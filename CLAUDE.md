# TaxOrder Pro — CLAUDE.md
# Reguły projektu dla asystenta AI. Mają pierwszeństwo przed domyślnym zachowaniem.

## Architektura systemu

**Stack:** Cloudflare Pages (SPA) + Worker (backend REST) + D1 (SQLite) + R2 (pliki) + KV (prefs)
**Supabase:** wycofany. Katalog `supabase/` to relikt — nie dodawaj tam nic nowego.
**Worker URL produkcja:** `https://taxorder-pro-api.adamus1000.workers.dev`
**GitHub:** `https://github.com/adic94/taxorder-pro`
**Język UI:** polski | **Język kodu (zmienne, funkcje):** angielski

### Kluczowe pliki
| Plik | Rola |
|------|------|
| `worker/index.js` | Cały backend Worker (~11 500 linii) |
| `app.js` | Główna logika SPA (~9700 linii, 587 KB) |
| `index.html` | Markup + definicja globalnego `esc()` (~5200 linii, 365 KB) |
| `modules/vehicle-detail.js` | Karta pojazdu (~3700 linii) |
| `modules/tax-engine.js` | Silnik podatku DT-1 (stawki, kategorie) |
| `modules/cf-cloud.js` | Klient Cloudflare D1 API |
| `modules/i18n.js` | Tłumaczenia PL/EN/DE/UK/LV/LT/ET (7 języków) |
| `modules/gminy-rates.js` | Stawki podatkowe per gmina |
| `sw.js` | Service Worker (PWA, cache) |

### Mapa katalogów
```
taxorder-pro/
├── app.js                     # SPA main (~9 700 ln)
├── index.html                 # markup + esc() (~5 200 ln)
├── worker/
│   ├── index.js               # Worker backend (~11 500 ln)
│   └── schema_v*.sql          # migracje DB (aktualny: v49)
├── modules/
│   ├── vehicle-detail.js      # karta pojazdu (~3 700 ln)
│   ├── tax-engine.js          # DT-1 silnik
│   ├── cf-cloud.js            # klient D1 API
│   ├── i18n.js                # tłumaczenia 7 języków
│   └── gminy-rates.js         # stawki per gmina
├── tests/e2e/                 # Playwright E2E
│   ├── global-setup.js        # auth (TEST_TOKEN / TEST_EMAIL)
│   └── .auth-state.json       # stan sesji (gitignore)
├── tools/                     # skrypty dev — nie wchodzą na prod
├── .claude/commands/          # slash commands Claude Code
└── docs/                      # runbooki, rollback
```

---

## STAN PROJEKTU — skrót (pełna historia: `docs/claude/HANDOFF-HISTORIA.md`)

> Ten plik jest wczytywany przy KAŻDEJ wiadomości — trzymaj go poniżej ~25 KB.
> Szczegóły, logi sesji, tabele pomiarów i zamknięte tematy idą do `docs/claude/`,
> tutaj tylko jednolinijkowe wskaźniki. Przed pracą nad tematem: `grep -n "<temat>" docs/claude/*.md`.

**Ostatni pełny wpis HANDOFF:** 2026-08-24. Ostrzeżenia, które nadal obowiązują (szczegóły w historii):
- ⛔ CEPiK open-data: wyszukiwanie po `numer-rejestracyjny` zwraca złe pojazdy — nie budować na tym.
- ⛔ KSeF: integracja celuje w API, którego już nie ma — świadomie nienaprawione.
- ⛔ Aztec: dekodowanie niestabilne na prawdziwych dokumentach — nie odtwarzać śledztwa od zera.
- ⚠️ Licencjonowanie modułów (`company_packages`) WYŁĄCZONE — włączanie to wdrożenie funkcji, nie bugfix.
- ⚠️ Dryf migracji D1: stan sprawdzaj zapytaniem do `sqlite_master`, nie po braku błędu.
- 🧾 Eksport JPK nigdy nie działał (słownik tabeli ≠ handler).

