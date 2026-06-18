/**
 * TaxOrder Pro — Kartoteka Kierowców
 * Lista kierowców z danymi (prawo jazdy, telefon), autocomplete w pojazdach
 */
window.TaxOrderDrivers = (function () {

  const STORE_KEY = 'taxDrivers';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }

  function _save(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
    _updateDatalist();
    if (window.TaxOrderFleetCloud?.saveDrivers) {
      window.TaxOrderFleetCloud.saveDrivers(list).catch(() => {});
    }
  }

  function _updateDatalist() {
    const dl = document.getElementById('drivers-datalist');
    if (!dl) return;
    const list = getAll();
    dl.innerHTML = list.map(d => `<option value="${d.name}">`).join('');
  }

  function open() {
    _renderList();
    document.getElementById('drivers-modal').style.display = 'flex';
  }

  function close() {
    document.getElementById('drivers-modal').style.display = 'none';
  }

  function _renderList() {
    const list = getAll();
    const el = document.getElementById('drivers-list-body');
    if (!el) return;

    if (!list.length) {
      el.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">
        Brak kierowców. Dodaj pierwszego kierowcę poniżej.
      </td></tr>`;
      return;
    }

    el.innerHTML = list.map((d, i) => {
      const expColor = d.licenseExpiry
        ? (new Date(d.licenseExpiry) < new Date() ? 'var(--red)' :
           (new Date(d.licenseExpiry) - new Date() < 90*86400000 ? 'var(--amber)' : 'var(--green)'))
        : 'var(--text3)';
      const st = getStats(d.name);
      const assignedVeh = (window.vehs||[]).find(v => v.kierowca === d.name);
      return `<tr style="border-bottom:0.5px solid var(--border)">
        <td style="padding:8px 10px;font-weight:500">
          ${d.name}
          ${assignedVeh ? `<div style="font-size:10px;font-family:var(--mono);color:var(--blue)">${assignedVeh.nrRej}</div>` : ''}
        </td>
        <td style="padding:8px 10px;font-family:var(--mono);font-size:11px">${d.phone||'—'}</td>
        <td style="padding:8px 10px;font-family:var(--mono);font-size:11px">${d.licenseNo||'—'}</td>
        <td style="padding:8px 10px;font-size:11px;color:${expColor}">${d.licenseExpiry ? new Date(d.licenseExpiry).toLocaleDateString('pl-PL') : '—'}</td>
        <td style="padding:8px 10px;font-size:11px">
          ${st.fuelCost > 0 ? `<span class="stat-chip" style="font-size:10px;padding:2px 6px;margin:1px">${st.fuelCost.toFixed(0)} zł paliwo</span>` : ''}
          ${st.finesCount > 0 ? `<span class="stat-chip stat-chip-amber" style="font-size:10px;padding:2px 6px;margin:1px">${st.finesCount} mandat</span>` : ''}
        </td>
        <td style="padding:8px 10px;text-align:center">
          <button class="btn btn-gray" style="font-size:11px;padding:3px 8px" onclick="TaxOrderDrivers.edit(${i})"><i class="ti ti-edit"></i></button>
          <button class="btn btn-gray" style="font-size:11px;padding:3px 8px;margin-left:4px" onclick="TaxOrderDrivers.remove(${i})"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function edit(idx) {
    const list = getAll();
    const d = list[idx];
    if (!d) return;
    document.getElementById('drv-id').value = idx;
    document.getElementById('drv-name').value = d.name || '';
    document.getElementById('drv-phone').value = d.phone || '';
    document.getElementById('drv-email').value = d.email || '';
    document.getElementById('drv-licenseNo').value = d.licenseNo || '';
    document.getElementById('drv-licenseExpiry').value = d.licenseExpiry || '';
    document.getElementById('drv-notes').value = d.notes || '';
    document.getElementById('drivers-form-title').textContent = 'Edytuj kierowcę';
    document.getElementById('drivers-form').style.display = 'block';
  }

  function newDriver() {
    document.getElementById('drv-id').value = '';
    ['drv-name','drv-phone','drv-email','drv-licenseNo','drv-licenseExpiry','drv-notes']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    document.getElementById('drivers-form-title').textContent = 'Nowy kierowca';
    document.getElementById('drivers-form').style.display = 'block';
    document.getElementById('drv-name')?.focus();
  }

  function saveDriver() {
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const name = g('drv-name');
    if (!name) { toast('⚠ Imię i nazwisko jest wymagane'); return; }

    const list = getAll();
    const idx = g('drv-id');
    const driver = {
      id: idx !== '' ? list[parseInt(idx)]?.id || Date.now() : Date.now(),
      name,
      phone: g('drv-phone'),
      email: g('drv-email'),
      licenseNo: g('drv-licenseNo'),
      licenseExpiry: g('drv-licenseExpiry'),
      notes: g('drv-notes'),
    };

    if (idx !== '') list[parseInt(idx)] = driver;
    else list.push(driver);

    _save(list);
    _renderList();
    document.getElementById('drivers-form').style.display = 'none';
    toast(`✓ Kierowca "${name}" zapisany`);
  }

  function remove(idx) {
    const list = getAll();
    const name = list[idx]?.name || 'kierowca';
    if (!confirm(`Usunąć kierowcę "${name}"?`)) return;
    list.splice(idx, 1);
    _save(list);
    _renderList();
    toast(`Usunięto kierowcę "${name}"`);
  }

  // Statystyki per kierowca na podstawie fuelHistory i serviceHistory
  function getStats(driverName) {
    const vehicles = window.vehs || [];
    let totalKm = 0, fuelCost = 0, fuelLiters = 0, serviceCost = 0, vehiclesUsed = new Set(), finesCount = 0, finesAmt = 0;

    vehicles.forEach(v => {
      const fh = (v.fuelHistory || []).filter(h => (h.driverName || v.kierowca) === driverName);
      fh.forEach(h => { fuelCost += h.totalGross || 0; fuelLiters += h.liters || 0; if (v.kierowca === driverName) vehiclesUsed.add(v.nrRej); });

      const sh = (v.serviceHistory || []).filter(h => h.driverName === driverName);
      sh.forEach(h => { serviceCost += h.cost || 0; });

      if (v.kierowca === driverName) vehiclesUsed.add(v.nrRej);
    });

    // Mandaty
    try {
      const fines = JSON.parse(localStorage.getItem('taxFines') || '[]');
      fines.filter(f => f.driverName === driverName).forEach(f => { finesCount++; finesAmt += f.amount || 0; });
    } catch {}

    return { fuelCost, fuelLiters, serviceCost, vehiclesUsed: [...vehiclesUsed], finesCount, finesAmt };
  }

  function importFromVehicles() {
    const existing = new Set(getAll().map(d => d.name.toLowerCase()));
    const list = getAll();
    let added = 0;
    (window.vehs || []).forEach(v => {
      if (v.kierowca && !existing.has(v.kierowca.toLowerCase())) {
        list.push({ id: Date.now() + Math.random(), name: v.kierowca, phone: '', email: '', licenseNo: '', licenseExpiry: '', notes: '' });
        existing.add(v.kierowca.toLowerCase());
        added++;
      }
    });
    if (added) { _save(list); _renderList(); toast(`✓ Dodano ${added} kierowców z bazy pojazdów`); }
    else toast('ℹ Wszyscy kierowcy z pojazdów są już na liście');
  }

  // Wywołaj po załadowaniu
  function init() { _updateDatalist(); }

  return { getAll, open, close, edit, newDriver, saveDriver, remove, importFromVehicles, init, getStats };
})();
