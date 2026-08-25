"""
OCR fallback — RapidOCR (ONNX Runtime, lang="latin") + parser GEOMETRYCZNY.

DLACZEGO RapidOCR, NIE PaddleOCR (którym ten moduł był do 25.08, patrz historia
git `paddle_fields.py`). PaddleOCR wymaga frameworka `paddlepaddle`, a jego
akcelerator CPU oneDNN PADA TWARDYM CRASHEM procesu na Cloud Run — dwie różne
awarie (SIGFPE, NotImplementedError) na dwóch różnych wersjach paddlepaddle,
patrz historia `requirements.txt`. Wyłączenie akceleratora (`enable_mkldnn=False`)
usuwało crash, ale kosztem prędkości — 30-90s/dokument, za wolno na limit 8s
Workera. RapidOCR (github.com/RapidAI/RapidOCR, 7.5k★) to TE SAME modele PP-OCR
(w tym `latin_PP-OCRv5_rec_mobile`, obejmujący polskie znaki), skonwertowane do
ONNX i uruchamiane przez ONNX Runtime — inny silnik wykonawczy, bez frameworka
Paddle i bez jego błędów w oneDNN.

PUŁAPKA PRZY MIGRACJI: RapidOCR ma klasyfikator kąta TYLKO na poziomie
POJEDYNCZEJ LINII tekstu (0°/180°, moduł "Cls") — NIE ma odpowiednika
`use_doc_orientation_classify` z PaddleOCR/PaddleX (klasyfikacja obrotu CAŁEJ
STRONY 0/90/180/270). Bez tego klaster "Toyota Hilux GR" (strona narysowana
w orientacji pionowej, patrz WE6LR80 — pierwszy dowód, na którym to wykryto
25.08) znowu dawałby zero pól. Załatane Tesseract OSD (`osd_rotate_angle` w
`preprocessing.py`) — TANIE, bo liczy tylko kąt strony ze statystyki kształtów
liter, nie robi pełnego rozpoznawania tekstu. Ten sam mechanizm był już w
kodzie PRZED przejściem na PaddleOCR (`ocr_fallback.run_ocr()`) — rozpoznawanie
tekstu było wtedy złej jakości (regex na spłaszczonym tekście), ale wykrywanie
KĄTA nigdy nie było zdiagnozowane jako zepsute.

Parser geometryczny (Box, FIELD_LABELS, parse_fields_spatial) jest NIEZALEŻNY
od silnika OCR — działa na już wyekstrahowanej liście (tekst, bbox, pewność),
więc migracja dotyka WYŁĄCZNIE `_get_ocr()`/`run_rapid_ocr()` niżej.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Instancja RapidOCR ładuje modele ONNX raz na proces — singleton budowany przy
# PIERWSZYM wywołaniu, nie przy imporcie (żeby / (health check) nie płacił kosztu).
_OCR_SINGLETON = None


def _get_ocr():
    global _OCR_SINGLETON
    if _OCR_SINGLETON is None:
        from rapidocr import RapidOCR, LangRec, OCRVersion, ModelType
        logger.info("Ładowanie modeli RapidOCR (Rec.lang_type=LATIN)...")
        _OCR_SINGLETON = RapidOCR(
            params={
                # LangRec.LATIN obejmuje jęz. polski (grupa Latin-script w PP-OCRv5,
                # ten sam model co poprzednio pod PaddleOCR: latin_PP-OCRv5_rec_mobile).
                # Wartości MUSZĄ być z enumów (rapidocr.utils.typings), nie gołym
                # stringiem — "must be Enum Type" zmierzone na buildzie 25.08.
                # Detekcja (Det) zostaje domyślna — nie jest specyficzna językowo.
                "Rec.lang_type": LangRec.LATIN,
                "Rec.ocr_version": OCRVersion.PPOCRV5,
                "Rec.model_type": ModelType.MOBILE,
            }
        )
        logger.info("Modele RapidOCR załadowane.")
    return _OCR_SINGLETON


@dataclass
class Box:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    score: float

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def h(self) -> float:
        return self.y1 - self.y0


def run_rapid_ocr(pil_img: Image.Image) -> list[Box]:
    """Prostuje obrót CAŁEJ STRONY (Tesseract OSD), uruchamia RapidOCR, zwraca listę pól z pozycją."""
    from .preprocessing import osd_rotate_angle, rotate_pil

    angle = osd_rotate_angle(pil_img)
    if angle:
        logger.info("OSD wykrył obrót strony: %d°, prostuję przed OCR", angle)
        pil_img = rotate_pil(pil_img, angle)

    arr = np.array(pil_img.convert("RGB"))
    ocr = _get_ocr()
    result = ocr(arr)

    boxes: list[Box] = []
    if result is None or result.boxes is None:
        return boxes
    for poly, text, score in zip(result.boxes, result.txts, result.scores):
        text = (text or "").strip()
        if not text:
            continue
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        boxes.append(Box(text=text, x0=float(min(xs)), y0=float(min(ys)), x1=float(max(xs)), y1=float(max(ys)), score=float(score)))
    return boxes


# ── Katalog etykiet euro-dowodu ─────────────────────────────────────────────
# klucz wyjściowy → (regex etykiety w OSOBNYM boxie, kierunek szukania wartości:
# 'right' | 'below' | 'any')
#
# Klucze WYJŚCIOWE dokładnie jak w snake_case parserze Tesseracta (ocr_fallback.py)
# — `main.py` i `extractors/validators.py` są na nie napisane, nie duplikujemy
# konwencji nazw. Rozszerzone o 7 pól, których TAMTEN parser nie miał wcale
# (przeznaczenie, liczba_osi, kategoria, rok_prod, nr_homolog — plus norma_euro
# i zawieszenie, które dostają osobne, tekstowe wyszukiwanie niżej, bo żyją w
# wolnym tekście adnotacji urzędowych, nie w jednej komórce tabeli).
FIELD_LABELS: dict[str, tuple[str, str]] = {
    "numer_rejestracyjny":   (r"^A$", "right"),
    "data_pierwszej_rej":    (r"^B$", "right"),
    "marka":                 (r"^D\.?\s*1$", "right"),
    "typ":                   (r"^D\.?\s*2$", "right"),
    "model":                 (r"^D\.?\s*3$", "right"),
    "vin":                   (r"^E$", "right"),
    "f1_dmc":                (r"^F\.?\s*1$", "right"),
    "f2_dmc_ladunek":        (r"^F\.?\s*2$", "right"),
    "f3_dmc_zespol":         (r"^F\.?\s*3$", "right"),
    "g_masa_wlasna":         (r"^G$", "right"),
    "kategoria":             (r"^J$", "right"),
    "liczba_osi":            (r"^L$", "right"),
    "nr_homolog":            (r"^K$", "right"),
    "o1_przyczepa_ham":      (r"^O\.?\s*1$", "right"),
    "o2_przyczepa_nieham":   (r"^O\.?\s*2$", "right"),
    "p1_pojemnosc":          (r"^P\.?\s*1$", "right"),
    "p2_moc_kw":             (r"^P\.?\s*2$", "right"),
    "p3_paliwo":             (r"^P\.?\s*3$", "right"),
    "s1_miejsca_siedz":      (r"^S\.?\s*1$", "right"),
    "s2_miejsca_stojace":    (r"^S\.?\s*2$", "right"),
    # Etykiety opisowe (nie jednoliterowe) — szukane CAŁYM tekstem, wartość zwykle POD spodem
    "rok_prod":              (r"ROK\s+PRODUKCJI", "below"),
    "przeznaczenie":         (r"PRZEZNACZENIE|RODZAJ\s+POJAZDU", "below"),
}

# Pola "kod+wartość mogą trafić w JEDEN box" — próbowane PRZED dopasowaniem
# geometrycznym, bo tańsze i pewniejsze, gdy się trafi.
COMBINED_PATTERNS: dict[str, str] = {
    "numer_rejestracyjny": r"^A[:\s]+([A-Z]{2,3}\s?[A-Z0-9]{3,6})$",
    "data_pierwszej_rej":  r"^B[:\s]+(\d{2}[.\-/]\d{2}[.\-/]\d{4})$",
    "f1_dmc":               r"^F\.?\s*1[:\s]+(\d{3,6})",
    "f2_dmc_ladunek":       r"^F\.?\s*2[:\s]+(\d{3,6})",
    "f3_dmc_zespol":        r"^F\.?\s*3[:\s]+(\d{3,6})",
    "g_masa_wlasna":        r"^G[:\s]+(\d{3,6})",
    "p1_pojemnosc":         r"^P\.?\s*1[:\s]+(\d{3,6})",
    "p2_moc_kw":            r"^P\.?\s*2[:\s]+(\d{1,4})",
    "s1_miejsca_siedz":     r"^S\.?\s*1[:\s]+(\d{1,3})",
}

# (min, max) rozsądnego zakresu — odrzuca trafienia w cudze pole (np. rok jako DMC)
NUMERIC_RANGES: dict[str, tuple[int, int]] = {
    "f1_dmc": (400, 60000), "f2_dmc_ladunek": (400, 60000), "f3_dmc_zespol": (400, 100000),
    "g_masa_wlasna": (100, 60000), "o1_przyczepa_ham": (100, 60000), "o2_przyczepa_nieham": (50, 50000),
    "p1_pojemnosc": (50, 20000), "p2_moc_kw": (1, 1000), "s1_miejsca_siedz": (1, 90),
    "s2_miejsca_stojace": (0, 200), "liczba_osi": (1, 10),
}


# Słowa z etykiet WIELOWYRAZOWYCH innych pól (dziś tylko "ROK PRODUKCJI") — jeśli
# "przeznaczenie" (jedyne inne pole dopasowywane 'below' w tej samej, pionowo
# ułożonej kolumnie beżowej) dostanie jedno z tych słów jako wartość, to sygnał
# przecieku, nie prawdziwa treść pola.
_OTHER_LABEL_WORDS = {"ROK", "PRODUKCJI"}


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s.strip().upper())


def _vertical_overlap_ratio(a: Box, b: Box) -> float:
    inter = max(0.0, min(a.y1, b.y1) - max(a.y0, b.y0))
    shorter = min(a.h, b.h) or 1.0
    return inter / shorter


def _horizontal_overlap_ratio(a: Box, b: Box) -> float:
    inter = max(0.0, min(a.x1, b.x1) - max(a.x0, b.x0))
    shorter = min(a.x1 - a.x0, b.x1 - b.x0) or 1.0
    return inter / shorter


def _find_value_box(label: Box, boxes: list[Box], direction: str, page_w: float, page_h: float) -> Optional[Box]:
    """Najbliższy box po prawej (ta sama linia) albo pod spodem (ta sama kolumna)."""
    max_gap_x = page_w * 0.22
    max_gap_y = page_h * 0.05

    if direction in ("right", "any"):
        candidates = [
            b for b in boxes
            if b is not label
            and b.x0 > label.x1 - 2
            and (b.x0 - label.x1) < max_gap_x
            and _vertical_overlap_ratio(label, b) > 0.35
        ]
        if candidates:
            return min(candidates, key=lambda b: b.x0 - label.x1)

    if direction in ("below", "any"):
        candidates = [
            b for b in boxes
            if b is not label
            and b.y0 > label.y1 - 2
            and (b.y0 - label.y1) < max_gap_y
            and _horizontal_overlap_ratio(label, b) > 0.2
        ]
        if candidates:
            return min(candidates, key=lambda b: b.y0 - label.y1)

    return None


def _clean_value(key: str, raw: str) -> Optional[str]:
    raw = raw.strip()
    if not raw or raw in ("---", "-", "—"):
        return None

    if key in NUMERIC_RANGES:
        digits = re.sub(r"[^\d]", "", raw)
        if not digits:
            return None
        v = int(digits)
        lo, hi = NUMERIC_RANGES[key]
        return str(v) if lo <= v <= hi else None

    if key == "numer_rejestracyjny":
        v = re.sub(r"[^A-Z0-9]", "", raw.upper())
        return v if re.match(r"^[A-Z]{2,3}[A-Z0-9]{2,7}$", v) else None

    if key == "vin":
        v = re.sub(r"[^A-Z0-9]", "", raw.upper())
        return v if len(v) >= 11 else None  # pełna walidacja długości/znaków po stronie Workera

    if key == "data_pierwszej_rej":
        m = re.search(r"(\d{2})[.\-/](\d{2})[.\-/](\d{4})", raw)
        return f"{m.group(1)}.{m.group(2)}.{m.group(3)}" if m else None

    if key == "p3_paliwo":
        m = re.match(r"^([DBGPdbgp])", raw)
        if not m:
            return None
        return {"D": "ON", "B": "PB", "G": "LPG", "P": "PB"}.get(m.group(1).upper(), raw)

    if key == "rok_prod":
        return raw if re.fullmatch(r"(19|20)\d{2}", raw) else None

    if key == "przeznaczenie" and raw.upper() in _OTHER_LABEL_WORDS:
        # Zabezpieczenie przed "przeciekiem" sąsiedniego pola, gdy prawdziwa wartość
        # (często "---") nie zostanie wykryta jako osobny box i dopasowanie geometryczne
        # sięga dalej niż powinno — złapane na realnym dokumencie 25.08 (zwracało "ROK"
        # z sąsiedniej etykiety "ROK PRODUKCJI" zamiast pustej wartości "---").
        return None

    # Pola tekstowe (marka/typ/model/kategoria/nr_homolog): długość + brak nonsensu
    if len(raw) > 60:
        return None
    return raw


def parse_fields_spatial(boxes: list[Box], page_w: float, page_h: float) -> dict[str, tuple[Optional[str], float]]:
    """
    Zwraca {klucz: (wartość, confidence)} — TA SAMA konwencja co
    `ocr_fallback.parse_fields()`, więc `main.py` i walidatory nie wymagają zmian.
    """
    result: dict[str, tuple[Optional[str], float]] = {}
    used: set[int] = set()  # indeksy boxów już zużytych jako wartość — nie przydzielaj dwa razy

    # 1) Szybka ścieżka: kod i wartość w JEDNYM boxie
    for key, pat in COMBINED_PATTERNS.items():
        for i, b in enumerate(boxes):
            if i in used:
                continue
            # UWAGA: `_norm()` usuwa WSZYSTKIE spacje — nie używać tu, bo wzorce
            # dla numer_rejestracyjny/data_pierwszej_rej wymagają `[:\s]+` między
            # kodem a wartością (błąd złapany testem: "A WZ946KA" → _norm nie
            # zostawiał separatora, regex nigdy nie trafiał).
            m = re.match(pat, b.text.strip().upper() if key in ("numer_rejestracyjny", "data_pierwszej_rej") else b.text.strip(), re.IGNORECASE)
            if m:
                val = _clean_value(key, m.group(1))
                if val:
                    result[key] = (val, min(0.9, b.score))
                    used.add(i)
                    break

    # 2) Ścieżka geometryczna: etykieta w OSOBNYM boxie → najbliższa wartość
    for key, (label_pat, direction) in FIELD_LABELS.items():
        if key in result:
            continue
        best: Optional[tuple[Box, Box]] = None
        best_dist = float("inf")
        for i, lb in enumerate(boxes):
            norm_text = _norm(lb.text) if len(lb.text.replace(" ", "")) <= 4 else lb.text.strip().upper()
            if not re.search(label_pat, norm_text):
                continue
            vb = _find_value_box(lb, boxes, direction, page_w, page_h)
            if vb is None:
                continue
            vidx = boxes.index(vb)
            if vidx in used:
                continue
            dist = abs(vb.x0 - lb.x1) + abs(vb.y0 - lb.y0)
            if dist < best_dist:
                best_dist = dist
                best = (lb, vb)
        if best:
            lb, vb = best
            val = _clean_value(key, vb.text)
            if val:
                result[key] = (val, min(0.75, vb.score))
                used.add(boxes.index(vb))

    for key in FIELD_LABELS:
        result.setdefault(key, (None, 0.0))
    for key in COMBINED_PATTERNS:
        result.setdefault(key, (None, 0.0))

    # 3) norma_euro / zawieszenie — brak stałej pozycji (żyją w wolnym tekście
    # adnotacji urzędowych), więc szukane w CAŁYM tekście strony, nie geometrycznie.
    full_text = " ".join(b.text for b in boxes)
    m = re.search(r"EURO\s*([0-6]|I{1,3}V?|VI{0,3})\b", full_text, re.IGNORECASE)
    result["norma_euro"] = (f"EURO {m.group(1).upper()}", 0.6) if m else (None, 0.0)

    m = re.search(r"zawieszeni\w*\s+(pneumatyczne\w*|r[oó]wnowa[żz]ne\s+pneumatycznemu|inne)", full_text, re.IGNORECASE)
    result["zawieszenie"] = (m.group(1).lower(), 0.6) if m else (None, 0.0)

    return result
