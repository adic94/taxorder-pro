"""
Detekcja i dekodowanie kodu Aztec z polskiego Dowodu Rejestracyjnego.

Kaskada odporności na orientację i jakość:
  a) oryginalny obraz
  b) rotacje 90°/180°/270°
  c) dla każdej orientacji: skala szarości, progowanie adaptacyjne, upscale 2×
  d) korekcja perspektywy → ponowne próby a–c
"""
from __future__ import annotations
import base64
import logging
from typing import Optional

import cv2
import numpy as np
from PIL import Image

try:
    import zxingcpp
    _ZXING_AVAILABLE = True
except ImportError:
    _ZXING_AVAILABLE = False

from .nrv2e import decode_aztec_payload
from .preprocessing import (
    pil_to_cv2, cv2_to_pil, to_gray, adaptive_threshold,
    find_document_quad, perspective_warp,
)

logger = logging.getLogger(__name__)

# Kolejność pól wg rozporządzenia MiR (format płaski, "|"-separated)
# Indeksy mogą się różnić między wersjami dowodów — mapujemy po nazwie
FIELD_ORDER = [
    "seria_dowodu",        # 0
    "numer_dowodu",        # 1
    "organ_wydajacy",      # 2
    "numer_rejestracyjny", # 3
    "marka",               # 4
    "typ",                 # 5
    "wariant",             # 6
    "wersja",              # 7
    "model",               # 8
    "vin",                 # 9
    "data_pierwszej_rej",  # 10
    "data_rej_aktualnej",  # 11
    "kategoria",           # 12
    # właściciel / posiadacz (personal_data)
    "wlasciciel_nazwa",    # 13
    "wlasciciel_adres",    # 14
    "posiadacz_nazwa",     # 15
    "posiadacz_adres",     # 16
    # masy
    "f1_dmc",              # 17
    "f2_dmc_ladunek",      # 18
    "f3_dmc_zespol",       # 19
    "g_masa_wlasna",       # 20
    "o1_przyczepa_ham",    # 21
    "o2_przyczepa_nieham", # 22
    # silnik
    "p1_pojemnosc",        # 23
    "p2_moc_kw",           # 24
    "p3_paliwo",           # 25
    # inne
    "liczba_osi",          # 26
    "s1_miejsca_siedz",    # 27
    "s2_miejsca_stojace",  # 28
    "nr_homologacji",      # 29
]

PERSONAL_FIELDS = {
    "wlasciciel_nazwa", "wlasciciel_adres",
    "posiadacz_nazwa", "posiadacz_adres",
}


def _read_aztec_from_array(arr: np.ndarray) -> Optional[str]:
    """Próbuje odczytać kod Aztec z tablicy numpy (BGR lub gray)."""
    if not _ZXING_AVAILABLE:
        return None
    try:
        if len(arr.shape) == 2:
            img_rgb = cv2.cvtColor(arr, cv2.COLOR_GRAY2RGB)
        else:
            img_rgb = cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
        results = zxingcpp.read_barcodes(img_rgb)
        for r in results:
            if "Aztec" in str(r.format):
                return r.text
        # Jeśli żadnego Azteca — zwróć None
        return None
    except Exception as e:
        logger.debug("zxing błąd: %s", e)
        return None


def _variants(bgr: np.ndarray) -> list[np.ndarray]:
    """Generuje warianty preprocessingu dla jednej orientacji."""
    gray = to_gray(bgr)
    thresh = adaptive_threshold(gray)
    h, w = bgr.shape[:2]
    upscaled = cv2.resize(bgr, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    return [bgr, gray, thresh, upscaled]


_ROTATIONS = [
    (cv2.ROTATE_90_CLOCKWISE,    90),
    (cv2.ROTATE_180,            180),
    (cv2.ROTATE_90_COUNTERCLOCKWISE, 270),
]


def _try_all_orientations(bgr: np.ndarray) -> Optional[str]:
    """Próbuje odczytać Aztec we wszystkich orientacjach i wariantach."""
    # a+b+c: oryginał + 3 rotacje, każda z wariantami
    candidates = [bgr] + [cv2.rotate(bgr, r) for r, _ in _ROTATIONS]
    for cand in candidates:
        for variant in _variants(cand):
            result = _read_aztec_from_array(variant)
            if result:
                return result
    return None


def extract_aztec(pil_img: Image.Image) -> Optional[dict]:
    """
    Próbuje wyekstrahować dane z kodu Aztec.
    Zwraca słownik pól lub None jeśli nie znaleziono.
    """
    if not _ZXING_AVAILABLE:
        logger.warning("zxing-cpp niedostępny — Aztec pomijany")
        return None

    bgr = pil_to_cv2(pil_img)

    # Próba a–c na obrazie oryginalnym i rotacjach
    raw_text = _try_all_orientations(bgr)

    # Próba d: korekcja perspektywy → ponowne próby
    if not raw_text:
        quad = find_document_quad(bgr)
        if quad is not None:
            warped = perspective_warp(bgr, quad)
            raw_text = _try_all_orientations(warped)

    if not raw_text:
        return None

    return _parse_aztec_text(raw_text)


def _parse_aztec_text(text: str) -> dict:
    """
    Dekoduje surowy tekst z Aztec (może być base64+NRV2E lub surowy UTF).
    Mapuje pola na nazwy z FIELD_ORDER.
    """
    # Sprawdź czy wygląda jak base64 (tylko znaki b64 + ewentualne padding)
    import re
    stripped = text.strip()
    if re.match(r'^[A-Za-z0-9+/=\-_]+$', stripped) and len(stripped) % 4 == 0:
        try:
            raw = base64.b64decode(stripped + "==")
            decoded = decode_aztec_payload(raw)
            parts = decoded.split("|")
        except Exception:
            # Fallback: traktuj jako plain tekst z "|"
            parts = stripped.split("|")
    else:
        parts = stripped.split("|")

    result = {}
    for i, val in enumerate(parts):
        val = val.strip()
        if not val:
            continue
        if i < len(FIELD_ORDER):
            key = FIELD_ORDER[i]
        else:
            key = f"pole_{i}"
        result[key] = val

    return result
