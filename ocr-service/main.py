"""
TaxOrder OCR Service — pytesseract backend dla polskich Dowodów Rejestracyjnych

Dlaczego pytesseract zamiast PaddleOCR:
- PaddleOCR wymaga ~800MB RAM → Railway free tier (512MB) → OOM Killed
- pytesseract: ~150MB RAM, sprawdzona technologia, server-side preprocessing

Kluczowa funkcja: image_to_data() zwraca bounding boxy każdego słowa
→ filtrujemy po y_rel > 0.28 → czytamy F.1/F.2/F.3/G TYLKO z żółtej tabeli
→ sekcja homologacji (beżowa = TOP, y_rel 0-0.25) jest pomijana
"""

import os
import re
import io
import base64
import logging
from typing import Optional

import cv2
import numpy as np
from PIL import Image
import pytesseract
from pytesseract import Output
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="TaxOrder OCR Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Żółta tabela rejestracyjna DR: y_rel 0.28 – 0.78 (portret)
YELLOW_Y_MIN = 0.28
YELLOW_Y_MAX = 0.78


class OcrRequest(BaseModel):
    imageBase64: str
    mimeType: str = "image/jpeg"


# ── Preprocessing ─────────────────────────────────────────────────────────────

def _preprocess(img: Image.Image) -> np.ndarray:
    """Grayscale + adaptive threshold — eliminuje kolorowe tła DR (żółte/beżowe)."""
    arr = np.array(img.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    enhanced = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 11,
    )
    return enhanced


# ── Ekstrakcja linii z bounding boxami ────────────────────────────────────────

def _run_tesseract(arr: np.ndarray, img_h: int, img_w: int) -> list[dict]:
    """Zwraca linie tekstu z pozycją y_rel i x_rel w obrazie."""
    data = pytesseract.image_to_data(
        arr, lang="pol+eng",
        config="--psm 11 --oem 3",
        output_type=Output.DICT,
    )
    groups: dict = {}
    n = len(data["text"])
    for i in range(n):
        word = data["text"][i].strip()
        conf = int(data["conf"][i])
        if not word or conf < 10:
            continue
        x = data["left"][i]
        y = data["top"][i]
        w = data["width"][i]
        h = data["height"][i]
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        if key not in groups:
            groups[key] = {"words": [], "xs": [], "ys": []}
        groups[key]["words"].append(word)
        groups[key]["xs"].append(x + w / 2)
        groups[key]["ys"].append(y + h / 2)

    lines = []
    for grp in groups.values():
        text = " ".join(grp["words"]).strip()
        if not text:
            continue
        xc = sum(grp["xs"]) / len(grp["xs"])
        yc = sum(grp["ys"]) / len(grp["ys"])
        lines.append({
            "text": text,
            "x": xc, "y": yc,
            "x_rel": xc / img_w if img_w > 0 else 0.5,
            "y_rel": yc / img_h if img_h > 0 else 0.5,
        })
    lines.sort(key=lambda l: l["y"])
    return lines


# ── Parser pól DR ─────────────────────────────────────────────────────────────

