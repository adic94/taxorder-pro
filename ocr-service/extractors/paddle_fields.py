"""
OCR fallback — PaddleOCR (PP-OCRv5, lang="pl") + parser GEOMETRYCZNY.

DLACZEGO NOWY MODUŁ, NIE POPRAWKA `ocr_fallback.py`. Tamten parser (Tesseract +
`re.search` na spłaszczonym tekście) zakłada, że kod pola i jego wartość leżą OBOK
SIEBIE w kolejności czytania. To założenie jest fałszywe dla euro-dowodu: dokument
ma TRZY kolumny (beżowa/żółta/niebieska) czytane każda z osobna, a Tesseract
spłaszcza wszystko do jednego strumienia tekstu w kolejności zależnej od layoutu
wykrytego przez PSM — stąd „HVZSHYM" jako numer rejestracyjny zamiast prawdziwej
tablicy (zmierzone 24.08, patrz komentarz w worker/index.js przy PROBA_0_WLACZONA).

Ten moduł NIE zgaduje z tekstu — dopasowuje WARTOŚĆ do NAJBLIŻSZEGO GEOMETRYCZNIE
pola-etykiety (bounding box), dokładnie tak jak czyta to człowiek patrzący na
formularz. `ocr_fallback.py` zostaje w repo nietknięty (health check nadal zgłasza
wersję Tesseracta, może się przydać do debugowania), ale od tej zmiany nie jest
już wołany przez żadną aktywną ścieżkę w `main.py`.

Obrót strony (0/90/180/270) prostuje `use_doc_orientation_classify=True` — model
klasyfikacji orientacji PaddleX, NIE Tesseract OSD. Znalezisko 25.08: dokumenty
z klastra "Toyota Hilux GR" mają treść strony narysowaną w orientacji pionowej
mimo fizycznie poziomego dowodu (obrót zaszyty w macierzy rysowania obrazu na
stronie PDF, nie we fladze /Rotate) — to dokładnie przypadek, na który
use_doc_orientation_classify jest zaprojektowany.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Instancja PaddleOCR jest CIĘŻKA (ładowanie modeli) — jeden singleton na proces,
# budowany przy PIERWSZYM wywołaniu, nie przy imporcie modułu (żeby /  (health
# check) i /ocr bez obrazu nie płaciły kosztu ładowania modeli).
_OCR_SINGLETON = None


def _get_ocr():
    global _OCR_SINGLETON
    if _OCR_SINGLETON is None:
        from paddleocr import PaddleOCR
        logger.info("Ładowanie modeli PaddleOCR (lang=pl)...")
        _OCR_SINGLETON = PaddleOCR(
            lang="pl",
            # `lang="pl"` sam z siebie dobrał modele "medium" (PP-OCRv6_medium_*,
            # zmierzone w logach 25.08) — bez akceleratora oneDNN (patrz niżej)
            # jedno zapytanie przekroczyło 120 s. Jawne "mobile" to jedyny wariant
            # z modelem rozpoznawania faktycznie obejmującym polskie znaki
            # (grupa "latin", patrz PP-OCRv5_multi_languages) i ~10x mniej wag
            # niż "medium" (4.7M vs 61M) — dokładnie ten kompromis (mniejsza
            # dokładność za cenę mieszczenia się w 8 s Workera) jest tu celowy.
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=True,   # naprawia całostronicowy obrót 0/90/180/270
            use_doc_unwarping=False,              # źródło to płaski render PDF, nie zdjęcie — niepotrzebne
            use_textline_orientation=True,        # pojedyncze odwrócone linie (rzadkie, ale tanie w koszcie)
            enable_mkldnn=False,                  # patrz komentarz w requirements.txt — oneDNN pada na CPU Cloud Run, dwie różne awarie na dwóch wersjach paddlepaddle
        )
        logger.info("Modele PaddleOCR załadowane.")
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


def run_paddle_ocr(pil_img: Image.Image) -> list[Box]:
    """Uruchamia PaddleOCR, zwraca listę wykrytych pól tekstowych z pozycją."""
    arr = np.array(pil_img.convert("RGB"))
    ocr = _get_ocr()
    results = ocr.predict(arr)
    boxes: list[Box] = []
    for res in results:
        texts = res.get("rec_texts") if isinstance(res, dict) else res.rec_texts
        scores = res.get("rec_scores") if isinstance(res, dict) else res.rec_scores
        rboxes = res.get("rec_boxes") if isinstance(res, dict) else res.rec_boxes
        for t, s, b in zip(texts, scores, rboxes):
            t = (t or "").strip()
            if not t:
                continue
            x0, y0, x1, y1 = [float(v) for v in b]
            boxes.append(Box(text=t, x0=x0, y0=y0, x1=x1, y1=y1, score=float(s)))
    return boxes


# ── Katalog etykiet euro-dowodu ─────────────────────────────────────────────
# klucz wyjściowy → (regex etykiety w OSOBNYM boxie, regex "kod+wartość w jednym
# boxie" jako szybsza ścieżka, kierunek szukania wartości: 'right' | 'below' | 'any')
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
