# tools/ — narzędzia deweloperskie

Skrypty lokalne do diagnostyki, audytu i QA. Nie wchodzą do buildu prod.
Wymagają: `sharp`, `zxing-wasm`, `playwright` — zainstalowane w `node_modules/`.

## Doprowadzenie projektu do stanu działającego

| Skrypt | Co robi |
|--------|---------|
| `uruchom-wszystko.js` | **Jedno polecenie na start.** `npm.cmd run uruchom` sprawdza środowisko, poświadczenia wranglera, aktualność kodu, bramki jednostkowe, niewdrożone commity Workera i listę modeli AI — po czym wypisuje, **czego nie potrafi zrobić za człowieka** (akceptacja licencji modelu, `wrangler login`). Domyślnie **niczego nie zmienia**; `--wykonaj` dodatkowo wdraża Workera. Wdrożenie jest wstrzymywane, gdy bramki nie przechodzą. Każdy krok potwierdza wynik odczytem, nie brakiem błędu |

## Konfiguracja lokalna

| Skrypt | Co robi |
|--------|---------|
| `env-setup.js` | **Tworzy albo UZUPEŁNIA `.env`** na podstawie `.env.example`. `npm.cmd run env:setup`. W odróżnieniu od `Copy-Item .env.example .env` **nie nadpisuje** istniejących wartości — dopisuje wyłącznie brakujące klucze wraz z ich komentarzami. Omija dwie pułapki Windowsa: `.env.txt` z Notatnika (wykrywa i ostrzega — dotenv go nie czyta, a `.gitignore` nie ignoruje) oraz UTF-16LE po zapisie przez `>` w PowerShellu (wykrywa i przepisuje na UTF-8). **Nigdy nie wypisuje wartości** — raportuje nazwy kluczy i to, czy są wypełnione, więc wynik da się wkleić do zgłoszenia bez wycieku |

## CEPiK — rejestr państwowy jako źródło danych DT-1

| Skrypt | Co robi |
|--------|---------|
| `cepik-probe.js` | **Czy `api.cepik.gov.pl` wymaga autoryzacji i jakie pola zwraca.** `POST /api/cepik/token` oddaje 503 „CEPiK nie jest skonfigurowany" — sekrety `CEPIK_KEY`/`CEPIK_SECRET` nigdy nie zostały ustawione. Zanim ktokolwiek wystąpi o poświadczenia, ta sonda odpowiada taniej: czy endpoint otwartych danych w ogóle ich potrzebuje, oraz czy zwraca **liczbę osi i rodzaj zawieszenia** — pola DT-1, których `_qavParseCepik` w `app.js` nie mapuje (mapuje markę, model, VIN, rok, DMC, paliwo, kategorię). Nie da się tego sprawdzić z konsoli przeglądarki: CSP aplikacji nie ma `api.cepik.gov.pl` w `connect-src`. Nie wypisuje VIN-u ani numeru rejestracyjnego |

## Test OCR bez deployu

| Skrypt | Co robi |
|--------|---------|
| `cf-ocr-test.js` | **Wysyła JEDEN dowód do Workers AI i porównuje dwa modele obok siebie.** Playground Cloudflare przyjmuje sam tekst — nie da się w nim sprawdzić ani skuteczności na dowodzie, ani czy licencja przepuszcza żądanie WIZYJNE. To narzędzie odpowiada na trzy pytania naraz: czy licencja zaakceptowana (kod **5016**), czy `llama-4-scout` przyjmuje obraz przez `messages`+`image_url` (otwarta niewiadoma z CLAUDE.md), i który model lepiej czyta TWÓJ dowód. Wysyła **oba różne kształty żądania** — `image:[bajty]` dla `llama-3.2-11b-vision` i `messages` dla scouta — bo podmiana samego identyfikatora modelu w Workerze zepsułaby OCR po cichu. Obraz leci wyłącznie na Twoje konto CF; VIN i nr rej. maskowane na wyjściu. Wymaga `CLOUDFLARE_API_TOKEN` (uprawnienie **Workers AI → Read**, i tylko to) w `.env` lub zmiennej środowiskowej. Bez podanej ścieżki wybiera pierwszy obraz z `DR_FOLDER` — PDF-y pomija świadomie, bo produkcyjny render ma własne ustawienia (`PDF_AZTEC`) i byle jaki render mierzyłby jakość renderu, nie modelu. Odróżnia odpowiedź spoza API Cloudflare (proxy/firewall) od realnego błędu tokenu |

## Narzędzia diagnostyczne DR (dowód rejestracyjny)

| Skrypt | Co robi |
|--------|---------|
| `dr-analyze-unreadable.js` | Analizuje corpus DR "Aztec nieodczytany" z checkpointu; kategoryzuje wg nazwy/rozdzielczości; szacuje realny brak kodu vs porażka detekcji |
| `dr-page-test.js` | Weryfikuje czy renderPdfToBase64 renderuje tylko str. 1 PDF; testuje kolejne strony na losowej próbce "stały DR" |
| `dr-helper-wasm.html` | Helper Playwright: ładuje zxing-wasm z CDN, udostępnia `decodeAztecFromCanvas()`; używany przez dr-page-test.js |
| `aztec-diagnoza.js` | **Dlaczego kod Aztec się nie odczytuje — pomiar rozdzielczości ŹRÓDŁA na całym zbiorze.** Nie dekoduje i nie uruchamia przeglądarki; czyta nagłówki (PNG IHDR, JPEG SOF, PDF `/MediaBox` + `/Width`+`/Height`), więc przechodzi tysiące dokumentów w sekundy. Odpowiada na pytanie, którego `--katalog` nie zadaje: czy zero odczytów wynika z naszej detekcji, czy ze zbyt słabego skanu. **Render w wyższym DPI nie tworzy informacji, której nie ma w źródle** — skan 100 DPI pozostanie nieczytelny dla Aztec niezależnie od ustawień `PDF_AZTEC`. Progi: kod ma bok ~25 mm, dekoder potrzebuje ≥3 px/moduł, komfortowo 5. Parsery zweryfikowane na plikach o znanych wymiarach: 5/5 trafień co do DPI |
| `aztec-compare.js --katalog` | Wskaźnik odczytu Aztec na całym zbiorze. **`--rownolegle N`** uruchamia N podprocesów naraz — przy 1318 dokumentach różnica to godziny. Każdy plik nadal dostaje własny podproces (izolacja: awaria jednego nie przewraca przebiegu), zmienia się tylko liczba biegnących równocześnie. Wyniki wypisywane w kolejności PLIKÓW, nie zakończeń — inaczej nie dałoby się ich zestawić z listą wejściową. Zweryfikowane: wynik identyczny sekwencyjnie i przy `--rownolegle 4` |
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
