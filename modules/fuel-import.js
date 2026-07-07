/**
 * TaxOrder Pro — Moduł Kosztów / Import Tankowań
 * Import CSV z kart paliwowych: ORLEN, DKV, BP, Shell, Lotos, Circle K
 * + ręczne tankowanie + historia kosztów per pojazd
 */
window.FuelImport = (function () {

  // ── Mapowanie nazw kolumn CSV na pola modelu ──────────────────────────────
  const FIELD_ALIASES = {
    date:       ['data','data transakcji','data tankowania','transaction date','date','datum','data operacji'],
    time:       ['godzina','czas','time','godzina transakcji','hora','time of transaction'],
    nrRej:      ['nr rejestracyjny','nr rej','rejestracja','nr.rej.','plate','reg no','vehicle reg',
                 'vehicle registration','tablice','tablica rej'],
    cardNo:     ['nr karty','numer karty','card number','card no','no karty','karta paliwowa','card'],
    liters:     ['ilosc','litry','litrow','volume','quantity','vol l','fuel qty','qty',
                 'ilosc l','ilosc (l)','ilosc paliwa','litres','liters'],
    pricePerL:  ['cena','cena za litr','cena/l','unit price','price','price per litre',
                 'cena jedn','cenajl','cena netto'],
    totalGross: ['kwota brutto','kwota','total','total amount','amount','wartosc','wartosc brutto',
                 'suma','suma brutto','kwota transakcji','wartość'],
    totalNet:   ['kwota netto','net','net amount','wartosc netto','suma netto'],
    station:    ['stacja','stacja paliw','station','site name','site','sklep','punkt sprzedazy'],
    location:   ['miejscowosc','miasto','city','location','adres','miejsce','country'],
    product:    ['produkt','product','fuel type','rodzaj paliwa','paliwo','fuel','typ paliwa'],
    km:         ['przebieg','licznik','km','odometer','mileage','stan km','km przy tankowaniu'],
    notes:      ['uwagi','opis','notes','remarks','info'],
  };

  const NUMERIC_FIELDS = new Set(['liters','pricePerL','totalGross','totalNet','km']);

  // Produkt → typ paliwa
  const PRODUCT_MAP = {
    on:'diesel', 'on evo':'diesel', diesel:'diesel', dieselevo:'diesel',
    pb95:'pb95', pb98:'pb98', 'e10':'pb95', 'super':'pb95', benzyna:'pb95',
    lpg:'lpg', lng:'lng', cng:'cng', 'h2':'h2',
    adblue:'mocznik', mocznik:'mocznik', 'ad-blue':'mocznik',
    myjnia:'myjnia', wash:'myjnia', 'car wash':'myjnia',
  };

  // Współczynniki emisji CO2 wg KOBIZE (kg CO2/litr lub kg CO2/m³ dla CNG)
  // Źródło: Wskaźniki emisji z zużycia paliw KOBiZE (aktualizacja 2024)
  const KOBIZE_FACTORS = {
    diesel: 2.679, on: 2.679,
    pb95: 2.302, pb98: 2.302,
    lpg: 1.626,
    cng: 2.154,
    lng: 2.750,
    h2: 0,
    mocznik: 0, myjnia: 0, inne: 0,
  };

  let _parsedRows = [];
  let _colMap = {};
  let _headers = [];
  let _rawRows = [];
  let _savedSchemas = {};

  // ── Normalize ─────────────────────────────────────────────────────────────
  function _n(str) {
    return String(str||'').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g,'')
      .replace(/[^a-z0-9]/g,' ').trim();
  }

  function _autoMap() {
    _colMap = {};
    _headers.forEach((h, idx) => {
      const hn = _n(h);
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        if (_colMap[field] !== undefined) continue;
        if (aliases.some(a => _n(a) === hn || hn.includes(_n(a)))) {
          _colMap[field] = idx;
        }
      }
    });
  }

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  function _parse(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return false;
    const sep = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';
    function splitRow(line) {
      const cols = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; continue; }
        if (c === sep && !inQ) { cols.push(cur.trim()); cur = ''; }
        else cur += c;
      }
      cols.push(cur.trim());
      return cols;
    }
    _headers = splitRow(lines[0]);
    _rawRows = lines.slice(1).filter(l => l.trim()).map(splitRow);
    return true;
  }

  // ── Map row → tankowanie object ───────────────────────────────────────────
  function _rowToFuel(row) {
    const get = field => {
      const idx = _colMap[field];
      return (idx !== undefined && idx < row.length) ? row[idx] : '';
    };
    const getNum = field => {
      const val = get(field).replace(',', '.');
      const n = parseFloat(val);
      return isNaN(n) ? null : n;
    };

    // Normalizuj datę
    let date = get('date');
    const dateMatch = date.match(/(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
    const dateMatchPL = date.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})/);
    if (dateMatchPL) date = `${dateMatchPL[3]}-${dateMatchPL[2]}-${dateMatchPL[1]}`;
    else if (dateMatch) date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

    // Normalizuj produkt
    let product = _n(get('product'));
    product = PRODUCT_MAP[product] || PRODUCT_MAP[Object.keys(PRODUCT_MAP).find(k => product.includes(k))||''] || 'inne';

    const liters = getNum('liters');
    const co2kg = liters != null ? +(liters * (KOBIZE_FACTORS[product] || 0)).toFixed(3) : null;

    return {
      id: Date.now() + Math.random(),
      date,
      time: get('time').substring(0,5),
      nrRej: (get('nrRej') || '').toUpperCase().replace(/\s/g,''),
      cardNo: get('cardNo'),
      liters,
      pricePerL: getNum('pricePerL'),
      totalGross: getNum('totalGross'),
      totalNet: getNum('totalNet'),
      station: get('station'),
      location: get('location'),
      product,
      km: getNum('km'),
      co2kg,
      source: 'csv',
      notes: get('notes'),
    };
  }

  // ── Schemas ───────────────────────────────────────────────────────────────
  function _loadSchemas() {
    try { _savedSchemas = JSON.parse(localStorage.getItem('fuelImportSchemas')) || {}; }
    catch { _savedSchemas = {}; }
  }

  function _saveSchema(name) {
    _loadSchemas();
    _savedSchemas[name] = { colMap: {..._colMap}, headers: [..._headers] };
    localStorage.setItem('fuelImportSchemas', JSON.stringify(_savedSchemas));
    toast(t('fi.toast.schema.saved').replace('{0}', name));
  }

  function _applySchema(name) {
    _loadSchemas();
    const s = _savedSchemas[name];
    if (!s) return;
    _colMap = {...s.colMap};
    _renderPreview();
    _renderMappingUI();
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  function open() {
    _loadSchemas();
    document.getElementById('fuel-import-modal').style.display = 'flex';
    _reset();
  }

  function close() {
    document.getElementById('fuel-import-modal').style.display = 'none';
    _reset();
  }

  function _reset() {
    _parsedRows = []; _colMap = {}; _headers = []; _rawRows = [];
    const fi = document.getElementById('fuel-csv-file');
    if (fi) fi.value = '';
    document.getElementById('fuel-import-step2').style.display = 'none';
    document.getElementById('fuel-import-step3').style.display = 'none';
    document.getElementById('fuel-import-result').style.display = 'none';
    document.getElementById('fuel-import-step1').style.display = 'block';
  }

  function handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      let text = e.target.result;
      // Wykryj Windows-1250 / Latin2
      if (/Ä…|Ä™|Å›/.test(text)) {
        const dec = new TextDecoder('windows-1250');
        text = dec.decode(new Uint8Array([...text].map(c=>c.charCodeAt(0))));
      }
      if (!_parse(text)) { toast(t('fi.toast.csv.err')); return; }
      _autoMap();
      document.getElementById('fuel-import-step1').style.display = 'none';
      document.getElementById('fuel-import-step2').style.display = 'block';
      _renderMappingUI();
      _renderPreview();
    };
    reader.readAsText(file, 'windows-1250');
  }

  function _renderMappingUI() {
    const LABELS = {
      date:'Data *', time:'Godzina', nrRej:'Nr rejestracyjny *', cardNo:'Nr karty paliwowej',
      liters:'Ilość (litry) *', pricePerL:'Cena/litr', totalGross:'Kwota brutto *',
      totalNet:'Kwota netto', station:'Stacja', location:'Miejscowość',
      product:'Produkt / paliwo', km:'Stan licznika (km)', notes:'Uwagi',
    };
    const el = document.getElementById('fuel-col-mapping');
    if (!el) return;

    const schemaOpts = Object.keys(_savedSchemas).map(n =>
      `<option value="${n}">${n}</option>`).join('');

    el.innerHTML = `
      ${schemaOpts ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px;background:var(--bg3);border-radius:var(--radius)">
          <span style="font-size:12px;font-weight:500">Użyj zapisanego schematu:</span>
          <select id="fuel-schema-sel" class="fi" style="flex:1;margin:0">
            <option value="">— wybierz —</option>${schemaOpts}
          </select>
          <button class="btn btn-blue" style="font-size:11px;padding:4px 10px"
            onclick="FuelImport.applySchema(document.getElementById('fuel-schema-sel').value)">
            Zastosuj
          </button>
        </div>` : ''}
      <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">
        Mapowanie kolumn CSV → pola systemu
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${Object.entries(LABELS).map(([field, label]) => `
          <div class="vdf">
            <label class="vdl">${label}</label>
            <select id="fuel-map-${field}" class="fi" onchange="FuelImport.updateMap('${field}',this.value)">
              <option value="-1">— pomijaj —</option>
              ${_headers.map((h,i) => `<option value="${i}" ${_colMap[field]===i?'selected':''}>${h}</option>`).join('')}
            </select>
          </div>`).join('')}
      </div>`;
  }

  function updateMap(field, val) {
    const idx = parseInt(val);
    if (idx < 0) delete _colMap[field];
    else _colMap[field] = idx;
    _renderPreview();
  }

  function applySchema(name) { if (name) _applySchema(name); }

  function _renderPreview() {
    _parsedRows = _rawRows.map(_rowToFuel).filter(r => r.date || r.nrRej || r.liters);
    const el = document.getElementById('fuel-preview');
    if (!el) return;

    const matched = _parsedRows.filter(r => r.nrRej && vehs.find(v => v.nrRej === r.nrRej));
    const unmatched = _parsedRows.filter(r => r.nrRej && !vehs.find(v => v.nrRej === r.nrRej));

    document.getElementById('fuel-import-step3').style.display = 'block';
    document.getElementById('fuel-preview-stats').innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <div class="stat-chip"><span>${_rawRows.length}</span> wierszy CSV</div>
        <div class="stat-chip stat-chip-green"><span>${matched.length}</span> dopasowanych pojazdów</div>
        ${unmatched.length ? `<div class="stat-chip stat-chip-amber"><span>${unmatched.length}</span> bez dopasowania</div>` : ''}
        <div class="stat-chip"><span>${(_parsedRows.reduce((s,r)=>s+(r.liters||0),0)).toFixed(1)} l</span> łącznie</div>
        <div class="stat-chip"><span>${fmt2(_parsedRows.reduce((s,r)=>s+(r.totalGross||0),0))} zł</span> łącznie</div>
      </div>`;

    const COLS = ['Data','Czas','Nr rej.','Produkt','Litry','Cena/l','Kwota','Stacja','Karta'];
    el.innerHTML = `
      <div style="overflow-x:auto;max-height:260px;overflow-y:auto">
        <table style="font-size:11px;min-width:700px">
          <thead><tr>${COLS.map(c=>`<th style="padding:4px 8px;white-space:nowrap;background:var(--bg3);position:sticky;top:0">${c}</th>`).join('')}</tr></thead>
          <tbody>
            ${_parsedRows.slice(0,50).map(r => {
              const veh = vehs.find(v => v.nrRej === r.nrRej);
              const bg = veh ? '' : 'background:rgba(255,200,0,.1)';
              return `<tr style="${bg}">
                <td style="padding:3px 8px;font-family:var(--mono);font-size:10px">${r.date||'—'}</td>
                <td style="padding:3px 8px;color:var(--text2)">${r.time||'—'}</td>
                <td style="padding:3px 8px;font-weight:600;font-family:var(--mono)">${r.nrRej||'<span style="color:var(--amber)">?</span>'}</td>
                <td style="padding:3px 8px">${r.product||'—'}</td>
                <td style="padding:3px 8px;text-align:right">${r.liters!=null?r.liters.toFixed(1):'-'}</td>
                <td style="padding:3px 8px;text-align:right">${r.pricePerL!=null?r.pricePerL.toFixed(3):'-'}</td>
                <td style="padding:3px 8px;text-align:right;font-weight:500">${r.totalGross!=null?r.totalGross.toFixed(2):'-'}</td>
                <td style="padding:3px 8px;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.station||'—'}</td>
                <td style="padding:3px 8px;font-family:var(--mono);font-size:10px">${r.cardNo||'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${_parsedRows.length > 50 ? `<div style="text-align:center;padding:6px;font-size:11px;color:var(--text3)">…i ${_parsedRows.length-50} więcej wierszy</div>` : ''}
      </div>`;
  }

  async function doImport() {
    if (!_parsedRows.length) { toast(t('fi.toast.no.data')); return; }

    let imported = 0, skipped = 0;
    _parsedRows.forEach(row => {
      if (!row.nrRej) { skipped++; return; }
      const veh = vehs.find(v => v.nrRej === row.nrRej);
      if (!veh) { skipped++; return; }
      if (!Array.isArray(veh.fuelHistory)) veh.fuelHistory = [];
      // Deduplikacja: ta sama data + litry (±0.01) + karta paliwowa lub stacja
      const dup = veh.fuelHistory.find(h =>
        h.date === row.date &&
        Math.abs((h.liters||0) - (row.liters||0)) < 0.01 &&
        (!row.cardNo || !h.cardNo || h.cardNo === row.cardNo)
      );
      if (dup) { skipped++; return; }
      veh.fuelHistory.push(row);
      imported++;
    });

    // Sortuj historię każdego pojazdu desc
    vehs.forEach(v => {
      if (v.fuelHistory?.length) {
        v.fuelHistory.sort((a,b) => new Date(b.date) - new Date(a.date));
      }
    });

    // Zapis schemat?
    const schName = document.getElementById('fuel-save-schema-name')?.value?.trim();
    const schCheck = document.getElementById('fuel-save-schema')?.checked;
    if (schCheck && schName) _saveSchema(schName);

    // Zapis do chmury
    const toSave = vehs.filter(v => v.fuelHistory?.length);
    if (window.TaxOrderFleetCloud?.saveVehicles && toSave.length) {
      try {
        for (let i = 0; i < toSave.length; i += 20) {
          await window.TaxOrderFleetCloud.saveVehicles(toSave.slice(i, i + 20));
        }
      } catch(e) { console.warn('[FuelImport] Cloud save error', e); }
    }

    document.getElementById('fuel-import-result').style.display = 'block';
    document.getElementById('fuel-import-result').innerHTML = `
      <div style="padding:16px;background:var(--green-light);border-radius:var(--radius);border:1px solid var(--green);text-align:center">
        <div style="font-size:18px;font-weight:700;color:var(--green);margin-bottom:6px">✓ Import zakończony</div>
        <div style="font-size:13px">Dodano <strong>${imported}</strong> tankowań | Pominięto: ${skipped}</div>
      </div>`;

    toast(t('fi.toast.imported').replace('{0}', imported));
    if (typeof renderDash === 'function') renderDash();
  }

  // ── Ręczne tankowanie (z vehicle detail) ─────────────────────────────────
  function addManual(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:500px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-gas-station" style="color:var(--amber)"></i>Nowe tankowanie — ${v.nrRej}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Data *</label>
            <input id="_fuel-date" type="date" class="fi" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="vdf">
            <label class="vdl">Godzina</label>
            <input id="_fuel-time" type="time" class="fi" value="${new Date().toTimeString().slice(0,5)}">
          </div>
          <div class="vdf">
            <label class="vdl">Paliwo</label>
            <select id="_fuel-product" class="fi">
              <option value="diesel">ON Diesel</option>
              <option value="pb95">PB95</option>
              <option value="pb98">PB98</option>
              <option value="lpg">LPG</option>
              <option value="cng">CNG</option>
              <option value="lng">LNG</option>
              <option value="mocznik">AdBlue / Mocznik</option>
              <option value="myjnia">Myjnia</option>
              <option value="inne">Inne</option>
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Ilość (litry) *</label>
            <input id="_fuel-liters" type="number" step="0.01" min="0" class="fi" placeholder="0.00">
          </div>
          <div class="vdf">
            <label class="vdl">Cena/litr (zł) *</label>
            <input id="_fuel-price" type="number" step="0.001" min="0" class="fi" placeholder="0.000"
              oninput="const l=parseFloat(document.getElementById('_fuel-liters').value)||0;const p=parseFloat(this.value)||0;document.getElementById('_fuel-total').value=(l*p).toFixed(2)">
          </div>
          <div class="vdf">
            <label class="vdl">Kwota brutto (zł)</label>
            <input id="_fuel-total" type="number" step="0.01" min="0" class="fi" placeholder="0.00">
          </div>
          <div class="vdf">
            <label class="vdl">Stacja / dostawca</label>
            <input id="_fuel-station" type="text" class="fi" placeholder="np. ORLEN, BP, Shell...">
          </div>
          <div class="vdf">
            <label class="vdl">Nr karty paliwowej</label>
            <input id="_fuel-card" type="text" class="fi" value="${v.kartaOrlen||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Stan licznika (km)</label>
            <input id="_fuel-km" type="number" class="fi" placeholder="opcjonalnie">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Uwagi</label>
            <input id="_fuel-notes" type="text" class="fi" placeholder="opcjonalnie">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-green" onclick="FuelImport.saveManual(${vehId},this)">
            <i class="ti ti-check"></i>Zapisz tankowanie
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('_fuel-liters')?.focus();
  }

  async function saveManual(vehId, btn) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const gf = id => { const val = g(id); return val ? parseFloat(val.replace(',','.')) : null; };

    const date = g('_fuel-date');
    const liters = gf('_fuel-liters');
    if (!date || !liters) { toast(t('fi.toast.fields.req')); return; }

    const product = g('_fuel-product');
    const co2kg = liters != null ? +(liters * (KOBIZE_FACTORS[product] || 0)).toFixed(3) : null;

    if (!Array.isArray(v.fuelHistory)) v.fuelHistory = [];
    v.fuelHistory.unshift({
      id: Date.now() + Math.random(),
      date,
      time: g('_fuel-time'),
      nrRej: v.nrRej,
      product,
      liters,
      pricePerL: gf('_fuel-price'),
      totalGross: gf('_fuel-total'),
      station: g('_fuel-station'),
      cardNo: g('_fuel-card'),
      km: gf('_fuel-km'),
      co2kg,
      notes: g('_fuel-notes'),
      source: 'manual',
    });

    btn.closest('[style*=fixed]').remove();
    if (window.TaxOrderFleetCloud?.saveVehicle) await window.TaxOrderFleetCloud.saveVehicle(v);
    toast(t('fi.toast.fuel.saved'));
    if (typeof renderDash === 'function') renderDash();
    // Odśwież zakładkę kosztów jeśli otwarta
    if (document.getElementById('vd-tab-koszty-content')?.style.display !== 'none') {
      window.TaxOrderVehicleDetail?._refreshKoszty?.(vehId);
    }
  }

  async function removeFuel(vehId, fuelId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v || !v.fuelHistory) return;
    v.fuelHistory = v.fuelHistory.filter(h => h.id !== fuelId);
    if (window.TaxOrderFleetCloud?.saveVehicle) await window.TaxOrderFleetCloud.saveVehicle(v);
    toast(t('fi.toast.fuel.deleted'));
    window.TaxOrderVehicleDetail?._refreshKoszty?.(vehId);
  }

  // ── Template downloadu ────────────────────────────────────────────────────
  function downloadTemplate() {
    const rows = [
      ['Data transakcji','Godzina','Nr rejestracyjny','Produkt','Ilosc','Cena/l','Kwota brutto','Stacja','Nr karty','Przebieg'],
    ];
    const first5 = (window.vehs||[]).slice(0,5).map(v => [
      new Date().toISOString().slice(0,10), '12:00', v.nrRej,
      'ON', '50.0', '6.89', '344.50', 'ORLEN', v.kartaOrlen||'', v.stanKilometrow||''
    ]);
    if (!first5.length) rows.push(['2024-01-15','12:00','WA12345','ON','50.0','6.89','344.50','ORLEN','','145000']);
    else rows.push(...first5);
    const csv = rows.map(r => r.join(';')).join('\r\n');
    const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='szablon_tankowania.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── KOBIZE — Raport emisji CO2 ────────────────────────────────────────────
  function exportKobize(year) {
    year = year || new Date().getFullYear() - 1;
    const rows = [];
    rows.push(['Nr rejestracyjny','Marka','Model','Rok prod.','Miesiąc','Paliwo','Ilość (l)','CO2 (kg)','Koszt brutto (zł)']);

    const allFuel = [];
    (window.vehs || []).forEach(v => {
      (v.fuelHistory || []).forEach(f => {
        const fy = f.date ? parseInt(f.date.slice(0,4)) : 0;
        if (fy !== year) return;
        const fuelType = f.product || 'inne';
        const co2 = f.co2kg != null ? f.co2kg : (f.liters ? +(f.liters * (KOBIZE_FACTORS[fuelType] || 0)).toFixed(3) : 0);
        allFuel.push({
          nrRej: v.nrRej, marka: v.marka, model: v.model, rok: v.rok,
          month: f.date ? f.date.slice(0,7) : '', fuelType,
          liters: f.liters || 0, co2, gross: f.totalGross || 0,
        });
      });
    });

    // Grupuj po nrRej + miesiąc + paliwo
    const grouped = {};
    allFuel.forEach(f => {
      const key = `${f.nrRej}||${f.month}||${f.fuelType}`;
      if (!grouped[key]) grouped[key] = {...f, liters:0, co2:0, gross:0};
      grouped[key].liters += f.liters;
      grouped[key].co2 += f.co2;
      grouped[key].gross += f.gross;
    });

    Object.values(grouped).sort((a,b) => `${a.nrRej}${a.month}`.localeCompare(`${b.nrRej}${b.month}`)).forEach(g => {
      rows.push([
        g.nrRej, g.marka, g.model, g.rok,
        g.month, g.fuelType,
        g.liters.toFixed(2), g.co2.toFixed(3), g.gross.toFixed(2),
      ]);
    });

    // Suma końcowa
    const totalLiters = Object.values(grouped).reduce((s,g)=>s+g.liters,0);
    const totalCO2 = Object.values(grouped).reduce((s,g)=>s+g.co2,0);
    const totalGross = Object.values(grouped).reduce((s,g)=>s+g.gross,0);
    rows.push([]);
    rows.push(['ŁĄCZNIE', '', '', '', '', '', totalLiters.toFixed(2), totalCO2.toFixed(3), totalGross.toFixed(2)]);

    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download=`raport_emisji_CO2_KOBIZE_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast(t('fi.toast.kobize.ok').replace('{0}', year).replace('{1}', totalCO2.toFixed(0)).replace('{2}', (totalCO2/1000).toFixed(2)));
  }

  // ── Podsumowanie CO2 dla całej floty za dany miesiąc ─────────────────────
  function getFleetCO2(monthStr) {
    let total = 0;
    (window.vehs || []).forEach(v => {
      (v.fuelHistory || []).forEach(f => {
        if (!monthStr || (f.date && f.date.startsWith(monthStr))) {
          const co2 = f.co2kg != null ? f.co2kg
            : (f.liters ? f.liters * (KOBIZE_FACTORS[f.product] || 0) : 0);
          total += co2;
        }
      });
    });
    return total;
  }

  return {
    open, close, handleFile, updateMap, applySchema,
    doImport, addManual, saveManual, removeFuel, downloadTemplate,
    exportKobize, getFleetCO2, KOBIZE_FACTORS,
  };

})();
