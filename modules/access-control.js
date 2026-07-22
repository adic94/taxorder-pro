(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ── Definicja modułów (source of truth po stronie frontendu) ─────────────
  const ALL_MODULES = [
    // BASIC
    { id:'pojazdy',           label:'Pojazdy',               cat:'Flota',        pkg:'basic',      icon:'ti-car' },
    { id:'kierowcy',          label:'Kierowcy',              cat:'Kierowcy',     pkg:'basic',      icon:'ti-users' },
    { id:'paliwo',            label:'Paliwo',                cat:'Flota',        pkg:'basic',      icon:'ti-gas-station' },
    { id:'szkody',            label:'Szkody',                cat:'Flota',        pkg:'basic',      icon:'ti-alert-triangle' },
    { id:'mandaty',           label:'Mandaty',               cat:'Flota',        pkg:'basic',      icon:'ti-ban' },
    { id:'faktury',           label:'Faktury dostawców',     cat:'Finanse',      pkg:'basic',      icon:'ti-file-invoice' },
    { id:'formularze',        label:'Formularze DT-1',       cat:'Podatki',      pkg:'basic',      icon:'ti-file-text' },
    { id:'protokoly',         label:'Protokoły wydań',       cat:'Dokumenty',    pkg:'basic',      icon:'ti-clipboard' },
    { id:'dt1-historia',      label:'Historia DT-1',         cat:'Podatki',      pkg:'basic',      icon:'ti-history' },
    { id:'powiadomienia',     label:'Powiadomienia',         cat:'System',       pkg:'basic',      icon:'ti-bell' },
    { id:'dash',              label:'Dashboard',             cat:'System',       pkg:'basic',      icon:'ti-layout-dashboard' },
    // PRO
    { id:'zlecenia',          label:'Zlecenia serwisowe',    cat:'Serwis',       pkg:'pro',        icon:'ti-tool' },
    { id:'opony-magazyn',     label:'Magazyn opon',          cat:'Serwis',       pkg:'pro',        icon:'ti-circle' },
    { id:'karty',             label:'Karty paliwowe',        cat:'Finanse',      pkg:'pro',        icon:'ti-credit-card' },
    { id:'tachograph',        label:'Tachograf',             cat:'Kierowcy',     pkg:'pro',        icon:'ti-clock' },
    { id:'transport-orders',  label:'Zlecenia transportu',   cat:'Transport',    pkg:'pro',        icon:'ti-truck' },
    { id:'kalendarz',         label:'Kalendarz floty',       cat:'Flota',        pkg:'pro',        icon:'ti-calendar' },
    { id:'fleet-kanban',      label:'Kanban floty',          cat:'Flota',        pkg:'pro',        icon:'ti-layout-board' },
    { id:'driver-scoring',    label:'Eco-driving / Scoring', cat:'Kierowcy',     pkg:'pro',        icon:'ti-star' },
    { id:'driver-performance',label:'Wyniki kierowców',      cat:'Kierowcy',     pkg:'pro',        icon:'ti-chart-line' },
    { id:'driver-schedule',   label:'Harmonogram kierowców', cat:'Kierowcy',     pkg:'pro',        icon:'ti-calendar-stats' },
    { id:'driver-panel',      label:'Panel kierowcy (PWA)',  cat:'Kierowcy',     pkg:'pro',        icon:'ti-device-mobile' },
    { id:'budget',            label:'Budżet floty',          cat:'Finanse',      pkg:'pro',        icon:'ti-wallet' },
    { id:'budget-annual',     label:'Budżet roczny',         cat:'Finanse',      pkg:'pro',        icon:'ti-chart-pie' },
    { id:'fuel-card-import',  label:'Import kart paliw',     cat:'Finanse',      pkg:'pro',        icon:'ti-file-upload' },
    { id:'delegations',       label:'Delegacje',             cat:'Finanse',      pkg:'pro',        icon:'ti-plane' },
    { id:'leasing-schedule',  label:'Harmonogram leasingu',  cat:'Finanse',      pkg:'pro',        icon:'ti-calendar-event' },
    { id:'vehicle-equipment', label:'Wyposażenie pojazdu',   cat:'Flota',        pkg:'pro',        icon:'ti-settings-2' },
    { id:'vehicle-inventory', label:'Inwentaryzacja floty',  cat:'Flota',        pkg:'pro',        icon:'ti-clipboard-list' },
    { id:'fleet-reservations',label:'Rezerwacje pojazdów',   cat:'Flota',        pkg:'pro',        icon:'ti-calendar-check' },
    { id:'spare-parts',       label:'Części zamienne',       cat:'Serwis',       pkg:'pro',        icon:'ti-components' },
    { id:'service-contracts', label:'Umowy serwisowe',       cat:'Serwis',       pkg:'pro',        icon:'ti-file-certificate' },
    { id:'supplier-invoices', label:'Faktury dostawców serwisu',cat:'Serwis',    pkg:'pro',        icon:'ti-receipt' },
    { id:'approvals',         label:'Workflow zatwierdzeń',  cat:'System',       pkg:'pro',        icon:'ti-checks' },
    { id:'fleet-policies',    label:'Polityki floty',        cat:'System',       pkg:'pro',        icon:'ti-shield' },
    { id:'alert-dashboard',   label:'Dashboard alertów',     cat:'System',       pkg:'pro',        icon:'ti-bell-ringing' },
    { id:'mapa',              label:'Mapa floty',            cat:'GPS',          pkg:'pro',        icon:'ti-map' },
    { id:'raporty',           label:'Raporty',               cat:'Analityka',    pkg:'pro',        icon:'ti-chart-bar' },
    { id:'pdfexport',         label:'Eksport PDF',           cat:'Dokumenty',    pkg:'pro',        icon:'ti-file-type-pdf' },
    { id:'impexp',            label:'Import / Eksport danych',cat:'Dokumenty',   pkg:'pro',        icon:'ti-transfer' },
    // ENTERPRISE
    { id:'ev-fleet',          label:'Flota EV',              cat:'EV',           pkg:'enterprise', icon:'ti-bolt' },
    { id:'ev-charging',       label:'Sesje ładowania EV',    cat:'EV',           pkg:'enterprise', icon:'ti-charging-pile' },
    { id:'geofencing',        label:'Geofencing',            cat:'GPS',          pkg:'enterprise', icon:'ti-map-pin-check' },
    { id:'gps-integrations',  label:'GPS Integracje',        cat:'GPS',          pkg:'enterprise', icon:'ti-satellite' },
    { id:'trip-private',      label:'Jazdy pryw./służb.',    cat:'GPS',          pkg:'enterprise', icon:'ti-car-suv' },
    { id:'driver-wages',      label:'Wynagrodzenia kierowców',cat:'Kierowcy',    pkg:'enterprise', icon:'ti-cash' },
    { id:'route-cost',        label:'Kalkulator kosztów tras',cat:'Transport',   pkg:'enterprise', icon:'ti-calculator' },
    { id:'route-billing',     label:'Faktury tras',          cat:'Finanse',      pkg:'enterprise', icon:'ti-receipt-2' },
    { id:'smart-forms',       label:'Smart Forms',           cat:'System',       pkg:'enterprise', icon:'ti-forms' },
    { id:'fleet-kpi',         label:'Dashboard KPI',         cat:'Analityka',    pkg:'enterprise', icon:'ti-chart-bar' },
    { id:'zapier-ui',         label:'Zapier / Make',         cat:'Integracje',   pkg:'enterprise', icon:'ti-plug-connected' },
    { id:'insurance',         label:'Ubezpieczenia',         cat:'Flota',        pkg:'enterprise', icon:'ti-shield-check' },
    { id:'ai',                label:'Asystent AI',           cat:'AI',           pkg:'enterprise', icon:'ti-robot' },
    { id:'tco',               label:'TCO — koszty całkowite',cat:'Analityka',    pkg:'enterprise', icon:'ti-trending-up' },
    { id:'co2-report',        label:'Raport CO2',            cat:'Analityka',    pkg:'enterprise', icon:'ti-leaf' },
    { id:'executive-dashboard',label:'Dashboard CEO',        cat:'Analityka',    pkg:'enterprise', icon:'ti-presentation' },
    { id:'audit-log',         label:'Dziennik zdarzeń',      cat:'System',       pkg:'enterprise', icon:'ti-list-details' },
    { id:'vehicle-value',     label:'Wycena pojazdów',       cat:'Flota',        pkg:'enterprise', icon:'ti-coin' },
    { id:'gus-regon',         label:'GUS REGON',             cat:'Integracje',   pkg:'enterprise', icon:'ti-building' },
    { id:'vies-validator',    label:'VIES — weryfikacja VAT', cat:'Integracje',  pkg:'enterprise', icon:'ti-shield-half' },
    { id:'epp-vat',           label:'EPP VAT',               cat:'Podatki',      pkg:'enterprise', icon:'ti-receipt-tax' },
    { id:'integrations',      label:'Integracje zewnętrzne', cat:'Integracje',   pkg:'enterprise', icon:'ti-plug' },
    { id:'onboarding',        label:'Onboarding',            cat:'System',       pkg:'enterprise', icon:'ti-rocket' },
    { id:'walidacja',         label:'Walidacja danych',      cat:'System',       pkg:'enterprise', icon:'ti-check' },
  ];

  const PKG_MODULES = {
    basic:      ALL_MODULES.filter(m => m.pkg === 'basic').map(m => m.id),
    pro:        ALL_MODULES.filter(m => m.pkg === 'basic' || m.pkg === 'pro').map(m => m.id),
    enterprise: ALL_MODULES.map(m => m.id),
  };

  const PKG_META = {
    basic:      { label:'Basic',      color:'#6b7280', desc:'Podstawowe zarządzanie flotą' },
    pro:        { label:'Pro',        color:'#2563eb', desc:'Pełna flota + tachograf + finanse' },
    enterprise: { label:'Enterprise', color:'#7c3aed', desc:'Wszystkie moduły + AI + GPS + EV' },
  };

  // ── Stan ──────────────────────────────────────────────────────────────────
  let _cfg       = null;   // company_packages row
  let _users     = [];     // company users with permissions
  let _tab       = 'package';
  let _editUser  = null;   // user being edited in modal
  let _allowed   = null;   // null = unlimited | Set of allowed module IDs

  // ── Init: pobierz uprawnienia bieżącego użytkownika ──────────────────────
  async function init() {
    _injectStyles();
    const co = Co();
    if (!co) return;
    try {
      const r = await fetch(`${API()}/api/access-control/my-permissions?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) {
        const d = await r.json();
        _allowed = d.unlimited ? null : new Set(d.allowed || []);
      }
    } catch {}
    _applyToSidebar();
  }

  function canAccess(moduleId) {
    if (_allowed === null) return true; // unlimited (enterprise lub nie załadowano)
    return _allowed.has(moduleId);
  }

  function _applyToSidebar() {
    document.querySelectorAll('.tnb').forEach(btn => {
      const id = btn.id.replace('tnb-', '');
      if (!id || id === 'access-control') return; // samo narzędzie zawsze widoczne dla admina
      const hasAccess = canAccess(id);
      btn.classList.toggle('module-locked', !hasAccess);
    });
  }

  function _injectStyles() {
    if (document.getElementById('ac-styles')) return;
    const s = document.createElement('style');
    s.id = 'ac-styles';
    s.textContent = `
      .tnb.module-locked { opacity:.35; }
      .tnb.module-locked::after { content:'🔒'; position:absolute; top:2px; right:3px; font-size:9px; }
      .tnb { position:relative; }
      .ac-module-locked-page { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:380px;gap:16px;color:var(--text3) }
      .ac-module-locked-page .lock-icon { font-size:56px }
    `;
    document.head.appendChild(s);
  }

  function showLockedPage(moduleId, pageEl) {
    const mod = ALL_MODULES.find(m => m.id === moduleId);
    const reqPkg = mod?.pkg || 'enterprise';
    const pkgMeta = PKG_META[reqPkg] || PKG_META.enterprise;
    if (!pageEl) return;
    pageEl.innerHTML = `<div class="ac-module-locked-page">
      <div class="lock-icon">🔒</div>
      <div style="font-size:20px;font-weight:700;color:var(--text)">${e(mod?.label || moduleId)}</div>
      <div style="font-size:14px;text-align:center;max-width:400px">
        Ten moduł wymaga pakietu <span style="font-weight:700;color:${pkgMeta.color}">${pkgMeta.label}</span>.<br>
        Skontaktuj się z administratorem firmy lub właścicielem systemu, aby uzyskać dostęp.
      </div>
      <span style="background:${pkgMeta.color};color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600">${pkgMeta.label} — ${pkgMeta.desc}</span>
      <button class="btn" onclick="showPage('access-control')"><i class="ti ti-settings"></i> Zarządzaj dostępem</button>
    </div>`;
  }

  // ── Admin UI ──────────────────────────────────────────────────────────────
  async function renderAccessControl() {
    const co = Co();
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API()}/api/access-control/config?company=${encodeURIComponent(co)}`, { headers: H() }),
        fetch(`${API()}/api/access-control/users?company=${encodeURIComponent(co)}`, { headers: H() }),
      ]);
      if (r1.ok) _cfg   = await r1.json();
      if (r2.ok) _users = await r2.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-access-control');
    if (!el) return;
    const pkg     = _cfg?.package_name || 'enterprise';
    const pkgMeta = PKG_META[pkg] || PKG_META.enterprise;
    const custAdd = JSON.parse(_cfg?.modules_add || '[]');
    const custRem = JSON.parse(_cfg?.modules_remove || '[]');
    const validUntil = _cfg?.valid_until;

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-lock-access"></i> Kontrola dostępu i pakiety</h2>
  <span style="background:${pkgMeta.color};color:#fff;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700">
    <i class="ti ti-package"></i> ${pkgMeta.label}
  </span>
</div>
${validUntil ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:13px">
  <i class="ti ti-clock" style="color:#d97706"></i> Licencja ważna do: <strong>${e(validUntil)}</strong>
  ${_cfg?.notes ? ` &mdash; ${e(_cfg.notes)}` : ''}
</div>` : ''}
<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
  <button class="tab-btn ${_tab==='package'?'active':''}" onclick="window.AccessControl._setTab('package')"><i class="ti ti-package"></i> Pakiet firmy</button>
  <button class="tab-btn ${_tab==='modules'?'active':''}" onclick="window.AccessControl._setTab('modules')"><i class="ti ti-apps"></i> Moduły (${custAdd.length} dod. / ${custRem.length} wyłącz.)</button>
  <button class="tab-btn ${_tab==='users'?'active':''}" onclick="window.AccessControl._setTab('users')"><i class="ti ti-users"></i> Użytkownicy (${_users.length})</button>
</div>
<div id="ac-tab-content"></div>
<div id="ac-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
  <div id="ac-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(680px,96vw);max-height:92vh;overflow-y:auto"></div>
</div>`;
    _renderTab();
  }

  function _setTab(tab) { _tab = tab; _renderTab(); }

  function _renderTab() {
    const el = document.getElementById('ac-tab-content');
    if (!el) return;
    if (_tab === 'package')  { _renderPackageTab(el); return; }
    if (_tab === 'modules')  { _renderModulesTab(el); return; }
    if (_tab === 'users')    { _renderUsersTab(el); }
  }

  // ── Tab 1: Pakiet ─────────────────────────────────────────────────────────
  function _renderPackageTab(el) {
    const cur = _cfg?.package_name || 'enterprise';
    el.innerHTML = `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:24px">
  ${Object.entries(PKG_META).map(([key, meta]) => {
    const mods = PKG_MODULES[key] || [];
    const isActive = cur === key;
    return `<div style="border:2px solid ${isActive ? meta.color : 'var(--border)'};border-radius:12px;padding:20px;background:${isActive ? 'var(--bg2)' : 'var(--bg)'};cursor:pointer;transition:.2s" onclick="window.AccessControl._selectPackage('${key}')">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        ${isActive ? `<div style="width:20px;height:20px;border-radius:50%;background:${meta.color};display:flex;align-items:center;justify-content:center"><i class="ti ti-check" style="color:#fff;font-size:12px"></i></div>` : `<div style="width:20px;height:20px;border-radius:50%;border:2px solid var(--border)"></div>`}
        <span style="font-weight:700;font-size:16px;color:${meta.color}">${meta.label}</span>
      </div>
      <p style="font-size:12px;color:var(--text3);margin:0 0 10px">${meta.desc}</p>
      <div style="font-size:11px;color:var(--text2)">${mods.length} modułów</div>
      ${isActive ? `<div style="margin-top:10px;font-size:11px;font-weight:700;color:${meta.color}">✓ Aktualny pakiet</div>` : ''}
    </div>`;
  }).join('')}
</div>

<div style="background:var(--bg2);border-radius:12px;padding:20px">
  <h3 style="font-size:14px;margin:0 0 14px"><i class="ti ti-table"></i> Porównanie pakietów</h3>
  <div style="overflow-x:auto">
  <table class="data-table" style="font-size:12px;min-width:500px">
    <thead><tr><th>Kategoria / Moduł</th><th style="text-align:center;color:#6b7280">Basic</th><th style="text-align:center;color:#2563eb">Pro</th><th style="text-align:center;color:#7c3aed">Enterprise</th></tr></thead>
    <tbody>
    ${Object.entries(_groupByCategory(ALL_MODULES)).map(([cat, mods]) => `
      <tr style="background:var(--bg)"><td colspan="4" style="font-weight:700;font-size:11px;text-transform:uppercase;color:var(--text3);padding:6px 10px">${e(cat)}</td></tr>
      ${mods.map(m => `<tr>
        <td style="padding-left:20px"><i class="ti ${m.icon}" style="color:var(--text3)"></i> ${e(m.label)}</td>
        <td style="text-align:center">${m.pkg==='basic'?'✅':'—'}</td>
        <td style="text-align:center">${['basic','pro'].includes(m.pkg)?'✅':'—'}</td>
        <td style="text-align:center">✅</td>
      </tr>`).join('')}
    `).join('')}
    </tbody>
  </table>
  </div>
</div>`;
  }

  async function _selectPackage(pkg) {
    if (!confirm(`Zmienić pakiet firmy na "${PKG_META[pkg]?.label}"?`)) return;
    const custAdd = JSON.parse(_cfg?.modules_add || '[]');
    const custRem = JSON.parse(_cfg?.modules_remove || '[]');
    try {
      const r = await fetch(`${API()}/api/access-control/config?company=${encodeURIComponent(Co())}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: pkg, modules_add: custAdd, modules_remove: custRem, valid_until: _cfg?.valid_until, notes: _cfg?.notes })
      });
      if (r.ok) { if (_cfg) _cfg.package_name = pkg; await renderAccessControl(); }
      else alert('Błąd: ' + await r.text());
    } catch (ex) { alert(ex.message); }
  }

  // ── Tab 2: Moduły indywidualne ────────────────────────────────────────────
  function _renderModulesTab(el) {
    const pkg     = _cfg?.package_name || 'enterprise';
    const base    = new Set(PKG_MODULES[pkg] || ALL_MODULES.map(m => m.id));
    const custAdd = new Set(JSON.parse(_cfg?.modules_add || '[]'));
    const custRem = new Set(JSON.parse(_cfg?.modules_remove || '[]'));

    el.innerHTML = `
<div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px">
  <i class="ti ti-info-circle" style="color:var(--blue)"></i>
  Moduły <strong>zielone</strong> — aktywne w pakiecie.
  Możesz <strong>dodać</strong> moduły spoza pakietu lub <strong>wyłączyć</strong> moduły z pakietu dla całej firmy.
  Zmiany per-użytkownik konfiguruj w zakładce "Użytkownicy".
</div>
<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px">
  <button class="btn btn-primary" onclick="window.AccessControl._saveModules()"><i class="ti ti-device-floppy"></i> Zapisz moduły</button>
</div>
${Object.entries(_groupByCategory(ALL_MODULES)).map(([cat, mods]) => `
<div style="margin-bottom:16px">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:8px;letter-spacing:.5px">${e(cat)}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">
  ${mods.map(m => {
    const inBase   = base.has(m.id);
    const isAdd    = custAdd.has(m.id);
    const isRem    = custRem.has(m.id);
    const active   = (inBase || isAdd) && !isRem;
    const pkgMeta  = PKG_META[m.pkg] || PKG_META.enterprise;
    return `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid ${active?pkgMeta.color:'var(--border)'};border-radius:8px;cursor:pointer;background:${active?'var(--bg2)':'var(--bg)'}">
      <input type="checkbox" class="ac-mod-cb" data-id="${e(m.id)}" data-inbase="${inBase?1:0}" ${active?'checked':''}>
      <i class="ti ${e(m.icon)}" style="color:${active?pkgMeta.color:'var(--text3)'}"></i>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(m.label)}</div>
        <div style="font-size:10px;color:${pkgMeta.color}">${pkgMeta.label}${isAdd?' · ✦ dodany':''}${isRem?' · ✕ wyłączony':''}</div>
      </div>
    </label>`;
  }).join('')}
  </div>
</div>`).join('')}`;
  }

  async function _saveModules() {
    const pkg  = _cfg?.package_name || 'enterprise';
    const base = new Set(PKG_MODULES[pkg] || ALL_MODULES.map(m => m.id));
    const add = [], rem = [];
    document.querySelectorAll('.ac-mod-cb').forEach(cb => {
      const id = cb.dataset.id;
      const inBase = cb.dataset.inbase === '1';
      if (cb.checked && !inBase)  add.push(id);  // dodano ponad pakiet
      if (!cb.checked && inBase)  rem.push(id);  // wyłączono z pakietu
    });
    try {
      const r = await fetch(`${API()}/api/access-control/config?company=${encodeURIComponent(Co())}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_name: pkg, modules_add: add, modules_remove: rem, valid_until: _cfg?.valid_until, notes: _cfg?.notes })
      });
      if (r.ok) { await renderAccessControl(); await init(); }
      else alert('Błąd: ' + await r.text());
    } catch (ex) { alert(ex.message); }
  }

  // ── Tab 3: Użytkownicy ────────────────────────────────────────────────────
  function _renderUsersTab(el) {
    const pkg  = _cfg?.package_name || 'enterprise';
    const base = new Set(PKG_MODULES[pkg] || ALL_MODULES.map(m => m.id));
    const custAdd = JSON.parse(_cfg?.modules_add || '[]');
    const custRem = JSON.parse(_cfg?.modules_remove || '[]');
    const companyModules = new Set([...base, ...custAdd].filter(m => !custRem.includes(m)));

    const ROLE_LBL = { admin:'Administrator', kierownik:'Kierownik', ksiegowy:'Księgowy', mechanik:'Mechanik', dyspozytor:'Dyspozytor', kierowca:'Kierowca' };
    const ROLE_CLS = { admin:'danger', kierownik:'', ksiegowy:'ok', mechanik:'warn', dyspozytor:'', kierowca:'pill-gray' };

    el.innerHTML = `
<div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px">
  <i class="ti ti-info-circle" style="color:var(--blue)"></i>
  Domyślnie użytkownicy dziedziczą dostęp z pakietu firmy i swojej roli.
  Kliknij <strong>Konfiguruj</strong> aby nadać lub odebrać konkretne moduły danemu użytkownikowi.
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Użytkownik</th><th>Rola</th><th>Własne uprawnienia</th><th>Odmowy</th><th></th></tr></thead>
<tbody>
${_users.length ? _users.map(u => {
  const allowed = u.allowed_modules ? JSON.parse(u.allowed_modules) : null;
  const denied  = JSON.parse(u.denied_modules || '[]');
  return `<tr>
    <td>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${e((u.name||u.email||'?').slice(0,2).toUpperCase())}</div>
        <div><div style="font-weight:600;font-size:13px">${e(u.name||u.email)}</div><div style="font-size:11px;color:var(--text3)">${e(u.email)}</div></div>
      </div>
    </td>
    <td><span class="pill ${ROLE_CLS[u.role]||''}">${ROLE_LBL[u.role]||e(u.role)}</span></td>
    <td>
      ${allowed !== null
        ? `<span class="pill ok">${allowed.length} modułów (własna lista)</span>`
        : `<span style="font-size:12px;color:var(--text3)">Dziedzicz z firmy</span>`}
    </td>
    <td>${denied.length > 0 ? `<span class="pill danger">${denied.length} odmów</span>` : '<span style="font-size:12px;color:var(--text3)">—</span>'}</td>
    <td style="display:flex;gap:6px">
      <button class="btn" style="font-size:12px;padding:4px 10px" data-uid="${e(u.id)}" onclick="window.AccessControl._openUserModal(this.dataset.uid)">
        <i class="ti ti-settings"></i> Konfiguruj
      </button>
      ${allowed !== null || denied.length > 0 ? `<button class="btn" style="font-size:12px;padding:4px 10px;color:var(--red)" data-uid="${e(u.id)}" onclick="window.AccessControl._resetUser(this.dataset.uid)" title="Resetuj do domyślnych"><i class="ti ti-refresh"></i></button>` : ''}
    </td>
  </tr>`;
}).join('') : '<tr><td colspan="5" class="empty">Brak użytkowników</td></tr>'}
</tbody></table></div>`;
  }

  function _openUserModal(userId) {
    _editUser = _users.find(u => String(u.id) === String(userId));
    if (!_editUser) return;
    const pkg        = _cfg?.package_name || 'enterprise';
    const base       = new Set(PKG_MODULES[pkg] || ALL_MODULES.map(m => m.id));
    const custAdd    = new Set(JSON.parse(_cfg?.modules_add || '[]'));
    const custRem    = new Set(JSON.parse(_cfg?.modules_remove || '[]'));
    const companySet = new Set([...base, ...custAdd].filter(m => !custRem.has(m)));
    const userAllowed= _editUser.allowed_modules ? new Set(JSON.parse(_editUser.allowed_modules)) : null;
    const userDenied = new Set(JSON.parse(_editUser.denied_modules || '[]'));
    const inner = document.getElementById('ac-modal-inner');
    const modal = document.getElementById('ac-modal');
    if (!inner || !modal) return;
    const ROLE_LBL = { admin:'Administrator', kierownik:'Kierownik', ksiegowy:'Księgowy', mechanik:'Mechanik', dyspozytor:'Dyspozytor', kierowca:'Kierowca' };

    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <div>
    <h3 style="margin:0">${e(_editUser.name||_editUser.email)}</h3>
    <span style="font-size:12px;color:var(--text3)">${ROLE_LBL[_editUser.role]||e(_editUser.role)} · ${e(_editUser.email)}</span>
  </div>
  <button onclick="window.AccessControl._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg2);border-radius:8px;margin-bottom:14px">
  <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
    <input type="checkbox" id="ac-u-custom" ${userAllowed !== null ? 'checked' : ''} onchange="window.AccessControl._toggleCustomMode(this.checked)">
    <strong>Własna lista modułów</strong> (zamiast dziedziczenia z firmy)
  </label>
</div>
<div id="ac-u-inherit-note" style="${userAllowed !== null ? 'display:none' : ''}">
  <div style="font-size:12px;color:var(--text3);margin-bottom:14px">
    Użytkownik dziedziczy <strong>${companySet.size}</strong> modułów z pakietu firmy.
    Możesz zablokować konkretne moduły poniżej lub włączyć "własną listę" dla pełnej kontroli.
  </div>
</div>
<div style="display:flex;gap:8px;margin-bottom:10px">
  <button class="btn btn-secondary" onclick="window.AccessControl._checkAll(true)">Zaznacz wszystkie</button>
  <button class="btn btn-secondary" onclick="window.AccessControl._checkAll(false)">Odznacz wszystkie</button>
</div>
${Object.entries(_groupByCategory(ALL_MODULES)).map(([cat, mods]) => `
<div style="margin-bottom:12px">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:6px">${e(cat)}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px">
  ${mods.map(m => {
    const inCompany = companySet.has(m.id);
    const checked   = userAllowed !== null ? userAllowed.has(m.id) : (inCompany && !userDenied.has(m.id));
    const pkgColor  = PKG_META[m.pkg]?.color || '#6b7280';
    return `<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;${!inCompany?'opacity:.4':''}" title="${!inCompany?'Poza pakietem firmy':''}">
      <input type="checkbox" class="ac-u-cb" data-id="${e(m.id)}" data-incompany="${inCompany?1:0}" ${checked?'checked':''}>
      <i class="ti ${e(m.icon)}" style="color:${pkgColor}"></i>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(m.label)}</span>
    </label>`;
  }).join('')}
  </div>
</div>`).join('')}
<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
  <button class="btn" onclick="window.AccessControl._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.AccessControl._saveUser()"><i class="ti ti-device-floppy"></i> Zapisz uprawnienia</button>
