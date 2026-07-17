(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const CAT_LBL = { fuel:'Paliwo', service:'Serwis', insurance:'Ubezpieczenie', tires:'Opony', parts:'Części zamienne', leasing:'Leasing', rental:'Wynajem', other:'Inny' };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/suppliers${path}?company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderSuppliers() {
    const el = document.getElementById('page-suppliers');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-building-factory-2"></i> Baza Dostawców</h2>
        <button class="btn btn-primary" onclick="window.SuppliersModule._openModal()"><i class="ti ti-plus"></i> Nowy dostawca</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="supp-filter-cat" class="form-control" style="width:180px" onchange="window.SuppliersModule._load()">
          <option value="">Wszystkie kategorie</option>
          ${Object.entries(CAT_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="supp-search" class="form-control" style="width:220px" placeholder="Nazwa / NIP / miasto..." oninput="window.SuppliersModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Nazwa</th><th>Kategoria</th><th>NIP</th><th>Miasto</th><th>Kontakt</th><th>Ocena</th><th>Warunki płatności</th><th>Akcje</th></tr></thead>
        <tbody id="supp-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="supp-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.SuppliersModule._closeModal()">
        <div class="modal-box" style="max-width:580px">
          <div class="modal-header"><h3 id="supp-modal-title">Dostawca</h3><button class="modal-close" onclick="window.SuppliersModule._closeModal()">×</button></div>
          <div class="modal-body" id="supp-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const cat = document.getElementById('supp-filter-cat')?.value || '';
    const q   = document.getElementById('supp-search')?.value || '';
    const tbody = document.getElementById('supp-tbody');
    if (!tbody) return;
    const data = await api(`?cat=${cat}&q=${encodeURIComponent(q)}`);
    const list = data.suppliers || [];
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak dostawców</td></tr>'; return; }
    tbody.innerHTML = list.map(s => `<tr>
      <td><strong>${esc(s.name)}</strong></td>
      <td><span class="pill">${esc(CAT_LBL[s.category]||s.category||'—')}</span></td>
      <td>${esc(s.nip||'—')}</td>
      <td>${esc(s.city||'—')}</td>
      <td>${s.contact_name?esc(s.contact_name):'—'}${s.contact_phone?`<br><small>${esc(s.contact_phone)}</small>`:''}</td>
      <td>${'⭐'.repeat(Math.min(5,Math.max(0,s.rating??0)))} (${s.rating??0}/5)</td>
      <td>${s.payment_terms_days??30} dni</td>
      <td>
        <button class="btn-icon" data-id="${esc(s.id)}" onclick="window.SuppliersModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
        <button class="btn-icon danger" data-id="${esc(s.id)}" onclick="window.SuppliersModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('supp-modal');
    const body  = document.getElementById('supp-modal-body');
    document.getElementById('supp-modal-title').textContent = id ? 'Edytuj dostawcę' : 'Nowy dostawca';
    let s = {};
    if (id) { const d = await api(`/${id}`); s = d.supplier || {}; }
    body.innerHTML = `<form id="supp-form" onsubmit="window.SuppliersModule._save(event,'${esc(id||'')}')">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row" style="grid-column:1/-1"><label>Nazwa *</label><input name="name" class="form-control" required value="${esc(s.name||'')}"></div>
        <div class="form-row"><label>Kategoria</label>
          <select name="category" class="form-control">
            ${Object.entries(CAT_LBL).map(([v,l])=>`<option value="${v}" ${s.category===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>NIP</label><input name="nip" class="form-control" maxlength="10" value="${esc(s.nip||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Adres</label><input name="address" class="form-control" value="${esc(s.address||'')}"></div>
        <div class="form-row"><label>Miasto</label><input name="city" class="form-control" value="${esc(s.city||'')}"></div>
        <div class="form-row"><label>Osoba kontaktowa</label><input name="contact_name" class="form-control" value="${esc(s.contact_name||'')}"></div>
        <div class="form-row"><label>Telefon kontaktowy</label><input name="contact_phone" class="form-control" value="${esc(s.contact_phone||'')}"></div>
        <div class="form-row"><label>Email kontaktowy</label><input name="contact_email" type="email" class="form-control" value="${esc(s.contact_email||'')}"></div>
        <div class="form-row"><label>Ocena (1-5)</label>
          <select name="rating" class="form-control">
            ${[1,2,3,4,5].map(n=>`<option value="${n}" ${(s.rating??3)===n?'selected':''}>${'⭐'.repeat(n)} ${n}/5</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Termin płatności (dni)</label><input name="payment_terms_days" type="number" class="form-control" value="${s.payment_terms_days??30}"></div>
        <div class="form-row"><label>Aktywny</label>
          <select name="active" class="form-control">
            <option value="1" ${s.active!==0?'selected':''}>Tak</option>
            <option value="0" ${s.active===0?'selected':''}>Nie</option>
          </select>
        </div>
        <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(s.notes||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.SuppliersModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
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
    if (!confirm('Usunąć dostawcę?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('supp-modal'); if(m) m.style.display='none'; }
  window.SuppliersModule = { renderSuppliers, _load, _openModal, _save, _delete, _closeModal };
})();
