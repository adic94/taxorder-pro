# TaxOrder OCR Service

Mikroserwis FastAPI do ekstrakcji danych z polskich **Dowodów Rejestracyjnych** (JPG/PNG/PDF).

## Endpoint

### `POST /extract/dowod-rejestracyjny`

Multipart, pole `file`. Akceptuje JPG, PNG, PDF (walidacja po magic bytes).

**Limity:**
- max 15 MB
- timeout 60 s
- plik przetwarzany wyłącznie w pamięci (RODO — bez trwałej kopii)

**Przykład curl:**

```bash
curl -X POST https://ocr.twojadomena.pl/extract/dowod-rejestracyjny \
  -H "X-Api-Key: <TWOJ_KLUCZ>" \
  -F "file=@skan_dr.jpg"
```

**Przykładowa odpowiedź:**

```json
{
  "status": "ok",
  "source": "aztec",
  "pages_processed": 1,
  "fields": {
    "numer_rejestracyjny": {"value": "WZ946KA", "confidence": 1.0, "needs_review": false},
    "vin":                 {"value": "VF1RFD00061234567", "confidence": 1.0, "needs_review": false},
    "marka":               {"value": "RENAULT", "confidence": 1.0},
    "typ":                 {"value": "CLIO", "confidence": 1.0},
    "data_pierwszej_rej":  {"value": "15.03.2019", "confidence": 1.0},
    "f1_dmc":              {"value": "1615", "confidence": 1.0},
    "g_masa_wlasna":       {"value": "1120", "confidence": 1.0},
    "p1_pojemnosc":        {"value": "1598", "confidence": 1.0},
    "p2_moc_kw":           {"value": "66", "confidence": 1.0},
    "p3_paliwo":           {"value": "PB", "confidence": 1.0},
    "s1_miejsca_siedz":    {"value": "5", "confidence": 1.0}
  },
  "owner": {
    "present": true,
    "personal_data": true,
    "fields": {
      "wlasciciel_nazwa": {"value": "JAN KOWALSKI", "confidence": 1.0, "personal_data": true}
    }
  },
  "warnings": [],
  "processing_ms": 234
}
```

### `GET /`

Health check — zwraca wersję Tesseracta.

### `POST /ocr` (legacy)

Poprzedni endpoint (base64 JSON) — zachowany dla kompatybilności wstecznej.

---

## Kaskada przetwarzania

```
Wejście (JPG/PNG/PDF)
       │
       ▼
Etap 0 — Normalizacja
  ├─ PDF → obrazy (pdf2image, 300 dpi)
  ├─ Korekcja orientacji EXIF (PIL.ImageOps.exif_transpose)
  └─ Limit rozmiaru (maks. 4000 px na dłuższym boku)
       │
       ▼
Etap 1 — Kod Aztec (zxing-cpp)         → source: "aztec", confidence: 1.0
  ├─ Oryginalny obraz
  ├─ Rotacje 90°/180°/270°
  ├─ Warianty: skala szarości, progowanie, upscale 2×
  └─ Korekcja perspektywy (Canny → findContours → warpPerspective) + ponowne próby
       │ (gdy Aztec nieczytelny)
       ▼
Etap 2 — OCR Tesseract                 → source: "ocr", confidence: 0.3–0.9
  ├─ OSD (Tesseract) → korekcja obrotu o 0/90/180/270°
  ├─ Deskew drobnych kątów (minAreaRect, ±15°)
  ├─ Preprocessing: denoising → adaptive threshold → dylatacja
  ├─ Dwa przebiegi (PSM 6 i PSM 4), wybór wg avg confidence
  └─ Parser kotwiczony na kodach euro-pól (A, B, D.1–D.3, E, F.1–F.3, G, P.1–P.3, S.1)
       │ (gdy < 5 pól i ANTHROPIC_API_KEY ustawiony)
       ▼
Etap 3 — Claude Vision (opcjonalny)    → source: "vision", confidence: 0.7
  └─ Zapytanie do API Anthropic z obrazem i strukturyzowanym promptem
       │
       ▼
Walidacja (VIN, nr rej., daty, zakresy mas/mocy/pojemności/miejsc)
  └─ needs_review: true dla pól z ostrzeżeniami (nie odrzuca całości)
```

---

## Zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `API_SECRET` | Opcjonalny klucz API (nagłówek `X-Api-Key`) |
| `ANTHROPIC_API_KEY` | Klucz Anthropic — aktywuje Etap 3 (Claude Vision) |
| `PORT` | Port serwisu (domyślnie 8000) |

---

## Uruchomienie lokalne

```bash
# Wymagania systemowe: tesseract-ocr tesseract-ocr-pol poppler-utils
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Testy

```bash
pip install pytest
pytest tests/ -q
```

---

## Ograniczenia znane

- **Zdjęcia z grubym zamazanym Aztec** (np. odbity lakier, silny odblask): etap 1 może zawieść — fallback na OCR zmniejsza confidence do 0.3–0.7.
- **Dane osobowe właściciela** dekodowane z Aztec są zwracane w polu `owner.fields` z flagą `personal_data: true`; aplikacja konsumująca powinna je traktować zgodnie z RODO.
- **Zdjęcia R2 (kolory kodu)**: kody Aztec na starych dowodach są czarno-białe, ale od 2016 niektóre mają tło kolorowe — progowanie adaptacyjne radzi sobie z tym poprawnie.
- **Eksport PDF ze skanerów** z niskim DPI (< 150): dekodowanie Aztec może zawieść; serwis zawsze wróci do OCR.
