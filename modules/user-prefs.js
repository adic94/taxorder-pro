/**
 * UserPrefs — cross-device synchronizacja preferencji UI przez D1.
 *
 * API identyczne z localStorage (get/set/remove), ale przy każdym zapisie
 * asynchronicznie aktualizuje D1 przez /api/prefs/kv.
 *
 * Przy logowaniu wywołaj: await window.UserPrefs.syncFromCloud()
 * Żeby wypchnąć wszystkie lokalne prefs do D1:  window.UserPrefs.pushToCloud()
 *
 * Kill switch (bez deployu, z konsoli):
 *   localStorage.setItem('taxorder_prefs_kv_source','local'); location.reload();
 * Powrót do D1:
 *   localStorage.removeItem('taxorder_prefs_kv_source'); location.reload();
 */
(function () {
  'use strict';

  // ── Podział kluczy: globalny (company_id='') vs per-firma ────────────────────
  const GLOBAL_KEYS = new Set([
    'theme',
    'taxDarkMode',
    'sidebarMode',
    'sidebarCollapse',
    'taxSidebarIconOnly',
    'taxSidebarSection',
    'slim_table',
    'onboarding_done',
    'ks-hint-shown',
  ]);

  const COMPANY_KEYS = new Set([
    'taxColOrder',
    'taxColPresets',
    'taxColVis',
    'taxColFilters',
    'taxorder-saved-filters',
    'taxorder-dash-config',
    'fleet_widgets',
    'fleetViewMode',
    'dwf_view',
    'fuelImportSchemas',
  ]);

  const ALL_MANAGED = new Set([...GLOBAL_KEYS, ...COMPANY_KEYS]);

  // ── Wewnętrzne pomocniki ─────────────────────────────────────────────────────

  function _isDisabled() {
    return localStorage.getItem('taxorder_prefs_kv_source') === 'local';
  }

  function _workerUrl() {
    return (localStorage.getItem('cf_worker_url') || '').replace(/\/$/, '')
      || 'https://taxorder-pro-api.adamus1000.workers.dev';
  }

  function _token() {
    return localStorage.getItem('cf_token') || '';
  }

  function _isLoggedIn() {
    return !!document.getElementById('page-dash');
  }

  function _company() {
    return localStorage.getItem('cf_company')
      || localStorage.getItem('currentCompany')
      || localStorage.getItem('dt1_current_company')
      || '';
  }

  function _companyFor(key) {
    return GLOBAL_KEYS.has(key) ? '' : _company();
  }

  function _authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${  _token()}` };
  }

  async function _put(key, value, companyId) {
    if (_isDisabled()) return;
    const tok = _token();
    if (!tok) {
      if (_isLoggedIn()) console.warn('[UserPrefs] PUT pominięty — brak cf_token mimo aktywnej sesji:', key);
      return;
    }
    try {
      const r = await fetch(`${_workerUrl()  }/api/prefs/kv`, {
        method: 'PUT',
        headers: _authHeaders(),
        body: JSON.stringify({ key, value, company_id: companyId }),
      });
      if (!r.ok) console.warn('[UserPrefs] Synchronizacja nieudana:', r.status, key);
    } catch { /* silent — localStorage już zapisany */ }
  }

  async function _del(key, companyId) {
    if (_isDisabled()) return;
    const tok = _token();
    if (!tok) {
      if (_isLoggedIn()) console.warn('[UserPrefs] DELETE pominięty — brak cf_token mimo aktywnej sesji:', key);
      return;
    }
    try {
      const r = await fetch(
        `${_workerUrl()  }/api/prefs/kv?${  new URLSearchParams({ key, company: companyId })}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${  tok}` } }
      );
      if (!r.ok) console.warn('[UserPrefs] Synchronizacja nieudana:', r.status, key);
    } catch { /* silent */ }
  }

  // ── Publiczne API ────────────────────────────────────────────────────────────

  const UserPrefs = {

    /**
     * Odczytaj preferencję. Zwraca sparsowaną wartość JSON lub domyślną.
     * Identycznie jak localStorage.getItem, ale z automatycznym JSON.parse.
     */
    get(key, defaultVal = null) {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultVal;
      try { return JSON.parse(raw); } catch { return raw; }
    },

    /**
     * Zapisz preferencję.
     * localStorage natychmiast → D1 asynchronicznie (fire-and-forget).
     * Wartości złożone (object/array) są serializowane do JSON.
     */
    set(key, value) {
      if (key === 'theme' && value !== 'dark' && value !== 'light') {
        console.warn('[UserPrefs] theme: wartość musi być "dark" lub "light", pominięto:', value, new Error().stack);
        return;
      }
      const serialized = (value !== null && typeof value === 'object') || Array.isArray(value)
        ? JSON.stringify(value)
        : String(value);
      localStorage.setItem(key, serialized);
      if (ALL_MANAGED.has(key)) {
        _put(key, serialized, _companyFor(key));
      }
    },

    /**
     * Usuń preferencję z localStorage i D1.
     */
    remove(key) {
      localStorage.removeItem(key);
      if (ALL_MANAGED.has(key)) {
        _del(key, _companyFor(key));
      }
    },

    /**
     * Zwraca obiekt ze wszystkimi zarządzanymi preferencjami obecnymi
     * w localStorage.
     */
    getAll() {
      const out = {};
      for (const key of ALL_MANAGED) {
        const v = localStorage.getItem(key);
        if (v !== null) out[key] = v;
      }
      return out;
    },

    /**
     * Pobierz preferencje z D1 i zmerguj z localStorage.
     * D1 ma pierwszeństwo: nowe urządzenie dostanie ustawienia z chmury.
     * Wywołaj raz po zalogowaniu, gdy token i company są dostępne.
     */
    async syncFromCloud() {
      if (_isDisabled() || !_token()) return;
      try {
        const resp = await fetch(`${_workerUrl()  }/api/prefs/kv`, {
          headers: { 'Authorization': `Bearer ${  _token()}` },
        });
        if (!resp.ok) return;
        const { prefs } = await resp.json();
        const company = _company();
        for (const { company_id, key, value } of (prefs || [])) {
          if (!ALL_MANAGED.has(key)) continue;
          // Zaakceptuj globalną lub matching firmę
          if (company_id !== '' && company_id !== company) continue;
          // Przy konflikcie global vs firma — firma wygrywa (nadpisuje global)
          // Nie nadpisujemy jeśli lokalny klucz jest nowszy — ale bez timestamp
          // po stronie localStorage wymagamy prostego rule: cloud wins
          localStorage.setItem(key, value);
        }
      } catch { /* silent */ }
    },

    /**
     * Wypchnij wszystkie zarządzane preferencje z localStorage do D1.
     * Używaj po pierwszym logowaniu na nowym urządzeniu, żeby przesłać
     * lokalny stan do chmury.
     */
    async pushToCloud() {
      if (_isDisabled() || !_token()) return;
      const company = _company();
      const globalKv = {};
      const companyKv = {};

      for (const key of GLOBAL_KEYS) {
        const v = localStorage.getItem(key);
        if (v !== null) globalKv[key] = v;
      }
      for (const key of COMPANY_KEYS) {
        const v = localStorage.getItem(key);
        if (v !== null) companyKv[key] = v;
      }

      const base = { method: 'PUT', headers: _authHeaders() };
      try {
        if (Object.keys(globalKv).length) {
          await fetch(`${_workerUrl()  }/api/prefs/kv`, {
            ...base,
            body: JSON.stringify({ kv: globalKv, company_id: '' }),
          });
        }
        if (Object.keys(companyKv).length && company) {
          await fetch(`${_workerUrl()  }/api/prefs/kv`, {
            ...base,
            body: JSON.stringify({ kv: companyKv, company_id: company }),
          });
        }
      } catch { /* silent */ }
    },

    /**
     * Zwraca company_id, które będzie użyte dla danego klucza.
     * Przydatne przy debugowaniu i testach.
     */
    companyFor(key) { return _companyFor(key); },

    /** Lista zarządzanych kluczy globalnych. */
    GLOBAL_KEYS,

    /** Lista zarządzanych kluczy per-firma. */
    COMPANY_KEYS,
  };

  window.UserPrefs = UserPrefs;
})();
