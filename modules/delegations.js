/**
 * TaxOrder Pro — Moduł Delegacji
 * Dane persystowane w D1 (tabela delegations, schema v38).
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.() || window.currentCompanyId || '';

  const DIET_RATES = { 'Polska': 45, 'Niemcy': 49, 'Francja': 50, 'Wielka Brytania': 42, 'inne': 40 };

  const STATUS_LABEL = { draft: 'Szkic', submitted: 'Złożona', approved: 'Zatwierdzona', paid: 'Wypłacona' };
  const STATUS_PILL  = { draft: 'pill-gray', submitted: 'pill-blue', approved: 'pill-green', paid: 'pill-green' };

  // ── In-memory cache (ładowany z API przy renderze) ─────────────────────────
  let _cache = [];

  // ── API helper ─────────────────────────────────────────────────────────────
  async function _api(method, path, body) {
    const url = `${API()}${path}?company=${Co()}`;
    const opts = { method, headers: { 'Content-Type': 'application/json', ...H() } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.json().catch(() => ({}));
  }

  async function _fetchAll() {
    const data = await _api('GET', '/api/delegations').catch(() => ({ delegations: [] }));
    _cache = data.delegations || [];
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _fmt(ds) {
    if (!ds) return '—';
    const parts = String(ds).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : ds;
  }

  function _calcTotal(d) {
    return ((d.km_driven ?? 0) * (d.km_rate ?? 0.89))
         + ((d.diet_days ?? 0) * (d.diet_rate ?? 45))
         + (d.hotel_cost  ?? 0)
         + (d.other_costs ?? 0);
  }

  function _thisMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }

  // ── Main page render ───────────────────────────────────────────────────────
  async function renderDelegations() {
    const pg = document.getElementById('page-delegations');
    if (!pg) return;

    pg.innerHTML = `
      <div style="padding:20px 24px 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <h2 style="margin:0;font-size:18px;font-weight:700"><i class="ti ti-road"></i> Delegacje</h2>
        <button class="btn btn-blue" style="margin-left:auto"
          onclick="DelegationsModule.showDelegationModal(null)">
          <i class="ti ti-plus"></i> Nowa delegacja
        </button>
      </div>

      <div id="del-kpi-row" style="padding:0 24px 12px;display:flex;gap:10px;flex-wrap:wrap"></div>

      <div style="padding:0 24px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="month" id="del-filter-month" value="${_thisMonth()}" class="form-input"
          style="width:160px" onchange="DelegationsModule._refreshList()">
        <select id="del-filter-status" class="form-select" style="width:150px"
          onchange="DelegationsModule._refreshList()">
          <option value="">Wszystkie statusy</option>
          <option value="draft">Szkic</option>
          <option value="submitted">Złożona</option>
          <option value="approved">Zatwierdzona</option>
          <option value="paid">Wypłacona</option>
        </select>
        <input type="text" id="del-filter-driver" class="form-input"
          placeholder="Szukaj kierowcy…" style="width:200px"
          oninput="DelegationsModule._refreshList()">
        <button class="btn" style="margin-left:auto" onclick="DelegationsModule._exportCsv()">
          <i class="ti ti-download"></i> CSV
        </button>
      </div>

      <div style="overflow-x:auto;padding:0 24px 24px">
        <table class="data-table" style="font-size:13px">
          <thead><tr>
            <th>Kierowca</th><th>Pojazd</th><th>Cel</th>
            <th>Data od</th><th>Data do</th><th>Kraj</th>
            <th style="text-align:right">Km</th>
            <th style="text-align:right">Diety (PLN)</th>
            <th style="text-align:right">Razem (PLN)</th>
            <th>Status</th><th>Akcje</th>
          </tr></thead>
          <tbody id="del-tbody"><tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--text3)">
            <i class="ti ti-loader" style="font-size:20px"></i> Ładowanie…
          </td></tr></tbody>
        </table>
      </div>

      <!-- Modal -->
      <div id="del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);
           z-index:9200;align-items:flex-start;justify-content:center;overflow-y:auto;padding:30px 16px" onclick="if(event.target===this)this.style.display='none'">
        <div style="background:var(--surface);border-radius:12px;width:min(700px,95vw);
             padding:28px;margin:auto;position:relative">
          <div style="display:flex;align-items:center;margin-bottom:20px">
            <h3 id="del-modal-title" style="margin:0;font-size:16px;font-weight:700">Nowa delegacja</h3>
            <button onclick="DelegationsModule.closeDelegationModal()"
              style="margin-left:auto;background:none;border:none;font-size:26px;
                     cursor:pointer;color:var(--text3);line-height:1" aria-label="Zamknij">&times;</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div style="grid-column:1/-1">
              <div class="form-label">Kierowca *</div>
              <input id="del-f-driver" class="form-input" type="text"
                placeholder="Jan Kowalski" style="width:100%;margin-top:4px">
            </div>
            <div>
              <div class="form-label">Nr rejestracyjny</div>
              <input id="del-f-nrrej" class="form-input" type="text"
                placeholder="WA1234X" style="width:100%;margin-top:4px">
            </div>
            <div>
              <div class="form-label">Kraj</div>
              <select id="del-f-country" class="form-select"
                style="width:100%;margin-top:4px"
                onchange="DelegationsModule._onCountryChange()">
                <option>Polska</option>
                <option>Niemcy</option>
                <option>Francja</option>
                <option>Wielka Brytania</option>
                <option>inne</option>
              </select>
            </div>
            <div style="grid-column:1/-1">
              <div class="form-label">Trasa *</div>
              <input id="del-f-destination" class="form-input" type="text"
                placeholder="Warszawa → Kraków" style="width:100%;margin-top:4px">
            </div>
            <div style="grid-column:1/-1">
              <div class="form-label">Cel służbowy</div>
              <input id="del-f-purpose" class="form-input" type="text"
                placeholder="Szkolenie, spotkanie z klientem…" style="width:100%;margin-top:4px">
            </div>
            <div>
              <div class="form-label">Data wyjazdu *</div>
              <input id="del-f-date-from" class="form-input" type="date"
                style="width:100%;margin-top:4px" oninput="DelegationsModule._updateCalc()">
            </div>
            <div>
              <div class="form-label">Data powrotu</div>
              <input id="del-f-date-to" class="form-input" type="date"
                style="width:100%;margin-top:4px" oninput="DelegationsModule._updateCalc()">
            </div>
            <div>
              <div class="form-label">Kilometry</div>
              <input id="del-f-km" class="form-input" type="number" min="0" step="1"
                placeholder="0" style="width:100%;margin-top:4px"
                oninput="DelegationsModule._updateCalc()">
            </div>
            <div>
              <div class="form-label">Stawka km (zł)</div>
              <input id="del-f-km-rate" class="form-input" type="number" min="0" step="0.01"
                value="0.89" style="width:100%;margin-top:4px"
                oninput="DelegationsModule._updateCalc()">
            </div>
            <div>
              <div class="form-label">Liczba dób diety</div>
              <input id="del-f-diet-days" class="form-input" type="number" min="0" step="0.5"
                placeholder="0" style="width:100%;margin-top:4px"
                oninput="DelegationsModule._updateCalc()">
            </div>
            <div>
              <div class="form-label">Stawka diety (zł/dobę)</div>
              <input id="del-f-diet-rate" class="form-input" type="number" min="0" step="0.5"
                value="45" style="width:100%;margin-top:4px"
                oninput="DelegationsModule._updateCalc()">
            </div>
            <div>
              <div class="form-label">Hotel (zł)</div>
              <input id="del-f-hotel" class="form-input" type="number" min="0" step="0.01"
                placeholder="0" style="width:100%;margin-top:4px"
                oninput="DelegationsModule._updateCalc()">
            </div>
            <div>
              <div class="form-label">Inne koszty (zł)</div>
              <input id="del-f-other" class="form-input" type="number" min="0" step="0.01"
                placeholder="0" style="width:100%;margin-top:4px"
                oninput="DelegationsModule._updateCalc()">
            </div>
            <div>
              <div class="form-label">Status</div>
              <select id="del-f-status" class="form-select" style="width:100%;margin-top:4px">
                <option value="draft">Szkic</option>
                <option value="submitted">Złożona do zatwierdzenia</option>
                <option value="approved">Zatwierdzona</option>
                <option value="paid">Wypłacona</option>
              </select>
            </div>
            <div style="grid-column:1/-1">
              <div class="form-label">Uwagi</div>
              <textarea id="del-f-notes" class="form-input" rows="2"
                style="width:100%;margin-top:4px;resize:vertical"></textarea>
            </div>
          </div>
          <div id="del-calc-preview"
            style="background:var(--surface2,#f5f5f5);border-radius:8px;
                   padding:12px;margin-top:14px;font-size:13px"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">
            <button class="btn" onclick="DelegationsModule.closeDelegationModal()">Anuluj</button>
            <button class="btn btn-blue" onclick="DelegationsModule.saveDelegation()">
              <i class="ti ti-device-floppy"></i> Zapisz
            </button>
          </div>
        </div>
      </div>
    `;

    await _fetchAll();
    _refreshList();
  }

  // ── KPI + table refresh ────────────────────────────────────────────────────
  function _refreshList() {
    const month   = document.getElementById('del-filter-month')?.value   || _thisMonth();
    const statusF = document.getElementById('del-filter-status')?.value  || '';
    const driverQ = (document.getElementById('del-filter-driver')?.value || '').toLowerCase();

    const thisMonth = _cache.filter(d => (d.date_from || '').startsWith(month));
    const monthCost = thisMonth.reduce((s, d) => s + _calcTotal(d), 0);
    const awaiting  = _cache.filter(d => d.status === 'submitted').length;
    const kpiEl = document.getElementById('del-kpi-row');
    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="stat-chip"><span>${thisMonth.length}</span> delegacji w miesiącu</div>
        <div class="stat-chip stat-chip-amber">
          <span>${monthCost.toFixed(0)} zł</span> kosztów w miesiącu
        </div>
        <div class="stat-chip ${awaiting ? 'stat-chip-amber' : ''}">
          <span>${awaiting}</span> oczekuje na zatwierdzenie
        </div>
      `;
    }

    const filtered = _cache.filter(d => {
      const mOk = !month   || (d.date_from || '').startsWith(month);
      const sOk = !statusF || d.status === statusF;
      const dOk = !driverQ || (d.driver || '').toLowerCase().includes(driverQ);
      return mOk && sOk && dOk;
    });

    const tbody = document.getElementById('del-tbody');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="11"
        style="text-align:center;padding:2.5rem;color:var(--text3)">
        <i class="ti ti-route-off" style="font-size:28px;display:block;margin-bottom:8px"></i>
        Brak delegacji w wybranym filtrze
      </td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(d => {
      const total    = _calcTotal(d);
      const dietAmt  = (d.diet_days ?? 0) * (d.diet_rate ?? 45);
      const pillCls  = STATUS_PILL[d.status]  || 'pill-gray';
      const pillText = STATUS_LABEL[d.status] || esc(d.status);
      const canApprove = d.status === 'draft' || d.status === 'submitted';
      return `<tr>
        <td>${esc(d.driver || '—')}</td>
        <td><span style="font-family:var(--mono,monospace)">${esc(d.nr_rej || '—')}</span></td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(d.destination || '—')}
        </td>
        <td style="white-space:nowrap">${_fmt(d.date_from)}</td>
        <td style="white-space:nowrap">${_fmt(d.date_to)}</td>
        <td>${esc(d.country || '—')}</td>
        <td style="text-align:right">${(d.km_driven ?? 0).toLocaleString('pl-PL')}</td>
        <td style="text-align:right">${dietAmt.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">${total.toFixed(2)}</td>
        <td><span class="pill ${pillCls}">${pillText}</span></td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="tbtn" title="Edytuj"
              data-id="${esc(d.id)}"
              onclick="DelegationsModule.showDelegationModal(this.dataset.id)">
              <i class="ti ti-edit"></i>
            </button>
            ${canApprove ? `
            <button class="tbtn" title="Zatwierdź" style="color:var(--green,#22c55e)"
              data-id="${esc(d.id)}"
              onclick="DelegationsModule.approveDelegation(this.dataset.id)">
              <i class="ti ti-check"></i>
            </button>` : ''}
            <button class="tbtn" title="Drukuj / PDF"
              data-id="${esc(d.id)}"
              onclick="DelegationsModule.printDelegation(this.dataset.id)">
              <i class="ti ti-printer"></i>
            </button>
            <button class="tbtn" title="Usuń" style="color:var(--red,#ef4444)"
              data-id="${esc(d.id)}"
              onclick="DelegationsModule.deleteDelegation(this.dataset.id)">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  let _editId = null;

  function showDelegationModal(id) {
    _editId = id || null;
    const d = id ? (_cache.find(x => x.id === id) || null) : null;
    const modal = document.getElementById('del-modal');
    if (!modal) return;

    document.getElementById('del-modal-title').textContent =
      d ? 'Edytuj delegację' : 'Nowa delegacja';

    document.getElementById('del-f-driver').value      = d?.driver      || '';
    document.getElementById('del-f-nrrej').value       = d?.nr_rej      || '';
    document.getElementById('del-f-destination').value = d?.destination  || '';
    document.getElementById('del-f-purpose').value     = d?.purpose      || '';
    document.getElementById('del-f-date-from').value   = d?.date_from    || '';
    document.getElementById('del-f-date-to').value     = d?.date_to      || '';
    document.getElementById('del-f-km').value          = d?.km_driven    ?? '';
    document.getElementById('del-f-km-rate').value     = d?.km_rate      ?? 0.89;
    document.getElementById('del-f-diet-days').value   = d?.diet_days    ?? '';
    document.getElementById('del-f-diet-rate').value   = d?.diet_rate    ?? 45;
    document.getElementById('del-f-hotel').value       = d?.hotel_cost   ?? '';
    document.getElementById('del-f-other').value       = d?.other_costs  ?? '';
    document.getElementById('del-f-status').value      = d?.status       || 'draft';
    document.getElementById('del-f-country').value     = d?.country      || 'Polska';
    document.getElementById('del-f-notes').value       = d?.notes        || '';

    _updateCalc();
    modal.style.display = 'flex';
  }

  function closeDelegationModal() {
    const m = document.getElementById('del-modal');
    if (m) m.style.display = 'none';
    _editId = null;
  }

  function _onCountryChange() {
    const country = document.getElementById('del-f-country')?.value || 'inne';
    const rate    = DIET_RATES[country] ?? DIET_RATES['inne'];
    const el      = document.getElementById('del-f-diet-rate');
    if (el) el.value = rate;
    _updateCalc();
  }

  function _updateCalc() {
    const km     = parseFloat(document.getElementById('del-f-km')?.value)        || 0;
    const kmRate = parseFloat(document.getElementById('del-f-km-rate')?.value)   || 0.89;
    const days   = parseFloat(document.getElementById('del-f-diet-days')?.value) || 0;
    const dRate  = parseFloat(document.getElementById('del-f-diet-rate')?.value) || 45;
    const hotel  = parseFloat(document.getElementById('del-f-hotel')?.value)     || 0;
    const other  = parseFloat(document.getElementById('del-f-other')?.value)     || 0;

    const kmCost   = km * kmRate;
    const dietCost = days * dRate;
    const total    = kmCost + dietCost + hotel + other;

    const preview = document.getElementById('del-calc-preview');
    if (!preview) return;
    preview.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
        <span>Przejazdy: <strong>${kmCost.toFixed(2)} zł</strong></span>
        <span>Diety: <strong>${dietCost.toFixed(2)} zł</strong></span>
        <span>Hotel: <strong>${hotel.toFixed(2)} zł</strong></span>
        <span>Inne: <strong>${other.toFixed(2)} zł</strong></span>
        <span style="margin-left:auto;font-size:15px;font-weight:700;color:var(--text1)">
          Razem: ${total.toFixed(2)} zł
        </span>
      </div>
    `;
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function saveDelegation() {
    const driver    = (document.getElementById('del-f-driver')?.value   || '').trim();
    const date_from = document.getElementById('del-f-date-from')?.value || '';
    if (!driver)    { alert('Podaj imię i nazwisko kierowcy');  return; }
    if (!date_from) { alert('Podaj datę wyjazdu');               return; }

    const record = {
      driver,
      nr_rej:      (document.getElementById('del-f-nrrej')?.value.trim()        || '').toUpperCase() || null,
      destination: document.getElementById('del-f-destination')?.value.trim()    || null,
      purpose:     document.getElementById('del-f-purpose')?.value.trim()        || null,
      date_from,
      date_to:     document.getElementById('del-f-date-to')?.value               || null,
      country:     document.getElementById('del-f-country')?.value               || 'Polska',
      km_driven:   parseFloat(document.getElementById('del-f-km')?.value)        || 0,
      km_rate:     parseFloat(document.getElementById('del-f-km-rate')?.value)   || 0.89,
      diet_days:   parseFloat(document.getElementById('del-f-diet-days')?.value) || 0,
      diet_rate:   parseFloat(document.getElementById('del-f-diet-rate')?.value) || 45,
      hotel_cost:  parseFloat(document.getElementById('del-f-hotel')?.value)     || 0,
      other_costs: parseFloat(document.getElementById('del-f-other')?.value)     || 0,
      status:      document.getElementById('del-f-status')?.value                || 'draft',
      notes:       document.getElementById('del-f-notes')?.value.trim()          || null,
    };

    const btn = document.querySelector('#del-modal .btn-blue');
    if (btn) btn.disabled = true;
    try {
      if (_editId) {
        await _api('PUT', `/api/delegations/${_editId}`, record);
        const idx = _cache.findIndex(x => x.id === _editId);
        if (idx >= 0) _cache[idx] = { ..._cache[idx], ...record };
      } else {
        const res = await _api('POST', '/api/delegations', record);
        if (res.id) _cache.unshift({ id: res.id, ...record });
      }
      closeDelegationModal();
      _refreshList();
      window.toast?.('Delegacja zapisana');
    } catch (e) {
      alert(`Błąd zapisu: ${  e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function approveDelegation(id) {
    if (!confirm('Zatwierdzić delegację?')) return;
    const d = _cache.find(x => x.id === id);
    if (!d) return;
    await _api('PUT', `/api/delegations/${id}`, { ...d, status: 'approved' });
    d.status = 'approved';
    _refreshList();
  }

  async function deleteDelegation(id) {
    if (!confirm('Usunąć delegację? Operacja jest nieodwracalna.')) return;
    await _api('DELETE', `/api/delegations/${id}`);
    _cache = _cache.filter(x => x.id !== id);
    _refreshList();
  }

  // ── PDF print ──────────────────────────────────────────────────────────────
  function printDelegation(id) {
    const d = _cache.find(x => x.id === id);
    if (!d) return;

    const total    = _calcTotal(d);
    const kmCost   = (d.km_driven ?? 0) * (d.km_rate ?? 0.89);
    const dietCost = (d.diet_days ?? 0) * (d.diet_rate ?? 45);
    const co       = esc(Co() || '');

    const win = window.open('', '_blank', 'width=820,height=960');
    if (!win) { alert('Zablokowane wyskakujące okienko — zezwól w przeglądarce i spróbuj ponownie.'); return; }

    win.document.write(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8">
<title>Delegacja — ${esc(d.driver)}</title>
<style>
  body  { font-family:Arial,sans-serif;font-size:12px;color:#222;margin:18mm 22mm; }
  h1    { font-size:15px;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:14px; }
  h2    { font-size:12px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.5px;color:#555; }
  table { border-collapse:collapse;width:100%;margin-bottom:12px; }
  td,th { border:1px solid #bbb;padding:5px 9px; }
  th    { background:#f0f0f0;font-weight:600;text-align:left; }
  .info td { border:none;padding:2px 0; }
  .info td:first-child { color:#666;width:130px; }
  .total { font-weight:700; }
  .sigs  { display:flex;gap:50px;margin-top:50px; }
  .sig   { border-top:1px solid #888;padding-top:6px;width:170px;font-size:10px;text-align:center;color:#444; }
  @media print { @page { margin:1.5cm } }
</style></head><body>
<h1>Polecenie wyjazdu służbowego / Rozliczenie delegacji</h1>
<table class="info">
  <tr><td>Firma:</td><td><strong>${co}</strong></td></tr>
  <tr><td>Pracownik:</td><td><strong>${esc(d.driver)}</strong></td></tr>
  <tr><td>Pojazd (nr rej.):</td><td>${esc(d.nr_rej || '—')}</td></tr>
  <tr><td>Trasa:</td><td>${esc(d.destination || '—')}</td></tr>
  <tr><td>Cel wyjazdu:</td><td>${esc(d.purpose || '—')}</td></tr>
  <tr><td>Data wyjazdu:</td><td>${esc(d.date_from || '—')}</td></tr>
  <tr><td>Data powrotu:</td><td>${esc(d.date_to   || '—')}</td></tr>
  <tr><td>Kraj:</td><td>${esc(d.country || '—')}</td></tr>
  <tr><td>Status:</td><td>${esc(STATUS_LABEL[d.status] || d.status || '—')}</td></tr>
</table>
<h2>Zestawienie kosztów</h2>
<table>
  <thead>
    <tr><th>Rodzaj kosztu</th><th>Podstawa obliczenia</th><th style="text-align:right">Kwota (PLN)</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Przejazdy — pojazd prywatny</td>
      <td>${(d.km_driven ?? 0).toLocaleString('pl-PL')} km × ${(d.km_rate ?? 0.89).toFixed(2)} zł/km</td>
      <td style="text-align:right">${kmCost.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Diety</td>
      <td>${(d.diet_days ?? 0)} dób × ${(d.diet_rate ?? 45).toFixed(2)} zł/dobę</td>
      <td style="text-align:right">${dietCost.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Koszty noclegów</td>
      <td>faktury / rachunki</td>
      <td style="text-align:right">${(d.hotel_cost ?? 0).toFixed(2)}</td>
    </tr>
    <tr>
      <td>Inne koszty</td>
      <td>—</td>
      <td style="text-align:right">${(d.other_costs ?? 0).toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="2" class="total">RAZEM do wypłaty</td>
      <td class="total" style="text-align:right">${total.toFixed(2)} PLN</td>
    </tr>
  </tbody>
</table>
${d.notes ? `<p style="margin-top:10px"><strong>Uwagi:</strong> ${esc(d.notes)}</p>` : ''}
<div class="sigs">
  <div class="sig">Podpis pracownika</div>
  <div class="sig">Zatwierdzający / podpis</div>
  <div class="sig">Główna księgowość</div>
</div>
<p style="margin-top:24px;font-size:10px;color:#aaa">
  Wygenerowano: ${new Date().toLocaleString('pl-PL')} | TaxOrder Pro
</p>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  // ── CSV export ─────────────────────────────────────────────────────────────
  function _csvCell(v) {
    const s    = String(v ?? '');
    const safe = /^[=+\-@\t\r\n]/.test(s) ? `\t${  s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function _exportCsv() {
    const hdr = '"ID";"Kierowca";"Pojazd";"Trasa";"Cel";"Data od";"Data do";"Kraj";' +
                '"Km";"Stawka km";"Diety PLN";"Hotel PLN";"Inne PLN";"Razem PLN";"Status"';
    const rows = _cache.map(d => {
      const dietAmt = (d.diet_days ?? 0) * (d.diet_rate ?? 45);
      return [
        d.id, d.driver, d.nr_rej || '', d.destination || '', d.purpose || '',
        d.date_from || '', d.date_to || '', d.country || '',
        d.km_driven ?? 0, d.km_rate ?? 0.89,
        dietAmt.toFixed(2),
        d.hotel_cost  ?? 0,
        d.other_costs ?? 0,
        _calcTotal(d).toFixed(2),
        d.status,
      ].map(_csvCell).join(';');
    });
    const csv  = [hdr, ...rows].join('\r\n');
    const blob = new Blob([`﻿${  csv}`], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `delegacje-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.DelegationsModule = {
    renderDelegations,
    _refreshList,
    showDelegationModal,
    closeDelegationModal,
    saveDelegation,
    approveDelegation,
    deleteDelegation,
    printDelegation,
    _updateCalc,
    _onCountryChange,
    _exportCsv,
  };

})();
