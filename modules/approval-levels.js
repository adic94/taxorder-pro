(function () {
  'use strict';
  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';
  const tok = () => localStorage.getItem('cf_token') || '';
  const hdrs = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok()}` });

  async function apiFetch(path, opts = {}) {
    const r = await fetch(`${API()}/api/approval-levels${path}?company=${encodeURIComponent(co())}`, { headers: hdrs(), ...opts });
    return r.json();
  }

  async function renderApprovalLevels() {
    const el = document.getElementById('page-approval-levels');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-shield-check"></i> Poziomy Zatwierdzeń</h2>
        <button class="btn btn-primary" onclick="window.ApprovalLevelsModule._openForm()"><i class="ti ti-plus"></i> Dodaj poziom</button>
      </div>
      <p style="color:var(--text-muted);font-size:.9em;margin-bottom:16px">Konfiguracja progów kwotowych wymagających zatwierdzenia przez wskazaną osobę.</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Poziom</th><th>Min. kwota</th><th>Max. kwota</th><th>Zatwierdzający</th><th>Email</th><th>Typy dokumentów</th><th></th></tr></thead>
          <tbody id="al-tbody"><tr><td colspan="7" class="loading-row"><i class="ti ti-loader ti-spin"></i> Ładowanie…</td></tr></tbody>
        </table>
      </div>
      <div id="al-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.ApprovalLevelsModule._closeForm()">
        <div class="modal-box" style="max-width:500px">
          <div class="modal-header"><h3 id="al-modal-title">Nowy poziom zatwierdzenia</h3><button class="modal-close" onclick="window.ApprovalLevelsModule._closeForm()">×</button></div>
          <div class="modal-body">
            <form id="al-form" onsubmit="window.ApprovalLevelsModule._save(event)">
              <input type="hidden" name="id">
              <div class="form-row"><label>Poziom (nr kolejny) *</label><input name="level" type="number" min="1" class="form-control" required placeholder="1"></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-row"><label>Kwota od (zł)</label><input name="min_amount" type="number" min="0" class="form-control" placeholder="0"></div>
                <div class="form-row"><label>Kwota do (zł)</label><input name="max_amount" type="number" min="0" class="form-control" placeholder="999999"></div>
              </div>
              <div class="form-row"><label>Imię i nazwisko zatwierdzającego *</label><input name="approver_name" class="form-control" required placeholder="Jan Kowalski"></div>
              <div class="form-row"><label>Email zatwierdzającego *</label><input name="approver_email" type="email" class="form-control" required placeholder="jan.kowalski@firma.pl"></div>
              <div class="form-row"><label>Typy dokumentów (rozdziel przecinkami)</label><input name="entity_types" class="form-control" placeholder="invoice,order,contract"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="window.ApprovalLevelsModule._closeForm()">Anuluj</button>
                <button type="submit" class="btn btn-primary"><i class="ti ti-check"></i> Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      </div>`;
    await _load();
  }

  async function _load() {
    const tbody = document.getElementById('al-tbody');
    if (!tbody) return;
    try {
      const data = await apiFetch('');
      const rows = data.levels || [];
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Brak skonfigurowanych poziomów</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>${esc(String(r.level))}</td>
          <td>${r.min_amount != null ? Number(r.min_amount).toLocaleString('pl-PL') + ' zł' : '—'}</td>
          <td>${r.max_amount != null ? Number(r.max_amount).toLocaleString('pl-PL') + ' zł' : '—'}</td>
          <td>${esc(r.approver_name || '—')}</td>
          <td>${esc(r.approver_email || '—')}</td>
          <td>${esc(r.entity_types || '—')}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-gray btn-sm" data-id="${esc(String(r.id))}" onclick="window.ApprovalLevelsModule._edit(this.dataset.id)"><i class="ti ti-edit"></i></button>
            <button class="btn btn-gray btn-sm" style="color:var(--red)" data-id="${esc(String(r.id))}" onclick="window.ApprovalLevelsModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Błąd ładowania danych</td></tr>';
    }
  }

  function _openForm(data = {}) {
    const modal = document.getElementById('al-modal');
    const form  = document.getElementById('al-form');
    if (!modal || !form) return;
    document.getElementById('al-modal-title').textContent = data.id ? 'Edytuj poziom' : 'Nowy poziom zatwierdzenia';
    form.reset();
    ['id', 'level', 'min_amount', 'max_amount', 'approver_name', 'approver_email', 'entity_types'].forEach(k => {
      if (form[k] && data[k] != null) form[k].value = data[k];
    });
    modal.style.display = 'flex';
  }

  function _closeForm() {
    const modal = document.getElementById('al-modal');
    if (modal) modal.style.display = 'none';
  }

  async function _edit(id) {
    try {
      const data = await apiFetch(`/${id}`);
      _openForm(data.level || data);
    } catch { _openForm({}); }
  }

  async function _save(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    const id = body.id;
    delete body.id;
    ['min_amount', 'max_amount', 'level'].forEach(k => { if (body[k] !== '') body[k] = Number(body[k]); });
    try {
      await apiFetch(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      _closeForm();
      await _load();
    } catch { if (typeof toast === 'function') toast('Błąd zapisu'); }
  }

  async function _delete(id) {
    if (!confirm('Usunąć ten poziom zatwierdzenia?')) return;
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' });
      await _load();
    } catch { if (typeof toast === 'function') toast('Błąd usuwania'); }
  }

  window.ApprovalLevelsModule = { renderApprovalLevels, _load, _openForm, _closeForm, _edit, _save, _delete };
})();
