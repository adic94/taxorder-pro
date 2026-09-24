# Audyt przekrojowy schema → API → tenant/role/license → UI

Data: 2026-08-31  
Zakres: statyczny audyt tylko do odczytu; bez wywołań produkcyjnych i bez zmian kodu programu.  
Środowisko odniesienia: lokalne repozytorium oraz istniejąca konfiguracja UAT.

## Wynik wykonawczy

Nie znaleziono P0. Znaleziono 6 problemów P1 i 3 problemy P2. Najważniejszy wniosek: zielony UAT centrów A–F potwierdza scenariusz administratora w pakiecie Enterprise, ale nie obejmuje pakietu Pro, indywidualnego odebrania modułu, roli viewer ani przełączania firmy przez administratora. W tych wariantach warstwy UI i API rozchodzą się.

## P1 — pakiet `pro` jest nieznany serwerowej bramce licencji

**Dowody**

- Frontend i zapis konfiguracji posługują się nazwą `pro`: `modules/access-control.js:23-52`, `modules/access-control.js:82-85`, `worker/index.js:12126-12133`.
- Serwerowa mapa płatnych modułów zna `professional`, ale nie `pro`: `worker/index.js:14686-14694`.
- Nieznana nazwa pakietu kończy się pustą listą, a płatny endpoint zwraca 402: `worker/index.js:14713-14717`, `worker/index.js:14733-14737`.

**Skutek**

Firma z legalnie ustawionym pakietem `pro` widzi moduły Pro w UI, ale wszystkie endpointy objęte `MODULE_ROUTES` mogą odpowiadać 402. Dotyczy m.in. centrum operacyjnego (`/api/operations`).

**Minimalna reprodukcja (lokalnie/UAT)**

1. Ustaw dla syntetycznej firmy `company_packages.package_name='pro'`.
2. Zaloguj użytkownika tej firmy.
3. `GET /api/operations?company=<firma>`.
4. Oczekiwane: 200; obecnie przy włączonym egzekwowaniu modułów: 402.

**Regresja**: test tabelaryczny `basic`, `pro`, `enterprise` dla każdego wpisu `MODULE_ROUTES`; jedna kanoniczna nazwa pakietu po obu stronach.

## P1 — indywidualne zakazy modułów i część wyjątków firmy działają tylko w UI

**Dowody**

- UI pobiera `user_module_permissions`, oblicza `allowed` i blokuje `showPage`: `worker/index.js:12153-12169`, `modules/access-control.js:107-118`, `app.js:348-359`.
- Serwerowa bramka API odczytuje wyłącznie `company_packages`; nie odczytuje `user_module_permissions`: `worker/index.js:14697-14725`, `worker/index.js:14728-14737`.
- `modules_add/modules_remove` zapisują identyfikatory ekranów (np. `operations-workbench`), podczas gdy `MODULE_ROUTES` sprawdza inne kody domenowe (np. `transport`, `webhooks`, `finance`): `modules/access-control.js:28`, `modules/access-control.js:76-77`, `worker/index.js:14602-14604`.

**Skutek**

Użytkownik z odebranym modułem może wywołać jego API bezpośrednio. Dodatkowo usunięcie `operations-workbench`, `integration-hub` lub `automation-center` z pakietu nie usuwa odpowiednio serwerowych uprawnień `transport`, `webhooks` lub `finance`.

**Minimalna reprodukcja**

1. Dla użytkownika ustaw `denied_modules=['operations-workbench']`.
2. Potwierdź blokadę strony w UI.
3. Tym samym tokenem wywołaj `GET /api/operations?company=<firma>`.
4. Oczekiwane: 403/402; obecnie dostęp zależy tylko od pakietu firmy.

**Regresja**: macierz token × firma × rola × pakiet × `allowed_modules/denied_modules` wykonywana bezpośrednio przeciw API.

## P1 — rola `viewer` może modyfikować dane domenowe przez API

**Dowody**

- Dispatcher wymaga jedynie uwierzytelnienia dla opon, polis i tankowań: `worker/index.js:10170-10171`, `worker/index.js:10198`, `worker/index.js:10202`.
- Mutacje opon POST/PUT/DELETE nie sprawdzają roli: `worker/index.js:1100-1116`, `worker/index.js:1119-1157`, `worker/index.js:1160-1164`.
- Mutacje polis POST/PUT/DELETE również nie sprawdzają roli: `worker/index.js:5012-5038`.
- Mutacje tankowań POST/PUT/DELETE również nie sprawdzają roli: `worker/index.js:5242-5280`.

**Skutek**

Konto tylko do odczytu może tworzyć, zmieniać i usuwać dane operacyjne własnej firmy, omijając ograniczenia interfejsu. To jest błąd autoryzacji, nie tylko UX.