Nagłówki w historii (do grepowania):
- Skrót tego, co zamknięto 12–13.08
- CF Workers AI — licencja ZAAKCEPTOWANA, blokadą jest teraz dzienny limit (19.08)
- Kandydat na warstwę CF: `llama-4-scout` — ustalenia z 19.08 (NIE podmieniaj identyfikatora)
- Zamknięte
- 💰 DT-1: mamy KWOTĘ — 292 056 zł za 2026, ale nie cała jest gotowa do wysyłki (25.08 noc)
- ✅ Stawki DT-1: CAŁA tabela zweryfikowana u źródła — 45/45 (26.08)
- 🗃️ Sześć martwych tabel — migracja ZASTOSOWANA NA PRODUKCJI (27.08)
- ✅ Migracje v51–v53 zastosowane — i to odsłoniło wadę w nocnej bramce (27.08)
- ⛔ Zastosowanie migracji zapaliłoby nocną bramkę na 8 fałszywych alarmach
- 🚛 Trzy pojazdy wypadają z podstawy opodatkowania — nowa kontrola (27.08)
- 🧾 Eksport JPK nigdy nie zadziałał — tabela mówi innym słownikiem niż handler (27.08)
- 🔐 `company_packages` — konflikt v33/v48 domknięty, licencjonowanie NADAL wyłączone (27.08)
- 💰 DT-1 w bazie kontra silnik: 216/217 zgodnych, jeden pojazd nie płaci (27.08)
- 🔎 Zapytania z nazwą tabeli w zmiennej — 12 przejrzanych ręcznie, 11 czystych (27.08)
- ⚖️ Widełki ustawowe stawek DT-1 — struktura gotowa, kwoty do odczytu (27.08)
- 🔧 D1 jako PIĄTE źródło scalania — dwa pola, świadomie (26.08)
- ⚖️ Sztywna ciężarówka nie przekracza 32 t — 4 pojazdy po 40 t (26.08)
- 📅 „SPRZEDANY" w nazwie folderu ≠ nieposiadany w danym roku (26.08)
- 🧰 Dwa nowe narzędzia (26.08)
- ⛔ SPROSTOWANIE: „6 pojazdów płaci dwa razy" było MOIM BŁĘDEM, nie faktem (26.08)
- ✅ Walidacja wyliczenia DT-1 o produkcyjne D1 (26.08)
- 🔁 Duplikaty po VIN w arkuszu MASTER — 26 pojazdów, 53 wiersze (26.08)
- 🧹 Dwa wycieki naszej własnej infrastruktury do danych pojazdów (25.08 noc)
- 🔁 `tools/dr-reocr-podejrzane.js` — ponowny OCR sprzecznych wierszy (25.08 noc)
- 🗂️ Arkusz MASTER: cztery źródła, EURO z 1/54 do 568/945 (25.08 noc)
- 🔴 Parser DR: odwrócony układ strony dawał CICHĄ KORUPCJĘ, nie puste pola (25.08)
- ⛔ KSeF: cała integracja celuje w API, którego JUŻ NIE MA (25.08) — NIE naprawiona, świadomie
- W toku
- Aztec — ustalenia z 12.08.2026 (NIE odtwarzaj tego śledztwa od zera)
- Otwarte / znane długi
- Środowisko testowe — fakty z D1 (2026-08-05)
- Pułapki API MyCar (na wypadek integracji)

## BEZPIECZEŃSTWO — OBOWIĄZKOWE REGUŁY

### XSS — każde pole użytkownika w innerHTML musi mieć esc()
```javascript
// ŹLE — podatne na XSS
el.innerHTML = `<td>${user.name}</td>`;

// DOBRZE
el.innerHTML = `<td>${esc(user.name)}</td>`;
```
- `esc()` zdefiniowane globalnie w `index.html` — dostępne wszędzie w SPA
- Dotyczy każdego pola z DB, które użytkownik mógł wpisać (nazwy, opisy, numery, adresy)
- **Wyjątek:** wartości obliczone przez nasz kod (formatowanie liczb, dat) są bezpieczne

