// ==================== SŁOWNIKI POJAZDÓW ====================
// Marka/model (podpowiedzi jak na Otomoto), typ pojazdu, typ nadwozia, oznaczenie
// osi — każdy słownik ma wbudowaną listę startową i pozwala dopisać własną wartość,
// gdy gotowej opcji brakuje. Własne wpisy trzymane per przeglądarka (localStorage),
// tym samym wzorcem co GminyRates dla gmin spoza Warszawy — nie ma tu backendu,
// bo to tylko podpowiedzi UI, nie dane wpływające na wyliczenie podatku.

window.VehicleDictionaries = (function () {
  const LS_KEY = 'taxVehDicts';

  // Osobno od `SEED`, żeby dopisanie własnej wartości nigdy nie nadpisało wbudowanej —
  // `_load()`/`_persist()` operują wyłącznie na tej części.
  const SEED = {
    marki: [
      'MERCEDES-BENZ','MAN','SCANIA','VOLVO','DAF','IVECO','RENAULT TRUCKS','FORD',
      'FIAT','ISUZU','MITSUBISHI FUSO','HYUNDAI','VOLKSWAGEN','CITROEN','PEUGEOT',
      'OPEL','NISSAN','TOYOTA','JEEP','SKODA','BMW','AUDI','KIA',
      'WIELTON','SCHMITZ CARGOBULL','KRONE','KÖGEL','KRAKER','FLIEGL',
      'ZASŁAW','WIOLA','PRONAR','METALFACH','NIEWIADÓW',
    ],
    modeleWgMarki: {
      'MERCEDES-BENZ': ['ACTROS','ATEGO','AXOR','ANTOS','AROCS','SPRINTER','VITO','ECONIC'],
      'MAN':           ['TGX','TGS','TGM','TGL','TGE'],
      'SCANIA':        ['R','S','G','P','L'],
      'VOLVO':         ['FH','FM','FMX','FL','FE'],
      'DAF':           ['XF','CF','LF','XG'],
      'IVECO':         ['STRALIS','EUROCARGO','DAILY','S-WAY'],
      'RENAULT TRUCKS':['T','C','K','D','MASTER'],
      'ISUZU':         ['D-MAX','N-SERIES','F-SERIES'],
    },
    // Typ pojazdu — TaxEngine.getCat()/getRate() i GminyRates.getRateKey() dopasowują
    // tę wartość PODCIĄGIEM (np. `.includes('naczepa')`), więc słownik podpowiada
    // gotowe wartości, ale pole zostaje wolnym tekstem — nowa pozycja w słowniku
    // nie może być krótszym/innym słowem, które przestałoby łapać się na te podciągi.
    typy: [
      'Ciężarowy','Ciągnik siodłowy','Ciągnik balastowy','Przyczepa','Naczepa',
      'Autobus','Dostawczy','Osobowy','Pojazd specjalny',
    ],
    nadwozia: [
      ['sedan','Sedan'],['kombi','Kombi'],['suv','SUV / Terenowy'],['van','Van / Bus'],
      ['pickup','Pickup'],['ciezarowka','Ciężarówka'],['naczepa','Naczepa'],['przyczepa','Przyczepa'],
      ['furgon','Furgon'],['wywrotka','Wywrotka'],['chlodnia','Chłodnia'],['cysterna','Cysterna'],
      ['plandeka','Plandeka (firanka)'],['laweta','Laweta'],['beczkowoz','Beczkowóz / asenizacyjny'],
      ['hakowiec','Hakowiec / bramowiec'],['smieciarka','Śmieciarka'],['hds','Z HDS (żuraw)'],
    ],
    // Oznaczenie osi (układ napędowy). `8x4/6` dopisane na wyraźną prośbę — czteroosiowy
    // 8×4 z dodatkową osią wleczoną/podnoszoną (piąte koło na drodze przy obciążeniu).
    osie: [
      ['4x2','4×2 — solówka / ciągnik siodłowy (1 oś napędowa, 1 skrętna)'],
      ['4x4','4×4 — napęd na 4 koła (PSP, terenowe, lekkie wywrotki)'],
      ['6x2','6×2 — 3 osie, 1 napędowa, tylna wleczona nieskrętna'],
      ['6x2*4','6×2*4 — ostatnia oś wleczona SKRĘTNA (śmieciarka, dystrybucja)'],
      ['6x2/4','6×2/4 — oś pchana przed napędem skrętna (ciągniki UK)'],
      ['6x4','6×4 — klasyczny budowlany: 2 tylne napędowe (wywrotki, gruszki)'],
      ['6x6','6×6 — pełny napęd terenowy (wojsko, energetyka)'],
      ['8x2/4','8×2/4 — 4 osie, 2 przednie skrętne, 1 napędowa, 1 wleczona'],
      ['8x2*6','8×2*6 — 3 osie skrętne, żurawie HDS miejskie (Scania G500)'],
      ['8x4','8×4 — standardowa wywrotka 4-osiowa (2 napędowe z tyłu)'],
      ['8x4/4','8×4/4 — 8×4 z 4 kołami sterowanymi z przodu'],
      ['8x4/6','8×4/6 — 8×4 z dodatkową osią wleczoną/podnoszoną'],
      ['8x4*4','8×4*4 — tridem: ostatnia oś wleczona skrętna, dobra zwrotność'],
      ['8x8','8×8 — pełny napęd, pojazdy pustyniowe / kopalniane'],
      ['10x4','10×4 — 5 osi, pompy do betonu powyżej 50 m'],
      ['10x4*6','10×4*6 — ciężkie tridem, ostatnia oś skrętna'],
      ['10x6*4','10×6*4 — 3 osie napędowe, 2 skrętne'],
      ['10x6*2','10×6*2 — spec. holenderskie (Ginaf, Terberg), kopalniane'],
    ],
  };

  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
  }
  function _persist(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
    catch (e) { console.warn('[VehicleDictionaries] Nie można zapisać słownika:', e.message); }
  }

  // Uczy się też z tego, co już jest we flocie (window.vehs) — dopisana wartość
  // gdzieś na karcie pojazdu od razu staje się podpowiedzią gdzie indziej.
  function _znaneZFloty(pole) {
    const out = new Set();
    (window.vehs || []).forEach(v => { const val = (v[pole] || '').toString().trim(); if (val) out.add(val); });
    return [...out];
  }

  function getMarki() {
    const custom = _load().marki || [];
    return [...new Set([...SEED.marki, ..._znaneZFloty('marka'), ...custom])].sort();
  }

  function getModele(marka) {
    const key = (marka || '').trim().toUpperCase();
    const seedModele = SEED.modeleWgMarki[key] || [];
    const custom = (_load().modeleWgMarki || {})[key] || [];
    const zFloty = (window.vehs || [])
      .filter(v => (v.marka || '').trim().toUpperCase() === key)
      .map(v => (v.model || '').trim())
      .filter(Boolean);
    return [...new Set([...seedModele, ...zFloty, ...custom])].sort();
  }

  function getTypy() {
    const custom = _load().typy || [];
    return [...new Set([...SEED.typy, ...custom])];
  }

  function getNadwozia() {
    const custom = _load().nadwozia || [];
    return [...SEED.nadwozia, ...custom];
  }

  function getOsie() {
    const custom = _load().osie || [];
    return [...SEED.osie, ...custom];
  }

  // Dopisuje wartość do słownika prostego (lista stringów: marki, typy).
  // Sprawdza WBUDOWANĄ listę też, nie tylko custom — inaczej wpisanie wartości,
  // która już jest w SEED, dublowałaby ją w połączonej liście (getTypy() itd.).
  function addCustomSimple(kind, value) {
    const val = (value || '').trim();
    if (!val) return null;
    if ((SEED[kind] || []).includes(val)) return val;
    const data = _load();
    if (!Array.isArray(data[kind])) data[kind] = [];
    if (!data[kind].includes(val)) data[kind].push(val);
    _persist(data);
    return val;
  }

  // Dopisuje wartość do słownika par [klucz,etykieta]: nadwozia, osie.
  function addCustomPair(kind, value, label) {
    const key = (value || '').trim();
    if (!key) return null;
    if ((SEED[kind] || []).some(([k]) => k === key)) return key;
    const data = _load();
    if (!Array.isArray(data[kind])) data[kind] = [];
    if (!data[kind].some(([k]) => k === key)) data[kind].push([key, label || key]);
    _persist(data);
    return key;
  }

  function addCustomModel(marka, model) {
    const key = (marka || '').trim().toUpperCase();
    const val = (model || '').trim();
    if (!key || !val) return null;
    if ((SEED.modeleWgMarki[key] || []).includes(val)) return val;
    const data = _load();
    if (!data.modeleWgMarki) data.modeleWgMarki = {};
    if (!Array.isArray(data.modeleWgMarki[key])) data.modeleWgMarki[key] = [];
    if (!data.modeleWgMarki[key].includes(val)) data.modeleWgMarki[key].push(val);
    _persist(data);
    return val;
  }

  // ── Podpięcie <datalist> pod istniejący input, bez zmiany jego id/zachowania ──
  function attachDatalist(inputId, options, datalistId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let dl = document.getElementById(datalistId);
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = datalistId;
      document.body.appendChild(dl);
    }
    dl.innerHTML = options.map(o => `<option value="${String(o).replace(/"/g,'&quot;')}">`).join('');
    input.setAttribute('list', datalistId);
  }

  // ── Select z opcją "+ Dodaj inny…" na końcu listy ────────────────────────────
  // `onCustomAdded(newKey)` jest wołane PO zapisaniu nowej pozycji do słownika,
  // żeby wywołujący mógł odświeżyć/zaznaczyć nowo dodaną opcję we własnym `<select>`.
  const CUSTOM_VALUE = '__dodaj_inny__';

  function buildSelectOptions(pairs, selected) {
    const opts = pairs.map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`);
    opts.push(`<option value="${CUSTOM_VALUE}">+ Dodaj inny…</option>`);
    return opts.join('');
  }

  // `onAdded(newKey)` jest wołane WYŁĄCZNIE po realnym dopisaniu nowej pozycji —
  // zwykły wybór istniejącej opcji w select nic tu nie wywołuje, bo <select> sam
  // już trzyma poprawną wartość.
  function handleCustomSelect(selectEl, kind, addFn, onAdded) {
    if (selectEl.value !== CUSTOM_VALUE) return;
    const label = prompt('Nowa wartość do dodania do słownika:');
    if (!label || !label.trim()) { selectEl.value = ''; return; }
    const key = addFn(label.trim());
    if (!key) { selectEl.value = ''; return; }
    if (typeof toast === 'function') toast(`✓ Dodano „${label.trim()}" do słownika`);
    if (onAdded) onAdded(key);
  }

  return {
    getMarki, getModele, getTypy, getNadwozia, getOsie,
    addCustomSimple, addCustomPair, addCustomModel,
    attachDatalist, buildSelectOptions, handleCustomSelect, CUSTOM_VALUE,
  };
})();
