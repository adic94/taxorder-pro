(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtD = d => d ? new Date(`${d  }T00:00:00`).toLocaleDateString('pl-PL') : '—';

  let _reservations = [];
  let _curMonth = new Date().toISOString().slice(0, 7);

  // UWAGA: wartości muszą pasować do CHECK w tabeli `reservations` (schema_v13, potwierdzone
  // w produkcyjnym D1): CHECK(status IN ('pending','accepted','rejected')). schema_v40
  // redefiniował tę tabelę bez CHECK i z DEFAULT 'confirmed', ale przez CREATE TABLE IF NOT
  // EXISTS był cichym no-opem — w bazie stoi v13. Zapis 'confirmed' = naruszenie CHECK.
  const STATUS_LBL   = { pending: 'Oczekuje', accepted: 'Potwierdzone', rejected: 'Odrzucone' };
  const STATUS_COLOR = { pending: 'var(--orange)', accepted: 'var(--green)', rejected: 'var(--red)' };

  async function renderFleetReservations() {
    const co = Co();
    const [year, month] = _curMonth.split('-').map(Number);
    const from = `${_curMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${_curMonth}-${String(lastDay).padStart(2, '0')}`;
    try {
      const r = await fetch(`${API()}/api/reservations?company=${encodeURIComponent(co)}&from=${from}&to=${to}`, { headers: H() });
      if (r.ok) { const d = await r.json(); _reservations = d.reservations || []; }
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-fleet-reservations');
    if (!el) return;
    const vehs = (window.vehs || []).map(v => v.nrRej || v.nr_rej).filter(Boolean);
    const [year, month] = _curMonth.split('-').map(Number);
    const monthLabel = new Date(year, month - 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-calendar-event"></i> Rezerwacje pojazdów</h2>
  <button class="btn-primary" onclick="window.FleetReservationsModule.openModal()"><i class="ti ti-plus"></i> Nowa rezerwacja</button>
</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
  <button class="btn-icon" onclick="window.FleetReservationsModule.prevMonth()"><i class="ti ti-chevron-left"></i></button>
  <strong style="min-width:140px;text-align:center">${e(monthLabel)}</strong>
  <button class="btn-icon" onclick="window.FleetReservationsModule.nextMonth()"><i class="ti ti-chevron-right"></i></button>
  <button class="btn-secondary" onclick="window.FleetReservationsModule.goToday()">Dziś</button>
</div>
${_reservations.length === 0 ? `
<div style="padding:40px;text-align:center;color:var(--text3)">
  <i class="ti ti-calendar-off" style="font-size:48px;display:block;margin-bottom:12px"></i>
  Brak rezerwacji w tym miesiącu — kliknij "Nowa rezerwacja"
</div>` : `
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Pojazd</th><th>Kierowca / rezerwujący</th><th>Od</th><th>Do</th><th>Status</th><th>Uwagi</th><th></th></tr></thead>
<tbody>
${_reservations.map(r => `<tr>
  <td><strong>${e(r.nr_rej)}</strong></td>
  <td>${e(r.user_name || '—')}</td>
  <td>${e(fmtD(r.start))}</td>
  <td>${e(fmtD(r.end))}</td>
  <td><span style="color:${STATUS_COLOR[r.status] || 'var(--text)'};font-weight:600">${e(STATUS_LBL[r.status] || r.status)}</span></td>
  <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e(r.notes || '')}">${e(r.notes || '—')}</td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon" data-id="${e(r.id)}" onclick="window.FleetReservationsModule.openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(r.id)}" onclick="window.FleetReservationsModule.deleteRes(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('')}
</tbody></table></div>`}

<div id="fleet-res-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9100;align-items:center;justify-content:center">
  <div style="background:var(--bg-card);border-radius:var(--radius-lg);width:500px;max-width:96vw;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.25)">
    <div style="display:flex;align-items:center;margin-bottom:16px">
      <strong style="font-size:15px;flex:1">Rezerwacja pojazdu</strong>
      <button onclick="window.FleetReservationsModule.closeModal()" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--text2)">✕</button>
    </div>
    <input type="hidden" id="res-id">
    <div class="f" style="margin-bottom:10px">
      <label>Pojazd (nr rej.)</label>
      <select id="res-nrrej" class="form-input">
        <option value="">-- wybierz --</option>
        ${vehs.map(v => `<option value="${e(v)}">${e(v)}</option>`).join('')}
      </select>
    </div>
    <div class="f" style="margin-bottom:10px">
      <label>Kierowca / rezerwujący</label>
      <input id="res-user" class="form-input" placeholder="Imię i nazwisko">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="f"><label>Od (data)</label><input type="date" id="res-start" class="form-input"></div>
      <div class="f"><label>Do (data)</label><input type="date" id="res-end" class="form-input"></div>
    </div>
    <div class="f" style="margin-bottom:10px">
      <label>Status</label>
      <select id="res-status" class="form-input">
        <option value="pending">Oczekuje</option>
        <option value="accepted">Potwierdzone</option>
        <option value="rejected">Odrzucone</option>
      </select>
    </div>
    <div class="f" style="margin-bottom:16px">
      <label>Uwagi / cel wyjazdu</label>
      <textarea id="res-notes" class="form-input" rows="3" placeholder="Cel wyjazdu, trasa, dodatkowe informacje..."></textarea>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn-secondary" onclick="window.FleetReservationsModule.closeModal()">Anuluj</button>
      <button class="btn-primary" onclick="window.FleetReservationsModule.save()"><i class="ti ti-check"></i> Zapisz</button>
    </div>
  </div>
</div>`;
  }

  function openModal(resId) {
    const modal = document.getElementById('fleet-res-modal');
    if (!modal) return;
    const r = resId ? _reservations.find(x => x.id === resId) : null;
    document.getElementById('res-id').value       = r?.id || '';
    document.getElementById('res-nrrej').value    = r?.nr_rej || '';
    document.getElementById('res-user').value     = r?.user_name || '';
    document.getElementById('res-start').value    = r?.start || `${_curMonth  }-01`;
    document.getElementById('res-end').value      = r?.end   || `${_curMonth  }-01`;
    document.getElementById('res-status').value   = r?.status || 'pending';
    document.getElementById('res-notes').value    = r?.notes || '';
    modal.style.display = 'flex';
  }

  function closeModal() {
    const m = document.getElementById('fleet-res-modal');
    if (m) m.style.display = 'none';
  }

  async function save() {
    const id        = document.getElementById('res-id').value;
    const nr_rej    = document.getElementById('res-nrrej').value;
    const user_name = document.getElementById('res-user').value.trim();
    const start     = document.getElementById('res-start').value;
    const end       = document.getElementById('res-end').value;
    const status    = document.getElementById('res-status').value;
    const notes     = document.getElementById('res-notes').value.trim();
    if (!nr_rej) { alert('Wybierz pojazd'); return; }
    if (!start || !end) { alert('Podaj daty od/do'); return; }
    if (start > end) { alert('Data "Do" musi być >= "Od"'); return; }
    const body = { nr_rej, user_name, start, end, status, notes };
    if (id) body.id = id;
    try {
      const url = `${API()}/api/reservations${id ? `/${  encodeURIComponent(id)}` : ''}?company=${encodeURIComponent(Co())}`;
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || r.statusText);
      closeModal();
      await renderFleetReservations();
    } catch (ex) { alert(`Błąd: ${  ex.message}`); }
  }

  async function deleteRes(resId) {
    if (!confirm('Usunąć rezerwację?')) return;
    try {
      await fetch(`${API()}/api/reservations/${encodeURIComponent(resId)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderFleetReservations();
    } catch (ex) { alert(`Błąd: ${  ex.message}`); }
  }

  function prevMonth() {
    const [y, m] = _curMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    _curMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    renderFleetReservations();
  }

  function nextMonth() {
    const [y, m] = _curMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    _curMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    renderFleetReservations();
  }

  function goToday() {
    _curMonth = new Date().toISOString().slice(0, 7);
    renderFleetReservations();
  }

  window.FleetReservationsModule = { renderFleetReservations, openModal, closeModal, save, deleteRes, prevMonth, nextMonth, goToday };
})();
