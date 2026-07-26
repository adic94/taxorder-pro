# TaxOrder Pro — CLAUDE.md
# Reguły projektu dla asystenta AI. Mają pierwszeństwo przed domyślnym zachowaniem.

## Architektura systemu

**Stack:** Cloudflare Pages (SPA) + Worker (backend REST) + D1 (SQLite) + R2 (pliki) + KV (prefs)
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

### Fallback dla wartości numerycznych — ZAWSZE ?? nie ||
```javascript
// ŹLE — falsy-zero: gdy dmc=0, zwraca dmcMax zamiast 0
const dmc = v.dmc || v.dmcMax || 0;

// DOBRZE — null/undefined → fallback, 0 zostaje 0
const dmc = v.dmc ?? v.dmcMax ?? 0;
```
Dotyczy szczególnie: `dmc`, `dmcMax`, `dmcZespolu`, `miesiacePodatku`, `rok`

### Sekret API — NIGDY w kodzie
- Klucze API: `wrangler secret put NAZWA_SEKRETU` (tylko lokalnie, przez terminal)
- Tokeny sesji: tylko `localStorage` (nigdy git, nigdy logi)
- `tools/api-explorer/reports/` i `backups/` → `.gitignore` (mogą zawierać tokeny)

### Webhooki — walidacja URL
- Przy tworzeniu/edycji webhooka: URL musi zaczynać się od `https://`
- `github_issue_url` z DB: przed użyciem jako `href` sprawdź `startsWith('https://')`

---

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
- **Aktualny schemat: v43** (`doc_workflow_templates`, `doc_status_history`) — 43 pliki migracji
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
7. **`window.supabaseClient` NIE ISTNIEJE** — `modules/supabase-client.js` i SDK Supabase nie są
   ładowane w `index.html`. Moduły `company-access.js`, `company-create.js`,
   `companies-readonly.js`, `rate-reader.js` wciąż go wołają → martwy kod / TypeError.
   **Nie pisz nowego kodu opartego o `supabaseClient`.** Backend to wyłącznie D1 przez `cf-cloud.js`.
8. **`ocr-service/` nie jest podłączony** — mikroserwis z kaskadą Aztec+NRV2E istnieje w repo,
   ale żaden plik aplikacji się do niego nie odwołuje. OCR dokumentów idzie przez
   `/api/ai/ocr`, `/api/ai/ocr-doc` i `/api/bulk/*` (Groq Vision). Aztec daje 100% pewności
   danych — docelowo powinien być pierwszym krokiem dla dowodów rejestracyjnych.
9. **Izolacja tenanta** — każde zapytanie do tabeli tenantowej musi mieć `company_id=?`.
   Wzorzec dla operacji po `id`: najpierw `SELECT ... WHERE id=? AND company_id=?`, przy braku
   wiersza `404`; albo `WHERE id=? AND company_id=?` bezpośrednio w `UPDATE`/`DELETE`
   i sprawdzenie `r.meta.changes === 0`. Audyt: 625 zapytań, 99,4% ze scopem.
