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

## HANDOFF — STAN PROJEKTU

> Sekcja aktualizowana ręcznie po zamknięciu tematu lub otwarciu nowego.
> Generuj zwięzłe podsumowanie do wklejenia w claude.ai: `/status`
> Ostatnia aktualizacja: 2026-08-10 (UserPrefs 3b zamknięta, luka pokrycia vehicle-detail zamknięta, wrangler ujednolicony)

### Zamknięte
| Kiedy | Temat | Commit |
|-------|-------|--------|
| 2026-07 | DR extractor — Aztec + NRV2E kaskada, §12–13 zamknięte | `c2670da` |
| 2026-07 | DT-1 audyt ≥12t — 17 pojazdów, 11 korekt, +7 728 zł/rok | `4007011` |
| 2026-07 | Audyt bezpieczeństwa — 4× IDOR, hardening poświadczeń CEPiK | `96a5195` |
| 2026-07 | Migracja 24 pojazdów do właściwych spółek + test izolacji tenantów | — |
| 2026-08 | UserPrefs Partie 1–2 — globalne + per-company prefs w D1 (`user_prefs_kv`) | `5b59c95` |
| 2026-08 | E2E kill switch — `taxorder_prefs_kv_source=local` w global-setup | `3cf0e87` |
| 2026-08 | **CI awaria od 27.07** — tabs-mode sidebar (`494957b`/`c0c6a9e`, merge `3e543da`) ukrywał `#tnb-*` przez `.s-hidden{display:none}`; fix: helper `navigateTo()` → `showPage()` przez `page.evaluate()`. 41 → 20 awarii | `38147c8` |
| 2026-08 | CI tanie awarie — `new-modules` TypeError, `full-coverage` strict mode, `import-export` dropdown (helper `openTool()`). 20 → 4 awarie | `4fc7e5e` |
| 2026-08 | dotenv + `.env.example` — poświadczenia testowe poza terminalem i poza git | `5e908ed` |
| 2026-08 | `.gitignore` — `*.png`, `.playwright-mcp/`, `console-errors.txt` (+ wyjątki `!icons/**`, `!assets/**`) | `c6eb1d5` |
| 2026-08 | Build command Cloudflare Pages — `dist/` poprawne; 200 na `/worker/*` i `/docs/*` to **fallback SPA**, nie wyciek | — |
| 2026-08 | Repozytorium prywatne — potwierdzone `gh repo view`; sekrety poza git (`wrangler secret put` + GitHub Secrets) | — |
| 2026-08 | **Seed danych testowych — temat zamknięty jako zbędny.** Diagnoza „konto CI ma pustą flotę" OBALONA faktami z D1 (patrz niżej). Warianty seed / dedykowany tenant / `test.skip` odrzucone | — |
| 2026-08 | **CI 41 → 0 awarii (finał)** — `vehicle-card` + `vehicle-detail`: (1) duch `#fleet-tbody` — selektor nie istniał w aplikacji (prawdziwy: `#veh-tbody`); (2) `.sk-row` fałszywy pozytyw `waitForSelector` — 5 szkieletów wbudowanych w HTML spełniało warunek przed fetchem, fix: `:not(.sk-row)`; (3) `toggleExpandVeh()` niszczył `tbody` podczas dblclick — **błąd aplikacji**, fix: targeted DOM zamiast `renderVeh()`; (4) architektura super-tabów — w grupie `'przeglad'` widoczne **3** zakładki, nie 5; (5) VD_TABS urósł 16 → 19; `global-setup` mode 2: `addInitScript` nie modyfikował `storageState`, fix: `page.evaluate()` przed snapshotu | `c1ff10c` |
| 2026-08 | **`#bulk-bar` blokuje dblclick** — fix: `_suppressBulkBar()` (`pointer-events:none` na 800 ms, obie ścieżki: `toggleRow()` i `toggleExpandVeh()`); test `vehicle-detail.spec.js:59` przywrócony do fizycznego `page.dblclick()`. ROLLBACK pliki dla schema v45/v46/v47 (osobny commit, przed upływem Time Travel) | `e4c4161` / `28ee761` |
| 2026-08 | **UserPrefs Partia 3a** — (1) `global-setup`: pin `onboarding_done=1` + `ks-hint-shown=1` (oba tryby TOKEN i EMAIL); weryfikacja: 286/11/0 bez flag, 286/11/0 z flagami — pipeline NIE przechodził przypadkowo (event `taxorder-login` nigdy niee mitowany, toast 3s nie zakłóca timingu). (2) `user-prefs.js`: walidacja `theme` — tylko `dark`\|`light`, `console.warn` + stack przy innych; klucze podatne na `JSON.parse` w `get()` zgłoszone (slim_table/taxDarkMode/onboarding_done/ks-hint-shown — brak aktywnego buga). (3) migracja write-side: `taxSidebarSection` (app.js:194), `ks-hint-shown` (keyboard-shortcuts.js:146), `onboarding_done` (onboarding.js:73) → `UserPrefs.set()` | `f42ac81` / `76ac94d` / `f83c285` |
| 2026-08 | **tools/ porządek** — 6 narzędzi diagnostycznych commitowanych (dt1-verify.js z DRY-RUN, dr-analyze-unreadable.js, dr-page-test.js, test-nrv2e-variants.js, aztec-bench.html, dr-helper-wasm.html); 11 jednorazowych → `tools/_archive/` + gitignore; `tools/README.md` | `1abfe3c` |
| 2026-08 | **Luka pokrycia `vehicle-detail.spec.js:110` zamknięta.** Przyczyna: `#vd-uwagi` jest w zakładce `notes`, należącej do super-tabu `ustawienia` (`VD_SUPER_TABS`), nie do domyślnego `przeglad` — trzeba kliknąć `#vd-st-ustawienia` + `#vd-tab-notes` (dwukrotnie, bo `_activeSuperTab` przetrwał `close()`, ale auto-aktywacja w grupie trafia w pierwszą zakładkę `archive`). Przy weryfikacji ujawnił się drugi błąd testu: zakładał, że modal zostaje otwarty po „Zapisz" — `save()` (`vehicle-detail.js:469`) zawsze kończy się `this.close()`. Zweryfikowane: 8 passed, 0 skipped | `7426a00` |
| 2026-08 | **Rozjazd wersji Wranglera ujednolicony** — `deploy-worker.yml` instalował `wrangler@3`, `nightly-report.yml` dwukrotnie `wrangler@latest` (nieprzypięte); żaden nie odpowiadał `^4.0.0` z `package.json` ani przetestowanej lokalnie `4.103.0` z lockfile. Wszystkie trzy przypięte do `4.103.0`. Sprawdzone przed zmianą: brak w repo usuniętych w v4 opcji, brak dynamic `import()` w `worker/index.js`, `wrangler d1 execute` już miał `--remote` | `effaa48` |
| 2026-08 | **UserPrefs Partia 3b** — migracja write-side dla 4 kluczy firmowych: `fleet_widgets`, `dwf_view`, `fuelImportSchemas`, `taxorder-dash-config`. Wszystkie już były w `COMPANY_KEYS` (user-prefs.js) — brakowało tylko zamiany 8 miejsc z gołego `localStorage` na `UserPrefs.get/set/remove`. `taxorder-dash-config` (obawa o strategię scalania) nie wymagał nowej logiki — dziedziczy istniejącą politykę „D1 wygrywa całościowo" z `syncFromCloud()`. `global-setup.js` nie wymagał nowych wpisów — kill switch `taxorder_prefs_kv_source=local` już blokuje `syncFromCloud()` w CI. Zweryfikowane: `dashboard.spec.js` 8/8 passed | `a030b64` |