def _parse_fields(lines: list[dict], is_landscape: bool = False) -> dict:
    full_text = "\n".join(l["text"] for l in lines)

    if is_landscape:
        # Landscape: sekcje różnią się po X (beżowa = PRAWA strona, x_rel > 0.60)
        table_lines = [l for l in lines if 0.10 < l["x_rel"] < 0.63]
    else:
        # Portret: sekcje różnią się po Y (beżowa = GÓRA, y_rel < 0.28)
        table_lines = [l for l in lines if YELLOW_Y_MIN < l["y_rel"] < YELLOW_Y_MAX]

    table_text = "\n".join(l["text"] for l in table_lines)

    def find(pat: str, flags=re.IGNORECASE):
        m = re.search(pat, table_text, flags)
        return m if m else re.search(pat, full_text, flags)

    def find_all(pat: str) -> list[int]:
        """Zbierz WSZYSTKICH kandydatów — najpierw z żółtej tabeli."""
        hits = [int(m.group(1)) for m in re.finditer(pat, table_text, re.IGNORECASE)]
        if not hits:
            hits = [int(m.group(1)) for m in re.finditer(pat, full_text, re.IGNORECASE)]
        return hits

    d: dict = {}

    # ── Numer rejestracyjny (pole A) ──────────────────────────────────────
    for m in re.finditer(r"\b([A-Z]{2,3})\s*([A-Z0-9]{3,5})\b", full_text):
        cand = m.group(1) + m.group(2)
        if 5 <= len(cand) <= 8 and not re.fullmatch(r"[A-Z]{17}", cand):
            pfx = cand[:2] if len(cand) <= 7 else cand[:3]
            suf = cand[len(pfx):]
            # Normalizacja O↔0 w sufixie
            suf = re.sub(r"(\d)O", r"\g<1>0", suf)
            suf = re.sub(r"O(\d)", r"0\1", suf)
            # Usuń zdublowane zera powstałe po normalizacji (00 → 0)
            suf = re.sub(r"00", "0", suf)
            if re.fullmatch(r"[A-Z0-9]{2,6}", suf):
                d["nrRej"] = pfx + suf
                break

    # ── VIN (pole E) — 17 znaków ─────────────────────────────────────────
    m = re.search(r"\b([A-HJ-NPR-Z0-9]{17})\b", full_text.upper())
    if m:
        d["vin"] = m.group(1)

    # ── Marka (pole D.1) ─────────────────────────────────────────────────
    m = re.search(r"D\.?\s*1\s*[:\|]?\s*([A-Z][A-Z0-9\-\s]{1,20}?)(?:\s+D\.?\s*2|\n|$)",
                  full_text, re.IGNORECASE)
    if m:
        d["marka"] = m.group(1).strip()

    # ── Typ / model (pole D.2) ───────────────────────────────────────────
    m = re.search(r"D\.?\s*2\s*[:\|]?\s*([A-Z0-9][^\n]{1,30}?)(?:\n|$)",
                  full_text, re.IGNORECASE)
    if m:
        d["typ"] = m.group(1).strip()

    # ── Data rejestracji (pole B) — DD.MM.YYYY ────────────────────────────
    for dt_match in re.finditer(r"\b(\d{2}[.\-/]\d{2}[.\-/]\d{4})\b", full_text):
        norm = dt_match.group(1).replace("-", ".").replace("/", ".")
        parts = norm.split(".")
        if len(parts) == 3:
            dd, mm, yyyy = parts
            if 1970 <= int(yyyy) <= 2026 and 1 <= int(mm) <= 12 and 1 <= int(dd) <= 31:
                d["dataRej"] = norm
                break

    # ── F.1 — DMC pojazdu (WIELE kandydatów → wybierz max z tabeli) ───────
    # Max bo: zarejestrowany DMC (żółta tabela) ≥ DMC homologacji (beżowa)
    f1 = [v for v in find_all(r"F[\s.:\-]?[1lI!i]\s*[:\|\-]?\s*(\d{3,6})") if 500 <= v <= 200000]
    if f1:
        d["dmcKg"] = str(max(f1))

    # ── F.2 — DMC z ładunkiem ────────────────────────────────────────────
    f2 = [v for v in find_all(r"F[\s.:\-]?2\s*[:\|\-]?\s*(\d{3,6})") if 500 <= v <= 200000]
    if f2:
        d["dmcKg2"] = str(max(f2))

    # ── F.3 — DMC zespołu pojazdów ───────────────────────────────────────
    f3 = [v for v in find_all(r"F[\s.:\-]?3\s*[:\|\-]?\s*(\d{3,6})") if 500 <= v <= 200000]
    if f3:
        d["dmcZespolu"] = str(max(f3))

    # F.3 >= F.1 (jeśli odwrócone — zamień)
    if d.get("dmcKg") and d.get("dmcZespolu") and int(d["dmcKg"]) > int(d["dmcZespolu"]):
        d["dmcKg"], d["dmcZespolu"] = d["dmcZespolu"], d["dmcKg"]

    # ── G — masa własna ──────────────────────────────────────────────────
    m = find(r"\bG\s*[:\|]?\s*(\d{4,6})\s*(?:kg|Kg|KG)?")
    if m:
        v = int(m.group(1))
        if 100 <= v <= 100000:
            d["masaWlKg"] = str(v)
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

    # ── Pojemność cm³ (pole P.1) ──────────────────────────────────────────
    m = re.search(r"P\.?\s*1\s*[:\|]?\s*(\d{3,5})", full_text, re.IGNORECASE)
    if m:
        v = int(m.group(1))
        if 50 <= v <= 50000:
            d["pojSilnika"] = str(v)

    # ── Moc kW (pole P.2) ─────────────────────────────────────────────────
    m = re.search(r"P\.?\s*2\s*[:\|]?\s*(\d{2,4})", full_text, re.IGNORECASE)
    if m:
        d["mocKW"] = m.group(1)

    # ── Paliwo (pole P.3): D=diesel B=benzyna G=LPG ──────────────────────
    m = re.search(r"P\.?\s*3\s*[:\|]?\s*([DBG])\b", full_text, re.IGNORECASE)
    if m:
        d["paliwo"] = {"D": "ON", "B": "PB", "G": "LPG"}.get(m.group(1).upper(), m.group(1).upper())

    # ── Miejsca siedzące (pole S.1) ───────────────────────────────────────
    m = re.search(r"S\.?\s*1\s*[:\|]?\s*(\d{1,3})", full_text, re.IGNORECASE)
    if m:
        d["miejscaSied"] = m.group(1)

    # ── Rok produkcji ─────────────────────────────────────────────────────
    rok_hits = re.findall(r"\b(19[5-9]\d|20[0-2]\d)\b", full_text)
    if rok_hits:
        d["rokProd"] = rok_hits[-1]

    return d


# ── Przetwarzanie obrazu (multi-rotation) ─────────────────────────────────────

def _process_image(img_bytes: bytes) -> dict:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    best_lines: list[dict] = []
    best_count = 0
    best_is_landscape = False

    for angle in (0, 90, 270):
        rot = img.rotate(angle, expand=True) if angle else img
        is_land = rot.width > rot.height * 1.2
        proc = _preprocess(rot)
        h, w = proc.shape[0], proc.shape[1]
        lines = _run_tesseract(proc, h, w)
        if len(lines) > best_count:
            best_count = len(lines)
            best_lines = lines
            best_is_landscape = is_land

    return _parse_fields(best_lines, is_landscape=best_is_landscape)


# ── Endpointy ────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    try:
        ver = str(pytesseract.get_tesseract_version())
    except Exception:
        ver = "unknown"
    return {"status": "ok", "service": "taxorder-ocr", "engine": f"tesseract-{ver}"}


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
        return {"ok": True, "fields": fields, "model": "tesseract-server"}
    except Exception as e:
        logger.exception("OCR error")
        return {"ok": False, "error": str(e), "fields": {}}
