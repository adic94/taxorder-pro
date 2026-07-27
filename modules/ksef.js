(function () {
  'use strict';

  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  const STATUS_LABEL = {
    pending:        'Oczekuje',
    sent:           'Wysłana',
    accepted:       'Zaakceptowana',
    rejected:       'Odrzucona',
    offline_queued: 'W kolejce offline',
  };
  const STATUS_CLR = {
    pending:        '#f59e0b',
    sent:           '#3b82f6',
    accepted:       '#22c55e',
    rejected:       '#ef4444',
    offline_queued: '#d97706',
  };

  let _tab = 'invoices'; // invoices | queue | config

  async function api(path, opts = {}) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${API()}/api/ksef${path}${sep}company=${co()}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
      ...opts,
    });
    return r.json();
  }

  // ─── Main render ──────────────────────────────────────────────────────────

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
      <div id="ksef-tabs" style="display:flex;gap:0;border-bottom:2px solid var(--border,#e2e8f0);margin-bottom:16px">
        <button class="ksef-tab-btn" data-tab="invoices" onclick="window.KsefModule._switchTab('invoices')" style="padding:8px 18px;border:none;background:none;cursor:pointer;font-weight:600;border-bottom:2px solid transparent;margin-bottom:-2px">
          <i class="ti ti-file-invoice"></i> Faktury
        </button>
        <button class="ksef-tab-btn" data-tab="queue" onclick="window.KsefModule._switchTab('queue')" style="padding:8px 18px;border:none;background:none;cursor:pointer;font-weight:600;border-bottom:2px solid transparent;margin-bottom:-2px">
          <i class="ti ti-clock"></i> Kolejka offline
        </button>
        <button class="ksef-tab-btn" data-tab="config" onclick="window.KsefModule._switchTab('config')" style="padding:8px 18px;border:none;background:none;cursor:pointer;font-weight:600;border-bottom:2px solid transparent;margin-bottom:-2px">
          <i class="ti ti-settings"></i> Konfiguracja
        </button>
      </div>

      <div id="ksef-tab-invoices">
        <div id="ksef-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <select id="ksef-filter-status" class="form-control" style="width:190px" onchange="window.KsefModule._load()">
            <option value="">Wszystkie statusy</option>
            <option value="pending">Oczekuje</option>
            <option value="sent">Wysłana</option>
            <option value="accepted">Zaakceptowana</option>
            <option value="rejected">Odrzucona</option>
            <option value="offline_queued">W kolejce offline</option>
          </select>
          <input id="ksef-search" class="form-control" style="width:220px" placeholder="Szukaj (numer, NIP...)" oninput="window.KsefModule._load()">
        </div>
        <div class="table-wrap"><table class="data-table" id="ksef-table">
          <thead><tr>
            <th>Nr faktury</th><th>Nr KSeF</th><th>Status</th>
            <th>NIP sprzedawcy</th><th>NIP nabywcy</th><th>Kwota brutto</th>
            <th>Data KSeF</th><th>UPO ref.</th><th>Akcje</th>
          </tr></thead>
          <tbody id="ksef-tbody"><tr><td colspan="9" class="loading-row">Ładowanie...</td></tr></tbody>
        </table></div>
      </div>

      <div id="ksef-tab-queue" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div>
            <h3 style="margin:0 0 4px">Kolejka offline</h3>
            <p style="margin:0;font-size:.85em;color:#64748b">Faktury, których nie udało się wysłać do KSeF — zostaną ponowione automatycznie.</p>
          </div>
          <button class="btn btn-outline" onclick="window.KsefModule._retryAll()"><i class="ti ti-refresh"></i> Retry wszystkie</button>
        </div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr>
            <th>Nr faktury</th><th>Próby</th><th>Ostatni błąd</th><th>Następna próba</th><th>Status kolejki</th><th>Dodano</th>
          </tr></thead>
          <tbody id="ksef-queue-tbody"><tr><td colspan="6" class="loading-row">Ładowanie...</td></tr></tbody>
        </table></div>
      </div>

      <div id="ksef-tab-config" style="display:none">
        <div style="max-width:520px">
          <h3 style="margin-bottom:16px">Konfiguracja KSeF</h3>
          <div id="ksef-config-body"><p class="loading-row">Ładowanie...</p></div>
        </div>
      </div>

      <div id="ksef-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.KsefModule._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header">
            <h3 id="ksef-modal-title">Faktura KSeF</h3>
            <button class="modal-close" onclick="window.KsefModule._closeModal()">×</button>
          </div>
          <div class="modal-body" id="ksef-modal-body"></div>
        </div>
      </div>`;
    _switchTab(_tab);
  }

  // ─── Tab switching ────────────────────────────────────────────────────────

  function _switchTab(tab) {
    _tab = tab;
    ['invoices', 'queue', 'config'].forEach(t => {
      const panel = document.getElementById(`ksef-tab-${t}`);
      if (panel) panel.style.display = t === tab ? '' : 'none';
      const btn = document.querySelector(`.ksef-tab-btn[data-tab="${t}"]`);
      if (btn) {
        btn.style.borderBottomColor = t === tab ? 'var(--primary,#3b82f6)' : 'transparent';
        btn.style.color             = t === tab ? 'var(--primary,#3b82f6)' : '';
      }
    });
    if (tab === 'invoices') _load();
    else if (tab === 'queue')  _loadQueue();
    else if (tab === 'config') _loadConfig();
  }

  // ─── Invoices tab ─────────────────────────────────────────────────────────

  async function _load() {
    const status = document.getElementById('ksef-filter-status')?.value || '';
    const q      = document.getElementById('ksef-search')?.value || '';
    const tbody  = document.getElementById('ksef-tbody');
    if (!tbody) return;
    const data = await api(`?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
    const list = data.invoices || [];
    _renderStats(data.stats || {});
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Brak faktur KSeF</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(inv => {
      const clr   = STATUS_CLR[inv.ksef_status] || '#999';
      const lbl   = STATUS_LABEL[inv.ksef_status] || inv.ksef_status;
      const canSend = inv.ksef_status === 'pending' || inv.ksef_status === 'offline_queued';
      const upoRef  = inv.upo_reference_number;
      return `
      <tr>
        <td>${esc(inv.invoice_number)}</td>
        <td>${inv.ksef_number ? esc(inv.ksef_number) : '<span style="color:#999">—</span>'}</td>
        <td><span class="pill" style="background:${clr}20;color:${clr}">${esc(lbl)}</span></td>
        <td>${esc(inv.seller_nip || '—')}</td>
        <td>${esc(inv.buyer_nip || '—')}</td>
        <td style="text-align:right">${inv.gross_pln != null ? esc(inv.gross_pln.toFixed(2)) + ' PLN' : '—'}</td>
        <td>${inv.ksef_date ? esc(inv.ksef_date.slice(0, 10)) : '—'}</td>
        <td>${upoRef
          ? `<span style="font-size:.8em;color:#64748b" title="${esc(upoRef)}">${esc(upoRef.slice(0, 14))}${upoRef.length > 14 ? '…' : ''}</span>`
          : '<span style="color:#999">—</span>'}</td>
        <td style="white-space:nowrap">
          <button class="btn-icon" title="Edytuj" data-id="${esc(inv.id)}" onclick="window.KsefModule._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          ${canSend ? `<button class="btn-icon" title="Wyślij do KSeF" data-id="${esc(inv.id)}" onclick="window.KsefModule._send(this.dataset.id)"><i class="ti ti-send"></i></button>` : ''}
          ${inv.upo_url && inv.upo_url.startsWith('https://') ? `<a class="btn-icon" href="${esc(inv.upo_url)}" target="_blank" rel="noopener" title="Pobierz UPO"><i class="ti ti-file-check"></i></a>` : ''}
          <button class="btn-icon danger" title="Usuń" data-id="${esc(inv.id)}" onclick="window.KsefModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('ksef-stats');
    if (!el) return;
    const items = [
      { lbl: 'Łącznie',          val: s.total          || 0, color: '#64748b' },
      { lbl: 'Oczekuje',         val: s.pending         || 0, color: '#f59e0b' },
      { lbl: 'Zaakceptowane',    val: s.accepted        || 0, color: '#22c55e' },
      { lbl: 'Odrzucone',        val: s.rejected        || 0, color: '#ef4444' },
      { lbl: 'Kolejka offline',  val: s.offline_queued  || 0, color: '#d97706' },
    ];
    el.innerHTML = items.map(i =>
      `<div class="stat-chip" style="border-color:${i.color}">` +
        `<span style="color:${i.color};font-size:1.3em;font-weight:700">${i.val}</span>` +
        `<span>${esc(i.lbl)}</span>` +
      `</div>`
    ).join('');
  }

  // ─── Offline queue tab ────────────────────────────────────────────────────

  async function _loadQueue() {
    const tbody = document.getElementById('ksef-queue-tbody');
    if (!tbody) return;
    const data = await api('/offline-queue');
    const list = data.queue || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Kolejka jest pusta</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(item => {
      const isFatal  = item.status === 'failed_permanent';
      const nextText = isFatal
        ? '<span style="color:#ef4444;font-weight:600">Trwały błąd</span>'
        : esc((item.next_retry_at || '—').slice(0, 19).replace('T', ' '));
      const statusBadge = isFatal
        ? '<span class="pill" style="background:#ef444420;color:#ef4444">Stały błąd</span>'
        : '<span class="pill" style="background:#d9770620;color:#d97706">W kolejce</span>';
      return `
      <tr>
        <td>${esc(item.invoice_number)}</td>
        <td>${item.attempt_count ?? 0}</td>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(item.error_last || '')}">${esc((item.error_last || '—').slice(0, 80))}</td>
        <td>${nextText}</td>
        <td>${statusBadge}</td>
        <td>${esc((item.created_at || '—').slice(0, 19).replace('T', ' '))}</td>
      </tr>`;
    }).join('');
  }

  async function _retryAll() {
    if (!confirm('Ponowić wysyłkę wszystkich elementów w kolejce offline?')) return;
    const res = await api('/retry-all', { method: 'POST', body: JSON.stringify({}) });
    alert(`Ponowiono: ${res.retried ?? 0} faktur.`);
    _loadQueue();
    _load();
  }

  // ─── Config tab ───────────────────────────────────────────────────────────

  async function _loadConfig() {
    const el = document.getElementById('ksef-config-body');
    if (!el) return;
    const data = await api('/config');
    const cfg  = data.config || {};
    el.innerHTML = `
      <form id="ksef-config-form" onsubmit="window.KsefModule._saveConfig(event)">
        <div class="form-row">
          <label>NIP firmy</label>
          <input name="nip" class="form-control" maxlength="10" placeholder="1234567890" value="${esc(cfg.nip || '')}">
        </div>
        <div class="form-row">
          <label>Środowisko KSeF</label>
          <select name="env" class="form-control">
            <option value="test" ${cfg.env !== 'prod' ? 'selected' : ''}>Test — ksef-test.mf.gov.pl</option>
            <option value="prod" ${cfg.env === 'prod' ? 'selected' : ''}>Produkcja — ksef.mf.gov.pl</option>
          </select>
        </div>
        <div class="form-row">
          <label>Token sesji KSeF</label>
          <input name="token" type="password" class="form-control" placeholder="Zostaw puste, aby nie zmieniać" autocomplete="new-password">
          <small style="color:#64748b">Token jest przechowywany po stronie serwera i nigdy nie jest wyświetlany.</small>
        </div>
        <div class="form-row" style="align-items:center;gap:12px;flex-direction:row">
          <label style="margin:0;min-width:0">Automatyczne wysyłanie faktur</label>
          <input type="checkbox" id="ksef-auto-send" ${cfg.auto_send_enabled ? 'checked' : ''} style="width:auto;margin:0">
        </div>
        ${cfg.token_expires_at
          ? `<p style="font-size:.85em;color:#64748b;margin:4px 0">Token wygasa: ${esc(cfg.token_expires_at.slice(0, 19).replace('T', ' '))}</p>`
          : ''}
        ${cfg.last_sync_at
          ? `<p style="font-size:.85em;color:#64748b;margin:4px 0">Ostatnia synchronizacja: ${esc(cfg.last_sync_at.slice(0, 19).replace('T', ' '))}</p>`
          : ''}
        <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary"><i class="ti ti-device-floppy"></i> Zapisz konfigurację</button>
          <button type="button" class="btn btn-outline" onclick="window.KsefModule._ksefAuth()"><i class="ti ti-key"></i> Pobierz token sesji z KSeF</button>
        </div>
      </form>`;
  }

  async function _saveConfig(e) {
    e.preventDefault();
    const f = e.target;
    const body = {
      nip:               (f.querySelector('[name="nip"]')?.value || '').trim(),
      env:               f.querySelector('[name="env"]')?.value || 'test',
      token:             f.querySelector('[name="token"]')?.value || '',
      auto_send_enabled: f.querySelector('#ksef-auto-send')?.checked ? 1 : 0,
    };
    const res = await api('/config', { method: 'PUT', body: JSON.stringify(body) });
    if (res.ok) {
      alert('Konfiguracja KSeF zapisana.');
      _loadConfig();
    } else {
      alert('Błąd zapisu konfiguracji.');
    }
  }

  async function _ksefAuth() {
    if (!confirm('Pobrać token sesji z KSeF?\n\nWymagany jest prawidłowy NIP i autoryzacja po stronie MF (certyfikat lub podpis elektroniczny).')) return;
    const res = await api('/auth', { method: 'POST', body: JSON.stringify({}) });
    if (res.ok) {
      alert('Token sesji pobrany. Wygasa: ' + (res.token_expires_at || '?'));
      _loadConfig();
    } else {
      alert('Błąd pobierania tokenu KSeF:\n' + (res.error || JSON.stringify(res)));
    }
  }

  // ─── Invoice modal ────────────────────────────────────────────────────────

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
    const statusOpts = ['pending', 'sent', 'accepted', 'rejected', 'offline_queued']
      .map(s => `<option value="${s}" ${inv.ksef_status === s ? 'selected' : ''}>${esc(STATUS_LABEL[s] || s)}</option>`)
      .join('');
    body.innerHTML = `
      <form id="ksef-form" onsubmit="window.KsefModule._save(event,'${esc(id || '')}')">
        <div class="form-row"><label>Numer faktury *</label><input name="invoice_number" class="form-control" required value="${esc(inv.invoice_number || '')}"></div>
        <div class="form-row"><label>NIP sprzedawcy</label><input name="seller_nip" class="form-control" maxlength="10" value="${esc(inv.seller_nip || '')}"></div>
        <div class="form-row"><label>NIP nabywcy</label><input name="buyer_nip" class="form-control" maxlength="10" value="${esc(inv.buyer_nip || '')}"></div>
        <div class="form-row"><label>Kwota brutto (PLN)</label><input name="gross_pln" type="number" step="0.01" class="form-control" value="${inv.gross_pln ?? ''}"></div>
        <div class="form-row"><label>Status KSeF</label><select name="ksef_status" class="form-control">${statusOpts}</select></div>
        <div class="form-row"><label>Numer KSeF</label><input name="ksef_number" class="form-control" value="${esc(inv.ksef_number || '')}"></div>
        <div class="form-row"><label>Data KSeF</label><input name="ksef_date" type="date" class="form-control" value="${esc(inv.ksef_date?.slice(0, 10) || '')}"></div>
        <div class="form-row"><label>URL UPO</label><input name="upo_url" type="url" class="form-control" placeholder="https://..." value="${esc(inv.upo_url || '')}"></div>
        <div class="form-row"><label>Komunikat błędu</label><textarea name="error_message" class="form-control" rows="2">${esc(inv.error_message || '')}</textarea></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.KsefModule._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (body.upo_url && !body.upo_url.startsWith('https://')) {
      alert('URL UPO musi zaczynać się od https://');
      return;
    }
    const method = id ? 'PUT' : 'POST';
    const path   = id ? `/${id}` : '';
    await api(path, { method, body: JSON.stringify(body) });
    _closeModal();
    _load();
  }

  async function _send(id) {
    if (!confirm('Wysłać fakturę do KSeF?')) return;
    const res = await api(`/${id}/send`, { method: 'POST', body: JSON.stringify({}) });
    if (res.ok && res.status === 'accepted') {
      alert('Faktura zaakceptowana przez KSeF.\nNumer referencyjny: ' + (res.ksef_reference || '—'));
    } else if (res.offline_queued) {
      alert('KSeF niedostępny lub brak konfiguracji — faktura dodana do kolejki offline.\nPowód: ' + (res.reason || 'brak połączenia'));
    } else {
      alert('Odpowiedź KSeF: ' + JSON.stringify(res));
    }
    _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć rekord KSeF?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('ksef-modal');
    if (m) m.style.display = 'none';
  }

  async function _syncNbp() {
    alert(
      'Synchronizacja z KSeF API (Ministerstwo Finansów).\n\n' +
      'Aby uruchomić: skonfiguruj NIP i token sesji w zakładce Konfiguracja.'
    );
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.KsefModule = {
    renderKsef,
    _load, _loadQueue, _loadConfig,
    _switchTab,
    _openModal, _save, _closeModal,
    _send, _delete, _retryAll,
    _saveConfig, _ksefAuth,
    _syncNbp,
  };
})();
