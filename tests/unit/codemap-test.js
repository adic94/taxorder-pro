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
const { funkcje, skanuj } = require('../../tools/codemap.js');

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

// ── Skaner leksykalny ────────────────────────────────────────────────────────
// Regres z review (PR #99): kod skladany jako TEKST w literale szablonowym ma niewciete
// deklaracje, a zakres funkcji urywal sie na pierwszej z nich. Poprzednie asercje powielaly
// to samo zalozenie regexowe, wiec przechodzily mimo obciecia — te mierza cos innego.
{
  const syn = [
    'function a() {',                 // 0
    '  const s = `',                  // 1
    'function ukryta() {}',           // 2  <- w szablonie
    'var x = ${ `zagniezdzony` };',   // 3
    '`;',                             // 4
    '}',                              // 5
    '// komentarz z ` backtickiem',   // 6
    "const r = /[`]/.test('`');",     // 7  regex i string z backtickiem
    'function b() {}',                // 8
    '/* blok',                        // 9
    'function w_komentarzu() {}',     // 10
    '*/',                             // 11
  ].join('\n');
  const { top, czysto } = skanuj(syn);
  ok(czysto, 'skaner konczy w stanie neutralnym na danych syntetycznych');
  ok(top[0] && !top[2] && !top[3] && !top[4] && top[5], 'linie wewnatrz szablonu nie sa najwyzszym poziomem');
  ok(top[6] && top[7] && top[8], 'backtick w komentarzu, regexie i stringu NIE otwiera szablonu');
  ok(!top[10] && !top[11], 'linie wewnatrz komentarza blokowego nie sa najwyzszym poziomem');
}

for (const plik of ['worker/index.js', 'app.js']) {
  const src = fs.readFileSync(path.join(__dirname, '../..', plik), 'utf8');
  ok(skanuj(src).czysto, `${plik}: skaner konczy w stanie neutralnym (nie pogubil sie na szablonach/regexach)`);
}

{
  const src = fs.readFileSync(path.join(__dirname, '../..', 'app.js'), 'utf8').split('\n');
  const fn = funkcje('app.js');
  const g = fn.find((f) => f.nazwa === 'generateWarsawBookmarklet');
  ok(!!g, 'app.js: znaleziono generateWarsawBookmarklet');
  if (g) {
    // ostatnia linia ciala funkcji = ta z textContent po szablonie; zakres musi ja zawierac
    const ost = src.findIndex((l, i) => i > g.od && l.includes('labelEl.textContent = `TaxOrder'));
    ok(ost >= 0 && g.do >= ost + 2, `generateWarsawBookmarklet: zakres ${g.od}-${g.do} obejmuje cale cialo (do linii ${ost + 1})`);
    const wewn = fn.filter((f) => f !== g && f.od > g.od && f.od <= g.do).map((f) => f.nazwa);
    ok(!wewn.length, `kod wbudowany w szablon nie jest raportowany jako osobne funkcje (${wewn.join(', ') || 'brak'})`);
  }
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
