/**
 * TaxOrder Pro — kontrola PODSTAWY OPODATKOWANIA na produkcyjnym D1
 *
 * Uruchom:
 *   node tools/autotest/d1-flota-check.js            # raport
 *   node tools/autotest/d1-flota-check.js --strict   # kod wyjścia 1 przy znalezisku (do CI)
 *   node tools/autotest/d1-flota-check.js --z-pliku <wynik.json>   # bez wranglera
 *
 * Wymaga zalogowanego wranglera (`wrangler login`) albo CLOUDFLARE_API_TOKEN — chyba że
 * podasz `--z-pliku` z gotową odpowiedzią `wrangler d1 execute --json`.
 *
 * DLACZEGO ISTNIEJE: `d1-schema-diff.js` pyta „czy baza ma taki KSZTAŁT, jak myślimy".
 * To narzędzie pyta o co innego — „czy w bazie stoją takie DANE, żeby podatek dało się
 * policzyć i żeby żaden pojazd cicho z niego nie wypadł". Kształt może być bez zarzutu,
 * a pojazd i tak płaci zero, bo ma puste jedno pole.
 *
 * Wszystkie cztery kontrole wykrywają ten sam rodzaj awarii: BRAK, KTÓRY NIE JEST BŁĘDEM.
 * Pojazd z pustą DMC nie generuje wyjątku ani ostrzeżenia — po prostu nie ma kategorii
 * i wypada z sumy. Deklaracja wygląda poprawnie i nikt jej nie zakwestionuje poza urzędem.
 *
 * Wykryte tym sposobem przy pierwszym uruchomieniu (27.08.2026, odczyt produkcyjnego D1):
 *   • WZ481KK + WA0677L — DWA WIERSZE POD JEDNYM VIN-em (YS2R6X2000548xxxx), obydwa
 *     Scania R490 „Szambiarka", obydwa z pustą DMC, obydwa 0 zł. Różna liczba osi
 *     (2 kontra 3) przy tym samym VIN znaczy, że albo jeden to stara tablica po
 *     przerejestrowaniu, albo VIN wklejono przez pomyłkę;
 *   • WA995AL — dane KOMPLETNE, silnik liczy D14/1488 zł, a baza trzyma pustą kategorię
 *     i zero. Nie jest to zwolnienie leasingowe: `leasingCompany` nie jest ustawione
 *     u żadnego pojazdu, a 122 ze 132 aut ze statusem „Leasing" są opodatkowane.
 *
 * ⚠️ NARZĘDZIE NICZEGO NIE ZAPISUJE. Poprawa kwoty podatku na produkcji to decyzja
 * właściciela, nie skutek uboczny kontroli.
 */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT    = path.join(__dirname, '..', '..');
const DB_NAME = 'taxorder-pro';
const STRICT  = process.argv.includes('--strict');

// Odczyt z gotowego pliku zamiast z wranglera. Powód nie jest wygodą: sesja w chmurze
// NIE MA wranglera, a ma dostęp do D1 innym kanałem — bez tej ścieżki narzędzia nie dałoby
// się sprawdzić na prawdziwych danych, a niesprawdzone narzędzie jest gorsze niż żadne.
// Plik to surowa odpowiedź `wrangler d1 execute --json` (albo sama tablica wyników).
const iPlik = process.argv.indexOf('--z-pliku');
const Z_PLIKU = iPlik !== -1 ? process.argv[iPlik + 1] : null;
if (iPlik !== -1 && !Z_PLIKU) {
  console.error('--z-pliku wymaga ścieżki do pliku JSON');
  process.exit(2);
}

const C = { r:'\x1b[31m', g:'\x1b[32m', y:'\x1b[33m', d:'\x1b[2m', b:'\x1b[1m', x:'\x1b[0m' };
let znalezisk = 0;
const ok  = m => console.log(`  ${C.g}✓${C.x} ${m}`);
const bad = (m, d) => { znalezisk++; console.log(`  ${C.r}✗${C.x} ${m}`); if (d) console.log(`     ${C.d}${d}${C.x}`); };
const inf = (m, d) => { console.log(`  ${C.y}!${C.x} ${m}`); if (d) console.log(`     ${C.d}${d}${C.x}`); };

