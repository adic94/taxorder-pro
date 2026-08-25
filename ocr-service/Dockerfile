# Przypinamy wydanie Debiana (trixie), bo ruchomy tag python:3.11-slim
# zmienił bazę bez ostrzeżenia i wywalił build na Railway 24.06.2026.
FROM python:3.11-slim-trixie

# Tesseract OCR + języki PL i EN — od 25.08 wieczorem używany WYŁĄCZNIE do OSD
# (wykrycie obrotu CAŁEJ STRONY 0/90/180/270), nie do rozpoznawania tekstu —
# patrz komentarz w extractors/rapid_fields.py. NIE usuwać: RapidOCR ma tylko
# klasyfikator obrotu POJEDYNCZEJ LINII, bez OSD klaster dokumentów z obróconą
# stroną (WE6LR80, patrz CLAUDE.md) znowu dawałby zero pól.
# libgl1/libglib2.0-0 — dla `import cv2` (zależności OCR ciągną opencv z linkowaniem
# do libGL, nawet gdy sam kod używa tylko headless API). Bez tego:
# "ImportError: libGL.so.1: cannot open shared object file" (zmierzone 25.08 na
# PaddleOCR — zostawione jako zabezpieczenie, RapidOCR mógłby mieć tę samą zależność).
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-pol \
    tesseract-ocr-eng \
    libgomp1 \
    poppler-utils \
    libucl1 \
    libucl-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Pobiera modele RapidOCR (PP-OCRv5 latin, mobile) PRZY BUDOWIE, nie przy
# pierwszym żądaniu. Bez tego pierwsze wywołanie po starcie kontenera (Cloud Run
# scale-to-zero = KAŻDE zimne wywołanie) pobiera modele z sieci i przekracza 8 s,
# na które Worker czeka (AbortSignal.timeout(8000) w worker/index.js) —
# dokładnie ten objaw, który 24.08 zdyskwalifikował Próbę 0. Wypieczone w
# obrazie: modele są już na dysku, zostaje tylko załadowanie do pamięci (patrz
# `_get_ocr()` w extractors/rapid_fields.py — leniwe, przy 1. żądaniu).
RUN python -c "from extractors.rapid_fields import _get_ocr; _get_ocr()"

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
