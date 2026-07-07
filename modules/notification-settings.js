/**
 * TaxOrder Pro — Centrum ustawień powiadomień
 * Zakładki: Alerty | Kanały | Szablony | Historia
 */
window.TaxOrderNotifSettings = (function () {

  const API = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const token = () => localStorage.getItem('cf_token');
  const hdrs = (extra) => ({ 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}), ...(extra || {}) });
  const company = () => window.currentCompanyId || 'mtoilet';

  let _alertTypes = [];
  let _prefs = {};       // alert_type_id → pref row
  let _templates = [];
  let _log = [];
  let _activeTab = 'alerty';

  const CATEGORIES = {
    dokumenty:   { label: 'Dokumenty & Ubezpieczenia', icon: 'ti-file-certificate', color: '#1d4ed8' },
    serwis:      { label: 'Serwis & Konserwacja',       icon: 'ti-tool',             color: '#d97706' },
    wyposazenie: { label: 'Wyposażenie & Zabudowa',     icon: 'ti-briefcase',        color: '#059669' },
    wlasny:      { label: 'Własne typy',                icon: 'ti-star',             color: '#7c3aed' },
  };

  // ── API calls ───────────────────────────────────────────────────────────────
  async function _loadAlertTypes() {
    const r = await fetch(`${API()}/api/alert-types?company=${company()}`, { headers: hdrs() });
    const d = r.ok ? await r.json() : {};
    _alertTypes = d.types || d || [];
  }
  async function _loadPrefs() {
    const r = await fetch(`${API()}/api/notif-prefs`, { headers: hdrs() });
    const d = r.ok ? await r.json() : {};
    const list = d.prefs || d || [];
    _prefs = {};
    list.forEach(p => { _prefs[p.alert_type_id] = p; });
  }
  async function _loadTemplates() {
    const r = await fetch(`${API()}/api/maintenance-templates?company=${company()}`, { headers: hdrs() });
    const d = r.ok ? await r.json() : {};
    _templates = d.templates || d || [];
  }
  async function _loadLog() {
    const r = await fetch(`${API()}/api/notif-log?company=${company()}&limit=100`, { headers: hdrs() });
    const d = r.ok ? await r.json() : {};
    _log = d.entries || d || [];
  }

  async function _savePref(typeId, patch) {
    const cur = _prefs[typeId] || {};
    const body = {
      alert_type_id:  typeId,
      enabled:        patch.enabled  ?? (cur.enabled  !== 0),
      channels:       patch.channels ?? (cur.channels  ? JSON.parse(cur.channels)  : { push: true, email: false, sms: false }),
      threshold_days: patch.threshold_days ?? (cur.threshold_days ? JSON.parse(cur.threshold_days) : null),
      threshold_km:   patch.threshold_km   ?? cur.threshold_km   ?? null,
      quiet_from:     patch.quiet_from     ?? cur.quiet_from     ?? '22:00',
      quiet_to:       patch.quiet_to       ?? cur.quiet_to       ?? '07:00',
    };
    await fetch(`${API()}/api/notif-prefs`, { method: 'PUT', headers: hdrs(), body: JSON.stringify(body) });
    _prefs[typeId] = { ...cur, ...body,
      channels: JSON.stringify(body.channels),
      threshold_days: body.threshold_days ? JSON.stringify(body.threshold_days) : null };
  }

  // ── Render główna strona ─────────────────────────────────────────────────────
  async function load() {
    const el = document.getElementById('page-powiadomienia');
    if (!el) return;
    el.innerHTML = `<div style="padding:20px 24px;max-width:1100px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <i class="ti ti-bell-cog" style="font-size:24px;color:var(--blue)"></i>
        <h2 style="margin:0;font-size:20px">Centrum powiadomień</h2>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap" id="ns-tabs">
        ${['alerty','kanaly','szablony','historia'].map(t => `
          <button id="ns-tab-${t}" onclick="TaxOrderNotifSettings._tab('${t}')"
            class="btn ${_activeTab===t?'btn-blue':'btn-gray'}" style="font-size:12px">
            <i class="ti ${t==='alerty'?'ti-bell':t==='kanaly'?'ti-send':t==='szablony'?'ti-template':'ti-history'}"></i>
            ${t==='alerty'?'Moje alerty':t==='kanaly'?'Kanały & Cicha godzina':t==='szablony'?'Szablony konserwacji':'Historia alertów'}
          </button>`).join('')}
      </div>
      <div id="ns-content"><div class="loading-spinner" style="padding:40px;text-align:center"><i class="ti ti-loader ti-spin" style="font-size:32px"></i></div></div>
    </div>`;

    await Promise.all([_loadAlertTypes(), _loadPrefs()]);
    _renderTab(_activeTab);
  }

  function _tab(name) {
    _activeTab = name;
    document.querySelectorAll('[id^="ns-tab-"]').forEach(b => {
      b.className = 'btn ' + (b.id === 'ns-tab-' + name ? 'btn-blue' : 'btn-gray');
      b.style.fontSize = '12px';
    });
    _renderTab(name);
  }

  async function _renderTab(name) {
    const el = document.getElementById('ns-content');
    if (!el) return;
    if (name === 'alerty')   { _renderAlerty(el); return; }
    if (name === 'kanaly')   { _renderKanaly(el); return; }
    if (name === 'szablony') { await _loadTemplates(); _renderSzablony(el); return; }
    if (name === 'historia') { await _loadLog(); _renderHistoria(el); return; }
  }

  // ── Zakładka: Alerty ────────────────────────────────────────────────────────
  function _renderAlerty(el) {
    const byCategory = {};
    _alertTypes.forEach(at => {
      if (!byCategory[at.category]) byCategory[at.category] = [];
      byCategory[at.category].push(at);
    });

    const sections = Object.entries(CATEGORIES).map(([cat, meta]) => {
      const types = byCategory[cat] || [];
      if (!types.length && cat !== 'wlasny') return '';
      const rows = types.map(at => _alertTypeRow(at)).join('');
      const addBtn = (cat === 'wlasny' || true) ? '' : '';
      return `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <i class="ti ${meta.icon}" style="font-size:16px;color:${meta.color}"></i>
            <strong style="font-size:13px">${meta.label}</strong>
            ${cat === 'wlasny' ? `<button class="btn btn-gray" style="font-size:11px;margin-left:auto" onclick="TaxOrderNotifSettings._addCustomType()"><i class="ti ti-plus"></i>Nowy typ</button>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div style="background:var(--blue-light,#EFF6FF);border:1px solid #BFDBFE;border-radius:var(--radius);padding:10px 14px;margin-bottom:16px;font-size:12px;color:#1d4ed8">
        <i class="ti ti-info-circle"></i> Alerty są sprawdzane codziennie o 3:00 UTC. Dla alertów km-based wymagany aktualny licznik pojazdu.
      </div>
      ${sections}
      <div style="margin-top:8px">
        <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderNotifSettings._addCustomType()">
          <i class="ti ti-plus"></i>Dodaj własny typ alertu
        </button>
      </div>`;
  }

  function _alertTypeRow(at) {
    const pref = _prefs[at.id] || {};
    const enabled = pref.enabled !== 0;
    const channels = pref.channels ? JSON.parse(pref.channels) : { push: true, email: false, sms: false };
    const threshDays = pref.threshold_days ? JSON.parse(pref.threshold_days) : JSON.parse(at.default_days || '[30,14,7]');
    const threshKm = pref.threshold_km ?? at.default_km ?? null;

    const dayPills = threshDays.map((d, i) =>
      `<span style="display:inline-flex;align-items:center;gap:3px;background:var(--bg3);border:1px solid var(--border);border-radius:99px;padding:2px 8px;font-size:11px;cursor:pointer"
        onclick="TaxOrderNotifSettings._removeDay('${at.id}', ${i})">${d}d <i class="ti ti-x" style="font-size:9px;opacity:.6"></i></span>`
    ).join('');

    return `<div id="atr-${at.id}" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;
      display:flex;flex-wrap:wrap;align-items:flex-start;gap:10px;${enabled?'':'opacity:.55'}">
      <!-- Toggle -->
      <label style="display:flex;align-items:center;gap:6px;min-width:200px;cursor:pointer">
        <input type="checkbox" ${enabled?'checked':''} onchange="TaxOrderNotifSettings._toggleEnabled('${at.id}',this.checked)" style="width:15px;height:15px;cursor:pointer">
        <i class="ti ${at.icon}" style="color:${CATEGORIES[at.category]?.color||'var(--text2)'}"></i>
        <span style="font-size:13px;font-weight:600">${at.name}</span>
        ${at.company_id ? `<span style="font-size:10px;background:var(--bg3);padding:1px 6px;border-radius:99px;color:var(--text2)">własny</span>` : ''}
      </label>
      <!-- Progi dni -->
      ${at.trigger_time ? `
      <div style="flex:1;min-width:220px">
        <div style="font-size:11px;color:var(--text2);margin-bottom:4px">Alerty (dni przed terminem):</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">
          ${dayPills}
          <button class="btn btn-gray" style="font-size:10px;padding:2px 8px;border-radius:99px"
            onclick="TaxOrderNotifSettings._addDay('${at.id}')"><i class="ti ti-plus"></i>Dodaj</button>
        </div>
      </div>` : ''}
      <!-- Próg km -->
      ${at.trigger_km ? `
      <div style="min-width:140px">
        <div style="font-size:11px;color:var(--text2);margin-bottom:4px">Alert km przed:</div>
        <div style="display:flex;align-items:center;gap:4px">
          <input type="number" min="0" step="100" value="${threshKm ?? ''}" placeholder="np. 500"
            style="width:80px;font-size:12px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg)"
            onchange="TaxOrderNotifSettings._saveKm('${at.id}',this.value)">
          <span style="font-size:11px;color:var(--text2)">km</span>
        </div>
      </div>` : ''}
      <!-- Kanały -->
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
        ${['push','email','sms'].map(ch => `
          <label style="display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer">
            <input type="checkbox" ${channels[ch]?'checked':''} style="cursor:pointer"
              onchange="TaxOrderNotifSettings._toggleChannel('${at.id}','${ch}',this.checked)">
            <i class="ti ${ch==='push'?'ti-device-mobile':ch==='email'?'ti-mail':'ti-message'}"></i>${ch.toUpperCase()}
          </label>`).join('')}
      </div>
      ${at.company_id ? `<button class="btn btn-gray" style="font-size:10px;padding:3px 8px;color:var(--red);flex-shrink:0"
        onclick="TaxOrderNotifSettings._deleteCustomType('${at.id}')"><i class="ti ti-trash"></i></button>` : ''}
    </div>`;
  }

  // ── Zakładka: Kanały ─────────────────────────────────────────────────────────
  function _renderKanaly(el) {
    const firstPref = Object.values(_prefs)[0] || {};
    const quietFrom = firstPref.quiet_from || '22:00';
    const quietTo   = firstPref.quiet_to   || '07:00';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
        <!-- Push -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <i class="ti ti-device-mobile" style="font-size:18px;color:#7c3aed"></i>
            <strong>Push (aplikacja)</strong>
          </div>
          <div id="push-status-msg" style="font-size:12px;color:var(--text2);margin-bottom:10px">Sprawdzam...</div>
          <div style="display:flex;gap:6px">
            <button id="push-enable-btn" class="btn btn-blue" style="font-size:11px" onclick="TaxOrderNotifSettings._enablePush()">
              <i class="ti ti-bell-ringing"></i>Włącz push
            </button>
            <button id="push-disable-btn" class="btn btn-gray" style="font-size:11px;display:none" onclick="TaxOrderNotifSettings._disablePush()">
              <i class="ti ti-bell-off"></i>Wyłącz
            </button>
            <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderNotifSettings._testPush()">
              <i class="ti ti-send"></i>Test push
            </button>
            <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderNotifSettings._triggerQueue()">
              <i class="ti ti-player-play"></i>Wyzwól kolejkę
            </button>
          </div>
        </div>
        <!-- Email -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <i class="ti ti-mail" style="font-size:18px;color:#d97706"></i>
            <strong>Email</strong>
            <span style="font-size:10px;background:var(--amber,#fef3c7);color:#92400e;padding:2px 6px;border-radius:99px">Faza 2</span>
          </div>
          <div style="font-size:12px;color:var(--text2)">Dostępne w Fazie 2 po konfiguracji RESEND_API_KEY.</div>
        </div>
        <!-- SMS -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <i class="ti ti-message" style="font-size:18px;color:#059669"></i>
            <strong>SMS</strong>
            <span style="font-size:10px;background:var(--amber,#fef3c7);color:#92400e;padding:2px 6px;border-radius:99px">Faza 3</span>
          </div>
          <div style="font-size:12px;color:var(--text2)">Dostępne w Fazie 3 po konfiguracji SMSAPI_TOKEN.</div>
        </div>
      </div>
      <!-- Cicha godzina -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-top:16px;max-width:400px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <i class="ti ti-moon" style="font-size:18px;color:#4f46e5"></i>
          <strong>Cicha godzina</strong>
          <span style="font-size:11px;color:var(--text2)">(nie wysyłaj powiadomień)</span>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <div>
            <div style="font-size:11px;color:var(--text2);margin-bottom:3px">Od</div>
            <input type="time" id="quiet-from" value="${quietFrom}" class="fi" style="width:100px">
          </div>
          <div>
            <div style="font-size:11px;color:var(--text2);margin-bottom:3px">Do</div>
            <input type="time" id="quiet-to" value="${quietTo}" class="fi" style="width:100px">
          </div>
          <button class="btn btn-blue" style="font-size:11px;margin-top:14px" onclick="TaxOrderNotifSettings._saveQuiet()">
            <i class="ti ti-check"></i>Zapisz
          </button>
        </div>
      </div>`;

    _updatePushStatus();
  }

  async function _updatePushStatus() {
    const st = await window.TaxOrderNotifications?.getPushStatus?.();
    const msg = document.getElementById('push-status-msg');
    const enableBtn = document.getElementById('push-enable-btn');
    const disableBtn = document.getElementById('push-disable-btn');
    if (!msg) return;
    if (st === 'subscribed') {
      msg.innerHTML = '<i class="ti ti-check" style="color:var(--green)"></i> Push aktywny — alerty dotrą gdy aplikacja jest zamknięta';
      enableBtn?.style.setProperty('display','none');
      disableBtn?.style.removeProperty('display');
    } else if (st === 'not-subscribed') {
      msg.innerHTML = '<i class="ti ti-bell-off" style="color:var(--text2)"></i> Push nieaktywny';
      enableBtn?.style.removeProperty('display');
      disableBtn?.style.setProperty('display','none');
    } else if (st === 'no-sw') {
      msg.innerHTML = '<i class="ti ti-alert-triangle" style="color:var(--amber)"></i> Service Worker niedostępny';
    } else {
      msg.innerHTML = '<i class="ti ti-x" style="color:var(--text2)"></i> Przeglądarka nie obsługuje Push API';
    }
  }

  // ── Zakładka: Szablony ──────────────────────────────────────────────────────
  function _renderSzablony(el) {
    const rows = _templates.map(t => `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px;margin-bottom:2px">${t.name}</div>
            ${t.description ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">${t.description}</div>` : ''}
            <div style="display:flex;flex-wrap:wrap;gap:5px">
              ${(t.items||[]).map(item => {
                const at = _alertTypes.find(a=>a.id===item.typeId);
                return `<span style="font-size:11px;background:var(--bg3);border:1px solid var(--border);border-radius:99px;padding:2px 8px">
                  <i class="ti ${at?.icon||'ti-tool'}"></i> ${item.label||at?.name||item.typeId}
                  ${item.intervalDays ? `· co ${item.intervalDays} dni` : ''}
                  ${item.intervalKm   ? `· co ${item.intervalKm} km`   : ''}
                </span>`;
              }).join('')}
              ${!t.items?.length ? '<span style="font-size:11px;color:var(--text2)">Brak elementów</span>' : ''}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn btn-blue" style="font-size:11px" onclick="TaxOrderNotifSettings._applyTemplate('${t.id}','${t.name}')">
              <i class="ti ti-truck"></i>Przypisz do pojazdów
            </button>
            <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderNotifSettings._editTemplate('${t.id}')">
              <i class="ti ti-pencil"></i>
            </button>
            <button class="btn btn-gray" style="font-size:11px;color:var(--red)" onclick="TaxOrderNotifSettings._deleteTemplate('${t.id}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>
      </div>`).join('');

    el.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-blue" onclick="TaxOrderNotifSettings._newTemplate()"><i class="ti ti-plus"></i>Nowy szablon</button>
      </div>
      ${rows || '<div style="text-align:center;padding:40px;color:var(--text3)"><i class="ti ti-template" style="font-size:36px;display:block;margin-bottom:8px"></i>Brak szablonów — utwórz pierwszy szablon</div>'}`;
  }

  // ── Zakładka: Historia ──────────────────────────────────────────────────────
  function _renderHistoria(el) {
    if (!_log.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)"><i class="ti ti-history" style="font-size:36px;display:block;margin-bottom:8px"></i>Brak historii powiadomień</div>';
      return;
    }
    const rows = _log.map(entry => {
      const dt = new Date(entry.sent_at + (entry.sent_at.includes('T') ? '' : 'Z')).toLocaleString('pl-PL');
      const acked = !!entry.acknowledged_at;
      const snoozed = entry.snoozed_until && new Date(entry.snoozed_until) > new Date();
      const statusBadge = acked
        ? `<span style="font-size:10px;background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:99px">Potwierdzone</span>`
        : snoozed
        ? `<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:99px">Odłożone</span>`
        : `<span style="font-size:10px;background:var(--bg3);color:var(--text2);padding:2px 7px;border-radius:99px">Nowe</span>`;
      const chIcon = { push:'ti-device-mobile', email:'ti-mail', sms:'ti-message', inapp:'ti-bell' }[entry.channel] || 'ti-bell';
      return `<tr>
        <td style="font-size:11px;color:var(--text2)">${dt}</td>
        <td>${entry.vehicle_nr_rej ? `<strong>${entry.vehicle_nr_rej}</strong>` : '—'}</td>
        <td style="font-size:12px">${entry.label}</td>
        <td style="font-size:11px">${entry.days_until !== null && entry.days_until !== undefined ? (entry.days_until < 0 ? `<span style="color:var(--red)">Wygasło ${Math.abs(entry.days_until)} dni temu</span>` : `za ${entry.days_until} dni`) : (entry.km_until !== null ? `za ${entry.km_until} km` : '—')}</td>
        <td><i class="ti ${chIcon}"></i></td>
        <td>${statusBadge}</td>
        <td>
          ${!acked && !snoozed ? `
            <div style="display:flex;gap:4px">
              <button class="tbtn" onclick="TaxOrderNotifSettings._logAction('acknowledge','${entry.id}')" title="Potwierdź"><i class="ti ti-check"></i></button>
              <button class="tbtn" onclick="TaxOrderNotifSettings._logSnooze('${entry.id}')" title="Odłóż"><i class="ti ti-clock-pause"></i></button>
            </div>` : ''}
        </td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
        <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderNotifSettings._refreshLog()"><i class="ti ti-refresh"></i>Odśwież</button>
      </div>
      <div class="tbl-wrap" style="overflow-x:auto">
        <table style="min-width:700px">
          <thead><tr><th>Kiedy</th><th>Pojazd</th><th>Alert</th><th>Pozostało</th><th>Kanał</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Akcje użytkownika ───────────────────────────────────────────────────────
  async function _toggleEnabled(typeId, val) {
    await _savePref(typeId, { enabled: val });
    const row = document.getElementById('atr-' + typeId);
    if (row) row.style.opacity = val ? '1' : '0.55';
  }
  async function _toggleChannel(typeId, ch, val) {
    const cur = _prefs[typeId]?.channels ? JSON.parse(_prefs[typeId].channels) : { push: true, email: false, sms: false };
    cur[ch] = val;
    await _savePref(typeId, { channels: cur });
  }
  async function _removeDay(typeId, idx) {
    const pref = _prefs[typeId] || {};
    const at = _alertTypes.find(a => a.id === typeId);
    let days = pref.threshold_days ? JSON.parse(pref.threshold_days) : JSON.parse(at?.default_days || '[30,14,7]');
    days.splice(idx, 1);
    await _savePref(typeId, { threshold_days: days });
    const el = document.getElementById('ns-content');
    _renderAlerty(el);
  }
  async function _addDay(typeId) {
    const val = parseInt(prompt('Dodaj próg (dni przed terminem):', '30'));
    if (!val || isNaN(val) || val < 1) return;
    const pref = _prefs[typeId] || {};
    const at = _alertTypes.find(a => a.id === typeId);
    let days = pref.threshold_days ? JSON.parse(pref.threshold_days) : JSON.parse(at?.default_days || '[30,14,7]');
    if (!days.includes(val)) { days.push(val); days.sort((a,b) => b-a); }
    await _savePref(typeId, { threshold_days: days });
    _renderAlerty(document.getElementById('ns-content'));
  }
  async function _saveKm(typeId, val) {
    await _savePref(typeId, { threshold_km: parseInt(val) || null });
  }
  async function _saveQuiet() {
    const from = document.getElementById('quiet-from')?.value || '22:00';
    const to   = document.getElementById('quiet-to')?.value   || '07:00';
    const updates = Object.keys(_prefs).map(typeId => _savePref(typeId, { quiet_from: from, quiet_to: to }));
    if (!updates.length) {
      // Brak preferencji — utwórz dla wszystkich typów
      for (const at of _alertTypes) await _savePref(at.id, { quiet_from: from, quiet_to: to });
    } else {
      await Promise.all(updates);
    }
    window.toast?.(t('ns.toast.quiet.saved'));
  }

  async function _enablePush() {
    const ok = await window.TaxOrderNotifications?.subscribeToPush?.();
    if (ok) _updatePushStatus();
  }
  async function _disablePush() {
    await window.TaxOrderNotifications?.unsubscribeFromPush?.();
    _updatePushStatus();
  }
  async function _testPush() {
    const sub = await window.TaxOrderNotifications?.getPushStatus?.();
    if (sub !== 'subscribed') { window.toast?.(t('ns.toast.push.first')); return; }
    const r = await fetch(`${API()}/api/push/send`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ company_id: company(), title: 'TaxOrder Pro — test push', message: 'Powiadomienia push działają poprawnie ✓', url: '/?page=powiadomienia', urgent: false }),
    });
    window.toast?.(t(r.ok ? 'ns.toast.test.ok' : 'ns.toast.push.err'));
  }

  async function _triggerQueue() {
    const r = await fetch(`${API()}/api/notif-trigger`, { method: 'POST', headers: hdrs() });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      window.toast?.('✓ ' + (d.msg || t('ns.toast.trigger.ok')));
      setTimeout(() => _renderHistoria(document.getElementById('ns-content')), 3000);
    } else {
      window.toast?.(t('ns.toast.err').replace('{0}', d.error || r.status));
    }
  }

  async function _addCustomType() {
    const name = prompt('Nazwa własnego typu alertu (np. "Przegląd zabudowy chłodniczej"):');
    if (!name?.trim()) return;
    const cats = { d:'dokumenty', s:'serwis', w:'wyposazenie', x:'wlasny' };
    const catKey = prompt('Kategoria: d=Dokumenty, s=Serwis, w=Wyposażenie, x=Własne', 'x');
    const cat = cats[catKey?.toLowerCase()] || 'wlasny';
    const timeOk = confirm(t('ns.confirm.alert.date'));
    const kmOk   = confirm(t('ns.confirm.alert.km'));
    const r = await fetch(`${API()}/api/alert-types?company=${company()}`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ name: name.trim(), category: cat, trigger_time: timeOk ? 1 : 0, trigger_km: kmOk ? 1 : 0 }),
    });
    if (r.ok) {
      await _loadAlertTypes();
      _renderAlerty(document.getElementById('ns-content'));
      window.toast?.(t('ns.toast.alert.added').replace('{0}', name.trim()));
    }
  }

  async function _deleteCustomType(id) {
    if (!confirm(t('ns.confirm.alert.del'))) return;
    await fetch(`${API()}/api/alert-types/${id}`, { method: 'DELETE', headers: hdrs() });
    await _loadAlertTypes();
    _renderAlerty(document.getElementById('ns-content'));
  }

  async function _logAction(action, id) {
    await fetch(`${API()}/api/notif-log?company=${company()}`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ action, id }),
    });
    await _loadLog();
    _renderHistoria(document.getElementById('ns-content'));
  }

  async function _logSnooze(id) {
    const days = parseInt(prompt('Odłóż alert na ile dni?', '7'));
    if (!days || isNaN(days)) return;
    await fetch(`${API()}/api/notif-log?company=${company()}`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ action: 'snooze', id, days }),
    });
    await _loadLog();
    _renderHistoria(document.getElementById('ns-content'));
  }

  async function _refreshLog() {
    await _loadLog();
    _renderHistoria(document.getElementById('ns-content'));
  }

  // ── Szablony ─────────────────────────────────────────────────────────────────
  function _newTemplate() {
    _openTemplateModal(null);
  }
  function _editTemplate(id) {
    const t = _templates.find(t => t.id === id);
    if (t) _openTemplateModal(t);
  }

  function _openTemplateModal(tpl) {
    const items = tpl?.items || [];
    const itemRows = () => items.map((item, i) => {
      const at = _alertTypes.find(a => a.id === item.typeId);
      return `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px" data-idx="${i}">
        <span style="font-size:12px;min-width:160px"><i class="ti ${at?.icon||'ti-tool'}"></i> ${item.label||at?.name||item.typeId}</span>
        <input type="number" placeholder="Co X dni" value="${item.intervalDays||''}" min="1"
          style="width:90px;font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:var(--radius-sm)"
          onchange="window._tplItem[${i}].intervalDays=parseInt(this.value)||null">
        <input type="number" placeholder="Co X km" value="${item.intervalKm||''}" min="0" step="1000"
          style="width:90px;font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:var(--radius-sm)"
          onchange="window._tplItem[${i}].intervalKm=parseInt(this.value)||null">
        <button onclick="window._tplItem.splice(${i},1);TaxOrderNotifSettings._refreshTplItems()" style="background:none;border:none;cursor:pointer;color:var(--red)"><i class="ti ti-x"></i></button>
      </div>`;
    }).join('');

    window._tplItem = items.map(i => ({ ...i }));

    const typeOpts = _alertTypes.map(a => `<option value="${a.id}">${CATEGORIES[a.category]?.label||a.category} — ${a.name}</option>`).join('');

    const html = `<div id="tpl-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:5000;display:flex;align-items:center;justify-content:center"
      onclick="if(event.target===this)this.remove()">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:600px;max-width:95vw;max-height:90vh;overflow-y:auto;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <i class="ti ti-template" style="font-size:20px;color:var(--blue)"></i>
          <strong style="font-size:16px">${tpl ? 'Edytuj szablon' : 'Nowy szablon'}</strong>
          <button onclick="document.getElementById('tpl-modal').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:20px">×</button>
        </div>
        <div class="f" style="margin-bottom:10px">
          <label>Nazwa szablonu</label>
          <input id="tpl-name" class="fi" value="${tpl?.name||''}" placeholder="np. MAN TGL — pakiet roczny">
        </div>
        <div class="f" style="margin-bottom:16px">
          <label>Opis (opcjonalny)</label>
          <input id="tpl-desc" class="fi" value="${tpl?.description||''}" placeholder="Krótki opis...">
        </div>
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">Elementy konserwacji:</div>
        <div id="tpl-items">${itemRows()}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:10px;margin-bottom:16px">
          <select id="tpl-add-type" class="fi" style="flex:1">${typeOpts}</select>
          <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderNotifSettings._addTplItem()">
            <i class="ti ti-plus"></i>Dodaj
          </button>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-gray" onclick="document.getElementById('tpl-modal').remove()">Anuluj</button>
          <button class="btn btn-blue" onclick="TaxOrderNotifSettings._saveTpl('${tpl?.id||''}')"><i class="ti ti-check"></i>Zapisz</button>
        </div>
      </div>
    </div>`;
    document.getElementById('tpl-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function _refreshTplItems() {
    const el = document.getElementById('tpl-items');
    if (!el) return;
    const items = window._tplItem || [];
    el.innerHTML = items.map((item, i) => {
      const at = _alertTypes.find(a => a.id === item.typeId);
      return `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <span style="font-size:12px;min-width:160px"><i class="ti ${at?.icon||'ti-tool'}"></i> ${item.label||at?.name||item.typeId}</span>
        <input type="number" placeholder="Co X dni" value="${item.intervalDays||''}" min="1"
          style="width:90px;font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:var(--radius-sm)"
          onchange="window._tplItem[${i}].intervalDays=parseInt(this.value)||null">
        <input type="number" placeholder="Co X km" value="${item.intervalKm||''}" min="0" step="1000"
          style="width:90px;font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:var(--radius-sm)"
          onchange="window._tplItem[${i}].intervalKm=parseInt(this.value)||null">
        <button onclick="window._tplItem.splice(${i},1);TaxOrderNotifSettings._refreshTplItems()" style="background:none;border:none;cursor:pointer;color:var(--red)"><i class="ti ti-x"></i></button>
      </div>`;
    }).join('');
  }

  function _addTplItem() {
    const typeId = document.getElementById('tpl-add-type')?.value;
    if (!typeId) return;
    window._tplItem = window._tplItem || [];
    const at = _alertTypes.find(a => a.id === typeId);
    window._tplItem.push({ typeId, label: at?.name || typeId, intervalDays: null, intervalKm: null });
    _refreshTplItems();
  }

  async function _saveTpl(existingId) {
    const name = document.getElementById('tpl-name')?.value?.trim();
    const desc = document.getElementById('tpl-desc')?.value?.trim();
    if (!name) { alert('Podaj nazwę szablonu'); return; }
    const body = { name, description: desc || null, items: window._tplItem || [] };
    if (existingId) {
      await fetch(`${API()}/api/maintenance-templates/${existingId}?company=${company()}`, { method: 'PUT', headers: hdrs(), body: JSON.stringify(body) });
    } else {
      await fetch(`${API()}/api/maintenance-templates?company=${company()}`, { method: 'POST', headers: hdrs(), body: JSON.stringify(body) });
    }
    document.getElementById('tpl-modal')?.remove();
    await _loadTemplates();
    _renderSzablony(document.getElementById('ns-content'));
    window.toast?.(t('ns.toast.template.saved'));
  }

  async function _deleteTemplate(id) {
    if (!confirm(t('ns.confirm.template.del'))) return;
    await fetch(`${API()}/api/maintenance-templates/${id}?company=${company()}`, { method: 'DELETE', headers: hdrs() });
    await _loadTemplates();
    _renderSzablony(document.getElementById('ns-content'));
  }

  async function _applyTemplate(templateId, name) {
    const vehs = window.vehs || [];
    const vehList = vehs.map(v => `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px">
      <input type="checkbox" class="aply-cb" value="${esc(v.nrRej)}"> ${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}
    </label>`).join('');

    const html = `<div id="apply-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:5001;display:flex;align-items:center;justify-content:center">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:480px;max-width:95vw;max-height:85vh;overflow-y:auto;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <strong style="font-size:15px">Przypisz "${name}" do pojazdów</strong>
        <div style="margin:12px 0;max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:10px">${vehList}</div>
        <div style="display:flex;gap:6px;justify-content:space-between">
          <button class="btn btn-gray" style="font-size:11px" onclick="document.querySelectorAll('.aply-cb').forEach(c=>c.checked=true)">Zaznacz wszystkie</button>
          <div style="display:flex;gap:6px">
            <button class="btn btn-gray" onclick="document.getElementById('apply-modal').remove()">Anuluj</button>
            <button class="btn btn-blue" onclick="TaxOrderNotifSettings._doApply('${templateId}')"><i class="ti ti-check"></i>Przypisz</button>
          </div>
        </div>
      </div>
    </div>`;
    document.getElementById('apply-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  async function _doApply(templateId) {
    const nrRejes = [...document.querySelectorAll('.aply-cb:checked')].map(c => c.value);
    if (!nrRejes.length) { alert('Zaznacz co najmniej jeden pojazd'); return; }
    const r = await fetch(`${API()}/api/maintenance-templates?company=${company()}`, {
      method: 'POST', headers: hdrs(),
      body: JSON.stringify({ action: 'apply', templateId, nrRejes, name: '' }),
    });
    document.getElementById('apply-modal')?.remove();
    const data = await r.json();
    window.toast?.(r.ok ? t('ns.toast.template.applied').replace('{0}', data.applied) : t('ns.toast.err.assign'));
  }

  return { load, _tab, _toggleEnabled, _toggleChannel, _removeDay, _addDay, _saveKm, _saveQuiet,
           _enablePush, _disablePush, _testPush, _addCustomType, _deleteCustomType,
           _logAction, _logSnooze, _refreshLog, _newTemplate, _editTemplate, _deleteTemplate,
           _applyTemplate, _doApply, _addTplItem, _refreshTplItems, _saveTpl };
})();
