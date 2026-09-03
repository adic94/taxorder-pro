/**
 * TaxOrder Pro — Wycena i amortyzacja floty
 * Szacowana wartość rynkowa + deprecjacja, analiza wymiany, wycena ręczna.
 */
(function () {
  'use strict';

  /* ── Pomocnicze ─────────────────────────────────────────────────────────── */
  const e = s => typeof esc === 'function'
    ? esc(s)
    : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtN = (v, d = 0) =>
    v != null ? (+v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

  const fmtPLN = (v, d = 0) => v != null ? `${fmtN(v, d)  } zł` : '—';

  /* ── Stałe deprecjacji ──────────────────────────────────────────────────── */
  const DEPR_RATES = [0.20, 0.15, 0.12, 0.10, 0.08]; // rok 1–5
  // Rok 6+: -5%/rok (Math.pow(0.95, age - 5))

  const CURRENT_YEAR = new Date().getFullYear();

  /**
   * Szacunkowa wartość pojazdu w bieżącym roku.
   * @param {number} price  – cena zakupu netto
   * @param {number} year   – rok produkcji
   */
  function calcValue(price, year) {
    if (!price || !year || price <= 0 || year <= 0) return null;
    const age = CURRENT_YEAR - year;
    if (age <= 0) return price;
    let v = price;
    for (let i = 0; i < Math.min(age, DEPR_RATES.length); i++) v *= (1 - DEPR_RATES[i]);
    if (age > 5) v *= Math.pow(0.95, age - 5);
    return Math.max(v, price * 0.05);
  }

  /**
   * Szacunkowa wartość pojazdu na koniec konkretnego roku.
   * @param {number} price       – cena zakupu netto
   * @param {number} purchYear   – rok produkcji pojazdu
   * @param {number} atYear      – rok referencyjny
   */
  function _calcValueAt(price, purchYear, atYear) {
    if (!price || !purchYear || price <= 0 || purchYear <= 0) return null;
    const age = atYear - purchYear;
    if (age <= 0) return price;
    let v = price;
    for (let i = 0; i < Math.min(age, DEPR_RATES.length); i++) v *= (1 - DEPR_RATES[i]);
    if (age > 5) v *= Math.pow(0.95, age - 5);
    return Math.max(v, price * 0.05);
  }

  /* ── Stan Chart.js ──────────────────────────────────────────────────────── */
  let _chart = null;

  /* ── Pillsy typów własności ─────────────────────────────────────────────── */
  const OT = { own: 'Własna', leasing: 'Leasing', rental: 'Wynajem', leaseback: 'L. zwrotny', service_loan: 'Zastępczy' };
  const OC = { own: 'pill-green', leasing: 'pill-blue', rental: 'pill-amber', leaseback: 'pill-blue', service_loan: 'pill-gray' };

  function _ownPill(ownershipType) {
    const ot = ownershipType;
    if (!ot) return '<span style="color:var(--text3)">—</span>';
    return `<span class="pill ${OC[ot] || 'pill-gray'}">${OT[ot] || e(ot)}</span>`;
  }

  /* ── Główna funkcja render ───────────────────────────────────────────────── */
  function renderVehicleValue() {
    const el = document.getElementById('page-vehicle-value');
    if (!el) return;

    // Zniszcz stary wykres przed podmianą innerHTML
    if (_chart) { try { _chart.destroy(); } catch (_) {} _chart = null; }

    const vehs      = window.vehs || [];
    const withPrice = vehs.filter(v => (v.purchasePrice ?? 0) > 0 && (v.rok ?? 0) > 0);

    // Wylicz wiersze i posortuj malejąco wg bieżącej wartości
    const rows = withPrice.map(v => {
      const price    = v.purchasePrice ?? 0;
      const age      = CURRENT_YEAR - (v.rok ?? 0);
      const est      = calcValue(price, v.rok);
      const deprPct  = (est != null && price > 0) ? (1 - est / price) * 100 : null;
      const lastManual = Array.isArray(v.manualValuation) && v.manualValuation.length
        ? [...v.manualValuation].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
        : null;
      return { v, price, age, est, deprPct, lastManual };
    }).sort((a, b) => (b.est ?? 0) - (a.est ?? 0));

    const totalPurchase = rows.reduce((s, r) => s + r.price, 0);
    const totalEst      = rows.reduce((s, r) => s + (r.est ?? 0), 0);

    // Kandydaci do wymiany: wiek > 7 lat I wartość < 15% ceny zakupu
    const replaceable = rows.filter(r => r.age > 7 && r.est != null && r.est < r.price * 0.15);

    // Dropdown pojazdów do formularza wyceny ręcznej
    const vehOptions = vehs.map(v =>
      `<option value="${e(v.id)}">${e(v.nrRej || '—')} — ${e([v.marka, v.model].filter(Boolean).join(' ') || '')}</option>`
    ).join('');

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-trending-down"></i> Wycena i amortyzacja floty</h2>
</div>

<!-- KPI chips -->
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
  <div class="kpi-chip">
    <i class="ti ti-car" style="color:var(--blue)"></i>
    <span class="kpi-val">${rows.length}</span>
    <span class="kpi-lbl">Pojazdy z ceną zakupu</span>
  </div>
  <div class="kpi-chip">
    <i class="ti ti-coin" style="color:var(--text)"></i>
    <span class="kpi-val">${fmtPLN(totalPurchase)}</span>
    <span class="kpi-lbl">Łączna cena zakupu</span>
  </div>
  <div class="kpi-chip">
    <i class="ti ti-chart-line" style="color:var(--green)"></i>
    <span class="kpi-val">${fmtPLN(totalEst)}</span>
    <span class="kpi-lbl">Łączna wartość bieżąca (est.)</span>
  </div>
  <div class="kpi-chip">
    <i class="ti ti-percentage" style="color:var(--amber)"></i>
    <span class="kpi-val">${totalPurchase > 0 ? `${fmtN((1 - totalEst / totalPurchase) * 100, 1)  }%` : '—'}</span>
    <span class="kpi-lbl">Średnia deprecjacja floty</span>
  </div>
  ${replaceable.length ? `<div class="kpi-chip">
    <i class="ti ti-alert-triangle" style="color:var(--red)"></i>
    <span class="kpi-val" style="color:var(--red)">${replaceable.length}</span>
    <span class="kpi-lbl">Do rozważenia wymiany</span>
  </div>` : ''}
</div>

<!-- ══ CZĘŚĆ A — ZESTAWIENIE WARTOŚCI ════════════════════════════════════ -->
<h3 style="font-size:14px;font-weight:700;margin:0 0 10px">
  <i class="ti ti-table-column" style="margin-right:6px"></i>Zestawienie wartości pojazdów
</h3>
${rows.length ? `
<div class="table-wrap">
  <table class="data-table">
    <thead><tr>
      <th>Nr rej.</th>
      <th>Marka / Model</th>
      <th style="text-align:right">Rok</th>
      <th style="text-align:right">Cena zakupu</th>
      <th style="text-align:right">Wiek (lata)</th>
      <th style="text-align:right">Wartość bieżąca (est.)</th>
      <th style="text-align:right">Deprecjacja %</th>
      <th>Typ własności</th>
      <th>Ostatnia wycena</th>
    </tr></thead>
    <tbody>
${rows.map(r => {
  const v = r.v;
  const deprColor = r.deprPct == null ? '' : r.deprPct > 70 ? 'color:var(--red);font-weight:700' : r.deprPct > 40 ? 'color:var(--amber)' : 'color:var(--green)';
  const lastM = r.lastManual;
  const lastMStr = lastM
    ? `<span style="font-size:11px">${e(lastM.date || '')} — <strong>${fmtPLN(lastM.pln)}</strong><br><span style="color:var(--text3)">${e(lastM.source || '')}</span></span>`
    : '<span style="color:var(--text3)">—</span>';
  return `<tr style="cursor:pointer"
      data-nrrej="${e(v.nrRej || '')}"
      onclick="if(typeof showVehicleDetail==='function') showVehicleDetail(this.dataset.nrrej)">
    <td><strong style="font-family:var(--mono)">${e(v.nrRej || '—')}</strong></td>
    <td>${e([v.marka, v.model].filter(Boolean).join(' ') || '—')}</td>
    <td style="text-align:right;font-family:var(--mono)">${v.rok ?? '—'}</td>
    <td style="text-align:right;font-family:var(--mono)">${fmtPLN(r.price)}</td>
    <td style="text-align:right;font-family:var(--mono)">${r.age >= 0 ? r.age : '—'}</td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmtPLN(r.est)}</td>
    <td style="text-align:right;font-family:var(--mono);${deprColor}">${r.deprPct != null ? `${fmtN(r.deprPct, 1)  }%` : '—'}</td>
    <td>${_ownPill(v.ownershipType)}</td>
    <td onclick="event.stopPropagation()">${lastMStr}</td>
  </tr>`;
}).join('')}
    </tbody>
    <tfoot>
      <tr style="font-weight:700;background:var(--bg-card)">
        <td colspan="3">Suma</td>
        <td style="text-align:right;font-family:var(--mono)">${fmtPLN(totalPurchase)}</td>
        <td></td>
        <td style="text-align:right;font-family:var(--mono)">${fmtPLN(totalEst)}</td>
        <td style="text-align:right;font-family:var(--mono)">${totalPurchase > 0 ? `${fmtN((1 - totalEst / totalPurchase) * 100, 1)  }%` : '—'}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
</div>` : '<p style="color:var(--text-muted)">Brak pojazdów z uzupełnioną ceną zakupu i rokiem produkcji.</p>'}

<!-- ══ CZĘŚĆ B — POJAZDY DO WYMIANY ══════════════════════════════════════ -->
<h3 style="font-size:14px;font-weight:700;margin:28px 0 10px">
  <i class="ti ti-refresh-alert" style="margin-right:6px"></i>Pojazdy do analizy wymiany
  ${replaceable.length ? `<span class="pill pill-red" style="margin-left:8px">${replaceable.length}</span>` : ''}
</h3>
${replaceable.length ? `
<div class="table-wrap">
  <table class="data-table">
    <thead><tr>
      <th>Nr rej.</th><th>Marka / Model</th><th style="text-align:right">Rok</th>
      <th style="text-align:right">Wiek</th>
      <th style="text-align:right">Cena zakupu</th>
      <th style="text-align:right">Wartość bieżąca</th>
      <th style="text-align:right">Wart. %</th>
      <th>Priorytet</th>
    </tr></thead>
    <tbody>
${replaceable.map(r => {
  const v = r.v;
  const pct  = r.price > 0 ? r.est / r.price * 100 : 0;
  // Priorytet: Wysoki jeśli wiek > 10 LUB wartość < 10% ceny; Średni w pozostałych przypadkach
  const isHigh = r.age > 10 || pct < 10;
  const prioEl = isHigh
    ? '<span class="pill pill-red">Wysoki</span>'
    : '<span class="pill pill-amber">Średni</span>';
  return `<tr style="cursor:pointer"
      data-nrrej="${e(v.nrRej || '')}"
      onclick="if(typeof showVehicleDetail==='function') showVehicleDetail(this.dataset.nrrej)">
    <td><strong style="font-family:var(--mono)">${e(v.nrRej || '—')}</strong></td>
    <td>${e([v.marka, v.model].filter(Boolean).join(' ') || '—')}</td>
    <td style="text-align:right">${v.rok ?? '—'}</td>
    <td style="text-align:right;color:var(--red);font-weight:700">${r.age} lat</td>
    <td style="text-align:right;font-family:var(--mono)">${fmtPLN(r.price)}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--red);font-weight:700">${fmtPLN(r.est)}</td>
    <td style="text-align:right;color:var(--red);font-weight:700">${fmtN(pct, 1)}%</td>
    <td>${prioEl}</td>
  </tr>`;
}).join('')}
    </tbody>
  </table>
</div>` : '<p style="color:var(--text-muted);font-style:italic">Brak pojazdów spełniających kryteria wymiany (wiek &gt; 7 lat i wartość &lt; 15% ceny zakupu).</p>'}

<!-- ══ CZĘŚĆ C — TREND WARTOŚCI FLOTY ════════════════════════════════════ -->
<h3 style="font-size:14px;font-weight:700;margin:28px 0 10px">
  <i class="ti ti-chart-bar" style="margin-right:6px"></i>Trend wartości floty (ostatnie 4 lata)
</h3>
<div id="vv-chart-wrap" style="margin-bottom:28px">
  <div style="position:relative;height:220px"><canvas id="vehicle-value-chart"></canvas></div>
</div>

<!-- ══ CZĘŚĆ D — RĘCZNA WYCENA ════════════════════════════════════════════ -->
<h3 style="font-size:14px;font-weight:700;margin:0 0 12px">
  <i class="ti ti-pencil" style="margin-right:6px"></i>Ręczna wycena pojazdu
</h3>
<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:20px">
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:14px">
    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Pojazd</label>
      <select id="vv-veh-select" class="fi">
        <option value="">— wybierz pojazd —</option>
        ${vehOptions}
      </select>
    </div>
    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Data wyceny</label>
      <input id="vv-date" type="date" class="fi" value="${new Date().toISOString().slice(0, 10)}">
    </div>
    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Wycena (PLN netto)</label>
      <input id="vv-pln" type="number" min="0" step="100" class="fi" placeholder="np. 45 000">
    </div>
    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Źródło wyceny</label>
      <select id="vv-source" class="fi">
        <option value="Rzeczoznawca">Rzeczoznawca</option>
        <option value="Autovista">Autovista</option>
        <option value="Eurotax">Eurotax</option>
        <option value="Inne">Inne</option>
      </select>
    </div>
    <div style="grid-column:1/-1">
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Uwagi</label>
      <input id="vv-notes" type="text" class="fi" placeholder="np. wycena na potrzeby sprzedaży">
    </div>
  </div>
  <button class="btn-primary" onclick="VehicleValueModule.saveManualValuation()">
    <i class="ti ti-device-floppy"></i> Zapisz wycenę
  </button>
</div>`;

    // Renderuj wykres po aktualizacji DOM
    _renderChart(rows);
  }

  /* ── Wykres trendu wartości floty (Część C) ──────────────────────────────── */
  function _renderChart(rows) {
    const canvas = document.getElementById('vehicle-value-chart');
    if (!canvas) return;

    const chartYears = [CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR];

    // Łączna wartość floty dla każdego roku (na podstawie modelu deprecjacji)
    const fleetValues = chartYears.map(yr =>
      (window.vehs || [])
        .filter(v => (v.purchasePrice ?? 0) > 0 && (v.rok ?? 0) > 0)
        .reduce((s, v) => {
          const val = _calcValueAt(v.purchasePrice ?? 0, v.rok ?? 0, yr);
          return s + (val ?? 0);
        }, 0)
    );

    if (!window.Chart) {
      // Fallback: prosta tabela gdy Chart.js niedostępne
      const wrap = document.getElementById('vv-chart-wrap');
      if (!wrap) return;
      wrap.innerHTML = `
<div class="table-wrap">
  <table class="data-table">
    <thead><tr><th>Rok</th><th style="text-align:right">Łączna wartość floty (est.)</th></tr></thead>
    <tbody>
      ${chartYears.map((yr, i) => `<tr>
        <td style="font-family:var(--mono)">${yr}</td>
        <td style="text-align:right;font-family:var(--mono)">${fmtPLN(fleetValues[i])}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const tc     = isDark ? '#9ca3af' : '#6b7280';
    const gc     = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)';

    _chart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: chartYears.map(String),
        datasets: [{
          label: 'Wartość floty (est.)',
          data: fleetValues,
          backgroundColor: chartYears.map((yr, i) =>
            yr === CURRENT_YEAR ? 'rgba(59,130,246,.85)' : 'rgba(59,130,246,.4)'
          ),
          borderColor: 'rgba(59,130,246,1)',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${  (ctx.raw ?? 0).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })  } zł`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: tc, font: { size: 12 } },
            grid:  { display: false },
          },
          y: {
            ticks: {
              color: tc,
              font:  { size: 11 },
              callback: val => `${(val / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 0 })  } tys. zł`,
            },
            grid: { color: gc },
            beginAtZero: true,
          },
        },
      },
    });
  }

  /* ── Zapis ręcznej wyceny (Część D) ─────────────────────────────────────── */
  function saveManualValuation() {
    const selEl    = document.getElementById('vv-veh-select');
    const vehicleId = selEl?.value;
    if (!vehicleId) { alert('Wybierz pojazd z listy.'); return; }

    const dateVal   = document.getElementById('vv-date')?.value;
    const plnRaw    = document.getElementById('vv-pln')?.value;
    const plnVal    = parseFloat(plnRaw);
    const sourceVal = document.getElementById('vv-source')?.value || 'Inne';
    const notesVal  = document.getElementById('vv-notes')?.value  || '';

    if (!dateVal)    { alert('Podaj datę wyceny.'); return; }
    if (isNaN(plnVal) || plnVal <= 0) { alert('Podaj kwotę wyceny (PLN > 0).'); return; }

    const v = (window.vehs || []).find(x => String(x.id) === String(vehicleId));
    if (!v) { alert('Nie znaleziono pojazdu.'); return; }

    const newEntry = {
      date:    dateVal,
      pln:     plnVal,
      source:  sourceVal,
      notes:   notesVal,
      addedAt: new Date().toISOString(),
    };

    const existing = Array.isArray(v.manualValuation) ? v.manualValuation : [];
    const updated  = [...existing, newEntry];

    if (typeof window.setV === 'function') {
      window.setV(v.id, 'manualValuation', updated);
    } else {
      // Fallback: aktualizuj lokalnie gdy setV niedostępne
      v.manualValuation = updated;
    }

    // Wyczyść formularz i odśwież widok
    if (document.getElementById('vv-notes')) document.getElementById('vv-notes').value = '';
    if (document.getElementById('vv-pln'))   document.getElementById('vv-pln').value   = '';
    renderVehicleValue();
    if (typeof toast === 'function') toast('Wycena ręczna zapisana.');
  }

  /* ── Publiczne API ───────────────────────────────────────────────────────── */
  window.VehicleValueModule = {
    renderVehicleValue,
    saveManualValuation,
    calcValue, // eksport dla ewentualnych użytkowników zewnętrznych
  };

})();
