(function () {
  'use strict';
  const API = window.WORKER_URL || '';
  const co  = () => localStorage.getItem('currentCompany') || '';
  const TYPE_LBL   = { incoming:'Przychodzące', outgoing:'Wychodzące' };
  const STATUS_LBL = { pending:'Oczekuje', sent:'Wysłane', delivered:'Dostarczone', read:'Odczytane', rejected:'Odrzucone' };
  const STATUS_CLR = { pending:'#f59e0b', sent:'#3b82f6', delivered:'#8b5cf6', read:'#22c55e', rejected:'#ef4444' };

  async function api(path, opts={}) {
    const r = await fetch(`${API}/api/edoreczenia${path}?company=${co()}`, { headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('authToken')}`}, ...opts });
    return r.json();
  }

  function renderEdoreczenia() {
    const el = document.getElementById('page-edoreczenia');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-mailbox"></i> e-Doręczenia (gov.pl)</h2>
        <button class="btn btn-primary" onclick="window.EdoreczeniaModule._openModal()"><i class="ti ti-plus"></i> Nowe e-doręczenie</button>
      </div>
      <div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:.9em">
        <i class="ti ti-info-circle"></i> <strong>e-Doręczenia</strong> to obowiązkowy od 2025 r. system elektronicznych doręczeń urzędowych (gov.pl / Poczta Polska).
        Poniższy rejestr pozwala śledzić korespondencję i terminy odbioru.
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="edo-filter-type" class="form-control" style="width:160px" onchange="window.EdoreczeniaModule._load()">
          <option value="">Wszystkie</option>
          ${Object.entries(TYPE_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <select id="edo-filter-status" class="form-control" style="width:160px" onchange="window.EdoreczeniaModule._load()">
          <option value="">Wszystkie statusy</option>
          ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="edo-search" class="form-control" style="width:220px" placeholder="Nadawca / tytuł / nr ref..." oninput="window.EdoreczeniaModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Typ</th><th>Nr referencyjny</th><th>Nadawca / Odbiorca</th><th>Tytuł</th><th>Data nadania</th><th>Termin odbioru</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="edo-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="edo-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.EdoreczeniaModule._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header"><h3 id="edo-modal-title">e-Doręczenie</h3><button class="modal-close" onclick="window.EdoreczeniaModule._closeModal()">×</button></div>
          <div class="modal-body" id="edo-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const type   = document.getElementById('edo-filter-type')?.value || '';
    const status = document.getElementById('edo-filter-status')?.value || '';
    const q      = document.getElementById('edo-search')?.value || '';
    const tbody  = document.getElementById('edo-tbody');
    if (!tbody) return;
    const data = await api(`?type=${type}&status=${status}&q=${encodeURIComponent(q)}`);
    const list = data.items || [];
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak e-doręczeń</td></tr>'; return; }
    const today = new Date().toISOString().slice(0,10);
    tbody.innerHTML = list.map(e => {
      const overdue = e.deadline_date && e.deadline_date.slice(0,10) < today && e.status !== 'delivered' && e.status !== 'read';
      return `<tr style="${overdue?'background:rgba(239,68,68,.06)':''}">
        <td><span class="pill">${esc(TYPE_LBL[e.direction]||e.direction)}</span></td>
        <td>${esc(e.reference_number||'—')}</td>
        <td>${esc(e.sender_name||e.receiver_name||'—')}</td>
        <td>${esc(e.title||'—')}</td>
        <td>${esc(e.sent_date?.slice(0,10)||'—')}</td>
        <td style="${overdue?'color:#ef4444;font-weight:600':''}">${e.deadline_date?esc(e.deadline_date.slice(0,10))+(overdue?' ⚠️':''):'—'}</td>
        <td><span class="pill" style="background:${STATUS_CLR[e.status]||'#999'}20;color:${STATUS_CLR[e.status]||'#999'}">${esc(STATUS_LBL[e.status]||e.status)}</span></td>
        <td>
          <button class="btn-icon" data-id="${esc(e.id)}" onclick="window.EdoreczeniaModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" data-id="${esc(e.id)}" onclick="window.EdoreczeniaModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('edo-modal');
    const body  = document.getElementById('edo-modal-body');
    document.getElementById('edo-modal-title').textContent = id ? 'Edytuj e-doręczenie' : 'Nowe e-doręczenie';
    let e = { direction:'incoming', status:'pending', sent_date: new Date().toISOString().slice(0,10) };
    if (id) { const d = await api(`/${id}`); e = d.item || e; }
    body.innerHTML = `<form id="edo-form" onsubmit="window.EdoreczeniaModule._save(event,'${esc(id||'')}')">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row"><label>Kierunek *</label>
          <select name="direction" class="form-control" required>
            ${Object.entries(TYPE_LBL).map(([v,l])=>`<option value="${v}" ${e.direction===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Status</label>
          <select name="status" class="form-control">
            ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}" ${e.status===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row" style="grid-column:1/-1"><label>Tytuł / przedmiot *</label><input name="title" class="form-control" required value="${esc(e.title||'')}"></div>
        <div class="form-row"><label>Nr referencyjny</label><input name="reference_number" class="form-control" value="${esc(e.reference_number||'')}"></div>
        <div class="form-row"><label>Nazwa organu / nadawcy</label><input name="sender_name" class="form-control" value="${esc(e.sender_name||'')}"></div>
        <div class="form-row"><label>Nazwa odbiorcy</label><input name="receiver_name" class="form-control" value="${esc(e.receiver_name||'')}"></div>
        <div class="form-row"><label>Data nadania</label><input name="sent_date" type="date" class="form-control" value="${esc(e.sent_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Termin odbioru / odpowiedzi</label><input name="deadline_date" type="date" class="form-control" value="${esc(e.deadline_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Data dostarczenia / odczytania</label><input name="delivered_at" type="date" class="form-control" value="${esc(e.delivered_at?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Skrzynka eDO (EZD / URL)</label><input name="edo_box_id" class="form-control" placeholder="np. PL.29.10.001234" value="${esc(e.edo_box_id||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Treść / opis</label><textarea name="description" class="form-control" rows="3">${esc(e.description||'')}</textarea></div>
        <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(e.notes||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.EdoreczeniaModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
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
    if (!confirm('Usunąć rekord e-doręczenia?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('edo-modal'); if(m) m.style.display='none'; }
  window.EdoreczeniaModule = { renderEdoreczenia, _load, _openModal, _save, _delete, _closeModal };
})();
