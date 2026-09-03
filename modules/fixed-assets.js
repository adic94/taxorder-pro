/**
 * TaxOrder Pro — Moduł Środki Trwałe (amortyzacja pojazdów)
 *
 * SCHEMA_NEEDED:
 * CREATE TABLE IF NOT EXISTS fixed_assets (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   vehicle_id TEXT,
 *   name TEXT NOT NULL,
 *   asset_number TEXT,
 *   purchase_date TEXT,
 *   purchase_value REAL NOT NULL,
 *   residual_value REAL DEFAULT 0,
 *   useful_life_years INTEGER DEFAULT 5,
 *   depreciation_method TEXT DEFAULT 'linear',
 *   depreciation_rate REAL DEFAULT 20,
 *   current_book_value REAL,
 *   status TEXT DEFAULT 'active',
 *   disposal_date TEXT,
 *   disposal_value REAL,
 *   notes TEXT,
 *   created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
 * );
 * CREATE TABLE IF NOT EXISTS fixed_asset_depreciation (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   asset_id TEXT NOT NULL,
 *   period TEXT NOT NULL,
 *   depreciation_amount REAL NOT NULL,
 *   book_value_after REAL NOT NULL,
 *   created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
 * );
 * CREATE INDEX IF NOT EXISTS idx_fa_company ON fixed_assets(company_id, status);
 *
 * ENDPOINT_NEEDED:
 * GET    /api/fixed-assets?company=X          — list assets
 * POST   /api/fixed-assets                    — create
 * PUT    /api/fixed-assets/:id                — update
 * DELETE /api/fixed-assets/:id                — delete
 * GET    /api/fixed-assets/:id/depreciation   — get depreciation schedule
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || { Authorization: `Bearer ${localStorage.getItem('cf_token')}` };
  const Co  = () => window._cfCo?.() || window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  const METHOD_LABEL = { linear: 'Liniowa', diminishing: 'Degresywna (malejące saldo)' };
  const STATUS_LABEL = { active: 'Aktywny', disposed: 'Zlikwidowany', written_off: 'Umorzony' };
  const STATUS_CLR   = { active: '#22c55e', disposed: '#94a3b8', written_off: '#f59e0b' };

  async function _api(method, path, body) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API()}${path}${sep}company=${encodeURIComponent(Co())}`;
    const opts = { method, headers: { 'Content-Type': 'application/json', ...H() } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.json().catch(() => ({}));
  }

  function _fmt2(n) { return n != null ? Number(n).toFixed(2) : '—'; }
  function _fmtDate(ds) { return ds ? String(ds).slice(0, 10) : '—'; }

  // ── Depreciation calculation (frontend) ──────────────────────────────────

  function _calcLinearDepreciation(purchaseValue, residualValue, usefulYears, purchaseDate) {
    const annual = (purchaseValue - residualValue) / usefulYears;
    const schedule = [];
    let bookValue = purchaseValue;
    const startYear = purchaseDate ? new Date(purchaseDate).getFullYear() : new Date().getFullYear();
    for (let y = 1; y <= usefulYears; y++) {
      const dep = Math.min(annual, bookValue - residualValue);
      bookValue -= dep;
      schedule.push({ year: startYear + y - 1, amount: dep, bookValue: Math.max(bookValue, residualValue) });
    }
    return schedule;
  }

  function _calcDiminishingDepreciation(purchaseValue, residualValue, rate, purchaseDate) {
    const schedule = [];
    let bookValue  = purchaseValue;
    const rateDecimal = rate / 100;
    const startYear   = purchaseDate ? new Date(purchaseDate).getFullYear() : new Date().getFullYear();
    // Run until book value near residual (max 30 years safety cap)
    for (let y = 0; y < 30 && bookValue - residualValue > 0.01; y++) {
      const dep = Math.min(bookValue * rateDecimal, bookValue - residualValue);
      bookValue -= dep;
      schedule.push({ year: startYear + y, amount: dep, bookValue: Math.max(bookValue, residualValue) });
    }
    return schedule;
  }

  function _calcSchedule(asset) {
    const pv  = asset.purchase_value ?? 0;
    const rv  = asset.residual_value ?? 0;
    const uly = asset.useful_life_years ?? 5;
    const dr  = asset.depreciation_rate ?? 20;
    const pd  = asset.purchase_date || null;
    if (asset.depreciation_method === 'diminishing') {
      return _calcDiminishingDepreciation(pv, rv, dr, pd);
    }
    return _calcLinearDepreciation(pv, rv, uly, pd);
  }

  function _currentBookValue(asset) {
    // If stored, use it; otherwise compute from schedule
    if (asset.current_book_value != null) return asset.current_book_value;
    const schedule = _calcSchedule(asset);
    if (!schedule.length) return asset.purchase_value ?? 0;
    const nowYear = new Date().getFullYear();
    const row = [...schedule].reverse().find(r => r.year <= nowYear);
    return row ? row.bookValue : asset.purchase_value ?? 0;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function renderFixedAssets() {
    const el = document.getElementById('page-fixed-assets');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-building-factory-2"></i> Środki Trwałe</h2>
        <button class="btn btn-primary" onclick="window.FixedAssets._openModal()"><i class="ti ti-plus"></i> Nowy środek trwały</button>
      </div>
      <div id="fa-kpi-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <select id="fa-status-filter" class="form-control" style="width:160px" onchange="window.FixedAssets._load()">
          <option value="">Wszystkie statusy</option>
          ${Object.entries(STATUS_LABEL).map(([v,l]) => `<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="fa-search" class="form-control" style="width:220px" placeholder="Nazwa / nr inwentarzowy..." oninput="window.FixedAssets._load()">
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Nazwa</th><th>Nr inwentarzowy</th><th>Data nabycia</th><th>Wartość nabycia</th>
            <th>Wart. bilansowa</th><th>Amortyzacja/rok</th><th>Metoda</th><th>Status</th><th>Akcje</th>
          </tr></thead>
          <tbody id="fa-tbody"><tr><td colspan="9" class="loading-row">Ładowanie...</td></tr></tbody>
        </table>
      </div>
      <div id="fa-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.FixedAssets._closeModal()">
        <div class="modal-box" style="max-width:600px">
          <div class="modal-header">
            <h3 id="fa-modal-title">Środek trwały</h3>
            <button class="modal-close" onclick="window.FixedAssets._closeModal()">×</button>
          </div>
          <div class="modal-body" id="fa-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const status = document.getElementById('fa-status-filter')?.value || '';
    const q      = document.getElementById('fa-search')?.value || '';
    const tbody  = document.getElementById('fa-tbody');
    if (!tbody) return;

    const data  = await _api('GET', `/api/fixed-assets?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
    const list  = data.assets || [];

    const totalPurchase = list.reduce((s, a) => s + (a.purchase_value ?? 0), 0);
    const totalBook     = list.reduce((s, a) => s + _currentBookValue(a), 0);
    const totalDepr     = totalPurchase - totalBook;

    const kpi = document.getElementById('fa-kpi-row');
    if (kpi) {
      kpi.innerHTML = [
        { lbl: 'Wartość nabycia łącznie', val: `${_fmt2(totalPurchase)  } PLN`, clr: '#3b82f6', icon: 'ti-coin' },
        { lbl: 'Umorzenie łączne',       val: `${_fmt2(totalDepr)      } PLN`, clr: '#f59e0b', icon: 'ti-trending-down' },
        { lbl: 'Wartość bilansowa netto', val: `${_fmt2(totalBook)      } PLN`, clr: '#22c55e', icon: 'ti-chart-bar' },
      ].map(k => `
        <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:200px">
          <i class="ti ${k.icon}" style="font-size:1.6em;color:${k.clr}"></i>
          <div><div style="font-size:1.1em;font-weight:700;color:${k.clr}">${k.val}</div><div style="font-size:.8em;color:var(--text-muted)">${k.lbl}</div></div>
        </div>`).join('');
    }

    if (!list.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Brak środków trwałych</td></tr>'; return; }

    tbody.innerHTML = list.map(a => {
      const bv     = _currentBookValue(a);
      const sched  = _calcSchedule(a);
      const annual = sched.length ? sched[0].amount : 0;
      const clr    = STATUS_CLR[a.status] || '#94a3b8';
      return `<tr>
        <td><strong>${esc(a.name || '—')}</strong></td>
        <td>${esc(a.asset_number || '—')}</td>
        <td>${esc(_fmtDate(a.purchase_date))}</td>
        <td style="text-align:right">${_fmt2(a.purchase_value)} PLN</td>
        <td style="text-align:right;font-weight:600">${_fmt2(bv)} PLN</td>
        <td style="text-align:right">${_fmt2(annual)} PLN</td>
        <td>${esc(METHOD_LABEL[a.depreciation_method] ?? a.depreciation_method ?? '—')}</td>
        <td><span style="padding:2px 8px;border-radius:12px;font-size:.8em;font-weight:600;background:${clr}20;color:${clr}">${esc(STATUS_LABEL[a.status] ?? a.status ?? '—')}</span></td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-outline" data-id="${esc(a.id)}" onclick="window.FixedAssets._showSchedule(this.dataset.id)">Amortyzacja</button>
          <button class="btn-icon" data-id="${esc(a.id)}" onclick="window.FixedAssets._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" data-id="${esc(a.id)}" onclick="window.FixedAssets._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  async function _openModal(id) {
    const body  = document.getElementById('fa-modal-body');
    const title = document.getElementById('fa-modal-title');
    const modal = document.getElementById('fa-modal');
    let a = { depreciation_method: 'linear', depreciation_rate: 20, useful_life_years: 5, residual_value: 0, status: 'active' };
    if (id) { const d = await _api('GET', `/api/fixed-assets/${id}`); a = d.asset || a; }
    title.textContent = id ? 'Edytuj środek trwały' : 'Nowy środek trwały';
    body.innerHTML = `
      <form id="fa-form" data-id="${esc(id || '')}" onsubmit="window.FixedAssets._save(event,this.dataset.id)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row" style="grid-column:1/-1"><label>Nazwa *</label>
            <input name="name" class="form-control" required value="${esc(a.name || '')}">
          </div>
          <div class="form-row"><label>Nr inwentarzowy</label>
            <input name="asset_number" class="form-control" value="${esc(a.asset_number || '')}">
          </div>
          <div class="form-row"><label>Status</label>
            <select name="status" class="form-control">
              ${Object.entries(STATUS_LABEL).map(([v,l]) => `<option value="${v}" ${a.status === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Data nabycia</label>
            <input name="purchase_date" type="date" class="form-control" value="${esc(a.purchase_date?.slice(0,10) || '')}">
          </div>
          <div class="form-row"><label>Wartość nabycia (PLN) *</label>
            <input name="purchase_value" type="number" step="0.01" class="form-control" required value="${a.purchase_value ?? ''}">
          </div>
          <div class="form-row"><label>Wartość rezydualna (PLN)</label>
            <input name="residual_value" type="number" step="0.01" class="form-control" value="${a.residual_value ?? 0}">
          </div>
          <div class="form-row"><label>Metoda amortyzacji</label>
            <select name="depreciation_method" class="form-control">
              ${Object.entries(METHOD_LABEL).map(([v,l]) => `<option value="${v}" ${a.depreciation_method === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Stawka amortyzacji (%/rok)</label>
            <input name="depreciation_rate" type="number" step="0.5" min="1" max="100" class="form-control" value="${a.depreciation_rate ?? 20}">
          </div>
          <div class="form-row"><label>Okres użytkowania (lata)</label>
            <input name="useful_life_years" type="number" min="1" max="50" class="form-control" value="${a.useful_life_years ?? 5}">
          </div>
          <div class="form-row"><label>Nr rejestracyjny pojazdu</label>
            <input name="vehicle_id" class="form-control" value="${esc(a.vehicle_id || '')}">
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label>
            <textarea name="notes" class="form-control" rows="2">${esc(a.notes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.FixedAssets._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    ['purchase_value', 'residual_value', 'depreciation_rate', 'useful_life_years'].forEach(k => {
      if (body[k] !== '') body[k] = +body[k];
    });
    await _api(id ? 'PUT' : 'POST', id ? `/api/fixed-assets/${id}` : '/api/fixed-assets', body);
    _closeModal(); _load();
  }

  async function _showSchedule(id) {
    const body  = document.getElementById('fa-modal-body');
    const title = document.getElementById('fa-modal-title');
    const modal = document.getElementById('fa-modal');
    const d     = await _api('GET', `/api/fixed-assets/${id}`);
    const a     = d.asset || {};
    const sched = _calcSchedule(a);
    title.textContent = `Plan amortyzacji — ${esc(a.name || id)}`;
    body.innerHTML = `
      <p style="margin-bottom:10px;color:var(--text-muted)">
        Metoda: <strong>${esc(METHOD_LABEL[a.depreciation_method] ?? a.depreciation_method ?? '—')}</strong> |
        Wartość nabycia: <strong>${_fmt2(a.purchase_value)} PLN</strong> |
        Rezydualna: <strong>${_fmt2(a.residual_value ?? 0)} PLN</strong>
      </p>
      <div class="table-wrap" style="max-height:380px;overflow-y:auto">
        <table class="data-table">
          <thead><tr><th>Rok</th><th style="text-align:right">Odpis amortyzacyjny</th><th style="text-align:right">Wartość bilansowa po</th></tr></thead>
          <tbody>
            ${sched.map(r => `<tr>
              <td>${r.year}</td>
              <td style="text-align:right">${_fmt2(r.amount)} PLN</td>
              <td style="text-align:right">${_fmt2(r.bookValue)} PLN</td>
            </tr>`).join('')}
            ${!sched.length ? '<tr><td colspan="3" class="empty-row">Brak danych</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" onclick="window.FixedAssets._closeModal()">Zamknij</button>
      </div>`;
    modal.style.display = 'flex';
  }

  async function _delete(id) {
    if (!confirm('Usunąć środek trwały?')) return;
    await _api('DELETE', `/api/fixed-assets/${id}`);
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('fa-modal');
    if (m) m.style.display = 'none';
  }

  window.FixedAssets = { renderFixedAssets, _load, _openModal, _save, _showSchedule, _delete, _closeModal };
})();
