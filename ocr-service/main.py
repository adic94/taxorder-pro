"""
TaxOrder OCR Service — PaddleOCR backend dla polskich Dowodów Rejestracyjnych

Kluczowa przewaga nad Tesseract/Vision AI:
- PaddleOCR zwraca bounding boxy każdego tekstu → znamy jego pozycję Y na dokumencie
- DR ma 2 sekcje: beżowa (homologacja, BŁĘDNE wartości F) vs żółta tabela (PRAWIDŁOWE)
- Filtrujemy po y_rel > YELLOW_TABLE_THRESHOLD → czytamy tylko żółtą tabelę dla F.1/F.2/F.3/G
"""

import os
import re
import io
import base64
import logging
from typing import Optional

import numpy as np
from PIL import Image
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from paddleocr import PaddleOCR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="TaxOrder OCR Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Singleton OCR engine — inicjalizowany raz przy starcie
_ocr: Optional[PaddleOCR] = None

# Żółta tabela rejestracyjna DR zaczyna się mniej-więcej od 42% wysokości dokumentu.
# Wartości powyżej tego progu to sekcja homologacji (BEŻOWA) — ignorujemy dla F.1/F.2/F.3/G.
YELLOW_TABLE_THRESHOLD = 0.42


def get_ocr() -> PaddleOCR:
    global _ocr
    if _ocr is None:
        logger.info("Inicjalizacja PaddleOCR (pierwsze uruchomienie)...")
        _ocr = PaddleOCR(
            use_angle_cls=True,   # automatyczna detekcja orientacji tekstu
            lang="en",            # łaciński zestaw znaków (polskie DR używają liter łacińskich)
            use_gpu=False,
            show_log=False,
            enable_mkldnn=False,  # stabilność na CPU bez MKL
        )
        logger.info("PaddleOCR gotowy.")
    return _ocr


class OcrRequest(BaseModel):
    imageBase64: str
    mimeType: str = "image/jpeg"


# ── Ekstrakcja linii z bounding boxami ──────────────────────────────────────

def _extract_lines(paddle_result, img_height: int) -> list[dict]:
    lines = []
    if not paddle_result or not paddle_result[0]:
        return lines
    for item in paddle_result[0]:
        if not item or len(item) < 2:
            continue
        bbox, text_info = item
        if isinstance(text_info, (list, tuple)):
            text = str(text_info[0]) if text_info else ""
            conf = float(text_info[1]) if len(text_info) > 1 else 1.0
        else:
            text, conf = str(text_info), 1.0
        text = text.strip()
        if not text or conf < 0.25:
            continue
        ys = [pt[1] for pt in bbox]
        xs = [pt[0] for pt in bbox]
        y_c = sum(ys) / len(ys)
        x_c = sum(xs) / len(xs)
        lines.append({
            "text": text,
            "conf": conf,
            "y": y_c,
            "x": x_c,
            "y_rel": y_c / img_height if img_height > 0 else 0.5,
        })
    lines.sort(key=lambda l: l["y"])
    return lines


# ── Parser pól DR ─────────────────────────────────────────────────────────

