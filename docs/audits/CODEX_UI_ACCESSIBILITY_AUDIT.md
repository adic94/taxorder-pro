# Audyt UI, dostępności i stanów błędów — centra operacyjne i Driver PWA

Data: 2026-08-31  
Audytor: `codex-desktop:codex-ui-audit`  
Zakres: `operations-workbench`, `integration-hub`, `automation-center`, `driver-pwa`  
Środowisko: kod lokalny i istniejące wyniki UAT; produkcja nie była używana ani zmieniana.

## Wynik

Nie znaleziono P0. Znaleziono 4 problemy P1, 8 problemów P2 i 2 problemy P3. Najpilniejsze są: brak możliwości poprawnego nadania dostępu do `driver-pwa`, ukrywanie 401/403/402 i awarii sieci w aplikacji kierowcy oraz niedostępne klawiaturowo panele/modalne.

Istniejące testy dostępności obejmują wyłącznie dashboard: `tests/e2e/accessibility.spec.js` loguje się i uruchamia axe na `#page-dash`, a `tests/e2e/mobile-smoke.spec.js` sprawdza overflow również tylko na `#page-dash`. Dlatego zielony wynik tych testów nie pokrywa czterech modułów z tego audytu.

## Znaleziska

### P1 — `driver-pwa` nie może zostać poprawnie przydzielony w katalogu uprawnień

Dowód:

- `index.html:283`, `index.html:2914` i `app.js:498` używają identyfikatora `driver-pwa`.
- `modules/access-control.js:34` oraz `modules/feature-config.js:48` rejestrują wyłącznie inny moduł: `driver-panel`.
- `modules/access-control.js:116-127` uznaje dostęp tylko wtedy, gdy `_allowed` zawiera dokładny identyfikator przycisku. Dla ograniczonego użytkownika `driver-pwa` będzie zablokowany, a administrator z `unlimited` nie ujawni błędu.

Wpływ: kierowca z ograniczonym zestawem modułów może nie otworzyć właściwej aplikacji PWA, a administrator nie ma pozycji, którą mógłby mu nadać.

Reprodukcja:

1. Utwórz użytkownika bez `unlimited` i przydziel mu pozycję „Panel kierowcy (PWA)”.
2. Zaloguj się tym użytkownikiem i wywołaj `showPage('driver-pwa')`.
3. Oczekiwane: PWA jest dostępne. Faktyczne: `canAccess('driver-pwa')` nie znajduje przydziału `driver-panel` i pokazuje ekran blokady.

Rekomendacja: ujednolicić identyfikator albo dodać jawny alias `driver-pwa → driver-panel` w jednym źródle prawdy oraz test uprawnień dla roli kierowcy.

### P1 — Driver PWA ukrywa 401/403/402 i błędy API jako „brak danych”

Dowód:

- `modules/driver-pwa.js:214-220`: każda odpowiedź `!ok` z `/api/operations` i każdy wyjątek czyści `#dpwa-dispatch` bez komunikatu.
- `modules/driver-pwa.js:246-253`: każda odpowiedź `!ok` z `/api/driver-trips` staje się pustą tablicą, więc `modules/driver-pwa.js:258-263` pokazuje „Brak zarejestrowanych tras dziś”. Jedynie wyjątek sieciowy pokazuje błąd.

Wpływ: wygaśnięta sesja, brak roli, brak licencji lub błąd serwera wyglądają jak prawidłowy pusty dzień. Kierowca może rozpocząć pracę bez widocznego zlecenia albo bez świadomości utraty synchronizacji.

Reprodukcja:

1. Zamockuj `/api/operations` kolejno na 401, 403 i 402.
2. Otwórz Driver PWA.
3. Faktyczne: sekcja zleceń znika. Oczekiwane: jawny stan „sesja wygasła” / „brak uprawnień” / „moduł niedostępny” z bezpieczną akcją naprawczą.
4. Powtórz dla `/api/driver-trips`; faktyczne: komunikat „Brak zarejestrowanych tras dziś”.

Rekomendacja: wspólny mapper statusów HTTP, trwały banner synchronizacji i blokada akcji zależnych od danych, gdy odczyt się nie udał.

### P1 — panele i modale nie mają semantyki dialogu ani zarządzania fokusem

Dowód:

