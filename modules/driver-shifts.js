(function () {
  'use strict';

  const API = () => window._cfApi ? window._cfApi() : window.WORKER_URL;
  const H   = () => window._cfHdrs ? window._cfHdrs() : {};
  const Co  = () => window._cfCo   ? window._cfCo()   : '';
  const e   = (s) => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtMin = (m) => m != null ? `${Math.floor(m/60)}h ${m%60}min` : '—';

  let _shifts = [];
  let _driver = '';

  async function renderDriverShifts(driver) {
    _driver = driver || _driver;
    const co = Co();
    const params = new URLSearchParams({ company: co });
    if (_driver) params.set('driver', _driver);
    const from = document.getElementById('ds-from')?.value;
    const to   = document.getElementById('ds-to')?.value;
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    try {
      const r = await fetch(`${API()}/api/driver-shifts?${params}`, { headers: H() });
      if (r.ok) _shifts = await r.json();
    } catch {}

    const el = document.getElementById('page-driver-shifts');
    if (!el) return;

    // Podsumowanie
    let summaryHtml = '';
    if (_driver) {
      try {
        const sp = new URLSearchParams({ company: co, driver: _driver });
        if (from) sp.set('from', from);
        if (to)   sp.set('to', to);
        const sr = await fetch(`${API()}/api/driver-shifts/summary?${sp}`, { headers: H() });
        if (sr.ok) {
          const s = await sr.json();
          summaryHtml = `<div class="kpi-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
  <div class="kpi-chip"><i class="ti ti-clock"></i><span class="kpi-val">${fmtMin(s.total_work_minutes)}</span><span class="kpi-lbl">Przepracowano</span></div>
  <div class="kpi-chip"><i class="ti ti-alert-circle"></i><span class="kpi-val">${fmtMin(s.total_overtime)}</span><span class="kpi-lbl">Nadgodziny</span></div>
  <div class="kpi-chip"><i class="ti ti-calendar"></i><span class="kpi-val">${s.shift_count||0}</span><span class="kpi-lbl">Zmian</span></div>
</div>`;
        }
      } catch {}
    }

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-clock"></i> Czas pracy kierowców</h2>
  <button class="btn-primary" onclick="window.DriverShiftsModule.openShiftModal()"><i class="ti ti-plus"></i> Dodaj zmianę</button>
</div>
<div class="filter-row" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
  <input id="ds-driver-filter" type="text" placeholder="Filtruj kierowcę" value="${e(_driver)}" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)" oninput="_driver=this.value">
  <input id="ds-from" type="date" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
  <input id="ds-to"   type="date" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
  <button class="btn-secondary" onclick="window.DriverShiftsModule.renderDriverShifts()">Filtruj</button>
</div>
${summaryHtml}
<div class="table-wrap">
<table class="data-table">
<thead><tr><th>Data</th><th>Kierowca</th><th>Nr rej.</th><th>Start</th><th>Koniec</th><th>Przerwa</th><th>Czas pracy</th><th>Nadgodziny</th><th>Typ</th><th></th></tr></thead>
<tbody>
${_shifts.length ? _shifts.map(s => `<tr>
  <td>${e(s.shift_date)}</td>
  <td>${e(s.driver_name)}</td>
  <td>${e(s.nr_rej||'—')}</td>
  <td>${e(s.start_time||'—')}</td>
  <td>${e(s.end_time||'—')}</td>
  <td>${s.break_minutes ? `${s.break_minutes} min` : '—'}</td>
  <td>${fmtMin(s.work_minutes)}</td>
  <td>${s.overtime_minutes ? fmtMin(s.overtime_minutes) : '—'}</td>
  <td>${e(s.shift_type||'normal')}</td>
  <td>
    <button class="btn-icon" data-id="${e(s.id)}" onclick="window.DriverShiftsModule.editShift(this.dataset.id)" title="Edytuj"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(s.id)}" onclick="window.DriverShiftsModule.deleteShift(this.dataset.id)" title="Usuń"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="10" class="empty">Brak zmian</td></tr>'}
</tbody>
</table>
</div>`;
  }

  function openShiftModal(id) {
    const s = id ? _shifts.find(x => x.id === id) : null;
    const modal = document.getElementById('shift-modal');
    if (!modal) return;
    document.getElementById('sm-id').value           = s?.id || '';
    document.getElementById('sm-driver').value       = s?.driver_name || _driver || '';
    document.getElementById('sm-nr-rej').value       = s?.nr_rej || '';
    document.getElementById('sm-date').value          = s?.shift_date || new Date().toISOString().slice(0,10);
    document.getElementById('sm-start').value         = s?.start_time || '';
    document.getElementById('sm-end').value           = s?.end_time || '';
    document.getElementById('sm-break').value         = s?.break_minutes ?? 0;
    document.getElementById('sm-type').value          = s?.shift_type || 'normal';
    document.getElementById('sm-notes').value         = s?.notes || '';
    modal.style.display = 'flex';
  }

  function closeShiftModal() {
    const modal = document.getElementById('shift-modal');
    if (modal) modal.style.display = 'none';
  }

  async function saveShift() {
    const id = document.getElementById('sm-id').value;
    const driver = document.getElementById('sm-driver').value.trim();
    if (!driver) { alert('Wpisz imię kierowcy'); return; }
    const body = {
      driver_name:   driver,
      nr_rej:        document.getElementById('sm-nr-rej').value || null,
      shift_date:    document.getElementById('sm-date').value,
      start_time:    document.getElementById('sm-start').value || null,
      end_time:      document.getElementById('sm-end').value || null,
      break_minutes: parseInt(document.getElementById('sm-break').value) || 0,
      shift_type:    document.getElementById('sm-type').value || 'normal',
      notes:         document.getElementById('sm-notes').value || null,
    };
    const method = id ? 'PUT' : 'POST';
    const url    = id
      ? `${API()}/api/driver-shifts/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/driver-shifts?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers: { ...H(), 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeShiftModal();
      await renderDriverShifts();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  function editShift(id) { openShiftModal(id); }

  async function deleteShift(id) {
    if (!confirm('Usunąć tę zmianę?')) return;
    try {
      await fetch(`${API()}/api/driver-shifts/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers: H() });
      await renderDriverShifts();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  window.DriverShiftsModule = { renderDriverShifts, openShiftModal, closeShiftModal, saveShift, editShift, deleteShift };
})();
