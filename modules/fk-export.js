(function () {
  'use strict';

  const API = () => window._cfApi ? window._cfApi() : window.WORKER_URL;
  const H   = () => window._cfHdrs ? window._cfHdrs() : {};
  const Co  = () => window._cfCo   ? window._cfCo()   : '';
  const e   = (s) => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v) => v != null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

  const COST_TYPES = ['service','fine','fuel','damage','mileage','insurance'];
  const COST_LABELS = { service:'Serwis/Naprawy',fine:'Mandaty',fuel:'Paliwo',damage:'Szkody',mileage:'Rozliczenia km',insurance:'Ubezpieczenia' };

  let _glAccounts = [];
  let _previewData = [];

  async function renderFkExport() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/gl-accounts?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _glAccounts = await r.json();
    } catch {}

    const el = document.getElementById('page-fk-export');
    if (!el) return;

    const today = new Date().toISOString().slice(0,10);
    const monthStart = `${today.slice(0,7)}-01`;

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-file-export"></i> Eksport FK</h2>
</div>
<div class="card" style="padding:20px;margin-bottom:16px">
  <h3 style="margin:0 0 16px">Mapowanie kont GL</h3>
  <table class="data-table" style="margin-bottom:12px">
  <thead><tr><th>Typ kosztu</th><th>Konto GL</th><th>Opis</th><th></th></tr></thead>
  <tbody>
  ${COST_TYPES.map(t => {
    const gl = _glAccounts.find(g => g.cost_type === t);
    return `<tr>
    <td>${e(COST_LABELS[t])}</td>
    <td><input type="text" id="gl-${e(t)}" value="${e(gl?.gl_account||'')}" placeholder="np. 4-02-001" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);width:120px"></td>
    <td><input type="text" id="gld-${e(t)}" value="${e(gl?.description||'')}" placeholder="Opis konta" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);width:200px"></td>
    <td><button class="btn-secondary" data-type="${e(t)}" onclick="window.FkExportModule.saveGlAccount(this.dataset.type)">Zapisz</button></td>
  </tr>`;
  }).join('')}
  </tbody>
  </table>
</div>
<div class="card" style="padding:20px">
  <h3 style="margin:0 0 16px">Eksport kosztów</h3>
  <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
    <div><label style="display:block;font-size:12px;margin-bottom:4px">Od</label><input type="date" id="fk-from" value="${monthStart}" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)"></div>
    <div><label style="display:block;font-size:12px;margin-bottom:4px">Do</label><input type="date" id="fk-to" value="${today}" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)"></div>
    <div style="align-self:flex-end;display:flex;gap:8px">
      <button class="btn-secondary" onclick="window.FkExportModule.previewExport()"><i class="ti ti-eye"></i> Podgląd</button>
      <button class="btn-primary" onclick="window.FkExportModule.downloadCsv()"><i class="ti ti-download"></i> Pobierz CSV</button>
    </div>
  </div>
  <div id="fk-preview"></div>
</div>`;
  }

  async function saveGlAccount(costType) {
    const gl  = document.getElementById(`gl-${costType}`)?.value?.trim();
    const desc = document.getElementById(`gld-${costType}`)?.value?.trim();
    if (!gl) { alert('Wpisz nr konta GL'); return; }
    try {
      const r = await fetch(`${API()}/api/gl-accounts?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type':'application/json' },
        body: JSON.stringify({ cost_type: costType, gl_account: gl, description: desc||null }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  async function previewExport() {
    const from = document.getElementById('fk-from')?.value;
    const to   = document.getElementById('fk-to')?.value;
    if (!from || !to) { alert('Wybierz zakres dat'); return; }
    try {
      const r = await fetch(`${API()}/api/fk-export?company=${encodeURIComponent(Co())}&from=${from}&to=${to}&format=json`, { headers: H() });
      if (!r.ok) throw new Error(await r.text());
      _previewData = await r.json();
    } catch(ex) { alert(`Błąd: ${ex.message}`); return; }

    const el = document.getElementById('fk-preview');
    if (!el) return;
    if (!_previewData.length) { el.innerHTML = '<p class="empty">Brak kosztów w wybranym zakresie</p>'; return; }
    const total = _previewData.reduce((s,r) => s+(r.amount||0), 0);
    el.innerHTML = `
<div class="table-wrap">
<table class="data-table">
<thead><tr><th>Data</th><th>Typ</th><th>Konto GL</th><th>Nr rej.</th><th>Kwota</th><th>Opis</th></tr></thead>
<tbody>
${_previewData.map(r => `<tr>
  <td>${e(r.date||'—')}</td>
  <td>${e(r.type_label||r.type)}</td>
  <td>${e(r.gl_account||'—')}</td>
  <td>${e(r.nr_rej||'—')}</td>
  <td>${fmtN(r.amount)} PLN</td>
  <td>${e(r.description||'—')}</td>
</tr>`).join('')}
<tr style="font-weight:bold"><td colspan="4">RAZEM</td><td>${fmtN(total)} PLN</td><td></td></tr>
</tbody>
</table>
</div>`;
  }

  async function downloadCsv() {
    const from = document.getElementById('fk-from')?.value;
    const to   = document.getElementById('fk-to')?.value;
    if (!from || !to) { alert('Wybierz zakres dat'); return; }
    const url = `${API()}/api/fk-export?company=${encodeURIComponent(Co())}&from=${from}&to=${to}&format=csv`;
    const a = document.createElement('a');
    a.href = url; a.download = `fk-export-${from}-${to}.csv`; a.style.display='none';
    // Autoryzowany download przez fetch + blob (bo nagłówki sesji)
    try {
      const r = await fetch(url, { headers: H() });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(objUrl); a.remove(); }, 1000);
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  window.FkExportModule = { renderFkExport, saveGlAccount, previewExport, downloadCsv };
})();
