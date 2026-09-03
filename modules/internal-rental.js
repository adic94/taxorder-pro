(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';

  const STATUS_CLR   = { active: '#3b82f6', returned: '#22c55e', invoiced: '#8b5cf6' };
  const STATUS_LABEL = { active: 'Aktywny', returned: 'Zwrócony', invoiced: 'Zafakturowany' };

  async function api(path, opts = {}) {
    const r = await fetch(`${API()}/api/internal-rentals${path}${path.includes('?')?'&':'?'}company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderInternalRental() {
    const el = document.getElementById('page-internal-rental');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-building-warehouse"></i> Wynajem Wewnętrzny</h2>
        <button class="btn btn-primary" onclick="window.InternalRental._openModal()"><i class="ti ti-plus"></i> Nowy wynajem</button>
      </div>
      <p style="color:var(--text-muted);margin-bottom:12px">Refakturowanie kosztów użytkowania pojazdów przez działy wewnętrzne firmy.</p>
      <div id="irent-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="irent-filter-status" class="form-control" style="width:160px" onchange="window.InternalRental._load()">
          <option value="">Wszystkie statusy</option>
          <option value="active">Aktywne</option>
          <option value="returned">Zwrócone</option>
          <option value="invoiced">Zafakturowane</option>
        </select>
        <input id="irent-search" class="form-control" style="width:200px" placeholder="Pojazd / dział..." oninput="window.InternalRental._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Pojazd</th><th>Dział</th><th>Osoba</th><th>Okres</th><th>Dystans (km)</th><th>Koszt (PLN)</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="irent-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="irent-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.InternalRental._closeModal()">
        <div class="modal-box" style="max-width:580px">
          <div class="modal-header"><h3 id="irent-modal-title">Wynajem wewnętrzny</h3><button class="modal-close" onclick="window.InternalRental._closeModal()">×</button></div>
          <div class="modal-body" id="irent-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const status = document.getElementById('irent-filter-status')?.value || '';
    const q      = document.getElementById('irent-search')?.value || '';
    const tbody  = document.getElementById('irent-tbody');
    if (!tbody) return;
    const data = await api(`?status=${status}&q=${encodeURIComponent(q)}`);
    const list = data.rentals || [];
    _renderStats(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak wynajmów wewnętrznych</td></tr>'; return; }
    tbody.innerHTML = list.map(r => `
      <tr>
        <td><strong>${esc(r.vehicle_reg || '—')}</strong></td>
        <td>${esc(r.renter_department || '—')}</td>
        <td>${esc(r.renter_person || '—')}</td>
        <td style="font-size:.85em">${esc(r.start_datetime?.slice(0,16)||'?')} – ${r.end_datetime ? esc(r.end_datetime.slice(0,16)) : '⏳'}</td>
        <td style="text-align:right">${r.distance_km != null ? esc(r.distance_km.toFixed(1)) : '—'}</td>
        <td style="text-align:right">${r.total_cost_pln != null ? `${esc(r.total_cost_pln.toFixed(2))  } PLN` : '—'}</td>
        <td><span class="pill" style="background:${STATUS_CLR[r.status]||'#999'}20;color:${STATUS_CLR[r.status]||'#999'}">${esc(STATUS_LABEL[r.status]||r.status)}</span></td>
        <td>
          ${r.status === 'active' ? `<button class="btn-icon" title="Zwróć pojazd" data-id="${esc(r.id)}" onclick="window.InternalRental._return(this.dataset.id)"><i class="ti ti-check"></i></button>` : ''}
          <button class="btn-icon" title="Edytuj" data-id="${esc(r.id)}" onclick="window.InternalRental._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon" title="Drukuj" data-id="${esc(r.id)}" onclick="window.InternalRental._print(this.dataset.id)"><i class="ti ti-printer"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(r.id)}" onclick="window.InternalRental._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('irent-stats');
    if (!el) return;
    el.innerHTML = [
      { lbl: 'Aktywne', val: s.active || 0, c: '#3b82f6' },
      { lbl: 'Zwrócone', val: s.returned || 0, c: '#22c55e' },
      { lbl: 'Koszt łącznie', val: s.total_cost ? `${s.total_cost.toFixed(2)  } PLN` : '—', c: '#8b5cf6' },
    ].map(i => `<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.2em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('irent-modal');
    const body  = document.getElementById('irent-modal-body');
    const title = document.getElementById('irent-modal-title');
    let r = {};
    if (id) { const d = await api(`/${id}`); r = d.rental || {}; }
    title.textContent = id ? 'Edytuj wynajem wewnętrzny' : 'Nowy wynajem wewnętrzny';
    body.innerHTML = `
      <form id="irent-form" data-id="${esc(id||'')}" onsubmit="window.InternalRental._save(event,this.dataset.id)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Nr rejestracyjny</label><input name="vehicle_reg" class="form-control" value="${esc(r.vehicle_reg||'')}"></div>
          <div class="form-row"><label>Dział *</label><input name="renter_department" class="form-control" required value="${esc(r.renter_department||'')}"></div>
          <div class="form-row"><label>Osoba pobierająca</label><input name="renter_person" class="form-control" value="${esc(r.renter_person||'')}"></div>
          <div class="form-row"><label>Cel</label><input name="purpose" class="form-control" value="${esc(r.purpose||'')}"></div>
          <div class="form-row"><label>Data/czas wydania *</label><input name="start_datetime" type="datetime-local" class="form-control" required value="${esc(r.start_datetime?.slice(0,16)||'')}"></div>
          <div class="form-row"><label>Data/czas zwrotu</label><input name="end_datetime" type="datetime-local" class="form-control" value="${esc(r.end_datetime?.slice(0,16)||'')}"></div>
          <div class="form-row"><label>Licznik wydania (km)</label><input name="mileage_start" type="number" class="form-control" value="${r.mileage_start??''}"></div>
          <div class="form-row"><label>Licznik zwrotu (km)</label><input name="mileage_end" type="number" class="form-control" value="${r.mileage_end??''}"></div>
          <div class="form-row"><label>Stawka za km (PLN)</label><input name="cost_rate_pln_per_km" type="number" step="0.001" class="form-control" value="${r.cost_rate_pln_per_km??0.89}"></div>
          <div class="form-row"><label>Stawka za dobę (PLN)</label><input name="cost_rate_pln_per_day" type="number" step="0.01" class="form-control" value="${r.cost_rate_pln_per_day??0}"></div>
          <div class="form-row"><label>Koszt łączny (PLN)</label><input name="total_cost_pln" type="number" step="0.01" class="form-control" value="${r.total_cost_pln??''}"></div>
          <div class="form-row"><label>Status</label>
            <select name="status" class="form-control">
              ${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}" ${r.status===v?'selected':''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Nr faktury wewnętrznej</label><input name="invoice_number" class="form-control" value="${esc(r.invoice_number||'')}"></div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(r.notes||'')}</textarea></div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.InternalRental._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    await api(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _return(id) {
    const now = new Date().toISOString().slice(0, 16);
    const km  = prompt('Podaj stan licznika przy zwrocie (km):');
    if (km === null) return;
    await api(`/${id}/return`, { method: 'POST', body: JSON.stringify({ end_datetime: now, mileage_end: parseInt(km) || null }) });
    _load();
  }

  async function _print(id) {
    const d = await api(`/${id}`);
    const r = d.rental || {};
    const w = window.open('', '_blank');
    w.document.write(`<html><body style="font-family:sans-serif;padding:20px">
      <h2>Protokół Wynajmu Wewnętrznego</h2>
      <p><b>Pojazd:</b> ${esc(r.vehicle_reg||'—')} | <b>Dział:</b> ${esc(r.renter_department||'—')} | <b>Osoba:</b> ${esc(r.renter_person||'—')}</p>
      <p><b>Wydano:</b> ${esc(r.start_datetime?.slice(0,16)||'—')} | <b>Zwrócono:</b> ${esc(r.end_datetime?.slice(0,16)||'—')}</p>
      <p><b>Przebieg:</b> ${r.mileage_start??'—'} → ${r.mileage_end??'—'} km (dystans: ${r.distance_km?.toFixed(1)??'—'} km)</p>
      <p><b>Cel:</b> ${esc(r.purpose||'—')}</p>
      <p><b>Koszt łączny:</b> ${r.total_cost_pln?.toFixed(2)??'—'} PLN</p>
      ${r.notes ? `<p><b>Uwagi:</b> ${esc(r.notes)}</p>` : ''}
      <hr><p>Podpis wydającego: _________________________ &nbsp;&nbsp; Podpis odbierającego: _________________________</p>
    </body></html>`);
    w.print();
  }

  async function _delete(id) {
    if (!confirm('Usunąć wynajem wewnętrzny?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('irent-modal');
    if (m) m.style.display = 'none';
  }

  window.InternalRental = { renderInternalRental, _load, _openModal, _save, _return, _print, _delete, _closeModal };
})();

