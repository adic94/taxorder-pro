(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const EVENT_LBL = {
    harsh_brake:'Gwałtowne hamowanie', harsh_accel:'Gwałtowne przyspieszenie',
    sharp_turn:'Gwałtowny skręt', lane_departure:'Zmiana pasa', collision:'Kolizja',
    driver_distraction:'Rozproszenie kierowcy', speeding:'Przekroczenie prędkości',
    rolling_stop:'Brak pełnego zatrzymania', tailgating:'Zbyt mała odległość', other:'Inne'
  };
  const SEV_CLR = { low:'#22c55e', medium:'#f59e0b', high:'#ef4444', critical:'#7c3aed' };
  const SEV_LBL = { low:'Niskie', medium:'Średnie', high:'Wysokie', critical:'Krytyczne' };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/video-telematics${path}?company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderVideoTelematics() {
    const el = document.getElementById('page-video-telematics');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-camera"></i> Telematyka Wideo (ADAS)</h2>
        <button class="btn btn-primary" onclick="window.VideoTelematics._openModal()"><i class="ti ti-plus"></i> Dodaj zdarzenie</button>
      </div>
      <div id="vt-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="vt-filter-event" class="form-control" style="width:220px" onchange="window.VideoTelematics._load()">
          <option value="">Wszystkie zdarzenia</option>
          ${Object.entries(EVENT_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <select id="vt-filter-sev" class="form-control" style="width:150px" onchange="window.VideoTelematics._load()">
          <option value="">Wszystkie ważności</option>
          ${Object.entries(SEV_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="vt-search-reg" class="form-control" style="width:180px" placeholder="Nr rej." oninput="window.VideoTelematics._load()">
        <input id="vt-filter-date-from" type="date" class="form-control" style="width:150px" onchange="window.VideoTelematics._load()">
        <span style="align-self:center">—</span>
        <input id="vt-filter-date-to" type="date" class="form-control" style="width:150px" onchange="window.VideoTelematics._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Data / czas</th><th>Pojazd</th><th>Kierowca</th><th>Zdarzenie</th><th>Ważność</th><th>Lokalizacja</th><th>Klip wideo</th><th>Akcje</th></tr></thead>
        <tbody id="vt-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="vt-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.VideoTelematics._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header"><h3 id="vt-modal-title">Zdarzenie ADAS</h3><button class="modal-close" onclick="window.VideoTelematics._closeModal()">×</button></div>
          <div class="modal-body" id="vt-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const event_type = document.getElementById('vt-filter-event')?.value || '';
    const severity   = document.getElementById('vt-filter-sev')?.value || '';
    const reg        = document.getElementById('vt-search-reg')?.value || '';
    const date_from  = document.getElementById('vt-filter-date-from')?.value || '';
    const date_to    = document.getElementById('vt-filter-date-to')?.value || '';
    const tbody      = document.getElementById('vt-tbody');
    if (!tbody) return;
    const data = await api(`?event_type=${event_type}&severity=${severity}&reg=${encodeURIComponent(reg)}&date_from=${date_from}&date_to=${date_to}`);
    const list = data.events || [];
    _renderStats(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak zdarzeń ADAS</td></tr>'; return; }
    tbody.innerHTML = list.map(e => `<tr>
      <td>${esc(e.event_at?.replace('T',' ').slice(0,16)||'—')}</td>
      <td><strong>${esc(e.vehicle_reg||'—')}</strong></td>
      <td>${esc(e.driver_name||'—')}</td>
      <td>${esc(EVENT_LBL[e.event_type]||e.event_type||'—')}</td>
      <td><span class="pill" style="background:${SEV_CLR[e.severity]||'#999'}20;color:${SEV_CLR[e.severity]||'#999'}">${esc(SEV_LBL[e.severity]||e.severity||'—')}</span></td>
      <td style="font-size:.85em">${esc(e.location||'—')}</td>
      <td>${e.clip_url && e.clip_url.startsWith('https://')?`<a href="${esc(e.clip_url)}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="Otwórz klip"><i class="ti ti-player-play"></i></a>`:'—'}</td>
      <td>
        <button class="btn-icon" data-id="${esc(e.id)}" onclick="window.VideoTelematics._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
        <button class="btn-icon danger" data-id="${esc(e.id)}" onclick="window.VideoTelematics._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('vt-stats');
    if (!el) return;
    el.innerHTML = [
      { lbl:'Krytyczne', val: s.critical||0, c:'#7c3aed' },
      { lbl:'Wysokie', val: s.high||0, c:'#ef4444' },
      { lbl:'Średnie', val: s.medium||0, c:'#f59e0b' },
      { lbl:'Razem (30 dni)', val: s.total_30d||0, c:'#3b82f6' },
    ].map(i=>`<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.2em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('vt-modal');
    const body  = document.getElementById('vt-modal-body');
    document.getElementById('vt-modal-title').textContent = id ? 'Edytuj zdarzenie' : 'Nowe zdarzenie ADAS';
    let e = { severity:'medium', event_at: new Date().toISOString().slice(0,16) };
    if (id) { const d = await api(`/${id}`); e = d.event || e; }
    body.innerHTML = `<form id="vt-form" data-id="${esc(id||'')}" onsubmit="window.VideoTelematics._save(event,this.dataset.id)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row"><label>Nr rej. *</label><input name="vehicle_reg" class="form-control" required value="${esc(e.vehicle_reg||'')}"></div>
        <div class="form-row"><label>Kierowca</label><input name="driver_name" class="form-control" value="${esc(e.driver_name||'')}"></div>
        <div class="form-row"><label>Typ zdarzenia *</label>
          <select name="event_type" class="form-control" required>
            ${Object.entries(EVENT_LBL).map(([v,l])=>`<option value="${v}" ${e.event_type===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Ważność</label>
          <select name="severity" class="form-control">
            ${Object.entries(SEV_LBL).map(([v,l])=>`<option value="${v}" ${e.severity===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Data i czas *</label><input name="event_at" type="datetime-local" class="form-control" required value="${esc(e.event_at?.slice(0,16)||'')}"></div>
        <div class="form-row"><label>Prędkość w chwili zdarzenia (km/h)</label><input name="speed_kmh" type="number" class="form-control" value="${e.speed_kmh??''}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Lokalizacja (adres / GPS)</label><input name="location" class="form-control" value="${esc(e.location||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>URL klipu wideo (https://…)</label><input name="clip_url" class="form-control" type="url" placeholder="https://..." value="${esc(e.clip_url||'')}"></div>
        <div class="form-row"><label>Kamera (front/back/cabin)</label><input name="camera_position" class="form-control" value="${esc(e.camera_position||'')}"></div>
        <div class="form-row"><label>ID urządzenia telematycznego</label><input name="device_id" class="form-control" value="${esc(e.device_id||'')}"></div>
        <div class="form-row" style="grid-column:1/-1"><label>Opis / uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(e.notes||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.VideoTelematics._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
    </form>`;
    modal.style.display = 'flex';
  }

  async function _save(ev, id) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    if (body.clip_url && !body.clip_url.startsWith('https://')) { alert('URL klipu musi zaczynać się od https://'); return; }
    await api(id?`/${id}`:'', { method: id?'PUT':'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _delete(id) {
    if (!confirm('Usunąć zdarzenie ADAS?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('vt-modal'); if(m) m.style.display='none'; }
  window.VideoTelematics = { renderVideoTelematics, _load, _openModal, _save, _delete, _closeModal };
})();
