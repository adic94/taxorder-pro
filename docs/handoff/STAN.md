# HANDOFF — STAN BIEŻĄCY (przeniesione z CLAUDE.md bez zmian treści)
> Czytaj, gdy pracujesz nad tematem z poniższych sekcji. Historia: `ARCHIWUM.md`, Aztec: `AZTEC.md`.

## HANDOFF — STAN PROJEKTU

> Sekcja aktualizowana ręcznie po zamknięciu tematu lub otwarciu nowego.
> Generuj zwięzłe podsumowanie do wklejenia w claude.ai: `/status`
> Ostatnia aktualizacja: 2026-08-24 (popołudnie) — **Worker wdrożony, GitHub Actions
> odblokowane, CEPiK open-data potwierdzony jako zepsuty (nie tylko podejrzany)**
>
> ### Zamknięte dziś: obie pozycje z poprzedniej wersji tej sekcji
>
> **1. Deploy Workera — ZROBIONE.** Przyczyna `Authentication error [code: 10000]` okazała
> się INNA, niż zakładał poprzedni wpis: to nie zmienna systemowa `CLOUDFLARE_API_TOKEN`
> (sprawdzone `Remove-Item Env:\...` → „does not exist"), tylko **plik `.env` w katalogu
> projektu** — `wrangler@4.120.1` sam go wczytuje i traktuje `CLOUDFLARE_API_TOKEN` stamtąd
> jako nadpisanie logowania OAuth, bez żadnej zmiennej w tle. Naprawa i pełny opis pułapki:
> patrz sekcja „PUŁAPKI" niżej, wpis przy istniejącym `CLOUDFLARE_API_TOKEN`. Wdrożone:
> Version ID `519dd2ea-98c3-4a22-ae30-a97d8d946800`, potwierdzone żywą odpowiedzią Workera
> (`/` → `{"error":"Endpoint nie istnieje"}`, nie błąd sieci). Produkcja miała 12 dni
> zaległości (ostatni udany auto-deploy: 12.08) — teraz wyrównana z `main`.
>
> **2. `aztec-diagnoza.js` — URUCHOMIONE, 8314 dokumentów.** Wynik: **MATERIAŁ
> WYSTARCZAJĄCY** — 65% skanów ≥150 DPI, żaden koszyk rozdzielczości nie spada do „za
> mało". To zawęża pytanie z „czy skany są za słabe" do „czy detekcja/dekodowanie sobie
> radzi" — i tu jest gorsza wiadomość, patrz niżej.
>
> **GitHub Actions — odblokowane.** Blokada „recent account payments have failed" (nie
> zwykłe wyczerpanie 2000 min — patrz sekcja CI/CD) zniknęła między 08:47 a 12:49 dziś.
> Potwierdzone realnym przebiegiem: `JS syntax check` i `E2E & API tests` (28 min, pełny
> suite) — oba **sukces** na pchniętym commicie. Nie ustalono, czy to efekt zmiany limitu
> wydatków po stronie właściciela, czy GitHub sam wyczyścił coś po swojej stronie.
>
> ### Aztec: dekodowanie działa na SELFTEŚCIE, ale jest NIESTABILNE na prawdziwym dokumencie
>
> Głębszy dive niż punkt 2 wyżej. Na realnym dowodzie (WA0638H) — kod fizycznie obecny,
> czysty dla oka, potwierdzone wizualnie. Ale:
>
> - **Detekcja na pełnej stronie zawodzi STRUKTURALNIE** — algorytm Azteca w ZXing szuka
>   wzorca od ŚRODKA obrazu na zewnątrz (inaczej niż QR), a kod leży w konkretnym polu
>   dokumentu, nie w centrum strony. To samo w sobie tłumaczy „0/1318" niezależnie od
>   jakości skanu — potwierdzone niezależnie od binaryzera (Hybrid i GlobalHistogram).
> - **Po ręcznym wycentrowaniu bywa niestabilne między sesjami renderowania TEGO SAMEGO
>   pliku PDF.** Raz detekcja przechodzi i dochodzi do błędu Reed-Solomon
>   (`Error locator degree does not match number of roots` — za dużo błędów bitowych na
>   pojemność korekcji), raz zawodzi już na etapie detekcji. Ten sam plik uruchomiony
>   trzykrotnie z rzędu daje identyczny wynik (deterministyczne w ramach jednej sesji),
>   ale RÓŻNY między osobnymi renderami tej samej strony — subpikselowa różnica w
>   antyaliasingu Chromium wystarcza, żeby przełączyć wynik.
> - **Wniosek: to nie jest już zadanie programistyczne.** Detekcja na pełnej stronie da
>   się naprawić (tiling/wycinanie), ale samo dekodowanie jest na granicy nawet w
>   warunkach idealnych (czysty render PDF, bez aparatu). Dalsza praca ma malejący zwrot
>   bez **prawdziwego zdjęcia** — pytanie zawęziło się z „czy materiał wystarcza" do
>   „czy fizyczny druk kodu ma zapas jakości", a na to odpowiada tylko realna fotografia.
>
> ### ⛔ CEPiK open-data: `numer-rejestracyjny` POTWIERDZONY jako zepsuty, nie tylko podejrzany
>
> **Nie buduj na tym niczego, dopóki to nie zostanie rozstrzygnięte.** Dwa pomiary na
> prawdziwych numerach floty:
>
> | zapytanie | zwrócony pojazd | data pierwszej rejestracji |
> |---|---|---|
> | okno 2025–2026, `WGM5973R` | CAN-AM OUTLANDER (quad) | **2025-01-01** |
> | okno 2026–2026, `WZ003EY` | TOYOTA COROLLA | **2026-01-02** |
>
> Za każdym razem rekord z **pierwszych dni okna**. A `WZ003EY` to w naszej flocie
> **mercedes sprinter z przebiegiem 230 998 km**, nie corolla. To wygląda na zwracanie
> pierwszego rekordu z województwa i zakresu dat. Przebieg na całej flocie przypisałby
> cudze dane do 876 pojazdów: 68 pól, poprawne typy, sensowne wartości — bez szansy na
> wykrycie po fakcie. `cepik-batch` robi teraz samokontrolę przed startem (dwa różne
> numery, to samo okno) i **odmawia pracy** przy identycznym rekordzie.
>
> **DOPISANE 24.08 popołudnie: potwierdzone niezależnie, na INNYM oknie dat.** Preflight
> (`--sprawdz`) na liście 134 pojazdów z brakami DT-1 zatrzymał się sam — słusznie —
> na dokładnie tym samym objawie. Ręczny test na `WA142AL`/`WA143AL` (dwie różne, dobrze
> sformatowane tablice) w oknie **2025–2026** dał ten sam rekord (CAN-AM OUTLANDER — ta
> sama „widmo"-tablica co w tabeli wyżej, inny dzień pomiaru, ten sam wynik: nie przypadek,
> tylko powtarzalny fallback). Powtórzone w oknie **2017–2018** — znowu identyczny rekord
> (CHEVROLET CAMARO tym razem). **To nie jest kwestia złego okna czasowego — filtr nie
> działa w żadnym z przetestowanych okien.** Partia 134 pojazdów NIE URUCHOMIONA — słusznie.
>
> Co jeszcze ustalone o tym API, żeby nie odtwarzać śledztwa:
> - **okno dat ma limit DWÓCH LAT KALENDARZOWYCH** — serwer mówi to wprost („Maksymalny
>   zakres lat to: 2"). Wcześniejsza wersja pytała o 30 lat w jednym zapytaniu, więc
>   KAŻDE jej zapytanie leciało 400; „bez wyniku" nie oznaczało braku pojazdów w rejestrze;
> - tablica województw miała **15 kodów zamiast 16** (`C` wskazywało łódzkie zamiast
>   kujawsko-pomorskiego), więc kod `04` nie występował nigdzie — także w fallbacku;
> - endpoint jest publiczny, bez `Authorization`; 429 przychodzi szybko, domyślny odstęp
>   to teraz 900 ms i obowiązuje po KAŻDYM żądaniu, także nieudanym.
>
> **VIN — SPRAWDZONE i ZAMKNIĘTE, ślepy zaułek.** Pole VIN **nie istnieje w ogóle** w tym
> API — wylistowane wszystkie ~70 pól zwracanych przy `pokaz-wszystkie-pola=true` na
> prawdziwym rekordzie, zero trafień na „vin"/„nadwozie"/„podwozie"/„rama". Parametr
> `vin=` bez wymaganych `wojewodztwo`+`data-od`+`data-do` daje 404 („nie podano wymaganych
> parametrów"); z nimi — zwraca coś, ale nie da się zweryfikować, bo API nigdy nie zwraca
> VIN-u w odpowiedzi. Nie próbuj tego ponownie bez nowej przesłanki. Efekt uboczny, który
> to jednak potwierdziło: pełna lista pól MA `liczba-osi` i `rodzaj-zawieszenia` — CEPiK
> dalej jest właściwym źródłem tych dwóch pól DT-1, TYLKO filtr po numerze trzeba naprawić
> albo obejść — patrz `docs/cepik/` (szkic pisma o teletransmisję CEP, czyli oficjalny
> dostęp z `CEPIK_KEY`/`CEPIK_SECRET` zamiast zepsutego endpointu open-data).
>
> **AKTUALIZACJA 27.08: obie techniczne blokady, które ten szkic wymieniał jako warunek
> przed wysyłką, są zamknięte.** `handleCepikPojazdy` ogranicza zapytania do własnej floty
> i woła `logAudit()` przy każdym dostępie (commit `e87de14`) — zweryfikowane odczytem
> z produkcyjnego `audit_logs`, nie brakiem błędu. Zostają wyłącznie pola do ręcznego
> uzupełnienia w samym piśmie (REGON, adres e-Doręczeń, osoba reprezentująca, data) —
> dane rejestrowe spółki, nie coś do wyprodukowania kodem.
>
> ### Arkusz DR: jest, ale najpierw przeczytaj trzy zakładki
>
> `tools/dr-excel.js` buduje arkusz z 30 polami katalogu i kodami urzędowymi w nagłówkach.
> **Przebieg 24.08 popołudnie (po trzech nowych filtrach — patrz commit `6890c66`):
> 907 pojazdów** (zestawienie 816 + checkpoint OCR 1290 rekordów, 10 mniej niż poprzedni
> przebieg — usunięte pojazdy-widma z fragmentów VIN/ścieżki jako „numer rejestracyjny").
>
> - **„Spoza zestawienia"** — 91 pojazdów zna wyłącznie OCR albo nazwa pliku, 52 z numerem
>   czytanym z nazwy. Przekłamanie o jedną cyfrę tworzy pojazd, który nie istnieje.
> - **„Odrzucone"** — 623 wartości niepasujących do typu pola (było 308 — nowe filtry
>   łapią więcej, nie mniej), 205 w polach DT-1.
> - **„Konflikty"** — 1914 rozbieżności, 193 w polach DT-1.
>
> **Nie używaj tego arkusza do deklaracji bez przejrzenia tych trzech.** Deklaracja z błędną
> DMC albo liczbą osi wygląda wiarygodnie i nikt jej nie zakwestionuje poza urzędem.
>
> **NOWE 24.08: `tools/dr-braki-checklist.js`** — osobny, gotowy do wydruku plik dla
> **134 pojazdów, których żadne źródło nie wypełniło na tyle, żeby policzyć DT-1** (117
> bez DMC — kategorii nie da się ustalić wcale; 17 ≥12t z brakiem osi/zawieszenia).
> Posortowany po ścieżce pliku źródłowego, kolorowany wg typu braku, z pustymi kolumnami
> na wpisanie z ręki. Sprawdzone przy budowie: 14 z tych wierszy to **przyczepy**
> (`typ='Przyczepa'`), którym pole marka/przeznaczenie w źródle podaje opis sprzętu
> zamontowanego na przyczepie (np. „Myjka Ciśnieniowa KRANZLE"), nie markę przyczepy —
> checklist pokazuje `Typ` i `Przeznaczenie` jako OSOBNE kolumny właśnie dlatego, żeby
> ta rozbieżność była widoczna, a nie cicho wybrana.
>
> ### Ustalenie, które zmienia priorytety: „68/916" to odpowiedź na złe pytanie
>
> `TaxEngine.getCat()` czyta liczbę osi i zawieszenie **wyłącznie dla pojazdów od 12 t**.
> Poniżej progu kategorię wyznacza sama DMC i rodzaj; pojazdy specjalne są zwolnione
> niezależnie od wszystkiego. „Ile pól jest pustych" i „ile brakuje do policzenia podatku"
> to dwie różne liczby. Arkusz **DT-1** podaje tę drugą per pojazd — kategorię, status
> i kolumnę „Czego brakuje" wymieniającą tylko pola, które silnik przy TYM tonażu
> faktycznie przeczyta. Kategorie liczy produkcyjny `modules/tax-engine.js` przez
> `window`-shim, nie kopia progów.
>
> ### Dlaczego OCR nie dawał zawieszenia: prompt o nie nie pytał
>
> Zmierzone pokrycie: `zawieszenie` **0/916** z żadnego źródła, `normaEuro` 55/916 wyłącznie
> z zestawienia. Przyczyna nie leżała w modelu ani w jakości skanów. Przy okazji: prompt DR
> istniał w **dwóch rozjechanych kopiach** — `handleAIOCR` (20 pól) i `handleDrOcr` (16 pól,
> bez przeznaczenia, bez F.2, bez O.1/O.2). Który handler obsłużył dokument, taki zestaw pól
> wracał, bez śladu w odpowiedzi. Teraz jedna stała `DR_POLA_OCR` — 23 pola, komplet DT-1,
> pilnowana bramką. **Na produkcji od 24.08** (deploy zrobiony, patrz wyżej), a przy
> pierwszym przebiegu mierz na kilkunastu dowodach, nie na 1290: darmowy próg CF to
> 10 000 neuronów na dobę.
>
> ### Rzeczy techniczne, które zostają
>
> 1. ~~**Pakiet minut Actions wyczerpany**~~ — **ODBLOKOWANE 24.08 popołudnie**, patrz
>    wyżej. Do 24.08 rano przebiegi padały po 3–5 s komunikatem o nieudanych płatnościach
>    (INNY objaw niż `runner_id: 0` opisany w sekcji CI/CD — tam chodzi o wyczerpanie
>    2000 min, tu o próbę obciążenia karty), teraz `JS syntax check`/`E2E`/`Health Check`
>    przechodzą normalnie. **Lokalne bramki nadal warte używania jako pierwsza linia**
>    (szybsze niż czekanie na CI): `npm run test:gates` (18 plików, 141 asercji, ~20 s,
>    bez sieci i bez zależności poza `node`). Do 18.08 `npm run audit:all` uruchamiał
>    tylko 3 z nich — patrz sekcja o narzędziach.
> 2. **`aztec-decoded-bytes.bin` w `%TEMP%`** (729 B, 30.07) — plik jest BASE64, nie
>    surowymi bajtami; po zdekodowaniu nagłówek wychodzi 1257, czyli w zakresie.
>    `node tools/aztec-compare.js --bytes <plik>` rozpoznaje base64 sam. Odpowiada na
>    pytanie, czy NRV2E radzi sobie z PRAWDZIWYM strumieniem — selftest tego nie mówi,
>    bo koduje „samymi literałami", a rzeczywisty NRV2E ma odwołania wstecz.
> 3. **Detekcja Aztec na materiale CC nie działa w ŻADNEJ implementacji.** `zxingcpp`
>    (Python, u CC), nasza ścieżka produkcyjna i kaskada `aztec-detector.js` — wszystkie
>    trzy na zero, na obu cropach (`aztec-tight.png`, `aztec-crop.png`). Nieprzetestowana
>    została jedna kombinacja: **oryginalny PDF przez nasz render** (narzędzie przyjmuje
>    teraz PDF i renderuje go ustawieniami czytanymi z `PDF_AZTEC`).
>
> ### Otwarte pytania do właściciela — dwa z trzech zamknięte 19.08
>
> - ~~**Klucze legacy Supabase — czy unieważnione?**~~ — **ZAMKNIĘTE odczytem, nie domysłem.**
>   Konektor Supabase (MCP) na koncie właściciela: `list_organizations` zwraca jedną
>   organizację („Wolund Synergy"), a `list_projects` zwraca **zero projektów**. Projekt
>   `opeqckxxdqicszfycolb` z historii repo **nie istnieje** — został skasowany, więc klucze
>   w historii wskazują na nieistniejący zasób i są martwe. Uwaga na zakres dowodu: to
>   stwierdzenie opiera się na tym, że token MCP widzi całe konto; projekt w organizacji
>   poza zasięgiem tokenu nie zostałby wykazany.
> - ~~**Wskaźnik CO2 dla diesla: 2,65 czy 2,68?**~~ — **ROZSTRZYGNIĘTE na 2,65**, rachunkiem,
>   nie wyborem. Stechiometria ON bez domieszki: `0,835 kg/l × 0,862 C × 44/12 = 2,639`,
>   czyli 2,65 mieści się w wyniku. **2,68 to inna wielkość, nie inna wartość tej samej** —
>   pochodzi ze współczynników typu DEFRA, które są CO2**e** (z CH4 i N2O) i zwykle zakładają
>   domieszkę B7. Za 2,65 przemawia też odtwarzalność: tą wartością policzone są wszystkie
>   złożone dotąd raporty ESG i JPK. **Co zostaje:** rachunek potwierdza rząd wielkości
>   i odrzuca 2,68, ale nie zastępuje odczytu z aktualnej tabeli KOBiZE — dlatego `zrodlo`
>   nadal mówi „niezweryfikowane". Sprawozdanie w CO2e wymaga OSOBNEGO zestawu z własnym
>   `od`, nie podmiany tych liczb.
> - **Stawki opłat środowiskowych** — **TRZY Z CZTERECH KROKÓW ZROBIONE (27.08).
  Zostaje wyłącznie GĘSTOŚĆ.** Poprzednia wersja tego wpisu opisywała temat jako
  nietknięty i była nieaktualna — kod ma dziś 83 stawki z Tabeli D, klucz
  trójwymiarowy `paliwo|norma|klasa_pojazdu` i CNG rozdzielony na fabryczny
  i przebudowany.

  Źródło: `monitorpolski.gov.pl/M2025000076901.pdf` (M.P. 2025 poz. 769, stawki
  na 2026), Tabela D. Klasy: `osobowy`, `do_3_5t_inny_niz_osobowy`, `powyzej_3_5t`,
  `autobus_powyzej_3_5t`. Paliwa: `bs`, `lpg`, `cng_fabryczny`, `cng_przebudowany`,
  `on`, `bd`. Normy: PRZED_EURO oraz EURO 1–5.

  **`computeEnvironmentalFee` nadal nie podaje kwot — i to jest poprawne.**
  Powód jest już tylko jeden: `gestosc_kg_na_litr` jest puste, więc każdy pojazd
  trafia na listę `nieustalone` z powodem „gęstość paliwa". Obwieszczenie gęstości
  NIE PODAJE (sprawdzone pełnotekstowo w obu rocznikach), więc pochodzi z innego
  źródła i wymaga osobnej decyzji z podaniem pochodzenia.

  > ⚠️ **Dostęp do źródeł rządowych bywa zablokowany polityką sieci.** Zmierzone
  > 27.08 z sesji w chmurze: `api.sejm.gov.pl`, `dziennikustaw.gov.pl`,
  > `monitorpolski.gov.pl` i `eli.gov.pl` odpowiadają **403 na CONNECT**. 25.08 te
  > same adresy działały. Nie zakładaj więc, że „skoro raz się udało, uda się znowu"
  > — i nie wpisuj liczb z pamięci, gdy nie ma dostępu.

  **Dwie rzeczy do rozstrzygnięcia przy okazji gęstości:**
  - **CNG sprzedaje się na KILOGRAMY, nie na litry**, więc `litry × gęstość` jest
    dla niego bez sensu — wejściem powinna być masa. Wpisanie mu „gęstości" da
    liczbę wyglądającą poprawnie i błędną.
  - **Autobusy powyżej 3,5 t mają w kodzie wyłącznie wiersz PRZED_EURO** (on 88,25;
    bd 79,87). Autobus EURO 1–5 nie dostanie stawki. Nie wiadomo, czy to wierne
    odwzorowanie Tabeli D, czy luka ekstrakcji — do sprawdzenia przy następnym
    dostępie do PDF-a.

  ### ⛔ EURO 6 to nie przypadek brzegowy — to 80% floty (zmierzone 27.08 na D1)

  Zapytanie do produkcyjnego D1 (`vehicles`, 217 pojazdów):

  | norma | do 3,5 t | powyżej 3,5 t | brak DMC | razem |
  |---|---|---|---|---|
  | **EURO 6** | 10 | **163** | — | **173** |
  | brak normy | 22 | 11 | 3 | 36 |
  | EURO 5 | — | 5 | — | 5 |
  | EURO 3 | — | 2 | — | 2 |
  | EURO 1 | — | 1 | — | 1 |

  **Stawkę w Tabeli D ma OSIEM pojazdów z 217 — 3,7% floty.** Uzupełnienie gęstości
  (jedyny formalnie brakujący krok) odblokowałoby wyliczenie dla ośmiu aut. Wąskim
  gardłem jest EURO 6, nie gęstość — i to trzeba rozstrzygnąć jako pierwsze.

  **Od czego zależy rozstrzygnięcie:** od DOSŁOWNEGO brzmienia opisów wierszy
  Tabeli D. Jeśli wiersz mówi „spełniające wymagania EURO 5" — pojazd EURO 6 nie ma
  stawki. Jeśli „EURO 5 i nowsze" albo „co najmniej EURO 5" — ma. Tej różnicy NIE DA
  SIĘ zgadnąć, a kod celowo odmawia zamiast podstawić stawkę EURO 5, bo podstawienie
  byłoby interpretacją przepisu.

  **Do sprawdzenia z księgowością, zanim ktokolwiek wyliczy kwotę** (pytania, nie
  ustalenia — nie weryfikowane w tej sesji): czy opłata za wprowadzanie gazów
  z eksploatacji pojazdów w ogóle nadal obciąża spółkę, oraz czy nie znosi jej próg
  kwotowy poniżej którego opłaty się nie wnosi. Odpowiedź „nie dotyczy" czyni cały
  ten temat bezprzedmiotowym — taniej to sprawdzić niż dokończyć implementację.

  **Wiarygodność stawek potwierdzona dwiema kontrolami niewymagającymi PDF-a**
  (utrwalone w `tests/unit/env-fee-test.js`, każda zweryfikowana negatywnie):
  monotoniczność (w 16 seriach paliwo×klasa stawka ani razu nie rośnie wraz z normą
  EURO — a udokumentowany tryb awarii ekstrakcji, przesunięcie wiersza o jeden, tę
  własność by złamał) oraz trzy kotwice ON EURO 5 (5,76 / 6,82 / 9,19 zł/Mg) zgodne
  co do grosza z odczytem zapisanym niezależnie w tym pliku.


### W toku

**Rozjazd schematu D1 — ZWERYFIKOWANY NA PRODUKCJI 11.08.** Odczyt z `wrangler d1 execute
--remote` obalił diagnozę obu przebiegów audytu w najważniejszym punkcie. Nie zgadywać
ponownie — to są fakty z bazy.

| Tabela | Faktyczny stan w D1 | Wniosek |
|--------|---------------------|---------|
| `company_packages` | **ISTNIEJE od 13.08 wieczorem** — utworzona ręcznie przez `wrangler d1 execute --file=worker/schema_v48.sql` (nocny automat nie ma runnerów do 1.09). Struktura z **v48**, czyli z kolumną `active`, bez `updated_by`. **Utworzenie jest behawioralnie obojętne — sprawdzone w kodzie, nie założone:** `resolveModuleAccess` (index.js:13548) ma `if (!row) allowed = ['*']`, więc pusta tabela daje pełny dostęp dokładnie tak samo, jak wcześniej dawał `catch` przy braku tabeli. `GET /api/access-control/config` też zwraca domyślne `enterprise` przy braku wiersza. **ZAPIS nadal pada 500**, bo `PUT /api/access-control/config` (index.js:11066) wstawia `updated_by`, którego v48 nie ma — ale padał też wcześniej, na `no such table`. Ten zepsuty zapis działa dziś jako blokada: nie da się przypadkiem zapisać pakietu. Naprawa (`ALTER TABLE company_packages ADD COLUMN updated_by TEXT`) to **włączenie licencjonowania modułów**, czyli decyzja produktowa — patrz ostrzeżenie niżej. |
| `esg_targets` | **v35** (`co2_target_kg`, `fuel_target_l`, `ev_percentage_target`, `electric_km_target`) | v41 był cichym no-opem. `POST /api/esg/targets` (index.js:11734) pisze kolumny v41 (`metric_key`, `target_value`…) **bez `.catch()`** → 500. **Aktywny błąd produkcyjny**, dodawanie celów ESG martwe |
| `reservations` | **v13 z `CHECK(status IN ('pending','accepted','rejected'))`** | Potwierdzone dosłownie przez `SELECT sql FROM sqlite_master`. **Naprawione** — `fleet-reservations.js` używał `confirmed` (naruszenie CHECK). Odtworzone lokalnie na SQLite: `accepted` przechodzi, `confirmed` → `CHECK constraint failed` |

**Właściwy problem jest szerszy niż pojedyncze tabele: dryf migracji.** Co najmniej cały
`schema_v48.sql` (`company_packages` + `usage_snapshots`) nigdy nie trafił na produkcję,
a `schema_v41.sql` częściowo. `CREATE TABLE IF NOT EXISTS` sprawia, że ponowne uruchomienie
starszego pliku **nie naprawi** tabeli o innej strukturze — i nic o tym nie zgłosi.

**ZAMKNIĘTE 13.08 wieczorem — wszystkie trzy kroki wykonane, potwierdzone u źródła.**

Ręcznie, bo nocny automat nie ma runnerów do 1 września:

```powershell
wrangler d1 execute taxorder-pro --remote --file=worker/schema_v45.sql   # ksef_config, ksef_offline_queue
wrangler d1 execute taxorder-pro --remote --file=worker/schema_v48.sql   # usage_snapshots, company_packages
wrangler d1 execute taxorder-pro --remote --file=worker/migration_v50_esg_targets.sql
```

Potwierdzenie zapytaniem do `sqlite_master`, nie wnioskowaniem z „brak błędu":

    company_packages | ksef_config | ksef_offline_queue | usage_snapshots   — cztery z czterech

Oba pliki przeszły po 4 zapytania **bez błędu** — wcześniej `v45` padał na
`duplicate column name: upo_r2_key`, a `v48` na `no such column: active`. Naprawy
z PR #8 i przeniesienie kolumn KSeF do `schema_v34` faktycznie zadziałały na produkcji,
nie tylko na czystej bazie w teście.

`esg_targets`: `COUNT(*)` był **0**, więc migracja bezstratna z definicji. Struktura
potwierdzona po fakcie — `idx_esg_co_metric` odwołuje się do `metric_key` (czyli kolumna
istnieje), a `idx_esg_co_year` **nie jest już UNIQUE** (czyli pułapka blokująca drugą
metrykę w tym samym roku jest rozbrojona).

**Co z tego wynika na przyszłość:** nocny automat nie jest jedyną drogą. Gdy runnery są
niedostępne, pliki schematu uruchamia się ręcznie tym samym poleceniem — a stan
sprawdza zapytaniem do `sqlite_master`, nie po tym, czy polecenie nie krzyknęło.

2b. ~~decyzja o kierunku~~ — rozstrzygnięta: kod backendu i `esg-report.js` Kod backendu i `esg-report.js` są napisane pod model
   v41 (`metric_key`/`target_value`/`lower_is_better` — dowolna metryka), tabela stoi na v35
   (sztywne kolumny). Migracja tabeli do v41 jest właściwym kierunkiem, ale wymaga
   `CREATE TABLE ... AS SELECT` + `DROP` + `RENAME` (SQLite nie zmieni struktury w miejscu).
   Najpierw: `SELECT COUNT(*) FROM esg_targets` — przy zerze migracja jest trywialna.
3. ~~`webhook_logs`, `fuel_entries`, `alert_events`~~ — **zrobione**, patrz Zamknięte.
   Zostało jedno świadome pominięcie: `alert_events` (jedyny zapis, zero odczytów, kod ma
   już komentarz „jeśli istnieje") — utworzenie tabeli zaczęłoby gromadzić dane, których
   nic nie czyta. Tak samo `webhook_logs`: naprawiony 500, ale tabeli celowo NIE tworzę,
   bo nic do niej nie pisze — trigger Zapier wymaga implementacji zapisu, to funkcja,
   nie łatka.

> ⚠️ **Gdyby kiedyś włączać licencjonowanie modułów:** to nie jest bug fix, tylko wdrożenie
> funkcji. `_packageModules()` mapuje `basic → []` (pusta lista). Firma **bez wiersza** jest
> bezpieczna (`if (!row) allowed=['*']`), więc samo utworzenie tabeli z `schema_v48.sql` jest
> behawioralnie obojętne. Ryzyko pojawia się dopiero przy pierwszym `INSERT` — wiersz z
> pakietem `basic` odcina wszystkie moduły spoza `MODULE_EXEMPT`. Kolejność: utwórz tabelę →
> `wrangler secret put MODULE_ENFORCEMENT` → `off` → dopiero wiersze → włącz świadomie.

---


### Otwarte / znane długi

**Dług techniczny**
- ~~Konto CI głównego suite loguje się WYŁĄCZNIE jako admin — regresja w gatingu uprawnień UI
  nie zostałaby wykryta~~ — **zrobione, PR #72 (`6337acf`, 2026-09-01), ten wpis był nieaktualny.**
  `tests/e2e/nonadmin-permissions.spec.js` + projekt `nonadmin` w `playwright.config.js` +
  drugie logowanie w `global-setup.js` (konto `acichocki@mtoilet.pl`, `kierownik`/`gcon`) już
  działają w `ci-e2e.yml` obok głównego suite admina — nie zamiast niego. Zweryfikowane 03.09
  na najnowszym przebiegu na `main` (run `33701933254`): wszystkie 3 testy realnie zalogowane
  i przechodzące (`✓ 298/300/302 [nonadmin] › nonadmin-permissions.spec.js`), 288/288 total
  passed. Test izolacji tenantów (`npm run test:isolation`, backend) i ten plik (frontend/UI)
  to dwie różne warstwy tego samego konta — obie pokryte.
- `ocr-service/` — **JEST podłączony, wbrew temu, co ten dług twierdził do 19.08.**
  `worker/index.js:3029` wywołuje go jako „Próbę 0" pod adresem z `OCR_PYTHON_URL`
  (`wrangler.toml` → Railway). Otwarte zostaje co innego: **nie wiadomo, czy ta instancja
  żyje** — do 19.08 jej porażka ginęła w pustym `catch`. Po naprawie powód trafia do
  `console.log` i do odpowiedzi 502, więc `wrangler tail` odpowie na to jednym dokumentem.
- `tools/README.md` i `tools/_archive/` — zinwentaryzowane. 11 plików w `_archive/` (gitignore). Jeśli dodasz nowe narzędzie diagnostyczne — dopisz je do `tools/README.md`.
- **Tryb widoku przypięty w `global-setup.js`.** Jawnie pinowane (oba tryby TOKEN i EMAIL):
  `slim_table='false'`, `fleetViewMode='fleet'`, `onboarding_done='1'`, `ks-hint-shown='1'`.
  Jeśli ktoś doda nową preferencję UI wpływającą na renderowanie tabeli floty lub powodującą
  modal/overlay przy pierwszym uruchomieniu — musi ją dopisać do global-setup. Inaczej CI
  staje się zależne od stanu przeglądarki i testy padają niedeterministycznie.
- **Niestabilne testy przy długim suite (do obserwacji).** Lokalny suite trwa ~13 min; przy
  kumulacji czasu `fleet-columns.spec.js:75` („Resetuj domyślne") i `import-export.spec.js:39`
  (beforeEach timeout) bywają niestabilne — timeout 30 s przekroczony sporadycznie. Oba przechodzą
  po izolowanym rerun. Jeśli powtórzą się w CI — wymagają osobnej diagnozy, nie są flakie lokalne.
- **Flagi `onboarding_done` i `ks-hint-shown` nie wpływają na bieżący suite.** Zweryfikowane
  na czystym storage (bez tych kluczy): 286/11/0, identycznie jak z pinami. Pinowanie w
  `global-setup.js` jest zabezpieczeniem na przyszłość (event `taxorder-login` niezaimplementowany,
  toast 3s nie zakłóca timingu testów przy obecnym suite).
- 6 z 8 pierwotnych podatności npm (wszystkie high) naprawione bezpiecznie — patrz
  Zamknięte. Pozostałe 2 (moderate, `uuid`/`exceljs`) — **świadomie zaakceptowane,
  nie do naprawy `--force`** — patrz Zamknięte, uzasadnienie niżej.
- ~~`SUPABASE_URL` w `wrangler.toml`~~ — **nieaktualne, zrobione w `45267f8`.** Zweryfikowane
  `cat wrangler.toml` 11.08: wpisu nie ma. Ten dług wisiał tu po naprawie.
- ~~`ROLLBACK` v48/v49 brak~~ — **nieaktualne, pliki istnieją**: `worker/schema_v48_ROLLBACK.sql`
  (DROP `usage_snapshots`, `company_packages`) i `worker/schema_v49_ROLLBACK.sql`
  (DROP `idx_upkv_user_co`, `user_prefs_kv`). Komplet v45–v49.
- **Szum ostrzeżeń eslint: ~2092 (było 2168).** Błędów w kodzie produkcyjnym jest 0, więc
  `npm run lint` kończy się kodem 0. Rozkład: `prefer-template` ~1203, `no-unused-vars` ~250,
  `prefer-const` 47, `no-console` 46 — to już wyłącznie styl. **Nie dodawaj `--max-warnings 0`**
  bez wcześniejszego posprzątania, bo CI stanie się czerwony natychmiast.
  - ~~`no-undef` 621 — do przeglądu, może maskować literówki~~ — **zrobione 12.08**, patrz
    Zamknięte. Reguła jest teraz **`error`**, a lista globali w `.eslintrc.json` kompletna.
  - **Dodając nowy global na `window.*` — dopisz go do `globals` w `.eslintrc.json`.**
    Jeśli eslint zgłasza `no-undef` dla nazwy, której tam nie ma, **najpierw sprawdź, czy ta
    nazwa w ogóle gdziekolwiek istnieje** (`rg -n "nazwa" --glob '*.js'`). Precedens: `_csvEsc`
    i `decReason` nie istniały nigdzie w repo i psuły dwa przyciski eksportu. Dopisanie
    nieistniejącej nazwy do `globals` uciszyłoby detektor dokładnie tam, gdzie miał zadziałać.
  - Bramka `npm run lint` obejmuje `worker/index.js modules/*.js app.js` — **nie** `tests/`
    ani `tools/`. Tam zostaje 8 błędów `no-eval`/`no-script-url`/`no-new-func`, wszystkie
    celowe (test bookmarkletu MUSI parsować `javascript:`, `unit-tests.js` używa `eval`
    do uruchamiania asercji). Nie rozszerzaj zakresu bramki bez wyciszenia tych miejsc.

- ~~Dwie rozbieżne tablice wskaźników CO2~~ — **zrobione 12.08**, patrz Zamknięte. Problem
  był szerszy: obie tablice były rozjechane nie tylko ze sobą, ale i z danymi. Front nie ma
  już własnej tablicy — backend zwraca użyty wskaźnik w polu `ef`.
  **Do rozstrzygnięcia został jeden parametr domenowy: wartość dla diesla.** Zostawiłem
  **2.65** (backend), bo to ona produkowała dotychczasowe liczby w ESG i JPK; front miał 2.68.
  Zmiana = jedna liczba w `CO2_EMISSION_FACTORS`. CNG 2.04 przejęte z tablicy frontu.
- ~~**Zapisane `report_configs` ze źródłem `fuel_entries`**~~ — **bezprzedmiotowe,
  sprawdzone 19.08 zapytaniem do produkcyjnego D1:**
  `SELECT id,name,source_table FROM report_configs WHERE source_table IN ('fuel_entries','damages')`
  → **zero wierszy.** Nie ma czego przepinać.

- **Kreator raportów — 4 z 5 źródeł naprawione, `vehicles` otwarte.** Odkryte przez
  `npm run report-sources-check` (`tests/unit/report-sources-test.js`). Backendowa whitelista
  `ALLOWED_TABLES`/`ALLOWED_COLS` i front `SOURCES` to dwie niezależne kopie tej samej listy,
  a obie rozjechały się ze schematem bazy. Każde zapytanie ma `.catch()`, więc użytkownik
  dostawał **pustą tabelę bez błędu** — ta sama klasa co `fuel_entries`, tylko szersza.

  Naprawione (nazwy kolumn wzięte z realnych `CREATE TABLE`): `fuel_entries`→`fuel_fills`,
  `damages`→**`damage_reports`** (tabela `damages` nigdy nie istniała), oraz kolumny
  `service_orders` i `fines` — wszystkie trzy mają polskie nazwy w schemacie
  (`opis`, `koszt`, `warsztat`, `data_zdarzenia`), a whitelisty wymieniały angielskie.

  ~~Zostało `vehicles`~~ — **zrobione 12.08**, patrz Zamknięte. Mapa `COL_EXPR` tłumaczy
  nazwy logiczne na wyrażenia nad kolumną JSON `data`; fallbacki wzięte z aplikacji
  (`COALESCE($.dmc,$.dmcMax)`, `COALESCE($.oddzial,branch_id)`), nie wymyślone.
  `report-sources-test.js` **jest już bramką** w `ci-js.yml` (6 PASS / 0 FAIL).

- **`company_packages` — kod celuje w DWIE niezgodne struktury naraz.** Nie do naprawy
  „przy okazji": odczyt `resolveModuleAccess` (`worker/index.js:13248`) wymaga
  `... WHERE company_id=? AND active=1`, a kolumna `active` istnieje **wyłącznie** w `schema_v48`.
  Zapis `PUT /api/access-control/config` (`index.js:10813`) wstawia `updated_by`, które
  istnieje **wyłącznie** w `schema_v33`. Którakolwiek wersja tabeli powstanie, jedna z tych
  dwóch ścieżek pada. Dziś w praktyce: tabela powstaje z v33 (v48 wycofywany w całości),
  więc zapis pakietu działa, a odczyt leci w `catch → allowed=['*']` — **admin może zapisać
  pakiet `basic` i nie stanie się nic**, cicho. To ta sama klasa co „ciche zera" w ESG.
  Naprawa = decyzja produktowa o licencjonowaniu modułów (patrz ostrzeżenie niżej), nie łatka.

- ~~`xlsx@0.18.5` (SheetJS) z cdnjs — podatny~~ — **naprawione 25.08.** `cdn.sheetjs.com`
  okazał się dostępny z tej sesji (sprawdzone `curl`, nie założone — poprzednia notatka
  o 403 była prawdziwa w innym środowisku/czasie). Podmienione na `cdn.sheetjs.com/
  xlsx-0.20.3` (najnowsza, naprawia obie znane podatności), plik pobrany dwukrotnie
  niezależnie i porównany bajt w bajt przed policzeniem hasza. API SheetJS użyte w
  kodzie niezmienione w tym zakresie wersji — zero zmian w `app.js`/`modules/*.js`.

- **Podniesienie ZXing NIE naprawi zniekształcania bajtów Aztec — sprawdzone.** Kusi,
  żeby uznać `_aztecTextToBytes()` w `app.js` za obejście do usunięcia po aktualizacji
  biblioteki. Nie jest. Wada (`castAsNonUtf8Char` → `TextDecoder` → WHATWG mapuje
  „ISO-8859-1" na windows-1252) występuje w **0.19.1, 0.20.0 i 0.23.0** — sprawdzone
  przez uruchomienie `--selftest` na każdej z nich. Wzorzec zniekształcenia identyczny:
  `80→ac, 92→19, 9f→78`. To wieloletnia właściwość biblioteki, nie regresja jednej wersji.
  Produkcja stoi na **0.19.1** (`index.html:4317`), a bramka `zxing-version-test.js`
  pilnuje, żeby narzędzia testowały tę samą wersję.

- ~~Chart.js jedynym skryptem z CDN bez `integrity`~~ — **naprawione 25.08.** Hasz
  pobrany z oficjalnego API cdnjs (`api.cdnjs.com/libraries/Chart.js/4.4.1?fields=sri`),
  nie policzony samodzielnie z nieufnego źródła — własny SHA-512 z pobranego pliku
  zgodził się co do bajtu z wartością API, co potwierdza autentyczność. `cdn-sri-test.js`
  9/9 skryptów zabezpieczonych, `ZNANE_BEZ_SRI` wyzerowane.

**Sprawy operacyjne (poza kodem)**
- Domena e-mail dla Dominika Dymowskiego i Roberta Sasina — do ustalenia.
- 6 pojazdów litewskich — dokumenty u księgowości, brak potwierdzenia.
- ~~Klucze legacy w Supabase~~ — **bezprzedmiotowe, sprawdzone 19.08**: konto nie ma
  ŻADNEGO projektu, `opeqckxxdqicszfycolb` skasowany. Nie ma czego unieważniać.

**Nowy wątek — nie zaczęty**
- **Integracja MyCar GPS API (Tekom Technologia)** — kandydat na warstwę telematyczną.
  Trzy punkty zaczepienia: (1) czas pracy z **obrotów CAN zamiast zapłonu** — krytyczne dla pojazdów
  asenizacyjnych pracujących na postoju z PTO, wymaga zgłoszenia do `api@tekom.pl`;
  (2) zdarzenia paliwowe + geofency stacji → weryfikacja faktur ORLEN;
  (3) pobieranie plików DDD przez API → automatyzacja zgodności ITD.
  Docs: `registry.scalar.com/@tekom/apis/mycar-api`

---

### Środowisko testowe — fakty z D1 (2026-08-05)

Ustalone `SELECT`-ami na produkcyjnym D1. **Nie zgadywać ponownie** — te dane obaliły dwie
kolejne hipotezy diagnostyczne.

| Fakt | Wartość |
|------|---------|
| Konto CI | `adamus1000@gmail.com`, `id=1`, `role=admin` |
| `users.company_id` | `mtoilet` |
| `user_company_access` dla `user_id=1` | **0 wierszy** — dostęp wyłącznie przez `users.company_id` |
| Pojazdy w `mtoilet` | **193** |
| `TEST_COMPANY` | `mtoilet` (GitHub Secrets + `.env`) |

**Worker autoryzuje po tokenie, nie po parametrze.** `currentCompany` w `localStorage` to jedynie
sugestia dla SPA. Sama zmiana `TEST_COMPANY` na inny tenant **nie przełączy danych** — Worker
nadal zwróci dane spółki z `users.company_id`. Przełączenie tenanta wymaga zmiany
`users.company_id` **albo** wpisu w `user_company_access`.

**`hydrateCompaniesFromApi()` — potwierdzone zachowanie.** Pętla `for…of` nadpisuje istniejące
i **dodaje nowe** klucze do `COMPANIES`; spółka obecna wyłącznie w API przechodzi przez scalenie.
Reset `currentCompanyId` następuje tylko wtedy, gdy klucza nie ma po hydration.
`GET /api/companies` zwraca `WHERE active=1` dla zwykłych kont, **wszystkie** dla adminów —
więc `active=0` nie blokuje hydration dla konta admin, ale blokuje dla pozostałych.

---

### Pułapki API MyCar (na wypadek integracji)
- `GetRouteListByFilter` używa pola **`VehicalID`** (literówka utrwalona w API); `GetEventListByFilter`
  używa poprawnego `VehicleId`. Złe pole = pusty wynik **bez błędu**.
- Endpointy zwracają HTTP 200 także przy błędzie — o powodzeniu decyduje `ErrorCode`, nie status HTTP.
- `Id` parametru jest **per pojazd** — ten sam poziom paliwa ma inny `Id` na każdym aucie. Nie hardkodować.
- `GetRoutesSummary` zwraca `HH:MM:SS` — gubi całe doby powyżej 24 h. Do sum: `GetRouteStatsByFilter.T` (sekundy).
- Limit ~3–5 req/s. Do ciągłego zasysania danych — Kafka, nie REST.
- `LL.Lt/Ln == 361` oznacza wyłączony moduł GPS (oszczędzanie baterii), nie ostatnią znaną pozycję.

---

