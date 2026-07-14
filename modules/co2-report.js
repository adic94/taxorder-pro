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
  ${r ? `<div style="display:flex;gap:6px"><button class="btn-secondary" onclick="window.Co2ReportModule.exportCsv()"><i class="ti ti-download"></i> CSV</button><button class="btn-secondary" onclick="window.Co2ReportModule.exportCsrd()"><i class="ti ti-file-spreadsheet"></i> CSRD Excel</button></div>` : ''}
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

  function exportCsrd() {
    if (!_report) { alert('Brak danych raportu — wybierz rok i poczekaj na załadowanie'); return; }
    if (!window.XLSX) { alert('Biblioteka XLSX niedostępna'); return; }
    const r = _report;
    const year = document.getElementById('co2-year')?.value || new Date().getFullYear();
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Summary CSRD (ESRS E1)
    const summary = [
      ['RAPORT ESG / CSRD — Emisje gazów cieplarnianych (GHG)', ''],
      ['Standard:', 'ESRS E1 — Zmiana klimatu'],
      ['Rok sprawozdawczy:', String(year)],
      ['Data generowania:', new Date().toLocaleDateString('pl-PL')],
      ['', ''],
      ['ZAKRES 1 — Emisje bezpośrednie (spalanie paliwa przez flotę)', ''],
      ['Całkowite emisje CO₂ (Scope 1)', `${fmtN(r.total_kg, 1)} kg CO₂e`],
      ['Całkowite emisje CO₂ (tony)', `${fmtN(r.total_tonnes, 3)} tCO₂e`],
      ['Spalone paliwo łącznie', `${fmtN(r.by_vehicle?.reduce((a,v)=>a+v.liters,0),0)} litrów`],
      ['Liczba pojazdów raportujących', String(r.by_vehicle?.length || 0)],
      ['', ''],
      ['WSKAŹNIKI INTENSYWNOŚCI', ''],
      ['Emisja na pojazd (średnia)', r.by_vehicle?.length ? `${fmtN(r.total_kg / r.by_vehicle.length, 1)} kg CO₂e/pojazd` : '—'],
      ['', ''],
      ['ZAKRES 2 — Emisje pośrednie (energia elektryczna)', ''],
      ['Uwaga:', 'Brak danych o energii elektrycznej — wprowadź ręcznie'],
      ['', ''],
      ['ZAKRES 3 — Pozostałe emisje pośrednie', ''],
      ['Uwaga:', 'Wymagana rozszerzona analiza łańcucha wartości'],
      ['', ''],
      ['CEL REDUKCJI (ESRS E1-4)', ''],
      ['Cel redukcji:', 'Do uzupełnienia przez organizację'],
      ['Poziom bazowy:', 'Do uzupełnienia'],
      ['Rok docelowy:', 'Do uzupełnienia'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    ws1['!cols'] = [{ wch: 45 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Podsumowanie CSRD');

    // Sheet 2 — Per-vehicle breakdown
    const vehHdrs = ['Nr rej.', 'Typ paliwa', 'Litry', 'CO₂ (kg)', 'CO₂ (tCO₂e)', 'Udział %', 'Współczynnik emisji (kg/l)'];
    const EMISSION_FACTORS = { benzyna: 2.31, diesel: 2.68, lpg: 1.51, cng: 2.04, elektryczny: 0 };
    const vehRows = (r.by_vehicle || []).map(v => {
      const ef = EMISSION_FACTORS[v.fuel_type?.toLowerCase()] ?? 2.5;
      return [v.nr_rej||'', v.fuel_type||'', Number(v.liters?.toFixed(1)), Number(v.kg?.toFixed(1)), Number((v.kg/1000)?.toFixed(4)), Number(v.pct?.toFixed(2)), ef];
    });
    const ws2 = XLSX.utils.aoa_to_sheet([vehHdrs, ...vehRows]);
    ws2['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Dane per pojazd');

    // Sheet 3 — Monthly breakdown
    if (r.by_month?.length) {
      const mHdrs = ['Miesiąc', 'CO₂ (kg)', 'CO₂ (tCO₂e)'];
      const mRows = r.by_month.map(m => [m.month||'', Number(m.kg?.toFixed(1)), Number((m.kg/1000)?.toFixed(4))]);
      const ws3 = XLSX.utils.aoa_to_sheet([mHdrs, ...mRows]);
      ws3['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Rozkład miesięczny');
    }

    // Sheet 4 — ESRS disclosure checklist
    const checklist = [
      ['LISTA UJAWNIEŃ ESRS E1 (informacje wymagane)', 'Status', 'Uwagi'],
      ['E1-1: Plan transformacji klimatycznej', 'Do uzupełnienia', ''],
      ['E1-2: Polityki w zakresie łagodzenia zmian klimatu', 'Do uzupełnienia', ''],
      ['E1-3: Działania i zasoby w zakresie zmian klimatu', 'Do uzupełnienia', ''],
      ['E1-4: Cele w zakresie łagodzenia zmian klimatu', 'Do uzupełnienia', ''],
      ['E1-5: Zużycie energii i miks energetyczny', 'Częściowe', 'Flota pojazdów — Scope 1'],
      ['E1-6: Emisje gazów cieplarnianych GHG', 'Dostarczone', `Scope 1: ${fmtN(r.total_tonnes,2)} tCO₂e`],
      ['E1-7: Pochłanianie i kredyty GHG', 'Do uzupełnienia', ''],
      ['E1-8: Wewnętrzne ceny uprawnień do emisji CO₂', 'Do uzupełnienia', ''],
      ['E1-9: Ekspozycja na ryzyka związane ze zmianą klimatu', 'Do uzupełnienia', ''],
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(checklist);
    ws4['!cols'] = [{ wch: 50 }, { wch: 16 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Lista ujawnień ESRS E1');

    XLSX.writeFile(wb, `raport_ESG_CSRD_${year}.xlsx`);
  }

  window.Co2ReportModule = { renderCo2Report, exportCsv, exportCsrd };
})();
