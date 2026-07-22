(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtD  = s => s ? s.slice(0, 10) : '—';

  const CHARGER_LBL = { AC_slow:'AC wolne (do 22 kW)', AC_fast:'AC szybkie (22–50 kW)', DC_fast:'DC szybkie (50–150 kW)', DC_rapid:'DC ultra (150 kW+)' };
  const CHARGER_CLS = { AC_slow:'', AC_fast:'warn', DC_fast:'ok', DC_rapid:'danger' };

  let _sessions = [], _stats = null;

  async function renderEvCharging() {
    const co = Co();
    const from = document.getElementById('evc-filter-from')?.value || '';
    const to   = document.getElementById('evc-filter-to')?.value || '';
    const vid  = document.getElementById('evc-filter-vehicle')?.value || '';
    const params = new URLSearchParams({ company: co });
    if (from) params.set('date_from', from);
    if (to)   params.set('date_to', to);
    if (vid)  params.set('vehicle_id', vid);
    try {
      const r = await fetch(`${API()}/api/ev-charging?${params}`, { headers: H() });
      if (r.ok) { const data = await r.json(); _sessions = data.sessions || data; _stats = data.stats || null; }
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-ev-charging');
    if (!el) return;
    const total_kwh  = _stats?.total_kwh  ?? _sessions.reduce((s, x) => s + (x.energy_kwh ?? 0), 0);
    const total_cost = _stats?.total_cost ?? _sessions.reduce((s, x) => s + (x.cost_pln ?? 0), 0);
    const avg_kwh    = _stats?.avg_cost_per_kwh ?? (total_kwh > 0 ? total_cost / total_kwh : 0);
    const home_kwh   = _sessions.filter(s => s.home_charging).reduce((a, x) => a + (x.energy_kwh ?? 0), 0);

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-bolt"></i> Sesje ładowania EV</h2>
  <button class="btn-primary" onclick="window.EvCharging._openModal()"><i class="ti ti-plus"></i> Dodaj sesję</button>
</div>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
  <div class="kpi-chip" style="border-color:var(--blue)"><i class="ti ti-bolt" style="color:var(--blue)"></i><span class="kpi-val" style="color:var(--blue)">${fmtN(total_kwh, 1)}</span><span class="kpi-lbl">kWh łącznie</span></div>
  <div class="kpi-chip" style="border-color:var(--green)"><i class="ti ti-coin" style="color:var(--green)"></i><span class="kpi-val" style="color:var(--green)">${fmtN(total_cost, 2)}</span><span class="kpi-lbl">PLN koszt</span></div>
  <div class="kpi-chip"><i class="ti ti-bolt"></i><span class="kpi-val">${fmtN(avg_kwh, 2)}</span><span class="kpi-lbl">PLN/kWh śr.</span></div>
  <div class="kpi-chip"><i class="ti ti-home"></i><span class="kpi-val">${fmtN(home_kwh, 1)}</span><span class="kpi-lbl">kWh domowe</span></div>
  <div class="kpi-chip"><i class="ti ti-list"></i><span class="kpi-val">${_sessions.length}</span><span class="kpi-lbl">Sesji</span></div>
</div>
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
  <input id="evc-filter-from" type="date" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)" onchange="window.EvCharging.renderEvCharging()">
  <input id="evc-filter-to"   type="date" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)" onchange="window.EvCharging.renderEvCharging()">
  <input id="evc-filter-vehicle" type="text" placeholder="Nr rej. pojazdu" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);width:160px">
  <button class="btn-secondary" onclick="window.EvCharging.renderEvCharging()">Filtruj</button>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Data</th><th>Pojazd</th><th>Doładowanie %</th><th>Energia</th><th>Typ ładowarki</th><th>Dostawca</th><th>Koszt</th><th>PLN/kWh</th><th>Zasięg po</th><th></th></tr></thead>
