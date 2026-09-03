/**
 * TaxOrder Pro — Globalna wyszukiwarka (topbar)
 * Przeszukuje pojazdy, kierowców, szkody, mandaty + nawigację do modułów
 */
window.TaxOrderSearch = (function () {
  let _timer = null;

  const TYPE_ICONS = {
    vehicle: 'ti-truck',
    driver:  'ti-user',
    damage:  'ti-car-crash',
    fine:    'ti-receipt-tax',
    page:    'ti-layout-sidebar',
  };

  const TYPE_LABELS = { vehicle: 'Pojazd', driver: 'Kierowca', damage: 'Szkoda', fine: 'Mandat', page: 'Moduł' };

  // Katalog modułów do wyszukiwania
  const PAGES = [
    { label:'Pojazdy',               sub:'Kartoteka pojazdów',           icon:'ti-truck',           action:()=>showPage('pojazdy') },
    { label:'Serwis / Zlecenia',     sub:'Zlecenia serwisowe',           icon:'ti-clipboard-list',  action:()=>showPage('zlecenia') },
    { label:'Paliwo',                sub:'Ewidencja tankowania',         icon:'ti-gas-station',     action:()=>showPage('paliwo') },
    { label:'Szkody',                sub:'Rejestr szkód i kolizji',      icon:'ti-alert-triangle',  action:()=>showPage('szkody') },
    { label:'Mandaty',               sub:'Rejestr mandatów',             icon:'ti-ticket',          action:()=>window.FinesModule?.open?.() },
    { label:'Polisy ubezp.',         sub:'OC, AC i inne polisy',         icon:'ti-shield-check',    action:()=>showPage('policies') },
    { label:'Raporty',               sub:'Raporty i analityka',          icon:'ti-chart-line',      action:()=>showPage('raporty') },
    { label:'Kalkulator DT-1',       sub:'Podatek od środków transp.',   icon:'ti-calculator',      action:()=>showPage('kalkulator') },
    { label:'Deklaracja DT-1',       sub:'Wypełnij i wyślij DT-1',      icon:'ti-file-text',       action:()=>showPage('formularze') },
    { label:'Alerty i terminy',      sub:'Centrum alertów i przypomnień',icon:'ti-alert-triangle',  action:()=>showPage('alert-dashboard') },
    { label:'Dokumenty flotowe',     sub:'Dokumenty pojazdu',            icon:'ti-files',           action:()=>showPage('dok-smart') },
    { label:'OCR Dowodów Rej.',      sub:'Skan dokumentu przez AI',      icon:'ti-scan',            action:()=>showPage('ocr') },
    { label:'Import DR (Aztec)',     sub:'Import przez kod Aztec',       icon:'ti-id-badge',        action:()=>showPage('dr-import') },
    { label:'Masowy import dok.',    sub:'Import plików / folderów',     icon:'ti-folder-open',     action:()=>window.BulkImport?.open?.() },
    { label:'Kierowcy',              sub:'Kartoteka kierowców',          icon:'ti-id-badge',        action:()=>window.TaxOrderDrivers?.open?.() },
    { label:'Kalendarz',             sub:'Kalendarz floty',              icon:'ti-calendar',        action:()=>window.FleetCalendar?.open?.() },
    { label:'Karty flotowe',         sub:'Karty paliwowe i flotowe',     icon:'ti-credit-card',     action:()=>showPage('karty') },
    { label:'Harmonogram serwisu',   sub:'Plan przeglądów',             icon:'ti-tool',            action:()=>showPage('service-schedule') },
    { label:'Ewidencja paliwa',      sub:'Historia tankowania',          icon:'ti-droplet',         action:()=>showPage('fuel-db') },
    { label:'Budżet / TCO',          sub:'Koszty eksploatacji',          icon:'ti-wallet',          action:()=>showPage('budzet') },
    { label:'Ubezpieczenia',         sub:'Zarządzanie ubezpieczeniami',  icon:'ti-shield-check',    action:()=>showPage('insurance') },
    { label:'Firmy',                 sub:'Zarządzanie firmami',          icon:'ti-building-community', action:()=>showPage('firmy') },
    { label:'Użytkownicy',           sub:'Konta użytkowników',           icon:'ti-users',           action:()=>showPage('uzytkownicy') },
    { label:'Asystent AI',           sub:'Zapytaj AI o flocie',          icon:'ti-robot',           action:()=>showPage('ai') },
    { label:'Import / Eksport',      sub:'Eksport / import danych',      icon:'ti-arrows-exchange', action:()=>showPage('impexp') },
    { label:'CEPiK',                 sub:'Dane pojazdu z CEPiK',         icon:'ti-database',        action:()=>showPage('cepik') },
    { label:'Inspekcje pojazdów',    sub:'Historia inspekcji',           icon:'ti-clipboard-check', action:()=>showPage('vehicle-inspections') },
    { label:'Delegacje',             sub:'Rozliczenia podróży',          icon:'ti-briefcase',       action:()=>showPage('delegations') },
    { label:'JPK / SAF-T',           sub:'Jednolity Plik Kontrolny',     icon:'ti-file-type-xml',   action:()=>showPage('jpk') },
    { label:'KSeF / e-Faktury',      sub:'Krajowy System e-Faktur',      icon:'ti-file-invoice',    action:()=>showPage('ksef') },
    { label:'Usterki',               sub:'Rejestr usterek',              icon:'ti-alert-triangle',  action:()=>showPage('faults') },
    { label:'Stawki DT-1 2026',      sub:'Stawki podatku dla gmin',      icon:'ti-building-bank',   action:()=>showPage('stawki') },
  ];

  // Skróty w quicknav (pokazywane bez wpisywania)
  const QUICK_PAGES = [
    { label:'Pojazdy',       icon:'ti-truck',           action:()=>showPage('pojazdy') },
    { label:'Paliwo',        icon:'ti-gas-station',     action:()=>showPage('paliwo') },
    { label:'Serwis',        icon:'ti-clipboard-list',  action:()=>showPage('zlecenia') },
    { label:'Polisy',        icon:'ti-shield-check',    action:()=>showPage('policies') },
    { label:'Alerty',        icon:'ti-alert-triangle',  action:()=>showPage('alert-dashboard') },
    { label:'Raporty',       icon:'ti-chart-line',      action:()=>showPage('raporty') },
    { label:'DT-1',          icon:'ti-calculator',      action:()=>showPage('kalkulator') },
    { label:'AI',            icon:'ti-robot',           action:()=>showPage('ai') },
  ];

  function _q(val) { return String(val || '').toLowerCase(); }

  function _collect(query) {
    const results = [];

    // Moduły / strony
    PAGES.forEach(p => {
      if (_q(p.label).includes(query) || _q(p.sub).includes(query)) {
        results.push({ type:'page', label:p.label, sub:p.sub, icon:p.icon, action:p.action });
      }
    });

    // Pojazdy
    (window.vehs || []).forEach(v => {
      if (
        _q(v.nrRej).includes(query) ||
        _q(v.marka).includes(query) ||
        _q(v.model).includes(query) ||
        _q(v.kierowca).includes(query) ||
        _q(v.vin).includes(query)
      ) {
        results.push({
          type: 'vehicle',
          label: `${esc(v.nrRej || '—')  } — ${  esc(`${v.marka||''  } ${  v.model||''}`).trim()}`,
          sub: v.kierowca ? esc(v.kierowca) : (v.wlasciciel ? esc(v.wlasciciel) : ''),
          action: () => { if (window.TaxOrderVehicleDetail) TaxOrderVehicleDetail.open(v.id); _hide(); },
        });
      }
    });

    // Kierowcy
    (window.drivers || []).forEach(d => {
      if (_q(d.name).includes(query) || _q(d.phone).includes(query) || _q(d.license).includes(query)) {
        results.push({
          type: 'driver',
          label: esc(d.name || d.login || '—'),
          sub: d.phone ? esc(d.phone) : '',
          action: () => { window.TaxOrderDrivers?.open?.(); _hide(); },
        });
      }
    });

    // Szkody
    (window.damages || []).forEach(d => {
      if (_q(d.nrRej).includes(query) || _q(d.desc).includes(query) || _q(d.notes).includes(query)) {
        results.push({
          type: 'damage',
          label: esc(d.nrRej || '—'),
          sub: d.desc ? esc(String(d.desc).slice(0, 60)) : '',
          action: () => { if (window.showPage) showPage('szkody'); _hide(); },
        });
      }
    });

    // Mandaty
    (window.fines || []).forEach(f => {
      if (_q(f.nrRej).includes(query) || _q(f.place).includes(query) || _q(f.notes).includes(query)) {
        results.push({
          type: 'fine',
          label: esc(f.nrRej || '—') + (f.amount ? ` · ${  esc(String(f.amount))  } zł` : ''),
          sub: f.place ? esc(f.place) : '',
          action: () => { if (window.showPage) showPage('mandaty'); _hide(); },
        });
      }
    });

    return results.slice(0, 14);
  }

  function _renderResults(results, query) {
    const drop = document.getElementById('gs-dropdown');
    if (!drop) return;

    if (!results.length) {
      drop.innerHTML = `<div style="padding:14px 16px;color:var(--text3);font-size:13px;text-align:center">
        <i class="ti ti-search-off" style="font-size:22px;display:block;margin-bottom:6px"></i>
        Brak wyników dla „${esc(query)}"
      </div>`;
      drop.style.display = 'block';
      return;
    }

    window._gsResults = results;
    drop.innerHTML = results.map((r, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .12s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''"
        onmousedown="window._gsResults[${i}].action()">
        <div style="width:28px;height:28px;border-radius:6px;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${r.icon || TYPE_ICONS[r.type] || 'ti-search'}" style="font-size:14px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
          ${r.sub ? `<div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.sub}</div>` : ''}
        </div>
        <span style="font-size:10px;color:var(--text3);white-space:nowrap">${TYPE_LABELS[r.type] || ''}</span>
      </div>`).join('');
    drop.style.display = 'block';
  }

  function _showQuickNav() {
    const drop = document.getElementById('gs-dropdown');
    if (!drop) return;
    drop.innerHTML = `
      <div style="padding:8px 14px 4px;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Szybka nawigacja</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:4px 10px 10px">
        ${QUICK_PAGES.map((p, i) => `
          <button data-qnav="${i}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;font-size:10px;font-weight:600;color:var(--text2);font-family:var(--font);transition:all .12s" onmouseover="this.style.background='var(--bg3)';this.style.color='var(--blue)'" onmouseout="this.style.background='var(--bg2)';this.style.color='var(--text2)'" onmousedown="window._gsQuick[${i}].action();window.TaxOrderSearch.hide()">
            <i class="ti ${p.icon}" style="font-size:18px"></i>${p.label}
          </button>`).join('')}
      </div>
      <div style="padding:4px 14px 8px;font-size:10px;color:var(--text3);border-top:1px solid var(--border)"><i class="ti ti-keyboard" style="margin-right:4px"></i>Wpisz aby szukać · <kbd style="background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-size:10px">?</kbd> skróty klawiszowe</div>`;
    window._gsQuick = QUICK_PAGES;
    drop.style.display = 'block';
  }

  function search(rawVal) {
    clearTimeout(_timer);
    const query = rawVal.trim().toLowerCase();
    const drop = document.getElementById('gs-dropdown');
    if (!query || query.length < 2) {
      if (!query) _showQuickNav();
      else _hide();
      return;
    }
    _timer = setTimeout(() => {
      const results = _collect(query);
      _renderResults(results, rawVal.trim());
    }, 150);
  }

  function show() {
    const inp = document.getElementById('gs-input');
    const val = inp ? inp.value.trim() : '';
    if (val.length >= 2) {
      search(inp.value);
    } else {
      _showQuickNav();
    }
  }

  function _hide() {
    const drop = document.getElementById('gs-dropdown');
    if (drop) drop.style.display = 'none';
    const inp = document.getElementById('gs-input');
    if (inp) inp.value = '';
  }

  document.addEventListener('mousedown', e => {
    if (!e.target.closest('#gs-wrap')) _hide();
  });

  return { search, show, hide: _hide };
})();
