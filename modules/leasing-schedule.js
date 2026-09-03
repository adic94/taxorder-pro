/**
 * TaxOrder Pro — Harmonogram leasingu
 * Kalkulator rat annuitetowych, tabela amortyzacji + lista pojazdów na leasingu.
 */
(function () {
  'use strict';

  /* ── Pomocnicze ─────────────────────────────────────────────────────────── */
  const e = s => typeof esc === 'function'
    ? esc(s)
    : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtN = (v, d = 2) =>
    v != null ? (+v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

  const fmtPLN = v => v != null ? `${fmtN(v, 2)  } zł` : '—';

  /** Pill daty: czerwony jeśli przeszły, bursztynowy jeśli ≤ 90 dni. */
  function _datePillLoc(dateStr) {
    if (!dateStr) return '<span style="color:var(--text3)">—</span>';
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr  }T00:00:00`);
    if (isNaN(d)) return '<span style="color:var(--text3)">—</span>';
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const days = Math.round((d - now) / 86400000);
    const label = d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' });
    if (days < 0)   return `<span class="pill pill-red"   title="${Math.abs(days)} dni temu">${label}</span>`;
    if (days <= 90) return `<span class="pill pill-amber" title="Za ${days} dni">${label}</span>`;
    return `<span style="font-size:11px;color:var(--text2)">${label}</span>`;
  }

  /* ── Stan modułu ─────────────────────────────────────────────────────────── */
  let _schedule = []; // wiersze harmonogramu (dla eksportu CSV)
  let _summary  = null;

  /* ── Główna funkcja render ───────────────────────────────────────────────── */
  function renderLeasingSchedule() {
    const el = document.getElementById('page-leasing-schedule');
    if (!el) return;
    el.innerHTML = _buildPageHtml();
    _renderLeasingVehicles();
  }

  /* ── Szkielet strony ─────────────────────────────────────────────────────── */
  function _buildPageHtml() {
    return `
<div class="page-header">
  <h2><i class="ti ti-calendar-stats"></i> Harmonogram leasingu</h2>
</div>

<!-- ══ CZĘŚĆ A — KALKULATOR ══════════════════════════════════════════════ -->
<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:20px">
  <h3 style="margin:0 0 16px;font-size:15px;font-weight:700">
    <i class="ti ti-calculator" style="margin-right:6px"></i>Kalkulator leasingu
  </h3>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:16px">

    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">
        Wartość pojazdu (netto PLN)
      </label>
      <input id="ls-wartosc" type="number" min="0" step="1000" class="fi"
        placeholder="np. 120 000"
        oninput="LeasingScheduleModule._updateDownpayment()">
    </div>

    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">
        Wpłata własna %
      </label>
      <div style="display:flex;gap:6px;align-items:center">
        <input id="ls-wplata-pct" type="number" min="0" max="90" step="1" class="fi"
          placeholder="np. 10" style="flex:1"
          oninput="LeasingScheduleModule._updateDownpayment()">
        <span id="ls-wplata-pln" style="font-size:12px;color:var(--text2);white-space:nowrap;min-width:72px">= 0 zł</span>
      </div>
    </div>

    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">
        Liczba rat
      </label>
      <select id="ls-raty" class="fi">
        <option value="24">24 miesiące</option>
        <option value="36">36 miesięcy</option>
        <option value="48" selected>48 miesięcy</option>
        <option value="60">60 miesięcy</option>
        <option value="72">72 miesiące</option>
      </select>
    </div>

    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">
        Wykup %
      </label>
      <input id="ls-wykup-pct" type="number" min="1" max="40" step="0.1" class="fi"
        placeholder="np. 1" value="1">
    </div>

    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">
        Oprocentowanie roczne %
      </label>
      <input id="ls-oprocentowanie" type="number" min="0" max="50" step="0.1" class="fi"
        value="8.5">
    </div>

    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">VAT</label>
      <select id="ls-vat" class="fi">
        <option value="0.23" selected>23%</option>
        <option value="0.08">8%</option>
        <option value="0">0%</option>
      </select>
    </div>

    <div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">
        Odliczenie VAT
      </label>
      <select id="ls-vat-odlicz" class="fi">
        <option value="0.5" selected>50% (pojazd mieszany)</option>
        <option value="1">100% (wyłącznie działalność)</option>
      </select>
    </div>

  </div>
  <button class="btn-primary" onclick="LeasingScheduleModule._calcSchedule()">
    <i class="ti ti-chart-bar"></i> Oblicz harmonogram
  </button>
</div>

<!-- ══ PODSUMOWANIE (wypełniane dynamicznie) ═════════════════════════════ -->
<div id="ls-summary-wrap" style="display:none;margin-bottom:20px">
  <div id="ls-summary-kpi" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px"></div>
  <div id="ls-vat-info"
    style="font-size:12px;color:var(--text2);background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:10px 14px">
  </div>
</div>

<!-- ══ CZĘŚĆ B — TABELA AMORTYZACJI ══════════════════════════════════════ -->
<div id="ls-table-wrap" style="display:none;margin-bottom:28px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
    <h3 style="margin:0;font-size:14px;font-weight:700">
      <i class="ti ti-table" style="margin-right:6px"></i>Harmonogram spłat
    </h3>
    <button class="btn-secondary" onclick="LeasingScheduleModule._exportCsv()">
      <i class="ti ti-download"></i> Eksportuj CSV
    </button>
  </div>
  <div class="table-wrap" style="max-height:440px;overflow-y:auto">
    <table class="data-table">
      <thead><tr>
        <th style="text-align:right">Nr raty</th>
        <th>Data płatności</th>
        <th style="text-align:right">Rata brutto</th>
        <th style="text-align:right">Kapitał</th>
        <th style="text-align:right">Odsetki</th>
        <th style="text-align:right">Saldo pozostałe</th>
        <th style="text-align:right">VAT do odlicz.</th>
      </tr></thead>
      <tbody id="ls-amort-tbody"></tbody>
    </table>
  </div>
</div>

<!-- ══ CZĘŚĆ C — POJAZDY NA LEASINGU ═════════════════════════════════════ -->
<div>
  <h3 style="font-size:14px;font-weight:700;margin:0 0 12px">
    <i class="ti ti-truck" style="margin-right:6px"></i>Pojazdy na leasingu
  </h3>
  <div id="ls-vehs-wrap"></div>
</div>`;
  }

  /* ── Aktualizacja wyświetlania kwoty wpłaty własnej ──────────────────────── */
  function _updateDownpayment() {
    const wartosc = parseFloat(document.getElementById('ls-wartosc')?.value) || 0;
    const pct     = parseFloat(document.getElementById('ls-wplata-pct')?.value) ?? 0;
    const plnEl   = document.getElementById('ls-wplata-pln');
    if (plnEl) {
      plnEl.textContent = `= ${  (wartosc * pct / 100)
        .toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })  } zł`;
    }
  }

  /* ── Obliczenie harmonogramu ─────────────────────────────────────────────── */
  function _calcSchedule() {
    const wartosc     = parseFloat(document.getElementById('ls-wartosc')?.value)       || 0;
    const wpłataPct   = parseFloat(document.getElementById('ls-wplata-pct')?.value)    ?? 0;
    const n           = parseInt(document.getElementById('ls-raty')?.value)             || 48;
    const wykupPct    = parseFloat(document.getElementById('ls-wykup-pct')?.value)     ?? 1;
    const oprRoczne   = parseFloat(document.getElementById('ls-oprocentowanie')?.value) ?? 8.5;
    const vatRate     = parseFloat(document.getElementById('ls-vat')?.value)            ?? 0.23;
    const vatOdlicz   = parseFloat(document.getElementById('ls-vat-odlicz')?.value)    ?? 0.5;

    if (wartosc <= 0) { alert('Podaj wartość pojazdu (musi być większa od 0).'); return; }

    const wpłataPLN = wartosc * wpłataPct / 100;
    const wykupPLN  = wartosc * wykupPct  / 100;
    // Kapitał do sfinansowania = wartość minus wpłata własna
    const P = wartosc - wpłataPLN;
    // Miesięczna stopa procentowa
    const r = oprRoczne / 100 / 12;

    // Rata annuitetowa: rata = (P × r) / (1 − (1+r)^−n)
    // Gdy r = 0 (brak oprocentowania): rata = P / n
    const rata = r > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;

    // Budowanie harmonogramu amortyzacji
    _schedule = [];
    let saldo = P;
    const startDate = new Date();
    startDate.setDate(1); // normalizacja do 1. dnia miesiąca

    for (let i = 1; i <= n; i++) {
      const payDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const odsetki = saldo * r;
      // W ostatniej racie kapitał = dokładnie pozostałe saldo (korekta błędu zaokrąglenia)
      const kapital = i < n ? rata - odsetki : saldo;
      saldo = Math.max(saldo - kapital, 0);
      const rataNetto  = kapital + odsetki;
      const rataBrutto = rataNetto * (1 + vatRate);
      const vatKwota   = rataNetto * vatRate * vatOdlicz;
      _schedule.push({
        nr:          i,
        data:        payDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rataBrutto,
        kapital,
        odsetki,
        saldo,
        vatKwota,
      });
    }

    // Podsumowanie
    const totalNetto   = rata * n;
    const totalOdsetki = totalNetto - P;
    const totalCost    = wpłataPLN + totalNetto * (1 + vatRate) + wykupPLN * (1 + vatRate);
    _summary = { wartosc, wpłataPLN, wpłataPct, P, rata, n, wykupPLN, wykupPct, vatRate, vatOdlicz, totalNetto, totalOdsetki, totalCost };

    _renderSummary();
    _renderAmortTable();
  }

  /* ── Podsumowanie KPI ───────────────────────────────────────────────────── */
  function _renderSummary() {
    if (!_summary) return;
    const s    = _summary;
    const wrap = document.getElementById('ls-summary-wrap');
    const kpiEl = document.getElementById('ls-summary-kpi');
    const vatEl = document.getElementById('ls-vat-info');
    if (!wrap || !kpiEl || !vatEl) return;

    const rataBrutto    = s.rata * (1 + s.vatRate);
    const totalBrutto   = s.totalNetto * (1 + s.vatRate);
    const wykupBrutto   = s.wykupPLN * (1 + s.vatRate);

    const kpis = [
      { icon: 'ti-cash',        label: 'Rata / miesiąc netto',  val: fmtPLN(s.rata),        color: 'var(--blue)'  },
      { icon: 'ti-credit-card', label: 'Rata / miesiąc brutto', val: fmtPLN(rataBrutto),     color: 'var(--blue)'  },
      { icon: 'ti-coins',       label: 'Suma rat netto',         val: fmtPLN(s.totalNetto),  color: 'var(--text)'  },
      { icon: 'ti-percentage',  label: 'Łączne odsetki',         val: fmtPLN(s.totalOdsetki),color: 'var(--amber)' },
      { icon: 'ti-tag',         label: 'Cena wykupu brutto',     val: fmtPLN(wykupBrutto),   color: 'var(--text)'  },
      { icon: 'ti-calculator',  label: 'Całkowity koszt (TCO)',  val: fmtPLN(s.totalCost),   color: 'var(--green)' },
    ];
    kpiEl.innerHTML = kpis.map(k => `
      <div class="kpi-chip">
        <i class="ti ${k.icon}" style="color:${k.color}"></i>
        <span class="kpi-val" style="color:${k.color}">${k.val}</span>
        <span class="kpi-lbl">${k.label}</span>
      </div>`).join('');

    const vatMies    = s.rata * s.vatRate * s.vatOdlicz;
    const vatLacznie = vatMies * s.n;
    const vatPctStr  = `${(s.vatRate * 100).toFixed(0)  }%`;
    const odliczStr  = `${(s.vatOdlicz * 100).toFixed(0)  }%`;
    vatEl.innerHTML = `
      <strong>VAT:</strong> stawka ${vatPctStr}, odliczenie ${odliczStr}
      → VAT do odliczenia / miesiąc: <strong>${fmtPLN(vatMies)}</strong>
      &nbsp;|&nbsp; Łącznie przez ${s.n} rat: <strong>${fmtPLN(vatLacznie)}</strong>
      ${s.vatOdlicz < 1
        ? '<span style="color:var(--amber);margin-left:8px"><i class="ti ti-info-circle"></i> Pojazd mieszany — limit 50% odliczenia VAT (art. 86a ustawy o VAT)</span>'
        : ''}`;

    wrap.style.display = '';
  }

  /* ── Tabela harmonogramu ─────────────────────────────────────────────────── */
  function _renderAmortTable() {
    const tbody = document.getElementById('ls-amort-tbody');
    const wrap  = document.getElementById('ls-table-wrap');
    if (!tbody || !wrap) return;

    tbody.innerHTML = _schedule.map(row => `<tr>
      <td style="text-align:right;font-family:var(--mono);font-size:12px">${row.nr}</td>
      <td style="font-size:12px">${row.data}</td>
      <td style="text-align:right;font-family:var(--mono)">${fmtPLN(row.rataBrutto)}</td>
      <td style="text-align:right;font-family:var(--mono)">${fmtPLN(row.kapital)}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--text2)">${fmtPLN(row.odsetki)}</td>
      <td style="text-align:right;font-family:var(--mono)">${fmtPLN(row.saldo)}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--green)">${fmtPLN(row.vatKwota)}</td>
    </tr>`).join('');

    wrap.style.display = '';
  }

  /* ── Eksport CSV ─────────────────────────────────────────────────────────── */
  function _exportCsv() {
    if (!_schedule.length) { alert('Najpierw oblicz harmonogram.'); return; }
    const s = _summary;
    const lines = [
      ['Nr raty', 'Data płatności', 'Rata brutto (zł)', 'Kapitał (zł)', 'Odsetki (zł)', 'Saldo (zł)', 'VAT do odlicz. (zł)'].join(';'),
      ..._schedule.map(r => [
        r.nr,
        r.data,
        r.rataBrutto.toFixed(2),
        r.kapital.toFixed(2),
        r.odsetki.toFixed(2),
        r.saldo.toFixed(2),
        r.vatKwota.toFixed(2),
      ].join(';')),
      '',
      ['Podsumowanie', ''].join(';'),
      ['Wartość pojazdu netto',   (s?.wartosc ?? 0).toFixed(2)].join(';'),
      ['Wpłata własna',           (s?.wpłataPLN ?? 0).toFixed(2)].join(';'),
      ['Suma rat netto',          (s?.totalNetto ?? 0).toFixed(2)].join(';'),
      ['Łączne odsetki',          (s?.totalOdsetki ?? 0).toFixed(2)].join(';'),
      ['Cena wykupu brutto',      ((s?.wykupPLN ?? 0) * (1 + (s?.vatRate ?? 0))).toFixed(2)].join(';'),
      ['Całkowity koszt TCO',     (s?.totalCost ?? 0).toFixed(2)].join(';'),
    ];
    const csv  = `﻿${  lines.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'harmonogram-leasingu.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* ── Lista pojazdów na leasingu (Część C) ────────────────────────────────── */
  function _renderLeasingVehicles() {
    const wrap = document.getElementById('ls-vehs-wrap');
    if (!wrap) return;

    const list = (window.vehs || []).filter(v =>
      (v.ownershipType === 'leasing') || ((v.leasingRate ?? 0) > 0)
    );

    if (!list.length) {
      wrap.innerHTML = `<p style="color:var(--text-muted);font-style:italic;margin:0">
        Brak pojazdów oznaczonych jako leasing. Uzupełnij typ własności lub ratę leasingową w karcie pojazdu.
      </p>`;
      return;
    }

    wrap.innerHTML = `
<div class="table-wrap"><table class="data-table">
<thead><tr>
  <th>Nr rej.</th>
  <th>Marka / Model</th>
  <th>Leasingodawca</th>
  <th style="text-align:right">Rata / mies.</th>
  <th style="text-align:right">Wykup (netto)</th>
  <th>Koniec leasingu</th>
  <th>Nr umowy</th>
</tr></thead>
<tbody>
${list.map(v => {
  const marka  = e(v.marka  || '');
  const model  = e(v.model  || '');
  const label  = [marka, model].filter(Boolean).join(' ') || '—';
  const rata   = v.leasingRate   != null ? `${fmtN(v.leasingRate,   2)  } zł` : '—';
  const wykup  = v.leasingBuyout != null ? `${fmtN(v.leasingBuyout, 2)  } zł` : '—';
  return `<tr style="cursor:pointer"
      data-nrrej="${e(v.nrRej || '')}"
      onclick="if(typeof showVehicleDetail==='function') showVehicleDetail(this.dataset.nrrej)">
    <td><strong style="font-family:var(--mono)">${e(v.nrRej || '—')}</strong></td>
    <td>${label}</td>
    <td>${e(v.leasingCompany || '—')}</td>
    <td style="text-align:right;font-family:var(--mono)">${rata}</td>
    <td style="text-align:right;font-family:var(--mono)">${wykup}</td>
    <td>${_datePillLoc(v.leasingEnd)}</td>
    <td style="font-size:11px;color:var(--text2)">${e(v.leasingContractNo || '—')}</td>
  </tr>`;
}).join('')}
</tbody>
</table></div>`;
  }

  /* ── Publiczne API ───────────────────────────────────────────────────────── */
  window.LeasingScheduleModule = {
    renderLeasingSchedule,
    _updateDownpayment,
    _calcSchedule,
    _exportCsv,
  };

})();
