#!/usr/bin/env node
/**
 * Bramka: zduplikowane statyczne `id="..."` w index.html i modules/vehicle-detail.js.
 *
 * PO CO. `document.getElementById(id)` zwraca zawsze PIERWSZY element w DOM z danym
 * id — drugi (i każdy kolejny) jest po cichu nieosiągalny. W tej sesji ta klasa
 * błędu ugryzła DWA RAZY:
 *   - `wlascicielPojazdu` renderowane dwukrotnie w karcie pojazdu (zakładki
 *     Eksploatacja i Własność) — wpis w zakładce Własność (widoczna użytkownikowi)
 *     nigdy się nie zapisywał, bo save() zawsze czytał pierwszą kopię;
 *   - `bm-id` w DWÓCH niepowiązanych modalach (Oddział CRUD, Budżet) —
 *     BudgetsModule czytało i pisało do ukrytego pola modala oddziału.
 * Oba znalezione ręcznym skanem Python/regex, jednorazowo. Bez tej bramki
 * następny taki duplikat (skopiowany fragment HTML, drugi deweloper wybierający
 * ten sam krótki prefiks) przejdzie niezauważony — dokładnie jak poprzednie dwa.
 *
 * CO SPRAWDZA. Wyłącznie id CAŁKOWICIE STATYCZNE (bez `${...}` — te są z natury
 * bezpieczne, bo różnią się per instancję, np. `vd-tab-${id}` albo
 * `vd-cepik-status-${v.id}`). `modules/vehicle-detail.js` skanowany osobno od
 * `index.html`, bo cała jego zawartość ląduje w JEDNYM modalu (`#vd-modal-body`)
 * przez jedno `innerHTML =` — id unikalne w `index.html` osobno i w tym pliku
 * osobno wystarczą, bo te dwa drzewa DOM nie mieszają się ze sobą.
 *
 * ZNANE_WYJATKI: para plik→id, dla której duplikat jest ŚWIADOMY i bezpieczny
 * (np. dwa fragmenty markupu, które nigdy nie współistnieją w tym samym DOM
 * na raz — żaden taki przypadek nie jest dziś znany, lista zaczyna pusta).
 * Wpis, który przestał występować, MUSI zniknąć — inaczej lista rosłaby
 * w nieskończoność i bramka przestałaby cokolwiek mierzyć.
 *
 * SEKCJA [4] — MIĘDZYMODUŁOWA. [1] i [2] łapią duplikat WEWNĄTRZ jednego pliku;
 * nie widzą, że DWA RÓŻNE pliki (index.html + moduł, albo dwa moduły) użyły
 * tego samego literału. To jest realna, osobna kategoria awarii — ten sam
 * `getElementById` po cichu trafia w element z zupełnie innej, niepowiązanej
 * funkcjonalnie części aplikacji. Znaleziona 02.09.2026 ręcznym skanem
 * Python/regex (index.html + wszystkie modules/*.js): `pm-modal`/`pm-modal-title`
 * (statyczny modal "MODAL: POLISA" w index.html kontra modal wstrzykiwany przez
 * predictive-maintenance.js), `ocr-file`/`ocr-preview`/`ocr-result` (statyczna
 * strona "Skanuj DR" w index.html kontra ocr-fuel-invoices.js), `tpl-name`
 * (doc-workflow.js kontra notification-settings.js, oba wstrzykują modal przez
 * insertAdjacentHTML). Wszystkie trzy naprawione przemianowaniem.
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error('FAIL:', msg); }
}

const ROOT = path.join(__dirname, '..', '..');

const ZNANE_WYJATKI = {
  // 'index.html': ['jakis-id'],
};

// Para (id, [plik1, plik2, ...]) świadomie bezpieczna mimo współdzielenia id
// między plikami — dziś pusta, bo wszystkie trzy znalezione przypadki naprawiono
// przemianowaniem zamiast dopisywaniem wyjątku.
const ZNANE_WYJATKI_MIEDZYMODULOWE = {
  // 'jakis-id': ['index.html', 'modules/przyklad.js'],
};

function liczOd(wpisy) {
  const licznik = {};
  for (const id of wpisy) licznik[id] = (licznik[id] || 0) + 1;
  return licznik;
}

function filtrujDuplikaty(plik, licznik) {
  const wyjatki = new Set(ZNANE_WYJATKI[plik] || []);
  return Object.entries(licznik).filter(([id, n]) => n > 1 && !wyjatki.has(id));
}

// --- [1] index.html — literalne id="..." / id='...' (bez interpolacji) -------
// W statycznym HTML KAŻDE id piszemy wprost jako literał, więc grep po samym
// atrybucie łapie wszystko.
{
  const plik = 'index.html';
  const tresc = fs.readFileSync(path.join(ROOT, plik), 'utf8');
  const re = /id=["']([a-zA-Z][a-zA-Z0-9_-]*)["']/g;
  const wpisy = [];
  let m; while ((m = re.exec(tresc))) wpisy.push(m[1]);
  const dupy = filtrujDuplikaty(plik, liczOd(wpisy));
  ok(dupy.length === 0,
    `${plik}: ${dupy.length} zduplikowanych id — ${dupy.map(([id, n]) => `${id}(${n}x)`).join(', ')}`);
}

// --- [2] modules/vehicle-detail.js -------------------------------------------
// Tu inaczej: prawie każde pole karty pojazdu idzie przez helpery field()/sel()/
// selDict(id, ...), które renderują `id="vd-${id}"` — w SUROWYM pliku źródłowym
// ten atrybut wygląda identycznie za każdym razem (`${id}`), więc grep po
// `id="..."` nie zobaczy duplikatu wcale — dopiero po podstawieniu w runtime
// dwa wywołania z tym samym pierwszym argumentem stają się tym samym id.
// Dlatego łapiemy PIERWSZY ARGUMENT tych trzech wywołań, nie literał HTML.
// (Zweryfikowane negatywnie: wersja czytająca id="..." przechodziła 2/0 nawet
// z ręcznie wstrzykniętym drugim field('wlascicielPojazdu', ...) — bo ten atrybut
// w źródle to zawsze `id="vd-${id}"`, bez względu na to, co w niego trafi.)
{
  const plik = 'modules/vehicle-detail.js';
  const tresc = fs.readFileSync(path.join(ROOT, plik), 'utf8');
  const re = /(?:field|sel|selDict)\('([a-zA-Z0-9_.]+)'/g;
  const wpisy = [];
  let m; while ((m = re.exec(tresc))) wpisy.push(m[1]);
  ok(wpisy.length > 100, `modules/vehicle-detail.js: znaleziono tylko ${wpisy.length} wywołań field/sel/selDict — ekstraktor prawdopodobnie się rozjechał z kodem (oczekiwano >100)`);
  const dupy = filtrujDuplikaty(plik, liczOd(wpisy));
  ok(dupy.length === 0,
    `${plik}: ${dupy.length} zduplikowanych id w field()/sel()/selDict() — ${dupy.map(([id, n]) => `${id}(${n}x)`).join(', ')}`);
}

// --- [3] zapadka: wpis w ZNANE_WYJATKI, który już nie duplikuje się -----------
{
  for (const [plik, ids] of Object.entries(ZNANE_WYJATKI)) {
    const tresc = fs.readFileSync(path.join(ROOT, plik), 'utf8');
    for (const id of ids) {
      const n = (tresc.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length;
      ok(n > 1, `ZNANE_WYJATKI["${plik}"] ma "${id}", ale występuje ${n}x — wpis martwy, USUŃ z listy`);
    }
  }
}

// --- [4] międzymodułowe: ten sam literalny id w DWÓCH RÓŻNYCH plikach --------
// index.html + KAŻDY modules/*.js (w tym vehicle-detail.js — tu chodzi o jego
// WŁASNE literalne id="...", nie o field()/sel()/selDict(), które [2] już
// pokrywa osobno). Ten sam ekstraktor co [1]: id CAŁKOWICIE statyczne.
{
  const idToFiles = {}; // id -> Set<plik>
  const pliki = ['index.html', ...fs.readdirSync(path.join(ROOT, 'modules'))
    .filter(f => f.endsWith('.js'))
    .map(f => `modules/${f}`)];
  ok(pliki.length > 50, `[4]: znaleziono tylko ${pliki.length} plików do sprawdzenia (index.html + modules/*.js) — oczekiwano >50, coś się rozjechało z listą katalogu`);

  const re = /id=["']([a-zA-Z][a-zA-Z0-9_-]*)["']/g;
  for (const plik of pliki) {
    const tresc = fs.readFileSync(path.join(ROOT, plik), 'utf8');
    const seen = new Set();
    let m; while ((m = re.exec(tresc))) seen.add(m[1]);
    for (const id of seen) {
      (idToFiles[id] = idToFiles[id] || new Set()).add(plik);
    }
  }

  const dupy = Object.entries(idToFiles)
    .filter(([id, files]) => files.size > 1)
    .filter(([id, files]) => {
      const wyjatek = ZNANE_WYJATKI_MIEDZYMODULOWE[id];
      if (!wyjatek) return true;
      const takieSame = wyjatek.length === files.size && wyjatek.every(f => files.has(f));
      return !takieSame;
    });
  ok(dupy.length === 0,
    `międzymodułowy duplikat id — ${dupy.map(([id, files]) => `${id}(${[...files].join(', ')})`).join(' | ')}`);

  for (const [id, oczekiwanePliki] of Object.entries(ZNANE_WYJATKI_MIEDZYMODULOWE)) {
    const faktycznePliki = idToFiles[id] ? [...idToFiles[id]] : [];
    const takieSame = oczekiwanePliki.length === faktycznePliki.length &&
      oczekiwanePliki.every(f => faktycznePliki.includes(f));
    ok(takieSame, `ZNANE_WYJATKI_MIEDZYMODULOWE["${id}"] nie odpowiada już rzeczywistości (${faktycznePliki.join(', ') || 'brak duplikatu'}) — wpis martwy, USUŃ z listy`);
  }
}

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
