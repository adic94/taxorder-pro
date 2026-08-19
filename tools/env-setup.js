#!/usr/bin/env node
/**
 * Tworzy albo UZUPEŁNIA `.env` na podstawie `.env.example`.
 *
 *     node tools/env-setup.js
 *
 * PO CO, skoro jest `Copy-Item .env.example .env`. Bo kopiowanie NADPISUJE. Jeśli `.env`
 * już istnieje z poświadczeniami testowymi (TEST_EMAIL, TEST_PASS), kopiowanie kasuje je
 * bez ostrzeżenia — a odtworzenie wymaga wejścia do panelu po nowe hasło. Ten skrypt
 * dopisuje WYŁĄCZNIE brakujące klucze i nie dotyka istniejących wartości.
 *
 * DWIE PUŁAPKI WINDOWSA, które ten skrypt omija:
 *   1. Notatnik przy „Zapisz jako" dokleja `.txt` — powstaje `.env.txt`, którego dotenv
 *      nie widzi, a `git status` nie zgłasza, bo reguła `.env` go nie łapie.
 *   2. Operatory `>` i `>>` w PowerShellu 5.1 zapisują w UTF-16LE. dotenv czyta wtedy
 *      krzaki i zgłasza brak zmiennych, choć plik „wygląda dobrze" w edytorze.
 * Skrypt zapisuje jawnie UTF-8 bez BOM.
 *
 * NIGDY NIE WYPISUJE WARTOŚCI. Raportuje tylko nazwy kluczy i to, czy są wypełnione —
 * wynik da się wkleić do zgłoszenia albo do czatu bez wycieku sekretu.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRZYKLAD = path.join(ROOT, '.env.example');
const CEL = path.join(ROOT, '.env');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

if (!fs.existsSync(PRZYKLAD)) {
  console.error(R(`\nBrak ${PRZYKLAD} — uruchom to z katalogu projektu, po \`git pull\`.\n`));
  process.exit(2);
}

// Klucze z pliku wzorcowego, w kolejności występowania.
const klucze = (t) => (t.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/gm) || [])
  .map(l => l.replace(/\s*=.*$/, '').trim());

const wzor = fs.readFileSync(PRZYKLAD, 'utf8');
const oczekiwane = klucze(wzor);

console.log(B('\n  Konfiguracja .env\n'));

let tresc, istnial = fs.existsSync(CEL);
if (istnial) {
  tresc = fs.readFileSync(CEL, 'utf8');
  // UTF-16LE zaczyna się od BOM FF FE albo ma bajty zerowe co drugi znak — to skutek
  // zapisu przez `>` w PowerShellu. dotenv czyta wtedy śmieci.
  const surowe = fs.readFileSync(CEL);
  if ((surowe[0] === 0xFF && surowe[1] === 0xFE) || (surowe.length > 4 && surowe[1] === 0x00)) {
    console.log(Y('  Plik był zapisany w UTF-16LE (skutek `>` w PowerShellu) — przepisuję na UTF-8.'));
    tresc = surowe.toString('utf16le');
  }
  console.log(`  ${G('✓')} .env istnieje — dopisuję tylko brakujące klucze, nic nie kasuję`);
} else {
  tresc = '';
  console.log(`  ${Y('•')} .env nie istniał — tworzę`);
}

const obecne = new Set(klucze(tresc));
const brakujace = oczekiwane.filter(k => !obecne.has(k));

if (brakujace.length) {
  // Przenosimy też komentarz poprzedzający klucz — bez niego użytkownik nie wie,
  // jakiego zakresu ma być token ani skąd go wziąć.
  let dopisz = istnial && tresc.trim() ? '\n' : '';
  const linie = wzor.split(/\r?\n/);
  for (const k of brakujace) {
    const i = linie.findIndex(l => new RegExp(`^\\s*${k}\\s*=`).test(l));
    let od = i;
    while (od > 0 && /^\s*#/.test(linie[od - 1])) od--;
    dopisz += `\n${linie.slice(od, i + 1).join('\n')}`;
  }
  tresc = tresc.replace(/\s*$/, '') + dopisz + '\n';
}

fs.writeFileSync(CEL, tresc, { encoding: 'utf8' });

// ── Raport: nazwy kluczy i czy wypełnione. Wartości NIE są wypisywane. ────────
// PODZIAL NA /\r?\n/, NIE NA '\n'. Na Windowsie plik ma zakonczenia CRLF, wiec podzial
// po samym '\n' zostawia '\r' na koncu kazdej linii. W JavaScripcie `.` NIE dopasowuje
// '\r' (to terminator linii), a `$` bez flagi `m` dopasowuje sie WYLACZNIE na koncu
// napisu — nie przed koncowym terminatorem, jak w Pythonie. Efekt: caly wzorzec nie
// pasowal i KAZDY klucz byl raportowany jako pusty, mimo poprawnie zapisanych wartosci.
// Zglosil to uzytkownik: „drugi run pokazal wszystkie 8 jako puste, a wartosci SA w pliku".
const wartosci = Object.fromEntries(
  tresc.split(/\r?\n/)
    .map(l => l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$/))
    .filter(Boolean)
    .map(m => [m[1], m[2].trim()]));

const puste = [];
console.log(B('\n  Klucze:\n'));
for (const k of oczekiwane) {
  const v = wartosci[k] || '';
  const nowy = brakujace.includes(k);
  if (v) console.log(`   ${G('✓')} ${k.padEnd(26)} ${D(`wypełniony (${v.length} zn.)`)}`);
  else { puste.push(k); console.log(`   ${R('·')} ${k.padEnd(26)} ${Y('DO UZUPEŁNIENIA')}${nowy ? D(' (nowy)') : ''}`); }
}

console.log(`\n  ${D('plik:')} ${CEL}`);

// Sprzątanie po pułapce Notatnika — plik .env.txt nie jest widziany ani przez dotenv,
// ani przez regułę .gitignore, więc może zostać w katalogu niezauważony.
if (fs.existsSync(`${CEL}.txt`)) {
  console.log(Y(`\n  UWAGA: istnieje też .env.txt — to skutek zapisu z Notatnika.`));
  console.log(Y('  dotenv go NIE czyta, a .gitignore NIE ignoruje. Skasuj albo scal ręcznie.'));
}

if (puste.length) {
  console.log(B(`\n  Do uzupełnienia (${puste.length}):`));
  console.log(D('  Otwórz plik i wpisz wartości po znaku `=`, bez cudzysłowów.\n'));
  console.log(`      notepad "${CEL}"\n`);
  if (puste.includes('CLOUDFLARE_API_TOKEN')) {
    console.log(D('  Token: Dashboard → My Profile → API Tokens → Create Token → Custom token'));
    console.log(D('         Uprawnienie: Account → Workers AI → Read.  TYLKO TO JEDNO.\n'));
  }
} else {
  console.log(G('\n  Wszystkie klucze wypełnione.\n'));
}
process.exit(0);
