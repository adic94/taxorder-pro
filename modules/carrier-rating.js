/**
 * TaxOrder Pro — Moduł Rating Przewoźników
 *
 * SCHEMA_NEEDED:
 * CREATE TABLE IF NOT EXISTS carrier_ratings (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   carrier_name TEXT NOT NULL,
 *   carrier_nip TEXT,
 *   carrier_email TEXT,
 *   carrier_phone TEXT,
 *   rating_punctuality INTEGER DEFAULT 3,
 *   rating_quality INTEGER DEFAULT 3,
 *   rating_price INTEGER DEFAULT 3,
 *   rating_communication INTEGER DEFAULT 3,
 *   rating_overall REAL,
 *   blacklisted INTEGER DEFAULT 0,
 *   blacklist_reason TEXT,
 *   orders_count INTEGER DEFAULT 0,
 *   last_order_at TEXT,
 *   notes TEXT,
 *   created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 *   updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
 * );
 * CREATE TABLE IF NOT EXISTS carrier_rating_history (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   carrier_id TEXT NOT NULL,
 *   order_reference TEXT,
 *   rating_punctuality INTEGER,
 *   rating_quality INTEGER,
 *   rating_price INTEGER,
 *   rating_communication INTEGER,
 *   comment TEXT,
 *   rated_by TEXT,
 *   rated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
 * );
 * CREATE INDEX IF NOT EXISTS idx_cr_company ON carrier_ratings(company_id, blacklisted);
 *
 * ENDPOINT_NEEDED:
 * GET    /api/carrier-ratings?company=X&blacklisted=0   — list carriers
 * POST   /api/carrier-ratings                           — create
 * PUT    /api/carrier-ratings/:id                       — update (incl. blacklist)
 * DELETE /api/carrier-ratings/:id                       — delete
 * POST   /api/carrier-ratings/:id/rate                  — add rating history entry
 * GET    /api/carrier-ratings/:id/history               — get history
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || { Authorization: `Bearer ${localStorage.getItem('cf_token')}` };
  const Co  = () => window._cfCo?.() || window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  // Weighted average: punctuality×30% + quality×30% + price×20% + communication×20%
  const WEIGHTS = { rating_punctuality: 0.3, rating_quality: 0.3, rating_price: 0.2, rating_communication: 0.2 };

  let _activeTab = 'all';

  async function _api(method, path, body) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API()}${path}${sep}company=${encodeURIComponent(Co())}`;
    const opts = { method, headers: { 'Content-Type': 'application/json', ...H() } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.json().catch(() => ({}));
  }

  function _calcOverall(c) {
    return (
      (c.rating_punctuality ?? 3) * WEIGHTS.rating_punctuality +
      (c.rating_quality     ?? 3) * WEIGHTS.rating_quality +
      (c.rating_price       ?? 3) * WEIGHTS.rating_price +
      (c.rating_communication ?? 3) * WEIGHTS.rating_communication
    );
  }

  function _stars(n, max) {
    // n = 1-5, max=5; returns filled ★ and empty ☆
    const filled = Math.round(n ?? 0);
    return '★'.repeat(Math.min(filled, max)) + '☆'.repeat(Math.max(max - filled, 0));
  }

  function _starColor(n) {
    if (n >= 4) return '#22c55e';
    if (n >= 3) return '#f59e0b';
    return '#ef4444';
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function renderCarrierRating() {
    const el = document.getElementById('page-carrier-rating');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-truck"></i> Rating Przewoźników</h2>
        <button class="btn btn-primary" onclick="window.CarrierRating._openModal()"><i class="ti ti-plus"></i> Dodaj przewoźnika</button>
      </div>
      <div class="tabs-bar" style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--border,#e2e8f0)">
        <button id="cr-tab-all"       onclick="window.CarrierRating._switchTab('all')"       style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">Wszyscy przewoźnicy</button>
        <button id="cr-tab-blacklist" onclick="window.CarrierRating._switchTab('blacklist')" style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600;color:#ef4444">⛔ Czarna lista</button>
      </div>
      <div id="cr-tab-content"></div>
      <div id="cr-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.CarrierRating._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header">
            <h3 id="cr-modal-title">Przewoźnik</h3>
            <button class="modal-close" onclick="window.CarrierRating._closeModal()">×</button>
          </div>
          <div class="modal-body" id="cr-modal-body"></div>
        </div>
      </div>`;
    _switchTab(_activeTab);
  }

  function _switchTab(tab) {
    _activeTab = tab;
    ['all', 'blacklist'].forEach(t => {
      const btn = document.getElementById(`cr-tab-${t}`);
      if (btn) btn.style.borderBottom = t === tab ? '2px solid #3b82f6' : 'none';
    });
    const content = document.getElementById('cr-tab-content');
    if (!content) return;
    _renderCarriersTab(content, tab === 'blacklist');
  }

  function _renderCarriersTab(container, blacklistOnly) {
    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <input id="cr-search" class="form-control" style="width:240px" placeholder="Nazwa / NIP..." oninput="window.CarrierRating._load(${blacklistOnly})">
        <select id="cr-sort" class="form-control" style="width:180px" onchange="window.CarrierRating._load(${blacklistOnly})">
          <option value="overall_desc">Ocena: najlepsza</option>
          <option value="overall_asc">Ocena: najniższa</option>
          <option value="name_asc">Nazwa A–Z</option>
          <option value="orders_desc">Zlecenia: najwięcej</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Nazwa</th><th>NIP</th>
            <th title="Punktualność">Punkt.</th>
            <th title="Jakość">Jakość</th>
            <th title="Cena">Cena</th>
            <th title="Komunikacja">Komunik.</th>
            <th>Ocena ogólna</th>
            <th>Zlecenia</th>
            <th>Akcje</th>
          </tr></thead>
          <tbody id="cr-tbody"><tr><td colspan="9" class="loading-row">Ładowanie...</td></tr></tbody>
        </table>
      </div>`;
    _load(blacklistOnly);
  }

  async function _load(blacklistOnly) {
    const q      = document.getElementById('cr-search')?.value || '';
    const sort   = document.getElementById('cr-sort')?.value || 'overall_desc';
    const tbody  = document.getElementById('cr-tbody');
    if (!tbody) return;

    const bl = blacklistOnly ? 1 : 0;
    const data = await _api('GET', `/api/carrier-ratings?blacklisted=${bl}&q=${encodeURIComponent(q)}&sort=${encodeURIComponent(sort)}`);
    let list   = data.carriers || [];

    // Client-side sort fallback
    if (sort === 'overall_desc')  list.sort((a, b) => _calcOverall(b) - _calcOverall(a));
    if (sort === 'overall_asc')   list.sort((a, b) => _calcOverall(a) - _calcOverall(b));
    if (sort === 'name_asc')      list.sort((a, b) => (a.carrier_name || '').localeCompare(b.carrier_name || ''));
    if (sort === 'orders_desc')   list.sort((a, b) => (b.orders_count ?? 0) - (a.orders_count ?? 0));

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-row">${blacklistOnly ? 'Czarna lista jest pusta' : 'Brak przewoźników'}</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(c => {
      const overall = _calcOverall(c);
      const clr     = _starColor(overall);
      return `<tr>
        <td>
          <strong>${esc(c.carrier_name || '—')}</strong>
          ${c.carrier_email ? `<div style="font-size:.8em;color:var(--text-muted)">${esc(c.carrier_email)}</div>` : ''}
        </td>
        <td>${esc(c.carrier_nip || '—')}</td>
        <td style="color:${_starColor(c.rating_punctuality ?? 3)};letter-spacing:2px">${_stars(c.rating_punctuality ?? 3, 5)}</td>
        <td style="color:${_starColor(c.rating_quality ?? 3)};letter-spacing:2px">${_stars(c.rating_quality ?? 3, 5)}</td>
        <td style="color:${_starColor(c.rating_price ?? 3)};letter-spacing:2px">${_stars(c.rating_price ?? 3, 5)}</td>
        <td style="color:${_starColor(c.rating_communication ?? 3)};letter-spacing:2px">${_stars(c.rating_communication ?? 3, 5)}</td>
        <td>
          <span style="font-size:1.1em;font-weight:700;color:${clr}">${overall.toFixed(1)}</span>
          <span style="color:${clr};letter-spacing:2px;margin-left:4px">${_stars(overall, 5)}</span>
        </td>
        <td style="text-align:center">${c.orders_count ?? 0}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-outline" data-id="${esc(c.id)}" onclick="window.CarrierRating._openRateModal(this.dataset.id)">Oceń</button>
          <button class="btn-icon" data-id="${esc(c.id)}" onclick="window.CarrierRating._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          ${!c.blacklisted
            ? `<button class="btn-icon danger" title="Czarna lista" data-id="${esc(c.id)}" data-name="${esc(c.carrier_name)}" onclick="window.CarrierRating._blacklist(this.dataset.id,this.dataset.name)"><i class="ti ti-ban"></i></button>`
            : `<button class="btn-icon" title="Usuń z czarnej listy" data-id="${esc(c.id)}" onclick="window.CarrierRating._unblacklist(this.dataset.id)"><i class="ti ti-circle-check"></i></button>`
          }
          <button class="btn-icon danger" data-id="${esc(c.id)}" onclick="window.CarrierRating._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Carrier modal (create / edit) ─────────────────────────────────────────

  async function _openModal(id) {
    const body  = document.getElementById('cr-modal-body');
    const title = document.getElementById('cr-modal-title');
    const modal = document.getElementById('cr-modal');
    let c = {};
    if (id) { const d = await _api('GET', `/api/carrier-ratings/${id}`); c = d.carrier || {}; }
    title.textContent = id ? 'Edytuj przewoźnika' : 'Nowy przewoźnik';
    body.innerHTML = `
      <form id="cr-form" data-id="${esc(id || '')}" onsubmit="window.CarrierRating._save(event,this.dataset.id)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row" style="grid-column:1/-1"><label>Nazwa przewoźnika *</label>
            <input name="carrier_name" class="form-control" required value="${esc(c.carrier_name || '')}">
          </div>
          <div class="form-row"><label>NIP</label>
            <input name="carrier_nip" class="form-control" value="${esc(c.carrier_nip || '')}">
          </div>
          <div class="form-row"><label>E-mail</label>
            <input name="carrier_email" type="email" class="form-control" value="${esc(c.carrier_email || '')}">
          </div>
          <div class="form-row"><label>Telefon</label>
            <input name="carrier_phone" class="form-control" value="${esc(c.carrier_phone || '')}">
          </div>
          <div class="form-row"><label>Liczba zleceń</label>
            <input name="orders_count" type="number" min="0" class="form-control" value="${c.orders_count ?? 0}">
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label>
            <textarea name="notes" class="form-control" rows="2">${esc(c.notes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.CarrierRating._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.orders_count = +(body.orders_count ?? 0);
    await _api(id ? 'PUT' : 'POST', id ? `/api/carrier-ratings/${id}` : '/api/carrier-ratings', body);
    _closeModal(); _load(_activeTab === 'blacklist');
  }

  // ── Rate modal ────────────────────────────────────────────────────────────

  async function _openRateModal(id) {
    const body  = document.getElementById('cr-modal-body');
    const title = document.getElementById('cr-modal-title');
    const modal = document.getElementById('cr-modal');
    const d     = await _api('GET', `/api/carrier-ratings/${id}`);
    const c     = d.carrier || {};
    title.textContent = `Oceń: ${esc(c.carrier_name || id)}`;

    const starField = (name, label, currentVal) => {
      const val = currentVal ?? 3;
      return `<div class="form-row">
        <label>${esc(label)}</label>
        <div style="display:flex;gap:8px;align-items:center">
          ${[1,2,3,4,5].map(n => `
            <label style="cursor:pointer;font-size:1.4em;color:${n <= val ? '#f59e0b' : '#d1d5db'}" title="${n}">
              <input type="radio" name="${name}" value="${n}" ${n === val ? 'checked' : ''} style="display:none"
                onchange="window.CarrierRating._updateStars('${name}',${n})">★
            </label>`).join('')}
          <span id="cr-star-lbl-${name}" style="color:#64748b;font-size:.85em">${val}/5</span>
        </div>
      </div>`;
    };

    body.innerHTML = `
      <form id="cr-rate-form" data-id="${esc(id)}" onsubmit="window.CarrierRating._saveRating(event,this.dataset.id)">
        ${starField('rating_punctuality',   'Punktualność (30%)',  c.rating_punctuality)}
        ${starField('rating_quality',       'Jakość usług (30%)',  c.rating_quality)}
        ${starField('rating_price',         'Cena (20%)',          c.rating_price)}
        ${starField('rating_communication', 'Komunikacja (20%)',   c.rating_communication)}
        <div class="form-row"><label>Nr zlecenia</label>
          <input name="order_reference" class="form-control" placeholder="Opcjonalnie">
        </div>
        <div class="form-row"><label>Komentarz</label>
          <textarea name="comment" class="form-control" rows="3"></textarea>
        </div>
        <div class="form-row"><label>Oceniający</label>
          <input name="rated_by" class="form-control" value="">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.CarrierRating._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz ocenę</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  function _updateStars(name, val) {
    const lbl = document.getElementById(`cr-star-lbl-${name}`);
    if (lbl) lbl.textContent = `${val}/5`;
    const labels = document.querySelectorAll(`[name="${name}"]`);
    labels.forEach(inp => {
      const parent = inp.parentElement;
      if (parent) parent.style.color = +inp.value <= val ? '#f59e0b' : '#d1d5db';
    });
  }

  async function _saveRating(e, id) {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    ['rating_punctuality', 'rating_quality', 'rating_price', 'rating_communication'].forEach(k => {
      if (body[k]) body[k] = +body[k];
    });
    // Save history entry
    await _api('POST', `/api/carrier-ratings/${id}/rate`, body);
    // Also update main rating with new weighted avg
    await _api('PUT', `/api/carrier-ratings/${id}`, {
      rating_punctuality:   body.rating_punctuality,
      rating_quality:       body.rating_quality,
      rating_price:         body.rating_price,
      rating_communication: body.rating_communication,
      rating_overall:       _calcOverall(body),
    });
    _closeModal(); _load(_activeTab === 'blacklist');
  }

  // ── Blacklist ─────────────────────────────────────────────────────────────

  async function _blacklist(id, name) {
    const reason = prompt(`Powód wpisania na czarną listę (${esc(name)}):`);
    if (reason === null) return; // cancelled
    await _api('PUT', `/api/carrier-ratings/${id}`, { blacklisted: 1, blacklist_reason: reason });
    _load(_activeTab === 'blacklist');
  }

  async function _unblacklist(id) {
    if (!confirm('Usunąć z czarnej listy?')) return;
    await _api('PUT', `/api/carrier-ratings/${id}`, { blacklisted: 0, blacklist_reason: '' });
    _load(_activeTab === 'blacklist');
  }

  async function _delete(id) {
    if (!confirm('Usunąć przewoźnika?')) return;
    await _api('DELETE', `/api/carrier-ratings/${id}`);
    _load(_activeTab === 'blacklist');
  }

  function _closeModal() {
    const m = document.getElementById('cr-modal');
    if (m) m.style.display = 'none';
  }

  window.CarrierRating = {
    renderCarrierRating,
    _switchTab,
    _load,
    _openModal,
    _save,
    _openRateModal,
    _updateStars,
    _saveRating,
    _blacklist,
    _unblacklist,
    _delete,
    _closeModal,
  };
})();
