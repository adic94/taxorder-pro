/* Harmonogram serwisowy — interwały km/miesiące per pojazd */
(function () {
  const BASE = () => (localStorage.getItem('cf_worker_url') || 'https://taxorder-pro-api.adamus1000.workers.dev');
  const COMPANY = () => localStorage.getItem('cf_company') || '';
  const TOKEN = () => localStorage.getItem('cf_token') || '';
  const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${  TOKEN()}` });

  function fd(ds) {
    if (!ds) return '—';
    const d = new Date(ds);
    return isNaN(d) ? '—' : d.toLocaleDateString('pl-PL');
  }

  function statusChip(entry, currentKm) {
    const now = new Date();
    const nextDate = entry.next_date ? new Date(entry.next_date) : null;
    const daysLeft = nextDate ? Math.round((nextDate - now) / 86400000) : null;
    const kmLeft   = (entry.next_km != null && currentKm) ? (entry.next_km - currentKm) : null;

    const overdue = (daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft < 0);
    const soon    = !overdue && ((daysLeft != null && daysLeft < 30) || (kmLeft != null && kmLeft < 1000));

    if (overdue) return `<span style="background:#f44336;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">Przeterminowany</span>`;
    if (soon)    return `<span style="background:#ff9800;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">Wkrótce</span>`;
    return `<span style="background:#4caf50;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">OK</span>`;
  }

  async function fetchSchedules(params) {
    const qs = new URLSearchParams({ company: COMPANY(), ...params });
    const r = await fetch(`${BASE()}/api/service-schedules?${qs}`, { headers: hdrs() });
    return r.ok ? r.json() : [];
  }

  async function saveSchedule(data, id) {
    const url = id
      ? `${BASE()}/api/service-schedules/${id}?company=${COMPANY()}`
      : `${BASE()}/api/service-schedules?company=${COMPANY()}`;
    const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: hdrs(), body: JSON.stringify(data) });
    return r.json();
  }

  async function deleteSchedule(id) {
    await fetch(`${BASE()}/api/service-schedules/${id}?company=${COMPANY()}`, { method: 'DELETE', headers: hdrs() });
  }

  // ─── Render dla karty pojazdu ─────────────────────────────────────────────
  function renderForVehicle(v) {
    const div = document.createElement('div');
    div.id = `ss-veh-${esc(v.nrRej || v.id)}`;
    div.innerHTML = '<div style="padding:12px 0;color:#888;font-style:italic">Ładowanie harmonogramu...</div>';
    loadForVehicle(v, div);
    return div;
  }

  async function loadForVehicle(v, container) {
    if (!container) container = document.getElementById(`ss-veh-${v.nrRej || v.id}`);
    if (!container) return;
    const schedules = await fetchSchedules(v.nrRej ? { nrRej: v.nrRej } : {});
    const currentKm = _lastKm(v);
    container.innerHTML = _renderVehicleHtml(v, schedules, currentKm);
  }

  function _lastKm(v) {
    if (!v.fuelHistory?.length && !v.serviceHistory?.length) return null;
    const kmVals = [];
    (v.fuelHistory || []).forEach(x => { if (x.km > 0) kmVals.push(x.km); });
    (v.serviceHistory || []).forEach(x => { if (x.km > 0) kmVals.push(x.km); });
    return kmVals.length ? Math.max(...kmVals) : null;
  }

  function _renderVehicleHtml(v, schedules, currentKm) {
    const nrRej = esc(v.nrRej || '');
    let rows = '';
    for (const s of schedules) {
      const nextKmStr   = s.next_km   ? `${s.next_km.toLocaleString('pl-PL')} km`  : '—';
      const nextDateStr = fd(s.next_date);
      const kmLeftStr   = (s.next_km != null && currentKm) ? `(zostało ${Math.max(0, s.next_km - currentKm).toLocaleString('pl-PL')} km)` : '';
      rows += `<tr>
        <td>${esc(s.name)}</td>
        <td>${s.interval_km ? `${s.interval_km.toLocaleString('pl-PL')  } km` : '—'}</td>
        <td>${s.interval_months ? `${s.interval_months  } mies.` : '—'}</td>
        <td>${s.last_km ? `${s.last_km.toLocaleString('pl-PL')  } km` : '—'}</td>
        <td>${fd(s.last_date)}</td>
        <td>${nextKmStr} <small style="color:#888">${kmLeftStr}</small></td>
        <td>${nextDateStr}</td>
        <td>${statusChip(s, currentKm)}</td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(s.id)}" data-nrrej="${nrRej}" onclick="ServiceScheduleModule._openEdit(this.dataset.id,this.dataset.nrrej)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon" title="Wykonano — aktualizuj daty/km" data-id="${esc(s.id)}" data-nrrej="${nrRej}" onclick="ServiceScheduleModule._markDone(this.dataset.id,this.dataset.nrrej)" style="color:#4caf50"><i class="ti ti-check"></i></button>
          <button class="btn-icon" title="Usuń" data-id="${esc(s.id)}" data-nrrej="${nrRej}" onclick="ServiceScheduleModule._del(this.dataset.id,this.dataset.nrrej)" style="color:#f44336"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }
    if (!rows) rows = `<tr><td colspan="9" style="text-align:center;color:#888;padding:16px">Brak pozycji harmonogramu</td></tr>`;
    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="btn-sm btn-primary" data-nrrej="${nrRej}" onclick="ServiceScheduleModule._openEdit(null,this.dataset.nrrej)"><i class="ti ti-plus"></i> Dodaj pozycję</button>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table" style="font-size:13px">
          <thead><tr><th>Nazwa</th><th>Co ile km</th><th>Co ile mies.</th><th>Ostatni km</th><th>Ostatnia data</th><th>Następny km</th><th>Następna data</th><th>Status</th><th>Akcje</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ─── Modal dodaj/edytuj ───────────────────────────────────────────────────
  function _openEdit(id, nrRej) {
    const modal = document.getElementById('ss-modal');
    if (!modal) return;
    document.getElementById('ss-modal-title').textContent = id ? 'Edytuj pozycję harmonogramu' : 'Nowa pozycja harmonogramu';
    document.getElementById('ss-f-id').value    = id || '';
    document.getElementById('ss-f-nrrej').value = nrRej || '';
    if (!id) {
      document.getElementById('ss-f-name').value    = '';
      document.getElementById('ss-f-intkm').value   = '';
      document.getElementById('ss-f-intmo').value   = '';
      document.getElementById('ss-f-lastkm').value  = '';
      document.getElementById('ss-f-lastdt').value  = '';
      document.getElementById('ss-f-notes').value   = '';
      // Default: auto-fill last km from vehicle
      const v = (window.vehs || []).find(x => x.nrRej === nrRej);
      if (v) {
        const km = _lastKm(v);
        if (km) document.getElementById('ss-f-lastkm').value = km;
      }
    } else {
      fetchSchedules({ nrRej }).then(list => {
        const s = list.find(x => x.id === id);
        if (!s) return;
        document.getElementById('ss-f-name').value    = s.name;
        document.getElementById('ss-f-intkm').value   = s.interval_km ?? '';
        document.getElementById('ss-f-intmo').value   = s.interval_months ?? '';
        document.getElementById('ss-f-lastkm').value  = s.last_km ?? '';
        document.getElementById('ss-f-lastdt').value  = s.last_date || '';
        document.getElementById('ss-f-notes').value   = s.notes || '';
      });
    }
    modal.style.display = 'flex';
  }

  function _closeEdit() {
    const modal = document.getElementById('ss-modal');
    if (modal) modal.style.display = 'none';
  }

  async function _submitEdit() {
    const id    = document.getElementById('ss-f-id').value || null;
    const nrRej = document.getElementById('ss-f-nrrej').value;
    const data = {
      nr_rej:          nrRej,
      name:            document.getElementById('ss-f-name').value.trim(),
      interval_km:     document.getElementById('ss-f-intkm').value  !== '' ? parseInt(document.getElementById('ss-f-intkm').value)  : null,
      interval_months: document.getElementById('ss-f-intmo').value  !== '' ? parseInt(document.getElementById('ss-f-intmo').value)  : null,
      last_km:         document.getElementById('ss-f-lastkm').value !== '' ? parseInt(document.getElementById('ss-f-lastkm').value) : null,
      last_date:       document.getElementById('ss-f-lastdt').value || null,
      notes:           document.getElementById('ss-f-notes').value.trim(),
    };
    if (!data.name) { alert('Podaj nazwę pozycji'); return; }
    const res = await saveSchedule(data, id);
    if (!res.ok && !res.id) { alert('Błąd zapisu'); return; }
    _closeEdit();
    const v = (window.vehs || []).find(x => x.nrRej === nrRej) || { nrRej };
    loadForVehicle(v);
    const page = document.getElementById('page-service-schedule');
    if (page && page.style.display !== 'none') _renderGlobalPage();
  }

  async function _markDone(id, nrRej) {
    const v = (window.vehs || []).find(x => x.nrRej === nrRej) || {};
    const currentKm = _lastKm(v);
    const todayStr  = new Date().toISOString().slice(0, 10);
    const kmPrompt  = prompt('Podaj aktualny przebieg (km):', currentKm || '');
    if (kmPrompt === null) return;
    const km = parseInt(kmPrompt);
    if (isNaN(km)) { alert('Nieprawidłowy przebieg'); return; }
    // Fetch current entry to get intervals
    const list = await fetchSchedules({ nrRej });
    const s = list.find(x => x.id === id);
    if (!s) return;
    const data = {
      nr_rej:          nrRej,
      name:            s.name,
      interval_km:     s.interval_km,
      interval_months: s.interval_months,
      last_km:         km,
      last_date:       todayStr,
      notes:           s.notes,
    };
    const res2 = await saveSchedule(data, id);
    if (!res2.ok && !res2.id) { alert('Błąd zapisu'); return; }
    const vFull = (window.vehs || []).find(x => x.nrRej === nrRej) || { nrRej };
    loadForVehicle(vFull);
    const page2 = document.getElementById('page-service-schedule');
    if (page2 && page2.style.display !== 'none') _renderGlobalPage();
  }

  async function _del(id, nrRej) {
    if (!confirm('Usunąć pozycję harmonogramu?')) return;
    try {
      await deleteSchedule(id);
      const v = (window.vehs || []).find(x => x.nrRej === nrRej) || { nrRej };
      loadForVehicle(v);
      const page = document.getElementById('page-service-schedule');
      if (page && page.style.display !== 'none') _renderGlobalPage();
    } catch (e) { if (window.toast) toast('Błąd usuwania — spróbuj ponownie'); }
  }

  // ─── Strona globalna ──────────────────────────────────────────────────────
  async function _renderGlobalPage() {
    const container = document.getElementById('ss-global-content');
    if (!container) return;
    container.innerHTML = '<div style="padding:24px;color:#888">Ładowanie...</div>';
    const all = await fetchSchedules({});
    if (!all.length) {
      container.innerHTML = '<div style="padding:24px;color:#888;text-align:center">Brak harmonogramów serwisowych</div>';
      return;
    }
    const byVeh = {};
    for (const s of all) {
      const k = s.nr_rej || '—';
      if (!byVeh[k]) byVeh[k] = [];
      byVeh[k].push(s);
    }
    let html = '';
    for (const [nrRej, list] of Object.entries(byVeh)) {
      const v = (window.vehs || []).find(x => x.nrRej === nrRej) || { nrRej };
      const currentKm = _lastKm(v);
      html += `<div style="margin-bottom:24px">
        <h4 style="margin:0 0 8px;font-size:14px;color:var(--accent)"><i class="ti ti-car"></i> ${esc(nrRej)}</h4>
        ${_renderVehicleHtml(v, list, currentKm)}
      </div>`;
    }
    container.innerHTML = html;
  }

  // ─── Alerty dla dashboard ─────────────────────────────────────────────────
  async function getAlerts() {
    const all = await fetchSchedules({ due: 'soon' });
    const alerts = [];
    for (const s of all) {
      const v = (window.vehs || []).find(x => x.nrRej === s.nr_rej) || {};
      const currentKm = _lastKm(v);
      const daysLeft = s.next_date ? Math.round((new Date(s.next_date) - new Date()) / 86400000) : null;
      const kmLeft   = (s.next_km != null && currentKm) ? (s.next_km - currentKm) : null;
      if ((daysLeft != null && daysLeft <= 30) || (kmLeft != null && kmLeft <= 1000)) {
        alerts.push({ ...s, daysLeft, kmLeft });
      }
    }
    return alerts;
  }

  window.ServiceScheduleModule = {
    renderForVehicle, loadForVehicle,
    _openEdit, _closeEdit, _submitEdit, _markDone, _del,
    _renderGlobalPage, getAlerts,
  };
})();
