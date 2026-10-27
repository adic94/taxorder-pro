#!/usr/bin/env node
/**
 * codemap.js — mapa funkcji najwiekszych plikow (worker/index.js, app.js, modules/*.js).
 *
 * PO CO. worker/index.js ma ~830 KB (~250 tys. tokenow), app.js ~615 KB. Przeczytanie calego
 * pliku zjada limit sesji, a zwykle potrzeba jednej funkcji. Statyczna tabela "funkcja -> linie"
 * w dokumentacji starzeje sie przy kazdym commicie (numery linii sie przesuwaja) i zaczyna
 * wprowadzac w blad — dlatego narzedzie liczy zakresy NA ZYWO z aktualnego pliku.
 *
 * UZYCIE
 *   node tools/codemap.js handleVehicles          # funkcje pasujace do wzorca (regex, bez wielkosci liter)
 *   node tools/codemap.js --top 25                # 25 najwiekszych funkcji
 *   node tools/codemap.js ksef --plik worker/index.js
 * potem czytaj tylko zakres:  sed -n '<od>,<do>p' <plik>
 *
 * Funkcja = deklaracja `function` / `async function` w kolumnie 0 (plik w stylu tego projektu:
 * deklaracje najwyzszego poziomu nie sa wciete). Zakres konczy sie tuz przed kolejna deklaracja
 * najwyzszego poziomu (function / const / let / var / class w kolumnie 0).
 * Nic nie zapisuje, nie wymaga sieci ani zaleznosci poza `node`.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMYSLNE = ['worker/index.js', 'app.js', 'index.html'].filter((f) => f !== 'index.html');

function pliki(wybrany) {
  if (wybrany) return [wybrany];
  const mod = fs.readdirSync(path.join(ROOT, 'modules')).filter((f) => f.endsWith('.js')).map((f) => 'modules/' + f);
  return DOMYSLNE.concat(mod);
}

const RE_FN = /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)\s*\(/;
const RE_TOP = /^(?:export\s+)?(?:async\s+function|function|const|let|var|class)\b/;

/**
 * Skaner leksykalny: dla kazdej linii mowi, czy ZACZYNA sie ona na najwyzszym poziomie kodu,
 * czyli poza literalem szablonowym (`...`), komentarzem blokowym i wyrazeniem ${...} w szablonie.
 *
 * PO CO. Sama regula "deklaracja w kolumnie 0" bledzie na kodzie, ktory aplikacja SKLADA jako tekst:
 * app.js:generateWarsawBookmarklet ma w szablonie niewciete `var`/`function` (wygenerowany skrypt),
 * wiec zakres funkcji urywal sie na linii 3627 zamiast 3663 i czytajacy po `sed -n` dostawal
 * 12 linii z 48 — bez zadnego sygnalu. Wynik tej funkcji jest wiec warunkiem koniecznym
 * rozpoznania deklaracji.
 *
 * Rozpoznaje: // i /* *\/, stringi '...' i "...", szablony z zagniezdzonym ${}, literaly regex
 * (heurystyka: '/' po znaku, po ktorym nie moze stac dzielenie). Zwraca tez `czysto` — czy na koncu
 * pliku skaner jest w stanie neutralnym; false oznacza, ze sie pogubil i zakresy sa niewiarygodne.
 */
function skanuj(src) {
  const top = [true];            // top[i] — czy linia i (0-based) zaczyna sie na najwyzszym poziomie
  const stos = [];               // {t:'tpl'} | {t:'expr', d:int}
  let blok = false;              // komentarz blokowy
  let prev = '';                 // ostatni znaczacy znak kodu
  const n = src.length;
  const nl = () => top.push(stos.length === 0 && !blok);
  const REGEX_PO = '(,=:[!&|?{};+-*%<>~^';
  for (let i = 0; i < n; i++) {
    const c = src[i], d = src[i + 1];
    if (c === '\n') { nl(); continue; }
    if (blok) { if (c === '*' && d === '/') { blok = false; i++; } continue; }
    const w = stos.length ? stos[stos.length - 1] : null;
    if (w && w.t === 'tpl') {
      if (c === '\\') { if (d === '\n') nl(); i++; }
      else if (c === '`') { stos.pop(); prev = 'x'; }
      else if (c === '$' && d === '{') { stos.push({ t: 'expr', d: 0 }); i++; prev = ''; }
      continue;
    }
    // kod (poziom glowny albo wnetrze ${})
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; i--; continue; }
    if (c === '/' && d === '*') { blok = true; i++; continue; }
    if (c === '"' || c === "'") {
      for (i++; i < n && src[i] !== c && src[i] !== '\n'; i++) if (src[i] === '\\') i++;
      if (src[i] === '\n') nl();
      prev = 'x'; continue;
    }
    if (c === '`') { stos.push({ t: 'tpl' }); continue; }
    if (c === '/' && (prev === '' || REGEX_PO.includes(prev))) {
      let kl = false;
      for (i++; i < n && src[i] !== '\n'; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === '[') kl = true; else if (src[i] === ']') kl = false;
        else if (src[i] === '/' && !kl) break;
      }
      if (src[i] === '\n') nl();
      prev = 'x'; continue;
    }
    if (w && w.t === 'expr') {
      if (c === '{') w.d++;
      else if (c === '}') { if (w.d === 0) { stos.pop(); continue; } w.d--; }
    }
    if (c !== ' ' && c !== '\t' && c !== '\r') prev = c;
  }
  return { top, czysto: stos.length === 0 && !blok };
}

function funkcje(plik) {
  const src = fs.readFileSync(path.join(ROOT, plik), 'utf8');
  const lines = src.split('\n');
  const { top } = skanuj(src);
  const out = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!top[i] || !RE_TOP.test(l)) continue;
    if (cur) { cur.do = i; out.push(cur); cur = null; }   // i = numer linii (1-based) tuz PRZED nowa deklaracja
    const m = RE_FN.exec(l);
    if (m) cur = { plik, nazwa: m[1], od: i + 1 };
  }
  if (cur) { cur.do = lines.length; out.push(cur); }
  return out;
}

function main() {
  const a = process.argv.slice(2);
  let top = 0, plik = null;
  const wzorce = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--top') top = parseInt(a[++i], 10) || 20;
    else if (a[i] === '--plik') plik = a[++i];
    else wzorce.push(a[i]);
  }
  let wszystkie = [];
  for (const f of pliki(plik)) {
    if (!fs.existsSync(path.join(ROOT, f))) { console.error('Brak pliku: ' + f); process.exit(1); }
    wszystkie = wszystkie.concat(funkcje(f));
  }
  let wynik = wszystkie;
  if (wzorce.length) {
    const re = new RegExp(wzorce.join('|'), 'i');
    wynik = wynik.filter((x) => re.test(x.nazwa));
  } else if (!top) top = 15;
  if (top) wynik = wynik.slice().sort((x, y) => (y.do - y.od) - (x.do - x.od)).slice(0, top);
  if (!wynik.length) { console.log('Brak funkcji pasujacych do: ' + wzorce.join(' | ')); return; }
  for (const x of wynik) {
    console.log(`${x.plik}:${x.od}-${x.do}  (${x.do - x.od + 1} ln)  ${x.nazwa}`);
  }
  console.log(`\n${wynik.length} wynik(ow). Czytaj zakres:  sed -n '<od>,<do>p' <plik>`);
}
if (require.main === module) main();
module.exports = { funkcje, skanuj };
