/**
 * TaxOrder Pro — Kalendarz Floty
 * Rezerwacje pojazdów: widok tygodniowy (Gantt) i miesięczny — dane w D1
 */
window.FleetCalendar = (function () {

  const STATUS_COLORS = {
    pending:  { bg:'var(--amber-light,#fff8e6)', border:'var(--amber)', text:'var(--amber)' },
    accepted: { bg:'var(--green-light,#ecfdf5)',  border:'var(--green)',  text:'var(--green)' },
    rejected: { bg:'rgba(239,68,68,.08)',          border:'var(--red)',    text:'var(--red)' },
  };
  const _statusLabel = s => ({ pending: t('cal.status.pending'), accepted: t('cal.status.accepted'), rejected: t('cal.status.rejected') })[s] || s;

  let _view   = 'week';
  let _anchor = new Date();
  _anchor.setHours(0,0,0,0);
  let _res    = [];   // cache rezerwacji
  let _loaded = false;

  // ── API ───────────────────────────────────────────────────────────────────
  const _api = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const _tok = () => localStorage.getItem('cf_token');
  const _hdrs = () => ({ 'Content-Type': 'application/json', ...(_tok() ? { Authorization: 'Bearer ' + _tok() } : {}) });
  const _co  = () => window.currentCompanyId || 'mtoilet';

  async function _loadApi(from, to) {
    try {
      let q = `${_api()}/api/reservations?company=${_co()}`;
      if (from) q += `&from=${from}`;
      if (to)   q += `&to=${to}`;
      const r = await fetch(q, { headers: _hdrs() });
      const d = r.ok ? await r.json() : {};
      _res    = d.reservations || [];
      _loaded = true;
    } catch { _res = []; }
  }

  async function _migrateLocalStorage() {
    const raw = localStorage.getItem('taxReservations');
    if (!raw) return;
    let old; try { old = JSON.parse(raw); } catch { localStorage.removeItem('taxReservations'); return; }
    if (!Array.isArray(old) || !old.length) { localStorage.removeItem('taxReservations'); return; }
    let migrated = 0;
    for (const r of old) {
      const veh = (window.vehs || []).find(v => v.id === r.vehId);
      const nr_rej = veh?.nrRej || r.nrRej || null;
      if (!nr_rej || !r.start || !r.end) continue;
      try {
        const resp = await fetch(`${_api()}/api/reservations?company=${_co()}`, {
          method: 'POST', headers: _hdrs(),
          body: JSON.stringify({ nr_rej, user_name: r.user || 'Migrated', start: r.start, end: r.end,
            status: r.status || 'accepted', notes: r.notes || null }),
        });
        if (resp.ok) migrated++;
      } catch {}
    }
    if (migrated > 0) { localStorage.removeItem('taxReservations'); if (typeof toast === 'function') toast(t('cal.toast.migrated').replace('{0}', migrated)); }
    else localStorage.removeItem('taxReservations');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _isoDate(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function _addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

  function _currentUser() {
    const u = window.currentUser;
    return u?.name || u?.email || 'Użytkownik';
  }

  function _isAdmin() {
    return ['admin','kierownik'].includes(window.currentUser?.role || '');
  }

  // ── Open / Close / Navigate ───────────────────────────────────────────────
  async function open() {
    document.getElementById('fleet-cal-modal').style.display = 'flex';
    _anchor = new Date(); _anchor.setHours(0,0,0,0);
    const dow = _anchor.getDay();
    _anchor.setDate(_anchor.getDate() - (dow === 0 ? 6 : dow - 1));
    await _migrateLocalStorage();
    await _loadApi();
    _render();
  }

  function close() { document.getElementById('fleet-cal-modal').style.display = 'none'; }
  async function prev() { _anchor = _addDays(_anchor, _view === 'week' ? -7 : -28); await _loadApi(); _render(); }
  async function next() { _anchor = _addDays(_anchor, _view === 'week' ? 7 : 28); await _loadApi(); _render(); }
  async function today() {
    _anchor = new Date(); _anchor.setHours(0,0,0,0);
    const dow = _anchor.getDay();
    _anchor = _addDays(_anchor, -(dow === 0 ? 6 : dow - 1));
    await _loadApi(); _render();
  }
  async function setView(v) { _view = v; await _loadApi(); _render(); }

  // ── Main render ───────────────────────────────────────────────────────────
  function _render() {
    if (_view === 'week') _renderWeek();
    else _renderMonth();
    _renderLegend();
  }

  function _renderLegend() {
    const el = document.getElementById('cal-legend');
    if (!el) return;
    el.innerHTML = Object.keys(STATUS_COLORS).map(k =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:10px;background:${STATUS_COLORS[k].bg};border:1px solid ${STATUS_COLORS[k].border};color:${STATUS_COLORS[k].text}">${_statusLabel(k)}</span>`
    ).join('');
  }

  // ── WIDOK TYGODNIOWY (Gantt) ──────────────────────────────────────────────
  function _renderWeek() {
    const el = document.getElementById('cal-body');
    if (!el) return;
    const vehs = (window.vehs || []).filter(v => v.is_active !== false);
    if (!vehs.length) { el.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text3)">${t('cal.no.vehicles')}</div>`; return; }

    const days = Array.from({length:7}, (_,i) => _addDays(_anchor, i));
    const todayStr = _isoDate(new Date());
    const _DOW = [t('cal.day.mon'),t('cal.day.tue'),t('cal.day.wed'),t('cal.day.thu'),t('cal.day.fri'),t('cal.day.sat'),t('cal.day.sun')];

    const dayHeaders = days.map(d => {
      const ds = _isoDate(d);
      const isToday = ds === todayStr;
      const dow = _DOW[d.getDay() === 0 ? 6 : d.getDay()-1];
      return `<th style="padding:6px 4px;text-align:center;font-size:11px;white-space:nowrap;min-width:80px;font-weight:${isToday?'700':'500'};color:${isToday?'var(--blue)':'var(--text2)'};background:${isToday?'var(--blue-light)':''}">
        ${dow}<br><span style="font-family:var(--mono)">${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}</span>
      </th>`;
    }).join('');

    const rows = vehs.map(v => {
      const vehRes = _res.filter(r => r.nr_rej === v.nrRej && r.status !== 'rejected');
      const cells = days.map(d => {
        const ds = _isoDate(d);
        const isToday = ds === todayStr;
        const rForDay = vehRes.filter(r => r.start <= ds && r.end >= ds);
        const cellBg = isToday ? 'rgba(59,130,246,.04)' : '';
        if (!rForDay.length) {
          return `<td style="padding:2px 3px;border-left:0.5px solid var(--border);min-width:80px;background:${cellBg};cursor:pointer"
            data-nr="${esc(v.nrRej)}" data-ds="${esc(ds)}" onclick="FleetCalendar.startNew(this.dataset.nr,this.dataset.ds)"
            title="${t('cal.click.reserve').replace('{0}',esc(v.nrRej)).replace('{1}',ds)}">&nbsp;</td>`;
        }
        const r = rForDay[0];
        const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
        const isFirst = r.start === ds;
        return `<td style="padding:2px 3px;border-left:0.5px solid var(--border);background:${sc.bg};border-bottom:2px solid ${sc.border}">
          ${isFirst ? `<div style="font-size:10px;font-weight:600;color:${sc.text};white-space:nowrap;overflow:hidden;max-width:76px;text-overflow:ellipsis" title="${esc(r.user_name)}: ${r.start}–${r.end}${r.notes?'\n'+esc(r.notes):''}"
            data-rid="${esc(String(r.id))}" onclick="FleetCalendar.editRes(this.dataset.rid)">${esc(r.user_name)}</div>
            ${r.notes ? `<div style="font-size:9px;color:var(--text3);white-space:nowrap;overflow:hidden;max-width:76px;text-overflow:ellipsis">${esc(r.notes)}</div>` : ''}` : ''}
        </td>`;
      }).join('');
      return `<tr>
        <td style="padding:6px 10px;font-size:12px;font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--bg2);z-index:1;border-right:1px solid var(--border);cursor:pointer" onclick="TaxOrderVehicleDetail.open(${v.id})" title="Karta pojazdu">
          <div style="font-family:var(--mono);font-size:11px;font-weight:700">${esc(v.nrRej)}</div>
          <div style="font-size:10px;color:var(--text3)">${esc(v.marka)} ${esc(v.model)}</div>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;width:100%;min-width:680px">
          <thead><tr>
            <th style="padding:6px 10px;text-align:left;position:sticky;left:0;background:var(--bg3);z-index:2;font-size:12px;border-right:1px solid var(--border)">${t('cal.col.vehicle')}</th>
            ${dayHeaders}
          </tr></thead>
          <tbody style="border-top:1px solid var(--border)">${rows}</tbody>
        </table>
      </div>`;

    const from = days[0], to = days[6];
    document.getElementById('cal-range').textContent =
      `${from.getDate()}.${String(from.getMonth()+1).padStart(2,'0')} – ${to.getDate()}.${String(to.getMonth()+1).padStart(2,'0')}.${to.getFullYear()}`;
  }

  // ── WIDOK MIESIĘCZNY ──────────────────────────────────────────────────────
  function _renderMonth() {
    const el = document.getElementById('cal-body');
    if (!el) return;
    const todayStr = _isoDate(new Date());

    const days = Array.from({length:28}, (_,i) => _addDays(_anchor, i));
    const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12].map(n => t(`cal.month.${n}`));

    document.getElementById('cal-range').textContent = MONTHS[_anchor.getMonth()] + ' ' + _anchor.getFullYear();

    const DOW = [t('cal.day.mon'),t('cal.day.tue'),t('cal.day.wed'),t('cal.day.thu'),t('cal.day.fri'),t('cal.day.sat'),t('cal.day.sun')];
    const header = DOW.map(d => `<th style="padding:6px;text-align:center;font-size:11px;color:var(--text2)">${d}</th>`).join('');

    const cells = days.map(d => {
      const ds = _isoDate(d);
      const isToday = ds === todayStr;
      const rForDay = _res.filter(r => r.start <= ds && r.end >= ds && r.status !== 'rejected');
      return `<td style="padding:4px;vertical-align:top;border:0.5px solid var(--border);min-width:50px;min-height:60px;background:${isToday?'rgba(59,130,246,.06)':''}">
        <div style="font-size:11px;font-weight:${isToday?'700':'400'};color:${isToday?'var(--blue)':'var(--text2)'};">${d.getDate()}</div>
        ${rForDay.slice(0,3).map(r => {
          const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
          return `<div style="font-size:9px;padding:1px 4px;margin-top:2px;border-radius:3px;background:${sc.bg};border-left:2px solid ${sc.border};cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            data-rid="${esc(String(r.id))}" onclick="FleetCalendar.editRes(this.dataset.rid)" title="${esc(r.nr_rej)}: ${esc(r.user_name)}">${esc(r.nr_rej)} – ${esc(r.user_name)}</div>`;
        }).join('')}
        ${rForDay.length > 3 ? `<div style="font-size:9px;color:var(--text3)">${t('cal.more').replace('{0}',rForDay.length-3)}</div>` : ''}
      </td>`;
    }).join('');

    el.innerHTML = `
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>${header}</tr></thead>
        <tbody>
          <tr>${cells.slice(0,7).join('')}</tr>
          <tr>${cells.slice(7,14).join('')}</tr>
          <tr>${cells.slice(14,21).join('')}</tr>
          <tr>${cells.slice(21,28).join('')}</tr>
        </tbody>
      </table>`;
  }

  // ── Formularz nowej rezerwacji ─────────────────────────────────────────────
  function startNew(nrRej, dateStr) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:460px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-calendar-plus" style="color:var(--blue)"></i>${t('cal.new.title')}
          ${nrRej ? `<span style="font-family:var(--mono);font-size:13px">${esc(nrRej)}</span>` : ''}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">${t('cal.field.vehicle')}</label>
            <select id="_res-nrrej" class="fi">
              ${(window.vehs||[]).filter(v=>v.is_active!==false).map(v=>
                `<option value="${esc(v.nrRej)}" ${v.nrRej===nrRej?'selected':''}>${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">${t('cal.field.driver')}</label>
            <input id="_res-user" type="text" class="fi" list="drivers-datalist" value="${esc(_currentUser())}" placeholder="${t('cal.field.notes.ph')}">
          </div>
          <div class="vdf">
            <label class="vdl">${t('cal.field.from')}</label>
            <input id="_res-start" type="date" class="fi" value="${dateStr || _isoDate(new Date())}">
          </div>
          <div class="vdf">
            <label class="vdl">${t('cal.field.to')}</label>
            <input id="_res-end" type="date" class="fi" value="${dateStr || _isoDate(new Date())}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">${t('cal.field.notes')}</label>
            <input id="_res-notes" type="text" class="fi" placeholder="${t('cal.field.notes.ph')}">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">${t('btn.cancel')}</button>
          <button class="btn btn-blue" onclick="FleetCalendar.saveRes(null,this)">
            <i class="ti ti-check"></i>${t('cal.btn.reserve')}
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('_res-start')?.focus();
  }

  async function saveRes(existingId, btn) {
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const nr_rej = g('_res-nrrej');
    const user_name = g('_res-user');
    const start = g('_res-start');
    const end   = g('_res-end');
    if (!nr_rej || !user_name || !start || !end) { toast(t('cal.toast.required')); return; }
    if (end < start) { toast(t('cal.toast.date.end')); return; }
    const status = g('_res-status') || (_isAdmin() ? 'accepted' : 'pending');
    try {
      const r = await fetch(`${_api()}/api/reservations?company=${_co()}`, {
        method: 'POST', headers: _hdrs(),
        body: JSON.stringify({ nr_rej, user_name, start, end, status, notes: g('_res-notes') || null }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast('⚠ ' + (e.error || r.status)); return;
      }
      btn.closest('[style*=fixed]').remove();
      await _loadApi(); _render(); toast(t('cal.toast.saved'));
    } catch { toast(t('cal.toast.conn')); }
  }

  function editRes(resId) {
    const r = _res.find(x => x.id === resId);
    if (!r) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';
    const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:460px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-calendar" style="color:var(--blue)"></i>${t('cal.edit.title')}
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${sc.bg};color:${sc.text};border:1px solid ${sc.border}">${_statusLabel(r.status)}</span>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:14px">${r.created_at ? new Date(r.created_at.replace(' ','T')+'Z').toLocaleString() : '—'}</div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">${t('cal.col.vehicle')}</label>
            <select id="_res-nrrej" class="fi">
              ${(window.vehs||[]).filter(v=>v.is_active!==false).map(v=>
                `<option value="${esc(v.nrRej)}" ${v.nrRej===r.nr_rej?'selected':''}>${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">${t('cal.field.driver.edit')}</label>
            <input id="_res-user" type="text" class="fi" list="drivers-datalist" value="${esc(r.user_name||'')}">
          </div>
          <div class="vdf">
            <label class="vdl">${t('common.from')}</label>
            <input id="_res-start" type="date" class="fi" value="${r.start}">
          </div>
          <div class="vdf">
            <label class="vdl">${t('common.to')}</label>
            <input id="_res-end" type="date" class="fi" value="${r.end}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">${t('cal.field.notes')}</label>
            <input id="_res-notes" type="text" class="fi" value="${esc(r.notes||'')}">
          </div>
          ${_isAdmin() ? `
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">${t('cal.field.status')}</label>
            <select id="_res-status" class="fi">
              <option value="pending" ${r.status==='pending'?'selected':''}>${t('cal.status.pending')}</option>
              <option value="accepted" ${r.status==='accepted'?'selected':''}>${t('cal.status.accepted')}</option>
              <option value="rejected" ${r.status==='rejected'?'selected':''}>${t('cal.status.rejected')}</option>
            </select>
          </div>` : ''}
        </div>
        <div style="display:flex;gap:8px;justify-content:space-between">
          <button class="btn btn-gray" style="color:var(--red)" data-rid="${esc(String(resId))}" onclick="FleetCalendar.deleteRes(this.dataset.rid,this)">
            <i class="ti ti-trash"></i>${t('btn.delete')}
          </button>
          <div style="display:flex;gap:8px">
            <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">${t('btn.cancel')}</button>
            <button class="btn btn-blue" data-rid="${esc(String(resId))}" onclick="FleetCalendar.updateRes(this.dataset.rid,this)">
              <i class="ti ti-check"></i>${t('btn.save')}
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  async function updateRes(resId, btn) {
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const start = g('_res-start');
    const end   = g('_res-end');
    if (end < start) { toast(t('cal.toast.date.end')); return; }
    const body = {
      nr_rej:    g('_res-nrrej'),
      user_name: g('_res-user'),
      start, end, notes: g('_res-notes') || null,
    };
    const status = g('_res-status');
    if (status) body.status = status;
    try {
      const r = await fetch(`${_api()}/api/reservations/${resId}?company=${_co()}`, {
        method: 'PUT', headers: _hdrs(), body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json().catch(()=>({})); toast('⚠ ' + (e.error || r.status)); return; }
      btn.closest('[style*=fixed]').remove();
      await _loadApi(); _render(); toast(t('cal.toast.updated'));
    } catch { toast(t('cal.toast.conn')); }
  }

  async function deleteRes(resId, btn) {
    if (!confirm(t('cal.confirm.delete'))) return;
    try {
      const r = await fetch(`${_api()}/api/reservations/${resId}?company=${_co()}`, { method: 'DELETE', headers: _hdrs() });
      if (!r.ok) { toast('⚠ ' + r.status); return; }
      btn.closest('[style*=fixed]').remove();
      await _loadApi(); _render(); toast(t('cal.toast.deleted'));
    } catch { toast(t('cal.toast.conn')); }
  }

  return { open, close, prev, next, today, setView, startNew, saveRes, editRes, updateRes, deleteRes };
})();
