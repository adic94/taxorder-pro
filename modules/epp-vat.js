(function () {
  'use strict';
  const e  = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const Co = () => window._cfCo?.() || '';
  const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pl-PL') : '';

  let _nrRej = '';
  let _month = new Date().toISOString().slice(0, 7);
  let _entries = [];

  function _key() { return `taxorder_epp_${Co()}_${_nrRej}_${_month}`; }
  function _load() { try { _entries = JSON.parse(localStorage.getItem(_key()) || '[]'); } catch { _entries = []; } }
  function _save() { localStorage.setItem(_key(), JSON.stringify(_entries)); }

  async function renderEppVat() { _render(); }

  function _render() {
    const el = document.getElementById('page-epp-vat');
    if (!el) return;
    const vehs = (window.vehs || []).map(v => v.nrRej || v.nr_rej).filter(Boolean);
    if (_nrRej) _load();
    const totalKm = _entries.reduce((s, r) => s + (parseFloat(r.km) || 0), 0);

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-file-certificate"></i> Ewidencja Przebiegu Pojazdu (EPP / VAT)</h2>
  <div style="display:flex;gap:6px">
    ${_nrRej && _entries.length ? `
      <button class="btn-secondary" onclick="window.EppVatModule.exportCsv()"><i class="ti ti-download"></i> CSV</button>
      <button class="btn-secondary" onclick="window.EppVatModule.printReport()"><i class="ti ti-printer"></i> Drukuj</button>` : ''}
    ${_nrRej ? `<button class="btn-primary" onclick="window.EppVatModule.openEntry()"><i class="ti ti-plus"></i> Dodaj wpis</button>` : ''}
  </div>
</div>
<div style="background:var(--blue-light,#eff6ff);border:1px solid var(--blue);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--blue)">
  <i class="ti ti-info-circle"></i> <strong>Art. 86a ustawy o VAT</strong> — aby odliczyć 100% VAT od paliwa, firma musi prowadzić ewidencję przebiegu pojazdu. Każdy wpis musi zawierać: datę, trasę, cel wyjazdu, przebieg km oraz podpis kierowcy i pracodawcy.
</div>
<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">
  <div class="f" style="margin:0">
    <label style="margin-bottom:4px;font-size:12px">Pojazd</label>
    <select id="epp-nrrej" class="form-input" onchange="window.EppVatModule.setVehicle(this.value)" style="min-width:140px">
      <option value="">-- wybierz --</option>
      ${vehs.map(v => `<option value="${e(v)}" ${v === _nrRej ? 'selected' : ''}>${e(v)}</option>`).join('')}
    </select>
  </div>
  <div class="f" style="margin:0">
    <label style="margin-bottom:4px;font-size:12px">Miesiąc</label>
    <input type="month" id="epp-month" class="form-input" value="${_month}" onchange="window.EppVatModule.setMonth(this.value)">
  </div>
</div>
${!_nrRej ? `
<div style="padding:40px;text-align:center;color:var(--text3)">
  <i class="ti ti-car-off" style="font-size:48px;display:block;margin-bottom:12px"></i>
  Wybierz pojazd aby zobaczyć ewidencję
</div>` : `
<div class="kpi-chip" style="margin-bottom:16px;display:inline-flex">
  <i class="ti ti-route" style="color:var(--blue)"></i>
  <span class="kpi-val">${totalKm.toLocaleString('pl-PL')} km</span>
  <span class="kpi-lbl">Łącznie w miesiącu</span>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>#</th><th>Data</th><th>Trasa (skąd → dokąd)</th><th>Cel wyjazdu</th><th>Km</th><th>Kierowca</th><th></th></tr></thead>
<tbody>
${_entries.length ? _entries.map((r, i) => `<tr>
  <td>${i + 1}</td>
  <td>${e(fmtD(r.date))}</td>
  <td>${e(r.route)}</td>
  <td>${e(r.purpose)}</td>
  <td style="font-weight:600">${parseFloat(r.km || 0).toLocaleString('pl-PL')} km</td>
  <td>${e(r.driver || '—')}</td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon" data-idx="${i}" onclick="window.EppVatModule.openEntry(parseInt(this.dataset.idx))"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-idx="${i}" onclick="window.EppVatModule.deleteEntry(parseInt(this.dataset.idx))"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="7" class="empty">Brak wpisów — kliknij "Dodaj wpis"</td></tr>'}
${_entries.length ? `<tr style="font-weight:700;background:var(--bg-card)"><td colspan="4" style="text-align:right">SUMA MIESIĘCZNA:</td><td>${totalKm.toLocaleString('pl-PL')} km</td><td colspan="2"></td></tr>` : ''}
</tbody></table></div>`}

<div id="epp-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9100;align-items:center;justify-content:center">
  <div style="background:var(--bg-card);border-radius:var(--radius-lg);width:480px;max-width:96vw;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.25)">
    <div style="display:flex;align-items:center;margin-bottom:16px">
      <strong style="font-size:15px;flex:1">Wpis EPP</strong>
      <button onclick="window.EppVatModule.closeEntry()" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--text2)">✕</button>
    </div>
    <input type="hidden" id="epp-idx" value="">
    <div class="f" style="margin-bottom:10px">
      <label>Data</label>
      <input type="date" id="epp-date" class="form-input">
    </div>
    <div class="f" style="margin-bottom:10px">
      <label>Trasa (skąd → dokąd)</label>
      <input id="epp-route" class="form-input" placeholder="np. Warszawa → Kraków → Warszawa">
    </div>
    <div class="f" style="margin-bottom:10px">
      <label>Cel wyjazdu</label>
      <input id="epp-purpose" class="form-input" placeholder="np. spotkanie z klientem, dostawa towaru">
    </div>
    <div class="f" style="margin-bottom:10px">
      <label>Liczba km</label>
      <input type="number" id="epp-km" class="form-input" min="0" step="0.1" placeholder="0">
    </div>
    <div class="f" style="margin-bottom:16px">
      <label>Kierowca</label>
      <input id="epp-driver" class="form-input" placeholder="Imię i nazwisko kierowcy">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn-secondary" onclick="window.EppVatModule.closeEntry()">Anuluj</button>
      <button class="btn-primary" onclick="window.EppVatModule.saveEntry()"><i class="ti ti-check"></i> Zapisz</button>
    </div>
  </div>
</div>`;
  }

  function setVehicle(v) { _nrRej = v; _load(); _render(); }
  function setMonth(m) { _month = m; if (_nrRej) _load(); _render(); }

  function openEntry(idx) {
    const modal = document.getElementById('epp-modal');
    if (!modal) return;
    const r = idx != null ? _entries[idx] : null;
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('epp-idx').value     = idx != null ? String(idx) : '';
    document.getElementById('epp-date').value    = r?.date    || today;
    document.getElementById('epp-route').value   = r?.route   || '';
    document.getElementById('epp-purpose').value = r?.purpose || '';
    document.getElementById('epp-km').value      = r?.km      || '';
    document.getElementById('epp-driver').value  = r?.driver  || '';
    modal.style.display = 'flex';
  }

  function closeEntry() { const m = document.getElementById('epp-modal'); if (m) m.style.display = 'none'; }

  function saveEntry() {
    const idx  = document.getElementById('epp-idx').value;
    const entry = {
      date:    document.getElementById('epp-date').value,
      route:   document.getElementById('epp-route').value.trim(),
      purpose: document.getElementById('epp-purpose').value.trim(),
      km:      parseFloat(document.getElementById('epp-km').value) || 0,
      driver:  document.getElementById('epp-driver').value.trim(),
    };
    if (!entry.date)    { alert('Podaj datę'); return; }
    if (!entry.route)   { alert('Podaj trasę'); return; }
    if (!entry.purpose) { alert('Podaj cel wyjazdu'); return; }
    if (idx !== '') { _entries[parseInt(idx)] = entry; }
    else { _entries.push(entry); _entries.sort((a, b) => a.date.localeCompare(b.date)); }
    _save(); closeEntry(); _render();
  }

  function deleteEntry(idx) {
    if (!confirm('Usunąć wpis EPP?')) return;
    _entries.splice(idx, 1); _save(); _render();
  }

  function exportCsv() {
    const rows = [['Lp.','Data','Trasa','Cel wyjazdu','Km','Kierowca']];
    _entries.forEach((r, i) => rows.push([i+1, r.date, r.route, r.purpose, r.km, r.driver||'']));
    const total = _entries.reduce((s, r) => s + (r.km || 0), 0);
    rows.push(['', 'SUMA','','', total, '']);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `EPP_${_nrRej}_${_month}.csv`; a.click();
  }

  function printReport() {
    const total = _entries.reduce((s, r) => s + (r.km || 0), 0);
    const rows = _entries.map((r, i) => `
<tr>
  <td style="text-align:center">${i + 1}</td>
  <td>${r.date}</td>
  <td>${r.route}</td>
  <td>${r.purpose}</td>
  <td style="text-align:right">${(r.km || 0).toLocaleString('pl-PL')}</td>
  <td>${r.driver || ''}</td>
  <td style="border-bottom:1px solid #555;min-width:80px"></td>
</tr>`).join('');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">
<title>EPP ${_nrRej} ${_month}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; margin: 15mm; color: #000; }
  h2 { font-size: 12px; text-align: center; margin-bottom: 2px; }
  .info { font-size: 10px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 3px 5px; }
  th { background: #e8e8e8; font-weight: bold; text-align: center; }
  .total { font-weight: bold; background: #f0f0f0; }
  .footer { margin-top: 25px; display: flex; justify-content: space-between; }
  .sig-block { text-align: center; width: 180px; }
  .sig-line { border-top: 1px solid #333; padding-top: 3px; font-size: 9px; margin-top: 35px; }
  @media print { body { margin: 10mm; } }
</style></head>
<body>
<h2>EWIDENCJA PRZEBIEGU POJAZDU</h2>
<p style="text-align:center;font-size:9px;margin-top:0">(art. 86a ust. 7 ustawy o podatku od towarów i usług)</p>
<table class="info" style="border:none;font-size:10px;width:100%;margin:8px 0">
  <tr><td>Pojazd:</td><td><strong>${_nrRej}</strong></td><td>Miesiąc:</td><td><strong>${_month}</strong></td><td>Wydruk:</td><td><strong>${new Date().toLocaleDateString('pl-PL')}</strong></td></tr>
</table>
<table>
  <thead><tr><th>#</th><th>Data</th><th>Trasa (skąd → dokąd)</th><th>Cel wyjazdu</th><th>Km</th><th>Kierowca</th><th>Podpis</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="total"><td colspan="4" style="text-align:right">SUMA MIESIĘCZNA:</td><td style="text-align:right">${total.toLocaleString('pl-PL')} km</td><td colspan="2"></td></tr>
  </tbody>
</table>
<div class="footer">
  <div class="sig-block"><div class="sig-line">Sporządził(a)</div></div>
  <div class="sig-block"><div class="sig-line">Pracodawca / Kierownik</div></div>
</div>
</body></html>`);
    win.document.close(); win.print();
  }

  window.EppVatModule = { renderEppVat, setVehicle, setMonth, openEntry, closeEntry, saveEntry, deleteEntry, exportCsv, printReport };
})();
