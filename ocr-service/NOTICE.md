# NOTICE — komponenty zewnętrzne i licencje

## libucl — UCL Compression Library

**Autor:** Markus Franz Xaver Johannes Oberhumer  
**Wersja:** 1.03  
**Licencja:** GNU General Public License v2 (GPL-2.0-only)  
**Źródło:** https://www.oberhumer.com/opensource/ucl/  
**Pakiet Debian:** `libucl1` / `libucl-dev`

Użycie: `extractors/nrv2e.py` ładuje `libucl.so.1` przez ctypes i wywołuje
`ucl_nrv2e_decompress_safe_8()` do dekompresji payloadu NRV2E z kodu Aztec.
Biblioteka nie jest dołączona do kodu źródłowego — instalowana jako systemowa
zależność (`apt install libucl1`). Interfejs izolowany przez `AztecDecoder`
(extractors/aztec_decoder.py) zgodnie z zasadą adaptera.

---

## zxing-cpp — ZXing C++ Port

**Autorzy:** Nu-book GmbH i współtwórcy  
**Licencja:** Apache License 2.0  
**Źródło:** https://github.com/zxing-cpp/zxing-cpp  
**Pakiet PyPI:** `zxing-cpp`

Użycie: `extractors/aztec.py` — detekcja i odczyt kodu Aztec z obrazów DR.

---

## Tesseract OCR

**Autorzy:** Google LLC i współtwórcy  
**Licencja:** Apache License 2.0  
**Źródło:** https://github.com/tesseract-ocr/tesseract  
**Pakiet Debian:** `tesseract-ocr`, `tesseract-ocr-pol`, `tesseract-ocr-eng`

Użycie: `extractors/ocr_fallback.py` — OCR fallback gdy kod Aztec nieczytelny.

---

## Poppler

**Autorzy:** Glyph & Cog LLC i współtwórcy  
**Licencja:** GNU General Public License v2 (GPL-2.0)  
**Źródło:** https://poppler.freedesktop.org/  
**Pakiet Debian:** `poppler-utils`

Użycie: `pdf2image` korzysta z `pdftoppm` (część poppler) do konwersji PDF → obrazy.

---

## Format pól kodu Aztec w polskim Dowodzie Rejestracyjnym

**Podstawa prawna:**  
Rozporządzenie Ministra Infrastruktury z dnia 11 grudnia 2017 r. w sprawie
rejestracji i oznaczania pojazdów oraz wymagań dla tablic rejestracyjnych
(Dz.U. 2017 poz. 2355), załącznik — wzór Dowodu Rejestracyjnego serii BAS/BAV/BAY.

**Opis technicznego formatu payloadu Aztec:**  
- Kod Aztec zawiera ciąg Base64 (kodowanie standardowe, z paddingiem)
- Po base64-decode: 4 bajty little-endian uint32 = rozmiar wyjścia + dane NRV2E
- Dane NRV2E decompress → bajty UTF-16LE
- Tekst UTF-16LE dzielony separatorem `|` na pola w ustalonej kolejności
- Kolejność pól: seria_dowodu | numer_dowodu | organ_wydajacy |
  numer_rejestracyjny | marka | typ | wariant | wersja | model | vin |
  data_pierwszej_rej | data_rej_aktualnej | kategoria |
  wlasciciel_nazwa | wlasciciel_adres | posiadacz_nazwa | posiadacz_adres |
  f1_dmc | f2_dmc_ladunek | f3_dmc_zespol | g_masa_wlasna |
  o1_przyczepa_ham | o2_przyczepa_nieham | p1_pojemnosc | p2_moc_kw |
  p3_paliwo | liczba_osi | s1_miejsca_siedz | s2_miejsca_stojace | nr_homologacji

**Dane osobowe:** pola wlasciciel_* i posiadacz_* oznaczone są flagą
`personal_data: true` w odpowiedzi API — przetwarzać zgodnie z RODO.

**Weryfikacja formatu:** potwierdzono eksperymentalnie na rzeczywistych skanach DR
(WPR0365T — MAN BAS 3574703; WA0677L — SCANIA BAV 5224071), lipiec 2026.
