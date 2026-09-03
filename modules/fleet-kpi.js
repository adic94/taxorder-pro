(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN  = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

  let _data = null;
  let _period = 'month';

  async function renderFleetKpi() {
    const co = Co();
    const params = new URLSearchParams({ company: co, period: _period });
    try {
      const r = await fetch(`${API()}/api/fleet-kpi?${params}`, { headers: H() });
      if (r.ok) _data = await r.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-fleet-kpi');
    if (!el) return;
    const d = _data || {};

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-chart-bar"></i> Dashboard KPI Floty</h2>
  <div style="display:flex;gap:8px;align-items:center">
    <select id="kpi-period" onchange="window.FleetKpi._setPeriod(this.value)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
      <option value="week" ${_period==='week'?'selected':''}>Ostatnie 7 dni</option>
      <option value="month" ${_period==='month'?'selected':''}>Ostatnie 30 dni</option>
      <option value="quarter" ${_period==='quarter'?'selected':''}>Ostatni kwartał</option>
      <option value="year" ${_period==='year'?'selected':''}>Ostatni rok</option>
    </select>
    <button class="btn-secondary" onclick="window.FleetKpi.renderFleetKpi()"><i class="ti ti-refresh"></i> Odśwież</button>
  </div>
</div>

<!-- KPI Row 1 — Pojazdy -->
<div style="margin-bottom:8px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);letter-spacing:.5px">Flota</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
  ${_kpiCard('ti-car','Pojazdów łącznie', d.vehicles_total??'—','')}
  ${_kpiCard('ti-check','Aktywnych', d.vehicles_active??'—','','--green')}
  ${_kpiCard('ti-tool','W serwisie', d.vehicles_in_service??'—','','--orange')}
  ${_kpiCard('ti-alert-triangle','Przeterminowanych', d.overdue_inspections??'—','przeglądów','--red')}
  ${_kpiCard('ti-shield-x','Wygasłe OC/AC', d.overdue_insurance??'—','','--red')}
</div>

<!-- KPI Row 2 — Koszty -->
<div style="margin-bottom:8px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);letter-spacing:.5px">Koszty</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
  ${_kpiCard('ti-gas-station','Paliwo', d.fuel_cost!=null?`${fmtN(d.fuel_cost,0)} PLN`:'—','')}
  ${_kpiCard('ti-tool','Serwis', d.service_cost!=null?`${fmtN(d.service_cost,0)} PLN`:'—','')}
  ${_kpiCard('ti-shield','Ubezpieczenia', d.insurance_cost!=null?`${fmtN(d.insurance_cost,0)} PLN`:'—','')}
  ${_kpiCard('ti-receipt','Faktury', d.invoices_total!=null?`${fmtN(d.invoices_total,0)} PLN`:'—','brutto','--blue')}
  ${_kpiCard('ti-trending-up','Marża', d.margin_pct!=null?`${fmtN(d.margin_pct,1)}%`:'—','','--green')}
</div>

<!-- KPI Row 3 — Kierowcy / Tachograf -->
<div style="margin-bottom:8px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);letter-spacing:.5px">Kierowcy</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
  ${_kpiCard('ti-users','Kierowców', d.drivers_count??'—','')}
  ${_kpiCard('ti-steering-wheel','Naruszeń tachografu', d.tacho_violations??'—','','--red')}
  ${_kpiCard('ti-star','Śr. wynik eco', d.avg_eco_score!=null?`${fmtN(d.avg_eco_score,1)}/100`:'—','',d.avg_eco_score>=70?'--green':d.avg_eco_score>=50?'--orange':'--red')}
  ${_kpiCard('ti-clock','Nadgodziny', d.overtime_hours!=null?`${fmtN(d.overtime_hours,1)} h`:'—','')}
  ${_kpiCard('ti-id-badge','CPC do odnowy', d.cpc_expiring??'—','≤90 dni','--orange')}
</div>

<!-- KPI Row 4 — Pojazdy EV / GPS -->
<div style="margin-bottom:8px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);letter-spacing:.5px">EV & Lokalizacja</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px">
  ${_kpiCard('ti-bolt','Ładowania EV', d.ev_sessions??'—','sesji')}
  ${_kpiCard('ti-bolt','Energia EV', d.ev_kwh!=null?`${fmtN(d.ev_kwh,0)} kWh`:'—','')}
  ${_kpiCard('ti-map-pin','Naruszenia stref', d.geofence_alerts??'—','geofencing','--orange')}
  ${_kpiCard('ti-truck','Zlecenia', d.transport_orders??'—','')}
  ${_kpiCard('ti-truck','Ukończone', d.orders_completed??'—','','--green')}
</div>

<!-- Top 5 Pojazdów wg kosztów -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px">
  ${_topVehicles(d.top_vehicles_cost)}
  ${_topDrivers(d.top_violations)}
  ${_costBreakdown(d)}
</div>`;
  }

  function _kpiCard(icon, label, value, sublabel, colorVar) {
    const col = colorVar ? `color:var(${colorVar})` : '';
    const brd = colorVar ? `border-color:var(${colorVar})` : '';
    return `<div class="kpi-chip" style="${brd}">
      <i class="ti ${icon}" style="${col}"></i>
      <span class="kpi-val" style="${col}">${value}</span>
      <span class="kpi-lbl">${label}${sublabel?`<br><small style="opacity:.7">${e(sublabel)}</small>`:''}</span>
    </div>`;
  }

  function _topVehicles(list) {
    if (!list?.length) return `<div style="background:var(--bg2);border-radius:12px;padding:20px">
      <h3 style="font-size:14px;margin:0 0 12px"><i class="ti ti-car"></i> Top 5 pojazdów — koszty</h3>
      <div style="text-align:center;color:var(--text3);padding:24px">Brak danych</div>
    </div>`;
    const max = Math.max(...list.map(x=>x.total_cost||0)) || 1;
    return `<div style="background:var(--bg2);border-radius:12px;padding:20px">
      <h3 style="font-size:14px;margin:0 0 12px"><i class="ti ti-car"></i> Top 5 pojazdów — koszty (PLN)</h3>
      ${list.slice(0,5).map((v,i) => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span>${i+1}. <strong>${e(v.vehicle_reg||v.nr_rej||'—')}</strong></span>
          <span style="font-weight:600">${fmtN(v.total_cost,0)} PLN</span>
        </div>
        <div style="height:6px;background:var(--border);border-radius:3px">
          <div style="height:6px;border-radius:3px;background:var(--blue);width:${Math.round((v.total_cost||0)/max*100)}%"></div>
        </div>
      </div>`).join('')}
    </div>`;
  }

  function _topDrivers(list) {
    if (!list?.length) return `<div style="background:var(--bg2);border-radius:12px;padding:20px">
      <h3 style="font-size:14px;margin:0 0 12px"><i class="ti ti-steering-wheel"></i> Top naruszenia — kierowcy</h3>
      <div style="text-align:center;color:var(--text3);padding:24px">Brak danych</div>
    </div>`;
    return `<div style="background:var(--bg2);border-radius:12px;padding:20px">
      <h3 style="font-size:14px;margin:0 0 12px"><i class="ti ti-steering-wheel"></i> Top naruszenia — kierowcy</h3>
      <div class="table-wrap"><table class="data-table" style="font-size:12px">
        <thead><tr><th>#</th><th>Kierowca</th><th>Naruszeń</th></tr></thead>
        <tbody>${list.slice(0,5).map((d,i) => `<tr>
          <td>${i+1}</td>
          <td>${e(d.driver_name||'—')}</td>
          <td><span class="pill danger">${d.violations}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }

  function _costBreakdown(d) {
    const fuel = d.fuel_cost ?? 0;
    const serv = d.service_cost ?? 0;
    const ins  = d.insurance_cost ?? 0;
    const total = fuel + serv + ins || 1;
    const bar = (val, color, label) => {
      const pct = Math.round(val / total * 100);
      return pct > 0 ? `<div title="${label}: ${fmtN(val,0)} PLN (${pct}%)" style="height:100%;width:${pct}%;background:${color};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;overflow:hidden">${pct>8?`${pct}%`:''}</div>` : '';
    };
    return `<div style="background:var(--bg2);border-radius:12px;padding:20px">
      <h3 style="font-size:14px;margin:0 0 12px"><i class="ti ti-chart-pie"></i> Struktura kosztów</h3>
      <div style="height:32px;display:flex;border-radius:6px;overflow:hidden;margin-bottom:12px">
        ${bar(fuel,'#2563eb','Paliwo')}${bar(serv,'#16a34a','Serwis')}${bar(ins,'#d97706','Ubezpieczenia')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px">
        <span><span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:2px;margin-right:4px"></span>Paliwo: ${fmtN(fuel,0)} PLN</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#16a34a;border-radius:2px;margin-right:4px"></span>Serwis: ${fmtN(serv,0)} PLN</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#d97706;border-radius:2px;margin-right:4px"></span>Ubezpieczenia: ${fmtN(ins,0)} PLN</span>
      </div>
      ${(!fuel&&!serv&&!ins)?'<div style="text-align:center;color:var(--text3);padding:16px">Brak danych kosztowych</div>':''}
    </div>`;
  }

  function _setPeriod(p) { _period = p; renderFleetKpi(); }

  window.FleetKpi = { renderFleetKpi, _setPeriod };
})();
