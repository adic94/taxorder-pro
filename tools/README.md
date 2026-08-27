# tools/ — narzędzia deweloperskie

Skrypty lokalne do diagnostyki, audytu i QA. Nie wchodzą do buildu prod.
Wymagają: `sharp`, `zxing-wasm`, `playwright` — zainstalowane w `node_modules/`.

## Doprowadzenie projektu do stanu działającego

| Skrypt | Co robi |
|--------|---------|
| `uruchom-wszystko.js` | **Jedno polecenie na start.** `npm.cmd run uruchom` sprawdza środowisko, poświadczenia wranglera, aktualność kodu, bramki jednostkowe, niewdrożone commity Workera i listę modeli AI — po czym wypisuje, **czego nie potrafi zrobić za człowieka** (akceptacja licencji modelu, `wrangler login`). Domyślnie **niczego nie zmienia**; `--wykonaj` dodatkowo wdraża Workera. Wdrożenie jest wstrzymywane, gdy bramki nie przechodzą. Każdy krok potwierdza wynik odczytem, nie brakiem błędu |

## Praca na dwóch komputerach

| Skrypt | Co robi |
|--------|---------|
| `sync.js` | **Most między HP a MT0268 — jedno polecenie w każdą stronę.** `node tools/sync.js` daje raport (zmiany lokalne, rozjazd z origin w obie strony, czego git NIE przenosi: `.env`, `node_modules`, katalog backupów). `--pobierz` robi `pull --ff-only` — przy rozjeździe ODMAWIA zamiast po cichu tworzyć commit scalający. `--wyslij` uruchamia bramki, commituje i pcha, po czym **potwierdza odczytem** — porównuje lokalny SHA z `origin/<gałąź>`, bo `git push` potrafi zakończyć się zerem przy zdalnej gałęzi wskazującej gdzie indziej. **Na `main` nie wyśle w ogóle**: push do main to wdrożenie na produkcję (`deploy-worker.yml` dla `worker/**`, Cloudflare Pages dla reszty), więc narzędzie synchronizujące dwa komputery nie ma tam wstępu — pilnuje tego `tests/unit/sync-guard-test.js`, zweryfikowany negatywnie na dwa tryby awarii. Celowo **nie działa w tle**: automat pchający zmiany co zapis wypychałby stany pośrednie na żywy system podatkowy. Pełny runbook trzech mostów (kod / claude.ai↔komputer / sesja↔sesja): `docs/MOST-DWA-KOMPUTERY.md` |

## Konfiguracja lokalna

| Skrypt | Co robi |
|--------|---------|
| `env-setup.js` | **Tworzy albo UZUPEŁNIA `.env`** na podstawie `.env.example`. `npm.cmd run env:setup`. W odróżnieniu od `Copy-Item .env.example .env` **nie nadpisuje** istniejących wartości — dopisuje wyłącznie brakujące klucze wraz z ich komentarzami. Omija dwie pułapki Windowsa: `.env.txt` z Notatnika (wykrywa i ostrzega — dotenv go nie czyta, a `.gitignore` nie ignoruje) oraz UTF-16LE po zapisie przez `>` w PowerShellu (wykrywa i przepisuje na UTF-8). **Nigdy nie wypisuje wartości** — raportuje nazwy kluczy i to, czy są wypełnione, więc wynik da się wkleić do zgłoszenia bez wycieku |

## Dowód rejestracyjny — katalog pól i Excel

