(function () {
  'use strict';

  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  const TYPE_ICON  = { standard: '🅿️', ev: '⚡', bus: '🚌', disabled: '♿', reserved: '🔒' };
  const TYPE_LABEL = { standard: 'Standardowe', ev: 'Ładowarka EV', bus: 'Dla busów', disabled: 'Niepełnosprawni', reserved: 'Zarezerwowane' };

  async function api(path, opts = {}) {
    const r = await fetch(`${API()}/api/parking${path}${path.includes('?')?'&':'?'}company=${co()}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
      ...opts,
    });
    return r.json();
  }

  function renderParking() {
    const el = document.getElementById('page-parking');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-parking"></i> Miejsca Parkingowe</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" onclick="window.ParkingModule._setView('grid')"><i class="ti ti-grid-dots"></i> Siatka</button>
          <button class="btn btn-outline" onclick="window.ParkingModule._setView('table')"><i class="ti ti-list"></i> Lista</button>
          <button class="btn btn-primary" onclick="window.ParkingModule._openModal()"><i class="ti ti-plus"></i> Dodaj miejsce</button>
        </div>
      </div>
      <div id="parking-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div id="parking-content">Ładowanie...</div>
      <div id="parking-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.ParkingModule._closeModal()">
        <div class="modal-box" style="max-width:500px">
          <div class="modal-header"><h3 id="parking-modal-title">Miejsce parkingowe</h3><button class="modal-close" onclick="window.ParkingModule._closeModal()">×</button></div>
          <div class="modal-body" id="parking-modal-body"></div>
        </div>
      </div>`;
    _currentView = 'grid';
    _load();
  }

  let _currentView = 'grid';

  function _setView(v) { _currentView = v; _load(); }

  async function _load() {
    const data  = await api('');
    const spots = data.spots || [];
    _renderStats(spots);
    if (_currentView === 'grid') _renderGrid(spots);
    else _renderTable(spots);
  }

  function _renderStats(spots) {
    const el = document.getElementById('parking-stats');
    if (!el) return;
    const total  = spots.length;
    const free   = spots.filter(s => !s.assigned_vehicle_reg && s.active).length;
    const taken  = spots.filter(s => s.assigned_vehicle_reg && s.active).length;
    const evSpots = spots.filter(s => s.spot_type === 'ev').length;
    el.innerHTML = [
      { lbl: 'Razem', val: total, c: '#64748b' },
      { lbl: 'Wolne', val: free, c: '#22c55e' },
      { lbl: 'Zajęte', val: taken, c: '#ef4444' },
      { lbl: 'Ładowarki EV', val: evSpots, c: '#3b82f6' },
    ].map(i => `<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.3em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  function _renderGrid(spots) {
    const el = document.getElementById('parking-content');
    if (!el) return;
    if (!spots.length) { el.innerHTML = '<div class="empty-row">Brak miejsc parkingowych</div>'; return; }
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
      ${spots.map(s => {
        const taken = !!s.assigned_vehicle_reg;
        const bg    = !s.active ? '#f1f5f9' : taken ? '#fef2f2' : '#f0fdf4';
        const border= !s.active ? '#94a3b8' : taken ? '#ef4444' : '#22c55e';
        return `<div style="background:${bg};border:2px solid ${border};border-radius:8px;padding:10px;cursor:pointer;text-align:center" onclick="window.ParkingModule._openModal('${esc(s.id)}')">
          <div style="font-size:1.8em">${TYPE_ICON[s.spot_type] || '🅿️'}</div>
          <div style="font-weight:700;font-size:1.1em">${esc(s.spot_number)}</div>
          <div style="font-size:0.75em;color:#666">${esc(TYPE_LABEL[s.spot_type] || s.spot_type || '')}</div>
          ${taken ? `<div style="font-size:0.8em;font-weight:600;color:#ef4444;margin-top:4px">${esc(s.assigned_vehicle_reg)}</div>` : '<div style="font-size:0.8em;color:#22c55e;margin-top:4px">Wolne</div>'}
          ${s.location ? `<div style="font-size:0.7em;color:#888">${esc(s.location)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  function _renderTable(spots) {
    const el = document.getElementById('parking-content');
    if (!el) return;
    el.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Nr miejsca</th><th>Lokalizacja</th><th>Typ</th><th>Pojazd</th><th>Od kiedy</th><th>Aktywne</th><th>Akcje</th></tr></thead>
      <tbody>${spots.length ? spots.map(s => `<tr>
        <td><strong>${esc(s.spot_number)}</strong></td>
        <td>${esc(s.location||'—')}</td>
        <td>${TYPE_ICON[s.spot_type]||''} ${esc(TYPE_LABEL[s.spot_type]||s.spot_type||'—')}</td>
        <td>${s.assigned_vehicle_reg ? esc(s.assigned_vehicle_reg) : '<span style="color:#22c55e">Wolne</span>'}</td>
        <td>${s.assigned_from ? esc(s.assigned_from.slice(0,10)) : '—'}</td>
        <td>${s.active ? '✅' : '⛔'}</td>
        <td>
          <button class="btn-icon" title="Edytuj/Przypisz" data-id="${esc(s.id)}" onclick="window.ParkingModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          ${s.assigned_vehicle_reg ? `<button class="btn-icon" title="Zwolnij" data-id="${esc(s.id)}" onclick="window.ParkingModule._release(this.dataset.id)"><i class="ti ti-lock-open"></i></button>` : ''}
          <button class="btn-icon danger" title="Usuń" data-id="${esc(s.id)}" onclick="window.ParkingModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty-row">Brak miejsc</td></tr>'}</tbody>
    </table></div>`;
  }

  async function _openModal(id) {
    const modal = document.getElementById('parking-modal');
    const body  = document.getElementById('parking-modal-body');
    const title = document.getElementById('parking-modal-title');
    let s = {};
    if (id) { const d = await api(`/${id}`); s = d.spot || {}; }
    title.textContent = id ? 'Edytuj miejsce parkingowe' : 'Nowe miejsce parkingowe';
    body.innerHTML = `
      <form id="parking-form" onsubmit="window.ParkingModule._save(event,'${esc(id||'')}')">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Nr miejsca *</label><input name="spot_number" class="form-control" required value="${esc(s.spot_number||'')}"></div>
          <div class="form-row"><label>Typ</label>
            <select name="spot_type" class="form-control">
              ${Object.entries(TYPE_LABEL).map(([v,l])=>`<option value="${v}" ${s.spot_type===v?'selected':''}>${TYPE_ICON[v]} ${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Lokalizacja / opis</label><input name="location" class="form-control" value="${esc(s.location||'')}"></div>
          <div class="form-row"><label>Przypisany pojazd (nr rej.)</label><input name="assigned_vehicle_reg" class="form-control" value="${esc(s.assigned_vehicle_reg||'')}"></div>
          <div class="form-row"><label>Przypisany od</label><input name="assigned_from" type="date" class="form-control" value="${esc(s.assigned_from?.slice(0,10)||'')}"></div>
          <div class="form-row"><label>Aktywne</label>
            <select name="active" class="form-control">
              <option value="1" ${s.active!==0?'selected':''}>Tak</option>
              <option value="0" ${s.active===0?'selected':''}>Nie (nieaktywne)</option>
            </select>
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(s.notes||'')}</textarea></div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.ParkingModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    await api(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _release(id) {
    if (!confirm('Zwolnić miejsce parkingowe?')) return;
    await api(`/${id}/release`, { method: 'POST', body: JSON.stringify({}) });
    _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć miejsce parkingowe?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('parking-modal');
    if (m) m.style.display = 'none';
  }

  window.ParkingModule = { renderParking, _setView, _load, _openModal, _save, _release, _delete, _closeModal };
})();


