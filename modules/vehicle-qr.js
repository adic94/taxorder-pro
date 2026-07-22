(function () {
  'use strict';
  const API = () => window.CF_WORKER_URL || '';
  const co  = () => window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  async function api(path, opts={}) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${API()}/api/vehicle-qr${path}${sep}company=${co()}`, { headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('cf_token')}`}, ...opts });
    return r.json();
  }

  function _qrUrl(vehicleId) {
    return `${API()}/api/vehicle-qr/scan/${vehicleId}?company=${co()}`;
  }

  function _googleChartQr(text) {
    return `https://chart.googleapis.com/chart?chs=220x220&cht=qr&chl=${encodeURIComponent(text)}&choe=UTF-8`;
  }

  function renderVehicleQr() {
    const el = document.getElementById('page-vehicle-qr');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-qrcode"></i> Kody QR Pojazdów</h2>
      </div>
      <p style="color:var(--text-muted);margin-bottom:16px;font-size:.9em">Każdy pojazd ma unikalny kod QR. Po zeskanowaniu wyświetla się karta pojazdu. Przydatne do szybkiej identyfikacji przy inspekcji lub zdaniu/odbiorze pojazdu.</p>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input id="qr-search" class="form-control" style="max-width:300px" placeholder="Nr rej. / marka / model..." oninput="window.VehicleQrModule._load()">
        <button class="btn btn-outline" onclick="window.VehicleQrModule._printAll()"><i class="ti ti-printer"></i> Drukuj wszystkie</button>
      </div>
      <div id="qr-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px"></div>
      <div class="table-wrap" style="margin-top:24px">
        <h4 style="margin-bottom:8px"><i class="ti ti-history"></i> Historia skanowań</h4>
        <table class="data-table">
          <thead><tr><th>Data skanowania</th><th>Pojazd</th><th>Scaner (IP)</th><th>Akcja</th></tr></thead>
          <tbody id="qr-scan-log"><tr><td colspan="4" class="loading-row">Ładowanie...</td></tr></tbody>
        </table>
      </div>`;
    _load();
  }

  async function _load() {
    const q     = document.getElementById('qr-search')?.value || '';
    const grid  = document.getElementById('qr-grid');
    const tbody = document.getElementById('qr-scan-log');
    if (!grid) return;
    const [vData, logData] = await Promise.all([
      api(`/vehicles?q=${encodeURIComponent(q)}`),
      api('/scans')
    ]);
    const vehicles = vData.vehicles || [];
    grid.innerHTML = vehicles.length
      ? vehicles.map(v => `
          <div style="background:var(--bg-card,#fff);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:16px;text-align:center">
            <div style="font-weight:700;font-size:1.05em">${esc(v.reg)}</div>
            <div style="color:var(--text-muted);font-size:.85em">${esc(v.brand||'')} ${esc(v.model||'')}</div>
            <div style="margin:10px auto;width:150px;height:150px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:.7em;color:#94a3b8;overflow:hidden">
              <img src="${_googleChartQr(_qrUrl(v.id))}" alt="QR ${esc(v.reg)}" style="width:150px;height:150px" onerror="this.style.display='none';this.nextSibling.style.display='block'">
              <span style="display:none">QR (offline)</span>
            </div>
            <div style="font-size:.7em;color:#94a3b8;word-break:break-all;margin-bottom:8px">${esc(_qrUrl(v.id))}</div>
            <button class="btn btn-outline" style="font-size:.8em" data-id="${esc(v.id)}" data-reg="${esc(v.reg)}" onclick="window.VehicleQrModule._printOne(this.dataset.id, this.dataset.reg)"><i class="ti ti-printer"></i> Drukuj</button>
          </div>`).join('')
      : '<div style="grid-column:1/-1;color:var(--text-muted)">Brak pojazdów</div>';
    const scans = logData.scans || [];
    if (tbody) {
      tbody.innerHTML = scans.length
        ? scans.map(s => `<tr>
            <td>${esc(s.scanned_at?.replace('T',' ').slice(0,19)||'—')}</td>
            <td>${esc(s.vehicle_reg||s.vehicle_id||'—')}</td>
            <td>${esc(s.scanner_ip||'—')}</td>
            <td>${esc(s.action||'view')}</td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="empty-row">Brak historii skanowań</td></tr>';
    }
  }

  function _printOne(vehicleId, reg) {
    const url = _qrUrl(vehicleId);
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>QR — ${esc(reg)}</title></head><body style="font-family:sans-serif;text-align:center;padding:20px">
      <h3>${esc(reg)}</h3>
      <img src="${_googleChartQr(url)}" style="width:200px;height:200px">
      <p style="font-size:.75em;word-break:break-all">${esc(url)}</p>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  }

  function _printAll() {
    const cards = document.querySelectorAll('#qr-grid [data-id]');
    if (!cards.length) { alert('Brak pojazdów do druku.'); return; }
    const w = window.open('', '_blank');
    let html = `<html><head><title>Kody QR — Pojazdy</title><style>
      body{font-family:sans-serif;} .card{display:inline-block;width:220px;text-align:center;margin:10px;padding:10px;border:1px solid #ddd;border-radius:6px;page-break-inside:avoid}
      img{width:180px;height:180px} @media print{.card{page-break-inside:avoid}}
    </style></head><body>`;
    cards.forEach(c => {
      const id  = c.dataset.id;
      const reg = c.dataset.reg;
      const url = _qrUrl(id);
      html += `<div class="card"><b>${esc(reg)}</b><br><img src="${_googleChartQr(url)}"><br><small>${esc(url)}</small></div>`;
    });
    html += `<script>window.onload=function(){window.print()}<\/script></body></html>`;
    w.document.write(html);
  }

  window.VehicleQrModule = { renderVehicleQr, _load, _printOne, _printAll };
})();
