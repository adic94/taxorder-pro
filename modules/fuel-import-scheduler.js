/**
 * TaxOrder Pro — Harmonogram importu paliw (cykliczny)
 * Import CSV z kart paliwowych: ORLEN, BP, Shell, Lotos, Circle K
 *
 * SCHEMA_NEEDED: uruchom worker/schema_v47.sql (fuel_import_schedules)
 */
window.FuelImportScheduler = (function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  let _schedules = [];
  let _logs      = [];
  let _tab       = 'schedules'; // 'schedules' | 'log'

  const PROVIDERS = {
    orlen:    { label: 'ORLEN / Orlen Charge',   icon: '⛽', color: '#d62b2b' },
    bp:       { label: 'BP',                      icon: '🟢', color: '#007a33' },
    shell:    { label: 'Shell',                   icon: '🔴', color: '#dd1d21' },
    lotos:    { label: 'Lotos / Gulf',            icon: '🔵', color: '#005aa0' },
    circle_k: { label: 'Circle K / Statoil',      icon: '🔶', color: '#f04e23' },
    dkv:      { label: 'DKV Euro Service',        icon: '🟡', color: '#f5a623' },
    custom:   { label: 'Niestandardowy (CSV)',    icon: '📄', color: '#6b7280' },
  };

  const STATUS_CFG = {
    ok:      { lbl: 'OK',       color: 'var(--green)' },
    error:   { lbl: 'Błąd',    color: 'var(--red)'   },
    partial: { lbl: 'Częściow.', color: 'var(--orange)' },
    pending: { lbl: 'Oczekuje', color: 'var(--text3)' },
  };

  // ── Ładowanie danych ────────────────────────────────────────────────────────
  async function _load() {
    const co = Co();
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API()}/api/fuel-import-scheduler?company=${encodeURIComponent(co)}`, { headers: H() }),
        fetch(`${API()}/api/fuel-import-scheduler/log?company=${encodeURIComponent(co)}`, { headers: H() }),
      ]);
      if (r1.ok) _schedules = await r1.json();
      if (r2.ok) _logs      = await r2.json();
    } catch {}
  }

  // ── Render główny ───────────────────────────────────────────────────────────
  async function renderFuelImportScheduler() {
    const el = document.getElementById('page-fuel-import-scheduler');
    if (!el) return;
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)"><i class="ti ti-loader" style="font-size:32px"></i><br>Ładowanie...</div>`;
    await _load();
    _render();
  }

  function _render() {
    const el = document.getElementById('page-fuel-import-scheduler');
    if (!el) return;

    el.innerHTML = `
<div class="page-header" style="margin-bottom:16px">
  <h2 style="margin:0"><i class="ti ti-calendar-repeat"></i> Harmonogram importu paliw</h2>
  <button class="btn-primary" onclick="window.FuelImportScheduler.openAddModal()">
    <i class="ti ti-plus"></i> Nowy harmonogram
  </button>
</div>

<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:16px">
  <button onclick="window.FuelImportScheduler.setTab('schedules')"
    style="padding:8px 18px;border:none;background:none;cursor:pointer;border-bottom:2px solid ${_tab==='schedules'?'var(--primary)':'transparent'};color:${_tab==='schedules'?'var(--primary)':'var(--text2)'}">
    <i class="ti ti-list"></i> Harmonogramy (${_schedules.length})
  </button>
  <button onclick="window.FuelImportScheduler.setTab('log')"
    style="padding:8px 18px;border:none;background:none;cursor:pointer;border-bottom:2px solid ${_tab==='log'?'var(--primary)':'transparent'};color:${_tab==='log'?'var(--primary)':'var(--text2)'}">
    <i class="ti ti-history"></i> Historia importów
  </button>
</div>

${_tab === 'schedules' ? _renderSchedules() : _renderLog()}

<div id="fis-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:none;align-items:center;justify-content:center" onclick="if(event.target===this)window.FuelImportScheduler.closeModal()"></div>
`;
  }

  function _renderSchedules() {
    if (!_schedules.length) return `
<div style="padding:60px;text-align:center;color:var(--text3)">
  <i class="ti ti-calendar-off" style="font-size:48px;display:block;margin-bottom:12px"></i>
  <p>Brak skonfigurowanych harmonogramów importu.</p>
  <p style="font-size:13px">Dodaj harmonogram, by automatycznie importować dane kart paliwowych każdej nocy.</p>
  <button class="btn-primary" onclick="window.FuelImportScheduler.openAddModal()"><i class="ti ti-plus"></i> Dodaj pierwszy harmonogram</button>
</div>`;

    return `
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
${_schedules.map(s => {
  const prov = PROVIDERS[s.provider] || PROVIDERS.custom;
  const st   = STATUS_CFG[s.last_run_status] || { lbl: '—', color: 'var(--text3)' };
  const lastRun = s.last_run_at ? new Date(s.last_run_at).toLocaleString('pl-PL') : 'Nigdy';
  return `
<div style="background:var(--bg2);border-radius:10px;padding:16px;border:1px solid var(--border)">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
    <div>
      <span style="font-size:20px;margin-right:6px">${prov.icon}</span>
      <strong style="font-size:15px">${e(s.name)}</strong>
    </div>
    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px">
      <input type="checkbox" ${s.active?'checked':''} onchange="window.FuelImportScheduler.toggleActive('${e(s.id)}',this.checked)">
      Aktywny
    </label>
  </div>
  <div style="font-size:12px;color:var(--text3);margin-bottom:6px">${e(prov.label)}</div>
  ${s.csv_url ? `<div style="font-size:11px;color:var(--text3);margin-bottom:6px;word-break:break-all"><i class="ti ti-link"></i> ${e(s.csv_url)}</div>` : `<div style="font-size:11px;color:var(--text3);margin-bottom:6px"><i class="ti ti-upload"></i> Ręczny upload CSV</div>`}
  <div style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:12px">
    <span style="color:${st.color};font-weight:600">${st.lbl}</span>
    <span style="color:var(--text3)">Ostatni: ${lastRun}</span>
    ${s.last_row_count ? `<span style="color:var(--text3)">(${s.last_row_count} wierszy)</span>` : ''}
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <button class="btn-primary" style="font-size:12px;padding:5px 10px"
      data-id="${e(s.id)}" onclick="window.FuelImportScheduler.runNow(this.dataset.id)" title="Uruchom teraz">
      <i class="ti ti-player-play"></i> Uruchom
    </button>
    <button class="btn-secondary" style="font-size:12px;padding:5px 10px"
      data-id="${e(s.id)}" onclick="window.FuelImportScheduler.openEditById(this.dataset.id)">
      <i class="ti ti-edit"></i> Edytuj
    </button>
    <button class="btn-danger" style="font-size:12px;padding:5px 10px"
      data-id="${e(s.id)}" onclick="window.FuelImportScheduler.deleteSchedule(this.dataset.id)">
      <i class="ti ti-trash"></i>
    </button>
  </div>
</div>`;
}).join('')}
</div>

<div style="margin-top:18px;padding:14px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <i class="ti ti-info-circle"></i>
  <strong>Cron nocny:</strong> Import uruchamia się automatycznie o 3:00 UTC dla każdego aktywnego harmonogramu z ustawionym adresem CSV.
  Harmonogramy bez URL wymagają ręcznego przesłania pliku przez "Uruchom".
</div>

${_renderFormatInfo()}`;
  }

  function _renderFormatInfo() {
    return `
<div style="margin-top:14px;padding:14px;background:var(--bg2);border-radius:8px">
  <h4 style="font-size:13px;margin:0 0 10px"><i class="ti ti-file-text"></i> Format CSV per dostawca</h4>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;font-size:12px">
    <div style="background:var(--bg);padding:8px 10px;border-radius:6px">
      <strong>ORLEN:</strong><br>
      <code style="font-size:10px">Data;NrRej;Litery;CenaJL;Kwota;Stacja</code>
    </div>
    <div style="background:var(--bg);padding:8px 10px;border-radius:6px">
      <strong>BP / Shell:</strong><br>
      <code style="font-size:10px">Date;Plate;Volume;UnitPrice;Total;Site</code>
    </div>
    <div style="background:var(--bg);padding:8px 10px;border-radius:6px">
      <strong>DKV:</strong><br>
      <code style="font-size:10px">TransDate;VehicleReg;Quantity;PriceUnit;Amount;StationName</code>
    </div>
    <div style="background:var(--bg);padding:8px 10px;border-radius:6px">
      <strong>Niestandardowy:</strong><br>
      <code style="font-size:10px">Dowolny CSV z kolumnami daty, nr rej., litrów</code>
    </div>
  </div>
</div>`;
  }

  function _renderLog() {
    if (!_logs.length) return `<div style="padding:40px;text-align:center;color:var(--text3)">Brak historii importów.</div>`;

    return `
<div class="table-wrap" style="overflow-x:auto">
<table class="data-table">
<thead><tr>
  <th>Data importu</th>
  <th>Harmonogram</th>
  <th>Status</th>
  <th>Importowane</th>
  <th>Pominięte</th>
  <th>Błąd</th>
</tr></thead>
<tbody>
${_logs.map(l => {
  const st = STATUS_CFG[l.status] || { lbl: l.status || '?', color: 'var(--text3)' };
  return `<tr>
    <td style="font-size:12px">${e(new Date(l.run_at).toLocaleString('pl-PL'))}</td>
    <td>${e(l.schedule_name || '—')}</td>
    <td><span style="color:${st.color};font-weight:600">${st.lbl}</span></td>
    <td style="color:var(--green);font-weight:600">${l.rows_imported ?? 0}</td>
    <td style="color:var(--text3)">${l.rows_skipped ?? 0}</td>
    <td style="font-size:11px;color:var(--red);max-width:220px;overflow:hidden;text-overflow:ellipsis">${e(l.error_msg || '')}</td>
  </tr>`;
}).join('')}
</tbody>
</table>
</div>`;
  }

  // ── Modal dodawania/edycji ───────────────────────────────────────────────────
  function openAddModal() {
    _showModal(null);
  }

  // Otwiera modal edycji na podstawie id (data-id) — bez interpolacji w onclick
  function openEditById(id) {
    const s = _schedules.find(sc => sc.id === id);
    if (!s) return;
    _showModal(s);
  }

  function openEditModal(jsonStr) {
    let s; try { s = JSON.parse(jsonStr); } catch { return; }
    _showModal(s);
  }

  function _showModal(s) {
    const isEdit = !!s;
    const provOptions = Object.entries(PROVIDERS).map(([k, v]) =>
      `<option value="${k}" ${s?.provider===k?'selected':''}>${v.icon} ${v.label}</option>`
    ).join('');

    const overlay = document.getElementById('fis-modal');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.innerHTML = `
<div style="background:var(--bg);border-radius:12px;padding:24px;width:460px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.25)">
  <h3 style="margin:0 0 16px;font-size:16px">${isEdit ? 'Edytuj harmonogram' : 'Nowy harmonogram importu'}</h3>
  <div style="display:flex;flex-direction:column;gap:12px">
    <label style="font-size:12px;color:var(--text3)">Nazwa *
      <input id="fis-name" class="sel" style="width:100%;margin-top:4px" placeholder="np. Karty ORLEN — Warszawa" value="${e(s?.name||'')}">
    </label>
    <label style="font-size:12px;color:var(--text3)">Dostawca *
      <select id="fis-provider" class="sel" style="width:100%;margin-top:4px">${provOptions}</select>
    </label>
    <label style="font-size:12px;color:var(--text3)">URL pliku CSV (opcjonalnie)
      <input id="fis-url" class="sel" style="width:100%;margin-top:4px" type="url" placeholder="https://..." value="${e(s?.csv_url||'')}">
      <small style="color:var(--text3)">Jeśli puste — wymagany ręczny upload pliku przez "Uruchom"</small>
    </label>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
      <input type="checkbox" id="fis-active" ${!isEdit||s?.active?'checked':''}>
      Aktywny (uruchamiaj w nocnym cronie)
    </label>
  </div>
  <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
    <button class="btn-secondary" onclick="window.FuelImportScheduler.closeModal()">Anuluj</button>
    <button class="btn-primary" onclick="window.FuelImportScheduler.saveSchedule(${isEdit?`'${e(s.id)}'`:null})">
      ${isEdit ? 'Zapisz' : 'Utwórz'}
    </button>
  </div>
</div>`;
  }

  function closeModal() {
    const o = document.getElementById('fis-modal');
    if (o) o.style.display = 'none';
  }

  // ── Operacje CRUD ────────────────────────────────────────────────────────────
  async function saveSchedule(existingId) {
    const name     = document.getElementById('fis-name')?.value.trim();
    const provider = document.getElementById('fis-provider')?.value;
    const csv_url  = document.getElementById('fis-url')?.value.trim() || null;
    const active   = document.getElementById('fis-active')?.checked ? 1 : 0;

    if (!name) { if(typeof toast==='function') toast('Podaj nazwę harmonogramu','error'); return; }
    if (csv_url && !csv_url.startsWith('https://')) { if(typeof toast==='function') toast('URL musi zaczynać się od https://','error'); return; }

    const co = Co();
    const method = existingId ? 'PUT' : 'POST';
    const url = existingId
      ? `${API()}/api/fuel-import-scheduler/${existingId}?company=${encodeURIComponent(co)}`
      : `${API()}/api/fuel-import-scheduler?company=${encodeURIComponent(co)}`;

    try {
      const r = await fetch(url, { method, headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name, provider, csv_url, active }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Błąd'); }
      if(typeof toast==='function') toast(existingId ? 'Harmonogram zaktualizowany' : 'Harmonogram dodany');
      closeModal();
      renderFuelImportScheduler();
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
    }
  }

  async function deleteSchedule(id) {
    if (!confirm('Usuń harmonogram?')) return;
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/fuel-import-scheduler/${id}?company=${encodeURIComponent(co)}`, { method: 'DELETE', headers: H() });
      if (!r.ok) throw new Error('Błąd usuwania');
      if(typeof toast==='function') toast('Harmonogram usunięty');
      renderFuelImportScheduler();
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
    }
  }

  async function toggleActive(id, active) {
    const co = Co();
    try {
      await fetch(`${API()}/api/fuel-import-scheduler/${id}?company=${encodeURIComponent(co)}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify({ active: active ? 1 : 0 }),
      });
    } catch {}
  }

  async function runNow(id) {
    const co = Co();
    const btn = event?.target?.closest('button');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Uruchamianie...'; }

    try {
      const r = await fetch(`${API()}/api/fuel-import-scheduler/run/${id}?company=${encodeURIComponent(co)}`, { method: 'POST', headers: H() });
      const d = await r.json();
      if (d.status === 'ok' || d.rows_imported >= 0) {
        if(typeof toast==='function') toast(`Import zakończony: ${d.rows_imported||0} wierszy zaimportowanych, ${d.rows_skipped||0} pominiętych`);
      } else {
        if(typeof toast==='function') toast(d.error || d.error_msg || 'Błąd importu','error');
      }
      renderFuelImportScheduler();
    } catch(ex) {
      if(typeof toast==='function') toast(ex.message,'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-player-play"></i> Uruchom'; }
    }
  }

  function setTab(tab) {
    _tab = tab;
    _render();
  }

  return { renderFuelImportScheduler, openAddModal, openEditById, openEditModal, closeModal, saveSchedule, deleteSchedule, toggleActive, runNow, setTab };
})();