### onclick z danymi użytkownika — ZAWSZE data-attributes
```javascript
// ŹLE — XSS jeśli d.name zawiera HTML
onclick="remove('${d.name.replace(/'/g,"\\'")}')";

// DOBRZE — data-* + dataset.*
data-name="${esc(d.name)}" onclick="remove(this.dataset.name)"
```

### Izolacja tenanta — każde zapytanie z company_id
```javascript
// ŹLE — IDOR: użytkownik odczyta rekord obcej spółki
db.prepare('SELECT * FROM vehicles WHERE id = ?').bind(id)

// DOBRZE — company_id z sesji, nie z requestu
db.prepare('SELECT * FROM vehicles WHERE id = ? AND company_id = ?')
  .bind(id, session.company_id)
```
- `company_id` **zawsze** z tokenu sesji, **nigdy** z parametru żądania
- Dotyczy GET pojedynczego rekordu tak samo jak list — audyt 2026-07 znalazł 4× IDOR
  właśnie na endpointach `GET /:id`, gdzie lista była filtrowana, a rekord nie
- Po każdym nowym endpointcie: test izolacji z konta bez dostępu do danej spółki

**Centralny guard w routerze (`worker/index.js:8673-8680`) — sprawdź TUTAJ najpierw.**
Zanim ocenisz pojedynczy handler jako podatny na IDOR przez `?company=`, sprawdź ten
blok w `handleRequest()` — działa PRZED dispatchem do jakiegokolwiek handlera:
```javascript
if (user && !user._apiKey && user.role !== 'admin') {
  const reqCompany = url.searchParams.get('company');
  if (reqCompany && reqCompany !== user.company_id) {
    return err('Brak dostępu do tej firmy', 403);
  }
}
```
Dzięki temu ~70 handlerów czytających `url.searchParams.get('company') || user.company_id`
bez własnego guardu (np. `handleVehicles`, `/api/export`, `/api/import`, `handleDocs`
plik z R2) **nie jest podatnych** dla sesji nie-admin — mismatch odcina router, zanim
handler w ogóle się wykona. Analiza pojedynczego handlera w oderwaniu od routera
prowadzi do fałszywego alarmu (sprawdzone 2026-08-10: subagent zgłosił to jako
"systemowy IDOR w 70 handlerach" bez uwzględnienia tego guardu — po weryfikacji
bezpośrednio w kodzie okazało się nieprawdą).

**Jedyny faktyczny wyjątek: `role === 'admin'` pomija scoping wszędzie, celowo.**
Komentarz w kodzie: *"Admin może odpytywać dowolną firmę — zarządzanie wieloma
klientami z jednego konta"*. To zamierzona architektura (jedno konto operatora
zarządza 6 spółkami klienckimi), spójna z `GET /api/companies` (admin: wszystkie
spółki) i `POST/PUT/DELETE /api/companies` (tylko admin/superadmin). Nie jest to
luka do załatania kodem — to sprowadza się do pytania **kto dostaje rolę admin**
(kwestia operacyjna, nie kod). Dokładnie ten sam, już udokumentowany dług: „Konto CI
jest adminem — regresja w gatingu uprawnień nie zostanie wykryta" (patrz Otwarte /
dług techniczny). `handleUsers` (jedyne miejsce nadające/zmieniające role i
company_id innych userów) samo wymaga `user.role==='admin'` na wejściu — brak
ścieżki samo-eskalacji uprawnień.

**Uzupełnione o test czarnoskrzynkowy 2026-08-10** (patrz HANDOFF → Zamknięte): drugie,
nie-adminowe konto (`kierownik`/`gcon`) potwierdziło na żywo — 4/4 próby cross-tenant
zablokowane 403, zero wycieku stanu w SPA przy przełączaniu firmy. Konto podłączone
do CI (`tests/api/tenant-isolation-test.js`, krok w `ci-e2e.yml`) — regresja w gatingu
uprawnień od teraz jest wykrywana automatycznie przy każdym PR.

