/**
 * TaxOrder Pro — Rentowność tras
 * Analiza zysku/marży per trasa/zlecenie, wykrywanie pustych przejazdów
 */
window.RouteProfitability = (function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtPLN = v => v != null && !isNaN(v) ? parseFloat(v).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) : '—';
  const fmtPct = v => v != null && !isNaN(v) ? `${parseFloat(v).toFixed(1)  }%` : '—';
  const fmtN   = (v,d=0) => v != null && !isNaN(v) ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits:d, maximumFractionDigits:d }) : '—';

  let _data      = null; // { routes:[], kpi:{} }
  let _from      = '';
  let _to        = '';
  let _vehicleF  = '';
  let _driverF   = '';
  let _sortCol   = 'margin_pct';
  let _sortDir   = -1;

  function _initDates() {
    if (!_from) {
      const d = new Date();
      d.setDate(1);
      _from = d.toISOString().slice(0,10);
    }
    if (!_to) {
      _to = new Date().toISOString().slice(0,10);
    }
  }

  function _marginColor(pct) {
    if (pct >= 20) return 'var(--green)';
    if (pct >= 5)  return 'var(--orange)';
    return 'var(--red)';
  }
  function _marginBadge(pct) {
    if (pct >= 20) return { lbl:'Dobra',    color:'var(--green)' };
    if (pct >= 5)  return { lbl:'Niska',    color:'var(--orange)' };
    return             { lbl:'Ujemna',   color:'var(--red)' };
  }

  async function _load() {
    _initDates();
    const co = Co();
    const params = new URLSearchParams({ company: co, from: _from, to: _to });
    if (_vehicleF) params.set('vehicle', _vehicleF);
    if (_driverF)  params.set('driver', _driverF);
    try {
      const r = await fetch(`${API()}/api/route-profitability?${params}`, { headers: H() });
      if (r.ok) _data = await r.json();
      else _data = null;
    } catch { _data = null; }
  }

  async function renderRouteProfitability() {
    const el = document.getElementById('page-route-profitability');
    if (!el) return;
    _initDates();
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)"><i class="ti ti-loader" style="font-size:32px"></i></div>`;
    await _load();
    _render();
  }

  function _render() {
    const el = document.getElementById('page-route-profitability');
    if (!el) return;

    const kpi    = _data?.kpi  || {};
    const routes = _data?.routes || [];
    const empty  = _data?.empty_runs || [];

    // Get unique vehicles and drivers for filters
    const vehicles = [...new Set(routes.map(r => r.nr_rej).filter(Boolean))].sort();
    const drivers  = [...new Set(routes.map(r => r.driver_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pl'));

    const sorted = [...routes].sort((a,b) => {
      const av = a[_sortCol], bv = b[_sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      return _sortDir * (typeof av === 'string' ? av.localeCompare(bv,'pl') : av - bv);
    });

    function thSort(col, lbl, tip='') {
      const active = _sortCol === col;
      return `<th style="cursor:pointer;user-select:none;white-space:nowrap" title="${e(tip)}" onclick="window.RouteProfitability.sortBy('${col}')">
        ${lbl} ${active ? (_sortDir<0?'▼':'▲') : '<span style="opacity:.3">⇅</span>'}
      </th>`;
    }

    el.innerHTML = `
<div class="page-header" style="margin-bottom:16px">
  <h2 style="margin:0"><i class="ti ti-route"></i> Rentowność tras</h2>
  <button class="btn-secondary" onclick="window.RouteProfitability.exportCsv()"><i class="ti ti-download"></i> CSV</button>
</div>

<!-- Filtry -->
<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px;background:var(--bg2);padding:12px;border-radius:8px">
  <div>
    <label style="font-size:11px;color:var(--text3);display:block">Od</label>
    <input type="date" id="rp-from" class="sel" style="padding:5px 8px" value="${e(_from)}" onchange="window.RouteProfitability._filterChange()">
  </div>
  <div>
    <label style="font-size:11px;color:var(--text3);display:block">Do</label>
    <input type="date" id="rp-to" class="sel" style="padding:5px 8px" value="${e(_to)}" onchange="window.RouteProfitability._filterChange()">
  </div>
  <div>
    <label style="font-size:11px;color:var(--text3);display:block">Pojazd</label>
    <select id="rp-veh" class="sel" style="padding:5px 8px" onchange="window.RouteProfitability._filterChange()">
      <option value="">Wszystkie</option>
      ${vehicles.map(v => `<option value="${e(v)}" ${_vehicleF===v?'selected':''}>${e(v)}</option>`).join('')}
    </select>
  </div>
  <div>
    <label style="font-size:11px;color:var(--text3);display:block">Kierowca</label>
    <select id="rp-driver" class="sel" style="padding:5px 8px" onchange="window.RouteProfitability._filterChange()">
      <option value="">Wszyscy</option>
      ${drivers.map(d => `<option value="${e(d)}" ${_driverF===d?'selected':''}>${e(d)}</option>`).join('')}
    </select>
  </div>
  <button class="btn-primary" style="font-size:12px;padding:6px 14px" onclick="window.RouteProfitability.reload()"><i class="ti ti-search"></i> Filtruj</button>
</div>

<!-- KPI -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">
  <div class="kpi-chip">
    <span class="kpi-val" style="font-size:16px">${fmtPLN(kpi.total_revenue)}</span>
    <span class="kpi-lbl">Łączny przychód</span>
  </div>
  <div class="kpi-chip">
    <span class="kpi-val" style="font-size:16px">${fmtPLN(kpi.total_cost)}</span>
    <span class="kpi-lbl">Łączny koszt</span>
  </div>
  <div class="kpi-chip" style="border-color:${kpi.avg_margin_pct>=10?'var(--green)':'var(--orange)'}">
    <span class="kpi-val" style="color:${_marginColor(kpi.avg_margin_pct??0)}">${fmtPct(kpi.avg_margin_pct)}</span>
    <span class="kpi-lbl">Średnia marża</span>
  </div>
  <div class="kpi-chip">
    <span class="kpi-val">${fmtN(kpi.total_km)}</span>
    <span class="kpi-lbl">Łączne km</span>
  </div>
  <div class="kpi-chip" style="border-color:${empty.length>0?'var(--orange)':'var(--border)'}">
    <span class="kpi-val" style="color:${empty.length>0?'var(--orange)':'var(--green)'}">${empty.length}</span>
    <span class="kpi-lbl">Puste przebiegi</span>
  </div>
</div>

<!-- Puste przebiegi alert -->
${empty.length ? `
<div style="background:rgba(234,88,12,.1);border:1px solid rgba(234,88,12,.3);border-radius:8px;padding:12px 16px;margin-bottom:16px">
  <strong style="color:var(--orange)"><i class="ti ti-alert-triangle"></i> Wykryto ${empty.length} pustych przejazdów</strong>
  <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px">
  ${empty.slice(0,8).map(r => `<span style="background:var(--bg2);padding:3px 8px;border-radius:4px;font-size:12px">${e(r.nr_rej || '?')} — ${e(r.trip_date||r.order_date||'?')}</span>`).join('')}
  ${empty.length > 8 ? `<span style="font-size:12px;color:var(--text3)">+${empty.length-8} więcej</span>` : ''}
  </div>
</div>` : ''}

<!-- Tabela tras -->
${sorted.length ? `
<div class="table-wrap" style="overflow-x:auto">
<table class="data-table">
<thead><tr>
  ${thSort('order_title','Trasa / Zlecenie')}
  ${thSort('nr_rej','Pojazd')}
  ${thSort('driver_name','Kierowca')}
  ${thSort('distance_km','km')}
  ${thSort('revenue_pln','Przychód')}
  ${thSort('cost_pln','Koszt')}
  ${thSort('margin_pln','Marża PLN')}
  ${thSort('margin_pct','Marża %')}
  <th>Ocena</th>
</tr></thead>
<tbody>
${sorted.map(r => {
  const badge = _marginBadge(r.margin_pct ?? 0);
  return `<tr>
    <td style="max-width:200px">
      <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e(r.order_title||'')}">${e(r.order_title || r.origin || '—')}</div>
      ${r.destination ? `<div style="font-size:11px;color:var(--text3)">${e(r.origin||'')} → ${e(r.destination)}</div>` : ''}
      ${r.order_date ? `<div style="font-size:11px;color:var(--text3)">${e(r.order_date)}</div>` : ''}
    </td>
    <td><code style="font-size:12px">${e(r.nr_rej||'—')}</code></td>
    <td style="font-size:12px">${e(r.driver_name||'—')}</td>
    <td style="text-align:right">${fmtN(r.distance_km)}</td>
    <td style="text-align:right;font-weight:600">${fmtPLN(r.revenue_pln)}</td>
    <td style="text-align:right">${fmtPLN(r.cost_pln)}</td>
    <td style="text-align:right;font-weight:600;color:${r.margin_pln>=0?'var(--green)':'var(--red)'}">${fmtPLN(r.margin_pln)}</td>
    <td style="text-align:right;color:${_marginColor(r.margin_pct??0)};font-weight:700">${fmtPct(r.margin_pct)}</td>
    <td><span style="color:${badge.color};font-weight:600;font-size:12px">${badge.lbl}</span></td>
  </tr>`;
}).join('')}
</tbody>
</table>
</div>` : `
<div style="padding:50px;text-align:center;color:var(--text3)">
  <i class="ti ti-route-off" style="font-size:40px;display:block;margin-bottom:12px"></i>
  Brak danych tras w wybranym okresie.<br>
  <small>Dane pobierane z modułu Faktur Tras. Dodaj faktury zleceń transportowych.</small>
</div>`}
`;
  }

  function _filterChange() {
    _from     = document.getElementById('rp-from')?.value || _from;
    _to       = document.getElementById('rp-to')?.value   || _to;
    _vehicleF = document.getElementById('rp-veh')?.value  || '';
    _driverF  = document.getElementById('rp-driver')?.value || '';
  }

  async function reload() {
    _filterChange();
    const el = document.getElementById('page-route-profitability');
    if (el) el.style.opacity = '.5';
    await _load();
    if (el) el.style.opacity = '1';
    _render();
  }

  function sortBy(col) {
    if (_sortCol === col) _sortDir *= -1;
    else { _sortCol = col; _sortDir = -1; }
    _render();
  }

  function exportCsv() {
    const routes = _data?.routes || [];
    if (!routes.length) { if(typeof toast==='function') toast('Brak danych','error'); return; }
    const cols = ['order_title','nr_rej','driver_name','distance_km','revenue_pln','cost_pln','margin_pln','margin_pct'];
    const hdrs = ['Trasa','Pojazd','Kierowca','km','Przychód PLN','Koszt PLN','Marża PLN','Marża %'];
    const rows = routes.map(r => cols.map(c => r[c] ?? '').join(';'));
    const csv  = [hdrs.join(';'), ...rows].join('\n');
    const a    = document.createElement('a');
    a.download = `rentownosc-tras-${_from}-${_to}.csv`;
    a.href     = `data:text/csv;charset=utf-8,${  encodeURIComponent(`﻿${  csv}`)}`;
    a.click();
  }

  return { renderRouteProfitability, sortBy, reload, exportCsv, _filterChange };
})();