**Minimalna reprodukcja**

1. Utwórz syntetyczne konto `viewer` na UAT.
2. Wyślij `POST /api/tires?company=<własna_firma>` z minimalnym JSON.
3. Oczekiwane: 403; obecnie kod prowadzi do INSERT.

**Regresja**: dla każdej mutującej trasy testuj role `viewer`, `kierowca`, `dyspozytor`, `kierownik`, `admin`, `superadmin`; domyślnie odmawiaj zapisu.

## P1 — centra integracji i automatyzacji ignorują firmę wybraną przez administratora

**Dowody**

- Centrum operacyjne konsekwentnie wysyła `?company=` i sprawdza dostęp: `modules/operations-workbench.js:69`, `worker/index.js:6536-6544`, `worker/index.js:6593-6594`.
- Integracje nie wysyłają `company`, a handler bezwarunkowo używa `user.company_id`: `modules/integration-hub.js:6-7`, `worker/index.js:9525-9536`.
- Automatyzacje zachowują się tak samo: `modules/automation-center.js:3-5`, `worker/index.js:9449-9454`.
- Licencja tych dwóch centrów jest więc również sprawdzana dla `user.company_id`, bo bramka używa parametru lub firmy użytkownika: `worker/index.js:14728-14737`.

**Skutek**

Administrator przełączający firmę w globalnym selektorze nadal ogląda i zmienia integracje/automatyzacje firmy przypisanej do swojego konta. Ekran pokazuje inny kontekst niż dane. Może to prowadzić do operacji na złym najemcy.

**Minimalna reprodukcja**

1. Zaloguj admina firmy A posiadającego dostęp do firmy B.
2. Przełącz UI na firmę B.
3. Otwórz centrum integracji lub automatyzacji i obserwuj request: brak `?company=B`.
4. Oczekiwane: dane B; obecnie handler odpytuje A.

**Regresja**: jeden test admin multi-company dla odczytu i zapisu w każdym z trzech centrów.

## P1 — widoczny moduł „ESG CSRD rozszerzony” nie ma schematu ani API

**Dowody**

- Ekran jest widoczny w nawigacji, ma kontener, skrypt i wywołanie renderowania: `index.html:421`, `index.html:2928`, `index.html:4400`, `app.js:512`.
- Sam moduł deklaruje brakujące tabele i endpointy jako `SCHEMA_NEEDED` / `ENDPOINT_NEEDED`: `modules/esg-extended.js:6-38`.
- Worker dispatchuje `/api/esg-targets`, ale nie `/api/esg-scope` ani `/api/esg-materiality`: `worker/index.js:10274`.
- Modułu `esg-extended` nie ma w katalogu `ALL_MODULES`: `modules/access-control.js:9-80`.

**Skutek**

Użytkownik otrzymuje pełnoprawną pozycję menu, której podstawowe odczyty i zapisy kończą się 404. Nie działa też przypisanie licencji ani uprawnień per użytkownik.

**Minimalna reprodukcja**

1. Otwórz „ESG CSRD rozszerzony”.
2. Wywołanie `GET /api/esg-scope?company=<firma>&year=2026` trafia do końcowego 404.

**Regresja**: test automatyczny „każdy `.tnb` → katalog modułów → render handler → co najmniej jedna rozpoznana trasa API”.

## P1 — OCR faktur paliw zapisuje do nieistniejącego endpointu

**Dowody**

- Moduł jest widoczny, ładowany i renderowany: `index.html:418`, `index.html:2923`, `index.html:4395`, `app.js:507`.
- OCR działa przez `/api/ocr-fuel`, lecz przycisk zapisu wysyła POST do `/api/fuel-records`: `modules/ocr-fuel-invoices.js:215`, `modules/ocr-fuel-invoices.js:311-334`.
- Worker nie dispatchuje `/api/fuel-records`; ma istniejący model `/api/fuel-fills`: `worker/index.js:10202`.

**Skutek**

Użytkownik może rozpoznać fakturę i poprawić pola, ale końcowe „Zapisz” zwraca 404. Workflow wygląda na kompletny aż do ostatniej akcji.

**Minimalna reprodukcja**

1. Otwórz OCR faktur paliw, wypełnij pojazd i litry.
2. Kliknij „Zapisz”.
3. Oczekiwane: rekord tankowania; obecnie POST `/api/fuel-records` nie ma handlera.

**Regresja**: scenariusz OCR preview → approve/save → odczyt utworzonego `fuel_fill`.

## P2 — UAT wysyła błędy frontendowe i pobiera konfigurację z produkcji

**Dowody**

- Dwa inline skrypty omijają `window.__TAXORDER_API_URL__`, `window.CF_API_URL` i `window.CF_WORKER_URL`: `index.html:79-97`, `index.html:5211-5217`.
- Konfigurowalny punkt wejścia istnieje: `config/cf-config.js:13`; główne API używa fallbacku po konfiguracji: `app.js:25-29`.

