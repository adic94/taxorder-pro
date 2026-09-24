# Benchmark TaxOrder Pro vs PasCom Flota II i rynek — 31.08.2026

## Konkluzja

TaxOrder Pro ma już większość szerokich kategorii funkcjonalnych PasCom Flota II. Największa różnica nie polega na liczbie modułów, lecz na głębokości kilku procesów oraz dojrzałości integracyjnej.

Najważniejsze luki względem PasCom to:

1. pełne reguły kontroli tankowań i korelacja pojedynczej transakcji z GPS;
2. pełny proces szkody i odszkodowania;
3. autoryzacja kosztorysu naprawy przed wykonaniem oraz automatyczne tworzenie dokumentu kosztowego;
4. rozliczenia okresowe kosztów, import zapłat, rozrachunki i eksport przelewów bankowych;
5. ogólny CRM kontrahentów, umowy, pisma i dokumenty kontrahenta poza domeną CFM;
6. reklamacje i niezgodności;
7. pola, kolumny, dokumenty i analizy konfigurowalne przez użytkownika bez zmiany kodu;
8. uniwersalne importy cykliczne oraz gotowe konektory ERP/FK/HR;
9. ewidencja telefonów służbowych i rozliczanie ich kosztów/limitów;
10. trwały harmonogram i rozliczenie leasingu zamiast samego kalkulatora.

Konkurenci telematyczni pokazują osobną klasę luk: aktywny coaching kierowcy, telematyka wideo AI, TPMS, diagnostyka pojazdu, monitoring temperatury/łańcucha chłodniczego, terminal kierowcy z nawigacją i zleceniami oraz usługi odzyskiwania skradzionych pojazdów. Tych funkcji nie należy budować jako samego CRUD-u — wymagają urządzeń, aplikacji terenowej lub partnera integracyjnego.

## Metoda

Stan TaxOrder Pro porównano z kodem, pełnym łańcuchem migracji i raportem `AUDYT_KOMPLETNOSCI_UI_2026-08-31.md`. Funkcje konkurentów przyjęto tylko wtedy, gdy zostały opisane na oficjalnej stronie producenta. Materiały marketingowe potwierdzają deklarowany zakres, ale nie dowodzą jakości wdrożenia ani kompletności każdego wariantu licencyjnego.

