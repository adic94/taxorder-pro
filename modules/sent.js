(function () {
  'use strict';
  const API = window.WORKER_URL || '';
  const co  = () => localStorage.getItem('currentCompany') || '';
  const TYPE_LBL   = { road:'Drogowy', rail:'Kolejowy', other:'Inny' };
  const STATUS_LBL = { draft:'Szkic', registered:'Zarejestrowany', transit:'W tranzycie', completed:'Zakończony', cancelled:'Anulowany' };
  const STATUS_CLR = { draft:'#94a3b8', registered:'#3b82f6', transit:'#f59e0b', completed:'#22c55e', cancelled:'#ef4444' };

  async function api(path, opts={}) {
    const r = await fetch(`${API}/api/sent${path}?company=${co()}`, { headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('authToken')}`}, ...opts });
    return r.json();
  }

  function renderSent() {
    const el = document.getElementById('page-sent');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-truck-delivery"></i> Monitoring SENT (PUESC)</h2>
        <button class="btn btn-primary" onclick="window.SentModule._openModal()"><i class="ti ti-plus"></i> Nowe zgłoszenie SENT</button>
      </div>
      <p style="color:var(--text-muted);margin-bottom:12px;font-size:.9em">System monitorowania przewozu towarów objętych zezwoleniem (PUESC / e-SENT).</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="sent-filter-status" class="form-control" style="width:160px" onchange="window.SentModule._load()">
          <option value="">Wszystkie</option>
          ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="sent-search" class="form-control" style="width:220px" placeholder="Nr SENT / pojazd / towar..." oninput="window.SentModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Nr referencyjny SENT</th><th>Towar</th><th>Kod CN</th><th>Pojazd</th><th>Trasa</th><th>Data wyjazdu</th><th>Masa (kg)</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="sent-tbody"><tr><td colspan="9" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="sent-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.SentModule._closeModal()">
        <div class="modal-box" style="max-width:620px">
          <div class="modal-header"><h3 id="sent-modal-title">Zgłoszenie SENT</h3><button class="modal-close" onclick="window.SentModule._closeModal()">×</button></div>
          <div class="modal-body" id="sent-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const status = document.getElementById('sent-filter-status')?.value || '';
    const q      = document.getElementById('sent-search')?.value || '';
    const tbody  = document.getElementById('sent-tbody');
    if (!tbody) return;
    const data = await api(`?status=${status}&q=${encodeURIComponent(q)}`);
    const list = data.records || [];
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Brak zgłoszeń SENT</td></tr>'; return; }
    tbody.innerHTML = list.map(r => `<tr>
      <td><strong>${esc(r.sent_number||'—')}</strong></td>
      <td>${esc(r.goods_name||'—')}</td>
      <td>${esc(r.cn_code||'—')}</td>
      <td>${esc(r.vehicle_reg||'—')}</td>
      <td>${esc(r.origin_country||'—')} → ${esc(r.destination_country||'—')}</td>
      <td>${esc(r.departure_date?.slice(0,10)||'—')}</td>
      <td style="text-align:right">${r.mass_kg!=null?esc(String(r.mass_kg))+' kg':'—'}</td>
      <td><span class="pill" style="background:${STATUS_CLR[r.status]||'#999'}20;color:${STATUS_CLR[r.status]||'#999'}">${esc(STATUS_LBL[r.status]||r.status)}</span></td>
      <td>
        <button class="btn-icon" data-id="${esc(r.id)}" onclick="window.SentModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
        <button class="btn-icon danger" data-id="${esc(r.id)}" onclick="window.SentModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('sent-modal');
    const body  = document.getElementById('sent-modal-body');
    document.getElementById('sent-modal-title').textContent = id ? 'Edytuj zgłoszenie SENT' : 'Nowe zgłoszenie SENT';
    let r = { status:'draft', transport_type:'road', departure_date: new Date().toISOString().slice(0,10) };
    if (id) { const d = await api(`/${id}`); r = d.record || r; }
    body.innerHTML = `<form id="sent-form" onsubmit="window.SentModule._save(event,'${esc(id||'')}')">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row"><label>Nr referencyjny SENT</label><input name="sent_number" class="form-control" value="${esc(r.sent_number||'')}"></div>
        <div class="form-row"><label>Status</label>
          <select name="status" class="form-control">
            ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}" ${r.status===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row" style="grid-column:1/-1"><hr style="margin:4px 0"><label style="font-weight:600">Towar</label></div>
        <div class="form-row"><label>Nazwa towaru *</label><input name="goods_name" class="form-control" required value="${esc(r.goods_name||'')}"></div>
        <div class="form-row"><label>Kod CN (np. 2710)</label><input name="cn_code" class="form-control" maxlength="10" value="${esc(r.cn_code||'')}"></div>
        <div class="form-row"><label>Masa brutto (kg)</label><input name="mass_kg" type="number" step="0.001" class="form-control" value="${r.mass_kg??''}"></div>
        <div class="form-row"><label>Wartość (PLN)</label><input name="value_pln" type="number" step="0.01" class="form-control" value="${r.value_pln??''}"></div>
        <div class="form-row" style="grid-column:1/-1"><hr style="margin:4px 0"><label style="font-weight:600">Transport</label></div>
        <div class="form-row"><label>Rodzaj transportu</label>
          <select name="transport_type" class="form-control">
            ${Object.entries(TYPE_LBL).map(([v,l])=>`<option value="${v}" ${r.transport_type===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Nr rej. pojazdu</label><input name="vehicle_reg" class="form-control" value="${esc(r.vehicle_reg||'')}"></div>
        <div class="form-row"><label>Kraj nadania</label><input name="origin_country" class="form-control" maxlength="3" value="${esc(r.origin_country||'PL')}"></div>
        <div class="form-row"><label>Kraj docelowy</label><input name="destination_country" class="form-control" maxlength="3" value="${esc(r.destination_country||'')}"></div>
        <div class="form-row"><label>Miejsce załadunku</label><input name="loading_place" class="form-control" value="${esc(r.loading_place||'')}"></div>
        <div class="form-row"><label>Miejsce dostawy</label><input name="delivery_place" class="form-control" value="${esc(r.delivery_place||'')}"></div>
        <div class="form-row"><label>Data wyjazdu *</label><input name="departure_date" type="date" class="form-control" required value="${esc(r.departure_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Data dostawy (planowana)</label><input name="expected_delivery_date" type="date" class="form-control" value="${esc(r.expected_delivery_date?.slice(0,10)||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><hr style="margin:4px 0"><label style="font-weight:600">Podmiot wysyłający</label></div>
        <div class="form-row"><label>Nadawca (nazwa)</label><input name="sender_name" class="form-control" value="${esc(r.sender_name||'')}"></div>
        <div class="form-row"><label>NIP nadawcy</label><input name="sender_nip" class="form-control" maxlength="10" value="${esc(r.sender_nip||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(r.notes||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.SentModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
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
    if (!confirm('Usunąć zgłoszenie SENT?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('sent-modal'); if(m) m.style.display='none'; }
  window.SentModule = { renderSent, _load, _openModal, _save, _delete, _closeModal };
})();
