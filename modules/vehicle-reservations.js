(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc==='function' ? esc(s) : String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const STATUS_LABEL = { pending:'Oczekuje', approved:'Zatwierdzona', rejected:'Odrzucona', completed:'Zakończona', cancelled:'Anulowana' };
  const STATUS_CLS   = { pending:'warn', approved:'ok', rejected:'danger', completed:'', cancelled:'' };

  let _reservations = [];

  async function renderReservations() {
    const co = Co();
    const status = document.getElementById('vr-filter-status')?.value || '';
    const params = new URLSearchParams({ company: co });
    if (status) params.set('status', status);
    try {
      const r = await fetch(`${API()}/api/vehicle-reservations?${params}`, { headers: H() });
      if (r.ok) _reservations = await r.json();
    } catch {}

    const el = document.getElementById('page-reservations');
    if (!el) return;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-calendar-event"></i> Rezerwacje pojazdów</h2>
  <button class="btn-primary" onclick="window.ReservationsModule.openModal()"><i class="ti ti-plus"></i> Nowa rezerwacja</button>
</div>
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
  <select id="vr-filter-status" onchange="window.ReservationsModule.renderReservations()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="">Wszystkie</option>
    <option value="pending">Oczekujące</option>
    <option value="approved">Zatwierdzone</option>
    <option value="rejected">Odrzucone</option>
    <option value="completed">Zakończone</option>
  </select>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Pojazd</th><th>Kierowca</th><th>Od</th><th>Do</th><th>Cel</th><th>Destynacja</th><th>Km plan</th><th>Status</th><th>Zatwierdził</th><th></th></tr></thead>
<tbody>
${_reservations.length ? _reservations.map(r=>`<tr>
  <td>${e(r.nr_rej)}</td>
  <td>${e(r.driver_name)}</td>
  <td>${e(r.date_from)}</td>
  <td>${e(r.date_to)}</td>
  <td>${e(r.purpose||'—')}</td>
  <td>${e(r.destination||'—')}</td>
  <td>${r.expected_km||'—'}</td>
  <td><span class="pill ${e(STATUS_CLS[r.status]||'')}">${e(STATUS_LABEL[r.status]||r.status)}</span></td>
  <td>${e(r.approved_by||'—')}</td>
  <td style="display:flex;gap:4px;flex-wrap:wrap">
    ${r.status==='pending' ? `
      <button class="btn-icon ok" data-id="${e(r.id)}" onclick="window.ReservationsModule.approve(this.dataset.id)" title="Zatwierdź"><i class="ti ti-check"></i></button>
      <button class="btn-icon danger" data-id="${e(r.id)}" onclick="window.ReservationsModule.reject(this.dataset.id)" title="Odrzuć"><i class="ti ti-x"></i></button>` : ''}
    ${r.status==='approved' ? `<button class="btn-icon" data-id="${e(r.id)}" onclick="window.ReservationsModule.complete(this.dataset.id)" title="Zakończ"><i class="ti ti-flag-check"></i></button>` : ''}
    <button class="btn-icon danger" data-id="${e(r.id)}" onclick="window.ReservationsModule.deleteRes(this.dataset.id)" title="Usuń"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="10" class="empty">Brak rezerwacji</td></tr>'}
</tbody></table></div>`;
    if (status) { const s = document.getElementById('vr-filter-status'); if (s) s.value = status; }
  }

  function openModal(id) {
    const res = id ? _reservations.find(x=>x.id===id) : null;
    const modal = document.getElementById('reservation-modal');
    if (!modal) return;
    const gi = id => document.getElementById(id);
    gi('rm-id').value          = res?.id||'';
    gi('rm-nr-rej').value      = res?.nr_rej||'';
    gi('rm-driver').value      = res?.driver_name||'';
    gi('rm-from').value        = res?.date_from||new Date().toISOString().slice(0,10);
    gi('rm-to').value          = res?.date_to||new Date().toISOString().slice(0,10);
    gi('rm-purpose').value     = res?.purpose||'';
    gi('rm-dest').value        = res?.destination||'';
    gi('rm-km').value          = res?.expected_km||'';
    gi('rm-notes').value       = res?.notes||'';
    modal.style.display = 'flex';
  }

  function closeModal() { const m = document.getElementById('reservation-modal'); if (m) m.style.display='none'; }

  async function saveReservation() {
    const gi = id => document.getElementById(id);
    const id   = gi('rm-id').value;
    const nr_rej = gi('rm-nr-rej').value.trim();
    const driver = gi('rm-driver').value.trim();
    const from   = gi('rm-from').value;
    const to     = gi('rm-to').value;
    if (!nr_rej||!driver||!from||!to) { alert('Wypełnij: pojazd, kierowca, daty'); return; }
    const body = { nr_rej, driver_name:driver, date_from:from, date_to:to,
      purpose:gi('rm-purpose').value||null, destination:gi('rm-dest').value||null,
      expected_km:parseInt(gi('rm-km').value)||null, notes:gi('rm-notes').value||null };
    const method = id ? 'PUT' : 'POST';
    const url = id
      ? `${API()}/api/vehicle-reservations/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/vehicle-reservations?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      const res = await r.json();
      closeModal();
      if (res.status === 'pending') alert('Rezerwacja złożona — czeka na zatwierdzenie managera.');
      await renderReservations();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  async function approve(id) {
    if (!confirm('Zatwierdzić rezerwację?')) return;
    try {
      await fetch(`${API()}/api/vehicle-reservations/${encodeURIComponent(id)}/approve?company=${encodeURIComponent(Co())}`, { method:'PUT', headers:H() });
      await renderReservations();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  async function reject(id) {
    const reason = prompt('Powód odrzucenia (opcjonalnie):') ?? '';
    try {
      await fetch(`${API()}/api/vehicle-reservations/${encodeURIComponent(id)}/reject?company=${encodeURIComponent(Co())}`, {
        method:'PUT', headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify({ reason })
      });
      await renderReservations();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  async function complete(id) {
    const km = prompt('Rzeczywisty przebieg (km) — zostaw puste jeśli nieznany:');
    try {
      await fetch(`${API()}/api/vehicle-reservations/${encodeURIComponent(id)}/complete?company=${encodeURIComponent(Co())}`, {
        method:'PUT', headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify({ actual_km: km ? parseInt(km) : null })
      });
      await renderReservations();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  async function deleteRes(id) {
    if (!confirm('Usunąć rezerwację?')) return;
    try {
      await fetch(`${API()}/api/vehicle-reservations/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers:H() });
      await renderReservations();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  window.ReservationsModule = { renderReservations, openModal, closeModal, saveReservation, approve, reject, complete, deleteRes };
})();
