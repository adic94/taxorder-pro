(function () {
  'use strict';
  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';
  const STATUS_LBL = { draft:'Szkic', sent:'Wysłany', delivered:'Dostarczony', cancelled:'Anulowany' };
  const STATUS_CLR = { draft:'#94a3b8', sent:'#3b82f6', delivered:'#22c55e', cancelled:'#ef4444' };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/cmr${path}${path.includes('?')?'&':'?'}company=${co()}`, { headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('cf_token')}`}, ...opts });
    return r.json();
  }

  function renderCmr() {
    const el = document.getElementById('page-cmr');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-file-invoice"></i> Listy Przewozowe CMR</h2>
        <button class="btn btn-primary" onclick="window.CmrModule._openModal()"><i class="ti ti-plus"></i> Nowy CMR</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="cmr-filter-status" class="form-control" style="width:150px" onchange="window.CmrModule._load()">
          <option value="">Wszystkie</option>
          ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="cmr-search" class="form-control" style="width:220px" placeholder="Nr CMR / pojazd / nadawca..." oninput="window.CmrModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Nr CMR</th><th>Data</th><th>Nadawca</th><th>Odbiorca</th><th>Trasa</th><th>Pojazd</th><th>Kierowca</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="cmr-tbody"><tr><td colspan="9" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="cmr-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.CmrModule._closeModal()">
        <div class="modal-box" style="max-width:660px">
          <div class="modal-header"><h3 id="cmr-modal-title">List przewozowy CMR</h3><button class="modal-close" onclick="window.CmrModule._closeModal()">×</button></div>
          <div class="modal-body" id="cmr-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const status = document.getElementById('cmr-filter-status')?.value || '';
    const q      = document.getElementById('cmr-search')?.value || '';
    const tbody  = document.getElementById('cmr-tbody');
    if (!tbody) return;
    const data = await api(`?status=${status}&q=${encodeURIComponent(q)}`);
    const list = data.documents || [];
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Brak dokumentów CMR</td></tr>'; return; }
    tbody.innerHTML = list.map(d => `<tr>
      <td><strong>${esc(d.cmr_number)}</strong></td>
      <td>${esc(d.issue_date?.slice(0,10)||'—')}</td>
      <td>${esc(d.sender_name||'—')}<br><small>${esc(d.sender_country||'')}</small></td>
      <td>${esc(d.receiver_name||'—')}<br><small>${esc(d.receiver_country||'')}</small></td>
      <td>${esc(d.loading_place||'—')} → ${esc(d.delivery_place||'—')}</td>
      <td>${esc(d.vehicle_reg||'—')}</td>
      <td>${esc(d.driver_name||'—')}</td>
      <td><span class="pill" style="background:${STATUS_CLR[d.status]||'#999'}20;color:${STATUS_CLR[d.status]||'#999'}">${esc(STATUS_LBL[d.status]||d.status)}</span></td>
      <td>
        <button class="btn-icon" title="Drukuj CMR" data-id="${esc(d.id)}" onclick="window.CmrModule._print(this.dataset.id)"><i class="ti ti-printer"></i></button>
        <button class="btn-icon" data-id="${esc(d.id)}" onclick="window.CmrModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
        <button class="btn-icon danger" data-id="${esc(d.id)}" onclick="window.CmrModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('cmr-modal');
    const body  = document.getElementById('cmr-modal-body');
    document.getElementById('cmr-modal-title').textContent = id ? 'Edytuj CMR' : 'Nowy list przewozowy CMR';
    let d = { status:'draft', issue_date: new Date().toISOString().slice(0,10) };
    if (id) { const res = await api(`/${id}`); d = res.document || d; }
    body.innerHTML = `<form id="cmr-form" onsubmit="window.CmrModule._save(event,'${esc(id||'')}')">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row"><label>Nr CMR *</label><input name="cmr_number" class="form-control" required value="${esc(d.cmr_number||'')}"></div>
        <div class="form-row"><label>Data wystawienia *</label><input name="issue_date" type="date" class="form-control" required value="${esc(d.issue_date?.slice(0,10)||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><hr style="margin:4px 0"><label style="font-weight:600">Nadawca</label></div>
        <div class="form-row"><label>Nazwa nadawcy</label><input name="sender_name" class="form-control" value="${esc(d.sender_name||'')}"></div>
        <div class="form-row"><label>Kraj nadawcy (PL, DE…)</label><input name="sender_country" class="form-control" maxlength="3" value="${esc(d.sender_country||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><input name="sender_address" class="form-control" placeholder="Adres nadawcy" value="${esc(d.sender_address||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><hr style="margin:4px 0"><label style="font-weight:600">Odbiorca</label></div>
        <div class="form-row"><label>Nazwa odbiorcy</label><input name="receiver_name" class="form-control" value="${esc(d.receiver_name||'')}"></div>
        <div class="form-row"><label>Kraj odbiorcy</label><input name="receiver_country" class="form-control" maxlength="3" value="${esc(d.receiver_country||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><input name="receiver_address" class="form-control" placeholder="Adres odbiorcy" value="${esc(d.receiver_address||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><hr style="margin:4px 0"><label style="font-weight:600">Transport</label></div>
        <div class="form-row"><label>Miejsce załadunku</label><input name="loading_place" class="form-control" value="${esc(d.loading_place||'')}"></div>
        <div class="form-row"><label>Miejsce dostawy</label><input name="delivery_place" class="form-control" value="${esc(d.delivery_place||'')}"></div>
        <div class="form-row"><label>Nr rej. pojazdu</label><input name="vehicle_reg" class="form-control" value="${esc(d.vehicle_reg||'')}"></div>
        <div class="form-row"><label>Kierowca</label><input name="driver_name" class="form-control" value="${esc(d.driver_name||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Opis ładunku</label><textarea name="cargo_description" class="form-control" rows="2">${esc(d.cargo_description||'')}</textarea></div>
        <div class="form-row"><label>Masa brutto (kg)</label><input name="gross_weight_kg" type="number" step="0.1" class="form-control" value="${d.gross_weight_kg??''}"></div>
        <div class="form-row"><label>Ilość / opakowanie</label><input name="packages_count" class="form-control" value="${esc(d.packages_count||'')}"></div>
        <div class="form-row"><label>Status</label>
          <select name="status" class="form-control">
            ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}" ${d.status===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Wartość (PLN)</label><input name="declared_value_pln" type="number" step="0.01" class="form-control" value="${d.declared_value_pln??''}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Instrukcje specjalne</label><textarea name="special_instructions" class="form-control" rows="2">${esc(d.special_instructions||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.CmrModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
    </form>`;
    modal.style.display = 'flex';
  }

  async function _save(ev, id) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    await api(id?`/${id}`:'', { method: id?'PUT':'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _print(id) {
    const data = await api(`/${id}`);
    const d = data.document || {};
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>CMR ${esc(d.cmr_number)}</title></head><body style="font-family:sans-serif;padding:20px;max-width:900px;margin:0 auto">
      <h2 style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px">LIST PRZEWOZOWY / CMR</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <tr>
          <td style="border:1px solid #000;padding:6px;width:50%"><b>Nadawca (1):</b><br>${esc(d.sender_name||'')} ${esc(d.sender_country||'')} ${esc(d.sender_address||'')}</td>
          <td style="border:1px solid #000;padding:6px"><b>Nr CMR:</b> ${esc(d.cmr_number)}<br><b>Data:</b> ${esc(d.issue_date?.slice(0,10)||'')}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:6px"><b>Odbiorca (2):</b><br>${esc(d.receiver_name||'')} ${esc(d.receiver_country||'')} ${esc(d.receiver_address||'')}</td>
          <td style="border:1px solid #000;padding:6px"><b>Pojazd:</b> ${esc(d.vehicle_reg||'')}<br><b>Kierowca:</b> ${esc(d.driver_name||'')}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:6px"><b>Miejsce załadunku (4):</b> ${esc(d.loading_place||'')}</td>
          <td style="border:1px solid #000;padding:6px"><b>Miejsce dostawy (3):</b> ${esc(d.delivery_place||'')}</td>
        </tr>
        <tr><td colspan="2" style="border:1px solid #000;padding:6px"><b>Opis ładunku (6):</b> ${esc(d.cargo_description||'')}</td></tr>
        <tr>
          <td style="border:1px solid #000;padding:6px"><b>Masa brutto (11):</b> ${d.gross_weight_kg??'—'} kg</td>
          <td style="border:1px solid #000;padding:6px"><b>Ilość / opakowanie (10):</b> ${esc(d.packages_count||'—')}</td>
        </tr>
        <tr><td colspan="2" style="border:1px solid #000;padding:6px"><b>Instrukcje specjalne (13):</b> ${esc(d.special_instructions||'—')}</td></tr>
      </table>
      <div style="display:flex;gap:20px;margin-top:30px">
        <div style="flex:1;border-top:1px solid #000;padding-top:6px;text-align:center">Podpis nadawcy</div>
        <div style="flex:1;border-top:1px solid #000;padding-top:6px;text-align:center">Podpis przewoźnika</div>
        <div style="flex:1;border-top:1px solid #000;padding-top:6px;text-align:center">Podpis odbiorcy</div>
      </div>
    </body></html>`);
    w.print();
  }

  async function _delete(id) {
    if (!confirm('Usunąć dokument CMR?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('cmr-modal'); if(m) m.style.display='none'; }
  window.CmrModule = { renderCmr, _load, _openModal, _save, _print, _delete, _closeModal };
})();


