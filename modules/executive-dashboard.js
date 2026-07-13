(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc==='function' ? esc(s) : String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v,d=0) => v!=null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';

  async function renderExecDashboard() {
    const co = Co();
    let kpi = null;
    try {
      const r = await fetch(`${API()}/api/executive-dashboard?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) kpi = await r.json();
    } catch {}

    const el = document.getElementById('page-exec-dashboard');
    if (!el) return;
    if (!kpi) { el.innerHTML = '<p style="padding:20px;color:var(--text-muted)">Nie udało się załadować danych.</p>'; return; }

    const budgetPct = kpi.budget_annual > 0 ? Math.min(100, (kpi.cost_ytd / kpi.budget_annual * 100)) : null;
    const budgetCls = budgetPct != null ? (budgetPct >= 100 ? 'danger' : budgetPct >= 80 ? 'warn' : 'ok') : '';

    el.innerHTML = `
<div class="page-header" style="margin-bottom:20px">
  <h2><i class="ti ti-layout-dashboard"></i> Executive Dashboard</h2>
  <button class="btn-secondary" onclick="window.ExecDashboardModule.renderExecDashboard()"><i class="ti ti-refresh"></i> Odśwież</button>
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
  ${kpiCard('Aktywne pojazdy', fmtN(kpi.vehicles_active), 'ti-car', '')}
  ${kpiCard('Koszty YTD', fmtN(kpi.cost_ytd)+' PLN', 'ti-cash', '')}
  ${kpiCard('Koszty MTD', fmtN(kpi.cost_mtd)+' PLN', 'ti-calendar-stats', '')}
  ${kpiCard('Oczekujące zatwierdzenia', kpi.pending_approvals, 'ti-checks', kpi.pending_approvals > 0 ? 'warn' : '')}
  ${kpiCard('Rezerwacje do zatwierdzenia', kpi.pending_reservations, 'ti-calendar-event', kpi.pending_reservations > 0 ? 'warn' : '')}
  ${kpiCard('Niski stan magazynowy', kpi.low_stock_parts, 'ti-package', kpi.low_stock_parts > 0 ? 'danger' : '')}
  ${kpiCard('Alerty kierowców', kpi.driver_alerts, 'ti-id-badge', kpi.driver_alerts > 0 ? 'danger' : '')}
  ${kpiCard('Otwarte usterki', kpi.open_faults, 'ti-alert-triangle', kpi.open_faults > 0 ? 'warn' : '')}
</div>

${kpi.budget_annual != null ? `
<div class="card" style="padding:16px;margin-bottom:20px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <strong>Realizacja budżetu rocznego</strong>
    <span>${fmtN(kpi.cost_ytd)} / ${fmtN(kpi.budget_annual)} PLN (${budgetPct!=null?fmtN(budgetPct)+'%':'—'})</span>
  </div>
  <div style="height:12px;background:var(--border);border-radius:6px;overflow:hidden">
    <div style="height:100%;width:${budgetPct??0}%;background:var(--${budgetCls==='danger'?'red':budgetCls==='warn'?'orange':'green'});border-radius:6px;transition:width .4s"></div>
  </div>
</div>` : ''}

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px">
  <div class="card" style="padding:16px">
    <h3 style="margin:0 0 12px;font-size:14px"><i class="ti ti-podium"></i> Top 5 najdroższych pojazdów (YTD)</h3>
    ${kpi.top_cost_vehicles?.length ? `<table style="width:100%;font-size:13px"><tbody>
    ${kpi.top_cost_vehicles.map((v,i)=>`<tr>
      <td style="padding:4px 0;color:var(--text-muted)">${i+1}.</td>
      <td style="padding:4px 8px;font-weight:600">${e(v.nr_rej)}</td>
      <td style="text-align:right">${fmtN(v.cost,2)} PLN</td>
    </tr>`).join('')}
    </tbody></table>` : '<p style="color:var(--text-muted);font-size:13px">Brak danych</p>'}
  </div>

  <div class="card" style="padding:16px">
    <h3 style="margin:0 0 12px;font-size:14px"><i class="ti ti-bell"></i> Akcje wymagające uwagi</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${kpi.pending_approvals > 0 ? `<div class="alert-item warn"><i class="ti ti-checks"></i> <a href="#" onclick="showPage('approvals');return false">${kpi.pending_approvals} zatwierdzeń oczekuje</a></div>` : ''}
      ${kpi.pending_reservations > 0 ? `<div class="alert-item warn"><i class="ti ti-calendar-event"></i> <a href="#" onclick="showPage('reservations');return false">${kpi.pending_reservations} rezerwacji do zatwierdzenia</a></div>` : ''}
      ${kpi.low_stock_parts > 0 ? `<div class="alert-item danger"><i class="ti ti-package"></i> <a href="#" onclick="showPage('spare-parts');return false">${kpi.low_stock_parts} części na wyczerpaniu</a></div>` : ''}
      ${kpi.driver_alerts > 0 ? `<div class="alert-item danger"><i class="ti ti-id-badge"></i> <a href="#" onclick="showPage('driver-profiles');return false">${kpi.driver_alerts} kierowców z wygasającymi dokumentami</a></div>` : ''}
      ${kpi.open_faults > 0 ? `<div class="alert-item warn"><i class="ti ti-alert-triangle"></i> <a href="#" onclick="showPage('faults');return false">${kpi.open_faults} otwartych usterek</a></div>` : ''}
      ${[kpi.pending_approvals,kpi.pending_reservations,kpi.low_stock_parts,kpi.driver_alerts,kpi.open_faults].every(x=>!x) ? '<p style="color:var(--text-muted);font-size:13px">Brak pilnych spraw ✓</p>' : ''}
    </div>
  </div>
</div>`;
  }

  function kpiCard(label, value, icon, cls) {
    const border = cls==='danger' ? 'border:2px solid var(--red)' : cls==='warn' ? 'border:2px solid var(--orange)' : '';
    return `<div class="card" style="padding:16px;${border}">
  <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:12px;margin-bottom:8px">
    <i class="ti ${e(icon)}"></i>${e(label)}
  </div>
  <div style="font-size:24px;font-weight:700;color:${cls==='danger'?'var(--red)':cls==='warn'?'var(--orange)':'var(--text)'}">${value}</div>
</div>`;
  }

  window.ExecDashboardModule = { renderExecDashboard };
})();
