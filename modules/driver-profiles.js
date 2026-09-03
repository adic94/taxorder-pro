(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc==='function' ? esc(s) : String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtD = d => d ? d.slice(0,10) : '—';
  const daysDiff = d => d ? Math.ceil((new Date(d)-Date.now())/86400000) : null;

  let _drivers = [];

  function _expiryClass(dateStr) {
    const d = daysDiff(dateStr);
    if (d === null) return '';
    if (d < 0) return 'danger';
    if (d <= 30) return 'warn';
    return '';
  }

  async function renderDriverProfiles() {
    const co = Co();
    const status = document.getElementById('dp-filter-status')?.value || '';
    const params = new URLSearchParams({ company: co });
    if (status) params.set('status', status);
    try {
      const r = await fetch(`${API()}/api/driver-profiles?${params}`, { headers: H() });
      if (r.ok) _drivers = await r.json();
    } catch {}

    // Alerty wygaśnięcia
    let alerts = [];
    try {
      const r = await fetch(`${API()}/api/driver-profiles/alerts?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) alerts = await r.json();
    } catch {}

    const el = document.getElementById('page-driver-profiles');
    if (!el) return;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-id-badge"></i> Kartoteka kierowców</h2>
  <button class="btn-primary" onclick="window.DriverProfilesModule.openModal()"><i class="ti ti-plus"></i> Dodaj kierowcę</button>
</div>
${alerts.length ? `<div class="alert alert-warn" style="margin-bottom:12px">
  <strong><i class="ti ti-alert-triangle"></i> Wygasające dokumenty (${alerts.length} kierowców):</strong>
  <ul style="margin:4px 0 0 16px">${alerts.map(a=>`<li>${e(`${a.first_name} ${a.last_name}`)} — ${_expiryBadges(a)}</li>`).join('')}</ul>
</div>` : ''}
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
  <select id="dp-filter-status" onchange="window.DriverProfilesModule.renderDriverProfiles()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="">Wszyscy</option>
    <option value="active">Aktywni</option>
    <option value="inactive">Nieaktywni</option>
    <option value="suspended">Zawieszeni</option>
  </select>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Nazwisko</th><th>Imię</th><th>Nr prac.</th><th>Telefon</th><th>Kat. prawa jazdy</th><th>Ważność PJ</th><th>Badanie</th><th>Psychotech.</th><th>Pojazd</th><th>Status</th><th></th></tr></thead>
<tbody>
${_drivers.length ? _drivers.map(d=>`<tr>
  <td>${e(d.last_name)}</td><td>${e(d.first_name)}</td>
  <td>${e(d.employee_id||'—')}</td><td>${e(d.phone||'—')}</td>
  <td>${e(_parseCategories(d.license_categories))}</td>
  <td class="${_expiryClass(d.license_expiry)}">${fmtD(d.license_expiry)}</td>
  <td class="${_expiryClass(d.medical_expiry)}">${fmtD(d.medical_expiry)}</td>
  <td class="${_expiryClass(d.psychotech_expiry)}">${fmtD(d.psychotech_expiry)}</td>
  <td>${e(d.assigned_nr_rej||'—')}</td>
  <td><span class="pill ${d.status==='active'?'ok':d.status==='suspended'?'danger':''}">${e({active:'Aktywny',inactive:'Nieaktywny',suspended:'Zawieszony'}[d.status]||d.status)}</span></td>
  <td>
    <button class="btn-icon" data-id="${e(d.id)}" onclick="window.DriverProfilesModule.openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(d.id)}" onclick="window.DriverProfilesModule.deleteDriver(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="11" class="empty">Brak kierowców</td></tr>'}
</tbody></table></div>`;
    if (status) document.getElementById('dp-filter-status').value = status;
  }

  function _parseCategories(json) {
    try { const a = JSON.parse(json||'[]'); return Array.isArray(a) ? a.join(', ') : json||'—'; } catch { return json||'—'; }
  }
  function _expiryBadges(a) {
    const b = [];
    const d = daysDiff;
    if (a.license_expiry && d(a.license_expiry)<=30)    b.push(`PJ wygasa ${fmtD(a.license_expiry)}`);
    if (a.medical_expiry && d(a.medical_expiry)<=30)    b.push(`Badanie wygasa ${fmtD(a.medical_expiry)}`);
    if (a.psychotech_expiry && d(a.psychotech_expiry)<=30) b.push(`Psychotech. wygasa ${fmtD(a.psychotech_expiry)}`);
    return b.map(x=>e(x)).join(', ');
  }

  function openModal(id) {
    const d = id ? _drivers.find(x=>x.id===id) : null;
    const modal = document.getElementById('driver-profile-modal');
    if (!modal) return;
    const gi = id => document.getElementById(id);
    gi('dpm-id').value           = d?.id||'';
    gi('dpm-first').value        = d?.first_name||'';
    gi('dpm-last').value         = d?.last_name||'';
    gi('dpm-empid').value        = d?.employee_id||'';
    gi('dpm-email').value        = d?.email||'';
    gi('dpm-phone').value        = d?.phone||'';
    gi('dpm-birth').value        = d?.birth_date||'';
    gi('dpm-license-no').value   = d?.license_number||'';
    gi('dpm-license-cat').value  = _parseCategories(d?.license_categories);
    gi('dpm-license-exp').value  = d?.license_expiry||'';
    gi('dpm-medical-exp').value  = d?.medical_expiry||'';
    gi('dpm-psycho-exp').value   = d?.psychotech_expiry||'';
    gi('dpm-vehicle').value      = d?.assigned_nr_rej||'';
    gi('dpm-status').value       = d?.status||'active';
    gi('dpm-notes').value        = d?.notes||'';
    modal.style.display = 'flex';
  }

  function closeModal() {
    const modal = document.getElementById('driver-profile-modal');
    if (modal) modal.style.display = 'none';
  }

  async function saveDriver() {
    const gi = id => document.getElementById(id);
    const id = gi('dpm-id').value;
    const first = gi('dpm-first').value.trim();
    const last  = gi('dpm-last').value.trim();
    if (!first || !last) { alert('Imię i nazwisko są wymagane'); return; }
    const catRaw = gi('dpm-license-cat').value.trim();
    const cats = catRaw ? catRaw.split(/[\s,]+/).map(s=>s.toUpperCase()).filter(Boolean) : [];
    const body = {
      first_name: first, last_name: last, employee_id: gi('dpm-empid').value||null,
      email: gi('dpm-email').value||null, phone: gi('dpm-phone').value||null,
      birth_date: gi('dpm-birth').value||null, license_number: gi('dpm-license-no').value||null,
      license_categories: cats.length ? cats : null,
      license_expiry: gi('dpm-license-exp').value||null,
      medical_expiry: gi('dpm-medical-exp').value||null,
      psychotech_expiry: gi('dpm-psycho-exp').value||null,
      assigned_nr_rej: gi('dpm-vehicle').value||null,
      status: gi('dpm-status').value, notes: gi('dpm-notes').value||null,
    };
    const method = id ? 'PUT' : 'POST';
    const url = id
      ? `${API()}/api/driver-profiles/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/driver-profiles?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeModal(); await renderDriverProfiles();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  async function deleteDriver(id) {
    if (!confirm('Usunąć kierowcę?')) return;
    try {
      await fetch(`${API()}/api/driver-profiles/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers:H() });
      await renderDriverProfiles();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  window.DriverProfilesModule = { renderDriverProfiles, openModal, closeModal, saveDriver, deleteDriver };
})();
