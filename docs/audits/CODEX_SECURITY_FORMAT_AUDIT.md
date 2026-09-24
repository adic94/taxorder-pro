# Audyt bezpieczeństwa formatów i izolacji danych

Data: 2026-08-31  
Zakres: import/eksport CSV, TXT, XLS/XLSX/XLSM, XML, JSON i dokumentów oraz izolacja tenantów/role/API keys.  
Tryb: analiza statyczna i bezpieczne testy lokalne. Nie wykonywano żądań do produkcji, uploadów dużych plików ani destrukcyjnego fuzzingu.

## Podsumowanie wykonawcze

Wynik: **wydanie należy wstrzymać do usunięcia dwóch P0**. Zwykły administrator firmy jest globalnie wyłączony z kontroli `company_id`, a następnie może utworzyć klucz API `read_write` przypisany do dowolnej firmy. Daje to trwały, łatwy do wykorzystania dostęp do eksportu i importu danych obcego tenanta.

| Priorytet | Liczba | Znaczenie |
|---|---:|---|
| P0 | 2 | pełny cross-tenant read/write lub trwałe przejęcie dostępu |
| P1 | 4 | istotne naruszenie integralności, dostępności albo bezpiecznej obsługi plików |
| P2 | 3 | prywatność, odporność klienta i brakujące zabezpieczenia warstwowe |
| P3 | 1 | luka w pokryciu testowym/dokumentacji |

## Znaleziska

### SEC-01 — P0 — administrator firmy omija izolację tenantów

**Dowód:** `worker/index.js:10070-10075` pomija globalny guard firmy dla każdej roli `admin`. Ten sam model powtarza `coOf()` w `worker/index.js:12234-12238`. Test `tests/api/tenant-isolation-test.js:5-8` wprost zakłada, że konto `admin` celowo nie podlega scopingowi. Jednocześnie uwierzytelniony użytkownik ma własne `company_id` (`worker/index.js:274-278`), więc `admin` jest rolą konta tenantowego, a nie odrębną tożsamością operatora platformy.

**Wpływ:** administrator firmy A może podać `?company=B` i czytać lub modyfikować dane firmy B w wielu endpointach. Szczególnie wyraźne są dokumenty: lista i upload biorą firmę z query (`worker/index.js:845-872`), a download jawnie przepuszcza każdego admina niezależnie od właściciela dokumentu (`worker/index.js:912-919`). Eksport całej firmy również korzysta z `company` z query (`worker/index.js:10100-10109`).

**Bezpieczny test reprodukcji (UAT, dwa syntetyczne tenanty):** zalogować `admin_a`, wykonać `GET /api/export?company=tenant_b`, `GET /api/docs?company=tenant_b` oraz `PATCH /api/docs/<id_b>?company=tenant_b`. Każde żądanie musi zwrócić `403`; obecna ścieżka kodu przepuszcza je do handlera.

**Rekomendacja:** jedynym źródłem tenanta dla zwykłej sesji i klucza API ma być `user.company_id`. Dostęp wielofirmowy oprzeć na jawnej tabeli `user_company_access` i osobnej roli `superadmin`, sprawdzanej centralnie. Usunąć wyjątek `admin` z globalnego guarda i `coOf()`. Każdy handler dokumentów ma dodatkowo sprawdzać ownera.

**Brama regresji:** test macierzowy dla ról `viewer/kierowca/kierownik/admin/superadmin` i metod GET/POST/PATCH/DELETE na co najmniej `/api/export`, `/api/import`, `/api/docs`, `/api/dr-import`, `/api/polisy-import`. `admin_a + company_b` zawsze 403; tylko `superadmin` lub jawny grant może przejść.

### SEC-02 — P0 — administrator może wybić klucz API dla dowolnej firmy

**Dowód:** endpoint wymaga wyłącznie roli `admin` (`worker/index.js:1968-1969`), następnie ufa `company_id` przesłanemu w body (`worker/index.js:1980-1991`). Nie porównuje go z `user.company_id` ani tabelą przydziałów. Utworzony klucz dziedziczy rolę `admin` przy zakresie `read_write` (`worker/index.js:281-294`). Kontrole importu/eksportu uznają taki klucz za prawidłowy, jeżeli query zgadza się z firmą wpisaną w kluczu (`worker/index.js:10104-10121`).

**Wpływ:** admin firmy A może utworzyć trwały klucz dla firmy B, a potem eksportować i importować jej dane. Atak nie zależy od globalnego wyjątku admina po utworzeniu klucza.

