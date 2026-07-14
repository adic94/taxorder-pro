(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const EVENTS_DESC = [
    { key: 'vehicle_added',       label: 'Pojazd dodany',          icon: 'ti-car' },
    { key: 'damage_added',        label: 'Nowa szkoda',             icon: 'ti-alert-triangle' },
    { key: 'alert_triggered',     label: 'Alert terminów',          icon: 'ti-bell' },
    { key: 'fuel_anomaly',        label: 'Anomalia paliwa',         icon: 'ti-gas-station' },
    { key: 'transport_order',     label: 'Nowe zlecenie transportu',icon: 'ti-truck' },
    { key: 'geofence_event',      label: 'Zdarzenie Geofencing',    icon: 'ti-map-pin' },
    { key: 'driver_violation',    label: 'Naruszenie kierowcy',     icon: 'ti-steering-wheel' },
    { key: 'inspection_due',      label: 'Przegląd techniczny',     icon: 'ti-tool' },
    { key: 'insurance_expiry',    label: 'Wygaśnięcie ubezpieczenia',icon:'ti-shield' },
  ];

  let _zapierUrl   = '';
  let _makeUrl     = '';
  let _lastEvents  = [];
  let _testResult  = null;

  async function renderZapierUi() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/zapier/config?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) { const d = await r.json(); _zapierUrl = d.zapier_url || ''; _makeUrl = d.make_url || ''; }
    } catch {}
    try {
      const r2 = await fetch(`${API()}/api/zapier/events?company=${encodeURIComponent(co)}&limit=20`, { headers: H() });
      if (r2.ok) _lastEvents = await r2.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-zapier-ui');
    if (!el) return;
    const pollUrl = `${API()}/api/zapier/events?company=${encodeURIComponent(Co())}`;

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-plug-connected"></i> Zapier / Make — Automatyzacje</h2>
</div>

<!-- Dwa konektory -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:24px">

  <!-- Zapier -->
  <div style="background:var(--bg2);border-radius:12px;padding:20px;border-top:4px solid #ff4a00">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div style="width:44px;height:44px;background:#ff4a00;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px">Zap</div>
      <div>
        <h4 style="margin:0">Zapier</h4>
        <p style="margin:0;font-size:11px;color:var(--text3)">Połącz z 6000+ aplikacjami</p>
      </div>
    </div>
    <label style="font-size:12px;color:var(--text3)">Webhook URL (wklej z Zapier → Catch Hook)</label>
    <input type="url" id="zi-zapier-url" class="sel" style="margin:6px 0 10px" placeholder="https://hooks.zapier.com/hooks/catch/..." value="${e(_zapierUrl)}">
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="window.ZapierUi._saveConfig('zapier')"><i class="ti ti-device-floppy"></i> Zapisz</button>
      ${_zapierUrl ? `<button class="btn" onclick="window.ZapierUi._test('zapier')"><i class="ti ti-send"></i> Test</button>` : ''}
    </div>
  </div>

  <!-- Make (Integromat) -->
  <div style="background:var(--bg2);border-radius:12px;padding:20px;border-top:4px solid #6f42c1">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div style="width:44px;height:44px;background:#6f42c1;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px">Make</div>
      <div>
        <h4 style="margin:0">Make (Integromat)</h4>
        <p style="margin:0;font-size:11px;color:var(--text3)">Zaawansowane scenariusze automatyzacji</p>
      </div>
    </div>
    <label style="font-size:12px;color:var(--text3)">Webhook URL (wklej z Make → Custom Webhook)</label>
    <input type="url" id="zi-make-url" class="sel" style="margin:6px 0 10px" placeholder="https://hook.eu1.make.com/..." value="${e(_makeUrl)}">
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="flex:1" onclick="window.ZapierUi._saveConfig('make')"><i class="ti ti-device-floppy"></i> Zapisz</button>
      ${_makeUrl ? `<button class="btn" onclick="window.ZapierUi._test('make')"><i class="ti ti-send"></i> Test</button>` : ''}
    </div>
  </div>
</div>

<!-- Polling trigger URL -->
<div style="background:var(--bg2);border-radius:12px;padding:20px;margin-bottom:24px">
  <h3 style="font-size:14px;margin:0 0 10px"><i class="ti ti-link"></i> Polling trigger URL (Zapier → New Event Trigger)</h3>
  <p style="font-size:12px;color:var(--text3);margin:0 0 8px">
    Użyj tego URL w Zapier jako "Polling trigger" — Zapier będzie odpytywał co kilka minut po nowe zdarzenia.
    Odpowiedź to tablica JSON z polem <code>id</code> do deduplikacji.
  </p>
  <div style="display:flex;align-items:center;gap:8px">
    <input type="text" value="${e(pollUrl)}" readonly class="sel" style="font-size:11px;font-family:monospace">
    <button class="btn" onclick="navigator.clipboard?.writeText(${JSON.stringify(pollUrl).replace(/"/g,'&quot;')}).then(()=>alert('Skopiowano!'))"><i class="ti ti-copy"></i></button>
  </div>
