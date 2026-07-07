"""
Detekcja kodu Aztec z obrazu DR przez zxing-cpp + dekodowanie przez AztecDecoder.

Kaskada odporności na orientację i jakość:
  a) obraz oryginalny
  b) rotacje 90°/180°/270° (cv2.rotate)
  c) dla każdej orientacji: warianty preprocessing (skala szarości,
     progowanie adaptacyjne, upscale 2×)
  d) korekcja perspektywy (Canny → findContours → warpPerspective)
     → ponowne próby a–c na wyprostowanym dokumencie
"""
from __future__ import annotations
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
    zxingcpp = None  # type: ignore[assignment]

from .aztec_decoder import AztecDecoder, PERSONAL_FIELDS
from .preprocessing import (
    pil_to_cv2, to_gray, adaptive_threshold,
    find_document_quad, perspective_warp,
)

logger = logging.getLogger(__name__)

_ROTATIONS = [
    cv2.ROTATE_90_CLOCKWISE,
    cv2.ROTATE_180,
    cv2.ROTATE_90_COUNTERCLOCKWISE,
]


def _read_raw(arr: np.ndarray) -> Optional[bytes]:
    """
    Próbuje odczytać kod Aztec z tablicy numpy.
    Zwraca surowe bajty payloadu (result.bytes) lub None.
    """
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
                # Preferuj r.bytes (binarne), fallback na r.text.encode()
                raw = getattr(r, "bytes", None)
                if raw:
                    return bytes(raw)
                text = getattr(r, "text", None)
                if text:
                    return text.encode("ascii", errors="replace")
    except Exception as e:
        logger.debug("zxing błąd: %s", e)
    return None


def _variants(bgr: np.ndarray) -> list[np.ndarray]:
    gray = to_gray(bgr)
    thresh = adaptive_threshold(gray)
    h, w = bgr.shape[:2]
    upscaled = cv2.resize(bgr, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    return [bgr, gray, thresh, upscaled]


def _try_all_orientations(bgr: np.ndarray) -> Optional[bytes]:
    candidates = [bgr] + [cv2.rotate(bgr, r) for r in _ROTATIONS]
    for cand in candidates:
        for variant in _variants(cand):
            raw = _read_raw(variant)
            if raw:
                return raw
    return None


def extract_aztec(pil_img: Image.Image) -> Optional[dict]:
    """
    Próbuje wyekstrahować i zdekodować dane z kodu Aztec DR.

    Zwraca słownik pól DR lub None gdy:
      - zxingcpp niedostępny
      - libucl1 niedostępna
      - kod Aztec nieczytelny
    """
    if not _ZXING_AVAILABLE:
        logger.warning("zxing-cpp niedostępny — etap Aztec pomijany")
        return None

    decoder = AztecDecoder.try_get()
    if decoder is None:
        logger.warning("AztecDecoder niedostępny — etap Aztec pomijany")
        return None

    bgr = pil_to_cv2(pil_img)

    # Próby a–c: oryginał + rotacje + warianty
    raw_bytes = _try_all_orientations(bgr)

    # Próba d: korekcja perspektywy → ponowne próby
    if not raw_bytes:
        quad = find_document_quad(bgr)
        if quad is not None:
            warped = perspective_warp(bgr, quad)
            raw_bytes = _try_all_orientations(warped)

    if not raw_bytes:
        return None

    try:
        fields = decoder.decode(raw_bytes)
    except (ValueError, RuntimeError) as e:
        logger.warning("Błąd dekodowania payloadu Aztec: %s", e)
        return None

    return fields
