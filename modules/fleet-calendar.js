/**
 * TaxOrder Pro — Kalendarz Floty
 * Rezerwacje pojazdów: widok tygodniowy (Gantt) i miesięczny
 * Linia czasu per pojazd, blokowanie nakładających się rezerwacji
 */
window.FleetCalendar = (function () {

  const STORE_KEY = 'taxReservations';
  const STATUS_COLORS = {
    pending:  { bg:'var(--amber-light,#fff8e6)', border:'var(--amber)', text:'var(--amber)' },
    accepted: { bg:'var(--green-light,#ecfdf5)',  border:'var(--green)',  text:'var(--green)' },
    rejected: { bg:'rgba(239,68,68,.08)',          border:'var(--red)',    text:'var(--red)' },
  };
  const STATUS_LABELS = { pending:'⏳ Oczekuje', accepted:'✅ Zatwierdzona', rejected:'❌ Odrzucona' };

  let _view = 'week';   // week | month
  let _anchor = new Date();  // pierwsza data widoku
  _anchor.setHours(0,0,0,0);

  // ── Storage ───────────────────────────────────────────────────────────────
  function _load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }

  function _persist(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _isoDate(d) { return d.toISOString().slice(0,10); }

  function _addDays(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }

  function _overlap(r1, r2) {
    return r1.start <= r2.end && r2.start <= r1.end;
  }

  function _hasConflict(newRes, exclude) {
    return _load().some(r =>
      r.id !== exclude &&
      r.vehId === newRes.vehId &&
      r.status !== 'rejected' &&
      _overlap({start:r.start, end:r.end}, {start:newRes.start, end:newRes.end})
    );
  }

  function _currentUser() {
    try {
      const d = JSON.parse(localStorage.getItem('taxUserProfile')||localStorage.getItem('cf_user')||'{}');
      return d.name || d.email || d.login || 'Użytkownik';
    } catch { return 'Użytkownik'; }
  }

  function _isAdmin() {
    try {
      const role = localStorage.getItem('taxUserRole') || '';
      return ['admin','manager','Admin','Kierownik'].includes(role) || true;
    } catch { return true; }
  }

  // ── Open / Close / Navigate ───────────────────────────────────────────────
  function open() {
    document.getElementById('fleet-cal-modal').style.display = 'flex';
    // Ustaw anchor na poniedzialek bieżącego tygodnia
    _anchor = new Date(); _anchor.setHours(0,0,0,0);
    const dow = _anchor.getDay(); // 0=sun
    _anchor.setDate(_anchor.getDate() - (dow === 0 ? 6 : dow - 1));
    _render();
  }

  function close() {
    document.getElementById('fleet-cal-modal').style.display = 'none';
  }

  function prev() {
    _anchor = _addDays(_anchor, _view === 'week' ? -7 : -28);
    _render();
  }

  function next() {
    _anchor = _addDays(_anchor, _view === 'week' ? 7 : 28);
    _render();
  }

  function today() {
    _anchor = new Date(); _anchor.setHours(0,0,0,0);
    const dow = _anchor.getDay();
    _anchor = _addDays(_anchor, -(dow === 0 ? 6 : dow - 1));
    _render();
  }

  function setView(v) { _view = v; _render(); }

  // ── Main render ───────────────────────────────────────────────────────────
  function _render() {
    if (_view === 'week') _renderWeek();
    else _renderMonth();
    _renderLegend();
  }

  function _renderLegend() {
    const el = document.getElementById('cal-legend');
    if (!el) return;
    el.innerHTML = Object.entries(STATUS_LABELS).map(([k,l]) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:10px;background:${STATUS_COLORS[k].bg};border:1px solid ${STATUS_COLORS[k].border};color:${STATUS_COLORS[k].text}">${l}</span>`
    ).join('');
  }

  // ── WIDOK TYGODNIOWY (Gantt) ──────────────────────────────────────────────
  function _renderWeek() {
    const el = document.getElementById('cal-body');
    if (!el) return;
    const vehs = (window.vehs || []).filter(v => v.is_active !== false);
    if (!vehs.length) { el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text3)">Brak aktywnych pojazdów w bazie.</div>'; return; }

    const days = Array.from({length:7}, (_,i) => _addDays(_anchor, i));
    const reservations = _load();
    const todayStr = _isoDate(new Date());

    // Nagłówek: daty
    const dayHeaders = days.map(d => {
      const ds = _isoDate(d);
      const isToday = ds === todayStr;
      const dow = ['Pn','Wt','Śr','Cz','Pt','So','Nd'][d.getDay() === 0 ? 6 : d.getDay()-1];
      return `<th style="padding:6px 4px;text-align:center;font-size:11px;white-space:nowrap;min-width:80px;font-weight:${isToday?'700':'500'};color:${isToday?'var(--blue)':'var(--text2)'};background:${isToday?'var(--blue-light)':''}">
        ${dow}<br><span style="font-family:var(--mono)">${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}</span>
      </th>`;
    }).join('');

    // Wiersze pojazdów
    const rows = vehs.map(v => {
      const vehResrv = reservations.filter(r => r.vehId === v.id && r.status !== 'rejected');
      const cells = days.map(d => {
        const ds = _isoDate(d);
        const isToday = ds === todayStr;
        // Sprawdź rezerwacje tego dnia
        const rForDay = vehResrv.filter(r => r.start <= ds && r.end >= ds);
        const cellBg = isToday ? 'rgba(59,130,246,.04)' : '';
        if (!rForDay.length) {
          return `<td style="padding:2px 3px;border-left:0.5px solid var(--border);min-width:80px;background:${cellBg};cursor:pointer"
            onclick="FleetCalendar.startNew(${v.id},'${ds}')"
            title="Kliknij aby zarezerwować ${v.nrRej} na ${ds}">&nbsp;</td>`;
        }
        const r = rForDay[0];
        const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
        const isFirst = r.start === ds;
        return `<td style="padding:2px 3px;border-left:0.5px solid var(--border);background:${sc.bg};border-bottom:2px solid ${sc.border}">
          ${isFirst ? `<div style="font-size:10px;font-weight:600;color:${sc.text};white-space:nowrap;overflow:hidden;max-width:76px;text-overflow:ellipsis" title="${r.user}: ${r.start}–${r.end}${r.notes?'\n'+r.notes:''}"
            onclick="FleetCalendar.editRes('${r.id}')">${r.user}</div>
            ${r.notes ? `<div style="font-size:9px;color:var(--text3);white-space:nowrap;overflow:hidden;max-width:76px;text-overflow:ellipsis">${r.notes}</div>` : ''}` : ''}
        </td>`;
      }).join('');
      return `<tr>
        <td style="padding:6px 10px;font-size:12px;font-weight:500;white-space:nowrap;position:sticky;left:0;background:var(--bg2);z-index:1;border-right:1px solid var(--border);cursor:pointer" onclick="TaxOrderVehicleDetail.open(${v.id})" title="Karta pojazdu">
          <div style="font-family:var(--mono);font-size:11px;font-weight:700">${v.nrRej}</div>
          <div style="font-size:10px;color:var(--text3)">${v.marka} ${v.model}</div>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;width:100%;min-width:680px">
          <thead><tr>
            <th style="padding:6px 10px;text-align:left;position:sticky;left:0;background:var(--bg3);z-index:2;font-size:12px;border-right:1px solid var(--border)">Pojazd</th>
            ${dayHeaders}
          </tr></thead>
          <tbody style="border-top:1px solid var(--border)">${rows}</tbody>
        </table>
      </div>`;

    // Aktualizuj nagłówek
    const from = days[0], to = days[6];
    document.getElementById('cal-range').textContent =
      `${from.getDate()}.${String(from.getMonth()+1).padStart(2,'0')} – ${to.getDate()}.${String(to.getMonth()+1).padStart(2,'0')}.${to.getFullYear()}`;
  }

  // ── WIDOK MIESIĘCZNY ──────────────────────────────────────────────────────
  function _renderMonth() {
    const el = document.getElementById('cal-body');
    if (!el) return;
    const reservations = _load();
    const todayStr = _isoDate(new Date());

    // 4 tygodnie od anchor
    const days = Array.from({length:28}, (_,i) => _addDays(_anchor, i));
    const MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

    document.getElementById('cal-range').textContent = MONTHS[_anchor.getMonth()] + ' ' + _anchor.getFullYear();

    const DOW = ['Pn','Wt','Śr','Cz','Pt','So','Nd'];
    const header = DOW.map(d => `<th style="padding:6px;text-align:center;font-size:11px;color:var(--text2)">${d}</th>`).join('');

    const cells = days.map((d, i) => {
      const ds = _isoDate(d);
      const isToday = ds === todayStr;
      const rForDay = reservations.filter(r => r.start <= ds && r.end >= ds && r.status !== 'rejected');
      return `<td style="padding:4px;vertical-align:top;border:0.5px solid var(--border);min-width:50px;min-height:60px;background:${isToday?'rgba(59,130,246,.06)':''}">
        <div style="font-size:11px;font-weight:${isToday?'700':'400'};color:${isToday?'var(--blue)':'var(--text2)'};">${d.getDate()}</div>
        ${rForDay.slice(0,3).map(r => {
          const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
          const veh = (window.vehs||[]).find(v=>v.id===r.vehId);
          return `<div style="font-size:9px;padding:1px 4px;margin-top:2px;border-radius:3px;background:${sc.bg};border-left:2px solid ${sc.border};cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            onclick="FleetCalendar.editRes('${r.id}')" title="${veh?.nrRej||''}: ${r.user}">${veh?.nrRej||'?'} – ${r.user}</div>`;
        }).join('')}
        ${rForDay.length > 3 ? `<div style="font-size:9px;color:var(--text3)">+${rForDay.length-3} więcej</div>` : ''}
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

  // ── Nowa rezerwacja ───────────────────────────────────────────────────────
  function startNew(vehId, dateStr) {
    const v = (window.vehs||[]).find(x=>x.id===vehId);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:460px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-calendar-plus" style="color:var(--blue)"></i>Nowa rezerwacja
          ${v ? `<span style="font-family:var(--mono);font-size:13px">${v.nrRej}</span>` : ''}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Pojazd *</label>
            <select id="_res-veh" class="fi">
              ${(window.vehs||[]).filter(v=>v.is_active!==false).map(v=>
                `<option value="${v.id}" ${v.id===vehId?'selected':''}>${v.nrRej} — ${v.marka} ${v.model}</option>`
              ).join('')}
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Kierowca / Cel *</label>
            <input id="_res-user" type="text" class="fi" list="drivers-datalist" value="${_currentUser()}" placeholder="Imię, nazwisko lub cel...">
          </div>
          <div class="vdf">
            <label class="vdl">Od *</label>
            <input id="_res-start" type="date" class="fi" value="${dateStr || _isoDate(new Date())}">
          </div>
          <div class="vdf">
            <label class="vdl">Do *</label>
            <input id="_res-end" type="date" class="fi" value="${dateStr || _isoDate(new Date())}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Cel / Uwagi</label>
            <input id="_res-notes" type="text" class="fi" placeholder="np. delegacja, serwis, wynajem...">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-blue" onclick="FleetCalendar.saveRes(null,this)">
            <i class="ti ti-check"></i>Zarezerwuj
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('_res-start')?.focus();
  }

  function saveRes(existingId, btn) {
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const vehId = parseInt(g('_res-veh'));
    const user  = g('_res-user');
    const start = g('_res-start');
    const end   = g('_res-end');
    if (!vehId || !user || !start || !end) { toast('⚠ Wypełnij wszystkie wymagane pola'); return; }
    if (end < start) { toast('⚠ Data końca musi być >= data początku'); return; }

    const list = _load();
    const id = existingId || String(Date.now());

    if (_hasConflict({vehId, start, end}, existingId)) {
      toast('⚠ Ten pojazd jest już zarezerwowany w tym terminie'); return;
    }

    if (existingId) {
      const idx = list.findIndex(r=>r.id===existingId);
      if (idx>=0) list[idx] = { ...list[idx], vehId, user, start, end, notes: g('_res-notes') };
    } else {
      list.push({ id, vehId, user, start, end, notes: g('_res-notes'), status: _isAdmin() ? 'accepted' : 'pending', createdAt: new Date().toISOString() });
    }
    _persist(list);
    btn.closest('[style*=fixed]').remove();
    toast('✓ Rezerwacja zapisana');
    _render();
  }

  function editRes(resId) {
    const list = _load();
    const r = list.find(x=>x.id===resId);
    if (!r) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';
    const sc = STATUS_COLORS[r.status]||STATUS_COLORS.pending;
    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:460px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-calendar" style="color:var(--blue)"></i>Rezerwacja
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${sc.bg};color:${sc.text};border:1px solid ${sc.border}">${STATUS_LABELS[r.status]||r.status}</span>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:14px">Dodana: ${new Date(r.createdAt||Date.now()).toLocaleString('pl-PL')}</div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Pojazd</label>
            <select id="_res-veh" class="fi">
              ${(window.vehs||[]).filter(v=>v.is_active!==false).map(v=>
                `<option value="${v.id}" ${v.id===r.vehId?'selected':''}>${v.nrRej} — ${v.marka} ${v.model}</option>`
              ).join('')}
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Kierowca / Cel</label>
            <input id="_res-user" type="text" class="fi" list="drivers-datalist" value="${r.user}">
          </div>
          <div class="vdf">
            <label class="vdl">Od</label>
            <input id="_res-start" type="date" class="fi" value="${r.start}">
          </div>
          <div class="vdf">
            <label class="vdl">Do</label>
            <input id="_res-end" type="date" class="fi" value="${r.end}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Uwagi</label>
            <input id="_res-notes" type="text" class="fi" value="${r.notes||''}">
          </div>
          ${_isAdmin() ? `
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Status (admin)</label>
            <select id="_res-status" class="fi">
              <option value="pending" ${r.status==='pending'?'selected':''}>⏳ Oczekuje</option>
              <option value="accepted" ${r.status==='accepted'?'selected':''}>✅ Zatwierdzona</option>
              <option value="rejected" ${r.status==='rejected'?'selected':''}>❌ Odrzucona</option>
            </select>
          </div>` : ''}
        </div>
        <div style="display:flex;gap:8px;justify-content:space-between">
          <button class="btn btn-gray" style="color:var(--red)" onclick="FleetCalendar.deleteRes('${resId}',this)">
            <i class="ti ti-trash"></i>Usuń
          </button>
          <div style="display:flex;gap:8px">
            <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
            <button class="btn btn-blue" onclick="FleetCalendar.updateRes('${resId}',this)">
              <i class="ti ti-check"></i>Zapisz
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  function updateRes(resId, btn) {
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const list = _load();
    const idx = list.findIndex(r=>r.id===resId);
    if (idx<0) return;
    const vehId = parseInt(g('_res-veh'));
    const start = g('_res-start');
    const end   = g('_res-end');
    if (end < start) { toast('⚠ Data końca musi być >= data początku'); return; }
    if (_hasConflict({vehId, start, end}, resId)) { toast('⚠ Termin nakłada się z inną rezerwacją'); return; }
    list[idx] = { ...list[idx], vehId, user: g('_res-user'), start, end, notes: g('_res-notes'), status: g('_res-status')||list[idx].status };
    _persist(list); btn.closest('[style*=fixed]').remove(); toast('✓ Rezerwacja zaktualizowana'); _render();
  }

  function deleteRes(resId, btn) {
    if (!confirm('Usunąć rezerwację?')) return;
    const list = _load().filter(r=>r.id!==resId);
    _persist(list); btn.closest('[style*=fixed]').remove(); toast('Rezerwacja usunięta'); _render();
  }

  return { open, close, prev, next, today, setView, startNew, saveRes, editRes, updateRes, deleteRes };
})();
