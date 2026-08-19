#!/usr/bin/env node
/**
 * Strażnik: zbiór odniesienia z Aztec nie może wylądować w repozytorium.
 *
 * CO TO ZA PLIK. `tools/aztec-compare.js --katalog <folder> --zapisz-prawde <plik.json>`
 * zapisuje pola odczytane z kodów Aztec — VIN, numer rejestracyjny, serię dowodu,
 * nazwisko właściciela i NIP — **bez maskowania**. Taki jest sens zbioru odniesienia:
 * porównuje się z nim wyniki modeli OCR, więc wartości muszą być dokładne.
 *
 * DLACZEGO ODMOWA, A NIE OSTRZEŻENIE. `.gitignore` chroni wyłącznie pliki WEWNĄTRZ
 * drzewa repozytorium, i to tylko wtedy, gdy reguła powstała ZANIM plik się pojawił —
 * reguła nie działa wstecz, a plik dodany wcześniej pozostaje śledzony i `git status`
 * nie zgłosi tego jako problemu. Ten projekt ma już taki precedens: `.vscode/mcp.json`
 * był śledzony mimo reguły i wystawił `project_ref` Supabase publicznie na dwa miesiące.
 *
 * Ostrzeżenie na terminalu ginie w wyjściu przebiegu na tysiącu dokumentów. Odmowa nie.
 *
 * Test jest behawioralny — uruchamia narzędzie jako podproces i sprawdza, czy faktycznie
 * odmawia i czy faktycznie nic nie zapisuje. Statyczne sprawdzenie obecności `if`
 * potwierdzałoby, że kod istnieje, a nie że działa.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const NARZ = path.join(ROOT, 'tools', 'aztec-compare.js');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nStrażnik zbioru odniesienia — dane osobowe nie trafiają do repo\n');

// Katalog wejściowy z jednym plikiem o obsługiwanym rozszerzeniu. Zawartość nieistotna:
// strażnik ścieżki zapisu wykonuje się PRZED jakimkolwiek przetwarzaniem dokumentu.
const wejscie = fs.mkdtempSync(path.join(os.tmpdir(), 'aztec-prawda-'));
fs.writeFileSync(path.join(wejscie, 'dokument.png'), '');

const uruchom = (cel) => spawnSync(process.execPath,
  [NARZ, '--katalog', wejscie, '--zapisz-prawde', cel],
  { encoding: 'utf8', timeout: 60000 });

// --- [1] każda lokalizacja w drzewie repo jest odrzucana ---------------------
const wRepo = [
  ['korzeń repo', path.join(ROOT, 'prawda.json')],
  ['podkatalog repo', path.join(ROOT, 'tests', 'prawda.json')],
  ['ukryty podkatalog', path.join(ROOT, '.github', 'prawda.json')],
  ['przez ..', path.join(ROOT, 'tools', '..', 'prawda.json')],
];
for (const [opis, cel] of wRepo) {
  const r = uruchom(cel);
  const odmowa = r.status === 2 && /ODMOWA/.test(`${r.stdout}${r.stderr}`);
  const brakPliku = !fs.existsSync(cel);
  ok(odmowa && brakPliku,
    odmowa && brakPliku
      ? `${opis}: odmowa (kod 2) i plik nie powstał`
      : `${opis}: kod=${r.status}, plik ${brakPliku ? 'nie powstał' : 'POWSTAŁ — WYCIEK'}`);
  if (!brakPliku) fs.unlinkSync(cel);
}

// --- [2] ścieżka poza repo jest przepuszczana --------------------------------
// Bez tego strażnik mógłby odmawiać wszystkiego i test [1] przechodziłby z błędnego powodu.
const poza = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aztec-cel-')), 'prawda.json');
const rOk = uruchom(poza);
ok(rOk.status !== 2 || !/ODMOWA/.test(`${rOk.stdout}${rOk.stderr}`),
  'ścieżka POZA repo nie jest odrzucana (strażnik nie blokuje wszystkiego)');
ok(/dane osobowe bez maskowania/i.test(`${rOk.stdout}${rOk.stderr}`),
  'przy dozwolonej ścieżce narzędzie ostrzega, co znajdzie się w pliku');

// --- [3] tryb niezamaskowany nie włącza się sam ------------------------------
// `--pola-json` wysypuje pełne wartości na stdout. Rodzic podaje go świadomie; ręczne
// uruchomienie bez tej flagi musi zostać przy maskowaniu.
const src = fs.readFileSync(NARZ, 'utf8');
ok(/const POLA_JSON = process\.argv\.includes\('--pola-json'\)/.test(src),
  'emisja niezamaskowanych pól jest za jawną flagą, nie domyślna');
ok(/\[__filename, f, \.\.\.\(plikPrawdy \? \['--pola-json'\] : \[\]\)\]/.test(src),
  'rodzic podaje --pola-json TYLKO gdy poproszono o zbiór odniesienia');

// --- [4] zakres maskowania nie skurczył się ----------------------------------
const osobowe = (src.match(/const OSOBOWE = new Set\(\[([^\]]*)\]/) || [])[1] || '';
for (const pole of ['vin', 'nrRej', 'seriaDr', 'wlasciciel', 'posiadacz', 'nipWlasciciela']) {
  if (!osobowe.includes(`'${pole}'`)) { ok(false, `pole \`${pole}\` wypadło z maskowania na zwykłym wyjściu`); }
}
ok(osobowe.includes("'vin'") && osobowe.includes("'wlasciciel'") && osobowe.includes("'nipWlasciciela'"),
  'zwykłe wyjście nadal maskuje VIN, właściciela i NIP');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