</div>`;
    modal.style.display = 'flex';
  }

  function _toggleCustomMode(isCustom) {
    const note = document.getElementById('ac-u-inherit-note');
    if (note) note.style.display = isCustom ? 'none' : '';
  }

  function _checkAll(checked) {
    document.querySelectorAll('.ac-u-cb').forEach(cb => { cb.checked = checked; });
  }

  async function _saveUser() {
    if (!_editUser) return;
    const isCustom = document.getElementById('ac-u-custom')?.checked;
    const cbs      = document.querySelectorAll('.ac-u-cb');
    let allowed  = null;
    let denied   = [];
    if (isCustom) {
      allowed = [];
      cbs.forEach(cb => { if (cb.checked) allowed.push(cb.dataset.id); });
    } else {
      // Dziedzicz z firmy — tylko zbieraj odmowy
      cbs.forEach(cb => { if (!cb.checked && cb.dataset.incompany === '1') denied.push(cb.dataset.id); });
    }
    try {
      const r = await fetch(`${API()}/api/access-control/users/${encodeURIComponent(_editUser.id)}?company=${encodeURIComponent(Co())}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_modules: allowed, denied_modules: denied })
      });
      if (!r.ok) throw new Error(await r.text());
      _closeModal();
      await renderAccessControl();
      await init(); // Odśwież uprawnienia bieżącego użytkownika
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  async function _resetUser(userId) {
    if (!confirm('Zresetować uprawnienia użytkownika do domyślnych (dziedziczenie z firmy)?')) return;
    try {
      await fetch(`${API()}/api/access-control/users/${encodeURIComponent(userId)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderAccessControl();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  function _closeModal() {
    const m = document.getElementById('ac-modal');
    if (m) m.style.display = 'none';
    _editUser = null;
  }

  // ── Helper ────────────────────────────────────────────────────────────────
  function _groupByCategory(mods) {
    const map = {};
    for (const m of mods) {
      if (!map[m.cat]) map[m.cat] = [];
      map[m.cat].push(m);
    }
    return map;
  }

  window.AccessControl = {
    init, canAccess, showLockedPage,
    renderAccessControl,
    _setTab, _selectPackage, _saveModules,
    _openUserModal, _toggleCustomMode, _checkAll, _saveUser, _resetUser,
    _closeModal,
  };
})();