<tbody>
${_sessions.length ? _sessions.map(s => `<tr>
  <td>${fmtD(s.session_date)}</td>
  <td><strong>${e(s.vehicle_reg || '—')}</strong></td>
  <td>
    ${s.charged_from_pct != null ? `<div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:11px;color:var(--text3)">${e(String(s.charged_from_pct))}%</span>
      <div style="flex:1;height:6px;background:var(--border);border-radius:3px;min-width:60px">
        <div style="height:6px;border-radius:3px;background:var(--blue);width:${Math.min(s.charged_to_pct??0,100)}%"></div>
      </div>
      <span style="font-size:11px">${e(String(s.charged_to_pct ?? '?'))}%</span>
    </div>` : '—'}
  </td>
  <td><strong>${fmtN(s.energy_kwh, 1)} kWh</strong></td>
  <td><span class="pill ${e(CHARGER_CLS[s.charger_type] || '')}">${e(CHARGER_LBL[s.charger_type] || s.charger_type || '—')}</span></td>
  <td>${e(s.provider || '—')} ${s.home_charging ? '<span class="pill" style="background:#e0f2fe;color:#0369a1">Dom</span>' : ''}</td>
  <td><strong>${fmtN(s.cost_pln, 2)} PLN</strong></td>
  <td>${s.cost_per_kwh ? fmtN(s.cost_per_kwh, 3) : '—'}</td>
  <td>${s.range_after_km ? fmtN(s.range_after_km) + ' km' : '—'}</td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon" data-id="${e(s.id)}" onclick="window.EvCharging._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(s.id)}" onclick="window.EvCharging._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="10" class="empty">Brak sesji ładowania</td></tr>'}
</tbody></table></div>
<div id="evc-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
  <div id="evc-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(580px,96vw);max-height:90vh;overflow-y:auto"></div>
</div>`;
  }

  function _openModal(id) {
    const s = id ? _sessions.find(x => x.id === id) : null;
    const inner = document.getElementById('evc-modal-inner');
    const modal = document.getElementById('evc-modal');
    if (!inner || !modal) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0"><i class="ti ti-bolt"></i> ${s ? 'Edytuj sesję' : 'Nowa sesja ładowania'}</h3>
  <button onclick="window.EvCharging._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<input type="hidden" id="evc-id" value="${e(s?.id||'')}">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
  <div><label style="font-size:12px;color:var(--text3)">Pojazd (nr rej.)</label><br><input type="text" id="evc-reg" class="sel" value="${e(s?.vehicle_reg||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Data sesji *</label><br><input type="date" id="evc-date" class="sel" value="${e(s?.session_date?.slice(0,10)||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Godzina startu</label><br><input type="time" id="evc-start" class="sel" value="${e(s?.start_time||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Godzina końca</label><br><input type="time" id="evc-end" class="sel" value="${e(s?.end_time||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Energia (kWh) *</label><br><input type="number" id="evc-kwh" class="sel" step="0.1" min="0" value="${s?.energy_kwh ?? ''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Koszt (PLN)</label><br><input type="number" id="evc-cost" class="sel" step="0.01" min="0" value="${s?.cost_pln ?? ''}" oninput="window.EvCharging._calcRate()"></div>
  <div><label style="font-size:12px;color:var(--text3)">Stan bat. przed (%)</label><br><input type="number" id="evc-from" class="sel" min="0" max="100" value="${s?.charged_from_pct ?? ''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Stan bat. po (%)</label><br><input type="number" id="evc-to" class="sel" min="0" max="100" value="${s?.charged_to_pct ?? ''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Typ ładowarki</label><br>
    <select id="evc-charger" class="sel">
      ${Object.entries(CHARGER_LBL).map(([k,v]) => `<option value="${k}" ${s?.charger_type===k?'selected':''}>${v}</option>`).join('')}
      <option value="" ${!s?.charger_type?'selected':''}>— Nieznany —</option>
    </select>
  </div>
  <div><label style="font-size:12px;color:var(--text3)">Dostawca / stacja</label><br><input type="text" id="evc-provider" class="sel" value="${e(s?.provider||'')}" placeholder="np. Orlen Charge, GreenWay"></div>
  <div><label style="font-size:12px;color:var(--text3)">Lokalizacja</label><br><input type="text" id="evc-loc" class="sel" value="${e(s?.location||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Zasięg po ładowaniu (km)</label><br><input type="number" id="evc-range" class="sel" min="0" value="${s?.range_after_km ?? ''}"></div>
</div>
<div style="margin:12px 0;display:flex;align-items:center;gap:8px">
  <input type="checkbox" id="evc-home" ${s?.home_charging?'checked':''}>
  <label for="evc-home" style="font-size:13px">Ładowanie domowe (kwalifikuje do refundacji pracowniczej)</label>
</div>
<div><label style="font-size:12px;color:var(--text3)">Uwagi</label><br><textarea id="evc-notes" class="sel" rows="2">${e(s?.notes||'')}</textarea></div>
<div id="evc-rate-info" style="font-size:12px;color:var(--text3);margin:8px 0"></div>
<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
  <button class="btn" onclick="window.EvCharging._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.EvCharging._save()"><i class="ti ti-device-floppy"></i> Zapisz</button>
</div>`;
    modal.style.display = 'flex';
    _calcRate();
  }

  function _calcRate() {
    const kwh  = parseFloat(document.getElementById('evc-kwh')?.value) || 0;
    const cost = parseFloat(document.getElementById('evc-cost')?.value) || 0;
    const el   = document.getElementById('evc-rate-info');
    if (el && kwh > 0 && cost > 0) el.textContent = `Koszt jednostkowy: ${(cost / kwh).toFixed(3)} PLN/kWh`;
    else if (el) el.textContent = '';
  }

  async function _save() {
    const id   = document.getElementById('evc-id')?.value;
    const date = document.getElementById('evc-date')?.value;
    const kwh  = parseFloat(document.getElementById('evc-kwh')?.value);
    if (!date) { alert('Data sesji jest wymagana'); return; }
    if (isNaN(kwh) || kwh <= 0) { alert('Energia (kWh) jest wymagana'); return; }
    const cost = parseFloat(document.getElementById('evc-cost')?.value) || 0;
    const body = {
      vehicle_reg: document.getElementById('evc-reg')?.value || null,
      session_date: date,
      start_time: document.getElementById('evc-start')?.value || null,
      end_time: document.getElementById('evc-end')?.value || null,
      energy_kwh: kwh,
      cost_pln: cost,
      cost_per_kwh: kwh > 0 && cost > 0 ? parseFloat((cost / kwh).toFixed(4)) : null,
      charged_from_pct: parseInt(document.getElementById('evc-from')?.value) || null,
      charged_to_pct: parseInt(document.getElementById('evc-to')?.value) || null,
      charger_type: document.getElementById('evc-charger')?.value || null,
      provider: document.getElementById('evc-provider')?.value || null,
      location: document.getElementById('evc-loc')?.value || null,
      range_after_km: parseInt(document.getElementById('evc-range')?.value) || null,
      home_charging: document.getElementById('evc-home')?.checked ? 1 : 0,
      notes: document.getElementById('evc-notes')?.value || null,
    };
    const url = id
      ? `${API()}/api/ev-charging/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/ev-charging?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      _closeModal(); await renderEvCharging();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  async function _delete(id) {
    if (!confirm('Usunąć sesję ładowania?')) return;
    try {
      await fetch(`${API()}/api/ev-charging/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderEvCharging();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  function _closeModal() {
    const m = document.getElementById('evc-modal');
    if (m) m.style.display = 'none';
  }

  window.EvCharging = { renderEvCharging, _openModal, _save, _delete, _closeModal, _calcRate };
})();
