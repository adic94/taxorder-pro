# Załącznik nr 1 — Opis systemu teleinformatycznego i rozwiązań zapewniających spełnienie warunków ustawowych

do wniosku WOLUND SYNERGY sp. z o.o. o udostępnianie danych z CEP w trybie teletransmisji

> **DOKUMENT ROBOCZY.** Obie techniczne blokady, na które ten opis pierwotnie wskazywał
> (rejestr dostępu niewywoływany, brak ograniczenia zapytań do własnej floty), zostały
> naprawione 27.08.2026 (commit `e87de14`) i zweryfikowane odczytem z produkcyjnej bazy —
> patrz zaznaczenia ✅ w punktach 4 i 5.3. Pozostałe pola `[___]` we wniosku głównym
> (dane rejestrowe, osoba reprezentująca, data) nadal wymagają ręcznego uzupełnienia
> i nie są przedmiotem tego dokumentu.

---

## 1. Nazwa i przeznaczenie systemu

**TaxOrder Pro** — system teleinformatyczny do ewidencji floty pojazdów oraz obsługi
obowiązków podatkowych i sprawozdawczych z nią związanych, w szczególności do
sporządzania deklaracji na podatek od środków transportowych (DT-1 wraz z załącznikiem
DT-1/A).

Użytkownikami systemu są wyłącznie imiennie wskazani pracownicy Wnioskodawcy oraz
obsługiwanych spółek. System nie jest udostępniany publicznie i nie posiada funkcji
samodzielnej rejestracji użytkowników.

## 2. Architektura

| Warstwa | Rozwiązanie | Uwagi istotne dla bezpieczeństwa |
|---|---|---|
| Interfejs użytkownika | aplikacja jednostronicowa (SPA) | nie posiada poświadczeń do CEP |
| Warstwa aplikacyjna | usługa serwerowa REST (Cloudflare Workers) | **jedyny** komponent uprawniony do wywołania API CEP |
| Baza danych | Cloudflare D1 (SQLite) | dane rozdzielone identyfikatorem podmiotu |
| Repozytorium plików | Cloudflare R2 | dokumenty pojazdów |
| Preferencje | Cloudflare KV | dane nieosobowe |

Cały ruch odbywa się kanałem szyfrowanym TLS. Komponenty uruchomione są w infrastrukturze
o zasięgu europejskim.

## 3. Sposób odbioru danych z CEP

Zapytania do CEP kieruje **wyłącznie warstwa serwerowa**. Przeglądarka użytkownika nie ma
technicznej możliwości wywołania API CEP:

- polityka bezpieczeństwa treści aplikacji (Content Security Policy) nie zawiera domeny
  CEP w dyrektywie `connect-src`, co powoduje zablokowanie takiego żądania przez
  przeglądarkę zanim opuści ono urządzenie użytkownika;
- poświadczenia dostępowe (identyfikator i klucz) przechowywane są wyłącznie jako sekrety
  środowiska wykonawczego warstwy serwerowej, wprowadzane kanałem administracyjnym.
  **Nie występują w kodzie źródłowym, w repozytorium ani po stronie klienta** — potwierdzone
  ręcznym przeglądem repozytorium (`worker/index.js`, `wrangler.toml`); repozytorium nie ma
  dziś skonfigurowanego automatycznego skanera sekretów (brak takiego kroku w CI, brak
  GitHub Advanced Security) — do rozważenia jako uzupełnienie kontroli.

Token dostępowy przechowywany jest w pamięci podręcznej o ograniczonym czasie życia
i odnawiany automatycznie, co ogranicza liczbę operacji uwierzytelniania.

## 4. Rejestr dostępu do danych (warunek ustawowy nr 1)

System prowadzi rejestr zdarzeń `audit_logs` o następującej strukturze:

| Kolumna | Znaczenie | Odpowiada wymogowi ustawowemu |
|---|---|---|
| `user_id`, `user_email` | tożsamość użytkownika | **kto** |
| `ip` | adres sieciowy stacji roboczej | **kto** (uzupełniająco) |
| `created_at` | znacznik czasu zdarzenia | **kiedy** |
| `action` | rodzaj operacji | **w jakim celu** |
| `details` | cel i parametry zapytania | **w jakim celu / jakie dane** |
| `entity_type`, `entity_id` | przedmiot operacji (pojazd) | **jakie dane** |
| `company_id` | podmiot, na rzecz którego pobrano dane | zakres upoważnienia |

Rejestr jest udostępniany do wglądu wyłącznie uprawnionemu administratorowi, przez
odrębny punkt dostępowy, podlegający tej samej kontroli uprawnień co dane podstawowe.
Interfejs użytkownika nie udostępnia funkcji usuwania ani modyfikacji wpisów rejestru.