def _parse_fields(lines: list[dict]) -> dict:
    full_text = "\n".join(l["text"] for l in lines)

    # Żółta tabela = dolna część dokumentu DR
    table_lines = [l for l in lines if l["y_rel"] > YELLOW_TABLE_THRESHOLD]
    table_text = "\n".join(l["text"] for l in table_lines)

    def find(pat: str, flags=re.IGNORECASE):
        """Szukaj najpierw w żółtej tabeli, potem w całym tekście."""
        m = re.search(pat, table_text, flags)
        return m if m else re.search(pat, full_text, flags)

    d: dict = {}

    # ── Numer rejestracyjny (pole A) ─────────────────────────────────────
    m = re.search(r"\b([A-Z]{2,3})\s*([A-Z0-9]{3,5})\b", full_text)
    if m:
        candidate = m.group(1) + m.group(2)
        if 5 <= len(candidate) <= 8 and not re.fullmatch(r"[A-Z]{17}", candidate):
            prefix = candidate[:2] if len(candidate) <= 7 else candidate[:3]
            suf = candidate[len(prefix):]
            suf = re.sub(r"(\d)O", r"\g<1>0", suf)
            suf = re.sub(r"O(\d)", r"0\1", suf)
            d["nrRej"] = prefix + suf

    # ── VIN (pole E) — 17 znaków ─────────────────────────────────────────
    m = re.search(r"\b([A-HJ-NPR-Z0-9]{17})\b", full_text.upper())
    if m:
        d["vin"] = m.group(1)

    # ── Marka (pole D.1) ─────────────────────────────────────────────────
    m = re.search(
        r"D\.?\s*1\s*[:\|]?\s*([A-Z][A-Z0-9\-\s]{1,20}?)(?:\s+D\.?\s*2|\n|$)",
        full_text, re.IGNORECASE,
    )
    if m:
        d["marka"] = m.group(1).strip()

    # ── Typ / model (pole D.2) ───────────────────────────────────────────
    m = re.search(
        r"D\.?\s*2\s*[:\|]?\s*([A-Z0-9][^\n]{1,30}?)(?:\n|D\.?\s*3|$)",
        full_text, re.IGNORECASE,
    )
    if m:
        d["typ"] = m.group(1).strip()

    # ── Data pierwszej rejestracji (pole B) ──────────────────────────────
    m = re.search(r"\b(\d{2}[.\-/]\d{2}[.\-/]\d{4})\b", full_text)
    if m:
        d["dataRej"] = m.group(1).replace("-", ".").replace("/", ".")

    # ── F.1 — DMC pojazdu (TYLKO z żółtej tabeli) ────────────────────────
    m = find(r"F[\s.:\-]?[1lI!i]\s*[:\|\-]?\s*(\d{3,6})")
    if m:
        v = int(m.group(1))
        if 500 <= v <= 200000:
            d["dmcKg"] = str(v)

    # ── F.2 — DMC z ładunkiem ────────────────────────────────────────────
    m = find(r"F[\s.:\-]?2\s*[:\|\-]?\s*(\d{3,6})")
    if m:
        v = int(m.group(1))
        if 500 <= v <= 200000:
            d["dmcKg2"] = str(v)

    # ── F.3 — DMC zespołu pojazdów ───────────────────────────────────────
    m = find(r"F[\s.:\-]?3\s*[:\|\-]?\s*(\d{3,6})")
    if m:
        v = int(m.group(1))
        if 500 <= v <= 200000:
            d["dmcZespolu"] = str(v)

    # F.3 musi być >= F.1 (jeśli odwrócone — zamień)
    if d.get("dmcKg") and d.get("dmcZespolu") and int(d["dmcKg"]) > int(d["dmcZespolu"]):
        d["dmcKg"], d["dmcZespolu"] = d["dmcZespolu"], d["dmcKg"]

    # ── G — masa własna ──────────────────────────────────────────────────
    m = find(r"\bG\s*[:\|]?\s*(\d{4,6})\s*(?:kg|Kg|KG)?")
    if m:
        v = int(m.group(1))
        if 100 <= v <= 100000:
            d["masaWlKg"] = str(v)
    # G musi być < F.1 (fizycznie niemożliwe żeby masa własna >= DMC)
    if d.get("masaWlKg") and d.get("dmcKg") and int(d["masaWlKg"]) >= int(d["dmcKg"]):
        del d["masaWlKg"]

    # ── Liczba osi (pole L) ──────────────────────────────────────────────
    m = find(r"\bL\s*[:\|]?\s*([1-5])\b")
    if m:
        d["liczbaOsi"] = m.group(1)

    # ── Kategoria (pole J) ───────────────────────────────────────────────
    m = find(r"\bJ\s*[:\|]?\s*([NMO][1-3]?[a-z]?)\b")
    if m:
        d["kategoria"] = m.group(1).upper()

    # ── Pojemność silnika cm³ (pole P.1) ─────────────────────────────────
    m = re.search(r"P\.?\s*1\s*[:\|]?\s*(\d{3,5})", full_text, re.IGNORECASE)
    if m:
        v = int(m.group(1))
        if 50 <= v <= 50000:
            d["pojSilnika"] = str(v)

    # ── Moc kW (pole P.2) ────────────────────────────────────────────────
    m = re.search(r"P\.?\s*2\s*[:\|]?\s*(\d{2,4})", full_text, re.IGNORECASE)
    if m:
        d["mocKW"] = m.group(1)

    # ── Paliwo (pole P.3): D=diesel, B=benzyna, G=LPG ───────────────────
    m = re.search(r"P\.?\s*3\s*[:\|]?\s*([DBG])\b", full_text, re.IGNORECASE)
    if m:
        d["paliwo"] = {"D": "ON", "B": "PB", "G": "LPG"}.get(m.group(1).upper(), m.group(1).upper())

    # ── Miejsca siedzące (pole S.1) ──────────────────────────────────────
    m = re.search(r"S\.?\s*1\s*[:\|]?\s*(\d{1,3})", full_text, re.IGNORECASE)
    if m:
        d["miejscaSied"] = m.group(1)

    # ── Rok produkcji ────────────────────────────────────────────────────
    rok_hits = re.findall(r"\b(19[5-9]\d|20[0-2]\d)\b", full_text)
    if rok_hits:
        d["rokProd"] = rok_hits[-1]

    return d


# ── Przetwarzanie obrazu ─────────────────────────────────────────────────

def _process_image(img_bytes: bytes) -> dict:
    ocr = get_ocr()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    def run_ocr(pil_img: Image.Image):
        arr = np.array(pil_img)
        result = ocr.ocr(arr, cls=True)
        h = pil_img.height
        lines = _extract_lines(result, h)
        count = len(result[0]) if result and result[0] else 0
        return lines, count

    lines_orig, count_orig = run_ocr(img)

    # Jeśli DR zeskanowany bokiem (co jest typowe) — spróbuj 90° i 270°
    best_lines, best_count = lines_orig, count_orig
    for angle in (90, 270):
        rotated = img.rotate(angle, expand=True)
        lines_r, count_r = run_ocr(rotated)
        if count_r > best_count * 1.25:
            best_lines, best_count = lines_r, count_r

    return _parse_fields(best_lines)


# ── Endpointy ────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "service": "taxorder-ocr", "engine": "paddleocr"}


@app.on_event("startup")
async def startup():
    get_ocr()  # warm-up — pobierz modele przy starcie, nie przy pierwszym żądaniu


@app.post("/ocr")
async def run_ocr(
    req: OcrRequest,
    x_api_key: Optional[str] = Header(default=None),
):
    api_secret = os.getenv("API_SECRET")
    if api_secret and x_api_key != api_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        img_bytes = base64.b64decode(req.imageBase64)
        fields = _process_image(img_bytes)
        return {"ok": True, "fields": fields, "model": "paddleocr"}
    except Exception as e:
        logger.exception("Błąd OCR")
        return {"ok": False, "error": str(e), "fields": {}}
