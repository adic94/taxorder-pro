(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtDT = s => s ? s.replace('T',' ').slice(0,16) : '—';

  let _zones   = [];
  let _events  = [];
  let _activeTab = 'zones';
  let _map = null;
  let _drawCircle = null;

  async function renderGeofencing() {
    const el = document.getElementById('page-geofencing');
    if (!el) return;
    const co = Co();
    try {
      const [zR, eR] = await Promise.all([
        fetch(`${API()}/api/geofences?company=${encodeURIComponent(co)}`, { headers: H() }),
        fetch(`${API()}/api/geofences/events?company=${encodeURIComponent(co)}&limit=100`, { headers: H() }),
      ]);
      if (zR.ok) _zones  = await zR.json();
      if (eR.ok) _events = await eR.json();
    } catch {}
    _renderPage(el);
  }

  function _renderPage(el) {
    el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
  <h2 style="margin:0;font-size:18px"><i class="ti ti-map-pin-check"></i> Geofencing — strefy i alerty</h2>
  <button class="btn btn-primary" onclick="window.Geofencing._openAdd()"><i class="ti ti-plus"></i> Nowa strefa</button>
</div>

<div style="display:flex;gap:4px;margin-bottom:16px">
  ${['zones','map','events'].map(t => `<button class="btn${_activeTab===t?' btn-primary':''}" onclick="window.Geofencing._tab('${t}')">
    <i class="ti ${t==='zones'?'ti-circle-check':t==='map'?'ti-map':'ti-bell'}"></i>
    ${t==='zones'?'Strefy ('+_zones.length+')':t==='map'?'Mapa':'Zdarzenia ('+_events.length+')'}
  </button>`).join('')}
</div>

<div id="geo-tab-content">${_renderTab()}</div>

<!-- Modal -->
<div id="geo-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
  <div id="geo-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(520px,96vw);max-height:90vh;overflow-y:auto"></div>
</div>`;
  }

  function _tab(tab) {
    _activeTab = tab;
    const el = document.getElementById('geo-tab-content');
    if (el) el.innerHTML = _renderTab();
    if (tab === 'map') setTimeout(() => _initMap(), 100);
  }

  function _renderTab() {
    if (_activeTab === 'zones')  return _renderZones();
    if (_activeTab === 'map')    return _renderMap();
    if (_activeTab === 'events') return _renderEvents();
    return '';
  }

  function _renderZones() {
    if (!_zones.length) return `<div style="padding:30px;text-align:center;color:var(--text3)">
      <i class="ti ti-map-pin-off" style="font-size:40px"></i>
      <p>Brak stref geofencing.<br>Kliknij "Nowa strefa" aby dodać obszar monitorowania.</p>
    </div>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
    ${_zones.map(z => `
    <div style="background:var(--bg2);border-radius:10px;padding:14px;border-left:4px solid ${e(z.color||'#2563eb')}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <strong style="font-size:14px">${e(z.name)}</strong>
          ${z.description?`<br><span style="font-size:12px;color:var(--text3)">${e(z.description)}</span>`:''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm" data-id="${e(z.id)}" onclick="window.Geofencing._edit(this.dataset.id)" title="Edytuj"><i class="ti ti-edit"></i></button>
          <button class="btn btn-sm" data-id="${e(z.id)}" onclick="window.Geofencing._delete(this.dataset.id)" title="Usuń" style="color:#dc2626"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;font-size:11px;color:var(--text3);flex-wrap:wrap">
        <span><i class="ti ti-${z.zone_type==='circle'?'circle':'vector-triangle'}"></i> ${z.zone_type==='circle'?'Okrąg (r='+z.radius_m+'m)':'Wielokąt'}</span>
        ${z.alert_enter?'<span style="color:#16a34a"><i class="ti ti-login"></i> Alert wjazdu</span>':''}
        ${z.alert_exit? '<span style="color:#d97706"><i class="ti ti-logout"></i> Alert wyjazdu</span>':''}
        <span style="color:${z.active?'#16a34a':'#dc2626'}">${z.active?'Aktywna':'Nieaktywna'}</span>
      </div>
      <div style="margin-top:8px">
        <button class="btn btn-sm" data-id="${e(z.id)}" onclick="window.Geofencing._showEvents(this.dataset.id)" style="font-size:11px">
          <i class="ti ti-history"></i> Historia zdarzeń
        </button>
      </div>
    </div>`).join('')}
  </div>`;
  }

  function _renderMap() {
    return `<div id="geo-leaflet-map" style="height:500px;border-radius:10px;overflow:hidden;border:1px solid var(--border)">
      <div style="padding:20px;text-align:center;color:var(--text3)"><i class="ti ti-loader"></i> Ładowanie mapy...</div>
    </div>
    <div style="margin-top:8px;font-size:12px;color:var(--text3)"><i class="ti ti-info-circle"></i>
      Na mapie widoczne są wszystkie aktywne strefy. Kliknij na strefę aby zobaczyć szczegóły.
    </div>`;
  }

  function _renderEvents() {
    if (!_events.length) return `<div style="padding:30px;text-align:center;color:var(--text3)">Brak zdarzeń geofencing.</div>`;
    return `<div style="overflow-x:auto">
    <table class="tach-table">
      <thead><tr>
        <th>Czas</th>
        <th>Strefa</th>
        <th>Pojazd</th>
        <th>Kierowca</th>
        <th>Zdarzenie</th>
        <th style="text-align:right">Prędkość</th>
      </tr></thead>
      <tbody>
        ${_events.map(ev => `<tr>
          <td style="font-size:12px;white-space:nowrap">${fmtDT(ev.event_time)}</td>
          <td style="font-weight:600">${e(ev.geofence_name||'—')}</td>
          <td style="font-size:12px">${e(ev.vehicle_reg||'—')}</td>
          <td style="font-size:12px">${e(ev.driver_name||'—')}</td>
          <td>
            <span style="padding:3px 8px;border-radius:8px;font-size:11px;font-weight:600;
              background:${ev.event_type==='enter'?'#dcfce7':'#fef3c7'};
              color:${ev.event_type==='enter'?'#16a34a':'#d97706'}">
              <i class="ti ti-${ev.event_type==='enter'?'login':'logout'}"></i>
              ${ev.event_type==='enter'?'Wjazd':'Wyjazd'}
            </span>
          </td>
          <td style="text-align:right;font-size:12px">${ev.speed_kmh!=null?Math.round(ev.speed_kmh)+' km/h':'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
  }

  function _initMap() {
    if (!window.L) return;
    const mapEl = document.getElementById('geo-leaflet-map');
    if (!mapEl) return;
    mapEl.innerHTML = '';
    _map = L.map('geo-leaflet-map').setView([52.2297, 21.0122], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(_map);

    _zones.forEach(z => {
      if (z.zone_type === 'circle' && z.center_lat && z.center_lon) {
        L.circle([z.center_lat, z.center_lon], {
          radius: z.radius_m || 500, color: z.color || '#2563eb', fillOpacity: 0.15
        }).addTo(_map).bindPopup(`<strong>${e(z.name)}</strong>${z.description?'<br>'+e(z.description):''}`);
      }
    });
  }

  function _openAdd(zone = null) {
    const inner = document.getElementById('geo-modal-inner');
    const m     = document.getElementById('geo-modal');
    if (!inner || !m) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0">${zone?'Edytuj strefę':'Nowa strefa geofencing'}</h3>
  <button onclick="window.Geofencing._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
  <div style="grid-column:1/-1"><label style="font-size:12px;color:var(--text3)">Nazwa strefy *</label><br>
    <input type="text" id="gf-name" class="sel" placeholder="np. Warszawa — baza, Magazyn Południe..." value="${e(zone?.name||'')}"></div>
  <div style="grid-column:1/-1"><label style="font-size:12px;color:var(--text3)">Opis</label><br>
    <input type="text" id="gf-desc" class="sel" value="${e(zone?.description||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Szerokość geo. (lat)</label><br>
    <input type="number" id="gf-lat" class="sel" step="0.000001" value="${zone?.center_lat||52.2297}" placeholder="52.2297"></div>
  <div><label style="font-size:12px;color:var(--text3)">Długość geo. (lon)</label><br>
    <input type="number" id="gf-lon" class="sel" step="0.000001" value="${zone?.center_lon||21.0122}" placeholder="21.0122"></div>
  <div><label style="font-size:12px;color:var(--text3)">Promień (metry)</label><br>
    <input type="number" id="gf-radius" class="sel" min="50" max="100000" value="${zone?.radius_m||500}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Kolor strefy</label><br>
    <input type="color" id="gf-color" value="${zone?.color||'#2563eb'}" style="width:100%;height:38px;border-radius:6px;border:1px solid var(--border)"></div>
  <div style="display:flex;align-items:center;gap:8px">
    <input type="checkbox" id="gf-alert-enter" ${(!zone||zone.alert_enter)?'checked':''}>
    <label for="gf-alert-enter" style="font-size:13px">Alert przy wjeździe</label>
  </div>
  <div style="display:flex;align-items:center;gap:8px">
    <input type="checkbox" id="gf-alert-exit" ${zone?.alert_exit?'checked':''}>
    <label for="gf-alert-exit" style="font-size:13px">Alert przy wyjeździe</label>
  </div>
</div>
<div style="margin-top:14px;padding:10px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <i class="ti ti-info-circle"></i> Wprowadź współrzędne centrum strefy. Możesz sprawdzić współrzędne miejsca na
  <strong>maps.google.com</strong> (prawy klik → "Co tu jest?").
</div>
<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
  <button class="btn" onclick="window.Geofencing._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.Geofencing._save('${e(zone?.id||'')}')"><i class="ti ti-check"></i> Zapisz strefę</button>
</div>`;
    m.style.display = 'flex';
  }

  function _closeModal() {
    const m = document.getElementById('geo-modal');
    if (m) m.style.display = 'none';
  }

  async function _save(id) {
    const data = {
      name:        document.getElementById('gf-name')?.value || '',
      description: document.getElementById('gf-desc')?.value || '',
      zone_type:   'circle',
      center_lat:  parseFloat(document.getElementById('gf-lat')?.value || 0),
      center_lon:  parseFloat(document.getElementById('gf-lon')?.value || 0),
      radius_m:    parseInt(document.getElementById('gf-radius')?.value || 500),
      color:       document.getElementById('gf-color')?.value || '#2563eb',
      alert_enter: document.getElementById('gf-alert-enter')?.checked ? 1 : 0,
      alert_exit:  document.getElementById('gf-alert-exit')?.checked  ? 1 : 0,
    };
    if (!data.name) { alert('Nazwa strefy jest wymagana'); return; }
    try {
      const url = id ? `${API()}/api/geofences/${id}?company=${encodeURIComponent(Co())}` : `${API()}/api/geofences?company=${encodeURIComponent(Co())}`;
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (r.ok) { _closeModal(); await renderGeofencing(); }
      else alert('Błąd zapisu');
    } catch (ex) { alert(ex.message); }
  }

  async function _edit(id) {
    const zone = _zones.find(z => z.id === id);
    if (zone) _openAdd(zone);
  }

  async function _delete(id) {
    if (!confirm('Usunąć strefę?')) return;
    await fetch(`${API()}/api/geofences/${id}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
    await renderGeofencing();
  }

  async function _showEvents(gfId) {
    const zone = _zones.find(z => z.id === gfId);
    try {
      const r = await fetch(`${API()}/api/geofences/${gfId}/events?company=${encodeURIComponent(Co())}&limit=50`, { headers: H() });
      const evs = r.ok ? await r.json() : [];
      const inner = document.getElementById('geo-modal-inner');
      const m     = document.getElementById('geo-modal');
      if (!inner||!m) return;
      inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <h3 style="margin:0"><i class="ti ti-history"></i> Zdarzenia — ${e(zone?.name||'Strefa')}</h3>
  <button onclick="window.Geofencing._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
${evs.length===0?'<p style="color:var(--text3)">Brak zdarzeń dla tej strefy.</p>':`
<table class="tach-table">
  <thead><tr><th>Czas</th><th>Pojazd</th><th>Kierowca</th><th>Zdarzenie</th><th style="text-align:right">Prędkość</th></tr></thead>
  <tbody>
    ${evs.map(ev=>`<tr>
      <td style="font-size:12px">${fmtDT(ev.event_time)}</td>
      <td style="font-size:12px">${e(ev.vehicle_reg||'—')}</td>
      <td style="font-size:12px">${e(ev.driver_name||'—')}</td>
      <td><span style="padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;background:${ev.event_type==='enter'?'#dcfce7':'#fef3c7'};color:${ev.event_type==='enter'?'#16a34a':'#d97706'}">
        ${ev.event_type==='enter'?'Wjazd':'Wyjazd'}</span></td>
      <td style="text-align:right;font-size:12px">${ev.speed_kmh!=null?Math.round(ev.speed_kmh)+' km/h':'—'}</td>
    </tr>`).join('')}
  </tbody>
</table>`}`;
      m.style.display = 'flex';
    } catch (ex) { alert(ex.message); }
  }

  window.Geofencing = { renderGeofencing, _tab, _openAdd, _closeModal, _save, _edit, _delete, _showEvents };
})();
