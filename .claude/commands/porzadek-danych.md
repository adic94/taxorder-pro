---
description: Pętla porządkowania danych floty i CFM — inwentaryzacja, przypisanie do modułów, scalanie źródeł, harmonogram i podsumowania
argument-hint: [opcjonalnie: etap, np. "E2" albo "dokumenty"; pusty = następny krok ze STAN.md]
allowed-tools: Bash(node *), Bash(npm run *), Bash(git status*), Bash(git log*), Bash(git diff*), Bash(rg *), Bash(grep *), Bash(ls *), Read, Glob, Grep, Write, Edit
---

# Pętla porządkowania danych — TaxOrder Pro / FleetCore (flota + CFM)

Zakres tego przebiegu: $ARGUMENTS (pusty = następny niezamknięty krok z `STAN.md`).

Uruchamiane jednorazowo (`/porzadek-danych`) albo w pętli
(`/loop /porzadek-danych` — model sam dobiera tempo; `/loop 2h /porzadek-danych` — stały odstęp).
**Jeden przebieg = jeden krok harmonogramu**, domknięty pomiarem i wpisem do `STAN.md`.
Nie próbuj zrobić całości naraz — pętla istnieje po to, żeby każdy krok był sprawdzony.

## Cel

Każdy dokument, rekord, katalog i parametr, który mamy (D1, R2, skany, arkusze, eksporty
z systemów zewnętrznych), ma być:

1. **zinwentaryzowany** — wiemy, że istnieje, gdzie leży i ile go jest;
2. **przypisany** — do pojazdu (VIN jako klucz nadrzędny, nr rej. pomocniczo), do spółki
   (`company_id`) i do modułu aplikacji, który go używa;
3. **uszeregowany** — ma jedno źródło prawdy i rangę względem pozostałych;
4. **oceniony** — wiemy, czy jest kompletny, sprzeczny, przestarzały czy osierocony;
5. **wykorzystany** — dane, które już zdobyliśmy, trafiają tam, gdzie aplikacja ich potrzebuje,
   zamiast leżeć w backupie.

Mierzy się to nie liczbą wypełnionych pól, tylko liczbą **decyzji operacyjnych, które dane
pozwalają podjąć**: policzyć DT-1, zafakturować klienta CFM, nie przegapić przeglądu, OC,
tachografu, leasingu, legalizacji.

## Zasady nadrzędne (nie podlegają negocjacji w żadnym przebiegu)

- **Zero zapisów na produkcję bez potwierdzenia właściciela.** Żadnego `UPDATE`/`INSERT`/
  `DELETE` na D1, żadnej migracji, `wrangler deploy`, pushu do `main`. Pętla **produkuje
  propozycje** (raport, arkusz, plik SQL do przejrzenia), właściciel je zatwierdza.
  Precedens: korekta `WA995AL` (D14, 1488 zł) czeka na decyzję, a nie na skrypt.
- **Dane produkcyjne poza repozytorium.** Wszystkie wyniki z VIN-ami, tablicami, DMC
  i nazwami spółek → `~/Documents/taxorder-backupy/porzadek/`. W repo lądują wyłącznie
  narzędzia, bramki i zanonimizowane liczby zbiorcze. W sesji w chmurze, gdzie tego katalogu
  nie ma — scratchpad sesji, nigdy drzewo repo.
