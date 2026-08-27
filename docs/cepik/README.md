# Dostęp do CEPiK dla TaxOrder Pro — co, gdzie i w jakiej kolejności

Stan na 2026-08-20. Dokumenty w tym katalogu:

| Plik | Rola |
|---|---|
| `wniosek-teletransmisja-CEP.md` | pismo główne — wniosek o zgodę na teletransmisję |
| `zalacznik-1-opis-systemu.md` | Załącznik nr 1 — opis systemu i zabezpieczeń |
| `README.md` | ten plik — procedura, adresy, załączniki, opłaty |

---

## 0. Zanim wyślesz cokolwiek — dwa kroki, które nic nie kosztują

Wniosek o teletransmisję to procedura na miesiące, zakończona audytem. Dwa kroki poniżej
mogą ją **zawęzić albo uczynić zbędną**, a zajmują godziny.

### 0.1 Uruchom sondę otwartych danych

```powershell
node tools/cepik-probe.js
```

`api.cepik.gov.pl/pojazdy` to API **otwartych danych** — bez tokenu i bez wniosku.
Sonda odpowiada na pytanie, którego nie rozstrzygnięto w commicie #40: **czy otwarte dane
w ogóle zawierają liczbę osi i rodzaj zawieszenia.** Jeżeli zawierają, znaczna część
potrzeb DT-1 jest zaspokojona bez żadnej procedury administracyjnej i wniosek można
zawęzić do danych, których tam nie ma.

> Nie uruchamiaj tego z tego kontenera ani z konsoli przeglądarki — proxy kontenera
> blokuje `api.cepik.gov.pl`, a CSP aplikacji blokuje wywołanie z przeglądarki.
> Uruchom z maszyny lokalnej.

### 0.2 Napraw rejestr dostępu — ✅ zrobione (27.08.2026, commit `e87de14`)

Ten punkt opisywał realną blokadę w dniu powstania dokumentu (20.08): `logAudit()` była
zaimplementowana, ale nie wywoływana z żadnego miejsca, więc `audit_logs` było puste —
dokładnie **warunek ustawowy nr 1** dla teletransmisji byłby zadeklarowany niezgodnie
ze stanem faktycznym.

Naprawione: `handleCepikPojazdy` (`worker/index.js:3978`) wywołuje `logAudit()` przy
odmowie dostępu do numeru spoza floty firmy i przy każdym udanym odczycie z CEP. Ten sam
commit ograniczył zapytania do pojazdów z własnej ewidencji — numer rejestracyjny spoza
floty wywołującej firmy dostaje 403, zanim zapytanie trafi do CEP. Zweryfikowane
zapytaniem do produkcyjnej bazy: `audit_logs` ma wpisy, nie jest puste.

---

## 1. Cztery ścieżki dostępu — którą wybrać

| Ścieżka | Co daje | Koszt | Czas | Wniosek |
|---|---|---|---|---|
| **A. Otwarte dane** `api.cepik.gov.pl` | dane techniczne, bez danych osobowych | 0 zł | natychmiast | brak |
| **B. CEPiK 2.0 B2B** `api2.cepik.gov.pl` | usługi sieciowe, m.in. weryfikacja kierowcy | wg regulaminu | tygodnie | rejestracja mailowa |
| **C. Teletransmisja (CEP)** | ciągły dostęp do danych pojazdów | 0 zł za dane | miesiące + audyt | **decyzja ministra** |
| **D. Dane jednostkowe** | jednorazowa informacja o pojeździe | **30,40 zł** za informację | dni–tygodnie | wniosek na wzorze |

**Rekomendacja:** A → (jeśli nie wystarcza) C. Ścieżka D przy 217 pojazdach to koszt
i brak bieżącej aktualizacji — nadaje się wyłącznie do jednorazowej weryfikacji
pojedynczych spornych pojazdów. Ścieżka B dotyczy głównie danych kierowców, nie pojazdów.

---

## 2. Ścieżka C — teletransmisja, krok po kroku

### Krok 1. Uzupełnij pismo i załączniki

W `wniosek-teletransmisja-CEP.md` uzupełnij wszystkie pola `[___]`:
REGON, adres e-Doręczeń, dane osoby reprezentującej, osoba do kontaktu, publikator
tekstu jednolitego ustawy, data.

