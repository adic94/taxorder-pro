#!/usr/bin/env node
/**
 * Straznik: tools/codemap.js zwraca zakresy, ktore naprawde obejmuja cala funkcje.
 *
 * DLACZEGO. Narzedzie sluzy do tego, zeby NIE czytac calego worker/index.js (830 KB) — czytamy
 * tylko `sed -n od,dop`. Zakres zaniżony o kilka linii obcialby funkcje po cichu, a czytajacy
 * uznalby, ze widzi calosc. Test sprawdza na PRAWDZIWYM pliku Workera trzy rzeczy:
 *   1. zakres zaczyna sie od deklaracji tej funkcji,
 *   2. linia po zakresie to deklaracja najwyzszego poziomu (albo koniec pliku) — nic nie zostalo obciete,
 *   3. zakresy nie nachodza na siebie i nie ma funkcji o ujemnej dlugosci.
 */
const fs = require('fs');
const path = require('path');
const { funkcje } = require('../../tools/codemap.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } };

for (const plik of ['worker/index.js', 'app.js']) {
  const lines = fs.readFileSync(path.join(__dirname, '../..', plik), 'utf8').split('\n');
  const fn = funkcje(plik);
  ok(fn.length > 100, `${plik}: znaleziono ${fn.length} funkcji (>100)`);

  const zle1 = fn.filter((f) => !new RegExp('function\\s*\\*?\\s*' + f.nazwa.replace(/\$/g, '\\$') + '\\s*\\(').test(lines[f.od - 1]));
  ok(!zle1.length, `${plik}: kazdy zakres zaczyna sie od deklaracji (${zle1.length} bledow)`);

  const RE_TOP = /^(?:export\s+)?(?:async\s+function|function|const|let|var|class)\b/;
  const zle2 = fn.filter((f) => f.do < lines.length && !RE_TOP.test(lines[f.do]));
  ok(!zle2.length, `${plik}: po kazdym zakresie nastepuje deklaracja najwyzszego poziomu (${zle2.length} bledow)`);

  let nach = 0;
  for (let i = 0; i < fn.length; i++) {
    if (fn[i].do < fn[i].od) nach++;
    if (i && fn[i].od <= fn[i - 1].do) nach++;
  }
  ok(nach === 0, `${plik}: zakresy rozlaczne i dodatnie (${nach} naruszen)`);
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