### W toku
*(brak)*

---

### Otwarte / znane długi

**Dług techniczny**
- **Konto CI (`adamus1000@gmail.com`) jest adminem.** Cały pipeline e2e działa na uprawnieniach
  administratora → **regresja w gatingu uprawnień nie zostanie wykryta**. Istotne, bo audyt 2026-07
  naprawiał 4× IDOR. Docelowo: drugie konto testowe bez roli admin.
- `rate-reader.js` — niezmigrowany z Supabase; tabela `tax_rates` nie istnieje w D1.
  Stawki gminne obsługuje `GminyRates` — moduł martwy, do usunięcia.
- `ocr-service/` — mikroserwis Aztec+NRV2E odłączony od aplikacji.
  Docelowo Aztec jako **pierwszy** krok kaskady OCR dla DR, przed Groq Vision (`/api/ai/ocr`).
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
- npm — 7 podatności (2 moderate, 5 high) w devDependencies (eslint 8.57.1 bez wsparcia, glob/rimraf).
  ⚠️ `npm audit fix --force` potrafi zepsuć Playwrighta — nie uruchamiać przy czerwonym CI.
- `CLOUDFLARE_ACCOUNT_ID` zahardkodowany w `nightly-report.yml` zamiast `${{ secrets.* }}`.
- `SUPABASE_URL` w `wrangler.toml` — Supabase wycofany, wpis do usunięcia.
- `ROLLBACK` — pliki v45/v46/v47 dodane (`28ee761`); v48/v49 brak (Time Travel jeszcze aktywne).