### Fallback dla wartości numerycznych — ZAWSZE ?? nie ||
```javascript
// ŹLE — falsy-zero: gdy dmc=0, zwraca dmcMax zamiast 0
const dmc = v.dmc || v.dmcMax || 0;

// DOBRZE — null/undefined → fallback, 0 zostaje 0
const dmc = v.dmc ?? v.dmcMax ?? 0;
```
Dotyczy szczególnie: `dmc`, `dmcMax`, `dmcZespolu`, `miesiacePodatku`, `rok`

### UserPrefs.get() zmienia typ — nie porównuj do stringa
`UserPrefs.get()` przepuszcza wartość przez `JSON.parse()`: `"false"` wraca jako boolean,
`"1"` jako number. Awaria jest **cicha** — brak błędu w konsoli.
```javascript
// ŹLE — boolean false !== string 'false' → TRUE, tryb zwięzły włącza się sam
const slim = UserPrefs.get('slim_table') !== 'false';

// DOBRZE — String() normalizuje typ niezależnie od tego co zwróci JSON.parse
const slim = String(UserPrefs.get('slim_table')) !== 'false';
```
Podatne klucze (przechowują `"false"`, `"true"`, `"0"`, `"1"`):
`slim_table`, `taxDarkMode`, `onboarding_done`, `ks-hint-shown`.
Obecny kod używa wyłącznie `localStorage.getItem()` dla tych kluczy — reguła chroni przyszły kod.

### Dane produkcyjne poza repozytorium
Backupy i raporty z operacji na danych (audyty DT-1, migracje, korekty osi) zawierają
numery rejestracyjne, DMC, VIN-y i nazwy spółek.

**Miejsce docelowe: `~/Documents/taxorder-backupy/`** — NIE pulpit, NIE katalog projektu.
Pulpit jest indeksowany przez wyszukiwarkę systemową i bywa synchronizowany z OneDrive.

**Uwaga: `.gitignore` chroni tylko pliki WEWNĄTRZ drzewa repozytorium.** Pliki leżące
poza `taxorder-pro/` nie są objęte żadną regułą git — są bezpieczne wyłącznie dlatego,
że git ich nie widzi. Skopiowane do środka repozytorium nie byłyby chronione bez jawnego wpisu.

Pliki przechowywane aktualnie w `~/Documents/taxorder-backupy/`:
- `dt1-backup-przed-update-B.json`, `dt1-brakujace-B.json`, `dt1-rozbieznosci-C.json`,
  `dt1-verify-d1.json` — audyt DT-1 31.07.2026 (wartość odtworzeniowa: korekty DMC)
- `backup-vehicles-przed-migracja.json` — migracja pojazdów 31.07.2026
- `backup-axles-pre-correction-2026-08-02.json` — korekta osi 02.08.2026
- `dr-coverage-report.json` — raport pokrycia Aztec DR 31.07.2026

### Sekret API — NIGDY w kodzie
- Klucze API: `wrangler secret put NAZWA_SEKRETU` (tylko lokalnie, przez terminal)
- Poświadczenia testowe: `.env` (gitignorowany) + `dotenv` w `playwright.config.js`.
  **Nigdy** w oknie czatu, nigdy przez `$env:` w terminalu — PowerShell zapisuje historię
  do `ConsoleHost_history.txt`
- Tokeny sesji: tylko `localStorage` (nigdy git, nigdy logi)
- `tools/api-explorer/reports/` i `backups/` → `.gitignore` (mogą zawierać tokeny)

### Supabase — WYCOFANY
- Nie używać `window.supabaseClient` ani żadnego nowego wywołania Supabase
- Backend to wyłącznie D1 / R2 / KV przez Worker

### Webhooki — walidacja URL
- Przy tworzeniu/edycji webhooka: URL musi zaczynać się od `https://`
- `github_issue_url` z DB: przed użyciem jako `href` sprawdź `startsWith('https://')`