> **Sprawdź jednostkę redakcyjną przed podpisaniem.** Numeracja przepisów o udostępnianiu
> danych z CEP (art. 80c–80ce Prawa o ruchu drogowym) była kilkukrotnie zmieniana.
> Pismo powołuje art. 80cd i **przytacza treść wszystkich trzech warunków ustawowych
> w punkcie IV**, więc merytorycznie jest odporne na przesunięcie numeracji — ale samą
> jednostkę zweryfikuj w aktualnym tekście jednolitym (ISAP) przed podpisem.

### Krok 2. Skompletuj załączniki

| Nr | Załącznik | Skąd |
|---|---|---|
| 1 | Opis systemu teleinformatycznego | `zalacznik-1-opis-systemu.md` — gotowy, obie techniczne blokady naprawione i opisane jako zrobione |
| 2 | Polityka bezpieczeństwa informacji + wykaz urządzeń | **do napisania** — wymagana wprost przez procedurę |
| 3 | Odpis aktualny KRS Wolund Synergy | ekrs.ms.gov.pl, bezpłatnie |
| 4–7 | Pełnomocnictwa spółek + ich odpisy KRS | mToilet, G-CON, KJR Supply, NWK Invest |
| 8 | Umowy powierzenia przetwarzania (art. 28 RODO) | ze spółkami z zał. 4–7 |
| 9 | Wykaz pojazdów objętych wnioskiem | eksport z systemu — **poza repozytorium** |
| 10 | Opłata skarbowa od pełnomocnictwa (17 zł za każde) | jeśli dotyczy |

**Kopie dokumentów urzędowych muszą być poświadczone za zgodność z oryginałem** przez
notariusza albo przez występującego w sprawie adwokata, radcę prawnego, rzecznika
patentowego lub doradcę podatkowego.

Załącznik nr 2 (polityka bezpieczeństwa) jest tym, na czym wnioski najczęściej się
zatrzymują — procedura wymaga, by wniosek „jednoznacznie opisywał spełnienie wszystkich
wymogów bezpieczeństwa i zawierał szczegółową specyfikację przygotowanego rozwiązania
oraz politykę bezpieczeństwa wskazującą urządzenia, które będą wykorzystywane".

### Krok 3. Wyślij

**Adresat główny — sprawy udostępniania danych z CEP prowadzi COI (od 1.10.2021):**

```
Centralny Ośrodek Informatyki
al. Wojciecha Korfantego 2
40-004 Katowice
tel. 32 750 65 23
```

**Organ wydający decyzję — Minister Cyfryzacji:**

```
Ministerstwo Cyfryzacji
ul. Królewska 27
00-060 Warszawa
```

**Forma:** papierowo albo elektronicznie — pismo podpisane kwalifikowanym podpisem
elektronicznym, **podpisem zaufanym** albo podpisem osobistym (e-dowód). Zwykły e-mail
nie spełnia wymogu formy dla wniosku.

#### Kanał elektroniczny — e-Doręczenia, nie ePUAP

**Od 1 stycznia 2026 r. e-Doręczenia zastąpiły ePUAP** jako kanał korespondencji
z administracją. Korespondencja przez ePUAP jest od tej daty skuteczna wyłącznie
w sprawach wskazanych w przepisach szczególnych (m.in. dostęp do informacji publicznej,
petycje) — **wniosek CEPiK się do nich nie zalicza**. Nie wysyłaj tego pisma przez ePUAP.

Ścieżka elektroniczna wygląda tak:

1. **Adres do e-Doręczeń (ADE) spółki** — Wolund Synergy jako spółka z KRS ma ustawowy
   obowiązek posiadania aktywnego ADE (podmioty wpisane do KRS przed 1.01.2025 —
   od 1 kwietnia 2025 r.; zarejestrowane później — adres tworzony przy rejestracji).
   Jeśli spółka go nie ma, wniosek o adres składa się przez Biznes.gov.pl u dostawcy
   publicznego albo u kwalifikowanego dostawcy komercyjnego.
2. **Administrator skrzynki** — podmioty z KRS **muszą wyznaczyć administratora skrzynki**
   (inaczej niż jednoosobowe działalności z CEIDG, które zarządzają nią same). Bez tego
   nikt nie wyśle pisma z adresu spółki.
