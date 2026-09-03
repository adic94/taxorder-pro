/* Rozliczenia km pracowniczych — delegacje i ryczałt */
(function () {
  const BASE = () => (localStorage.getItem('cf_worker_url') || 'https://taxorder-pro-api.adamus1000.workers.dev');
  const COMPANY = () => localStorage.getItem('cf_company') || '';
  const TOKEN = () => localStorage.getItem('cf_token') || '';
  const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${  TOKEN()}` });

  const STATUS_LABELS = { pending: 'Oczekuje', approved: 'Zatwierdzone', rejected: 'Odrzucone', paid: 'Wypłacone' };
  const STATUS_COLORS = { pending: '#ff9800', approved: '#2196f3', rejected: '#f44336', paid: '#4caf50' };

  function statusChip(status) {
    const color = STATUS_COLORS[status] || '#607d8b';
    const label = esc(STATUS_LABELS[status] || status);
    return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${label}</span>`;
  }

  function fd(ds) {
    if (!ds) return '—';
    const d = new Date(ds);
    return isNaN(d) ? '—' : d.toLocaleDateString('pl-PL');
  }

  async function fetchClaims(params) {
    const qs = new URLSearchParams({ company: COMPANY(), ...params });
    const r = await fetch(`${BASE()}/api/mileage-claims?${qs}`, { headers: hdrs() });
    return r.ok ? r.json() : [];
  }

  async function saveClaim(data, id) {
    const url = id
      ? `${BASE()}/api/mileage-claims/${id}?company=${COMPANY()}`
      : `${BASE()}/api/mileage-claims?company=${COMPANY()}`;
    const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: hdrs(), body: JSON.stringify(data) });
    return r.json();
  }

  async function deleteClaim(id) {
    await fetch(`${BASE()}/api/mileage-claims/${id}?company=${COMPANY()}`, { method: 'DELETE', headers: hdrs() });
  }

  async function changeStatus(id, action) {
    const r = await fetch(`${BASE()}/api/mileage-claims/${id}/${action}?company=${COMPANY()}`, {
      method: 'POST', headers: hdrs(),
    });
    return r.json();
  }

  // ─── Strona globalna ──────────────────────────────────────────────────────
  async function _renderGlobalPage() {
    const container = document.getElementById('mc-global-content');
    if (!container) return;
    container.innerHTML = '<div style="padding:24px;color:#888">Ładowanie...</div>';

    const filterStatus = document.getElementById('mc-filter-status')?.value || '';
    const filterDriver = document.getElementById('mc-filter-driver')?.value?.trim() || '';
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterDriver) params.driver = filterDriver;

    const claims = await fetchClaims(params);

    if (!claims.length) {
      container.innerHTML = '<div style="padding:24px;color:#888;text-align:center">Brak rozliczeń km</div>';
      return;
    }

    const totalAmount = claims.reduce((s, c) => s + (c.amount || 0), 0);
    let rows = '';
    for (const c of claims) {
      const canApprove = c.status === 'pending';
      const canPay     = c.status === 'approved';
      rows += `<tr>
        <td>${fd(c.claim_date)}</td>
        <td>${esc(c.driver_name)}</td>
        <td>${esc(c.nr_rej || '—')}</td>
        <td>${esc(c.purpose || '—')}</td>
        <td style="text-align:right">${c.km_total != null ? c.km_total.toLocaleString('pl-PL') : '—'}</td>
        <td style="text-align:right">${c.rate != null ? c.rate.toFixed(2) : '—'} zł</td>
        <td style="text-align:right;font-weight:600">${c.amount != null ? c.amount.toFixed(2) : '—'} zł</td>
        <td>${statusChip(c.status)}</td>
        <td>
          ${canApprove ? `<button class="btn-icon" title="Zatwierdź" style="color:#2196f3" data-id="${esc(c.id)}" onclick="MileageClaimsModule._changeStatus(this.dataset.id,'approved')"><i class="ti ti-check"></i></button>` : ''}
          ${canApprove ? `<button class="btn-icon" title="Odrzuć" style="color:#f44336" data-id="${esc(c.id)}" onclick="MileageClaimsModule._changeStatus(this.dataset.id,'rejected')"><i class="ti ti-x"></i></button>` : ''}
          ${canPay    ? `<button class="btn-icon" title="Oznacz jako wypłacone" style="color:#4caf50" data-id="${esc(c.id)}" onclick="MileageClaimsModule._changeStatus(this.dataset.id,'paid')"><i class="ti ti-cash"></i></button>` : ''}
          <button class="btn-icon" title="Edytuj" data-id="${esc(c.id)}" onclick="MileageClaimsModule._openEdit(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon" title="Usuń" style="color:#f44336" data-id="${esc(c.id)}" onclick="MileageClaimsModule._del(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }

    container.innerHTML = `
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;justify-content:flex-end">
        <span style="margin-right:auto;font-weight:600">Suma: ${totalAmount.toFixed(2)} zł</span>
        <button class="btn-sm" onclick="MileageClaimsModule._exportCsv()"><i class="ti ti-download"></i> CSV</button>
        <button class="btn-sm btn-primary" onclick="MileageClaimsModule._openEdit(null)"><i class="ti ti-plus"></i> Nowe rozliczenie</button>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table" style="font-size:13px">
          <thead><tr><th>Data</th><th>Pracownik</th><th>Pojazd</th><th>Cel</th><th style="text-align:right">km</th><th style="text-align:right">Stawka</th><th style="text-align:right">Kwota</th><th>Status</th><th>Akcje</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ─── CSV Export ───────────────────────────────────────────────────────────
  function _csvCell(v) {
    const s = String(v ?? '');
    const safe = /^[=+\-@\t\r\n]/.test(s) ? `\t${  s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  }
  async function _exportCsv() {
    const claims = await fetchClaims({});
    const header = '"Data";"Pracownik";"Pojazd";"Cel";"km_start";"km_end";"km";"Stawka";"Kwota";"Status"';
    const lines  = claims.map(c =>
      [c.claim_date, c.driver_name, c.nr_rej || '', c.purpose || '',
       c.km_start ?? '', c.km_end ?? '', c.km_total ?? '',
       (c.rate || 0).toFixed(2), (c.amount || 0).toFixed(2), c.status
      ].map(_csvCell).join(';')
    );
    const csv = [header, ...lines].join('\r\n');
    const blob = new Blob([`﻿${  csv}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rozliczenia-km-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // ─── Modal dodaj/edytuj ───────────────────────────────────────────────────
  let _editId = null;
  let _editData = null;

  function _openEdit(id) {
    _editId = id;
    const modal = document.getElementById('mc-modal');
    if (!modal) return;
    document.getElementById('mc-modal-title').textContent = id ? 'Edytuj rozliczenie' : 'Nowe rozliczenie km';
    if (!id) {
      document.getElementById('mc-f-date').value    = new Date().toISOString().slice(0, 10);
      document.getElementById('mc-f-driver').value  = '';
      document.getElementById('mc-f-nrrej').value   = '';
      document.getElementById('mc-f-kmstart').value = '';
      document.getElementById('mc-f-kmend').value   = '';
      document.getElementById('mc-f-purpose').value = '';
      document.getElementById('mc-f-rate').value    = '0.89';
      document.getElementById('mc-f-notes').value   = '';
      _updateCalc();
    } else {
      fetchClaims({}).then(list => {
        const c = list.find(x => x.id === id);
        if (!c) return;
        _editData = c;
        document.getElementById('mc-f-date').value    = c.claim_date || '';
        document.getElementById('mc-f-driver').value  = c.driver_name || '';
        document.getElementById('mc-f-nrrej').value   = c.nr_rej || '';
        document.getElementById('mc-f-kmstart').value = c.km_start ?? '';
        document.getElementById('mc-f-kmend').value   = c.km_end ?? '';
        document.getElementById('mc-f-purpose').value = c.purpose || '';
        document.getElementById('mc-f-rate').value    = c.rate ?? 0.89;
        document.getElementById('mc-f-notes').value   = c.notes || '';
        _updateCalc();
      });
    }
    modal.style.display = 'flex';
  }

  function _closeEdit() {
    const modal = document.getElementById('mc-modal');
    if (modal) modal.style.display = 'none';
  }

  function _updateCalc() {
    const start = parseInt(document.getElementById('mc-f-kmstart')?.value) || 0;
    const end   = parseInt(document.getElementById('mc-f-kmend')?.value)   || 0;
    const rate  = parseFloat(document.getElementById('mc-f-rate')?.value)  || 0.89;
    const km    = Math.max(0, end - start);
    const amount = (km * rate).toFixed(2);
    const preview = document.getElementById('mc-calc-preview');
    if (preview) preview.textContent = km > 0 ? `${km} km × ${rate.toFixed(2)} zł = ${amount} zł` : '';
  }

  async function _submitEdit() {
    const id = _editId;
    const data = {
      claim_date:  document.getElementById('mc-f-date').value,
      driver_name: document.getElementById('mc-f-driver').value.trim(),
      nr_rej:      document.getElementById('mc-f-nrrej').value.trim() || null,
      km_start:    document.getElementById('mc-f-kmstart').value !== '' ? parseInt(document.getElementById('mc-f-kmstart').value) : null,
      km_end:      document.getElementById('mc-f-kmend').value   !== '' ? parseInt(document.getElementById('mc-f-kmend').value)   : null,
      purpose:     document.getElementById('mc-f-purpose').value.trim(),
      rate:        parseFloat(document.getElementById('mc-f-rate').value) || 0.89,
      notes:       document.getElementById('mc-f-notes').value.trim(),
    };
    if (!data.driver_name) { alert('Podaj imię i nazwisko pracownika'); return; }
    if (!data.claim_date)  { alert('Podaj datę'); return; }
    const res = await saveClaim(data, id);
    if (!res.ok && !res.id) { alert('Błąd zapisu'); return; }
    _closeEdit();
    _renderGlobalPage();
  }

  async function _changeStatus(id, action) {
    const labels = { approved: 'Zatwierdzić', rejected: 'Odrzucić', paid: 'Oznaczyć jako wypłacone' };
    if (!confirm(`${labels[action] || action} to rozliczenie?`)) return;
    try {
      await changeStatus(id, action);
      _renderGlobalPage();
    } catch (e) { if (window.toast) toast('Błąd zmiany statusu — spróbuj ponownie'); }
  }

  async function _del(id) {
    if (!confirm('Usunąć rozliczenie?')) return;
    try {
      await deleteClaim(id);
      _renderGlobalPage();
    } catch (e) { if (window.toast) toast('Błąd usuwania — spróbuj ponownie'); }
  }

  window.MileageClaimsModule = {
    _renderGlobalPage, _exportCsv,
    _openEdit, _closeEdit, _submitEdit, _updateCalc,
    _changeStatus, _del,
  };
})();
