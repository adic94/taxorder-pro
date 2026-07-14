/**
 * TaxOrder Pro — Flota EV / Niskoemisyjna
 * Widok pojazdów elektrycznych, hybrydowych, CNG/LNG i wodorowych.
 * Zawiera KPI emisji CO₂, tabelę z edycją inline i sekcję
 * pojazdów-kandydatów do wymiany na EV.
 */
(function () {
  'use strict';

  const e = s => typeof esc === 'function'
    ? esc(s)
    : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtN = (v, d = 0) =>
    v != null && !isNaN(Number(v))
      ? Number(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d })
      : '—';

  // ── Stałe domeny ────────────────────────────────────────────────────────────
  const EV_KEYWORDS  = ['elektryczny', 'elektr', 'ev', 'hybrid', 'hybryda', 'phev', 'bev', 'wodór', 'cng', 'lng'];
  const DIESEL_G_KM  = 150;   // g/km — punkt odniesienia dla oszczędności CO₂
  const KM_PER_YEAR  = 15000; // km/rok — założenie dla wyliczeń
  const FUEL_PLN     = 6.5;   // PLN/l — cena paliwa do kosztów rocznych
  const HIGH_CONS    = 10;    // l/100km — próg "wysokiego spalania"

  // ── Klasyfikacja paliwa ──────────────────────────────────────────────────────

  function _isEv(v) {
    const p = String(v.paliwo ?? '').toLowerCase();
    return EV_KEYWORDS.some(k => p.includes(k));
  }

  /** Zwraca kategorię paliwa: 'bev' | 'phev' | 'alt' | 'other' */
  function _fuelCategory(paliwo) {
    const p = String(paliwo ?? '').toLowerCase();
    if (p.includes('bev') || p.includes('elektryczny') || p.includes('elektr')) return 'bev';
    if (p.includes('phev') || p.includes('hybrid') || p.includes('hybryda'))     return 'phev';
    if (p.includes('cng') || p.includes('lng') || p.includes('wodór'))           return 'alt';
    return 'other';
  }

  function _fuelPill(paliwo) {
    const cat = _fuelCategory(paliwo);
    const STYLE = {
      bev:   'background:#dcfce7;color:#166534',
      phev:  'background:#dbeafe;color:#1e40af',
      alt:   'background:#ccfbf1;color:#0f766e',
      other: 'background:#f3f4f6;color:#374151',
    };
    return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;${STYLE[cat]}">${e(paliwo ?? '—')}</span>`;
  }

  // ── Status pill ─────────────────────────────────────────────────────────────
  const STATUS_STYLE = {
    aktywny:        'background:#dcfce7;color:#166534',
    serwis:         'background:#fef9c3;color:#92400e',
    rezerwacja:     'background:#dbeafe;color:#1e40af',
    wyrejestrowany: 'background:#f3f4f6;color:#374151',
    sprzedany:      'background:#fee2e2;color:#991b1b',
  };

  function _statusPill(status) {
    const s = String(status ?? '');
    const style = STATUS_STYLE[s] ?? 'background:#f3f4f6;color:#374151';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;${style}">${e(s || '—')}</span>`;
  }

  // ── KPI chip ────────────────────────────────────────────────────────────────
  function _kpi(icon, val, label, iconColor) {
    return `<div style="display:inline-flex;align-items:center;gap:10px;background:var(--bg-card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 16px;margin-right:10px;margin-bottom:10px;vertical-align:top">
      <i class="ti ${icon}" style="font-size:22px;color:${iconColor}"></i>
      <div>
        <div style="font-size:18px;font-weight:700;line-height:1.2">${val}</div>
        <div style="font-size:11px;color:var(--text-muted,#6b7280)">${label}</div>
      </div>
    </div>`;
  }

  // ── Inline input do edycji pola numerycznego ────────────────────────────────
  function _numInput(vid, field, value, placeholder, title) {
    const safeVal = value != null && !isNaN(Number(value)) ? Number(value) : '';
    return `<input
      type="number"
      step="0.1"
      min="0"
      value="${e(String(safeVal))}"
      placeholder="${e(placeholder)}"
      title="${e(title)}"
      data-vid="${e(String(vid ?? ''))}"
      data-field="${e(field)}"
      style="width:74px;padding:3px 6px;border:1px solid var(--border,#e5e7eb);border-radius:5px;background:var(--bg-input,#fff);font-size:13px;color:var(--text,#111)"
      onchange="window.EvFleetModule._saveField(this.dataset.vid, this.dataset.field, this.value)"
    />`;
  }

  // ── Render główny ───────────────────────────────────────────────────────────
  function renderEvFleet() {
    const el = document.getElementById('page-ev-fleet');
    if (!el) return;

    const allVehs = window.vehs || [];
    const evVehs  = allVehs.filter(_isEv);
    const nonEvVehs = allVehs.filter(v => !_isEv(v));

    // ── KPI: średnia CO₂ ──────────────────────────────────────────────────────
    const evWithCo2  = evVehs.filter(v => v.co2GPerKm != null && !isNaN(Number(v.co2GPerKm)));
    const avgCo2Ev   = evWithCo2.length
      ? evWithCo2.reduce((s, v) => s + Number(v.co2GPerKm), 0) / evWithCo2.length
      : null;

    const nonEvWithCo2 = nonEvVehs.filter(v => v.co2GPerKm != null && !isNaN(Number(v.co2GPerKm)));
    const avgCo2NonEv  = nonEvWithCo2.length
      ? nonEvWithCo2.reduce((s, v) => s + Number(v.co2GPerKm), 0) / nonEvWithCo2.length
      : null;

    // ── KPI: oszczędności CO₂ ─────────────────────────────────────────────────
    // (diesel_baseline - actual_co2) × km/rok ÷ 1000 = kg/rok na pojazd
    const totalCo2SavingsKg = evVehs.reduce((sum, v) => {
      const actual = v.co2GPerKm != null ? Number(v.co2GPerKm) : 0;
      const savedGPerKm = Math.max(0, DIESEL_G_KM - actual);
      return sum + (savedGPerKm * KM_PER_YEAR / 1000);
    }, 0);

    // ── Sekcja "do rozważenia": pojazdy z wysokim spalaniem ──────────────────
    const highConsVehs = allVehs.filter(v => {
      const ns = Number(v.normaSpalania ?? 0);
      return !isNaN(ns) && ns > HIGH_CONS;
    });

    // ── HTML ──────────────────────────────────────────────────────────────────
    el.innerHTML = `
<div class="page-header" style="margin-bottom:16px">
  <h2 style="display:flex;align-items:center;gap:8px">
    <i class="ti ti-bolt" style="color:#16a34a"></i>
    Flota EV / Niskoemisyjna
  </h2>
</div>

<!-- KPI -->
<div style="margin-bottom:20px">
  ${_kpi('ti-bolt',         String(evVehs.length),                               'Pojazdy EV / Hybrid',       '#16a34a')}
  ${_kpi('ti-leaf',         avgCo2Ev   != null ? fmtN(avgCo2Ev,   1) + ' g/km' : '—', 'Śr. emisja CO₂ (EV)',       '#2563eb')}
  ${_kpi('ti-leaf-off',     avgCo2NonEv != null ? fmtN(avgCo2NonEv, 1) + ' g/km' : '—', 'Śr. emisja CO₂ (inne)',   '#6b7280')}
  ${_kpi('ti-trending-down', fmtN(totalCo2SavingsKg, 0) + ' kg/rok',            'Szac. oszczędności CO₂',    '#0f766e')}
</div>

<!-- Tabela EV -->
${evVehs.length === 0
  ? `<div style="text-align:center;padding:48px 0;color:var(--text-muted,#6b7280)">
       <i class="ti ti-bolt" style="font-size:44px;display:block;margin-bottom:8px;opacity:.4"></i>
       Brak pojazdów EV/Hybrid/CNG w flocie
     </div>`
  : `<div class="table-wrap"><table class="data-table">
<thead><tr>
  <th>Nr rej.</th>
  <th>Marka / Model</th>
  <th>Typ paliwa</th>
  <th>Rok</th>
  <th>Kierowca</th>
  <th>Emisja CO₂ (g/km)</th>
  <th>Norma spalania</th>
  <th>DMC (kg)</th>
  <th>Status</th>
</tr></thead>
<tbody>
${evVehs.map(v => {
  const dmc = v.dmc ?? v.dmcMax ?? null;
  return `<tr>
  <td>
    <strong
      style="cursor:pointer;color:var(--accent,#2563eb)"
      data-nrrej="${e(v.nrRej ?? '')}"
      onclick="window.EvFleetModule._openDetail(this.dataset.nrrej)"
    >${e(v.nrRej ?? '—')}</strong>
  </td>
  <td>${e([v.marka, v.model].filter(Boolean).join(' ') || '—')}</td>
  <td>${_fuelPill(v.paliwo)}</td>
  <td>${e(String(v.rok ?? '—'))}</td>
  <td>${e(v.kierowca ?? '—')}</td>
  <td>${_numInput(v.id, 'co2GPerKm',     v.co2GPerKm,     '—', 'Emisja CO₂ w g/km')}</td>
  <td>${_numInput(v.id, 'normaSpalania', v.normaSpalania, '—', 'l/100km lub kWh/100km')}</td>
  <td>${dmc != null ? fmtN(dmc, 0) : '—'}</td>
  <td>${_statusPill(v.status)}</td>
</tr>`;
}).join('')}
</tbody>
</table></div>
<p style="font-size:11px;color:var(--text-muted,#9ca3af);margin-top:4px">
  Emisja CO₂ i norma spalania — pola edytowalne; zmiany zapisywane natychmiast.
</p>`
}

<!-- Sekcja: Pojazdy do rozważenia -->
${highConsVehs.length ? `
<div style="margin-top:32px">
  <h3 style="font-size:15px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">
    <i class="ti ti-gas-station" style="color:#d97706"></i>
    Pojazdy do rozważenia — kandydaci do wymiany na EV
    <span style="background:#fef9c3;color:#92400e;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">${highConsVehs.length}</span>
  </h3>
  <p style="font-size:12px;color:var(--text-muted,#6b7280);margin-bottom:12px">
    Pojazdy z normą spalania &gt; ${HIGH_CONS} l/100km.
    Szac. roczny koszt paliwa = norma × 0,01 × ${fmtN(KM_PER_YEAR)} km × ${FUEL_PLN.toFixed(2)} PLN/l
  </p>
  <div class="table-wrap"><table class="data-table">
  <thead><tr>
    <th>Nr rej.</th>
    <th>Marka / Model</th>
    <th>Typ paliwa</th>
    <th>Norma (l/100km)</th>
    <th>Szac. koszt / rok</th>
    <th>Kierowca</th>
    <th>Status</th>
  </tr></thead>
  <tbody>
  ${highConsVehs.map(v => {
    const ns        = Number(v.normaSpalania ?? 0);
    const yearlyCost = ns * 0.01 * KM_PER_YEAR * FUEL_PLN;
    return `<tr>
    <td>
      <strong
        style="cursor:pointer;color:var(--accent,#2563eb)"
        data-nrrej="${e(v.nrRej ?? '')}"
        onclick="window.EvFleetModule._openDetail(this.dataset.nrrej)"
      >${e(v.nrRej ?? '—')}</strong>
    </td>
    <td>${e([v.marka, v.model].filter(Boolean).join(' ') || '—')}</td>
    <td>${e(v.paliwo ?? '—')}</td>
    <td style="font-weight:700;color:#d97706">${fmtN(ns, 1)}</td>
    <td style="font-weight:700">${fmtN(yearlyCost, 0)} PLN</td>
    <td>${e(v.kierowca ?? '—')}</td>
    <td>${_statusPill(v.status)}</td>
  </tr>`;
  }).join('')}
  </tbody>
  </table></div>
</div>` : ''}
`;
  }

  // ── Zdarzenia publiczne ─────────────────────────────────────────────────────

  function _openDetail(nrRej) {
    if (typeof window.showVehicleDetail === 'function') {
      window.showVehicleDetail(nrRej);
    }
  }

  function _saveField(vehicleId, field, rawValue) {
    if (!vehicleId || !field) return;

    const num = parseFloat(rawValue);
    const val = isNaN(num) ? null : num;

    // Optymistyczna aktualizacja lokalnego cache
    const vehs = window.vehs || [];
    const v = vehs.find(x => String(x.id ?? '') === String(vehicleId));
    if (v) v[field] = val;

    // Zapis do backendu
    if (typeof window.setV === 'function') {
      window.setV(vehicleId, field, val);
    }
  }

  // ── Eksport ─────────────────────────────────────────────────────────────────
  window.EvFleetModule = {
    renderEvFleet,
    _openDetail,
    _saveField,
  };
})();
