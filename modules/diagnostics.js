/**
 * TaxOrder Pro — Panel Diagnostyczny
 * Ctrl+Shift+D  →  otwórz / zamknij
 * Zbiera błędy JS, mierzy czasy fetch, sprawdza integralność danych,
 * testuje API i umożliwia automatyczne naprawy typowych problemów.
 */
window.TaxOrderDiagnostics = (function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let _panel = null;
  let _activeTab = 'health';
  const _errors = [];
  const _perf = {}; // path → [ms, ...]
  let _apiResults = [];
  let _apiRunning = false;

  // ── Capture: fetch timing ──────────────────────────────────────────────────
  const _origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = (typeof args[0] === 'string' ? args[0] : args[0]?.url || '');
    const key = url.replace(/https?:\/\/[^/]+/, '').replace(/[?#].*/, '') || url;
    const t0 = performance.now();
    try {
      const res = await _origFetch.apply(this, args);
      const ms = Math.round(performance.now() - t0);
      (_perf[key] = _perf[key] || []).push(ms);
      if (_perf[key].length > 50) _perf[key].shift();
      return res;
    } catch (e) {
      _pushErr('fetch', `${args[1]?.method || 'GET'} ${url}: ${e.message}`);
      throw e;
    }
  };

  // ── Capture: JS errors ─────────────────────────────────────────────────────
  const _prevOnerror = window.onerror;
  window.onerror = function (msg, src, line, col, err) {
    _pushErr('js', msg, `${src}:${line}:${col}`, err?.stack);
    return _prevOnerror ? _prevOnerror.apply(this, arguments) : false;
  };
  window.addEventListener('unhandledrejection', e => {
    _pushErr('promise', e.reason?.message || String(e.reason), '', e.reason?.stack);
  });

  function _pushErr(type, msg, src, stack) {
    _errors.push({ ts: new Date().toISOString(), type, msg: String(msg).slice(0, 300), src: src || '', stack: stack || '' });
    if (_errors.length > 200) _errors.splice(0, _errors.length - 200);
    const badge = document.getElementById('diag-err-badge');
    if (badge) { badge.textContent = _errors.length; badge.style.display = ''; }
  }

  // ── Config ─────────────────────────────────────────────────────────────────
  function _api() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _tok()  { return localStorage.getItem('cf_token'); }
  function _auth() { const t = _tok(); return t ? { Authorization: 'Bearer ' + t } : {}; }

  const MODULES_EXPECTED = [
    'TaxOrderDrivers', 'FleetCalendar', 'ServiceModule', 'FinesModule',
    'FuelImport', 'TaxOrderApiKeys', 'TaxOrderDamages', 'TaxOrderTires',
    'TaxOrderServiceOrders', 'TaxOrderHandoverProtocol',
    'TaxOrderCfmClients', 'TaxOrderCfmContracts', 'TaxOrderCfmInvoices',
    'TaxOrderVehicleDetail', 'FleetReports', 'VehicleImport',
    'TaxOrderInspectionCalendar',
  ];

  const API_SUITE = [
    { label: 'VAPID public key (bez auth)',  method: 'GET', path: '/api/push/vapid-public-key', noAuth: true,  ok: d => !!d?.publicKey },
    { label: 'Auth — brak tokenu → 401',     method: 'GET', path: '/api/vehicles?company=mtoilet', noAuth: true, expect: 401 },
    { label: 'Auth whoami',                  method: 'GET', path: '/api/auth/me',                 ok: d => !!d?.id || !!d?.email },
    { label: 'Lista pojazdów',               method: 'GET', path: '/api/vehicles?company=mtoilet', ok: d => Array.isArray(d) || !!d?.results },
    { label: 'Lista firm',                   method: 'GET', path: '/api/companies',               ok: d => Array.isArray(d) },
    { label: 'Klucze API',                   method: 'GET', path: '/api/api-keys',                ok: d => Array.isArray(d) },
    { label: 'Eksport danych',               method: 'GET', path: '/api/export?company=mtoilet',  ok: d => !!d?.vehicles },
    { label: '404 nieistniejący endpoint',   method: 'GET', path: '/api/_qa_404_test',            noAuth: true, expect: 404 },
  ];

  // ── Checks ─────────────────────────────────────────────────────────────────
  function _chkModules() {
    return MODULES_EXPECTED.map(m => ({ name: m, ok: typeof window[m] !== 'undefined' }));
  }

  function _chkRoleTabs() {
    if (typeof ROLE_TABS === 'undefined') return { ok: false, missing: ['ROLE_TABS undefined'] };
    const req = ['admin', 'kierownik', 'ksiegowy', 'mechanik', 'dyspozytor', 'kierowca'];
    const missing = req.filter(k => !ROLE_TABS[k]);
    return { ok: !missing.length, missing };
  }

  function _chkLS() {
    const issues = [];
    let count = 0;
    try {
      const raw = localStorage.getItem('dt1_vehicles');
      if (!raw) { issues.push('dt1_vehicles: brak'); }
      else {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) issues.push('dt1_vehicles: nie jest tablicą');
        else {
          count = arr.length;
          const noRej = arr.filter(v => !v.nrRej).length;
          const noId  = arr.filter(v => !v.id).length;
          if (noRej) issues.push(`${noRej} poj. bez nr rej.`);
          if (noId)  issues.push(`${noId} poj. bez ID`);
          // duplicates
          const seen = new Set();
          let dups = 0;
          arr.forEach(v => { if (v.nrRej) { if (seen.has(v.nrRej)) dups++; else seen.add(v.nrRej); } });
          if (dups) issues.push(`${dups} zduplikowanych nr rej.`);
        }
      }
    } catch (e) { issues.push('dt1_vehicles: uszkodzony JSON — ' + e.message); }

    const keys = Object.keys(localStorage);
    const size = keys.reduce((s, k) => s + (localStorage.getItem(k) || '').length, 0);
    return { issues, count, size, keys: keys.length };
  }

  function _chkUser() {
    const u = window.currentUser;
    if (!u) return { ok: false };
    const tabs = typeof ROLE_TABS !== 'undefined' ? (ROLE_TABS[u.role] || []) : [];
    return { ok: true, name: u.name, role: u.role, email: u.email, tabs: tabs.length };
  }

  function _score() {
    const mods   = _chkModules();
    const rt     = _chkRoleTabs();
    const ls     = _chkLS();
    const user   = _chkUser();
    const apiOk  = _apiResults.filter(r => r.ok).length;
    const apiTot = _apiResults.length;
    let s = 0;
    s += Math.round((mods.filter(m => m.ok).length / mods.length) * 30);
    s += rt.ok ? 15 : 0;
    s += ls.issues.length === 0 ? 20 : ls.issues.length < 3 ? 10 : 0;
    s += user.ok ? 10 : 0;
    s += apiTot ? Math.round((apiOk / apiTot) * 20) : 10;
    s -= Math.min(15, _errors.length * 2);
    return Math.max(0, Math.min(100, s));
  }

  // ── Auto-Fix definitions ───────────────────────────────────────────────────
  const FIXES = [
    {
      id: 'close-modals',
      label: 'Zamknij wszystkie otwarte modale',
      desc: 'Usuwa nakładki i modale blokujące UI',
      check: () => document.querySelectorAll('.modal:not(.hidden),[id$="-modal"]:not(.hidden)').length > 0,
      run: () => {
        let n = 0;
        document.querySelectorAll('.modal,[id$="-modal"]').forEach(m => { if (!m.classList.contains('hidden')) { m.classList.add('hidden'); n++; } });
        return `Zamknięto ${n} modali`;
      },
    },
    {
      id: 'clear-filters',
      label: 'Wyczyść filtry listy pojazdów',
      desc: 'Resetuje pole wyszukiwania i selecty filtrów',
      check: () => !!(document.getElementById('q-veh')?.value || document.getElementById('f-typ')?.value),
      run: () => {
        ['q-veh', 'f-typ', 'f-status'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        if (typeof clearColFilters === 'function') clearColFilters();
        if (typeof renderVeh === 'function') renderVeh();
        return 'Filtry wyczyszczone';
      },
    },
    {
      id: 'fix-ids',
      label: 'Napraw brakujące ID pojazdów',
      desc: 'Przypisuje unikalne ID każdemu pojazdowi który go nie ma',
      check: () => {
        try { return JSON.parse(localStorage.getItem('dt1_vehicles') || '[]').some(v => !v.id); }
        catch { return true; }
      },
      run: () => {
        try {
          const arr = JSON.parse(localStorage.getItem('dt1_vehicles') || '[]');
          let fixed = 0;
          arr.forEach(v => { if (!v.id) { v.id = Date.now() + Math.floor(Math.random() * 1e6); fixed++; } });
          localStorage.setItem('dt1_vehicles', JSON.stringify(arr));
          if (Array.isArray(window.vehs)) { window.vehs.length = 0; arr.forEach(v => window.vehs.push(v)); }
          if (typeof renderVeh === 'function') renderVeh();
          return `Naprawiono ${fixed} pojazdów`;
        } catch (e) { return '❌ ' + e.message; }
      },
    },
    {
      id: 'dedup-vehs',
      label: 'Usuń duplikaty pojazdów (ten sam nr rej.)',
      desc: 'Zachowuje ostatnio zmodyfikowany rekord dla każdego nr rej.',
      check: () => {
        try {
          const arr = JSON.parse(localStorage.getItem('dt1_vehicles') || '[]');
          const seen = new Set();
          return arr.some(v => { if (!v.nrRej) return false; if (seen.has(v.nrRej)) return true; seen.add(v.nrRej); return false; });
        } catch { return false; }
      },
      run: () => {
        try {
          const arr = JSON.parse(localStorage.getItem('dt1_vehicles') || '[]');
          const map = new Map();
          arr.forEach(v => { if (!v.nrRej) map.set(v.id || Math.random(), v); else map.set(v.nrRej, v); });
          const deduped = [...map.values()];
          const removed = arr.length - deduped.length;
          localStorage.setItem('dt1_vehicles', JSON.stringify(deduped));
          if (Array.isArray(window.vehs)) { window.vehs.length = 0; deduped.forEach(v => window.vehs.push(v)); }
          if (typeof renderVeh === 'function') renderVeh();
          return `Usunięto ${removed} duplikatów`;
        } catch (e) { return '❌ ' + e.message; }
      },
    },
    {
      id: 'reload-vehs',
      label: 'Przeładuj dane pojazdów z localStorage',
      desc: 'Odświeża tablicę pojazdów w pamięci i widok listy',
      check: () => true,
      run: () => {
        try {
          const arr = JSON.parse(localStorage.getItem('dt1_vehicles') || '[]');
          if (Array.isArray(window.vehs)) { window.vehs.length = 0; arr.forEach(v => window.vehs.push(v)); }
          if (typeof renderVeh === 'function') renderVeh();
          if (typeof renderDash === 'function') renderDash();
          if (typeof updateCounters === 'function') updateCounters();
          return `Przeładowano ${arr.length} pojazdów`;
        } catch (e) { return '❌ ' + e.message; }
      },
    },
    {
      id: 'fix-dates',
      label: 'Napraw formaty dat pojazdów',
      desc: 'Konwertuje DD.MM.YYYY → YYYY-MM-DD w polach ocEnd, acEnd, nextInspection',
      check: () => {
        try {
          const arr = JSON.parse(localStorage.getItem('dt1_vehicles') || '[]');
          return arr.some(v => ['ocEnd','acEnd','nextInspection'].some(f => /^\d{2}\.\d{2}\.\d{4}$/.test(v[f])));
        } catch { return false; }
      },
      run: () => {
        try {
          const arr = JSON.parse(localStorage.getItem('dt1_vehicles') || '[]');
          const fields = ['ocEnd','acEnd','nextInspection','udtEnd','tachoEnd'];
          let fixed = 0;
          arr.forEach(v => {
            fields.forEach(f => {
              if (/^\d{2}\.\d{2}\.\d{4}$/.test(v[f])) {
                const [d, m, y] = v[f].split('.');
                v[f] = `${y}-${m}-${d}`;
                fixed++;
              }
            });
          });
          localStorage.setItem('dt1_vehicles', JSON.stringify(arr));
          if (Array.isArray(window.vehs)) { window.vehs.length = 0; arr.forEach(v => window.vehs.push(v)); }
          return `Naprawiono ${fixed} dat`;
        } catch (e) { return '❌ ' + e.message; }
      },
    },
    {
      id: 'backup-ls',
      label: 'Pobierz kopię zapasową localStorage',
      desc: 'Eksportuje wszystkie dane dt1_* i cf_* do pliku JSON',
      check: () => !!localStorage.getItem('dt1_vehicles'),
      run: () => {
        const data = {};
        Object.keys(localStorage).filter(k => k.startsWith('dt1_') || k.startsWith('cf_')).forEach(k => {
          try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); }
        });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `taxorder-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        return 'Plik pobrany';
      },
    },
    {
      id: 'clear-session',
      label: 'Wyloguj i wyczyść sesję',
      desc: 'Usuwa token CF z localStorage i wraca do ekranu logowania',
      check: () => !!_tok(),
      run: () => {
        localStorage.removeItem('cf_token');
        localStorage.removeItem('dt1_user');
        setTimeout(() => location.reload(), 600);
        return 'Sesja wyczyszczona — przeładowuję…';
      },
    },
  ];

  // ── Panel build ────────────────────────────────────────────────────────────
  const TABS = ['health', 'api', 'data', 'modules', 'errors', 'fix', 'perf'];
  const TAB_LABELS = { health: '🏥 Health', api: '🌐 API', data: '💾 Dane', modules: '📦 Moduły', errors: '⚠ Błędy', fix: '🔧 Auto-Fix', perf: '⚡ Perf' };

  function _buildPanel() {
    const el = document.createElement('div');
    el.id = 'tord-diag-panel';
    el.innerHTML = `
<style>
#tord-diag-panel{position:fixed;bottom:0;right:0;width:700px;height:500px;background:var(--bg2,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px 0 0 0;box-shadow:0 -6px 40px rgba(0,0,0,.2);z-index:99999;display:flex;flex-direction:column;font-size:12px;font-family:system-ui,sans-serif;color:var(--text,#111827);transition:transform .2s ease}
#tord-diag-panel.dg-min{transform:translateY(calc(100% - 42px))}
#dg-hdr{display:flex;align-items:center;gap:8px;padding:0 12px;height:42px;background:var(--bg3,#f3f4f6);border-bottom:1px solid var(--border,#e5e7eb);border-radius:12px 0 0 0;cursor:move;user-select:none;flex-shrink:0}
#dg-hdr .t{font-weight:800;font-size:13px;color:var(--blue,#2563eb);flex:1;letter-spacing:-.01em}
#dg-hdr button{background:none;border:none;cursor:pointer;font-size:15px;color:var(--text2,#6b7280);padding:2px 5px;border-radius:4px;line-height:1}
#dg-hdr button:hover{background:var(--bg,#f9fafb)}
#dg-tabs{display:flex;border-bottom:1px solid var(--border,#e5e7eb);flex-shrink:0;overflow-x:auto}
.dg-tab{padding:7px 13px;cursor:pointer;border-bottom:2px solid transparent;font-size:11px;font-weight:600;color:var(--text2,#6b7280);white-space:nowrap;transition:all .15s}
.dg-tab:hover{color:var(--text,#111)}
.dg-tab.active{color:var(--blue,#2563eb);border-bottom-color:var(--blue,#2563eb)}
#dg-body{flex:1;overflow-y:auto;padding:14px 16px}
.dg-sec{margin-bottom:14px}
.dg-sec h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text2,#6b7280);margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border,#e5e7eb)}
.dg-row{display:flex;align-items:center;padding:4px 0;border-bottom:1px solid var(--bg3,#f3f4f6);gap:4px}
.dg-row:last-child{border:none}
.dg-row .lbl{flex:1;color:var(--text,#111)}
.ok{color:#16a34a;font-weight:700}.warn{color:#d97706;font-weight:700}.err{color:#dc2626;font-weight:700}
.dg-score{font-size:40px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.dg-kpi{background:var(--bg3,#f3f4f6);border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:8px 14px;text-align:center;min-width:70px}
.dg-kpi .v{font-size:20px;font-weight:800;line-height:1.2}.dg-kpi .l{font-size:10px;color:var(--text2,#6b7280);margin-top:2px}
.fx-card{background:var(--bg3,#f3f4f6);border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:10px 12px;margin-bottom:8px}
.fx-card .fx-title{font-weight:600;margin-bottom:3px}.fx-card .fx-desc{font-size:11px;color:var(--text2,#6b7280)}
.fx-card .fx-result{font-size:11px;color:#16a34a;margin-top:5px;display:none}
.dg-btn{padding:4px 12px;border-radius:6px;border:1px solid var(--border,#e5e7eb);background:var(--bg,#fff);cursor:pointer;font-size:11px;font-weight:600;transition:all .15s;color:var(--text,#111)}
.dg-btn:hover:not(:disabled){background:var(--blue,#2563eb);color:#fff;border-color:transparent}
.dg-btn:disabled{opacity:.4;cursor:default}
.dg-btn.done{background:#16a34a;color:#fff;border-color:transparent}
.dg-log{background:#111827;color:#4ade80;font-family:'JetBrains Mono',monospace;font-size:10px;padding:10px;border-radius:6px;max-height:180px;overflow-y:auto;white-space:pre-wrap;line-height:1.6}
.err-pill{display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700}
.pill-js{background:#fee2e2;color:#dc2626}.pill-promise{background:#fef3c7;color:#d97706}.pill-fetch{background:#dbeafe;color:#2563eb}
</style>
<div id="dg-hdr">
  <span class="t">🔧 TaxOrder Diagnostics</span>
  <span id="dg-score-mini" style="font-size:11px;color:var(--text2,#6b7280)"></span>
  <button onclick="TaxOrderDiagnostics.runApiTests()" title="Testuj API">🌐</button>
  <button onclick="TaxOrderDiagnostics.refresh()" title="Odśwież">↻</button>
  <button onclick="TaxOrderDiagnostics.minimize()" title="Minimalizuj">⊟</button>
  <button onclick="TaxOrderDiagnostics.close()" title="Zamknij">✕</button>
</div>
<div id="dg-tabs">
  ${TABS.map(t => `<div class="dg-tab${t === 'health' ? ' active' : ''}" data-tab="${t}" onclick="TaxOrderDiagnostics.showTab('${t}')">${TAB_LABELS[t]}<span class="dg-err-badge" style="display:none;margin-left:4px;background:#fee2e2;color:#dc2626;border-radius:9px;padding:0 5px;font-size:9px"></span></div>`).join('')}
</div>
<div id="dg-body"></div>`;
    document.body.appendChild(el);
    _makeDraggable(el, el.querySelector('#dg-hdr'));
    return el;
  }

  function _makeDraggable(el, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0;
    handle.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      ox = r.left; oy = r.top;
      const onMove = ev => {
        el.style.right = 'auto'; el.style.bottom = 'auto';
        el.style.left = Math.max(0, ox + ev.clientX - sx) + 'px';
        el.style.top  = Math.max(0, oy + ev.clientY - sy) + 'px';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ── Tab renderers ──────────────────────────────────────────────────────────
  function _tHealth() {
    const mods  = _chkModules();
    const rt    = _chkRoleTabs();
    const ls    = _chkLS();
    const user  = _chkUser();
    const apiOk = _apiResults.filter(r => r.ok).length;
    const apiT  = _apiResults.length;
    const s     = _score();
    const sc    = s >= 80 ? '#16a34a' : s >= 55 ? '#d97706' : '#dc2626';
    const modsOk = mods.filter(m => m.ok).length;
    document.getElementById('dg-score-mini').textContent = `Score: ${s}/100`;
    return `
    <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px">
      <div style="text-align:center;min-width:76px">
        <div class="dg-score" style="color:${sc}">${s}</div>
        <div style="font-size:10px;color:var(--text2,#6b7280);margin-top:3px">/ 100</div>
      </div>
      <div style="flex:1">
        <div class="dg-row"><span class="lbl">Moduły JS</span><span>${modsOk < mods.length ? `<span class="warn">${mods.length - modsOk} nie załadowanych</span>` : `<span class="ok">✅ ${modsOk}/${mods.length}</span>`}</span></div>
        <div class="dg-row"><span class="lbl">ROLE_TABS</span><span>${rt.ok ? '<span class="ok">✅ OK</span>' : `<span class="err">❌ Brak: ${rt.missing.join(', ')}</span>`}</span></div>
        <div class="dg-row"><span class="lbl">Dane (localStorage)</span><span>${ls.issues.length ? `<span class="warn">⚠ ${ls.issues[0]}</span>` : `<span class="ok">✅ ${ls.count} poj.</span>`}</span></div>
        <div class="dg-row"><span class="lbl">Użytkownik</span><span>${user.ok ? `<span class="ok">✅ ${esc(user.name)} (${esc(user.role)})</span>` : '<span class="err">❌ Niezalogowany</span>'}</span></div>
        <div class="dg-row"><span class="lbl">API</span><span>${apiT ? (apiOk === apiT ? `<span class="ok">✅ ${apiOk}/${apiT} OK</span>` : `<span class="warn">${apiOk}/${apiT} OK</span>`) : '<span style="color:var(--text3)">Nie testowano — kliknij 🌐</span>'}</span></div>
        <div class="dg-row"><span class="lbl">Błędy JS</span><span>${_errors.length === 0 ? '<span class="ok">✅ Brak</span>' : `<span class="${_errors.length < 5 ? 'warn' : 'err'}">${_errors.length} błędów</span>`}</span></div>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="dg-btn" onclick="TaxOrderDiagnostics.runApiTests()">🌐 Testuj API</button>
      <button class="dg-btn" onclick="TaxOrderDiagnostics.showTab('fix')">🔧 Auto-Fix</button>
      <button class="dg-btn" onclick="TaxOrderDiagnostics.exportReport()">📄 Raport HTML</button>
      <button class="dg-btn" onclick="TaxOrderDiagnostics.refresh()">↻ Odśwież</button>
    </div>`;
  }

  function _tApi() {
    if (_apiRunning) return '<div style="text-align:center;padding:24px;color:var(--text2)">⏳ Testuję API…</div>';
    if (!_apiResults.length) return `
    <div style="text-align:center;padding:30px">
      <div style="font-size:32px;margin-bottom:10px">🌐</div>
      <div style="color:var(--text2);margin-bottom:14px">Kliknij aby uruchomić testy wszystkich endpointów API</div>
      <button class="dg-btn" onclick="TaxOrderDiagnostics.runApiTests()">▶ Testuj API teraz</button>
    </div>`;
    const pass = _apiResults.filter(r => r.ok).length;
    const avgMs = Math.round(_apiResults.reduce((s, r) => s + r.ms, 0) / _apiResults.length);
    const rows = _apiResults.map(r => {
      const msC = r.ms < 300 ? '#16a34a' : r.ms < 700 ? '#d97706' : '#dc2626';
      return `<div class="dg-row">
        <span style="flex:1">${r.ok ? '✅' : '❌'} ${r.label}</span>
        <span style="color:${msC};font-family:monospace;margin:0 6px">${r.ms}ms</span>
        <span style="color:var(--text2);font-family:monospace;font-size:11px">[${r.status}]</span>
        ${r.note ? `<span style="color:#d97706;font-size:10px;max-width:130px;overflow:hidden;text-overflow:ellipsis" title="${r.note}">⚠ ${r.note}</span>` : ''}
      </div>`;
    }).join('');
    return `
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <div class="dg-kpi"><div class="v" style="color:#16a34a">${pass}/${_apiResults.length}</div><div class="l">PASS</div></div>
      <div class="dg-kpi"><div class="v" style="color:${avgMs < 400 ? '#16a34a' : '#d97706'}">${avgMs}ms</div><div class="l">avg latency</div></div>
      <div class="dg-kpi"><div class="v" style="color:${_apiResults.length - pass > 0 ? '#dc2626' : '#6b7280'}">${_apiResults.length - pass}</div><div class="l">FAIL</div></div>
    </div>
    <div class="dg-sec">${rows}</div>
    <button class="dg-btn" onclick="TaxOrderDiagnostics.runApiTests()">↻ Ponów testy</button>`;
  }

  function _tData() {
    const ls = _chkLS();
    let vehDetail = '';
    try {
      const arr = JSON.parse(localStorage.getItem('dt1_vehicles') || '[]');
      if (arr.length) {
        const types = {};
        arr.forEach(v => { types[v.typ || '?'] = (types[v.typ || '?'] || 0) + 1; });
        const topTypes = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => `${t}: ${n}`).join(', ');
        const wOc  = arr.filter(v => v.ocEnd).length;
        const wVin = arr.filter(v => v.vin).length;
        const wFuel = arr.filter(v => v.fuelHistory?.length).length;
        vehDetail = `
        <div class="dg-row"><span class="lbl">Typy pojazdów</span><span style="color:var(--text2,#6b7280)">${topTypes}</span></div>
        <div class="dg-row"><span class="lbl">Pojazdy z OC</span><span>${wOc}/${arr.length}</span></div>
        <div class="dg-row"><span class="lbl">Pojazdy z VIN</span><span>${wVin}/${arr.length}</span></div>
        <div class="dg-row"><span class="lbl">Pojazdy z historią paliwa</span><span>${wFuel}/${arr.length}</span></div>`;
      }
    } catch {}
    const lsKeys = Object.keys(localStorage).filter(k => k.startsWith('dt1_') || k.startsWith('cf_'));
    return `
    <div class="dg-sec">
      <h3>Pojazdy</h3>
      <div class="dg-row"><span class="lbl">Łącznie</span><span style="font-weight:700">${ls.count}</span></div>
      ${vehDetail}
    </div>
    <div class="dg-sec">
      <h3>Problemy (${ls.issues.length})</h3>
      ${ls.issues.length ? ls.issues.map(i => `<div class="warn" style="padding:3px 0">⚠ ${i}</div>`).join('') : '<div class="ok">✅ Brak problemów z integralnością danych</div>'}
    </div>
    <div class="dg-sec">
      <h3>Klucze localStorage (${lsKeys.length})</h3>
      ${lsKeys.map(k => {
        const size = (localStorage.getItem(k) || '').length;
        return `<div class="dg-row"><span class="lbl" style="font-family:monospace;font-size:11px">${k}</span><span style="color:var(--text2)">${size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B'}</span></div>`;
      }).join('')}
      <div class="dg-row"><span class="lbl">RAZEM</span><span style="font-weight:700">${(ls.size / 1024).toFixed(1)} KB</span></div>
    </div>`;
  }

  function _tModules() {
    const mods = _chkModules();
    const bad  = mods.filter(m => !m.ok);
    return `
    <div class="dg-sec">
      <h3>Moduły JS — ${mods.filter(m => m.ok).length}/${mods.length} załadowanych</h3>
      ${bad.length ? `<div class="warn" style="margin-bottom:8px;font-size:11px">⚠ Brakujące: ${bad.map(m => m.name).join(', ')}</div>` : ''}
      ${mods.map(m => `<div class="dg-row"><span class="lbl"><code style="font-size:11px">${m.name}</code></span><span class="${m.ok ? 'ok' : 'err'}">${m.ok ? '✅ OK' : '❌ Brak'}</span></div>`).join('')}
    </div>`;
  }

  function _tErrors() {
    if (!_errors.length) return '<div class="ok" style="text-align:center;padding:30px;font-size:14px">✅ Brak przechwyconych błędów</div>';
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-weight:700">${_errors.length} błędów</span>
      <button class="dg-btn" onclick="window.TaxOrderDiagnostics._errors.splice(0);TaxOrderDiagnostics.refresh()">Wyczyść</button>
    </div>
    ${[..._errors].reverse().slice(0, 40).map(e => `
    <div style="border-bottom:1px solid var(--bg3);padding:6px 0">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:3px">
        <span class="err-pill pill-${e.type}">${e.type.toUpperCase()}</span>
        <span style="font-size:10px;color:var(--text2)">${e.ts.slice(11, 19)}</span>
      </div>
      <div style="font-size:11px">${e.msg}</div>
      ${e.src ? `<div style="font-size:10px;color:var(--text2);font-family:monospace">${e.src}</div>` : ''}
    </div>`).join('')}`;
  }

  function _tFix() {
    return `<div class="dg-sec" style="border:none">
    <h3>Automatyczne naprawy</h3>
    ${FIXES.map(f => {
      const ok = f.check();
      return `<div class="fx-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <span class="fx-title">${f.label}</span>
          <button id="fx-${f.id}" class="dg-btn" ${!ok ? 'disabled' : ''} onclick="TaxOrderDiagnostics.applyFix('${f.id}')">
            ${ok ? '🔧 Napraw' : '✅ OK'}
          </button>
        </div>
        <div class="fx-desc">${f.desc}</div>
        <div id="fx-r-${f.id}" class="fx-result"></div>
      </div>`;
    }).join('')}
    </div>`;
  }

  function _tPerf() {
    const entries = Object.entries(_perf).sort((a, b) => {
      const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
      const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
      return avgB - avgA;
    });
    if (!entries.length) return '<div style="color:var(--text2);text-align:center;padding:30px">Brak danych. Używaj aplikacji — czasy zbierają się automatycznie z każdego żądania fetch.</div>';
    return `<div class="dg-sec">
    <h3>Czasy endpointów (${entries.length} unikalnych ścieżek)</h3>
    ${entries.map(([path, times]) => {
      const avg = Math.round(times.reduce((s, v) => s + v, 0) / times.length);
      const max = Math.max(...times);
      const min = Math.min(...times);
      const bar = Math.min(100, Math.round(avg / 10));
      const c = avg < 300 ? '#16a34a' : avg < 700 ? '#d97706' : '#dc2626';
      return `<div class="dg-row" style="flex-direction:column;align-items:stretch;gap:2px">
        <div style="display:flex;justify-content:space-between">
          <span style="font-family:monospace;font-size:10px;overflow:hidden;text-overflow:ellipsis;max-width:300px" title="${path}">${path}</span>
          <span style="font-family:monospace;font-size:11px;color:${c};font-weight:700">${avg}ms avg</span>
          <span style="font-size:10px;color:var(--text2)">${times.length}× · ${min}–${max}ms</span>
        </div>
        <div style="height:4px;background:var(--bg3);border-radius:2px"><div style="height:100%;width:${bar}%;background:${c};border-radius:2px"></div></div>
      </div>`;
    }).join('')}
    </div>`;
  }

  // ── Public ─────────────────────────────────────────────────────────────────
  function open() {
    if (!_panel) _panel = _buildPanel();
    _panel.style.display = 'flex';
    _panel.classList.remove('dg-min');
    refresh();
  }

  function close() {
    if (_panel) _panel.style.display = 'none';
  }

  function minimize() {
    if (_panel) _panel.classList.toggle('dg-min');
  }

  function showTab(tab) {
    _activeTab = tab;
    if (!_panel) return;
    _panel.querySelectorAll('.dg-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    refresh();
  }

  function refresh() {
    document.querySelectorAll('.dg-err-badge').forEach(b => {
      if (_errors.length) { b.textContent = _errors.length; b.style.display = ''; }
      else b.style.display = 'none';
    });
    const body = document.getElementById('dg-body');
    if (!body) return;
    const map = { health: _tHealth, api: _tApi, data: _tData, modules: _tModules, errors: _tErrors, fix: _tFix, perf: _tPerf };
    body.innerHTML = (map[_activeTab] || _tHealth)();
  }

  async function runApiTests() {
    if (_apiRunning) return;
    _apiRunning = true;
    const body = document.getElementById('dg-body');
    if (body && _activeTab === 'api') body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text2)">⏳ Testuję API…</div>';
    _apiResults = [];
    const base = _api();
    const tok  = _tok();
    for (const ep of API_SUITE) {
      const t0 = performance.now();
      try {
        const h = ep.noAuth ? {} : (tok ? { Authorization: 'Bearer ' + tok } : {});
        const res = await _origFetch(`${base}${ep.path}`, { method: ep.method, headers: h });
        const ms  = Math.round(performance.now() - t0);
        let json; try { json = await res.json(); } catch { json = {}; }
        const expStatus = ep.expect || 200;
        const statusOk  = res.status === expStatus;
        const verifyOk  = ep.ok ? ep.ok(json) : true;
        _apiResults.push({ label: ep.label, status: res.status, ms, ok: statusOk && verifyOk, note: !statusOk ? `Oczek. ${expStatus}` : (!verifyOk ? 'Weryfikacja nie powiodła się' : '') });
      } catch (e) {
        _apiResults.push({ label: ep.label, status: 0, ms: Math.round(performance.now() - t0), ok: false, note: e.message });
      }
    }
    _apiRunning = false;
    showTab('api');
  }

  function applyFix(id) {
    const fix = FIXES.find(f => f.id === id);
    if (!fix) return;
    const result = fix.run();
    const rEl = document.getElementById('fx-r-' + id);
    const btn = document.getElementById('fx-' + id);
    if (rEl) { rEl.textContent = result; rEl.style.display = ''; }
    if (btn) { btn.textContent = '✅ Wykonano'; btn.classList.add('done'); btn.disabled = true; }
  }

  function exportReport() {
    const mods = _chkModules();
    const ls   = _chkLS();
    const user = _chkUser();
    const s    = _score();
    const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>TaxOrder Diagnostics — ${new Date().toLocaleDateString('pl-PL')}</title>
<style>*{box-sizing:border-box}body{font-family:system-ui;max-width:960px;margin:0 auto;padding:24px;font-size:13px;color:#111}h1{font-size:22px;font-weight:900;margin-bottom:4px}h2{font-size:14px;font-weight:700;margin:20px 0 8px;padding:6px 14px;background:#f3f4f6;border-left:4px solid #2563eb;border-radius:0 6px 6px 0}.ok{color:#16a34a;font-weight:700}.err{color:#dc2626;font-weight:700}.warn{color:#d97706;font-weight:700}table{border-collapse:collapse;width:100%;margin:6px 0}td,th{padding:5px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:left}th{background:#f9fafb;font-weight:700}.score{font-size:48px;font-weight:900;color:${s >= 80 ? '#16a34a' : s >= 55 ? '#d97706' : '#dc2626'}}</style></head><body>
<h1>TaxOrder Pro — Raport diagnostyczny</h1>
<p style="color:#6b7280">Wygenerowano: ${new Date().toLocaleString('pl-PL')} | Użytkownik: ${user.name || '—'} (${user.role || '—'})</p>
<div class="score">${s} <span style="font-size:20px;font-weight:400;color:#6b7280">/ 100</span></div>
<h2>Moduły JS</h2>
<table><tr><th>Moduł</th><th>Status</th></tr>
${mods.map(m => `<tr><td><code>${m.name}</code></td><td class="${m.ok ? 'ok' : 'err'}">${m.ok ? '✅ OK' : '❌ Brak'}</td></tr>`).join('')}
</table>
<h2>Dane (localStorage)</h2>
<table><tr><th>Pojazdy</th><th>Rozmiar</th><th>Problemy</th></tr><tr><td>${ls.count}</td><td>${(ls.size / 1024).toFixed(1)} KB</td><td>${ls.issues.length ? `<span class="warn">${ls.issues.join(', ')}</span>` : '<span class="ok">Brak</span>'}</td></tr></table>
<h2>Testy API</h2>
${_apiResults.length ? `<table><tr><th>Test</th><th>Status HTTP</th><th>Czas</th><th>Wynik</th></tr>
${_apiResults.map(r => `<tr><td>${r.label}</td><td>${r.status}</td><td>${r.ms}ms</td><td class="${r.ok ? 'ok' : 'err'}">${r.ok ? '✅ PASS' : '❌ FAIL' + (r.note ? ` — ${r.note}` : '')}</td></tr>`).join('')}</table>` : '<p style="color:#6b7280">Nie uruchomiono testów API</p>'}
<h2>Błędy JS (${_errors.length})</h2>
${_errors.length ? `<table><tr><th>Czas</th><th>Typ</th><th>Komunikat</th><th>Źródło</th></tr>
${_errors.slice(-30).map(e => `<tr><td>${e.ts.slice(11, 19)}</td><td>${e.type}</td><td>${e.msg}</td><td>${e.src}</td></tr>`).join('')}</table>` : '<p class="ok">Brak błędów</p>'}
<h2>Wydajność endpointów</h2>
${Object.entries(_perf).length ? `<table><tr><th>Endpoint</th><th>Wywołania</th><th>Avg ms</th><th>Min</th><th>Max</th></tr>
${Object.entries(_perf).map(([p, t]) => { const avg = Math.round(t.reduce((s, v) => s + v, 0) / t.length); return `<tr><td><code>${p}</code></td><td>${t.length}</td><td class="${avg < 300 ? 'ok' : avg < 700 ? 'warn' : 'err'}">${avg}ms</td><td>${Math.min(...t)}ms</td><td>${Math.max(...t)}ms</td></tr>`; }).join('')}</table>` : '<p style="color:#6b7280">Brak danych (używaj aplikacji normalnie)</p>'}
</body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `taxorder-diag-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
  }

  // ── Keyboard shortcut ──────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      if (_panel && _panel.style.display !== 'none') { close(); } else { open(); }
    }
  });

  return { open, close, minimize, showTab, refresh, runApiTests, applyFix, exportReport, _errors, _perf };
})();