3. **Logowanie i wysyłka** — do skrzynki logujesz się Profilem Zaufanym albo e-dowodem,
   dołączasz pismo i załączniki, podpisujesz i wysyłasz. Wiadomość z ADE ma skutek prawny
   listu poleconego za potwierdzeniem odbioru.

**Profil Zaufany to podpis i sposób logowania, nie kanał wysyłki.** Podpisem zaufanym
podpisuje **osoba fizyczna** — więc pismo podpisuje członek zarządu albo pełnomocnik,
a jego umocowanie organ ustala z KRS lub z załączonego pełnomocnictwa. Nie mylić
z kwalifikowaną pieczęcią elektroniczną, która należy do spółki, ale nie zastępuje
podpisu osoby przy wniosku wymagającym podpisu wnioskodawcy.

#### Czego prawdopodobnie nie musisz załączać

Zgodnie z art. 220 KPA organ nie może żądać zaświadczenia ani dokumentu na potwierdzenie
faktów możliwych do ustalenia na podstawie **rejestrów publicznych dostępnych dla organu**.
KRS jest takim rejestrem. W praktyce zamiast odpisów KRS (zał. 3–7) często wystarczy podać
numery KRS i powołać się na ten przepis — pozwala to uniknąć kompletowania pięciu odpisów
i ich poświadczania. Pełnomocnictw to **nie** dotyczy: te trzeba złożyć, a w formie
elektronicznej muszą być podpisane elektronicznie przez mocodawcę.

**Adresy pomocnicze (do pytań, nie do złożenia wniosku):**

| Sprawa | Kontakt |
|---|---|
| ochrona danych osobowych w CEPiK | `iod@mc.gov.pl` |
| rejestracja do API CEPiK 2.0 (ścieżka B) | `biurocepik2.0@cyfra.gov.pl` |
| certyfikaty do CEPiK 2.0 | `cc.coi@coi.gov.pl`, tel. 42 253 54 71 |
| Centrum Certyfikacji COI (korespondencja) | ul. Gdańska 47/49, 90-729 Łódź |
| COI — sprawy ogólne | `coi@coi.gov.pl`, tel. 22 250 28 83 |

> `biurocepik2.0@cyfra.gov.pl` nie jest adresem znalezionym na potrzeby tego pisma —
> jest już w kodzie projektu, w komentarzu przy obsłudze CEPiK 2.0 B2B
> (`worker/index.js:4065`).

### Krok 4. Audyt i decyzja

Wydanie decyzji poprzedza audyt potwierdzający wykazaną specyfikację systemu. Pozytywna
opinia z audytu jest podstawowym warunkiem zgody. Dopiero po decyzji następuje część
techniczna: certyfikaty (Centrum Certyfikacji COI, Łódź) i konfiguracja sekretów
`CEPIK_KEY` / `CEPIK_SECRET` na Workerze.

---

## 3. Ścieżka D — dane jednostkowe (gdy potrzebny jeden pojazd)

- **To jedyna ścieżka z prawdziwą e-usługą online.** Wniosek składa się przez formularz
  na gov.pl, podpisując go Profilem Zaufanym, podpisem kwalifikowanym albo podpisem
  osobistym z e-dowodu — bez pisma, bez poczty. Dla teletransmisji (ścieżka C) takiej
  usługi nie ma; tam jest zwykłe pismo wysyłane przez e-Doręczenia albo pocztą.
- Wzór wniosku: rozporządzenie Ministra Cyfryzacji z 31 października 2017 r. w sprawie
  wzoru wniosku o udostępnienie albo przekazanie danych z centralnej ewidencji pojazdów
  (Dz. U. z 2017 r. poz. 2068), obowiązuje od 13 listopada 2017 r.
- **Opłata: 30,40 zł** za udostępnienie danych/informacji.
- Dane **o własnym pojeździe** właściciel lub posiadacz otrzymuje **nieodpłatnie**
  i bez konieczności uzasadniania interesu prawnego. Przy 217 pojazdach należących do
  czterech spółek to realna ścieżka dla pojedynczych pilnych przypadków — wniosek składa
  wtedy **spółka będąca właścicielem**, nie Wolund Synergy.
