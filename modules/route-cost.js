(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v, d=2) => v != null ? parseFloat(v).toLocaleString('pl-PL', {minimumFractionDigits:d,maximumFractionDigits:d}) : '—';

  let _profiles = [];
  let _lastResult = null;

  async function renderRouteCost() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/route-cost/profiles?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _profiles = await r.json();
      if (!_profiles.length) {
        // Utwórz domyślny profil
        await fetch(`${API()}/api/route-cost/profiles?company=${encodeURIComponent(co)}`, {
          method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Domyślny — diesel', fuel_price_pln: 6.50, fuel_norm_l100: 8.0,
            toll_rate_per_km: 0.0, driver_cost_per_km: 1.20, depreciation_per_km: 0.35, other_per_km: 0.10, is_default: 1 })
        });
        const r2 = await fetch(`${API()}/api/route-cost/profiles?company=${encodeURIComponent(co)}`, { headers: H() });
        if (r2.ok) _profiles = await r2.json();
      }
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-route-cost');
    if (!el) return;
    const def = _profiles.find(p => p.is_default) || _profiles[0] || {};

    el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
  <h2 style="margin:0;font-size:18px"><i class="ti ti-calculator"></i> Kalkulator kosztów trasy</h2>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1100px">

  <!-- Kalkulator -->
  <div style="background:var(--bg2);border-radius:12px;padding:20px">
    <h3 style="font-size:14px;margin:0 0 14px"><i class="ti ti-route"></i> Oblicz koszt</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="grid-column:1/-1">
        <label style="font-size:12px;color:var(--text3)">Dystans (km) *</label><br>
        <input type="number" id="rc-dist" class="sel" placeholder="np. 350" min="1" oninput="window.RouteCost._calc()">
      </div>
      <div>
        <label style="font-size:12px;color:var(--text3)">Profil kosztów</label><br>
        <select id="rc-profile" class="sel" onchange="window.RouteCost._loadProfile()">
          ${_profiles.map(p=>`<option value="${e(p.id)}" ${p.is_default?'selected':''}>${e(p.name)}</option>`).join('')}
          <option value="custom">Niestandardowy...</option>
        </select>
      </div>
      <div style="display:flex;align-items:flex-end">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" id="rc-return" onchange="window.RouteCost._calc()"> Trasa powrotna (×2)
        </label>
      </div>
    </div>

    <div id="rc-profile-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div>
        <label style="font-size:11px;color:var(--text3)">Cena paliwa (PLN/l)</label>
        <input type="number" id="rc-fp" class="sel" step="0.01" value="${def.fuel_price_pln||6.5}" oninput="window.RouteCost._calc()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text3)">Zużycie (l/100km)</label>
        <input type="number" id="rc-fn" class="sel" step="0.1" value="${def.fuel_norm_l100||8}" oninput="window.RouteCost._calc()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text3)">Opłaty drogowe (PLN/km)</label>
        <input type="number" id="rc-toll" class="sel" step="0.01" value="${def.toll_rate_per_km||0}" oninput="window.RouteCost._calc()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text3)">Koszt kierowcy (PLN/km)</label>
        <input type="number" id="rc-driver" class="sel" step="0.01" value="${def.driver_cost_per_km||1.2}" oninput="window.RouteCost._calc()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text3)">Amortyzacja (PLN/km)</label>
        <input type="number" id="rc-depr" class="sel" step="0.01" value="${def.depreciation_per_km||0.35}" oninput="window.RouteCost._calc()">
      </div>
      <div>
        <label style="font-size:11px;color:var(--text3)">Inne (PLN/km)</label>
        <input type="number" id="rc-other" class="sel" step="0.01" value="${def.other_per_km||0.1}" oninput="window.RouteCost._calc()">
      </div>
    </div>

    <button class="btn btn-primary" onclick="window.RouteCost._calcServer()"><i class="ti ti-calculator"></i> Oblicz</button>
    <button class="btn btn-sm" onclick="window.RouteCost._saveProfile()" style="margin-left:8px"><i class="ti ti-device-floppy"></i> Zapisz profil</button>
  </div>

  <!-- Wyniki -->
  <div id="rc-result" style="background:var(--bg2);border-radius:12px;padding:20px">
    <h3 style="font-size:14px;margin:0 0 14px;color:var(--text3)"><i class="ti ti-chart-pie"></i> Wynik kalkulacji</h3>
    <div style="text-align:center;padding:30px;color:var(--text3)">
      <i class="ti ti-route" style="font-size:40px"></i>
      <p>Wprowadź dystans i kliknij "Oblicz"</p>
    </div>
  </div>

</div>

