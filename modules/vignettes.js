/**
 * TaxOrder Pro — Moduł Winiety i e-TOLL OBU
 *
 * SCHEMA_NEEDED:
 * CREATE TABLE IF NOT EXISTS vignettes (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   vehicle_id TEXT,
 *   vehicle_reg TEXT NOT NULL,
 *   country TEXT NOT NULL,
 *   vignette_type TEXT DEFAULT 'annual',
 *   valid_from TEXT NOT NULL,
 *   valid_until TEXT NOT NULL,
 *   amount_pln REAL,
 *   receipt_number TEXT,
 *   notes TEXT,
 *   created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
 * );
 * CREATE TABLE IF NOT EXISTS etoll_devices (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   vehicle_id TEXT,
 *   vehicle_reg TEXT NOT NULL,
 *   obu_number TEXT,
 *   obu_type TEXT DEFAULT 'viabox',
 *   active INTEGER DEFAULT 1,
 *   balance_pln REAL DEFAULT 0,
 *   last_top_up_at TEXT,
 *   notes TEXT,
 *   created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
 * );
 * CREATE INDEX IF NOT EXISTS idx_vig_company ON vignettes(company_id, valid_until);
 * CREATE INDEX IF NOT EXISTS idx_etoll_company ON etoll_devices(company_id);
 *
 * ENDPOINT_NEEDED:
 * GET    /api/vignettes?company=X                  — list vignettes
 * POST   /api/vignettes                            — create
 * PUT    /api/vignettes/:id                        — update
 * DELETE /api/vignettes/:id                        — delete
 * GET    /api/etoll-devices?company=X              — list OBU devices
 * POST   /api/etoll-devices                        — create
 * PUT    /api/etoll-devices/:id                    — update (incl. top-up)
 * DELETE /api/etoll-devices/:id                    — delete
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || { Authorization: `Bearer ${localStorage.getItem('cf_token')}` };
  const Co  = () => window._cfCo?.() || window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  const COUNTRIES = [
    { code: 'AT', name: 'Austria',    flag: '🇦🇹' },
    { code: 'CZ', name: 'Czechy',     flag: '🇨🇿' },
    { code: 'CH', name: 'Szwajcaria', flag: '🇨🇭' },
    { code: 'HU', name: 'Węgry',      flag: '🇭🇺' },
    { code: 'RO', name: 'Rumunia',    flag: '🇷🇴' },
    { code: 'BG', name: 'Bułgaria',   flag: '🇧🇬' },
    { code: 'SK', name: 'Słowacja',   flag: '🇸🇰' },
    { code: 'SI', name: 'Słowenia',   flag: '🇸🇮' },
  ];
  const COUNTRY_MAP  = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));
  const VIG_TYPE     = { annual: 'Roczna', monthly: 'Miesięczna', '10day': '10-dniowa' };
  const OBU_TYPE     = { viabox: 'ViaBOX', visatoll: 'ViaTOLL', etoll_go: 'e-TOLL GO' };

  let _activeTab = 'vignettes';

  async function _api(method, path, body) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API()}${path}${sep}company=${encodeURIComponent(Co())}`;
    const opts = { method, headers: { 'Content-Type': 'application/json', ...H() } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.json().catch(() => ({}));
  }

  function _daysUntil(ds) { return Math.round((new Date(ds) - Date.now()) / 86400000); }
  function _fmtDate(ds)   { return ds ? String(ds).slice(0, 10) : '—'; }

  // ── Auto-compute valid_until based on country/type/from ───────────────────
  function _autoValidUntil(from, type) {
    if (!from) return '';
    const d = new Date(from);
    if (type === 'annual')  { d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1); }
    if (type === 'monthly') { d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); }
    if (type === '10day')   { d.setDate(d.getDate() + 9); }
    return d.toISOString().slice(0, 10);
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function renderVignettes() {
    const el = document.getElementById('page-vignettes');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-road-sign"></i> Winiety i e-TOLL</h2>
      </div>
      <div class="tabs-bar" style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--border,#e2e8f0)">
        <button id="vig-tab-vignettes" onclick="window.Vignettes._switchTab('vignettes')" style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">Winiety</button>
        <button id="vig-tab-etoll"     onclick="window.Vignettes._switchTab('etoll')"     style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">e-TOLL OBU</button>
      </div>
      <div id="vig-tab-content"></div>
      <div id="vig-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.Vignettes._closeModal()">
        <div class="modal-box" style="max-width:520px">
          <div class="modal-header">
            <h3 id="vig-modal-title">Winieta</h3>
            <button class="modal-close" onclick="window.Vignettes._closeModal()">×</button>
          </div>
          <div class="modal-body" id="vig-modal-body"></div>
        </div>
      </div>`;
    _switchTab(_activeTab);
  }

  function _switchTab(tab) {
    _activeTab = tab;
    ['vignettes', 'etoll'].forEach(t => {
      const btn = document.getElementById(`vig-tab-${t}`);
      if (btn) btn.style.borderBottom = t === tab ? '2px solid #3b82f6' : 'none';
    });
    const content = document.getElementById('vig-tab-content');
    if (!content) return;
    if (tab === 'vignettes') _renderVignettesTab(content);
    if (tab === 'etoll')     _renderEtollTab(content);
  }

  // ── WINIETY TAB ───────────────────────────────────────────────────────────

  function _renderVignettesTab(container) {
    container.innerHTML = `
      <div id="vig-kpi-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <select id="vig-country-filter" class="form-control" style="width:160px" onchange="window.Vignettes._loadVig()">
          <option value="">Wszystkie kraje</option>
          ${COUNTRIES.map(c => `<option value="${c.code}">${c.flag} ${esc(c.name)}</option>`).join('')}
        </select>
        <input id="vig-reg-search" class="form-control" style="width:180px" placeholder="Nr rejestracyjny..." oninput="window.Vignettes._loadVig()">
        <button class="btn btn-primary" style="margin-left:auto" onclick="window.Vignettes._openVigModal()">
          <i class="ti ti-plus"></i> Dodaj winietę
        </button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Pojazd</th><th>Kraj</th><th>Typ</th><th>Ważna od</th><th>Ważna do</th><th>Pozostało</th><th>Kwota</th><th>Akcje</th>
          </tr></thead>
          <tbody id="vig-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
        </table>
      </div>`;
    _loadVig();
  }

  async function _loadVig() {
    const country = document.getElementById('vig-country-filter')?.value || '';
    const q       = document.getElementById('vig-reg-search')?.value || '';
    const tbody   = document.getElementById('vig-tbody');
    if (!tbody) return;

    const data  = await _api('GET', `/api/vignettes?country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}`);
    const list  = data.vignettes || [];
    const today = new Date().toISOString().slice(0, 10);

    const expired  = list.filter(v => v.valid_until < today).length;
    const exp7     = list.filter(v => { const d = _daysUntil(v.valid_until); return d >= 0 && d <= 7; }).length;
    const active   = list.filter(v => v.valid_until >= today).length;

    const kpi = document.getElementById('vig-kpi-row');
    if (kpi) {
      kpi.innerHTML = [
        { lbl: 'Aktywne',            val: active,  clr: '#22c55e', icon: 'ti-check' },
        { lbl: 'Wygasające (≤7 dni)', val: exp7,   clr: '#f59e0b', icon: 'ti-clock' },
        { lbl: 'Wygasłe',            val: expired, clr: '#ef4444', icon: 'ti-x' },
      ].map(k => `
        <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:160px">
          <i class="ti ${k.icon}" style="font-size:1.6em;color:${k.clr}"></i>
          <div><div style="font-size:1.5em;font-weight:700;color:${k.clr}">${k.val}</div><div style="font-size:.8em;color:var(--text-muted)">${k.lbl}</div></div>
        </div>`).join('');
    }

    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak winiet</td></tr>'; return; }

    tbody.innerHTML = list.map(v => {
      const days = _daysUntil(v.valid_until);
      const clr  = days < 0 ? '#ef4444' : days <= 7 ? '#f59e0b' : '#22c55e';
      const c    = COUNTRY_MAP[v.country] || { flag: '', name: v.country };
      return `<tr>
        <td>${esc(v.vehicle_reg || '—')}</td>
        <td>${c.flag} ${esc(c.name)}</td>
        <td>${esc(VIG_TYPE[v.vignette_type] ?? v.vignette_type ?? '—')}</td>
        <td>${esc(_fmtDate(v.valid_from))}</td>
        <td>${esc(_fmtDate(v.valid_until))}</td>
        <td style="color:${clr};font-weight:600;text-align:center">${days < 0 ? 'Wygasło' : days + ' dni'}</td>
        <td style="text-align:right">${v.amount_pln != null ? esc(Number(v.amount_pln).toFixed(2)) + ' PLN' : '—'}</td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(v.id)}" onclick="window.Vignettes._openVigModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(v.id)}" onclick="window.Vignettes._deleteVig(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  async function _openVigModal(id) {
    const body  = document.getElementById('vig-modal-body');
    const title = document.getElementById('vig-modal-title');
    const modal = document.getElementById('vig-modal');
    let r = {};
    if (id) { const d = await _api('GET', `/api/vignettes/${id}`); r = d.vignette || {}; }
    title.textContent = id ? 'Edytuj winietę' : 'Nowa winieta';
    body.innerHTML = `
      <form id="vig-form" data-id="${esc(id || '')}" onsubmit="window.Vignettes._saveVig(event,this.dataset.id)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Nr rejestracyjny *</label>
            <input name="vehicle_reg" class="form-control" required value="${esc(r.vehicle_reg || '')}">
          </div>
          <div class="form-row"><label>Kraj *</label>
            <select name="country" class="form-control" required onchange="window.Vignettes._vigAutoDate()">
              <option value="">— wybierz —</option>
              ${COUNTRIES.map(c => `<option value="${c.code}" ${r.country === c.code ? 'selected' : ''}>${c.flag} ${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Typ winiety</label>
            <select name="vignette_type" class="form-control" onchange="window.Vignettes._vigAutoDate()">
              ${Object.entries(VIG_TYPE).map(([v,l]) => `<option value="${v}" ${r.vignette_type === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Kwota (PLN)</label>
            <input name="amount_pln" type="number" step="0.01" class="form-control" value="${r.amount_pln ?? ''}">
          </div>
          <div class="form-row"><label>Ważna od *</label>
            <input name="valid_from" type="date" id="vig-from" class="form-control" required value="${esc(r.valid_from?.slice(0,10) || '')}" oninput="window.Vignettes._vigAutoDate()">
          </div>
          <div class="form-row"><label>Ważna do *</label>
            <input name="valid_until" type="date" id="vig-until" class="form-control" required value="${esc(r.valid_until?.slice(0,10) || '')}">
          </div>
          <div class="form-row"><label>Nr paragonu</label>
            <input name="receipt_number" class="form-control" value="${esc(r.receipt_number || '')}">
          </div>
          <div class="form-row"><label>Uwagi</label>
            <input name="notes" class="form-control" value="${esc(r.notes || '')}">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.Vignettes._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  function _vigAutoDate() {
    const from  = document.getElementById('vig-from')?.value;
    const type  = document.querySelector('#vig-form [name=vignette_type]')?.value;
    const until = document.getElementById('vig-until');
    if (until && from && type) until.value = _autoValidUntil(from, type);
  }

  async function _saveVig(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    if (body.amount_pln !== '') body.amount_pln = +body.amount_pln;
    await _api(id ? 'PUT' : 'POST', id ? `/api/vignettes/${id}` : '/api/vignettes', body);
    _closeModal(); _loadVig();
  }

  async function _deleteVig(id) {
    if (!confirm('Usunąć winietę?')) return;
    await _api('DELETE', `/api/vignettes/${id}`);
    _loadVig();
  }

  // ── e-TOLL OBU TAB ────────────────────────────────────────────────────────

  function _renderEtollTab(container) {
    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <input id="etoll-search" class="form-control" style="width:220px" placeholder="Pojazd / nr OBU..." oninput="window.Vignettes._loadEtoll()">
        <button class="btn btn-primary" style="margin-left:auto" onclick="window.Vignettes._openEtollModal()">
          <i class="ti ti-plus"></i> Dodaj OBU
        </button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Pojazd</th><th>Nr OBU</th><th>Typ</th><th>Status</th><th>Saldo PLN</th><th>Ostatnie doładowanie</th><th>Akcje</th>
          </tr></thead>
          <tbody id="etoll-tbody"><tr><td colspan="7" class="loading-row">Ładowanie...</td></tr></tbody>
        </table>
      </div>`;
    _loadEtoll();
  }

  async function _loadEtoll() {
    const q     = document.getElementById('etoll-search')?.value || '';
    const tbody = document.getElementById('etoll-tbody');
    if (!tbody) return;
    const data = await _api('GET', `/api/etoll-devices?q=${encodeURIComponent(q)}`);
    const list = data.devices || [];
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Brak urządzeń OBU</td></tr>'; return; }
    tbody.innerHTML = list.map(d => `
      <tr>
        <td>${esc(d.vehicle_reg || '—')}</td>
        <td>${esc(d.obu_number || '—')}</td>
        <td>${esc(OBU_TYPE[d.obu_type] ?? d.obu_type ?? '—')}</td>
        <td><span style="padding:2px 8px;border-radius:12px;font-size:.8em;font-weight:600;background:${d.active ? '#dcfce7' : '#fee2e2'};color:${d.active ? '#15803d' : '#dc2626'}">${d.active ? 'Aktywny' : 'Nieaktywny'}</span></td>
        <td style="text-align:right;font-weight:600">${d.balance_pln != null ? esc(Number(d.balance_pln).toFixed(2)) + ' PLN' : '—'}</td>
        <td>${esc(d.last_top_up_at ? d.last_top_up_at.slice(0,10) : '—')}</td>
        <td>
          <button class="btn btn-sm btn-outline" data-id="${esc(d.id)}" data-bal="${d.balance_pln ?? 0}" onclick="window.Vignettes._openTopUp(this.dataset.id,+this.dataset.bal)">Doładuj</button>
          <button class="btn-icon" data-id="${esc(d.id)}" onclick="window.Vignettes._openEtollModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" data-id="${esc(d.id)}" onclick="window.Vignettes._deleteEtoll(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  async function _openEtollModal(id) {
    const body  = document.getElementById('vig-modal-body');
    const title = document.getElementById('vig-modal-title');
    const modal = document.getElementById('vig-modal');
    let r = {};
    if (id) { const d = await _api('GET', `/api/etoll-devices/${id}`); r = d.device || {}; }
    title.textContent = id ? 'Edytuj urządzenie OBU' : 'Nowe urządzenie OBU';
    body.innerHTML = `
      <form id="etoll-form" data-id="${esc(id || '')}" onsubmit="window.Vignettes._saveEtoll(event,this.dataset.id)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Nr rejestracyjny *</label>
            <input name="vehicle_reg" class="form-control" required value="${esc(r.vehicle_reg || '')}">
          </div>
          <div class="form-row"><label>Nr OBU</label>
            <input name="obu_number" class="form-control" value="${esc(r.obu_number || '')}">
          </div>
          <div class="form-row"><label>Typ urządzenia</label>
            <select name="obu_type" class="form-control">
              ${Object.entries(OBU_TYPE).map(([v,l]) => `<option value="${v}" ${r.obu_type === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Aktywny</label>
            <select name="active" class="form-control">
              <option value="1" ${r.active !== 0 ? 'selected' : ''}>Tak</option>
              <option value="0" ${r.active === 0 ? 'selected' : ''}>Nie</option>
            </select>
          </div>
          <div class="form-row"><label>Saldo (PLN)</label>
            <input name="balance_pln" type="number" step="0.01" class="form-control" value="${r.balance_pln ?? 0}">
          </div>
          <div class="form-row"><label>Uwagi</label>
            <input name="notes" class="form-control" value="${esc(r.notes || '')}">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.Vignettes._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _saveEtoll(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.active = +body.active;
    if (body.balance_pln !== '') body.balance_pln = +body.balance_pln;
    await _api(id ? 'PUT' : 'POST', id ? `/api/etoll-devices/${id}` : '/api/etoll-devices', body);
    _closeModal(); _loadEtoll();
  }

  function _openTopUp(id, currentBalance) {
    const body  = document.getElementById('vig-modal-body');
    const title = document.getElementById('vig-modal-title');
    const modal = document.getElementById('vig-modal');
    title.textContent = 'Doładowanie e-TOLL';
    body.innerHTML = `
      <form id="topup-form" data-id="${esc(id)}" onsubmit="window.Vignettes._saveTopUp(event,this.dataset.id)">
        <div class="form-row">
          <label>Aktualne saldo</label>
          <div style="font-size:1.2em;font-weight:700;padding:8px 0">${esc(String(currentBalance))} PLN</div>
        </div>
        <div class="form-row"><label>Kwota doładowania (PLN) *</label>
          <input name="topup_amount" type="number" step="0.01" min="1" class="form-control" required autofocus>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.Vignettes._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Doładuj</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _saveTopUp(e, id) {
    e.preventDefault();
    const amount = +e.target.elements.topup_amount.value;
    if (!amount || amount <= 0) return;
    // Fetch current balance, add amount
    const d = await _api('GET', `/api/etoll-devices/${id}`);
    const cur = d.device?.balance_pln ?? 0;
    await _api('PUT', `/api/etoll-devices/${id}`, {
      balance_pln: cur + amount,
      last_top_up_at: new Date().toISOString(),
    });
    _closeModal(); _loadEtoll();
  }

  async function _deleteEtoll(id) {
    if (!confirm('Usunąć urządzenie OBU?')) return;
    await _api('DELETE', `/api/etoll-devices/${id}`);
    _loadEtoll();
  }

  function _closeModal() {
    const m = document.getElementById('vig-modal');
    if (m) m.style.display = 'none';
  }

  window.Vignettes = {
    renderVignettes,
    _switchTab,
    _loadVig,
    _loadEtoll,
    _openVigModal,
    _saveVig,
    _vigAutoDate,
    _deleteVig,
    _openEtollModal,
    _saveEtoll,
    _openTopUp,
    _saveTopUp,
    _deleteEtoll,
    _closeModal,
  };
})();
