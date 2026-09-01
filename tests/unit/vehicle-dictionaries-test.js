// Bramka: słowniki pojazdów (marka/model, typ, nadwozie, osie) — podpowiedzi jak na
// Otomoto + możliwość dopisania własnej wartości bez utraty wbudowanej listy.
//
// Ładuje produkcyjny modules/vehicle-dictionaries.js przez window-shim (ten sam
// wzorzec co inne bramki modułów klienckich w tym projekcie), z minimalnym stubem
// localStorage/document — moduł jest czysto frontendowy, bez zależności od Workera.

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error('FAIL:', msg); }
}

function makeWindow(vehs) {
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const elements = {};
  const document = {
    getElementById: id => elements[id] || null,
    createElement: tag => ({ tag, options: [], set innerHTML(html) {
        // Minimalna symulacja <option> dla attachDatalist — wystarcza do policzenia opcji.
        this._html = html;
        this.options = (html.match(/<option value="([^"]*)">/g) || [])
          .map(m => ({ value: m.match(/value="([^"]*)"/)[1] }));
      }, get innerHTML() { return this._html || ''; },
      setAttribute() {}, appendChild() {} }),
    body: { appendChild: (el) => { elements[el.id] = el; } },
  };
  // Pozwala testowi ręcznie "zamontować" input, na który attachDatalist ma wskazać list=.
  function mountInput(id) {
    const el = { id, setAttribute(name, val) { this[name] = val; } };
    elements[id] = el;
    return el;
  }
  return { window: { vehs: vehs || [] }, localStorage, document, mountInput, _elements: elements };
}

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'modules', 'vehicle-dictionaries.js'), 'utf8');

function load(vehs) {
  const ctx = makeWindow(vehs);
  const fn = new Function('window', 'localStorage', 'document', src + '\nreturn window.VehicleDictionaries;');
  const VD = fn(ctx.window, ctx.localStorage, ctx.document);
  return { VD, ctx };
}

// ── [1] Listy startowe niepuste, "8x4/6" obecne (dopisane na wyraźną prośbę) ────
{
  const { VD } = load();
  ok(VD.getMarki().length > 10, 'lista marek musi mieć sensowną liczbę pozycji startowych');
  ok(VD.getTypy().includes('Ciężarowy'), 'typy pojazdu muszą zawierać "Ciężarowy"');
  ok(VD.getNadwozia().some(([k]) => k === 'naczepa'), 'nadwozia muszą zawierać "naczepa"');
  const osie = VD.getOsie();
  ok(osie.some(([k]) => k === '8x4/6'), 'oznaczenie osi musi zawierać "8x4/6" (wprost zażądane)');
  ok(osie.some(([k]) => k === '8x4'), 'oznaczenie osi musi nadal zawierać bazowe "8x4"');
}

// ── [2] Model zależny od marki, w tym z floty (window.vehs) ─────────────────────
{
  const { VD } = load([{ marka: 'MERCEDES-BENZ', model: 'ACTROS-NIESTANDARDOWY' }]);
  const modele = VD.getModele('mercedes-benz'); // wielkość liter nieistotna
  ok(modele.includes('ACTROS'), 'modele Mercedesa muszą zawierać wbudowany ACTROS');
  ok(modele.includes('ACTROS-NIESTANDARDOWY'), 'modele muszą uwzględniać to, co już jest we flocie (window.vehs)');
  ok(VD.getModele('NIEZNANA-MARKA-XYZ').length === 0, 'nieznana marka bez floty daje pustą listę, nie zgadnięte modele');
}