**Sprawy operacyjne (poza kodem)**
- Domena e-mail dla Dominika Dymowskiego i Roberta Sasina — do ustalenia.
- 6 pojazdów litewskich — dokumenty u księgowości, brak potwierdzenia.
- Klucze legacy w Supabase — do unieważnienia po potwierdzeniu, że nic ich nie używa.

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

**Centralny guard w routerze (`worker/index.js:8672-8679`) — sprawdź TUTAJ najpierw.**
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

**To była analiza statyczna, nie pentest.** Pełna pewność wymaga czarnoskrzynkowego
testu drugim, nie-adminowym kontem testowym — patrz "macierz izolacji tenantów"
niżej, wciąż zablokowana brakiem decyzji o takim koncie.

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

## WERYFIKACJA — narzędzia, które odpowiadają na inne pytanie

> Każdy wpis to realny błąd diagnostyczny z tego projektu. Zanim uznasz coś
> za sprawdzone, upewnij się, że test mierzy to, co myślisz.

### .gitignore nie działa wstecz
Plik dodany do repozytorium PRZED wpisaniem reguły pozostaje śledzony —
`.gitignore` dotyczy wyłącznie plików nieśledzonych. `git status` NIE zgłosi tego
jako problemu, bo z jego perspektywy wszystko jest poprawne.

Wykrycie:
```powershell
git ls-files | ForEach-Object { if (git check-ignore -q $_) { $_ } }
```
Naprawa: `git rm --cached <plik>` (zostawia plik na dysku).

Przykład z projektu: `.vscode/mcp.json` był śledzony od 2026-06-03 mimo reguły w `.gitignore`.
Zawierał Supabase `project_ref=opeqckxxdqicszfycolb` — widoczny publicznie od 03.06 do 05.08.2026.

### git check-ignore przy regułach negacji
`git check-ignore -v plik` **zawsze zwraca exit 0** i pokazuje dopasowaną regułę —
także wtedy, gdy tą regułą jest negacja `!` i plik **nie jest** ignorowany.
Odpowiada na pytanie „która reguła pasuje ostatnia", nie „czy Git to zobaczy".

**Prawdziwy test:** utwórz plik i sprawdź `git status` — `??` oznacza nieignorowany.
```bash
echo test > icons/probe.png && git status --short icons/probe.png && rm icons/probe.png
```

### Kod HTTP 200 nie dowodzi, że plik istnieje
Cloudflare Pages ma `not_found_handling = single-page-application` — **każda**
nieistniejąca ścieżka dostaje `index.html` ze statusem **200**.
Test kodem odpowiedzi jest tu bezwartościowy.

**Prawdziwy test:** porównaj **treść** ze ścieżką kontrolną, której na pewno nie ma.
```bash
curl -s https://taxorder-pro.pages.dev/nie-ma-mnie-98765.js | head -3
curl -s https://taxorder-pro.pages.dev/worker/index.js | head -3
```
Oba `<!DOCTYPE html>` → fallback, brak wycieku. Drugi z kodem JS → wyciek.

### curl z wieloma URL-ami
`-o /dev/null` działa **tylko na pierwszy** URL. Treść pozostałych leci na stdout
i zalewa wynik (u nas: 52 KB zamiast trzech kodów).

**Poprawnie:** pętla z osobnym wywołaniem na adres.
```bash
for u in URL1 URL2; do printf "%s  " "$(curl -s -o /dev/null -w '%{http_code}' "$u")"; echo "$u"; done
```

### Reguła *.png w .gitignore wysadza deploy
Build command Cloudflare kopiuje `icons/` i `assets/` do `dist/`. Zignorowana ikona
nie trafi do repo, `cp` jej nie znajdzie i **cały deploy padnie** z błędem
niepowiązanym z przyczyną. Dlatego pod `*.png` muszą stać wyjątki:
```gitignore
*.png
!icons/**
!assets/**
```

### PowerShell — here-string w git commit -m
Składnia `@'...'@` przekazana do `git commit -m` wciąga znak `@` do treści commita
(efekt: `@ fix: ...`). Używać zwykłych cudzysłowów albo `git commit -F plik`.

### npx w PowerShell
Polityka wykonywania blokuje niepodpisany `npx.ps1`. Używać `npx.cmd` albo
`.\node_modules\.bin\<narzędzie>.cmd`. **Nie zmieniać `Set-ExecutionPolicy`.**

---

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

## CI/CD — GITHUB ACTIONS

### ⚠️ PUSH DO `main` = WDROŻENIE NA PRODUKCJĘ
- `worker/**`, `wrangler.toml`, `package.json` → **`deploy-worker.yml` automatycznie wdraża Worker**
- każdy inny plik → Cloudflare Pages przebudowuje frontend
- Zmiany w backendzie rób przez branch + PR, nie bezpośrednio na `main`

