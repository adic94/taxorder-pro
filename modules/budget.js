/**
 * TaxOrder Pro — Budżet / TCO
 * Plan vs wykonanie, całkowity koszt posiadania per pojazd, prognoza roczna.
 * Dane persystowane w D1 (tabela budget_plans, schema v39).
 */
window.TaxOrderBudget = (function () {
  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || {};
  const e   = (s) => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function _yr() { return +(document.getElementById('budp-year')?.value || new Date().getFullYear()); }
  function _co() { return document.getElementById('budp-company')?.value || window.currentCompanyId || ''; }
  function _fmt(n) { return (+n || 0).toLocaleString('pl-PL', { maximumFractionDigits: 0 }); }
  function _fmtZ(n) { return _fmt(n) + ' zł'; }

  // ── In-memory plan cache (yr → {fuel,service,insur,tax,fines}) ────────────
  const _cache = {};

  async function _loadPlan(yr) {
    if (_cache[yr] !== undefined) return _cache[yr];
    try {
      const co  = _co();
      const url = `${API()}/api/budget-plans?year=${yr}&company=${co}`;
      const r   = await fetch(url, { headers: { ...H() } });
      const d   = await r.json().catch(() => ({}));
      _cache[yr] = d.plan || {};
    } catch {
      _cache[yr] = {};
    }
    return _cache[yr];
  }

  function _getVehs() {
    const co   = _co();
    const list = window.vehs || [];
    return co ? list.filter(v => (v.wlasciciel || '') === co) : list;
  }

  function _computeRow(v, pfx) {
    const fuel    = (v.fuelHistory    || []).filter(h => (h.date||'').startsWith(pfx)).reduce((s,h) => s + (h.totalGross||0), 0);
    const service = (v.serviceHistory || []).filter(h => (h.date||'').startsWith(pfx)).reduce((s,h) => s + (h.cost||0), 0);
    const insur   = (() => {
      let c = 0;
      ['ocPremium','acPremium'].forEach(f => { if (v[f] && (v.ocStart||'').startsWith(pfx.slice(0,4))) c += +v[f]; });
      return c;
    })();
    const allFines = window.TaxOrderFines?.getAllSync?.() || [];
    const fines    = allFines.filter(f => (f.nr_rej||'') === v.nrRej && (f.date||'').startsWith(pfx.slice(0,4))).reduce((s,f) => s + (f.amount||0), 0);
    const tax      = typeof calcTax === 'function' ? (calcTax(v).amount || 0) : 0;
    return { fuel, service, insur, fines, tax, tco: fuel + service + insur + fines + tax };
  }

  async function render() {
    const yr   = _yr();
    const pfx  = String(yr);
    const vehs = _getVehs();
    const plan = await _loadPlan(yr);
    const now  = new Date();
    const monthsDone = yr < now.getFullYear() ? 12 : (yr === now.getFullYear() ? now.getMonth() + 1 : 0);

    let totFuel = 0, totSvc = 0, totInsur = 0, totFines = 0, totTax = 0;
    const rows = vehs.map(v => {
      const r = _computeRow(v, pfx);
      totFuel  += r.fuel;
      totSvc   += r.service;
      totInsur += r.insur;
      totFines += r.fines;
      totTax   += r.tax;
      return { v, ...r };
    });
    const totAll = totFuel + totSvc + totInsur + totFines + totTax;

    // ── KPI ───────────────────────────────────────────────────────────────────
    const kpiEl = document.getElementById('budp-kpi');
    if (kpiEl) {
      const avgTco = rows.length ? totAll / rows.length : 0;
      const top    = rows.slice().sort((a,b) => b.tco - a.tco)[0];
      kpiEl.innerHTML = [
        ['Pojazdy w analizie', vehs.length,       '',                                                    'var(--text)'],
        ['Łączny TCO',         _fmtZ(totAll),     'paliwo+serwis+ubezp.+tax+mandaty',                   'var(--blue)'],
        ['Paliwo',             _fmtZ(totFuel),    pfx,                                                   'var(--green)'],
        ['Serwis',             _fmtZ(totSvc),     pfx,                                                   'var(--amber)'],
        ['Śr. TCO / pojazd',  _fmtZ(avgTco),     top ? 'Max: ' + e(top.v.nrRej) : '',                  'var(--text)'],
      ].map(([l,v,s,c]) =>
        `<div class="stat"><div class="stat-label">${l}</div>` +
        `<div class="stat-val" style="color:${c};font-size:20px">${v}</div>` +
        `<div class="stat-sub">${s}</div></div>`
      ).join('');
    }

    // ── Plan vs wykonanie ─────────────────────────────────────────────────────
    const planEl = document.getElementById('budp-plan');
    if (planEl) {
      const cats = [
        { key:'fuel',    label:'Paliwo',       icon:'ti-gas-station',  val:totFuel  },
        { key:'service', label:'Serwis',        icon:'ti-tool',         val:totSvc   },
        { key:'insur',   label:'Ubezpieczenia', icon:'ti-shield',       val:totInsur },
        { key:'tax',     label:'Podatek DT-1',  icon:'ti-file-invoice', val:totTax   },
        { key:'fines',   label:'Mandaty',        icon:'ti-ticket',       val:totFines },
      ];
      const budTotal = cats.reduce((s,c) => s + (plan[c.key] ?? 0), 0);
      const actTotal = cats.reduce((s,c) => s + c.val, 0);

      planEl.innerHTML = cats.map(c => {
        const b   = plan[c.key] ?? 0;
        const pct = b ? Math.min((c.val / b) * 100, 130) : 0;
        const over  = c.val > b && b > 0;
        const color = over ? 'var(--red)' : 'var(--green)';
        return `<div style="margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <i class="ti ${c.icon}" style="font-size:13px;color:var(--text2);width:16px"></i>
            <span style="font-size:12px;font-weight:600;flex:1">${c.label}</span>
            <span style="font-size:11px;color:var(--text2)">Wykon.: <strong>${_fmtZ(c.val)}</strong></span>
            ${b
              ? `<span style="font-size:11px;${over?'color:var(--red);font-weight:700':'color:var(--green)'}">/ ${_fmtZ(b)} (${pct.toFixed(0)}%)</span>`
              : `<input type="number" class="fi" data-bkey="${c.key}" placeholder="Plan zł" style="width:90px;height:24px;font-size:11px;margin:0;text-align:right">`
            }
          </div>
          ${b ? `<div class="budp-prog"><div class="budp-prog-fill" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>` : ''}
        </div>`;
      }).join('') + (budTotal
        ? `<div style="padding:8px 10px;background:var(--bg3);border-radius:var(--radius);font-size:12px;display:flex;gap:16px;margin-top:8px">
            <span>Budżet: <strong>${_fmtZ(budTotal)}</strong></span>
            <span>Wykonanie: <strong>${_fmtZ(actTotal)}</strong></span>
            <span style="${actTotal>budTotal?'color:var(--red);font-weight:700':'color:var(--green)'}">
              ${actTotal > budTotal ? '▲ +' : '▼ −'}${_fmtZ(Math.abs(actTotal-budTotal))}
            </span>
          </div>`
        : '<div style="font-size:11px;color:var(--text3);margin-top:8px">Wpisz wartości budżetu w polach powyżej i kliknij <strong>Zapisz plan</strong>.</div>'
      );
    }

    // ── Prognoza roczna ───────────────────────────────────────────────────────
    const forecastEl = document.getElementById('budp-forecast');
    if (forecastEl) {
      if (monthsDone > 0 && monthsDone < 12) {
        const monthRate = totAll / monthsDone;
        const forecast  = monthRate * 12;
        const remaining = forecast - totAll;
        const endDate   = new Date(yr, 11, 31).toLocaleDateString('pl-PL', { day:'numeric', month:'long' });
        forecastEl.innerHTML = `
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Wydano (${monthsDone} mies.)</div>
            <div style="font-size:22px;font-weight:700;color:var(--blue)">${_fmtZ(totAll)}</div>
          </div>
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Prognoza na 12 mies.</div>
            <div style="font-size:22px;font-weight:700;color:var(--green)">${_fmtZ(forecast)}</div>
          </div>
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Pozostało (do ${endDate})</div>
            <div style="font-size:18px;font-weight:600;color:var(--amber)">${_fmtZ(remaining)}</div>
          </div>
          <div style="padding:8px;background:var(--blue-light);border-radius:var(--radius);font-size:11px;color:var(--blue)">
            <i class="ti ti-info-circle" style="margin-right:4px"></i>
            Miesięczna stawka: ${_fmtZ(monthRate)} / mies. (śr. z ${monthsDone} mies.)
          </div>`;
      } else if (monthsDone === 12 || yr < now.getFullYear()) {
        forecastEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text2)">
          <i class="ti ti-check-circle" style="font-size:32px;color:var(--green);display:block;margin-bottom:8px"></i>
          Rok ${yr} zamknięty<br><strong>Łączny TCO: ${_fmtZ(totAll)}</strong>
        </div>`;
      } else {
        forecastEl.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:12px">Brak danych kosztowych za ${yr}.</div>`;
      }
    }

    // ── Tabela TCO ────────────────────────────────────────────────────────────
    const tcoEl = document.getElementById('budp-tco');
    if (tcoEl) {
      const top = rows.slice().sort((a,b) => b.tco - a.tco).slice(0, 15);
      if (!top.length) {
        tcoEl.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text3)">Brak danych kosztowych za ${yr}</div>`;
        return;
      }
      const maxTco = top[0].tco || 1;
      tcoEl.innerHTML = `<table style="font-size:12px">
        <thead><tr>
          <th>#</th><th>Nr rej.</th><th>Pojazd</th>
          <th style="text-align:right">Paliwo</th>
          <th style="text-align:right">Serwis</th>
          <th style="text-align:right">Ubezp.</th>
          <th style="text-align:right">DT-1</th>
          <th style="text-align:right">Mandaty</th>
          <th style="text-align:right;font-weight:700">TCO</th>
          <th style="min-width:80px">Udział</th>
        </tr></thead>
        <tbody>${top.map((r,i) => {
          const pct  = (r.tco / (totAll || 1) * 100).toFixed(1);
          const barW = (r.tco / maxTco * 100).toFixed(1);
          return `<tr>
            <td style="color:var(--text3);font-weight:600">${i+1}</td>
            <td><strong style="font-family:var(--mono)">${e(r.v.nrRej)}</strong></td>
            <td style="color:var(--text2)">${e(r.v.marka)} ${e(r.v.model)}</td>
            <td style="text-align:right;font-family:var(--mono)">${r.fuel>0?_fmtZ(r.fuel):'—'}</td>
            <td style="text-align:right;font-family:var(--mono)">${r.service>0?_fmtZ(r.service):'—'}</td>
            <td style="text-align:right;font-family:var(--mono)">${r.insur>0?_fmtZ(r.insur):'—'}</td>
            <td style="text-align:right;font-family:var(--mono)">${r.tax>0?_fmtZ(r.tax):'—'}</td>
            <td style="text-align:right;font-family:var(--mono)">${r.fines>0?_fmtZ(r.fines):'—'}</td>
            <td style="text-align:right;font-family:var(--mono);font-weight:700;color:var(--blue)">${_fmtZ(r.tco)}</td>
            <td>
              <div style="display:flex;align-items:center;gap:4px">
                <div style="flex:1;background:var(--bg3);border-radius:2px;height:6px;overflow:hidden">
                  <div style="width:${barW}%;height:100%;background:var(--blue);border-radius:2px"></div>
                </div>
                <span style="font-size:10px;color:var(--text3);width:32px;text-align:right">${pct}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr style="background:var(--bg2);font-weight:700">
          <td colspan="3" style="padding:8px 12px">RAZEM (${vehs.length} pojazdów)</td>
          <td style="text-align:right;padding:8px 4px">${_fmtZ(totFuel)}</td>
          <td style="text-align:right;padding:8px 4px">${_fmtZ(totSvc)}</td>
          <td style="text-align:right;padding:8px 4px">${_fmtZ(totInsur)}</td>
          <td style="text-align:right;padding:8px 4px">${_fmtZ(totTax)}</td>
          <td style="text-align:right;padding:8px 4px">${_fmtZ(totFines)}</td>
          <td style="text-align:right;padding:8px 4px;color:var(--blue)">${_fmtZ(totAll)}</td>
          <td></td>
        </tr></tfoot>
      </table>`;
    }
  }

  async function savePlan() {
    const yr   = _yr();
    const plan = {};
    document.querySelectorAll('#budp-plan input[data-bkey]').forEach(inp => {
      const v = parseFloat(inp.value) || 0;
      if (v > 0) plan[inp.dataset.bkey] = v;
    });
    if (!Object.keys(plan).length) { toast('⚠ Wpisz wartości budżetu w pola'); return; }

    try {
      const co  = _co();
      const url = `${API()}/api/budget-plans?company=${co}`;
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...H() },
        body: JSON.stringify({ year: yr, ...plan }),
      });
      _cache[yr] = { ..._cache[yr], ...plan };  // optymistyczna aktualizacja cache
      await render();
      toast('✓ Zapisano plan budżetu na ' + yr);
    } catch (err) {
      toast('⚠ Błąd zapisu planu: ' + err.message);
    }
  }

  function exportExcel() {
    if (!window.XLSX) { toast('⚠ Brak XLSX'); return; }
    const yr   = _yr();
    const pfx  = String(yr);
    const vehs = _getVehs();
    const rows = vehs.map(v => {
      const r = _computeRow(v, pfx);
      return ['Nr rej.','Marka','Model','Rok','Paliwo','Serwis','Ubezp.','DT-1','Mandaty','TCO'].reduce((obj, h, i) => {
        obj[h] = [v.nrRej, v.marka||'', v.model||'', v.rok||'', r.fuel, r.service, r.insur, r.tax, r.fines, r.tco][i];
        return obj;
      }, {});
    }).sort((a,b) => b.TCO - a.TCO);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rows), 'TCO ' + yr);
    window.XLSX.writeFile(wb, 'budzet-tco-' + yr + '.xlsx');
    toast('✓ Wyeksportowano TCO dla ' + vehs.length + ' pojazdów');
  }

  return { render, savePlan, exportExcel };
})();
