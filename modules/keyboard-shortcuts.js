/**
 * TaxOrder Pro — Skróty klawiszowe
 * G+D/P/R/K/A → nawigacja, / → szukaj, N → nowy wpis, ? → cheat-sheet
 */
window.TaxOrderShortcuts = (function () {
  let _gPending = false, _gTimer = null;

  const SHORTCUTS = [
    { keys: 'G + D', desc: 'Przejdź do Dashboard' },
    { keys: 'G + P', desc: 'Przejdź do Pojazdów' },
    { keys: 'G + R', desc: 'Przejdź do Raportów' },
    { keys: 'G + K', desc: 'Przejdź do Kalkulatora DT-1' },
    { keys: 'G + A', desc: 'Przejdź do Asystenta AI' },
    { keys: 'G + B', desc: 'Przejdź do Budżetu / TCO' },
    { keys: 'G + F', desc: 'Przejdź do Dokumentów flotowych' },
    { keys: 'G + U', desc: 'Przejdź do Polis ubezpieczeniowych' },
    { keys: 'G + H', desc: 'Przejdź do Harmonogramu serwisowego' },
    { keys: 'G + J', desc: 'Przejdź do Rozliczeń km (delegacje)' },
    { keys: '/', desc: 'Szukaj (globalna wyszukiwarka)' },
    { keys: 'N', desc: 'Nowy wpis (kontekst bieżącej strony)' },
    { keys: '?', desc: 'Pokaż tę ściągę skrótów' },
    { keys: 'Esc', desc: 'Zamknij modal / panel / dropdown' },
  ];

  function _isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
  }

  function _go(page) {
    if (typeof showPage === 'function') showPage(page);
  }

  function _newEntry() {
    const pageEl = document.querySelector('.page.active');
    const pageId = pageEl?.id?.replace('page-', '') || '';
    switch (pageId) {
      case 'paliwo':           window.FuelImport?.open?.(); break;
      case 'zlecenia':         window.TaxOrderServiceOrders?.openNew?.(); break;
      case 'szkody':           window.TaxOrderDamages?.openNew?.(); break;
      case 'kierowcy':         window.TaxOrderDrivers?.openNew?.(); break;
      case 'mandaty':          window.FinesModule?.open?.(); break;
      case 'dok-smart':        window.DocumentsModule?.openGlobalUpload?.(); break;
      case 'policies':         window.PoliciesModule?._openEdit?.(null, ''); break;
      case 'service-schedule': window.ServiceScheduleModule?._openEdit?.(null, ''); break;
      case 'mileage-claims':   window.MileageClaimsModule?._openEdit?.(null); break;
      default:
        toast('ℹ Naciśnij N na stronie z listą aby dodać nowy wpis');
    }
  }

  function showCheatSheet() {
    document.getElementById('ks-cheatsheet')?.remove();
    const modal = document.createElement('div');
    modal.id = 'ks-cheatsheet';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px 32px;width:480px;max-width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
          <i class="ti ti-keyboard" style="font-size:24px;color:var(--blue)"></i>
          <div style="font-size:17px;font-weight:700;flex:1">Skróty klawiszowe</div>
          <button onclick="document.getElementById('ks-cheatsheet').remove()"
            style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:20px;padding:4px;line-height:1;border-radius:var(--radius-sm)">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px">
          ${SHORTCUTS.map(s => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 4px;border-bottom:1px solid var(--border)">
              <kbd style="background:var(--bg2);border:1px solid var(--border);border-bottom-width:2px;border-radius:6px;padding:3px 10px;font-size:12px;font-family:var(--mono);font-weight:700;white-space:nowrap;flex-shrink:0;min-width:70px;text-align:center">${s.keys}</kbd>
              <span style="font-size:13px;color:var(--text2)">${s.desc}</span>
            </div>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">
          <i class="ti ti-info-circle" style="margin-right:4px"></i>
          Skróty nie działają gdy kursor jest w polu tekstowym
        </div>
      </div>`;
    document.body.appendChild(modal);

    // Esc closes
    const escHandler = e => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  }

  document.addEventListener('keydown', e => {
    if (_isTyping()) return;

    const key = e.key;

    // ? → cheat-sheet
    if (key === '?') { e.preventDefault(); showCheatSheet(); return; }

    // / → global search
    if (key === '/') {
      e.preventDefault();
      const inp = document.getElementById('gs-input');
      if (inp) { inp.focus(); inp.select(); }
      return;
    }

    // N → new entry
    if (key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      _newEntry();
      return;
    }

    // G → start two-key sequence
    if (key.toLowerCase() === 'g') {
      e.preventDefault();
      _gPending = true;
      clearTimeout(_gTimer);
      _gTimer = setTimeout(() => { _gPending = false; }, 1200);
      return;
    }

    // Second key after G
    if (_gPending) {
      _gPending = false;
      clearTimeout(_gTimer);
      e.preventDefault();
      switch (key.toLowerCase()) {
        case 'd': _go('dash');            break;
        case 'p': _go('pojazdy');         break;
        case 'r': _go('raporty');         break;
        case 'k': _go('kalkulator');      break;
        case 'a': _go('ai');              break;
        case 'b': _go('budzet');          break;
        case 'f': _go('dok-smart');       break;
        case 'u': _go('policies');        break;
        case 'h': _go('service-schedule');break;
        case 'j': _go('mileage-claims');  break;
      }
    }
  });

  // Hint w topbarze — pojawia się 3s po załadowaniu strony (jednorazowo)
  window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('ks-hint-shown')) return;
    setTimeout(() => {
      if (typeof toast === 'function') {
        toast('💡 Naciśnij ? aby zobaczyć skróty klawiszowe');
        if (window.UserPrefs) UserPrefs.set('ks-hint-shown', '1'); else localStorage.setItem('ks-hint-shown', '1');
      }
    }, 3000);
  });

  return { showCheatSheet };
})();
