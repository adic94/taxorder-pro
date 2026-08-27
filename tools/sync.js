#!/usr/bin/env node
/**
 * MOST MIĘDZY DWOMA KOMPUTERAMI — jedno polecenie w każdą stronę.
 *
 *     node tools/sync.js                  # raport: co mam, co ma origin, czego brakuje
 *     node tools/sync.js --pobierz        # ściągnij zmiany z drugiego komputera
 *     node tools/sync.js --wyslij         # bramki + commit + push (NIGDY na main)
 *     node tools/sync.js --wyslij --opis "co zrobiłem"
 *
 * DLACZEGO TO NIE JEST AUTOMAT DZIAŁAJĄCY W TLE. Kuszące jest postawić watcher, który
 * sam commituje i pcha każdą zmianę — „ciągła synchronizacja". W TYM repozytorium taki
 * automat jest wdrożeniem na produkcję: push do `main` uruchamia `deploy-worker.yml`
 * (zmiany w `worker/**`) albo przebudowę Cloudflare Pages (cała reszta). Automat pchałby
 * kod w połowie edycji, przed bramkami, wprost na żywy system podatkowy. Dlatego wysyłka
 * jest ZAWSZE świadomym poleceniem, a `main` jest dla niej zamknięty.
 *
 * DLACZEGO GIT, A NIE WŁASNY PROTOKÓŁ. Oba komputery mają już wspólny origin na GitHubie.
 * Własny kanał plik-do-pliku byłby gorszym gitem: bez historii, bez rozwiązywania
 * konfliktów, bez możliwości cofnięcia. To narzędzie nie zastępuje gita — usuwa z niego
 * kroki, w których łatwo o pomyłkę przy pracy na dwóch maszynach naraz.
 *
 * DLACZEGO NODE, A NIE .PS1. Polityka wykonywania Windowsa blokuje niepodpisane skrypty
 * `.ps1` (dotyczy też `npm.ps1`). `node` jest zwykłym plikiem wykonywalnym — uruchomi się
 * bez zmieniania ustawień systemu. Ten sam powód co w `tools/uruchom-wszystko.js`.
 *
 * ZASADA RAPORTOWANIA: brak błędu NIE jest dowodem sukcesu. Po wysyłce narzędzie
 * ODCZYTUJE stan zdalnej gałęzi i porównuje go z lokalnym SHA — nie poprzestaje na tym,
 * że `git push` nie krzyknął.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

/**
 * Gałęzie, na które to narzędzie NIE wyśle. `main` jest wdrożeniem na produkcję —
 * zmiany trafiają tam przez pull request i przegląd, nie przez skrypt synchronizujący
 * dwa komputery. Lista może wyłącznie rosnąć.
 */
const GALEZIE_CHRONIONE = ['main', 'master'];
const galezChroniona = g => GALEZIE_CHRONIONE.includes(String(g || '').trim());

/**
 * NIE UŻYWAJ `shell: true`. Na Windowsie `spawnSync` z shellem składa wiersz polecenia,
 * łącząc argumenty SPACJAMI bez cudzysłowów — ścieżka `...\Program flotowy\...` rozpada
 * się na spacji i git dostaje śmieci. Ten projekt stracił na tym diagnozę (patrz
 * `tests/unit/tooling-windows-test.js`).
 */
function git(...args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return {
    kod: r.status === null ? 2 : r.status,
    out: (r.stdout || '').trim(),
    err: (r.stderr || '').trim(),
  };
}

function naglowek(t) { console.log(`\n${B(t)}\n${D('─'.repeat(60))}`); }

// --- [0] czy to w ogóle repozytorium ---------------------------------------
if (git('rev-parse', '--git-dir').kod !== 0) {
  console.error(R('To nie jest katalog repozytorium git. Wejdź do katalogu projektu.'));
  process.exit(2);
}

const POBIERZ = process.argv.includes('--pobierz');
const WYSLIJ  = process.argv.includes('--wyslij');
const iOpis   = process.argv.indexOf('--opis');
const OPIS    = iOpis > -1 ? process.argv[iOpis + 1] : null;

const galaz = git('rev-parse', '--abbrev-ref', 'HEAD').out;
const komputer = os.hostname();

console.log(`\n${B('MOST — synchronizacja między komputerami')}`);
console.log(D(`  komputer: ${komputer}   gałąź: ${galaz}`));