Główny punkt odniesienia: [PasCom Flota II](https://www.pascom.com.pl/oferta/pascom-flota-ii/). Producent deklaruje, że program został uznany przez czytelników magazynów FLOTA i FLEET za najlepszy polski program flotowy; traktujemy to jako deklarację producenta, nie niezależny współczesny test porównawczy.

Dodatkowe punkty odniesienia:

- [Webfleet](https://www.webfleet.com/pl_pl/webfleet/fleet-management/),
- [Navifleet](https://www.navifleet.pl/funkcje),
- [Cartrack EcoDriving](https://cartrack.pl/cartrack-program-ecodriving),
- [Cartrack Video](https://gps.cartrack.pl/inteligentne-kamery-do-monitorowania-pojazdow-cartrack).

## Systemy wymienione we wcześniejszym researchu Claude

Zapisany raport Claude `document_ai/TAXORDER_OPEN_SOURCE_ASSESSMENT.md` wymieniał również poniższe produkty. Tylko część z nich jest bezpośrednią konkurencją flotową.

| System | Typ porównania | Najważniejsza przewaga nad TaxOrder | Wniosek |
|---|---|---|---|
| SOFTRA FLOTA Commandor c/s 8.8.3 | bezpośredni polski konkurent flotowy | wspólny model kontrahentów/umów, finanse i rejestry księgowe, telefony, magazyn wydań oraz głębsza wypożyczalnia z zamówieniem, wydaniem/zdaniem i kaucją | wykorzystać legalny eksport i szablony importu jako checklistę migracyjną; nie kopiować binarnej aplikacji |
| Fleetbase / FleetOps | bezpośredni konkurent TMS/dispatch, szczególnie last mile | Orchestrator przydzielający pojazdy i kierowców według pojemności, lokalizacji, umiejętności i okien czasowych; konfigurowalne workflow; Navigator z offline navigation, live ETA i proof of delivery | najważniejszy benchmark dla dyspozytorni i aplikacji kierowcy; licencja AGPL wymaga osobnej decyzji |
| ERPNext | system ERP, nie bezpośredni konkurent flotowy | pełne zakupy, magazyn, księgowość, płatności, środki trwałe i procesy finansowe | użyć jako piaskownicy wzorca konektora; nie przenosić pełnego ERP do TaxOrder |
| SoftCRM | CRM referencyjny | wspólny model firmy, kontaktów, umów i zadań | inspiracja dla ujednolicenia kontrahentów; nie fundament produktu |
| YetiForce CRM | CRM referencyjny | rozbudowane procesy CRM, workflow, uprawnienia i raportowanie | tylko benchmark konfigurowalności i CRM |
| Yudao Cloud | wielki ERP/CRM/WMS/MES | szerokość workflow, generatorów i platformy low-code | nie wdrażać; koszt lokalizacji i utrzymania jest nieproporcjonalny |
| qcadoo | MES/APS/WMS | planowanie produkcji, traceability, OEE | poza zakresem, chyba że TaxOrder wejdzie w produkcję lub warsztat przemysłowy |
| B2BForce | framework proceduralny/agentowy | wzorce procedur, handoffów i dokumentacji pracy agentów | dotyczy współpracy AI, nie funkcji flotowych |

### Dodatkowe luki ujawnione przez SOFTRA

Analiza instalacji SOFTRA była ograniczona do binarnego klienta i szablonów importu, ale potwierdziła kilka domen płytszych lub nieobecnych w TaxOrder:

- telefony i SIM jako majątek wraz z kosztami;
- wspólne kartoteki klientów, dostawców, umów i kontraktów;
- rejestry księgowe oraz głębsze rozliczenia MPK;
- magazyn wydań wyposażenia, nie tylko stan magazynowy;
- pełniejszy rental: zamówienie, rezerwacja, wydanie, zdanie, kaucja i rozliczenie;
- nieobecności powiązane z pracownikiem i regułami kosztowymi/tankowaniami.

### Dodatkowe luki ujawnione przez Fleetbase/FleetOps

Fleetbase jest mocniejszym punktem odniesienia niż PasCom dla operacji czasu rzeczywistego. Oficjalna dokumentacja opisuje:

- automatyczny, wieloetapowy przydział pojazdu, trasy i kierowcy;
- ograniczenia pojemności, objętości, umiejętności, zmian i okien czasowych;
- podgląd planu przed zatwierdzeniem i możliwość ręcznej korekty;
- konfigurowalne typy zleceń, pola, statusy, walidacje i automatyzacje;
- mobilną aplikację Navigator z przyjęciem/odrzuceniem pracy, nawigacją offline, wieloma przystankami, ETA i proof of delivery;
- publiczne śledzenie przesyłki/zlecenia dla klienta;
- automatyczne SLA i zarządzanie wyjątkami.

TaxOrder ma zlecenia transportowe, mapę, kierowców, harmonogramy, PWA, podpisy i optymalizację tras, ale funkcje są rozdzielone. Największą luką jest brak jednego spójnego procesu: `zlecenie → automatyczny plan → przydział → dispatch do kierowcy → nawigacja → POD → rozliczenie`, obsługiwanego w czasie rzeczywistym.

Źródła: [FleetOps — przegląd](https://fleetbase.io/docs/fleet-ops), [Orchestrator](https://www.fleetbase.io/docs/fleet-ops/operations/orchestrator/overview), [Navigator](https://fleetbase.io/platform/navigator).

## Macierz: PasCom vs TaxOrder Pro

| Obszar PasCom | TaxOrder Pro | Ocena różnicy | Co rzeczywiście brakuje |
|---|---|---|---|
| Zasoby, pojazdy, wyposażenie | rozbudowana karta pojazdu, wyposażenie, inwentaryzacja, QR, historia | porównywalne | brak istotnej luki kategorii |
| Karty paliwowe, serwisowe i płatnicze | karty flotowe i importy paliwowe | częściowe | bardziej ogólna kartoteka typów kart, historia przydziałów i ograniczeń dla każdego typu |
| Serwis i zlecenia | serwis, zlecenia, harmonogramy, części, umowy serwisowe | szerokie, ale płytszy workflow | formalna autoryzacja kosztorysu przed naprawą i automatyczny dokument kosztowy po akceptacji |
| Polisy | polisy, terminy, składki, sumy, udział własny | blisko | harmonogram płatności składek i miesięczne rozksięgowanie na MPK |
| Szkody i odszkodowania | szkody + prosty `insurance_claims` | wyraźna luka | pełna likwidacja szkody, uczestnicy/policja/załączniki, odszkodowania, bilans i historia etapów |
| Rozliczenia okresowe | TCO, budżety, koszty | częściowe | reguły rozliczania kosztu w czasie i między jednostkami organizacyjnymi |
| Ogumienie | magazyn i obsługa opon | porównywalne administracyjnie | brak telematycznego TPMS; to luka sprzętowa, nie kartotekowa |
| Limity pracowników i pojazdów | `fleet_limits`, polityki, budżety | częściowe | jedna elastyczna kartoteka limitów z automatycznym naliczaniem obciążeń i raportem przekroczeń |
| Dokumenty kosztowe i import faktur | dokumenty, OCR, KSeF, faktury dostawców/paliwa | szerokie | uniwersalne mapowanie księgowe i automatyczne rozksięgowanie wszystkich typów faktur |
| Import zapłat | brak potwierdzonego modułu | luka | import wyciągu/zapłat, kojarzenie z należnościami i obsługa różnic |
| Rozrachunki i eksport przelewów | windykacja i statusy faktur | luka | paczka przelewów do banku, zobowiązania, kompensaty, częściowe zapłaty i uzgodnienie sald |
| Kontrahenci CRM | klienci CFM, dostawcy, serwisy, przewoźnicy | rozproszone | wspólny rekord kontrahenta, kontakty, obrót, historia i relacje niezależne od modułu |
| Dokumenty kontrahenta, umowy, pisma | dokument manager i wyspecjalizowane umowy | częściowe | ogólny rejestr umów/korespondencji przypięty do wspólnego kontrahenta |
| Pracownicy, urlopy, absencje, szkolenia | kierowcy, HR, urlopy, badania, szkolenia, zmiany | w większości jest | elektroniczna lista obecności dla wszystkich pracowników może wymagać domknięcia poza czasem pracy kierowców |
| Harmonogramy | wiele kalendarzy i Gantt | jest | brak jednej konfigurowalnej osi zdarzeń międzydomenowych może utrudniać obsługę |
| Zestawienia użytkownika | raporty, report builder, dashboardy | częściowe | tabele przestawne, dowolne zestawienia i wykresy tworzone przez użytkownika bez whitelisty źródeł |
| Własne pola i kolumny | stałe schematy oraz konfiguracja widoczności | luka platformowa | metadane pól niestandardowych, walidacje, formularze i kolumny tworzone bez wdrożenia kodu |
| Wynajem i rezerwacje | rezerwacje, rental wewnętrzny, CFM | szerokie | brak potwierdzonej pełnej obsługi komercyjnej wypożyczalni z cennikiem, kaucją i rozliczeniem klienta |
| Reklamacje i niezgodności | brak odrębnego procesu | luka | rejestr reklamacji/NCR, przyczyna, działania korygujące, SLA i zamknięcie |
| Rozliczenia kierowców, delegacje i zaliczki | wynagrodzenia, delegacje, kilometrówki | w dużej mierze jest | sprawdzić zaliczki, rozliczenie wielowalutowe i integrację z płacami |
| Środki trwałe | moduł aktywów i amortyzacji | jest | brak istotnej luki kategorii |
| Komunikator | messenger i powiadomienia | jest | brak istotnej luki kategorii |
| Parkingi | moduł parkingów | jest | brak istotnej luki kategorii |
| Telefony | tylko numery kontaktowe | luka | telefony/SIM jako zasoby, abonamenty, faktury, przydziały i limity kosztów |
| GPS | integracje, mapa, pozycje, geofencing | jest | jakość zależy od dostawców; brak pełnej korelacji pojedynczego tankowania z miejscem/czasem GPS |
| Aplikacja mobilna | PWA kierowcy i formularze | częściowe | potwierdzić tryb offline, dystrybucję zadań, powiadomienia i codzienną pracę terenową E2E |
| Fakturowanie, KSeF, JPK | obecne | szerokie | integracje produkcyjne i księgowanie wymagają testów, ale nie są białą plamą UI |
| Windykacja | obecna | jest | brak istotnej luki kategorii |
| E-mail i SMS | silnik powiadomień i kolejki | jest | brak istotnej luki kategorii |
| Import cykliczny | scheduler paliwa i wybrane integracje | częściowe | ogólny scheduler importu dla dowolnego źródła, mapowania i raportu błędów |
| Firmy zależne/oddziały | multi-company, dostęp, oddziały | jest strukturalnie | dynamicznie sprawdzić konsolidację raportów i operacje międzyfirmowe |
| Tłumaczenia | 7 języków | przewaga TaxOrder | PasCom deklaruje 5 języków; TaxOrder ma PL/EN/DE/UK/LV/LT/ET |

## Najważniejsza przewaga PasCom: kontrola paliwa

PasCom deklaruje wykrywanie:

- tankowania niewłaściwego paliwa;
- ilości ponad pojemność zbiornika;
- rozbieżności między kartą paliwową a GPS;
- tankowań w weekendy i podczas nieobecności;
- ponadnormatywnego spalania.

TaxOrder ma już trzy elementy:

- alert dużego tankowania i dwóch tankowań jednego dnia w `alert-dashboard.js`;
- analizę łącznego paliwa względem dystansu GPS w `gps-integrations.js`;
- pojemności baków w karcie pojazdu.

To oznacza, że luka jest mniejsza niż wcześniej zakładano, ale nadal istotna. Brakuje spójnego backendowego silnika reguł na poziomie pojedynczej transakcji, trwałych alertów, wyjaśnienia wyniku i procesu oznaczenia `potwierdzone / fałszywy alarm / do wyjaśnienia`. Szczególnie brakuje korelacji czasu i miejsca pojedynczego tankowania z najbliższą pozycją GPS, reguły rodzaju paliwa oraz połączenia z urlopem/absencją kierowcy.

Źródła: [funkcje PasCom Flota II](https://www.pascom.com.pl/oferta/pascom-flota-ii/), [integracja GPS PasCom](https://www.pascom.com.pl/oferta/modul-integracja-gps/), [integracje IT PasCom](https://www.pascom.com.pl/oferta/integracje-pascom/).

## Najważniejsza przewaga PasCom: szkody i odszkodowania

PasCom opisuje proces od zgłoszenia do całkowitej likwidacji, z uczestnikami, udziałem policji, załącznikami, rozliczeniem odszkodowania, bilansem szkody i historią etapów. TaxOrder ma bogaty rejestr szkód, lecz `insurance_claims` przechowuje głównie opis, numer, kwotę roszczenia, kwotę rozliczoną, status i notatki.

To potwierdza, że FNOL/likwidacja szkody jest luką konkurencyjną, a nie tylko hipotezą. Rozszerzenie powinno wykorzystywać istniejące `damage_reports`, dokumenty i workflow zamiast tworzyć drugi niezależny rejestr.

Źródło: [PasCom — Ubezpieczenia, polisy i szkody](https://www.pascom.com.pl/oferta/pascom-flota-modul-ubezpieczenia-polisy-szkody/).

## Najważniejsza przewaga PasCom: proces serwisowy

TaxOrder obsługuje serwis, zlecenia, części, terminarze i koszty. PasCom wyraźnie deklaruje jednak pełną ścieżkę: zgłoszenie usterki → zlecenie → autoryzacja kosztorysu → realizacja → automatyczny dokument kosztowy, z obsługą warsztatów wewnętrznych i zewnętrznych.

W TaxOrder istnieje ogólny workflow zatwierdzeń, lecz audyt nie potwierdził domenowego połączenia go z kosztorysem naprawy. Najlepszą zmianą nie jest nowy moduł serwisu, tylko wpięcie autoryzacji kosztorysu i progów kwotowych do istniejących zleceń.

Źródło: [PasCom — Obsługa serwisowa i autoryzacja napraw](https://www.pascom.com.pl/oferta/pascom-flota-ii/pascom-flota-modul-obslugi-serwisowej-i-autoryzacji-napraw/).

## Luki ujawnione przez konkurentów telematycznych

| Funkcja rynkowa | Kto ją deklaruje | Stan TaxOrder | Rekomendacja |
|---|---|---|---|
| Aktywny coaching stylu jazdy i grywalizacja | Webfleet, Cartrack | tabela `driver_behavior_events` osierocona; scoring agregowany | integrować dane dostawcy, nie tworzyć sztucznych zdarzeń; dodać feedback i plan szkoleniowy |
| Kamera AI z automatycznymi zdarzeniami i dowodem wideo | Webfleet, Cartrack | rejestr `video_telematics_events` i URL klipu, bez potwierdzonego ingestu dostawcy | konektor do jednego dostawcy jako pilotaż |
| TPMS na żywo | Webfleet | kartoteka opon i checklisty, brak telemetrycznych czujników | integracja sprzętowa; nie budować własnego hardware |
| Diagnostyka OBD/OEM i DTC | Webfleet | serwis predykcyjny oparty głównie na regułach | konektor OEM/telematyczny i mapowanie kodów usterek |
| Monitoring temperatury, drzwi i agregatu chłodniczego | Webfleet | brak potwierdzonego modułu cold-chain | budować tylko dla segmentu chłodniczego, jako pakiet branżowy |
| Terminal kierowcy, profesjonalna nawigacja, zlecenia i ETA | Webfleet | PWA, zlecenia i komunikator istnieją osobno | połączyć w jeden mobilny workflow; nawigację dostarczyć przez partnera |
| Inspekcje i protokoły wykonywane mobilnie | Navifleet | inspekcje, protokoły i PWA są | najpierw test E2E UX; kategoria nie jest luką |
| ANPR | spotykane w ekosystemach parking/telematyka | brak | osobny konektor; sensowny dla parkingów, bram i automatycznej identyfikacji |
| Odzyskiwanie skradzionego pojazdu / centrum operacyjne | dostawcy telematyczni, m.in. Cartrack | brak jako usługa | partnerstwo/SLA, nie funkcja samego oprogramowania |

Źródła: [Webfleet — produkty](https://www.webfleet.com/pl_pl/webfleet/products/), [Webfleet — zarządzanie flotą](https://www.webfleet.com/pl_pl/webfleet/fleet-management/), [Webfleet — cold chain](https://www.webfleet.com/pl_pl/webfleet/solutions/cold-chain/), [Navifleet — funkcje](https://www.navifleet.pl/funkcje), [Cartrack EcoDriving](https://cartrack.pl/cartrack-program-ecodriving), [Cartrack Video](https://gps.cartrack.pl/inteligentne-kamery-do-monitorowania-pojazdow-cartrack).

## Priorytety produktu

### P0 — najpierw domknąć to, co wpływa na wiarygodność systemu

1. Zalogowany audyt ról i separacji tenantów.
2. Silnik reguł paliwowych: rodzaj paliwa, pojemność, duplikaty, weekend/absencja, pojedyncze tankowanie vs GPS.
3. Autoryzacja kosztorysu naprawy w istniejącym workflow.
4. Pełny proces szkody/odszkodowania wykorzystujący istniejące dane.

### P1 — przewaga operacyjna nad systemem „kartotekowym”

5. Trwały harmonogram leasingowy i rozliczenia okresowe.
6. Import zapłat, rozrachunki i eksport przelewów; najlepiej przez konektor ERP, nie przez budowę pełnej księgowości.
7. Wspólny model kontrahenta, umów i dokumentów.
8. Uniwersalny scheduler importów z obserwowalnością i kolejką błędów.
9. Konfigurowalne pola i kolumny oraz głębszy self-service reporting.

### P2 — funkcje segmentowe

10. Reklamacje i niezgodności.
11. Telefony/SIM i koszty telekomunikacyjne.
12. Komercyjna wypożyczalnia, jeśli TaxOrder ma obsługiwać rental, a nie tylko flotę własną/CFM.
13. Cold-chain, TPMS, AI video, OBD/OEM oraz ANPR wyłącznie jako pakiety integracyjne dla klientów, którzy ich potrzebują.

## Czego nie budować od zera

- pełnego ERP i księgowości — zbudować konektory enova365 i Comarch ERP XL/Optima;
- sprzętu GPS, TPMS, kamer lub terminala — integrować certyfikowanych dostawców;
- drugiego systemu scoringu — uruchomić `driver_behavior_events` jako źródło obecnego scoringu;
- drugiego rejestru szkód — rozszerzyć i połączyć `damage_reports` z `insurance_claims`;
- drugiego workflow — wykorzystać działające zatwierdzenia do serwisu, szkód i wydatków;
- kolejnego ogólnego komunikatora — istniejący moduł wystarcza.

## Rekomendowana kolejność wdrożenia

1. Warsztat/demonstracja PasCom z checklistą luk z tego dokumentu; potwierdzić działanie, nie tylko obecność modułów.
2. Smoke test TaxOrder po rolach i zamknięcie drobnych luk UI.
3. Pakiet „kontrola kosztów”: fraud paliwowy + autoryzacja napraw + harmonogram leasingu.
4. Pakiet „szkody”: FNOL, odszkodowanie, bilans i historia.
5. Konektor ERPNext jako wzorzec, następnie enova365 i Comarch.
6. Jeden pilotaż telematyczny: wybrać dostawcę oferującego GPS + zachowanie kierowcy + video lub diagnostykę.
7. Dopiero po danych z klientów zdecydować o telefonach, reklamacjach, cold-chain i ANPR.

## Ograniczenia

Porównanie opisuje deklarowane funkcje producentów, nie ceny, jakość UX, czas wdrożenia, SLA ani kompletność poszczególnych pakietów licencyjnych. Najbardziej wartościowym następnym krokiem wobec PasCom jest dostęp do demo i wykonanie scenariuszy: podejrzane tankowanie, autoryzacja kosztorysu, likwidacja szkody, import zapłaty, eksport przelewów, własne pole i własny raport.
