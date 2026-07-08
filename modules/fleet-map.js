/**
 * TaxOrder Pro — Mapa GPS Floty
 * Pokazuje ostatnią pozycję GPS każdego pojazdu na mapie Leaflet.
 * Dane z window.vehs[].gpsHistory (pole {ts,lat,lon,km,speed,driver,location}).
 */
window.FleetMap = (function () {
  let _map = null;       // instancja Leaflet
  let _markers = [];     // aktualne markery
  let _filterText = '';  // aktualny filtr tekstowy

  // ── Kolor markera wg świeżości GPS ──────────────────────────────────────
  function _markerColor(ts) {
    if (!ts) return '#9ca3af'; // szary — brak GPS
    const ageH = (Date.now() - new Date(ts).getTime()) / 3600000;
    if (ageH < 24)  return '#16a34a'; // zielony — < 24h
    if (ageH < 168) return '#d97706'; // żółty — < 7 dni
    return '#dc2626';                  // czerwony — > 7 dni
  }

  function _markerSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path fill="${color}" stroke="#fff" stroke-width="1.5"
        d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z"/>
      <circle cx="14" cy="13" r="5" fill="#fff" opacity="0.9"/>
    </svg>`;
  }

  function _icon(color) {
    return L.divIcon({
      className: '',
      html: _markerSvg(color),
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -36],
    });
  }

  // ── Inicjalizacja mapy ───────────────────────────────────────────────────
  function _initMap() {
    const el = document.getElementById('fleet-map');
    if (!el) return false;

    if (!window.L) {
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3);font-size:13px"><i class="ti ti-map-off" style="font-size:32px;margin-right:8px"></i>Leaflet nie jest załadowany</div>';
      return false;
    }

    if (_map) {
      _map.remove();
      _map = null;
    }

    _map = L.map('fleet-map', { zoomControl: true }).setView([52.0, 19.0], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(_map);

    return true;
  }

  // ── Render główny ────────────────────────────────────────────────────────
  function render() {
    const vehs = window.vehs || [];
    const onlyGps = document.getElementById('mapa-only-gps')?.checked;

    if (!_initMap()) return;

    // Usuń stare markery
    _markers.forEach(m => _map.removeLayer(m));
    _markers = [];

    const sidebarEl = document.getElementById('mapa-sidebar');
    const items = [];

    vehs.forEach(v => {
      const hist = Array.isArray(v.gpsHistory) ? v.gpsHistory : [];
      // Znajdź najnowszy wpis z lat+lon
      const last = [...hist].filter(h => h.lat && h.lon).sort((a, b) => new Date(b.ts) - new Date(a.ts))[0] || null;

      if (onlyGps && !last) return;

      // Filtr tekstowy
      const needle = _filterText.toLowerCase();
      if (needle) {
        const haystack = [v.nrRej, v.nr_rej, v.marka, v.model, v.kierowca, last?.driver, last?.location].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(needle)) return;
      }

      items.push({ v, last });
    });

    // Jeśli brak pojazdów z GPS — komunikat
    const withGps = items.filter(i => i.last);

    items.forEach(({ v, last }) => {
      const color = _markerColor(last?.ts);

      if (last) {
        const dateStr = new Date(last.ts).toLocaleString('pl-PL');
        const kmStr = last.km ? Number(last.km).toLocaleString('pl-PL') + ' km' : '—';
        const speedStr = last.speed != null ? last.speed + ' km/h' : null;
        const locStr = last.location || '';

        const popupHtml = `
          <div style="min-width:180px;font-family:var(--font-sans,sans-serif)">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${v.nrRej || v.nr_rej || '—'}</div>
            <div style="font-size:11px;color:#555;margin-bottom:6px">${[v.marka, v.model].filter(Boolean).join(' ') || 'Pojazd'}</div>
            <table style="font-size:11px;border-collapse:collapse;width:100%">
              <tr><td style="color:#888;padding:1px 6px 1px 0">Stan km</td><td style="font-weight:600">${kmStr}</td></tr>
              ${speedStr ? `<tr><td style="color:#888;padding:1px 6px 1px 0">Prędkość</td><td>${speedStr}</td></tr>` : ''}
              ${locStr ? `<tr><td style="color:#888;padding:1px 6px 1px 0">Miejsce</td><td>${locStr}</td></tr>` : ''}
              ${(last.driver || v.kierowca) ? `<tr><td style="color:#888;padding:1px 6px 1px 0">Kierowca</td><td>${last.driver || v.kierowca}</td></tr>` : ''}
              <tr><td style="color:#888;padding:1px 6px 1px 0">Czas</td><td>${dateStr}</td></tr>
            </table>
            <div style="margin-top:8px">
              <a href="#" onclick="showPage('pojazdy');setTimeout(()=>TaxOrderVehicleDetail.open(${v.id}),200);return false"
                style="font-size:11px;color:#2563eb;font-weight:600;text-decoration:none">
                Otwórz kartę pojazdu →
              </a>
            </div>
          </div>`;

        const marker = L.marker([last.lat, last.lon], { icon: _icon(color) })
          .bindPopup(popupHtml, { maxWidth: 260 })
          .addTo(_map);

        _markers.push(marker);
      }
    });

    // Dopasuj widok do wszystkich markerów
    if (_markers.length > 0) {
      const group = new L.featureGroup(_markers);
      _map.fitBounds(group.getBounds().pad(0.15));
    }

    // Sidebar
    if (sidebarEl) {
      if (!items.length) {
        sidebarEl.innerHTML = '<div style="padding:20px;color:var(--text3);font-size:12px;text-align:center"><i class="ti ti-map-off"></i><br>Brak pojazdów do wyświetlenia</div>';
      } else {
        sidebarEl.innerHTML = items.map(({ v, last }) => {
          const color = _markerColor(last?.ts);
          const age = last ? _ageStr(last.ts) : null;
          return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer"
              onclick="FleetMap.focusVehicle('${v.id}')"
              onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
              <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
              <div style="min-width:0;flex:1">
                <div style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.nrRej || v.nr_rej || '—'}</div>
                <div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${[v.marka, v.model].filter(Boolean).join(' ') || 'Pojazd'}</div>
              </div>
              <div style="font-size:10px;color:var(--text3);text-align:right;flex-shrink:0">
                ${age ? `<div>${age}</div>` : '<div style="color:#9ca3af">brak GPS</div>'}
                ${last?.location ? `<div style="max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${last.location}">${last.location}</div>` : ''}
              </div>
            </div>`;
        }).join('');
      }
    }

    // Legenda / podsumowanie
    const withGpsCount = withGps.length;
    const total = items.length;
    const summaryEl = document.querySelector('#page-mapa .pg-sub');
    if (summaryEl) {
      summaryEl.textContent = `Pojazdy z GPS: ${withGpsCount} / ${total} — kliknij marker lub pozycję na liście, aby zobaczyć szczegóły`;
    }
  }

  // ── Czas od ostatniej pozycji ────────────────────────────────────────────
  function _ageStr(ts) {
    if (!ts) return null;
    const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60)  return mins + ' min temu';
    const hrs = Math.round(mins / 60);
    if (hrs < 24)   return hrs + ' godz. temu';
    return Math.round(hrs / 24) + ' dni temu';
  }

  // ── Centrowanie na pojeździe ─────────────────────────────────────────────
  function focusVehicle(vehicleId) {
    const vehs = window.vehs || [];
    const v = vehs.find(x => x.id === vehicleId);
    if (!v) return;
    const hist = Array.isArray(v.gpsHistory) ? v.gpsHistory : [];
    const last = [...hist].filter(h => h.lat && h.lon).sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
    if (!last || !_map) return;
    _map.setView([last.lat, last.lon], 14);
    const marker = _markers.find(m => {
      const ll = m.getLatLng();
      return Math.abs(ll.lat - last.lat) < 0.00001 && Math.abs(ll.lng - last.lon) < 0.00001;
    });
    if (marker) marker.openPopup();
  }

  // ── Filtr tekstowy ───────────────────────────────────────────────────────
  function filter(text) {
    _filterText = text || '';
    render();
  }

  // ── Auto-odświeżanie co 3 minuty gdy strona mapa jest aktywna ───────────
  let _autoRefreshTimer = null;

  function _stopAutoRefresh() {
    if (_autoRefreshTimer) { clearInterval(_autoRefreshTimer); _autoRefreshTimer = null; }
  }

  function _startAutoRefresh() {
    _stopAutoRefresh();
    _autoRefreshTimer = setInterval(async () => {
      const mapPage = document.getElementById('page-mapa');
      if (!mapPage || !mapPage.classList.contains('active')) { _stopAutoRefresh(); return; }
      if (typeof window.TaxOrderFleetCloud?.loadVehicles === 'function') {
        await window.TaxOrderFleetCloud.loadVehicles();
      }
      render();
    }, 3 * 60 * 1000);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) _stopAutoRefresh(); });

  return {
    render() { render(); if (!_autoRefreshTimer) _startAutoRefresh(); },
    focusVehicle,
    filter,
  };
})();
