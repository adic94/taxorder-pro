/**
 * TaxOrder Pro — Konfiguracja modułów
 * Włącz/wyłącz widoczność pozycji w nawigacji i widgetów na dashboardzie.
 * Ustawienia zapisywane w KV per firma.
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()  || window.currentCompanyId || '';

  // ── Moduły których nie można wyłączyć (core) ──────────────────────────────
  const CORE = new Set(['dash','pojazdy','zlecenia','paliwo','kalkulator','formularze','firmy','uzytkownicy','ai']);

  // ── Definicja wszystkich pozycji nawigacji (w kolejności z sidebara) ───────
  const NAV_SECTIONS = [
    { label: 'Flota', items: [
      { key: 'pojazdy',          label: 'Pojazdy',              icon: 'ti-truck' },
      { key: 'kierowcy',         label: 'Kierowcy',             icon: 'ti-id-badge' },
      { key: 'kalendarz',        label: 'Kalendarz',            icon: 'ti-calendar' },
      { key: 'protokoly',        label: 'Protokoły',            icon: 'ti-file-signature' },
      { key: 'mapa',             label: 'Mapa GPS',             icon: 'ti-map-2' },
      { key: 'fleet-kanban',     label: 'Kanban floty',         icon: 'ti-layout-kanban' },
      { key: 'ev-fleet',         label: 'Flota EV / Hybrid',    icon: 'ti-plug' },
      { key: 'vehicle-equipment',label: 'Wyposażenie',          icon: 'ti-tool' },
    ]},
    { label: 'Eksploatacja', items: [
      { key: 'zlecenia',         label: 'Serwis / Zlecenia',    icon: 'ti-clipboard-list' },
      { key: 'opony-magazyn',    label: 'Opony',                icon: 'ti-circle-dot' },
      { key: 'szkody',           label: 'Szkody',               icon: 'ti-alert-triangle' },
      { key: 'mandaty',          label: 'Mandaty',              icon: 'ti-ticket' },
    ]},
    { label: 'Zarządzanie', items: [
      { key: 'exec-dashboard',   label: 'Dashboard exec.',      icon: 'ti-layout-dashboard' },
      { key: 'fleet-kpi',        label: 'Dashboard KPI',        icon: 'ti-chart-bar' },
      { key: 'approvals',        label: 'Zatwierdzenia',        icon: 'ti-checks' },
      { key: 'approval-levels',  label: 'Poziomy zatwierdzeń',  icon: 'ti-list-check' },
      { key: 'audit-log',        label: 'Historia zmian',       icon: 'ti-history' },
      { key: 'access-control',   label: 'Dostęp / Pakiety',     icon: 'ti-lock-access' },
    ]},
    { label: 'Kierowcy — Zarządzanie', items: [
      { key: 'driver-profiles',  label: 'Profile kierowców',    icon: 'ti-id-badge' },
      { key: 'driver-performance',label:'Wydajność kierowców',  icon: 'ti-chart-infographic' },
      { key: 'driver-scoring',   label: 'Scoring kierowców',    icon: 'ti-award' },
      { key: 'driver-wages',     label: 'Wynagrodzenia',        icon: 'ti-cash' },
      { key: 'driver-schedule',  label: 'Grafik kierowców',     icon: 'ti-calendar-week' },
      { key: 'driver-panel',     label: 'Panel kierowcy',       icon: 'ti-steering-wheel' },
      { key: 'reservations',     label: 'Rezerwacje',           icon: 'ti-calendar-event' },
    ]},
    { label: 'Flota — Operacje', items: [
      { key: 'fleet-reservations',label:'Rezerwacje pojazdów',  icon: 'ti-calendar-event' },
      { key: 'fleet-policies',   label: 'Polityki flotowe',     icon: 'ti-settings-2' },
      { key: 'spare-parts',      label: 'Magazyn części',       icon: 'ti-package' },
      { key: 'service-contracts',label: 'Kontrakty serwisów',   icon: 'ti-contract' },
      { key: 'supplier-invoices',label: 'Faktury dostawców',    icon: 'ti-receipt' },
      { key: 'transport-orders', label: 'Zlecenia transportowe',icon: 'ti-truck' },
      { key: 'fuel-card-import', label: 'Import kart paliwowych',icon: 'ti-credit-card' },
      { key: 'tachograph',       label: 'Tachografy DDD',       icon: 'ti-device-tablet-search' },
    ]},
    { label: 'Logistyka & TCO', items: [
      { key: 'vehicle-inventory',label: 'Inwentaryzacja',       icon: 'ti-list-check' },
      { key: 'delegations',      label: 'Delegacje',            icon: 'ti-briefcase' },
      { key: 'tco',              label: 'TCO pojazdów',         icon: 'ti-calculator' },
      { key: 'co2-report',       label: 'Raport CO₂',          icon: 'ti-leaf' },
      { key: 'budget-annual',    label: 'Budżet roczny',        icon: 'ti-report-money' },
      { key: 'epp-vat',          label: 'EPP / VAT',            icon: 'ti-file-certificate' },
    ]},
    { label: 'Compliance & Finanse', items: [
      { key: 'trip-private',     label: 'Prywatna / Służbowa',  icon: 'ti-car-suv' },
      { key: 'route-cost',       label: 'Koszty tras',          icon: 'ti-calculator' },
      { key: 'route-billing',    label: 'Faktury tras',         icon: 'ti-receipt' },
      { key: 'insurance',        label: 'Ubezpieczenia',        icon: 'ti-shield-check' },
      { key: 'ksef',             label: 'KSeF / e-Faktury',     icon: 'ti-file-invoice' },
      { key: 'gdpr',             label: 'RODO / ADO',           icon: 'ti-shield-lock' },
      { key: 'ev-charging',      label: 'Ładowanie EV',         icon: 'ti-bolt' },
      { key: 'currency',         label: 'Waluty',               icon: 'ti-currency-zloty' },
    ]},
    { label: 'Integracje & Tech', items: [
      { key: 'geofencing',       label: 'Geofencing',           icon: 'ti-map-pin-check' },
      { key: 'gps-integrations', label: 'GPS Integracje',       icon: 'ti-satellite' },
      { key: 'smart-forms',      label: 'Smart Forms',          icon: 'ti-forms' },
      { key: 'integrations',     label: 'Integracje zewnętrzne',icon: 'ti-plug' },
      { key: 'zapier-ui',        label: 'Zapier / Make',        icon: 'ti-plug-connected' },
    ]},
    { label: 'Pojazdy — inspekcje', items: [
      { key: 'vehicle-inspections',label:'Inspekcje pojazdów',  icon: 'ti-clipboard-check' },
      { key: 'fleet-renewal',    label: 'Wymiana floty',        icon: 'ti-refresh-dot' },
      { key: 'fleet-limits',     label: 'Limity km / paliwa',   icon: 'ti-gauge' },
      { key: 'parking',          label: 'Miejsca parkingowe',   icon: 'ti-parking' },
    ]},
    { label: 'Kierowcy — Rozwój', items: [
      { key: 'driver-training',  label: 'Szkolenia / Badania',  icon: 'ti-school' },
      { key: 'carpooling',       label: 'Carpooling',           icon: 'ti-users' },
      { key: 'internal-rental',  label: 'Wynajem wewnętrzny',   icon: 'ti-building-warehouse' },
      { key: 'driver-worktime',  label: 'Czas pracy kierowcy',  icon: 'ti-clock' },
    ]},
    { label: 'Serwis predykcyjny', items: [
      { key: 'predictive-maintenance',label:'Serwis predykcyjny',icon: 'ti-bulb' },
      { key: 'warranties',       label: 'Gwarancje / Recall',   icon: 'ti-certificate' },
      { key: 'fleet-disposal',   label: 'Likwidacja pojazdu',   icon: 'ti-car-off' },
      { key: 'video-telematics', label: 'Telematyka wideo',     icon: 'ti-camera' },
      { key: 'vehicle-qr',       label: 'Kody QR',              icon: 'ti-qrcode' },
    ]},
    { label: 'Finanse i compliance', items: [
      { key: 'suppliers',        label: 'Dostawcy',             icon: 'ti-building-factory-2' },
      { key: 'report-builder',   label: 'Kreator raportów',     icon: 'ti-table-options' },
      { key: 'jpk',              label: 'JPK / SAF-T',          icon: 'ti-file-type-xml' },
      { key: 'esg-report',       label: 'Raport ESG',           icon: 'ti-leaf' },
      { key: 'edoreczenia',      label: 'e-Doręczenia',         icon: 'ti-mailbox' },
    ]},
    { label: 'Transport i komunikacja', items: [
      { key: 'cmr',              label: 'CMR',                  icon: 'ti-file-invoice' },
      { key: 'sent',             label: 'SENT / PUESC',         icon: 'ti-truck-delivery' },
      { key: 'messenger',        label: 'Komunikator',          icon: 'ti-message-circle' },
    ]},
    { label: 'Koszty', items: [
      { key: 'paliwo',           label: 'Paliwo',               icon: 'ti-gas-station' },
      { key: 'karty',            label: 'Karty flotowe',        icon: 'ti-credit-card' },
      { key: 'cfm-klienci',      label: 'Klienci CFM',          icon: 'ti-building-store' },
      { key: 'cfm-kontrakty',    label: 'Kontrakty CFM',        icon: 'ti-file-description' },
      { key: 'cfm-faktury',      label: 'Faktury CFM',          icon: 'ti-file-invoice' },
    ]},
    { label: 'Dokumenty', items: [
      { key: 'dok-smart',        label: 'Dokumenty flotowe',    icon: 'ti-files' },
      { key: 'policies',         label: 'Polisy ubezpieczeniowe',icon:'ti-shield-check' },
      { key: 'service-schedule', label: 'Harmonogram serwisu',  icon: 'ti-tool' },
      { key: 'mileage-claims',   label: 'Rozliczenia km',       icon: 'ti-road' },
      { key: 'oddzialy',         label: 'Oddziały',             icon: 'ti-building' },
      { key: 'impexp',           label: 'Import / Eksport',     icon: 'ti-arrows-exchange' },
      { key: 'ocr',              label: 'OCR Dowodów',          icon: 'ti-scan' },
      { key: 'pdfexport',        label: 'Eksport PDF',          icon: 'ti-file-type-pdf' },
    ]},
    { label: 'Raporty & Analityka', items: [
      { key: 'raporty',          label: 'Raporty',              icon: 'ti-chart-line' },
      { key: 'budzet',           label: 'Budżet / TCO',         icon: 'ti-wallet' },
      { key: 'fuel-db',          label: 'Ewidencja paliwa',     icon: 'ti-droplet' },
      { key: 'budgets',          label: 'Budżety',              icon: 'ti-target' },
      { key: 'faults',           label: 'Usterki',              icon: 'ti-alert-triangle' },
      { key: 'driver-shifts',    label: 'Czas pracy (zmiany)',  icon: 'ti-clock' },
      { key: 'tacho',            label: 'Tachograf',            icon: 'ti-device-desktop' },
      { key: 'benchmark',        label: 'Benchmark kosztów',    icon: 'ti-chart-bar' },
      { key: 'fk-export',        label: 'Eksport FK',           icon: 'ti-file-export' },
      { key: 'leasing-schedule', label: 'Harmonogram leasingu', icon: 'ti-file-dollar' },
      { key: 'vehicle-value',    label: 'Wartość pojazdów',     icon: 'ti-trending-down' },
    ]},
    { label: 'Podatki', items: [
      { key: 'kalkulator',       label: 'Kalkulator DT-1',      icon: 'ti-calculator' },
      { key: 'formularze',       label: 'Deklaracja DT-1',      icon: 'ti-file-text' },
      { key: 'stawki',           label: 'Stawki 2026',          icon: 'ti-building-bank' },
      { key: 'podatnik',         label: 'Podatnik',             icon: 'ti-building' },
      { key: 'pd',               label: 'Eksport PD',           icon: 'ti-upload' },
      { key: 'walidacja',        label: 'Walidacja DT-1',       icon: 'ti-shield-check' },
      { key: 'faktury',          label: 'Faktury',              icon: 'ti-file-invoice' },
      { key: 'dt1-historia',     label: 'Historia DT-1',        icon: 'ti-file-certificate' },
    ]},
    { label: 'Powiadomienia', items: [
      { key: 'alert-dashboard',  label: 'Alerty i terminy',     icon: 'ti-bell-ringing' },
      { key: 'terminarz',        label: 'Terminarz',            icon: 'ti-calendar-check' },
      { key: 'powiadomienia',    label: 'Powiadomienia',        icon: 'ti-bell-cog' },
      { key: 'webhooks',         label: 'Webhooki',             icon: 'ti-webhook' },
      { key: 'errors-admin',     label: 'Błędy JS (logi)',      icon: 'ti-bug' },
      { key: 'polisy-ocr',       label: 'Import polis OCR',     icon: 'ti-scan' },
      { key: 'dr-import',        label: 'Import DR (Aztec)',    icon: 'ti-id-badge' },
    ]},
    { label: 'Administracja', items: [
      { key: 'firmy',            label: 'Firmy',                icon: 'ti-building-community' },
      { key: 'uzytkownicy',      label: 'Użytkownicy',          icon: 'ti-users' },
      { key: 'api-klucze',       label: 'Klucze API',           icon: 'ti-key' },
      { key: 'cepik',            label: 'CEPiK',                icon: 'ti-database' },
      { key: 'gus-regon',        label: 'GUS / REGON',          icon: 'ti-building-community' },
      { key: 'vies-validator',   label: 'Walidator VIES',       icon: 'ti-world-check' },
      { key: 'feature-config',   label: 'Konfiguracja modułów', icon: 'ti-layout-sidebar' },
    ]},
    { label: 'AI', items: [
      { key: 'ai',               label: 'Asystent AI',          icon: 'ti-robot' },
    ]},
  ];

  // Widgety dashboardu (muszą odpowiadać DASH_WIDGETS w app.js)
  const DASH_WIDGETS_DEF = [
    { id: 'kpi',             label: 'Wskaźniki KPI floty',             icon: 'ti-chart-bar' },
    { id: 'notifs',          label: 'Mandaty / Kierowcy / Karty',      icon: 'ti-bell' },
    { id: 'alerts',          label: 'Alerty terminów',                 icon: 'ti-bell-ringing' },
    { id: 'service_fuel',    label: 'Serwis + Paliwo',                 icon: 'ti-tools' },
    { id: 'activity',        label: 'Aktywność floty',                 icon: 'ti-activity' },
    { id: 'policies_claims', label: 'Polisy wygasające + Rozliczenia', icon: 'ti-shield-check' },
    { id: 'structure',       label: 'Struktura floty + DT-1',          icon: 'ti-chart-pie' },
  ];

  // ── Wewnętrzny stan ────────────────────────────────────────────────────────
  let _pending = {};      // tymczasowe zmiany w edytorze (przed zapisem)
  let _pendingDash = [];  // lista ukrytych widgetów (przed zapisem)

  // ── API helpers ────────────────────────────────────────────────────────────
  async function loadFlags() {
    try {
      const r = await fetch(`${API()}/api/feature-flags?company=${Co()}`, { headers: H() });
      const d = await r.json().catch(() => ({}));
      window._featureFlags = { nav: d.nav || {}, dash: d.dash || null };
    } catch {
      window._featureFlags = { nav: {}, dash: null };
    }
    applyNavFlags();
    // Odśwież widok konfiguracji jeśli jest aktywny
    if (document.getElementById('page-feature-config')?.classList.contains('active')) {
      renderPage();
    }
  }

  async function saveFlags(navFlags, dashHidden) {
    const body = { nav: navFlags };
    if (dashHidden !== undefined) body.dash = dashHidden;
    await fetch(`${API()}/api/feature-flags?company=${Co()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...H() },
      body: JSON.stringify(body),
    });
    window._featureFlags = { ...window._featureFlags, nav: navFlags };
    if (dashHidden !== undefined) window._featureFlags.dash = dashHidden;
    applyNavFlags();
  }

  // ── Zastosuj flagi do sidebara ─────────────────────────────────────────────
  function applyNavFlags() {
    const flags = window._featureFlags?.nav || {};
    const nav   = document.getElementById('main-sidebar');
    if (!nav) return;

    let currentLabel    = null;
    let sectionCollapsed = false;
    let hasVisible      = false;

    Array.from(nav.children).forEach(el => {
      if (el.classList.contains('sidebar-label')) {
        if (currentLabel) currentLabel.style.display = hasVisible ? '' : 'none';
        currentLabel     = el;
        currentLabel.style.display = '';
        sectionCollapsed = el.classList.contains('collapsed');
        hasVisible       = false;
      } else if (el.classList.contains('tnb')) {
        const key     = (el.id || '').replace('tnb-', '');
        const enabled = flags[key] !== false;
        // gdy sekcja jest zwinięta, przycisk pozostaje ukryty niezależnie od flagi
        el.style.display = (enabled && !sectionCollapsed) ? '' : 'none';
        if (enabled) hasVisible = true;
      }
    });
    if (currentLabel) currentLabel.style.display = hasVisible ? '' : 'none';
  }

  // ── Stan zwinięcia sekcji (localStorage) ─────────────────────────────────
  const COLLAPSE_KEY = 'fc-collapsed-sections';
  function _loadCollapsed()  { try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch { return new Set(); } }
  function _saveCollapsed(s) { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s])); }

  // ── Render strony konfiguracji ─────────────────────────────────────────────
  function renderPage() {
    const el = document.getElementById('page-feature-config');
    if (!el) return;

    const flags      = window._featureFlags?.nav || {};
    const dashHidden = window._featureFlags?.dash || [];
    const collapsed  = _loadCollapsed();

    _pending     = { ...flags };
    _pendingDash = [...dashHidden];

    let totalCount = 0, disabledCount = 0;
    NAV_SECTIONS.forEach(s => s.items.forEach(item => {
      totalCount++;
      if (flags[item.key] === false) disabledCount++;
    }));

    el.innerHTML = `
    <div style="max-width:1100px;padding:24px 20px">

      <!-- Nagłówek -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px">
            <i class="ti ti-layout-sidebar" style="color:var(--blue)"></i>
            Konfiguracja modułów
          </h2>
          <div style="font-size:12px;color:var(--text2);margin-top:3px">
            Włącz lub wyłącz moduły w bocznym menu. Ustawienia per firma, zapisywane w chmurze.
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="font-size:12px;color:var(--text2);padding:4px 10px;background:var(--bg3);border-radius:20px">
            Aktywnych: <strong id="fc-count-on">${totalCount - disabledCount}</strong> / ${totalCount}
          </span>
          <button class="btn" onclick="FeatureConfig._collapseAll()" style="font-size:12px" title="Zwiń wszystkie sekcje">
            <i class="ti ti-layout-navbar-collapse"></i> Zwiń
          </button>
          <button class="btn" onclick="FeatureConfig._expandAll()" style="font-size:12px" title="Rozwiń wszystkie sekcje">
            <i class="ti ti-layout-navbar-expand"></i> Rozwiń
          </button>
          <button class="btn" onclick="FeatureConfig._resetAll()" style="font-size:12px">
            <i class="ti ti-refresh"></i> Włącz wszystko
          </button>
          <button class="btn btn-blue" onclick="FeatureConfig._save()" id="fc-save-btn" style="font-size:13px;font-weight:600">
            <i class="ti ti-device-floppy"></i> Zapisz zmiany
          </button>
        </div>
      </div>

      <!-- Szukajka -->
      <div style="position:relative;margin-bottom:20px">
        <i class="ti ti-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:15px;pointer-events:none"></i>
        <input id="fc-search" type="text" class="fi"
          placeholder="Szukaj modułu… (np. delegacje, mapa, OCR)"
          style="padding-left:36px;font-size:13px;width:100%"
          oninput="FeatureConfig._onSearch(this.value)">
      </div>

      <!-- Karty sekcji -->
      <div style="display:flex;flex-direction:column;gap:12px" id="fc-sections">
        ${NAV_SECTIONS.map(sec => {
          const secKey   = sec.label.replace(/[^a-z0-9]/gi, '');
          const isCollapsed = collapsed.has(sec.label);
          return `
          <div class="card fc-section" data-section="${esc(sec.label)}">
            <div style="padding:10px 16px;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none"
              data-sec="${esc(sec.label)}"
              onclick="FeatureConfig._toggleSection(this)">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2)">${esc(sec.label)}</span>
              <span style="font-size:11px;color:var(--text3);margin-left:4px" id="fc-sec-count-${secKey}"></span>
              <i class="ti ti-chevron-down fc-chevron" style="margin-left:auto;font-size:14px;color:var(--text3);transition:transform .2s${isCollapsed ? ';transform:rotate(-90deg)' : ''}"></i>
            </div>
            <div class="fc-sec-body" style="display:${isCollapsed ? 'none' : 'grid'};grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1px;background:var(--border)">
              ${sec.items.map(item => {
                const isCore    = CORE.has(item.key);
                const isEnabled = flags[item.key] !== false;
                return `<div class="fc-item" data-key="${esc(item.key)}" data-label="${esc(item.label.toLowerCase())}"
                  style="background:var(--bg2);padding:10px 14px;display:flex;align-items:center;gap:10px">
                  <i class="ti ${item.icon}" style="font-size:16px;color:var(--text2);flex-shrink:0;width:18px;text-align:center"></i>
                  <span style="flex:1;font-size:13px;color:var(--text);${isCore ? 'opacity:.65' : ''}">${esc(item.label)}</span>
                  ${isCore
                    ? `<span title="Moduł wymagany" style="font-size:10px;color:var(--text3);flex-shrink:0">
                        <i class="ti ti-lock" style="font-size:11px"></i>
                       </span>`
                    : `<label class="fc-toggle" title="${isEnabled ? 'Wyłącz' : 'Włącz'}">
                        <input type="checkbox" data-key="${esc(item.key)}" ${isEnabled ? 'checked' : ''}
                          onchange="FeatureConfig._toggle(this.dataset.key, this.checked)">
                        <span class="fc-toggle-knob"></span>
                       </label>`
                  }
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Widgety dashboardu -->
      <div class="card" style="margin-top:12px">
        <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none"
          onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'grid':'none';this.querySelector('.fc-chevron').style.transform=b.style.display==='none'?'rotate(-90deg)':''">
          <i class="ti ti-layout-dashboard" style="color:var(--blue)"></i>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2)">Widgety pulpitu (dashboard)</span>
          <i class="ti ti-chevron-down fc-chevron" style="margin-left:auto;font-size:14px;color:var(--text3);transition:transform .2s"></i>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1px;background:var(--border)">
          ${DASH_WIDGETS_DEF.map(w => {
            const hidden = dashHidden.includes(w.id);
            return `<div style="background:var(--bg2);padding:10px 14px;display:flex;align-items:center;gap:10px">
              <i class="ti ${w.icon}" style="font-size:16px;color:var(--text2);flex-shrink:0;width:18px;text-align:center"></i>
              <span style="flex:1;font-size:13px;color:var(--text)">${esc(w.label)}</span>
              <label class="fc-toggle">
                <input type="checkbox" data-dashid="${esc(w.id)}" ${hidden ? '' : 'checked'}
                  onchange="FeatureConfig._toggleDash(this.dataset.dashid, this.checked)">
                <span class="fc-toggle-knob"></span>
              </label>
            </div>`;
          }).join('')}
        </div>
        <div style="padding:10px 16px;font-size:11px;color:var(--text3);border-top:1px solid var(--border)">
          <i class="ti ti-info-circle"></i>
          Kolejność widgetów zmieniasz przez Pulpit → przycisk <strong>Dostosuj widżety</strong>.
        </div>
      </div>

      <!-- Legenda -->
      <div style="margin-top:16px;padding:12px 16px;background:var(--bg3);border-radius:var(--radius-lg);font-size:12px;color:var(--text2);display:flex;gap:20px;flex-wrap:wrap;border:1px solid var(--border)">
        <span><i class="ti ti-toggle-right" style="color:var(--green)"></i> Włączony — widoczny w menu</span>
        <span><i class="ti ti-toggle-left" style="color:var(--text3)"></i> Wyłączony — ukryty w menu</span>
        <span><i class="ti ti-lock"></i> Zablokowany — wymagany przez system</span>
      </div>

    </div>

    <style>
      .fc-toggle { position:relative;display:inline-flex;width:36px;height:20px;flex-shrink:0;cursor:pointer }
      .fc-toggle input { opacity:0;width:0;height:0;position:absolute }
      .fc-toggle-knob { position:absolute;inset:0;background:var(--border);border-radius:10px;transition:.25s }
      .fc-toggle-knob::before { content:'';position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:3px;left:3px;transition:.25s;box-shadow:0 1px 3px rgba(0,0,0,.2) }
      .fc-toggle input:checked + .fc-toggle-knob { background:var(--green) }
      .fc-toggle input:checked + .fc-toggle-knob::before { transform:translateX(16px) }
      .fc-item { transition:background .1s }
      .fc-item:hover { background:var(--bg3) !important }
      .fc-section > div:first-child:hover { background:var(--bg3) }
    </style>`;

    _updateSectionCounts();
  }

  function _updateSectionCounts() {
    NAV_SECTIONS.forEach(sec => {
      const secKey = sec.label.replace(/[^a-z]/gi, '');
      const el     = document.getElementById(`fc-sec-count-${secKey}`);
      if (!el) return;
      const on  = sec.items.filter(i => _pending[i.key] !== false).length;
      const tot = sec.items.length;
      el.textContent = `${on}/${tot}`;
    });
    // Aktualizuj globalny licznik
    let totalOn = 0, totalAll = 0;
    NAV_SECTIONS.forEach(s => s.items.forEach(i => {
      totalAll++;
      if (_pending[i.key] !== false) totalOn++;
    }));
    const cnt = document.getElementById('fc-count-on');
    if (cnt) cnt.textContent = totalOn;
  }

  function _toggle(key, enabled) {
    if (CORE.has(key)) return;
    if (enabled) {
      delete _pending[key];         // brak wpisu = włączony (wartość domyślna)
    } else {
      _pending[key] = false;
    }
    _updateSectionCounts();
  }

  function _toggleDash(id, visible) {
    if (visible) {
      _pendingDash = _pendingDash.filter(x => x !== id);
    } else {
      if (!_pendingDash.includes(id)) _pendingDash.push(id);
    }
  }

  function _toggleSection(headerEl) {
    const body    = headerEl.nextElementSibling;
    const chevron = headerEl.querySelector('.fc-chevron');
    const secName = headerEl.dataset.sec;
    const collapsed = _loadCollapsed();
    if (body.style.display === 'none') {
      body.style.display = 'grid';
      chevron.style.transform = '';
      collapsed.delete(secName);
    } else {
      body.style.display = 'none';
      chevron.style.transform = 'rotate(-90deg)';
      collapsed.add(secName);
    }
    _saveCollapsed(collapsed);
  }

  function _collapseAll() {
    const collapsed = new Set();
    document.querySelectorAll('.fc-sec-body').forEach(b => { b.style.display = 'none'; });
    document.querySelectorAll('.fc-section [data-sec]').forEach(h => {
      const ch = h.querySelector('.fc-chevron');
      if (ch) ch.style.transform = 'rotate(-90deg)';
      collapsed.add(h.dataset.sec);
    });
    _saveCollapsed(collapsed);
  }

  function _expandAll() {
    document.querySelectorAll('.fc-sec-body').forEach(b => { b.style.display = 'grid'; });
    document.querySelectorAll('.fc-section [data-sec]').forEach(h => {
      const ch = h.querySelector('.fc-chevron');
      if (ch) ch.style.transform = '';
    });
    _saveCollapsed(new Set());
  }

  function _resetAll() {
    if (!confirm('Włączyć wszystkie moduły?')) return;
    document.querySelectorAll('#fc-sections input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
    });
    NAV_SECTIONS.forEach(s => s.items.forEach(i => { delete _pending[i.key]; }));
    _updateSectionCounts();
  }

  function _onSearch(q) {
    const query = q.toLowerCase().trim();
    document.querySelectorAll('.fc-item').forEach(el => {
      const match = !query || (el.dataset.label || '').includes(query) || (el.dataset.key || '').includes(query);
      el.style.display = match ? '' : 'none';
    });
    document.querySelectorAll('.fc-section').forEach(sec => {
      const hasVisible = Array.from(sec.querySelectorAll('.fc-item')).some(i => i.style.display !== 'none');
      sec.style.display = hasVisible || !query ? '' : 'none';
    });
  }

  async function _save() {
    const btn = document.getElementById('fc-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Zapisuję…'; }
    try {
      await saveFlags(_pending, _pendingDash);
      // Synchronizuj też dash config w localStorage (dla openDashCustomize)
      const ls = { order: DASH_WIDGETS_DEF.map(w => w.id), hidden: _pendingDash };
      localStorage.setItem('taxorder-dash-config', JSON.stringify(ls));
      if (typeof _applyDashConfig === 'function') _applyDashConfig();
      window.toast?.('✓ Konfiguracja modułów zapisana');
    } catch (e) {
      window.toast?.('⚠ Błąd zapisu: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i> Zapisz zmiany'; }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.FeatureConfig = {
    loadFlags,
    applyNavFlags,
    renderPage,
    _toggle,
    _toggleDash,
    _toggleSection,
    _collapseAll,
    _expandAll,
    _resetAll,
    _onSearch,
    _save,
  };
})();
