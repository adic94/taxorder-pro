#!/usr/bin/env node
/**
 * Strażnik: żaden krok kaskady OCR nie połyka powodu swojej porażki.
 *
 * DLACZEGO ISTNIEJE. Kaskada OCR dla dowodów ma cztery warstwy:
 *
 *   Próba 0  PaddleOCR (Python, Railway)          — najdokładniejsza, bounding boxy
 *   Próba 1  CF Workers AI (llama-3.2-11b-vision) — bez kosztów zewnętrznych
 *   Próba 2  Groq Vision (×4 modele)              — fallback
 *
 * Każda następna jest GORSZA od poprzedniej, a przejście w dół jest ciche. To znaczy,
 * że awaria warstwy wyższej nie objawia się błędem — objawia się gorszymi danymi.
 * Użytkownik dostaje dowód z mniejszą liczbą pól i nie ma jak zgadnąć dlaczego.
 *
 * Przerabialiśmy to dwa razy w tygodniu:
 *
 *   17.08  CF Workers AI zwracał kod 5016 („model license not accepted"). Powód siedział
 *          wyłącznie w `console.log`, a endpoint oddawał 502 z komunikatem o Groq — czyli
 *          o warstwie, która była tylko SKUTKIEM. Diagnoza zajęła dzień zamiast minuty
 *          i wymagała `wrangler tail` na produkcji.
 *   18.08  Próba 0 miała `catch (e) { }` z samym komentarzem. Uśpiona instancja Railway,
 *          zmieniony adres i obrócony sekret wyglądały identycznie: nie wyglądały wcale.
 *
 * Test jest statyczny — czyta źródło Workera, nie wymaga sieci ani deployu.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nStrażnik kaskady OCR — każda warstwa mówi, dlaczego padła\n');

// --- wytnij ciało handleAIOCR ----------------------------------------------
const start = SRC.indexOf('async function handleAIOCR(');
ok(start > 0, 'handleAIOCR znaleziona w worker/index.js');
if (start < 0) { console.log('\nWynik: 0 PASS / 1 FAIL\n'); process.exit(1); }

// Koniec = początek następnej deklaracji funkcji najwyższego poziomu.
const reszta = SRC.slice(start + 10);
const nast = reszta.search(/\n(?:async )?function [A-Za-z_]/);
const body = nast > 0 ? SRC.slice(start, start + 10 + nast) : SRC.slice(start);

// --- [1] każda warstwa ma swoją zmienną powodu ------------------------------
for (const [zm, opis] of [['pyErr', 'Próba 0 — PaddleOCR'], ['cfErr', 'Próba 1 — CF Workers AI'], ['lastErr', 'Próba 2 — Groq']]) {
  ok(new RegExp(`\\b${zm}\\b`).test(body), `${opis}: zmienna \`${zm}\` istnieje`);
}

// --- [2] wszystkie trzy docierają do wywołującego ---------------------------
// Bez tego powód zostaje w logu, a log produkcji wymaga `wrangler tail` na żywo.
const koncowy = (body.match(/return err\(`Błąd AI Vision[^`]*`/) || [])[0] || '';
ok(!!koncowy, 'końcowy return err() z komunikatem „Błąd AI Vision" istnieje');
for (const zm of ['pyErr', 'cfErr', 'lastErr']) {
  ok(koncowy.includes(zm), `końcowy komunikat 502 zawiera \`${zm}\``);
}

// --- [3] żaden catch w kaskadzie nie jest pusty -----------------------------
// Pusty = zawiera wyłącznie komentarze i białe znaki. To jest DOKŁADNIE ten wzorzec,
// który ukrył 5016 i uśpione Railway. Komentarz „fall through" nie jest obsługą błędu.
const puste = [];
const reCatch = /catch\s*(?:\(([^)]*)\))?\s*\{([\s\S]*?)\}/g;
let m;
while ((m = reCatch.exec(body)) !== null) {
  const wnetrze = m[2]
    .replace(/\/\*[\s\S]*?\*\//g, '')   // komentarze blokowe
    .replace(/\/\/[^\n]*/g, '')          // komentarze liniowe
    .trim();
  if (!wnetrze) {
    const linia = body.slice(0, m.index).split('\n').length;
    const nrGlobalny = SRC.slice(0, start).split('\n').length + linia - 1;
    puste.push(`worker/index.js:${nrGlobalny}`);
  }
}
ok(puste.length === 0,
  puste.length
    ? `${puste.length} pusty catch w kaskadzie OCR: ${puste.join(', ')} — powód porażki ginie, warstwa niżej jest GORSZA`
    : 'żaden catch w kaskadzie nie połyka powodu w ciszy');

// --- [4] timeout odróżniony od awarii sieci ---------------------------------
// Railway na darmowym planie usypia instancję; zimny start przekracza 8 s i zgłasza się
// jako TimeoutError. Bez rozróżnienia „usługa śpi" wygląda jak „usługa nie istnieje".
ok(/TimeoutError/.test(body),
  'timeout Próby 0 odróżniony od awarii sieci (uśpione Railway to inny problem niż zły adres)');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
