/**
 * TaxOrder Pro — Cloudflare Cloud Module
 * Supabase wycofany (26.07.2026). Ten moduł zastąpił: supabase-client.js,
 * auth-supabase.js, fleet-cloud.js, migration-supabase.js.
 *
 * Eksportuje na window:
 *   TaxOrderAuth       — login, logout, resetPassword, getSession
 *   TaxOrderFleetCloud — loadVehicles, saveVehicle, saveVehicles
 *   TaxOrderStateSync  — save(companyId), load(companyId)
 *   TaxOrderPrefs      — save(prefs), load()
 *   TaxOrderDocs       — upload, list, delete, fileUrl
 */
(function () {
  // URL workera — ustawiany przez config/cf-config.js zanim ten plik się załaduje
  const API = (window.CF_API_URL || '').replace(/\/$/, '');

  if (!API) {
    console.warn('[CF Cloud] CF_API_URL nie ustawiony — moduł pracuje w trybie offline');
  }

  // Token sesji
  function _getToken() { return localStorage.getItem('cf_token'); }
  function _setToken(t) {
    if (t) localStorage.setItem('cf_token', t);
    else localStorage.removeItem('cf_token');
  }

  // ─── Bazowy klient API ─────────────────────────────────────────────────────
  async function cfApi(path, method = 'GET', body = null, isFormData = false, timeoutMs = 15000) {
    if (!API) throw new Error('CF_API_URL nie skonfigurowany');
    const headers = {};
    const token = _getToken();
    if (token) headers['Authorization'] = `Bearer ${  token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let resp;
    try {
      resp = await fetch(API + path, {
        method,
        headers,
        body: isFormData ? body : (body ? JSON.stringify(body) : null),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('Timeout — serwer nie odpowiada. Spróbuj ponownie.');
      throw e;
    }
    clearTimeout(timer);

    if (resp.status === 204) return {};
    // Cloudflare challenge/WAF zwraca HTML zamiast JSON — wykryj i zwróć czytelny błąd
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json') && !resp.ok) {
      throw new Error(`Serwer niedostępny (HTTP ${  resp.status  }). Spróbuj ponownie za chwilę.`);
    }
    const data = await resp.json().catch(() => ({ error: resp.statusText }));
    if (!resp.ok) throw new Error(data.error || `HTTP ${  resp.status}`);
    return data;
  }

  // ─── TaxOrderAuth ─────────────────────────────────────────────────────────
  window.TaxOrderAuth = {
    async login(email, password) {
      try {
        const data = await cfApi('/api/auth/login', 'POST', { email, password });
        _setToken(data.token);
        // Dodaj user_metadata kompatybilne z formatem Supabase używanym przez app.js
        const user = { ...data.user, user_metadata: { name: data.user.name, role: data.user.role } };
        console.log('[CF Auth] Zalogowano:', user.email, '| rola:', user.role);
        return { ok: true, user };
      } catch (e) {
        console.error('[CF Auth] Błąd logowania:', e.message);
        return { ok: false, error: { message: e.message } };
      }
    },

    async logout() {
      try { await cfApi('/api/auth/logout', 'POST'); } catch (_) {}
      _setToken(null);
      console.log('[CF Auth] Wylogowano');
    },

    async resetPassword(email) {
      // Cloudflare Worker nie obsługuje jeszcze email-reset — wymaga Workers Email lub SendGrid
      return { ok: false, error: { message: 'Reset hasła nie jest dostępny. Skontaktuj się z administratorem.' } };
    },

    async updatePassword(newPassword) {
      try {
        await cfApi('/api/users/me/password', 'PUT', { password: newPassword });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: { message: e.message } };
      }
    },

    async getSession() {
      if (!_getToken()) return { session: null };
      try {
        const user = await cfApi('/api/auth/me');
        return { session: { user: { ...user, user_metadata: { name: user.name } } } };
      } catch (_) {
        _setToken(null);
        return { session: null };
      }
    },

    // Stub — nieużywany w trybie CF
    async getMyCompanies() { return []; },
  };

  // ─── TaxOrderFleetCloud ───────────────────────────────────────────────────
  window.TaxOrderFleetCloud = {
    // Mapuje wiersz D1 → obiekt pojazdu używany przez app.js
    mapDbVehicle(row, index) {
      let data = {};
      try { data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}); } catch (_) {}
      return {
        ...data,
        id:               index,
        dbId:             row.id,
        nrRej:            row.nr_rej           || data.nrRej        || '',
        marka:            data.marka           || '',
        model:            data.model           || '',
        rok:              data.rok             ?? null,
        typ:              data.typ             || '',
        dmc:              data.dmc             ?? data.dmcMax        ?? 0,
        osie:             row.axles_count       ?? data.osie         ?? 2,
        zawieszenie:      row.suspension_type   || data.zawieszenie  || 'pneumatyczne',
        dmcZespolu:       row.dmc_zespolu       ?? data.dmcZespolu   ?? 0,
        miesiacePodatku:  row.miesiace_podatku  ?? data.miesiacePodatku ?? 12,
        dt1_category:     row.dt1_category      || data.cat          || null,
        dt1_tax_amount:   row.dt1_tax_amount     != null ? Number(row.dt1_tax_amount) : (data.amount ?? null),
        branch_id:        row.branch_id          ?? null,
      };
    },

    // Buduje payload do Workers z obiektu pojazdu
    mapVehicleToCf(v) {
      const tax = typeof calcTax === 'function' ? calcTax(v) : {};
      return {
        company_id:       window.currentCompanyId || 'mtoilet',
        nr_rej:           v.nrRej,
        axles_count:      parseInt(v.osie)           || 2,
        suspension_type:  v.zawieszenie              || 'pneumatyczne',
        dmc_zespolu:      parseInt(v.dmcZespolu)      || 0,
        miesiace_podatku: parseInt(v.miesiacePodatku ?? 12) || 1,
        dt1_category:     tax.cat   || v.cat           || null,
        dt1_tax_amount:   tax.amount != null ? tax.amount : (v.amount ?? null),
        branch_id:        v.branch_id ?? null,
        data:             JSON.stringify(v),
      };
    },

    _loadLock: false,

    // Pobiera pojazdy aktywnej firmy z D1
    async loadVehicles(companySlug) {
      if (this._loadLock) {
        console.warn('[CF Cloud] loadVehicles: poprzednie ładowanie w toku — pominięto');
        return { ok: false, skipped: true };
      }
      this._loadLock = true;
      const slug = companySlug || window.currentCompanyId || 'mtoilet';
      try {
        const rows   = await cfApi(`/api/vehicles?company=${  encodeURIComponent(slug)}`);
        const mapped = rows.map((r, i) => this.mapDbVehicle(r, i));

        if (mapped.length && window.vehs) {
          window.vehs.splice(0, window.vehs.length, ...mapped);
        }

        // Załaduj też stan firmy (taxpayer, selected, rok)
        await window.TaxOrderStateSync.applyFromCloud(slug);

        console.log('[CF Cloud] Pojazdy:', mapped.length, '| firma:', slug);
        if (!mapped.length) {
          console.warn('[CF Cloud] 0 pojazdów w D1 — zachowuję lokalną flotę');
          return { ok: false, count: 0, vehicles: [] };
        }
        return { ok: true, count: mapped.length, vehicles: mapped };
      } catch (e) {
        console.warn('[CF Cloud] loadVehicles:', e.message);
        return { ok: false, error: e };
      } finally {
        this._loadLock = false;
      }
    },

    // Zapisuje jeden pojazd
    async saveVehicle(v) {
      try {
        await cfApi(`/api/vehicles/${  encodeURIComponent(v.nrRej)}`, 'PUT', this.mapVehicleToCf(v));
        return { ok: true };
      } catch (e) {
        console.warn('[CF Cloud] saveVehicle', v.nrRej, ':', e.message);
        return { ok: false };
      }
    },

    // Zapisuje wiele pojazdów (bulk upsert)
    async saveVehicles(vehicles) {
      const toSave = (vehicles || []).filter(v => v.nrRej);
      if (!toSave.length) return { ok: true, saved: 0, failed: 0 };
      try {
        await cfApi('/api/vehicles/bulk', 'POST', {
          company_id: window.currentCompanyId || 'mtoilet',
          vehicles:   toSave.map(v => this.mapVehicleToCf(v)),
        });
        if (typeof toast === 'function') toast(`✓ Zsynchronizowano ${toSave.length} pojazdów z Cloudflare`);
        return { ok: true, saved: toSave.length, failed: 0 };
      } catch (e) {
        console.warn('[CF Cloud] saveVehicles:', e.message);
        return { ok: false, saved: 0, failed: toSave.length };
      }
    },
  };

  // ─── TaxOrderStateSync ─────────────────────────────────────────────────────
  window.TaxOrderStateSync = {
    // Zapisuje bieżący stan firmy do D1
    async save(companyId) {
      try {
        const taxYear  = document.getElementById('taxYear')?.value || '2026';
        const selected = window.selected ? [...window.selected] : [];
        const taxpayer = {};
        ['nip','regon','nazwa','ulica','dom','lokal','kod','miasto','woj','organ','imie','nazwisko','cel'].forEach(k => {
          const el = document.getElementById(`tp-${  k}`);
          if (el) taxpayer[k] = el.value;
        });
        await cfApi(`/api/state/${  encodeURIComponent(companyId)}`, 'PUT', {
          tax_year: taxYear, selected, taxpayer,
        });
      } catch (e) { console.warn('[CF State] save:', e.message); }
    },

    // Pobiera stan firmy z D1 i aplikuje do UI (bez renderowania)
    async applyFromCloud(companyId) {
      try {
        const state = await cfApi(`/api/state/${  encodeURIComponent(companyId)}`);
        if (!state) return;

        // Rok podatkowy
        const yrEl = document.getElementById('taxYear');
        if (yrEl && state.tax_year) yrEl.value = state.tax_year;

        // Zaznaczenia
        if (window.selected && Array.isArray(state.selected)) {
          window.selected.clear();
          state.selected.forEach(id => window.selected.add(id));
        }

        // Dane podatnika
        const tp = state.taxpayer || {};
        ['nip','regon','nazwa','ulica','dom','lokal','kod','miasto','woj','organ','imie','nazwisko','cel'].forEach(k => {
          const el = document.getElementById(`tp-${  k}`);
          if (el && tp[k] !== undefined) el.value = tp[k];
        });
      } catch (e) { console.warn('[CF State] applyFromCloud:', e.message); }
    },
  };

  // ─── TaxOrderPrefs ─────────────────────────────────────────────────────────
  window.TaxOrderPrefs = {
    _pending: null,

    // Debounced save — żeby nie walić requestem przy każdym pixelu resize
    async save(prefs) {
      clearTimeout(this._pending);
      this._pending = setTimeout(async () => {
        try { await cfApi('/api/prefs', 'PUT', prefs); } catch (e) {
          console.warn('[CF Prefs] save:', e.message);
        }
      }, 1500);
    },

    async load() {
      try { return await cfApi('/api/prefs'); } catch (e) {
        console.warn('[CF Prefs] load:', e.message);
        return null;
      }
    },
  };

  // ─── TaxOrderDocs ─────────────────────────────────────────────────────────
  window.TaxOrderDocs = {
    async upload(file, nrRej, company) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('nrRej', nrRej);
      fd.append('company', company || window.currentCompanyId || 'mtoilet');
      return cfApi('/api/docs/upload', 'POST', fd, true);
    },

    async list(nrRej, company) {
      return cfApi(`/api/docs?nrRej=${  encodeURIComponent(nrRej)
         }&company=${  encodeURIComponent(company || window.currentCompanyId || 'mtoilet')}`);
    },

    async delete(docId) {
      return cfApi(`/api/docs/${  docId}`, 'DELETE');
    },

    fileUrl(r2Key) {
      return `${API  }/api/docs/file/${  r2Key}`;
    },
  };

  console.log('[CF Cloud] Moduł załadowany | API:', API || '(brak — tryb offline)');
})();
