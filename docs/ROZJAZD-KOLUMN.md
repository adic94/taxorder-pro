# Zapytania do nieistniejących kolumn — inwentarz i rekomendacje

> Stan na 26.08.2026, ustalony przez `tests/unit/worker-columns-test.js` na 862
> zapytaniach z `worker/index.js` wobec schematu zbudowanego z `worker/schema_v*.sql`
> + `worker/migration_v*.sql`. **Nie jest to lista podejrzeń** — każda pozycja to
> zapytanie, którego SQLite odmawia przygotowania.

## Dlaczego to przetrwało tak długo

To poprawny JavaScript i poprawny SQL. `node --check`, eslint, `xss-audit` i Playwright
przechodzą obok — błąd ujawnia się dopiero przy wykonaniu, wobec konkretnego schematu.
Skutek zależy wyłącznie od tego, czy zapytanie ma `.catch()`:

- **z `.catch()`** → cicha pustka: zero, pusta lista, brak śladu w konsoli;
- **bez `.catch()`** → 500.

Ciche zera są groźniejsze, bo użytkownik dostaje wiarygodnie wyglądający wynik.

## A0. Bramka najpierw ukrywała część własnych znalezisk

Pierwsza wersja `worker-columns-test.js` rozpoznawała brakującą kolumnę **jednym**
komunikatem SQLite — `no such column: X`. Tymczasem SQLite zgłasza to **dwoma**,
zależnie od rodzaju zapytania:

| rodzaj | komunikat |
|---|---|
| `SELECT` / `UPDATE` | `no such column: X` |
| `INSERT` | `table T has no column named X` |

Wszystkie zepsute **INSERT-y** trafiały więc do kosza „poza zasięgiem ekstrakcji"
i były liczone jako ograniczenie narzędzia, nie jako błędy. Po naprawie klasyfikatora
liczba niezmierzonych zapytań spadła z 20 do 12, a **trzy defekty wyszły z ukrycia**:

| linia | zapytanie | skutek | status |
|---|---|---|---|
| 12730 | `INSERT INTO sessions (id, …)` | `sessions` nie ma kolumny `id`; **bez `.catch()` → 500 na ścieżce logowania Clerk** | naprawione |
| 12453 | `INSERT INTO vehicle_qr_scans(… scanned_at, scanner_ip …)` | `.catch(()=>{})` — skany QR **nigdy się nie zapisywały**, bez żadnego sygnału | naprawione |
| 12375 | `INSERT INTO report_configs(… filter_col, filter_val, row_limit)` | schemat ma `filters`/`sort_by`; zapis konfiguracji raportu pada | wymaga decyzji |

`sessions` jest wart osobnej uwagi: poprawny wzorzec
(`INSERT INTO sessions(token, user_id, expires_at)`) stoi **dwa razy w tym samym pliku**
(linie 363 i 523), a komentarz nad zepsutą wersją deklaruje „taka sama jak przy normalnym
logowaniu". To była trzecia, rozjechana kopia — ta sama klasa co dwa prompty OCR, dwie
tablice CO2, dwie listy źródeł raportów i dwie deklaracje wersji ZXing.

`report_configs` dołącza do grupy A: front czyta `filter_col`/`filter_val`, więc kod
i frontend zgadzają się ze sobą, a odmieńcem jest schemat.

## A. Pięć tabel, których kształt nikt nie używa (`schema_v35`)

`cmr_documents`, `sent_records`, `messages`, `edoreczenia_items`, `driver_work_sessions`
dostały w `schema_v35` kształt, do którego **nie odwołuje się żaden kod**. Zmierzone:
14 kolumn tych tabel ma **zero wystąpień** w `worker/index.js` ORAZ w `app.js`,
`index.html` i `modules/` — `shipper_name`, `origin_place`, `notification_number`,
`planned_start`, `received_at`, `content_summary`, `goods_type`, `work_type` i dalsze.

Handler i frontend mówią spójnie **innym** słownikiem: front wysyła `cmr_number`,
`goods_name`, `departure_date`, `work_date`, `reference_number` — i te same nazwy
występują w workerze. Czyli kod front↔backend zgadza się ze sobą, a odmieńcem jest
schemat.

