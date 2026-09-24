# Audyt kompletności UI — 31.08.2026

## Cel i zakres

Audyt odpowiada na pytanie, czy funkcje istniejące w schemacie D1 są dostępne i operacyjnie używalne w aplikacji, a nie wyłącznie czy istnieje plik lub tabela.

Sprawdzono pełny łańcuch migracji `worker/schema*.sql` i `worker/migration*.sql`, routing w `worker/index.js`, 163 moduły `modules/*.js`, nawigację i kontenery ekranów w `index.html` oraz dyspozytor `showPage()` w `app.js`. Mechaniczny skan znalazł 142 unikalne nazwy `CREATE TABLE`; liczba obejmuje tabele tymczasowe, kopie i nazwy pośrednie z migracji, więc nie jest liczbą aktywnych tabel produkcyjnych.

Weryfikacja lokalna:

- aplikacja uruchamia się i ładuje ekran logowania bez błędów JavaScript;
- jedyny komunikat startowy to ostrzeżenie `UserPrefs` o braku tokenu przed zalogowaniem;
- `npm run audit:all`: 170/170 plików poprawnych składniowo, 25/25 bramek i 233/233 asercje przeszły, audyty XSS, i18n i Service Workera są zielone;
- pełny smoke test ekranów po zalogowaniu nie został wykonany, ponieważ sesja nie zawiera poświadczeń testowych. Wnioski o cyklu interakcji są zatem oparte na kodzie, poza samym startem aplikacji.

## Wynik zarządczy

TaxOrder Pro nie ma problemu „139 tabel i brak UI”. Zdecydowana większość domen ma kompletny łańcuch: nawigacja → ekran/moduł → API → tabela. Wcześniejsze wyniki oparte wyłącznie na `app.js` i nazwach z podkreślnikami były fałszywie negatywne, ponieważ logika ekranów znajduje się głównie w osobnych plikach `modules/*.js`, nazywanych myślnikami.

Najważniejsze potwierdzone luki to:

1. trwały harmonogram rat leasingowych — jest kalkulator UI, ale brak tabeli rat, API i powiązania harmonogramu z umową;
2. `driver_behavior_events` — tabela bez routingu API i bez UI;
3. ANPR — brak modelu, integracji i interfejsu rozpoznawania tablic;
4. fraud paliwowy — dane `fuel_fills` i `gps_positions` istnieją, lecz nie ma reguły korelującej miejsce/czas tankowania z pozycją pojazdu;
5. FNOL — `insurance_claims` jest rejestrem roszczeń, nie pełnym procesem zgłoszenia szkody do ubezpieczyciela;
6. generowanie publicznego linku kierowcy — backend `vehicle_tokens`/`driver-form` jest gotowy, ale brak wywołania w UI;
7. `approval_requests` — osierocony, alternatywny model workflow z v35; działający ekran zatwierdzeń używa starszej tabeli `approvals`.

## Macierz modułów

