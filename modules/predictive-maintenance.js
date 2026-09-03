(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const TYPES = { oil_change:'Wymiana oleju', tires:'Wymiana opon', brake_fluid:'Płyn hamulcowy', inspection:'Przegląd tech.', belt:'Pasek rozrządu', coolant:'Płyn chłodniczy', battery:'Akumulator', custom:'Niestandardowy' };
  const STATUS_CLR = { ok:'#22c55e', soon:'#f59e0b', overdue:'#ef4444' };
  const STATUS_LBL = { ok:'✅ OK', soon:'⚠️ Wkrótce', overdue:'🚨 Zaległy' };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/predictive-maintenance${path}${path.includes('?')?'&':'?'}company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderPredictiveMaintenance() {
    const el = document.getElementById('page-predictive-maintenance');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-bulb"></i> Serwis Predykcyjny</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" onclick="window.PredictiveMaintenance._recalculate()"><i class="ti ti-refresh"></i> Przelicz alerty</button>
          <button class="btn btn-primary" onclick="window.PredictiveMaintenance._openModal()"><i class="ti ti-plus"></i> Dodaj alert</button>
        </div>
      </div>
      <p style="color:var(--text-muted);margin-bottom:12px">Automatyczne alerty o zbliżającym się serwisie na podstawie przebiegu lub daty.</p>
      <div id="pm-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="pm-filter-status" class="form-control" style="width:150px" onchange="window.PredictiveMaintenance._load()">
          <option value="">Wszystkie</option>
          <option value="overdue">🚨 Zaległe</option>
          <option value="soon">⚠️ Wkrótce</option>
          <option value="ok">✅ OK</option>
        </select>
        <input id="pm-search-reg" class="form-control" style="width:180px" placeholder="Nr rej." oninput="window.PredictiveMaintenance._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Pojazd</th><th>Typ serwisu</th><th>Trigger</th><th>Ostatni serwis</th><th>Następny (data/km)</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="pm-tbody"><tr><td colspan="7" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="predmaint-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.PredictiveMaintenance._closeModal()">
        <div class="modal-box" style="max-width:540px">
          <div class="modal-header"><h3 id="predmaint-modal-title">Alert serwisowy</h3><button class="modal-close" onclick="window.PredictiveMaintenance._closeModal()">×</button></div>
          <div class="modal-body" id="pm-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const status = document.getElementById('pm-filter-status')?.value || '';
    const reg    = document.getElementById('pm-search-reg')?.value || '';
    const tbody  = document.getElementById('pm-tbody');
    if (!tbody) return;
    const data = await api(`?status=${status}&reg=${encodeURIComponent(reg)}`);
    const list = data.alerts || [];
    _renderStats(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Brak alertów serwisowych</td></tr>'; return; }
    tbody.innerHTML = list.map(a => `<tr style="background:${a.status==='overdue'?'rgba(239,68,68,.06)':a.status==='soon'?'rgba(245,158,11,.06)':''}">
      <td><strong>${esc(a.vehicle_reg)}</strong></td>
      <td>${esc(TYPES[a.alert_type] || a.alert_type)}</td>
      <td>${a.trigger_type==='mileage'?`co ${esc(String(a.interval_km||0))} km`:`co ${esc(String(a.interval_days||0))} dni`}</td>
      <td>${a.last_service_date ? esc(a.last_service_date.slice(0,10)) : '—'}<br><small>${a.last_service_km!=null?`${esc(String(a.last_service_km))} km`:'—'}</small></td>
      <td>${a.predicted_due_date ? esc(a.predicted_due_date.slice(0,10)) : '—'}<br><small>${a.predicted_due_km!=null?`${esc(String(a.predicted_due_km))} km`:'—'}</small></td>
      <td><span style="color:${STATUS_CLR[a.status]||'#999'};font-weight:600">${STATUS_LBL[a.status]||esc(a.status)}</span></td>
      <td>
        <button class="btn-icon" title="Zaznacz jako wykonany" data-id="${esc(a.id)}" onclick="window.PredictiveMaintenance._markDone(this.dataset.id)"><i class="ti ti-check"></i></button>
        <button class="btn-icon" data-id="${esc(a.id)}" onclick="window.PredictiveMaintenance._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
        <button class="btn-icon danger" data-id="${esc(a.id)}" onclick="window.PredictiveMaintenance._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('pm-stats');
    if (!el) return;
    el.innerHTML = [
      { lbl:'Zaległe', val: s.overdue||0, c:'#ef4444' },
      { lbl:'Wkrótce', val: s.soon||0, c:'#f59e0b' },
      { lbl:'OK', val: s.ok||0, c:'#22c55e' },
    ].map(i=>`<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.3em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('predmaint-modal');
    const body  = document.getElementById('pm-modal-body');
    document.getElementById('predmaint-modal-title').textContent = id ? 'Edytuj alert' : 'Nowy alert serwisowy';
    let a = { trigger_type:'mileage' };
    if (id) { const d = await api(`/${id}`); a = d.alert || a; }
    body.innerHTML = `<form id="pm-form" data-id="${esc(id||'')}" onsubmit="window.PredictiveMaintenance._save(event,this.dataset.id)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row"><label>Nr rej. *</label><input name="vehicle_reg" class="form-control" required value="${esc(a.vehicle_reg||'')}"></div>
        <div class="form-row"><label>Typ serwisu *</label>
          <select name="alert_type" class="form-control" required>
            ${Object.entries(TYPES).map(([v,l])=>`<option value="${v}" ${a.alert_type===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Trigger</label>
          <select name="trigger_type" class="form-control">
            <option value="mileage" ${a.trigger_type==='mileage'?'selected':''}>Przebieg (km)</option>
            <option value="date" ${a.trigger_type==='date'?'selected':''}>Data (dni)</option>
          </select>
        </div>
        <div class="form-row"><label>Interwał (km lub dni)</label><input name="interval_km" type="number" class="form-control" placeholder="np. 10000" value="${a.interval_km??a.interval_days??''}"></div>
        <div class="form-row"><label>Ostatni serwis (data)</label><input name="last_service_date" type="date" class="form-control" value="${esc(a.last_service_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Ostatni serwis (km)</label><input name="last_service_km" type="number" class="form-control" value="${a.last_service_km??''}"></div>
        <div class="form-row"><label>Bieżący przebieg (km)</label><input name="current_km" type="number" class="form-control" value="${a.current_km??''}"></div>
        <div class="form-row"><label>Aktywny</label>
          <select name="active" class="form-control">
            <option value="1" ${a.active!==0?'selected':''}>Tak</option>
            <option value="0" ${a.active===0?'selected':''}>Nie</option>
          </select>
        </div>
        <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(a.notes||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.PredictiveMaintenance._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
    </form>`;
    modal.style.display = 'flex';
  }

  async function _save(ev, id) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    if (body.trigger_type === 'mileage') { body.interval_km = body.interval_km !== '' ? +body.interval_km : null; body.interval_days = null; }
    else { body.interval_days = body.interval_days !== '' ? +body.interval_days : null; body.interval_km = null; }
    await api(id?`/${id}`:'', { method: id?'PUT':'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _markDone(id) {
    const km = prompt('Aktualny przebieg przy wykonaniu serwisu (km):');
    if (km === null) return;
    const today = new Date().toISOString().slice(0,10);
    await api(`/${id}/done`, { method:'POST', body: JSON.stringify({ km: +km||null, date: today }) });
    _load();
  }

  async function _recalculate() {
    const d = await api('/recalculate', { method:'POST', body:'{}' });
    alert(`Przeliczono ${d.updated||0} alertów.`);
    _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć alert?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('predmaint-modal'); if(m) m.style.display='none'; }
  window.PredictiveMaintenance = { renderPredictiveMaintenance, _load, _openModal, _save, _markDone, _recalculate, _delete, _closeModal };
})();