**Wniosek: te funkcje nigdy nie działały.** POST pada na „no such column", lista wraca
pusta przez `.catch()`. Nie jest to regresja — to stan od wprowadzenia.

| tabela | kolumna w kodzie | co jest w schemacie | linia |
|---|---|---|---|
| `cmr_documents` | `cmr_number` | `document_number` (martwa) | 12379 |
| `sent_records` | `sent_number` | `notification_number` (martwa) | 12396 |
| `sent_records` | `departure_date` | `planned_start` (martwa) | 12391 |
| `edoreczenia_items` | `title` | `subject` | 12509 |
| `edoreczenia_items` | `sent_date` | `received_at` (martwa) | 12504 |
| `driver_work_sessions` | `work_date` | `session_date` | 12584, 12594 |
| `messages` | `parent_id` | brak — wątkowanie nie działa | 12407, 12410 |

**Rekomendacja: migracja dodająca brakujące kolumny (`ALTER TABLE ADD COLUMN`), nie
przepisywanie handlerów.** Uzasadnienie: front i backend już się zgadzają, więc taniej
dostroić schemat niż dwie warstwy kodu. `ALTER ADD COLUMN` jest przyrostowy — poprawny
niezależnie od tego, czy tabele mają wiersze, czego z tej sesji nie da się sprawdzić
(brak dostępu do produkcyjnego D1).

> ⚠️ **To zmiana schematu produkcyjnego.** Nowy `schema_vNN.sql` zostanie zastosowany
> przez nocny automat po scaleniu do `main`. Decyzja należy do właściciela — dlatego
> migracja NIE wchodzi w tej zmianie, tylko rekomendacja.

## B. NAPRAWIONE w tej zmianie

Kolumna o właściwym znaczeniu istniała pod inną nazwą — naprawa po stronie kodu,
zero zmian w bazie.

| linia | było | jest | skutek przed naprawą |
|---|---|---|---|
| 11424 | `SUM(f.koszt) FROM fuel` | `SUM(f.total_cost) FROM fuel_fills` | ciche zero: koszt paliwa w KPI |
| 11425 | `SUM(so.cost) … so.date` | `koszt_rzeczywisty … data_realizacji` | ciche zero: koszt serwisu w KPI |
| 11427 | `tachograph_violations … created_at` | `violation_date` | ciche zero: licznik naruszeń |
| 11445 | `SUM(f.koszt) FROM fuel` (top pojazdów) | `fuel_fills` | pusty ranking pojazdów wg paliwa |
| 11447 | `driver_name FROM tachograph_violations` | `JOIN tachograph_files` (imię+nazwisko z pliku) | pusty ranking naruszeń |
| 12463 | `service_orders … strftime('%Y',date)` | `data_realizacji` | kreator raportów: pusty wynik |
| 6543 | `driver_name FROM faults` | `JOIN vehicles` po `$.kierowca` | **500 przy każdym wywołaniu** |
| 12844 | `INSERT INTO polisy` | `INSERT INTO insurance_policies` | **import polis meldował sukces, nie zapisując nic** |

Dwie z tych pozycji to nie ciche zera:

**`faults` w rankingu kierowców (6543)** siedzi w `env.DB.batch()`, a **batch w D1 jest
atomowy** — jedno wadliwe zapytanie odrzuca całą partię. Endpoint zwracał 500 przy
każdym wywołaniu. `faults` nie ma kolumny kierowcy w ogóle: usterka jest przypisana do
pojazdu, a jedyna kolumna osobowa to `reported_by` (zgłaszający ≠ kierowca). Kierowcę
wiążemy tak, jak robi to kreator raportów — przez przypisanie kierowcy do pojazdu
(`JSON_EXTRACT(data,'$.kierowca')`, jedyne takie mapowanie w kodzie produkcyjnym).
Złączenie idzie po `(company_id, nr_rej)`, na czym stoi istniejący indeks
`idx_faults_vehicle`.

