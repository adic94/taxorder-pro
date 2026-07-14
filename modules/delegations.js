/**
 * TaxOrder Pro — Moduł Delegacji
 * Zarządza poleceniami wyjazdu i rozliczeniami delegacji.
 * Dane w localStorage (klucz: taxorder_delegations) — synchronizacja z backendem wkrótce.
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.() || window.currentCompanyId || '';

  const LS_KEY = 'taxorder_delegations';

  const DIET_RATES = { 'Polska': 45, 'Niemcy': 49, 'Francja': 50, 'Wielka Brytania': 42, 'inne': 40 };
  const KM_RATE    = { 'do 900 cc': 0.89, 'powyżej 900 cc': 0.89, 'motocykl': 0.69 };

  const STATUS_LABEL = { draft: 'Szkic', submitted: 'Złożona', approved: 'Zatwierdzona', paid: 'Wypłacona' };
  const STATUS_PILL  = { draft: 'pill-gray', submitted: 'pill-blue', approved: 'pill-green', paid: 'pill-green' };

  // ── Storage helpers ────────────────────────────────────────────────────────
  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  }
  function _save(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }

  function _fmt(ds) {
    if (!ds) return '—';
    const parts = String(ds).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : ds;
  }

  function _calcTotal(d) {
    return ((d.kmDriven ?? 0) * (d.kmRate ?? 0.89))
         + ((d.dietDays ?? 0) * (d.dietRate ?? 45))
         + (d.hotelCost  ?? 0)
         + (d.otherCosts ?? 0);
  }

  function _thisMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }

  // ── Main page render ───────────────────────────────────────────────────────
  function renderDelegations() {
    const pg = document.getElementById('page-delegations');
    if (!pg) return;

    pg.innerHTML = `
      <div style="padding:20px 24px 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <h2 style="margin:0;font-size:18px;font-weight:700"><i class="ti ti-road"></i> Delegacje</h2>
        <span style="font-size:12px;color:var(--text3)">Dane lokalne — synchronizacja z backendem wkrótce</span>
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
          <tbody id="del-tbody"></tbody>
        </table>
      </div>

      <!-- Modal -->
      <div id="del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);
           z-index:1000;align-items:flex-start;justify-content:center;overflow-y:auto;padding:30px 16px">
        <div style="background:var(--surface);border-radius:12px;width:min(700px,95vw);
             padding:28px;margin:auto;position:relative">
          <div style="display:flex;align-items:center;margin-bottom:20px">
            <h3 id="del-modal-title" style="margin:0;font-size:16px;font-weight:700">Nowa delegacja</h3>
            <button onclick="DelegationsModule.closeDelegationModal()"
              style="margin-left:auto;background:none;border:none;font-size:26px;
                     cursor:pointer;color:var(--text3);line-height:1">&times;</button>
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

    _refreshList();
  }

  // ── KPI + table refresh (called by filters too) ────────────────────────────
  function _refreshList() {
    const all     = _load();
    const month   = document.getElementById('del-filter-month')?.value   || _thisMonth();
    const statusF = document.getElementById('del-filter-status')?.value  || '';
    const driverQ = (document.getElementById('del-filter-driver')?.value || '').toLowerCase();

    // KPI row
    const thisMonth = all.filter(d => (d.dateFrom || '').startsWith(month));
    const monthCost = thisMonth.reduce((s, d) => s + _calcTotal(d), 0);
    const awaiting  = all.filter(d => d.status === 'submitted').length;
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

    // Filter
    const filtered = all.filter(d => {
      const mOk = !month   || (d.dateFrom || '').startsWith(month);
      const sOk = !statusF || d.status === statusF;
      const dOk = !driverQ || (d.driver  || '').toLowerCase().includes(driverQ);
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
      const dietAmt  = (d.dietDays ?? 0) * (d.dietRate ?? 45);
      const pillCls  = STATUS_PILL[d.status]  || 'pill-gray';
      const pillText = STATUS_LABEL[d.status] || esc(d.status);
      const canApprove = d.status === 'draft' || d.status === 'submitted';
      return `<tr>
        <td>${esc(d.driver || '—')}</td>
        <td><span style="font-family:var(--mono,monospace)">${esc(d.nrRej || '—')}</span></td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(d.destination || '—')}
        </td>
        <td style="white-space:nowrap">${_fmt(d.dateFrom)}</td>
        <td style="white-space:nowrap">${_fmt(d.dateTo)}</td>
        <td>${esc(d.country || '—')}</td>
        <td style="text-align:right">${(d.kmDriven ?? 0).toLocaleString('pl-PL')}</td>
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
    const d = id ? (_load().find(x => x.id === id) || null) : null;
    const modal = document.getElementById('del-modal');
    if (!modal) return;

    document.getElementById('del-modal-title').textContent =
      d ? 'Edytuj delegację' : 'Nowa delegacja';

    document.getElementById('del-f-driver').value      = d?.driver      || '';
    document.getElementById('del-f-nrrej').value       = d?.nrRej       || '';
    document.getElementById('del-f-destination').value = d?.destination  || '';
    document.getElementById('del-f-purpose').value     = d?.purpose      || '';
    document.getElementById('del-f-date-from').value   = d?.dateFrom     || '';
    document.getElementById('del-f-date-to').value     = d?.dateTo       || '';
    document.getElementById('del-f-km').value          = d?.kmDriven     ?? '';
    document.getElementById('del-f-km-rate').value     = d?.kmRate       ?? 0.89;
    document.getElementById('del-f-diet-days').value   = d?.dietDays     ?? '';
    document.getElementById('del-f-diet-rate').value   = d?.dietRate     ?? 45;
    document.getElementById('del-f-hotel').value       = d?.hotelCost    ?? '';
    document.getElementById('del-f-other').value       = d?.otherCosts   ?? '';
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
  function saveDelegation() {
    const driver   = (document.getElementById('del-f-driver')?.value   || '').trim();
    const dateFrom = document.getElementById('del-f-date-from')?.value || '';
    if (!driver)   { alert('Podaj imię i nazwisko kierowcy');  return; }
    if (!dateFrom) { alert('Podaj datę wyjazdu');               return; }

    const record = {
      id:          _editId || ('del_' + Date.now()),
      driver,
      nrRej:       (document.getElementById('del-f-nrrej')?.value.trim()        || '').toUpperCase(),
      destination: document.getElementById('del-f-destination')?.value.trim()    || '',
      purpose:     document.getElementById('del-f-purpose')?.value.trim()        || '',
      dateFrom,
      dateTo:      document.getElementById('del-f-date-to')?.value               || '',
      country:     document.getElementById('del-f-country')?.value               || 'Polska',
      kmDriven:    parseFloat(document.getElementById('del-f-km')?.value)        || 0,
      kmRate:      parseFloat(document.getElementById('del-f-km-rate')?.value)   || 0.89,
      dietDays:    parseFloat(document.getElementById('del-f-diet-days')?.value) || 0,
      dietRate:    parseFloat(document.getElementById('del-f-diet-rate')?.value) || 45,
      hotelCost:   parseFloat(document.getElementById('del-f-hotel')?.value)     || 0,
      otherCosts:  parseFloat(document.getElementById('del-f-other')?.value)     || 0,
      status:      document.getElementById('del-f-status')?.value                || 'draft',
      notes:       document.getElementById('del-f-notes')?.value.trim()          || '',
    };

    const all = _load();
    if (_editId) {
      const idx = all.findIndex(x => x.id === _editId);
      if (idx >= 0) all[idx] = record; else all.push(record);
    } else {
      all.push(record);
    }
    _save(all);
    closeDelegationModal();
    _refreshList();
    if (window.toast) toast('Delegacja zapisana');
  }

  function approveDelegation(id) {
    if (!confirm('Zatwierdzić delegację?')) return;
    const all = _load();
    const d   = all.find(x => x.id === id);
    if (d) { d.status = 'approved'; _save(all); _refreshList(); }
  }

  function deleteDelegation(id) {
    if (!confirm('Usunąć delegację? Operacja jest nieodwracalna.')) return;
    _save(_load().filter(x => x.id !== id));
    _refreshList();
  }

  // ── PDF print ──────────────────────────────────────────────────────────────
  function printDelegation(id) {
    const d = _load().find(x => x.id === id);
    if (!d) return;

    const total    = _calcTotal(d);
    const kmCost   = (d.kmDriven ?? 0) * (d.kmRate ?? 0.89);
    const dietCost = (d.dietDays ?? 0) * (d.dietRate ?? 45);
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
  <tr><td>Pojazd (nr rej.):</td><td>${esc(d.nrRej || '—')}</td></tr>
  <tr><td>Trasa:</td><td>${esc(d.destination || '—')}</td></tr>
  <tr><td>Cel wyjazdu:</td><td>${esc(d.purpose || '—')}</td></tr>
  <tr><td>Data wyjazdu:</td><td>${esc(d.dateFrom || '—')}</td></tr>
  <tr><td>Data powrotu:</td><td>${esc(d.dateTo   || '—')}</td></tr>
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
      <td>${(d.kmDriven ?? 0).toLocaleString('pl-PL')} km × ${(d.kmRate ?? 0.89).toFixed(2)} zł/km</td>
      <td style="text-align:right">${kmCost.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Diety</td>
      <td>${(d.dietDays ?? 0)} dób × ${(d.dietRate ?? 45).toFixed(2)} zł/dobę</td>
      <td style="text-align:right">${dietCost.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Koszty noclegów</td>
      <td>faktury / rachunki</td>
      <td style="text-align:right">${(d.hotelCost ?? 0).toFixed(2)}</td>
    </tr>
    <tr>
      <td>Inne koszty</td>
      <td>—</td>
      <td style="text-align:right">${(d.otherCosts ?? 0).toFixed(2)}</td>
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
    const safe = /^[=+\-@\t\r\n]/.test(s) ? '\t' + s : s;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function _exportCsv() {
    const all = _load();
    const hdr = '"ID";"Kierowca";"Pojazd";"Trasa";"Cel";"Data od";"Data do";"Kraj";' +
                '"Km";"Stawka km";"Diety PLN";"Hotel PLN";"Inne PLN";"Razem PLN";"Status"';
    const rows = all.map(d => {
      const dietAmt = (d.dietDays ?? 0) * (d.dietRate ?? 45);
      return [
        d.id, d.driver, d.nrRej || '', d.destination || '', d.purpose || '',
        d.dateFrom || '', d.dateTo || '', d.country || '',
        d.kmDriven ?? 0, d.kmRate ?? 0.89,
        dietAmt.toFixed(2),
        d.hotelCost  ?? 0,
        d.otherCosts ?? 0,
        _calcTotal(d).toFixed(2),
        d.status,
      ].map(_csvCell).join(';');
    });
    const csv  = [hdr, ...rows].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
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
