(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtN = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

  const CAT = { fuel: 'Paliwo', service: 'Serwis', insurance: 'Ubezpieczenie', fines: 'Mandaty', parts: 'Części', leasing: 'Leasing', other: 'Inne' };
  const CAT_ICON = { fuel: 'ti-gas-station', service: 'ti-tool', insurance: 'ti-shield', fines: 'ti-gavel', parts: 'ti-settings', leasing: 'ti-coin', other: 'ti-dots' };

  let _budget = null;

  async function renderBudgetAnnual() {
    const co   = Co();
    const year = document.getElementById('ba-year')?.value || new Date().getFullYear();
    try {
      const r = await fetch(`${API()}/api/budget-annual?company=${encodeURIComponent(co)}&year=${year}`, { headers: H() });
      if (r.ok) _budget = await r.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-budget-annual');
    if (!el) return;
    const year = document.getElementById('ba-year')?.value || new Date().getFullYear();
    const cats = _budget?.categories || Object.keys(CAT).map(k => ({ category: k, planned: 0, actual: 0, variance: 0, variance_pct: null }));
    const totalPlanned = cats.reduce((a, c) => a + (c.planned || 0), 0);
    const totalActual  = cats.reduce((a, c) => a + (c.actual  || 0), 0);

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-report-money"></i> Budżet roczny</h2>
  <button class="btn-primary" onclick="window.BudgetAnnualModule.saveBudget()"><i class="ti ti-device-floppy"></i> Zapisz budżet</button>
</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
  <select id="ba-year" onchange="window.BudgetAnnualModule.renderBudgetAnnual()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    ${[0,1,2].map(i => { const y = new Date().getFullYear()-i; return `<option value="${y}" ${String(y)===String(year)?'selected':''}>${y}</option>`; }).join('')}
    <option value="${new Date().getFullYear()+1}">${new Date().getFullYear()+1}</option>
  </select>
  <div class="kpi-chip" style="display:inline-flex"><i class="ti ti-trending-up" style="color:var(--green)"></i><span class="kpi-val">${fmtN(totalActual,2)} PLN</span><span class="kpi-lbl">Wykonanie / ${fmtN(totalPlanned,2)} PLN plan</span></div>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Kategoria</th><th>Plan (PLN)</th><th>Wykonanie (PLN)</th><th>Różnica</th><th>% wykon.</th><th>Postęp</th></tr></thead>
<tbody>
${cats.map(c => {
  const planned = c.planned || 0;
  const actual  = c.actual  || 0;
  const diff    = actual - planned;
  const pct     = planned > 0 ? Math.min(Math.round(actual / planned * 100), 200) : 0;
  const barPct  = Math.min(pct, 100);
  const barColor = pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--orange)' : 'var(--green)';
  return `<tr>
  <td><i class="ti ${CAT_ICON[c.category]||'ti-circle'}"></i> ${e(CAT[c.category]||c.category)}</td>
  <td><input type="number" step="0.01" id="ba-cat-${e(c.category)}" value="${planned.toFixed(2)}" class="form-input" style="width:130px;text-align:right" oninput="window.BudgetAnnualModule.previewTotal()"></td>
  <td style="text-align:right">${fmtN(actual,2)}</td>
  <td style="text-align:right;color:${diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'inherit'}">${diff !== 0 ? (diff > 0 ? '+' : '') + fmtN(diff,2) : '—'}</td>
  <td style="text-align:right">${planned > 0 ? `${fmtN(c.variance_pct !== null ? (actual/planned*100) : 0, 1)}%` : '—'}</td>
  <td style="min-width:100px">
    <div style="width:100%;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
      <div style="width:${barPct}%;height:100%;background:${barColor};border-radius:3px"></div>
    </div>
    <span style="font-size:11px;color:var(--text-muted)">${pct}%</span>
  </td>
</tr>`;
}).join('')}
<tr style="font-weight:600;background:var(--bg-card)">
  <td>SUMA</td><td id="ba-total-plan" style="text-align:right">${fmtN(totalPlanned,2)}</td>
  <td style="text-align:right">${fmtN(totalActual,2)}</td>
  <td style="text-align:right;color:${totalActual-totalPlanned>0?'var(--red)':'var(--green)'}">${totalActual !== totalPlanned ? (totalActual-totalPlanned>0?'+':'')+fmtN(totalActual-totalPlanned,2) : '—'}</td>
  <td colspan="2"></td>
</tr>
</tbody></table></div>
<div style="margin-top:16px;font-size:13px;color:var(--text-muted)">
  ${cats.filter(c=>c.actual>0).map(c => {
    const pct2 = totalActual > 0 ? Math.round(c.actual/totalActual*100) : 0;
    return `<span style="margin-right:12px">${e(CAT[c.category]||c.category)} ${pct2}%</span>`;
  }).join('')}
</div>`;
  }

  function previewTotal() {
    const cats = ['fuel','service','insurance','fines','parts','leasing','other'];
    let total = 0;
    for (const c of cats) { total += parseFloat(document.getElementById(`ba-cat-${c}`)?.value) || 0; }
    const el = document.getElementById('ba-total-plan');
    if (el) el.textContent = total.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function saveBudget() {
    const year = document.getElementById('ba-year')?.value || new Date().getFullYear();
    const cats = ['fuel','service','insurance','fines','parts','leasing','other'];
    const items = cats.map(c => ({
      category: c,
      planned_amount: parseFloat(document.getElementById(`ba-cat-${c}`)?.value) || 0,
    }));
    try {
      const r = await fetch(`${API()}/api/budget-annual?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: parseInt(year), items }),
      });
      if (!r.ok) throw new Error(await r.text());
      await renderBudgetAnnual();
    } catch (ex) { alert(`Błąd: ${  ex.message}`); }
  }

  window.BudgetAnnualModule = { renderBudgetAnnual, previewTotal, saveBudget };
})();