**Skutek**

Błędy z UAT/lokalnego uruchomienia trafiają do produkcyjnego `/api/errors`, mieszając telemetrię środowisk i potencjalnie przesyłając produkcji URL, user-agent oraz identyfikator firmy testowej. PostHog UAT pobiera także konfigurację produkcyjną.

**Minimalna reprodukcja**

Uruchom frontend z `window.__TAXORDER_API_URL__` wskazującym UAT, wywołaj nieobsłużony wyjątek i sprawdź Network: request idzie do produkcyjnego Workera.

**Regresja**: test przeglądarkowy blokujący dowolny request do hosta produkcyjnego, gdy aktywne jest `UAT_API_URL`.

## P2 — globalna wyszukiwarka nie zna nowych centrów

**Dowody**

- Katalog wyszukiwarki jest ręczną tablicą `PAGES`: `modules/global-search.js:18-52`.
- Nie zawiera `operations-workbench`, `integration-hub` ani `automation-center`, mimo że są w menu i dispatcherze UI: `index.html:307`, `index.html:408-409`, `app.js:436`, `app.js:458-459`.

**Skutek**

Nowe centra nie są osiągalne przez główne narzędzie wyszukiwania, choć produkt ma działać jako jedno centrum operacyjne. Ręczne duplikowanie katalogów będzie generować kolejne rozjazdy.

**Minimalna reprodukcja**

Wpisz w globalnej wyszukiwarce „centrum operacyjne”, „centrum integracji” albo „automatyzacje kosztowe”; brak wyniku typu Moduł.

**Regresja**: generować wyszukiwarkę z jednego katalogu modułów i testować każdy dostępny wpis.

## P2 — osierocone tabele i niepodłączone modele procesu

**Dowody**

- `approval_requests` istnieje wyłącznie w schemacie: `worker/schema_v35.sql:22-42`; bieżący workflow używa innej tabeli `approvals`, np. `worker/index.js:5674`, `worker/index.js:5714-5751`.
- `driver_behavior_events` istnieje wyłącznie w schemacie: `worker/schema_v35.sql:126-144`; brak odczytu/zapisu w Workerze i modułach.
- `operation_requirements` jest tworzona w v54, ale Worker ani UI jej nie odczytuje i nie zapisuje: `worker/migration_v54_operations_axis.sql:64`; przeszukanie dokładnego identyfikatora poza migracjami daje 0 trafień.
- `operation_tasks` jest tylko odczytywana w projekcji listy: `worker/index.js:6625`; brak ścieżki tworzenia/aktualizacji.

**Skutek**

Schemat sugeruje kompletność funkcji, której nie ma w działającym przepływie. Szczególnie scoring kierowcy i wymagania/zadania operacji nie mają źródła danych, więc mogą stale pozostawać puste.

**Minimalna reprodukcja**

Na lokalnej/UAT D1 wykonaj liczniki tabel po pełnym scenariuszu operacyjnym; `operation_requirements` i `operation_tasks` nie otrzymują rekordów przez publiczne API.

**Regresja**: manifest tabel z właścicielem domenowym oraz wymaganym co najmniej jednym writerem i readerem; jawna allowlista tabel archiwalnych/migracyjnych.

## Rekomendowana kolejność napraw

1. Ujednolicić nazwy pakietów i identyfikatory modułów; stworzyć jedną serwerową funkcję decyzji obejmującą pakiet firmy i uprawnienia użytkownika.
2. Wprowadzić domyślne `deny` dla mutacji oraz centralną macierz ról.
3. Dodać kontekst firmy do integration-hub i automation-center, korzystając z tej samej funkcji dostępu co operations.
4. Ukryć niedokończone ESG/OCR za feature flagą albo domknąć ich API i test end-to-end.
5. Usunąć produkcyjne URL-e z wykonywalnych inline skryptów UAT.
6. Wygenerować nawigację, wyszukiwarkę, katalog licencji i mapę API z jednego manifestu.

## Zakres pozytywnie potwierdzony

- Globalny guard blokuje nie-adminowi obcą firmę podaną w `?company=`: `worker/index.js:10069-10076`.
- Klucze API mają osobną kontrolę firmy także dla JSON body: `worker/index.js:10051-10067`.
- Centrum operacyjne posiada dodatkową kontrolę `user_company_access`, ograniczenie listy dla kierowcy oraz tenantowe filtry w zapytaniach: `worker/index.js:6536-6544`, `worker/index.js:6613-6629`.
- Nowe tabele v54-v57, z wyjątkiem wskazanych osieroconych modeli, mają czytelne połączenie z handlerami overview/commands/import/automation.