**Payload testowy (UAT):** `POST /api/api-keys` jako `admin_a` z JSON `{"name":"negative-test","company_id":"tenant_b","scope":"read_write"}`. Oczekiwane `403`; obecnie kod tworzy klucz. Po teście klucz natychmiast unieważnić.

**Rekomendacja:** ignorować `body.company_id` i zawsze używać `user.company_id`; alternatywnie wymagać `superadmin` + jawnego grantu. Wymusić scope najmniejszych uprawnień, audytować utworzenie i rotację klucza. API key nie powinien mapować się na ogólną rolę `admin`; autoryzacja ma bazować wyłącznie na scopes/capabilities.

**Brama regresji:** test: `admin_a` nie może utworzyć klucza dla `tenant_b`; klucz `read` nie może wykonać żadnej mutacji; klucz `read_write` firmy A zawsze dostaje 403 dla firmy B.

### SEC-03 — P1 — upload dokumentów bez allowlisty, limitu i kontroli roli

**Dowód:** `/api/docs/upload` przyjmuje dowolny obiekt `file`, ufa rozszerzeniu i MIME klienta oraz strumieniuje go do R2 bez limitu (`worker/index.js:866-903`). Cały router wymaga tylko zalogowania (`worker/index.js:10168`), więc każdy użytkownik może też wejść w PATCH/DELETE (`worker/index.js:933-963`). Importy polis i DR mają allowlistę rozszerzeń, lecz nadal nie mają limitu rozmiaru ani weryfikacji magic bytes (`worker/index.js:3717-3731`, `worker/index.js:3852-3863`). Dla porównania upload POD poprawnie wymusza 20 MB (`worker/index.js:6671-6674`).

**Wpływ:** zapełnienie R2, koszt i przeciążenie Workera, przechowywanie dowolnej treści jako zaufanego dokumentu, spoofing MIME oraz kasowanie/metadane dokumentów przez role bez uprawnień zarządczych.

**Bezpieczne payloady:** mały plik tekstowy nazwany `test.pdf` z `Content-Type: application/pdf`; mały `test.html`; syntetyczny multipart z zadeklarowanym `Content-Length` powyżej limitu (bez wysyłania dużego body). Oczekiwane odpowiednio `415`, `415`, `413`.

**Rekomendacja:** wspólna funkcja upload guard: limity per endpoint i tenant, allowlista rozszerzenie + MIME + magic bytes, limit liczby stron/pikseli, kwarantanna/skan, `X-Content-Type-Options: nosniff`, restrykcyjne role dla upload/PATCH/DELETE. Usuwać R2 po błędzie zapisu DB.

**Brama regresji:** kontraktowe testy 413/415 i macierz ról; potwierdzenie, że błąd DB nie zostawia sieroty w R2.

### SEC-04 — P1 — nieograniczony i nadmiernie elastyczny import JSON

**Dowód:** `/api/import` materializuje całe body przez `req.json()` bez limitu liczby rekordów lub rozmiaru (`worker/index.js:2441-2449`). Następnie wykonuje pętle i batche dla wszystkich danych (`worker/index.js:2453-2527`). „Whitelistą” kolumn jest tylko regex poprawnej nazwy SQL; kod nie ogranicza pól do jawnego schematu eksportowego (`worker/index.js:2502-2507`). W efekcie klient może modyfikować dowolną istniejącą kolumnę tabel z `EXPORT_TABLES`, z wyjątkiem `id` i `company_id`.

**Wpływ:** wyczerpanie CPU/D1, częściowe importy po błędzie, obejście reguł domenowych i modyfikacja pól systemowych (statusy, autor, timestampy) przez import.

**Payload testowy:** syntetyczny JSON z jednym rekordem zawierającym dodatkowe pola systemowe, np. `created_by`, `approved_by`, `updated_at`, oraz osobny test z 2001 rekordami. Oczekiwane: nieznane/niedozwolone pola 422; przekroczony limit 413/422 przed wykonaniem zapisu.

**Rekomendacja:** jawna lista importowalnych pól per tabela/wersja kontraktu, max body/max rows/max columns/max cell length, pełny dry-run i walidacja przed transakcją/commit, raport odrzuceń bez surowych komunikatów DB.

**Brama regresji:** testy kontraktowe dla każdego `EXPORT_TABLES`: dozwolone pola przechodzą, systemowe są odrzucane; limit 2000 wierszy i atomowość importu.

### SEC-05 — P1 — CSV/XLSX formula injection w starszych eksportach

