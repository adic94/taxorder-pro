(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN  = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtD  = s => s ? s.slice(0, 10) : '—';
  const today = () => new Date().toISOString().slice(0, 10);

  const STATUS_LBL = { draft:'Szkic', sent:'Wysłana', paid:'Opłacona', overdue:'Przeterminowana' };
  const STATUS_CLS = { draft:'', sent:'warn', paid:'ok', overdue:'danger' };

  let _invoices = [], _stats = null;

  async function renderRouteBilling() {
    const co = Co();
    const params = new URLSearchParams({ company: co });
    const st = document.getElementById('rb-filter-status')?.value;
    if (st) params.set('status', st);
    try {
      const r = await fetch(`${API()}/api/route-billing?${params}`, { headers: H() });
      if (r.ok) { const d = await r.json(); _invoices = d.invoices || d; _stats = d.stats || null; }
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-route-billing');
    if (!el) return;
    const totalNet   = _stats?.total_net   ?? _invoices.reduce((s,i)=>s+(i.net_pln??0),0);
    const totalGross = _stats?.total_gross ?? _invoices.reduce((s,i)=>s+(i.gross_pln??0),0);
    const totalCost  = _invoices.reduce((s,i)=>s+(i.cost_pln??0),0);
    const totalMargin= totalGross - totalCost;
    const unpaid     = _invoices.filter(i=>i.status==='sent'||i.status==='overdue').reduce((s,i)=>s+(i.gross_pln??0),0);

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-receipt"></i> Faktury zleceń transportowych</h2>
  <button class="btn-primary" onclick="window.RouteBilling._openModal()"><i class="ti ti-plus"></i> Nowa faktura</button>
</div>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
  <div class="kpi-chip"><i class="ti ti-file-invoice"></i><span class="kpi-val">${_invoices.length}</span><span class="kpi-lbl">Faktur</span></div>
  <div class="kpi-chip" style="border-color:var(--blue)"><i class="ti ti-coin" style="color:var(--blue)"></i><span class="kpi-val" style="color:var(--blue)">${fmtN(totalNet,2)}</span><span class="kpi-lbl">PLN netto</span></div>
  <div class="kpi-chip" style="border-color:var(--green)"><i class="ti ti-coin" style="color:var(--green)"></i><span class="kpi-val" style="color:var(--green)">${fmtN(totalGross,2)}</span><span class="kpi-lbl">PLN brutto</span></div>
  <div class="kpi-chip"><i class="ti ti-trending-up"></i><span class="kpi-val">${fmtN(totalMargin,2)}</span><span class="kpi-lbl">PLN marża</span></div>
  ${unpaid > 0 ? `<div class="kpi-chip" style="border-color:#dc2626"><i class="ti ti-clock" style="color:#dc2626"></i><span class="kpi-val" style="color:#dc2626">${fmtN(unpaid,2)}</span><span class="kpi-lbl">PLN nieopłacone</span></div>` : ''}
</div>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <select id="rb-filter-status" onchange="window.RouteBilling.renderRouteBilling()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="">Wszystkie statusy</option>
    ${Object.entries(STATUS_LBL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
  </select>
  <button class="btn-secondary" onclick="window.RouteBilling.renderRouteBilling()">Odśwież</button>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Nr faktury</th><th>Klient</th><th>Zlecenie</th><th>Data</th><th>Termin</th><th>Netto</th><th>Brutto</th><th>Koszt</th><th>Marża %</th><th>Status</th><th></th></tr></thead>
<tbody>
${_invoices.length ? _invoices.map(inv => {
  const margin = inv.gross_pln && inv.cost_pln ? ((inv.gross_pln - inv.cost_pln) / inv.gross_pln * 100) : (inv.margin_pct ?? 0);
  return `<tr>
  <td style="font-family:monospace;font-size:12px"><strong>${e(inv.invoice_number||'—')}</strong></td>
  <td>${e(inv.client_name||'—')}</td>
  <td style="font-size:11px;color:var(--text3)">${e(inv.order_title||'—')}</td>
  <td>${fmtD(inv.invoice_date)}</td>
  <td style="${inv.status==='overdue'?'color:#dc2626;font-weight:600':''}">${fmtD(inv.due_date)}</td>
  <td>${fmtN(inv.net_pln,2)}</td>
  <td><strong>${fmtN(inv.gross_pln,2)}</strong></td>
  <td>${fmtN(inv.cost_pln,2)}</td>
  <td style="color:${margin>=20?'#16a34a':margin>=10?'#d97706':'#dc2626'};font-weight:600">${fmtN(margin,1)}%</td>
  <td>
    <select style="border:none;background:transparent;cursor:pointer;font-size:12px;color:inherit" data-id="${e(inv.id)}" onchange="window.RouteBilling._updateStatus(this.dataset.id,this.value)">
      ${Object.entries(STATUS_LBL).map(([k,v])=>`<option value="${k}" ${inv.status===k?'selected':''}>${v}</option>`).join('')}
    </select>
  </td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon" data-id="${e(inv.id)}" onclick="window.RouteBilling._openModal(this.dataset.id)" title="Edytuj"><i class="ti ti-edit"></i></button>
    <button class="btn-icon" data-id="${e(inv.id)}" onclick="window.RouteBilling._printInvoice(this.dataset.id)" title="Drukuj/PDF"><i class="ti ti-printer"></i></button>
    <button class="btn-icon danger" data-id="${e(inv.id)}" onclick="window.RouteBilling._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`;}).join('') : '<tr><td colspan="11" class="empty">Brak faktur</td></tr>'}
</tbody></table></div>
<div id="rb-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
  <div id="rb-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(620px,96vw);max-height:92vh;overflow-y:auto"></div>
</div>`;
  }

  function _openModal(id) {
    const inv = id ? _invoices.find(x => x.id === id) : null;
    const inner = document.getElementById('rb-modal-inner');
    const modal = document.getElementById('rb-modal');
    if (!inner || !modal) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0"><i class="ti ti-receipt"></i> ${inv ? 'Edytuj fakturę' : 'Nowa faktura'}</h3>
  <button onclick="window.RouteBilling._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
</div>
<input type="hidden" id="rb-id" value="${e(inv?.id||'')}">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
  <div><label style="font-size:12px;color:var(--text3)">Nr faktury *</label><br><input type="text" id="rb-invno" class="sel" value="${e(inv?.invoice_number||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Klient *</label><br><input type="text" id="rb-client" class="sel" value="${e(inv?.client_name||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">NIP klienta</label><br><input type="text" id="rb-nip" class="sel" value="${e(inv?.client_nip||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Powiązane zlecenie</label><br><input type="text" id="rb-ordtitle" class="sel" value="${e(inv?.order_title||'')}" placeholder="Tytuł zlecenia"></div>
  <div><label style="font-size:12px;color:var(--text3)">Data wystawienia</label><br><input type="date" id="rb-date" class="sel" value="${e(inv?.invoice_date?.slice(0,10)||today())}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Termin płatności</label><br><input type="date" id="rb-due" class="sel" value="${e(inv?.due_date?.slice(0,10)||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Kwota netto (PLN) *</label><br><input type="number" id="rb-net" class="sel" step="0.01" value="${inv?.net_pln??''}" oninput="window.RouteBilling._calcBrutto()"></div>
  <div><label style="font-size:12px;color:var(--text3)">VAT %</label><br>
    <select id="rb-vat" class="sel" onchange="window.RouteBilling._calcBrutto()">
      <option value="0.23" ${(inv?.vat_rate??0.23)===0.23?'selected':''}>23%</option>
      <option value="0.08" ${inv?.vat_rate===0.08?'selected':''}>8%</option>
      <option value="0.05" ${inv?.vat_rate===0.05?'selected':''}>5%</option>
      <option value="0" ${inv?.vat_rate===0?'selected':''}>0% (ZW)</option>
    </select>
  </div>
  <div><label style="font-size:12px;color:var(--text3)">Brutto (PLN)</label><br><input type="number" id="rb-gross" class="sel" step="0.01" value="${inv?.gross_pln??''}" readonly style="background:var(--bg2)"></div>
  <div><label style="font-size:12px;color:var(--text3)">Koszt realizacji (PLN)</label><br><input type="number" id="rb-cost" class="sel" step="0.01" value="${inv?.cost_pln??''}" oninput="window.RouteBilling._calcBrutto()"></div>
</div>
<div id="rb-margin-info" style="font-size:12px;color:var(--text3);margin:8px 0"></div>
<div style="margin-bottom:12px"><label style="font-size:12px;color:var(--text3)">Uwagi</label><br><textarea id="rb-notes" class="sel" rows="2">${e(inv?.notes||'')}</textarea></div>
<div style="display:flex;gap:8px;justify-content:flex-end">
  <button class="btn" onclick="window.RouteBilling._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.RouteBilling._save()"><i class="ti ti-device-floppy"></i> Zapisz</button>
</div>`;
    modal.style.display = 'flex';
    _calcBrutto();
  }

  function _calcBrutto() {
    const net  = parseFloat(document.getElementById('rb-net')?.value)  || 0;
    const vat  = parseFloat(document.getElementById('rb-vat')?.value)  || 0;
    const cost = parseFloat(document.getElementById('rb-cost')?.value) || 0;
    const vatAmt = parseFloat((net * vat).toFixed(2));
    const gross  = parseFloat((net + vatAmt).toFixed(2));
    const grossEl = document.getElementById('rb-gross');
    if (grossEl) grossEl.value = gross || '';
    const margin = gross > 0 ? ((gross - cost) / gross * 100) : 0;
    const infoEl = document.getElementById('rb-margin-info');
    if (infoEl && net > 0) {
      infoEl.textContent = `VAT: ${fmtN(vatAmt,2)} PLN | Brutto: ${fmtN(gross,2)} PLN | Marża: ${fmtN(margin,1)}% (${fmtN(gross-cost,2)} PLN)`;
    }
  }

  async function _save() {
    const id     = document.getElementById('rb-id')?.value;
    const invNo  = document.getElementById('rb-invno')?.value?.trim();
    const client = document.getElementById('rb-client')?.value?.trim();
    const net    = parseFloat(document.getElementById('rb-net')?.value);
    if (!invNo)  { alert('Nr faktury wymagany'); return; }
    if (!client) { alert('Klient wymagany'); return; }
    if (isNaN(net)||net<=0) { alert('Kwota netto wymagana'); return; }
    const vat   = parseFloat(document.getElementById('rb-vat')?.value) || 0;
    const vatAmt= parseFloat((net * vat).toFixed(2));
    const gross = parseFloat((net + vatAmt).toFixed(2));
    const cost  = parseFloat(document.getElementById('rb-cost')?.value) || 0;
    const body = {
      invoice_number: invNo, client_name: client,
      client_nip: document.getElementById('rb-nip')?.value || null,
      order_title: document.getElementById('rb-ordtitle')?.value || null,
      invoice_date: document.getElementById('rb-date')?.value || today(),
      due_date: document.getElementById('rb-due')?.value || null,
      net_pln: net, vat_rate: vat, vat_pln: vatAmt, gross_pln: gross,
      cost_pln: cost,
      margin_pln: parseFloat((gross - cost).toFixed(2)),
      margin_pct: gross > 0 ? parseFloat(((gross - cost) / gross * 100).toFixed(2)) : 0,
      notes: document.getElementById('rb-notes')?.value || null,
    };
    const url = id
      ? `${API()}/api/route-billing/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/route-billing?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      _closeModal(); await renderRouteBilling();
    } catch (ex) { alert(`Błąd: ${  ex.message}`); }
  }

  async function _updateStatus(id, status) {
    try {
      await fetch(`${API()}/api/route-billing/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, {
        method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
      });
      await renderRouteBilling();
    } catch {}
  }

  function _printInvoice(id) {
    const inv = _invoices.find(x => x.id === id);
    if (!inv) return;
    const w = window.open('', '_blank', 'width=800,height=700');
    w.document.write(`<!doctype html><html><head><title>Faktura ${esc(inv.invoice_number)}</title>
<style>body{font-family:Arial,sans-serif;padding:40px;font-size:14px}h1{font-size:22px;margin-bottom:4px}.meta{display:flex;justify-content:space-between;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f5f5f5}.total{font-size:18px;font-weight:bold;text-align:right;margin-top:12px}@media print{.no-print{display:none}}</style>
</head><body>
<h1>FAKTURA VAT</h1>
<div class="meta">
  <div><strong>Sprzedawca:</strong><br>${e(Co())}</div>
  <div style="text-align:right"><strong>Nr: ${e(inv.invoice_number)}</strong><br>Data: ${e(inv.invoice_date||'')}<br>Termin: ${e(inv.due_date||'')}</div>
</div>
<div><strong>Nabywca:</strong> ${e(inv.client_name)} ${inv.client_nip?`| NIP: ${e(inv.client_nip)}`:''}</div>
${inv.order_title?`<div style="color:#666;margin-top:4px">Zlecenie: ${e(inv.order_title)}</div>`:''}
<table>
  <tr><th>Opis usługi</th><th>Netto (PLN)</th><th>VAT</th><th>Brutto (PLN)</th></tr>
  <tr><td>Usługa transportowa${inv.order_title?` — ${e(inv.order_title)}`:''}</td><td>${fmtN(inv.net_pln,2)}</td><td>${fmtN((inv.vat_rate||0)*100,0)}%</td><td>${fmtN(inv.gross_pln,2)}</td></tr>
</table>
<div class="total">DO ZAPŁATY: ${fmtN(inv.gross_pln,2)} PLN</div>
${inv.notes?`<p style="margin-top:20px;color:#666">${e(inv.notes)}</p>`:''}
<br><button class="no-print" onclick="window.print()">Drukuj / Zapisz PDF</button>
</body></html>`);
    w.document.close();
  }

  async function _delete(id) {
    if (!confirm('Usunąć fakturę?')) return;
    try {
      await fetch(`${API()}/api/route-billing/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderRouteBilling();
    } catch (ex) { alert(`Błąd: ${  ex.message}`); }
  }

  function _closeModal() {
    const m = document.getElementById('rb-modal');
    if (m) m.style.display = 'none';
  }

  window.RouteBilling = { renderRouteBilling, _openModal, _save, _updateStatus, _printInvoice, _delete, _closeModal, _calcBrutto };
})();