- **Rozstrzyga VIN, nie nazwa folderu ani numer rejestracyjny.** Tablica zmienia się przy
  przerejestrowaniu, folder bywa wspólny dla dwóch aut. Sprostowanie z 26.08 („6 pojazdów
  płaci dwa razy") było artefaktem scalania po tablicy.
- **Arkusz zbudowany z dokumentów opisuje dokumenty, nie flotę.** Każde ustalenie
  o pojazdach firmy potwierdzaj w D1, a twierdzenie „w całej bazie" — zapytaniem na
  **wszystkich** wierszach, nie na próbce (sprostowanie z 27.08).
- **Brak to brak, nie zero i nie domysł.** ZSI zapisuje nieznane DMC jako `0`; silnik DT-1
  przy braku osi cicho przyjmuje 2. Puste pole zostaje puste i trafia na listę braków.
- **Nie wierz odpowiedzi, której filtr nie udowodnił działania.** CEPiK open-data
  `numer-rejestracyjny` jest zepsuty — nie używaj go jako źródła, dopóki sekcja HANDOFF
  tego nie odwoła.
- **Nie twórz piątej kopii listy.** Katalog pól DR to `modules/dr-fields.js`, kategorie DT-1
  liczy `modules/tax-engine.js` (przez `window`-shim), stawki — `modules/gminy-rates.js`,
  wskaźniki CO2 — `CO2_EMISSION_FACTORS` w Workerze. Narzędzia czytają je, nie kopiują.
- **Każde nowe narzędzie kontrolne musi upaść na złych danych**, zanim uznasz je za bramkę
  (kontrola negatywna, jak we wszystkich wpisach sekcji Zamknięte w `CLAUDE.md`).

## Źródła, które już mamy (wykorzystaj, zanim pobierzesz cokolwiek nowego)

| ranga | źródło | gdzie | co wnosi | znane wady |
|---|---|---|---|---|
| 5 | **D1 produkcja** (`vehicles`, `documents`, `fuel_fills`, `damage_reports`, `fines`, `service_orders`, polisy, kierowcy, CFM…) | Worker / `mcp__cloudflare__d1_query` (tylko `SELECT`) | stan, na którym liczy się podatek i faktury | `suspension_type` wpisane hurtem (217× „pneumatyczne"), 3 pojazdy bez DMC, para `WZ481KK`/`WA0677L` z tym samym VIN |
| 4 | **DR — dowody rejestracyjne** (Aztec + OCR, checkpoint ~1318 rekordów) | `taxorder-backupy/`, `tools/dr-extractor.js`, `tools/dr-excel.js` | dane urzędowe DT-1 | OCR skanu, nie dowód: „LONDAIS", M1 przy Atego, wycieki promptu/modelu |
| 3 | **ZSI** — `Brak VIN w ZSI.xlsx` | `Desktop/Dokumentacja pojazdów/Pulpit/` | **norma EURO**, przebiegi, kierowca, OC/AC | DMC `0` = brak danych |
| 2 | **MyCar** — `mycar-10-2025-nowe.xls` (UTF-16LE TSV) | `Downloads/` | karta paliwowa, polisa, GPS, eToll, leasing | eksport z października 2025 — sprawdź świeżość |
| 1 | **ORLEN** — numery kart CSV | `Downloads/` | ważność, status, blokady kart | tylko karty |
| — | **Arkusz MASTER** (`tools/flota-master.js`) | `taxorder-backupy/` | scalone 4 źródła + arkusze „DR do weryfikacji", „Ten sam VIN" | 26 pojazdów pod >1 tablicą (artefakt dokumentów) |
| — | **DT-1**: `dt1-wyliczenie.js`, `dt1-checklist.js`, `dr-braki-checklist.js` | `tools/` | kwota 298 200 zł, 89 flag, 134 pojazdy z brakami | 48 pojazdów spoza D1 (62 952 zł) do decyzji |
| — | **Kontrole**: `tools/autotest/d1-flota-check.js`, `d1-schema-diff.js` | `tools/autotest/` | kompletność danych i kształt bazy | wymagają poświadczeń do produkcji |
| — | Uchwała XXIX/1065/2025, M.P. 2025 poz. 769 (Tabela D) | `Program flotowy/`, `/akt-prawny` | stawki DT-1 (45/45), opłaty środowiskowe | gęstość paliw i EURO 6 nierozstrzygnięte |

Ranga dotyczy pól, które dane źródło **zna u źródła** (`RANGA` w `flota-master.js`:
D1 wnosi tylko `liczbaOsi` i `rodzaj`). Nie podnoś rangi źródła dla pola, którego ono
tylko „przechowuje".

## Model docelowy — do czego przypisujemy dane

Każdy obiekt danych dostaje cztery współrzędne: **spółka → pojazd (VIN) → domena → moduł**.

| domena | przykładowe dane | moduły (`modules/`) | tabela D1 |
|---|---|---|---|
| Identyfikacja i rejestracja | VIN, nr rej., DR, kategoria homologacyjna, DMC, osie, rodzaj | `vehicle-detail`, `dr-import`, `dr-fields` | `vehicles` |
| Podatki i opłaty | DT-1, gmina, stawki, opłata środowiskowa, winiety, eToll | `tax-engine`, `gminy-rates`, `dt1-*`, `vignettes`, `etoll-import` | `vehicles.dt1_*`, `vignettes` |
| Ubezpieczenia | OC/AC/NNW, polisy, terminy, szkody | `insurance`, `policies`, `policy-ocr`, `damages` | polisy, `damage_reports` |
| Finansowanie i CFM | leasing, najem, umowy klienta, faktury, rozliczenia tras | `cfm-clients`, `cfm-contracts`, `cfm-invoices`, `leasing-schedule`, `route-billing`, `tco` | tabele CFM |
| Eksploatacja | tankowania, karty, przebiegi, CO2, ESG | `fuel-*`, `fuel-card-import`, `co2-report`, `esg-*` | `fuel_fills`, `esg_targets` |
| Serwis i stan techniczny | przeglądy, serwisy, opony, części, gwarancje, usterki | `service*`, `vehicle-inspections`, `tires-warehouse`, `spare-parts`, `warranties`, `faults` | `service_orders`… |
| Kierowcy i czas pracy | przypisania, uprawnienia, badania, tachograf, mandaty | `drivers`, `driver-*`, `tacho*`, `fines`, `hr-module` | kierowcy, `fines`, `hr_*` |
| Telematyka | GPS, MyCar/Tekom, geofencing | `gps-integrations`, `tekom-*`, `geofencing`, `fleet-map` | — |
| Dokumenty | skany, PDF, protokoły, CMR, skrzynka dokumentów | `documents`, `document-manager`, `doc-workflow`, `handover-protocol`, `cmr` | `documents` (+ R2) |
| Księgowość / urzędy | JPK, KSeF, e-Doręczenia, środki trwałe | `jpk`, `ksef`, `edoreczenia`, `fixed-assets` | `jpk_exports`, `ksef_*` |

Obiekt, którego nie da się przypisać do żadnej komórki tej tabeli, trafia na listę
**„osierocone"** — z powodem (brak VIN, brak spółki, brak modułu, który by go czytał).

## Harmonogram — etapy i kroki

Etapy idą po kolei; kroki w etapie można przestawiać. Każdy krok kończy się **artefaktem**
(plik w `porzadek/`) i **liczbą**, którą da się porównać w następnym przebiegu.

### E0 — Start i stan wyjściowy (1 przebieg)
- E0.1 Przeczytaj HANDOFF w `CLAUDE.md` i `tools/README.md`; zanotuj w `STAN.md` daty
  i liczby, od których startujemy (217 pojazdów w D1, 907/945 w arkuszach, 1318 DR, itd.).
- E0.2 Sprawdź, które źródła są dostępne **w tej sesji** (pliki lokalne, D1 przez MCP,
  sieć do źródeł rządowych). Brak dostępu = krok na liście „zablokowane", nie domysł.
- E0.3 `npm run test:gates` — zielony punkt startowy; czerwony = najpierw to.

### E1 — Inwentaryzacja (2–3 przebiegi)
- E1.1 **D1**: liczba wierszy per tabela tenantowa × `company_id`; tabele puste, tabele
  bez odczytów w Workerze (np. `approval_requests`, `driver_behavior_events`,
  `fixed_asset_depreciation`).
- E1.2 **R2 / `documents`**: dokumenty per typ, per pojazd; dokumenty z `nr_rej IS NULL`
  (skrzynka po `migration_v54`); pliki w R2 bez wiersza i wiersze bez pliku.
- E1.3 **Dysk**: katalogi „Dokumentacja pojazdów", backupy, eksporty — drzewo z liczbą plików,
  typami i najpóźniejszą datą per katalog pojazdu. Nazwy „SPRZEDANY/SOLD" zapisuj jako
  sygnał, nie jako status (polisa mówi więcej niż folder).
- E1.4 **Arkusze zewnętrzne** (ZSI, MyCar, ORLEN): kolumny, liczba wierszy, data eksportu.
- Artefakt: `inwentarz.json` + `inwentarz.md` (liczby zbiorcze).

### E2 — Klucz pojazdu i deduplikacja (2 przebiegi)
- E2.1 Rejestr pojazdów: VIN → lista tablic → spółka → status w D1. Źródło VIN-ów:
  D1, DR (Aztec ma pierwszeństwo przed OCR), ZSI.
- E2.2 Konflikty klucza: ten sam VIN pod różnymi tablicami, ta sama tablica pod różnymi VIN,
  pary różniące się jedną literą (M↔W — możliwy błąd OCR), VIN niepoprawny (cyfra kontrolna,
  długość, litery I/O/Q).
- E2.3 Pojazdy-widma: rekordy tylko z nazwy pliku (`GD`, `GDA`, `PY`), tablice zagraniczne,
  sprzęt bez tablicy (myjka Kränzle `895`) — osobna lista, nie kasowanie.
- E2.4 48 pojazdów „tylko w dokumentach": klasyfikacja realna flota / historyczny / artefakt,
  z dowodem (polisa, faktura, tankowanie po dacie).
- Artefakt: `rejestr-pojazdow.xlsx` (arkusze: Rejestr, Konflikty VIN, Widma, Poza D1).

### E3 — Przypisanie do domen i modułów (2–3 przebiegi)
- E3.1 Dla każdej domeny z tabeli wyżej: które pola mamy, z jakiego źródła, w jakim pokryciu
  (pojazdy z wartością / pojazdy, których pole dotyczy — nie / całą flotę).
- E3.2 Dokumenty → pojazd + typ dokumentu + moduł; dokumenty osierocone z powodem.
- E3.3 Dane, które **leżą w backupie, a moduł ich nie dostaje** (np. EURO z ZSI 568/945,
  polisy i karty z MyCar, karty ORLEN) — lista kandydatów do importu z proponowaną ścieżką
  (istniejący importer: `zsia-importer`, `fuel-card-import`, `tekom-import`, `bulk-import`…).
- E3.4 Moduły, które czytają tabele bez danych — lista „funkcja istnieje, dane nie dotarły".
- Artefakt: `macierz-pokrycia.xlsx` (domena × pole × źródło × pokrycie × moduł).

### E4 — Jakość i spójność (3–4 przebiegi, priorytet wg pieniędzy i ryzyka)
Kolejność kontroli według skutków:
1. **DT-1** — DMC, osie (≥12 t), rodzaj, ciągnik vs sztywna ciężarówka (>32 t), M1 vs N1/N2,
   miesiące posiadania; porównanie z `vehicles.dt1_*` (ostatnio 216/217 zgodnych).
2. **Terminy prawne** — OC, przegląd, tachograf (legalizacja, odczyty DDD), badania kierowców,
   uprawnienia, UDT tam, gdzie dotyczy (asenizacja, HDS). Brakujący termin = ryzyko kary.
3. **CFM** — każdy pojazd klienta ma umowę, stawkę, okres; pojazdy w umowie bez danych
   kosztowych; faktury bez pojazdu.
4. **Eksploatacja** — tankowania vs typ paliwa pojazdu, przebiegi malejące, karty
   przypisane do sprzedanych pojazdów.
5. **ESG / opłaty środowiskowe** — tylko pomiar (EURO 6 = 80% floty bez stawki w Tabeli D);
   nic nie liczymy, dopóki decyzja w HANDOFF nie zapadnie.
- Każda kontrola: liczba naruszeń, lista pojazdów, **proponowana poprawka ze źródłem**,
  kwota/ryzyko. Kontrole, które warto utrwalić, idą do `tools/autotest/d1-flota-check.js`
  (z listą `ZNANE` i zapadką w obie strony).
- Artefakt: `jakosc-<data>.xlsx` + `propozycje-poprawek.sql` (**nie wykonywany**, z komentarzem
  przy każdym wierszu: pojazd, stare → nowe, źródło, skutek finansowy).

### E5 — Porządek struktury (1–2 przebiegi)
- E5.1 Proponowany standard katalogów dokumentów:
  `<spółka>/<VIN>_<nr_rej>/<domena>/<RRRR-MM-DD>_<typ>_<opis>.<ext>` — plan przeniesienia
  jako lista `skąd → dokąd`, **bez** przenoszenia plików.
- E5.2 Słowniki: typy dokumentów, rodzaje pojazdów, paliwa (warianty z `#fm-ftype`),
  statusy — jedna lista, wskazanie miejsc, które używają innych wartości.
- E5.3 Schemat D1: martwe tabele, rozjazdy kolumn (`docs/ROZJAZD-KOLUMN.md`) — tylko
  aktualizacja dokumentacji i ewentualny plik `migration_vNN_*.sql` do przeglądu.

### E6 — Podsumowanie i plan wdrożenia (1 przebieg na zamknięcie cyklu)
- Raport dla zarządu (1 strona): pokrycie per domena przed/po, kwoty zagrożone brakami,
  terminy w najbliższych 30/60/90 dniach, decyzje do podjęcia.
- Lista decyzji dla właściciela, posortowana skutkiem (zł, kara, ryzyko prawne).
- Proponowane PR-y (narzędzia, bramki, importy) — każdy osobno, przez branch.
- Wpis do sekcji HANDOFF w `CLAUDE.md` (zwięzły, z liczbami i datą) — w osobnym commicie.

### Rytm podsumowań
| kiedy | co | gdzie |
|---|---|---|
| po każdym przebiegu | 5–10 linii: krok, liczby przed/po, blokady, następny krok | `STAN.md` + odpowiedź w czacie |
| po każdym etapie | podsumowanie etapu z artefaktami i decyzjami do podjęcia | `porzadek/etap-EN.md` |
| co tydzień (poniedziałek) | zestawienie: postęp harmonogramu, terminy prawne 30 dni, otwarte decyzje | `porzadek/tydzien-RRRR-WW.md` |
| koniec cyklu (E6) | raport dla zarządu + aktualizacja HANDOFF | `porzadek/raport-koncowy.md`, `CLAUDE.md` |

## Przebieg jednej iteracji pętli

1. Przeczytaj `~/Documents/taxorder-backupy/porzadek/STAN.md` (brak pliku = zacznij od E0.1
   i go utwórz). Wybierz krok: `$ARGUMENTS` albo pierwszy niezamknięty.
2. Sprawdź warunki kroku (dostęp do źródła, wynik poprzedniego kroku). Brak = oznacz
   „zablokowane: <powód>" i przejdź do następnego niezależnego kroku.
3. Wykonaj krok **istniejącym narzędziem**, jeśli jest (`tools/README.md`). Nowe narzędzie
   tylko wtedy, gdy żadne nie odpowiada na to pytanie — i od razu z kontrolą negatywną.
4. Zmierz wynik liczbą. Wynik sprzeczny z wcześniejszym ustaleniem → najpierw wyjaśnij
   rozbieżność, potem zapisz (nie nadpisuj starej liczby bez komentarza).
5. Zapisz artefakt i dopisz do `STAN.md`:
   ```
   ## RRRR-MM-DD HH:MM — E<n>.<m> <nazwa>
   wynik: <liczby>
   artefakt: <ścieżka>
   decyzje dla właściciela: <lista albo „brak">
   zablokowane: <lista albo „brak">
   następny krok: E<n>.<m>
   ```
6. W czacie: krótkie podsumowanie (co zrobione, liczby, decyzje, następny krok).
   Gdy cały harmonogram zamknięty albo wszystko, co zostało, czeka na decyzję właściciela —
   **zatrzymaj pętlę** i napisz to wprost, zamiast kręcić puste przebiegi.

## Czego pętla NIE robi

- nie poprawia danych w D1, nie przenosi ani nie kasuje plików na dysku i w R2;
- nie odpytuje masowo API zewnętrznych (CEPiK, CF Workers AI — limit 10 000 neuronów/dobę,
  Groq TPD) bez budżetu żądań policzonego przed startem;
- nie uzupełnia wartości „z pamięci" ani z dokumentów, których nie przeczytała;
- nie zmienia stawek, kategorii ani reguł podatkowych — to decyzje, nie porządki.
