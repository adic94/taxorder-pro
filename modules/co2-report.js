(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtN = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

  let _report = null;

  async function renderCo2Report() {
    const co    = Co();
    const year  = document.getElementById('co2-year')?.value  || new Date().getFullYear();
    const month = document.getElementById('co2-month')?.value || '';
    const params = new URLSearchParams({ company: co, year });
    if (month) params.set('month', month);
    try {
      const r = await fetch(`${API()}/api/co2-report?${params}`, { headers: H() });
      if (r.ok) _report = await r.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-co2-report');
    if (!el) return;
    const year  = document.getElementById('co2-year')?.value  || new Date().getFullYear();
    const month = document.getElementById('co2-month')?.value || '';
    const r = _report;

    const months = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
    const byMonth = r?.by_month || [];
    const maxKg   = Math.max(...byMonth.map(m => m.kg), 1);

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-leaf"></i> Raport CO₂ / ESG</h2>
  ${r ? `<button class="btn-secondary" onclick="window.Co2ReportModule.exportCsv()"><i class="ti ti-download"></i> Eksportuj CSV</button>` : ''}
</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
  <select id="co2-year" onchange="window.Co2ReportModule.renderCo2Report()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    ${[0,1,2].map(i => { const y = new Date().getFullYear()-i; return `<option value="${y}" ${String(y)===String(year)?'selected':''}>${y}</option>`; }).join('')}
  </select>
  <select id="co2-month" onchange="window.Co2ReportModule.renderCo2Report()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="">Cały rok</option>
    ${months.map((m,i) => `<option value="${i+1}" ${String(i+1)===String(month)?'selected':''}>${m}</option>`).join('')}
  </select>
</div>
${r ? `
${r.target_exceeded ? `<div style="background:var(--red-light,#ffeaea);border:1px solid var(--red);border-radius:8px;padding:10px 14px;margin-bottom:16px;color:var(--red)"><i class="ti ti-alert-circle"></i> Przekroczono próg 10 000 kg CO₂ — rozważ optymalizację tras lub pojazdy niskoemisyjne</div>` : ''}
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
  <div class="kpi-chip"><i class="ti ti-leaf" style="color:var(--green)"></i><span class="kpi-val">${fmtN(r.total_kg, 1)} kg</span><span class="kpi-lbl">Łącznie CO₂</span></div>
  <div class="kpi-chip"><i class="ti ti-leaf"></i><span class="kpi-val">${fmtN(r.total_tonnes, 2)} t</span><span class="kpi-lbl">Tony CO₂</span></div>
  <div class="kpi-chip"><i class="ti ti-gas-station"></i><span class="kpi-val">${fmtN(r.by_vehicle?.reduce((a,v)=>a+v.liters,0),0)} l</span><span class="kpi-lbl">Spalone paliwo</span></div>
  <div class="kpi-chip"><i class="ti ti-car"></i><span class="kpi-val">${r.by_vehicle?.length || 0}</span><span class="kpi-lbl">Pojazdów</span></div>
</div>

${byMonth.length ? `<div style="margin-bottom:20px">
  <h3 style="font-size:14px;margin-bottom:8px">Emisje miesięczne</h3>
  <div style="display:flex;align-items:flex-end;gap:4px;height:100px;border-bottom:1px solid var(--border);padding-bottom:4px">
    ${byMonth.map(m => {
      const pct = Math.round(m.kg / maxKg * 100);
      const label = m.month?.slice(5) || '';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <span style="font-size:9px;color:var(--text-muted)">${fmtN(m.kg,0)}</span>
        <div style="width:100%;background:var(--green);height:${pct}%;min-height:2px;border-radius:3px 3px 0 0" title="${m.month}: ${fmtN(m.kg,1)} kg CO₂"></div>
        <span style="font-size:9px;color:var(--text-muted)">${e(label)}</span>
      </div>`;
    }).join('')}
  </div>
</div>` : ''}

<div class="table-wrap"><table class="data-table">
<thead><tr><th>Nr rej.</th><th>Typ paliwa</th><th>Litry</th><th>CO₂ (kg)</th><th>Udział %</th></tr></thead>
<tbody>
${r.by_vehicle?.length ? r.by_vehicle.map(v => `<tr>
  <td><strong>${e(v.nr_rej || v.vehicle_id)}</strong></td>
  <td>${e(v.fuel_type || '—')}</td>
  <td>${fmtN(v.liters, 1)} l</td>
  <td>${fmtN(v.kg, 1)} kg</td>
  <td>
    <div style="display:flex;align-items:center;gap:6px">
      <div style="width:60px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="width:${v.pct}%;height:100%;background:var(--green)"></div>
      </div>
      ${fmtN(v.pct, 1)}%
    </div>
  </td>
</tr>`).join('') : '<tr><td colspan="5" class="empty">Brak danych — uzupełnij tankowania</td></tr>'}
</tbody></table></div>` : '<p style="color:var(--text-muted)">Ładowanie danych...</p>'}`;
  }

  function exportCsv() {
    if (!_report?.by_vehicle?.length) return;
    const rows = [['Nr rej.','Typ paliwa','Litry','CO2 kg','Udzial %']];
    for (const v of _report.by_vehicle) rows.push([v.nr_rej||'', v.fuel_type||'', v.liters, v.kg, v.pct]);
    rows.push(['SUMA','','',_report.total_kg,'100']);
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `co2_${_report.year || ''}.csv`; a.click();
  }

  window.Co2ReportModule = { renderCo2Report, exportCsv };
})();
