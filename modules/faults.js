(function () {
  'use strict';

  const API = () => window._cfApi ? window._cfApi() : window.WORKER_URL;
  const H   = () => window._cfHdrs ? window._cfHdrs() : {};
  const Co  = () => window._cfCo   ? window._cfCo()   : '';
  const e   = (s) => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const SEV = { low: 'Niskie', medium: 'Średnie', high: 'Wysokie', critical: 'Krytyczne' };
  const SEV_CLS = { low:'', medium:'warn', high:'danger', critical:'danger' };
  const STATUS = { open: 'Otwarte', in_progress: 'W toku', resolved: 'Rozwiązane' };

  let _faults = [];
  let _filterNrRej = '';
  let _filterStatus = '';

  async function renderFaults(nrRej) {
    _filterNrRej = nrRej || _filterNrRej;
    const co = Co();
    const params = new URLSearchParams({ company: co });
    if (_filterNrRej) params.set('nr_rej', _filterNrRej);
    const fStatus = document.getElementById('fault-f-status')?.value || '';
    if (fStatus) params.set('status', fStatus);
    try {
      const r = await fetch(`${API()}/api/faults?${params}`, { headers: H() });
      if (r.ok) _faults = await r.json();
    } catch {}

    const el = document.getElementById('page-faults');
    if (!el) return;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-alert-triangle"></i> Dziennik usterek</h2>
  <button class="btn-primary" onclick="window.FaultsModule.openFaultModal()"><i class="ti ti-plus"></i> Zgłoś usterkę</button>
</div>
<div class="filter-row" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
  <select id="fault-f-status" onchange="window.FaultsModule.renderFaults()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="">Wszystkie statusy</option>
    <option value="open">Otwarte</option>
    <option value="in_progress">W toku</option>
    <option value="resolved">Rozwiązane</option>
  </select>
</div>
<div class="table-wrap">
<table class="data-table">
<thead><tr>
  <th>Data</th><th>Nr rej.</th><th>Zgłaszający</th><th>Opis</th><th>Ważność</th><th>Status</th><th>Rozwiązano</th><th></th>
</tr></thead>
<tbody>
${_faults.length ? _faults.map(f => `<tr class="${e(SEV_CLS[f.severity]||'')}">
  <td>${e(f.report_date||'—')}</td>
  <td>${e(f.nr_rej)}</td>
  <td>${e(f.reported_by||'—')}</td>
  <td>${e(f.description)}</td>
  <td><span class="pill ${e(SEV_CLS[f.severity]||'')}">${e(SEV[f.severity]||f.severity)}</span></td>
  <td><span class="pill">${e(STATUS[f.status]||f.status)}</span></td>
  <td>${f.resolved_at ? e(f.resolved_at.slice(0,10)) : '—'}</td>
  <td>
    <button class="btn-icon" data-id="${e(f.id)}" onclick="window.FaultsModule.editFault(this.dataset.id)" title="Edytuj"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(f.id)}" onclick="window.FaultsModule.deleteFault(this.dataset.id)" title="Usuń"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="8" class="empty">Brak usterek</td></tr>'}
</tbody>
</table>
</div>`;
    // Przywróć wartość filtra statusu
    const sel = document.getElementById('fault-f-status');
    if (sel && fStatus) sel.value = fStatus;
  }

  function openFaultModal(id) {
    const f = id ? _faults.find(x => x.id === id) : null;
    const modal = document.getElementById('fault-modal');
    if (!modal) return;
    document.getElementById('flt-id').value          = f?.id || '';
    document.getElementById('flt-nr-rej').value      = f?.nr_rej || _filterNrRej || '';
    document.getElementById('flt-date').value         = f?.report_date || new Date().toISOString().slice(0,10);
    document.getElementById('flt-reported-by').value = f?.reported_by || '';
    document.getElementById('flt-description').value = f?.description || '';
    document.getElementById('flt-severity').value    = f?.severity || 'low';
    document.getElementById('flt-status').value      = f?.status || 'open';
    document.getElementById('flt-resolved-by').value = f?.resolved_by || '';
    document.getElementById('flt-svc-order').value   = f?.service_order_id || '';
    modal.style.display = 'flex';
  }

  function closeFaultModal() {
    const modal = document.getElementById('fault-modal');
    if (modal) modal.style.display = 'none';
  }

  async function saveFault() {
    const id = document.getElementById('flt-id').value;
    const desc = document.getElementById('flt-description').value.trim();
    if (!desc) { alert('Wpisz opis usterki'); return; }
    const body = {
      nr_rej:           document.getElementById('flt-nr-rej').value,
      report_date:      document.getElementById('flt-date').value,
      reported_by:      document.getElementById('flt-reported-by').value || null,
      description:      desc,
      severity:         document.getElementById('flt-severity').value,
      status:           document.getElementById('flt-status').value,
      resolved_by:      document.getElementById('flt-resolved-by').value || null,
      service_order_id: document.getElementById('flt-svc-order').value || null,
    };
    const method = id ? 'PUT' : 'POST';
    const url    = id
      ? `${API()}/api/faults/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/faults?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers: { ...H(), 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeFaultModal();
      await renderFaults();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  function editFault(id) { openFaultModal(id); }

  async function deleteFault(id) {
    if (!confirm('Usunąć tę usterkę?')) return;
    try {
      await fetch(`${API()}/api/faults/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers: H() });
      await renderFaults();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  window.FaultsModule = { renderFaults, openFaultModal, closeFaultModal, saveFault, editFault, deleteFault };
})();
