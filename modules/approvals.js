(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc==='function' ? esc(s) : String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = v => v!=null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

  const TYPE_LABEL = { service_order:'Zlecenie serwisowe', damage_report:'Szkoda', mileage_claim:'Rozliczenie km', fine:'Mandat', reservation:'Rezerwacja pojazdu' };
  const STATUS_CLS = { pending:'warn', approved:'ok', rejected:'danger' };

  let _items = [];

  async function renderApprovals() {
    const co = Co();
    const status = document.getElementById('appr-filter-status')?.value || 'pending';
    const params = new URLSearchParams({ company: co, status });
    try {
      const r = await fetch(`${API()}/api/approvals?${params}`, { headers: H() });
      if (r.ok) _items = await r.json();
    } catch {}

    // Odśwież badge
    try {
      const r = await fetch(`${API()}/api/approvals/count?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) { const d=await r.json(); const b=document.getElementById('badge-approvals'); if(b) b.textContent=d.count; }
    } catch {}

    const el = document.getElementById('page-approvals');
    if (!el) return;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-checks"></i> Kolejka zatwierdzeń</h2>
</div>
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
  <select id="appr-filter-status" onchange="window.ApprovalsModule.renderApprovals()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="pending">Oczekujące</option>
    <option value="approved">Zatwierdzone</option>
    <option value="rejected">Odrzucone</option>
  </select>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Typ</th><th>Pojazd</th><th>Kwota</th><th>Opis</th><th>Wnioskował</th><th>Data</th><th>Status</th><th></th></tr></thead>
<tbody>
${_items.length ? _items.map(a=>`<tr>
  <td>${e(TYPE_LABEL[a.record_type]||a.record_type)}</td>
  <td>${e(a.nr_rej||'—')}</td>
  <td>${a.amount!=null ? fmtN(a.amount)+' PLN' : '—'}</td>
  <td title="${e(a.description||'')}">${e((a.description||'').slice(0,60)+(a.description?.length>60?'…':''))}</td>
  <td>${e(a.requested_by||'—')}</td>
  <td>${e((a.created_at||'').slice(0,10))}</td>
  <td><span class="pill ${e(STATUS_CLS[a.status]||'')}">${e({pending:'Oczekuje',approved:'Zatwierdzone',rejected:'Odrzucone'}[a.status]||a.status)}</span></td>
  <td style="display:flex;gap:4px">
    ${a.status==='pending' ? `
      <button class="btn-icon ok" data-id="${e(a.id)}" onclick="window.ApprovalsModule.approve(this.dataset.id)" title="Zatwierdź"><i class="ti ti-check"></i></button>
      <button class="btn-icon danger" data-id="${e(a.id)}" onclick="window.ApprovalsModule.reject(this.dataset.id)" title="Odrzuć"><i class="ti ti-x"></i></button>` : '—'}
  </td>
</tr>`).join('') : '<tr><td colspan="8" class="empty">Brak pozycji</td></tr>'}
</tbody></table></div>`;
    const sel = document.getElementById('appr-filter-status');
    if (sel) sel.value = status;
  }

  async function approve(id) {
    if (!confirm('Zatwierdzić?')) return;
    try {
      await fetch(`${API()}/api/approvals/${encodeURIComponent(id)}/approve?company=${encodeURIComponent(Co())}`, { method:'PUT', headers:H() });
      await renderApprovals();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  async function reject(id) {
    const reason = prompt('Powód odrzucenia:') ?? '';
    try {
      await fetch(`${API()}/api/approvals/${encodeURIComponent(id)}/reject?company=${encodeURIComponent(Co())}`, {
        method:'PUT', headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify({ reason })
      });
      await renderApprovals();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  // Automatycznie tworzy rekord zatwierdzenia jeśli kwota przekracza próg
  async function checkAndCreateApproval(company, recordType, recordId, nrRej, amount, description, requestedBy) {
    try {
      const r = await fetch(`${API()}/api/fleet-policies?company=${encodeURIComponent(company)}`, { headers: H() });
      if (!r.ok) return false;
      const pol = await r.json();
      const thresholds = { service_order: pol.service_approval_threshold, damage_report: pol.damage_approval_threshold, mileage_claim: pol.mileage_approval_threshold };
      const thresh = thresholds[recordType];
      if (thresh == null || amount < thresh) return false;
      await fetch(`${API()}/api/approvals?company=${encodeURIComponent(company)}`, {
        method:'POST', headers:{...H(),'Content-Type':'application/json'},
        body: JSON.stringify({ record_type:recordType, record_id:recordId, nr_rej:nrRej, amount, description, requested_by:requestedBy })
      });
      return true;
    } catch { return false; }
  }

  window.ApprovalsModule = { renderApprovals, approve, reject, checkAndCreateApproval };
})();
