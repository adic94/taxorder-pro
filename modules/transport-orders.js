(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtN = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtDT = s => s ? s.replace('T', ' ').slice(0, 16) : '—';

  const STATUS_LBL = { planned: 'Zaplanowane', in_progress: 'W trakcie', completed: 'Zakończone', cancelled: 'Anulowane' };
  const STATUS_CLS = { planned: '', in_progress: 'warn', completed: 'ok', cancelled: 'danger' };
  const PRIO_LBL   = { normal: 'Normalny', urgent: 'Pilny', low: 'Niski' };
  const PRIO_CLS   = { normal: '', urgent: 'danger', low: '' };

  let _orders = [], _stats = null;

  async function renderTransportOrders() {
    const co = Co();
    const status = document.getElementById('to-filter-status')?.value || '';
    const from   = document.getElementById('to-filter-from')?.value || '';
    const to     = document.getElementById('to-filter-to')?.value || '';
    const params = new URLSearchParams({ company: co });
    if (status) params.set('status', status);
    if (from)   params.set('from', from);
    if (to)     params.set('to', to);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API()}/api/transport-orders?${params}`, { headers: H() }),
        fetch(`${API()}/api/transport-orders/stats?company=${encodeURIComponent(co)}`, { headers: H() }),
      ]);
      if (r1.ok) _orders = await r1.json();
      if (r2.ok) _stats  = await r2.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-transport-orders');
    if (!el) return;
    const today = new Date().toISOString().slice(0, 10);

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-truck"></i> Zlecenia transportowe</h2>
  <button class="btn-primary" onclick="window.TransportOrdersModule.openModal()"><i class="ti ti-plus"></i> Nowe zlecenie</button>
</div>
${_stats ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
  <div class="kpi-chip"><i class="ti ti-list"></i><span class="kpi-val">${_stats.total}</span><span class="kpi-lbl">Łącznie</span></div>
  <div class="kpi-chip"><i class="ti ti-clock"></i><span class="kpi-val">${_stats.planned}</span><span class="kpi-lbl">Zaplanowane</span></div>
  <div class="kpi-chip" style="border-color:var(--orange)"><i class="ti ti-truck" style="color:var(--orange)"></i><span class="kpi-val" style="color:var(--orange)">${_stats.in_progress}</span><span class="kpi-lbl">W trakcie</span></div>
  <div class="kpi-chip" style="border-color:var(--green)"><i class="ti ti-check" style="color:var(--green)"></i><span class="kpi-val" style="color:var(--green)">${_stats.completed}</span><span class="kpi-lbl">Zakończone</span></div>
  <div class="kpi-chip"><i class="ti ti-calendar"></i><span class="kpi-val">${_stats.today}</span><span class="kpi-lbl">Dziś</span></div>
</div>` : ''}
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
  <select id="to-filter-status" onchange="window.TransportOrdersModule.renderTransportOrders()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="">Wszystkie statusy</option>
    <option value="planned">Zaplanowane</option>
    <option value="in_progress">W trakcie</option>
    <option value="completed">Zakończone</option>
    <option value="cancelled">Anulowane</option>
  </select>
  <input id="to-filter-from" type="date" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
  <input id="to-filter-to" type="date" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
  <button class="btn-secondary" onclick="window.TransportOrdersModule.renderTransportOrders()">Filtruj</button>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>#</th><th>Tytuł</th><th>Kierowca</th><th>Pojazd</th><th>Skąd → Dokąd</th><th>Start</th><th>Priorytet</th><th>Status</th><th></th></tr></thead>
<tbody>
${_orders.length ? _orders.map((o, i) => `<tr>
  <td>${i + 1}</td>
  <td><strong>${e(o.title)}</strong></td>
  <td>${e(o.driver_name || '—')}</td>
  <td>${e(o.nr_rej || '—')}</td>
  <td>${e(o.origin || '—')}${o.destination ? ' → ' + e(o.destination) : ''}</td>
  <td style="white-space:nowrap">${fmtDT(o.scheduled_start)}</td>
  <td><span class="pill ${e(PRIO_CLS[o.priority] || '')}">${e(PRIO_LBL[o.priority] || esc(o.priority))}</span></td>
  <td>
    <select style="border:none;background:transparent;cursor:pointer;font-size:12px;color:inherit" data-id="${e(o.id)}" onchange="window.TransportOrdersModule.updateStatus(this.dataset.id,this.value)">
      ${['planned','in_progress','completed','cancelled'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${STATUS_LBL[s]}</option>`).join('')}
    </select>
  </td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon" data-id="${e(o.id)}" onclick="window.TransportOrdersModule.openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(o.id)}" onclick="window.TransportOrdersModule.deleteOrder(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="9" class="empty">Brak zleceń</td></tr>'}
</tbody></table></div>`;
  }

  function openModal(id) {
    const o = id ? _orders.find(x => x.id === id) : null;
    const modal = document.getElementById('transport-order-modal');
    if (!modal) return;
    const gi = k => document.getElementById(k);
    gi('tom-id').value          = o?.id || '';
    gi('tom-title').value       = o?.title || '';
    gi('tom-driver').value      = o?.driver_name || '';
    gi('tom-nrrej').value       = o?.nr_rej || '';
    gi('tom-origin').value      = o?.origin || '';
    gi('tom-destination').value = o?.destination || '';
    gi('tom-start').value       = o?.scheduled_start ? o.scheduled_start.slice(0, 16) : '';
    gi('tom-end').value         = o?.scheduled_end   ? o.scheduled_end.slice(0, 16)   : '';
    gi('tom-km').value          = o?.distance_km || '';
    gi('tom-cargo').value       = o?.cargo_desc || '';
    gi('tom-weight').value      = o?.cargo_weight_kg || '';
    gi('tom-priority').value    = o?.priority || 'normal';
    gi('tom-status').value      = o?.status || 'planned';
    gi('tom-notes').value       = o?.notes || '';
    modal.style.display = 'flex';
  }

  function closeModal() {
    const m = document.getElementById('transport-order-modal');
    if (m) m.style.display = 'none';
  }

  async function saveOrder() {
    const gi = k => document.getElementById(k);
    if (!gi('tom-title').value || !gi('tom-start').value) { alert('Wypełnij: tytuł, data startu'); return; }
    const id = gi('tom-id').value;
    const body = {
      title: gi('tom-title').value, driver_name: gi('tom-driver').value || null,
      nr_rej: gi('tom-nrrej').value || null, origin: gi('tom-origin').value || null,
      destination: gi('tom-destination').value || null, scheduled_start: gi('tom-start').value || null,
      scheduled_end: gi('tom-end').value || null, distance_km: parseFloat(gi('tom-km').value) || null,
      cargo_desc: gi('tom-cargo').value || null, cargo_weight_kg: parseFloat(gi('tom-weight').value) || null,
      priority: gi('tom-priority').value, status: gi('tom-status').value, notes: gi('tom-notes').value || null,
    };
    const url = id
      ? `${API()}/api/transport-orders/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/transport-orders?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeModal(); await renderTransportOrders();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  async function updateStatus(id, status) {
    try {
      await fetch(`${API()}/api/transport-orders/${encodeURIComponent(id)}/status?company=${encodeURIComponent(Co())}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      await renderTransportOrders();
    } catch {}
  }

  async function deleteOrder(id) {
    if (!confirm('Usunąć zlecenie?')) return;
    try {
      await fetch(`${API()}/api/transport-orders/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderTransportOrders();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  window.TransportOrdersModule = { renderTransportOrders, openModal, closeModal, saveOrder, updateStatus, deleteOrder };
})();