<!-- Profile kosztów -->
<div style="margin-top:20px">
  <h3 style="font-size:14px;margin:0 0 12px"><i class="ti ti-settings"></i> Zapisane profile kosztów</h3>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
    ${_profiles.map(p => `
    <div style="background:var(--bg2);border-radius:10px;padding:12px;border-left:3px solid ${p.is_default?'#2563eb':'var(--border)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <strong style="font-size:13px">${e(p.name)} ${p.is_default?'<span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:6px">Domyślny</span>':''}</strong>
        <button class="btn btn-sm" data-id="${e(p.id)}" onclick="window.RouteCost._delProfile(this.dataset.id)" style="color:#dc2626;font-size:10px"><i class="ti ti-trash"></i></button>
      </div>
      <div style="font-size:11px;color:var(--text3);display:grid;grid-template-columns:1fr 1fr;gap:2px">
        <span>Paliwo: ${fmtN(p.fuel_price_pln,2)} PLN/l · ${fmtN(p.fuel_norm_l100,1)} l/100km</span>
        <span>Tolls: ${fmtN(p.toll_rate_per_km,2)} PLN/km</span>
        <span>Kierowca: ${fmtN(p.driver_cost_per_km,2)} PLN/km</span>
        <span>Amortyzacja: ${fmtN(p.depreciation_per_km,2)} PLN/km</span>
      </div>
      <div style="margin-top:6px;font-weight:600;font-size:12px">
        Suma: ~${fmtN((p.fuel_price_pln*p.fuel_norm_l100/100)+(p.toll_rate_per_km||0)+(p.driver_cost_per_km||0)+(p.depreciation_per_km||0)+(p.other_per_km||0),2)} PLN/km
      </div>
    </div>`).join('')}
  </div>