**Dowód:** nowy Integration Hub ma poprawną ochronę komórek zaczynających się od `= + - @` (`modules/integration-hub.js:37-38`). Starszy eksport floty zapisuje surowe wartości do XLSX i CSV (`modules/import-export.js:236-264`). Eksport FK tylko cudzysłowi dane, co nie neutralizuje formuł (`worker/index.js:6216-6225`). Eksport tachografu analogicznie tylko escapuje separator/cudzysłów (`worker/index.js:9219-9226`). Ten wzorzec występuje także w wielu modułach raportowych.

**Wpływ:** po otwarciu eksportu w Excelu/LibreOffice komórka kontrolowana przez dane może wykonać formułę, otworzyć zewnętrzny URL lub uruchomić niebezpieczny mechanizm zależny od konfiguracji klienta.

**Payload testowy:** `=1+1`, `+SUM(1,1)`, `-1+2`, `@SUM(1,1)` oraz `=HYPERLINK("https://example.invalid/";"test")` w polu opis/nazwa. Oczekiwany tekst powinien rozpoczynać się apostrofem lub być zapisany jawnie jako typ string, nigdy formula.

**Rekomendacja:** jedna współdzielona funkcja `safeSpreadsheetCell` używana przez wszystkie eksporty CSV/TXT/XLS/XLSX; uwzględnić wiodące spacje, tabulatory i CR/LF przed markerem formuły.

**Brama regresji:** statyczny test wykrywający lokalne implementacje CSV bez wspólnego sanitizera oraz test otwierający wygenerowane XLSX i potwierdzający `cell.t === 's'`/brak `cell.f`.

### SEC-06 — P1 — import kart paliwowych nie jest idempotentny

**Dowód:** confirm wykonuje `INSERT OR IGNORE` (`worker/index.js:7982-7996`), ale schemat `fuel_fills` ma zwykłe indeksy, nie unikalny klucz transakcji (`worker/schema_v24.sql:25-28`). Ponowienie tego samego requestu może więc dopisać te same tankowania ponownie. Scheduler stosuje deduplikację aplikacyjną po zbyt słabym zestawie `(company_id,nr_rej,fill_date,liters)` (`worker/index.js:13643-13661`), podatnym zarówno na kolizje, jak i duplikaty różniące się formatem.

**Wpływ:** podwójne koszty, fałszywe alerty oszustw paliwowych i błędne rozliczenia przy retry sieciowym.

**Payload testowy:** dwa identyczne wywołania confirm z rekordem syntetycznym. Drugie musi zwrócić `replayed:true`/`skipped:1`, a liczba rekordów pozostać 1.

**Rekomendacja:** wymagany identyfikator transakcji dostawcy lub stabilny fingerprint znormalizowanych pól, unikalny indeks `(company_id, source_provider, source_transaction_id/fingerprint)` i idempotency key całego importu.

**Brama regresji:** podwójny confirm i równoległe dwa confirmy dają dokładnie jeden rekord.

### SEC-07 — P2 — brak ochrony przed workbook/zip bomb i limitów klienta

**Dowód:** UI deklaruje „Max 5 MB”, ale `VehicleImport.handleFile` nie sprawdza `file.size` i od razu ładuje cały plik do pamięci/SheetJS (`modules/vehicle-import.js:199-216`). To samo występuje w ogólnym imporcie XLSX (`modules/import-export.js:163-204`), Bulk Import (`modules/bulk-import.js:189-205`) i Integration Hub (`modules/integration-hub.js:34`). Limit 2000 w Integration Hub jest stosowany dopiero po stronie serwera do już sparsowanych rekordów (`worker/index.js:9553`), więc nie chroni przeglądarki przed skompresowanym workbookiem.

**Wpływ:** zawieszenie karty, duże zużycie RAM i utrata niezapisanej pracy użytkownika.

**Bezpieczny test:** wygenerowany lokalnie skoroszyt nieprzekraczający 6 MB oraz arkusz z liczbą komórek powyżej limitu; aplikacja ma odrzucić go przed `FileReader/XLSX.read`. Nie testować bomb kompresyjnych na współdzielonym środowisku.

**Rekomendacja:** sprawdzić rozmiar przed odczytem, ograniczyć liczbę arkuszy/wierszy/kolumn/komórek i długość shared strings; parsować w Web Workerze; XLSM traktować jako dane bez VBA, z jawnym komunikatem.

**Brama regresji:** spy na `XLSX.read` potwierdza, że nie jest wywołane dla pliku ponad limit.

### SEC-08 — P2 — VIN-y i adres e-mail trafiają do logów

**Dowód:** Worker loguje pełny VIN przed i po sanitizacji (`worker/index.js:3044-3051`, `worker/index.js:3259-3261`, `worker/index.js:3328-3330`). Frontend loguje adres e-mail po zalogowaniu (`modules/cf-cloud.js:72`).

