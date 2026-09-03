(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const TYPE_LBL  = { warranty:'Gwarancja', recall:'Kampania serwisowa (recall)', extended_warranty:'Gwarancja rozszerzona' };
  const TYPE_CLR  = { warranty:'#22c55e', recall:'#ef4444', extended_warranty:'#8b5cf6' };
  const RECALL_CLR = { open:'#ef4444', scheduled:'#f59e0b', completed:'#22c55e' };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/warranties${path}${path.includes('?')?'&':'?'}company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderWarranties() {
    const el = document.getElementById('page-warranties');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-certificate"></i> Gwarancje i Kampanie Serwisowe</h2>
        <button class="btn btn-primary" onclick="window.WarrantiesModule._openModal()"><i class="ti ti-plus"></i> Dodaj rekord</button>
      </div>
      <div id="warr-alerts" style="margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="warr-filter-type" class="form-control" style="width:200px" onchange="window.WarrantiesModule._load()">
          <option value="">Wszystkie typy</option>
          ${Object.entries(TYPE_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="warr-search-reg" class="form-control" style="width:180px" placeholder="Nr rej." oninput="window.WarrantiesModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Pojazd</th><th>Typ</th><th>Tytuł</th><th>Dostawca</th><th>Ważne do / Nr kampanii</th><th>Limit km</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="warr-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="warr-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.WarrantiesModule._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header"><h3 id="warr-modal-title">Gwarancja / Recall</h3><button class="modal-close" onclick="window.WarrantiesModule._closeModal()">×</button></div>
          <div class="modal-body" id="warr-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const type = document.getElementById('warr-filter-type')?.value || '';
    const reg  = document.getElementById('warr-search-reg')?.value || '';
    const tbody = document.getElementById('warr-tbody');
    if (!tbody) return;
    const data = await api(`?type=${type}&reg=${encodeURIComponent(reg)}`);
    const list = data.records || [];
    _renderAlerts(data.active_recalls || []);
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak rekordów gwarancji/kampanii</td></tr>'; return; }
    const today = new Date().toISOString().slice(0,10);
    tbody.innerHTML = list.map(r => {
      const expired = r.end_date && r.end_date.slice(0,10) < today;
      const expiringSoon = r.end_date && !expired && _daysLeft(r.end_date) <= 30;
      return `<tr style="${expired?'opacity:.6':''}">
        <td><strong>${esc(r.vehicle_reg)}</strong></td>
        <td><span class="pill" style="background:${TYPE_CLR[r.record_type]||'#999'}20;color:${TYPE_CLR[r.record_type]||'#999'}">${esc(TYPE_LBL[r.record_type]||r.record_type)}</span></td>
        <td>${esc(r.title)}</td>
        <td>${esc(r.provider||'—')}</td>
        <td>${r.end_date ? `<span style="color:${expired?'#94a3b8':expiringSoon?'#f59e0b':'inherit'}">${esc(r.end_date.slice(0,10))}${expiringSoon?' ⚠️':expired?' (wygasła)':''}</span>` : esc(r.recall_number||'—')}</td>
        <td>${r.mileage_limit_km!=null?`${esc(String(r.mileage_limit_km))} km`:'—'}</td>
        <td>${r.record_type==='recall'?`<span style="color:${RECALL_CLR[r.recall_status]||'#999'}">${esc(r.recall_status||'—')}</span>` : (expired?'<span style="color:#94a3b8">Wygasła</span>':'<span style="color:#22c55e">Aktywna</span>')}</td>
        <td>
          <button class="btn-icon" data-id="${esc(r.id)}" onclick="window.WarrantiesModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" data-id="${esc(r.id)}" onclick="window.WarrantiesModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderAlerts(recalls) {
    const el = document.getElementById('warr-alerts');
    if (!el) return;
    if (!recalls.length) { el.innerHTML=''; return; }
    el.innerHTML = `<div class="alert-banner" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:12px;color:#dc2626"><i class="ti ti-alert-triangle"></i> <strong>${recalls.length} otwartych kampanii serwisowych (recall):</strong> ${recalls.map(r=>`${esc(r.vehicle_reg)} — ${esc(r.title)}`).join('; ')}</div>`;
  }

  function _daysLeft(dateStr) { return Math.floor((new Date(dateStr)-new Date())/86400000); }

  async function _openModal(id) {
    const modal = document.getElementById('warr-modal');
    const body  = document.getElementById('warr-modal-body');
    document.getElementById('warr-modal-title').textContent = id ? 'Edytuj rekord' : 'Nowa gwarancja / kampania serwisowa';
    let r = {};
    if (id) { const d = await api(`/${id}`); r = d.record || {}; }
    body.innerHTML = `<form id="warr-form" data-id="${esc(id||'')}" onsubmit="window.WarrantiesModule._save(event,this.dataset.id)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row"><label>Nr rej. *</label><input name="vehicle_reg" class="form-control" required value="${esc(r.vehicle_reg||'')}"></div>
        <div class="form-row"><label>Typ *</label>
          <select name="record_type" class="form-control" required>
            ${Object.entries(TYPE_LBL).map(([v,l])=>`<option value="${v}" ${r.record_type===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row" style="grid-column:1/-1"><label>Tytuł *</label><input name="title" class="form-control" required value="${esc(r.title||'')}"></div>
        <div class="form-row"><label>Producent / serwis</label><input name="provider" class="form-control" value="${esc(r.provider||'')}"></div>
        <div class="form-row"><label>Nr kampanii recall</label><input name="recall_number" class="form-control" value="${esc(r.recall_number||'')}"></div>
        <div class="form-row"><label>Data początku</label><input name="start_date" type="date" class="form-control" value="${esc(r.start_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Data końca / wygaśnięcia</label><input name="end_date" type="date" class="form-control" value="${esc(r.end_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Limit km (gwarancja)</label><input name="mileage_limit_km" type="number" class="form-control" value="${r.mileage_limit_km??''}"></div>
        <div class="form-row"><label>Status kampanii</label>
          <select name="recall_status" class="form-control">
            <option value="open" ${r.recall_status==='open'?'selected':''}>Otwarta</option>
            <option value="scheduled" ${r.recall_status==='scheduled'?'selected':''}>Zaplanowana</option>
            <option value="completed" ${r.recall_status==='completed'?'selected':''}>Zrealizowana</option>
          </select>
        </div>
        <div class="form-row"><label>Koszt (PLN)</label><input name="cost_pln" type="number" step="0.01" class="form-control" value="${r.cost_pln??''}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Opis</label><textarea name="description" class="form-control" rows="2">${esc(r.description||'')}</textarea></div>
        <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(r.notes||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.WarrantiesModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
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
    if (!confirm('Usunąć rekord?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('warr-modal'); if(m) m.style.display='none'; }
  window.WarrantiesModule = { renderWarranties, _load, _openModal, _save, _delete, _closeModal };
})();