</div>`;
  }

  function _loadProfile() {
    const id = document.getElementById('rc-profile')?.value;
    if (id === 'custom') return;
    const p = _profiles.find(pr => pr.id === id);
    if (!p) return;
    document.getElementById('rc-fp').value    = p.fuel_price_pln;
    document.getElementById('rc-fn').value    = p.fuel_norm_l100;
    document.getElementById('rc-toll').value  = p.toll_rate_per_km;
    document.getElementById('rc-driver').value= p.driver_cost_per_km;
    document.getElementById('rc-depr').value  = p.depreciation_per_km;
    document.getElementById('rc-other').value = p.other_per_km;
    _calc();
  }

  function _calc() {
    const dist = parseFloat(document.getElementById('rc-dist')?.value || 0);
    if (!dist) return;
    const fp   = parseFloat(document.getElementById('rc-fp')?.value   || 6.5);
    const fn   = parseFloat(document.getElementById('rc-fn')?.value   || 8);
    const toll = parseFloat(document.getElementById('rc-toll')?.value  || 0);
    const driv = parseFloat(document.getElementById('rc-driver')?.value|| 1.2);
    const depr = parseFloat(document.getElementById('rc-depr')?.value  || 0.35);
    const oth  = parseFloat(document.getElementById('rc-other')?.value  || 0.1);
    const ret  = document.getElementById('rc-return')?.checked;
    const d    = dist * (ret ? 2 : 1);

    const cFuel   = d * fn / 100 * fp;
    const cToll   = d * toll;
    const cDriver = d * driv;
    const cDepr   = d * depr;
    const cOther  = d * oth;
    const cTotal  = cFuel + cToll + cDriver + cDepr + cOther;
    const cPerKm  = d > 0 ? cTotal / d : 0;

    _showResult({ distance_km: d, fuel_liters: d*fn/100, cost_fuel: cFuel, cost_toll: cToll,
      cost_driver: cDriver, cost_depreciation: cDepr, cost_other: cOther,
      cost_total: cTotal, cost_per_km: cPerKm });
  }

  async function _calcServer() {
    const dist = parseFloat(document.getElementById('rc-dist')?.value || 0);
    if (!dist) { alert('Podaj dystans'); return; }
    const profileId = document.getElementById('rc-profile')?.value;
    const body = {
      distance_km: dist,
      profile_id: profileId !== 'custom' ? profileId : '',
      fuel_price_pln:      parseFloat(document.getElementById('rc-fp')?.value||6.5),
      fuel_norm_l100:      parseFloat(document.getElementById('rc-fn')?.value||8),
      toll_rate_per_km:    parseFloat(document.getElementById('rc-toll')?.value||0),
      driver_cost_per_km:  parseFloat(document.getElementById('rc-driver')?.value||1.2),
      depreciation_per_km: parseFloat(document.getElementById('rc-depr')?.value||0.35),
      other_per_km:        parseFloat(document.getElementById('rc-other')?.value||0.1),
      return_trip:         document.getElementById('rc-return')?.checked || false,
    };
    try {
      const r = await fetch(`${API()}/api/route-cost/calculate?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (r.ok) { _lastResult = await r.json(); _showResult(_lastResult); }
    } catch { _calc(); }
  }

  function _showResult(res) {
    const el = document.getElementById('rc-result');
    if (!el) return;
    const totalPct = res.cost_total > 0 ? {
      fuel:   Math.round(res.cost_fuel / res.cost_total * 100),
      toll:   Math.round(res.cost_toll / res.cost_total * 100),
      driver: Math.round(res.cost_driver / res.cost_total * 100),
    } : { fuel:0, toll:0, driver:0 };

    el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <h3 style="font-size:14px;margin:0"><i class="ti ti-chart-pie"></i> Wynik kalkulacji</h3>
  <button class="btn btn-sm" onclick="window.RouteCost._copyResult()"><i class="ti ti-copy"></i> Kopiuj</button>
</div>

<div style="text-align:center;margin-bottom:20px">
  <div style="font-size:36px;font-weight:800;color:#2563eb">${fmtN(res.cost_total,2)} PLN</div>
  <div style="font-size:14px;color:var(--text3)">za ${fmtN(res.distance_km,0)} km · ${fmtN(res.cost_per_km,2)} PLN/km</div>
</div>

<div style="margin-bottom:12px">
  <div style="display:flex;height:16px;border-radius:8px;overflow:hidden;margin-bottom:8px">
    <div style="width:${totalPct.fuel}%;background:#dc2626" title="Paliwo"></div>
    <div style="width:${totalPct.toll}%;background:#d97706" title="Opłaty drogowe"></div>
    <div style="width:${totalPct.driver}%;background:#2563eb" title="Kierowca"></div>
    <div style="width:${100-totalPct.fuel-totalPct.toll-totalPct.driver}%;background:#16a34a" title="Amortyzacja + inne"></div>
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px">
    <span style="color:#dc2626">■ Paliwo ${totalPct.fuel}%</span>
    <span style="color:#d97706">■ Tolls ${totalPct.toll}%</span>
    <span style="color:#2563eb">■ Kierowca ${totalPct.driver}%</span>
    <span style="color:#16a34a">■ Amort. + inne ${100-totalPct.fuel-totalPct.toll-totalPct.driver}%</span>
  </div>
</div>

<table style="width:100%;font-size:13px;border-collapse:collapse">
  <tr style="background:var(--bg)"><td style="padding:5px 8px;color:var(--text3)">Paliwo (${fmtN(res.fuel_liters,1)} l)</td><td style="padding:5px 8px;text-align:right;font-weight:600">${fmtN(res.cost_fuel,2)} PLN</td></tr>
  <tr><td style="padding:5px 8px;color:var(--text3)">Opłaty drogowe</td><td style="padding:5px 8px;text-align:right">${fmtN(res.cost_toll,2)} PLN</td></tr>
  <tr style="background:var(--bg)"><td style="padding:5px 8px;color:var(--text3)">Koszt kierowcy</td><td style="padding:5px 8px;text-align:right">${fmtN(res.cost_driver,2)} PLN</td></tr>
  <tr><td style="padding:5px 8px;color:var(--text3)">Amortyzacja</td><td style="padding:5px 8px;text-align:right">${fmtN(res.cost_depreciation,2)} PLN</td></tr>
  <tr style="background:var(--bg)"><td style="padding:5px 8px;color:var(--text3)">Inne</td><td style="padding:5px 8px;text-align:right">${fmtN(res.cost_other,2)} PLN</td></tr>
  <tr style="border-top:2px solid var(--border)"><td style="padding:8px;font-weight:700">ŁĄCZNIE</td><td style="padding:8px;text-align:right;font-weight:800;font-size:15px;color:#2563eb">${fmtN(res.cost_total,2)} PLN</td></tr>
</table>`;
  }

  async function _saveProfile() {
    const name = prompt('Nazwa profilu:', 'Nowy profil');
    if (!name) return;
    const body = {
      name,
      fuel_price_pln:      parseFloat(document.getElementById('rc-fp')?.value||6.5),
      fuel_norm_l100:      parseFloat(document.getElementById('rc-fn')?.value||8),
      toll_rate_per_km:    parseFloat(document.getElementById('rc-toll')?.value||0),
      driver_cost_per_km:  parseFloat(document.getElementById('rc-driver')?.value||1.2),
      depreciation_per_km: parseFloat(document.getElementById('rc-depr')?.value||0.35),
      other_per_km:        parseFloat(document.getElementById('rc-other')?.value||0.1),
    };
    try {
      const r = await fetch(`${API()}/api/route-cost/profiles?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (r.ok) await renderRouteCost();
      else alert('Błąd zapisu');
    } catch (ex) { alert(ex.message); }
  }

  async function _delProfile(id) {
    if (!confirm('Usunąć profil?')) return;
    await fetch(`${API()}/api/route-cost/profiles/${id}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
    await renderRouteCost();
  }

  function _copyResult() {
    if (!_lastResult) return;
    const txt = `Koszt trasy ${_lastResult.distance_km} km: ${parseFloat(_lastResult.cost_total).toFixed(2)} PLN (${parseFloat(_lastResult.cost_per_km).toFixed(2)} PLN/km)`;
    navigator.clipboard?.writeText(txt).then(()=>alert('Skopiowano do schowka'));
  }

  window.RouteCost = { renderRouteCost, _loadProfile, _calc, _calcServer, _saveProfile, _delProfile, _copyResult };
})();
