(function () {
  'use strict';

  const API = window.WORKER_URL || '';
  const co  = () => localStorage.getItem('currentCompany') || '';

  const TYPE_LABEL = { training: 'Szkolenie', medical: 'Badanie lekarskie', psycho: 'Badanie psychol.', license_renewal: 'Odnowienie kat.' };
  const TYPE_ICON  = { training: 'ti-school', medical: 'ti-stethoscope', psycho: 'ti-brain', license_renewal: 'ti-id-badge-2' };
  const RESULT_CLR = { passed: '#22c55e', failed: '#ef4444', pending: '#f59e0b' };

  async function api(path, opts = {}) {
    const r = await fetch(`${API}/api/driver-training${path}?company=${co()}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      ...opts,
    });
    return r.json();
  }

  function renderDriverTraining() {
    const el = document.getElementById('page-driver-training');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-school"></i> Szkolenia i Badania Kierowców</h2>
        <button class="btn btn-primary" onclick="window.DriverTraining._openModal()"><i class="ti ti-plus"></i> Dodaj rekord</button>
      </div>
      <div id="training-alerts" style="margin-bottom:12px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="dt-filter-type" class="form-control" style="width:180px" onchange="window.DriverTraining._load()">
          <option value="">Wszystkie typy</option>
          ${Object.entries(TYPE_LABEL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <select id="dt-filter-result" class="form-control" style="width:150px" onchange="window.DriverTraining._load()">
          <option value="">Wszystkie wyniki</option>
          <option value="passed">Zaliczone</option>
          <option value="failed">Niezaliczone</option>
          <option value="pending">Oczekuje</option>
        </select>
        <input id="dt-search" class="form-control" style="width:200px" placeholder="Kierowca / tytuł..." oninput="window.DriverTraining._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Kierowca</th><th>Typ</th><th>Tytuł</th><th>Data od–do</th><th>Ważne do</th><th>Wynik</th><th>Koszt</th><th>Akcje</th></tr></thead>
        <tbody id="dt-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="dt-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.DriverTraining._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header"><h3 id="dt-modal-title">Szkolenie / Badanie</h3><button class="modal-close" onclick="window.DriverTraining._closeModal()">×</button></div>
          <div class="modal-body" id="dt-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const type   = document.getElementById('dt-filter-type')?.value || '';
    const result = document.getElementById('dt-filter-result')?.value || '';
    const q      = document.getElementById('dt-search')?.value || '';
    const tbody  = document.getElementById('dt-tbody');
    if (!tbody) return;
    const data = await api(`?type=${type}&result=${result}&q=${encodeURIComponent(q)}`);
    const list = data.records || [];
    _renderAlerts(data.expiring || []);
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak rekordów</td></tr>'; return; }
    tbody.innerHTML = list.map(r => {
      const expiringSoon = r.valid_until && _daysUntil(r.valid_until) <= 30;
      return `<tr ${expiringSoon ? 'style="background:rgba(245,158,11,0.1)"' : ''}>
        <td>${esc(r.driver_name || '—')}</td>
        <td><i class="ti ${TYPE_ICON[r.record_type]||'ti-file'}"></i> ${esc(TYPE_LABEL[r.record_type] || r.record_type || '—')}</td>
        <td>${esc(r.title || '—')}</td>
        <td>${esc(r.start_date?.slice(0,10)||'?')}${r.end_date ? ' – '+esc(r.end_date.slice(0,10)) : ''}</td>
        <td>${r.valid_until ? `<span style="color:${expiringSoon?'#f59e0b':'inherit'}">${esc(r.valid_until.slice(0,10))}${expiringSoon?' ⚠️':''}</span>` : '—'}</td>
        <td><span style="color:${RESULT_CLR[r.result]||'#999'}">${esc(r.result||'—')}</span></td>
        <td style="text-align:right">${r.cost_pln ? esc(r.cost_pln.toFixed(2)) + ' PLN' : '—'}</td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(r.id)}" onclick="window.DriverTraining._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(r.id)}" onclick="window.DriverTraining._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderAlerts(expiring) {
    const el = document.getElementById('training-alerts');
    if (!el) return;
    if (!expiring.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="alert-banner warning"><i class="ti ti-alert-triangle"></i> <strong>${expiring.length} rekord(ów) traci ważność w ciągu 30 dni:</strong> ${expiring.map(r=>`${esc(r.driver_name)} — ${esc(r.title)} (${esc(r.valid_until?.slice(0,10)||'')})`).join('; ')}</div>`;
  }

  function _daysUntil(dateStr) {
    return Math.floor((new Date(dateStr) - new Date()) / 86400000);
  }

  async function _openModal(id) {
    const modal = document.getElementById('dt-modal');
    const body  = document.getElementById('dt-modal-body');
    const title = document.getElementById('dt-modal-title');
    let r = {};
    if (id) { const d = await api(`/${id}`); r = d.record || {}; }
    title.textContent = id ? 'Edytuj rekord' : 'Nowy rekord szkolenia/badania';
    body.innerHTML = `
      <form id="dt-form" onsubmit="window.DriverTraining._save(event,'${esc(id||'')}')">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Kierowca *</label><input name="driver_name" class="form-control" required value="${esc(r.driver_name||'')}"></div>
          <div class="form-row"><label>Typ *</label>
            <select name="record_type" class="form-control">
              ${Object.entries(TYPE_LABEL).map(([v,l])=>`<option value="${v}" ${r.record_type===v?'selected':''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Tytuł szkolenia / badania *</label><input name="title" class="form-control" required value="${esc(r.title||'')}"></div>
          <div class="form-row"><label>Organizator</label><input name="provider" class="form-control" value="${esc(r.provider||'')}"></div>
          <div class="form-row"><label>Nr certyfikatu</label><input name="certificate_number" class="form-control" value="${esc(r.certificate_number||'')}"></div>
          <div class="form-row"><label>Data od</label><input name="start_date" type="date" class="form-control" value="${esc(r.start_date?.slice(0,10)||'')}"></div>
          <div class="form-row"><label>Data do</label><input name="end_date" type="date" class="form-control" value="${esc(r.end_date?.slice(0,10)||'')}"></div>
          <div class="form-row"><label>Ważne do</label><input name="valid_until" type="date" class="form-control" value="${esc(r.valid_until?.slice(0,10)||'')}"></div>
          <div class="form-row"><label>Wynik</label>
            <select name="result" class="form-control">
              <option value="passed" ${r.result==='passed'?'selected':''}>✅ Zaliczone</option>
              <option value="failed" ${r.result==='failed'?'selected':''}>❌ Niezaliczone</option>
              <option value="pending" ${r.result==='pending'?'selected':''}>⏳ Oczekuje</option>
            </select>
          </div>
          <div class="form-row"><label>Koszt (PLN)</label><input name="cost_pln" type="number" step="0.01" class="form-control" value="${r.cost_pln??''}"></div>
          <div class="form-row"><label>URL dokumentu</label><input name="document_url" type="url" class="form-control" placeholder="https://..." value="${esc(r.document_url||'')}"></div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(r.notes||'')}</textarea></div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.DriverTraining._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    if (body.document_url && !body.document_url.startsWith('https://')) { alert('URL dokumentu musi zaczynać się od https://'); return; }
    await api(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć rekord?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('dt-modal');
    if (m) m.style.display = 'none';
  }

  window.DriverTraining = { renderDriverTraining, _load, _openModal, _save, _delete, _closeModal };
})();
