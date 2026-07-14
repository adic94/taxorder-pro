(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtDT = s => s ? s.replace('T',' ').slice(0,16) : '—';

  const PROVIDERS = {
    teltonika: { label:'Teltonika FMB/FMC', icon:'T', color:'#ff6900', desc:'FMB920, FMB140, FMC640 i inne' },
    webfleet:  { label:'Webfleet (TomTom)', icon:'W', color:'#d91f2a', desc:'PRO 8375, PRO 7350, LINK 340' },
    samsara:   { label:'Samsara Fleet',     icon:'S', color:'#1e3a5f', desc:'VG34, VG54, CM31, CM32' },
  };

  let _integrations = [];
  let _activeProvider = null;

  async function renderGpsIntegrations() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/gps-integrations?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _integrations = await r.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-gps-integrations');
    if (!el) return;
    el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px">
  <h2 style="margin:0;font-size:18px"><i class="ti ti-satellite"></i> Integracje GPS — dane w czasie rzeczywistym</h2>
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:24px">
  ${Object.entries(PROVIDERS).map(([key, prov]) => {
    const cfg = _integrations.find(i=>i.provider===key)||{};
    return `
  <div style="background:var(--bg2);border-radius:12px;padding:20px;border-top:4px solid ${prov.color}">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div style="width:44px;height:44px;background:${prov.color};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px">${prov.icon}</div>
      <div>
        <h4 style="margin:0;font-size:15px">${prov.label}</h4>
        <p style="margin:0;font-size:11px;color:var(--text3)">${prov.desc}</p>
      </div>
    </div>

    ${cfg.configured ? `
    <div style="margin-bottom:12px;padding:8px 10px;background:var(--bg);border-radius:8px;font-size:12px">
      <span style="color:#16a34a;font-weight:600"><i class="ti ti-check"></i> Skonfigurowano</span>
      ${cfg.last_sync?`<br><span style="color:var(--text3)">Ost. sync: ${fmtDT(cfg.last_sync)} · Pojazdów: ${cfg.vehicles_tracked||0}</span>`:'<br><span style="color:var(--text3)">Nigdy nie synchronizowano</span>'}
      ${cfg.sync_error?`<br><span style="color:#dc2626">Błąd: ${e(cfg.sync_error)}</span>`:''}
    </div>` : `<div style="margin-bottom:12px;padding:8px 10px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text3)">
      <i class="ti ti-circle-x"></i> Nie skonfigurowano
    </div>`}

    <div style="display:flex;gap:8px">
      <button class="btn" style="flex:1" data-prov="${key}" onclick="window.GpsIntegrations._openConfig(this.dataset.prov)">
        <i class="ti ti-settings"></i> ${cfg.configured?'Konfiguracja':'Skonfiguruj'}
      </button>
      ${cfg.configured?`<button class="btn btn-primary" data-prov="${key}" onclick="window.GpsIntegrations._sync(this.dataset.prov)">
        <i class="ti ti-refresh"></i> Sync
      </button>`:''}
    </div>
  </div>`;
  }).join('')}
</div>

<!-- Wyjaśnienie -->
<div style="background:var(--bg2);border-radius:12px;padding:20px">
  <h3 style="font-size:14px;margin:0 0 12px"><i class="ti ti-info-circle"></i> Jak skonfigurować integrację GPS?</h3>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;font-size:13px">
    <div>
      <strong style="color:#ff6900">Teltonika FMB/FMC</strong><br>
      <p style="margin:4px 0;font-size:12px;color:var(--text3)">Zaloguj się do panelu Teltonika Fleet Management. Przejdź do <em>Settings → API Access</em> i wygeneruj klucz API.
      Wprowadź URL serwera (domyślnie: <code>https://fm.teltonika.lt</code>) i klucz do pola Token.</p>
    </div>
    <div>
      <strong style="color:#d91f2a">Webfleet (TomTom)</strong><br>
      <p style="margin:4px 0;font-size:12px;color:var(--text3)">W panelu Webfleet przejdź do <em>Account → API Keys</em>. Utwórz klucz API z uprawnieniami do odczytu floty.
      Wprowadź URL (<code>https://csv.webfleet.com</code>), konto i klucz.</p>
    </div>
    <div>
      <strong style="color:#1e3a5f">Samsara</strong><br>
      <p style="margin:4px 0;font-size:12px;color:var(--text3)">W panelu Samsara przejdź do <em>Settings → API Tokens</em>. Utwórz token z uprawnieniami <em>Read Only</em>.
      Wklej go do pola Token poniżej.</p>
    </div>
  </div>
</div>

<!-- Config modal -->
<div id="gps-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center">
  <div id="gps-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(500px,96vw)"></div>
</div>`;
  }

  function _openConfig(provider) {
    _activeProvider = provider;
    const prov = PROVIDERS[provider] || {};
    const cfg  = _integrations.find(i=>i.provider===provider)||{};
    const inner= document.getElementById('gps-modal-inner');
    const m    = document.getElementById('gps-modal');
    if (!inner||!m) return;

    const isWebfleet  = provider === 'webfleet';
    const isTeltonika = provider === 'teltonika';

    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0;color:${prov.color}">${prov.label} — konfiguracja</h3>
  <button onclick="window.GpsIntegrations._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<div style="margin-bottom:12px">
  <label style="font-size:12px;color:var(--text3)">Token / Klucz API *</label><br>
  <input type="password" id="gps-token" class="sel" value="">
</div>
${isWebfleet||isTeltonika?`<div style="margin-bottom:12px">
  <label style="font-size:12px;color:var(--text3)">${isTeltonika?'Nazwa użytkownika / Account ID':'Account ID (identyfikator konta)'}</label><br>
  <input type="text" id="gps-account" class="sel" value="${e(cfg.account_id||'')}">
</div>`:''}
${isTeltonika||isWebfleet?`<div style="margin-bottom:12px">
  <label style="font-size:12px;color:var(--text3)">URL serwera (opcjonalnie)</label><br>
  <input type="text" id="gps-url" class="sel" placeholder="${isTeltonika?'https://fm.teltonika.lt':'https://csv.webfleet.com'}">
</div>`:''}
<div style="margin-bottom:14px;display:flex;align-items:center;gap:8px">
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
    const token     = document.getElementById('gps-token')?.value?.trim();
    const account_id= document.getElementById('gps-account')?.value?.trim()||'';
    const server_url= document.getElementById('gps-url')?.value?.trim()||'';
    const enabled   = document.getElementById('gps-enabled')?.checked ? 1 : 0;
    if (!token) { alert('Token jest wymagany'); return; }
    try {
      const r = await fetch(`${API()}/api/gps-integrations/${_activeProvider}?company=${encodeURIComponent(Co())}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, account_id, server_url, enabled })
      });
      if (r.ok) { _closeModal(); await renderGpsIntegrations(); }
      else alert('Błąd zapisu');
    } catch (ex) { alert(ex.message); }
  }

  async function _sync(provider) {
    const btn = document.querySelector(`[data-prov="${provider}"] .btn-primary`) || document.body;
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const r = await fetch(`${API()}/api/gps-integrations/${provider}/sync?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: H()
      });
      const data = r.ok ? await r.json() : {};
      if (data.ok) {
        alert(`Synchronizacja zakończona: ${data.vehicles||0} pojazdów, ${data.positions||0} pozycji`);
        await renderGpsIntegrations();
      } else {
        alert('Błąd synchronizacji: ' + JSON.stringify(data.errors||[]));
      }
    } catch (ex) { alert(ex.message); }
    finally { btn.disabled = false; }
  }

  function _closeModal() {
    const m = document.getElementById('gps-modal');
    if (m) m.style.display = 'none';
  }

  window.GpsIntegrations = { renderGpsIntegrations, _openConfig, _saveConfig, _sync, _closeModal };
})();