| Grupa | Tabele/dane | API | Ekran | Ocena | Najważniejszy problem |
|---|---|---:|---:|---|---|
| Pojazdy i karta pojazdu | tak | tak | tak | kompletne | brak osobnego widoku surowych pozycji GPS; dane są konsumowane przez mapę/integracje |
| Serwis, zlecenia, inspekcje | tak | tak | tak | kompletne | do smoke testu cykl zamknięcia i błędy sieciowe |
| Szkody | tak | tak | tak | kompletne jako rejestr szkód | nie zastępuje pełnego FNOL ubezpieczeniowego |
| Polisy i roszczenia | `insurance_policies`, `insurance_claims` | tak | tak | polisy kompletne; FNOL płytkie | roszczenie ma opis, kwoty, numer, status i notatki; brak komunikacji z ubezpieczycielem, załączników, osi czasu i SLA |
| Opony | tak | tak | tak | kompletne | kontrolę uprawnień operacyjnych zweryfikować dynamicznie |
| Paliwo i karty paliwowe | `fuel_fills` i importy | tak | tak | kompletne operacyjnie | brak korelacji tankowanie ↔ GPS; obecne anomalie dotyczą spalania/statystyki |
| Leasing | pola pojazdu, bez tabeli rat | brak API harmonogramu | tak | częściowe | `leasing-schedule.js` liczy kapitał i odsetki wyłącznie w przeglądarce; brak zapisu/importu rzeczywistych rat i marży |
| TCO, budżety, aktywa | tak | tak | tak | kompletne | brak luki strukturalnej potwierdzonej w audycie |
| GPS, geofencing, integracje GPS | tak | tak | tak | kompletne funkcjonalnie | przydatny osobny ekran historii `gps_positions`; obecnie nacisk na mapę i integracje |
| Tachograf i e-TOLL/winiety | tak | tak | tak | kompletne | wcześniejsza ocena „jedno API” była błędna: moduły używają wrapperów `_api()`; winiety obsługują CRUD winiet i urządzeń e-TOLL |
| Wideo-telematyka | tak | pełny CRUD | tak | rejestr kompletny | to ręczny rejestr zdarzeń/URL klipów, nie automatyczna integracja dostawcy wideo |
| Predykcyjny serwis | `predictive_alerts` | CRUD + przeliczenie | tak | kompletne regułowo | wymaga walidacji jakości predykcji na danych rzeczywistych; nie jest to model ML |
| Kierowcy, HR, grafik, płace | tak | tak | tak | kompletne | oddzielna tabela `driver_behavior_events` pozostaje nieużywana |
| Scoring/wydajność kierowców | dane agregowane z paliwa, szkód i zmian | tak | tak | częściowe | istnieją wyniki agregowane, ale brak ingestu zdarzeń jazdy do `driver_behavior_events` |
| Zatwierdzenia | `approvals`, poziomy | tak | tak | kompletne | osierocona tabela `approval_requests` dubluje domenę i powinna zostać świadomie usunięta albo zaadaptowana |
| Rezerwacje, carpooling, parking | tak | tak | tak | kompletne | cykle approve/reject/complete są zaimplementowane |
| Dokumenty i obieg | tak | tak | tak | kompletne | dokumenty flotowe, upload, statusy, historia i szablony mają osobne moduły |
| KSeF i JPK | tak | tak | tak | kompletne na poziomie UI/API | integrację zewnętrzną należy testować na środowisku testowym KSeF; nie jest to luka UI |
| ESG/CSRD | tak | tak | tak | kompletne | wcześniejsze rozjazdy schematu zostały opisane w historii; bieżące bramki migracji są zielone |
| RODO i audyt | tak | tak | tak | kompletne | wymagany test ról na koncie nieadministracyjnym |
| Spedycja: zlecenia, CMR, SENT | tak | tak | tak | kompletne | wszystkie mają pozycje nawigacji i obsługę backendową |
| Windykacja | tak | lista/CRUD/statystyki/przypomnienia | tak | kompletne | wcześniejsze „zero wzmianek” wynikało z nazwy `debt-collection.js` |
| CFM | klienci, kontrakty, faktury | pełny CRUD/generowanie | 3 ekrany | kompletne | CFM nie jest tajemniczą martwą domeną; ma jawne pozycje menu i modale |
| Integracje, webhooki, Zapier/Make | tak | tak | tak | kompletne jako framework | konektory enova365 i Comarch pozostają nową pracą domenową |
| Smart Forms i raporty | tak | tak | tak | kompletne | publiczny formularz kierowcy korzysta z innego gotowego API, ale nie ma przycisku generowania linku |
| Użytkownicy, role, pakiety | tak | tak | tak | kompletne strukturalnie | końcowy test autoryzacji wymaga co najmniej kont admin/kierownik/kierowca |
| Powiadomienia | tak | tak | tak | kompletne | preferencje, typy alertów, log i push są obecne |

## Potwierdzone luki — specyfikacja

### P0 — kontrola uprawnień i tenantów w działającej aplikacji

Statyczny kod routingu zwykle sprawdza uwierzytelnienie i `company_id`, a historia projektu raportuje 99,4% zapytań tenantowych ze scopem. Nie jest to jednak dowód poprawnej autoryzacji funkcjonalnej. Należy wykonać macierz kont admin/kierownik/kierowca dla operacji odczytu, utworzenia, edycji i usunięcia w polisach, oponach, tankowaniach, RODO, audycie i konfiguracji integracji.

Kryterium: niedozwolona operacja zwraca 403/404 również przy bezpośrednim wywołaniu API, a nie tylko znika z menu.

### P1 — trwały harmonogram leasingu

Obecny `modules/leasing-schedule.js` zawiera kalkulator annuitetowy i prezentuje kapitał, odsetki, VAT, saldo oraz eksport CSV. Nie zapisuje harmonogramu do D1 i opiera listę pojazdów na polach pojazdu.

Zakres brakujący:

- umowa leasingowa i jej parametry źródłowe;
- raty: numer, termin, kapitał, odsetki, marża/opłaty, VAT, brutto, saldo, status płatności;
- import harmonogramu leasingodawcy i ręczne korekty z audytem;
- API CRUD oraz powiązanie z pojazdem, dostawcą, dokumentem i TCO;
- rozróżnienie harmonogramu planowanego od rzeczywistych płatności.

### P1 — zdarzenia stylu jazdy

`driver_behavior_events` istnieje od v35 i opisuje hamowanie, przyspieszenie, prędkość, zakręt, jałowy bieg, telefon i pasy. Nazwa nie występuje w `worker/index.js`, `modules/`, `app.js` ani `index.html` poza migracją. To potwierdzona tabela osierocona.

Decyzja architektoniczna: albo zbudować ingest z telematyki + API + ekran zdarzeń i włączyć dane do istniejącego scoringu, albo wycofać tabelę w kontrolowanej migracji. Nie tworzyć drugiego systemu scorecard obok obecnych `driver-scoring` i `driver-performance`.

### P1 — fraud paliwowy

System ma tankowania, pozycje GPS i integracje GPS, ale brak zapytania/reguły łączącej te źródła. Minimalna reguła powinna porównywać czas tankowania z najbliższą pozycją pojazdu i geokodowaną lokalizacją stacji, uwzględniając tolerancję czasu, promień, jakość GPS i strefę czasową. Wynik ma być alertem do wyjaśnienia, nie automatycznym oskarżeniem.

### P1 — FNOL

`insurance_claims` przechowuje tylko identyfikatory polisy/pojazdu, datę i opis szkody, numer roszczenia, kwoty, status oraz notatki. Brakuje uczestników, danych zdarzenia i lokalizacji, obrażeń/policji, załączników, checklisty, historii kontaktu, wysyłki do ubezpieczyciela, potwierdzeń, SLA i pełnej osi statusów. Wniosek: rejestr roszczeń istnieje, pełny FNOL nie.

### P2 — link formularza kierowcy

Backend `GET /api/vehicle-tokens/:nrRej` tworzy lub zwraca token i URL `#driver-form/:token`; publiczne API formularza również istnieje. Frontend nie wywołuje `/api/vehicle-tokens`, więc użytkownik nie ma przycisku „Generuj link”. To małe domknięcie UI, nie nowa funkcja backendowa.

### P2 — osobne widoki danych technicznych

`gps_positions` i geofences są obsługiwane przez mapę/geofencing, a `fleet-inventory` przez moduł sesji inwentaryzacyjnych. Nie są martwym backendem. Można natomiast poprawić odkrywalność przez historię pozycji GPS i jednoznaczne wejście do inwentaryzacji z głównej nawigacji/karty pojazdu.

## Korekty wcześniejszych hipotez

- `ev_charging`, video telematics, windykacja, CFM i `fleet_limits` nie są martwym backendem.
- `vignettes.js`, `video-telematics.js` i `predictive-maintenance.js` używają lokalnych wrapperów API; liczenie wyłącznie surowych wystąpień `fetch()` zaniżało integrację.
- harmonogram leasingowy ma już użyteczny kalkulator; brakuje trwałego modelu operacyjnego.
- zatwierdzenia i rezerwacje mają zaimplementowane cykle stanów; osierocona jest osobna tabela `approval_requests`, nie działający moduł `approvals`.

## Rekomendowany backlog

1. Zalogowany smoke test oraz test ról/tenantów dla krytycznych endpointów.
2. Dodać przycisk generowania linku formularza kierowcy.
3. Podjąć decyzję o `approval_requests` i `driver_behavior_events` przed nowymi migracjami.
4. Zaprojektować i wdrożyć trwały harmonogram leasingowy.
5. Zbudować fraud paliwowy jako explainable alert nad istniejącymi danymi.
6. Rozszerzyć `insurance_claims` do FNOL po uzgodnieniu zakresu integracji z ubezpieczycielami.
7. ANPR jako osobny projekt integracyjny.
8. Dopiero potem wzorzec konektora ERPNext i konektory enova365/Comarch.

## Ograniczenia audytu

Audyt nie potwierdza działania zewnętrznych usług ani zachowania na danych produkcyjnych. Bez kont testowych dla kilku ról nie zweryfikowano wizualnie każdego modalu, wszystkich komunikatów błędów, separacji tenantów ani rzeczywistych przejść stanu. To jest zamknięty audyt kompletności kodu z testem startowym UI, a nie certyfikacja produkcyjna end-to-end.