// ── [3] Dopisanie własnej wartości NIE nadpisuje wbudowanej listy ───────────────
{
  const { VD, ctx } = load();
  const before = VD.getTypy().length;
  VD.addCustomSimple('typy', 'Quad');
  const after = VD.getTypy();
  ok(after.length === before + 1, 'dopisanie własnego typu dodaje jedną pozycję, nie nadpisuje listy');
  ok(after.includes('Quad') && after.includes('Ciężarowy'), 'lista po dopisaniu ma i starą, i nową wartość');

  // Nowa instancja modułu (symulacja przeładowania strony) — wpis musi przetrwać w localStorage.
  const fn2 = new Function('window', 'localStorage', 'document', src + '\nreturn window.VehicleDictionaries;');
  const VD2 = fn2(ctx.window, ctx.localStorage, ctx.document);
  ok(VD2.getTypy().includes('Quad'), 'własny wpis musi przetrwać "przeładowanie" (localStorage)');
}

// ── [4] Dopisanie duplikatu nie tworzy dwóch identycznych pozycji ───────────────
{
  const { VD } = load();
  VD.addCustomPair('nadwozia', 'naczepa', 'Naczepa (duplikat)');
  const count = VD.getNadwozia().filter(([k]) => k === 'naczepa').length;
  ok(count === 1, 'dopisanie klucza, który już istnieje (wbudowany), nie tworzy duplikatu');
}

// ── [5] addCustomModel — model przypisany do KONKRETNEJ marki, nie globalnie ────
{
  const { VD } = load();
  VD.addCustomModel('SCANIA', 'MOJA-WERSJA-XYZ');
  ok(VD.getModele('SCANIA').includes('MOJA-WERSJA-XYZ'), 'model dopisany do Scanii musi być widoczny dla Scanii');
  ok(!VD.getModele('VOLVO').includes('MOJA-WERSJA-XYZ'), 'model dopisany do Scanii NIE MOŻE wyciekać do modeli Volvo');
}

// ── [6] attachDatalist — nie nadpisuje istniejącego <datalist>, tylko go odświeża ──
{
  const { VD, ctx } = load();
  const input = ctx.mountInput('test-input');
  VD.attachDatalist('test-input', ['A', 'B'], 'test-list');
  ok(input.list === 'test-list', 'attachDatalist musi ustawić atrybut list= na wejściu');
  const dl1 = ctx._elements['test-list'];
  ok(dl1.options.length === 2, 'datalist musi mieć tyle opcji, ile przekazano');
  VD.attachDatalist('test-input', ['A', 'B', 'C'], 'test-list');
  const dl2 = ctx._elements['test-list'];
  ok(dl2.options.length === 3, 'ponowne wywołanie musi ODŚWIEŻYĆ istniejący datalist, nie zduplikować go');
}

// ── [7] buildSelectOptions / handleCustomSelect — kontrakt z vehicle-detail.js ──
{
  const { VD } = load();
  const html = VD.buildSelectOptions([['x', 'X'], ['y', 'Y']], 'y');
  ok(html.includes('value="y" selected'), 'zaznaczona wartość musi mieć atrybut selected');
  ok(html.includes(VD.CUSTOM_VALUE), 'lista opcji musi zawierać wartość-sentinel obsługi "Dodaj inny"');

  let addedCalled = null;
  const fakeSelect = { value: VD.CUSTOM_VALUE };
  global.prompt = () => 'Nowa Wartość';
  global.toast = () => {};
  VD.handleCustomSelect(fakeSelect, 'typy', (v) => VD.addCustomSimple('typy', v), (key) => { addedCalled = key; });
  ok(addedCalled === 'Nowa Wartość', 'handleCustomSelect musi wywołać onAdded z nową wartością po zapisaniu');
  ok(VD.getTypy().includes('Nowa Wartość'), 'wartość z promptu musi trafić do słownika');

  // Normalny wybór (nie sentinel) NIE wywołuje onAdded — <select> już ma poprawną wartość.
  let notCalled = false;
  const normalSelect = { value: 'x' };
  VD.handleCustomSelect(normalSelect, 'typy', () => {}, () => { notCalled = true; });
  ok(notCalled === false, 'zwykły wybór opcji (nie "Dodaj inny") nie może wywoływać onAdded');
}

console.log(`Wynik: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
