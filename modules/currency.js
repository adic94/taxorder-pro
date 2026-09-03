(function () {
  'use strict';

  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  const CURRENCIES = ['EUR', 'USD', 'GBP', 'CZK', 'DKK', 'NOK', 'SEK', 'CHF', 'HUF', 'RON', 'BGN', 'HRK'];

  async function api(path, opts = {}) {
    const r = await fetch(`${API()}/api/currency${path}${path.includes('?')?'&':'?'}company=${co()}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
      ...opts,
    });
    return r.json();
  }

  function renderCurrency() {
    const el = document.getElementById('page-currency');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-currency-zloty"></i> Wielowalutowość — Kursy Walut</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" onclick="window.CurrencyModule._fetchNbp()"><i class="ti ti-refresh"></i> Pobierz z NBP</button>
          <button class="btn btn-primary" onclick="window.CurrencyModule._openModal()"><i class="ti ti-plus"></i> Dodaj kurs ręcznie</button>
        </div>
      </div>
      <p style="color:var(--text-muted);margin-bottom:12px">Zarządzaj kursami walut. Używane w module refakturowania tras i fakturach. Kursy można pobierać automatycznie z NBP (tabela A).</p>
      <div id="cur-converter" style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:16px;margin-bottom:16px">
        <h4 style="margin:0 0 12px"><i class="ti ti-arrows-exchange"></i> Kalkulator walutowy</h4>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <input id="cur-amount" type="number" step="0.01" class="form-control" style="width:140px" placeholder="Kwota" oninput="window.CurrencyModule._convert()" value="100">
          <select id="cur-from" class="form-control" style="width:100px" onchange="window.CurrencyModule._convert()">
            <option value="PLN">PLN</option>
            ${CURRENCIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
          <span>→</span>
          <select id="cur-to" class="form-control" style="width:100px" onchange="window.CurrencyModule._convert()">
            <option value="PLN">PLN</option>
            ${CURRENCIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
          <span id="cur-result" style="font-size:1.3em;font-weight:700;min-width:160px">—</span>
        </div>
      </div>
      <h4>Historia kursów</h4>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="cur-filter-code" class="form-control" style="width:120px" onchange="window.CurrencyModule._load()">
          <option value="">Wszystkie</option>
          ${CURRENCIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
        <input id="cur-filter-from" type="date" class="form-control" style="width:150px" onchange="window.CurrencyModule._load()">
        <input id="cur-filter-to" type="date" class="form-control" style="width:150px" onchange="window.CurrencyModule._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Waluta</th><th>Kurs (1 jed. = X PLN)</th><th>Data kursu</th><th>Źródło</th><th>Akcje</th></tr></thead>
        <tbody id="cur-tbody"><tr><td colspan="5" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="cur-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.CurrencyModule._closeModal()">
        <div class="modal-box" style="max-width:420px">
          <div class="modal-header"><h3>Kurs waluty</h3><button class="modal-close" onclick="window.CurrencyModule._closeModal()">×</button></div>
          <div class="modal-body" id="cur-modal-body"></div>
        </div>
      </div>`;
    _load();
    _convert();
  }

  let _rates = {};

  async function _load() {
    const code  = document.getElementById('cur-filter-code')?.value || '';
    const from_ = document.getElementById('cur-filter-from')?.value || '';
    const to_   = document.getElementById('cur-filter-to')?.value || '';
    const tbody = document.getElementById('cur-tbody');
    if (!tbody) return;
    const data = await api(`?code=${code}&from=${from_}&to=${to_}`);
    const list = data.rates || [];
    _rates = {};
    list.forEach(r => { if (!_rates[r.currency_code]) _rates[r.currency_code] = r.rate_to_pln; });
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Brak kursów walut</td></tr>'; return; }
    tbody.innerHTML = list.map(r => `
      <tr>
        <td><strong>${esc(r.currency_code)}</strong></td>
        <td style="text-align:right"><strong>${esc(r.rate_to_pln.toFixed(4))}</strong> PLN</td>
        <td>${esc(r.rate_date?.slice(0,10)||'—')}</td>
        <td><span class="pill">${esc(r.source||'manual')}</span></td>
        <td>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(r.id)}" onclick="window.CurrencyModule._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
    _convert();
  }

  function _convert() {
    const amount  = parseFloat(document.getElementById('cur-amount')?.value) || 0;
    const fromCur = document.getElementById('cur-from')?.value || 'PLN';
    const toCur   = document.getElementById('cur-to')?.value || 'PLN';
    const result  = document.getElementById('cur-result');
    if (!result) return;
    if (fromCur === toCur) { result.textContent = `= ${amount.toFixed(2)} ${toCur}`; return; }
    const rateFrom = fromCur === 'PLN' ? 1 : (_rates[fromCur] || null);
    const rateTo   = toCur === 'PLN'   ? 1 : (_rates[toCur]   || null);
    if (!rateFrom || !rateTo) { result.textContent = '— (brak kursu)'; return; }
    const converted = (amount * rateFrom) / rateTo;
    result.textContent = `= ${converted.toFixed(4)} ${toCur}`;
  }

  async function _openModal() {
    const modal = document.getElementById('cur-modal');
    const body  = document.getElementById('cur-modal-body');
    body.innerHTML = `
      <form id="cur-form" onsubmit="window.CurrencyModule._save(event)">
        <div class="form-row"><label>Waluta *</label>
          <select name="currency_code" class="form-control" required>
            ${CURRENCIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Kurs do PLN (1 jed. waluty = X PLN) *</label><input name="rate_to_pln" type="number" step="0.0001" class="form-control" required placeholder="np. 4.2573"></div>
        <div class="form-row"><label>Data kursu *</label><input name="rate_date" type="date" class="form-control" required value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.CurrencyModule._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.source = 'manual';
    await api('', { method: 'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _fetchNbp() {
    const btn = event.target.closest('button');
    if (btn) btn.disabled = true;
    try {
      const data = await api('/nbp-fetch', { method: 'POST', body: JSON.stringify({}) });
      if (data.ok) {
        alert(`Pobrano ${data.imported || 0} kursów z NBP (${data.date || ''})`);
      } else {
        alert(`Błąd pobierania kursów NBP: ${  data.error || 'nieznany'}`);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
    _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć kurs waluty?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('cur-modal');
    if (m) m.style.display = 'none';
  }

  // Publiczna funkcja pomocnicza: przelicz X jednostek waluty na PLN wg ostatniego kursu
  function convertToPln(amount, currencyCode) {
    if (currencyCode === 'PLN') return amount;
    const rate = _rates[currencyCode];
    if (!rate) return null;
    return amount * rate;
  }

  window.CurrencyModule = { renderCurrency, _load, _convert, _openModal, _save, _fetchNbp, _delete, _closeModal, convertToPln };
})();


