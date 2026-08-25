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

Health check — nie ładuje modeli RapidOCR (te ładują się raz, przy starcie kontenera,
patrz `_preload_rapid_models`). Zwraca `engine: "rapidocr-latin"` — Tesseract nadal jest
w obrazie (binarka wypisana jako `tesseract_ver` dla debugowania), ale od 25.08 wieczorem
używana WYŁĄCZNIE do wykrycia obrotu strony (OSD), nie do rozpoznawania tekstu.

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
Etap 2 — RapidOCR (ONNX, lang=latin)    → source: "ocr", confidence: 0.3–0.9
  ├─ Tesseract OSD → korekcja CAŁOSTRONICOWEGO obrotu 0/90/180/270° PRZED OCR-em
  │    (RapidOCR ma tylko klasyfikator POJEDYNCZEJ LINII 0/180°, nie całej strony —
  │    OSD wypełnia tę lukę, patrz extractors/rapid_fields.py)
  ├─ Modele "mobile" (latin_PP-OCRv5_rec_mobile — jedyny wariant z polskimi znakami)
  ├─ ONNX Runtime, NIE framework paddlepaddle — ~8-11s/dokument, 5-8× szybciej niż
  │    PaddleOCR na tym samym CPU (który wymagał enable_mkldnn=False z powodu
  │    twardych crashy procesu w oneDNN, patrz historia requirements.txt)
  └─ Parser GEOMETRYCZNY — dopasowanie etykieta→wartość po bounding boxach, NIE regex
       na spłaszczonym tekście (23 pola: A, B, D.1–D.3, E, F.1–F.3, G, J, K, L,
       O.1–O.2, P.1–P.3, S.1–S.2, + ROK PRODUKCJI/PRZEZNACZENIE/norma EURO/zawieszenie)
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
# Wymagania systemowe: tesseract-ocr tesseract-ocr-pol poppler-utils libgl1 libglib2.0-0
# (libgl1/libglib2.0-0 — dla `import cv2`; tesseract-ocr — WYŁĄCZNIE do OSD od 25.08 wieczorem)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Testy

```bash
pip install pytest
pytest tests/ -q
```

## Strojenie parsera bez deployu

```bash
pip install rapidocr onnxruntime pypdfium2
python stroj_lokalnie.py <plik.pdf> [--boxy] [--json]
python stroj_lokalnie.py --katalog <folder> --limit 20
```

**~10 s na dokument zamiast ~14 min** pętli `gcloud run deploy` + przebieg wsadowy.
Sesja 25.08 pokazała, że to właśnie ta pętla, a nie model ani kod, była wąskim
gardłem przy siedmiu kolejnych poprawkach parsera.

Render lokalny (`pypdfium2`) i produkcyjny (`pdf.js`) to różne rasteryzatory —
bezwzględne pokrycie potrafi się różnić o pojedyncze pola. Do porównań
**względnych** („czy moja zmiana pomogła"), liczby do raportu z przebiegu wsadowego.

---

## Ograniczenia znane

- **Zdjęcia z grubym zamazanym Aztec** (np. odbity lakier, silny odblask): etap 1 może zawieść — fallback na OCR zmniejsza confidence do 0.3–0.7.
- **Dane osobowe właściciela** dekodowane z Aztec są zwracane w polu `owner.fields` z flagą `personal_data: true`; aplikacja konsumująca powinna je traktować zgodnie z RODO.
- **Zdjęcia R2 (kolory kodu)**: kody Aztec na starych dowodach są czarno-białe, ale od 2016 niektóre mają tło kolorowe — progowanie adaptacyjne radzi sobie z tym poprawnie.
- **Eksport PDF ze skanerów** z niskim DPI (< 150): dekodowanie Aztec może zawieść; serwis zawsze wróci do OCR.
- **Wciąż na granicy limitu 8s Workera (~8-11s/dokument, zmierzone 25.08).** Bez
  akceleratora sprzętowego (PaddleOCR-owy oneDNN nie jest tu już problemem — RapidOCR
  jedzie przez ONNX Runtime) samo ONNX inference na CPU rzadko schodzi poniżej 8s
  niezawodnie. `PROBA_0_WLACZONA` w Workerze zostaje `false` do czasu potwierdzenia
  STABILNEGO <8s (miary z 10 dokumentów: 5.5-10.7s, mediana ~9.5s) — dla wsadu
  (`tools/dr-ocr-batch-cloudrun.js`, bez limitu czasu) to bez znaczenia.
- **Pole `przeznaczenie` bywa niedokładne** — dopasowanie "poniżej etykiety" (używane
  też dla `rok_prod`) jest mniej odporne niż "po prawej" (większość pozostałych pól),
  bo box wartości bywa dalej / RapidOCR i PaddleOCR dają nieco inne granice boxów.
  Zmierzone 25.08: 2/10 dokumentów miało błędne dopasowanie tego jednego pola. Reszta
  pól (dmcKg, masaWlKg, liczbaOsi, miejscaSied) była identyczna między silnikami na
  tej samej próbce — problem jest zlokalizowany, nie systemowy.
