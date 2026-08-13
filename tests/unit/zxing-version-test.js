#!/usr/bin/env node
/**
 * Strażnik: aplikacja deklaruje JEDNĄ wersję ZXing, a narzędzia testują TĘ SAMĄ.
 *
 * DLACZEGO ISTNIEJE. Do 13.08.2026 aplikacja deklarowała dwie różne wersje tej samej
 * biblioteki:
 *
 *   index.html:4317   @zxing/library@0.19.1   — zwykły <script>, ładuje się przy starcie
 *   app.js loadZXing() @zxing/library@0.20.0  — wstrzykiwany dynamicznie
 *
 * Wygrywała 0.19.1, bo `loadZXing()` zaczyna od `if (window.ZXing) return window.ZXing;`
 * — a `window.ZXing` istnieje już po wykonaniu tagu z index.html. Linia z 0.20.0 była
 * więc martwa, ale nikt tego nie wiedział.
 *
 * KOSZT tej rozbieżności był realny, choć wyszedł przypadkiem: całe śledztwo nad
 * zniekształcaniem bajtów Aztec (0x80–0x9F, mapowanie ISO-8859-1 → windows-1252)
 * prowadziliśmy na 0.20.0 z `node_modules`, czyli na wersji, której produkcja NIE
 * uruchamia. Naprawa okazała się słuszna także dla 0.19.1 — ale sprawdziliśmy to
 * dopiero po fakcie. To był zbieg okoliczności, nie projekt.
 *
 * Test pilnuje więc dwóch rzeczy:
 *   1. index.html i app.js deklarują tę samą wersję,
 *   2. jeśli `node_modules/@zxing/library` jest zainstalowany (narzędzia deweloperskie
 *      i selftest go używają), to jest to ta sama wersja co w produkcji.
 *
 * Punkt 2 ostrzega, zamiast wywalać CI: `@zxing/library` instaluje się przez
 * `npm i --no-save`, więc na czystym runnerze go nie ma i to jest w porządku.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m' } ${m}`); w ? pass++ : fail++; };

const wersje = (plik) => {
  const src = fs.readFileSync(path.join(ROOT, plik), 'utf8');
  return [...new Set((src.match(/@zxing\/library@([0-9]+\.[0-9]+\.[0-9]+)/g) || [])
    .map(s => s.split('@').pop()))];
};

console.log('\nStrażnik wersji ZXing — jedna wersja w aplikacji, ta sama w testach\n');

const wHtml = wersje('index.html');
const wApp = wersje('app.js');

ok(wHtml.length === 1, `index.html deklaruje dokładnie jedną wersję (${wHtml.join(', ') || 'brak'})`);
ok(wApp.length <= 1, `app.js deklaruje najwyżej jedną wersję (${wApp.join(', ') || 'brak'})`);

const produkcyjna = wHtml[0];
if (wApp.length) {
  ok(wApp[0] === produkcyjna,
    wApp[0] === produkcyjna
      ? `app.js i index.html zgodne: ${produkcyjna}`
      : `ROZJAZD — index.html: ${produkcyjna}, app.js: ${wApp[0]}. Wygrywa index.html (ładuje się pierwszy), więc wersja z app.js jest martwa i myląca.`);
}

// Kolejność ładowania — powód, dla którego wygrywa index.html. Gdyby loadZXing()
// przestało zwracać wcześnie przy istniejącym window.ZXing, wygrywałaby inna wersja
// i ten test przestałby opisywać rzeczywistość.
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
ok(/if\s*\(\s*window\.ZXing\s*\)/.test(app),
  'loadZXing() nadal zwraca wcześnie, gdy window.ZXing już istnieje (to dlatego wygrywa index.html)');

// Narzędzia deweloperskie muszą mierzyć tę samą wersję, którą uruchamia produkcja.
const pkg = path.join(ROOT, 'node_modules', '@zxing', 'library', 'package.json');
if (fs.existsSync(pkg)) {
  const zainstalowana = JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
  ok(zainstalowana === produkcyjna,
    zainstalowana === produkcyjna
      ? `node_modules ma wersję produkcyjną (${zainstalowana}) — selftest mierzy to, co działa u użytkownika`
      : `node_modules ma ${zainstalowana}, produkcja ${produkcyjna}. Narzędzia testują INNĄ wersję niż uruchamia aplikacja — napraw: npm i --no-save "@zxing/library@${produkcyjna}"`);
} else {
  console.log(`\n  (node_modules/@zxing/library nieobecny — pomijam. Instalacja: npm i --no-save "@zxing/library@${produkcyjna}")`);
}

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
