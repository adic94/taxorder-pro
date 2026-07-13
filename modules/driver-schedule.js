(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const SHIFT_COLOR = { day: 'var(--green)', night: '#6366f1', standby: 'var(--orange)' };
  const SHIFT_LBL   = { day: 'Dzienna', night: 'Nocna', standby: 'Dyżur' };
  const DAY_PL      = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

  let _weekDate = new Date().toISOString().slice(0, 10);
  let _weekData = null;
  let _entries  = [];

  async function renderDriverSchedule() {
    const co = Co();
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API()}/api/driver-schedule/week?company=${encodeURIComponent(co)}&date=${_weekDate}`, { headers: H() }),
        fetch(`${API()}/api/driver-schedule?company=${encodeURIComponent(co)}&from=${_weekDate}`, { headers: H() }),
      ]);
      if (r1.ok) _weekData = await r1.json();
      if (r2.ok) _entries  = await r2.json();
    } catch {}
    _render();
  }

  function _getWeekDates(isoDate) {
    const d = new Date(isoDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d); mon.setDate(diff);
    const days = [];
    for (let i = 0; i < 7; i++) { const dd = new Date(mon); dd.setDate(mon.getDate() + i); days.push(dd.toISOString().slice(0, 10)); }
    return days;
  }

  function _render() {
    const el = document.getElementById('page-driver-schedule');
    if (!el) return;
    const days    = _weekData?.days || _getWeekDates(_weekDate);
    const drivers = _weekData?.drivers || [];
    const grid    = _weekData?.grid || {};
    const weekStart = days[0];
    const weekEnd   = days[6];

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-calendar-week"></i> Grafik kierowców</h2>
  <button class="btn-primary" onclick="window.DriverScheduleModule.openModal()"><i class="ti ti-plus"></i> Dodaj zmianę</button>
</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
  <button class="btn-secondary" onclick="window.DriverScheduleModule.prevWeek()"><i class="ti ti-chevron-left"></i></button>
  <span style="font-weight:600;min-width:200px;text-align:center">${e(weekStart)} — ${e(weekEnd)}</span>
  <button class="btn-secondary" onclick="window.DriverScheduleModule.nextWeek()"><i class="ti ti-chevron-right"></i></button>
  <button class="btn-secondary" onclick="window.DriverScheduleModule.goToToday()">Dziś</button>
</div>
<div class="table-wrap" style="overflow-x:auto"><table class="data-table" style="min-width:700px">
<thead><tr>
  <th>Kierowca</th>
  ${days.map((d, i) => `<th style="text-align:center;min-width:90px">${DAY_PL[i]}<br><small style="font-weight:400">${d.slice(5)}</small></th>`).join('')}
</tr></thead>
<tbody>
${drivers.length ? drivers.map(drv => `<tr>
  <td style="white-space:nowrap;font-weight:500">${e(drv)}</td>
  ${days.map(d => {
    const entry = grid[drv]?.[d];
    if (entry) return `<td style="padding:2px"><div style="background:${SHIFT_COLOR[entry.shift_type]||'var(--green)'};color:#fff;border-radius:6px;padding:3px 6px;font-size:11px;cursor:pointer" data-id="${e(entry.id)}" onclick="window.DriverScheduleModule.openModal(this.dataset.id)" title="${e(entry.nr_rej||'')} ${e(entry.start_time||'')}–${e(entry.end_time||'')}">
      ${e(SHIFT_LBL[entry.shift_type]||entry.shift_type)}<br>${e(entry.start_time||'')}${entry.end_time?'–'+e(entry.end_time):''}
    </div></td>`;
    return `<td style="cursor:pointer;color:var(--text-muted);text-align:center;font-size:18px" onclick="window.DriverScheduleModule.openModal(null,'${d}','${e(drv)}')">+</td>`;
  }).join('')}
</tr>`).join('') : `<tr><td colspan="${days.length + 1}" class="empty">Brak kierowców w grafiku — dodaj zmianę</td></tr>`}
</tbody></table></div>
<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">
  ${Object.entries(SHIFT_LBL).map(([k,v]) => `<span style="display:flex;align-items:center;gap:4px;font-size:12px"><span style="width:12px;height:12px;border-radius:3px;background:${SHIFT_COLOR[k]};display:inline-block"></span>${v}</span>`).join('')}
</div>`;
  }

  function prevWeek() {
    const d = new Date(_weekDate); d.setDate(d.getDate() - 7);
    _weekDate = d.toISOString().slice(0, 10); renderDriverSchedule();
  }
  function nextWeek() {
    const d = new Date(_weekDate); d.setDate(d.getDate() + 7);
    _weekDate = d.toISOString().slice(0, 10); renderDriverSchedule();
  }
  function goToToday() { _weekDate = new Date().toISOString().slice(0, 10); renderDriverSchedule(); }

  function openModal(id, date, driverName) {
    const entry = id ? (_weekData?.entries || _entries).find(x => x.id === id) : null;
    const modal = document.getElementById('driver-schedule-modal');
    if (!modal) return;
    const gi = k => document.getElementById(k);
    gi('dsm-id').value     = entry?.id || '';
    gi('dsm-driver').value = entry?.driver_name || driverName || '';
    gi('dsm-date').value   = entry?.scheduled_date || date || _weekDate;
    gi('dsm-type').value   = entry?.shift_type || 'day';
    gi('dsm-start').value  = entry?.start_time || '';
    gi('dsm-end').value    = entry?.end_time || '';
    gi('dsm-nrrej').value  = entry?.nr_rej || '';
    gi('dsm-route').value  = entry?.route || '';
    gi('dsm-notes').value  = entry?.notes || '';
    modal.style.display = 'flex';
  }

  function closeModal() {
    const m = document.getElementById('driver-schedule-modal');
    if (m) m.style.display = 'none';
  }

  async function saveSchedule() {
    const gi = k => document.getElementById(k);
    if (!gi('dsm-driver').value || !gi('dsm-date').value) { alert('Wypełnij: kierowca, data'); return; }
    const id = gi('dsm-id').value;
    const body = {
      driver_name: gi('dsm-driver').value, scheduled_date: gi('dsm-date').value,
      shift_type: gi('dsm-type').value, start_time: gi('dsm-start').value || null,
      end_time: gi('dsm-end').value || null, nr_rej: gi('dsm-nrrej').value || null,
      route: gi('dsm-route').value || null, notes: gi('dsm-notes').value || null,
    };
    const url = id
      ? `${API()}/api/driver-schedule/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/driver-schedule?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeModal(); await renderDriverSchedule();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  async function deleteSchedule(id) {
    if (!confirm('Usunąć wpis z grafiku?')) return;
    try {
      await fetch(`${API()}/api/driver-schedule/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderDriverSchedule();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  window.DriverScheduleModule = { renderDriverSchedule, prevWeek, nextWeek, goToToday, openModal, closeModal, saveSchedule, deleteSchedule };
})();
