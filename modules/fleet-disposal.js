(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const REASON_LBL = { sale:'Sprzedaż', scrap:'Kasacja', transfer:'Przekazanie', lease_end:'Koniec leasingu', accident_total_loss:'Szkoda całkowita' };
  const STATUS_CLR = { in_progress:'#f59e0b', completed:'#22c55e', cancelled:'#94a3b8' };
  const STATUS_LBL = { in_progress:'W trakcie', completed:'Zakończona', cancelled:'Anulowana' };

  async function api(path, opts={}) {
    const r = await fetch(`${API()}/api/fleet-disposal${path}${path.includes('?')?'&':'?'}company=${encodeURIComponent(Co())}`, { headers: H(), ...opts });
    return r.json();
  }

  function renderFleetDisposal() {
    const el = document.getElementById('page-fleet-disposal');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-car-off"></i> Likwidacja / Sprzedaż Pojazdów</h2>
        <button class="btn btn-primary" onclick="window.FleetDisposal._openModal()"><i class="ti ti-plus"></i> Nowa likwidacja</button>
      </div>
      <div id="disp-stats" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="disp-filter-status" class="form-control" style="width:160px" onchange="window.FleetDisposal._load()">
          <option value="">Wszystkie</option>
          ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <select id="disp-filter-reason" class="form-control" style="width:180px" onchange="window.FleetDisposal._load()">
          <option value="">Wszystkie powody</option>
          ${Object.entries(REASON_LBL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="disp-search" class="form-control" style="width:180px" placeholder="Nr rej. / kupujący..." oninput="window.FleetDisposal._load()">
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Pojazd</th><th>Powód</th><th>Przebieg końc.</th><th>Wartość ksiąg. (PLN)</th><th>Cena sprzed. (PLN)</th><th>Nabywca</th><th>Status</th><th>Akcje</th></tr></thead>
        <tbody id="disp-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="disp-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.FleetDisposal._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header"><h3 id="disp-modal-title">Likwidacja pojazdu</h3><button class="modal-close" onclick="window.FleetDisposal._closeModal()">×</button></div>
          <div class="modal-body" id="disp-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const status = document.getElementById('disp-filter-status')?.value || '';
    const reason = document.getElementById('disp-filter-reason')?.value || '';
    const q      = document.getElementById('disp-search')?.value || '';
    const tbody  = document.getElementById('disp-tbody');
    if (!tbody) return;
    const data = await api(`?status=${status}&reason=${reason}&q=${encodeURIComponent(q)}`);
    const list = data.disposals || [];
    _renderStats(data.stats || {});
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak rekordów likwidacji</td></tr>'; return; }
    tbody.innerHTML = list.map(d => {
      const pnl = d.sale_price_pln!=null && d.book_value_pln!=null ? d.sale_price_pln - d.book_value_pln : null;
      return `<tr>
        <td><strong>${esc(d.vehicle_reg)}</strong></td>
        <td>${esc(REASON_LBL[d.reason]||d.reason)}</td>
        <td style="text-align:right">${d.mileage_final_km!=null?`${esc(String(d.mileage_final_km))} km`:'—'}</td>
        <td style="text-align:right">${d.book_value_pln!=null?`${esc(d.book_value_pln.toFixed(2))} PLN`:'—'}</td>
        <td style="text-align:right">${d.sale_price_pln!=null?`${esc(d.sale_price_pln.toFixed(2))} PLN`:'—'}</td>
        <td>${esc(d.buyer_name||'—')}</td>
        <td><span class="pill" style="background:${STATUS_CLR[d.status]||'#999'}20;color:${STATUS_CLR[d.status]||'#999'}">${esc(STATUS_LBL[d.status]||d.status)}</span>${pnl!=null?`<br><small style="color:${pnl>=0?'#22c55e':'#ef4444'}">${pnl>=0?'+':''}${pnl.toFixed(0)} PLN</small>`:''}</td>
        <td>
          <button class="btn-icon" title="Drukuj protokół" data-id="${esc(d.id)}" onclick="window.FleetDisposal._print(this.dataset.id)"><i class="ti ti-printer"></i></button>
          <button class="btn-icon" data-id="${esc(d.id)}" onclick="window.FleetDisposal._openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" data-id="${esc(d.id)}" onclick="window.FleetDisposal._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function _renderStats(s) {
    const el = document.getElementById('disp-stats');
    if (!el) return;
    el.innerHTML = [
      { lbl:'W trakcie', val: s.in_progress||0, c:'#f59e0b' },
      { lbl:'Zakończone', val: s.completed||0, c:'#22c55e' },
      { lbl:'Łączna sprzedaż', val: s.total_sale ? `${s.total_sale.toFixed(0)} PLN` : '—', c:'#3b82f6' },
      { lbl:'Zysk/Strata', val: s.pnl!=null ? `${(s.pnl>=0?'+':'')+s.pnl.toFixed(0)} PLN` : '—', c: s.pnl>=0?'#22c55e':'#ef4444' },
    ].map(i=>`<div class="stat-chip" style="border-color:${i.c}"><span style="color:${i.c};font-size:1.1em;font-weight:700">${i.val}</span><span>${esc(i.lbl)}</span></div>`).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('disp-modal');
    const body  = document.getElementById('disp-modal-body');
    document.getElementById('disp-modal-title').textContent = id ? 'Edytuj likwidację' : 'Nowa likwidacja/sprzedaż pojazdu';
    let d = {};
    if (id) { const data = await api(`/${id}`); d = data.disposal || {}; }
    body.innerHTML = `<form id="disp-form" data-id="${esc(id||'')}" onsubmit="window.FleetDisposal._save(event,this.dataset.id)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-row"><label>Nr rej. *</label><input name="vehicle_reg" class="form-control" required value="${esc(d.vehicle_reg||'')}"></div>
        <div class="form-row"><label>Powód *</label>
          <select name="reason" class="form-control" required>
            ${Object.entries(REASON_LBL).map(([v,l])=>`<option value="${v}" ${d.reason===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row"><label>Data rozpoczęcia *</label><input name="start_date" type="date" class="form-control" required value="${esc(d.start_date?.slice(0,10)||new Date().toISOString().slice(0,10))}"></div>
        <div class="form-row"><label>Data zakończenia</label><input name="end_date" type="date" class="form-control" value="${esc(d.end_date?.slice(0,10)||'')}"></div>
        <div class="form-row"><label>Końcowy przebieg (km)</label><input name="mileage_final_km" type="number" class="form-control" value="${d.mileage_final_km??''}"></div>
        <div class="form-row"><label>Wartość księgowa (PLN)</label><input name="book_value_pln" type="number" step="0.01" class="form-control" value="${d.book_value_pln??''}"></div>
        <div class="form-row"><label>Cena sprzedaży (PLN)</label><input name="sale_price_pln" type="number" step="0.01" class="form-control" value="${d.sale_price_pln??''}"></div>
        <div class="form-row"><label>Nabywca</label><input name="buyer_name" class="form-control" value="${esc(d.buyer_name||'')}"></div>
        <div class="form-row"><label>NIP nabywcy</label><input name="buyer_nip" class="form-control" maxlength="10" value="${esc(d.buyer_nip||'')}"></div>
        <div class="form-row"><label>Nr dokumentu (faktura)</label><input name="document_number" class="form-control" value="${esc(d.document_number||'')}"></div>
        <div class="form-row"><label>Status</label>
          <select name="status" class="form-control">
            ${Object.entries(STATUS_LBL).map(([v,l])=>`<option value="${v}" ${d.status===v?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label><textarea name="notes" class="form-control" rows="2">${esc(d.notes||'')}</textarea></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.FleetDisposal._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
    </form>`;
    modal.style.display = 'flex';
  }

  async function _save(ev, id) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    await api(id?`/${id}`:'', { method: id?'PUT':'POST', body: JSON.stringify(body) });
    _closeModal(); _load();
  }

  async function _print(id) {
    const data = await api(`/${id}`);
    const d = data.disposal || {};
    const w = window.open('', '_blank');
    w.document.write(`<html><body style="font-family:sans-serif;padding:20px">
      <h2>Protokół Likwidacji/Sprzedaży Pojazdu</h2>
      <p><b>Pojazd:</b> ${esc(d.vehicle_reg)} | <b>Powód:</b> ${esc(REASON_LBL[d.reason]||d.reason)} | <b>Status:</b> ${esc(STATUS_LBL[d.status]||d.status)}</p>
      <p><b>Data likwidacji:</b> ${esc(d.start_date?.slice(0,10)||'—')} | <b>Zakończenie:</b> ${esc(d.end_date?.slice(0,10)||'—')}</p>
      <p><b>Przebieg końcowy:</b> ${d.mileage_final_km??'—'} km</p>
      <p><b>Wartość księgowa:</b> ${d.book_value_pln?.toFixed(2)??'—'} PLN | <b>Cena sprzedaży:</b> ${d.sale_price_pln?.toFixed(2)??'—'} PLN</p>
      <p><b>Nabywca:</b> ${esc(d.buyer_name||'—')} | <b>NIP:</b> ${esc(d.buyer_nip||'—')}</p>
      <p><b>Nr dokumentu:</b> ${esc(d.document_number||'—')}</p>
      ${d.notes?`<p><b>Uwagi:</b> ${esc(d.notes)}</p>`:''}
      <hr><p>Podpis przekazującego: ___________________________ &nbsp; Podpis odbierającego: ___________________________</p>
    </body></html>`);
    w.print();
  }

  async function _delete(id) {
    if (!confirm('Usunąć rekord likwidacji?')) return;
    await api(`/${id}`, { method:'DELETE' });
    _load();
  }

  function _closeModal() { const m=document.getElementById('disp-modal'); if(m) m.style.display='none'; }
  window.FleetDisposal = { renderFleetDisposal, _load, _openModal, _save, _print, _delete, _closeModal };
})();

