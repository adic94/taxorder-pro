/**
 * TaxOrder Pro — Dashboard Alertów / Terminy
 * Wszystkie pojazdy × wszystkie typy dokumentów, posortowane wg pilności.
 * Kliknięcie wiersza → otwiera kartę pojazdu na odpowiedniej zakładce.
 */
window.TaxOrderAlertDashboard = (function () {

  const CATS = [
    { id:'oc',      label:'OC',             icon:'ti-shield-check',              color:'#059669', field:'ocEnd',          tab:'insurance' },
    { id:'ac',      label:'AC/Casco',       icon:'ti-shield-half',               color:'#2563eb', field:'acEnd',          tab:'insurance' },
    { id:'ass',     label:'NNW/Assistance', icon:'ti-heart-plus',                color:'#d97706', field:'assEnd',         tab:'insurance' },
    { id:'przeglad',label:'Przegląd SKP',   icon:'ti-car-garage',               color:'#7c3aed', field:'nextInspection', tab:'badania'   },
    { id:'udt',     label:'UDT',            icon:'ti-building-factory-2',        color:'#dc2626', field:'udtNextDate',    tab:'badania',  cond: v => v.hasUdt },
    { id:'tacho',   label:'Tachograf',      icon:'ti-device-desktop-analytics',  color:'#0891b2', field:'tachoNextCalib', tab:'badania',  cond: v => v.hasTacho },
    { id:'opony',   label:'Opony',          icon:'ti-circle',                    color:'#64748b', field:'tireNextChange', tab:'basic'    },
  ];

  let _alerts = [];
  let _filtered = [];
  let _activeFilter = '';

  // ── Buduje tablicę alertów z listy pojazdów ─────────────────────────────────
  function _build(vehs) {
    const now = new Date(); now.setHours(0,0,0,0);
    const out = [];
    for (const v of vehs) {
      if (v.is_active === false) continue;
      for (const cat of CATS) {
        if (cat.cond && !cat.cond(v)) continue;
        const ds = v[cat.field];
        if (!ds) continue;
        const d = new Date(ds + (ds.includes('T') ? '' : 'T00:00:00'));
        if (isNaN(d)) continue;
        const days = Math.round((d - now) / 86400000);
        out.push({ nrRej: v.nr_rej || v.nrRej, marka: v.marka || '', model: v.model || '', id: v.id, ...cat, date: ds, days });
      }
    }
    return out.sort((a, b) => a.days - b.days);
  }

  function _status(days) {
    if (days < 0)    return { bg:'#fee2e2', fg:'#991b1b', badge:'Wygasło '+Math.abs(days)+'d temu', prio:0 };
    if (days <= 7)   return { bg:'#fee2e2', fg:'#dc2626', badge:'za '+days+' dni', prio:1 };
    if (days <= 30)  return { bg:'#fef3c7', fg:'#92400e', badge:'za '+days+' dni', prio:2 };
    if (days <= 60)  return { bg:'#fffbeb', fg:'#b45309', badge:'za '+days+' dni', prio:3 };
    return               { bg:'#f0fdf4', fg:'#166534', badge:'za '+days+' dni', prio:4 };
  }

  // ── load() — wejście ze showPage('alert-dashboard') ────────────────────────
  async function load() {
    const el = document.getElementById('page-alert-dashboard');
    if (!el) return;

    el.innerHTML = `<div style="padding:20px 24px;max-width:1200px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <i class="ti ti-alert-triangle" style="font-size:24px;color:#dc2626"></i>
        <h2 style="margin:0;font-size:20px">Dashboard Alertów — Terminy</h2>
        <button class="btn btn-gray" style="font-size:11px;margin-left:auto" onclick="TaxOrderAlertDashboard.load()">
          <i class="ti ti-refresh"></i>Odśwież
        </button>
        <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderAlertDashboard.exportCSV()">
          <i class="ti ti-file-download"></i>Eksport CSV
        </button>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:20px">
        Wszystkie terminy posortowane wg pilności — kliknij wiersz aby otworzyć kartę pojazdu.
      </div>
      <div id="ad-body" style="text-align:center;padding:48px"><i class="ti ti-loader ti-spin" style="font-size:32px"></i></div>
    </div>`;

    let vehs = window.vehs || [];
    if (!vehs.length) {
      const API = window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
      const token = localStorage.getItem('cf_token');
      const company = window.currentCompanyId || 'mtoilet';
      const r = await fetch(`${API}/api/vehicles?company=${company}`, { headers:{ Authorization:`Bearer ${token}` } });
      if (r.ok) {
        const rows = await r.json();
        vehs = rows.map(row => {
          let data = {};
          try { data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}); } catch {}
          return { ...row, ...data };
        });
      }
    }

    _alerts = _build(vehs);
    _filtered = _alerts;
    _activeFilter = '';
    _render();
  }

  function _render() {
    const el = document.getElementById('ad-body');
    if (!el) return;

    const expired = _alerts.filter(a => a.days < 0).length;
    const urgent  = _alerts.filter(a => a.days >= 0 && a.days <=  7).length;
    const soon    = _alerts.filter(a => a.days >  7 && a.days <= 30).length;
    const ok      = _alerts.filter(a => a.days > 30).length;

    // Zbierz kategorie które faktycznie wystąpiły
    const catSeen = CATS.filter(c => _alerts.some(a => a.id === c.id));

    el.innerHTML = `
      <!-- Karty podsumowania -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:22px">
        ${[
          { n:expired, label:'Wygasłe',  bg:'#fee2e2', fg:'#991b1b', icon:'ti-alert-circle',       key:'expired' },
          { n:urgent,  label:'< 7 dni',  bg:'#fef3c7', fg:'#92400e', icon:'ti-clock-exclamation',  key:'<7'     },
          { n:soon,    label:'7–30 dni', bg:'#fffbeb', fg:'#b45309', icon:'ti-clock',               key:'<30'    },
          { n:ok,      label:'> 30 dni', bg:'#f0fdf4', fg:'#166534', icon:'ti-circle-check',        key:'>30'    },
        ].map(s => `
          <div onclick="TaxOrderAlertDashboard._setFilter('${s.key}')" style="background:${s.bg};border-radius:var(--radius-lg);padding:14px 16px;text-align:center;cursor:pointer;transition:box-shadow .15s;${_activeFilter===s.key?'box-shadow:0 0 0 2px '+s.fg:''}">
            <i class="ti ${s.icon}" style="font-size:26px;color:${s.fg};display:block;margin-bottom:4px"></i>
            <div style="font-size:26px;font-weight:700;color:${s.fg}">${s.n}</div>
            <div style="font-size:11px;color:${s.fg}">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Filtry kategorii -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px" id="ad-cat-filters">
        <button class="btn ${!_activeFilter?'btn-blue':'btn-gray'}" style="font-size:11px" onclick="TaxOrderAlertDashboard._setFilter('')">
          Wszystkie (${_alerts.length})
        </button>
        ${catSeen.map(c => `
          <button class="btn ${_activeFilter===c.id?'btn-blue':'btn-gray'}" style="font-size:11px" onclick="TaxOrderAlertDashboard._setFilter('${c.id}')">
            <i class="ti ${c.icon}" style="color:${c.color}"></i>${c.label} (${_alerts.filter(a=>a.id===c.id).length})
          </button>`).join('')}
      </div>

      <!-- Tabela -->
      <div class="tbl-wrap" style="overflow-x:auto">
        <table>
          <thead><tr>
            <th>Nr rej</th><th>Pojazd</th><th>Typ dokumentu</th>
            <th>Data wygaśnięcia</th><th>Pozostało</th><th></th>
          </tr></thead>
          <tbody id="ad-tbody">${_rows(_filtered)}</tbody>
        </table>
      </div>`;
  }

  function _rows(alerts) {
    if (!alerts.length) return `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">
      <i class="ti ti-circle-check" style="font-size:36px;display:block;margin-bottom:8px;color:var(--green)"></i>
      Brak alertów w wybranej kategorii
    </td></tr>`;

    return alerts.map(a => {
      const s = _status(a.days);
      const dateDisp = (() => { try { return new Date(a.date + (a.date.includes('T')?'':'T00:00:00')).toLocaleDateString('pl-PL'); } catch { return a.date; } })();
      return `<tr style="cursor:pointer" onclick="TaxOrderAlertDashboard._open(${a.id},'${a.tab}')">
        <td><strong style="font-family:var(--mono)">${a.nrRej}</strong></td>
        <td style="font-size:12px;color:var(--text2)">${a.marka} ${a.model}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;background:var(--bg3);border:1px solid var(--border);border-radius:99px;padding:3px 10px">
            <i class="ti ${a.icon}" style="color:${a.color}"></i>${a.label}
          </span>
        </td>
        <td style="font-size:12px;font-family:var(--mono)">${dateDisp}</td>
        <td>
          <span style="font-size:12px;font-weight:700;background:${s.bg};color:${s.fg};padding:3px 10px;border-radius:99px;display:inline-block">
            ${s.badge}
          </span>
        </td>
        <td onclick="event.stopPropagation()">
          <button class="tbtn" onclick="TaxOrderAlertDashboard._open(${a.id},'${a.tab}')" title="Otwórz kartę pojazdu">
            <i class="ti ti-external-link"></i>
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  function _setFilter(key) {
    _activeFilter = key;
    if (!key)          _filtered = _alerts;
    else if (key === 'expired') _filtered = _alerts.filter(a => a.days < 0);
    else if (key === '<7')      _filtered = _alerts.filter(a => a.days >= 0 && a.days <= 7);
    else if (key === '<30')     _filtered = _alerts.filter(a => a.days > 7 && a.days <= 30);
    else if (key === '>30')     _filtered = _alerts.filter(a => a.days > 30);
    else                        _filtered = _alerts.filter(a => a.id === key);
    _render();
  }

  function exportCSV() {
    const data = _filtered.length ? _filtered : _alerts;
    const headers = ['Nr rej', 'Marka', 'Model', 'Typ dokumentu', 'Data wygaśnięcia', 'Pozostało dni'];
    const rows = data.map(a => {
      const dateDisp = (() => { try { return new Date(a.date + (a.date.includes('T')?'':'T00:00:00')).toLocaleDateString('pl-PL'); } catch { return a.date; } })();
      return [a.nrRej, a.marka, a.model, a.label, dateDisp, a.days];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `alerty_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    window.toast?.(`✅ Wyeksportowano ${data.length} alertów`);
  }

  function _open(vehId, tab) {
    showPage?.('pojazdy');
    setTimeout(() => {
      if (typeof openVehicleDetail === 'function') {
        openVehicleDetail(vehId);
        if (tab && tab !== 'basic') setTimeout(() => TaxOrderVehicleDetail?._tab(tab), 400);
      }
    }, 200);
  }

  return { load, _setFilter, _open, exportCSV };
})();