---

## WERYFIKACJA — skrót (pełna treść: `docs/claude/WERYFIKACJA.md`)

Pułapki weryfikacji (szczegóły w pliku):
- Żadne z narzędzi audytu nie widzi kodu, który aplikacja GENERUJE jako tekst
- Changelog migracji major (v3→v4) nie mówi nic o konkretnej wersji patch
- .gitignore nie działa wstecz
- git check-ignore przy regułach negacji
- Rekord w odpowiedzi nie dowodzi, że Twój filtr zadziałał
- Kod HTTP 200 nie dowodzi, że plik istnieje
- curl z wieloma URL-ami
- Reguła *.png w .gitignore wysadza deploy
- PowerShell — here-string w git commit -m
- `&&` nie działa w PowerShell 5.1 — i to błąd PARSOWANIA, nie wykonania
- PowerShell: `^` to NIE jest kontynuacja linii, a `stash@{0}` wymaga cudzysłowów
- `CLOUDFLARE_API_TOKEN` w środowisku PRZESŁANIA `wrangler login`
- npx i npm w PowerShell
- Pobranie jednego pliku z brancha bez przełączania się na niego

## FIRMY (NAJEMCY) — ŹRÓDŁO PRAWDY

Od schema_v44 firmy żyją w tabeli `companies` w D1, nie w kodzie.

- `GET /api/companies` — lista firm widocznych dla użytkownika (admin: wszystkie;
  reszta: `user_company_access` + własna `users.company_id`)
- `POST/PUT/DELETE /api/companies` — tylko rola `admin` / `superadmin`.
  DELETE = dezaktywacja (`active=0`), nigdy fizyczne kasowanie — dane pojazdów,
  dokumentów i deklaracji DT-1 muszą zostać.
- `GET/PUT /api/company-access` — nadawanie dostępów użytkownik ↔ firma

**Literał `COMPANIES` w `app.js` to seed i fallback offline**, nie źródło prawdy.
`hydrateCompaniesFromApi()` scala listę z D1 po zalogowaniu. Dodając firmę,
dopisuj ją do D1 — nie do literału.

**Kill switch** (bez deployu, z konsoli przeglądarki):
```javascript
localStorage.setItem('taxorder_companies_source','local'); location.reload();
```
Wraca do listy lokalnej. Pełny runbook wycofania: `docs/ROLLBACK_v44.md`.
Weryfikacja po deployu: `npm run verify:v44`.

## PODATEK DT-1 — ZASADY DOMENY

### Przepływ obliczeń (kolejność priorytetu)
1. `window.TaxEngine` (`modules/tax-engine.js`) — **główna ścieżka, zawsze używana**
2. `window.GminyRates` (`modules/gminy-rates.js`) — nadpisuje stawkę jeśli gmina zdefiniowana
3. `getCat()` / `getRate()` w `app.js` — **tylko fallback awaryjny**, normalnie nie uruchamiane

### Zwolnienia
- Pojazd specjalny: `typ.includes('specjaln') || przeznaczenie.includes('specjaln')` → `return null` (brak podatku)
- Guard MUSI być w `TaxEngine.getCat()` — dodanie tylko do fallbacku w app.js jest bez efektu

### DMC — jedno pole, dwa źródła
- Formularz zapisuje wartość do `v.dmcMax` (input `vd-dmcMax`)
- Mapper powinien ustawiać `dmc: data.dmc ?? data.dmcMax ?? 0`
- W `save()` karty pojazdu: zapisz ZARÓWNO `dmc` jak i `dmcMax`

---

## DEPLOYMENT — PROCEDURA

### Worker (backend)
```powershell
# Ustaw PATH z Node.js portable
$env:Path = "C:\Users\acichocki\node\node-v24.16.0-win-x64;" + $env:Path
cd "c:\Users\acichocki\Desktop\Program flotowy\taxorder-pro"
.\node_modules\.bin\wrangler.cmd deploy
```

