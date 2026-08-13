#!/usr/bin/env node
/**
 * Strażnik: pdf.js nie może wykonywać kodu z wgranego PDF-a.
 *
 * CVE-2024-4367 — w pdf.js przed 4.2.67 spreparowany PDF potrafi wykonać DOWOLNY
 * JavaScript w origin strony, jeśli `isEvalSupported` zostaje na domyślnym `true`.
 * Aplikacja ładuje pdf.js 3.11.174 (index.html, z CDN) i renderuje nim pliki, które
 * WGRYWAJĄ UŻYTKOWNICY: dowody rejestracyjne, polisy, faktury, dokumenty pojazdu.
 *
 * Konsekwencja jest konkretna, nie teoretyczna: token sesji leży w `localStorage`
 * tego samego origin (patrz CLAUDE.md — „Tokeny sesji: tylko localStorage"), więc kod
 * z PDF-a odczytuje go bez żadnej dodatkowej luki.
 *
 * `isEvalSupported: false` to mitygacja zalecana przez Mozillę dla tych, którzy nie
 * mogą podnieść wersji. Wyłącza zoptymalizowaną ścieżkę renderowania fontów —
 * renderowanie nadal działa, tylko wolniej.
 *
 * Test jest statyczny i bez zależności. NIE sprawdza wersji pdf.js (to osobna sprawa,
 * patrz niżej), tylko to, że każde wywołanie `getDocument` w kodzie produkcyjnym
 * przekazuje ten parametr.
 *
 * `tools/` jest wyłączone celowo: to lokalne narzędzia deweloperskie, uruchamiane
 * ręcznie na własnych plikach, nie na materiale od użytkownika.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

// Pliki produkcyjne: app.js + modules/*.js (bez tools/, bez tests/, bez node_modules)
const pliki = ['app.js', ...fs.readdirSync(path.join(ROOT, 'modules'))
  .filter(f => f.endsWith('.js')).map(f => path.join('modules', f))];

console.log('\nStrażnik pdf.js — wgrany PDF nie może wykonać kodu (CVE-2024-4367)\n');

const bezZabezpieczenia = [];
let wszystkich = 0;
for (const rel of pliki) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // Każde wywołanie getDocument( ... ) — bierzemy zawartość nawiasów przez zliczanie
  let i = 0;
  while ((i = src.indexOf('getDocument(', i)) >= 0) {
    wszystkich++;
    let gl = 0, j = i + 'getDocument('.length - 1;
    for (; j < src.length; j++) {
      if (src[j] === '(') gl++;
      else if (src[j] === ')') { gl--; if (gl === 0) break; }
    }
    const argumenty = src.slice(i, j + 1);
    if (!/isEvalSupported\s*:\s*false/.test(argumenty)) {
      bezZabezpieczenia.push(`${rel}:${src.slice(0, i).split('\n').length}`);
    }
    i = j + 1;
  }
}

ok(wszystkich > 0, `znaleziono wywołania getDocument w kodzie produkcyjnym (${wszystkich})`);
ok(bezZabezpieczenia.length === 0,
  bezZabezpieczenia.length
    ? `KAŻDE wywołanie musi mieć isEvalSupported: false — brakuje w: ${bezZabezpieczenia.join(', ')}`
    : `wszystkie ${wszystkich} wywołań przekazuje isEvalSupported: false`);

// Jeśli kiedyś podniesiemy pdf.js powyżej 4.2.67, ten test przestaje być konieczny —
// ale niech przypomni, że wersja z CDN jest nadal podatna, żeby nikt nie uznał
// mitygacji za rozwiązanie problemu.
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const wersja = (html.match(/pdf\.js\/(\d+)\.(\d+)\.(\d+)\//) || []).slice(1).map(Number);
if (wersja.length === 3) {
  const [maj, min] = wersja;
  const zalatana = maj > 4 || (maj === 4 && min >= 2);
  console.log(`\n  pdf.js w index.html: ${wersja.join('.')} — ${zalatana ? 'wersja załatana' : '\x1b[33mwersja PODATNA, mitygacja przez isEvalSupported\x1b[0m'}`);
  if (!zalatana) {
    console.log('  Podniesienie do ≥ 4.2.67 zamyka sprawę u źródła. Uwaga: 4.x jest ESM,');
    console.log('  więc wymaga zmiany sposobu ładowania w index.html — to osobne zadanie.');
  }
}

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
