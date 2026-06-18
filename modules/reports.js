/**
 * TaxOrder Pro — Raporty Flotowe
 * Koszty miesięczne / roczne, plan serwisowy, CO2, eksport Excel
 */
window.FleetReports = (function () {

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _fmt2(n) { return n != null ? (+n).toFixed(2) : ''; }
  function _fmt0(n) { return n != null ? Math.round(+n).toLocaleString('pl-PL') : ''; }

  function _fuelCostForPeriod(v, prefix) {
    return (v.fuelHistory || [])
      .filter(h => prefix ? (h.date||'').startsWith(prefix) : true)
      .reduce((s, h) => s + (h.totalGross||0), 0);
  }

  function _serviceCostForPeriod(v, prefix) {
    return (v.serviceHistory || [])
      .filter(h => prefix ? (h.date||'').startsWith(prefix) : true)
      .reduce((s, h) => s + (h.cost||0), 0);
  }

  function _insuranceCostForPeriod(v, prefix) {
    let cost = 0;
    const yr = prefix ? prefix.slice(0,4) : null;
    if (!yr) return 0;
    const fields = ['ocPremium','acPremium'];
    fields.forEach(f => { if (v[f] && v.ocStart?.startsWith(yr)) cost += +v[f]; });
    return cost;
  }

  // ── renderPage — buduje zawartość page-raporty-fleet ─────────────────────
  function renderPage() {
    const el = document.getElementById('fleet-reports-body');
    if (!el) return;

    const now = new Date();
    const curYr = now.getFullYear();
    const curMo = now.toISOString().slice(0,7);

    el.innerHTML = `
      <!-- Selektor okresu -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <div class="f" style="margin:0">
          <label style="font-size:11px;color:var(--text3)">Rok</label>
          <select id="fr-year" class="fi" style="margin:0;width:100px" onchange="FleetReports.renderPage()">
            ${[curYr, curYr-1, curYr-2].map(y => `<option value="${y}" ${y===curYr?'selected':''}>${y}</option>`).join('')}
          </select>
        </div>
        <div class="f" style="margin:0">
          <label style="font-size:11px;color:var(--text3)">Miesiąc (opcjonalnie)</label>
          <select id="fr-month" class="fi" style="margin:0;width:140px" onchange="FleetReports.renderPage()">
            <option value="">— cały rok —</option>
            ${['01','02','03','04','05','06','07','08','09','10','11','12'].map((m,i) =>
              `<option value="${m}" ${curMo.endsWith(m)?'selected':''}>${i+1} — ${['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'][i]}</option>`
            ).join('')}
          </select>
        </div>
        <button class="btn btn-green" style="margin-left:auto" onclick="FleetReports.exportExcel()">
          <i class="ti ti-download"></i>Eksportuj Excel
        </button>
        <button class="btn btn-gray" onclick="FleetReports.exportCsv()">
          <i class="ti ti-file-text"></i>CSV
        </button>
      </div>

      <!-- Tabela kosztów per pojazd -->
      <div id="fr-table"></div>`;

    _renderCostTable();
  }

  function _getPrefix() {
    const yr  = document.getElementById('fr-year')?.value || new Date().getFullYear();
    const mo  = document.getElementById('fr-month')?.value || '';
    return mo ? `${yr}-${mo}` : String(yr);
  }

  function _buildRows() {
    const prefix = _getPrefix();
    const rows = [];
    (window.vehs || []).forEach(v => {
      const fuel    = _fuelCostForPeriod(v, prefix);
      const service = _serviceCostForPeriod(v, prefix);
      const insur   = _insuranceCostForPeriod(v, prefix);
      const total   = fuel + service + insur;
      const fuelL   = (v.fuelHistory||[]).filter(h=>prefix?(h.date||'').startsWith(prefix):true).reduce((s,h)=>s+(h.liters||0),0);
      const co2     = (v.fuelHistory||[]).filter(h=>prefix?(h.date||'').startsWith(prefix):true).reduce((s,h)=>{
        const c = h.co2kg != null ? h.co2kg : (h.liters||0)*(window.FuelImport?.KOBIZE_FACTORS?.[h.product]||0);
        return s+c;
      },0);
      if (total > 0 || fuel > 0 || service > 0) {
        rows.push({ v, fuel, service, insur, total, fuelL, co2 });
      }
    });
    return rows.sort((a,b) => b.total - a.total);
  }

  function _renderCostTable() {
    const el = document.getElementById('fr-table');
    if (!el) return;
    const rows = _buildRows();
    const prefix = _getPrefix();

    const totFuel    = rows.reduce((s,r)=>s+r.fuel,0);
    const totService = rows.reduce((s,r)=>s+r.service,0);
    const totInsur   = rows.reduce((s,r)=>s+r.insur,0);
    const totTotal   = rows.reduce((s,r)=>s+r.total,0);
    const totL       = rows.reduce((s,r)=>s+r.fuelL,0);
    const totCO2     = rows.reduce((s,r)=>s+r.co2,0);

    el.innerHTML = `
      <!-- KPI Bar -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px">
        ${[
          ['Łączne koszty',totTotal,'zł','var(--blue)'],
          ['Paliwo',totFuel,'zł','var(--amber)'],
          ['Serwis',totService,'zł','var(--red)'],
          ['Ubezpieczenia',totInsur,'zł','var(--green)'],
          ['Litry paliwa',totL,'l','var(--text2)'],
          ['Emisja CO₂',(totCO2/1000).toFixed(2),'t CO₂','var(--green)'],
        ].map(([lbl,val,unit,clr])=>`
          <div style="padding:12px;background:var(--bg3);border-radius:var(--radius);text-align:center">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${lbl}</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:${clr}">${typeof val==='number'?val.toFixed(val%1?2:0).replace(/\B(?=(\d{3})+(?!\d))/g,' '):val}</div>
            <div style="font-size:11px;color:var(--text2)">${unit}</div>
          </div>`).join('')}
      </div>

      ${rows.length ? `
      <div class="tbl-wrap"><table style="width:100%">
        <thead><tr>
          <th>Nr rej.</th><th>Marka / Model</th><th>Rok</th>
          <th style="text-align:right">Paliwo (zł)</th>
          <th style="text-align:right">Litry</th>
          <th style="text-align:right">CO₂ (kg)</th>
          <th style="text-align:right">Serwis (zł)</th>
          <th style="text-align:right">Ubezp. (zł)</th>
          <th style="text-align:right;font-weight:700">ŁĄCZNIE (zł)</th>
        </tr></thead>
        <tbody>
          ${rows.map(r=>`
            <tr style="cursor:pointer" onclick="TaxOrderVehicleDetail.open(${r.v.id})">
              <td style="font-family:var(--mono);font-weight:700">${r.v.nrRej}</td>
              <td>${r.v.marka} ${r.v.model}</td>
              <td style="font-family:var(--mono)">${r.v.rok||'—'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.fuel?_fmt2(r.fuel):'-'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.fuelL?r.fuelL.toFixed(1):'-'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.co2?r.co2.toFixed(0):'-'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.service?_fmt2(r.service):'-'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.insur?_fmt2(r.insur):'-'}</td>
              <td style="text-align:right;font-family:var(--mono);font-weight:700">${_fmt2(r.total)}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--bg3);font-weight:700">
            <td colspan="3">ŁĄCZNIE (${rows.length} pojazdów)</td>
            <td style="text-align:right;font-family:var(--mono)">${_fmt2(totFuel)}</td>
            <td style="text-align:right;font-family:var(--mono)">${totL.toFixed(1)}</td>
            <td style="text-align:right;font-family:var(--mono)">${totCO2.toFixed(0)}</td>
            <td style="text-align:right;font-family:var(--mono)">${_fmt2(totService)}</td>
            <td style="text-align:right;font-family:var(--mono)">${_fmt2(totInsur)}</td>
            <td style="text-align:right;font-family:var(--mono)">${_fmt2(totTotal)}</td>
          </tr>
        </tfoot>
      </table></div>` : `<div style="text-align:center;padding:40px;color:var(--text3)">Brak danych kosztowych za wybrany okres.<br>Zaimportuj tankowania i dodaj serwisy w kartach pojazdów.</div>`}`;
  }

  // ── Eksport Excel ─────────────────────────────────────────────────────────
  function exportExcel() {
    if (typeof XLSX === 'undefined') { toast('⚠ Biblioteka XLSX niedostępna'); return; }
    const rows = _buildRows();
    const prefix = _getPrefix();
    const yr  = document.getElementById('fr-year')?.value || new Date().getFullYear();
    const mo  = document.getElementById('fr-month')?.value || '';

    // Sheet 1: Koszty per pojazd
    const headers = ['Nr rej.','Marka','Model','Rok','Paliwo (zł)','Litry (l)','CO2 (kg)','Serwis (zł)','Ubezpieczenia (zł)','Łącznie (zł)'];
    const data = [headers, ...rows.map(r => [
      r.v.nrRej, r.v.marka, r.v.model, r.v.rok||'',
      _fmt2(r.fuel), _fmt2(r.fuelL), _fmt2(r.co2),
      _fmt2(r.service), _fmt2(r.insur), _fmt2(r.total),
    ])];

    // Sheet 2: Serwisy
    const sHeaders = ['Nr rej.','Marka','Model','Data','Typ','Opis','Km','Koszt brutto','Warsztat','Faktura'];
    const sData = [sHeaders];
    (window.vehs||[]).forEach(v => {
      (v.serviceHistory||[]).filter(s => prefix ? (s.date||'').startsWith(prefix) : true).forEach(s => {
        sData.push([v.nrRej,v.marka,v.model,s.date,s.type,s.description||'',s.km||'',s.cost||'',s.workshop||'',s.invoiceNo||'']);
      });
    });

    // Sheet 3: Tankowania
    const fHeaders = ['Nr rej.','Marka','Data','Paliwo','Litry','Cena/l','Kwota brutto','Stacja'];
    const fData = [fHeaders];
    (window.vehs||[]).forEach(v => {
      (v.fuelHistory||[]).filter(h => prefix ? (h.date||'').startsWith(prefix) : true).forEach(h => {
        fData.push([v.nrRej,v.marka,h.date,h.product,h.liters||'',h.pricePerL||'',h.totalGross||'',h.station||'']);
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Koszty');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sData), 'Serwisy');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fData), 'Tankowania');

    const fname = `raport_flota_${yr}${mo?'_'+mo:''}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast(`✓ Eksportowano: ${fname}`);
  }

  function exportCsv() {
    const rows = _buildRows();
    const yr  = document.getElementById('fr-year')?.value || new Date().getFullYear();
    const mo  = document.getElementById('fr-month')?.value || '';
    const headers = ['Nr rej.','Marka','Model','Rok','Paliwo (zł)','Litry','CO2 (kg)','Serwis (zł)','Ubezpieczenia (zł)','Łącznie (zł)'];
    const csv = '﻿' + [headers, ...rows.map(r => [
      r.v.nrRej, r.v.marka, r.v.model, r.v.rok||'',
      _fmt2(r.fuel), r.fuelL.toFixed(2), r.co2.toFixed(3),
      _fmt2(r.service), _fmt2(r.insur), _fmt2(r.total),
    ])].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download=`raport_flota_${yr}${mo?'_'+mo:''}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast('✓ CSV wyeksportowany');
  }

  // ── Raport planowanych serwisów ───────────────────────────────────────────
  function renderServicePlan(containerId) {
    const el = document.getElementById(containerId||'fr-service-plan');
    if (!el) return;
    const upcoming = window.ServiceModule?.getUpcomingServices(180) || [];
    if (!upcoming.length) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3)">Brak zaplanowanych serwisów w ciągu 6 miesięcy.</div>`;
      return;
    }
    const headers = ['Nr rej.','Pojazd','Typ serwisu','Termin','Km','Dni'];
    const rows = upcoming.map(({v,s,days})=>[
      v.nrRej, `${v.marka} ${v.model}`,
      window.ServiceModule?.SERVICE_TYPES[s.type]?.label || s.type,
      s.nextServiceDate||'', s.nextServiceKm||'', days,
    ]);
    el.innerHTML = `
      <div class="tbl-wrap"><table style="width:100%;font-size:12px">
        <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td style="${i===5&&+c<0?'color:var(--red);font-weight:700':''};${i===0?'font-family:var(--mono);font-weight:700':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <div style="margin-top:10px;text-align:right">
        <button class="btn btn-green" onclick="FleetReports.exportServicePlanExcel()"><i class="ti ti-download"></i>Eksport Excel</button>
      </div>`;
  }

  function exportServicePlanExcel() {
    if (typeof XLSX === 'undefined') { toast('⚠ Biblioteka XLSX niedostępna'); return; }
    const upcoming = window.ServiceModule?.getUpcomingServices(180) || [];
    const headers = ['Nr rej.','Marka','Model','Typ serwisu','Termin','Km do serwisu','Dni pozostało','Warsztat'];
    const data = [headers, ...upcoming.map(({v,s,days})=>[
      v.nrRej, v.marka, v.model,
      window.ServiceModule?.SERVICE_TYPES[s.type]?.label || s.type,
      s.nextServiceDate||'', s.nextServiceKm||'', days, s.workshop||'',
    ])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Plan serwisowy');
    XLSX.writeFile(wb, `plan_serwisowy_${new Date().toISOString().slice(0,7)}.xlsx`);
    toast('✓ Plan serwisowy wyeksportowany');
  }

  return { renderPage, exportExcel, exportCsv, renderServicePlan, exportServicePlanExcel };
})();