### Workflow (8 plików w `.github/workflows/`)
| Plik | Wyzwalacz | Rola |
|------|-----------|------|
| `ci-e2e.yml` | push main / PR / nightly 02:00 UTC | Playwright E2E + testy API |
| `ci-js.yml` | push | `node --check` na wszystkich modułach |
| `ci-ocr-docker.yml` | zmiany w `ocr-service/**` | build obrazu Docker |
| `deploy-worker.yml` | zmiany w `worker/**` | **auto-deploy Workera** |
| `health-check.yml` | cron | monitoring produkcji |
| `nightly-report.yml` | cron | raport nocny |
| `claude.yml` | — | integracja Claude |
| `setup-labels.yml` | — | etykiety repo |

**Wymagane sekrety GitHub (Settings → Secrets):**
- `TEST_EMAIL` — login konta testowego
- `TEST_PASS` — hasło konta testowego
- `TEST_COMPANY` — np. `mtoilet`

**Wymagane zmienne GitHub (Settings → Variables):**
- `PROD_WORKER_URL` — `https://taxorder-pro-api.adamus1000.workers.dev`

Testy lokalne (gdy Node.js w PATH):
```bash
npm run test:e2e   # Playwright E2E
npm run test:api   # testy API
```

---

## NARZĘDZIA DEWELOPERSKIE (tooling)

### Dostępne MCP w Claude Code (aktywne w tej sesji)
| MCP | Narzędzia | Kiedy używać |
|-----|-----------|--------------|
| **GitHub MCP** | `mcp__claude_ai_gitHub__*` | PR, issues, push plików, review kodu |
| **Cloudflare MCP** | `mcp__cloudflare__*` | D1 queries, R2, Worker deploy, KV, Queues |
| **Cloudflare Dev Platform** | `mcp__claude_ai_Cloudflare_Developer_Platform__*` | D1 execute, Workers API |
| **Google Drive / Gmail** | `mcp__claude_ai_Google_*` | dokumenty, kopie zapasowe przez Drive |

**Przykład — query D1 przez MCP bez terminala:**
```
mcp__cloudflare__d1_query (database_id, sql, params)
```

### Playwright MCP
Zainstalowany: `@playwright/mcp` — uruchamiany przez Claude Code do automatycznego testowania UI.
Playwright testy: `npm run test:e2e` | Playwright MCP server: `npx @playwright/mcp`

### ast-grep (AST-aware search)
Zainstalowany lokalnie: `npx sg`  
Konfiguracja: `sgconfig.yml` + `.ast-grep/rules/`  
Używaj do: znajdowania wzorców kodu, refaktoryzacji, audytu XSS (zamiast grep przy złożonych wzorcach)
```bash
npx sg scan --rule .ast-grep/rules/no-bare-xss.yml
npx sg run -p 'el.innerHTML = $X' modules/*.js
```

### jsconfig.json (typescript-lsp dla JS)
`jsconfig.json` w roieniu projektu aktywuje pełne IDE IntelliSense dla plików `.js`
(podpowiedzi typów, navigation, find references) — działa automatycznie w VS Code.

### Audyt własny (tools/autotest/)
```bash
npm run audit:all       # syntax + XSS + i18n + SW cache
npm run xss-audit       # szuka innerHTML bez esc()
npm run sw-check        # weryfikuje CACHE_NAME po zmianach index.html
npm run migration-check # sprawdza czy schematy są spójne
```

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
   `rate-reader.js` pozostaje niezmigrowany — tabela `tax_rates` istniała tylko
   w Supabase; stawki gminne obsługuje `window.GminyRates`.
   **Backend to wyłącznie D1 przez Worker.**
8. **`ocr-service/` nie jest podłączony** — mikroserwis z kaskadą Aztec+NRV2E istnieje w repo,
   ale żaden plik aplikacji się do niego nie odwołuje. OCR dokumentów idzie przez
   `/api/ai/ocr`, `/api/ai/ocr-doc` i `/api/bulk/*` (Groq Vision). Aztec daje 100% pewności
   danych — docelowo powinien być pierwszym krokiem dla dowodów rejestracyjnych.
9. **Izolacja tenanta** — każde zapytanie do tabeli tenantowej musi mieć `company_id=?`.
   Wzorzec dla operacji po `id`: najpierw `SELECT ... WHERE id=? AND company_id=?`, przy braku
   wiersza `404`; albo `WHERE id=? AND company_id=?` bezpośrednio w `UPDATE`/`DELETE`
   i sprawdzenie `r.meta.changes === 0`. Audyt: 625 zapytań, 99,4% ze scopem.
