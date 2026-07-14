(function () {
  'use strict';

  const API = window.WORKER_URL || '';
  const co  = () => localStorage.getItem('currentCompany') || '';

  const PERIOD_LABEL = { daily: 'Dzienny', weekly: 'Tygodniowy', monthly: 'Miesięczny', annual: 'Roczny' };

  async function api(path, opts = {}) {
    const r = await fetch(`${API}/api/fleet-limits${path}?company=${co()}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      ...opts,
    });
    return r.json();
  }

  function renderFleetLimits() {
    const el = document.getElementById('page-fleet-limits');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-gauge"></i> Limity Paliwowe i Przebiegowe</h2>
        <button class="btn btn-primary" onclick="window.FleetLimits._openModal()"><i class="ti ti-plus"></i> Dodaj limit</button>
      </div>
      <p style="color:var(--text-muted);margin-bottom:12px">Ustaw limity zużycia paliwa i przebiegu dla pojazdów lub kierowców. Przekroczenia są widoczne w raportach.</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="lim-filter-scope" class="form-control" style="width:150px" onchange="window.FleetLimits._load()">
          <option value="">Pojazdy i kierowcy</option>
          <option value="vehicle">Tylko pojazdy</option>
          <option value="driver">Tylko kierowcy</option>
        </select>
        <select id="lim-filter-period" class="form-control" style="width:160px" onchange="window.FleetLimits._load()">
          <option value="">Wszystkie okresy</option>
          ${Object.entries(PERIOD_LABEL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="lim-search" class="form-control" style="width:200px" placeholder="Nr rej. / kierowca..." oninput="window.FleetLimits._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Typ</th><th>Pojazd / Kierowca</th><th>Okres</th><th>Limit paliwa (L)</th><th>Limit paliwa (PLN)</th><th>Limit km</th><th>Limit km pryw.</th><th>Aktywny</th><th>Akcje</th></tr></thead>
        <tbody id="lim-tbody"><tr><td colspan="9" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="lim-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.FleetLimits._closeModal()">
        <div class="modal-box" style="max-width:520px">
          <div class="modal-header"><h3 id="lim-modal-title">Limit</h3><button class="modal-close" onclick="window.FleetLimits._closeModal()">×</button></div>
          <div class="modal-body" id="lim-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const scope  = document.getElementById('lim-filter-scope')?.value || '';
    const period = document.getElementById('lim-filter-period')?.value || '';
    const q      = document.getElementById('lim-search')?.value || '';
    const tbody  = document.getElementById('lim-tbody');
    if (!tbody) return;
    const data = await api(`?scope=${scope}&period=${period}&q=${encodeURIComponent(q)}`);
    const list = data.limits || [];
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Brak zdefiniowanych limitów</td></tr>'; return; }
    tbody.innerHTML = list.map(l => `
      <tr style="${!l.active?'opacity:.5':''}">
        <td><span class="pill">${l.limit_scope === 'vehicle' ? '🚗 Pojazd' : '👤 Kierowca'}</span></td>
        <td>${esc(l.scope_label || l.scope_id || '—')}</td>
        <td>${esc(PERIOD_LABEL[l.period] || l.period || '—')}</td>
        <td style="text-align:right">${l.fuel_limit_liters != null ? esc(l.fuel_limit_liters.toFixed(1)) + ' L' : '—'}</td>
        <td style="text-align:right">${l.fuel_limit_pln != null ? esc(l.fuel_limit_pln.toFixed(2)) + ' PLN' : '—'}</td>
        <td style="text-align:right">${l.mileage_limit_km != null ? esc(String(l.mileage_limit_km)) + ' km' : '—'}</td>
        <td style="text-align:right">${l.private_mileage_limit_km != null ? esc(String(l.private_mileage_limit_km)) + ' km' : '—'}</td>
        <td>${l.active ? '✅' : '⛔'}</td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(l.id)}" onclick="window.FleetLimits._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(l.id)}" onclick="window.FleetLimits._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('lim-modal');
    const body  = document.getElementById('lim-modal-body');
    const title = document.getElementById('lim-modal-title');
    let l = {};
    if (id) { const d = await api(`/${id}`); l = d.limit || {}; }
    title.textContent = id ? 'Edytuj limit' : 'Nowy limit';
    body.innerHTML = `
      <form id="lim-form" onsubmit="window.FleetLimits._save(event,'${esc(id||'')}')">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Typ limitu *</label>
            <select name="limit_scope" class="form-control" required>
              <option value="vehicle" ${l.limit_scope==='vehicle'?'selected':''}>🚗 Pojazd</option>
              <option value="driver"  ${l.limit_scope==='driver'?'selected':''}>👤 Kierowca</option>
            </select>
          </div>
          <div class="form-row"><label>Etykieta (nr rej. / imię)</label><input name="scope_label" class="form-control" value="${esc(l.scope_label||'')}"></div>
          <div class="form-row"><label>Okres</label>
            <select name="period" class="form-control">
              ${Object.entries(PERIOD_LABEL).map(([v,la])=>`<option value="${v}" ${l.period===v?'selected':''}>${esc(la)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Limit paliwa (litry)</label><input name="fuel_limit_liters" type="number" step="0.1" class="form-control" value="${l.fuel_limit_liters??''}"></div>
          <div class="form-row"><label>Limit paliwa (PLN)</label><input name="fuel_limit_pln" type="number" step="0.01" class="form-control" value="${l.fuel_limit_pln??''}"></div>
          <div class="form-row"><label>Limit przebiegu (km)</label><input name="mileage_limit_km" type="number" class="form-control" value="${l.mileage_limit_km??''}"></div>
          <div class="form-row"><label>Limit km prywatnych</label><input name="private_mileage_limit_km" type="number" class="form-control" value="${l.private_mileage_limit_km??''}"></div>
          <div class="form-row"><label>Aktywny</label>
            <select name="active" class="form-control">
              <option value="1" ${l.active!==0?'selected':''}>Tak</option>
              <option value="0" ${l.active===0?'selected':''}>Nie</option>
            </select>
          </div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.FleetLimits._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    await api(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć limit?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('lim-modal');
    if (m) m.style.display = 'none';
  }

  window.FleetLimits = { renderFleetLimits, _load, _openModal, _save, _delete, _closeModal };
})();
