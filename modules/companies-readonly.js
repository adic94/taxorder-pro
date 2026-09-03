/**
 * TaxOrder Pro — Lista firm (najemców)
 *
 * Supabase wycofany (26.07.2026). Poprzednia wersja (companies-supabase.js)
 * wołała window.supabaseClient — nigdy niezainicjalizowany, panel firm nie działał.
 * Źródłem prawdy jest tabela `companies` w D1 (schema_v44) przez /api/companies.
 */
(function () {
  'use strict';

  const API  = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const tok  = () => localStorage.getItem('cf_token') || '';
  const hdrs = () => ({ Authorization: `Bearer ${  tok()}`, 'Content-Type': 'application/json' });

  async function loadCompanies() {
    if (!tok()) {
      console.warn('[Companies] Brak tokenu — pomijam pobranie firm');
      return [];
    }
    try {
      const r = await fetch(`${API()  }/api/companies`, { headers: hdrs() });
      if (!r.ok) {
        console.error(`[Companies] HTTP ${  r.status}`);
        return window.TaxOrderCompaniesList || [];
      }
      const d = await r.json().catch(() => ({}));
      window.TaxOrderCompaniesList = Array.isArray(d.companies) ? d.companies : [];
      return window.TaxOrderCompaniesList;
    } catch (e) {
      console.error('[Companies] Blad sieci:', e);
      return window.TaxOrderCompaniesList || [];
    }
  }

  function renderCompaniesPanel() {
    const el = document.getElementById('companies-grid');
    if (!el) return;

    const list = window.TaxOrderCompaniesList || [];
    if (!list.length) {
      el.innerHTML = '<div style="color:var(--text3);padding:16px">Brak firm do wyświetlenia.</div>';
      return;
    }

    el.innerHTML = list.map(c => {
      const color = /^#[0-9a-fA-F]{3,6}$/.test(c.color || '') ? c.color : '#185FA5';
      const adres = [
        [c.ulica, c.dom].filter(Boolean).join(' '),
        [c.kod, c.miasto].filter(Boolean).join(' ')
      ].filter(Boolean).join(', ');
      return `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:12px;height:12px;border-radius:50%;background:${color}"></div>
          <strong>${esc(c.short_name || c.id)}</strong>
        </div>
        <div style="font-size:12px;color:var(--text2);min-height:34px">${esc(c.name || '')}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.6">
          NIP: ${esc(c.nip || '—')}<br>
          REGON: ${esc(c.regon || '—')}<br>
          ${esc(adres || '—')}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn btn-red" type="button"
                  data-id="${esc(c.id)}" data-name="${esc(c.short_name || c.id)}"
                  onclick="window.TaxOrderCompaniesReadOnly.deactivateCompany(this.dataset.id, this.dataset.name)">
            Dezaktywuj
          </button>
        </div>
      </div>`;
    }).join('');
  }

  async function loadAndRenderCompanies() {
    await loadCompanies();
    renderCompaniesPanel();
  }

  /**
   * Dezaktywacja zamiast usunięcia — pojazdy, dokumenty i deklaracje DT-1
   * firmy zostają w bazie (wymogi archiwizacji i kontroli podatkowej).
   */
  async function deactivateCompany(id, name) {
    if (!id) return;
    if (!confirm(`Dezaktywować firmę: ${  name || id  }?\n\nDane firmy (pojazdy, dokumenty, deklaracje) zostaną zachowane, ale firma zniknie z listy wyboru.`)) return;

    try {
      const r = await fetch(`${API()  }/api/companies/${  encodeURIComponent(id)}`, {
        method: 'DELETE', headers: hdrs()
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(`Blad: ${  d.error || (`HTTP ${  r.status}`)}`); return; }
      if (typeof toast === 'function') toast('✓ Firma dezaktywowana');
      await loadAndRenderCompanies();
    } catch (e) {
      alert(`Blad sieci: ${  e.message}`);
    }
  }

  window.TaxOrderCompaniesReadOnly = {
    loadCompanies,
    renderCompaniesPanel,
    loadAndRenderCompanies,
    deactivateCompany,
    deleteCompany: deactivateCompany   // alias zgodnosci ze starym HTML
  };
})();