</div>

<!-- Obsługiwane zdarzenia -->
<div style="background:var(--bg2);border-radius:12px;padding:20px;margin-bottom:24px">
  <h3 style="font-size:14px;margin:0 0 12px"><i class="ti ti-list-check"></i> Obsługiwane zdarzenia</h3>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
    ${EVENTS_DESC.map(ev => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px">
      <i class="ti ${ev.icon}" style="color:var(--blue)"></i> ${ev.label}
    </div>`).join('')}
  </div>
</div>

<!-- Ostatnie zdarzenia -->
<div style="background:var(--bg2);border-radius:12px;padding:20px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <h3 style="font-size:14px;margin:0"><i class="ti ti-history"></i> Ostatnie zdarzenia (do wysłania)</h3>
    <button class="btn-secondary" onclick="window.ZapierUi.renderZapierUi()"><i class="ti ti-refresh"></i> Odśwież</button>
  </div>
  ${_lastEvents.length ? `
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>ID</th><th>Typ zdarzenia</th><th>Pojazd</th><th>Data</th><th>Dane</th></tr></thead>
    <tbody>
    ${_lastEvents.slice(0,15).map(ev => `<tr>
      <td style="font-size:10px;font-family:monospace">${e(String(ev.id||'').slice(0,8))}…</td>
      <td><span class="pill">${e(ev.event_type||ev.type||'—')}</span></td>
      <td>${e(ev.vehicle_reg||ev.entity_id||'—')}</td>
      <td style="font-size:11px">${ev.created_at ? new Date(ev.created_at).toLocaleString('pl-PL') : '—'}</td>
      <td style="font-size:11px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(ev.description||ev.message||JSON.stringify(ev.data||''))}</td>
    </tr>`).join('')}
    </tbody>
  </table></div>` : `<div style="text-align:center;padding:24px;color:var(--text3)">Brak zdarzeń w kolejce</div>`}
</div>`;
  }

  async function _saveConfig(target) {
    const urlVal = target === 'zapier'
      ? document.getElementById('zi-zapier-url')?.value?.trim()
      : document.getElementById('zi-make-url')?.value?.trim();
    if (!urlVal) { alert('Podaj URL webhooka'); return; }
    if (!urlVal.startsWith('https://')) { alert('URL musi zaczynać się od https://'); return; }
    try {
      const r = await fetch(`${API()}/api/zapier/config?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, url: urlVal })
      });
      if (r.ok) { if (target === 'zapier') _zapierUrl = urlVal; else _makeUrl = urlVal; _render(); alert('Zapisano!'); }
      else alert('Błąd zapisu: ' + await r.text());
    } catch (ex) { alert(ex.message); }
  }

  async function _test(target) {
    const url = target === 'zapier' ? _zapierUrl : _makeUrl;
    if (!url) return;
    try {
      const r = await fetch(`${API()}/api/zapier/test?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, webhook_url: url })
      });
      const d = r.ok ? await r.json() : {};
      alert(d.ok ? `Test wysłany! Status odpowiedzi: ${d.status||'OK'}` : `Błąd testu: ${d.error || r.status}`);
    } catch (ex) { alert(ex.message); }
  }

  window.ZapierUi = { renderZapierUi, _saveConfig, _test };
})();
