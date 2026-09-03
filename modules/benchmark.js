(function () {
  'use strict';

  const API = () => window._cfApi ? window._cfApi() : window.WORKER_URL;
  const H   = () => window._cfHdrs ? window._cfHdrs() : {};
  const Co  = () => window._cfCo   ? window._cfCo()   : '';
  const e   = (s) => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v, dec=0) => v != null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:dec,maximumFractionDigits:dec}) : '—';

  let _data = [];
  let _sortCol = 'total_cost';
  let _sortDir = -1;

  async function renderBenchmark() {
    const co = Co();
    const year = document.getElementById('bench-year')?.value || new Date().getFullYear();
    try {
      const r = await fetch(`${API()}/api/benchmark?company=${encodeURIComponent(co)}&year=${year}`, { headers: H() });
      if (r.ok) _data = await r.json();
    } catch {}
    _renderTable();
  }

  function _renderTable() {
    const el = document.getElementById('page-benchmark');
    if (!el) return;
    const year = document.getElementById('bench-year')?.value || new Date().getFullYear();

    const sorted = [..._data].sort((a,b) => _sortDir * (((a[_sortCol]||0)) - (b[_sortCol]||0)));

    const totalCostAll = sorted.reduce((s,v) => s+(v.total_cost||0), 0);
    const avgTotalCost = sorted.length ? totalCostAll / sorted.length : 0;

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-chart-bar"></i> Benchmark kosztów floty</h2>
</div>
<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
  <select id="bench-year" onchange="window.BenchmarkModule.renderBenchmark()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    ${[0,1,2].map(i => { const y = new Date().getFullYear()-i; return `<option value="${y}" ${String(y)===String(year)?'selected':''}>${y}</option>`; }).join('')}
  </select>
  <div class="kpi-chip"><i class="ti ti-car"></i><span class="kpi-val">${sorted.length}</span><span class="kpi-lbl">Pojazdów</span></div>
  <div class="kpi-chip"><i class="ti ti-cash"></i><span class="kpi-val">${fmtN(totalCostAll)} PLN</span><span class="kpi-lbl">Koszty łączne</span></div>
  <div class="kpi-chip"><i class="ti ti-chart-pie"></i><span class="kpi-val">${fmtN(avgTotalCost)} PLN</span><span class="kpi-lbl">Śr. koszt/pojazd</span></div>
</div>
<div class="table-wrap">
<table class="data-table">
<thead><tr>
  <th>Nr rej.</th><th>Marka/model</th><th>Rok</th>
  <th class="sort-hdr" onclick="window.BenchmarkModule.sortBy('service_cost')" style="cursor:pointer">Serwis ${_sortCol==='service_cost'?(_sortDir>0?'▲':'▼'):''}</th>
  <th class="sort-hdr" onclick="window.BenchmarkModule.sortBy('fuel_cost')" style="cursor:pointer">Paliwo ${_sortCol==='fuel_cost'?(_sortDir>0?'▲':'▼'):''}</th>
  <th class="sort-hdr" onclick="window.BenchmarkModule.sortBy('fine_cost')" style="cursor:pointer">Mandaty ${_sortCol==='fine_cost'?(_sortDir>0?'▲':'▼'):''}</th>
  <th class="sort-hdr" onclick="window.BenchmarkModule.sortBy('damage_cost')" style="cursor:pointer">Szkody ${_sortCol==='damage_cost'?(_sortDir>0?'▲':'▼'):''}</th>
  <th>Litr./km (śr.)</th>
  <th class="sort-hdr" onclick="window.BenchmarkModule.sortBy('total_cost')" style="cursor:pointer"><strong>Razem ${_sortCol==='total_cost'?(_sortDir>0?'▲':'▼'):''}</strong></th>
  <th>PLN/km</th>
</tr></thead>
<tbody>
${sorted.length ? sorted.map(v => {
  const pct = avgTotalCost > 0 ? v.total_cost / avgTotalCost : 0;
  const cls = pct > 1.5 ? 'danger' : pct > 1.2 ? 'warn' : '';
  return `<tr class="${cls}">
  <td>${e(v.nr_rej)}</td>
  <td>${e(`${v.marka||''} ${v.model||''}`).trim()||'—'}</td>
  <td>${e(v.rok||'—')}</td>
  <td>${fmtN(v.service_cost)} PLN</td>
  <td>${fmtN(v.fuel_cost)} PLN</td>
  <td>${fmtN(v.fine_cost)} PLN</td>
  <td>${fmtN(v.damage_cost)} PLN</td>
  <td>${v.avg_consumption ? `${fmtN(v.avg_consumption,1)} l/100km` : '—'}</td>
  <td><strong>${fmtN(v.total_cost)} PLN</strong></td>
  <td>${v.cost_per_km ? fmtN(v.cost_per_km,2) : '—'}</td>
</tr>`;
}).join('') : '<tr><td colspan="10" class="empty">Brak danych</td></tr>'}
</tbody>
</table>
</div>
<p style="font-size:12px;color:var(--text-muted);margin-top:8px">Pogrubienie czerwone = koszt &gt;150% średniej. Pomarańczowe = &gt;120% średniej.</p>`;
  }

  function sortBy(col) {
    if (_sortCol === col) { _sortDir = -_sortDir; }
    else { _sortCol = col; _sortDir = -1; }
    _renderTable();
  }

  window.BenchmarkModule = { renderBenchmark, sortBy };
})();