/**
 * ZNANE, ŚWIADOMIE ZAAKCEPTOWANE POZYCJE.
 *
 * ⚠️ To NIE jest miejsce na uciszanie kontroli. Wpis tutaj oznacza „sprawdzone
 * u źródła i tak ma być", nie „nie chce mi się tego naprawiać". Każdy wpis musi
 * podawać powód, a kontrola [5] niżej wymusza usunięcie wpisu, gdy pozycja znika —
 * inaczej lista rosłaby w nieskończoność i narzędzie przestałoby cokolwiek mierzyć.
 */
const ZNANE = {
  '895': 'nie jest pojazdem — myjka ciśnieniowa Kränzle wpisana jako przyczepa, bez tablicy i bez VIN-u',
};

// ─── odczyt z D1 ──────────────────────────────────────────────────────────────

// Wywołanie wranglera jak w d1-schema-diff.js: przez `node <plik>.js`, NIE przez
// node_modules/.bin/wrangler.cmd — od łatki na CVE-2024-27980 Node na Windows odmawia
// uruchomienia .cmd bez powłoki i przewraca się na `spawnSync ... EINVAL`.
function d1(sql) {
  if (Z_PLIKU) {
    const parsed = JSON.parse(fs.readFileSync(Z_PLIKU, 'utf8'));
    const rows = (Array.isArray(parsed) ? parsed : [parsed]).flatMap(r => r.results || r.result || r);
    if (!rows.length || !('nr_rej' in rows[0]))
      throw new Error(`${Z_PLIKU} nie wygląda na wynik zapytania o pojazdy (brak kolumny nr_rej)`);
    return rows;
  }
  const cli = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const useLocal = fs.existsSync(cli);
  const tail = ['d1', 'execute', DB_NAME, '--remote', '--json', '--command', sql];
  const exe  = useLocal ? process.execPath : 'wrangler';
  const args = useLocal ? [cli, ...tail] : tail;

  let raw;
  try {
    raw = execFileSync(exe, args, {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const details = [e.stderr, e.stdout].filter(Boolean).join('\n');
    if (/not authenticated|wrangler login|Authentication|CLOUDFLARE_API_TOKEN|credentials/i.test(details)) {
      throw new Error('AUTH: wrangler nie ma poświadczeń');
    }
    throw new Error((e.message || 'nieznany błąd').split('\n')[0] +
      (details ? '\n   ' + details.trim().split('\n').slice(-3).join('\n   ') : ''));
  }

  const start = raw.indexOf('[');
  if (start < 0) throw new Error('Nie znaleziono JSON w odpowiedzi wranglera:\n   ' + raw.slice(0, 300));
  const parsed = JSON.parse(raw.slice(start));
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap(r => r.results || r.result || []);
}

// ─── silnik podatkowy ─────────────────────────────────────────────────────────

// PRODUKCYJNY silnik przez `window`-shim — ten sam kod, którym liczy aplikacja.
// Kopia progów rozjechałaby się i ukryła dokładnie ten błąd, który ma wykrywać.
function silnik() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'modules', 'gminy-rates.js'), 'utf8'))(w);
  new Function('window', fs.readFileSync(path.join(ROOT, 'modules', 'tax-engine.js'), 'utf8'))(w);
  if (!w.TaxEngine || typeof w.TaxEngine.calcTax !== 'function')
    throw new Error('modules/tax-engine.js nie wystawił TaxEngine.calcTax — ekstrakcja przestała działać');
  return w.TaxEngine;
}

// ─── maskowanie ───────────────────────────────────────────────────────────────

// VIN identyfikuje konkretny pojazd i jego właściciela. Raport bywa wklejany do zgłoszeń
// i czatów, więc pokazujemy tylko tyle, żeby dało się dopasować dwa wiersze do siebie.
const maskVin = v => {
  const s = String(v || '');
  return s.length > 8 ? s.slice(0, 9) + 'x'.repeat(s.length - 9) : s;
};

// ─── raport ───────────────────────────────────────────────────────────────────

console.log(`\n${C.b}Podstawa opodatkowania kontra produkcyjne D1${C.x}\n`);

