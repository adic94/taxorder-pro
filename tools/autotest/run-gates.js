#!/usr/bin/env node
/**
 * Uruchamia WSZYSTKIE bramki jednostkowe z `tests/unit/` i pilnuje, żeby każda
 * z nich była wpięta w `ci-js.yml`.
 *
 * PO CO. Do 18.08.2026 `npm run audit:all` — polecenie, po które sięga się przed
 * wypchnięciem — uruchamiał **3 z 13** bramek. Pozostałe dziesięć istniały wyłącznie
 * jako kroki w `ci-js.yml`. Dopóki CI działa, to tylko niewygoda. Od 12.08 pakiet minut
 * Actions jest wyczerpany (reset 1 września), więc bramki lokalne SĄ całą siecią
 * bezpieczeństwa — a ta sieć miała 23% pokrycia i wyglądała na zieloną.
 *
 * Przyczyną było prowadzenie listy bramek w dwóch miejscach naraz (łańcuch `&&`
 * w package.json i kroki w ci-js.yml), które rozjechały się po cichu. Ten projekt
 * przerabiał to już trzykrotnie: dwie tablice wskaźników CO2, dwie listy źródeł
 * kreatora raportów, dwie deklaracje wersji ZXing. Dlatego tutaj listy NIE MA —
 * jest katalog `tests/unit/`, czytany przy każdym uruchomieniu.
 *
 * Trzy rzeczy, które sprawdza:
 *   1. każdy plik z tests/unit/ przechodzi (kod wyjścia 0),
 *   2. każdy plik z tests/unit/ jest wpięty w ci-js.yml — bramka poza CI nie jest bramką,
 *   3. każdy plik wołany z ci-js.yml istnieje — krok wskazujący na usunięty plik
 *      wywala CI komunikatem o brakującym module, nie o regresji.
 *
 * Uruchamia wszystkie do końca, także po pierwszej porażce: łańcuch `&&` zatrzymuje się
 * na pierwszym błędzie i ukrywa pozostałe, przez co naprawa idzie po jednej na przebieg.
 *
 * Nie ma zależności poza `node` i nie rusza sieci — działa przy wyczerpanych minutach
 * i w PowerShellu 5.1 (`node` to zwykły plik wykonywalny, polityka wykonywania go nie
 * dotyczy, w przeciwieństwie do `npm.ps1`).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'tests', 'unit');
const CI = path.join(ROOT, '.github', 'workflows', 'ci-js.yml');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const pliki = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
if (!pliki.length) {
  console.error(R('tests/unit/ jest pusty — albo ktoś usunął bramki, albo uruchamiasz to z innego katalogu.'));
  process.exit(2);
}

// --- [1] uruchomienie -------------------------------------------------------
console.log(`\nBramki jednostkowe — ${pliki.length} plików z tests/unit/\n`);

const wyniki = [];
for (const f of pliki) {
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  // Bramki kończą się linią "Wynik: N PASS / M FAIL". Brak tej linii przy kodzie 0
  // jest sam w sobie podejrzany — plik mógł nic nie sprawdzić.
  const m = out.match(/(\d+)\s+PASS\s*\/\s*(\d+)\s+FAIL/);
  const kod = r.status === null ? 2 : r.status;
  wyniki.push({ f, kod, pass: m ? +m[1] : null, fail: m ? +m[2] : null, out });
  const etykieta = m ? `${m[1]} PASS / ${m[2]} FAIL` : D('(brak podsumowania)');
  console.log(`  ${kod === 0 ? G('✓') : R('✗')} ${f.padEnd(34)} ${etykieta}`);
}

// --- [2] i [3] spójność z ci-js.yml -----------------------------------------
const yml = fs.readFileSync(CI, 'utf8');
const wCi = new Set([...yml.matchAll(/tests\/unit\/([A-Za-z0-9._-]+\.js)/g)].map(m => m[1]));

const pozaCi = pliki.filter(f => !wCi.has(f));
const widmo = [...wCi].filter(f => !pliki.includes(f));

const zle = wyniki.filter(w => w.kod !== 0);

// Wyjście każdej bramki, która padła — inaczej trzeba by uruchamiać ją ponownie ręcznie.
for (const w of zle) {
  console.log(`\n${R('─'.repeat(60))}\n${R(w.f)} (kod wyjścia ${w.kod})\n`);
  console.log(w.out.trimEnd());
}

console.log(`\n${'─'.repeat(60)}`);
const sumaPass = wyniki.reduce((a, w) => a + (w.pass || 0), 0);
const sumaFail = wyniki.reduce((a, w) => a + (w.fail || 0), 0);
console.log(`Bramki: ${pliki.length - zle.length}/${pliki.length} przeszło   Asercje: ${sumaPass} PASS / ${sumaFail} FAIL`);

if (pozaCi.length) {
  console.log(R(`\nBRAMKA POZA CI (${pozaCi.length}): ${pozaCi.join(', ')}`));
  console.log('  Plik jest w tests/unit/, ale ci-js.yml go nie uruchamia — na PR-ach nie zadziała.');
  console.log('  Dopisz krok `run: node tests/unit/<plik>` w .github/workflows/ci-js.yml.');
}
if (widmo.length) {
  console.log(R(`\nKROK CI BEZ PLIKU (${widmo.length}): ${widmo.join(', ')}`));
  console.log('  ci-js.yml woła plik, którego nie ma — CI padnie na braku modułu, nie na regresji.');
}

const ok = !zle.length && !pozaCi.length && !widmo.length;
console.log(ok ? G('\nWszystko zielone.\n') : R('\nSą problemy — szczegóły wyżej.\n'));
process.exit(ok ? 0 : 1);
