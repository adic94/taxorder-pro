(function () {
  'use strict';

  const API = () => window._cfApi ? window._cfApi() : window.WORKER_URL;
  const H   = () => window._cfHdrs ? window._cfHdrs() : {};
  const Co  = () => window._cfCo   ? window._cfCo()   : '';
  const e   = (s) => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = (v, dec=2) => v != null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:dec,maximumFractionDigits:dec}) : '—';
  const fmtD = (d) => d ? d.slice(0,10) : '—';

  let _fills = [];
  let _currentNrRej = '';

  // ── Rendery strony ──────────────────────────────────────────────────────────
  async function renderFuelDb(nrRej) {
    _currentNrRej = nrRej || '';
    const co = Co();
    const url = `${API()}/api/fuel-fills?company=${encodeURIComponent(co)}${nrRej ? '&nr_rej='+encodeURIComponent(nrRej) : ''}`;
    let data = [];
    try {
      const r = await fetch(url, { headers: H() });
      if (r.ok) data = await r.json();
    } catch {}
    _fills = Array.isArray(data) ? data : [];

    const el = document.getElementById('page-fuel-db');
    if (!el) return;

    // Statystyki
    let statsHtml = '';
    if (nrRej) {
      try {
        const sr = await fetch(`${API()}/api/fuel-fills/stats?company=${encodeURIComponent(co)}&nr_rej=${encodeURIComponent(nrRej)}`, { headers: H() });
        if (sr.ok) {
          const s = await sr.json();
          statsHtml = `
<div class="kpi-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
  ${kpi('Łączne koszty',fmtN(s.total_cost)+' PLN','ti-cash')}
  ${kpi('Litry łącznie',fmtN(s.total_liters,1)+' l','ti-droplet')}
  ${kpi('Śr. spalanie',s.avg_consumption ? fmtN(s.avg_consumption,1)+' l/100km' : '—','ti-gauge')}
  ${kpi('Tankowania',s.fill_count||0,'ti-list')}
</div>`;
        }
      } catch {}
    }

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-droplet"></i> Ewidencja paliwa${nrRej ? ' — '+e(nrRej) : ''}</h2>
  <button class="btn-primary" onclick="window.FuelDbModule.openFuelModal()"><i class="ti ti-plus"></i> Dodaj tankowanie</button>
</div>
${statsHtml}
<div class="table-wrap">
<table class="data-table">
<thead><tr>
  <th>Data</th><th>Nr rej.</th><th>Kierowca</th><th>Litry</th><th>Cena/l</th><th>Koszt</th><th>Stan km</th><th>Stacja</th><th>Paliwo</th><th></th>
</tr></thead>
<tbody>
${_fills.length ? _fills.map(f => `<tr>
  <td>${fmtD(f.fill_date)}</td>
  <td>${e(f.nr_rej)}</td>
  <td>${e(f.driver_name||'—')}</td>
  <td>${fmtN(f.liters,1)}</td>
  <td>${f.price_per_liter ? fmtN(f.price_per_liter,3) : '—'}</td>
  <td>${f.total_cost ? fmtN(f.total_cost)+' PLN' : '—'}</td>
  <td>${f.odometer ? fmtN(f.odometer,0) : '—'}</td>
  <td>${e(f.station||'—')}</td>
  <td>${e(f.fuel_type||'diesel')}</td>
  <td>
    <button class="btn-icon" data-id="${e(f.id)}" onclick="window.FuelDbModule.editFuel(this.dataset.id)" title="Edytuj"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(f.id)}" onclick="window.FuelDbModule.deleteFuel(this.dataset.id)" title="Usuń"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="10" class="empty">Brak zapisów</td></tr>'}
</tbody>
</table>
</div>`;
  }

  function kpi(lbl, val, icon) {
    return `<div class="kpi-chip"><i class="ti ${e(icon)}"></i><span class="kpi-val">${val}</span><span class="kpi-lbl">${e(lbl)}</span></div>`;
  }

  // ── Modal ───────────────────────────────────────────────────────────────────
  function openFuelModal(id) {
    const fill = id ? _fills.find(f => f.id === id) : null;
    const modal = document.getElementById('fuel-modal');
    if (!modal) return;
    document.getElementById('fm-id').value       = fill?.id || '';
    document.getElementById('fm-nr-rej').value   = fill?.nr_rej || _currentNrRej || '';
    document.getElementById('fm-date').value      = fill?.fill_date || new Date().toISOString().slice(0,10);
    document.getElementById('fm-driver').value    = fill?.driver_name || '';
    document.getElementById('fm-liters').value    = fill?.liters || '';
    document.getElementById('fm-ppl').value       = fill?.price_per_liter || '';
    document.getElementById('fm-cost').value      = fill?.total_cost || '';
    document.getElementById('fm-odo').value       = fill?.odometer || '';
    document.getElementById('fm-station').value   = fill?.station || '';
    document.getElementById('fm-card').value      = fill?.card_no || '';
    document.getElementById('fm-ftype').value     = fill?.fuel_type || 'diesel';
    document.getElementById('fm-full').checked    = fill ? !!fill.full_tank : true;
    document.getElementById('fm-notes').value     = fill?.notes || '';
    modal.style.display = 'flex';
  }

  function closeFuelModal() {
    const modal = document.getElementById('fuel-modal');
    if (modal) modal.style.display = 'none';
  }

  async function saveFuel() {
    const id       = document.getElementById('fm-id').value;
    const liters   = parseFloat(document.getElementById('fm-liters').value);
    if (!liters) { alert('Wpisz ilość litrów'); return; }
    const ppl      = parseFloat(document.getElementById('fm-ppl').value) || null;
    const body = {
      nr_rej:         document.getElementById('fm-nr-rej').value,
      fill_date:      document.getElementById('fm-date').value,
      driver_name:    document.getElementById('fm-driver').value || null,
      liters,
      price_per_liter: ppl,
      total_cost:     parseFloat(document.getElementById('fm-cost').value) || (ppl ? parseFloat((liters*ppl).toFixed(2)) : null),
      odometer:       parseInt(document.getElementById('fm-odo').value) || null,
      station:        document.getElementById('fm-station').value || null,
      card_no:        document.getElementById('fm-card').value || null,
      fuel_type:      document.getElementById('fm-ftype').value || 'diesel',
      full_tank:      document.getElementById('fm-full').checked ? 1 : 0,
      notes:          document.getElementById('fm-notes').value || null,
    };
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `${API()}/api/fuel-fills/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}` : `${API()}/api/fuel-fills?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers: { ...H(), 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeFuelModal();
      await renderFuelDb(_currentNrRej);
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  async function editFuel(id) { openFuelModal(id); }

  async function deleteFuel(id) {
    if (!confirm('Usunąć to tankowanie?')) return;
    try {
      await fetch(`${API()}/api/fuel-fills/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers: H() });
      await renderFuelDb(_currentNrRej);
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  // ── Autocalc cena ───────────────────────────────────────────────────────────
  function autoCalcCost() {
    const l = parseFloat(document.getElementById('fm-liters')?.value);
    const p = parseFloat(document.getElementById('fm-ppl')?.value);
    const costEl = document.getElementById('fm-cost');
    if (l && p && costEl && !costEl.value) costEl.value = (l*p).toFixed(2);
  }

  window.FuelDbModule = { renderFuelDb, openFuelModal, closeFuelModal, saveFuel, editFuel, deleteFuel, autoCalcCost };
})();
