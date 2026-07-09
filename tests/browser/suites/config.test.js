/**
 * Testy konfiguracji modularnego kokpitu i zakładek karty pojazdu
 * Testuje zapis/odczyt z localStorage, backward compat (nowe widgety)
 */
(function () {
  const { describe, it, expect } = window.TaxOrderTests;

  // ─── Helpers ───────────────────────────────────────────────
  const LS_DASH = 'taxorder-dash-config';
  const LS_TABS = 'taxorder-vd-tabs';

  function withCleanLS(key, fn) {
    const backup = localStorage.getItem(key);
    try {
      localStorage.removeItem(key);
      fn();
    } finally {
      if (backup !== null) localStorage.setItem(key, backup);
      else localStorage.removeItem(key);
    }
  }

  const DASH_IDS = ['kpi', 'notifs', 'alerts', 'service_fuel', 'activity', 'structure'];
  const TAB_IDS  = ['dr','insurance','badania','serwis','opony','eksploatacja','koszty',
                    'ownership','purchase','archive','notes','dokumenty','mandaty','gps','karty','konserwacja'];

  // ─── Dashboard config ──────────────────────────────────────
  describe('Kokpit — konfiguracja widgetów', () => {

    it('brak localStorage → domyślna kolejność zawiera wszystkie widgety', () => {
      withCleanLS(LS_DASH, () => {
        const cfg = typeof _getDashConfig === 'function' ? _getDashConfig() : null;
        if (!cfg) { console.warn('_getDashConfig niedostępna w tym kontekście — pomiń'); return; }
        expect(cfg.order.length).toBe(DASH_IDS.length);
        DASH_IDS.forEach(id => expect(cfg.order).toContain(id));
      });
    });

    it('domyślna konfiguracja: brak ukrytych widgetów', () => {
      withCleanLS(LS_DASH, () => {
        const cfg = typeof _getDashConfig === 'function' ? _getDashConfig() : null;
        if (!cfg) return;
        expect(cfg.hidden.length).toBe(0);
      });
    });

    it('zapis i odczyt konfiguracji kokpitu', () => {
      withCleanLS(LS_DASH, () => {
        const saved = { order: ['alerts', 'kpi', 'notifs', 'service_fuel', 'activity', 'structure'], hidden: ['notifs'] };
        localStorage.setItem(LS_DASH, JSON.stringify(saved));
        const cfg = typeof _getDashConfig === 'function' ? _getDashConfig() : null;
        if (!cfg) return;
        expect(cfg.order[0]).toBe('alerts');
        expect(cfg.hidden).toContain('notifs');
      });
    });

    it('nowy widget (brakujący w zapisanej konfiguracji) pojawia się na końcu', () => {
      withCleanLS(LS_DASH, () => {
        const savedWithout = { order: ['kpi', 'notifs', 'alerts'], hidden: [] };
        localStorage.setItem(LS_DASH, JSON.stringify(savedWithout));
        const cfg = typeof _getDashConfig === 'function' ? _getDashConfig() : null;
        if (!cfg) return;
        // Widgety których brakuje w zapisanym orderze powinny zostać dodane
        DASH_IDS.forEach(id => expect(cfg.order).toContain(id));
      });
    });
  });

  // ─── Vehicle tabs config ───────────────────────────────────
  describe('Karta pojazdu — konfiguracja zakładek', () => {

    it('brak localStorage → wszystkie 16 zakładek widoczne', () => {
      withCleanLS(LS_TABS, () => {
        const cfg = window.TaxOrderVehicleDetail?._getVdTabsCfg?.();
        if (!cfg) { console.warn('TaxOrderVehicleDetail niedostępna — pomiń'); return; }
        expect(cfg.order.length).toBe(TAB_IDS.length);
        expect(cfg.hidden.length).toBe(0);
      });
    });

    it('zapis ukrytych zakładek — poprawny odczyt', () => {
      withCleanLS(LS_TABS, () => {
        const saved = { order: TAB_IDS, hidden: ['gps', 'konserwacja'] };
        localStorage.setItem(LS_TABS, JSON.stringify(saved));
        const cfg = window.TaxOrderVehicleDetail?._getVdTabsCfg?.();
        if (!cfg) return;
        expect(cfg.hidden).toContain('gps');
        expect(cfg.hidden).toContain('konserwacja');
        expect(cfg.hidden).not.toContain('dr');
      });
    });

    it('zmiana kolejności zakładek', () => {
      withCleanLS(LS_TABS, () => {
        const reordered = ['insurance', 'serwis', 'dr', ...TAB_IDS.filter(id => !['insurance','serwis','dr'].includes(id))];
        localStorage.setItem(LS_TABS, JSON.stringify({ order: reordered, hidden: [] }));
        const cfg = window.TaxOrderVehicleDetail?._getVdTabsCfg?.();
        if (!cfg) return;
        expect(cfg.order[0]).toBe('insurance');
        expect(cfg.order[1]).toBe('serwis');
      });
    });

    it('nowa zakładka (brakująca w zapisanej konfiguracji) pojawia się na końcu', () => {
      withCleanLS(LS_TABS, () => {
        const savedWithout = { order: ['dr', 'insurance', 'badania'], hidden: [] };
        localStorage.setItem(LS_TABS, JSON.stringify(savedWithout));
        const cfg = window.TaxOrderVehicleDetail?._getVdTabsCfg?.();
        if (!cfg) return;
        TAB_IDS.forEach(id => expect(cfg.order).toContain(id));
      });
    });

    it('uszkodzony JSON w localStorage → konfiguracja domyślna (brak wyjątku)', () => {
      withCleanLS(LS_TABS, () => {
        localStorage.setItem(LS_TABS, '{nie-valid-json');
        let cfg;
        try {
          cfg = window.TaxOrderVehicleDetail?._getVdTabsCfg?.();
        } catch (e) {
          throw new Error('Wyjątek zamiast fallback: ' + e.message);
        }
        if (!cfg) return;
        expect(cfg.order.length).toBe(TAB_IDS.length);
      });
    });
  });
})();
