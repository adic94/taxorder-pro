/**
 * TaxOrder Pro — Globalna wyszukiwarka (topbar)
 * Przeszukuje pojazdy, kierowców, szkody, mandaty w czasie rzeczywistym
 */
window.TaxOrderSearch = (function () {
  let _timer = null;

  const TYPE_ICONS = {
    vehicle: 'ti-truck',
    driver:  'ti-user',
    damage:  'ti-car-crash',
    fine:    'ti-receipt-tax',
  };

  function _q(val) { return String(val || '').toLowerCase(); }

  function _collect(query) {
    const results = [];

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
          label: esc(v.nrRej || '—') + ' — ' + esc((v.marka||'') + ' ' + (v.model||'')).trim(),
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
          label: esc(f.nrRej || '—') + (f.amount ? ' · ' + f.amount + ' zł' : ''),
          sub: f.place ? esc(f.place) : '',
          action: () => { if (window.showPage) showPage('mandaty'); _hide(); },
        });
      }
    });

    return results.slice(0, 12);
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

    const typeLabel = { vehicle: 'Pojazd', driver: 'Kierowca', damage: 'Szkoda', fine: 'Mandat' };
    drop.innerHTML = results.map((r, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .12s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''"
        onmousedown="window._gsResults[${i}].action()">
        <div style="width:28px;height:28px;border-radius:6px;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ${TYPE_ICONS[r.type] || 'ti-search'}" style="font-size:14px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
          ${r.sub ? `<div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.sub}</div>` : ''}
        </div>
        <span style="font-size:10px;color:var(--text3);white-space:nowrap">${typeLabel[r.type] || ''}</span>
      </div>`).join('');
    window._gsResults = results;
    drop.style.display = 'block';
  }

  function search(rawVal) {
    clearTimeout(_timer);
    const query = rawVal.trim().toLowerCase();
    const drop = document.getElementById('gs-dropdown');
    if (!query || query.length < 2) { _hide(); return; }
    _timer = setTimeout(() => {
      const results = _collect(query);
      _renderResults(results, rawVal.trim());
    }, 180);
  }

  function show() {
    const inp = document.getElementById('gs-input');
    if (inp && inp.value.trim().length >= 2) search(inp.value);
  }

  function _hide() {
    const drop = document.getElementById('gs-dropdown');
    if (drop) drop.style.display = 'none';
    const inp = document.getElementById('gs-input');
    if (inp) inp.value = '';
  }

  // Zamknij dropdown klikając poza nim
  document.addEventListener('mousedown', e => {
    if (!e.target.closest('#gs-wrap')) _hide();
  });

  return { search, show, hide: _hide };
})();