### Migracja DB
```powershell
.\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --file=worker/schema_vN.sql
```
- Schematy: `CREATE TABLE IF NOT EXISTS` — bezpieczne do ponownego uruchomienia
- **Aktualny schemat: v49** (`user_prefs_kv`) — 49 pliki migracji
- Nowe tabele zawsze w nowym pliku `schema_vN.sql` (N = kolejny numer)
- Weryfikacja spójności: `npm run migration-check`

### Frontend (Cloudflare Pages)
- Automatyczny deploy przy `git push origin main`
- Service Worker cache: przy dodaniu nowych modułów do `index.html` → bump `CACHE_NAME` w `sw.js`

---

## KONWENCJE KODU

### Moduły
- Eksport na `window.*`: `window.TaxOrderNazwaModulu = { ... }`
- Wzorzec IIFE dla enkapsulacji: `(function() { ... })()`
- Funkcje publiczne: eksportowane przez return lub bezpośrednio na window

### i18n
- Klucz tłumaczenia: `window.t('klucz.i18n')` lub `data-i18n="klucz"`
- Nowy klucz → dodać do **wszystkich 7 języków** w `modules/i18n.js`
- Języki: `pl` (bazowy), `en`, `de`, `uk` (ukraiński), `lv` (łotewski), `lt` (litewski), `et` (estoński)
- Wzorzec: `{ pl: '...', en: '...', de: '...', uk: '...', lv: '...', lt: '...', et: '...' }`
- Języki bałtyckie wynikają z operacji na rynkach LV/LT/EE — nie usuwać

### printCard() / renderowanie HTML
- `row(lbl, val)` — używa `esc()` automatycznie, dla wartości tekstowych
- `rowH(lbl, val)` — HTML surowy (tylko dla wartości obliczonych naszym kodem, np. `fz()`, `fd()`)

---

## ZNANE PUŁAPKI (wyciągnięte z historii bugów)

1. **`hookId === 'test'` zawsze false** — trasa `POST /api/webhooks/:id/test` to `segs[3]`, nie `segs[2]`
2. **`runNightlyAnalysis` + Claude API** — jeśli Claude zwróci błąd, NIE oznaczaj `analyzed=1`; zrób `return`
3. **`_clientName()` w CFM** — może zwrócić `client_name_cache` (dane użytkownika) → owijać w `esc()`
4. **`pillLbl[status] || status`** — fallback `|| status` to surowe dane DB → `|| esc(status)`
5. **`v.rok ?? null`** — rok może być `0` (nieznany) albo `null` — nie używaj `|| null`
6. **Service Worker** — przy zmianach w `index.html` (nowe `<script>`) zawsze bump `CACHE_NAME`
7. **Nie używaj `window.supabaseClient`** — nigdy nie jest inicjalizowany (SDK ani
   `modules/supabase-client.js` nie są ładowane). Moduły `companies-readonly.js`,
   `company-create.js`, `company-access.js` zostały przepisane na D1 (26.07.2026).
   `rate-reader.js` usunięty (`d2a6d00`, tabela `tax_rates` istniała tylko w Supabase);
   stawki gminne obsługuje `window.GminyRates`.
   **Backend to wyłącznie D1 przez Worker.**