let pojazdy;
try {
  pojazdy = d1(
    'SELECT nr_rej, dt1_category, dt1_tax_amount, axles_count, data FROM vehicles ORDER BY nr_rej'
  );
} catch (e) {
  if (/^AUTH:/.test(e.message)) {
    console.log(`  ${C.y}!${C.x} wrangler nie ma poświadczeń — kontrola pominięta`);
    console.log(`     ${C.d}Zaloguj się:  node node_modules/wrangler/bin/wrangler.js login${C.x}`);
    console.log(`     ${C.d}Uwaga: CLOUDFLARE_API_TOKEN w .env PRZESŁANIA logowanie OAuth.${C.x}\n`);
    process.exit(0);
  }
  console.log(`  ${C.r}✗${C.x} odczyt z D1 nie powiódł się\n     ${C.d}${e.message}${C.x}\n`);
  process.exit(1);
}

const TaxEngine = silnik();
ok(`odczytano ${pojazdy.length} pojazdów z produkcyjnego D1`);

// Rozpakowanie kolumny JSON `data` — płaskich kolumn w `vehicles` jest tylko kilka,
// reszta pól pojazdu siedzi w niej.
const flota = [];
const zlyJson = [];
for (const r of pojazdy) {
  let v;
  try { v = JSON.parse(r.data || '{}'); } catch { zlyJson.push(r.nr_rej); continue; }
  flota.push({
    nr:   r.nr_rej,
    katB: r.dt1_category || null,
    kwB:  Number(r.dt1_tax_amount) || 0,
    osieKol: r.axles_count,
    v,
  });
}

// ─── [0] nieczytelny JSON ─────────────────────────────────────────────────────
console.log('\n[0] Kolumna `data` — poprawność JSON');
if (zlyJson.length) bad(`${zlyJson.length} pojazdów z niepoprawnym JSON`, zlyJson.join(', '));
else ok('wszystkie wiersze sparsowane');

// ─── [1] duplikaty po VIN ─────────────────────────────────────────────────────
// VIN jest przypisany do nadwozia na stałe i JAKO JEDYNA cecha przeżywa zmianę tablicy.
// Dwa wiersze pod jednym VIN-em to albo stara tablica po przerejestrowaniu (wtedy podatek
// policzy się DWA RAZY), albo pomyłka przy wpisywaniu (wtedy jeden z pojazdów ma cudze dane).
console.log('\n[1] Duplikaty po VIN');
const poVin = new Map();
for (const p of flota) {
  const vin = String(p.v.vin || '').trim().toUpperCase();
  if (!vin) continue;
  if (!poVin.has(vin)) poVin.set(vin, []);
  poVin.get(vin).push(p);
}
const dupy = [...poVin.entries()].filter(([, g]) => g.length > 1);
if (!dupy.length) {
  ok(`żaden VIN nie występuje pod więcej niż jedną tablicą (${poVin.size} VIN-ów)`);
} else {
  for (const [vin, g] of dupy) {
    const opis = g.map(p => `${p.nr} (osie ${p.v.osie ?? '?'}, ${p.kwB} zł)`).join('  +  ');
    bad(`${maskVin(vin)} — ${g.length} wiersze`, `${opis}   ${g[0].v.marka || ''} ${g[0].v.model || ''}`.trim());
  }
}

// ─── [2] pojazdy bez DMC ──────────────────────────────────────────────────────
// Bez DMC `getCat()` zwraca null, więc pojazd NIE MA kategorii i wypada z sumy —
// bez błędu, bez ostrzeżenia, bez śladu w deklaracji.
console.log('\n[2] Pojazdy bez DMC — wypadają z podstawy opodatkowania');
const bezDmc = flota.filter(p => (p.v.dmc ?? p.v.dmcMax) == null);
const bezDmcNowe = bezDmc.filter(p => !ZNANE[p.nr]);
for (const p of bezDmc.filter(p => ZNANE[p.nr]))
  ok(`${p.nr} — znany: ${ZNANE[p.nr]}`);
if (!bezDmcNowe.length) {
  ok('każdy pozostały pojazd ma DMC');
} else {
  for (const p of bezDmcNowe)
    bad(`${p.nr} — DMC puste, podatek ${p.kwB} zł`,
        `${p.v.marka || ''} ${p.v.model || ''} · ${p.v.typ || 'rodzaj nieznany'} · osie ${p.v.osie ?? '?'}`.trim());
}

