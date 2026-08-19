#!/usr/bin/env node
/**
 * Strażnik: narzędzia z `tools/` działają na Windowsie, w ścieżce ZE SPACJĄ,
 * na plikach z zakończeniami CRLF.
 *
 * DLACZEGO ISTNIEJE. Dwa błędy zgłoszone 19.08.2026 przez użytkownika, oba dające
 * FAŁSZYWY ODCZYT zamiast awarii — czyli najgorszy możliwy tryb porażki narzędzia
 * diagnostycznego:
 *
 *   1. `uruchom-wszystko.js` raportował „bramki nie przechodzą" przy 15/15 PASS.
 *      Przyczyna: `spawnSync(..., { shell: true })` na Windowsie składa wiersz polecenia
 *      łącząc argumenty SPACJAMI, BEZ cudzysłowów. Ścieżka projektu zawiera spację
 *      (`...\Desktop\Program flotowy\taxorder-pro\...`), więc cmd.exe rozbijał ją i node
 *      dostawał `C:\Users\...\Desktop\Program` jako plik do uruchomienia.
 *      To samo fałszowało `wrangler whoami` → „brak poświadczeń" przy zalogowanym CLI.
 *
 *   2. `env-setup.js` pokazywał WSZYSTKIE klucze jako puste, choć wartości były w pliku.
 *      Przyczyna: podział po `'\n'` zamiast `/\r?\n/`. Na Windowsie plik ma CRLF, więc
 *      każda linia kończyła się `\r`. W JavaScripcie `.` NIE dopasowuje `\r` (to terminator
 *      linii), a `$` bez flagi `m` dopasowuje się WYŁĄCZNIE na końcu napisu — nie przed
 *      końcowym terminatorem, jak w Pythonie. Wzorzec nie pasował i wartość ginęła.
 *
 * Obie klasy są niewidoczne na Linuksie: `shell: WIN` jest tam wyłączone, a pliki mają LF.
 * CI działa na ubuntu-latest, więc BEZ tego testu nic ich nie złapie.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nStrażnik narzędzi — Windows, spacje w ścieżce, CRLF\n');

// ── [1] żadne narzędzie nie używa shell:true bez cytowania ────────────────────
// Wzorzec `shell: WIN` albo `shell: true` przy niecytowanych argumentach to dokładnie
// ten błąd. Cytowanie rozpoznajemy po obecności funkcji opakowującej argumenty.
const NARZEDZIA = ['uruchom-wszystko.js', 'cf-ocr-test.js', 'env-setup.js', 'aztec-compare.js'];
for (const n of NARZEDZIA) {
  const p = path.join(ROOT, 'tools', n);
  if (!fs.existsSync(p)) { ok(false, `${n} — plik nie istnieje`); continue; }
  const src = fs.readFileSync(p, 'utf8');
  const goleShell = /shell:\s*(WIN|true)\b/.test(src);
  const cytuje = /\.replace\(\/"\/g|cyt\s*=|`"\$\{/.test(src);
  ok(!goleShell || cytuje,
    goleShell && !cytuje
      ? `${n} — używa shell bez cytowania argumentów; ścieżka ze spacją rozbije polecenie`
      : `${n} — bez gołego shell:true${goleShell ? ' (shell z cytowaniem)' : ''}`);
}

// ── [2] env-setup czyta wartości z pliku CRLF ────────────────────────────────
// Test BEHAWIORALNY: budujemy .env z zakończeniami Windows i sprawdzamy, czy skrypt
// rozpozna wartość. Sprawdzenie statyczne („czy jest /\r?\n/") potwierdzałoby obecność
// kodu, a nie jego działanie.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tooling-crlf-'));
fs.mkdirSync(path.join(tmp, 'tools'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'tools', 'env-setup.js'), path.join(tmp, 'tools', 'env-setup.js'));
fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(tmp, '.env.example'));
fs.writeFileSync(path.join(tmp, '.env'), 'TEST_EMAIL=ktos@example.pl\r\nTEST_PASS=abc123\r\n');

const r = spawnSync(process.execPath, [path.join(tmp, 'tools', 'env-setup.js')], { encoding: 'utf8', timeout: 30000 });
const out = `${r.stdout}${r.stderr}`.replace(/\x1b\[[0-9;]*m/g, '');

ok(/TEST_EMAIL\s+wypełniony/.test(out),
  /TEST_EMAIL\s+wypełniony/.test(out)
    ? 'env-setup czyta wartości z pliku CRLF (zakończenia Windows)'
    : 'env-setup NIE widzi wartości w pliku CRLF — podział po \'\\n\' zamiast /\\r?\\n/');

// Raport nie może wypisywać wartości — to jest obietnica tego narzędzia, nie detal.
ok(!/ktos@example\.pl|abc123/.test(out),
  !/ktos@example\.pl|abc123/.test(out)
    ? 'env-setup nie wypisuje wartości kluczy (tylko długości)'
    : 'env-setup WYPISAŁ wartość klucza — sekret trafiłby do logu i do zgłoszenia');

// ── [3] cf-ocr-test zna kody błędów, które realnie wystąpiły ─────────────────
// 5016 (licencja) i 4006 (dzienny limit neuronów) wyglądają identycznie dla kogoś,
// kto widzi samo „HTTP 4xx", a prowadzą do zupełnie innych działań: kliknięcia w panelu
// albo czekania do północy UTC. Oba wystąpiły na tym koncie.
const ocr = fs.readFileSync(path.join(ROOT, 'tools', 'cf-ocr-test.js'), 'utf8');
for (const [kod, opis] of [['5016', 'licencja modelu'], ['4006', 'dzienny limit neuronów']]) {
  ok(ocr.includes(kod), `cf-ocr-test rozpoznaje kod ${kod} (${opis})`);
}

// ── [4] narzędzia oparte na fetch nie ubijają pętli zdarzeń ─────────────────
// `process.exit()` wywołany wewnątrz funkcji async, gdy gniazda fetch jeszcze się
// zamykają, przerywa Node'a asercją libuv NA WINDOWSIE:
//     Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c
// Wynik jest wtedy już wypisany, więc nic nie ginie — ale wygląda jak awaria narzędzia
// i przykrywa prawdziwy komunikat. Zgłoszone przez użytkownika po realnym przebiegu.
// Na Linuksie to samo kończy się bez asercji, więc CI tego nie złapie.
const ostatnie = ocr.slice(ocr.lastIndexOf('})();') - 400);
ok(/process\.exitCode\s*=/.test(ostatnie) && !/process\.exit\(/.test(ostatnie),
  /process\.exitCode\s*=/.test(ostatnie) && !/process\.exit\(/.test(ostatnie)
    ? 'cf-ocr-test kończy async przez process.exitCode (nie ubija zamykających się gniazd)'
    : 'cf-ocr-test woła process.exit() w kontekście async — na Windowsie przerwie asercją libuv');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
