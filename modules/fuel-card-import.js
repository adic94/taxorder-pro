(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtN = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

  const PROVIDER_LBL = { circle_k: 'Circle K', bp: 'BP', shell: 'Shell', lotos: 'Lotos', orlen: 'Orlen', other: 'Inny' };

  let _imports = [], _preview = null, _loading = false;

  async function renderFuelCardImport() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/fuel-card-import?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _imports = await r.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-fuel-card-import');
    if (!el) return;

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-credit-card"></i> Import kart paliwowych</h2>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap">
<div>
  <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">Nowy import</h3>
  <div class="f" style="margin-bottom:10px">
    <label>Dostawca karty</label>
    <select id="fci-provider" class="form-input">
      ${Object.entries(PROVIDER_LBL).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
    </select>
  </div>
  <div class="f" style="margin-bottom:10px">
    <label>Plik CSV (separator: średnik)</label>
    <input type="file" id="fci-file" accept=".csv,.txt" class="form-input" onchange="window.FuelCardImportModule.onFileChange(this)">
  </div>
  <div class="f" style="margin-bottom:10px">
    <label>lub wklej CSV</label>
    <textarea id="fci-csv" class="form-input" rows="5" placeholder="data;nr_rej;litry;kwota;stacja&#10;01.06.2025;WA1234X;50.00;300.00;Circle K Warszawa"></textarea>
  </div>
  <button class="btn-primary" onclick="window.FuelCardImportModule.parseData()" ${_loading ? 'disabled' : ''}><i class="ti ti-search"></i> ${_loading ? '⏳ Przetwarzanie...' : 'Wgraj i przejrzyj'}</button>
</div>
<div>
  <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">Poprzednie importy</h3>
  ${_imports.length ? `<div class="table-wrap"><table class="data-table">
  <thead><tr><th>Data</th><th>Dostawca</th><th>Plik</th><th>Rekordów</th><th>Status</th></tr></thead>
  <tbody>
  ${_imports.map(imp => `<tr>
    <td style="font-size:12px">${e(imp.imported_at?.slice(0,16)||'')}</td>
    <td>${e(PROVIDER_LBL[imp.card_provider]||imp.card_provider)}</td>
    <td style="font-size:11px;color:var(--text-muted)">${e(imp.filename||'—')}</td>
    <td>${imp.records_count||0}</td>
    <td><span class="pill ${imp.status==='processed'?'ok':imp.status==='error'?'danger':'warn'}">${e(imp.status)}</span></td>
  </tr>`).join('')}
  </tbody></table></div>` : '<p style="color:var(--text-muted);font-size:13px">Brak poprzednich importów</p>'}
</div>
</div>
<div id="fci-preview" style="margin-top:20px"></div>`;
    if (_preview) _renderPreview();
  }

  function _renderPreview() {
    const el = document.getElementById('fci-preview');
    if (!el || !_preview) return;
    const { records, provider, count } = _preview;
    el.innerHTML = `
<hr style="margin:16px 0;border:none;border-top:1px solid var(--border)">
<h3 style="font-size:14px;font-weight:600;margin-bottom:8px">Podgląd importu — ${count} rekordów (${e(PROVIDER_LBL[provider]||provider)})</h3>
<div class="table-wrap" style="max-height:300px;overflow-y:auto"><table class="data-table">
<thead><tr><th>Data</th><th>Nr rej.</th><th>Litry</th><th>Kwota PLN</th><th>Stacja</th></tr></thead>
<tbody>
${records.slice(0, 50).map(r => `<tr>
  <td>${e(r.fill_date||'')}</td><td>${e(r.nr_rej||'')}</td>
  <td>${fmtN(r.liters,2)}</td><td>${fmtN(r.cost_pln,2)}</td><td>${e(r.station||'—')}</td>
</tr>`).join('')}
${records.length > 50 ? `<tr><td colspan="5" class="empty">... i ${records.length-50} więcej</td></tr>` : ''}
</tbody></table></div>
<div style="margin-top:12px;display:flex;gap:8px">
  <button class="btn-primary" onclick="window.FuelCardImportModule.confirmImport()"><i class="ti ti-database-import"></i> Importuj ${count} rekordów</button>
  <button class="btn-secondary" onclick="window.FuelCardImportModule.cancelPreview()">Anuluj</button>
</div>`;
  }

  function onFileChange(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const ta = document.getElementById('fci-csv'); if (ta) ta.value = ev.target.result; };
    reader.readAsText(file, 'utf-8');
  }

  async function parseData() {
    const csvText  = document.getElementById('fci-csv')?.value?.trim();
    const provider = document.getElementById('fci-provider')?.value || 'other';
    if (!csvText) { alert('Wgraj plik lub wklej CSV'); return; }
    _loading = true; _render();
    try {
      const r = await fetch(`${API()}/api/fuel-card-import/parse?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: csvText, provider }),
      });
      if (!r.ok) throw new Error(await r.text());
      _preview = await r.json();
      if (!_preview.count) { alert('Nie znaleziono rekordów — sprawdź format CSV (separator ;)'); _preview = null; }
    } catch (ex) { alert('Błąd: ' + ex.message); _preview = null; }
    _loading = false; _render();
  }

  async function confirmImport() {
    if (!_preview?.records?.length) return;
    const file     = document.getElementById('fci-file')?.files?.[0]?.name || 'import.csv';
    const provider = _preview.provider || 'other';
    try {
      const r = await fetch(`${API()}/api/fuel-card-import/confirm?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, filename: file, records: _preview.records }),
      });
      if (!r.ok) throw new Error(await r.text());
      const res = await r.json();
      alert(`Import zakończony: ${res.imported} nowych, ${res.skipped} pominięte (duplikaty)`);
      _preview = null; await renderFuelCardImport();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  function cancelPreview() { _preview = null; _render(); }

  window.FuelCardImportModule = { renderFuelCardImport, onFileChange, parseData, confirmImport, cancelPreview };
})();
