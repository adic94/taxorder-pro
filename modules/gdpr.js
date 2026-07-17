(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';

  const TYPE_LABEL  = { consent: 'Zgoda', request: 'Wniosek', deletion: 'Usunięcie danych', export: 'Eksport danych', breach: 'Naruszenie' };
  const TYPE_ICON   = { consent: '✅', request: '📋', deletion: '🗑️', export: '📤', breach: '🚨' };
  const TYPE_CLR    = { consent: '#22c55e', request: '#3b82f6', deletion: '#ef4444', export: '#8b5cf6', breach: '#dc2626' };
  const STATUS_CLR  = { active: '#22c55e', fulfilled: '#3b82f6', deleted: '#94a3b8', expired: '#f59e0b' };
  const STATUS_LABEL= { active: 'Aktywny', fulfilled: 'Zrealizowany', deleted: 'Usunięty', expired: 'Wygasły' };

  async function api(path, opts = {}) {
    const r = await fetch(`${API()}/api/gdpr${path}?company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderGdpr() {
    const el = document.getElementById('page-gdpr');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-shield-lock"></i> RODO / ADO — Ochrona Danych Osobowych</h2>
        <button class="btn btn-primary" onclick="window.GdprModule._openModal()"><i class="ti ti-plus"></i> Nowy rekord RODO</button>
      </div>
      <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.3);border-radius:8px;padding:12px;margin-bottom:16px;font-size:.9em">
        <strong>Administrator Danych Osobowych (ADO)</strong> — rejestruj zgody, wnioski podmiotów danych, naruszenia i działania podjęte w myśl Rozporządzenia RODO (UE 2016/679).
      </div>
      <div id="gdpr-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="gdpr-filter-type" class="form-control" style="width:180px" onchange="window.GdprModule._load()">
          <option value="">Wszystkie typy</option>
          ${Object.entries(TYPE_LABEL).map(([v,l])=>`<option value="${v}">${TYPE_ICON[v]} ${esc(l)}</option>`).join('')}
        </select>
        <select id="gdpr-filter-status" class="form-control" style="width:160px" onchange="window.GdprModule._load()">
          <option value="">Wszystkie statusy</option>
          ${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="gdpr-search" class="form-control" style="width:200px" placeholder="Imię / email..." oninput="window.GdprModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Typ</th><th>Podmiot</th><th>Email</th><th>Opis</th><th>Podstawa prawna</th><th>Retencja do</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="gdpr-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="gdpr-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.GdprModule._closeModal()">
        <div class="modal-box" style="max-width:580px">
          <div class="modal-header"><h3 id="gdpr-modal-title">Rekord RODO</h3><button class="modal-close" onclick="window.GdprModule._closeModal()">×</button></div>
          <div class="modal-body" id="gdpr-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const type   = document.getElementById('gdpr-filter-type')?.value || '';
    const status = document.getElementById('gdpr-filter-status')?.value || '';
    const q      = document.getElementById('gdpr-search')?.value || '';
    const tbody  = document.getElementById('gdpr-tbody');
    if (!tbody) return;
    const data = await api(`?type=${type}&status=${status}&q=${encodeURIComponent(q)}`);
    const list = data.records || [];
    _renderStats(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak rekordów RODO</td></tr>'; return; }
    tbody.innerHTML = list.map(r => {
      const expiring = r.retention_until && _daysLeft(r.retention_until) <= 14 && r.status === 'active';
      return `<tr ${expiring ? 'style="background:rgba(245,158,11,.08)"' : ''}>
        <td><span style="color:${TYPE_CLR[r.record_type]||'#999'}">${TYPE_ICON[r.record_type]||'?'} ${esc(TYPE_LABEL[r.record_type]||r.record_type)}</span></td>
        <td>${esc(r.subject_name||'—')}<br><small style="color:#888">${esc(r.subject_type||'')}</small></td>
        <td>${esc(r.subject_email||'—')}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.description||'')}">${esc(r.description||'—')}</td>
        <td><small>${esc(r.legal_basis||'—')}</small></td>
        <td>${r.retention_until ? `<span style="color:${expiring?'#f59e0b':'inherit'}">${esc(r.retention_until.slice(0,10))}${expiring?' ⚠️':''}</span>` : '—'}</td>
        <td><span class="pill" style="background:${STATUS_CLR[r.status]||'#999'}20;color:${STATUS_CLR[r.status]||'#999'}">${esc(STATUS_LABEL[r.status]||r.status)}</span></td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(r.id)}" onclick="window.GdprModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(r.id)}" onclick="window.GdprModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('gdpr-stats');
    if (!el) return;
    el.innerHTML = [
      { lbl: 'Aktywne zgody', val: s.consent_active || 0, c: '#22c55e' },
      { lbl: 'Otwarte wnioski', val: s.requests_open || 0, c: '#3b82f6' },
      { lbl: 'Naruszenia', val: s.breaches || 0, c: '#ef4444' },
      { lbl: 'Wygasające (14 dni)', val: s.expiring_soon || 0, c: '#f59e0b' },
    ].map(i => `<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.2em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  function _daysLeft(dateStr) {
    return Math.floor((new Date(dateStr) - new Date()) / 86400000);
  }

  async function _openModal(id) {
    const modal = document.getElementById('gdpr-modal');
    const body  = document.getElementById('gdpr-modal-body');
    const title = document.getElementById('gdpr-modal-title');
    let r = {};
    if (id) { const d = await api(`/${id}`); r = d.record || {}; }
    title.textContent = id ? 'Edytuj rekord RODO' : 'Nowy rekord RODO';
    body.innerHTML = `
      <form id="gdpr-form" onsubmit="window.GdprModule._save(event,'${esc(id||'')}')">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Typ rekordu *</label>
            <select name="record_type" class="form-control" required>
              ${Object.entries(TYPE_LABEL).map(([v,l])=>`<option value="${v}" ${r.record_type===v?'selected':''}>${TYPE_ICON[v]} ${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Typ podmiotu</label>
            <select name="subject_type" class="form-control">
              <option value="driver" ${r.subject_type==='driver'?'selected':''}>Kierowca</option>
              <option value="employee" ${r.subject_type==='employee'?'selected':''}>Pracownik</option>
              <option value="client" ${r.subject_type==='client'?'selected':''}>Klient</option>
            </select>
          </div>
          <div class="form-row"><label>Imię i nazwisko podmiotu</label><input name="subject_name" class="form-control" value="${esc(r.subject_name||'')}"></div>
          <div class="form-row"><label>Email podmiotu</label><input name="subject_email" type="email" class="form-control" value="${esc(r.subject_email||'')}"></div>
          <div class="form-row" style="grid-column:1/-1"><label>Opis / cel przetwarzania</label><textarea name="description" class="form-control" rows="2">${esc(r.description||'')}</textarea></div>
          <div class="form-row" style="grid-column:1/-1"><label>Podstawa prawna (art. RODO)</label><input name="legal_basis" class="form-control" placeholder="np. art. 6 ust. 1 lit. b RODO" value="${esc(r.legal_basis||'')}"></div>
          <div class="form-row"><label>Retencja (dni)</label><input name="retention_days" type="number" class="form-control" value="${r.retention_days??''}"></div>
          <div class="form-row"><label>Retencja do</label><input name="retention_until" type="date" class="form-control" value="${esc(r.retention_until?.slice(0,10)||'')}"></div>
          <div class="form-row"><label>Status</label>
            <select name="status" class="form-control">
              ${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}" ${r.status===v?'selected':''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Obsłużył(a)</label><input name="handled_by" class="form-control" value="${esc(r.handled_by||'')}"></div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(r.notes||'')}</textarea></div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.GdprModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
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
    if (!confirm('Usunąć rekord RODO?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('gdpr-modal');
    if (m) m.style.display = 'none';
  }

  window.GdprModule = { renderGdpr, _load, _openModal, _save, _delete, _closeModal };
})();