// --- [1] stan lokalny -------------------------------------------------------
naglowek('[1] Zmiany lokalne');

const brudne = git('status', '--porcelain').out.split('\n').filter(Boolean);
if (!brudne.length) {
  console.log(`  ${G('✓')} drzewo robocze czyste`);
} else {
  console.log(`  ${Y('●')} ${brudne.length} zmienionych plików:`);
  for (const l of brudne.slice(0, 15)) console.log(D(`      ${l}`));
  if (brudne.length > 15) console.log(D(`      … i ${brudne.length - 15} więcej`));
}

// --- [2] stan wobec drugiego komputera --------------------------------------
naglowek('[2] Stan wobec origin (drugi komputer pisze tam samo)');

const fetch = git('fetch', 'origin', galaz);
if (fetch.kod !== 0) {
  console.log(`  ${Y('●')} nie udało się odpytać origin — pracujesz na danych z ostatniego pobrania`);
  console.log(D(`      ${fetch.err.split('\n')[0] || 'brak szczegółów'}`));
} else {
  console.log(`  ${G('✓')} odpytano origin/${galaz}`);
}

let przede = 0, zatem = 0;
const licz = git('rev-list', '--left-right', '--count', `origin/${galaz}...HEAD`);
if (licz.kod === 0) {
  const [a, b] = licz.out.split(/\s+/).map(Number);
  zatem = a || 0;   // commity, których NIE MAM (są na origin)
  przede = b || 0;  // commity, których nie ma origin (mam lokalnie)
}

if (!zatem && !przede) console.log(`  ${G('✓')} zsynchronizowane — ten sam stan po obu stronach`);
if (zatem) console.log(`  ${Y('↓')} ${zatem} commitów czeka na origin (drugi komputer coś zrobił) — ${B('--pobierz')}`);
if (przede) console.log(`  ${Y('↑')} ${przede} commitów masz tylko lokalnie — ${B('--wyslij')}`);
if (zatem && przede) console.log(`  ${R('⚠')}  rozjazd w OBIE strony — najpierw --pobierz, potem --wyslij`);

// --- [3] czego git nie przenosi ---------------------------------------------
naglowek('[3] Czego git NIE przenosi (trzeba skopiować ręcznie)');

const envPath = path.join(ROOT, '.env');
if (!fs.existsSync(envPath)) {
  console.log(`  ${R('✗')} .env nie istnieje — ${D('npm.cmd run env:setup')}`);
} else {
  // Nigdy nie wypisujemy WARTOŚCI — tylko nazwy kluczy i to, czy są wypełnione.
  // Wynik ma dać się wkleić do zgłoszenia bez wycieku poświadczeń.
  const tresc = fs.readFileSync(envPath, 'utf8');
  const puste = tresc.split(/\r?\n/)
    .filter(l => /^[A-Z_][A-Z0-9_]*=/.test(l))
    .filter(l => l.split('=').slice(1).join('=').trim() === '')
    .map(l => l.split('=')[0]);
  if (!puste.length) console.log(`  ${G('✓')} .env — wszystkie klucze wypełnione`);
  else console.log(`  ${Y('●')} .env — puste klucze: ${puste.join(', ')}`);
}

console.log(fs.existsSync(path.join(ROOT, 'node_modules'))
  ? `  ${G('✓')} node_modules obecne`
  : `  ${R('✗')} brak node_modules — ${D('npm.cmd ci')}`);

const backupy = path.join(os.homedir(), 'Documents', 'taxorder-backupy');
console.log(fs.existsSync(backupy)
  ? `  ${G('✓')} ${backupy}`
  : `  ${Y('●')} brak ${backupy} ${D('— dane produkcyjne, świadomie poza repo')}`);

// --- [4] pobranie -----------------------------------------------------------
if (POBIERZ) {
  naglowek('[4] Pobieranie zmian z origin');
  if (brudne.length) {
    console.log(`  ${R('✗')} masz niezacommitowane zmiany — pobranie mogłoby je nadpisać.`);
    console.log(D('      Najpierw je wyślij (--wyslij) albo odłóż (git stash).'));
    process.exit(1);
  }
  // --ff-only: przy rozjeździe ODMAWIA zamiast tworzyć commit scalający po cichu.
  const p = git('pull', '--ff-only', 'origin', galaz);
  if (p.kod !== 0) {
    console.log(`  ${R('✗')} pobranie odrzucone — gałęzie się rozjechały`);
    console.log(D(`      ${p.err.split('\n').slice(0, 3).join('\n      ')}`));
    console.log(D('      Rozstrzygnij ręcznie: git pull --rebase origin ' + galaz));
    process.exit(1);
  }
  console.log(`  ${G('✓')} ${p.out.split('\n')[0] || 'aktualne'}`);
  console.log(D(`      HEAD: ${git('rev-parse', '--short', 'HEAD').out}`));
}

