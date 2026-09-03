/**
 * TaxOrder Pro — regresja bookmarkletu DT-1 → Warszawa
 * Uruchom: node tests/unit/warsaw-bookmarklet-test.js
 *
 * Bez zależności (żadnego npm install) — nadaje się do ci-js.yml.
 *
 * DLACZEGO ISTNIEJE: bookmarklet jest generowany jako tekst wewnątrz literału szablonowego
 * w app.js i wykonywany na obcym origin (moja.warszawa19115.pl, sesja zalogowana PZ).
 * Żadne z istniejących narzędzi tego nie widzi:
 *   • node --check / syntax-check  — sprawdzają app.js, nie kod, który app.js EMITUJE,
 *   • xss-audit                    — szuka `el.innerHTML = ...` w kodzie, a tu sink siedzi
 *                                    wewnątrz stringa,
 *   • Playwright E2E               — nie klika bookmarkletu na obcej stronie.
 * Efekt: funkcja przez cały czas rzucała SyntaxError, a po jego naprawieniu odsłaniała
 * dwa wektory wstrzyknięcia. Ten test pilnuje obu naraz.
 */

const fs   = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', '..', 'app.js');

let _pass = 0, _fail = 0;
const failures = [];

function test(name, fn) {
  try { fn(); _pass++; process.stdout.write(`  ✓ ${name}\n`); }
  catch (e) { _fail++; failures.push({ name, error: e.message }); process.stdout.write(`  ✗ ${name}\n`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ─── Wyciągnięcie szablonu bookmarkletu z app.js ──────────────
function extractScript() {
  const src   = fs.readFileSync(APP, 'utf8');
  const start = src.indexOf('const script = `');
  assert(start >= 0, 'nie znaleziono szablonu bookmarkletu w app.js');
  const endMark = '`.replace(/\\s{2,}/g,\' \');';
  const end = src.indexOf(endMark, start);
  assert(end >= 0, 'nie znaleziono końca szablonu bookmarkletu');
  const literal = src.slice(start + 'const script = '.length, end + 1);
  assert(!literal.includes('${'), 'szablon zawiera interpolację — test wymaga aktualizacji');
  // eslint-disable-next-line no-eval
  return eval(literal).replace(/\s{2,}/g, ' ');
}

// Odtwarza konstrukcję z app.js (generateWarsawBookmarklet)
function buildUrl(script, D) {
  return 'javascript:' + encodeURIComponent(script + '(' + JSON.stringify(D) + ')');
}

// Minimalny DOM — tyle, ile dotyka bookmarklet. Zwraca wygenerowany HTML panelu.
function runBookmarklet(url) {
  assert(url.startsWith('javascript:'), 'URL nie jest bookmarkletem');
  // przeglądarka percent-dekoduje javascript: URL przed wykonaniem
  const code = decodeURIComponent(url.slice('javascript:'.length));

  const sandbox = { panelHtml: null, injected: false };
  const mkEl = () => ({
    style: '', innerHTML: '', textContent: '',
    querySelector: () => ({ addEventListener() {} }),
    addEventListener() {}, remove() {}, getAttribute: () => null,
  });
  const doc = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => mkEl(),
    body: { appendChild(el) { sandbox.panelHtml = el.innerHTML; } },
  };
  function HTMLInputElement() {}
  Object.defineProperty(HTMLInputElement.prototype, 'value', {
    set() {}, get() { return ''; }, configurable: true,
  });

  // eslint-disable-next-line no-new-func
  new Function('document', 'HTMLInputElement', 'Event', 'window', code)(
    doc, HTMLInputElement, function Event() {}, sandbox,
  );
  return sandbox;
}

const BAZA = {
  nip: '1234567890', nazwa: 'Firma Testowa', ulica: 'Kwiatowa', nr: '1', lokal: '',
  kod: '00-001', miasto: 'Warszawa', rok: 2026, cel: '1',
};
const pojazd = extra => Object.assign({
  nr_rej: 'WX00001', vin: '', marka: 'Volvo', model: 'FH16', rok: 2020, typ: '',
  dmc: 12000, osie: 2, zawieszenie: 'pneumatyczne', dataNabycia: '2020-01-01', dataRejestracji: '',
}, extra);

console.log('\nBookmarklet DT-1 → Warszawa — regresja\n');

const script = extractScript();

test('wygenerowany skrypt parsuje się (brak SyntaxError)', () => {
  // Historyczny błąd: \' wewnątrz literału szablonowego dawało goły apostrof,
  // który zamykał string w emitowanym kodzie → "Unexpected identifier 'div'".
  new Function('return ' + script); // eslint-disable-line no-new-func
});

test('szablon nie zawiera apostrofów w atrybutach HTML (źródło SyntaxError)', () => {
  assert(!/onclick="[^"]*'/.test(script),
    'atrybut onclick z apostrofem — użyj data-* + addEventListener');
});

test('ładunek javascript: jest percent-enkodowany', () => {
  // Dopuszcza obie składnie ('a'+b i `a${b}`) — eslint --fix (prefer-template) przepisuje
  // konkatenację na literał szablonowy, co jest wyłącznie zmianą stylu. Test i tak sprawdza
  // niezmiennik bezpieczeństwa: prefiks 'javascript:' MUSI stać NA ZEWNĄTRZ encodeURIComponent(),
  // inaczej sam schemat też zostałby zakodowany i bookmarklet by nie działał.
  const src = fs.readFileSync(APP, 'utf8');
  assert(/const bm = (?:'javascript:'\s*\+|`javascript:\$\{)\s*encodeURIComponent\(/.test(src),
    'bm musi używać encodeURIComponent — bez tego %22 w danych wychodzi poza literał JSON');
});

test('bookmarklet wykonuje się na zwykłych danych', () => {
  const D = Object.assign({}, BAZA, { pojazdy: [pojazd()] });
  const r = runBookmarklet(buildUrl(script, D));
  assert(r.panelHtml, 'panel nie został dodany do body');
  assert(r.panelHtml.includes('WX00001'), 'brak numeru rejestracyjnego w panelu');
  assert(r.panelHtml.includes('Volvo'), 'brak marki w panelu');
});

test('WEKTOR A — %22 w danych nie wychodzi poza literał JSON', () => {
  const D = Object.assign({}, BAZA, {
    pojazdy: [pojazd({ marka: 'A%22,%22__pwn%22:(window.injected=1),%22z%22:%22' })],
  });
  const r = runBookmarklet(buildUrl(script, D));
  assert(r.injected !== 1, 'dane wykonały się jako kod — brak percent-enkodowania');
});

test('WEKTOR B — HTML w danych pojazdu jest escapowany, nie wykonywany', () => {
  const D = Object.assign({}, BAZA, {
    pojazdy: [pojazd({ model: '<img src=x onerror=alert(1)>' })],
  });
  const r = runBookmarklet(buildUrl(script, D));
  assert(!r.panelHtml.includes('<img'), 'surowy <img> trafił do innerHTML — brak esc()');
  assert(r.panelHtml.includes('&lt;img'), 'oczekiwano zescapowanego <img> w panelu');
});

test('WEKTOR B — HTML w danych podatnika jest escapowany', () => {
  const D = Object.assign({}, BAZA, {
    nazwa: '<script>alert(1)</script>', miasto: '<b>X</b>', pojazdy: [pojazd()],
  });
  const r = runBookmarklet(buildUrl(script, D));
  assert(!r.panelHtml.includes('<script>'), 'surowy <script> w danych podatnika');
  assert(!r.panelHtml.includes('<b>X</b>'), 'surowy HTML w polu miasto');
});

console.log(`\n${'─'.repeat(40)}`);
console.log(`Wynik: ${_pass} PASS / ${_fail} FAIL`);
if (_fail) {
  console.log('\nNiezdane testy:');
  failures.forEach(f => console.log(`  ✗ ${f.name}: ${f.error}`));
}
console.log('');
process.exit(_fail > 0 ? 1 : 0);
