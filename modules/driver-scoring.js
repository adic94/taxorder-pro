(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtN = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtMin = m => m ? `${Math.floor(m / 60)}h ${m % 60}min` : '—';

  let _data = [];
  let _sortCol = 'score';
  let _sortDir = -1;

  async function renderDriverScoring() {
    const co   = Co();
    const year = document.getElementById('scoring-year')?.value || new Date().getFullYear();
    try {
      const r = await fetch(`${API()}/api/driver-scoring?company=${encodeURIComponent(co)}&year=${year}`, { headers: H() });
      if (r.ok) _data = await r.json();
    } catch {}
    _render();
  }

  function _scoreColor(s) { return s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--orange)' : 'var(--red)'; }

  function _render() {
    const el = document.getElementById('page-driver-scoring');
    if (!el) return;
    const year = document.getElementById('scoring-year')?.value || new Date().getFullYear();
    const sorted = [..._data].sort((a, b) => {
      const av = a[_sortCol], bv = b[_sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      return _sortDir * (typeof av === 'string' ? av.localeCompare(bv) : av - bv);
    });
    const top3 = sorted.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];

    function thSort(col, lbl) {
      const active = _sortCol === col;
      return `<th style="cursor:pointer;user-select:none" onclick="window.DriverScoringModule.sortBy('${col}')">${lbl} ${active ? (_sortDir < 0 ? '▼' : '▲') : ''}</th>`;
    }

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-award"></i> Scoring kierowców</h2>
</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
  <select id="scoring-year" onchange="window.DriverScoringModule.renderDriverScoring()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    ${[0, 1, 2].map(i => { const y = new Date().getFullYear() - i; return `<option value="${y}" ${String(y) === String(year) ? 'selected' : ''}>${y}</option>`; }).join('')}
  </select>
  <span style="font-size:13px;color:var(--text-muted)">${_data.length} kierowców</span>
</div>
${top3.length ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
  ${top3.map((d, i) => `<div class="kpi-chip" style="border-color:${_scoreColor(d.score)}">
    <span style="font-size:20px">${medals[i]}</span>
    <span class="kpi-val" style="color:${_scoreColor(d.score)}">${d.score}</span>
    <span class="kpi-lbl">${e(d.driver_name)}</span>
  </div>`).join('')}
</div>` : ''}
<div class="table-wrap" style="overflow-x:auto"><table class="data-table">
<thead><tr>
  <th>#</th>
  ${thSort('driver_name', 'Kierowca')}
  ${thSort('score', 'Wynik')}
  ${thSort('category', 'Kategoria')}
  ${thSort('fine_cnt', 'Mandaty')}
  ${thSort('fine_amount', 'Kwota mand.')}
  ${thSort('fault_cnt', 'Usterki')}
  ${thSort('shifts', 'Zmiany')}
  ${thSort('overtime_min', 'Nadgodziny')}
  ${thSort('avg_consumption', 'l/100km')}
</tr></thead>
<tbody>
${sorted.length ? sorted.map((d, i) => `<tr>
  <td style="color:var(--text-muted)">${i + 1}</td>
  <td><strong>${e(d.driver_name)}</strong></td>
  <td>
    <div style="display:flex;align-items:center;gap:8px">
      <div style="width:40px;height:40px;border-radius:50%;background:${_scoreColor(d.score)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${d.score}</div>
    </div>
  </td>
  <td><span class="pill ${d.score >= 80 ? 'ok' : d.score >= 60 ? 'warn' : 'danger'}">${e(d.category)}</span></td>
  <td class="${d.fine_cnt > 2 ? 'danger' : d.fine_cnt > 0 ? 'warn' : ''}">${d.fine_cnt || 0}</td>
  <td>${d.fine_amount ? fmtN(d.fine_amount, 2) + ' PLN' : '—'}</td>
  <td class="${d.fault_cnt > 3 ? 'danger' : d.fault_cnt > 0 ? 'warn' : ''}">${d.fault_cnt || 0}</td>
  <td>${d.shifts || 0}</td>
  <td>${d.overtime_min ? fmtMin(d.overtime_min) : '—'}</td>
  <td class="${d.avg_consumption > 12 ? 'danger' : d.avg_consumption > 10 ? 'warn' : ''}">${d.avg_consumption ? fmtN(d.avg_consumption, 1) : '—'}</td>
</tr>`).join('') : '<tr><td colspan="10" class="empty">Brak danych — kierowcy muszą być w kartotece i mieć zmiany</td></tr>'}
</tbody></table></div>
<p style="font-size:12px;color:var(--text-muted);margin-top:8px">Wynik 80-100: Wzorowy &bull; 60-79: Dobry &bull; 40-59: Przeciętny &bull; &lt;40: Do poprawy</p>`;
  }

  function sortBy(col) {
    if (_sortCol === col) _sortDir = -_sortDir;
    else { _sortCol = col; _sortDir = col === 'score' ? -1 : 1; }
    _render();
  }

  window.DriverScoringModule = { renderDriverScoring, sortBy };
})();
