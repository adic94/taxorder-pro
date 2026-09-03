(function () {
  'use strict';
  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';
  const STATUS_LBL = { active:'W pracy', break:'Przerwa', completed:'Zakończona', rest:'Odpoczynek' };
  const STATUS_CLR = { active:'#22c55e', break:'#f59e0b', completed:'#3b82f6', rest:'#94a3b8' };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/driver-worktime${path}${path.includes('?')?'&':'?'}company=${co()}`, { headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('cf_token')}`}, ...opts });
    return r.json();
  }

  function _dur(mins) {
    if (mins == null) return '—';
    const h = Math.floor(mins/60), m = mins%60;
    return `${h}h ${m}min`;
  }

  function renderDriverWorktime() {
    const el = document.getElementById('page-driver-worktime');
    if (!el) return;
    const today = new Date().toISOString().slice(0,10);
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-clock"></i> Rejestr Czasu Pracy Kierowców</h2>
        <button class="btn btn-primary" onclick="window.DriverWorktime._openModal()"><i class="ti ti-plus"></i> Dodaj sesję</button>
      </div>
      <div id="dwt-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="dwt-date-from" type="date" class="form-control" style="width:150px" value="${firstDay}" onchange="window.DriverWorktime._load()">
        <span style="align-self:center">—</span>
        <input id="dwt-date-to" type="date" class="form-control" style="width:150px" value="${today}" onchange="window.DriverWorktime._load()">
        <input id="dwt-search-driver" class="form-control" style="width:200px" placeholder="Imię / nazwisko / ID kierowcy..." oninput="window.DriverWorktime._load()">
        <select id="dwt-filter-status" class="form-control" style="width:160px" onchange="window.DriverWorktime._load()">
          <option value="">Wszystkie statusy</option>
          ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Kierowca</th><th>Data</th><th>Pojazd</th><th>Rozpoczęcie</th><th>Zakończenie</th><th>Czas pracy</th><th>Przerwy</th><th>Km</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="dwt-tbody"><tr><td colspan="10" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="dwt-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.DriverWorktime._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header"><h3 id="dwt-modal-title">Sesja pracy kierowcy</h3><button class="modal-close" onclick="window.DriverWorktime._closeModal()">×</button></div>
          <div class="modal-body" id="dwt-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const from   = document.getElementById('dwt-date-from')?.value || '';
    const to     = document.getElementById('dwt-date-to')?.value || '';
    const driver = document.getElementById('dwt-search-driver')?.value || '';
    const status = document.getElementById('dwt-filter-status')?.value || '';
    const tbody  = document.getElementById('dwt-tbody');
    if (!tbody) return;
    const data = await api(`?from=${from}&to=${to}&driver=${encodeURIComponent(driver)}&status=${status}`);
    const list = data.sessions || [];
    _renderStats(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty-row">Brak sesji pracy</td></tr>'; return; }
    tbody.innerHTML = list.map(s => `<tr>
      <td><strong>${esc(s.driver_name||s.driver_id||'—')}</strong></td>
      <td>${esc(s.work_date?.slice(0,10)||'—')}</td>
      <td>${esc(s.vehicle_reg||'—')}</td>
      <td>${esc(s.start_time?.slice(0,5)||'—')}</td>
      <td>${esc(s.end_time?.slice(0,5)||'—')}</td>
      <td><strong>${_dur(s.work_duration_mins)}</strong></td>
      <td>${_dur(s.break_duration_mins)}</td>
      <td style="text-align:right">${s.mileage_km!=null?`${esc(String(s.mileage_km))} km`:'—'}</td>
      <td><span class="pill" style="background:${STATUS_CLR[s.status]||'#999'}20;color:${STATUS_CLR[s.status]||'#999'}">${esc(STATUS_LBL[s.status]||s.status)}</span></td>
      <td>
        <button class="btn-icon" data-id="${esc(s.id)}" onclick="window.DriverWorktime._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
        <button class="btn-icon danger" data-id="${esc(s.id)}" onclick="window.DriverWorktime._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('dwt-stats');
    if (!el) return;
    el.innerHTML = [
      { lbl:'Aktywni teraz', val: s.active_now||0, c:'#22c55e' },
      { lbl:'Sesji (zakres)', val: s.total_sessions||0, c:'#3b82f6' },
      { lbl:'Łączny czas pracy', val: s.total_work_hours?`${s.total_work_hours.toFixed(1)}h`:'—', c:'#8b5cf6' },
      { lbl:'Łączny przebieg', val: s.total_mileage_km?`${s.total_mileage_km} km`:'—', c:'#f59e0b' },
    ].map(i=>`<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.1em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('dwt-modal');
    const body  = document.getElementById('dwt-modal-body');
    document.getElementById('dwt-modal-title').textContent = id ? 'Edytuj sesję pracy' : 'Nowa sesja pracy kierowcy';
    let s = { status:'completed', work_date: new Date().toISOString().slice(0,10) };
    if (id) { const d = await api(`/${id}`); s = d.session || s; }
    body.innerHTML = `<form id="dwt-form" onsubmit="window.DriverWorktime._save(event,'${esc(id||'')}')">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row"><label>Kierowca (imię i nazwisko) *</label><input name="driver_name" class="form-control" required value="${esc(s.driver_name||'')}"></div>
        <div class="form-row"><label>ID kierowcy</label><input name="driver_id" class="form-control" value="${esc(s.driver_id||'')}"></div>
        <div class="form-row"><label>Data pracy *</label><input name="work_date" type="date" class="form-control" required value="${esc(s.work_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Nr rej. pojazdu</label><input name="vehicle_reg" class="form-control" value="${esc(s.vehicle_reg||'')}"></div>
        <div class="form-row"><label>Godzina rozpoczęcia</label><input name="start_time" type="time" class="form-control" value="${esc(s.start_time?.slice(0,5)||'')}"></div>
        <div class="form-row"><label>Godzina zakończenia</label><input name="end_time" type="time" class="form-control" value="${esc(s.end_time?.slice(0,5)||'')}"></div>
        <div class="form-row"><label>Czas pracy (min)</label><input name="work_duration_mins" type="number" class="form-control" value="${s.work_duration_mins??''}"></div>
        <div class="form-row"><label>Łączny czas przerw (min)</label><input name="break_duration_mins" type="number" class="form-control" value="${s.break_duration_mins??''}"></div>
        <div class="form-row"><label>Przebieg w trakcie (km)</label><input name="mileage_km" type="number" class="form-control" value="${s.mileage_km??''}"></div>
        <div class="form-row"><label>Status</label>
          <select name="status" class="form-control">
            ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}" ${s.status===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row" style="grid-column:1/-1"><label>Trasa (opis)</label><input name="route_description" class="form-control" value="${esc(s.route_description||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(s.notes||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.DriverWorktime._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
    </form>`;
    modal.style.display = 'flex';
  }

  async function _save(ev, id) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    await api(id?`/${id}`:'', { method: id?'PUT':'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć sesję pracy?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('dwt-modal'); if(m) m.style.display='none'; }
  window.DriverWorktime = { renderDriverWorktime, _load, _openModal, _save, _delete, _closeModal };
})();


