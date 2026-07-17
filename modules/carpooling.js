(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';

  const STATUS_CLR   = { open: '#22c55e', full: '#f59e0b', completed: '#3b82f6', cancelled: '#94a3b8' };
  const STATUS_LABEL = { open: 'Otwarty', full: 'Komplet', completed: 'Zakończony', cancelled: 'Anulowany' };

  async function api(path, opts = {}) {
    const r = await fetch(`${API()}/api/carpooling${path}?company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderCarpooling() {
    const el = document.getElementById('page-carpooling');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-users"></i> Carpooling — Wspólne Przejazdy</h2>
        <button class="btn btn-primary" onclick="window.CarpoolingModule._openModal()"><i class="ti ti-plus"></i> Nowy przejazd</button>
      </div>
      <p style="color:var(--text-muted);margin-bottom:12px">Organizuj wspólne przejazdy pracowników, redukuj koszty i emisję CO₂.</p>
      <div id="cp-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="cp-filter-date" type="date" class="form-control" style="width:160px" onchange="window.CarpoolingModule._load()">
        <select id="cp-filter-status" class="form-control" style="width:150px" onchange="window.CarpoolingModule._load()">
          <option value="">Wszystkie</option>
          ${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="cp-search" class="form-control" style="width:200px" placeholder="Kierowca / trasa..." oninput="window.CarpoolingModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Data</th><th>Kierowca</th><th>Pojazd</th><th>Trasa</th><th>Godz. odjazdu</th><th>Wolne miejsca</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="cp-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="cp-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.CarpoolingModule._closeModal()">
        <div class="modal-box" style="max-width:600px">
          <div class="modal-header"><h3 id="cp-modal-title">Przejazd carpooling</h3><button class="modal-close" onclick="window.CarpoolingModule._closeModal()">×</button></div>
          <div class="modal-body" id="cp-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const date   = document.getElementById('cp-filter-date')?.value || '';
    const status = document.getElementById('cp-filter-status')?.value || '';
    const q      = document.getElementById('cp-search')?.value || '';
    const tbody  = document.getElementById('cp-tbody');
    if (!tbody) return;
    const data = await api(`?date=${date}&status=${status}&q=${encodeURIComponent(q)}`);
    const list = data.trips || [];
    _renderStats(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak przejazdów</td></tr>'; return; }
    tbody.innerHTML = list.map(t => {
      const parts = _safeJson(t.participants, []);
      const seatsLeft = (t.available_seats || 0) - parts.length;
      return `<tr>
        <td>${esc(t.trip_date?.slice(0,10)||'—')}</td>
        <td>${esc(t.driver_name||'—')}</td>
        <td>${esc(t.vehicle_reg||'—')}</td>
        <td>${esc(t.origin||'—')} → ${esc(t.destination||'—')}</td>
        <td>${esc(t.departure_time||'—')}</td>
        <td>
          <span style="color:${seatsLeft>0?'#22c55e':'#ef4444'}">${seatsLeft} / ${t.available_seats || 0}</span>
          ${parts.length ? `<span style="font-size:.75em;color:#666;margin-left:4px">(${parts.map(p=>esc(p.name||'')).join(', ')})</span>` : ''}
        </td>
        <td><span class="pill" style="background:${STATUS_CLR[t.status]||'#999'}20;color:${STATUS_CLR[t.status]||'#999'}">${esc(STATUS_LABEL[t.status]||t.status)}</span></td>
        <td>
          ${t.status === 'open' ? `<button class="btn-icon" title="Dołącz pasażera" data-id="${esc(t.id)}" onclick="window.CarpoolingModule._addParticipant(this.dataset.id)"><i class="ti ti-user-plus"></i></button>` : ''}
          <button class="btn-icon" title="Edytuj" data-id="${esc(t.id)}" onclick="window.CarpoolingModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(t.id)}" onclick="window.CarpoolingModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('cp-stats');
    if (!el) return;
    el.innerHTML = [
      { lbl: 'Otwarte przejazdy', val: s.open || 0, c: '#22c55e' },
      { lbl: 'W tym tygodniu', val: s.this_week || 0, c: '#3b82f6' },
      { lbl: 'Oszcz. CO₂ (est.)', val: s.co2_saved ? s.co2_saved.toFixed(1) + ' kg' : '—', c: '#16a34a' },
    ].map(i => `<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.2em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('cp-modal');
    const body  = document.getElementById('cp-modal-body');
    const title = document.getElementById('cp-modal-title');
    let t = {};
    if (id) { const d = await api(`/${id}`); t = d.trip || {}; }
    const parts = _safeJson(t.participants, []);
    title.textContent = id ? 'Edytuj przejazd' : 'Nowy przejazd carpooling';
    body.innerHTML = `
      <form id="cp-form" data-id="${esc(id||'')}" onsubmit="window.CarpoolingModule._save(event,this.dataset.id)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Kierowca *</label><input name="driver_name" class="form-control" required value="${esc(t.driver_name||'')}"></div>
          <div class="form-row"><label>Nr rejestracyjny</label><input name="vehicle_reg" class="form-control" value="${esc(t.vehicle_reg||'')}"></div>
          <div class="form-row"><label>Data przejazdu *</label><input name="trip_date" type="date" class="form-control" required value="${esc(t.trip_date?.slice(0,10)||'')}"></div>
          <div class="form-row"><label>Godzina odjazdu</label><input name="departure_time" type="time" class="form-control" value="${esc(t.departure_time||'')}"></div>
          <div class="form-row"><label>Skąd</label><input name="origin" class="form-control" value="${esc(t.origin||'')}"></div>
          <div class="form-row"><label>Dokąd</label><input name="destination" class="form-control" value="${esc(t.destination||'')}"></div>
          <div class="form-row"><label>Wolne miejsca</label><input name="available_seats" type="number" min="1" max="8" class="form-control" value="${t.available_seats??3}"></div>
          <div class="form-row"><label>Dystans (km)</label><input name="distance_km" type="number" step="0.1" class="form-control" value="${t.distance_km??''}"></div>
          <div class="form-row"><label>Koszt (PLN)</label><input name="cost_pln" type="number" step="0.01" class="form-control" value="${t.cost_pln??''}"></div>
          <div class="form-row"><label>Status</label>
            <select name="status" class="form-control">
              ${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}" ${t.status===v?'selected':''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(t.notes||'')}</textarea></div>
        </div>
        ${parts.length ? `<h4 style="margin:12px 0 6px">Pasażerowie (${parts.length})</h4>
        <ul style="margin:0;padding-left:18px">${parts.map(p=>`<li>${esc(p.name||'?')} — ${esc(p.department||'')} ${p.pickup_point?`(${esc(p.pickup_point)})`:''}</li>`).join('')}</ul>` : ''}
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.CarpoolingModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    await api(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _addParticipant(tripId) {
    const name    = prompt('Imię i nazwisko pasażera:');
    if (!name) return;
    const dept    = prompt('Dział:') || '';
    const pickup  = prompt('Miejsce wsiadania:') || '';
    await api(`/${tripId}/participants`, { method: 'POST', body: JSON.stringify({ name, department: dept, pickup_point: pickup }) });
    _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć przejazd carpooling?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('cp-modal');
    if (m) m.style.display = 'none';
  }

  function _safeJson(val, def) {
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return def; }
  }

  window.CarpoolingModule = { renderCarpooling, _load, _openModal, _save, _addParticipant, _delete, _closeModal };
})();
