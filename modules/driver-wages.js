(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v, d=2) => v != null ? parseFloat(v).toLocaleString('pl-PL', {minimumFractionDigits:d,maximumFractionDigits:d}) : '—';

  const STATUS_LBL = { draft:'Szkic', approved:'Zatwierdzony', paid:'Wypłacony' };
  const STATUS_CLR = { draft:'#d97706', approved:'#2563eb', paid:'#16a34a' };

  let _wages = [];
  let _rates = [];
  let _activeTab = 'wages';

  async function renderDriverWages() {
    const co     = Co();
    const period = document.getElementById('dw-period')?.value || new Date().toISOString().slice(0,7);
    try {
      const [wR, rR] = await Promise.all([
        fetch(`${API()}/api/driver-wages?company=${encodeURIComponent(co)}&period_month=${period}`, { headers: H() }),
        fetch(`${API()}/api/driver-wages/rates?company=${encodeURIComponent(co)}`, { headers: H() }),
      ]);
      if (wR.ok) _wages = await wR.json();
      if (rR.ok) _rates = await rR.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-driver-wages');
    if (!el) return;
    const period = document.getElementById('dw-period')?.value || new Date().toISOString().slice(0,7);
    const totalGross = _wages.reduce((s,w) => s + (w.gross_total||0), 0);
    const totalNet   = _wages.reduce((s,w) => s + (w.net_total||0), 0);

    el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
  <h2 style="margin:0;font-size:18px"><i class="ti ti-cash"></i> Wynagrodzenia kierowców</h2>
  <div style="display:flex;gap:8px;align-items:center">
    <input type="month" id="dw-period" class="sel" value="${e(period)}" onchange="window.DriverWages.renderDriverWages()">
    <button class="btn btn-primary" onclick="window.DriverWages._openCalculate()"><i class="ti ti-calculator"></i> Oblicz wynagrodzenie</button>
    <button class="btn btn-sm" onclick="window.DriverWages._showRates()"><i class="ti ti-settings"></i> Stawki</button>
  </div>
</div>

<!-- KPI -->
${_wages.length > 0 ? `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:20px">
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #2563eb">
    <div style="font-size:22px;font-weight:700">${_wages.length}</div>
    <div style="font-size:12px;color:var(--text3)">Kierowców w ${period}</div>
  </div>
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #d97706">
    <div style="font-size:22px;font-weight:700;color:#d97706">${fmtN(totalGross)} PLN</div>
    <div style="font-size:12px;color:var(--text3)">Łączne brutto</div>
  </div>
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #16a34a">
    <div style="font-size:22px;font-weight:700;color:#16a34a">${fmtN(totalNet)} PLN</div>
    <div style="font-size:12px;color:var(--text3)">Łączne netto</div>
  </div>
  <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:3px solid #dc2626">
    <div style="font-size:22px;font-weight:700;color:#dc2626">${fmtN(totalGross - totalNet)} PLN</div>
    <div style="font-size:12px;color:var(--text3)">Łączny PIT</div>
  </div>
</div>` : ''}

<!-- Tabela -->
${_wages.length === 0 ? `<div style="padding:40px;text-align:center;background:var(--bg2);border-radius:12px">
  <i class="ti ti-cash" style="font-size:40px;color:var(--text3)"></i>
  <p style="color:var(--text3);margin-top:10px">Brak rozliczeń za ${period}.<br>
  Kliknij "Oblicz wynagrodzenie" aby wygenerować rozliczenie na podstawie danych tachografu.</p>
</div>` : `
<div style="overflow-x:auto">
<table class="tach-table">
  <thead>
    <tr>
      <th>Kierowca</th>
      <th style="text-align:right">Godz. jazdy</th>
      <th style="text-align:right">Godz. pracy</th>
      <th style="text-align:right">Nadgodziny</th>
      <th style="text-align:right">Brutto PLN</th>
      <th style="text-align:right">PIT</th>
      <th style="text-align:right">Netto PLN</th>
      <th>Status</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    ${_wages.map(w => `<tr>
      <td><strong>${e(w.driver_name)}</strong></td>
      <td style="text-align:right;font-size:12px">${fmtN(w.driving_hours??0,1)}h</td>
      <td style="text-align:right;font-size:12px">${fmtN(w.work_hours??0,1)}h</td>
      <td style="text-align:right;font-size:12px;color:${(w.overtime_hours??0)>0?'#d97706':'inherit'}">${fmtN(w.overtime_hours??0,1)}h</td>
      <td style="text-align:right;font-weight:700">${fmtN(w.gross_total??0)} PLN</td>
      <td style="text-align:right;font-size:12px;color:#dc2626">${fmtN(w.tax_amount??0)} PLN</td>
      <td style="text-align:right;font-weight:700;color:#16a34a">${fmtN(w.net_total??0)} PLN</td>
      <td>
        <span style="padding:3px 8px;border-radius:8px;font-size:11px;font-weight:600;
          background:${STATUS_CLR[w.status]||'#6b7280'}22;color:${STATUS_CLR[w.status]||'#6b7280'}">
          ${STATUS_LBL[w.status]||e(w.status)}
        </span>
      </td>
      <td style="display:flex;gap:4px">
        <button class="btn btn-sm" data-id="${e(w.id)}" onclick="window.DriverWages._details(this.dataset.id)" title="Szczegóły"><i class="ti ti-eye"></i></button>
        ${w.status==='draft'?`<button class="btn btn-sm" data-id="${e(w.id)}" onclick="window.DriverWages._approve(this.dataset.id)" title="Zatwierdź" style="color:#2563eb"><i class="ti ti-check"></i></button>`:''}
        ${w.status==='approved'?`<button class="btn btn-sm" data-id="${e(w.id)}" onclick="window.DriverWages._markPaid(this.dataset.id)" title="Oznacz jako wypłacone" style="color:#16a34a"><i class="ti ti-cash"></i></button>`:''}
      </td>
    </tr>`).join('')}
  </tbody>
</table>
</div>`}

<div style="margin-top:14px;padding:12px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <i class="ti ti-info-circle"></i> Wynagrodzenia obliczane są na podstawie danych z tachografów DDD (godziny jazdy + godziny pracy).
  Diety i inne składniki należy dodać ręcznie. Dieta urzędowa 2024: <strong>45 PLN/dobę krajową</strong>.
</div>

<!-- Modal -->
<div id="dw-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
  <div id="dw-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(600px,96vw);max-height:90vh;overflow-y:auto"></div>
</div>`;
  }

  function _openCalculate() {
    const inner = document.getElementById('dw-modal-inner');
    const m     = document.getElementById('dw-modal');
    if (!inner||!m) return;
    const period = document.getElementById('dw-period')?.value || new Date().toISOString().slice(0,7);

    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0"><i class="ti ti-calculator"></i> Oblicz wynagrodzenie</h3>
  <button onclick="window.DriverWages._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
</div>
<div style="margin-bottom:12px">
  <label style="font-size:12px;color:var(--text3)">Kierowca (Nazwisko Imię)</label><br>
  <input type="text" id="dw-c-name" class="sel" placeholder="np. Kowalski Jan">
</div>
<div style="margin-bottom:12px">
  <label style="font-size:12px;color:var(--text3)">Miesiąc rozliczeniowy</label><br>
  <input type="month" id="dw-c-period" class="sel" value="${e(period)}">
</div>
<div id="dw-calc-result"></div>
<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
  <button class="btn" onclick="window.DriverWages._closeModal()">Zamknij</button>
  <button class="btn btn-primary" onclick="window.DriverWages._doCalculate()"><i class="ti ti-calculator"></i> Oblicz z tachografu</button>
</div>`;
    m.style.display = 'flex';
  }

  async function _doCalculate() {
    const driver_name  = document.getElementById('dw-c-name')?.value?.trim();
    const period_month = document.getElementById('dw-c-period')?.value;
    if (!driver_name)  { alert('Podaj nazwisko i imię kierowcy'); return; }
    if (!period_month) { alert('Wybierz miesiąc'); return; }
    const res = document.getElementById('dw-calc-result');
    if (res) res.innerHTML = '<div style="padding:12px;text-align:center"><i class="ti ti-loader"></i> Obliczanie...</div>';
    try {
      const r = await fetch(`${API()}/api/driver-wages/calculate?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_name, period_month })
      });
      const data = r.ok ? await r.json() : { ok: false };
      if (res) res.innerHTML = data.ok ? `
<div style="background:var(--bg2);border-radius:10px;padding:14px;margin-top:10px">
  <h4 style="margin:0 0 10px;font-size:13px">${e(driver_name)} · ${e(period_month)}</h4>
  <table style="width:100%;font-size:13px;border-collapse:collapse">
    <tr><td style="padding:4px 8px;color:var(--text3)">Godziny jazdy</td><td style="padding:4px 8px;text-align:right">${fmtN(data.driving_hours,1)} h</td></tr>
    <tr style="background:var(--bg)"><td style="padding:4px 8px;color:var(--text3)">Godziny pracy</td><td style="padding:4px 8px;text-align:right">${fmtN(data.work_hours,1)} h</td></tr>
    <tr><td style="padding:4px 8px;color:var(--text3)">Nadgodziny</td><td style="padding:4px 8px;text-align:right">${fmtN(data.overtime_hours,1)} h</td></tr>
    <tr style="background:var(--bg)"><td style="padding:4px 8px;color:var(--text3)">Wynagrodzenie podstawowe</td><td style="padding:4px 8px;text-align:right">${fmtN(data.base_salary)} PLN</td></tr>
    <tr><td style="padding:4px 8px;color:var(--text3)">Premia za nadgodziny</td><td style="padding:4px 8px;text-align:right">${fmtN(data.overtime_bonus)} PLN</td></tr>
    ${(data.penalty_deduction??0)>0?`<tr style="background:var(--bg)"><td style="padding:4px 8px;color:#dc2626">Potrącenie (naruszenia tachograf)</td><td style="padding:4px 8px;text-align:right;color:#dc2626">-${fmtN(data.penalty_deduction)} PLN</td></tr>`:''}
    <tr style="border-top:2px solid var(--border)"><td style="padding:6px 8px;font-weight:700">Brutto</td><td style="padding:6px 8px;text-align:right;font-weight:800;font-size:15px">${fmtN(data.gross_total)} PLN</td></tr>
    <tr><td style="padding:4px 8px;color:#dc2626">PIT</td><td style="padding:4px 8px;text-align:right;color:#dc2626">-${fmtN(data.tax_amount)} PLN</td></tr>
    <tr style="background:#dcfce7"><td style="padding:6px 8px;font-weight:700;color:#16a34a">Netto do wypłaty</td><td style="padding:6px 8px;text-align:right;font-weight:800;font-size:15px;color:#16a34a">${fmtN(data.net_total)} PLN</td></tr>
  </table>
  <div style="margin-top:10px;font-size:11px;color:var(--text3)"><i class="ti ti-info-circle"></i> Stawka obliczona z danych tachografu. Dodaj diety i inne składniki ręcznie.</div>
</div>` : '<div style="color:#dc2626;padding:10px">Błąd obliczenia — sprawdź czy kierowca ma dane DDD w wybranym miesiącu</div>';
      if (data.ok) { setTimeout(() => renderDriverWages(), 500); }
    } catch (ex) { if (res) res.innerHTML = `<div style="color:#dc2626">${e(ex.message)}</div>`; }
  }

  async function _approve(id) {
    await fetch(`${API()}/api/driver-wages/${id}?company=${encodeURIComponent(Co())}`, {
      method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString() })
    });
    await renderDriverWages();
  }

  async function _markPaid(id) {
    await fetch(`${API()}/api/driver-wages/${id}?company=${encodeURIComponent(Co())}`, {
      method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() })
    });
    await renderDriverWages();
  }

  async function _details(id) {
    const w = _wages.find(w => w.id === id);
    if (!w) return;
    const inner = document.getElementById('dw-modal-inner');
    const m     = document.getElementById('dw-modal');
    if (!inner||!m) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <h3 style="margin:0">${e(w.driver_name)} · ${e(w.period_month)}</h3>
  <button onclick="window.DriverWages._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
</div>
<table style="width:100%;font-size:13px;border-collapse:collapse">
  ${[
    ['Godziny jazdy', fmtN(w.driving_hours,1)+' h'],
    ['Godziny pracy', fmtN(w.work_hours,1)+' h'],
    ['Łącznie godzin', fmtN(w.total_hours,1)+' h'],
    ['Nadgodziny', fmtN(w.overtime_hours,1)+' h'],
    ['Godziny nocne', fmtN(w.night_hours,1)+' h'],
    ['Wynagrodzenie podstawowe', fmtN(w.base_salary)+' PLN'],
    ['Premia za nadgodziny', fmtN(w.overtime_bonus)+' PLN'],
    ['Premia nocna', fmtN(w.night_bonus)+' PLN'],
    ['Diety', fmtN(w.daily_allowances)+' PLN'],
    ['Premia eco-driving', fmtN(w.eco_bonus)+' PLN'],
    ['Potrącenie naruszenia', '-'+fmtN(w.penalty_deduction)+' PLN'],
    ['BRUTTO', fmtN(w.gross_total)+' PLN'],
    ['Zaliczka PIT', '-'+fmtN(w.tax_amount)+' PLN'],
    ['NETTO', fmtN(w.net_total)+' PLN'],
  ].map(([label,val],i) => `<tr style="${i%2===0?'background:var(--bg)':''}"><td style="padding:5px 8px;color:var(--text3)">${label}</td><td style="padding:5px 8px;text-align:right;font-weight:${label.startsWith('BRUTTO')||label.startsWith('NETTO')?'800':'400'}">${val}</td></tr>`).join('')}
</table>`;
    m.style.display = 'flex';
  }

  async function _showRates() {
    const inner = document.getElementById('dw-modal-inner');
    const m     = document.getElementById('dw-modal');
    if (!inner||!m) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <h3 style="margin:0"><i class="ti ti-settings"></i> Stawki wynagrodzeń</h3>
  <button onclick="window.DriverWages._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
</div>
<div style="margin-bottom:14px">
  <h4 style="font-size:13px;margin:0 0 8px">Dodaj / aktualizuj stawkę</h4>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div style="grid-column:1/-1"><label style="font-size:12px;color:var(--text3)">Kierowca (Nazwisko Imię)</label><br>
      <input type="text" id="wr-name" class="sel" placeholder="Kowalski Jan"></div>
    <div><label style="font-size:12px;color:var(--text3)">Stawka godzinowa (PLN/h)</label><br>
      <input type="number" id="wr-rate" class="sel" step="0.5" value="25"></div>
    <div><label style="font-size:12px;color:var(--text3)">Dieta krajowa (PLN/dobę)</label><br>
      <input type="number" id="wr-diet" class="sel" step="1" value="45"></div>
    <div><label style="font-size:12px;color:var(--text3)">Mnożnik nadgodzin</label><br>
      <input type="number" id="wr-ot" class="sel" step="0.1" value="1.5"></div>
    <div><label style="font-size:12px;color:var(--text3)">Stawka PIT (0.12 = 12%)</label><br>
      <input type="number" id="wr-tax" class="sel" step="0.01" value="0.12"></div>
  </div>
  <button class="btn btn-primary" onclick="window.DriverWages._saveRate()" style="margin-top:10px"><i class="ti ti-check"></i> Zapisz stawkę</button>
</div>
${_rates.length?`<table class="tach-table">
  <thead><tr><th>Kierowca</th><th>PLN/h</th><th>Dieta</th><th>Nadgodz.</th><th>PIT</th></tr></thead>
  <tbody>${_rates.map(r=>`<tr><td>${e(r.driver_name)}</td><td>${fmtN(r.hourly_rate,2)}</td><td>${fmtN(r.daily_allowance,0)}</td><td>${fmtN(r.overtime_rate_mult,1)}×</td><td>${Math.round((r.tax_rate??0.12)*100)}%</td></tr>`).join('')}</tbody>
</table>`:'<p style="color:var(--text3);font-size:12px">Brak zapisanych stawek.</p>'}`;
    m.style.display = 'flex';
  }

  async function _saveRate() {
    const driver_name       = document.getElementById('wr-name')?.value?.trim();
    const hourly_rate       = parseFloat(document.getElementById('wr-rate')?.value||25);
    const daily_allowance   = parseFloat(document.getElementById('wr-diet')?.value||45);
    const overtime_rate_mult= parseFloat(document.getElementById('wr-ot')?.value||1.5);
    const tax_rate          = parseFloat(document.getElementById('wr-tax')?.value||0.12);
    if (!driver_name) { alert('Wpisz nazwisko kierowcy'); return; }
    try {
      const r = await fetch(`${API()}/api/driver-wages/rates?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_name, hourly_rate, daily_allowance, overtime_rate_mult, tax_rate })
      });
      if (r.ok) { await _showRates(); } else alert('Błąd zapisu');
    } catch (ex) { alert(ex.message); }
  }

  function _closeModal() {
    const m = document.getElementById('dw-modal');
    if (m) m.style.display = 'none';
  }

  window.DriverWages = { renderDriverWages, _openCalculate, _doCalculate, _approve, _markPaid, _details, _showRates, _saveRate, _closeModal };
})();
