(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc==='function' ? esc(s) : String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = v => v!=null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

  const TYPE_LABEL = { fuel:'Paliwo', service:'Serwis', parts:'Części', insurance:'Ubezpieczenie', other:'Inne' };
  const STATUS_CLS = { pending:'warn', approved:'', paid:'ok', rejected:'danger' };
  const STATUS_LBL = { pending:'Oczekuje', approved:'Zatwierdzono', paid:'Opłacono', rejected:'Odrzucono' };

  let _invoices = [];
  let _itemCount = 1;

  async function renderSupplierInvoices() {
    const co = Co();
    const status = document.getElementById('si-filter-status')?.value || '';
    const from   = document.getElementById('si-filter-from')?.value  || '';
    const to     = document.getElementById('si-filter-to')?.value    || '';
    const params = new URLSearchParams({ company: co });
    if (status) params.set('status', status);
    if (from)   params.set('from', from);
    if (to)     params.set('to', to);
    try {
      const r = await fetch(`${API()}/api/supplier-invoices?${params}`, { headers: H() });
      if (r.ok) _invoices = await r.json();
    } catch {}

    // Statystyki
    let stats = null;
    try {
      const r = await fetch(`${API()}/api/supplier-invoices/stats?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) stats = await r.json();
    } catch {}

    const el = document.getElementById('page-supplier-invoices');
    if (!el) return;

    const today = new Date().toISOString().slice(0,10);
    const monthStart = `${today.slice(0,7)}-01`;

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-receipt"></i> Faktury od dostawców</h2>
  <button class="btn-primary" onclick="window.SupplierInvoicesModule.openModal()"><i class="ti ti-plus"></i> Dodaj fakturę</button>
</div>
${stats ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
  ${stats.by_type?.map(t=>`<div class="kpi-chip"><i class="ti ti-receipt"></i><span class="kpi-val">${fmtN(t.total)} PLN</span><span class="kpi-lbl">${e(TYPE_LABEL[t.invoice_type]||t.invoice_type)}</span></div>`).join('')||''}
  ${stats.overdue_count > 0 ? `<div class="kpi-chip" style="border:2px solid var(--red)"><i class="ti ti-alert-circle" style="color:var(--red)"></i><span class="kpi-val" style="color:var(--red)">${stats.overdue_count}</span><span class="kpi-lbl">Przeterminowane (${fmtN(stats.overdue_amount)} PLN)</span></div>` : ''}
</div>` : ''}
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
  <select id="si-filter-status" onchange="window.SupplierInvoicesModule.renderSupplierInvoices()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="">Wszystkie</option>
    <option value="pending">Oczekujące</option>
    <option value="approved">Zatwierdzone</option>
    <option value="paid">Opłacone</option>
    <option value="rejected">Odrzucone</option>
  </select>
  <input id="si-filter-from" type="date" value="${monthStart}" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
  <input id="si-filter-to"   type="date" value="${today}"     style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
  <button class="btn-secondary" onclick="window.SupplierInvoicesModule.renderSupplierInvoices()">Filtruj</button>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Nr faktury</th><th>Dostawca</th><th>Data</th><th>Termin</th><th>Typ</th><th>Netto</th><th>Brutto</th><th>Status</th><th></th></tr></thead>
<tbody>
${_invoices.length ? _invoices.map(inv=>{
  const overdue = inv.due_date && inv.due_date < today && inv.status !== 'paid';
  return `<tr class="${overdue?'danger':''}">
  <td>${e(inv.invoice_number)}</td>
  <td>${e(inv.supplier_name)}</td>
  <td>${e(inv.invoice_date)}</td>
  <td class="${overdue?'danger':''}">${e(inv.due_date||'—')}</td>
  <td>${e(TYPE_LABEL[inv.invoice_type]||inv.invoice_type)}</td>
  <td>${fmtN(inv.total_net)} PLN</td>
  <td>${fmtN(inv.total_gross)} PLN</td>
  <td><span class="pill ${e(STATUS_CLS[inv.status]||'')}">${e(STATUS_LBL[inv.status]||inv.status)}</span></td>
  <td style="display:flex;gap:4px">
    ${inv.status==='pending'?`<button class="btn-icon ok" data-id="${e(inv.id)}" onclick="window.SupplierInvoicesModule.approve(this.dataset.id)" title="Zatwierdź"><i class="ti ti-check"></i></button>`:''}
    ${inv.status==='approved'?`<button class="btn-icon ok" data-id="${e(inv.id)}" onclick="window.SupplierInvoicesModule.markPaid(this.dataset.id)" title="Opłacono"><i class="ti ti-cash"></i></button>`:''}
    <button class="btn-icon" data-id="${e(inv.id)}" onclick="window.SupplierInvoicesModule.openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(inv.id)}" onclick="window.SupplierInvoicesModule.deleteInvoice(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`;}).join('') : '<tr><td colspan="9" class="empty">Brak faktur</td></tr>'}
</tbody></table></div>`;
    if (status) { const s=document.getElementById('si-filter-status'); if(s) s.value=status; }
  }

  function openModal(id) {
    const inv = id ? _invoices.find(x=>x.id===id) : null;
    const modal = document.getElementById('supplier-invoice-modal');
    if (!modal) return;
    const gi = k => document.getElementById(k);
    gi('sim-id').value           = inv?.id||'';
    gi('sim-number').value       = inv?.invoice_number||'';
    gi('sim-supplier').value     = inv?.supplier_name||'';
    gi('sim-date').value         = inv?.invoice_date||new Date().toISOString().slice(0,10);
    gi('sim-due').value          = inv?.due_date||'';
    gi('sim-type').value         = inv?.invoice_type||'service';
    gi('sim-net').value          = inv?.total_net||'';
    gi('sim-vat').value          = inv?.total_vat||'';
    gi('sim-gross').value        = inv?.total_gross||'';
    gi('sim-gl').value           = inv?.gl_account||'';
    gi('sim-notes').value        = inv?.notes||'';
    gi('sim-items').innerHTML    = '<tr><td colspan="5" class="empty">Brak pozycji — <a href="#" onclick="window.SupplierInvoicesModule.addItem();return false">Dodaj pozycję</a></td></tr>';
    _itemCount = 0;
    modal.style.display = 'flex';
  }

  function closeModal() { const m=document.getElementById('supplier-invoice-modal'); if(m) m.style.display='none'; }

  function addItem() {
    const tbody = document.getElementById('sim-items');
    if (!tbody) return;
    const idx = _itemCount++;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="form-input sim-item-nr" placeholder="Nr rej." style="width:90px"></td>
      <td><input type="text" class="form-input sim-item-desc" placeholder="Opis *" style="min-width:160px"></td>
      <td><input type="number" step="0.01" class="form-input sim-item-qty" value="1" style="width:60px" oninput="window.SupplierInvoicesModule.calcRow(this)"></td>
      <td><input type="number" step="0.01" class="form-input sim-item-price" placeholder="0.00" style="width:90px" oninput="window.SupplierInvoicesModule.calcRow(this)"></td>
      <td><input type="number" step="0.01" class="form-input sim-item-total" placeholder="0.00" style="width:90px" readonly></td>
      <td><button class="btn-icon danger" onclick="this.closest('tr').remove();window.SupplierInvoicesModule.recalcTotal()"><i class="ti ti-x"></i></button></td>`;
    tbody.appendChild(tr);
  }

  function calcRow(input) {
    const tr = input.closest('tr');
    const qty   = parseFloat(tr.querySelector('.sim-item-qty')?.value)||0;
    const price = parseFloat(tr.querySelector('.sim-item-price')?.value)||0;
    const totalEl = tr.querySelector('.sim-item-total');
    if (totalEl) totalEl.value = (qty*price).toFixed(2);
    recalcTotal();
  }

  function recalcTotal() {
    let total = 0;
    document.querySelectorAll('.sim-item-total').forEach(el => { total += parseFloat(el.value)||0; });
    const grossEl = document.getElementById('sim-gross');
    if (grossEl && !grossEl.value) grossEl.value = total.toFixed(2);
  }

  async function saveInvoice() {
    const gi = k => document.getElementById(k);
    const id = gi('sim-id').value;
    if (!gi('sim-number').value||!gi('sim-supplier').value||!gi('sim-date').value) {
      alert('Wypełnij: nr faktury, dostawca, data'); return;
    }
    const items = [];
    document.querySelectorAll('#sim-items tr').forEach(tr => {
      const desc = tr.querySelector('.sim-item-desc')?.value?.trim();
      if (!desc) return;
      items.push({
        nr_rej:     tr.querySelector('.sim-item-nr')?.value||null,
        description: desc,
        quantity:   parseFloat(tr.querySelector('.sim-item-qty')?.value)||1,
        unit_price: parseFloat(tr.querySelector('.sim-item-price')?.value)||null,
        total:      parseFloat(tr.querySelector('.sim-item-total')?.value)||null,
      });
    });
    const body = {
      invoice_number: gi('sim-number').value,
      supplier_name:  gi('sim-supplier').value,
      invoice_date:   gi('sim-date').value,
      due_date:       gi('sim-due').value||null,
      invoice_type:   gi('sim-type').value||'service',
      total_net:      parseFloat(gi('sim-net').value)||null,
      total_vat:      parseFloat(gi('sim-vat').value)||null,
      total_gross:    parseFloat(gi('sim-gross').value)||null,
      gl_account:     gi('sim-gl').value||null,
      notes:          gi('sim-notes').value||null,
      items,
    };
    const method = id ? 'PUT' : 'POST';
    const url = id
      ? `${API()}/api/supplier-invoices/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/supplier-invoices?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeModal(); await renderSupplierInvoices();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  async function approve(id) {
    try {
      await fetch(`${API()}/api/supplier-invoices/${encodeURIComponent(id)}/approve?company=${encodeURIComponent(Co())}`, { method:'PUT', headers:H() });
      await renderSupplierInvoices();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  async function markPaid(id) {
    try {
      await fetch(`${API()}/api/supplier-invoices/${encodeURIComponent(id)}/pay?company=${encodeURIComponent(Co())}`, { method:'PUT', headers:H() });
      await renderSupplierInvoices();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  async function deleteInvoice(id) {
    if (!confirm('Usunąć fakturę?')) return;
    try {
      await fetch(`${API()}/api/supplier-invoices/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers:H() });
      await renderSupplierInvoices();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  window.SupplierInvoicesModule = { renderSupplierInvoices, openModal, closeModal, addItem, calcRow, recalcTotal, saveInvoice, approve, markPaid, deleteInvoice };
})();
