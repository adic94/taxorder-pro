# WERYFIKACJA — narzędzia, które odpowiadają na inne pytanie

> Przeniesione z `CLAUDE.md` 2026-10-27 bez zmian treści, żeby nie ładować tego przy każdej wiadomości.
> Czytaj na żądanie (grep po nagłówkach), nie w całości.

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

### Rekord w odpowiedzi nie dowodzi, że Twój filtr zadziałał

API, które nie zna parametru, zwykle go **ignoruje**, a nie odrzuca. Odpowiedź wygląda
wtedy identycznie jak trafienie: HTTP 200, komplet pól, poprawne typy, sensowne wartości.
Przy zapytaniu o jeden rekord (`limit=1`) dostajesz po prostu pierwszy rekord ze zbioru
i nie masz jak tego odróżnić od wyniku wyszukiwania.

Przykład z projektu: `api.cepik.gov.pl/pojazdy` z `numer-rejestracyjny=WZ003EY` zwrócił
toyotę corollę zarejestrowaną 2026-01-02, podczas gdy pod tym numerem mamy mercedesa
sprintera z przebiegiem 230 998 km. Drugi numer, inne okno — znowu rekord z pierwszych
dni okna. 68 pól, zero błędów, dane całkowicie nie te. Przebieg na całej flocie
przypisałby cudze dane do 876 pojazdów, nie do wykrycia po fakcie.

**Prawdziwy test — jedno dodatkowe zapytanie, dwa warianty:**
- ten sam zakres, **inna wartość filtra**: identyczny rekord = filtr jest martwy;
- albo zapytanie **bez filtra**: jeśli zwraca to samo, filtr nic nie zawężał.

Dopiero **różne** rekordy dla różnych wartości dowodzą, że parametr działa. Wynik
porównaj też z tym, co już wiesz o obiekcie (marka, model, rocznik) — rejestr może
zwrócić prawdziwe dane **innego** pojazdu, bo tablice bywają przenoszone przy sprzedaży.

Ta kontrola jest wbudowana w `tools/cepik-batch.js`: przed przebiegiem odpytuje dwa różne
numery i **odmawia pracy**, gdy zwrócą ten sam rekord.

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

### `&&` nie działa w PowerShell 5.1 — i to błąd PARSOWANIA, nie wykonania
Windows PowerShell 5.1 (domyślny na Windowsie) nie zna `&&` ani `||` jako separatorów —
te operatory doszły dopiero w PowerShell 7. Komunikat:

    The token '&&' is not a valid statement separator in this version.

**Pułapka jest w tym, że to błąd parsera:** wywala się CAŁA linia, więc nie wykonuje się
nawet pierwsze polecenie. Łatwo pomyśleć „pierwsze przeszło, drugie padło" i szukać
przyczyny nie tam, gdzie trzeba.

```powershell
git checkout <branch>        # osobne linie
git pull
```
`;` też zadziała, ale ma inną semantykę niż `&&` — uruchamia kolejne polecenie
**niezależnie od tego, czy poprzednie się powiodło**. Przy sekwencjach typu
„checkout, potem pull" to potrafi zrobić pulla na złej gałęzi.

Dotyczy to także instrukcji, które generujemy dla użytkownika: pisząc polecenia dla
tego projektu, zakładaj PowerShell 5.1, nie bash.

### PowerShell: `^` to NIE jest kontynuacja linii, a `stash@{0}` wymaga cudzysłowów

Dwa błędy popełnione przy pisaniu poleceń dla tego projektu 19.08 — oba wyglądają jak
literówka użytkownika, a są błędem autora polecenia.

**Kontynuacja linii to backtick `` ` ``, nie `^`.** `^` działa w `cmd.exe`; w PowerShellu
daje `Missing expression after unary operator '--'`, bo kolejna linia zaczyna się od `--`.

```powershell
node tools/aztec-compare.js --katalog "..." `
  --zapisz-prawde "..."
```

**`{`…`}` po `@` to literał tablicy asocjacyjnej.** `git stash show -p stash@{0}` rozsypuje
się na `Too many revisions specified: 'stash@' 'MAA=' 'xml' 'text'`. Referencje stasha
i inne argumenty z nawiasami klamrowymi zawsze w cudzysłowach:

```powershell
git stash show -p "stash@{0}"
git stash drop "stash@{0}"
```

**Osobno, nie PowerShell:** `git diff <plik>` pokazuje wyłącznie zmiany NIEZASTAGOWANE.
Po `git stash pop` zmiany wracają zastagowane (`M ` — litera w PIERWSZEJ kolumnie
`git status --short`), więc `git diff` pokazuje pustkę przy niepustym drzewie roboczym.
Do obejrzenia: `git diff --cached <plik>`.

### `CLOUDFLARE_API_TOKEN` w środowisku PRZESŁANIA `wrangler login`

Gdy ta zmienna jest ustawiona, wrangler uwierzytelnia się **nią** i całkowicie ignoruje
logowanie OAuth — także po świeżym `wrangler login`. Token o wąskim zakresie (np.
`Workers AI → Read`, utworzony do `tools/cf-ocr-test.js`) wystarcza na inferencję, ale
`wrangler deploy` i `wrangler tail` odbijają się wtedy od:

    Authentication error [code: 10000]

Komunikat wygląda na wygasłe logowanie i wysyła w ślepy zaułek — `wrangler login` niczego
nie naprawi, dopóki zmienna jest ustawiona. Zdjęcie jej dotyczy TYLKO bieżącego okna:

```powershell
Remove-Item Env:\CLOUDFLARE_API_TOKEN
.\node_modules\.bin\wrangler.cmd login
```

`tools/uruchom-wszystko.js` usuwa tę zmienną ze środowiska podprocesów i ostrzega, gdy ją
wykryje. **Nie dodawaj `dotenv` do narzędzi wołających wranglera** — wstrzyknięcie tokenu
z `.env` odtworzy dokładnie ten problem. `cf-ocr-test.js` czyta `.env` celowo: woła REST
bezpośrednio, nie przez wranglera.

**AKTUALIZACJA 24.08 — problem wraca BEZ żadnego `dotenv` w narzędziach.** `wrangler@4.120.1`
sam wczytuje `.env` z bieżącego katalogu i traktuje `CLOUDFLARE_API_TOKEN` stamtąd jako
nadpisanie logowania OAuth — dokładnie tak samo, jakby zmienna była ustawiona w systemie.
Objawy inne niż wyżej: `Remove-Item Env:\CLOUDFLARE_API_TOKEN` mówi „does not exist" (bo
zmiennej faktycznie nie ma w środowisku), a `wrangler login` kończy się jawnym:

    You are logged in with an API Token. Unset the CLOUDFLARE_API_TOKEN in the environment to log in via OAuth.

Winny jest `.env` w katalogu projektu (token do `cf-ocr-test.js`, patrz `.env.example`) —
sam jego OBECNOŚĆ z tym kluczem wystarcza, żaden inny proces nie musi go czytać. Naprawa:
zakomentować linię `CLOUDFLARE_API_TOKEN=` w `.env` (zostawić resztę zmiennych — reszta
narzędzi, np. Playwright, dalej ich potrzebuje), odkomentowywać tylko na czas realnego
uruchamiania `cf-ocr-test.js`. Samo przeniesienie/usunięcie `.env` też działa, ale zabiera
też `TEST_EMAIL`/`TEST_PASS` innym narzędziom — więc lepiej zakomentować jedną linię niż
ruszać cały plik.

### npx i npm w PowerShell
Polityka wykonywania blokuje niepodpisany `npx.ps1` — **i tak samo `npm.ps1`**.
`npm run <cokolwiek>` kończy się `UnauthorizedAccess`, nie błędem skryptu.
Używać `npm.cmd run ...` / `npx.cmd`, albo `.\node_modules\.bin\<narzędzie>.cmd`.
**Nie zmieniaj `Set-ExecutionPolicy` na stałe** (zakres `CurrentUser` ani `LocalMachine`) — to zdejmuje zabezpieczenie z całego systemu, żeby obejść jedną niedogodność.
Wyjątek, który jest w porządku: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` dotyczy **wyłącznie bieżącego okna** i znika po jego zamknięciu. Nic nie zostaje w rejestrze. Jeśli i tak wolisz nie ruszać polityki — wariant z `.cmd` działa zawsze i niczego nie zmienia.

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