**Wpływ:** zbędne rozpowszechnianie danych identyfikujących pojazd/użytkownika w konsoli i retencji logów operatora.

**Test:** statyczna brama zabraniająca `console.*` z polami `vin`, `email`, `token`, `document`, `nr_rej`; w testach błędów używać wyłącznie syntetycznych identyfikatorów.

**Rekomendacja:** usunąć logi lub stosować jednokierunkowy skrót/ostatnie 4 znaki; zdefiniować retencję i redakcję PII.

### SEC-09 — P2 — harmonogram pobierania CSV ma niepełną ochronę SSRF/DoS

**Dowód:** walidacja URL sprawdza wyłącznie prefiks tekstowy `https://` (`worker/index.js:13559-13568`, `worker/index.js:13590-13607`). Fetch automatycznie podąża za przekierowaniami i następnie materializuje całą odpowiedź przez `resp.text()` bez limitu (`worker/index.js:13638-13641`). Nie ma allowlisty hostów dostawców, pinningu protokołu po redirect ani limitu bajtów.

**Wpływ:** wymuszanie połączeń Workera do niezatwierdzonych hostów oraz pobieranie bardzo dużych odpowiedzi cyklicznie.

**Bezpieczny test:** kontrolowany endpoint UAT zwracający redirect do niezaufanego hosta i odpowiedź z `Content-Length` ponad limit bez przesyłania body. Oczekiwane `UNSAFE_URL`/`PAYLOAD_TOO_LARGE`.

**Rekomendacja:** `new URL`, allowlista hostów per provider, `redirect:'manual'` lub walidacja każdego redirectu, limit Content-Length i strumieniowy limit bajtów, Content-Type CSV/text, limit wierszy.

**Brama regresji:** odrzucenie localhost, adresów prywatnych/link-local, redirectów poza allowlistę i odpowiedzi ponad limit.

### SEC-10 — P3 — test izolacji utrwala wyjątek admina zamiast go wykrywać

**Dowód:** `tests/api/tenant-isolation-test.js:5-8` i `:86` celowo wyklucza adminów, a macierz sprawdza tylko sześć odczytów (`tests/api/tenant-isolation-test.js:106-119`). Brakuje POST/PATCH/DELETE, dokumentów, DR/polis, kluczy API i roli superadmin.

**Rekomendacja:** zastąpić test pełną macierzą ról, tenantów, scopes i metod. Testy muszą pracować na dwóch syntetycznych tenantach UAT i nigdy nie mieć domyślnego URL produkcyjnego.

## Zabezpieczenia potwierdzone

- Integration Hub bierze tenant wyłącznie z tokenu (`worker/index.js:9525-9528`), ogranicza preview do 2000 rekordów (`worker/index.js:9553`) i ma idempotency key (`worker/index.js:9555-9557`).
- Frontend Integration Hub odrzuca `DOCTYPE/ENTITY` w XML (`modules/integration-hub.js:34`) i nie uruchamia makr XLSM przez SheetJS. Nie stwierdzono wykonywalnego XXE w tej ścieżce.
- Eksport Integration Hub neutralizuje podstawowe markery formuł (`modules/integration-hub.js:37-38`), choć sanitizer powinien uwzględniać białe znaki przed markerem.
- Upload POD ma limit 20 MB oraz sprzątanie obiektu po błędzie (`worker/index.js:6671-6700`) — ten wzorzec nadaje się do ponownego użycia.
- SQL korzysta głównie z parametrów `.bind()`. Dynamiczne nazwy w ogólnym imporcie są ograniczone regexem, więc nie potwierdzono klasycznego SQL injection; problemem pozostaje brak semantycznej allowlisty kolumn.

## Rekomendowana kolejność napraw

1. Natychmiast: SEC-02 — zablokować tworzenie kluczy dla obcych firm; rozważyć unieważnienie i audyt istniejących kluczy.
2. Natychmiast: SEC-01 — rozdzielić `admin` tenantowy od `superadmin`, scoping z tokenu/grantu.
3. Przed publicznym importem dokumentów: SEC-03 i SEC-04.
4. Przed eksportami dla klientów: SEC-05 i SEC-06.
5. Następnie: SEC-07–SEC-10 oraz rozszerzona bramka bezpieczeństwa w CI.

## Kryterium wydania

Release może przejść dopiero po: 0 otwartych P0/P1; pełnej macierzy cross-tenant na UAT; negatywnych testach API keys; centralnym upload guardzie; wspólnym sanitizerze arkuszy; idempotentnym imporcie paliwa. Produkcyjne dane i endpointy nie są potrzebne do żadnego z tych testów.