// ─── [3] pojazdy od 12 t bez liczby osi ───────────────────────────────────────
// OD 12 t STAWKA ZALEŻY OD LICZBY OSI, a `getCat()` przy jej braku CICHO przyjmuje 2
// (`parseInt(v.osie) || 2`) — czyli najniższą stawkę w przedziale. Brak danych nie jest
// tu błędem, tylko zaniżoną kwotą, która wygląda tak samo wiarygodnie jak poprawna.
console.log('\n[3] Pojazdy od 12 t bez liczby osi');
const ciezkieBezOsi = flota.filter(p => {
  const dmc = p.v.dmc ?? p.v.dmcMax;
  if (!(Number(dmc) >= 12000)) return false;
  return (p.v.osie ?? p.osieKol) == null;
});
if (!ciezkieBezOsi.length) ok('każdy pojazd od 12 t ma liczbę osi');
else for (const p of ciezkieBezOsi)
  bad(`${p.nr} — DMC ${p.v.dmc ?? p.v.dmcMax}, brak osi → silnik przyjmie 2`,
      `${p.v.marka || ''} ${p.v.model || ''}`.trim());

// ─── [4] baza kontra silnik ───────────────────────────────────────────────────
// Kolumny `dt1_*` to zapisany SNAPSHOT, nie wyliczenie na żywo. Ta sekcja pyta,
// czy snapshot nadal zgadza się z tym, co policzyłby dziś produkcyjny silnik.
console.log('\n[4] Zapisana kwota kontra produkcyjny silnik podatkowy');
const rozne = [];
let sumaBaza = 0, sumaSilnik = 0, bledySilnika = 0;
for (const p of flota) {
  let w;
  try { w = TaxEngine.calcTax(p.v); }
  catch (e) { bledySilnika++; bad(`${p.nr} — silnik rzucił wyjątkiem`, e.message); continue; }
  const katS = w.cat || null;
  const kwS  = Math.round(Number(w.amount) || 0);
  sumaBaza += p.kwB;
  sumaSilnik += kwS;
  if (katS !== p.katB || Math.abs(p.kwB - kwS) >= 1)
    rozne.push({ ...p, katS, kwS });
}
const rozneNowe = rozne.filter(p => !ZNANE[p.nr]);
if (!rozneNowe.length && !bledySilnika) {
  ok(`${flota.length - rozne.length}/${flota.length} zgodnych · suma ${sumaBaza} zł`);
} else {
  for (const p of rozneNowe)
    bad(`${p.nr} — baza ${p.katB ?? '(brak)'} ${p.kwB} zł, silnik ${p.katS ?? '(brak)'} ${p.kwS} zł`,
        `${p.v.typ || '?'} · DMC ${p.v.dmc ?? p.v.dmcMax ?? '?'} · osie ${p.v.osie ?? '?'} · miesięcy ${p.v.miesiacePodatku ?? '?'}`);
  inf(`suma wg bazy ${sumaBaza} zł · wg silnika ${sumaSilnik} zł · różnica ${sumaSilnik - sumaBaza} zł`);
}

// ─── [5] zapadka na listę znanych ─────────────────────────────────────────────
// Wpis, który przestał występować, MUSI zniknąć z listy. Bez tego lista rośnie
// i po jakimś czasie zawiera wyłącznie pozycje nieaktualne — czyli nie mierzy nic.
console.log('\n[5] Lista znanych pozycji');
const wystepuje = new Set([...bezDmc, ...rozne, ...ciezkieBezOsi].map(p => p.nr));
let sierotki = 0;
for (const nr of Object.keys(ZNANE)) {
  if (!wystepuje.has(nr)) { sierotki++; bad(`${nr} jest na liście znanych, ale już nie występuje — usuń wpis (naprawione)`); }
}
if (!sierotki) ok(`${Object.keys(ZNANE).length} pozycji, każda nadal występuje`);

// ─── podsumowanie ─────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
if (znalezisk === 0) {
  console.log(`${C.g}Podstawa opodatkowania bez zastrzeżeń.${C.x}\n`);
  process.exit(0);
}
console.log(`${C.r}Znalezisk: ${znalezisk}${C.x}`);
console.log(`${C.d}Narzędzie niczego nie zapisuje — poprawa kwoty podatku na produkcji`);
console.log(`to decyzja właściciela, nie skutek uboczny kontroli.${C.x}\n`);
process.exit(STRICT ? 1 : 0);
