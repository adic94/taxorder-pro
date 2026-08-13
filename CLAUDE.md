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
> Ostatnia aktualizacja: 2026-08-13
>
> ### ⛔ CZTERY RZECZY CZEKAJĄ NA CZŁOWIEKA — zacznij od nich, nie od kodu
>
> 1. **Worker NIE JEST wdrożony.** Trzy zmergowane commity dotykające `worker/`
>    (`fd43645`, `6528242`, `bb4f3b9`) siedzą na `main` niewdrożone, bo Actions padły
>    w trakcie. **Produkcja ma więc nadal 500 na `GET /api/fleet-kpi`** (strona
>    „Dashboard KPI" martwa) **i błędne wskaźniki CO2** (elektryk liczony jak spalinowy).
>    Nie czekaj na Actions — `git pull origin main && wrangler deploy` z terminala.
> 2. **`migration_v50_esg_targets.sql` niezastosowana** → 500 przy dodawaniu celów ESG.
>    Najpierw `SELECT COUNT(*) FROM esg_targets`. Migracja ma bramkę
>    (`tests/unit/migration-v50-test.js`, 11 asercji, 3 kontrole negatywne).
> 3. **Pakiet minut Actions wyczerpany** (2000/2000), reset **1 września**. Przebiegi
>    padają po 3–5 s z `runner_id: 0` — to NIE jest awaria CI, patrz sekcja CI/CD.
> 4. **Klucze legacy Supabase — czy unieważnione?** Otwarte od dawna; przy rozważaniu
>    upublicznienia repo przestaje to być formalność (`project_ref` jest w historii).
>
> ### Cztery PR-y otwarte, żaden nie ma zielonego CI (runnery niedostępne)
>
> | PR | Gałąź | Rzecz |
> |----|-------|-------|
> | **#16** | `claude/claude-yml-guard` | **scal pierwszy** — `claude.yml` uruchamiał agenta z `contents: write` na sam TEKST komentarza, bez sprawdzenia autora |
> | #15 | `claude/ci-oszczednosci` | harmonogramy zjadały 57% pakietu minut |
> | #13 → #14 | `aztec-ustalenia` → `aztec-naprawa` | stos: narzędzie + naprawa Aztec |
>
> Wszystkie bramki uruchomione lokalnie i zielone; każda nowa zweryfikowana negatywnie.
> `ci-js.yml` rozjechał się między gałęziami — konflikt `env-fee` vs `migration-v50`
> **rozwiązany już w `aztec-naprawa`** (oba kroki zostają, 9 kroków).
>
> ### Skrót tego, co zamknięto 12–13.08
>
> Aztec: przyczyna zniekształcenia bajtów `0x80`–`0x9F` znaleziona (WHATWG mapuje
> etykietę „ISO-8859-1" na **windows-1252**) i naprawiona; `--selftest` przechodzi całą
> produkcyjną ścieżkę end-to-end, 17/17 pól, bez potrzeby zdjęcia. `_decodeAztecPayload`
> wydzielone z `handleAztec`, żeby narzędzie uruchamiało kod produkcyjny, nie kopię.
> Zostało **wyłącznie** pytanie o skuteczność DETEKCJI na sfotografowanym dokumencie —
> do tego potrzeba jednego prawdziwego zdjęcia, trzymanego poza repozytorium.

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
| 2026-08 | **Hotfix: `wrangler@4.103.0` wymaga Node.js ≥22, nie 20.** Deploy Workera padł natychmiast po merge PR #5 („Wrangler requires at least Node.js v22.0.0") — audyt migracji v3→v4 wyżej sprawdzał ogólne wymagania przejścia na v4, nie konkretnej wersji patch. Kod na produkcji był przez cały czas bezpieczny — deploy padał na `wrangler --version`, przed `wrangler deploy`. Naprawione: `node-version` 20→22 w trzech miejscach faktycznie instalujących wranglera (`deploy-worker.yml`, `nightly-report.yml` ×2; job `syntax-check` w `nightly-report.yml` zostawiony na 20 — nie dotyka wranglera). **Zweryfikowane realnym deployem** (nie tylko lokalnie) — `wrangler.toml` dostał notatkę-komentarz jako trigger, run `31429689144` zielony w 22s, health-check produkcji 200 po deployu. Notatka w `wrangler.toml`: sprawdzaj wymaganą wersję Node przy każdej zmianie wersji wranglera, nie tylko ogólne changelogi migracji | `85eddfb` / `d983c64` |
| 2026-08 | **UserPrefs Partia 3b** — migracja write-side dla 4 kluczy firmowych: `fleet_widgets`, `dwf_view`, `fuelImportSchemas`, `taxorder-dash-config`. Wszystkie już były w `COMPANY_KEYS` (user-prefs.js) — brakowało tylko zamiany 8 miejsc z gołego `localStorage` na `UserPrefs.get/set/remove`. `taxorder-dash-config` (obawa o strategię scalania) nie wymagał nowej logiki — dziedziczy istniejącą politykę „D1 wygrywa całościowo" z `syncFromCloud()`. `global-setup.js` nie wymagał nowych wpisów — kill switch `taxorder_prefs_kv_source=local` już blokuje `syncFromCloud()` w CI. Zweryfikowane: `dashboard.spec.js` 8/8 passed | `a030b64` |
| 2026-08 | **Karty floty przy 401 — komunikat błędu + zerwana pętla ponawiania.** `renderKarty()`/`_loadKarty()`: `_cardsLoaded` był ustawiany `true` nawet gdy `r.ok===false` — pusta tabela bez komunikatu. Naprawa: `_cardsLoadError` + `_cardsLoading`, ręczny przycisk „Spróbuj ponownie" zamiast auto-retry. **Przy live-teście (Playwright MCP, bez logowania = prawdziwy 401 z prod Workera) odkryta druga, niezależna instancja tego samego wzorca**: `_renderFleetCardsDash()` (widget dashboardu) miał własny łańcuch retry nierozróżniający „nie wczytano"/„zero kart"/„błąd" — każda nieudana próba generowała kolejną, w pętli bijącej realnymi zapytaniami do prod API co ~100-200ms bez ograniczenia. Naprawione tym samym wzorcem. Brak testu E2E dla tej funkcji — zweryfikowane wyłącznie manualnie, żywym serwerem + Playwright MCP (instrumentacja `window.fetch`/`window._loadKarty`: 20+ wywołań po ustawieniu błędu → 0 nowych fetchy) | `8716182` |
| 2026-08 | **Drugie, nie-adminowe konto testowe założone + izolacja tenantów zweryfikowana na żywo.** Konto `acichocki@mtoilet.pl`, rola `kierownik`, spółka `gcon` (id=14 w D1), utworzone przez `POST /api/users` (hasło hashowane server-side, zapisane wyłącznie w `~/Documents/taxorder-backupy/test-account-tenant-isolation-2026-08-10.txt`, nigdy w czacie/repo). **Backend:** 4/4 próby cross-tenant (`?company=mtoilet` z sesji `gcon`) na `vehicles`/`export`/`damages`/`fleet-cards` zwróciły `403` — potwierdza guard z `worker/index.js:8673-8680` na żywo, nie tylko statycznie. **Front:** przełączenie firmy w SPA (konto admin, `switchCompany('gcon')`) — `vehCount` 161→21, zero rejestracji z `mtoilet` w `window.vehs` po przełączeniu, `currentCompanyId` i `_cardsLoaded` zaktualizowane poprawnie. Zero wycieku w obu warstwach | — |
| 2026-08 | **Konto nie-admin podłączone do CI.** Nowy `tests/api/tenant-isolation-test.js` (wzorowany na `api-test.js`) loguje się kontem `kierownik`/`gcon` i asertuje `403` na 6 endpointach przy próbie `?company=mtoilet`. Nowy krok w `ci-e2e.yml` obok istniejącego „Testy API", uruchamiany tylko gdy ustawiony `PROD_WORKER_URL`. Nowe sekrety GitHub `TEST_EMAIL_NONADMIN`/`TEST_PASS_NONADMIN` ustawione przez `gh secret set` (wartości nigdy nie trafiły do repo/czatu). Zweryfikowane lokalnie przed commitem: 8/8 PASS. Dług „konto CI jest adminem" — zamknięty dla warstwy API; główny suite Playwright nadal działa na koncie admina (patrz Dług techniczny) | `015c150` |
| 2026-08 | **eqeqeq — 18 miejsc naprawionych właściwie (jawna konwersja typu), nie zignorowanych.** Wcześniej (`b16a2a7`) celowo pominięte — `==` łapało dopasowanie ID string/number (`onclick="...('${id}')"` vs wewnętrzny `number`) i wartości `<select>.value` (zawsze string) vs liczbowe stałe. Mechaniczna zamiana na `===` zepsułaby wyszukiwanie rekordów i zaznaczenia w dropdownach. Naprawa per-lokacja: dopasowania ID → `String(a)===String(b)` (`documents.js`, `service.js` ×2 funkcje, `vehicle-detail.js` dropdown oddziału), wartości formularzy → `Number(a)===literał` (`service.js` VAT, `folder-monitor.js` interwał skanowania). Przy okazji naprawiony realny błąd wartościowy w `esg-report.js`: linia z `!=` i sąsiednia z `===` dawały niespójny wynik dla `lower_is_better` przechowywanego jako string `"0"` (żaden radiobutton nie wychodził zaznaczony) — obie ujednolicone na `Number(...)`. Zweryfikowane: eslint 0/18, `vehicle-card.spec.js` + `vehicle-detail.spec.js` 18/18 passed (w tym in-browser suite 71/71) | `d28cf25` |
| 2026-08 | **`rate-reader.js` — martwe odwołanie w `sw.js` naprawione (realny bug, nie tylko sprzątanie).** Sam moduł już nie istniał (usunięty `d2a6d00` w poprzedniej sesji), ale `STATIC_ASSETS` w `sw.js` wciąż wskazywał na nieistniejący plik. `caches.addAll(STATIC_ASSETS)` w handlerze `install` jest atomowe — jeden 404 wywala całą instalację Service Workera, więc cache PWA/offline nie odświeżał się wcale od czasu usunięcia modułu. Usunięty wpis, `CACHE_NAME` v74→v75, komentarz w `style.css` zaktualizowany. Zweryfikowane: `sw-cache-bump --check` — 0 rozbieżności | — |
| 2026-08 | **`CLOUDFLARE_ACCOUNT_ID` przeniesiony do sekretu GitHub.** Znaleziony w 3 miejscach (nie 2, jak sugerował poprzedni wpis w długu technicznym) — `deploy-worker.yml` też miał wartość w cleartext, nie tylko `nightly-report.yml` ×2. Nowy sekret `CLOUDFLARE_ACCOUNT_ID` ustawiony przez `gh secret set`, wszystkie trzy miejsca zamienione na `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`. Uwaga: ID konta i tak jest już jawne w `wrangler.toml` (`account_id = "bb17..."`, plik commitowany) — to porządek/DRY, nie usunięcie realnego wycieku | — |
| 2026-08 | **npm audit — 6 z 8 podatności (wszystkie high) naprawione bezpiecznie.** Zwykły `npm audit fix` (bez `--force`) rozwiązał `brace-expansion`, `js-yaml`, `sharp`, `undici` — bez breaking changes, `package.json` niezmieniony (tylko `package-lock.json`). Efekt uboczny: lokalny `wrangler` w lockfile skoczył 4.103.0→4.120.1 (w ramach `^4.0.0` z package.json) — zaktualizowane też przypięte wersje w CI (3 miejsca), żeby nie powtórzyć rozjazdu z KROK 3; sprawdzony `engines.node` nowej wersji: nadal `>=22.0.0`, bez zmian. Pozostałe 2 (moderate, `uuid`/`exceljs`) świadomie nietknięte — wymagają `--force` i cofnięcia `exceljs` do 3.4.0. Zweryfikowane: `wrangler --version`/`playwright --version`/`eslint --version` działają, `vehicle-card.spec.js` 10/10 passed (w tym in-browser suite 71/71), YAML sparsowany bez błędu | — |
| 2026-08 | **uuid/exceljs — decyzja: NIE `--force`, ryzyko świadomie zaakceptowane.** Zbadane przed decyzją: (1) `exceljs@4.4.0` to i tak najnowsza wersja na npm — nie ma nowszej naprawiającej zależność od `uuid`, `--force` cofnąłby DWIE wersje major (4.4.0→3.4.0), nie mały breaking change; (2) `exceljs` jest `require`owany wyłącznie w `tools/dr-extractor.js` (lokalne narzędzie deweloperskie, `tools/` nie wchodzi na produkcję, nie ładowane przez Worker ani przeglądarkę, uruchamiane ręcznie) — zero ekspozycji sieciowej; (3) CVE dotyczy braku sprawdzania granic bufora gdy do `uuid.v4()` przekazany jest własny parametr `buf` — sprawdzone źródło `exceljs` (`node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`): wywołuje `uuidv4()` bez żadnych argumentów, luka strukturalnie nieosiągalna tą ścieżką. Koszt (ryzyko zepsucia `dr-extractor.js`, utrata 2 wersji major funkcjonalności) bez żadnej realnej korzyści bezpieczeństwa. Nie uruchamiać `npm audit fix --force` bez ponownej analizy, jeśli `exceljs` zacznie być używany gdzie indziej niż `tools/` | — |
| 2026-08 | **Bookmarklet DT-1 → Warszawa — funkcja martwa od wprowadzenia + dwa wektory wstrzyknięcia.** Znalezione przy okazji jedynego **błędu** eslint (`no-script-url`) utopionego w 2168 ostrzeżeniach. (1) **Nigdy nie działał**: w literale szablonowym `\'` nie jest escapem — daje goły apostrof, który zamykał string w emitowanym kodzie (`onclick="this.closest('div[style]')..."` wewnątrz stringa ograniczonego `'`) → `SyntaxError: Unexpected identifier 'div'` przy **każdym** uruchomieniu, niezależnie od danych. Wprowadzony i nietknięty od `0000e30`. (2) Po naprawie samej składni **odsłaniały się dwa wektory** — potwierdzone w realnym Chromium, nie teoretycznie: **A)** przeglądarka percent-dekoduje `javascript:` URL przed wykonaniem, więc `%22` w polu `marka` zamieniało się w `"`, wychodziło poza literał JSON i wykonywało dowolny kod; **B)** `p.nr_rej`/`marka`/`model`/`osie`/`zawieszenie` oraz dane podatnika szły surowe do `innerHTML` — a panel renderuje się na origin **moja.warszawa19115.pl w sesji zalogowanej PZ**. Dane wchodzą też z importów CSV/CEPiK/OCR, więc nie tylko „użytkownik atakuje sam siebie". Naprawa: własny `esc()` wewnątrz generowanego skryptu (globalny `esc()` aplikacji tam nie istnieje), `addEventListener` zamiast `onclick` z zagnieżdżonymi apostrofami, `encodeURIComponent` na ładunku `javascript:`, celowy `eslint-disable` z uzasadnieniem. `CACHE_NAME` v75→v76 — SW jest stale-while-revalidate, bez bumpu poprawka dotarłaby dopiero przy drugim wejściu. Nowy test bez zależności `tests/unit/warsaw-bookmarklet-test.js` (7 asercji) wpięty w `ci-js.yml` i `audit:all`; **zweryfikowany negatywnie** — na oryginalnym app.js daje 0/7 PASS, na naprawionym 7/7. Dodana bramka `npm run lint` w `ci-e2e.yml` (eslint nie był uruchamiany w ŻADNYM workflow — stąd przeoczenie) | — |
| 2026-08 | **Audyt CC — weryfikacja u źródła i 3 poprawki backendu.** Dwa niezależne przebiegi audytu; każde znalezisko sprawdzone bezpośrednio w kodzie (CLAUDE.md ma udokumentowany przypadek subagenta zgłaszającego nieistniejący „systemowy IDOR w 70 handlerach"). **Potwierdzone i naprawione:** (1) `handleSupplierInvoices` DELETE — `DELETE FROM supplier_invoice_items WHERE invoice_id=?` bez `company_id`; centralny guard routera tu NIE pomaga, bo atak nie używa `?company=` (własna firma w parametrze, cudze `id` w ścieżce) → cross-tenant kasowanie pozycji faktur; fix: `SELECT ... AND company_id=?` → 404 przed kasowaniem dzieci. (2) `handleNotifLog` acknowledge/snooze — dodany `company_id` (ryzyko było niskie, zapytania scope'owane po `user_id`, ale niespójne). (3) `enforceModuleAccess` przeniesione ZA guardy firmy — czyta `?company=` z URL, więc przed guardem odpowiadało o pakiet obcej firmy (402 vs przepuszczenie = kanał boczny); dziś nieaktywne, ale naprawa pakietów bez tej zmiany by go otworzyła. **Odrzucone jako nieaktualne:** raport „4 commity Supabase czekają na push" — wszystkie cztery (`45267f8`, `9aff207`, `af71be6`, `d2a6d00`) są w `origin/main`, zweryfikowane `git merge-base --is-ancestor`; raport „`vehicle-detail.spec.js:110` naprawiony" — naprawiony wcześniej w `7426a00`. **Sprzeczność między raportami:** jeden twierdzi „13 par duplikatów, wszystkie identyczne strukturalnie, bezpieczne", drugi flaguje `company_packages` (jedną z tych par) jako krytyczną — drugi ma rację, różnice strukturalne potwierdzone w `schema_v33`/`v48`, `v35`/`v41`, `v13`/`v40`. Reszta → W toku | — |
| 2026-08 | **Rezerwacje floty — zapis „Potwierdzone" naruszał CHECK.** Produkcyjna tabela `reservations` stoi na `schema_v13` z `CHECK(status IN ('pending','accepted','rejected'))` — potwierdzone dosłownie przez `SELECT sql FROM sqlite_master` na `--remote`. `schema_v40` redefiniował ją bez CHECK i z `DEFAULT 'confirmed'`, ale jako `CREATE TABLE IF NOT EXISTS` był cichym no-opem. `fleet-reservations.js` oferował `<option value="confirmed">` → każdy zapis ze statusem „Potwierdzone" leciał na `CHECK constraint failed`. Drugi, niezgłoszony objaw: istniejące wiersze ze statusem `accepted` renderowały się w UI jako surowe „accepted", bo `STATUS_LBL` nie miało takiego klucza. Naprawa po stronie UI (3 miejsca w jednym module), nie bazy — SQLite nie zmieni CHECK bez przebudowy tabeli, a wszystkie istniejące wiersze i tak używają `accepted`. Sprawdzone: `vehicle-reservations.js` pisze do INNEJ tabeli (`vehicle_reservations`), więc jego `approved`/`completed`/`cancelled` są poprawne. Zweryfikowane odtworzeniem produkcyjnego CHECK na SQLite: `accepted` przechodzi, `confirmed` → `CHECK constraint failed` | — |
| 2026-08 | **`fuel_entries` nie istnieje — CO2, paliwo i raporty były cichymi zerami.** Tabela nie jest tworzona przez żaden `schema_v*.sql`, a **wszystkie** odwołania miały `.catch()` — nic nie wybuchało, po prostu każdy wynik był pusty. To gorsze niż 500: użytkownik dostawał wiarygodnie wyglądające zera. Cztery miejsca przestawione na `fuel_fills` (jedyna tabela tankowań z realnymi danymi — pełny CRUD, importy, dashboardy): (1) `handleEsgTargets` ×2 — **CO2 i zużycie paliwa w raportach ESG były zerowe dla każdej firmy i roku**; `fuel_fills` nie ma `co2_kg`, więc CO2 liczone z litrów i typu paliwa, dokładnie jak w `handleCO2Report` — wskaźniki wyciągnięte do wspólnej stałej `CO2_EMISSION_FACTORS`, żeby oba endpointy nie mogły się rozjechać (wartości bez zmian); (2) kreator raportów — źródło „Paliwo" zwracało zawsze pusty raport, poprawione po obu stronach naraz (front i backend są sparowane) z mapowaniem kolumn; (3) eksport JPK_KR/SAF_T — nie zawierał ŻADNYCH pozycji paliwowych. Osobno `webhook_logs`: tam SELECT **nie** miał `.catch()` → 500 na `GET /api/zapier?events`; dodany `.catch()`, ale tabeli celowo NIE utworzono — to jedyne odwołanie w workerze, nic do niej nie pisze, więc utworzenie dałoby trwale pustą tabelę i pozorną naprawę. Zweryfikowane na SQLite: 100 l diesla + 50 l LPG + 10 l elektryka = 160 l i 346,5 kg CO2 zamiast 0 i 0 | — |
| 2026-08 | **🔴 Nocny workflow kasował tabele co noc — główna (ale NIE jedyna) przyczyna „dryfu migracji".** `nightly-report.yml` uruchamiał `for f in worker/schema_v*.sql`. Ten glob dopasowuje **także pliki `schema_vNN_ROLLBACK.sql`**, a leksykograficznie każdy trafiał **tuż po swojej migracji** (`schema_v48.sql` → `schema_v48_ROLLBACK.sql`). Baza co noc tworzyła tabele i natychmiast je kasowała: `companies`, `user_company_access` (v44), `ksef_config`, `ksef_offline_queue` (v45), `vignettes`, `hr_leaves`, `hr_medical_exams`, `driver_trips`, `fixed_assets`, `carrier_ratings` (v46), `debt_collection`, `debt_reminders`, `fuel_import_schedules`, `external_access_tokens` (v47), `company_packages`, `usage_snapshots` (v48), `user_prefs_kv` (v49). **To jest główny powód braków w D1** (`num_tables: 113` w logu nocnego przebiegu wobec 134 definicji w repo), ale **nie wyjaśnia wszystkiego — 5 tabel nie powstałoby nawet po tej naprawie**, patrz wpis niżej o `schema_v8`/`schema_v48`. Dwa dalsze defekty w tym samym kroku: glob powłoki sortuje **leksykograficznie**, więc `v2` wykonywało się po `v19`, a `v5` po `v49` — migracje szły w złej kolejności; oraz `|| echo "błąd lub już wykonany"` zrównywał realną awarię z powtórzeniem i zawsze kończył się kodem 0 (job świecił na zielono 11.08 o 04:47, jak co noc). Import D1 z `--file` jest **transakcyjny per plik** — jeden błędny statement wycofuje CAŁY plik, więc `duplicate column name` w pliku zawierającym nową tabelę oznacza, że ta tabela też nie powstała; w logu widać to na `schema_v8.sql` i `schema_v9.sql`. Naprawa: wykluczenie plików ROLLBACK, `sort -V`, rozdzielenie awarii od powtórzenia, oraz **bramka `d1-schema-diff --strict`** porównująca faktyczny stan bazy z repo. Nowa konwencja: migracje strukturalne (DROP/RENAME/ALTER) nazywamy `migration_vNN_opis.sql`, żeby NIE trafiały do nocnego automatu | — |
| 2026-08 | **Naprawiony automat NIE wystarczy — 5 tabel nie powstaje mimo to, a bramka `--strict` dawała 14 fałszywych alarmów.** Sprawdzone przez uruchomienie wszystkich `schema_v*.sql` na prawdziwym silniku SQL (`node:sqlite`), dwukrotnie, z odtworzeniem transakcyjności D1 per plik — nie przez czytanie plików. (1) **`schema_v8.sql` pada ZAWSZE, nie tylko przy powtórzeniu**: `ALTER TABLE users ADD COLUMN extra_permissions` dubluje kolumnę już obecną w `CREATE TABLE users` z `schema_v1.sql`. Wycofanie całego pliku zabiera ze sobą **4 tabele powiadomień** — `alert_types`, `notification_prefs`, `notification_log`, `maintenance_templates`. ⚠️ **SPROSTOWANIE 12.08 (dane z produkcji):** te cztery tabele **ISTNIEJĄ w D1** — nie ma ich w sekcji [2] nocnego raportu. Zdanie „automat nigdy ich nie utworzył" było **błędne dla produkcji**. `ALTER` w v8 zadziałał **raz, historycznie** (produkcyjna tabela `users` powstała ścieżką bez kolumny `extra_permissions`) i dopiero każde kolejne uruchomienie pada. Lokalne odtworzenie na czystej bazie pokazywało utratę tych tabel, bo tam `schema_v1` tworzy `users` **z** tą kolumną, więc v8 nie przechodzi nigdy — test odpowiadał na inne pytanie niż „jaki jest stan produkcji". Naprawa v8 pozostaje słuszna (plik przestaje padać, migracje stają się odtwarzalne na czystej bazie), ale **nie usuwa żadnych realnych 500** — tych 500 nie było. Potwierdzone dosłownie w logu produkcyjnym (`duplicate column name: extra_permissions`, run `31459590724`), nie tylko lokalnie. Żadne z ~30 zapytań do tych tabel w workerze **nie ma `.catch()`** — przy braku tabel to 500, nie ciche zero. (2) **`schema_v48.sql` pada zawsze**: `CREATE INDEX ... ON company_packages(company_id, active)` — kolumny `active` nie ma, bo tabelę tworzy wcześniejszy `schema_v33` o innej strukturze, a `CREATE TABLE IF NOT EXISTS` z v48 jest cichym no-opem. Ginie `usage_snapshots`. To rehabilituje odrzuconą wcześniej diagnozę audytu („v33 wygrała, brak kolumny `active`") — była poprawna jako opis **konfliktu plików**; błędna była tylko co do stanu produkcji, gdzie tabeli nie było, bo kasował ją nocny ROLLBACK. (3) **`d1-schema-diff --strict` porównywał wyłącznie z `CREATE TABLE`, ignorując `ALTER TABLE ADD COLUMN`** — 14 tabel legalnie rozszerzonych ALTER-ami raportował jako „nie pasuje do ŻADNEJ definicji" i kończył kodem 1. Bramka świeciłaby **czerwono co noc niezależnie od stanu bazy**, czyli nie niosłaby informacji. Naprawione; po naprawie sekcja [5] pusta, kod wyjścia nadal 1 z **prawdziwych** powodów (5 brakujących tabel, 10 na starszej definicji). Nowy `tests/unit/migration-apply-test.js` (bramka w `ci-js.yml`, Node 20→22 bo `node:sqlite`) — **zweryfikowany negatywnie dwukrotnie**: po cofnięciu świadomości ALTER daje 3/4 z „14 rozjazdów", a po dodaniu migracji gubiącej tabelę wskazuje ją po nazwie | — |
| 2026-08-12 | **`schema_v8` i `schema_v48` naprawione u źródła — 5 tabel może wreszcie powstać.** Poprzedni wpis ustalił, ŻE te pliki padają zawsze; ten je naprawia. `schema_v8.sql`: usunięty `ALTER TABLE users ADD COLUMN extra_permissions` (kolumna jest w `CREATE TABLE users` w `schema_v1.sql:15`) — usunięcie niczego nie zabiera, bo sam komunikat `duplicate column name` dowodzi, że kolumna na produkcji istnieje. `schema_v48.sql`: indeks zawężony z `(company_id, active)` do `(company_id)` — działa na obu strukturach (`schema_v33` ma `company_id TEXT PRIMARY KEY`, nie ma `active`), więc plik przestaje się wycofywać razem z `usage_snapshots`. **Zachowanie licencjonowania modułów bez zmian** — struktura `company_packages` nietknięta, `resolveModuleAccess` nadal trafia w `catch → allowed=['*']`; rozjazd v33/v48 zostaje otwarty. Seed w v8 sprawdzony przed wypchnięciem: `INSERT OR IGNORE` z `company_id = NULL` (wbudowane typy alertów), idempotentny, zero danych tenanta. `ZNANE_BRAKI` w `migration-apply-test.js` wyzerowane z komentarzem zakazującym dopisywania tam tabel „żeby uciszyć test" — wpis na tej liście oznacza migrację, która nie dociera na produkcję. Zweryfikowane `node:sqlite` z transakcyjnością per plik: 4/4 PASS, negatywnie — po przywróceniu ALTER-a test wymienia cztery tracone tabele po nazwie. **Pliki `schema_v*.sql` NIE wykonują się przy deployu Workera** — zastosuje je dopiero nocny automat albo ręczne `wrangler d1 execute` | PR #8 |
| 2026-08-12 | **PR #6 zmergowany (`090ba3e`), deploy Workera na produkcję zielony.** Wszystkie trzy checki przed mergem: Playwright E2E ✅ (04:10:39), syntax ✅, Cloudflare Pages ✅; `mergeable_state: clean`. `deploy-worker.yml` run `31562469799` — sukces 04:11:47. Health-check produkcji po deployu (`workflow_dispatch`, run `31562566597`, 04:13:32) — sukces. Squash zachował drzewo 1:1 (`git diff adbc861 090ba3e` puste). **Uwaga na przyszłość: z tego środowiska nie da się odpytać produkcji** — polityka sieciowa odrzuca CONNECT do `*.workers.dev` (403), więc `curl` na Worker API zwraca `000`, co wygląda jak awaria produkcji, a jest ograniczeniem kontenera. **To samo dotyczy `*.pages.dev`** — także preview gałęzi z PR (potwierdzone 12.08: `connect_rejected`, „gateway answered 403 to CONNECT"; diagnoza przez `curl -sS "$HTTPS_PROXY/__agentproxy/status"`, sekcja `recentRelayFailures`). Do weryfikacji deployu używaj `health-check.yml` przez `workflow_dispatch`, nie curla. **Do testów w przeglądarce nie potrzeba jednak sieci** — `localhost` omija proxy: `python3 -m http.server` w katalogu repo + Playwright z `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'` i `args:['--no-sandbox']` (wersja z `node_modules` szuka innego builda i podpowiada `npx playwright install` — **nie uruchamiaj go**, wskaż preinstalowaną binarkę; skrypt poza repo wymaga `NODE_PATH=/home/user/taxorder-pro/node_modules`) | `090ba3e` |
| 2026-08-12 | **Dwa przyciski eksportu martwe od wprowadzenia — `no-undef` zamieniony z szumu w detektor.** Przegląd 621 ostrzeżeń `no-undef` (jedyna kategoria mogąca maskować realne błędy) dał 54 unikalne nazwy, z czego **4 nie istniały nigdzie w repo**. Dwie z nich to realne awarie: (1) **`bulkExportCSV()`** (`app.js`, przycisk „CSV (.csv)" w menu eksportu, `index.html:4265`) wołał `.map(_csvEsc)` — nazwa występowała w całym repo **dokładnie raz, w tym wywołaniu**; `ReferenceError` przy każdym kliknięciu. Podstawiony istniejący `csvCell()` (`app.js:1230`), który przy okazji **chroni przed wstrzyknięciem formuł CSV** (prefiks TAB dla `=+-@`) — czego zepsuty `_csvEsc` i tak nigdy nie robił. (2) **`expJson()`** („Zapisz backup sesji (.json)", `index.html:2663`) czytał niezadeklarowane `decReason`; `app.js` nie jest w trybie strict, więc przypisanie w `impJson()` tworzyło globalną **niejawnie** — ale tylko po wcześniejszym imporcie, więc eksport na czystej sesji rzucał `ReferenceError`. Dodana jawna deklaracja `let decReason = ''`. Pozostałe dwie (`FleetCloud` w `vehicle-import.js`, `saveVehs` w `etoll-import.js`) to martwe gałęzie za `typeof`-guardem — nie wybuchały, ujednolicone do `window.*`. **Bramka:** `no-undef` podniesione `warn`→`error` + kompletna lista 50 globali w `.eslintrc.json`. Zweryfikowane negatywnie na dwa sposoby: (a) bramka — wstrzyknięta literówka `renderVehh` → `npm run lint` EXIT 1, po cofnięciu EXIT 0; (b) **w realnej przeglądarce, z kontrolą negatywną na kodzie sprzed naprawy** — serwer statyczny na `localhost` + Playwright, wywołanie obu funkcji po zaznaczeniu 2 pojazdów: na `HEAD~1` dokładnie przewidziane `ReferenceError: _csvEsc is not defined` i `ReferenceError: decReason is not defined`, na `HEAD` oba `OK`. Awarie były więc realne i widoczne dla użytkownika, nie teoretyczne. To ta sama klasa co bookmarklet DT-1 — funkcja martwa od dnia wprowadzenia, niewidoczna dla `node --check`, `xss-audit` i Playwrighta, bo żaden test nie klikał tego przycisku | — |
| 2026-08-12 | **Pierwszy nocny przebieg z naprawionym automatem — kolejność i ROLLBACK-i OK, ale obalił dwie moje tezy.** Run `31565799753` (05:12, sha `090ba3e`). ✅ Pliki szły **numerycznie** (`sort -V` działa), **żaden `_ROLLBACK` nie został uruchomiony** — naprawa z PR #6 potwierdzona na produkcji. Bramka `--strict` zakończyła się kodem 1 i **tak miało być**. D1: **131 tabel** wobec 134 definicji w repo. **Sekcja [2] — brakują tylko 3 tabele, nie 5:** `ksef_config`, `ksef_offline_queue` (obie z `schema_v45`) i `usage_snapshots` (`schema_v48`). **Cztery tabele powiadomień ISTNIEJĄ** — patrz sprostowanie przy wpisie wyżej. **Nowe znalezisko tej samej klasy, którego PR #8 NIE naprawia:** `schema_v45.sql` pada na `ALTER TABLE ksef_invoices ADD COLUMN upo_r2_key` (`duplicate column name`) i wycofuje razem ze sobą obie tabele KSeF; worker odwołuje się do nich w ~18 miejscach, część **bez `.catch()`**. `schema_v48` padł dokładnie jak zdiagnozowano (`no such column: active at offset 75`) — PR #8 to naprawia. Łącznie 16 plików zakończonych błędem, wszystkie tej samej klasy `duplicate column name` na `ALTER` (v29 `penalty_pln`, v30 `cpc_card_number`, v36 `sku`, v37 `clerk_user_id`, v43 `workflow_status`, v45 `upo_r2_key`). Sekcja [4]: **11 tabel na starszej definicji**, w tym `esg_targets` (v35) i `company_packages` (v33, bez `active`) — zgodnie z wcześniejszymi ustaleniami. Sekcja [5] pusta, sekcja [3] pusta | run `31565799753` |

| 2026-08-12 | **Zero zakleszczonych plików schematu — klasa błędu domknięta.** Punktowe naprawy (v8, v45, v48) rozszerzone na wszystkie pozostałe: `v23`, `v24`, `v30`, `v36`, `v43` padały przy każdym powtórzeniu **i zawierały `CREATE TABLE`**, więc ich tabele były nie do odtworzenia. Najgroźniejszy `schema_v24`: 8 tabel, w tym **`fuel_fills`**. Dowodu, że kolumny są na produkcji, dostarczył nocny raport — `d1-schema-diff` dopasowuje **dokładny** zbiór kolumn D1 do definicji z repo (licząc `ALTER`-y), a sekcja [5] była **pusta** i żadna z tych tabel nie wystąpiła w [4]; brak `branch_id`/`gl_account`/`cpc_*`/`sku`/`workflow_*` wypchnąłby tabelę do jednej z tych sekcji. 26 kolumn przeniesionych do `CREATE TABLE` w 7 plikach (v1, v2, v3, v10, v11, v21, v25). `vehicles.branch_id` **bez** `REFERENCES branches(id)` — `branches` powstaje dopiero w v23, więc FK w `schema_v1` tworzyłby zależność od kolejności tworzenia tabel. **Weryfikacja niezależna od bramki** (bramka porównuje repo z bazą zbudowaną z tego samego repo, więc sama w sobie nie dowodzi zachowawczości): zbudowana baza sprzed zmiany i po niej, porównane `PRAGMA table_info` każdej tabeli — **135 tabel przed i po, zero utraconych, zero z innym zbiorem kolumn**. `ZNANE_ZAKLESZCZONE` wyzerowane; asercja „żaden plik padający przy powtórzeniu nie tworzy tabel" przechodzi dla wszystkich plików; padających przy powtórzeniu 14 → 8. Bramka złapała po drodze dwa błędy wprowadzone moim skryptem: przecinek rozdzielający kolumny wewnątrz komentarza oraz kolumny wstawione **po** `UNIQUE(...)`, które musi stać na końcu | — |

| 2026-08-12 | **`vehicles` nie ma płaskich kolumn — 11 zapytań pisanych tak, jakby miała.** Gałąź `claude/vehicles-i-co2`. Realne kolumny: `id, company_id, nr_rej, axles_count, suspension_type, dmc_zespolu, miesiace_podatku, dt1_category, dt1_tax_amount, data, updated_at, branch_id, tacho_*` — reszta siedzi w JSON `data`. **`GET /api/fleet-kpi` zwracał 500 ZAWSZE** (jedyne zapytanie w swoim `Promise.all` bez `.catch()`), więc strona „Dashboard KPI" była martwa. Dziesięć pozostałych miało `.catch()` → **ciche zera**: liczniki floty i udział EV w ESG, wyszukiwarka pojazdów i skany QR, historia serwisowa dla analizy Claude, licznik przeterminowanych przeglądów (kolumna `przeglad_do` **nie istnieje nigdzie w repo** — aplikacja używa `nextInspection`), zapis wyniku CEPiK (dodatkowo `user.company` zamiast `user.company_id`). Definicje „pojazd czynny"/„elektryczny" wyciągnięte do `SQL_VEH_ACTIVE`/`SQL_VEH_IS_EV`. **Bramka `tests/unit/vehicles-columns-test.js`** — wyciąga KAŻDE zapytanie do `vehicles` i przygotowuje je na schemacie; `db.prepare()` w SQLite waliduje nazwy kolumn. Negatywnie: `origin/main` → 11 zapytań po numerze linii, HEAD → 0 przy 49 sprawdzonych. Pierwsza wersja testu używała regexa na literałach, przechodziła przez ich granice i padała **tak samo na starym i nowym kodzie** — wykryła to dopiero kontrola negatywna; ekstrakcja przepisana na skaner od `.prepare(`. Ten skaner znalazł 2 błędy przeoczone w ręcznym przeglądzie (`JOIN vehicles`, nie `FROM`) | — |
| 2026-08-12 | **Wskaźniki CO2 nie trafiały w wartości zapisywane przez aplikację.** Dług opisywał to jako „rozjazd dwóch tablic" — w rzeczywistości **obie były rozjechane z danymi**. Formularz tankowania (`index.html`, `#fm-ftype`) zapisuje `diesel/pb95/pb98/lpg/cng/elektryk`, a backend szukał po **równości** wśród kluczy `petrol/gasoline/electric`: `pb95`/`pb98` → 2,5 zamiast 2,31 (+8%), `cng` → 2,5 zamiast 2,04 (+23%), **`elektryk` → 2,5 zamiast 0** (pojazd bezemisyjny liczony jak spalinowy). Dodany `co2FactorFor()` dopasowuje po fragmencie (importy i OCR dokładają `benzyna`, `elektryczny`, `hybryda`, `ON`). Front **nie dostał drugiej kopii tablicy** — kilogramy liczy backend, więc backend zwraca użyty wskaźnik w polu `ef`, a `co2-report.js` tylko go wyświetla; wcześniej arkusz eksportu pokazywał 2,68 obok kilogramów z 2,65. Rozjazd jest teraz strukturalnie niemożliwy. Bramka czyta warianty wprost z `<select>` w `index.html`. Test wyłapał mój własny błąd: polskie `elektr` i angielskie `electr` różnią się literą k/c | — |
| 2026-08-12 | **Kreator raportów — źródło „Pojazdy" zwracało pustą tabelę.** Mapa `COL_EXPR` (nazwa logiczna → wyrażenie SQL) użyta w SELECT (z aliasem), filtrze i `ORDER BY`. Klucze wzięte z aplikacji: `$.marka`, `$.model`, `$.kierowca`, `COALESCE($.oddzial,branch_id)`, `COALESCE($.dmc,$.dmcMax)` — `COALESCE` zachowuje semantykę `??`, więc DMC równe 0 zostaje zerem. `report-sources-test` **rozszerzony, nie osłabiony**: kolumna musi być płaską kolumną albo mieć mapowanie, a samo `COL_EXPR` może odwoływać się wyłącznie do realnych kolumn. Wpięty do `ci-js.yml` | — |

### W toku

**Rozjazd schematu D1 — ZWERYFIKOWANY NA PRODUKCJI 11.08.** Odczyt z `wrangler d1 execute
--remote` obalił diagnozę obu przebiegów audytu w najważniejszym punkcie. Nie zgadywać
ponownie — to są fakty z bazy.

| Tabela | Faktyczny stan w D1 | Wniosek |
|--------|---------------------|---------|
| `company_packages` | **NIE ISTNIEJE** — `SELECT` zwraca `no such table`, `PRAGMA table_info` pustkę | **Przyczyna ustalona: `schema_v48_ROLLBACK.sql` kasował ją co noc** (patrz Zamknięte). Nie „migracja nigdy nie zastosowana" — była stosowana i natychmiast cofana. `catch → allowed=['*']` w `resolveModuleAccess` to **udokumentowana ścieżka backward-compat** (komentarz w kodzie: „Tabela nie istnieje (przed migracją)"), nie awaria. **Zero firm dotkniętych** — nie ma wierszy, więc nikt nic nie traci. Audyt zdiagnozował „v33 wygrała, brak kolumny `active`" — **nieprawda**. Proponowany `ALTER TABLE company_packages ADD COLUMN active` **padłby** na `no such table` |
| `esg_targets` | **v35** (`co2_target_kg`, `fuel_target_l`, `ev_percentage_target`, `electric_km_target`) | v41 był cichym no-opem. `POST /api/esg/targets` (index.js:11734) pisze kolumny v41 (`metric_key`, `target_value`…) **bez `.catch()`** → 500. **Aktywny błąd produkcyjny**, dodawanie celów ESG martwe |
| `reservations` | **v13 z `CHECK(status IN ('pending','accepted','rejected'))`** | Potwierdzone dosłownie przez `SELECT sql FROM sqlite_master`. **Naprawione** — `fleet-reservations.js` używał `confirmed` (naruszenie CHECK). Odtworzone lokalnie na SQLite: `accepted` przechodzi, `confirmed` → `CHECK constraint failed` |

**Właściwy problem jest szerszy niż pojedyncze tabele: dryf migracji.** Co najmniej cały
`schema_v48.sql` (`company_packages` + `usage_snapshots`) nigdy nie trafił na produkcję,
a `schema_v41.sql` częściowo. `CREATE TABLE IF NOT EXISTS` sprawia, że ponowne uruchomienie
starszego pliku **nie naprawi** tabeli o innej strukturze — i nic o tym nie zgłosi.

**Do zamknięcia — 3 kroki:**

1. **Pełne porównanie tabel** (repo: 134 definicje `CREATE TABLE` w `schema_v*.sql`):
   ```bash
   wrangler d1 execute taxorder-pro --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
   ```
   Od 12.08 nie trzeba tego robić ręcznie — nocny raport ma bramkę `d1-schema-diff --strict`,
   a jej sekcja `[2]` wymienia brakujące tabele po nazwie. **Pierwszy przebieg z naprawionym
   automatem wypadnie czerwono i tak ma być** — to 3 realnie brakujące tabele i 11 na
   starszej definicji, nie usterka bramki. Przyczyna tych 5 jest naprawiona w PR #8
   (`schema_v8`/`schema_v48`), ale skutek zniknie dopiero po przebiegu, który je zastosuje.
2. **`esg_targets` — migracja GOTOWA, niezastosowana.** `worker/migration_v50_esg_targets.sql`
   (+ `migration_v50_esg_targets_ROLLBACK.sql`) przebudowuje tabelę z v35 na v41, zachowując dane.
   Zweryfikowana na SQLite na wiernym odtworzeniu produkcyjnej tabeli — round-trip
   v35→v50→ROLLBACK→v35 zwraca dane identyczne. **Uruchom po sprawdzeniu**
   `SELECT COUNT(*) FROM esg_targets`:
   ```bash
   wrangler d1 execute taxorder-pro --remote --file=worker/migration_v50_esg_targets.sql
   ```
   Pułapka, której nie zgłosił żaden audyt: v35 zakłada indeks **UNIQUE**`(company_id, year)`,
   a model v41 wymaga wielu wierszy na rok. `schema_v41` deklaruje indeks o tej samej nazwie
   bez UNIQUE, więc też był no-opem — bez `DROP INDEX` nowy model padłby na drugiej metryce.

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

### Aztec — ustalenia z 12.08.2026 (NIE odtwarzaj tego śledztwa od zera)

**Teza „brakuje nam warstwy obraz → bajty Aztec" jest NIEPRAWDZIWA.** Warstwa istnieje
i działa po stronie przeglądarki: `loadZXing()` + `tryAztecFromCanvas()` (`app.js:5868`
i `5880`), używane przez `modules/dr-import.js:_tryAztecBlob`, które próbuje czterech
obrotów. Architektura jest świadoma: detekcja w przeglądarce, NRV2E i parsowanie pól
w Workerze (`handleAztec`, `/api/aztec`, przyjmuje `bytesBase64`).

**Realne znalezisko: `modules/aztec-detector.js` jest martwy w aplikacji.** Kaskada
9 strategii, do 42 prób, budżet 6 s, obsługa dowolnych kątów obrotu. Jest ładowany
w `index.html:4318`, ale wołają go **wyłącznie** `tools/dr-helper.html`
i `tools/aztec-bench.html` — narzędzia deweloperskie. Import dowodu jedzie słabszą
ścieżką. Ktoś zbudował nawet benchmark porównujący obie, ale migracja nie nastąpiła.

**Dlaczego nie wolno go podpiąć „po prostu":**
- `tryAztecFromCanvas` ustawia `CHARACTER_SET: ISO-8859-1` i odzyskuje bajty przez
  `text.charCodeAt(i) & 0xFF` — ISO-8859-1 to mapowanie 1:1 bajt↔znak, więc to działa.
- `aztec-detector.js` woła `.getText()` **bez** tej wskazówki (linie 157 i 176).
- Ładunek DR jest binarny (NRV2E), więc różnica dotyczy wierności bajtów ≥ 0x80.

**Hipoteza „wystarczy dopiąć charset" ZOSTAŁA OBALONA.** Round-trip na `@zxing/library@0.20.0`
(zainstalowanej lokalnie — `registry.npmjs.org` jest w wyjątkach proxy, więc da się to
powtórzyć bez sieci do CDN): `AztecEncoder.encode()` na ładunku z bajtami `0x80`–`0xFF`,
potem `AztecCodeReader.decode()` — wywala się na `URI malformed` **zarówno z wskazówką
ISO-8859-1, jak i bez niej**. Detekcja przechodzi, przewraca się dopiero warstwa tekstowa.
Czyli biblioteka ignoruje `CHARACTER_SET` na ścieżce Aztec, a poprawka jest głębsza niż
jedna wskazówka.

**ZNALEZIONE 12.08 PO NAPISANIU NARZĘDZIA — WADA JEST W ŚCIEŻCE PRODUKCYJNEJ, nie tylko
w detektorze.** `node tools/aztec-compare.js --selftest` generuje kod Aztec o ZNANYM ładunku
i porównuje odczytane bajty z oryginałem. Wynik na obu ścieżkach identyczny i **błędny**:

    oczekiwano: 64 00 00 00 80 81 8d 90 9f ff 41 42
    odczytano : 64 00 00 00 ac 81 8d 90 78 ff 41 42
                            ^^                ^^
    poz.4: 0x80 → 0xAC     poz.8: 0x9F → 0x78

To podpis **CP1252**: `0x80` to tam znak euro (U+20AC), a `charCodeAt(i) & 0xFF` z U+20AC
daje `0xAC`. Przeglądarka nie stosuje czystego ISO-8859-1 **mimo wymuszonej wskazówki
CHARACTER_SET**. Dotyczy to `tryAztecFromCanvas()` w `app.js`, czyli ścieżki, którą
JEDZIE PRODUKCYJNY IMPORT DOWODU — nie tylko nieużywanego detektora.

Ładunek NRV2E to dowolne bajty, więc zakres `0x80`–`0x9F` w prawdziwych dowodach
wystąpi. **HIPOTEZA DO SPRAWDZENIA:** część dowodów kwalifikowanych dotąd jako
„nieczytelne" (patrz `tools/dr-analyze-unreadable.js`, `dr-coverage-report.json`)
mogła w rzeczywistości zostać poprawnie wykryta i dopiero zniekształcona na warstwie
tekstowej. Nie potwierdzone na realnym dokumencie.

**NAPRAWIONE — przyczyna okazała się inna, niż zakładał ten akapit.** `getRawBytes()`
jest nieosiągalne: `Decoder.decode()` woła `getEncodedData()` PRZED złożeniem wyniku
i to ono rzuca `URIError`. Sedno leży głębiej: w trybie binarnym dekoder odczytuje
**dokładną wartość bajtu** (`readCode(bits, index, 8)`), po czym przepuszcza ją przez
`StringUtils.castAsNonUtf8Char` → `TextDecoder`. A **standard WHATWG mapuje etykietę
„ISO-8859-1" na windows-1252** — stąd `0x80` → U+20AC → `0xAC` i `0x9F` → U+0178 → `0x78`.
Wskazówka `CHARACTER_SET` nie ma z tym nic wspólnego, bo mapowanie robi warstwa tekstowa.

Naprawa jest odwróceniem tej tablicy: `_aztecTextToBytes()` w `app.js` mapuje 27 punktów
kodowych, w których windows-1252 różni się od ISO-8859-1, z powrotem na bajty.
Zweryfikowane `node tools/aztec-compare.js --selftest` — wynik zawiera na stałe linię
„bez naprawy", pokazującą oba zniekształcenia, więc regresja od razu rzuci się w oczy.

**Cała ścieżka DEKODOWANIA zweryfikowana end-to-end — bez zdjęcia (12.08).** `--selftest`
nie sprawdza już samych bajtów: buduje ładunek w **prawdziwym formacie DR** (nowy, 55 pól),
koduje go jako Aztec, renderuje do obrazu i przepuszcza przez pełną produkcyjną ścieżkę
obraz → Aztec → bajty → NRV2E → UTF-16LE → pola. Wynik: **17/17 pól zgodnych** na obu
ścieżkach, `format=new`. Kontrola negatywna (stara konwersja `charCodeAt & 0xFF`) na tym
samym ładunku **nie przechodzi** — a gdyby przeszła, test krzyczy „nie mierzy tego, co
deklaruje", zamiast po cichu zaświecić na zielono.

Dwie rzeczy, które to umożliwiły:
- `_decodeAztecPayload()` **wydzielone z `handleAztec`** (`worker/index.js`) — narzędzie
  wyciąga tę funkcję z pliku Workera i uruchamia **dokładnie kod produkcyjny**, zamiast
  trzymać kopię. Kopia rozjechałaby się i ukryła właśnie ten błąd, który ma wykrywać
  (precedens: dwie tablice CO2, dwie listy źródeł kreatora raportów). Kotwice ekstrakcji
  są jawne — ich brak przerywa działanie, nie powoduje cichego fallbacku.
- Kompresora NRV2E nie mamy i nie jest potrzebny: dekompresor obsługuje wariant
  **„same literały"** (bit 1 = kolejny bajt to literał) tą samą ścieżką co strumień
  z odwołaniami wstecz. Round-trip przez produkcyjny `_nrv2eDecompress()` to potwierdza.

**Efekt uboczny — pytanie o detektor częściowo rozstrzygnięte:** po naprawie konwersji
ścieżka B (`aztec-detector.js`) zwraca bajty **identyczne** ze ścieżką A. Wcześniej nie
było to wiadome; `tools/aztec-bench.html` tego nie mierzył, bo nigdy nie konwertował
wyniku z powrotem na bajty.

**Czego nadal brakuje — i tylko tego:** jednego prawdziwego **zdjęcia**. Pozostała
niewiadoma zawęziła się z „czy dekodowanie działa" do „czy **detekcja** działa na
sfotografowanym dokumencie" — perspektywa, ostrość, oświetlenie, artefakty JPEG.
Selftest używa czystego renderu, więc o tym nie mówi nic. Zdjęcie trzymaj POZA
repozytorium (dowód zawiera VIN i dane właściciela); narzędzie nic nie zapisuje,
a VIN, nr rej. i serię dowodu **maskuje na wyjściu**, żeby log dało się wkleić
do zgłoszenia bez wycieku.

    node tools/aztec-compare.js ~/Documents/taxorder-backupy/dowod.jpg

**Inter Cars nie jest tu odpowiedzią.** Ich `/pl/api/aztec/file/decode` kończy się na
VIN-ie i przekazaniu go do dostawców `[GA09, MRS7, BTR5, BTR6]` — służy identyfikacji
auta pod katalog części. DT-1 potrzebuje DMC, liczby osi i zawieszenia, czyli pełnego
ładunku dowodu, którego IC nie oddaje. Do tego stopka e-Cat niesie zastrzeżenie TecDoc
zakazujące kopiowania ich bazy.


### Otwarte / znane długi

**Dług techniczny**
- **Konto CI głównego suite (`ci-e2e.yml` job `e2e`, Playwright) nadal loguje się jako admin
  (`adamus1000@gmail.com`).** Sam Playwright E2E suite (karty pojazdów, dashboard, itd.) nie testuje
  gatingu uprawnień. To osobne od testu izolacji tenantów niżej w Zamkniętych — tamten test
  (`npm run test:isolation`) działa jako dodatkowy krok API obok głównego suite, nie zastępuje go.
  Jeśli w przyszłości powstaną testy UI wymagające zwykłej (nie-admin) roli — użyj konta
  `acichocki@mtoilet.pl` (`kierownik`/`gcon`, sekrety `TEST_EMAIL_NONADMIN`/`TEST_PASS_NONADMIN`).
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
- **Zapisane `report_configs` ze źródłem `fuel_entries`** (jeśli istnieją) po zmianie
  whitelisty zwrócą „Niedozwolone źródło danych" zamiast pustej tabeli. Te konfiguracje
  i tak nigdy nie zwracały danych — komunikat błędu jest uczciwszy niż cicha pustka, ale
  warto je przepiąć na `fuel_fills`:
  `SELECT id,name FROM report_configs WHERE source_table='fuel_entries'`

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

## WERYFIKACJA — narzędzia, które odpowiadają na inne pytanie

> Każdy wpis to realny błąd diagnostyczny z tego projektu. Zanim uznasz coś
> za sprawdzone, upewnij się, że test mierzy to, co myślisz.

### Żadne z narzędzi audytu nie widzi kodu, który aplikacja GENERUJE jako tekst

`node --check`, `syntax-check`, `xss-audit`, eslint i Playwright sprawdzają kod, który
piszemy. Jeśli funkcja **składa inny program w stringu** (bookmarklet, `new Function`,
szablon wstrzykiwany do `<script>`), ten wygenerowany kod nie przechodzi przez żadne z nich:

| Narzędzie | Co naprawdę sprawdza | Czego NIE złapie |
|-----------|----------------------|------------------|
| `node --check` / `syntax-check` | składnię `app.js` | składni stringa, który `app.js` emituje |
| `xss-audit` | wzorzec `el.innerHTML = ...` w kodzie | `innerHTML` wewnątrz literału szablonowego |
| Playwright E2E | zachowanie SPA na naszym origin | bookmarklet uruchamiany na obcej stronie |

Przykład z projektu: generator bookmarkletu DT-1 → Warszawa rzucał `SyntaxError` przy
**każdym** uruchomieniu od dnia wprowadzenia (`0000e30`), a po naprawie składni odsłonił
dwa wektory wstrzyknięcia. Cały audyt (`npm run audit:all`) świecił na zielono przez ten
cały czas. Jedynym sygnałem był 1 **błąd** eslint utopiony w 2168 ostrzeżeniach — a eslint
nie był wtedy uruchamiany w żadnym workflow.

**Pułapka w literale szablonowym:** wewnątrz `` `...` `` sekwencja `\'` **nie jest escapem** —
daje goły apostrof. Kod `onclick="fn(\'x\')"` napisany w backtickach emituje `onclick="fn('x')"`,
co zamyka string w generowanym programie. W generowanym kodzie nie używaj zagnieżdżonych
apostrofów — dawaj `data-*` + `addEventListener`.

**Pułapka `javascript:` URL:** przeglądarka **percent-dekoduje** URL przed wykonaniem, więc
`%22` w danych staje się `"` i wychodzi poza literał JSON. Ładunek zawsze przez
`encodeURIComponent()`.

**Prawdziwy test:** wyekstrahuj wygenerowany string, sparsuj go (`new Function`) i uruchom
na złośliwych danych — wzorzec w `tests/unit/warsaw-bookmarklet-test.js`. Test uznaj za
wiarygodny dopiero, gdy **upadnie na starym kodzie** (tam: 0/7 PASS przed naprawą, 7/7 po).

### Changelog migracji major (v3→v4) nie mówi nic o konkretnej wersji patch
Sprawdzenie „jakie funkcje usunięto między v3 a v4" (node_compat, legacy_assets, itd.)
odpowiada na pytanie o zgodność KODU, nie o wymagania ŚRODOWISKA konkretnej wersji
patch, którą faktycznie się instaluje. `wrangler@4.103.0` podniósł minimalny Node.js
do 22 już PO wydaniu v4 — nie ma tego w ogólnym przewodniku migracji v3→v4, tylko
w komunikacie błędu przy starcie (`wrangler --version`).

Przykład z projektu: `deploy-worker.yml` i `nightly-report.yml` ustawiały Node 20
(spełniało wymagania v4 z dnia migracji), przypięcie na `wrangler@4.103.0` (nowszy
patch) zepsuło deploy na produkcję natychmiast po merge.

**Prawdziwy test:** po zmianie wersji narzędzia CLI, uruchom je raz w docelowym
środowisku CI (albo sprawdź jego własny `engines`/komunikat startowy), nie tylko
przewodnik migracji między wersjami major.

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

### npx i npm w PowerShell
Polityka wykonywania blokuje niepodpisany `npx.ps1` — **i tak samo `npm.ps1`**.
`npm run <cokolwiek>` kończy się `UnauthorizedAccess`, nie błędem skryptu.
Używać `npm.cmd run ...` / `npx.cmd`, albo `.\node_modules\.bin\<narzędzie>.cmd`.
**Nie zmieniać `Set-ExecutionPolicy`.**

Dla narzędzi z `tools/` najprościej ominąć npm w całości — `node` to zwykły plik
wykonywalny, polityka go nie dotyczy:
```powershell
node tools/autotest/d1-schema-diff.js
```

### Pobranie jednego pliku z brancha bez przełączania się na niego
Gdy w drzewie roboczym są niezacommitowane zmiany, `git checkout <branch>` przerwie
operację. Żeby wziąć **pojedynczy plik** z innego brancha, nie ruszając reszty:
```powershell
git fetch origin <branch>
git checkout origin/<branch> -- sciezka/do/pliku.js
```
Nie przełącza brancha i nie nadpisuje niepowiązanych zmian. **Nie używać** do tego
`git show ... > plik` w PowerShellu — operator `>` zapisuje w UTF-16LE i psuje plik.

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
   `rate-reader.js` usunięty (`d2a6d00`, tabela `tax_rates` istniała tylko w Supabase);
   stawki gminne obsługuje `window.GminyRates`.
   **Backend to wyłącznie D1 przez Worker.**
8. **`ocr-service/` nie jest podłączony** — mikroserwis z kaskadą Aztec+NRV2E istnieje w repo,
   ale żaden plik aplikacji się do niego nie odwołuje. OCR dokumentów idzie przez
   `/api/ai/ocr`, `/api/ai/ocr-doc` i `/api/bulk/*` (Groq Vision). Aztec daje 100% pewności
   danych — docelowo powinien być pierwszym krokiem dla dowodów rejestracyjnych.
9. **Izolacja tenanta** — każde zapytanie do tabeli tenantowej musi mieć `company_id=?`.
   Wzorzec dla operacji po `id`: najpierw `SELECT ... WHERE id=? AND company_id=?`, przy braku
   wiersza `404`; albo `WHERE id=? AND company_id=?` bezpośrednio w `UPDATE`/`DELETE`
   i sprawdzenie `r.meta.changes === 0`. Audyt: 625 zapytań, 99,4% ze scopem.
