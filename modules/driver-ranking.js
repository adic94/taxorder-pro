/**
 * TaxOrder Pro — Rankingi kierowców
 * Scoring wg: zużycia paliwa, szkód, czasu pracy, terminowości
 */
window.DriverRanking = (function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v, d=1) => v != null && !isNaN(v) ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits:d, maximumFractionDigits:d }) : '—';

  let _data    = [];
  let _days    = 30;
  let _sortCol = 'total_score';
  let _sortDir = -1;

  const MEDALS = ['🥇', '🥈', '🥉'];

  function _scoreColor(s) {
    if (s >= 80) return 'var(--green)';
    if (s >= 60) return 'var(--orange)';
    return 'var(--red)';
  }
  function _trendIcon(t) {
    if (t > 2)  return '<span style="color:var(--green)">▲</span>';
    if (t < -2) return '<span style="color:var(--red)">▼</span>';
    return '<span style="color:var(--text3)">—</span>';
  }

  async function _load() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/driver-ranking?company=${encodeURIComponent(co)}&days=${_days}`, { headers: H() });
      if (r.ok) _data = await r.json();
    } catch {}
  }

  async function renderDriverRanking() {
    const el = document.getElementById('page-driver-ranking');
    if (!el) return;
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)"><i class="ti ti-loader" style="font-size:32px"></i></div>`;
    await _load();
    _render();
  }

  function _render() {
    const el = document.getElementById('page-driver-ranking');
    if (!el) return;

    const sorted = [..._data].sort((a, b) => {
      const av = a[_sortCol], bv = b[_sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      return _sortDir * (typeof av === 'string' ? av.localeCompare(bv, 'pl') : av - bv);
    });

    const top3 = sorted.slice(0, 3);

    function thSort(col, lbl, tip='') {
      const active = _sortCol === col;
      return `<th style="cursor:pointer;user-select:none;white-space:nowrap" title="${e(tip)}" onclick="window.DriverRanking.sortBy('${col}')">
        ${lbl} ${active ? (_sortDir < 0 ? '▼' : '▲') : '<span style="opacity:.3">⇅</span>'}
      </th>`;
    }

    el.innerHTML = `
<div class="page-header" style="margin-bottom:16px">
  <h2 style="margin:0"><i class="ti ti-trophy"></i> Ranking kierowców</h2>
  <div style="display:flex;gap:6px;align-items:center">
    <span style="font-size:12px;color:var(--text3)">Okres:</span>
    ${[30,90,180].map(d => `<button
      style="padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:${_days===d?'var(--primary)':'transparent'};color:${_days===d?'#fff':'var(--text2)'};cursor:pointer;font-size:12px"
      onclick="window.DriverRanking.setDays(${d})">${d} dni</button>`).join('')}
    <button class="btn-secondary" style="font-size:12px;padding:5px 10px" onclick="window.DriverRanking.exportCsv()"><i class="ti ti-download"></i> CSV</button>
  </div>
</div>

<!-- Podium top 3 -->
${top3.length >= 1 ? `
<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:22px;align-items:flex-end;justify-content:center;padding:16px;background:var(--bg2);border-radius:12px">
  ${top3.map((d, i) => {
    const heightMap = [100, 80, 65];
    return `
<div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:110px">
  <span style="font-size:28px">${MEDALS[i]}</span>
  <div style="font-size:28px;font-weight:800;color:${_scoreColor(d.total_score)}">${d.total_score ?? '—'}</div>
  <div style="font-weight:600;font-size:13px;text-align:center">${e(d.driver_name)}</div>
  ${d.vehicles_count ? `<div style="font-size:11px;color:var(--text3)">${d.vehicles_count} pojazd${d.vehicles_count>1?'ów':''}</div>` : ''}
  <div style="width:80px;height:${heightMap[i]}px;background:${_scoreColor(d.total_score)};border-radius:4px 4px 0 0;opacity:.8"></div>
</div>`;
  }).join('')}
</div>` : ''}

<!-- Tabela pełna -->
${sorted.length ? `
<div class="table-wrap" style="overflow-x:auto">
<table class="data-table">
<thead><tr>
  <th style="width:36px">#</th>
  ${thSort('driver_name','Kierowca')}
  ${thSort('total_score','Wynik ogólny','Łączny wynik 0–100')}
  ${thSort('fuel_score','Paliwo','Wynik efektywności paliwowej')}
  ${thSort('damage_score','Bezwypadkowość','Wynik: brak szkód')}
  ${thSort('compliance_score','Punktualność','Wynik terminowości')}
  ${thSort('avg_consumption','L/100km','Średnie zużycie paliwa')}
  ${thSort('damage_count','Szkody','Liczba zgłoszonych szkód')}
  ${thSort('vehicles_count','Pojazdy')}
  <th>Trend</th>
</tr></thead>
<tbody>
${sorted.map((d, i) => `<tr>
  <td style="color:var(--text3);font-weight:600">${i < 3 ? MEDALS[i] : i+1}</td>
  <td><strong>${e(d.driver_name)}</strong></td>
  <td>
    <div style="display:flex;align-items:center;gap:8px">
      <div style="width:34px;height:34px;border-radius:50%;background:${_scoreColor(d.total_score ?? 0)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0">${d.total_score ?? '—'}</div>
      <div style="flex:1;background:var(--bg2);border-radius:4px;height:6px;min-width:60px">
        <div style="height:6px;border-radius:4px;background:${_scoreColor(d.total_score??0)};width:${Math.min(100, d.total_score??0)}%"></div>
      </div>
    </div>
  </td>
  <td style="color:${_scoreColor(d.fuel_score??0)}">${d.fuel_score ?? '—'}</td>
  <td style="color:${_scoreColor(d.damage_score??0)}">${d.damage_score ?? '—'}</td>
  <td style="color:${_scoreColor(d.compliance_score??0)}">${d.compliance_score ?? '—'}</td>
  <td>${fmtN(d.avg_consumption)} <span style="font-size:11px;color:var(--text3)">l/100</span></td>
  <td>${d.damage_count ?? 0}</td>
  <td>${d.vehicles_count ?? 0}</td>
  <td>${_trendIcon(d.trend ?? 0)} <span style="font-size:11px;color:var(--text3)">${d.trend != null ? (d.trend > 0 ? '+' : '') + Math.round(d.trend) : ''}</span></td>
</tr>`).join('')}
</tbody>
</table>
</div>` : `
<div style="padding:50px;text-align:center;color:var(--text3)">
  <i class="ti ti-users-minus" style="font-size:40px;display:block;margin-bottom:12px"></i>
  Brak danych kierowców za ostatnie ${_days} dni.<br>
  <small>Upewnij się, że pojazdy mają przypisanych kierowców oraz są zarejestrowane tankowania.</small>
</div>`}

<!-- Legenda -->
<div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--text3)">
  <span><span style="color:var(--green);font-weight:700">80–100</span> Wynik bardzo dobry</span>
  <span><span style="color:var(--orange);font-weight:700">60–79</span> Dobry</span>
  <span><span style="color:var(--red);font-weight:700">0–59</span> Wymaga uwagi</span>
  <span style="margin-left:auto"><i class="ti ti-info-circle"></i> Wynik = 50% paliwo + 30% bezwypadkowość + 20% punktualność</span>
</div>
`;
  }

  function sortBy(col) {
    if (_sortCol === col) _sortDir *= -1;
    else { _sortCol = col; _sortDir = -1; }
    _render();
  }

  async function setDays(d) {
    _days = d;
    const el = document.getElementById('page-driver-ranking');
    if (el) el.style.opacity = '.5';
    await _load();
    if (el) el.style.opacity = '1';
    _render();
  }

  function exportCsv() {
    if (!_data.length) { if(typeof toast==='function') toast('Brak danych','error'); return; }
    const cols = ['driver_name','total_score','fuel_score','damage_score','compliance_score','avg_consumption','damage_count','vehicles_count'];
    const hdrs = ['Kierowca','Wynik','Paliwo','Bezwypadkowość','Punktualność','L/100km','Szkody','Pojazdy'];
    const rows = _data.map(d => cols.map(c => d[c] ?? '').join(';'));
    const csv  = [hdrs.join(';'), ...rows].join('\n');
    const a    = document.createElement('a');
    a.download = `ranking-kierowcow-${new Date().toISOString().slice(0,10)}.csv`;
    a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
    a.click();
  }

  return { renderDriverRanking, sortBy, setDays, exportCsv };
})();
