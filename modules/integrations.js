(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const PROVIDERS = {
    shell:     { label: 'Shell Flota',   icon: 'ti-gas-station', color: '#e8a000' },
    dkv:       { label: 'DKV Mobility',  icon: 'ti-credit-card', color: '#003087' },
    navifleet: { label: 'Navifleet GPS', icon: 'ti-map-pin',     color: '#1d8348' },
  };

  let _tab      = 'shell';
  let _settings = {};  // provider → config (masked)
  let _logs     = {};  // provider → last 10 sync logs
  let _loading  = {};  // provider → bool
  let _saving   = false;

  // ── render ──

  async function renderIntegrations() {
    const el = document.getElementById('page-integrations');
    if (!el) return;
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text3)"><i class="ti ti-loader" style="font-size:32px"></i><br>Ładowanie...</div>';
    await _loadAll();
    _render();
  }

  async function _loadAll() {
    try {
      const r = await fetch(`${API()}/api/integrations?company=${encodeURIComponent(Co())}`, { headers: H() });
      if (r.ok) {
        const rows = await r.json();
        for (const row of rows) _settings[row.provider] = row;
      }
    } catch {}
    for (const provider of Object.keys(PROVIDERS)) {
      try {
        const r = await fetch(`${API()}/api/integrations/${provider}/log?company=${encodeURIComponent(Co())}`, { headers: H() });
        if (r.ok) _logs[provider] = await r.json();
      } catch {}
    }
  }

  function _render() {
    const el = document.getElementById('page-integrations');
    if (!el) return;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-plug"></i> Integracje zewnętrzne — auto-sync kart i GPS</h2>
</div>
<div style="background:var(--blue-light,#eff6ff);border:1px solid var(--blue);border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:var(--blue)">
  <i class="ti ti-info-circle"></i> Integracje pobierają dane automatycznie każdej nocy (03:00). Możesz też uruchomić synchronizację ręcznie. Każdy dostawca wymaga osobnego konta i danych API.
</div>

<div style="display:flex;gap:0;margin-bottom:20px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
  ${Object.entries(PROVIDERS).map(([k, v]) => {
    const st = _settings[k];
    const ok = st?.last_sync_status === 'ok';
    const err = st?.last_sync_status === 'error';
    return `<button onclick="window.IntegrationsModule._setTab('${k}')"
      style="flex:1;padding:12px;border:none;cursor:pointer;font-size:13px;font-weight:${_tab===k?700:400};
      background:${_tab===k?'var(--blue)':'var(--bg-card)'};color:${_tab===k?'#fff':'var(--text2)'};
      border-right:1px solid var(--border);display:flex;flex-direction:column;align-items:center;gap:4px">
      <i class="ti ${v.icon}" style="font-size:20px;color:${_tab===k?'#fff':v.color}"></i>
      ${v.label}
      ${st?.last_sync ? `<span style="font-size:10px;color:${_tab===k?'rgba(255,255,255,.8)':ok?'var(--green)':err?'var(--red)':'var(--text3)'};font-weight:400">
        ${ok?'✓':err?'✗':'–'} ${st.last_sync_count||0} rek.</span>` : '<span style="font-size:10px;color:var(--text3);font-weight:400">nie skonfigurowano</span>'}
    </button>`;
  }).join('')}
</div>

<div id="integration-tab-content">
  ${_tabHtml(_tab)}
</div>`;
  }

  function _tabHtml(provider) {
    if (provider === 'shell')     return _shellTab();
    if (provider === 'dkv')       return _dkvTab();
    if (provider === 'navifleet') return _navifleetTab();
    return '';
  }

  // ── Shell Tab ──

  function _shellTab() {
    const cfg = _getConfig('shell');
    return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
<div>
  <h3 style="font-size:14px;font-weight:600;margin-bottom:4px"><i class="ti ti-gas-station" style="color:#e8a000"></i> Shell Fleet Card API</h3>
  <p style="font-size:12px;color:var(--text2);margin-bottom:16px">
    Wymagane konto Shell Flota Business + dostęp API przez
    <a href="https://developer.shell.com" target="_blank" style="color:var(--blue)">developer.shell.com</a>.
    Transakcje pobierane są z ostatnich N dni i zapisywane do tankowań.
  </p>
  <div class="f" style="margin-bottom:10px">
    <label style="font-size:12px">Client ID <span style="color:var(--red)">*</span></label>
    <input id="shell-client-id" class="form-input" value="${e(cfg.client_id||'')}" placeholder="np. 4a1b2c3d-xxxx">
  </div>
  <div class="f" style="margin-bottom:10px">
    <label style="font-size:12px">Client Secret <span style="color:var(--red)">*</span></label>
    <input id="shell-client-secret" class="form-input" type="password" value="${e(cfg.client_secret||'')}" placeholder="••••••••">
  </div>
  <div class="f" style="margin-bottom:10px">
    <label style="font-size:12px">ColCo Code <small style="color:var(--text3)">(kraj — Polska = PL lub 18)</small></label>
    <input id="shell-colco" class="form-input" value="${e(cfg.colco_code||'PL')}" placeholder="PL">
  </div>
  <div class="f" style="margin-bottom:16px">
    <label style="font-size:12px">Payer Number <span style="color:var(--red)">*</span></label>
    <input id="shell-payer" class="form-input" value="${e(cfg.payer_number||'')}" placeholder="GB99213576">
  </div>
  <div class="f" style="margin-bottom:16px">
    <label style="font-size:12px">Dni wstecz przy synchronizacji</label>
    <input id="shell-days" class="form-input" type="number" min="1" max="90" value="${e(String(cfg.days_back||7))}" style="width:80px">
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn-primary" onclick="window.IntegrationsModule._save('shell')" ${_saving?'disabled':''}>
      <i class="ti ti-device-floppy"></i> Zapisz
    </button>
    <button class="btn-secondary" onclick="window.IntegrationsModule._test('shell')" ${_loading.shell?'disabled':''}>
      <i class="ti ti-plug-connected"></i> Test połączenia
    </button>
    <button class="btn-secondary" onclick="window.IntegrationsModule._sync('shell')" ${_loading.shell?'disabled':''}>
      ${_loading.shell?'<i class="ti ti-loader"></i> Synchronizacja...':'<i class="ti ti-refresh"></i> Synchronizuj teraz'}
    </button>
  </div>
</div>
<div>
  ${_syncStatusHtml('shell')}
  ${_logHtml('shell')}
</div>
</div>`;
  }

  // ── DKV Tab ──

  function _dkvTab() {
    const cfg = _getConfig('dkv');
    return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
<div>
  <h3 style="font-size:14px;font-weight:600;margin-bottom:4px"><i class="ti ti-credit-card" style="color:#003087"></i> DKV Mobility API</h3>
  <p style="font-size:12px;color:var(--text2);margin-bottom:16px">
    Wymagane konto DKV + dostęp API Enterprise przez
    <a href="https://api-portal.dkv-mobility.com" target="_blank" style="color:var(--blue)">api-portal.dkv-mobility.com</a>.
    Pobiera transakcje rozliczone i nierozliczone.
  </p>
  <div class="f" style="margin-bottom:10px">
    <label style="font-size:12px">Subscription Key <span style="color:var(--red)">*</span></label>
    <input id="dkv-subkey" class="form-input" type="password" value="${e(cfg.subscription_key||'')}" placeholder="••••••••">
  </div>
  <div class="f" style="margin-bottom:10px">
    <label style="font-size:12px">Client ID (OAuth)</label>
    <input id="dkv-client-id" class="form-input" value="${e(cfg.client_id||'')}" placeholder="opcjonalnie">
  </div>
  <div class="f" style="margin-bottom:10px">
    <label style="font-size:12px">Client Secret (OAuth)</label>
    <input id="dkv-client-secret" class="form-input" type="password" value="${e(cfg.client_secret||'')}" placeholder="••••••••">
  </div>
  <div class="f" style="margin-bottom:16px">
    <label style="font-size:12px">Numer klienta DKV <span style="color:var(--red)">*</span></label>
    <input id="dkv-customer" class="form-input" value="${e(cfg.customer_number||'')}" placeholder="np. 1234567">
  </div>
  <div class="f" style="margin-bottom:16px">
    <label style="font-size:12px">Dni wstecz przy synchronizacji</label>
    <input id="dkv-days" class="form-input" type="number" min="1" max="90" value="${e(String(cfg.days_back||7))}" style="width:80px">
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn-primary" onclick="window.IntegrationsModule._save('dkv')" ${_saving?'disabled':''}>
      <i class="ti ti-device-floppy"></i> Zapisz
    </button>
    <button class="btn-secondary" onclick="window.IntegrationsModule._test('dkv')" ${_loading.dkv?'disabled':''}>
      <i class="ti ti-plug-connected"></i> Test połączenia
    </button>
    <button class="btn-secondary" onclick="window.IntegrationsModule._sync('dkv')" ${_loading.dkv?'disabled':''}>
      ${_loading.dkv?'<i class="ti ti-loader"></i> Synchronizacja...':'<i class="ti ti-refresh"></i> Synchronizuj teraz'}
    </button>
  </div>
</div>
<div>
  ${_syncStatusHtml('dkv')}
  ${_logHtml('dkv')}
</div>
</div>`;
  }

  // ── Navifleet Tab ──

  function _navifleetTab() {
    const cfg = _getConfig('navifleet');
    return `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
<div>
  <h3 style="font-size:14px;font-weight:600;margin-bottom:4px"><i class="ti ti-map-pin" style="color:#1d8348"></i> Navifleet GPS API</h3>
  <p style="font-size:12px;color:var(--text2);margin-bottom:16px">
    Dla użytkowników GPS Navifleet. Klucz API generujesz w
    <a href="https://gps.navifleet.pl" target="_blank" style="color:var(--blue)">gps.navifleet.pl</a>
    → Ustawienia → Integracje → API. Pobiera tankowania z GPS i styl jazdy kierowców.
  </p>
  <div class="f" style="margin-bottom:10px">
    <label style="font-size:12px">API Key <span style="color:var(--red)">*</span></label>
    <input id="navi-apikey" class="form-input" type="password" value="${e(cfg.api_key||'')}" placeholder="••••••••">
  </div>
  <div class="f" style="margin-bottom:16px">
    <label style="font-size:12px">Dni wstecz przy synchronizacji</label>
    <input id="navi-days" class="form-input" type="number" min="1" max="90" value="${e(String(cfg.days_back||7))}" style="width:80px">
  </div>
  <div style="background:var(--bg);border-radius:6px;padding:10px 12px;margin-bottom:16px;font-size:11px;color:var(--text2)">
    <strong>Co jest synchronizowane:</strong><br>
    • Tankowania z czujników GPS → zakładka Paliwo<br>
    • Dane eco-drivingu → Scoring kierowców<br>
    • Nr rejestracyjne dopasowywane automatycznie
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn-primary" onclick="window.IntegrationsModule._save('navifleet')" ${_saving?'disabled':''}>
      <i class="ti ti-device-floppy"></i> Zapisz
    </button>
    <button class="btn-secondary" onclick="window.IntegrationsModule._test('navifleet')" ${_loading.navifleet?'disabled':''}>
      <i class="ti ti-plug-connected"></i> Test połączenia
    </button>
    <button class="btn-secondary" onclick="window.IntegrationsModule._sync('navifleet')" ${_loading.navifleet?'disabled':''}>
      ${_loading.navifleet?'<i class="ti ti-loader"></i> Synchronizacja...':'<i class="ti ti-refresh"></i> Synchronizuj teraz'}
    </button>
  </div>
</div>
<div>
  ${_syncStatusHtml('navifleet')}
  ${_logHtml('navifleet')}
</div>
</div>`;
  }

  // ── Status + log helpers ──

  function _syncStatusHtml(provider) {
    const st = _settings[provider];
    if (!st?.last_sync) return `<div style="padding:16px;border-radius:8px;background:var(--bg);font-size:12px;color:var(--text3);margin-bottom:12px">
      <i class="ti ti-clock-off"></i> Nie synchronizowano jeszcze — wprowadź dane i kliknij "Synchronizuj teraz"
    </div>`;
    const ok = st.last_sync_status === 'ok';
    return `<div style="padding:12px 14px;border-radius:8px;border:1px solid ${ok?'var(--green,#22c55e)':'var(--red,#ef4444)'};
      background:${ok?'var(--green-light,#f0fdf4)':'var(--red-light,#fff1f2)'};font-size:12px;margin-bottom:12px">
      <div style="font-weight:600;color:${ok?'var(--green,#16a34a)':'var(--red,#dc2626)'};margin-bottom:4px">
        ${ok?'<i class="ti ti-circle-check"></i> Ostatnia synchronizacja OK':'<i class="ti ti-circle-x"></i> Ostatnia synchronizacja — błąd'}
      </div>
      <div style="color:var(--text2)">${e(st.last_sync?.replace('T',' ').slice(0,16)||'')}</div>
      <div style="margin-top:4px"><strong>${st.last_sync_count||0}</strong> rekordów zaimportowanych</div>
    </div>`;
  }

  function _logHtml(provider) {
    const logs = _logs[provider] || [];
    if (!logs.length) return '';
    return `<div>
      <div style="font-size:12px;font-weight:600;margin-bottom:8px">Historia synchronizacji</div>
      <div class="table-wrap" style="max-height:220px;overflow-y:auto">
      <table class="data-table" style="font-size:11px">
      <thead><tr><th>Czas</th><th>Status</th><th>Import.</th><th>Pomin.</th></tr></thead>
      <tbody>
      ${logs.map(l => `<tr>
        <td style="white-space:nowrap">${e((l.synced_at||'').slice(0,16).replace('T',' '))}</td>
        <td><span class="pill ${l.status==='ok'?'ok':'danger'}" style="font-size:10px">${e(l.status)}</span>
          ${l.error_message?`<span title="${e(l.error_message)}" style="cursor:help;color:var(--red)"> ⚠</span>`:''}</td>
        <td>${l.records_imported||0}</td>
        <td>${l.records_skipped||0}</td>
      </tr>`).join('')}
      </tbody></table></div>
    </div>`;
  }

  // ── helpers ──

  function _getConfig(provider) {
    return JSON.parse(_settings[provider]?.config || '{}');
  }

  function _setTab(tab) {
    _tab = tab;
    const el = document.getElementById('integration-tab-content');
    if (el) el.innerHTML = _tabHtml(tab);
    document.querySelectorAll('[onclick^="window.IntegrationsModule._setTab"]').forEach((btn, i) => {
      const p = Object.keys(PROVIDERS)[i];
      btn.style.background = p === tab ? 'var(--blue)' : 'var(--bg-card)';
      btn.style.color = p === tab ? '#fff' : 'var(--text2)';
      btn.style.fontWeight = p === tab ? '700' : '400';
    });
  }

  function _readConfig(provider) {
    if (provider === 'shell') return {
      client_id:     document.getElementById('shell-client-id')?.value?.trim(),
      client_secret: document.getElementById('shell-client-secret')?.value?.trim(),
      colco_code:    document.getElementById('shell-colco')?.value?.trim() || 'PL',
      payer_number:  document.getElementById('shell-payer')?.value?.trim(),
      days_back:     parseInt(document.getElementById('shell-days')?.value) || 7,
    };
    if (provider === 'dkv') return {
      subscription_key: document.getElementById('dkv-subkey')?.value?.trim(),
      client_id:        document.getElementById('dkv-client-id')?.value?.trim(),
      client_secret:    document.getElementById('dkv-client-secret')?.value?.trim(),
      customer_number:  document.getElementById('dkv-customer')?.value?.trim(),
      days_back:        parseInt(document.getElementById('dkv-days')?.value) || 7,
    };
    if (provider === 'navifleet') return {
      api_key:   document.getElementById('navi-apikey')?.value?.trim(),
      days_back: parseInt(document.getElementById('navi-days')?.value) || 7,
    };
    return {};
  }

  // ── actions ──

  async function _save(provider) {
    const config = _readConfig(provider);
    _saving = true;
    try {
      const r = await fetch(`${API()}/api/integrations/${provider}?company=${encodeURIComponent(Co())}`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!r.ok) throw new Error(await r.text());
      if (!_settings[provider]) _settings[provider] = { provider };
      _settings[provider].config = JSON.stringify(config);
      alert('Zapisano konfigurację integracji.');
    } catch (ex) { alert('Błąd zapisu: ' + ex.message); }
    _saving = false;
    _render();
  }

  async function _test(provider) {
    await _save(provider);
    _loading[provider] = true; _render();
    try {
      const r = await fetch(`${API()}/api/integrations/${provider}/sync?company=${encodeURIComponent(Co())}`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_back: 1, test_only: true }),
      });
      const d = await r.json();
      if (d.error) alert(`❌ Test połączenia nie powiódł się:\n${d.error}`);
      else alert(`✅ Połączenie działa!\nToken/klucz zaakceptowany przez ${PROVIDERS[provider].label}.`);
    } catch (ex) { alert('❌ Błąd połączenia: ' + ex.message); }
    _loading[provider] = false; _render();
  }

  async function _sync(provider) {
    _loading[provider] = true; _render();
    try {
      const cfg = _readConfig(provider);
      const r = await fetch(`${API()}/api/integrations/${provider}/sync?company=${encodeURIComponent(Co())}`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_back: cfg.days_back || 7 }),
      });
      const d = await r.json();
      if (d.error) {
        alert(`❌ Synchronizacja nie powiodła się:\n${d.error}`);
      } else {
        alert(`✅ Synchronizacja ${PROVIDERS[provider].label} zakończona!\n✓ Zaimportowano: ${d.imported}\n⏭ Pominięte (duplikaty): ${d.skipped}`);
      }
      await _loadAll();
    } catch (ex) { alert('Błąd: ' + ex.message); }
    _loading[provider] = false; _render();
  }

  window.IntegrationsModule = { renderIntegrations, _setTab, _save, _test, _sync };
})();
