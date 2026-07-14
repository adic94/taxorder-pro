(function () {
  'use strict';

  const API = window.WORKER_URL || '';
  const co  = () => localStorage.getItem('currentCompany') || '';

  const REASON_LABEL = { age: 'Wiek', mileage: 'Przebieg', cost: 'Koszty TCO', manual: 'Ręcznie' };
  const STATUS_CLR   = { planned: '#3b82f6', in_progress: '#f59e0b', done: '#22c55e', cancelled: '#94a3b8' };
  const STATUS_LABEL = { planned: 'Zaplanowana', in_progress: 'W trakcie', done: 'Zrealizowana', cancelled: 'Anulowana' };

  async function api(path, opts = {}) {
    const r = await fetch(`${API}/api/fleet-renewal${path}?company=${co()}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      ...opts,
    });
    return r.json();
  }

  function renderFleetRenewal() {
    const el = document.getElementById('page-fleet-renewal');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-refresh-dot"></i> Planowanie Wymiany Floty</h2>
        <button class="btn btn-primary" onclick="window.FleetRenewal._openModal()"><i class="ti ti-plus"></i> Dodaj plan wymiany</button>
      </div>
      <div class="renewal-kpi" id="renewal-kpi" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="renewal-filter-status" class="form-control" style="width:180px" onchange="window.FleetRenewal._load()">
          <option value="">Wszystkie statusy</option>
          <option value="planned">Zaplanowana</option>
          <option value="in_progress">W trakcie</option>
          <option value="done">Zrealizowana</option>
          <option value="cancelled">Anulowana</option>
        </select>
        <input id="renewal-search" class="form-control" style="width:200px" placeholder="Nr rej. / opis..." oninput="window.FleetRenewal._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Pojazd</th><th>Wiek (mies.)</th><th>Przebieg (km)</th><th>Powód</th><th>Planowana wymiana</th><th>Budżet (PLN)</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="renewal-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="renewal-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.FleetRenewal._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header"><h3 id="renewal-modal-title">Plan wymiany</h3><button class="modal-close" onclick="window.FleetRenewal._closeModal()">×</button></div>
          <div class="modal-body" id="renewal-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const status = document.getElementById('renewal-filter-status')?.value || '';
    const q      = document.getElementById('renewal-search')?.value || '';
    const tbody  = document.getElementById('renewal-tbody');
    if (!tbody) return;
    const data = await api(`?status=${status}&q=${encodeURIComponent(q)}`);
    const list = data.plans || [];
    _renderKpi(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak planów wymiany</td></tr>'; return; }
    tbody.innerHTML = list.map(p => `
      <tr>
        <td><strong>${esc(p.vehicle_reg || '—')}</strong></td>
        <td style="text-align:right">${p.current_age_months ?? '—'}</td>
        <td style="text-align:right">${p.current_mileage_km != null ? esc(String(p.current_mileage_km)) : '—'}</td>
        <td>${esc(REASON_LABEL[p.renewal_reason] || p.renewal_reason || '—')}</td>
        <td>${p.planned_replacement_date ? esc(p.planned_replacement_date.slice(0,10)) : '—'}</td>
        <td style="text-align:right">${p.replacement_budget_pln != null ? esc(p.replacement_budget_pln.toLocaleString('pl-PL')) + ' PLN' : '—'}</td>
        <td><span class="pill" style="background:${STATUS_CLR[p.status]||'#999'}20;color:${STATUS_CLR[p.status]||'#999'}">${esc(STATUS_LABEL[p.status] || p.status)}</span></td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(p.id)}" onclick="window.FleetRenewal._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(p.id)}" onclick="window.FleetRenewal._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  function _renderKpi(s) {
    const el = document.getElementById('renewal-kpi');
    if (!el) return;
    el.innerHTML = [
      { lbl: 'Zaplanowanych', val: s.planned || 0, c: '#3b82f6' },
      { lbl: 'W trakcie', val: s.in_progress || 0, c: '#f59e0b' },
      { lbl: 'Zrealizowanych', val: s.done || 0, c: '#22c55e' },
      { lbl: 'Budżet łącznie', val: s.total_budget ? s.total_budget.toLocaleString('pl-PL') + ' PLN' : '—', c: '#8b5cf6' },
    ].map(i => `<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.2em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('renewal-modal');
    const body  = document.getElementById('renewal-modal-body');
    const title = document.getElementById('renewal-modal-title');
    let p = {};
    if (id) { const d = await api(`/${id}`); p = d.plan || {}; }
    title.textContent = id ? 'Edytuj plan wymiany' : 'Nowy plan wymiany';
    body.innerHTML = `
      <form id="renewal-form" onsubmit="window.FleetRenewal._save(event,'${esc(id||'')}')">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Nr rejestracyjny</label><input name="vehicle_reg" class="form-control" value="${esc(p.vehicle_reg||'')}"></div>
          <div class="form-row"><label>Wiek pojazdu (mies.)</label><input name="current_age_months" type="number" class="form-control" value="${p.current_age_months??''}"></div>
          <div class="form-row"><label>Bieżący przebieg (km)</label><input name="current_mileage_km" type="number" class="form-control" value="${p.current_mileage_km??''}"></div>
          <div class="form-row"><label>Powód wymiany</label>
            <select name="renewal_reason" class="form-control">
              ${Object.entries(REASON_LABEL).map(([v,l])=>`<option value="${v}" ${p.renewal_reason===v?'selected':''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Planowana data wymiany</label><input name="planned_replacement_date" type="date" class="form-control" value="${esc(p.planned_replacement_date?.slice(0,10)||'')}"></div>
          <div class="form-row"><label>Budżet (PLN)</label><input name="replacement_budget_pln" type="number" step="0.01" class="form-control" value="${p.replacement_budget_pln??''}"></div>
          <div class="form-row" style="grid-column:1/-1"><label>Opis pojazdu zastępczego</label><input name="replacement_vehicle_desc" class="form-control" value="${esc(p.replacement_vehicle_desc||'')}"></div>
          <div class="form-row"><label>Status</label>
            <select name="status" class="form-control">
              ${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}" ${p.status===v?'selected':''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(p.notes||'')}</textarea></div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.FleetRenewal._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    const method = id ? 'PUT' : 'POST';
    await api(id ? `/${id}` : '', { method, body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć plan wymiany?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('renewal-modal');
    if (m) m.style.display = 'none';
  }

  window.FleetRenewal = { renderFleetRenewal, _load, _openModal, _save, _delete, _closeModal };
})();
