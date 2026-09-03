(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc==='function' ? esc(s) : String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = v => v!=null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

  let _parts = [];

  async function renderSpareParts() {
    const co = Co();
    const cat = document.getElementById('sp-filter-cat')?.value || '';
    const params = new URLSearchParams({ company: co });
    if (cat) params.set('category', cat);
    try {
      const r = await fetch(`${API()}/api/spare-parts?${params}`, { headers: H() });
      if (r.ok) _parts = await r.json();
    } catch {}

    const el = document.getElementById('page-spare-parts');
    if (!el) return;
    const lowStock = _parts.filter(p => p.quantity <= p.min_quantity);
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-package"></i> Magazyn części zamiennych</h2>
  <button class="btn-primary" onclick="window.SparePartsModule.openModal()"><i class="ti ti-plus"></i> Dodaj część</button>
</div>
${lowStock.length ? `<div class="alert alert-danger" style="margin-bottom:12px"><i class="ti ti-alert-triangle"></i> <strong>Niski stan magazynowy (${lowStock.length} pozycji):</strong> ${lowStock.map(p=>e(`${p.name} (${p.quantity} ${p.unit})`)).join(', ')}</div>` : ''}
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
  <select id="sp-filter-cat" onchange="window.SparePartsModule.renderSpareParts()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="">Wszystkie kategorie</option>
    <option value="filtry">Filtry</option><option value="hamulce">Hamulce</option>
    <option value="oleje">Oleje</option><option value="opony">Opony</option>
    <option value="elektrika">Elektryka</option><option value="inne">Inne</option>
  </select>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Nazwa</th><th>Nr katalogowy</th><th>Kategoria</th><th>Stan</th><th>Min</th><th>Jedn.</th><th>Cena jedn.</th><th>Dostawca</th><th>Lokalizacja</th><th></th></tr></thead>
<tbody>
${_parts.length ? _parts.map(p=>`<tr class="${p.quantity<=p.min_quantity?'danger':''}">
  <td>${e(p.name)}</td>
  <td>${e(p.part_number||'—')}</td>
  <td>${e(p.category||'—')}</td>
  <td style="font-weight:700;color:${p.quantity<=p.min_quantity?'var(--red)':p.quantity<=p.min_quantity*2?'var(--orange)':'inherit'}">${p.quantity}</td>
  <td>${p.min_quantity}</td>
  <td>${e(p.unit||'szt')}</td>
  <td>${p.unit_price ? `${fmtN(p.unit_price)} PLN` : '—'}</td>
  <td>${e(p.supplier||'—')}</td>
  <td>${e(p.location||'—')}</td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon ok" data-id="${e(p.id)}" onclick="window.SparePartsModule.openStockModal(this.dataset.id,'+')" title="Przyjmij"><i class="ti ti-plus"></i></button>
    <button class="btn-icon warn" data-id="${e(p.id)}" onclick="window.SparePartsModule.openStockModal(this.dataset.id,'-')" title="Wydaj"><i class="ti ti-minus"></i></button>
    <button class="btn-icon" data-id="${e(p.id)}" onclick="window.SparePartsModule.openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(p.id)}" onclick="window.SparePartsModule.deletePart(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="10" class="empty">Brak części</td></tr>'}
</tbody></table></div>`;
    if (cat) { const s = document.getElementById('sp-filter-cat'); if (s) s.value = cat; }
  }

  function openModal(id) {
    const p = id ? _parts.find(x=>x.id===id) : null;
    const modal = document.getElementById('spare-part-modal');
    if (!modal) return;
    const gi = k => document.getElementById(k);
    gi('spm-id').value        = p?.id||'';
    gi('spm-name').value      = p?.name||'';
    gi('spm-partno').value    = p?.part_number||'';
    gi('spm-cat').value       = p?.category||'inne';
    gi('spm-qty').value       = p?.quantity??0;
    gi('spm-min').value       = p?.min_quantity??1;
    gi('spm-unit').value      = p?.unit||'szt';
    gi('spm-price').value     = p?.unit_price||'';
    gi('spm-supplier').value  = p?.supplier||'';
    gi('spm-location').value  = p?.location||'';
    gi('spm-notes').value     = p?.notes||'';
    modal.style.display = 'flex';
  }

  function closeModal() { const m=document.getElementById('spare-part-modal'); if(m) m.style.display='none'; }

  function openStockModal(id, dir) {
    const p = _parts.find(x=>x.id===id);
    const modal = document.getElementById('stock-modal');
    if (!modal) return;
    document.getElementById('stk-id').value    = id;
    document.getElementById('stk-name').textContent = p?.name||'';
    document.getElementById('stk-dir').value   = dir;
    document.getElementById('stk-qty').value   = '';
    document.getElementById('stk-nr-rej').value = '';
    document.getElementById('stk-reason').value = '';
    document.getElementById('stk-title').textContent = dir==='+' ? 'Przyjęcie na magazyn' : 'Wydanie z magazynu';
    modal.style.display = 'flex';
  }
  function closeStockModal() { const m=document.getElementById('stock-modal'); if(m) m.style.display='none'; }

  async function saveStock() {
    const id  = document.getElementById('stk-id').value;
    const dir = document.getElementById('stk-dir').value;
    const qty = parseInt(document.getElementById('stk-qty').value);
    if (!qty || qty < 1) { alert('Podaj ilość (> 0)'); return; }
    const body = {
      qty_change: dir==='+' ? qty : -qty,
      nr_rej:     document.getElementById('stk-nr-rej').value||null,
      reason:     document.getElementById('stk-reason').value||null,
    };
    try {
      const r = await fetch(`${API()}/api/spare-parts/${encodeURIComponent(id)}/stock?company=${encodeURIComponent(Co())}`, {
        method:'PUT', headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify(body)
      });
      if (!r.ok) throw new Error(await r.text());
      closeStockModal(); await renderSpareParts();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  async function savePart() {
    const gi = k => document.getElementById(k);
    const id = gi('spm-id').value;
    if (!gi('spm-name').value.trim()) { alert('Nazwa jest wymagana'); return; }
    const body = {
      name:         gi('spm-name').value.trim(),
      part_number:  gi('spm-partno').value||null,
      category:     gi('spm-cat').value||null,
      quantity:     parseInt(gi('spm-qty').value)||0,
      min_quantity: parseInt(gi('spm-min').value)||1,
      unit:         gi('spm-unit').value||'szt',
      unit_price:   parseFloat(gi('spm-price').value)||null,
      supplier:     gi('spm-supplier').value||null,
      location:     gi('spm-location').value||null,
      notes:        gi('spm-notes').value||null,
    };
    const method = id ? 'PUT' : 'POST';
    const url = id
      ? `${API()}/api/spare-parts/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/spare-parts?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeModal(); await renderSpareParts();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  async function deletePart(id) {
    if (!confirm('Usunąć tę część?')) return;
    try {
      await fetch(`${API()}/api/spare-parts/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers:H() });
      await renderSpareParts();
    } catch(ex) { alert(`Błąd: ${ex.message}`); }
  }

  window.SparePartsModule = { renderSpareParts, openModal, closeModal, openStockModal, closeStockModal, saveStock, savePart, deletePart };
})();