// --- [5] wysyłka ------------------------------------------------------------
if (WYSLIJ) {
  naglowek('[5] Wysyłka na origin');

  if (galezChroniona(galaz)) {
    console.log(`  ${R('✗')} ODMOWA — gałąź ${B(galaz)} jest chroniona.`);
    console.log(D('      Push do main jest WDROŻENIEM NA PRODUKCJĘ (deploy-worker.yml,'));
    console.log(D('      Cloudflare Pages). Zmiany trafiają tam przez pull request.'));
    console.log(D(`      Przełącz się na gałąź roboczą: git checkout -b claude/<temat>`));
    process.exit(1);
  }

  // Bramki PRZED wysyłką, nie po. 22 pliki, ~20 s, bez sieci — tanio wobec kosztu
  // wypchnięcia zepsutego kodu na drugi komputer i do CI.
  console.log(D('  Uruchamiam bramki jednostkowe przed wysyłką…\n'));
  const bramki = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'autotest', 'run-gates.js')],
                           { cwd: ROOT, stdio: 'inherit' });
  if (bramki.status !== 0) {
    console.log(`\n  ${R('✗')} bramki nie przechodzą — wysyłka wstrzymana.`);
    console.log(D('      Napraw je albo wyślij świadomie: git push -u origin ' + galaz));
    process.exit(1);
  }

  if (brudne.length) {
    const opis = OPIS || `sync z ${komputer}: ${brudne.length} plików`;
    const add = git('add', '-A');
    if (add.kod !== 0) { console.log(`  ${R('✗')} git add: ${add.err}`); process.exit(1); }
    const c = git('commit', '-m', opis);
    if (c.kod !== 0) { console.log(`  ${R('✗')} git commit: ${c.err || c.out}`); process.exit(1); }
    console.log(`  ${G('✓')} commit: ${D(opis)}`);
  } else {
    console.log(D('  Brak nowych zmian do zacommitowania.'));
  }

  const push = git('push', '-u', 'origin', galaz);
  if (push.kod !== 0) {
    console.log(`  ${R('✗')} push odrzucony`);
    console.log(D(`      ${push.err.split('\n').slice(0, 4).join('\n      ')}`));
    process.exit(1);
  }

  // POTWIERDZENIE ODCZYTEM, nie brakiem błędu. `git push` potrafi zakończyć się zerem
  // w sytuacjach, w których zdalna gałąź nie wskazuje na nasz commit.
  git('fetch', 'origin', galaz);
  const lokalny = git('rev-parse', 'HEAD').out;
  const zdalny = git('rev-parse', `origin/${galaz}`).out;
  if (lokalny && lokalny === zdalny) {
    console.log(`  ${G('✓')} origin/${galaz} = ${lokalny.slice(0, 7)} ${D('(potwierdzone odczytem)')}`);
  } else {
    console.log(`  ${R('✗')} push nie zgłosił błędu, ale origin ma INNY commit:`);
    console.log(D(`      lokalnie ${lokalny.slice(0, 7)}  ≠  origin ${zdalny.slice(0, 7)}`));
    process.exit(1);
  }
}

// --- [6] co dalej -----------------------------------------------------------
if (!POBIERZ && !WYSLIJ) {
  naglowek('Co dalej');
  if (zatem) console.log(`  ${B('node tools/sync.js --pobierz')}  ${D('— weź to, co zrobił drugi komputer')}`);
  if (brudne.length || przede) console.log(`  ${B('node tools/sync.js --wyslij')}   ${D('— wyślij swoją pracę')}`);
  if (!zatem && !brudne.length && !przede) console.log(D('  Nic do zrobienia — obie strony mają ten sam stan.'));
}
console.log('');

module.exports = { galezChroniona, GALEZIE_CHRONIONE };