- Rachunek do opłaty:

```
Ministerstwo Cyfryzacji, ul. Królewska 27, 00-060 Warszawa
BGK Oddział Warszawa
52 1130 1017 0020 1232 2420 0001
tytuł: "CEPiK – opłata za udostępnienie danych"
```

W tytule/dowodzie wpłaty wskaż, której sprawy dotyczy.

---

## 4. Kwestia, którą trzeba rozstrzygnąć przed wysyłką

**Wolund Synergy nie jest właścicielem żadnego pojazdu w systemie.** Sprawdzone
zapytaniem do produkcyjnej bazy D1: wszystkie 217 pojazdów należy do mToilet (193),
G-CON (21), KJR Supply (2) i NWK Invest (1).

To ma konsekwencje prawne. Najmocniejsza podstawa — „dane o własnym pojeździe, nieodpłatnie,
bez wykazywania interesu" — **nie przysługuje Wolund Synergy**, tylko tym czterem spółkom.
Wolund Synergy musi wykazywać interes prawny jako podmiot trzeci, a sam fakt bycia
dostawcą oprogramowania interesem prawnym nie jest.

Pismo w tym katalogu rozwiązuje to konstrukcją: **Wolund Synergy występuje na podstawie
pełnomocnictw czterech spółek** (załączniki 4–7) i umów powierzenia przetwarzania
(załącznik 8), jako operator systemu i podmiot przetwarzający. Bez tych pełnomocnictw
wniosek jest słaby i prawdopodobnie zostanie odmówiony.

**Wariant alternatywny, wart rozważenia:** wniosek składa **każda spółka osobno**, jako
właściciel pojazdów, wskazując Wolund Synergy jako operatora systemu teleinformatycznego,
przez który dane są odbierane. Jest to cztery razy więcej papierologii, ale podstawa
prawna jest wtedy najmocniejsza z możliwych. Decyzja należy do zarządu — jeśli padnie na
ten wariant, treść pisma zmienia się w pkt I, III.1 i VI, reszta zostaje.

---

## 5. Źródła

- [Tryb teletransmisji — gov.pl/web/cepik](https://www.gov.pl/web/cepik/tryb-teletransmisji)
- [Udostępnianie danych z CEPiK — informacje ogólne, BIP COI](https://coi.ssdip.bip.gov.pl/rejestry-ewidencje-archiwa/udostepnianie-danych-z-cepik-informacje-ogolne.html)
- [Wniosek o udostępnienie danych z SI CEPiK — BIP COI](https://coi.ssdip.bip.gov.pl/rejestry-ewidencje-archiwa/wniosek-o-udostepnienie-danych-z-si-cepik.html)
- [Zmiana danych adresowych — udostępnianie zbiorów danych z CEPiK](https://www.gov.pl/web/cepik/zmiana-danych-adresowych-i-kontaktowych-w-sprawie-udostepniania-zbiorow-danych-z-cepik)
- [Dostęp pocztą — gov.pl/web/cepik](https://www.gov.pl/web/cepik/poczta2)
- [Rozporządzenie MC z 31.10.2017, Dz.U. 2017 poz. 2068 — ISAP](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20170002068)
- [Art. 80cd Prawa o ruchu drogowym](https://lexlege.pl/prawo-o-ruchu-drogowym/art-80cd/)
- [Dostęp przez internet — gov.pl/web/cepik](https://www.gov.pl/web/cepik/dostep-przez-internet)
- [Zmiany w komunikacji elektronicznej od 1 stycznia 2026 r. — e-Doręczenia](https://www.gov.pl/web/e-doreczenia/zmiany-w-komunikacji-elektronicznej-od-1-stycznia-2026-roku)
- [e-Doręczenia dla przedsiębiorców — Biznes.gov.pl](https://www.biznes.gov.pl/pl/portal/004495)

> Adresy i kwoty zebrano przez wyszukiwarkę — proxy tego środowiska blokuje bezpośredni
> dostęp do `gov.pl`, `eli.gov.pl` i `lexlege.pl`, więc **nie udało się ich potwierdzić
> odczytem strony źródłowej**. Przed wysyłką potwierdź telefonicznie w COI Katowice
> (32 750 65 23) aktualny adres, formę złożenia i komplet załączników.
