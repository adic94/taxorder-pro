"""
TaxOrder OCR Service — ekstrakcja danych z polskich Dowodów Rejestracyjnych

Kaskada przetwarzania:
  Etap 0 — normalizacja wejścia (EXIF, PDF→obrazy, limit rozmiaru)
  Etap 1 — kod Aztec przez zxing-cpp (confidence 1.0)
  Etap 2 — OCR Tesseract + parser euro-pól (gdy Aztec nieczytelny)
  Etap 3 — Claude Vision (opcjonalny, gdy ANTHROPIC_API_KEY ustawiony)

Limity bezpieczeństwa:
  - max 15 MB wejście
  - walidacja po magic bytes (nie Content-Type)
  - plik przetwarzany wyłącznie w pamięci (RODO — bez trwałej kopii)
  - timeout 60 s przez asyncio
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import time
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pytesseract

from extractors.schema import ExtractionResponse, FieldValue, OwnerFields
from extractors.preprocessing import load_images_from_bytes
from extractors.aztec import extract_aztec, PERSONAL_FIELDS
from extractors.ocr_fallback import run_ocr, parse_fields
from extractors.validators import (
    validate_vin, validate_nrrej, validate_date,
    validate_mass, validate_capacity, validate_power, validate_seats,
    check_mass_consistency,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB
PROCESSING_TIMEOUT = 60  # sekund

ALLOWED_MAGIC = {
    b'\xff\xd8\xff': "image/jpeg",
    b'\x89PNG':       "image/png",
    b'%PDF':          "application/pdf",
}

app = FastAPI(title="TaxOrder OCR Service", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Stary endpoint (kompatybilność wsteczna) ─────────────────────────────────

class _OcrRequest:
    pass

from pydantic import BaseModel as _BM
class OcrRequest(_BM):
    imageBase64: str
    mimeType: str = "image/jpeg"

@app.post("/ocr")
async def run_ocr_legacy(
    req: OcrRequest,
    x_api_key: Optional[str] = Header(default=None),
):
    api_secret = os.getenv("API_SECRET")
    if api_secret and x_api_key != api_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        img_bytes = base64.b64decode(req.imageBase64)
        from extractors.preprocessing import load_images_from_bytes as _lib
        images = _lib(img_bytes)
        if not images:
            return {"ok": False, "error": "Brak obrazów", "fields": {}}
        fields = _legacy_parse(images[0])
        return {"ok": True, "fields": fields, "model": "tesseract-server"}
    except Exception as e:
        logger.exception("OCR legacy error")
        return {"ok": False, "error": str(e), "fields": {}}


def _legacy_parse(pil_img: Image.Image) -> dict:
    """Uproszczony parser na potrzeby kompatybilności /ocr."""
    text, conf, data = run_ocr(pil_img)
    parsed = parse_fields(text, data)
    out = {}
    LEGACY_MAP = {
        "numer_rejestracyjny": "nrRej",
        "vin": "vin",
        "marka": "marka",
        "typ": "typ",
        "model": "model",
        "data_pierwszej_rej": "dataRej",
        "f1_dmc": "dmcKg",
        "g_masa_wlasna": "masaWlKg",
        "p1_pojemnosc": "pojSilnika",
        "p2_moc_kw": "mocKW",
        "p3_paliwo": "paliwo",
        "s1_miejsca_siedz": "miejscaSied",
    }
    for new_key, old_key in LEGACY_MAP.items():
        val, _ = parsed.get(new_key, (None, 0))
        if val:
            out[old_key] = val
    return out


# ── Nowy endpoint ─────────────────────────────────────────────────────────────

def _detect_mime(data: bytes) -> Optional[str]:
    for magic, mime in ALLOWED_MAGIC.items():
        if data[:len(magic)] == magic:
            return mime
    return None


def _build_field(value, conf: float, needs_review: bool = False, personal: bool = False) -> FieldValue:
    return FieldValue(
        value=value,
        confidence=conf,
        needs_review=needs_review,
        personal_data=personal,
    )


def _apply_validators(fields: dict, warnings: list[str]) -> dict:
    """Waliduje pola in-place, dodaje needs_review i warnings."""

    def _check(key: str, validator, *args):
        fv = fields.get(key)
        if fv and fv.value:
            ok, msg = validator(fv.value, *args)
            if not ok:
                fv.needs_review = True
                warnings.append(f"{key}: {msg}")

    _check("vin", validate_vin)
    _check("numer_rejestracyjny", validate_nrrej)
    _check("data_pierwszej_rej", validate_date)
    _check("data_rej_aktualnej", validate_date)

    for mass_key in ("f1_dmc", "f2_dmc_ladunek", "f3_dmc_zespol", "g_masa_wlasna",
                     "o1_przyczepa_ham", "o2_przyczepa_nieham"):
        _check(mass_key, validate_mass, mass_key)

    _check("p1_pojemnosc", validate_capacity)
    _check("p2_moc_kw", validate_power)
    _check("s1_miejsca_siedz", validate_seats)

    # Spójność F.1 ≥ G
    f1 = fields.get("f1_dmc")
    g = fields.get("g_masa_wlasna")
    f1_val = int(f1.value) if f1 and f1.value else None
    g_val  = int(g.value)  if g  and g.value  else None
    warn = check_mass_consistency(f1_val, g_val)
    if warn:
        warnings.append(warn)

    return fields


async def _process_upload(data: bytes) -> ExtractionResponse:
    t0 = time.monotonic()
    warnings: list[str] = []

    mime = _detect_mime(data)
    if not mime:
        return ExtractionResponse(
            status="error",
            source="none",
            warnings=["Nieobsługiwany format pliku (oczekiwano JPG, PNG lub PDF)"],
            processing_ms=int((time.monotonic() - t0) * 1000),
        )

    try:
        images = load_images_from_bytes(data)
    except Exception as e:
        return ExtractionResponse(
            status="error",
            source="none",
            warnings=[f"Błąd wczytywania pliku: {e}"],
            processing_ms=int((time.monotonic() - t0) * 1000),
        )

    pages_processed = len(images)
    fields_raw: dict[str, FieldValue] = {}
    owner_fields: dict[str, FieldValue] = {}
    source = "none"

    # ── Etap 1: Aztec ─────────────────────────────────────────────────────
    for pil_img in images:
        aztec_data = extract_aztec(pil_img)
        if aztec_data:
            source = "aztec"
            for key, val in aztec_data.items():
                if not val:
                    continue
                is_personal = key in PERSONAL_FIELDS
                fv = _build_field(val, 1.0, personal=is_personal)
                if is_personal:
                    owner_fields[key] = fv
                else:
                    fields_raw[key] = fv
            break  # pierwsza strona z Aztec wystarczy

    # ── Etap 2: OCR fallback ───────────────────────────────────────────────
    if source == "none":
        best_conf = -1.0
        best_parsed: dict[str, tuple] = {}
        for pil_img in images:
            try:
                text, avg_conf, tess_data = run_ocr(pil_img)
                parsed = parse_fields(text, tess_data)
                filled = sum(1 for v, _ in parsed.values() if v)
                score = avg_conf + filled * 0.01
                if score > best_conf:
                    best_conf = score
                    best_parsed = parsed
            except Exception as e:
                warnings.append(f"Błąd OCR strony: {e}")

        if best_parsed:
            source = "ocr"
            for key, (val, conf) in best_parsed.items():
                if val is None:
                    continue
                is_personal = key in PERSONAL_FIELDS
                fv = _build_field(val, conf, personal=is_personal)
                if is_personal:
                    owner_fields[key] = fv
                else:
                    fields_raw[key] = fv

    # ── Etap 3: Claude Vision (opcjonalny) ────────────────────────────────
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    filled_count = sum(1 for fv in fields_raw.values() if fv.value)
    if anthropic_key and filled_count < 5 and images:
        try:
            import anthropic
            buf = io.BytesIO()
            images[0].save(buf, format="JPEG", quality=85)
            img_b64 = base64.b64encode(buf.getvalue()).decode()
            client = anthropic.Anthropic(api_key=anthropic_key)
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64},
                        },
                        {
                            "type": "text",
                            "text": (
                                "To jest skan polskiego dowodu rejestracyjnego. "
                                "Zwróć TYLKO obiekt JSON z polami euro-dowodu: "
                                "numer_rejestracyjny, vin, marka, typ, model, "
                                "data_pierwszej_rej (DD.MM.YYYY), f1_dmc, g_masa_wlasna, "
                                "p1_pojemnosc, p2_moc_kw, p3_paliwo, s1_miejsca_siedz. "
                                "Pola nieznalezione ustaw na null. Bez komentarzy."
                            ),
                        },
                    ],
                }],
            )
            import json
            vision_raw = msg.content[0].text.strip()
            # Wyodrębnij JSON nawet jeśli model opakował go w markdown
            import re as _re
            jm = _re.search(r'\{.*\}', vision_raw, _re.DOTALL)
            if jm:
                vision_data = json.loads(jm.group(0))
                source = "vision"
                for key, val in vision_data.items():
                    if val is not None and key not in fields_raw:
                        fields_raw[key] = _build_field(str(val), 0.7)
        except Exception as e:
            warnings.append(f"Claude Vision pominięty: {e}")

    # ── Walidacja ─────────────────────────────────────────────────────────
    _apply_validators(fields_raw, warnings)

    owner = OwnerFields(
        present=bool(owner_fields),
        personal_data=True,
        fields=owner_fields,
    )

    return ExtractionResponse(
        status="ok",
        source=source,
        pages_processed=pages_processed,
        fields=fields_raw,
        owner=owner,
        warnings=warnings,
        processing_ms=int((time.monotonic() - t0) * 1000),
    )


@app.post("/extract/dowod-rejestracyjny", response_model=ExtractionResponse)
async def extract_dr(
    file: UploadFile = File(...),
    x_api_key: Optional[str] = Header(default=None),
):
    # Uwierzytelnienie
    api_secret = os.getenv("API_SECRET")
    if api_secret and x_api_key != api_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Limit rozmiaru
    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Plik zbyt duży (max 15 MB)")

    # Przetwarzanie z timeoutem
    try:
        response = await asyncio.wait_for(
            _process_upload(data),
            timeout=PROCESSING_TIMEOUT,
        )
    except asyncio.TimeoutError:
        return ExtractionResponse(
            status="timeout",
            source="none",
            warnings=["Przekroczono limit czasu przetwarzania (60 s)"],
        )
    except Exception as e:
        logger.exception("Błąd ekstrakcji DR")
        return ExtractionResponse(
            status="error",
            source="none",
            warnings=[f"Wewnętrzny błąd serwisu: {e}"],
        )
    finally:
        # Dane są tylko w pamięci — jawne zwolnienie referencji (RODO)
        del data

    return response


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/")
def health():
    try:
        ver = str(pytesseract.get_tesseract_version())
    except Exception:
        ver = "unknown"
    return {
        "status": "ok",
        "service": "taxorder-ocr",
        "version": "3.0.0",
        "engine": f"tesseract-{ver}",
    }