- panel szczegółów i planowania: `modules/operations-workbench.js:211-225` oraz `modules/operations-workbench.js:238-246`;
- trzy modale PWA: `modules/driver-pwa.js:132-204`;
- brak `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, pułapki fokusu, obsługi Escape i przywracania fokusu elementowi otwierającemu;
- ikonowy przycisk zamknięcia panelu w `modules/operations-workbench.js:217` nie ma nazwy dostępnościowej.

Wpływ: użytkownik klawiatury lub czytnika ekranu może pozostać na elementach pod nakładką, nie wie, że otwarto dialog, i nie ma przewidywalnej drogi zamknięcia.

Reprodukcja:

1. Otwórz szczegóły operacji klawiaturą.
2. Naciskaj Tab aż fokus wyjdzie poza panel; naciśnij Escape.
3. Faktyczne: brak pułapki/obsługi Escape i brak przywrócenia fokusu.
4. W czytniku ekranu przycisk `ti-x` nie ma dostępnej nazwy.

Rekomendacja: jeden współdzielony komponent dialog/drawer z pełnym cyklem fokusu i testem Playwright.

### P1 — komunikaty o wyniku operacji nie są ogłaszane technologiom asystującym

Dowód:

- wspólny kontener `index.html:4325` ma tylko `class="toast" id="toast"`, bez `role="status"`, `role="alert"` ani `aria-live`;
- `app.js:5194-5208` podmienia `innerHTML` i usuwa komunikat po 3 sekundach;
- wszystkie akcje `automation-center` raportują sukces/błąd wyłącznie przez toast: `modules/automation-center.js:14-19`; podobnie import, adaptery i eksporty w `modules/integration-hub.js:30-39` oraz komendy w `modules/operations-workbench.js:268-297`.

Wpływ: niewidomy użytkownik nie otrzymuje potwierdzenia zapisu ani informacji o błędzie. Dotyczy to operacji finansowych, importów, FNOL, ERP i zmian stanu zleceń.

Reprodukcja:

1. Włącz czytnik ekranu i uruchom dowolny dry-run albo błędny zapis.
2. Faktyczne: komunikat wizualny pojawia się na 3 sekundy bez ogłoszenia.

Rekomendacja: trwały `aria-live` (`polite` dla sukcesu, `assertive`/`role=alert` dla błędu), poprawne rozróżnienie typu komunikatu i komunikat inline przy formularzu.

### P2 — wszystkie błędy centrów integracji/automatyzacji są błędnie diagnozowane jako brak migracji

Dowód:

- `modules/integration-hub.js:7` zawsze dopisuje „Wymagana jest ręczna migracja v56”.
- `modules/automation-center.js:5` zawsze dopisuje „Wymagana jest ręczna migracja v57”.
- mechanizm obejmuje również 401, 402, 403, 429, 500 i awarię sieci.

Wpływ: użytkownik lub support może próbować wykonywać migrację mimo wygaśniętej sesji, braku licencji albo awarii sieci.

Reprodukcja: zamockuj `/overview` na 401 lub przełącz przeglądarkę offline; otwórz moduł. Zobaczysz instrukcję migracji.

Rekomendacja: typowane stany `unauthorized`, `forbidden`, `license_required`, `offline`, `server_error`, `schema_missing`; wskazówkę migracji pokazywać wyłącznie dla rozpoznanego kodu schematu.

### P2 — układy nowych centrów wymuszają poziomy overflow na 360 px

Dowód:

- `modules/integration-hub.js:11` wymusza cztery kolumny `minmax(130px,1fr)` (minimum 550 px z odstępami), a `modules/integration-hub.js:14` wymusza drugą kolumnę minimum 320 px.
- `modules/automation-center.js:7` wymusza cztery kolumny po minimum 140 px (minimum 590 px), a `modules/automation-center.js:9` i `:10` wymuszają układy dwukolumnowe.
- reguły mobilne `style.css:615-669` nie obejmują selektorów tych modułów.

Wpływ: przy 360 px treść i akcje wychodzą poza ekran; część formularza może być trudna do znalezienia bez poziomego przewijania całej strony.

Reprodukcja: viewport 360×800, otwórz oba centra i porównaj `document.documentElement.scrollWidth` z `clientWidth`.

Rekomendacja: klasy układu zamiast inline CSS i breakpoint do jednej kolumny; dodać moduły do testu `mobile-smoke`.

### P2 — elementy Gantta są klikalnymi `div`, ale nie są obsługiwane klawiaturą

Dowód: `modules/operations-workbench.js:177` tworzy wiersz z `onclick` na `div`, bez `tabindex`, roli, nazwy i obsługi Enter/Space.

Wpływ: użytkownik klawiatury nie może otworzyć szczegółów z widoku Gantta, mimo że może to zrobić myszą.

Reprodukcja: wybierz Gantt i przechodź Tabem po operacjach; żaden wiersz nie otrzyma fokusu.

Rekomendacja: użyć natywnego `button`/linku dla nazwy operacji lub dodać pełną semantykę i obsługę klawiatury.

### P2 — kontrolki formularzy nie mają programowo powiązanych etykiet

Dowód:

- etykiety Driver PWA nie mają `for`, a inputy nie są ich potomkami: `modules/driver-pwa.js:137-150`, `:167-175`, `:192-195`;
- formularze leasingu, FNOL i ERP polegają na placeholderach: `modules/automation-center.js:10-12`;
- select zmiany trybu reguły nie ma nazwy odnoszącej się do konkretnej reguły: `modules/automation-center.js:8`.

Wpływ: czytnik ekranu nie przekazuje stabilnej nazwy pola; placeholder znika po wpisaniu wartości i nie zastępuje etykiety.

Reprodukcja: uruchom axe na każdym module lub użyj `getByLabel('Kapitał PLN')`; locator nie znajdzie kontrolki po etykiecie.

Rekomendacja: jawne `<label for>`, `fieldset/legend` dla grup i `aria-describedby` dla walidacji.

### P2 — klasy głównych przycisków centrum operacyjnego nie mają definicji stylu ani focus-visible

Dowód:

- `modules/operations-workbench.js:129`, `:134`, `:136`, `:150`, `:217-220`, `:243-245` używa `btn-primary`, `btn-secondary` i `btn-icon` bez bazowej klasy `btn`.
- przeszukanie repozytorium nie znajduje definicji `.btn-primary`, `.btn-secondary` ani `.btn-icon`; `style.css:512` zapewnia fokus wyłącznie `.btn:focus-visible`.

Wpływ: przeglądarka renderuje część najważniejszych akcji jako kontrolki domyślne; brakuje spójnego touch targetu i widocznego fokusu z systemem projektu.

Reprodukcja: otwórz centrum operacyjne i sprawdź computed style lub przejdź Tabem po „Odśwież”, filtrach i przycisku zamknięcia.

Rekomendacja: stosować `class="btn btn-primary"` itd. albo zdefiniować komponenty wraz z `:focus-visible` i minimum 44×44 px dla ikonowych akcji.

### P2 — akcje asynchroniczne nie mają stanu busy i można je uruchomić wielokrotnie

Dowód:

- `modules/automation-center.js:14-19`, `modules/integration-hub.js:32-39` i `modules/driver-pwa.js:223-236` nie wyłączają kontrolki, nie ustawiają `aria-busy` i nie pokazują postępu;
- klucze idempotencji komend kierowcy zawierają `Date.now()` (`modules/driver-pwa.js:227`, `:236`), więc podwójne kliknięcie tworzy dwa różne żądania, a nie powtórzenie tej samej intencji.

Wpływ: na wolnym łączu użytkownik może wysłać kilka żądań; backend może odrzucić drugie konfliktem wersji, ale UI pokaże niejasny błąd po wcześniejszym sukcesie.

Reprodukcja: opóźnij odpowiedź o 2 s i dwukrotnie naciśnij „Akceptuję”, „Zapisz szkic” lub „Potwierdź import”. Obserwuj co najmniej dwa requesty.

Rekomendacja: per-action pending lock, `disabled`, `aria-busy`, trwały klucz intencji do czasu odpowiedzi i przywrócenie stanu po błędzie.

### P2 — błąd osi czasu operacji jest przedstawiany jako brak migracji

Dowód: `modules/operations-workbench.js:208-209` ignoruje każdy błąd pobrania wydarzeń, po czym `modules/operations-workbench.js:222` pokazuje „Historia będzie dostępna po migracji v54”.

Wpływ: awaria sieci, 403 albo 500 wygląda jak brak migracji, podczas gdy pozostałe dane operacji mogą być aktualne.

Reprodukcja: zwróć 500 tylko z endpointu `/events`; otwórz szczegóły operacji.

Rekomendacja: rozdzielić `eventsLoading`, `eventsEmpty`, `eventsError` i `schemaMissing`.

### P2 — zmiana statusu przystanku zapisuje się bez potwierdzenia i bez rollbacku kontrolki

Dowód: select w `modules/operations-workbench.js:219` wywołuje zapis bezpośrednio w `onchange`; błąd w `modules/operations-workbench.js:276-280` wyświetla tylko toast, ale nie przywraca poprzedniej wartości w otwartym panelu.

Wpływ: po 403, konflikcie wersji lub offline kontrolka nadal wizualnie pokazuje niezapisany status do czasu ponownego renderu/otwarcia.

Reprodukcja: otwórz szczegóły, zamockuj PUT na 409/403, zmień status; po błędzie porównaj wartość selecta z backendem.

Rekomendacja: lokalny stan `saving/error`, rollback albo wymuszone przeładowanie szczegółów oraz komunikat inline przy polu.

### P3 — stany ładowania i wyniki inline nie są live regions

Dowód:

- loading: `modules/operations-workbench.js:65`, `modules/integration-hub.js:7`, `modules/automation-center.js:5`, `modules/driver-pwa.js:124-127`;
- wyniki planowania i leasingu: `modules/operations-workbench.js:259-263`, `modules/automation-center.js:10` i `:17`;
- brak `role="status"`, `aria-live` i `aria-busy`.

Wpływ: użytkownik czytnika ekranu nie wie, że trwa ładowanie ani że wynik podglądu się zmienił.

Rekomendacja: semantyczne statusy, `aria-busy` na kontenerze oraz ogłaszanie zakończenia.

### P3 — stany puste Driver PWA i błąd sieci nie zawierają akcji ponowienia

Dowód: `modules/driver-pwa.js:252-263` pokazuje statyczny tekst; jedyną drogą ponowienia jest przeładowanie całego widoku/aplikacji.

Wpływ: na niestabilnym mobilnym łączu kierowca nie może łatwo wznowić synchronizacji.

Rekomendacja: przycisk „Spróbuj ponownie”, wskaźnik online/offline i automatyczne ponowienie z backoffem bez powielania komend.

## Rekomendowane bramki regresji

1. Rozszerzyć axe z dashboardu na wszystkie cztery strony, zarówno dla administratora, jak i kierowcy.
2. Dodać macierz odpowiedzi 200/401/402/403/409/429/500/offline dla każdego głównego odczytu i zapisu.
3. Dodać test klawiatury: otwarcie/zamknięcie dialogu, Escape, pułapka i powrót fokusu, Gantt Enter/Space.
4. Dodać viewporty 360×800, 390×844, 768×1024 oraz zoom 200%; warunek `scrollWidth <= clientWidth + 1` dla każdej strony.
5. Dodać test przydziału modułu kierowcy: konfiguracja `driver-panel` musi jednoznacznie odblokować faktyczną stronę PWA albo oba miejsca muszą używać jednego ID.
6. Dodać test podwójnego kliknięcia i wolnej sieci: jedna intencja użytkownika = jedno zastosowanie operacji.

## Kolejność napraw

1. Ujednolicić `driver-pwa`/`driver-panel` i przestać ukrywać błędy autoryzacji/synchronizacji.
2. Wprowadzić wspólny mapper błędów HTTP oraz wspólny dostępny dialog/toast.
3. Naprawić układy mobilne i kontrolki/etykiety.
4. Uzupełnić busy/retry/rollback oraz rozszerzyć bramki Playwright/axe.

## Ograniczenia audytu

Audyt był tylko-odczytowy dla kodu aplikacji. Próba otwarcia izolowanego dokumentu testowego w przeglądarce została zablokowana przez politykę bezpieczeństwa przeglądarki, więc nie obchodzono blokady. Ustalenia mobilne wynikają z jednoznacznych minimalnych szerokości inline i braku odpowiadających im breakpointów; przed zamknięciem napraw należy je dodatkowo potwierdzić w docelowym teście UAT z kontem kierowcy.
