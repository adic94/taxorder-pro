# tools/ — narzędzia deweloperskie

Skrypty lokalne do diagnostyki, audytu i QA. Nie wchodzą do buildu prod.
Wymagają: `sharp`, `zxing-wasm`, `playwright` — zainstalowane w `node_modules/`.

## Doprowadzenie projektu do stanu działającego

| Skrypt | Co robi |
|--------|---------|
| `uruchom-wszystko.js` | **Jedno polecenie na start.** `npm.cmd run uruchom` sprawdza środowisko, poświadczenia wranglera, aktualność kodu, bramki jednostkowe, niewdrożone commity Workera i listę modeli AI — po czym wypisuje, **czego nie potrafi zrobić za człowieka** (akceptacja licencji modelu, `wrangler login`). Domyślnie **niczego nie zmienia**; `--wykonaj` dodatkowo wdraża Workera. Wdrożenie jest wstrzymywane, gdy bramki nie przechodzą. Każdy krok potwierdza wynik odczytem, nie brakiem błędu |

## Narzędzia diagnostyczne DR (dowód rejestracyjny)

| Skrypt | Co robi |
|--------|---------|
| `dr-analyze-unreadable.js` | Analizuje corpus DR "Aztec nieodczytany" z checkpointu; kategoryzuje wg nazwy/rozdzielczości; szacuje realny brak kodu vs porażka detekcji |
| `dr-page-test.js` | Weryfikuje czy renderPdfToBase64 renderuje tylko str. 1 PDF; testuje kolejne strony na losowej próbce "stały DR" |
| `dr-helper-wasm.html` | Helper Playwright: ładuje zxing-wasm z CDN, udostępnia `decodeAztecFromCanvas()`; używany przez dr-page-test.js |
| `test-nrv2e-variants.js` | Referencja historyczna: 5 wariantów NRV2E (A–E); wariant E (LSB, off*2) — poprawny dla polskich DR |

## Zgodność schematu D1

| Skrypt | Co robi |
|--------|---------|
| `autotest/d1-schema-diff.js` | Porównuje **produkcyjne D1** z definicjami w `worker/schema_v*.sql`. Wykrywa: tabele nigdy nieutworzone, tabele stojące na starszej definicji (cichy no-op `CREATE TABLE IF NOT EXISTS`), tabele w bazie bez definicji w repo. `npm run d1-diff` (wymaga `wrangler login`), `npm run d1-diff:offline` (tylko analiza plików), `--strict` = kod wyjścia 1 przy rozjeździe, `--fixture <json>` = test logiki bez dostępu do bazy |

> **To NIE to samo co `npm run migration-check`.** Tamten porównuje pliki schema między sobą
> („czy migracje są spójne w repo"), ten porównuje repo z bazą („czy baza wygląda tak, jak
> myślimy"). Drugie pytanie nie było zadawane do 11.08.2026 — i właśnie ono ujawniło, że
> `company_packages` w ogóle nie istnieje, `esg_targets` stoi na v35 zamiast v41, a
> `reservations` na v13 z `CHECK`, którego v40 miał się pozbyć.

## Audyt podatkowy DT-1

| Skrypt | Co robi |
|--------|---------|
| `dt1-verify.js` | ⚠ Dotyka danych podatkowych (~100 pojazdów). Porównuje DMC z DR-checkpoint z D1; grupy A/B/C rozbieżności; generuje SQL UPDATE grupy B. **Domyślnie DRY-RUN** — SQL na stdout. Zapis plików tylko z `--execute` |

## Benchmark Aztec

| Plik | Co robi |
|------|---------|
| `aztec-bench.html` | Benchmark ścieżki A (ZXing@0.19.1) vs B (TaxOrderAztecDetector z `modules/`); user ładuje pliki lokalnie; eksport CSV |

---

## `_archive/` — eksperymenty jednorazowe

Pliki przeniesione z katalogu głównego tools/. Zachowane lokalnie, ignorowane przez git.
Reprezentują jednorazowe eksperymenty z sesji diagnozy odczytu Aztec DR (2026-07-30 — 2026-07-31).
Temat zamknięty — skuteczność ekstraktora osiągnęła 71,4% (typy stałe z wystarczającą rozdzielczością).

| Plik | Dlaczego archiwum |
|------|------------------|
| `test-zxing-wasm.js` | Test biblioteki na plikach tymczasowych, które już nie istnieją |
| `dump-aztec-bytes.js` | Jednorazowy hex-dump do analizy formatu bajtów Aztec |
| `try-decode-aztec.js` | Debug interpretacji bajtów; hardkodowany VIN pojazdu |
| `test-one-file.js` | Test na 1 konkretnym JPG z udziału sieciowego (WB6357U) |
| `test-jpg-debug.js` | Debug preprocessingu na konkretnym pliku DR |
| `test-pipeline-2files.js` | Pipeline test na 2 konkretnych pojazdach (WB6357U + WB6385U) |
| `diag-vin-check.js` | Diagnostyka 5 konkretnych DR po numerach rejestracyjnych |
| `dr-owner-check.js` | Wyciągał właścicieli-firmy z Aztec; zapisywał VIN→owner na dysk |
| `webinar-analyzer.html` | Standalone recorder webinarów (Groq Whisper + LLM); bez związku z flotą |
| `dr-heuristic-check.js` | Próbkuje share sieciowy pod hardkodowaną ścieżką — bezużyteczne poza oryginalną maszyną |

### `aztec-compare.js`
Porównuje dwie ścieżki dekodowania Aztec na prawdziwym zdjęciu dowodu:
ścieżkę produkcyjną (`tryAztecFromCanvas` z `app.js`) i nieużywany
`modules/aztec-detector.js`. Sprawdza **wierność bajtów**, a nie tylko skuteczność
detekcji — czego `aztec-bench.html` nie mierzy.

```bash
npm i --no-save @zxing/library@0.20.0
node tools/aztec-compare.js sciezka/do/dowodu.jpg   # wymaga zdjęcia POZA repo
node tools/aztec-compare.js --selftest              # bez zdjęcia: kontrola wierności bajtów
```

`--selftest` generuje własny kod Aztec o znanym ładunku i wykrywa zniekształcenie
bajtów `0x80`–`0x9F` przez warstwę tekstową (CP1252). Kod wyjścia 1 przy rozjeździe.
