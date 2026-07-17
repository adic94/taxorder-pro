(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const METRIC_LBL = {
    co2_total_tonnes: 'Emisja CO₂ łączna (t)',
    co2_per_km: 'CO₂ na km (g/km)',
    fuel_consumption_l: 'Zużycie paliwa (l)',
    ev_share_pct: 'Udział EV/Hybrid (%)',
    accidents_per_1m_km: 'Wypadki / 1M km',
    training_hours: 'Godziny szkoleń kierowców',
    fuel_cost_pln: 'Koszty paliwa (PLN)',
    mileage_km: 'Przebieg łączny (km)',
    diversity_score: 'Wskaźnik różnorodności (0-100)',
  };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/esg-targets${path}?company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderEsgReport() {
    const el = document.getElementById('page-esg-report');
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-leaf"></i> Raport ESG i Cele Środowiskowe</h2>
        <div style="display:flex;gap:8px">
          <select id="esg-year" class="form-control" style="width:100px" onchange="window.EsgReport._load()">
            ${[year+1,year,year-1,year-2].map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}
          </select>
          <button class="btn btn-outline" onclick="window.EsgReport._openSetTarget()"><i class="ti ti-target"></i> Ustaw cel</button>
          <button class="btn btn-primary" onclick="window.EsgReport._generateReport()"><i class="ti ti-download"></i> Eksport raportu</button>
        </div>
      </div>
      <div id="esg-dashboard" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:20px"></div>
      <h4 style="margin-bottom:12px"><i class="ti ti-target"></i> Cele i postęp</h4>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Wskaźnik</th><th>Cel (rok)</th><th>Wartość bieżąca</th><th>Postęp</th><th>Odchylenie</th><th>Akcje</th></tr></thead>
        <tbody id="esg-tbody"><tr><td colspan="6" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="esg-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.EsgReport._closeModal()">
        <div class="modal-box" style="max-width:480px">
          <div class="modal-header"><h3 id="esg-modal-title">Cel ESG</h3><button class="modal-close" onclick="window.EsgReport._closeModal()">×</button></div>
          <div class="modal-body" id="esg-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const year  = document.getElementById('esg-year')?.value || new Date().getFullYear();
    const tbody = document.getElementById('esg-tbody');
    const dash  = document.getElementById('esg-dashboard');
    if (!tbody) return;
    const data = await api(`?year=${year}`);
    const targets = data.targets || [];
    const actuals = data.actuals || {};
    _renderDashboard(actuals, dash);
    if (!targets.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Brak zdefiniowanych celów ESG. Kliknij "Ustaw cel" aby dodać.</td></tr>'; return; }
    tbody.innerHTML = targets.map(t => {
      const actual  = actuals[t.metric_key] ?? null;
      const pct     = actual!=null && t.target_value ? Math.round(actual/t.target_value*100) : null;
      const better  = t.lower_is_better;
      const achieved = pct!=null && (better ? actual<=t.target_value : actual>=t.target_value);
      const clr     = pct==null?'#94a3b8':achieved?'#22c55e':pct>=80?'#f59e0b':'#ef4444';
      return `<tr>
        <td><strong>${esc(METRIC_LBL[t.metric_key]||t.metric_key)}</strong></td>
        <td>${t.target_value!=null?esc(String(t.target_value)):' — '} ${esc(t.unit||'')}</td>
        <td>${actual!=null?esc(String(actual))+' '+esc(t.unit||''):'—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:#e2e8f0;border-radius:4px;height:8px">
              <div style="background:${clr};border-radius:4px;height:8px;width:${Math.min(pct??0,100)}%"></div>
            </div>
            <span style="color:${clr};font-weight:600;white-space:nowrap">${pct!=null?pct+'%':'—'}</span>
          </div>
        </td>
        <td style="color:${clr}">${actual!=null&&t.target_value!=null?(actual-t.target_value>0?'+':'')+(actual-t.target_value).toFixed(2)+' '+esc(t.unit||''):'—'}</td>
        <td>
          <button class="btn-icon" data-id="${esc(t.id)}" onclick="window.EsgReport._openSetTarget(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" data-id="${esc(t.id)}" onclick="window.EsgReport._deleteTarget(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderDashboard(actuals, dash) {
    if (!dash) return;
    const cards = [
      { key:'co2_total_tonnes', icon:'ti-cloud', clr:'#22c55e' },
      { key:'ev_share_pct', icon:'ti-bolt', clr:'#3b82f6' },
      { key:'fuel_consumption_l', icon:'ti-droplet', clr:'#f59e0b' },
      { key:'accidents_per_1m_km', icon:'ti-alert-triangle', clr:'#ef4444' },
    ];
    dash.innerHTML = cards.map(c => `
      <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:16px">
        <div style="color:${c.clr};font-size:1.8em"><i class="ti ${c.icon}"></i></div>
        <div style="font-size:1.6em;font-weight:700;color:${c.clr}">${actuals[c.key]!=null?esc(String(actuals[c.key])):'—'}</div>
        <div style="font-size:.85em;color:var(--text-muted)">${esc(METRIC_LBL[c.key]||c.key)}</div>
      </div>`).join('');
  }

  async function _openSetTarget(id) {
    const modal = document.getElementById('esg-modal');
    const body  = document.getElementById('esg-modal-body');
    const year  = document.getElementById('esg-year')?.value || new Date().getFullYear();
    document.getElementById('esg-modal-title').textContent = id ? 'Edytuj cel ESG' : 'Nowy cel ESG';
    let t = { year: +year, lower_is_better: 1 };
    if (id) { const d = await api(`/targets/${id}`); t = d.target || t; }
    body.innerHTML = `<form id="esg-form" onsubmit="window.EsgReport._saveTarget(event,'${esc(id||'')}')">
      <div class="form-row"><label>Wskaźnik *</label>
        <select name="metric_key" class="form-control" required>
          ${Object.entries(METRIC_LBL).map(([v,l])=>`<option value="${v}" ${t.metric_key===v?'selected':''}>${esc(l)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Rok *</label><input name="year" type="number" class="form-control" required value="${t.year||year}" min="2020" max="2099"></div>
      <div class="form-row"><label>Wartość docelowa *</label><input name="target_value" type="number" step="0.001" class="form-control" required value="${t.target_value??''}"></div>
      <div class="form-row"><label>Jednostka (t, %, km, l…)</label><input name="unit" class="form-control" value="${esc(t.unit||'')}"></div>
      <div class="form-row"><label>Niższy = lepszy</label>
        <select name="lower_is_better" class="form-control">
          <option value="1" ${t.lower_is_better!=0?'selected':''}>Tak (CO₂, zużycie)</option>
          <option value="0" ${t.lower_is_better===0?'selected':''}>Nie (udział EV, szkolenia)</option>
        </select>
      </div>
      <div class="form-row"><label>Opis celu</label><textarea name="description" class="form-control" rows="2">${esc(t.description||'')}</textarea></div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.EsgReport._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
    </form>`;
    modal.style.display = 'flex';
  }

  async function _saveTarget(ev, id) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    body.target_value = +body.target_value;
    body.year = +body.year;
    body.lower_is_better = +body.lower_is_better;
    await api(id?`/targets/${id}`:'/targets', { method: id?'PUT':'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _deleteTarget(id) {
    if (!confirm('Usunąć cel ESG?')) return;
    await api(`/targets/${id}`, { method:'DELETE' });
    _load();
  }

  async function _generateReport() {
    const year = document.getElementById('esg-year')?.value || new Date().getFullYear();
    const data = await api(`/report?year=${year}`);
    const targets = data.targets || [];
    const actuals = data.actuals || {};
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Raport ESG ${esc(String(year))}</title></head><body style="font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto">
      <h2>Raport ESG — ${esc(String(year))}</h2>
      <p>Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}</p>
      <h3>Środowisko (Environmental)</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f1f5f9"><th>Wskaźnik</th><th>Wartość bieżąca</th><th>Cel</th><th>Status</th></tr></thead>
        <tbody>${targets.map(t=>{
          const actual = actuals[t.metric_key]??null;
          const achieved = actual!=null&&t.target_value!=null&&(t.lower_is_better?actual<=t.target_value:actual>=t.target_value);
          return `<tr><td>${esc(METRIC_LBL[t.metric_key]||t.metric_key)}</td><td>${actual!=null?esc(String(actual))+' '+esc(t.unit||''):'—'}</td><td>${esc(String(t.target_value))} ${esc(t.unit||'')}</td><td style="color:${achieved?'green':'red'}">${achieved?'✅ Osiągnięty':'❌ Nieosiągnięty'}</td></tr>`;
        }).join('')}
        </tbody>
      </table>
      <p style="margin-top:30px;font-size:.8em;color:#64748b">Raport wygenerowany automatycznie przez TaxOrder Pro</p>
    </body></html>`);
    w.print();
  }

  function _closeModal() { const m=document.getElementById('esg-modal'); if(m) m.style.display='none'; }
  window.EsgReport = { renderEsgReport, _load, _openSetTarget, _saveTarget, _deleteTarget, _generateReport, _closeModal };
})();