**`handleBulkSavePolicy` (12844)** był najgorszym przypadkiem w całym zestawieniu:
INSERT do tabeli `polisy`, której nie tworzy żaden `schema_v*.sql`, `.catch()` odkładał
powód do `console.warn`, a handler i tak zwracał `{ok:true}`. Import polis meldował
sukces i nie zapisywał niczego. Przy przepisaniu na `insurance_policies` dołożone dwie
rzeczy, których brak zamieniłby jedną awarię na drugą:
- `policy_number` i `end_date` są `NOT NULL` — ich brak kończy się teraz czytelnym
  błędem 400 zamiast cichego niepowodzenia;
- stary `INSERT OR IGNORE` opierał się na ograniczeniu UNIQUE tabeli `polisy`;
  `insurance_policies` go nie ma, więc powtórzony import tworzyłby duplikaty — dodana
  jawna kontrola po `(company_id, policy_number)`.

## C. Pojęcia, których w schemacie nie ma wcale — wymagają decyzji

| linia | zapytanie | problem |
|---|---|---|
| 8330 | `vu.vehicle_id FROM tachograph_vehicles_used` | tabela wiąże pojazd przez `vehicle_reg`, nie identyfikator |
| 10062, 10201 | `u.telefon FROM users` | `users` nie ma kolumny telefonu — **powiadomienia SMS nie mogą działać** |

Każda z tych pozycji to wybór między migracją a zmianą semantyki zapytania. `driver_name`
w `faults` nie jest literówką — to pytanie, czy „kierowca" ma w ogóle sens dla usterki,
czy raczej chodziło o zgłaszającego.

## D. Tabele, których nie tworzy żaden plik schematu

| tabela | linie | status |
|---|---|---|
| `alert_events` | 8972 | świadome — jedyny zapis, zero odczytów (CLAUDE.md) |
| ~~`fuel`~~ | 11424, 11445 | **naprawione** — przepięte na `fuel_fills` |
| ~~`polisy`~~ | 12844 | **naprawione** — przepięte na `insurance_policies` |

`fuel` i `polisy` były tą samą klasą co naprawione wcześniej `fuel_entries` i `damages` —
teraz też naprawione. Zostaje wyłącznie `alert_events`, świadomie.

## E. Konflikt udokumentowany osobno

`company_packages.active` (14018) — kolumna istnieje wyłącznie w `schema_v48`, a zapis
`PUT /api/access-control/config` wstawia `updated_by`, które istnieje wyłącznie w `v33`.
Nie do naprawy „przy okazji": to decyzja o włączeniu licencjonowania modułów. Pełny
opis i kolejność kroków — CLAUDE.md, sekcja „Otwarte / znane długi".

## F. Dlaczego nie ruszamy 27 niemych `.catch()` przy zapisach

Po naprawie `handleBulkSavePolicy` naturalnym odruchem było przeszukać worker za
zapisami, których niepowodzenie jest połykane. Jest ich **27** — `INSERT`/`UPDATE`/
`DELETE` z `.catch(() => {})`, m.in. kolejka KSeF, log windykacji, log importu paliwa,
`notification_log`, `last_used_at` kluczy API.

**Nie zmieniamy ich i to jest wniosek, nie zaniechanie.** Niemy `catch` przy zapisie
jest groźny tylko wtedy, gdy zapytanie może paść — a od tej zmiany **każde zapytanie
`INSERT`/`UPDATE` do nieistniejącej kolumny lub tabeli wywala bramkę**, niezależnie od
tego, czy ma `.catch()`. Dokładnie tak wykryliśmy `polisy` i skany QR: nie po objawie,
tylko przy budowie schematu.

Innymi słowy: ryzyko z niemego `catch` przesunęło się z „ukrywa błąd w zapytaniu" na
„ukrywa awarię bazy w czasie wykonania" — a to drugie jest przy D1 rzadkie i zwykle
świadomie tolerowane (telemetria, liczniki użycia). Masowa zamiana 27 miejsc byłaby
zmianą zachowania bez znalezionego defektu, czyli dokładnie tym, przed czym ostrzega
sekcja WERYFIKACJA w CLAUDE.md.