8. **Kaskada OCR ma CZTERY warstwy, nie dwie — i każda niższa jest gorsza.**
   Kolejność w `handleAIOCR` (`worker/index.js`): **Aztec** (100% pewności) → **Próba 0
   PaddleOCR** (`ocr-service/` na Railway, `OCR_PYTHON_URL`, linia 3029) → **Próba 1
   CF Workers AI** (`llama-3.2-11b-vision-instruct`, linia 3065) → **Próba 2 Groq Vision**
   (×4 modele). `handleAIOCRDoc` (linia 3416) nie ma Próby 0 — zaczyna od CF.

   **Zejście w dół jest ciche, więc awaria warstwy wyższej objawia się GORSZYMI DANYMI,
   nie błędem.** Ta klasa kosztowała dwie diagnozy w jednym tygodniu: CF zwracał kod 5016
   („model license not accepted") wyłącznie do `console.log`, a Próba 0 miała `catch`
   z samym komentarzem. Oba naprawione — powód każdej warstwy trafia do odpowiedzi 502.
   Pilnuje tego bramka `tests/unit/ocr-cascade-errors-test.js`.

   Do 19.08 ten wpis twierdził, że `ocr-service/` „nie jest podłączony i żaden plik
   aplikacji się do niego nie odwołuje". **To było nieprawdą** i wprowadzało w błąd przy
   każdej diagnozie OCR — analiza kaskady bez Próby 0 opisuje inny system niż działający.
10. **`TaxEngine.getCat()` przy braku liczby osi CICHO przyjmuje 2** — `parseInt(v.osie) || 2`
   (`modules/tax-engine.js:88` i `:199`). Brak danych nie jest błędem: dla pojazdu **od 12 t**
   daje to kategorię **D8 zamiast D9/D10**, czyli inną stawkę, a kwota wygląda tak samo
   wiarygodnie. Przy zmierzonym pokryciu `liczba osi 68/916` to nie jest przypadek brzegowy.
   Ta sama pułapka dotyczy `osie <= 2 ? "D11" : "D12"` (ciągniki) i `"D13"/"D14"/"D15"`
   (naczepy). **Zanim podasz komukolwiek kwotę podatku, sprawdź, ile pozycji stoi na tym
   domyśle** — `tools/dr-excel.js` liczy to i wypisuje, a w arkuszu DT-1 kolumna
   „Możliwe kategorie (brak osi)" pokazuje na czerwono wszystkie kategorie, jakie wychodzą
   przy 1–4 osiach. Trzy kategorie w jednej komórce znaczą „to nie jest ustalone".

11. **Izolacja tenanta** — każde zapytanie do tabeli tenantowej musi mieć `company_id=?`.
   Wzorzec dla operacji po `id`: najpierw `SELECT ... WHERE id=? AND company_id=?`, przy braku
   wiersza `404`; albo `WHERE id=? AND company_id=?` bezpośrednio w `UPDATE`/`DELETE`
   i sprawdzenie `r.meta.changes === 0`. Audyt: 625 zapytań, 99,4% ze scopem.

---

## Gdzie jest reszta (czytaj tylko gdy potrzebne)
| Temat | Plik |
|---|---|
| Pełna historia HANDOFF | `docs/claude/HANDOFF-HISTORIA.md` |
| Weryfikacja, pułapki PowerShell/wrangler/git | `docs/claude/WERYFIKACJA.md` |
| Mosty komputer↔telefon↔sesje, dwie sesje | `docs/claude/MOSTY-I-SESJE.md` |
| CI/CD (GitHub Actions) i narzędzia dev | `docs/claude/CI-I-NARZEDZIA.md` |
| Mapa kodu | `CODEBASE_MAP.md` |

## OSZCZĘDZANIE KONTEKSTU — OBOWIĄZKOWE
- `app.js` (~600 KB), `index.html` (~370 KB), `worker/index.js`: NIGDY nie czytaj w całości. `grep -n`, potem `Read` z `offset`/`limit` (≤200 linii).
- `fontkit.umd.min.js`, `pdf-lib.min.js`, `package-lock.json`: nie czytaj (biblioteki zewnętrzne / lockfile).
- Wyniki testów i zapytań: tylko podsumowanie (`--reporter=line`, `COUNT`/`GROUP BY`), nie pełne listingi.
- Raporty i ustalenia sesji zapisuj do `docs/`, a w tym pliku zostaw najwyżej jedną linię ze wskaźnikiem.
- Przy aktualizacji stanu projektu: nowy wpis na górze `docs/claude/HANDOFF-HISTORIA.md`, tutaj tylko aktualizacja listy ostrzeżeń.