| Skrypt | Co robi |
|--------|---------|
| `modules/dr-fields.js` | **Jedno źródło prawdy dla pól DR.** 34 pola z oznaczeniami z rozporządzenia (A, B, D.1, E, F.1…), z flagami `dt1` (wpływa na podatek), `osobowe` (maskowanie), `aztec` (jest w ładunku kodu) i mapowaniem na nazwy CEPiK. Sześć kodów oznaczonych `pewne: false` — wpisanych z wiedzy ogólnej, do sprawdzenia w Dz.U. Katalog nie udaje pewności, której nie ma |
| `xlsx-import.js` | **Wczytuje istniejący arkusz** (np. „Zestawienie pojazdów") i normalizuje go do pól DR. Dwa kroki, bo nie znamy cudzych nagłówków: `--pokaz` wypisuje kolumny i PROPONOWANE dopasowanie z oznaczeniem pewności (✓ kod lub pełna nazwa, ≈ fragment — sprawdź, — brak), dopiero potem `--wyjscie dane.json`. Zgadywanie mapowania bez pokazania go człowiekowi dałoby plik, w którym „masa własna" trafiła do kolumny DMC — błąd, który wygląda wiarygodnie. Ręczne mapowanie: `--mapa mapa.json` |
| `dr-excel.js` — walidacja | **Wartość niepasująca do typu pola NIE trafia do arkusza.** Pierwsze scalenie danych z OCR ujawniło `2023.05.11` w polu masy, `m.p.` w polu liczbowym i `99` jako liczbę osi. Model czytający skan potrafi przypisać wartość do sąsiedniego pola; arkusz, który to przyjmuje, wygląda na kompletny i jest fałszywy. Zakresy (`dmcKg` 100–100000, `liczbaOsi` 1–10 itd.) siedzą w katalogu `modules/dr-fields.js`, nie w narzędziu. Odrzucone wartości trafiają na arkusz **Odrzucone** z powodem — ciche pominięcie zamieniłoby jeden problem na drugi. `--zrodlo ocr` nadaje źródło rekordom, które go nie mają |
| `dr-excel.js --pokaz` | **Co naprawdę jest w pliku JSON, zanim go scalisz.** Rozpoznaje tablicę, obiekt z rekordami pod dowolnym kluczem i plik bez rekordów; wypisuje, ile pól pasuje do katalogu (z zaznaczeniem DT-1), ile jest spoza niego i ile rekordów ma oznaczone źródło. Pliki z cudzych pipeline'ów mają własny kształt, a scalanie na ślepo daje arkusz z pustymi kolumnami i **żadnego sygnału**, że coś poszło nie tak — brak danych wygląda identycznie jak brak dopasowania |
| `dr-excel.js --zarzad <plik.xlsx>` | **DRUGI skoroszyt — prezentacyjny, dla zarządu i do wczytania przez inny program.** Powstaje z tych samych scalonych danych co techniczny (jedno wywołanie daje oba). Cztery arkusze: *Podsumowanie* (liczby do decyzji), *Flota* (jeden wiersz na pojazd, stabilne nagłówki, bez scalonych komórek i bez znaczenia w kolorze — nadaje się do importu), *Podatek DT-1*, *Jakość danych*. **Dlaczego osobny plik, a nie dodatkowe arkusze w technicznym:** odbiorcy mają sprzeczne potrzeby, a arkusze diagnostyczne obok prezentacyjnych zachęcają do wklejenia całości do prezentacji razem z „447 odrzuconych wartości" — co czyta się jak awaria, a jest normalną pracą filtrów. **Arkusz nie udaje pewności, której nie ma:** każdy wiersz niesie kolumnę „Pewność" (wysoka / tylko OCR / numer z nazwy pliku), a Podsumowanie podaje, ile pojazdów zna wyłącznie OCR — bo numer czytany z nazwy pliku bywa przekłamany o jeden znak i tworzy pojazd, który nie istnieje |
| `dr-excel.js` | **Excel ze wszystkimi polami DR + POCHODZENIE każdej wartości.** `npm.cmd run dr:excel -- dane.json`. Trzy arkusze: *Pojazdy* (kolumny w kolejności katalogu, nagłówki z kodami urzędowymi, liczby jako liczby, **kolor komórki wg źródła**), *Pokrycie* (ile wypełnionych na pole i z jakiego źródła; pola DT-1 poniżej 50% na czerwono), *Konflikty* (gdy źródła podały RÓŻNE wartości — wygrywa wyższe w hierarchii Aztec > CEPiK > zestawienie > OCR > nazwa pliku, ale rozbieżność zostaje widoczna), *Legenda*. Przyjmuje WIELE plików wejściowych naraz i scala je po numerze rejestracyjnym. Powód, dla którego kolor jest w arkuszu, a nie w logu: „3500" z kodu Aztec i „3500" zgadnięte przez model z rozmytego skanu wyglądają identycznie, a przy DMC przekładają się wprost na kwotę wobec urzędu. Zapis do drzewa repo **odmawiany** |

## CEPiK — rejestr państwowy jako źródło danych DT-1

| Skrypt | Co robi |
|--------|---------|
| `cepik-batch.js` | **Pobiera dane DR z rejestru państwowego dla całej floty.** `npm.cmd run cepik:batch -- zestawienie.json --wyjscie cepik.json`. Pomiar sondą (21.08) wykazał, że CEPiK zwraca **68 pól** i pokrywa **9 z 10 pól DT-1** — w tym liczbę osi i rodzaj zawieszenia, których nie ma ani w zestawieniu, ani w OCR, ani w Aztec (0%). Brakuje tylko normy EURO, a ta jest w zestawieniu. Bez poświadczeń — endpoint publiczny, zmierzone. Województwo z prefiksu numeru, przy pudle próbuje pozostałych 15 kodów (błędny kod daje **pusty wynik, nie błąd** — wygląda jak „pojazdu nie ma"). Odstęp 350 ms, checkpoint zapisywany co 10 pojazdów, wznawianie po przerwaniu. `--limit N` do zmierzenia tempa przed pełnym przebiegiem |
| `cepik-probe.js` | **Czy `api.cepik.gov.pl` wymaga autoryzacji i jakie pola zwraca.** `POST /api/cepik/token` oddaje 503 „CEPiK nie jest skonfigurowany" — sekrety `CEPIK_KEY`/`CEPIK_SECRET` nigdy nie zostały ustawione. Zanim ktokolwiek wystąpi o poświadczenia, ta sonda odpowiada taniej: czy endpoint otwartych danych w ogóle ich potrzebuje, oraz czy zwraca **liczbę osi i rodzaj zawieszenia** — pola DT-1, których `_qavParseCepik` w `app.js` nie mapuje (mapuje markę, model, VIN, rok, DMC, paliwo, kategorię). Nie da się tego sprawdzić z konsoli przeglądarki: CSP aplikacji nie ma `api.cepik.gov.pl` w `connect-src`. Nie wypisuje VIN-u ani numeru rejestracyjnego |

## OCR wsadowy — dowody bez danych w zestawieniu

| Skrypt | Co robi |
|--------|---------|
| `dr-ocr-batch.js` | **Ponowny OCR przez żywy endpoint `/api/ai/ocr`** dla listy `[{nrRej, plik}]`. Render 150 DPI JPEG (ustawienia `PDF_OCR` z `modules/dr-import.js` — musi się z nimi zgadzać, inaczej narzędzie mierzy inny render niż produkcja). Auto-relogin przy wygasłym tokenie (HTML zamiast JSON w odpowiedzi). Checkpoint dopisywany po każdym dokumencie, więc przerwanie nie traci postępu. Zalecany chunk ~20 dokumentów — większe partie (40–69) bywały ubijane w tle bez czytelnego sygnału przyczyny |
| `dr-ocr-retry-rotacje.js` | Próba obrotów `[-90, 0, 90, 180]` przez kaskadę CF/Groq na Workerze. **Ślepy zaułek — patrz `dr-ocr-batch-cloudrun.js` niżej.** Test 25.08 trafił w wyczerpane dzienne limity obu warstw (CF 4006, Groq TPD), a NIEZALEŻNIE od tego okazało się, że przyczyną zer wcale nie był (tylko) obrót strony — patrz niżej |
| `dr-ocr-batch-cloudrun.js` | **Właściwa naprawa klastra "zero z CF/Groq" — woła Cloud Run (RapidOCR) BEZPOŚREDNIO, z pominięciem limitu 8s Workera.** Znalezisko 25.08: dokumenty typu `WE6LR8x`/`WE6LT5x` (klaster Toyot Hilux GR) mają treść strony PDF narysowaną w orientacji pionowej mimo fizycznie poziomego dowodu — `page.rotate`=0, obrót zaszyty w macierzy rysowania obrazu, nie we fladze PDF. `ocr-service/extractors/rapid_fields.py` prostuje to Tesseract OSD PRZED wywołaniem RapidOCR — zweryfikowane na WE6LR80: z zera pól (dwie pełne rundy CF+Groq) do kilku poprawnych pól, zgodnych z ręczną inspekcją wizualną obróconego dokumentu. **Silnik zmieniony 25.08 wieczorem z PaddleOCR na RapidOCR** (github.com/RapidAI/RapidOCR — te same modele PP-OCR, ONNX Runtime zamiast frameworka paddlepaddle): PaddleOCR miał dobrą jakość, ale jego akcelerator CPU oneDNN padał twardym crashem na Cloud Run (SIGFPE, dwie różne awarie na dwóch wersjach), a wyłączenie go dawało 30-80s/dokument. RapidOCR: **8-11s/dokument, 5-8× szybciej**, wciąż nie DOSTATECZNIE poniżej limitu 8s Workera, żeby bezpiecznie włączyć Próbę 0 z powrotem — ale dla wsadu uruchamianego z tego narzędzia bez znaczenia. Wymaga `OCR_PYTHON_SECRET`/`OCR_PYTHON_URL` w `.env` |
| `dr-ocr-boxes.js` | **Podgląd SUROWYCH boxów OCR dla jednego dokumentu — narzędzie do strojenia parsera.** Odpowiada na pytanie, którego sam wynik nie rozstrzyga: puste pole ma DWIE zupełnie różne przyczyny — (a) OCR nie odczytał tekstu, (b) odczytał, ale parser geometryczny nie dopasował go do etykiety. Bez tego strojenie jest zgadywaniem. Uruchomienie 25.08 na `WE6LR80` wykryło w 15 minut cztery realne błędy naraz: odwrócony układ strony (cicha korupcja `dmcKg=1882` z rubryki „18,82 kN"), `"D.1 TOYOTA"` jako JEDEN box (stąd `marka` 2%), sklejanie części dziesiętnych (`"2755,00 cm³"` → 275500, poza zakresem → pole puste) i przekazywanie wymiarów sprzed obrotu. `--szukaj TEKST` filtruje boxy. ⚠ Wynik zawiera pełny tekst dokumentu (VIN, właściciel) — nie zapisuj do repo |
| `dr-braki-checklist.js` | Osobny plik xlsx dla pojazdów, których ŻADNE źródło nie wypełniło na tyle, żeby policzyć DT-1 (bez DMC, albo ≥12t bez osi/zawieszenia). Do ręcznego wypełnienia, posortowany po ścieżce pliku źródłowego |

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
| `autotest/d1-flota-check.js` | Pyta o co innego niż wiersz wyżej: nie o KSZTAŁT bazy, tylko o to, czy stoją w niej takie **dane**, żeby podatek dało się policzyć. Wykrywa: duplikaty po VIN (ten sam pojazd pod dwiema tablicami — podatek policzy się dwa razy), pojazdy bez DMC (cicho wypadają z podstawy opodatkowania), pojazdy od 12 t bez liczby osi (silnik przyjmuje wtedy 2, czyli najniższą stawkę), oraz rozjazd zapisanych kolumn `dt1_*` z **produkcyjnym** `tax-engine.js`. `npm run flota-check`, `--strict` = kod wyjścia 1, `--z-pliku <json>` = bez wranglera. **Niczego nie zapisuje.** |

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
