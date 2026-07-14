(function () {
  'use strict';

  const API = window.WORKER_URL || '';
  const co  = () => localStorage.getItem('currentCompany') || '';

  const STATUS_LABEL = { pending: 'Oczekuje', sent: 'Wysłana', accepted: 'Zaakceptowana', rejected: 'Odrzucona' };
  const STATUS_CLR   = { pending: '#f59e0b', sent: '#3b82f6', accepted: '#22c55e', rejected: '#ef4444' };

  async function api(path, opts = {}) {
    const r = await fetch(`${API}/api/ksef${path}?company=${co()}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      ...opts,
    });
    return r.json();
  }

  function renderKsef() {
    const el = document.getElementById('page-ksef');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-file-invoice"></i> KSeF — e-Faktury</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-outline" onclick="window.KsefModule._syncNbp()"><i class="ti ti-refresh"></i> Synchronizuj z KSeF</button>
          <button class="btn btn-primary" onclick="window.KsefModule._openModal()"><i class="ti ti-plus"></i> Nowa faktura KSeF</button>
        </div>
      </div>
      <div class="ksef-stats" id="ksef-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div class="ksef-filters" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="ksef-filter-status" class="form-control" style="width:160px" onchange="window.KsefModule._load()">
          <option value="">Wszystkie statusy</option>
          <option value="pending">Oczekuje</option>
          <option value="sent">Wysłana</option>
          <option value="accepted">Zaakceptowana</option>
          <option value="rejected">Odrzucona</option>
        </select>
        <input id="ksef-search" class="form-control" style="width:220px" placeholder="Szukaj (numer, NIP...)" oninput="window.KsefModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table" id="ksef-table">
        <thead><tr><th>Nr faktury</th><th>Nr KSeF</th><th>Status</th><th>NIP sprzedawcy</th><th>NIP nabywcy</th><th>Kwota brutto</th><th>Data KSeF</th><th>Akcje</th></tr></thead>
        <tbody id="ksef-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="ksef-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.KsefModule._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header"><h3 id="ksef-modal-title">Faktura KSeF</h3><button class="modal-close" onclick="window.KsefModule._closeModal()">×</button></div>
          <div class="modal-body" id="ksef-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const status = document.getElementById('ksef-filter-status')?.value || '';
    const q      = document.getElementById('ksef-search')?.value || '';
    const tbody  = document.getElementById('ksef-tbody');
    if (!tbody) return;
    const data = await api(`?status=${status}&q=${encodeURIComponent(q)}`);
    const list = data.invoices || [];
    _renderStats(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak faktur KSeF</td></tr>'; return; }
    tbody.innerHTML = list.map(inv => `
      <tr>
        <td>${esc(inv.invoice_number)}</td>
        <td>${inv.ksef_number ? esc(inv.ksef_number) : '<span style="color:#999">—</span>'}</td>
        <td><span class="pill" style="background:${STATUS_CLR[inv.ksef_status] || '#999'}20;color:${STATUS_CLR[inv.ksef_status] || '#999'}">${esc(STATUS_LABEL[inv.ksef_status] || inv.ksef_status)}</span></td>
        <td>${esc(inv.seller_nip || '—')}</td>
        <td>${esc(inv.buyer_nip || '—')}</td>
        <td style="text-align:right">${inv.gross_pln != null ? esc(inv.gross_pln.toFixed(2)) + ' PLN' : '—'}</td>
        <td>${inv.ksef_date ? esc(inv.ksef_date.slice(0,10)) : '—'}</td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(inv.id)}" onclick="window.KsefModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          ${inv.ksef_status === 'pending' ? `<button class="btn-icon" title="Wyślij do KSeF" data-id="${esc(inv.id)}" onclick="window.KsefModule._send(this.dataset.id)"><i class="ti ti-send"></i></button>` : ''}
          ${inv.upo_url && inv.upo_url.startsWith('https://') ? `<a class="btn-icon" href="${esc(inv.upo_url)}" target="_blank" title="UPO"><i class="ti ti-file-check"></i></a>` : ''}
          <button class="btn-icon danger" title="Usuń" data-id="${esc(inv.id)}" onclick="window.KsefModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('ksef-stats');
    if (!el) return;
    const items = [
      { lbl: 'Łącznie', val: s.total || 0, color: '#64748b' },
      { lbl: 'Oczekuje', val: s.pending || 0, color: '#f59e0b' },
      { lbl: 'Zaakceptowane', val: s.accepted || 0, color: '#22c55e' },
      { lbl: 'Odrzucone', val: s.rejected || 0, color: '#ef4444' },
    ];
    el.innerHTML = items.map(i => `<div class="stat-chip" style="border-color:${i.color}"><span style="color:${i.color};font-size:1.3em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('ksef-modal');
    const body  = document.getElementById('ksef-modal-body');
    const title = document.getElementById('ksef-modal-title');
    let inv = {};
    if (id) {
      const d = await api(`/${id}`);
      inv = d.invoice || {};
    }
    title.textContent = id ? 'Edytuj fakturę KSeF' : 'Nowa faktura KSeF';
    body.innerHTML = `
      <form id="ksef-form" onsubmit="window.KsefModule._save(event,'${esc(id||'')}')">
        <div class="form-row"><label>Numer faktury *</label><input name="invoice_number" class="form-control" required value="${esc(inv.invoice_number||'')}"></div>
        <div class="form-row"><label>NIP sprzedawcy</label><input name="seller_nip" class="form-control" maxlength="10" value="${esc(inv.seller_nip||'')}"></div>
        <div class="form-row"><label>NIP nabywcy</label><input name="buyer_nip" class="form-control" maxlength="10" value="${esc(inv.buyer_nip||'')}"></div>
        <div class="form-row"><label>Kwota brutto (PLN)</label><input name="gross_pln" type="number" step="0.01" class="form-control" value="${inv.gross_pln ?? ''}"></div>
        <div class="form-row"><label>Status KSeF</label>
          <select name="ksef_status" class="form-control">
            ${['pending','sent','accepted','rejected'].map(s=>`<option value="${s}" ${inv.ksef_status===s?'selected':''}>${esc(STATUS_LABEL[s])}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Numer KSeF</label><input name="ksef_number" class="form-control" value="${esc(inv.ksef_number||'')}"></div>
        <div class="form-row"><label>Data KSeF</label><input name="ksef_date" type="date" class="form-control" value="${esc(inv.ksef_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>URL UPO</label><input name="upo_url" type="url" class="form-control" placeholder="https://..." value="${esc(inv.upo_url||'')}"></div>
        <div class="form-row"><label>Komunikat błędu</label><textarea name="error_message" class="form-control" rows="2">${esc(inv.error_message||'')}</textarea></div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.KsefModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (body.upo_url && !body.upo_url.startsWith('https://')) { alert('URL UPO musi zaczynać się od https://'); return; }
    const method = id ? 'PUT' : 'POST';
    const path   = id ? `/${id}` : '';
    await api(path, { method, body: JSON.stringify(body) });
    _closeModal();
    _load();
  }

  async function _send(id) {
    if (!confirm('Wysłać fakturę do KSeF? (symulacja — wymaga integracji z API MF)')) return;
    await api(`/${id}/send`, { method: 'POST', body: JSON.stringify({}) });
    _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć rekord KSeF?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  async function _syncNbp() {
    alert('Synchronizacja z KSeF API (Ministerstwo Finansów) — wymaga certyfikatu i tokenu autoryzacyjnego MF.\n\nAby uruchomić: skonfiguruj token w Ustawieniach → Integracje → KSeF.');
  }

  function _closeModal() {
    const m = document.getElementById('ksef-modal');
    if (m) m.style.display = 'none';
  }

  window.KsefModule = { renderKsef, _load, _openModal, _save, _send, _delete, _syncNbp, _closeModal };
})();