> ✅ **Zrobione (27.08.2026, commit `e87de14`).** Tabela rejestru i funkcja zapisu
> `logAudit()` (`worker/index.js:7428`, `worker/schema_v26.sql:49`) są wywoływane z obu
> gałęzi ścieżki obsługującej zapytania do CEP (`handleCepikPojazdy`,
> `worker/index.js:3978`) — przy odmowie dostępu do numeru spoza floty firmy
> (`action: 'cepik_pojazdy_odmowa'`) i przy każdym udanym odczycie
> (`action: 'cepik_pojazdy_odczyt'`). Zweryfikowane zapytaniem do produkcyjnej bazy D1,
> nie brakiem błędu: `SELECT COUNT(*) FROM audit_logs` = 2 wiersze, najnowszy z 24.08.2026.
>
> Warunek ustawowy nr 1 jest dziś spełniony faktycznie, nie tylko infrastrukturalnie.

## 5. Kontrola dostępu i rozdzielenie danych podmiotów (warunek ustawowy nr 2)

### 5.1 Uwierzytelnianie i role

Dostęp wyłącznie po uwierzytelnieniu. Użytkownikom przypisywane są role o zróżnicowanym
zakresie uprawnień. Uprawnienia weryfikowane są przy każdym żądaniu po stronie serwera —
interfejs użytkownika nie jest traktowany jako warstwa kontroli dostępu.

### 5.2 Rozdzielenie danych poszczególnych spółek

Każde zapytanie do danych podlega ograniczeniu identyfikatorem podmiotu, przy czym
**identyfikator pochodzi z sesji użytkownika, nigdy z parametru żądania**. Niezależnie od
tego, centralny mechanizm routingu odrzuca (kod 403) żądanie, w którym użytkownik
wskazuje podmiot inny niż przypisany do jego konta — kontrola ta wykonywana jest przed
przekazaniem żądania do jakiejkolwiek funkcji obsługującej dane.

Skuteczność rozdzielenia została zweryfikowana:

- **audytem statycznym** — przegląd 625 zapytań do bazy danych; 99,4% zawiera ograniczenie
  identyfikatorem podmiotu, pozostałe dotyczą danych nieprzypisanych do podmiotu;
- **testem czarnoskrzynkowym na środowisku produkcyjnym** — z konta nieuprzywilejowanego
  podjęto próby odczytu danych innego podmiotu na sześciu punktach dostępowych;
  wszystkie zakończyły się odmową (kod 403);
- **testem automatycznym uruchamianym przy każdej zmianie kodu** — próba dostępu
  międzypodmiotowego jest wykrywana automatycznie, zanim zmiana zostanie wdrożona.

### 5.3 Ograniczenie zakresu zapytań do CEP

Zapytania kierowane do CEP dotyczą wyłącznie pojazdów znajdujących się w ewidencji
Wnioskodawcy i przypisanych do spółek objętych upoważnieniami. System nie udostępnia
funkcji zapytania o dowolny numer rejestracyjny spoza ewidencji.

> ✅ **Zrobione (27.08.2026, commit `e87de14`).** `handleCepikPojazdy` porównuje numer
> rejestracyjny z zapytania z ewidencją podmiotu użytkownika (porównanie znormalizowane —
> bez spacji, myślników, wielkości liter) i odmawia dostępu kodem 403 dla numeru spoza
> floty firmy, zanim zapytanie trafi do CEP.

## 6. Zabezpieczenia pozostałe

| Obszar | Rozwiązanie |
|---|---|
| Poufność w transmisji | TLS na wszystkich połączeniach |
| Poufność poświadczeń | sekrety środowiska wykonawczego; brak sekretów w repozytorium potwierdzony ręcznym przeglądem |
| Integralność danych | ograniczenia i klucze w schemacie bazy; migracje wersjonowane, z plikami wycofania |
| Dostępność | infrastruktura rozproszona; automatyczny monitoring dostępności |
| Autentyczność | uwierzytelnianie tokenem sesji; operacje zapisu wyłącznie dla ról uprawnionych |
| Odporność na wstrzyknięcie kodu | zapytania parametryzowane; automatyczna kontrola kodowania danych wyjściowych |
| Kontrola zmian | każda zmiana kodu przechodzi zestaw testów automatycznych przed wdrożeniem |

## 7. Retencja i usuwanie danych

Dane pobrane z CEP przechowywane są przez okres niezbędny do wykonania obowiązków
podatkowych i sprawozdawczych oraz przez okres przedawnienia zobowiązań podatkowych.
Wpisy rejestru dostępu przechowywane są przez okres [___ — uzupełnić zgodnie z polityką
bezpieczeństwa].

## 8. Osoby odpowiedzialne

| Rola | Osoba | Kontakt |
|---|---|---|
| Administrator systemu | [___] | [___] |
| Osoba odpowiedzialna za ochronę danych | [___] | [___] |
| Osoba do kontaktu w sprawie wniosku | [___] | [___] |
