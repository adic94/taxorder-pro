(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v, d=0) => v != null && !isNaN(v) ? parseFloat(v).toLocaleString('pl-PL', {minimumFractionDigits:d,maximumFractionDigits:d}) : '—';

  const PROVIDER_LBL = {
    orlen:'Orlen / Orlen Flota', shell:'Shell', bp:'BP',
    circle_k:'Circle K', lotos:'Lotos', dkv:'DKV', other:'Inny',
  };

  const FIELDS = [
    { key:'date',    label:'Data tankowania',     required:true  },
    { key:'nrrej',   label:'Nr rejestracyjny',    required:true  },
    { key:'liters',  label:'Litry / ilość',        required:false },
    { key:'cost',    label:'Kwota PLN (brutto)',  required:false },
    { key:'station', label:'Stacja / miejsce',    required:false },
  ];

  // ── state ──
  let _step     = 1;
  let _provider = 'orlen';
  let _rawCsv   = '';
  let _separator = ';';
  let _headers   = [];
  let _colMap    = { date:-1, nrrej:-1, liters:-1, cost:-1, station:-1 };
  let _preview   = null;
  let _imports   = [];
  let _loading   = false;

  // ── encoding + separator helpers ──

  async function _readFile(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { return new TextDecoder('windows-1250').decode(buf); }
  }

  function _detectSep(line) {
    const sc = { ';': 0, ',': 0, '\t': 0 };
    for (const c of line) if (c in sc) sc[c]++;
    return Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0] || ';';
  }

  function _autoMap(headers) {
    const kw = {
      date:    ['data','date','dzień','dzien','dt','tanko','czas'],
      nrrej:   ['nr_rej','rejestr','tablica','pojazd','plate','vehicle','numer rej','nr rej'],
      liters:  ['liter','ilosc','ilość','qty','quantity','volume','litry'],
      cost:    ['kwota','koszt','cost','amount','wartosc','wartość','brutto','pln','cena','suma'],
      station: ['stacja','station','miejsce','loc','punkt','sklep','adres'],
    };
    const res = {};
    for (const [field, words] of Object.entries(kw)) {
      res[field] = headers.findIndex(h => words.some(w => h.toLowerCase().includes(w)));
    }
    return res;
  }

  // ── main render ──

  async function renderFuelCardImport() {
    try {
      const r = await fetch(`${API()}/api/fuel-card-import?company=${encodeURIComponent(Co())}`, { headers: H() });
      if (r.ok) _imports = await r.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-fuel-card-import');
    if (!el) return;
    el.innerHTML = _headerHtml() + _stepBarHtml() + _stepContentHtml() + _historyHtml();
    _bindEvents();
  }

  function _headerHtml() {
    return `<div class="page-header"><h2><i class="ti ti-credit-card"></i> Import kart paliwowych</h2></div>`;
  }

  function _stepBarHtml() {
    const labels = ['1. Prześlij plik', '2. Mapuj kolumny', '3. Podgląd i import'];
    return `<div style="display:flex;margin-bottom:20px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      ${labels.map((lbl, i) => {
        const active = _step === i + 1;
        const done   = _step > i + 1;
        return `<div style="flex:1;padding:10px 12px;text-align:center;font-size:12px;font-weight:${active ? 700 : 400};
          background:${active ? 'var(--blue)' : done ? 'var(--green-light,#f0fdf4)' : 'var(--bg-card)'};
          color:${active ? '#fff' : done ? 'var(--green,#16a34a)' : 'var(--text2)'};
          border-right:${i < 2 ? '1px solid var(--border)' : 'none'}">
          ${done ? '<i class="ti ti-check"></i> ' : ''}${lbl}
        </div>`;
      }).join('')}
    </div>`;
  }

  function _stepContentHtml() {
    if (_step === 1) return _step1Html();
    if (_step === 2) return _step2Html();
    return _step3Html();
  }

  function _step1Html() {
    return `<div style="max-width:540px">
  <div class="f" style="margin-bottom:12px">
    <label>Dostawca karty</label>
    <select id="fci-provider" class="form-input">
      ${Object.entries(PROVIDER_LBL).map(([k,v]) => `<option value="${k}" ${k===_provider?'selected':''}>${v}</option>`).join('')}
    </select>
  </div>
  <div class="f" style="margin-bottom:12px">
    <label>Plik CSV <small style="color:var(--text3)">(UTF-8 lub Windows-1250 — wykrywamy automatycznie)</small></label>
    <input type="file" id="fci-file" accept=".csv,.txt" class="form-input">
  </div>
  <div style="text-align:center;color:var(--text3);font-size:12px;margin:8px 0">— lub wklej poniżej —</div>
  <div class="f" style="margin-bottom:16px">
    <label>Zawartość CSV</label>
    <textarea id="fci-csv" class="form-input" rows="6" placeholder="data;nr_rej;litry;kwota;stacja&#10;01.06.2025;WA1234X;50,00;300,00;Orlen Warszawa"></textarea>
  </div>
  <button class="btn-primary" id="fci-next1" ${_loading ? 'disabled' : ''}>
    <i class="ti ti-arrow-right"></i> ${_loading ? 'Wczytywanie...' : 'Dalej — mapuj kolumny'}
  </button>
</div>`;
  }

  function _step2Html() {
    const lines  = _rawCsv.trim().split(/\r?\n/);
    const sample = lines.slice(1, 4).map(l => l.split(_separator).map(c => c.trim()));
    const sepLabel = { ';': 'średnik (;)', ',': 'przecinek (,)', '\t': 'tabulator (TAB)' };

    return `<div style="display:grid;grid-template-columns:280px 1fr;gap:24px;align-items:start;flex-wrap:wrap">
<div>
  <h3 style="font-size:13px;font-weight:600;margin-bottom:12px">Mapowanie kolumn</h3>
  <div class="f" style="margin-bottom:14px">
    <label style="font-size:12px">Separator w pliku</label>
    <select id="fci-sep" class="form-input" style="width:auto">
      ${Object.entries(sepLabel).map(([k,v]) => `<option value="${k}" ${k===_separator?'selected':''}>${v}</option>`).join('')}
    </select>
  </div>
  ${FIELDS.map(f => `
  <div class="f" style="margin-bottom:10px">
    <label style="font-size:12px">${f.label}${f.required ? ' <span style="color:var(--red)">*</span>' : ''}</label>
    <select id="fmap-${f.key}" class="form-input" style="font-size:12px">
      <option value="-1">${f.required ? '-- wybierz kolumnę --' : '-- pomiń --'}</option>
      ${_headers.map((h, i) => `<option value="${i}" ${_colMap[f.key]===i ? 'selected' : ''}>${e(h)} (kol. ${i+1})</option>`).join('')}
    </select>
  </div>`).join('')}
  <div style="display:flex;gap:8px;margin-top:16px">
    <button class="btn-secondary" id="fci-back2"><i class="ti ti-arrow-left"></i> Wstecz</button>
    <button class="btn-primary" id="fci-next2" ${_loading ? 'disabled' : ''}>
      ${_loading ? '⏳ Parsowanie...' : '<i class="ti ti-eye"></i> Dalej — podgląd'}
    </button>
  </div>
</div>
<div>
  <h3 style="font-size:13px;font-weight:600;margin-bottom:12px">Podgląd pliku (${_headers.length} kolumn wykrytych)</h3>
  <div style="overflow-x:auto;font-size:11px">
    <table class="data-table">
      <thead><tr>${_headers.map((h, i) => `<th>kol.${i+1}: ${e(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${sample.length
          ? sample.map(row => `<tr>${_headers.map((_, i) => `<td>${e(row[i] || '')}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${_headers.length || 1}" class="empty">Brak danych</td></tr>`}
      </tbody>
    </table>
  </div>
</div>
</div>`;
  }

  function _step3Html() {
    if (!_preview) return '<p>Brak danych podglądu</p>';
    const { records, count, unknown_nrrej } = _preview;
    const unknownSet = new Set(unknown_nrrej || []);

    return `<div>
${unknownSet.size ? `
<div style="background:var(--orange-light,#fff7ed);border:1px solid var(--orange,#f59e0b);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px">
  <i class="ti ti-alert-triangle"></i> <strong>${unknownSet.size} nr rej. nieznanych w bazie fleet:</strong><br>
  <div style="margin-top:4px">${[...unknownSet].map(nr => `<span style="background:var(--orange,#f59e0b);color:#fff;border-radius:4px;padding:1px 7px;margin:2px;display:inline-block">${e(nr)}</span>`).join('')}</div>
  <span style="color:var(--text2)">Rekordy zostaną zaimportowane — możesz najpierw dodać te pojazdy do floty.</span>
</div>` : `
<div style="background:var(--green-light,#f0fdf4);border:1px solid var(--green,#22c55e);border-radius:8px;padding:8px 14px;margin-bottom:14px;font-size:12px;color:var(--green,#16a34a)">
  <i class="ti ti-circle-check"></i> Wszystkie pojazdy (${[...new Set(records.map(r => r.nr_rej))].length}) rozpoznane w systemie.
</div>`}
<h3 style="font-size:13px;font-weight:600;margin-bottom:10px">
  Parsowane rekordy — ${count} łącznie${count > 100 ? ' (pokazuje pierwsze 100)' : ''}
</h3>
<div class="table-wrap" style="max-height:400px;overflow-y:auto">
<table class="data-table" style="font-size:12px">
<thead><tr><th>#</th><th>Data</th><th>Nr rej.</th><th>Litry</th><th>Kwota PLN</th><th>Stacja</th></tr></thead>
<tbody>
${records.slice(0, 100).map((r, i) => `<tr ${unknownSet.has(r.nr_rej) ? 'style="background:var(--orange-light,#fff7ed)"' : ''}>
  <td>${i+1}</td>
  <td>${e(r.fill_date || '')}</td>
  <td><strong ${unknownSet.has(r.nr_rej) ? 'style="color:var(--orange,#d97706)"' : ''}>${e(r.nr_rej || '')}</strong></td>
  <td>${fmtN(r.liters, 2)}</td>
  <td>${fmtN(r.cost_pln, 2)}</td>
  <td>${e(r.station || '—')}</td>
</tr>`).join('')}
${count > 100 ? `<tr><td colspan="6" class="empty">... i ${count - 100} więcej rekordów</td></tr>` : ''}
</tbody>
</table>
</div>
<div style="display:flex;gap:8px;margin-top:14px">
  <button class="btn-secondary" id="fci-back3"><i class="ti ti-arrow-left"></i> Wstecz</button>
  <button class="btn-primary" id="fci-confirm" ${_loading ? 'disabled' : ''}>
    ${_loading ? '⏳ Importowanie...' : `<i class="ti ti-database-import"></i> Importuj ${count} rekordów`}
  </button>
</div>
</div>`;
  }

  function _historyHtml() {
    if (!_imports.length) return `
<div style="margin-top:32px">
  <h3 style="font-size:14px;font-weight:600;margin-bottom:8px">Historia importów</h3>
  <p style="color:var(--text3);font-size:13px">Brak poprzednich importów.</p>
</div>`;
    return `
<div style="margin-top:32px">
<h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Historia importów</h3>
<div class="table-wrap"><table class="data-table" style="font-size:12px">
<thead><tr><th>Data</th><th>Dostawca</th><th>Plik</th><th>Rekordów</th><th>Status</th></tr></thead>
<tbody>
${_imports.map(imp => `<tr>
  <td>${e(imp.imported_at?.slice(0,16)||'')}</td>
  <td>${e(PROVIDER_LBL[imp.card_provider] || imp.card_provider || '—')}</td>
  <td style="font-size:11px;color:var(--text3)">${e(imp.filename||'—')}</td>
  <td>${imp.records_count || 0}</td>
  <td><span class="pill ${imp.status==='processed'?'ok':imp.status==='error'?'danger':'warn'}">${e(imp.status||'')}</span></td>
</tr>`).join('')}
</tbody></table></div>
</div>`;
  }

  // ── event binding ──

  function _bindEvents() {
    document.getElementById('fci-next1')?.addEventListener('click', _goStep2);
    document.getElementById('fci-sep')?.addEventListener('change', ev => {
      _separator = ev.target.value;
      _reparseHeaders();
    });
    document.getElementById('fci-back2')?.addEventListener('click', () => { _step = 1; _render(); });
    document.getElementById('fci-next2')?.addEventListener('click', _goStep3);
    document.getElementById('fci-back3')?.addEventListener('click', () => { _step = 2; _render(); });
    document.getElementById('fci-confirm')?.addEventListener('click', _doConfirm);
  }

  // ── step actions ──

  async function _goStep2() {
    _provider = document.getElementById('fci-provider')?.value || 'orlen';
    const fileEl = document.getElementById('fci-file');
    const pasted = document.getElementById('fci-csv')?.value?.trim();

    if (fileEl?.files?.length) {
      _loading = true; _render();
      try { _rawCsv = await _readFile(fileEl.files[0]); }
      catch { alert('Nie można odczytać pliku'); _loading = false; _render(); return; }
      _loading = false;
    } else if (pasted) {
      _rawCsv = pasted;
    } else {
      alert('Wgraj plik lub wklej CSV'); return;
    }

    if (!_rawCsv.trim()) { alert('Plik jest pusty'); return; }

    const firstLine = _rawCsv.split(/\r?\n/)[0] || '';
    _separator = _detectSep(firstLine);
    _headers   = firstLine.split(_separator).map(h => h.trim());
    if (_headers.length < 2) { alert('Nie wykryto kolumn — sprawdź format pliku (wymagany nagłówek CSV)'); return; }
    _colMap = _autoMap(_headers);
    _step = 2;
    _render();
  }

  function _reparseHeaders() {
    const firstLine = _rawCsv.split(/\r?\n/)[0] || '';
    _headers = firstLine.split(_separator).map(h => h.trim());
    _colMap  = _autoMap(_headers);
    _render();
  }

  async function _goStep3() {
    for (const f of FIELDS) {
      const sel = document.getElementById(`fmap-${f.key}`);
      _colMap[f.key] = sel ? parseInt(sel.value) : -1;
    }
    if (_colMap.date  < 0) { alert('Wybierz kolumnę dla "Data tankowania"'); return; }
    if (_colMap.nrrej < 0) { alert('Wybierz kolumnę dla "Nr rejestracyjny"'); return; }

    _loading = true; _render();
    try {
      const r = await fetch(`${API()}/api/fuel-card-import/parse?company=${encodeURIComponent(Co())}`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: _rawCsv, provider: _provider, separator: _separator, col_map: _colMap }),
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(txt);
      _preview = JSON.parse(txt);
      if (!_preview.count) {
        alert('Nie znaleziono rekordów — sprawdź mapowanie kolumn i separator');
        _loading = false; _render(); return;
      }
      _step = 3;
    } catch (ex) { alert(`Błąd parsowania: ${  ex.message}`); }
    _loading = false; _render();
  }

  async function _doConfirm() {
    if (!_preview?.records?.length) return;
    const filename = document.getElementById('fci-file')?.files?.[0]?.name || 'import.csv';
    _loading = true; _render();
    try {
      const r = await fetch(`${API()}/api/fuel-card-import/confirm?company=${encodeURIComponent(Co())}`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: _provider, filename, records: _preview.records }),
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(txt);
      const res = JSON.parse(txt);
      alert(`Import zakończony!\n✅ Zaimportowano: ${res.imported}\n⏭ Pominięte (duplikaty): ${res.skipped}`);
      _step = 1; _rawCsv = ''; _preview = null;
      _colMap = { date:-1, nrrej:-1, liters:-1, cost:-1, station:-1 };
      await renderFuelCardImport();
    } catch (ex) { alert(`Błąd importu: ${  ex.message}`); _loading = false; _render(); }
  }

  window.FuelCardImportModule = { renderFuelCardImport };
})();
