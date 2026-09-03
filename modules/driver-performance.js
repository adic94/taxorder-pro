(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc==='function' ? esc(s) : String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v,d=0) => v!=null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
  const fmtMin = m => m ? `${Math.floor(m/60)}h ${m%60}min` : '—';

  let _data = [];
  let _sortCol = 'driver_name';
  let _sortDir = 1;

  async function renderDriverPerformance() {
    const co   = Co();
    const year = document.getElementById('dperf-year')?.value || new Date().getFullYear();
    try {
      const r = await fetch(`${API()}/api/driver-performance?company=${encodeURIComponent(co)}&year=${year}`, { headers: H() });
      if (r.ok) _data = await r.json();
    } catch {}
    _renderTable();
  }

  function _renderTable() {
    const el = document.getElementById('page-driver-performance');
    if (!el) return;
    const year = document.getElementById('dperf-year')?.value || new Date().getFullYear();

    const sorted = [..._data].sort((a,b) => {
      const av = a[_sortCol], bv = b[_sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      return _sortDir * (typeof av==='string' ? av.localeCompare(bv) : av - bv);
    });

    function thSort(col, label) {
      const active = _sortCol === col;
      return `<th style="cursor:pointer;user-select:none" onclick="window.DriverPerformanceModule.sortBy('${col}')">${label} ${active?(_sortDir>0?'▲':'▼'):''}</th>`;
    }

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-chart-infographic"></i> Wydajność kierowców</h2>
</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
  <select id="dperf-year" onchange="window.DriverPerformanceModule.renderDriverPerformance()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    ${[0,1,2].map(i=>{const y=new Date().getFullYear()-i;return`<option value="${y}" ${String(y)===String(year)?'selected':''}>${y}</option>`;}).join('')}
  </select>
  <span style="font-size:13px;color:var(--text-muted)">${sorted.length} kierowców</span>
</div>
<div class="table-wrap" style="overflow-x:auto"><table class="data-table">
<thead><tr>
  ${thSort('driver_name','Kierowca')}
  ${thSort('shifts','Zmiany')}
  ${thSort('total_minutes','Czas pracy')}
  ${thSort('total_overtime','Nadgodziny')}
  ${thSort('driven_km','Km')}
  ${thSort('fuel_liters','Paliwo (l)')}
  ${thSort('avg_consumption','l/100km')}
  ${thSort('fuel_cost','Koszt paliwa')}
  ${thSort('faults_reported','Usterki zgl.')}
  ${thSort('fine_cnt','Mandaty')}
  ${thSort('fine_amount','Kwota mandatów')}
  ${thSort('claims_amount','Rozl. km')}
</tr></thead>
<tbody>
${sorted.length ? sorted.map(d=>`<tr>
  <td><strong>${e(d.driver_name)}</strong></td>
  <td>${d.shifts||0}</td>
  <td>${fmtMin(d.total_minutes)}</td>
  <td>${d.total_overtime ? fmtMin(d.total_overtime) : '—'}</td>
  <td>${d.driven_km ? `${fmtN(d.driven_km)} km` : '—'}</td>
  <td>${d.fuel_liters ? `${fmtN(d.fuel_liters,1)} l` : '—'}</td>
  <td class="${d.avg_consumption > 12 ? 'danger' : d.avg_consumption > 10 ? 'warn' : ''}">${d.avg_consumption ? fmtN(d.avg_consumption,1) : '—'}</td>
  <td>${d.fuel_cost ? `${fmtN(d.fuel_cost,2)} PLN` : '—'}</td>
  <td>${d.faults_reported||0}</td>
  <td class="${d.fine_cnt>2?'danger':d.fine_cnt>0?'warn':''}">${d.fine_cnt||0}</td>
  <td class="${d.fine_amount>500?'danger':d.fine_amount>200?'warn':''}">${d.fine_amount ? `${fmtN(d.fine_amount,2)} PLN` : '—'}</td>
  <td>${d.claims_amount ? `${fmtN(d.claims_amount,2)} PLN` : '—'}</td>
</tr>`).join('') : '<tr><td colspan="12" class="empty">Brak danych</td></tr>'}
</tbody></table></div>
<p style="font-size:12px;color:var(--text-muted);margin-top:8px">Pomarańczowe = powyżej normy | Czerwone = znacznie powyżej normy</p>`;
  }

  function sortBy(col) {
    if (_sortCol === col) _sortDir = -_sortDir;
    else { _sortCol = col; _sortDir = 1; }
    _renderTable();
  }

  window.DriverPerformanceModule = { renderDriverPerformance, sortBy };
})();
