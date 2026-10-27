# CI/CD i narzędzia deweloperskie

> Przeniesione z `CLAUDE.md` 2026-10-27 bez zmian treści, żeby nie ładować tego przy każdej wiadomości.
> Czytaj na żądanie (grep po nagłówkach), nie w całości.

## CI/CD — GITHUB ACTIONS

### ⚠️ BUDŻET MINUT JEST CIASNY — repo jest PRYWATNE, więc każda minuta idzie z pakietu

Pakiet: **2000 min/mies.** Wyczerpał się 12.08.2026, **12. dnia miesiąca**. Reset —
pierwszy dzień cyklu rozliczeniowego (wtedy: 1 września).

**Jak wygląda wyczerpanie limitu:** przebiegi startują i padają po 3–5 sekundach,
z `runner_id: 0` i pustym `runner_name`. Wygląda to jak awaria CI albo błąd w YAML-u —
i tak też to początkowo zdiagnozowano. Zanim zaczniesz szukać przyczyny w kodzie,
sprawdź https://github.com/settings/billing. Rozróżnienie jest istotne, bo dwie
przyczyny wyglądają identycznie: **wyczerpane minuty** (czekaj do resetu) i **spending
limit na `$0`** (podniesienie odblokowuje natychmiast).

**Rachunek, który to spowodował** (zmierzony 12.08 — `run_duration_ms` z API, nie szacunek):
jeden przebieg `ci-e2e` to **~28 min w JEDNYM jobie**, a GitHub nalicza per job
z zaokrągleniem w górę.

| Harmonogram | Zużycie/mies. |
|---|---|
| `ci-e2e` nightly, **codziennie** | 840 min — **42% pakietu** |
| `health-check` co 4 h | 180 min |
| `nightly-report` (4 joby) | 120 min |
| **razem, zanim ktokolwiek cokolwiek wypchnie** | **1140 min = 57% limitu** |

Naprawione przez zejście z nocnego E2E na **tygodniowy** (poniedziałki) — harmonogramy
schodzą do 412 min (21%), na PR-y zostaje 56 przebiegów zamiast 30.

> **Dodając cokolwiek do `schedule:`, policz najpierw koszt miesięczny.** Cron co 4 h
> to 180 przebiegów, a każdy job kosztuje minimum minutę, choćby trwał 5 sekund.
> `health-check` zostawiono świadomie nietknięty: to jedyne, co pilnuje działającej
> produkcji. Oszczędzaj na teście, który się powiela, nie na czujniku, który jako
> jedyny coś widzi.

**`paths-ignore` na `pull_request` jest bezpieczne TYLKO dopóki nie ma wymaganych
checków.** Przy włączonej ochronie gałęzi PR dotykający wyłącznie plików z listy
zawiśnie na „Expected — waiting for status" i nie da się go zmergować. Stan na 12.08:
`main` ma `protected: false`, więc problem nie występuje — ale zakładając ochronę
gałęzi, wróć tutaj.

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

### Slash commands — spakowane procedury (`.claude/commands/`)

| Komenda | Kiedy |
|---|---|
| `/akt-prawny <czego szukasz>` | **Potrzebujesz treści przepisu.** ISAP **odbija automaty** (302 sam na siebie w nieskończoność) — działają `dziennikustaw.gov.pl` / `monitorpolski.gov.pl` + API ELI do sprawdzenia, czy akt **obowiązuje**. Zawiera dwie pułapki wyciągania tabel, obie zmierzone: niekonsekwentny separator dziesiętny i konieczność weryfikacji numeracji Lp |
| `/ocr-diagnoza <pole albo plik>` | **Pole DR się nie wyciąga.** Najpierw pomiar pokrycia, potem surowe boxy (`tools/dr-ocr-boxes.js`) — bo „OCR nie odczytał" i „parser nie dopasował" wyglądają identycznie, a wymagają innych napraw. Strojenie lokalne (`ocr-service/stroj_lokalnie.py`) skraca pętlę z ~14 min do ~10 s |

Pozostałe: `/audyt`, `/bezpieczenstwo`, `/migracja`, `/modul`, `/przed-mergem`,
`/status`, `/wdroz`.

### Audyt własny (tools/autotest/)
```bash
npm run audit:all       # syntax + XSS + i18n + SW cache + WSZYSTKIE bramki jednostkowe
npm run test:gates      # same bramki z tests/unit/ (19 plików, 154 asercje, ~20 s)
npm run xss-audit       # szuka innerHTML bez esc()
npm run sw-check        # weryfikuje CACHE_NAME po zmianach index.html
npm run migration-check # sprawdza czy schematy są spójne
```

**`test:gates` nie ma własnej listy bramek — czyta katalog `tests/unit/`.** Do 18.08.2026
`audit:all` uruchamiał **3 z 13** bramek: lista żyła w dwóch miejscach naraz (łańcuch `&&`
w `package.json` i kroki w `ci-js.yml`) i po cichu się rozjechała. Dopóki CI działa, to
tylko niewygoda — ale od 12.08 minuty Actions są wyczerpane, więc bramki lokalne są całą
siecią bezpieczeństwa, a ta sieć miała 23% pokrycia i wyglądała na zieloną.

Dlatego `run-gates.js` sprawdza też **spójność w drugą stronę**: plik w `tests/unit/`
nieobecny w `ci-js.yml` to porażka (bramka poza CI nie zadziała na PR-ach), tak samo krok
w `ci-js.yml` wskazujący na nieistniejący plik. Dodając bramkę, dopisz krok do `ci-js.yml` —
sam runner ci o tym przypomni. Uruchamia wszystkie do końca, także po pierwszej porażce,
i przedrukowuje wyjście tych, które padły.

Zweryfikowane negatywnie na wszystkich trzech warunkach: bramka celowo padająca, bramka
poza `ci-js.yml`, krok CI bez pliku — każdy daje kod wyjścia 1, a po przywróceniu 0.

---

