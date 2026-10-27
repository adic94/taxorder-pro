# Czwarty most — telefon → VS Code (przeniesione z CLAUDE.md bez zmian treści)


Cel: sterować projektem z telefonu niezależnie od tego, czy MT0268/HP są w danej chwili
włączone. Dwa mechanizmy, jeden wybór po stronie użytkownika w danej chwili — nie
automat przełączający się sam, bo nie ma z tej sesji (w chmurze) sposobu sprawdzić,
czy dany komputer żyje.

**A) Komputer włączony → VS Code Remote Tunnels (dostęp do TEGO konkretnego dysku/node/wrangler).**

Jednorazowo, na KAŻDYM komputerze osobno (MT0268 i HP mają różne tunele, różne nazwy):
1. W VS Code zaloguj się kontem GitHub (ikona konta, dolny lewy róg → *Sign in*) — to
   samo konto autoryzuje potem dostęp z telefonu.
2. Command Palette (`Ctrl+Shift+P`) → **„Remote Tunnels: Turn on Remote Tunnel Access"**
   — VS Code poprosi o nazwę urządzenia (np. `mt0268`, `hp`) i zaloguje przez GitHub.
3. Żeby tunel działał także przy zamkniętym oknie VS Code (i wracał po restarcie
   Windows) — w terminalu: `code tunnel service install`. Bez tego trzeba by ręcznie
   odpalać `code tunnel` za każdym razem, zanim telefon się połączy.
4. Z telefonu: `https://vscode.dev/tunnel/<nazwa-urządzenia>` w przeglądarce (albo
   apka **Visual Studio Code** z App Store/Play, ma wbudowaną listę tuneli) — pełny
   VS Code + terminal na TYM komputerze, z jego plikami i zainstalowanym tam
   `node`/`wrangler`/`git`.

Warunek: komputer musi być włączony i online. Wyłączony/uśpiony = tunel niedostępny —
to jest właśnie granica, na której wchodzi opcja B.

**B) Komputer niedostępny → GitHub Codespaces (w pełni w chmurze GitHub, niezależnie od MT0268/HP).**

Repo ma gotową konfigurację `.devcontainer/devcontainer.json` (Node 22 — poprawione
01.09, wcześniej stał tam Node 20 i `wrangler deploy` padałby tym samym błędem, co
opisany niżej w PUŁAPKACH „Node ≥22" hotfix `deploy-worker.yml`). Z telefonu:
`github.com/adic94/taxorder-pro` → **Code** (zielony przycisk) → zakładka
**Codespaces** → **Create codespace on main**. `postCreateCommand` sam odpala
`npm install` (ciągnie lokalnego `wrangler` z `package.json` do `node_modules/.bin` —
nic do doinstalowania globalnie) + Playwright. Porty `3000`/`8787` są już
w `forwardPorts`, więc `npm run serve` / `wrangler dev` mają gotowy podgląd w przeglądarce
telefonu. `wrangler login`/`wrangler deploy` wymagają tego samego potwierdzenia OAuth
w przeglądarce, co lokalnie — Codespaces przekierowuje to poprawnie, nic dodatkowego
nie trzeba konfigurować.

Limit darmowy Codespaces (konto free): rzędu 60 core-hours/mies. — do sprawdzenia
w `github.com/settings/billing` przy regularnym użyciu, nie tylko okazjonalnym z telefonu.

**Czego ten most NIE robi:** nie synchronizuje automatycznie między A i B — to dwa
niezależne środowiska (dysk lokalny kontra kontener Codespaces), każde ze swoim stanem
niezacommitowanym. `git push`/`git pull` jak zwykle jest jedynym mostem MIĘDZY nimi,
tak samo jak między MT0268 a HP (`tools/sync.js`, wyżej).

