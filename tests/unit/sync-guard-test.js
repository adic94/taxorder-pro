#!/usr/bin/env node
/**
 * Strażnik mostu między komputerami — `tools/sync.js` NIE MOŻE wysłać na `main`.
 *
 * DLACZEGO TO JEST BRAMKA, A NIE KOMENTARZ. Push do `main` w tym repozytorium jest
 * wdrożeniem na produkcję: `deploy-worker.yml` wdraża Workera przy zmianach w `worker/**`,
 * a Cloudflare Pages przebudowuje frontend przy każdym innym pliku. Narzędzie, które
 * synchronizuje dwa komputery „jednym poleceniem", jest dokładnie tym rodzajem wygody,
 * przy której ktoś kiedyś uruchomi je na `main` — i wdroży stan pośredni.
 *
 * Sprawdzane są DWIE rzeczy naraz, bo każda osobno daje się obejść:
 *   - że funkcja odmawiająca istnieje i zwraca prawdę dla `main`,
 *   - że w kodzie odmowa stoi PRZED wywołaniem `push` (funkcja poprawna, ale wywołana
 *     po pushu, jest ozdobą).
 *
 * Plus kontrola przebiegu bez flag: raport ma być czysto odczytowy i nie może ruszyć
 * drzewa roboczego.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PLIK = path.join(ROOT, 'tools', 'sync.js');

let pass = 0, fail = 0;
const ok = (w, opis) => { if (w) { pass++; console.log(`  ✓ ${opis}`); } else { fail++; console.log(`  ✗ ${opis}`); } };

console.log('\nStrażnik mostu — tools/sync.js\n');

ok(fs.existsSync(PLIK), 'tools/sync.js istnieje');
const src = fs.readFileSync(PLIK, 'utf8');

// --- [1] sama funkcja odmawiająca -------------------------------------------
const { galezChroniona, GALEZIE_CHRONIONE } = require(PLIK);

ok(typeof galezChroniona === 'function', 'eksportuje galezChroniona()');
ok(galezChroniona('main') === true, 'main jest chroniony');
ok(galezChroniona('master') === true, 'master jest chroniony');
ok(galezChroniona('  main  ') === true, 'main z białymi znakami też jest chroniony');
ok(galezChroniona('claude/vs-code-connection-p5c6dq') === false, 'gałąź robocza przechodzi');
ok(Array.isArray(GALEZIE_CHRONIONE) && GALEZIE_CHRONIONE.includes('main'), 'lista chronionych zawiera main');

// --- [2] odmowa stoi PRZED pushem -------------------------------------------
// Funkcja zwracająca poprawną odpowiedź, ale wywołana po wysyłce, nic nie chroni.
const iGuard = src.indexOf('galezChroniona(galaz)');
const iPush  = src.indexOf("git('push'");
ok(iGuard > -1, 'kod sprawdza gałąź przed wysyłką');
ok(iPush > -1, 'kod w ogóle wykonuje push');
ok(iGuard > -1 && iPush > -1 && iGuard < iPush, 'sprawdzenie gałęzi POPRZEDZA push');

// --- [3] bramki przed wysyłką, nie po ---------------------------------------
const iBramki = src.indexOf('run-gates.js');
ok(iBramki > -1, 'wysyłka uruchamia bramki jednostkowe');
ok(iBramki > -1 && iPush > -1 && iBramki < iPush, 'bramki POPRZEDZAJĄ push');

// --- [4] pułapka Windowsa ----------------------------------------------------
// spawnSync z shell:true skleja argumenty spacjami bez cudzysłowów, a ścieżka projektu
// na komputerze właściciela zawiera spację („Program flotowy"). Ta sama klasa błędu
// fałszowała już wynik `uruchom-wszystko.js` — patrz tests/unit/tooling-windows-test.js.
//
// SPRAWDZAMY KOD, NIE PROZĘ. Pierwsza wersja tej asercji szukała wzorca w całym pliku
// i trafiła we WŁASNY komentarz sync.js, który przed `shell: true` ostrzega — bramka
// świeciła na czerwono przy poprawnym narzędziu. Komentarze lecą precz przed pomiarem.
const kod = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!/shell:\s*true/.test(kod), 'nie używa shell:true (spacje w ścieżce na Windowsie)');
ok(/shell:\s*true/.test(src), 'kontrola bramki: wzorzec występuje w pliku (w komentarzu) — pomiar patrzy na kod');

// --- [5] raport bez flag niczego nie zmienia --------------------------------
const przed = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout;
const r = spawnSync(process.execPath, [PLIK], { cwd: ROOT, encoding: 'utf8' });
const po = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout;
ok(r.status === 0, 'przebieg bez flag kończy się kodem 0');
ok(przed === po, 'przebieg bez flag NIE rusza drzewa roboczego');
ok(/MOST/.test(r.stdout || ''), 'przebieg bez flag wypisuje raport');

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
