"""
OCR fallback — Tesseract + parser kodów euro-pól.
Używany gdy kod Aztec jest nieczytelny.
"""
from __future__ import annotations
import re
import logging
from typing import Optional

import cv2
import numpy as np
from PIL import Image
import pytesseract
from pytesseract import Output

from .preprocessing import (
    pil_to_cv2, to_gray, adaptive_threshold, deskew_small_angle, osd_rotate_angle, rotate_pil,
)

logger = logging.getLogger(__name__)


def _confidence_avg(data: dict) -> float:
    confs = [int(c) for c in data["conf"] if str(c).lstrip("-").isdigit() and int(c) >= 0]
    return sum(confs) / len(confs) if confs else 0.0


def _run_tesseract_psm(arr: np.ndarray, psm: int) -> tuple[str, float, dict]:
    """Zwraca (tekst, avg_confidence, data_dict)."""
    data = pytesseract.image_to_data(
        arr, lang="pol+eng",
        config=f"--psm {psm} --oem 3",
        output_type=Output.DICT,
    )
    text = " ".join(w for w in data["text"] if w.strip())
    conf = _confidence_avg(data)
    return text, conf, data


def _preprocess_for_ocr(bgr: np.ndarray) -> np.ndarray:
    gray = to_gray(bgr)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    thresh = adaptive_threshold(denoised)
    kernel = np.ones((2, 2), np.uint8)
    dilated = cv2.dilate(thresh, kernel, iterations=1)
    return dilated


def run_ocr(pil_img: Image.Image) -> tuple[str, float, dict]:
    """
    Uruchamia Tesseract z korekcją orientacji i deskew.
    Zwraca (pełny_tekst, avg_confidence, raw_data).
    """
    # Korekcja orientacji przez OSD
    angle = osd_rotate_angle(pil_img)
    if angle:
        pil_img = rotate_pil(pil_img, angle)

    bgr = pil_to_cv2(pil_img)
    gray = to_gray(bgr)
    gray = deskew_small_angle(gray)
    processed = _preprocess_for_ocr(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR))

    # Dwa przebiegi PSM 6 i PSM 4 — wybierz lepszy wg confidence
    t6, c6, d6 = _run_tesseract_psm(processed, psm=6)
    t4, c4, d4 = _run_tesseract_psm(processed, psm=4)

    if c6 >= c4:
        return t6, c6 / 100.0, d6
    return t4, c4 / 100.0, d4


def _conf_for_word(data: dict, word: str) -> float:
    """Szuka słowa w danych Tesseracta i zwraca jego confidence (0–1)."""
    for i, w in enumerate(data["text"]):
        if w.strip() == word:
            c = int(data["conf"][i])
            if c >= 0:
                return c / 100.0
    return 0.5  # domyślna wartość gdy nie znaleziono


def _extract_near_conf(data: dict, pattern: str, text: str) -> float:
    """Wyciąga średnią confidence dla słów pasujących do wartości pola."""
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return 0.0
    value_words = m.group(1).strip().split()
    confs = [_conf_for_word(data, w) for w in value_words if w]
    return sum(confs) / len(confs) if confs else 0.3


# ── Parser pól euro-dowodu ──────────────────────────────────────────────────

