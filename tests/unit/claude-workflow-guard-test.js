#!/usr/bin/env node
/**
 * Strażnik: kto może uruchomić `claude.yml`.
 *
 * Ten job dostaje `contents: write` i `secrets.ANTHROPIC_API_KEY`, a push do
 * `worker/**` uruchamia deploy na produkcję. Wyzwalaczem jest TREŚĆ komentarza,
 * więc bez sprawdzenia autora wystarczy napisać "@claude ...", żeby dostać agenta
 * z prawem zapisu. Na repozytorium publicznym mógłby to zrobić ktokolwiek —
 * `issue_comment` biegnie w kontekście repo bazowego i sekrety DOSTAJE (w odróżnieniu
 * od `pull_request` z forka).
 *
 * DLACZEGO TEST, A NIE PRZEGLĄD WZROKOWY: pierwsza wersja guardu miała dziurę —
 * sprawdzała `comment.author_association` LUB `issue.author_association` wspólnym
 * OR-em, więc obcy komentarz pod Issue właściciela przechodził (bo drugi człon był
 * wtedy OWNER). Wyrażenia GitHuba są na tyle rozwlekłe, że taka pomyłka ginie w tekście.
 *
 * Test NIE zawiera kopii warunku — wyciąga `if:` wprost z pliku i ewaluuje je.
 * Edycja workflow od razu zmienia to, co test mierzy.
 */
const fs = require('fs');
const path = require('path');

const PLIK = path.join(__dirname, '..', '..', '.github', 'workflows', 'claude.yml');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

// ── Wyciągnięcie warunku `if:` z joba `claude` ────────────────────────────────
// Bez zależności (brak `js-yaml` w runtime CI dla ci-js.yml), więc parsujemy blok
// skalarny ręcznie: `if: |` i wcięte linie aż do klucza na tym samym poziomie.
function wyciagnijIf(src) {
  const linie = src.split('\n');
  const i = linie.findIndex(l => /^\s{4}if:\s*\|/.test(l));
  if (i < 0) throw new Error('Nie znaleziono `if: |` w jobie claude — popraw kotwicę w teście');
  const wciecie = linie[i].match(/^\s*/)[0].length;
  const out = [];
  for (let j = i + 1; j < linie.length; j++) {
    const l = linie[j];
    if (l.trim() === '') { out.push(''); continue; }
    if (l.match(/^\s*/)[0].length <= wciecie) break;
    out.push(l);
  }
  return out.join('\n');
}

/**
 * Minimalny ewaluator wyrażeń GitHub Actions — tyle, ile używa ten warunek:
 * `contains()`, `fromJSON()`, `&&`, `||`, `==`, nawiasy, ścieżki `github.*`.
 * Tłumaczy na JS i uruchamia; brakująca właściwość daje '' (jak w GitHubie).
 */
function ewaluuj(wyr, ctx) {
  const sciezka = (p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), { github: ctx }) ?? '';
  const js = wyr
    .replace(/fromJSON\((['"])(.*?)\1\)/g, (_, __, j) => JSON.stringify(JSON.parse(j)))
    .replace(/contains\(/g, '__contains(')
    .replace(/github\.[A-Za-z0-9_.]+/g, (m) => JSON.stringify(sciezka(m)))
    .replace(/&&/g, '&&').replace(/\|\|/g, '||');
  const __contains = (a, b) => Array.isArray(a) ? a.includes(b) : String(a).includes(String(b));
  // eslint-disable-next-line no-new-func
  return !!new Function('__contains', `return (${js});`)(__contains);
}

const src = fs.readFileSync(PLIK, 'utf8');
const WARUNEK = wyciagnijIf(src);

const zdarzenie = (event_name, event) => ({ event_name, event });
const KOMENTARZ = '@claude popraw to';

console.log('\nStrażnik uprawnień do uruchomienia claude.yml\n');

// ── Kto MA przechodzić ────────────────────────────────────────────────────────
ok(ewaluuj(WARUNEK, zdarzenie('issue_comment', {
  comment: { body: KOMENTARZ, author_association: 'OWNER' },
  issue: { author_association: 'OWNER' } })),
  'właściciel komentuje "@claude" → przechodzi');

ok(ewaluuj(WARUNEK, zdarzenie('issue_comment', {
  comment: { body: KOMENTARZ, author_association: 'COLLABORATOR' },
  issue: { author_association: 'NONE' } })),
  'współpracownik komentuje pod obcym Issue → przechodzi (liczy się autor komentarza)');

ok(ewaluuj(WARUNEK, zdarzenie('issues', {
  action: 'opened',
  issue: { body: KOMENTARZ, author_association: 'MEMBER' } })),
  'członek zakłada Issue z "@claude" → przechodzi');

ok(ewaluuj(WARUNEK, zdarzenie('pull_request_review', {
  review: { body: KOMENTARZ, author_association: 'OWNER' } })),
  'właściciel w review "@claude" → przechodzi');

// ── Kto NIE MA przechodzić ────────────────────────────────────────────────────
ok(!ewaluuj(WARUNEK, zdarzenie('issue_comment', {
  comment: { body: KOMENTARZ, author_association: 'NONE' },
  issue: { author_association: 'NONE' } })),
  'obcy komentuje "@claude" → ODRZUCONY');

// To jest dokładnie ta dziura, którą miała pierwsza wersja guardu.
ok(!ewaluuj(WARUNEK, zdarzenie('issue_comment', {
  comment: { body: KOMENTARZ, author_association: 'NONE' },
  issue: { author_association: 'OWNER' } })),
  'obcy komentuje pod Issue WŁAŚCICIELA → ODRZUCONY (regresja: wspólny OR to przepuszczał)');

ok(!ewaluuj(WARUNEK, zdarzenie('issues', {
  action: 'opened',
  issue: { body: KOMENTARZ, author_association: 'NONE' } })),
  'obcy zakłada Issue z "@claude" → ODRZUCONY');

ok(!ewaluuj(WARUNEK, zdarzenie('issues', {
  action: 'labeled',
  label: { name: 'claude' },
  issue: { body: KOMENTARZ, author_association: 'NONE' } })),
  'label "claude" na Issue obcej osoby → ODRZUCONY (treść zgłoszenia jest promptem)');

ok(!ewaluuj(WARUNEK, zdarzenie('issue_comment', {
  comment: { body: 'zwykły komentarz bez wywołania', author_association: 'OWNER' },
  issue: { author_association: 'OWNER' } })),
  'właściciel pisze komentarz BEZ "@claude" → nie uruchamia');

ok(!ewaluuj(WARUNEK, zdarzenie('issues', {
  action: 'labeled',
  label: { name: 'bug' },
  issue: { body: 'opis', author_association: 'OWNER' } })),
  'label inny niż "claude" → nie uruchamia');

// ── Bezpiecznik na samą obecność sprawdzenia ─────────────────────────────────
ok(/author_association/.test(WARUNEK),
  'warunek w ogóle odwołuje się do author_association');

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
