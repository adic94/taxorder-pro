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

  // ── KOBIZE CO₂ ────────────────────────────────────────────────────────────
  const KOBIZE_FACTORS = { ON:2.679, PB:2.302, PB95:2.302, PB98:2.302, LPG:1.626, CNG:1.963, LNG:2.196, HEV:2.302, EV:0, H2:0 };

  function renderKobize(containerId) {
    const el = document.getElementById(containerId || 'fr-kobize-body');
    if (!el) return;
    const yr = document.getElementById('fr-kobize-year')?.value || new Date().getFullYear();
    const prefix = String(yr);

    const rows = (window.vehs || []).map(v => {
      let liters = 0, co2 = 0;
      const fuelBreakdown = {};
      (v.fuelHistory || []).filter(h => (h.date||'').startsWith(prefix)).forEach(h => {
        const l = h.liters || 0;
        const product = h.product || h.fuelType || 'ON';
        liters += l;
        const factor = KOBIZE_FACTORS[product] ?? KOBIZE_FACTORS['ON'];
        const kg = h.co2kg != null ? +h.co2kg : l * factor;
        co2 += kg;
        fuelBreakdown[product] = (fuelBreakdown[product]||0) + l;
      });
      return { v, liters, co2, fuelBreakdown };
    }).filter(r => r.liters > 0).sort((a,b) => b.co2 - a.co2);

    if (!rows.length) {
      el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3)">Brak danych paliwowych za ${yr}. Zaimportuj tankowania przez <strong>Import tankowań</strong>.</div>`;
      return;
    }

    const totL   = rows.reduce((s,r) => s+r.liters, 0);
    const totCo2 = rows.reduce((s,r) => s+r.co2, 0);
    const fmt1   = n => (+n).toFixed(1);
    const fmt3   = n => (+n).toFixed(3);

    el.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <div class="stat-chip"><span>${rows.length}</span> pojazdów</div>
        <div class="stat-chip"><span>${fmt1(totL)} l</span> łącznie paliwa</div>
        <div class="stat-chip" style="color:var(--red)"><span>${fmt1(totCo2)} kg</span> CO₂ łącznie</div>
        <div class="stat-chip"><span>${fmt1(totCo2/1000)} t</span> CO₂ (tony)</div>
        <button class="btn btn-green" style="font-size:11px;margin-left:auto" onclick="FleetReports.exportKobizeCsv()">
          <i class="ti ti-download"></i>CSV KOBIZE
        </button>
        <button class="btn btn-gray" style="font-size:11px" onclick="FleetReports.exportKobizeExcel()">
          <i class="ti ti-download"></i>Excel KOBIZE
        </button>
      </div>
      <div class="tbl-wrap">
        <table style="width:100%;font-size:11px">
          <thead><tr>
            <th>Nr rej.</th><th>Marka / Model</th><th>Typ paliwa</th>
            <th style="text-align:right">Litry (l)</th>
            <th style="text-align:right">CO₂ (kg)</th>
            <th style="text-align:right">CO₂ (t)</th>
            <th style="min-width:80px">Udział</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => {
              const fuels = Object.entries(r.fuelBreakdown).map(([k,v2]) => `${k}: ${fmt1(v2)}l`).join(', ');
              const pct   = (r.co2 / totCo2 * 100).toFixed(1);
              return `<tr>
                <td style="font-weight:700;font-family:var(--mono)">${r.v.nrRej}</td>
                <td>${r.v.marka} ${r.v.model}</td>
                <td style="font-size:10px;color:var(--text2)">${fuels}</td>
                <td style="text-align:right;font-family:var(--mono)">${fmt1(r.liters)}</td>
                <td style="text-align:right;font-family:var(--mono);color:var(--red)">${fmt1(r.co2)}</td>
                <td style="text-align:right;font-family:var(--mono)">${fmt3(r.co2/1000)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:4px">
                    <div style="flex:1;height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
                      <div style="width:${pct}%;height:100%;background:var(--red);opacity:.7;border-radius:4px"></div>
                    </div>
                    <span style="font-size:10px;color:var(--text3);white-space:nowrap">${pct}%</span>
                  </div>
                </td>
              </tr>`;
            }).join('')}
            <tr style="border-top:2px solid var(--border);font-weight:700">
              <td colspan="3" style="padding:6px 8px">ŁĄCZNIE</td>
              <td style="text-align:right;font-family:var(--mono)">${fmt1(totL)}</td>
              <td style="text-align:right;font-family:var(--mono);color:var(--red)">${fmt1(totCo2)}</td>
              <td style="text-align:right;font-family:var(--mono)">${fmt3(totCo2/1000)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  function exportKobizeCsv() {
    const yr = document.getElementById('fr-kobize-year')?.value || new Date().getFullYear();
    const prefix = String(yr);
    const rows = (window.vehs||[]).map(v => {
      let liters = 0, co2 = 0;
      (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(prefix)).forEach(h => {
        liters += h.liters||0;
        const factor = KOBIZE_FACTORS[h.product||'ON'] ?? 2.679;
        co2 += h.co2kg != null ? +h.co2kg : (h.liters||0)*factor;
      });
      return { v, liters, co2 };
    }).filter(r=>r.liters>0);

    const headers = ['Nr rej.','Marka','Model','Rok','Paliwo (l)','CO2 (kg)','CO2 (t)'];
    const csv = '﻿' + [headers, ...rows.map(r=>[
      r.v.nrRej,r.v.marka,r.v.model,r.v.rok||'',
      r.liters.toFixed(1),r.co2.toFixed(3),(r.co2/1000).toFixed(6),
    ])].map(row=>row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`kobize_co2_${yr}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast(t('rep.toast.kobize.csv').replace('{0}', rows.length).replace('{1}', yr));
  }

  function exportKobizeExcel() {
    if (typeof XLSX === 'undefined') { toast(t('rep.toast.xlsx.na')); return; }
    const yr = document.getElementById('fr-kobize-year')?.value || new Date().getFullYear();
    const prefix = String(yr);
    const rows = (window.vehs||[]).map(v => {
      let liters = 0, co2 = 0;
      (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(prefix)).forEach(h => {
        liters += h.liters||0;
        const factor = KOBIZE_FACTORS[h.product||'ON'] ?? 2.679;
        co2 += h.co2kg != null ? +h.co2kg : (h.liters||0)*factor;
      });
      return { v, liters, co2 };
    }).filter(r=>r.liters>0);

    const headers = ['Nr rej.','Marka','Model','Rok prod.','Litry paliwa (l)','Emisja CO2 (kg)','Emisja CO2 (t)'];
    const data = [headers, ...rows.map(r=>[
      r.v.nrRej, r.v.marka, r.v.model, r.v.rok||'',
      +r.liters.toFixed(1), +r.co2.toFixed(3), +(r.co2/1000).toFixed(6),
    ])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), `KOBIZE CO2 ${yr}`);
    XLSX.writeFile(wb, `kobize_co2_${yr}.xlsx`);
    toast(t('rep.toast.kobize.xls').replace('{0}', rows.length));
  }

  // ── TCO per pojazd ────────────────────────────────────────────────────────
  function renderTco(containerId) {
    const el = document.getElementById(containerId || 'fr-tco-body');
    if (!el) return;
    const yr   = document.getElementById('fr-tco-year')?.value || new Date().getFullYear();
    const pfx  = String(yr);
    const fmt  = n => (+n||0).toLocaleString('pl-PL', { minimumFractionDigits:0, maximumFractionDigits:0 });
    const fmt2 = n => (+n||0).toFixed(2).replace('.', ',');

    // Mandaty per nr_rej dla danego roku
    const allFines = window.TaxOrderFines?.getAllSync?.() || [];
    const finesByNr = {};
    allFines.filter(f => (f.date||'').startsWith(pfx)).forEach(f => {
      finesByNr[f.nr_rej] = (finesByNr[f.nr_rej]||0) + (f.amount||0);
    });

    const rows = (window.vehs||[]).map(v => {
      const fuel  = (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(pfx)).reduce((s,h)=>s+(h.totalGross||0),0);
      const svc   = (v.serviceHistory||[]).filter(h=>(h.date||'').startsWith(pfx)).reduce((s,h)=>s+(h.cost||0),0);
      const ins   = (v.ocPremium&&(v.ocStart||'').startsWith(pfx)?+v.ocPremium:0)+(v.acPremium&&(v.acStart||'').startsWith(pfx)?+v.acPremium:0);
      const leasing = (v.leasingRate && (v.leasingStart||'') <= pfx+'-12' && (v.leasingEnd||'') >= pfx+'-01')
        ? (+v.leasingRate * 12) : 0;
      const tax   = (typeof calcTax === 'function') ? (calcTax(v).amount||0) : 0;
      const fines = finesByNr[v.nrRej] || finesByNr[v.nr_rej] || 0;
      const total = fuel + svc + ins + leasing + tax + fines;
      return { v, fuel, svc, ins, leasing, tax, fines, total };
    }).filter(r => r.total > 0).sort((a,b) => b.total - a.total);

    if (!rows.length) { el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3)">Brak danych kosztowych za ${yr}.</div>`; return; }

    const totFuel    = rows.reduce((s,r)=>s+r.fuel,0);
    const totSvc     = rows.reduce((s,r)=>s+r.svc,0);
    const totIns     = rows.reduce((s,r)=>s+r.ins,0);
    const totLeasing = rows.reduce((s,r)=>s+r.leasing,0);
    const totTax     = rows.reduce((s,r)=>s+r.tax,0);
    const totFines   = rows.reduce((s,r)=>s+r.fines,0);
    const totAll     = rows.reduce((s,r)=>s+r.total,0);
    const maxTotal   = Math.max(...rows.map(r=>r.total),1);

    const bar = (val, tot) => {
      const w = tot ? (val/tot*100).toFixed(1) : 0;
      return `<div style="display:inline-block;width:${w}%;height:8px;background:currentColor;border-radius:2px;opacity:.7;vertical-align:middle"></div>`;
    };

    el.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <div class="stat-chip"><span>${rows.length}</span> pojazdów</div>
        <div class="stat-chip"><span>${fmt(totAll)} zł</span> łączny TCO</div>
        <div class="stat-chip"><span>${fmt(totAll/rows.length)} zł</span> avg/pojazd</div>
        <button class="btn btn-green" style="font-size:11px;margin-left:auto" onclick="FleetReports.exportTcoExcel()">
          <i class="ti ti-download"></i>Excel TCO
        </button>
      </div>
      <div class="tbl-wrap">
        <table style="width:100%;font-size:11px">
          <thead><tr>
            <th>Nr rej.</th><th>Marka/Model</th>
            <th style="text-align:right;color:var(--orange)">Paliwo</th>
            <th style="text-align:right;color:var(--red)">Serwis</th>
            <th style="text-align:right;color:var(--green)">Ubezp.</th>
            <th style="text-align:right;color:var(--blue)">Leasing</th>
            <th style="text-align:right;color:var(--text2)">Podatek</th>
            <th style="text-align:right;color:#dc2626">Mandaty</th>
            <th style="text-align:right;font-weight:700">TCO ŁĄCZNIE</th>
            <th style="min-width:100px">Struktura</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => {
              const w = (r.total/maxTotal*100).toFixed(1);
              return `<tr>
                <td style="font-weight:700;font-family:var(--mono)">${r.v.nrRej}</td>
                <td style="font-size:11px">${r.v.marka} ${r.v.model} <span style="color:var(--text3)">${r.v.rok||''}</span></td>
                <td style="text-align:right;font-family:var(--mono);color:var(--orange)">${r.fuel?fmt(r.fuel):'—'}</td>
                <td style="text-align:right;font-family:var(--mono);color:var(--red)">${r.svc?fmt(r.svc):'—'}</td>
                <td style="text-align:right;font-family:var(--mono);color:var(--green)">${r.ins?fmt(r.ins):'—'}</td>
                <td style="text-align:right;font-family:var(--mono);color:var(--blue)">${r.leasing?fmt(r.leasing):'—'}</td>
                <td style="text-align:right;font-family:var(--mono);color:var(--text2)">${r.tax?fmt(r.tax):'—'}</td>
                <td style="text-align:right;font-family:var(--mono);color:#dc2626">${r.fines?fmt(r.fines):'—'}</td>
                <td style="text-align:right;font-family:var(--mono);font-weight:700">${fmt(r.total)} zł</td>
                <td>
                  <div style="height:10px;background:var(--bg2);border-radius:4px;overflow:hidden">
                    <div style="width:${w}%;height:100%;background:var(--blue);border-radius:4px"></div>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot style="border-top:2px solid var(--border)">
            <tr style="font-weight:700">
              <td colspan="2" style="padding:6px 8px">ŁĄCZNIE</td>
              <td style="text-align:right;font-family:var(--mono);color:var(--orange)">${fmt(totFuel)}</td>
              <td style="text-align:right;font-family:var(--mono);color:var(--red)">${fmt(totSvc)}</td>
              <td style="text-align:right;font-family:var(--mono);color:var(--green)">${fmt(totIns)}</td>
              <td style="text-align:right;font-family:var(--mono);color:var(--blue)">${fmt(totLeasing)}</td>
              <td style="text-align:right;font-family:var(--mono)">${fmt(totTax)}</td>
              <td style="text-align:right;font-family:var(--mono);color:#dc2626">${fmt(totFines)}</td>
              <td style="text-align:right;font-family:var(--mono)">${fmt(totAll)} zł</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  function exportTcoExcel() {
    if (typeof XLSX === 'undefined') { toast(t('rep.toast.xlsx.na')); return; }
    const yr = document.getElementById('fr-tco-year')?.value || new Date().getFullYear();
    const pfx = String(yr);
    const rows = (window.vehs||[]).map(v => {
      const fuel  = (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(pfx)).reduce((s,h)=>s+(h.totalGross||0),0);
      const svc   = (v.serviceHistory||[]).filter(h=>(h.date||'').startsWith(pfx)).reduce((s,h)=>s+(h.cost||0),0);
      const ins   = (v.ocPremium&&(v.ocStart||'').startsWith(pfx)?+v.ocPremium:0)+(v.acPremium&&(v.acStart||'').startsWith(pfx)?+v.acPremium:0);
      const leasing = (v.leasingRate&&(v.leasingStart||'')<=pfx+'-12'&&(v.leasingEnd||'')>=pfx+'-01')?(+v.leasingRate*12):0;
      const tax   = (typeof calcTax==='function')?(calcTax(v).amount||0):0;
      const allFinesX = window.TaxOrderFines?.getAllSync?.() || [];
      const finesX = allFinesX.filter(f=>(f.date||'').startsWith(pfx)&&(f.nr_rej===v.nrRej||f.nr_rej===v.nr_rej)).reduce((s,f)=>s+(f.amount||0),0);
      const total = fuel+svc+ins+leasing+tax+finesX;
      return [v.nrRej,v.marka,v.model,v.rok||'',+fuel.toFixed(2),+svc.toFixed(2),+ins.toFixed(2),+leasing.toFixed(2),+tax.toFixed(2),+finesX.toFixed(2),+total.toFixed(2)];
    }).filter(r=>r[10]>0).sort((a,b)=>b[10]-a[10]);
    const headers = ['Nr rej.','Marka','Model','Rok','Paliwo (zł)','Serwis (zł)','Ubezp. (zł)','Leasing (zł)','Podatek (zł)','Mandaty (zł)','TCO (zł)'];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...rows]), `TCO ${yr}`);
    XLSX.writeFile(wb, `tco_flota_${yr}.xlsx`);
    toast(t('rep.toast.tco.xls').replace('{0}', rows.length).replace('{1}', yr));
  }

  // ── Raport polis ubezpieczeniowych ────────────────────────────────────────
  function renderInsuranceReport(containerId) {
    const el = document.getElementById(containerId || 'fr-insurance-body');
    if (!el) return;
    const now   = new Date();
    const fd    = d => d ? new Date(d).toLocaleDateString('pl-PL') : '—';
    const days  = d => d ? Math.round((new Date(d)-now)/86400000) : null;
    const pill  = d => {
      const n = days(d);
      if (n == null) return '<span style="color:var(--text3)">—</span>';
      if (n < 0)   return `<span class="pill pill-red" title="${Math.abs(n)} dni po terminie">WYGASŁA</span>`;
      if (n <= 30) return `<span class="pill pill-red" title="Za ${n} dni">${fd(d)}</span>`;
      if (n <= 60) return `<span class="pill pill-amber" title="Za ${n} dni">${fd(d)}</span>`;
      return `<span style="font-size:11px;color:var(--text2)">${fd(d)}</span>`;
    };
    const fmt  = n => n ? (+n).toLocaleString('pl-PL', {minimumFractionDigits:2,maximumFractionDigits:2})+' zł' : '—';

    // Zbierz wszystkie polisy (OC + AC + Ass)
    const policies = [];
    (window.vehs||[]).forEach(v => {
      if (v.ocInsurer || v.ocEnd) policies.push({ nrRej:v.nrRej, marka:v.marka, model:v.model, type:'OC', insurer:v.ocInsurer, policyNo:v.ocPolicyNo, start:v.ocStart, end:v.ocEnd, premium:v.ocPremium, endDate:v.ocEnd });
      if (v.acInsurer || v.acEnd) policies.push({ nrRej:v.nrRej, marka:v.marka, model:v.model, type:'AC', insurer:v.acInsurer, policyNo:v.acPolicyNo, start:v.acStart, end:v.acEnd, premium:v.acPremium, endDate:v.acEnd });
      if (v.assInsurer || v.assEnd) policies.push({ nrRej:v.nrRej, marka:v.marka, model:v.model, type:'Ass', insurer:v.assInsurer, policyNo:v.assPolicyNo, start:null, end:v.assEnd, premium:null, endDate:v.assEnd });
    });
    policies.sort((a,b) => {
      const da = a.endDate ? new Date(a.endDate) : new Date('2099-01-01');
      const db = b.endDate ? new Date(b.endDate) : new Date('2099-01-01');
      return da - db;
    });

    const expiring30  = policies.filter(p => { const n=days(p.endDate); return n!=null&&n>=0&&n<=30; }).length;
    const expiring60  = policies.filter(p => { const n=days(p.endDate); return n!=null&&n>30&&n<=60; }).length;
    const expired     = policies.filter(p => { const n=days(p.endDate); return n!=null&&n<0; }).length;
    const totalPrem   = policies.reduce((s,p)=>s+(+p.premium||0),0);

    el.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <div class="stat-chip"><span>${policies.length}</span> polis łącznie</div>
        ${expired?`<div class="stat-chip" style="color:var(--red)"><span>${expired}</span> wygasłe</div>`:''}
        ${expiring30?`<div class="stat-chip" style="color:var(--red)"><span>${expiring30}</span> do 30 dni</div>`:''}
        ${expiring60?`<div class="stat-chip" style="color:var(--amber)"><span>${expiring60}</span> do 60 dni</div>`:''}
        <div class="stat-chip"><span>${totalPrem.toLocaleString('pl-PL',{maximumFractionDigits:0})} zł</span> składki łącznie</div>
        <button class="btn btn-green" style="font-size:11px;margin-left:auto" onclick="FleetReports.exportInsuranceExcel()">
          <i class="ti ti-download"></i>Excel polisy
        </button>
      </div>
      <div class="tbl-wrap">
        <table style="width:100%;font-size:11px">
          <thead><tr>
            <th>Nr rej.</th><th>Pojazd</th><th style="text-align:center">Typ</th>
            <th>Ubezpieczyciel</th><th>Nr polisy</th>
            <th>Koniec</th><th style="text-align:right">Składka</th>
          </tr></thead>
          <tbody>
            ${policies.map(p => {
              const n = days(p.endDate);
              const rowBg = n!=null&&n<0?'background:#fef2f2' : n!=null&&n<=30?'background:#fff7ed' : '';
              const typeColor = p.type==='OC'?'var(--green)':p.type==='AC'?'var(--blue)':'var(--text2)';
              return `<tr style="${rowBg}">
                <td style="font-weight:700;font-family:var(--mono)">${p.nrRej}</td>
                <td style="font-size:11px;color:var(--text2)">${p.marka} ${p.model}</td>
                <td style="text-align:center"><span style="font-size:10px;font-weight:700;color:${typeColor};background:var(--bg3);border-radius:4px;padding:1px 6px">${p.type}</span></td>
                <td style="font-weight:${p.insurer?500:400}">${p.insurer||'<span style="color:var(--text3)">—</span>'}</td>
                <td style="font-family:var(--mono);font-size:10px;color:var(--text2)">${p.policyNo||'—'}</td>
                <td>${pill(p.endDate)}</td>
                <td style="text-align:right;font-family:var(--mono)">${fmt(p.premium)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${(() => {
        const withOC = new Set(policies.filter(p=>p.type==='OC').map(p=>p.nrRej));
        const noOC = (window.vehs||[]).filter(v => v.is_active!==false && !withOC.has(v.nrRej));
        if (!noOC.length) return '';
        return `<div style="margin-top:16px;padding:12px 14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:var(--radius)">
          <div style="font-weight:700;color:var(--red);font-size:12px;margin-bottom:8px">
            <i class="ti ti-alert-triangle"></i> ${noOC.length} pojazd${noOC.length>1?'ów':''} bez polisy OC:
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${noOC.map(v=>`<span style="font-family:var(--mono);font-size:11px;background:#fff;border:1px solid #fca5a5;border-radius:4px;padding:2px 8px;font-weight:600">${v.nrRej}</span>`).join('')}
          </div>
        </div>`;
      })()}`;
  }

  function exportInsuranceExcel() {
    if (typeof XLSX === 'undefined') { toast(t('rep.toast.xlsx.na')); return; }
    const now = new Date();
    const fd  = d => d ? new Date(d).toLocaleDateString('pl-PL') : '';
    const policies = [];
    (window.vehs||[]).forEach(v => {
      if (v.ocEnd||v.ocInsurer) policies.push([v.nrRej,v.marka,v.model,'OC',v.ocInsurer||'',v.ocPolicyNo||'',fd(v.ocStart),fd(v.ocEnd),+(v.ocPremium||0)]);
      if (v.acEnd||v.acInsurer) policies.push([v.nrRej,v.marka,v.model,'AC',v.acInsurer||'',v.acPolicyNo||'',fd(v.acStart),fd(v.acEnd),+(v.acPremium||0)]);
      if (v.assEnd||v.assInsurer) policies.push([v.nrRej,v.marka,v.model,'Ass',v.assInsurer||'',v.assPolicyNo||'','',fd(v.assEnd),0]);
    });
    policies.sort((a,b)=>new Date(a[7]||'2099')-new Date(b[7]||'2099'));
    const headers = ['Nr rej.','Marka','Model','Typ polisy','Ubezpieczyciel','Nr polisy','Początek','Koniec','Składka (zł)'];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...policies]), 'Polisy ubezpieczeniowe');
    XLSX.writeFile(wb, `polisy_ubezpieczen_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast(t('rep.toast.policies.xls').replace('{0}', policies.length));
  }

  // ── Raport zarządu — Executive Summary HTML export ───────────────────────
  function exportExecutiveSummary() {
    const now = new Date();
    const yr = now.getFullYear();
    const prefix = String(yr);
    const vehs = window.vehs || [];
    const today = now.toISOString().slice(0, 10);

    // KPIs
    let totalFuel = 0, totalSvc = 0, totalTax = 0, dt1Count = 0;
    const tcoRows = vehs.map(v => {
      const fuel = _fuelCostForPeriod(v, prefix);
      const svc  = _serviceCostForPeriod(v, prefix);
      const ins  = _insuranceCostForPeriod(v, prefix);
      const leasing = (v.leasingHistory||[]).filter(h=>(h.date||'').startsWith(prefix)).reduce((s,h)=>s+(h.amount||0),0);
      let tax = 0;
      if (typeof calcTax === 'function') { const r = calcTax(v); tax = r.amount || 0; }
      const total = fuel + svc + ins + leasing + tax;
      totalFuel += fuel; totalSvc += svc; totalTax += tax;
      return { nrRej: v.nrRej, marka: v.marka, model: v.model, fuel, svc, ins, leasing, tax, total };
    }).sort((a,b)=>b.total-a.total);

    // DT-1 tax vehicles
    if (typeof calcTax === 'function') vehs.forEach(v => { const r = calcTax(v); if (r.cat) dt1Count++; });

    const totalCost = totalFuel + totalSvc;

    // Alerty polisowe 30 dni
    const soon30 = [];
    vehs.forEach(v => {
      ['oc','ac','ass'].forEach(t => {
        const end = v[t+'End'];
        if (!end) return;
        const days = Math.round((new Date(end) - now) / 86400000);
        if (days >= 0 && days <= 30) soon30.push({ nrRej: v.nrRej, type: t.toUpperCase(), end, days });
      });
    });
    soon30.sort((a,b)=>a.days-b.days);

    // Top 5 by TCO
    const top5 = tcoRows.slice(0, 5);

    const fmt = n => Math.round(n).toLocaleString('pl-PL');

    const renewalRows = soon30.map(r => `
      <tr>
        <td>${r.nrRej}</td><td>${r.type}</td>
        <td style="color:${r.days<=7?'#e53e3e':'#dd6b20'};font-weight:600">${r.days} dni</td>
        <td>${r.end}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="color:#48bb78;text-align:center">Brak wymagających odnowienia</td></tr>';

    const top5Rows = top5.map((r,i) => `
      <tr>
        <td>${i+1}. ${r.nrRej}</td>
        <td>${r.marka} ${r.model}</td>
        <td style="text-align:right">${fmt(r.fuel)}</td>
        <td style="text-align:right">${fmt(r.svc)}</td>
        <td style="text-align:right;font-weight:700">${fmt(r.total)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Raport zarządu — ${yr}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1a202c;background:#fff;padding:32px}
  h1{font-size:22px;font-weight:700;margin-bottom:4px}
  .sub{color:#718096;font-size:11px;margin-bottom:28px}
  .kpi-row{display:flex;gap:16px;margin-bottom:28px}
  .kpi{flex:1;background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px}
  .kpi-val{font-size:22px;font-weight:700;color:#2b6cb0}
  .kpi-lbl{font-size:11px;color:#718096;margin-top:2px}
  h2{font-size:14px;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;color:#2d3748}
  table{width:100%;border-collapse:collapse;margin-bottom:28px}
  th{background:#edf2f7;text-align:left;padding:7px 10px;font-size:11px;font-weight:700;text-transform:uppercase;color:#4a5568}
  td{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px}
  tr:last-child td{border-bottom:none}
  .footer{margin-top:32px;font-size:10px;color:#a0aec0;text-align:right}
  @media print{body{padding:16px}}
</style>
</head>
<body>
<h1>Raport zarządu floty</h1>
<div class="sub">Wygenerowano: ${new Date().toLocaleString('pl-PL')} &nbsp;|&nbsp; Rok: ${yr} &nbsp;|&nbsp; Flota: ${vehs.length} pojazdów</div>

<div class="kpi-row">
  <div class="kpi"><div class="kpi-val">${vehs.length}</div><div class="kpi-lbl">Pojazdów w flocie</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(totalFuel)} zł</div><div class="kpi-lbl">Koszt paliwa YTD</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(totalSvc)} zł</div><div class="kpi-lbl">Koszt serwisu YTD</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(totalCost)} zł</div><div class="kpi-lbl">Łączne koszty YTD</div></div>
  <div class="kpi"><div class="kpi-val">${dt1Count}</div><div class="kpi-lbl">Pojazdy płacą DT-1</div></div>
  <div class="kpi"><div class="kpi-val">${fmt(totalTax)} zł</div><div class="kpi-lbl">Podatek DT-1</div></div>
</div>

<h2>Top 5 pojazdów wg. TCO (${yr})</h2>
<table>
  <tr><th>Nr rej.</th><th>Pojazd</th><th style="text-align:right">Paliwo (zł)</th><th style="text-align:right">Serwis (zł)</th><th style="text-align:right">TCO (zł)</th></tr>
  ${top5Rows}
</table>

<h2>Polisy ubezpieczeniowe — wygasają w ciągu 30 dni</h2>
<table>
  <tr><th>Nr rej.</th><th>Typ</th><th>Zostało</th><th>Data końca</th></tr>
  ${renewalRows}
</table>

<div class="footer">TaxOrder Pro &nbsp;|&nbsp; Raport wygenerowany automatycznie &nbsp;|&nbsp; ${today}</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `raport_zarzadu_${yr}_${today}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(t('rep.toast.mgmt.ok'));
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

      <!-- Budżet flotowy -->
      <div id="fr-budget"></div>
      <!-- Tabela kosztów per pojazd -->
      <div id="fr-table"></div>
      <div id="fr-monthly-trend"></div>
      <div id="fr-driver-score"></div>`;

    _renderBudget();
    _renderCostTable();
    _renderMonthlyTrend();
    _renderDriverScore();
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
      // l/100km z kolejnych tankowań z licznikiem km (wszystkie dane, nie tylko wybrany okres)
      const withKm = [...(v.fuelHistory||[])].filter(h=>h.km!=null&&h.km>0&&h.liters>0).sort((a,b)=>a.km-b.km);
      let _el=0,_ek=0,_en=0;
      for(let i=1;i<withKm.length;i++){const kd=withKm[i].km-withKm[i-1].km;if(kd>10&&kd<5000){_el+=withKm[i].liters;_ek+=kd;_en++;}}
      const avgEff = (_en>=2&&_ek>0) ? (_el/_ek*100) : null;
      // km przejechane w wybranym okresie (z danych licznika przy tankowaniach)
      const periodKm = (v.fuelHistory||[]).filter(h=>prefix?(h.date||'').startsWith(prefix):true).filter(h=>h.km!=null&&h.km>0).sort((a,b)=>a.km-b.km);
      const kmDriven = periodKm.length >= 2 ? periodKm[periodKm.length-1].km - periodKm[0].km : null;
      const costPerKm = kmDriven && kmDriven > 10 ? (fuel + service) / kmDriven : null;
      if (total > 0 || fuel > 0 || service > 0) {
        rows.push({ v, fuel, service, insur, total, fuelL, co2, avgEff, kmDriven, costPerKm });
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
          <th style="text-align:right">l/100km</th>
          <th style="text-align:right">CO₂ (kg)</th>
          <th style="text-align:right">Serwis (zł)</th>
          <th style="text-align:right">Ubezp. (zł)</th>
          <th style="text-align:right" title="Koszt paliwa+serwis na km (z danych licznika przy tankowaniach)">zł/km</th>
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
              <td style="text-align:right;font-family:var(--mono);color:${r.avgEff!=null?(r.v.normaSpalania&&r.avgEff>r.v.normaSpalania*1.15?'var(--red)':'var(--blue)'):'var(--text3)'}">${r.avgEff!=null?r.avgEff.toFixed(1):'-'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.co2?r.co2.toFixed(0):'-'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.service?_fmt2(r.service):'-'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.insur?_fmt2(r.insur):'-'}</td>
              <td style="text-align:right;font-family:var(--mono);color:${r.costPerKm!=null?'var(--blue)':'var(--text3)'}" title="${r.kmDriven?r.kmDriven.toLocaleString('pl-PL')+' km w okresie':''}">${r.costPerKm!=null?r.costPerKm.toFixed(2):'-'}</td>
              <td style="text-align:right;font-family:var(--mono);font-weight:700">${_fmt2(r.total)}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--bg3);font-weight:700">
            <td colspan="3">ŁĄCZNIE (${rows.length} pojazdów)</td>
            <td style="text-align:right;font-family:var(--mono)">${_fmt2(totFuel)}</td>
            <td style="text-align:right;font-family:var(--mono)">${totL.toFixed(1)}</td>
            <td style="text-align:right;font-family:var(--mono);color:var(--text3)">—</td>
            <td style="text-align:right;font-family:var(--mono)">${totCO2.toFixed(0)}</td>
            <td style="text-align:right;font-family:var(--mono)">${_fmt2(totService)}</td>
            <td style="text-align:right;font-family:var(--mono)">${_fmt2(totInsur)}</td>
            <td style="text-align:right;font-family:var(--mono);color:var(--text3)">—</td>
            <td style="text-align:right;font-family:var(--mono)">${_fmt2(totTotal)}</td>
          </tr>
        </tfoot>
      </table></div>` : `<div style="text-align:center;padding:40px;color:var(--text3)">Brak danych kosztowych za wybrany okres.<br>Zaimportuj tankowania i dodaj serwisy w kartach pojazdów.</div>`}`;
  }

  // ── Eksport Excel ─────────────────────────────────────────────────────────
  function exportExcel() {
    if (typeof XLSX === 'undefined') { toast(t('rep.toast.xlsx.na')); return; }
    const rows = _buildRows();
    const prefix = _getPrefix();
    const yr  = document.getElementById('fr-year')?.value || new Date().getFullYear();
    const mo  = document.getElementById('fr-month')?.value || '';

    // Sheet 1: Koszty per pojazd
    const headers = ['Nr rej.','Marka','Model','Rok','Paliwo (zł)','Litry (l)','l/100km','CO2 (kg)','Serwis (zł)','Ubezpieczenia (zł)','zł/km','Łącznie (zł)'];
    const data = [headers, ...rows.map(r => [
      r.v.nrRej, r.v.marka, r.v.model, r.v.rok||'',
      _fmt2(r.fuel), _fmt2(r.fuelL), r.avgEff!=null?r.avgEff.toFixed(1):'',
      _fmt2(r.co2), _fmt2(r.service), _fmt2(r.insur),
      r.costPerKm!=null?r.costPerKm.toFixed(2):'', _fmt2(r.total),
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
    toast(t('rep.toast.export.ok').replace('{0}', fname));
  }

  function exportCsv() {
    const rows = _buildRows();
    const yr  = document.getElementById('fr-year')?.value || new Date().getFullYear();
    const mo  = document.getElementById('fr-month')?.value || '';
    const headers = ['Nr rej.','Marka','Model','Rok','Paliwo (zł)','Litry','l/100km','CO2 (kg)','Serwis (zł)','Ubezpieczenia (zł)','zł/km','Łącznie (zł)'];
    const csv = '﻿' + [headers, ...rows.map(r => [
      r.v.nrRej, r.v.marka, r.v.model, r.v.rok||'',
      _fmt2(r.fuel), r.fuelL.toFixed(2), r.avgEff!=null?r.avgEff.toFixed(1):'',
      r.co2.toFixed(3), _fmt2(r.service), _fmt2(r.insur),
      r.costPerKm!=null?r.costPerKm.toFixed(2):'', _fmt2(r.total),
    ])].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download=`raport_flota_${yr}${mo?'_'+mo:''}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast(t('rep.toast.csv.ok'));
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

  // ── Serwisy km-based (maintenanceItems) ──────────────────────────────────
  function _buildMaintenanceKm() {
    const rows = [];
    for (const v of (window.vehs || [])) {
      const curKm = v.stanKilometrow != null ? Number(v.stanKilometrow) : null;
      for (const item of (v.maintenanceItems || [])) {
        const kmLeft = item.nextKm != null && curKm != null ? Number(item.nextKm) - curKm : null;
        rows.push({ v, item, curKm, kmLeft });
      }
    }
    return rows.sort((a, b) => {
      const pa = a.kmLeft == null ? Infinity : a.kmLeft;
      const pb = b.kmLeft == null ? Infinity : b.kmLeft;
      return pa - pb;
    });
  }

  function renderMaintenanceKm(containerId) {
    const el = document.getElementById(containerId || 'fr-maintenance-km');
    if (!el) return;
    const rows = _buildMaintenanceKm();
    if (!rows.length) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3)">Brak pozycji serwisowych wg licznika. Dodaj je w Karcie pojazdu → Koszty → Harmonogram serwisów.</div>`;
      return;
    }
    const _badge = kmLeft => {
      if (kmLeft == null) return `<span style="color:var(--text3)">—</span>`;
      if (kmLeft <= 0)    return `<span style="background:#fee2e2;color:#991b1b;font-weight:700;padding:2px 8px;border-radius:99px">Przekroczono o ${Math.abs(kmLeft).toLocaleString('pl-PL')} km</span>`;
      if (kmLeft <= 500)  return `<span style="background:#fee2e2;color:#dc2626;font-weight:700;padding:2px 8px;border-radius:99px">${kmLeft.toLocaleString('pl-PL')} km</span>`;
      if (kmLeft <= 2000) return `<span style="background:#fef3c7;color:#92400e;font-weight:700;padding:2px 8px;border-radius:99px">${kmLeft.toLocaleString('pl-PL')} km</span>`;
      return `<span style="color:var(--text2)">${kmLeft.toLocaleString('pl-PL')} km</span>`;
    };
    el.innerHTML = `
      <div class="tbl-wrap"><table style="width:100%;font-size:12px">
        <thead><tr>
          <th>Nr rej</th><th>Pojazd</th><th>Serwis</th>
          <th style="text-align:right">Teraz [km]</th><th style="text-align:right">Cel [km]</th><th>Pozostało</th>
          <th>Następna data</th><th></th>
        </tr></thead>
        <tbody>${rows.map(({ v, item, curKm, kmLeft }) => `<tr>
          <td style="font-family:var(--mono);font-weight:700">${v.nrRej || '—'}</td>
          <td style="color:var(--text2)">${v.marka || ''} ${v.model || ''}</td>
          <td>${item.label || 'Serwis'}</td>
          <td style="text-align:right;font-family:var(--mono)">${curKm != null ? curKm.toLocaleString('pl-PL') : '—'}</td>
          <td style="text-align:right;font-family:var(--mono)">${item.nextKm != null ? Number(item.nextKm).toLocaleString('pl-PL') : '—'}</td>
          <td>${_badge(kmLeft)}</td>
          <td style="color:var(--text2);font-size:11px">${item.nextDate || '—'}</td>
          <td><button class="tbtn" onclick="showPage('pojazdy');setTimeout(()=>{TaxOrderVehicleDetail.open(${v.id});setTimeout(()=>TaxOrderVehicleDetail?._tab('koszty'),400)},200)" title="Otwórz kartę pojazdu"><i class="ti ti-external-link"></i></button></td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }

  function exportMaintenanceKmExcel() {
    if (typeof XLSX === 'undefined') { window.toast?.('Brak biblioteki XLSX'); return; }
    const rows = _buildMaintenanceKm();
    const headers = ['Nr rej', 'Marka', 'Model', 'Serwis', 'Stan km', 'Cel km', 'Pozostało km', 'Następna data'];
    const data = [headers, ...rows.map(({ v, item, curKm, kmLeft }) => [
      v.nrRej || '', v.marka || '', v.model || '', item.label || 'Serwis',
      curKm ?? '', item.nextKm ?? '', kmLeft ?? '', item.nextDate || '',
    ])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Serwisy km');
    XLSX.writeFile(wb, `serwisy_km_${new Date().toISOString().slice(0, 10)}.xlsx`);
    window.toast?.('✓ Wyeksportowano serwisy km');
  }

  function exportServicePlanExcel() {
    if (typeof XLSX === 'undefined') { toast(t('rep.toast.xlsx.na')); return; }
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
    toast(t('rep.toast.svc.ok'));
  }

  function _renderMonthlyTrend() {
    const el = document.getElementById('fr-monthly-trend');
    if (!el) return;
    const mo = document.getElementById('fr-month')?.value || '';
    if (mo) { el.innerHTML = ''; return; } // only show for full-year view
    const yr = document.getElementById('fr-year')?.value || new Date().getFullYear();
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const LABEL = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
    const mData = months.map((m, i) => {
      const prefix = `${yr}-${m}`;
      let fuel = 0, service = 0;
      (window.vehs||[]).forEach(v => {
        fuel    += _fuelCostForPeriod(v, prefix);
        service += _serviceCostForPeriod(v, prefix);
      });
      return { label: LABEL[i], fuel, service, total: fuel + service };
    });
    const maxTotal = Math.max(...mData.map(d=>d.total), 1);
    const fmt = n => n.toLocaleString('pl-PL', {minimumFractionDigits:0,maximumFractionDigits:0});
    el.innerHTML = `
      <h3 style="font-size:13px;font-weight:700;margin:20px 0 10px;color:var(--text)">Trend miesięczny ${yr}</h3>
      <div class="tbl-wrap">
        <table style="width:100%;font-size:11px">
          <thead><tr>
            <th style="width:60px">Miesiąc</th>
            <th style="width:120px;text-align:right">Paliwo (zł)</th>
            <th style="width:120px;text-align:right">Serwis (zł)</th>
            <th style="width:120px;text-align:right">Łącznie (zł)</th>
            <th>Struktura</th>
          </tr></thead>
          <tbody>
            ${mData.map(d => {
              const fPct = maxTotal ? d.fuel / maxTotal * 100 : 0;
              const sPct = maxTotal ? d.service / maxTotal * 100 : 0;
              const empty = !d.total;
              return `<tr style="${empty?'color:var(--text3)':''}">
                <td style="font-weight:600;padding:4px 8px">${d.label}</td>
                <td style="text-align:right;padding:4px 8px;color:var(--orange)">${d.fuel ? fmt(d.fuel) : '—'}</td>
                <td style="text-align:right;padding:4px 8px;color:var(--red)">${d.service ? fmt(d.service) : '—'}</td>
                <td style="text-align:right;padding:4px 8px;font-weight:${empty?400:700}">${d.total ? fmt(d.total) : '—'}</td>
                <td style="padding:4px 8px">
                  <div style="display:flex;height:14px;border-radius:3px;overflow:hidden;background:var(--bg2);min-width:60px">
                    ${fPct ? `<div style="width:${fPct}%;background:var(--orange);opacity:.8"></div>` : ''}
                    ${sPct ? `<div style="width:${sPct}%;background:var(--red);opacity:.7"></div>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  const _BUDGET_KEY = 'taxFleetBudget';

  function _getBudget(yr) {
    try {
      const all = JSON.parse(localStorage.getItem(_BUDGET_KEY) || '{}');
      return all[yr] || { fuel: 0, service: 0, insurance: 0 };
    } catch { return { fuel: 0, service: 0, insurance: 0 }; }
  }

  function _saveBudget(yr, b) {
    try {
      const all = JSON.parse(localStorage.getItem(_BUDGET_KEY) || '{}');
      all[yr] = b;
      localStorage.setItem(_BUDGET_KEY, JSON.stringify(all));
    } catch(e) {}
  }

  function saveBudgetInputs() {
    const yr = document.getElementById('fr-year')?.value || new Date().getFullYear();
    const mo = document.getElementById('fr-month')?.value || '';
    if (mo) return; // budżet tylko dla pełnego roku
    const g = id => parseFloat(document.getElementById(id)?.value || 0) || 0;
    _saveBudget(yr, { fuel: g('fb-fuel'), service: g('fb-service'), insurance: g('fb-insurance') });
    _renderBudget();
    toast(t('rep.toast.budget.ok'));
  }

  function _renderBudget() {
    const el = document.getElementById('fr-budget');
    if (!el) return;
    const mo = document.getElementById('fr-month')?.value || '';
    if (mo) { el.innerHTML = ''; return; } // tylko rok
    const yr = document.getElementById('fr-year')?.value || new Date().getFullYear();
    const rows = _buildRows();
    const budget = _getBudget(yr);

    const actFuel  = rows.reduce((s,r) => s + r.fuel, 0);
    const actSvc   = rows.reduce((s,r) => s + r.service, 0);
    const actInsur = rows.reduce((s,r) => s + r.insur, 0);
    const actTotal = actFuel + actSvc + actInsur;
    const budTotal = budget.fuel + budget.service + budget.insurance;

    const fmtZ = n => (+n||0).toLocaleString('pl-PL', { minimumFractionDigits:0, maximumFractionDigits:0 });
    const diffColor = (b, a) => !b ? '' : a > b ? 'color:var(--red);font-weight:700' : 'color:var(--green);font-weight:700';
    const pct = (b, a) => !b ? '—' : ((a/b)*100).toFixed(0) + '%';
    const bar = (b, a) => {
      if (!b) return '<div style="height:8px;background:var(--bg2);border-radius:4px"></div>';
      const w = Math.min(a/b*100, 100).toFixed(1);
      const over = a > b;
      return `<div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
        <div style="width:${w}%;height:100%;background:${over?'var(--red)':'var(--green)'};border-radius:4px;transition:width .4s"></div>
      </div>`;
    };

    const cats = [
      { key:'fuel',      label:'Paliwo',        icon:'ti-gas-station', act:actFuel,  bud:budget.fuel,      id:'fb-fuel' },
      { key:'service',   label:'Serwis',         icon:'ti-tool',        act:actSvc,   bud:budget.service,   id:'fb-service' },
      { key:'insurance', label:'Ubezpieczenia',  icon:'ti-shield',      act:actInsur, bud:budget.insurance, id:'fb-insurance' },
    ];

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <h3 style="font-size:13px;font-weight:700;color:var(--text);margin:0">
          <i class="ti ti-wallet" style="margin-right:6px;color:var(--green)"></i>Budżet flotowy ${yr} — plan vs wykonanie
        </h3>
        <button class="btn btn-blue" style="font-size:11px;padding:3px 10px;margin-left:auto" onclick="FleetReports.saveBudgetInputs()">
          <i class="ti ti-check"></i>Zapisz budżet
        </button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">
        ${cats.map(c => `
          <div style="background:var(--bg2);border-radius:var(--radius);padding:14px;border:1px solid var(--border)">
            <div style="font-size:11px;font-weight:600;color:var(--text2);display:flex;align-items:center;gap:6px;margin-bottom:10px">
              <i class="ti ${c.icon}"></i>${c.label}
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <label style="font-size:10px;color:var(--text3);white-space:nowrap">Budżet (zł):</label>
              <input id="${c.id}" type="number" class="fi" style="margin:0;height:28px;font-size:12px;width:100%" value="${c.bud||''}" placeholder="0" min="0" step="1000">
            </div>
            <div style="font-size:11px;margin-bottom:6px">
              <span style="color:var(--text2)">Wykonanie:</span>
              <strong style="margin-left:4px">${fmtZ(c.act)} zł</strong>
              ${c.bud ? `<span style="font-size:10px;margin-left:6px;${diffColor(c.bud,c.act)}">${c.act>c.bud?'▲ + ':'▼ − '}${fmtZ(Math.abs(c.act-c.bud))} zł (${pct(c.bud,c.act)})</span>` : ''}
            </div>
            ${bar(c.bud, c.act)}
          </div>`).join('')}
      </div>
      ${budTotal ? `
        <div style="background:var(--bg3);border-radius:var(--radius);padding:10px 14px;font-size:12px;display:flex;gap:24px;align-items:center;flex-wrap:wrap">
          <span><strong>Łącznie budżet:</strong> ${fmtZ(budTotal)} zł</span>
          <span><strong>Łącznie wykonanie:</strong> ${fmtZ(actTotal)} zł</span>
          <span style="${diffColor(budTotal,actTotal)}">${actTotal > budTotal ? '▲ Przekroczono o' : '▼ Oszczędność'} ${fmtZ(Math.abs(actTotal-budTotal))} zł (${pct(budTotal,actTotal)})</span>
          <div style="flex:1;min-width:120px">${bar(budTotal, actTotal)}</div>
        </div>` : '<div style="font-size:11px;color:var(--text3);padding:4px 0">Wpisz wartości budżetu i kliknij <strong>Zapisz budżet</strong> aby śledzić wykonanie.</div>'}`;
  }

  function _renderDriverScore() {
    const el = document.getElementById('fr-driver-score');
    if (!el) return;
    const prefix = _getPrefix();

    // Zbierz dane per kierowca ze wszystkich pojazdów
    const drivers = {};

    (window.vehs || []).forEach(v => {
      // Tankowania — l/100km i koszty paliwa per kierowca
      (v.fuelHistory || []).filter(h => prefix ? (h.date||'').startsWith(prefix) : true).forEach(h => {
        const drv = h.driver || v.kierowca || '(brak)';
        if (!drivers[drv]) drivers[drv] = { fuelCost:0, fuelL:0, svcCost:0, fines:0, withKm:[], vehs:new Set() };
        drivers[drv].fuelCost += h.total || (h.liters||0) * (h.pricePerLiter||0);
        drivers[drv].fuelL   += h.liters || 0;
        drivers[drv].vehs.add(v.nrRej);
        if (h.km && h.km > 0) drivers[drv].withKm.push({ km: h.km, liters: h.liters || 0 });
      });

      // Koszty serwisowe (pojazd przypisany do kierowcy)
      const vDrv = v.kierowca || '(brak)';
      if (vDrv !== '(brak)') {
        if (!drivers[vDrv]) drivers[vDrv] = { fuelCost:0, fuelL:0, svcCost:0, fines:0, withKm:[], vehs:new Set() };
        drivers[vDrv].svcCost += _serviceCostForPeriod(v, prefix);
        drivers[vDrv].vehs.add(v.nrRej);
      }

      });

    // Mandaty — z centralnej listy FinesModule (sync cache)
    const allFines = window.FinesModule?.getAllSync?.() || [];
    allFines.filter(f => prefix ? (f.date||'').startsWith(prefix) : true).forEach(f => {
      const fDrv = f.driver_name || '(brak)';
      if (!drivers[fDrv]) drivers[fDrv] = { fuelCost:0, fuelL:0, svcCost:0, fines:0, withKm:[], vehs:new Set() };
      drivers[fDrv].fines += (f.amount || 0);
      if (f.nr_rej) drivers[fDrv].vehs.add(f.nr_rej);
    });

    const rows = Object.entries(drivers)
      .filter(([, d]) => d.fuelCost > 0 || d.svcCost > 0 || d.fines > 0)
      .map(([name, d]) => {
        // l/100km z kolejnych wpisów z km licznika (posortuj)
        const wk = [...d.withKm].sort((a,b) => a.km - b.km);
        let el2 = 0, ek = 0, en = 0;
        for (let i = 1; i < wk.length; i++) {
          const kd = wk[i].km - wk[i-1].km;
          if (kd > 10 && kd < 5000) { el2 += wk[i].liters; ek += kd; en++; }
        }
        const avgL100 = (en >= 2 && ek > 0) ? (el2 / ek * 100) : null;
        const total = d.fuelCost + d.svcCost + d.fines;
        return { name, ...d, avgL100, total, vehCount: d.vehs.size };
      })
      .sort((a, b) => b.total - a.total);

    if (!rows.length) { el.innerHTML = ''; return; }

    const fmt = n => (+n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const maxTotal = Math.max(...rows.map(r => r.total), 1);

    el.innerHTML = `
      <h3 style="font-size:13px;font-weight:700;margin:24px 0 10px;color:var(--text)">
        <i class="ti ti-steering-wheel" style="margin-right:6px;color:var(--blue)"></i>Ranking kierowców — koszty
      </h3>
      <div class="tbl-wrap">
        <table style="width:100%;font-size:11px">
          <thead><tr>
            <th style="width:28px">#</th>
            <th>Kierowca</th>
            <th style="text-align:right">Paliwo (zł)</th>
            <th style="text-align:right">Litry (l)</th>
            <th style="text-align:right">l/100km</th>
            <th style="text-align:right">Serwis (zł)</th>
            <th style="text-align:right">Mandaty (zł)</th>
            <th style="text-align:right">Łącznie (zł)</th>
            <th style="min-width:80px">Udział</th>
            <th style="text-align:center">Pojazdy</th>
          </tr></thead>
          <tbody>
            ${rows.map((r, i) => {
              const barW = (r.total / maxTotal * 100).toFixed(1);
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
              const l100Color = r.avgL100 == null ? '' :
                r.avgL100 > 20 ? 'color:var(--red);font-weight:700' :
                r.avgL100 > 12 ? 'color:var(--amber)' : 'color:var(--green)';
              return `<tr>
                <td style="font-weight:700;font-size:13px;padding:4px 8px">${medal}</td>
                <td style="padding:4px 8px;font-weight:600">${esc(r.name)}</td>
                <td style="text-align:right;padding:4px 8px;font-family:var(--mono)">${r.fuelCost ? fmt(r.fuelCost) : '—'}</td>
                <td style="text-align:right;padding:4px 8px;font-family:var(--mono)">${r.fuelL ? r.fuelL.toFixed(1) : '—'}</td>
                <td style="text-align:right;padding:4px 8px;font-family:var(--mono);${l100Color}">${r.avgL100 != null ? r.avgL100.toFixed(1) : '—'}</td>
                <td style="text-align:right;padding:4px 8px;font-family:var(--mono);color:var(--red)">${r.svcCost ? fmt(r.svcCost) : '—'}</td>
                <td style="text-align:right;padding:4px 8px;font-family:var(--mono);color:var(--red);font-weight:${r.fines>0?700:400}">${r.fines ? fmt(r.fines) : '—'}</td>
                <td style="text-align:right;padding:4px 8px;font-family:var(--mono);font-weight:700">${fmt(r.total)}</td>
                <td style="padding:4px 8px">
                  <div style="height:10px;background:var(--bg2);border-radius:4px;overflow:hidden">
                    <div style="width:${barW}%;height:100%;background:var(--blue);border-radius:4px"></div>
                  </div>
                </td>
                <td style="text-align:center;padding:4px 8px;font-size:10px;color:var(--text2)">${[...r.vehs].join(', ')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function exportServicePlanHtml() {
    const rows = _buildServicePlanRows();
    const today = new Date().toISOString().slice(0,10);
    const fd = d => d ? new Date(d).toLocaleDateString('pl-PL') : '—';
    const urgencyBadge = d => {
      if (!d) return '';
      const diff = Math.round((new Date(d) - new Date()) / 86400000);
      const color = diff < 0 ? '#dc2626' : diff <= 7 ? '#dc2626' : diff <= 14 ? '#d97706' : '#16a34a';
      const label = diff < 0 ? `${Math.abs(diff)} dni po terminie` : diff === 0 ? 'dziś' : `${diff} dni`;
      return `<span style="background:${color};color:#fff;border-radius:9px;font-size:9px;font-weight:700;padding:1px 7px">${label}</span>`;
    };
    const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Plan serwisowy — ${today}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;font-size:12px;color:#1f2937;padding:20px}
h1{font-size:20px;font-weight:800;margin-bottom:4px}
.sub{color:#6b7280;font-size:11px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#f3f4f6;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;padding:6px 10px;text-align:left;border-bottom:2px solid #e5e7eb}
td{padding:5px 10px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
tr:hover td{background:#f9fafb}
.mono{font-family:monospace}
@media print{button{display:none}}
</style></head>
<body>
<button onclick="window.print()" style="float:right;background:#1d4ed8;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px">🖨 Drukuj</button>
<h1>Plan serwisowy floty</h1>
<div class="sub">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} | TaxOrder Pro | ${rows.length} serwisów</div>
<table>
  <thead><tr>
    <th>Nr rej.</th><th>Marka / Model</th><th>Typ serwisu</th>
    <th>Data serwisu</th><th>Następny termin</th><th>Km</th>
    <th>Status</th><th>Warsztat</th>
  </tr></thead>
  <tbody>
    ${rows.map(r => {
      const diff = r.nextServiceDate ? Math.round((new Date(r.nextServiceDate) - new Date()) / 86400000) : null;
      const bg   = diff == null ? '' : diff < 0 ? '#fef2f2' : diff <= 7 ? '#fff7ed' : '';
      return `<tr style="background:${bg}">
        <td class="mono" style="font-weight:700">${r.nrRej}</td>
        <td>${r.marka} ${r.model}</td>
        <td>${r.svcLabel}</td>
        <td class="mono">${fd(r.lastDate)}</td>
        <td class="mono">${fd(r.nextServiceDate)} ${urgencyBadge(r.nextServiceDate)}</td>
        <td class="mono">${r.nextServiceKm ? r.nextServiceKm.toLocaleString('pl-PL')+' km' : '—'}</td>
        <td class="mono" style="color:${diff!=null&&diff<0?'#dc2626':'#6b7280'}">${diff!=null ? (diff<0?`${Math.abs(diff)} dni po`:`${diff} dni`) : '—'}</td>
        <td>${r.workshop||'—'}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>
</body></html>`;
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`plan_serwisowy_${today}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast(t('rep.toast.html.ok'));
  }

  function _buildServicePlanRows() {
    const today = new Date();
    const rows = [];
    (window.vehs||[]).forEach(v => {
      (v.serviceHistory||[]).forEach(s => {
        if (!s.nextServiceDate && !s.nextServiceKm) return;
        const svcLabel = window.ServiceModule?.SERVICE_TYPES?.[s.type]?.label || s.type || 'Serwis';
        const diff = s.nextServiceDate ? Math.round((new Date(s.nextServiceDate) - today) / 86400000) : null;
        rows.push({ nrRej:v.nrRej, marka:v.marka, model:v.model, svcLabel, lastDate:s.date, nextServiceDate:s.nextServiceDate, nextServiceKm:s.nextServiceKm, workshop:s.workshop, diff });
      });
    });
    return rows.sort((a,b) => {
      if (a.nextServiceDate && b.nextServiceDate) return new Date(a.nextServiceDate) - new Date(b.nextServiceDate);
      if (a.nextServiceDate) return -1;
      if (b.nextServiceDate) return 1;
      return 0;
    });
  }

  // Generuje tekstowe podsumowanie raportu i otwiera klienta poczty (mailto:)
  function emailExecutiveSummary() {
    const now = new Date();
    const yr  = now.getFullYear();
    const prefix = String(yr);
    const vehs = window.vehs || [];
    const today = now.toLocaleDateString('pl-PL');

    let totalFuel = 0, totalSvc = 0, totalTax = 0, dt1Count = 0;
    const tcoRows = vehs.map(v => {
      const fuel = _fuelCostForPeriod(v, prefix);
      const svc  = _serviceCostForPeriod(v, prefix);
      let tax = 0;
      if (typeof calcTax === 'function') { const r = calcTax(v); tax = r.amount || 0; }
      totalFuel += fuel; totalSvc += svc; totalTax += tax;
      return { nrRej: v.nrRej, marka: v.marka, model: v.model, fuel, svc, total: fuel + svc + tax };
    }).sort((a,b) => b.total - a.total);

    if (typeof calcTax === 'function') vehs.forEach(v => { const r = calcTax(v); if (r.cat) dt1Count++; });

    const fmt = n => Math.round(n).toLocaleString('pl-PL');

    // Polisy wygasające ≤30 dni
    const soon30 = [];
    vehs.forEach(v => {
      ['oc','ac','ass'].forEach(t => {
        const end = v[t+'End'];
        if (!end) return;
        const days = Math.round((new Date(end) - now) / 86400000);
        if (days >= 0 && days <= 30) soon30.push({ nrRej: v.nrRej, type: t.toUpperCase(), days });
      });
    });
    soon30.sort((a,b) => a.days - b.days);

    const top5 = tcoRows.slice(0,5);

    const subject = encodeURIComponent(`Raport floty ${yr} — ${today}`);

    const companyName = window.getCurrentCompany?.()?.name || 'TaxOrder Pro';

    let body = `RAPORT ZARZĄDU FLOTY — ${yr}\n`;
    body += `Firma: ${companyName} | Data: ${today}\n`;
    body += `${'─'.repeat(50)}\n\n`;
    body += `KPI FLOTY:\n`;
    body += `  Pojazdy łącznie: ${vehs.length}\n`;
    body += `  Opodatkowane DT-1: ${dt1Count}\n`;
    body += `  Koszt paliwa YTD: ${fmt(totalFuel)} zł\n`;
    body += `  Koszt serwisu YTD: ${fmt(totalSvc)} zł\n`;
    body += `  Podatek DT-1: ${fmt(totalTax)} zł\n`;
    body += `  Łącznie koszty: ${fmt(totalFuel + totalSvc + totalTax)} zł\n\n`;

    if (top5.length) {
      body += `TOP 5 POJAZDÓW WG. KOSZTÓW:\n`;
      top5.forEach((r,i) => {
        body += `  ${i+1}. ${r.nrRej} ${r.marka} ${r.model} — ${fmt(r.total)} zł\n`;
      });
      body += '\n';
    }

    if (soon30.length) {
      body += `POLISY WYMAGAJĄCE ODNOWIENIA (≤30 dni):\n`;
      soon30.forEach(r => {
        body += `  ${r.nrRej} — ${r.type} (za ${r.days} dni)\n`;
      });
      body += '\n';
    }

    body += `─────────────────────────────\n`;
    body += `Wygenerowano przez TaxOrder Pro`;

    const mailtoUrl = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;

    // mailto ma limit ~2000 znaków — jeśli przekracza, otwiera raport HTML i informuje
    if (mailtoUrl.length > 1900) {
      toast(t('rep.toast.email.long'));
    }

    const a = document.createElement('a');
    a.href = mailtoUrl;
    a.click();

    toast(t('rep.toast.email.ok'));
  }

  // ── Raport miesięczny PDF ─────────────────────────────────────────────────
  function initPdfSelectors() {
    const now  = new Date();
    const prev = now.getMonth() === 0 ? 12 : now.getMonth(); // poprzedni miesiąc (1-12)
    const yr   = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const mSel = document.getElementById('fr-pdf-month');
    const ySel = document.getElementById('fr-pdf-year');
    if (mSel && !mSel._initialized) { mSel.value = String(prev); mSel._initialized = true; }
    if (ySel && !ySel._initialized) { ySel.value = String(yr);   ySel._initialized = true; }
  }

  function generateMonthlyPdf() {
    if (typeof window.jspdf === 'undefined') { toast(t('rep.toast.jspdf.na')); return; }

    const month   = +(document.getElementById('fr-pdf-month')?.value || (new Date().getMonth() || 12));
    const year    = +(document.getElementById('fr-pdf-year')?.value  || new Date().getFullYear());
    const company =   document.getElementById('fr-pdf-company')?.value || '';

    const prefix  = `${year}-${String(month).padStart(2, '0')}`;
    const MNAMES  = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                     'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    const monthLabel = MNAMES[month - 1] + ' ' + year;

    let vehicles = window.vehs || [];
    if (company) vehicles = vehicles.filter(v => v.wlasciciel === company);

    // Agregacja paliwa
    const FACTORS = { ON:2.679, PB:2.302, PB95:2.302, PB98:2.302, LPG:1.626, CNG:1.963, HVO:0.481, EV:0 };
    const fuelRows = vehicles.map(v => {
      const entries = (v.fuelHistory || []).filter(h => (h.date || '').startsWith(prefix));
      if (!entries.length) return null;
      const liters = entries.reduce((s, h) => s + (h.liters || 0), 0);
      const cost   = entries.reduce((s, h) => s + (h.totalGross || 0), 0);
      const co2    = entries.reduce((s, h) => s + (h.co2kg != null ? +h.co2kg : (h.liters||0) * (FACTORS[h.product||'ON'] ?? 2.679)), 0);
      const kms    = entries.map(h => h.km).filter(k => k > 0).sort((a, b) => a - b);
      const dist   = kms.length >= 2 ? kms[kms.length - 1] - kms[0] : 0;
      const avg    = dist > 10 ? liters / dist * 100 : 0;
      return { v, liters, cost, co2, dist, avg };
    }).filter(Boolean).sort((a, b) => b.liters - a.liters);

    // Agregacja serwisu
    const svcRows = vehicles.flatMap(v =>
      (v.serviceHistory || [])
        .filter(h => (h.date || '').startsWith(prefix))
        .map(h => ({ v, ...h }))
    ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const totLiters = fuelRows.reduce((s, r) => s + r.liters, 0);
    const totCost   = fuelRows.reduce((s, r) => s + r.cost, 0);
    const totCo2    = fuelRows.reduce((s, r) => s + r.co2, 0);
    const totSvc    = svcRows.reduce((s, h) => s + (h.cost || 0), 0);

    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W    = 210;
    const BLUE  = [41, 98, 194];
    const GREEN = [22, 120, 60];
    const GRAY  = [100, 100, 100];
    const LGRAY = [245, 245, 248];

    // Banner nagłówkowy
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Raport Miesięczny Floty', 14, 18);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(monthLabel, 14, 29);
    if (company) { doc.setFontSize(10); doc.text(company, 14, 38); }
    doc.setFontSize(8);
    doc.text(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`, W - 14, 38, { align: 'right' });

    // KPI chips
    const chips = [
      { label: 'Pojazdy z tankowaniami', value: String(fuelRows.length) },
      { label: 'Paliwo łącznie',         value: totLiters.toFixed(0) + ' l' },
      { label: 'Koszt paliwa',           value: totCost.toFixed(0) + ' zł' },
      { label: 'Koszt serwisu',          value: totSvc.toFixed(0) + ' zł' },
      { label: 'Emisja CO₂',             value: totCo2.toFixed(0) + ' kg' },
    ];
    const cW = 36, cH = 18, cGap = 2;
    let cx = (W - (chips.length * cW + (chips.length - 1) * cGap)) / 2;
    chips.forEach(chip => {
      doc.setFillColor(...LGRAY);
      doc.roundedRect(cx, 48, cW, cH, 2, 2, 'F');
      doc.setTextColor(...BLUE);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(chip.value, cx + cW / 2, 57, { align: 'center' });
      doc.setTextColor(...GRAY);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(chip.label, cx + cW / 2, 62, { align: 'center' });
      cx += cW + cGap;
    });

    // Tabela paliwa
    doc.setTextColor(...BLUE);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Zestawienie tankowań', 14, 75);

    if (fuelRows.length) {
      doc.autoTable({
        startY: 78,
        head: [['Nr rej.', 'Marka / Model', 'Litry (l)', 'Śr. l/100km', 'Koszt (zł)', 'CO₂ (kg)']],
        body: [
          ...fuelRows.map(r => [
            r.v.nrRej,
            `${r.v.marka} ${r.v.model}`.substring(0, 28),
            r.liters.toFixed(1),
            r.avg > 0 ? r.avg.toFixed(1) : '—',
            r.cost  > 0 ? r.cost.toFixed(2)  : '—',
            r.co2.toFixed(1),
          ]),
          ['ŁĄCZNIE', '', totLiters.toFixed(1), '', totCost > 0 ? totCost.toFixed(2) : '—', totCo2.toFixed(1)],
        ],
        headStyles: { fillColor: BLUE, fontSize: 8, halign: 'center', textColor: [255,255,255] },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 22 },
          1: { cellWidth: 54 },
          2: { halign: 'right', cellWidth: 22 },
          3: { halign: 'right', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 28 },
          5: { halign: 'right', cellWidth: 24 },
        },
        didParseCell(data) {
          if (data.row.index === fuelRows.length && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 230, 255];
          }
        },
        alternateRowStyles: { fillColor: [248, 250, 255] },
        margin: { left: 14, right: 14 },
      });
    } else {
      doc.setTextColor(...GRAY);
      doc.setFontSize(9);
      doc.text('Brak danych paliwowych w wybranym okresie.', 14, 85);
    }

    // Tabela serwisu
    const svcY = (doc.lastAutoTable?.finalY || 90) + 12;
    doc.setTextColor(...GREEN);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Zdarzenia serwisowe', 14, svcY);

    if (svcRows.length) {
      doc.autoTable({
        startY: svcY + 3,
        head: [['Data', 'Nr rej.', 'Marka / Model', 'Opis', 'Koszt (zł)']],
        body: [
          ...svcRows.map(h => [
            h.date || '—',
            h.v.nrRej,
            `${h.v.marka} ${h.v.model}`.substring(0, 22),
            (h.description || h.type || '—').substring(0, 42),
            h.cost > 0 ? (+h.cost).toFixed(2) : '—',
          ]),
          ['ŁĄCZNIE', '', '', '', totSvc > 0 ? totSvc.toFixed(2) : '—'],
        ],
        headStyles: { fillColor: GREEN, fontSize: 8, textColor: [255,255,255] },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { fontStyle: 'bold', cellWidth: 22 },
          2: { cellWidth: 42 },
          3: { cellWidth: 76 },
          4: { halign: 'right', cellWidth: 20 },
        },
        didParseCell(data) {
          if (data.row.index === svcRows.length && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 255, 220];
          }
        },
        alternateRowStyles: { fillColor: [248, 255, 248] },
        margin: { left: 14, right: 14 },
      });
    } else {
      doc.setTextColor(...GRAY);
      doc.setFontSize(9);
      doc.text('Brak zdarzeń serwisowych w wybranym okresie.', 14, svcY + 8);
    }

    // Numeracja stron + stopka
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 288, W - 14, 288);
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `TaxOrder Pro — Raport ${monthLabel}${company ? ' / ' + company : ''} | Strona ${i} z ${pageCount}`,
        W / 2, 292, { align: 'center' }
      );
    }

    const safe = (s) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`raport_${year}_${String(month).padStart(2,'0')}${company ? '_' + safe(company) : ''}.pdf`);
    toast(t('rep.toast.pdf.ok').replace('{0}', monthLabel));
  }

  // ── Projekcja DT-1 na przyszły rok ───────────────────────────────────────

  function renderDt1Projection(containerId) {
    const el = document.getElementById(containerId || 'dt1-projection-result');
    if (!el) return;

    const vehs = (window.vehs || []).filter(v => !v.archived);
    const nowYear = new Date().getFullYear();
    const nextYear = nowYear + 1;

    if (!window.calcTax || !vehs.length) {
      el.innerHTML = `<div style="padding:16px;color:var(--text3);font-size:13px;text-align:center">Brak danych pojazdów lub kalkulatora podatku.</div>`;
      return;
    }

    const fmt = n => n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Compute current year tax
    const currentRows = [];
    let currentTotal = 0;
    vehs.forEach(v => {
      const t = window.calcTax(v);
      if (!t || t.exempt || !t.cat) return;
      const months = (typeof window.calcMiesiacePodatku === 'function')
        ? window.calcMiesiacePodatku(v, nowYear)
        : (v.miesiacePodatku != null ? +v.miesiacePodatku : 12);
      const amount = t.stawkaRoczna != null ? Math.round(t.stawkaRoczna * months / 12 * 100) / 100 : (t.kwota || 0);
      currentRows.push({ v, cat: t.cat, months, amount });
      currentTotal += amount;
    });

    // For next year: if vehicle rok < nextYear-1, mark as "old" (different rate bracket)
    // Simply recompute with all months = 12 (full year, no disposal/withdrawal)
    const nextRows = [];
    let nextTotal = 0;
    vehs.forEach(v => {
      const vNext = { ...v, rok: v.rok, miesiacePodatku: 12, dataWycofania: '', dataDopuszczenia: '', dataZbycia: '', saleDate: '' };
      const t = window.calcTax(vNext);
      if (!t || t.exempt || !t.cat) return;
      const amount = t.kwota || 0;
      nextRows.push({ v, cat: t.cat, amount });
      nextTotal += amount;
    });

    const diff = nextTotal - currentTotal;
    const diffSign = diff > 0 ? '+' : '';

    el.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        <div class="fkpi-card" style="flex:1;min-width:160px;padding:14px 18px">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">${nowYear} (bieżący)</div>
          <div style="font-size:24px;font-weight:800;color:var(--blue)">${fmt(currentTotal)} zł</div>
          <div style="font-size:11px;color:var(--text2)">${currentRows.length} pojazdów opodatkowanych</div>
        </div>
        <div class="fkpi-card" style="flex:1;min-width:160px;padding:14px 18px;${diff>0?'border-color:var(--red)':'border-color:var(--green)'}">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">${nextYear} (projekcja, pełny rok)</div>
          <div style="font-size:24px;font-weight:800;color:${diff>0?'var(--red)':'var(--green)'}">${fmt(nextTotal)} zł</div>
          <div style="font-size:11px;color:var(--text2)">${diffSign}${fmt(diff)} zł vs rok bieżący</div>
        </div>
        <div class="fkpi-card" style="flex:1;min-width:160px;padding:14px 18px">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Zmiana</div>
          <div style="font-size:24px;font-weight:800;color:${diff>0?'var(--red)':'var(--green)'}">
            ${currentTotal>0 ? (diffSign + (diff/currentTotal*100).toFixed(1) + '%') : '—'}
          </div>
          <div style="font-size:11px;color:var(--text2)">rok do roku</div>
        </div>
      </div>

      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">
        <i class="ti ti-info-circle" style="margin-right:4px"></i>
        Projekcja zakłada pełne 12 miesięcy bez wycofań/zbycia. Pojazdy wyprodukowane w ${nextYear - 1}–${nextYear} mogą zmienić kategorię wiekową.
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--bg2)">
          <th style="padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">Nr rej.</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">Pojazd</th>
          <th style="padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">Kat.</th>
          <th style="padding:7px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">${nowYear}</th>
          <th style="padding:7px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">${nextYear}</th>
          <th style="padding:7px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text3)">Δ</th>
        </tr></thead>
        <tbody>
          ${nextRows.map((r, i) => {
            const cur = currentRows.find(c => c.v.id === r.v.id);
            const curAmt = cur?.amount || 0;
            const delta = r.amount - curAmt;
            const ds = delta > 0 ? '+' : '';
            return `<tr style="${i%2?'background:var(--bg2)':''}">
              <td style="padding:6px 10px;font-family:var(--mono)">${r.v.nrRej||'—'}</td>
              <td style="padding:6px 10px;font-size:11px;color:var(--text2)">${r.v.marka||''} ${r.v.model||''}</td>
              <td style="padding:6px 10px"><span class="pill pill-blue" style="font-size:10px">${r.cat}</span></td>
              <td style="padding:6px 10px;text-align:right;font-family:var(--mono)">${curAmt>0?fmt(curAmt)+' zł':'—'}</td>
              <td style="padding:6px 10px;text-align:right;font-family:var(--mono);font-weight:700">${fmt(r.amount)} zł</td>
              <td style="padding:6px 10px;text-align:right;font-size:11px;color:${delta>0?'#dc2626':delta<0?'#16a34a':'var(--text3)'}">${delta!==0?ds+fmt(delta)+' zł':'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--border);font-weight:700;background:var(--bg2)">
            <td colspan="3" style="padding:7px 10px">Łącznie</td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--mono)">${fmt(currentTotal)} zł</td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--mono);color:${diff>0?'var(--red)':'var(--green)'}">${fmt(nextTotal)} zł</td>
            <td style="padding:7px 10px;text-align:right;font-size:11px;color:${diff>0?'#dc2626':'#16a34a'}">${diff!==0?(diffSign+fmt(diff)+' zł'):'—'}</td>
          </tr>
        </tfoot>
      </table>`;
  }

  return { renderPage, exportExcel, exportCsv, renderServicePlan, exportServicePlanExcel, exportServicePlanHtml, renderMaintenanceKm, exportMaintenanceKmExcel, saveBudgetInputs, renderKobize, exportKobizeCsv, exportKobizeExcel, renderTco, exportTcoExcel, renderInsuranceReport, exportInsuranceExcel, exportExecutiveSummary, emailExecutiveSummary, generateMonthlyPdf, initPdfSelectors, renderDt1Projection };
})();
