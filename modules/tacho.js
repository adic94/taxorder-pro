(function () {
  'use strict';

  const API = () => window._cfApi ? window._cfApi() : window.WORKER_URL;
  const H   = () => window._cfHdrs ? window._cfHdrs() : {};
  const Co  = () => window._cfCo   ? window._cfCo()   : '';
  const e   = (s) => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  let _records = [];
  let _filterNrRej = '';

  async function renderTacho(nrRej) {
    _filterNrRej = nrRej || _filterNrRej;
    const co = Co();
    const params = new URLSearchParams({ company: co });
    if (_filterNrRej) params.set('nr_rej', _filterNrRej);
    try {
      const r = await fetch(`${API()}/api/tacho-records?${params}`, { headers: H() });
      if (r.ok) _records = await r.json();
    } catch {}

    // Pobierz pojazdy z przeterminowanym pobraniem
    let overdueHtml = '';
    try {
      const or = await fetch(`${API()}/api/tacho-records/overdue?company=${encodeURIComponent(co)}`, { headers: H() });
      if (or.ok) {
        const overdue = await or.json();
        if (overdue.length) {
          overdueHtml = `<div class="alert alert-warn" style="margin-bottom:12px">
<strong><i class="ti ti-alert-triangle"></i> Przeterminowane pobieranie tachografu:</strong>
<ul style="margin:4px 0 0 16px">${overdue.map(o => `<li>${e(o.nr_rej)} — ostatnie pobranie: ${e(o.last_download||'nigdy')} (${e(String(o.days_since))} dni temu)</li>`).join('')}</ul>
</div>`;
        }
      }
    } catch {}

    const el = document.getElementById('page-tacho');
    if (!el) return;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-device-desktop"></i> Archiwum tachografu</h2>
  <button class="btn-primary" onclick="window.TachoModule.openTachoModal()"><i class="ti ti-plus"></i> Dodaj pobranie</button>
</div>
${overdueHtml}
<div class="table-wrap">
<table class="data-table">
<thead><tr><th>Data pobrania</th><th>Nr rej.</th><th>Kierowca</th><th>Okres od</th><th>Okres do</th><th>Plik</th><th>Uwagi</th><th></th></tr></thead>
<tbody>
${_records.length ? _records.map(r => `<tr>
  <td>${e(r.download_date)}</td>
  <td>${e(r.nr_rej)}</td>
  <td>${e(r.driver_name||'—')}</td>
  <td>${e(r.period_from||'—')}</td>
  <td>${e(r.period_to||'—')}</td>
  <td>${e(r.file_name||'—')}</td>
  <td>${e(r.notes||'—')}</td>
  <td>
    <button class="btn-icon" data-id="${e(r.id)}" onclick="window.TachoModule.editTacho(this.dataset.id)" title="Edytuj"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(r.id)}" onclick="window.TachoModule.deleteTacho(this.dataset.id)" title="Usuń"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="8" class="empty">Brak zapisów tachografu</td></tr>'}
</tbody>
</table>
</div>`;
  }

  function openTachoModal(id) {
    const rec = id ? _records.find(x => x.id === id) : null;
    const modal = document.getElementById('tacho-modal');
    if (!modal) return;
    document.getElementById('tm-id').value          = rec?.id || '';
    document.getElementById('tm-nr-rej').value      = rec?.nr_rej || _filterNrRej || '';
    document.getElementById('tm-driver').value      = rec?.driver_name || '';
    document.getElementById('tm-download').value    = rec?.download_date || new Date().toISOString().slice(0,10);
    document.getElementById('tm-from').value        = rec?.period_from || '';
    document.getElementById('tm-to').value          = rec?.period_to || '';
    document.getElementById('tm-file').value        = rec?.file_name || '';
    document.getElementById('tm-notes').value       = rec?.notes || '';
    modal.style.display = 'flex';
  }

  function closeTachoModal() {
    const modal = document.getElementById('tacho-modal');
    if (modal) modal.style.display = 'none';
  }

  async function saveTacho() {
    const id = document.getElementById('tm-id').value;
    const nrRej = document.getElementById('tm-nr-rej').value.trim();
    if (!nrRej) { alert('Wpisz nr rej.'); return; }
    const body = {
      nr_rej:        nrRej,
      driver_name:   document.getElementById('tm-driver').value || null,
      download_date: document.getElementById('tm-download').value,
      period_from:   document.getElementById('tm-from').value || null,
      period_to:     document.getElementById('tm-to').value || null,
      file_name:     document.getElementById('tm-file').value || null,
      notes:         document.getElementById('tm-notes').value || null,
    };
    const method = id ? 'PUT' : 'POST';
    const url    = id
      ? `${API()}/api/tacho-records/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/tacho-records?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers: { ...H(), 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeTachoModal();
      await renderTacho();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  function editTacho(id) { openTachoModal(id); }

  async function deleteTacho(id) {
    if (!confirm('Usunąć ten zapis tachografu?')) return;
    try {
      await fetch(`${API()}/api/tacho-records/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers: H() });
      await renderTacho();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  window.TachoModule = { renderTacho, openTachoModal, closeTachoModal, saveTacho, editTacho, deleteTacho };
})();
