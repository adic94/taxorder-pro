/**
 * TaxOrder Pro — Import XML z CEPiK
 * Obsługuje: oficjalny format CEPiK, pojazd.info, AZTEC DR, XML z urzędu
 * Mapuje pola XML → model pojazdu, aktualizuje lub tworzy rekordy
 */
window.CepikXML = (function () {

  // ── Mapowanie nazw pól XML → pola modelu pojazdu ─────────────────────────
  const FIELD_MAP = {
    // Nr rejestracyjny
    nrRej: ['NrRejestracyjny','NUMER_REJESTRACYJNY','nr_rejestracyjny','RegistrationNumber',
            'rejestracja','tablica','nrrej','B'],
    // VIN
    vin: ['VIN','NrVin','nr_vin','Vin','ChassisNumber','NUMER_VIN','E'],
    // Marka / producent
    marka: ['Marka','MARKA','marka','Make','Producent','PRODUCENT','D1','D.1'],
    // Model
    model: ['Model','MODEL','model','ModelPojazdu','MODEL_POJAZDU','D3','D.3'],
    // Typ / wariant
    typ: ['Typ','TYP','typ','Type','TypPojazdu','D2','D.2'],
    wariant: ['Wariant','WARIANT','wariant','Variant'],
    wersja: ['Wersja','WERSJA','wersja','Version'],
    // Rok produkcji
    rok: ['RokProdukcji','ROK_PRODUKCJI','rok_produkcji','YearOfManufacture','rok','Rocznik'],
    // Paliwo
    paliwo: ['RodzajPaliwa','RODZAJ_PALIWA','rodzaj_paliwa','FuelType','Paliwo','P3','P.3'],
    // DMC
    dmcMax: ['Dmc','DMC','dmc','MaxMass','DmcMax','DMC_MAX','MaksymalnaMasaCalkowita','F1','F.1'],
    dmcZespolu: ['DmcZespolu','DMC_ZESPOLU','MasaTechnicznieDopuszczalna','F2','F.2'],
    // Masa własna
    masaWlasna: ['MasaWlasna','MASA_WLASNA','masa_wlasna','MassInRunningOrder','G'],
    // Ładowność
    ladownosc: ['Ladownosc','LADOWNOSC','ladownosc','Payload'],
    // Silnik
    pojSilnika: ['PojemnoscSilnika','POJEMNOSC_SILNIKA','pojemnosc_silnika','EngineCapacity','P1','P.1'],
    mocKW: ['MocSilnikaKW','MOC_SILNIKA_KW','moc_kw','PowerKW','MocSilnika','P2','P.2'],
    // Miejsca
    miejscaSied: ['LiczbaMiejscSiedzacych','LICZBA_MIEJSC_SIEDZACYCH','LiczbaMiejsc','S1','S.1'],
    miejscaStoj: ['LiczbaMiejscStojacych','LICZBA_MIEJSC_STOJACYCH','S2','S.2'],
    // Daty
    dataRejestracji: ['DataPierwszejRejestracjiWKraju','DATA_PIERWSZEJ_REJESTRACJI',
                      'DataRejestracji','RegistrationDate','B'],
    docWaznyDo: ['DataWaznosciDowodu','DOC_WAZNY_DO','H'],
    docDataWydania: ['DataWydaniaDowodu','DOC_WYDANY','I'],
    // Kategoria / przeznaczenie
    katPojazdu: ['Kategoria','KATEGORIA','kategoria','Category','J'],
    przeznaczenie: ['Przeznaczenie','PRZEZNACZENIE','przeznaczenie','Purpose'],
    // Homologacja
    homologacja: ['NrHomologacji','NR_HOMOLOGACJI','Homologacja','K'],
    // Nr silnika
    numerSilnika: ['NrSilnika','NR_SILNIKA','NumerSilnika','EngineNumber'],
    // Kolor
    kolorNadwozia: ['Kolor','KOLOR','kolor','Colour','Color'],
    // Rozstaw osi
    rozstawOsi: ['RozstawOsi','ROZSTAW_OSI','WheelBase','M1','M.1'],
    // Masa przyczepy
    masaPrzyczepyZHam: ['MasaPrzyczepyZHamulcem','O1','O.1'],
    masaPrzyczepyBezHam: ['MasaPrzyczepyBezHamulca','O2','O.2'],
    // Status
    status: ['Stan','STAN','StanPojazdu','Status','status'],
    // Właściciel
    wlasciciel: ['Wlasciciel','WLASCICIEL','Owner','WlascicielNazwa'],
    // Typ nadwozia
    bodyType: ['RodzajNadwozia','RODZAJ_NADWOZIA','BodyType','Nadwozie'],
    // Liczba osi (DT-1)
    osie: ['LiczbaOsi','LICZBA_OSI','osie','NumberOfAxles'],
  };

  // Normalizacja polskich znaków do lowercase ASCII
  function _n(s) {
    return String(s||'').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g,'')
      .replace(/[^a-z0-9]/g,'').trim();
  }

  // Mapowanie wartości paliwa
  const FUEL_MAP = {
    'olej napedowy':'ON', 'diesel':'ON', 'on':'ON',
    'benzyna bezolowiowa':'PB', 'benzyna':'PB', 'pb95':'PB95', 'pb98':'PB98',
    'lpg':'LPG', 'cng':'CNG', 'lng':'LNG',
    'energia elektryczna':'EV', 'elektryczny':'EV', 'ev':'EV',
    'hybryda':'HEV', 'hybrid':'HEV',
    'wodor':'H2', 'h2':'H2',
  };

  // Mapowanie statusu
  const STATUS_MAP = {
    'zarejestrowany':'aktywny', 'active':'aktywny', 'aktywny':'aktywny',
    'wyrejestrowany':'wyrejestrowany', 'deleted':'archiwalny',
    'czasowo wycofany':'zawieszony',
  };

  // ── Parsowanie XML ────────────────────────────────────────────────────────
  function _parseXML(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error('Błąd parsowania XML: ' + err.textContent.slice(0,100));
    return doc;
  }

  // Pobierz wartość tekstową elementu (case-insensitive na nazwie tagu)
  function _getVal(el, tagName) {
    // Bezpośredni atrybut
    const attr = el.getAttribute(tagName);
    if (attr !== null) return attr.trim();
    // Szukaj po tagName (różne przypadki)
    const children = el.children;
    for (let i=0; i<children.length; i++) {
      const child = children[i];
      if (_n(child.tagName) === _n(tagName)) return child.textContent.trim();
    }
    return null;
  }

  // Znajdź wartość pola pojazdu w elemencie XML
  function _findField(el, aliases) {
    for (const alias of aliases) {
      const val = _getVal(el, alias);
      if (val !== null && val !== '') return val;
    }
    // Fallback: szukaj po znormalizowanej nazwie
    const children = Array.from(el.children);
    for (const alias of aliases) {
      const an = _n(alias);
      const found = children.find(c => _n(c.tagName) === an);
      if (found) return found.textContent.trim();
    }
    return null;
  }

  // ── Wykryj format i wyciągnij elementy pojazdów ───────────────────────────
  function _detectAndExtract(doc) {
    // Format 1: <Pojazdy><Pojazd>...</Pojazd></Pojazdy>
    let items = Array.from(doc.querySelectorAll('Pojazd, pojazd, POJAZD'));
    if (items.length) return { items, format: 'CEPiK standard' };

    // Format 2: <vehicles><vehicle>...</vehicle></vehicles>
    items = Array.from(doc.querySelectorAll('vehicle, Vehicle'));
    if (items.length) return { items, format: 'vehicle' };

    // Format 3: <dane><rekord>...</rekord></dane>
    items = Array.from(doc.querySelectorAll('rekord, Rekord, record, Record'));
    if (items.length) return { items, format: 'rekord' };

    // Format 4: korzeń zawiera bezpośrednio dane pojazdu
    const root = doc.documentElement;
    if (_findField(root, FIELD_MAP.nrRej)) return { items: [root], format: 'single' };

    // Format 5: wszystkie dzieci korzenia to pojazdy
    const rootChildren = Array.from(root.children);
    if (rootChildren.length > 0 && rootChildren.every(c =>
      c.children.length > 2)) {
      return { items: rootChildren, format: 'root-children' };
    }

    throw new Error('Nierozpoznany format XML. Sprawdź czy plik pochodzi z CEPiK.');
  }

  // ── Konwertuj element XML → obiekt pojazdu ────────────────────────────────
  function _elementToVehicle(el) {
    const get = (field) => _findField(el, FIELD_MAP[field] || [field]);
    const getNum = (field) => {
      const v = get(field);
      if (!v) return null;
      const n = parseInt(v.replace(/\s/g,'').replace(',','.'));
      return isNaN(n) ? null : n;
    };

    const nrRej = get('nrRej')?.toUpperCase().replace(/\s/g,'');
    if (!nrRej) return null;

    // Normalizuj paliwo
    let paliwo = get('paliwo') || '';
    const paliwoKey = _n(paliwo);
    paliwo = FUEL_MAP[paliwoKey] || FUEL_MAP[Object.keys(FUEL_MAP).find(k => paliwoKey.includes(k)) || ''] || paliwo;

    // Normalizuj status
    let status = get('status') || 'aktywny';
    const statusKey = _n(status);
    status = STATUS_MAP[statusKey] || STATUS_MAP[Object.keys(STATUS_MAP).find(k=>statusKey.includes(k))||''] || 'aktywny';

    // Rok produkcji
    let rok = get('rok');
    if (rok) {
      const m = rok.match(/\d{4}/);
      rok = m ? m[0] : rok;
    }

    return {
      nrRej,
      vin: get('vin') || null,
      marka: get('marka') || '',
      model: get('model') || '',
      typ: get('typ') || '',
      wariant: get('wariant') || null,
      wersja: get('wersja') || null,
      rok: rok || null,
      paliwo,
      dmcMax: getNum('dmcMax'),
      dmcZespolu: getNum('dmcZespolu'),
      masaWlasna: getNum('masaWlasna'),
      ladownosc: getNum('ladownosc'),
      pojSilnika: getNum('pojSilnika'),
      mocKW: getNum('mocKW'),
      miejscaSied: getNum('miejscaSied'),
      miejscaStoj: getNum('miejscaStoj'),
      dataRejestracji: get('dataRejestracji') || null,
      docWaznyDo: get('docWaznyDo') || null,
      docDataWydania: get('docDataWydania') || null,
      katPojazdu: get('katPojazdu') || null,
      przeznaczenie: get('przeznaczenie') || null,
      homologacja: get('homologacja') || null,
      numerSilnika: get('numerSilnika') || null,
      kolorNadwozia: get('kolorNadwozia') || null,
      rozstawOsi: getNum('rozstawOsi'),
      masaPrzyczepyZHam: getNum('masaPrzyczepyZHam'),
      masaPrzyczepyBezHam: getNum('masaPrzyczepyBezHam'),
      status: status,
      wlasciciel: get('wlasciciel') || null,
      bodyType: get('bodyType') || null,
      osie: getNum('osie'),
      cepikSyncStatus: 'ok',
      cepikSyncDate: new Date().toISOString().slice(0,10),
    };
  }

  // ── Stan globalny ─────────────────────────────────────────────────────────
  let _parsed = [];
  let _format = '';
  let _stats = { total:0, matched:0, new:0, errors:0 };

  // ── UI ────────────────────────────────────────────────────────────────────
  function open() {
    document.getElementById('cepik-xml-modal').style.display = 'flex';
    _reset();
  }

  function close() {
    document.getElementById('cepik-xml-modal').style.display = 'none';
    _reset();
  }

  function _reset() {
    _parsed = []; _format = '';
    _stats = {total:0, matched:0, new:0, errors:0};
    const fi = document.getElementById('cepik-xml-file');
    if (fi) fi.value = '';
    ['cepik-step2','cepik-step3','cepik-result'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const s1 = document.getElementById('cepik-step1');
    if (s1) s1.style.display = 'block';
  }

  function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        let text = e.target.result;
        // Wykryj i napraw kodowanie
        if (text.includes('encoding="windows-1250"') || text.includes('encoding="iso-8859-2"')) {
          const dec = new TextDecoder('windows-1250');
          text = dec.decode(new Uint8Array([...text].map(c=>c.charCodeAt(0))));
          text = text.replace(/encoding="windows-1250"/i,'encoding="UTF-8"')
                     .replace(/encoding="iso-8859-2"/i,'encoding="UTF-8"');
        }

        const doc = _parseXML(text);
        const { items, format } = _detectAndExtract(doc);
        _format = format;

        _parsed = items.map(el => {
          try { return _elementToVehicle(el); }
          catch(e) { _stats.errors++; return null; }
        }).filter(Boolean);

        _stats.total = _parsed.length;
        _stats.matched = _parsed.filter(p => (window.vehs||[]).some(v=>v.nrRej===p.nrRej||v.vin===p.vin)).length;
        _stats.new = _stats.total - _stats.matched;

        document.getElementById('cepik-step1').style.display = 'none';
        document.getElementById('cepik-step2').style.display = 'block';
        document.getElementById('cepik-step3').style.display = 'block';
        _renderPreview();

      } catch(e) {
        toast('⚠ ' + e.message);
        console.error('[CepikXML]', e);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function _renderPreview() {
    const el = document.getElementById('cepik-preview');
    if (!el) return;

    document.getElementById('cepik-import-stats').innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <div class="stat-chip"><span>${_stats.total}</span> pojazdów w pliku</div>
        <div class="stat-chip stat-chip-green"><span>${_stats.matched}</span> pasuje do bazy (aktualizacja)</div>
        <div class="stat-chip stat-chip-amber"><span>${_stats.new}</span> nowych pojazdów</div>
        ${_stats.errors ? `<div class="stat-chip" style="color:var(--red)"><span>${_stats.errors}</span> błędów parsowania</div>` : ''}
        <div class="stat-chip" style="font-size:10px;color:var(--text3)">Format: ${_format}</div>
      </div>`;

    const COLS = ['Nr rej.','VIN','Marka','Model','Rok','Paliwo','DMC (kg)','Status','Akcja'];
    el.innerHTML = `
      <div style="overflow-x:auto;max-height:300px;overflow-y:auto">
        <table style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr style="background:var(--bg3);position:sticky;top:0">
            ${COLS.map(c=>`<th style="padding:5px 8px;text-align:left;white-space:nowrap">${c}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${_parsed.map(p => {
              const existing = (window.vehs||[]).find(v=>v.nrRej===p.nrRej||(p.vin&&v.vin===p.vin));
              const rowBg = existing ? '' : 'background:rgba(16,185,129,.05)';
              return `<tr style="${rowBg};border-bottom:0.5px solid var(--border)">
                <td style="padding:4px 8px;font-family:var(--mono);font-weight:700">${esc(p.nrRej)}</td>
                <td style="padding:4px 8px;font-family:var(--mono);font-size:10px;color:var(--text2)">${esc(p.vin||'—')}</td>
                <td style="padding:4px 8px">${esc(p.marka)}</td>
                <td style="padding:4px 8px">${esc(p.model)}</td>
                <td style="padding:4px 8px;font-family:var(--mono)">${esc(p.rok||'—')}</td>
                <td style="padding:4px 8px">${esc(p.paliwo||'—')}</td>
                <td style="padding:4px 8px;text-align:right;font-family:var(--mono)">${p.dmcMax!=null?p.dmcMax.toLocaleString('pl-PL'):'—'}</td>
                <td style="padding:4px 8px"><span style="font-size:10px;color:${existing?'var(--blue)':'var(--green)'}">${existing?'✏ aktualizacja':'✨ nowy'}</span></td>
                <td style="padding:4px 8px">
                  <input type="checkbox" class="cepik-chk" data-nrrej="${esc(p.nrRej)}" checked>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="cepik-create-new" checked> Utwórz nowe pojazdy (których nie ma w bazie)
        </label>
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:20px">
          <input type="checkbox" id="cepik-overwrite" checked> Nadpisuj istniejące pola (VIN, DMC, paliwo itp.)
        </label>
      </div>`;
  }

  async function doImport() {
    if (!_parsed.length) return;

    const createNew = document.getElementById('cepik-create-new')?.checked !== false;
    const overwrite = document.getElementById('cepik-overwrite')?.checked !== false;
    const checked = new Set(
      Array.from(document.querySelectorAll('.cepik-chk:checked')).map(c=>c.dataset.nrrej)
    );

    let updated=0, created=0, skipped=0;
    const toSave = [];

    _parsed.forEach(p => {
      if (!checked.has(p.nrRej)) { skipped++; return; }

      const existing = (window.vehs||[]).find(v => v.nrRej===p.nrRej || (p.vin && v.vin===p.vin));

      if (existing) {
        if (overwrite) {
          // Nadpisz tylko pola niepuste z XML, zachowaj lokalne dane (ubezpieczenia, tankowania itp.)
          Object.entries(p).forEach(([k,v]) => {
            if (v !== null && v !== '' && v !== undefined && k !== 'id') {
              existing[k] = v;
            }
          });
          toSave.push(existing);
          updated++;
        } else { skipped++; }
      } else if (createNew) {
        const newVeh = {
          ...p,
          id: Date.now() + Math.random(),
          selected: false,
          miesiacePodatku: 12,
          status: p.status || 'aktywny',
          is_active: true,
        };
        (window.vehs = window.vehs || []).push(newVeh);
        toSave.push(newVeh);
        created++;
      } else { skipped++; }
    });

    // Batch save
    if (window.TaxOrderFleetCloud?.saveVehicles && toSave.length) {
      try {
        for (let i=0; i<toSave.length; i+=20) {
          await window.TaxOrderFleetCloud.saveVehicles(toSave.slice(i,i+20));
        }
      } catch(e) { console.warn('[CepikXML] save error', e); }
    }

    if (typeof renderVeh === 'function') renderVeh();
    if (typeof renderDash === 'function') renderDash();
    if (typeof updateCounters === 'function') updateCounters();

    const resultEl = document.getElementById('cepik-result');
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div style="padding:16px;background:var(--green-light,#ecfdf5);border-radius:var(--radius);border:1px solid var(--green);text-align:center;margin-top:16px">
        <div style="font-size:18px;font-weight:700;color:var(--green);margin-bottom:6px">✓ Import CEPiK zakończony</div>
        <div style="font-size:13px">
          Zaktualizowano: <strong>${updated}</strong> pojazdów &nbsp;|&nbsp;
          Nowe: <strong>${created}</strong> &nbsp;|&nbsp;
          Pominięto: ${skipped}
        </div>
      </div>`;

    toast(`✓ CEPiK XML: ${updated} zaktualizowanych, ${created} nowych`);
  }

  function downloadTemplate() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Pojazdy>
  <Pojazd>
    <NrRejestracyjny>WA12345</NrRejestracyjny>
    <VIN>VXXXXXXXXXXXXXXX</VIN>
    <Marka>VOLKSWAGEN</Marka>
    <Model>CRAFTER</Model>
    <Typ>ciężarowy</Typ>
    <RokProdukcji>2021</RokProdukcji>
    <RodzajPaliwa>OLEJ NAPĘDOWY</RodzajPaliwa>
    <Dmc>3500</Dmc>
    <MasaWlasna>2100</MasaWlasna>
    <PojemnoscSilnika>1968</PojemnoscSilnika>
    <MocSilnikaKW>103</MocSilnikaKW>
    <LiczbaMiejscSiedzacych>2</LiczbaMiejscSiedzacych>
    <DataPierwszejRejestracjiWKraju>2021-03-15</DataPierwszejRejestracjiWKraju>
    <Kategoria>N1</Kategoria>
  </Pojazd>
  <Pojazd>
    <NrRejestracyjny>WA54321</NrRejestracyjny>
    <VIN>VYYYYYYYYYYYYYY</VIN>
    <Marka>MERCEDES-BENZ</Marka>
    <Model>SPRINTER</Model>
    <RokProdukcji>2022</RokProdukcji>
    <RodzajPaliwa>OLEJ NAPĘDOWY</RodzajPaliwa>
    <Dmc>5000</Dmc>
    <MasaWlasna>2800</MasaWlasna>
    <Kategoria>N2</Kategoria>
  </Pojazd>
</Pojazdy>`;
    const blob = new Blob([xml], {type:'text/xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='szablon_cepik.xml'; a.click();
    URL.revokeObjectURL(url);
  }

  // Parsuje XML lub JSON (string) i zwraca dane jednego pojazdu po nr rej (lub pierwszego)
  function parseOneFromText(text, nrRej) {
    // Próba JSON
    try {
      const data = JSON.parse(text);
      const item = Array.isArray(data) ? data[0] : (data.data || data.pojazd || data.vehicle || data);
      if (!item) return null;
      const mapped = {};
      for (const [field, aliases] of Object.entries(FIELD_MAP)) {
        for (const alias of aliases) {
          if (item[alias] !== undefined && item[alias] !== null && item[alias] !== '') {
            mapped[field] = item[alias]; break;
          }
        }
      }
      mapped.cepikSyncStatus = 'ok';
      mapped.cepikSyncDate = new Date().toISOString().slice(0,10);
      return Object.keys(mapped).length > 2 ? mapped : null;
    } catch(e) { /* not JSON */ }

    // Próba XML
    try {
      const doc = _parseXML(text);
      const { items } = _detectAndExtract(doc);
      if (!items.length) return null;
      let el = items[0];
      if (nrRej && items.length > 1) {
        const norm = nrRej.toUpperCase().replace(/\s/g,'');
        el = items.find(i => _findField(i, FIELD_MAP.nrRej)?.toUpperCase().replace(/\s/g,'') === norm) || items[0];
      }
      return _elementToVehicle(el);
    } catch(e) { return null; }
  }

  return { open, close, handleFile, doImport, downloadTemplate, parseOneFromText, FIELD_MAP };
})();