def parse_fields(text: str, data: dict) -> dict[str, tuple[Optional[str], float]]:
    """
    Zwraca {nazwa_pola: (wartość, confidence)}.
    Pole nieznalezione → (None, 0.0).
    """
    result: dict[str, tuple[Optional[str], float]] = {}

    full = text.upper()

    def find(pat: str) -> Optional[re.Match]:
        return re.search(pat, text, re.IGNORECASE)

    def extract(key: str, pat: str, group: int = 1) -> None:
        m = find(pat)
        if m:
            val = m.group(group).strip()
            conf = _extract_near_conf(data, pat, text)
            result[key] = (val, max(conf, 0.3))
        else:
            result[key] = (None, 0.0)

    # A — numer rejestracyjny
    m = re.search(r'\bA\s*[:\|]?\s*([A-Z]{2,3}\s*[A-Z0-9]{4,5})\b', full)
    if m:
        val = re.sub(r'\s', '', m.group(1))
        result["numer_rejestracyjny"] = (val, 0.7)
    else:
        # fallback heurystyczny
        m2 = re.search(r'\b([A-Z]{2,3})([A-Z0-9]{4,5})\b', full)
        if m2:
            cand = m2.group(1) + m2.group(2)
            if not re.fullmatch(r'[A-Z]{17}', cand):
                result["numer_rejestracyjny"] = (cand, 0.4)
        else:
            result["numer_rejestracyjny"] = (None, 0.0)

    # B — data pierwszej rejestracji
    m = re.search(r'\bB\s*[:\|]?\s*(\d{2}[.\-/]\d{2}[.\-/]\d{4})\b', text, re.IGNORECASE)
    if m:
        result["data_pierwszej_rej"] = (m.group(1).replace("-", ".").replace("/", "."), 0.8)
    else:
        result["data_pierwszej_rej"] = (None, 0.0)

    # D.1 marka
    extract("marka", r'D\.?\s*1\s*[:\|]?\s*([A-Z][A-Z0-9\-\s]{1,20}?)(?:\s+D\.?\s*2|\n|$)')

    # D.2 typ
    extract("typ", r'D\.?\s*2\s*[:\|]?\s*([A-Z0-9][^\n]{1,30}?)(?:\n|$)')

    # D.3 model
    extract("model", r'D\.?\s*3\s*[:\|]?\s*([A-Z0-9][^\n]{1,30}?)(?:\n|$)')

    # E — VIN
    m = re.search(r'\b([A-HJ-NPR-Z0-9]{17})\b', full)
    if m:
        result["vin"] = (m.group(1), 0.85)
    else:
        result["vin"] = (None, 0.0)

    # F.1 DMC
    hits = [int(x) for x in re.findall(r'F\.?\s*1\s*[:\|]?\s*(\d{3,6})', text, re.IGNORECASE)
            if 500 <= int(x) <= 60000]
    result["f1_dmc"] = (str(max(hits)), 0.7) if hits else (None, 0.0)

    # F.2
    hits = [int(x) for x in re.findall(r'F\.?\s*2\s*[:\|]?\s*(\d{3,6})', text, re.IGNORECASE)
            if 500 <= int(x) <= 60000]
    result["f2_dmc_ladunek"] = (str(max(hits)), 0.7) if hits else (None, 0.0)

    # F.3
    hits = [int(x) for x in re.findall(r'F\.?\s*3\s*[:\|]?\s*(\d{3,6})', text, re.IGNORECASE)
            if 500 <= int(x) <= 60000]
    result["f3_dmc_zespol"] = (str(max(hits)), 0.7) if hits else (None, 0.0)

    # G masa własna
    m = re.search(r'\bG\s*[:\|]?\s*(\d{3,6})\s*(?:kg)?', text, re.IGNORECASE)
    if m:
        v = int(m.group(1))
        result["g_masa_wlasna"] = (str(v), 0.7) if 100 <= v <= 60000 else (None, 0.0)
    else:
        result["g_masa_wlasna"] = (None, 0.0)

    # O.1 przyczepa z hamulcem
    hits = [int(x) for x in re.findall(r'O\.?\s*1\s*[:\|]?\s*(\d{3,6})', text, re.IGNORECASE)
            if 100 <= int(x) <= 60000]
    result["o1_przyczepa_ham"] = (str(max(hits)), 0.6) if hits else (None, 0.0)

    # O.2 bez hamulca
    hits = [int(x) for x in re.findall(r'O\.?\s*2\s*[:\|]?\s*(\d{2,5})', text, re.IGNORECASE)
            if 50 <= int(x) <= 50000]
    result["o2_przyczepa_nieham"] = (str(hits[0]), 0.6) if hits else (None, 0.0)

    # P.1 pojemność
    m = re.search(r'P\.?\s*1\s*[:\|]?\s*(\d{3,5})', text, re.IGNORECASE)
    if m:
        v = int(m.group(1))
        result["p1_pojemnosc"] = (str(v), 0.75) if 50 <= v <= 20000 else (None, 0.0)
    else:
        result["p1_pojemnosc"] = (None, 0.0)

    # P.2 moc kW
    m = re.search(r'P\.?\s*2\s*[:\|]?\s*(\d{2,4})', text, re.IGNORECASE)
    if m:
        v = int(m.group(1))
        result["p2_moc_kw"] = (str(v), 0.75) if 1 <= v <= 1000 else (None, 0.0)
    else:
        result["p2_moc_kw"] = (None, 0.0)

    # P.3 paliwo
    m = re.search(r'P\.?\s*3\s*[:\|]?\s*([DBGPdbgp])\b', text, re.IGNORECASE)
    if m:
        fuel_map = {"D": "ON", "B": "PB", "G": "LPG", "P": "PB"}
        result["p3_paliwo"] = (fuel_map.get(m.group(1).upper(), m.group(1).upper()), 0.7)
    else:
        result["p3_paliwo"] = (None, 0.0)

    # S.1 miejsca siedzące
    m = re.search(r'S\.?\s*1\s*[:\|]?\s*(\d{1,3})', text, re.IGNORECASE)
    if m:
        v = int(m.group(1))
        result["s1_miejsca_siedz"] = (str(v), 0.7) if 1 <= v <= 90 else (None, 0.0)
    else:
        result["s1_miejsca_siedz"] = (None, 0.0)

    # S.2 miejsca stojące
    m = re.search(r'S\.?\s*2\s*[:\|]?\s*(\d{1,3})', text, re.IGNORECASE)
    if m:
        result["s2_miejsca_stojace"] = (m.group(1), 0.6)
    else:
        result["s2_miejsca_stojace"] = (None, 0.0)

    return result
