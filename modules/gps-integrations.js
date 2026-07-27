(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtDT = s => s ? s.replace('T',' ').slice(0,16) : '—';

  const PROVIDERS = {
    teltonika: { label:'Teltonika FMB/FMC', icon:'T',  color:'#ff6900', desc:'FMB920, FMB140, FMC640 i inne' },
    webfleet:  { label:'Webfleet (TomTom)', icon:'W',  color:'#d91f2a', desc:'PRO 8375, PRO 7350, LINK 340' },
    samsara:   { label:'Samsara Fleet',     icon:'S',  color:'#1e3a5f', desc:'VG34, VG54, CM31, CM32' },
    navisat:   { label:'Navisat',           icon:'N',  color:'#0066cc', desc:'NaviFleet, NaviTracker' },
    ecofleet:  { label:'Ecofleet',          icon:'E',  color:'#00a651', desc:'Platforma Ecofleet' },
    gurtam:    { label:'Wialon/Gurtam',     icon:'G',  color:'#e63600', desc:'Wialon Hosting, Local' },
    trimble:   { label:'Trimble Fleet',     icon:'TR', color:'#005f9e', desc:'Trimble TMT Fleet Maintenance' },
  };

  let _integrations  = [];
  let _activeProvider = null;
  let _activeTab     = 'providers';

  async function renderGpsIntegrations() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/gps-integrations?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _integrations = await r.json();
    } catch {}
    _render();
    // Re-render the active panel if it was map/fuel
    if (_activeTab !== 'providers') {
      _switchTab(_activeTab);
    }
  }

  // ─── TAB SWITCH ─────────────────────────────────────────────────────────────
  function _switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('[data-gps-tab-btn]').forEach(b => {
      const active = b.dataset.gpsTabBtn === tab;
      b.style.borderBottom = active ? '3px solid var(--primary,#2563eb)' : '3px solid transparent';
      b.style.color        = active ? 'var(--primary,#2563eb)' : 'var(--text3,#64748b)';
      b.style.fontWeight   = active ? '700' : '500';
    });
    document.querySelectorAll('[data-gps-panel]').forEach(c => {
      c.style.display = c.dataset.gpsPanel === tab ? 'block' : 'none';
    });
    if (tab === 'map')  _renderLiveMap();
    if (tab === 'fuel') _renderFuelGpsAnalysis();
  }

  // ─── MAIN RENDER ────────────────────────────────────────────────────────────
  function _render() {
    const el = document.getElementById('page-gps-integrations');
    if (!el) return;

    el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px">
  <h2 style="margin:0;font-size:18px"><i class="ti ti-satellite"></i> Integracje GPS — dane w czasie rzeczywistym</h2>
</div>

<!-- Zakładki -->
<div style="display:flex;gap:0;border-bottom:1px solid var(--border,#e2e8f0);margin-bottom:20px;overflow-x:auto">
  <button data-gps-tab-btn="providers"
    style="padding:10px 16px;background:none;border:none;border-bottom:3px solid var(--primary,#2563eb);cursor:pointer;font-size:13px;font-weight:700;color:var(--primary,#2563eb);white-space:nowrap"
    onclick="window.GpsIntegrations._switchTab('providers')">
    <i class="ti ti-plug"></i> Dostawcy GPS
  </button>
  <button data-gps-tab-btn="map"
    style="padding:10px 16px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;font-size:13px;font-weight:500;color:var(--text3,#64748b);white-space:nowrap"
    onclick="window.GpsIntegrations._switchTab('map')">
    <i class="ti ti-map"></i> Mapa na żywo
  </button>
  <button data-gps-tab-btn="fuel"
    style="padding:10px 16px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;font-size:13px;font-weight:500;color:var(--text3,#64748b);white-space:nowrap"
    onclick="window.GpsIntegrations._switchTab('fuel')">
    <i class="ti ti-gas-station"></i> Analiza paliwa vs GPS
  </button>
</div>

<!-- Panel: Dostawcy -->
<div data-gps-panel="providers" style="display:block">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:24px">
    ${Object.entries(PROVIDERS).map(([key, prov]) => {
      const cfg = _integrations.find(i => i.provider === key) || {};
      const iconSize = prov.icon.length > 1 ? '13px' : '18px';
      return `
    <div style="background:var(--bg2);border-radius:12px;padding:20px;border-top:4px solid ${prov.color}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:44px;height:44px;background:${prov.color};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${iconSize};flex-shrink:0">${prov.icon}</div>
        <div>
          <h4 style="margin:0;font-size:15px">${prov.label}</h4>
          <p style="margin:0;font-size:11px;color:var(--text3)">${prov.desc}</p>
        </div>
      </div>

      ${cfg.configured ? `
      <div style="margin-bottom:12px;padding:8px 10px;background:var(--bg);border-radius:8px;font-size:12px">
        <span style="color:#16a34a;font-weight:600"><i class="ti ti-check"></i> Skonfigurowano</span>
        ${cfg.last_sync
          ? `<br><span style="color:var(--text3)">Ost. sync: ${fmtDT(cfg.last_sync)} · Pojazdów: ${cfg.vehicles_tracked ?? 0}</span>`
          : '<br><span style="color:var(--text3)">Nigdy nie synchronizowano</span>'}
        ${cfg.sync_error ? `<br><span style="color:#dc2626">Błąd: ${e(cfg.sync_error)}</span>` : ''}
      </div>` : `
      <div style="margin-bottom:12px;padding:8px 10px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text3)">
        <i class="ti ti-circle-x"></i> Nie skonfigurowano
      </div>`}

      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1" data-prov="${key}"
          onclick="window.GpsIntegrations._openConfig(this.dataset.prov)">
          <i class="ti ti-settings"></i> ${cfg.configured ? 'Konfiguracja' : 'Skonfiguruj'}
        </button>
        ${cfg.configured ? `<button class="btn btn-primary" data-prov="${key}"
          onclick="window.GpsIntegrations._sync(this.dataset.prov)">
          <i class="ti ti-refresh"></i> Sync
        </button>` : ''}
      </div>
    </div>`;
    }).join('')}
  </div>

  <!-- Instrukcje konfiguracji -->
  <div style="background:var(--bg2);border-radius:12px;padding:20px">
    <h3 style="font-size:14px;margin:0 0 14px"><i class="ti ti-info-circle"></i> Jak skonfigurować integrację GPS?</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;font-size:13px">
      <div>
        <strong style="color:#ff6900">Teltonika</strong>
        <p style="margin:4px 0;font-size:12px;color:var(--text3)">Panel → <em>Settings → API Access</em> → klucz API.
          URL: <code>https://fm.teltonika.lt</code></p>
      </div>
      <div>
        <strong style="color:#d91f2a">Webfleet (TomTom)</strong>
        <p style="margin:4px 0;font-size:12px;color:var(--text3)">Account → <em>API Keys</em> → uprawnienia Read.
          URL: <code>https://csv.webfleet.com</code></p>
      </div>
      <div>
        <strong style="color:#1e3a5f">Samsara</strong>
        <p style="margin:4px 0;font-size:12px;color:var(--text3)">Settings → <em>API Tokens</em> → Read Only token.</p>
      </div>
      <div>
        <strong style="color:#0066cc">Navisat</strong>
        <p style="margin:4px 0;font-size:12px;color:var(--text3)">Panel NaviFleet → Ustawienia → API → wygeneruj token dostępu.</p>
      </div>
      <div>
        <strong style="color:#00a651">Ecofleet</strong>
        <p style="margin:4px 0;font-size:12px;color:var(--text3)">Platforma Ecofleet → API Keys → utwórz klucz integracyjny.</p>
      </div>
      <div>
        <strong style="color:#e63600">Wialon/Gurtam</strong>
        <p style="margin:4px 0;font-size:12px;color:var(--text3)">Wialon Hosting → User Settings → API → wygeneruj token sesji.
          URL: <code>https://hosting.wialon.com</code></p>
      </div>
      <div>
        <strong style="color:#005f9e">Trimble Fleet</strong>
        <p style="margin:4px 0;font-size:12px;color:var(--text3)">TMT Fleet Maintenance → Integrations → API Credentials.</p>
      </div>
    </div>
  </div>
</div>

<!-- Panel: Mapa na żywo -->
<div data-gps-panel="map" style="display:none">
  <div id="gps-live-map-content">
    <div style="text-align:center;padding:40px;color:var(--text3)">
      <i class="ti ti-loader"></i> Ładowanie...
    </div>
  </div>
</div>

<!-- Panel: Analiza paliwa vs GPS -->
<div data-gps-panel="fuel" style="display:none">
  <div id="gps-fuel-analysis-content">
    <div style="text-align:center;padding:40px;color:var(--text3)">
      <i class="ti ti-loader"></i> Ładowanie...
    </div>
  </div>
</div>

<!-- Config modal -->
<div id="gps-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;align-items:center;justify-content:center"
     onclick="if(event.target===this)this.style.display='none'">
  <div id="gps-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(500px,96vw)"></div>
</div>`;
  }

  // ─── LIVE MAP ────────────────────────────────────────────────────────────────
  async function _renderLiveMap() {
    const el = document.getElementById('gps-live-map-content');
    if (!el) return;

    const configured = _integrations.filter(i => i.configured);
    if (!configured.length) {
      el.innerHTML = `
<div style="text-align:center;padding:60px 20px">
  <i class="ti ti-satellite-off" style="font-size:3em;color:var(--text3);display:block;margin-bottom:12px"></i>
  <p style="color:var(--text3);margin:0">Brak skonfigurowanych integracji GPS.<br>
  Przejdź do zakładki <strong>Dostawcy GPS</strong> i dodaj integrację.</p>
</div>`;
      return;
    }

    el.innerHTML = `
<div style="border-radius:12px;overflow:hidden;border:1px solid var(--border,#e2e8f0);margin-bottom:16px">
  <!-- Placeholder mapy (wymaga integracji Leaflet/Mapbox) -->
  <div style="height:340px;background:linear-gradient(135deg,#e0f2fe 0%,#bae6fd 50%,#7dd3fc 100%);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;position:relative;overflow:hidden">
    <!-- Siatka -->
    <div style="position:absolute;inset:0;opacity:.07;background:repeating-linear-gradient(0deg,#000 0,#000 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#000 0,#000 1px,transparent 1px,transparent 40px)"></div>
    <!-- Ikona centralna -->
    <i class="ti ti-map-2" style="font-size:3em;color:#0369a1;z-index:1"></i>
    <div style="text-align:center;z-index:1">
      <strong style="color:#0369a1;font-size:15px">Mapa GPS — podgląd na żywo</strong><br>
      <span style="font-size:12px;color:#0c4a6e">Pełna integracja z mapą wymaga embedu Leaflet/Mapbox</span>
    </div>
    <!-- Markery symulowane per provider -->
    ${configured.slice(0, 4).map((cfg, i) => {
      const prov = PROVIDERS[cfg.provider] || {};
      const top  = 20 + (i % 2) * 35;
      const left = 15 + Math.floor(i / 2) * 45;
      return `<div style="position:absolute;top:${top}%;left:${left}%;z-index:2;background:${prov.color||'#2563eb'};color:#fff;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.3)">${prov.icon||'?'} ${e(cfg.provider)}</div>`;
    }).join('')}
  </div>
</div>

<!-- Status per dostawca -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
  ${configured.map(cfg => {
    const prov = PROVIDERS[cfg.provider] || {};
    return `
<div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:4px solid ${prov.color||'#2563eb'}">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <strong style="font-size:14px">${prov.label || e(cfg.provider)}</strong>
    <button class="btn" style="padding:4px 10px;font-size:12px" data-prov="${e(cfg.provider)}"
      onclick="window.GpsIntegrations._fetchPositions(this.dataset.prov)">
      <i class="ti ti-refresh"></i> Odśwież
    </button>
  </div>
  <div id="gps-pos-${e(cfg.provider)}" style="font-size:12px;color:var(--text3)">
    Pobieranie danych...
  </div>
</div>`;
  }).join('')}
</div>`;

    // Auto-fetch positions for each configured provider
    configured.forEach(cfg => _fetchPositions(cfg.provider));
  }

  // Public: fetch positions for a given provider (proxied through Worker /sync endpoint)
  async function fetchVehiclePositions(provider) {
    const PROVIDER_INTEGRATED = new Set(['teltonika', 'webfleet', 'samsara']);
    if (!PROVIDER_INTEGRATED.has(provider)) {
      return { error: 'Skonfiguruj credentials aby zobaczyć dane' };
    }
    try {
      const r = await fetch(
        `${API()}/api/gps-integrations/${encodeURIComponent(provider)}/sync?company=${encodeURIComponent(Co())}`,
        { method: 'POST', headers: H() }
      );
      if (!r.ok) return { error: `HTTP ${r.status}` };
      return await r.json();
    } catch (ex) {
      return { error: ex.message };
    }
  }

  async function _fetchPositions(provider) {
    const el = document.getElementById(`gps-pos-${provider}`);
    if (!el) return;
    el.innerHTML = '<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Pobieranie danych...';
    const result = await fetchVehiclePositions(provider);
    if (result.error) {
      el.innerHTML = `<span style="color:var(--text3)">${e(result.error)}</span>`;
    } else {
      const vehicles  = result.vehicles  ?? 0;
      const positions = result.positions ?? 0;
      el.innerHTML = `<i class="ti ti-check" style="color:#16a34a"></i> Pojazdów: <strong>${vehicles}</strong> · Pozycji: <strong>${positions}</strong>
        <br><span style="color:var(--text3)">Ost. aktualizacja: ${new Date().toLocaleTimeString('pl-PL')}</span>`;
    }
  }

  // ─── FUEL vs GPS ANALYSIS ────────────────────────────────────────────────────
  async function _renderFuelGpsAnalysis() {
    const el = document.getElementById('gps-fuel-analysis-content');
    if (!el) return;
    const year = new Date().getFullYear();
    el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
  <h3 style="margin:0;font-size:15px"><i class="ti ti-gas-station"></i> Analiza paliwa vs dystans GPS — ${year}</h3>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <label style="font-size:12px;color:var(--text3)">Próg alarmu:</label>
    <select id="gps-fuel-threshold" class="sel" style="width:80px;padding:4px 8px"
      onchange="window.GpsIntegrations._loadFuelAnalysis()">
      <option value="10">10%</option>
      <option value="20" selected>20%</option>
      <option value="30">30%</option>
    </select>
    <button class="btn btn-primary" onclick="window.GpsIntegrations._loadFuelAnalysis()">
      <i class="ti ti-refresh"></i> Odśwież
    </button>
  </div>
</div>
<div id="gps-fuel-table-wrap">
  <div style="text-align:center;padding:30px;color:var(--text3)">
    <i class="ti ti-loader"></i> Ładowanie danych...
  </div>
</div>`;
    await _loadFuelAnalysis();
  }

  async function _loadFuelAnalysis() {
    const wrap = document.getElementById('gps-fuel-table-wrap');
    if (!wrap) return;
    const co        = Co();
    const year      = new Date().getFullYear();
    const threshold = parseInt(document.getElementById('gps-fuel-threshold')?.value ?? '20', 10);

    try {
      // Pull fuel aggregates from the driver-performance endpoint
      // (returns per-vehicle: fuel_liters, km_total, avg_consumption, nr_rej)
      const r = await fetch(
        `${API()}/api/driver-performance?company=${encodeURIComponent(co)}&year=${year}`,
        { headers: H() }
      );
      const data     = r.ok ? await r.json() : {};
      const vehicles = data.vehicles || [];

      if (!vehicles.length) {
        wrap.innerHTML = `
<div style="text-align:center;padding:40px;color:var(--text3)">
  <i class="ti ti-database-off" style="font-size:2em;display:block;margin-bottom:8px"></i>
  Brak danych o zużyciu paliwa za ${year}.<br>
  <span style="font-size:12px">Uzupełnij ewidencję w module <strong>Paliwo</strong>.</span>
</div>`;
        return;
      }

      const rows = vehicles.map(v => {
        const fuelLiters     = v.fuel_liters     ?? 0;
        const gpsKm          = v.gps_km          ?? v.km_total ?? 0;
        const avgConsumption = v.avg_consumption ?? 8;        // l/100 km, fallback
        const expectedLiters = gpsKm > 0 ? (gpsKm / 100 * avgConsumption) : 0;
        const discrepancy    = expectedLiters > 0
          ? Math.round(Math.abs(fuelLiters - expectedLiters) / expectedLiters * 100)
          : 0;
        const isAlert = discrepancy > threshold;
        return { v, fuelLiters, gpsKm, avgConsumption, expectedLiters, discrepancy, isAlert };
      });

      const alertCount = rows.filter(r => r.isAlert).length;

      wrap.innerHTML = `
${alertCount ? `<div style="margin-bottom:12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#dc2626">
  <i class="ti ti-alert-triangle"></i> <strong>${alertCount}</strong> pojazd${alertCount !== 1 ? 'ów' : ''} przekracza próg ${threshold}% odchylenia.
</div>` : `<div style="margin-bottom:12px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#16a34a">
  <i class="ti ti-check"></i> Wszystkie pojazdy w normie (próg ${threshold}%).
</div>`}
<div style="overflow-x:auto">
<table class="table" style="min-width:700px">
<thead>
  <tr>
    <th>Pojazd</th>
    <th style="text-align:right">Paliwo (karta)</th>
    <th style="text-align:right">Dystans GPS</th>
    <th style="text-align:right">Śr. spalanie</th>
    <th style="text-align:right">Oczekiwane</th>
    <th style="text-align:right">Różnica</th>
    <th>Status</th>
  </tr>
</thead>
<tbody>
${rows.map(({ v, fuelLiters, gpsKm, avgConsumption, expectedLiters, discrepancy, isAlert }) => `
  <tr style="${isAlert ? 'background:#fef2f2' : ''}">
    <td>
      <strong>${e(v.nr_rej || v.vehicle_reg || '—')}</strong>
      ${v.make ? `<br><span style="font-size:11px;color:var(--text3)">${e(v.make)}</span>` : ''}
    </td>
    <td style="text-align:right">${fuelLiters.toFixed(1)} L</td>
    <td style="text-align:right">
      ${gpsKm > 0
        ? gpsKm.toLocaleString('pl-PL') + ' km'
        : '<span style="color:var(--text3)">brak GPS</span>'}
    </td>
    <td style="text-align:right">${avgConsumption.toFixed(1)} l/100km</td>
    <td style="text-align:right">${expectedLiters > 0 ? expectedLiters.toFixed(1) + ' L' : '—'}</td>
    <td style="text-align:right;${isAlert ? 'color:#dc2626;font-weight:700' : 'color:#16a34a'}">
      ${discrepancy > 0 ? discrepancy + '%' : '—'}
    </td>
    <td>
      ${isAlert
        ? `<span style="background:#fee2e2;color:#dc2626;padding:3px 8px;border-radius:99px;font-size:11px;white-space:nowrap"><i class="ti ti-alert-triangle"></i> &gt;${threshold}%</span>`
        : `<span style="background:#dcfce7;color:#166534;padding:3px 8px;border-radius:99px;font-size:11px;white-space:nowrap"><i class="ti ti-check"></i> OK</span>`}
    </td>
  </tr>`).join('')}
</tbody>
</table>
</div>
<p style="font-size:11px;color:var(--text3);margin-top:10px">
  * Analiza porównuje dane z ewidencji paliwa (karta paliwowa) z przebiegami GPS.
  Odchylenie &gt;${threshold}% może wskazywać na nieautoryzowane tankowania, błędy odczytu lub brak synchronizacji GPS.
</p>`;

    } catch (ex) {
      wrap.innerHTML = `<div style="color:#dc2626;padding:12px;border-radius:8px;background:#fef2f2">
        Błąd ładowania danych: ${e(ex.message)}
      </div>`;
    }
  }

  // ─── CONFIG MODAL ────────────────────────────────────────────────────────────
  function _openConfig(provider) {
    _activeProvider = provider;
    const prov  = PROVIDERS[provider] || {};
    const cfg   = _integrations.find(i => i.provider === provider) || {};
    const inner = document.getElementById('gps-modal-inner');
    const m     = document.getElementById('gps-modal');
    if (!inner || !m) return;

    const isWebfleet  = provider === 'webfleet';
    const isTeltonika = provider === 'teltonika';
    const isWialon    = provider === 'gurtam';
    const needsAccount = isWebfleet || isTeltonika || isWialon;
    const needsUrl     = isWebfleet || isTeltonika || isWialon;

    const defaultUrl = isTeltonika ? 'https://fm.teltonika.lt'
      : isWialon   ? 'https://hosting.wialon.com'
      : isWebfleet ? 'https://csv.webfleet.com'
      : '';

    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0;color:${prov.color || 'var(--primary)'};font-size:16px">${prov.label || e(provider)} — konfiguracja</h3>
  <button onclick="window.GpsIntegrations._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3)" aria-label="Zamknij">✕</button>
</div>
<div style="margin-bottom:12px">
  <label style="font-size:12px;color:var(--text3)">Token / Klucz API *</label><br>
  <input type="password" id="gps-token" class="sel" value="" placeholder="Wklej token...">
</div>
${needsAccount ? `<div style="margin-bottom:12px">
  <label style="font-size:12px;color:var(--text3)">${isTeltonika ? 'Nazwa użytkownika / Account ID' : isWialon ? 'Identyfikator hosta Wialon' : 'Account ID (identyfikator konta)'}</label><br>
  <input type="text" id="gps-account" class="sel" value="${e(cfg.account_id || '')}">
</div>` : ''}
${needsUrl ? `<div style="margin-bottom:12px">
  <label style="font-size:12px;color:var(--text3)">URL serwera (opcjonalnie)</label><br>
  <input type="text" id="gps-url" class="sel" placeholder="${defaultUrl}">
</div>` : ''}
<div style="margin-bottom:16px;display:flex;align-items:center;gap:8px">
  <input type="checkbox" id="gps-enabled" checked>
  <label for="gps-enabled" style="font-size:13px">Integracja aktywna</label>
</div>
<div style="display:flex;gap:8px;justify-content:flex-end">
  <button class="btn" onclick="window.GpsIntegrations._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.GpsIntegrations._saveConfig()"><i class="ti ti-check"></i> Zapisz</button>
</div>`;
    m.style.display = 'flex';
  }

  async function _saveConfig() {
    const token      = document.getElementById('gps-token')?.value?.trim() ?? '';
    const account_id = document.getElementById('gps-account')?.value?.trim() ?? '';
    const server_url = document.getElementById('gps-url')?.value?.trim()    ?? '';
    const enabled    = document.getElementById('gps-enabled')?.checked ? 1 : 0;
    if (!token) { alert('Token jest wymagany'); return; }
    try {
      const r = await fetch(`${API()}/api/gps-integrations/${_activeProvider}?company=${encodeURIComponent(Co())}`, {
        method: 'PUT',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, account_id, server_url, enabled })
      });
      if (r.ok) { _closeModal(); await renderGpsIntegrations(); }
      else alert('Błąd zapisu');
    } catch (ex) { alert(ex.message); }
  }

  async function _sync(provider) {
    // Use data-prov selector to grab the sync button (avoid class collision with other tables)
    const btn = document.querySelector(`button[data-prov="${provider}"].btn-primary`);
    if (btn?.disabled) return;
    if (btn) btn.disabled = true;
    try {
      const r = await fetch(
        `${API()}/api/gps-integrations/${provider}/sync?company=${encodeURIComponent(Co())}`,
        { method: 'POST', headers: H() }
      );
      const data = r.ok ? await r.json() : {};
      if (data.ok) {
        alert(`Synchronizacja zakończona: ${data.vehicles ?? 0} pojazdów, ${data.positions ?? 0} pozycji`);
        await renderGpsIntegrations();
      } else {
        alert('Błąd synchronizacji: ' + JSON.stringify(data.errors || []));
      }
    } catch (ex) { alert(ex.message); }
    finally { if (btn) btn.disabled = false; }
  }

  function _closeModal() {
    const m = document.getElementById('gps-modal');
    if (m) m.style.display = 'none';
  }

  window.GpsIntegrations = {
    renderGpsIntegrations,
    _openConfig,
    _saveConfig,
    _sync,
    _closeModal,
    _switchTab,
    fetchVehiclePositions,
    _fetchPositions,
    _loadFuelAnalysis,
  };
})();
