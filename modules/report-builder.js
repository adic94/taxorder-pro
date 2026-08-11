(function () {
  'use strict';
  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  const SOURCES = {
    vehicles: { lbl:'Pojazdy', cols:['reg','brand','model','year','fuel_type','dmc','status','driver','department'] },
    // fuel_fills, NIE fuel_entries — ta druga nie istnieje w bazie, przez co źródło „Paliwo"
    // zwracało zawsze pusty raport. Nazwy kolumn muszą się zgadzać z ALLOWED_COLS w workerze.
    fuel_fills: { lbl:'Paliwo', cols:['fill_date','nr_rej','liters','total_cost','price_per_liter','odometer','driver_name','fuel_type','station'] },
    service_orders: { lbl:'Serwis', cols:['nr_rej','typ','opis','status','warsztat','koszt_szacowany','koszt_rzeczywisty','data_realizacji'] },
    damage_reports: { lbl:'Szkody', cols:['nr_rej','data_zdarzenia','opis','przyczyna','status','koszt','zglaszajacy'] },
    fines: { lbl:'Mandaty', cols:['nr_rej','driver_name','date','type','amount','description','fine_no','paid'] },
    tco_cost_entries: { lbl:'TCO (koszty)', cols:['entry_date','vehicle_reg','category','amount_pln','description'] },
    ksef_invoices: { lbl:'Faktury KSeF', cols:['invoice_number','ksef_number','ksef_status','seller_nip','buyer_nip','gross_pln','ksef_date'] },
    carpooling_trips: { lbl:'Carpooling', cols:['trip_date','driver_name','vehicle_reg','origin','destination','status','cost_pln'] },
  };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/report-builder${path}${path.includes('?')?'&':'?'}company=${co()}`, { headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('cf_token')}`}, ...opts });
    return r.json();
  }

  let _currentConfig = null;

  function renderReportBuilder() {
    const el = document.getElementById('page-report-builder');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-table-options"></i> Kreator Raportów</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" onclick="window.ReportBuilder._openSaved()"><i class="ti ti-folder"></i> Zapisane raporty</button>
          <button class="btn btn-primary" onclick="window.ReportBuilder._runReport()"><i class="ti ti-play"></i> Uruchom raport</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:300px 1fr;gap:16px">
        <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:16px">
          <h4 style="margin:0 0 12px">Konfiguracja raportu</h4>
          <div class="form-row"><label>Źródło danych</label>
            <select id="rb-source" class="form-control" onchange="window.ReportBuilder._updateCols()">
              ${Object.entries(SOURCES).map(([v,s])=>`<option value="${v}">${esc(s.lbl)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Kolumny</label>
            <div id="rb-cols" style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:6px"></div>
          </div>
          <div class="form-row"><label>Filtr — kolumna</label>
            <select id="rb-filter-col" class="form-control"><option value="">— brak filtru —</option></select>
          </div>
          <div class="form-row"><label>Filtr — wartość</label>
            <input id="rb-filter-val" class="form-control" placeholder="np. WA12345">
          </div>
          <div class="form-row"><label>Sortuj wg</label>
            <select id="rb-sort" class="form-control"><option value="">— domyślnie —</option></select>
          </div>
          <div class="form-row"><label>Kierunek sortowania</label>
            <select id="rb-sort-dir" class="form-control">
              <option value="DESC">Malejąco (DESC)</option>
              <option value="ASC">Rosnąco (ASC)</option>
            </select>
          </div>
          <div class="form-row"><label>Limit wyników</label>
            <select id="rb-limit" class="form-control">
              <option value="100">100</option><option value="500">500</option><option value="1000">1000</option><option value="5000">5000</option>
            </select>
          </div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn btn-outline" style="flex:1" onclick="window.ReportBuilder._saveReport()"><i class="ti ti-device-floppy"></i> Zapisz</button>
            <button class="btn btn-outline" onclick="window.ReportBuilder._exportCsv()"><i class="ti ti-download"></i> CSV</button>
          </div>
        </div>
        <div>
          <div id="rb-result-info" style="color:var(--text-muted);margin-bottom:8px;font-size:.85em">Uruchom raport aby zobaczyć wyniki.</div>
          <div class="table-wrap" id="rb-result"></div>
        </div>
      </div>
      <div id="rb-saved-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.ReportBuilder._closeSaved()">
        <div class="modal-box" style="max-width:600px">
          <div class="modal-header"><h3>Zapisane raporty</h3><button class="modal-close" onclick="window.ReportBuilder._closeSaved()">×</button></div>
          <div class="modal-body" id="rb-saved-body"></div>
        </div>
      </div>`;
    _updateCols();
  }

  function _updateCols() {
    const source = document.getElementById('rb-source')?.value || 'vehicles';
    const cols   = SOURCES[source]?.cols || [];
    const colsEl = document.getElementById('rb-cols');
    const filtEl = document.getElementById('rb-filter-col');
    const sortEl = document.getElementById('rb-sort');
    if (!colsEl) return;
    colsEl.innerHTML = cols.map(c=>`<label style="display:flex;align-items:center;gap:6px;font-size:.85em"><input type="checkbox" name="col_${c}" checked> ${esc(c)}</label>`).join('');
    if (filtEl) filtEl.innerHTML = `<option value="">— brak filtru —</option>` + cols.map(c=>`<option value="${c}">${esc(c)}</option>`).join('');
    if (sortEl) sortEl.innerHTML = `<option value="">— domyślnie —</option>` + cols.map(c=>`<option value="${c}">${esc(c)}</option>`).join('');
  }

  async function _runReport() {
    const source = document.getElementById('rb-source')?.value || 'vehicles';
    const cols   = SOURCES[source]?.cols.filter(c => document.querySelector(`input[name="col_${c}"]`)?.checked) || [];
    const filter_col = document.getElementById('rb-filter-col')?.value || '';
    const filter_val = document.getElementById('rb-filter-val')?.value || '';
    const sort   = document.getElementById('rb-sort')?.value || '';
    const sortDir= document.getElementById('rb-sort-dir')?.value || 'DESC';
    const limit  = document.getElementById('rb-limit')?.value || '100';
    const infoEl = document.getElementById('rb-result-info');
    const resEl  = document.getElementById('rb-result');
    if (infoEl) infoEl.textContent = 'Ładowanie...';
    _currentConfig = { source, cols, filter_col, filter_val, sort, sort_dir: sortDir, limit: +limit };
    const data = await api('/run', { method:'POST', body: JSON.stringify(_currentConfig) });
    const rows = data.rows || [];
    if (infoEl) infoEl.textContent = `Wyniki: ${rows.length} wierszy (źródło: ${esc(SOURCES[source]?.lbl||source)})`;
    if (!resEl) return;
    if (!rows.length) { resEl.innerHTML = '<div class="empty-row">Brak wyników</div>'; return; }
    const usedCols = cols.length ? cols : Object.keys(rows[0]);
    resEl.innerHTML = `<table class="data-table"><thead><tr>${usedCols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(row=>`<tr>${usedCols.map(c=>`<td>${esc(row[c]!=null?String(row[c]):'')}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
  }

  function _exportCsv() {
    const resEl = document.getElementById('rb-result');
    if (!resEl) return;
    const table = resEl.querySelector('table');
    if (!table) { alert('Najpierw uruchom raport.'); return; }
    let csv = '';
    table.querySelectorAll('tr').forEach(r => {
      csv += [...r.querySelectorAll('th,td')].map(c => `"${c.textContent.replace(/"/g,'""')}"`).join(',') + '\n';
    });
    const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `raport_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  async function _saveReport() {
    if (!_currentConfig) { alert('Najpierw uruchom raport.'); return; }
    const name = prompt('Nazwa raportu:');
    if (!name) return;
    await api('/configs', { method:'POST', body: JSON.stringify({ name, ..._currentConfig }) });
    alert('Raport zapisany!');
  }

  async function _openSaved() {
    const modal = document.getElementById('rb-saved-modal');
    const body  = document.getElementById('rb-saved-body');
    const data  = await api('/configs');
    const list  = data.configs || [];
    body.innerHTML = list.length
      ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Nazwa</th><th>Źródło</th><th>Akcje</th></tr></thead><tbody>
          ${list.map(c=>`<tr>
            <td>${esc(c.name)}</td>
            <td>${esc(SOURCES[c.source_table]?.lbl||c.source_table)}</td>
            <td>
              <button class="btn-icon" data-cfg='${JSON.stringify(c)}' onclick="window.ReportBuilder._loadConfig(this.dataset.cfg)"><i class="ti ti-play"></i></button>
              <button class="btn-icon danger" data-id="${esc(c.id)}" onclick="window.ReportBuilder._deleteConfig(this.dataset.id,this.closest('tr'))"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody></table></div>`
      : '<div class="empty-row">Brak zapisanych raportów</div>';
    modal.style.display = 'flex';
  }

  function _loadConfig(cfgJson) {
    try {
      const c = JSON.parse(cfgJson);
      document.getElementById('rb-source').value = c.source_table || c.source || 'vehicles';
      _updateCols();
      setTimeout(() => {
        const cols = typeof c.columns === 'string' ? JSON.parse(c.columns) : (c.cols || c.columns || []);
        SOURCES[c.source_table||c.source]?.cols.forEach(col => {
          const cb = document.querySelector(`input[name="col_${col}"]`);
          if (cb) cb.checked = !cols.length || cols.includes(col);
        });
        _closeSaved();
        _runReport();
      }, 100);
    } catch {}
  }

  async function _deleteConfig(id, row) {
    if (!confirm('Usunąć zapisany raport?')) return;
    await api(`/configs/${id}`, { method:'DELETE' });
    row?.remove();
  }

  function _closeSaved() { const m=document.getElementById('rb-saved-modal'); if(m) m.style.display='none'; }
  window.ReportBuilder = { renderReportBuilder, _updateCols, _runReport, _exportCsv, _saveReport, _openSaved, _loadConfig, _deleteConfig, _closeSaved };
})();


