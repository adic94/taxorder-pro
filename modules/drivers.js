/**
 * TaxOrder Pro — Kartoteka Kierowców
 * Dane w D1 (wcześniej localStorage), autocomplete w pojazdach i formach
 */
window.TaxOrderDrivers = (function () {

  const LS_KEY  = 'taxDrivers';
  const API     = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const token   = () => localStorage.getItem('cf_token');
  const hdrs    = () => ({ 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}) });
  const company = () => window.currentCompanyId || 'mtoilet';

  let _drivers = [];
  let _loaded  = false;
  let _finesCache = null; // { driverName -> { count, amt } }

  // ── Migracja localStorage → D1 (jednorazowa) ─────────────────────────────
  async function _migrate() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    let old;
    try { old = JSON.parse(raw); } catch { localStorage.removeItem(LS_KEY); return; }
    if (!Array.isArray(old) || !old.length) { localStorage.removeItem(LS_KEY); return; }

    const co = company();
    let migrated = 0;
    for (const d of old) {
      if (!d.name) continue;
      const body = {
        id:             d.id ? String(d.id) : crypto.randomUUID(),
        name:           d.name,
        phone:          d.phone          || null,
        email:          d.email          || null,
        license_no:     d.licenseNo      || null,
        license_expiry: d.licenseExpiry  || null,
        notes:          d.notes          || null,
      };
      try {
        const r = await fetch(`${API()}/api/drivers?company=${co}`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
        if (r.ok || (await r.json().catch(() => ({}))).error?.includes('już istnieje')) migrated++;
      } catch {}
    }
    if (migrated > 0) {
      localStorage.removeItem(LS_KEY);
      if (typeof toast === 'function') toast(`✓ Przeniesiono ${migrated} kierowców do chmury`);
    }
  }

  // ── Ładowanie z API ───────────────────────────────────────────────────────
  async function load() {
    try {
      await _migrate();
      const r  = await fetch(`${API()}/api/drivers?company=${company()}`, { headers: hdrs() });
      const d  = r.ok ? await r.json() : {};
      _drivers = d.drivers || [];
      _loaded  = true;
    } catch {
      _drivers = [];
    }
    _updateDatalist();
  }

  function getAll() { return [..._drivers]; }

  // ── Datalist dla autocomplete ─────────────────────────────────────────────
  function _updateDatalist() {
    const dl = document.getElementById('drivers-datalist');
    if (!dl) return;
    dl.innerHTML = _drivers.map(d => `<option value="${d.name}">`).join('');
  }

  // ── Fines cache (async, załadowany przy otwieraniu modalu) ────────────────
  async function _loadFinesCache() {
    try {
      const r = await fetch(`${API()}/api/fines?company=${company()}&limit=1000`, { headers: hdrs() });
      const d = r.ok ? await r.json() : {};
      const map = {};
      for (const f of (d.fines || [])) {
        const key = (f.driver_name || '').toLowerCase();
        if (!key) continue;
        if (!map[key]) map[key] = { count: 0, amt: 0 };
        map[key].count++;
        map[key].amt += f.amount || 0;
      }
      _finesCache = map;
    } catch { _finesCache = {}; }
  }

  // ── Globalne okno ─────────────────────────────────────────────────────────
  async function open() {
    document.getElementById('drivers-modal').style.display = 'flex';
    const el = document.getElementById('drivers-list-body');
    if (el) el.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)"><i class="ti ti-loader-2" style="font-size:22px"></i></td></tr>`;
    await Promise.all([load(), _loadFinesCache()]);
    _renderList();
  }

  function close() {
    document.getElementById('drivers-modal').style.display = 'none';
  }

  function _renderList() {
    const el = document.getElementById('drivers-list-body');
    if (!el) return;

    if (!_drivers.length) {
      el.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">
        Brak kierowców. Dodaj pierwszego kierowcę poniżej.
      </td></tr>`;
      return;
    }

    el.innerHTML = _drivers.map(d => {
      const expColor = d.license_expiry
        ? (new Date(d.license_expiry) < new Date() ? 'var(--red)'
          : (new Date(d.license_expiry) - new Date() < 90 * 86400000 ? 'var(--amber)' : 'var(--green)'))
        : 'var(--text3)';
      const st = _getStatsCached(d.name);
      const assignedVeh = (window.vehs || []).find(v => v.kierowca === d.name);
      return `<tr style="border-bottom:0.5px solid var(--border)">
        <td style="padding:8px 10px;font-weight:500">
          ${d.name}
          ${assignedVeh ? `<div style="font-size:10px;font-family:var(--mono);color:var(--blue)">${assignedVeh.nrRej}</div>` : ''}
        </td>
        <td style="padding:8px 10px;font-family:var(--mono);font-size:11px">${d.phone || '—'}</td>
        <td style="padding:8px 10px;font-family:var(--mono);font-size:11px">${d.license_no || '—'}</td>
        <td style="padding:8px 10px;font-size:11px;color:${expColor}">
          ${d.license_expiry ? new Date(d.license_expiry).toLocaleDateString('pl-PL') : '—'}
        </td>
        <td style="padding:8px 10px;font-size:11px">
          ${st.fuelCost > 0 ? `<span class="stat-chip" style="font-size:10px;padding:2px 6px;margin:1px">${st.fuelCost.toFixed(0)} zł paliwo</span>` : ''}
          ${st.finesCount > 0 ? `<span class="stat-chip stat-chip-amber" style="font-size:10px;padding:2px 6px;margin:1px">${st.finesCount} mandat${st.finesCount > 4 ? 'ów' : st.finesCount > 1 ? 'y' : ''}</span>` : ''}
        </td>
        <td style="padding:8px 10px;text-align:center;white-space:nowrap">
          <button class="btn btn-gray" style="font-size:11px;padding:3px 8px" onclick="TaxOrderDrivers.edit('${d.id}')"><i class="ti ti-edit"></i></button>
          <button class="btn btn-gray" style="font-size:11px;padding:3px 8px;margin-left:4px" onclick="TaxOrderDrivers.remove('${d.id}','${d.name.replace(/'/g,"\\'")}')"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function _getStatsCached(driverName) {
    const vehicles = window.vehs || [];
    let fuelCost = 0, vehiclesUsed = new Set();
    vehicles.forEach(v => {
      const fh = (v.fuelHistory || []).filter(h => (h.driverName || v.kierowca) === driverName);
      fh.forEach(h => { fuelCost += h.totalGross || 0; });
      if (v.kierowca === driverName) vehiclesUsed.add(v.nrRej);
    });
    const fc = _finesCache ? (_finesCache[driverName.toLowerCase()] || { count: 0, amt: 0 }) : { count: 0, amt: 0 };
    return { fuelCost, vehiclesUsed: [...vehiclesUsed], finesCount: fc.count, finesAmt: fc.amt };
  }

  // ── Formularz dodaj/edytuj ────────────────────────────────────────────────
  function edit(id) {
    const d = _drivers.find(x => x.id === id);
    if (!d) return;
    document.getElementById('drv-id').value = d.id;
    document.getElementById('drv-name').value           = d.name           || '';
    document.getElementById('drv-phone').value          = d.phone          || '';
    document.getElementById('drv-email').value          = d.email          || '';
    document.getElementById('drv-licenseNo').value      = d.license_no     || '';
    document.getElementById('drv-licenseExpiry').value  = d.license_expiry || '';
    document.getElementById('drv-notes').value          = d.notes          || '';
    document.getElementById('drivers-form-title').textContent = 'Edytuj kierowcę';
    document.getElementById('drivers-form').style.display = 'block';
  }

  function newDriver() {
    document.getElementById('drv-id').value = '';
    ['drv-name','drv-phone','drv-email','drv-licenseNo','drv-licenseExpiry','drv-notes']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('drivers-form-title').textContent = 'Nowy kierowca';
    document.getElementById('drivers-form').style.display = 'block';
    document.getElementById('drv-name')?.focus();
  }

  async function saveDriver() {
    const g = id => document.getElementById(id)?.value?.trim() || '';
    const name = g('drv-name');
    if (!name) { toast('⚠ Imię i nazwisko jest wymagane'); return; }

    const driverId = g('drv-id');
    const body = {
      name,
      phone:          g('drv-phone')        || null,
      email:          g('drv-email')        || null,
      license_no:     g('drv-licenseNo')    || null,
      license_expiry: g('drv-licenseExpiry')|| null,
      notes:          g('drv-notes')        || null,
    };

    try {
      let r;
      if (driverId) {
        r = await fetch(`${API()}/api/drivers/${driverId}?company=${company()}`, {
          method: 'PUT', headers: hdrs(), body: JSON.stringify(body),
        });
      } else {
        r = await fetch(`${API()}/api/drivers?company=${company()}`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
      }
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast('⚠ ' + (e.error || 'Błąd zapisu: ' + r.status));
        return;
      }
      await load();
      _renderList();
      document.getElementById('drivers-form').style.display = 'none';
      toast(`✓ Kierowca "${name}" zapisany`);
    } catch { toast('⚠ Błąd połączenia'); }
  }

  async function remove(id, name) {
    if (!confirm(`Usunąć kierowcę "${name}"?`)) return;
    try {
      const r = await fetch(`${API()}/api/drivers/${id}?company=${company()}`, {
        method: 'DELETE', headers: hdrs(),
      });
      if (!r.ok) { toast('⚠ Błąd usuwania: ' + r.status); return; }
      await load();
      _renderList();
      toast(`Usunięto kierowcę "${name}"`);
    } catch { toast('⚠ Błąd połączenia'); }
  }

  async function importFromVehicles() {
    if (!_loaded) await load();
    const existing = new Set(_drivers.map(d => d.name.toLowerCase()));
    let added = 0;
    for (const v of (window.vehs || [])) {
      if (!v.kierowca || existing.has(v.kierowca.toLowerCase())) continue;
      try {
        const r = await fetch(`${API()}/api/drivers?company=${company()}`, {
          method: 'POST', headers: hdrs(),
          body: JSON.stringify({ name: v.kierowca }),
        });
        if (r.ok) { added++; existing.add(v.kierowca.toLowerCase()); }
      } catch {}
    }
    if (added) { await load(); _renderList(); toast(`✓ Dodano ${added} kierowców z bazy pojazdów`); }
    else toast('ℹ Wszyscy kierowcy z pojazdów są już na liście');
  }

  async function getStats(driverName) {
    if (!_finesCache) await _loadFinesCache();
    return _getStatsCached(driverName);
  }

  // ── Import masowy z ZSIA ──────────────────────────────────────────────────
  // Przyjmuje tablicę obiektów { name, phone, email, license_no, license_category,
  // license_expiry, _companyId } zwracanych przez zsia-importer._mapDriver().
  // Pomija istniejących (po name, case-insensitive). Zwraca liczbę dodanych.
  async function importBulk(drivers) {
    if (!Array.isArray(drivers) || !drivers.length) return 0;
    if (!_loaded) await load();

    const existing = new Set(_drivers.map(d => d.name.toLowerCase()));
    let added = 0;

    for (const d of drivers) {
      if (!d.name) continue;
      const key = d.name.toLowerCase();
      if (existing.has(key)) continue;

      const co = d._companyId || company();
      const body = {
        name:             d.name,
        phone:            d.phone            || null,
        email:            d.email            || null,
        license_no:       d.license_no       || null,
        license_category: d.license_category || null,
        license_expiry:   d.license_expiry   || null,
      };

      try {
        const r = await fetch(`${API()}/api/drivers?company=${co}`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
        if (r.ok) { added++; existing.add(key); }
      } catch { /* pomiń rekord przy błędzie sieciowym */ }
    }

    if (added) await load();
    return added;
  }

  async function init() {
    await load();
  }

  return { getAll, load, open, close, edit, newDriver, saveDriver, remove, importFromVehicles, importBulk, init, getStats };
})();
