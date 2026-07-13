(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc==='function' ? esc(s) : String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN = v => v!=null ? parseFloat(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

  const SERVICES = ['Wymiana oleju','Hamulce','Opony','Skrzynia biegów','Silnik','Zawieszenie','Elektryka','Klimatyzacja','Diagnostyka','Blacharstwo','Lakiernictwo'];

  let _contracts = [];

  async function renderServiceContracts() {
    const co = Co();
    try {
      const r = await fetch(`${API()}/api/service-contracts?company=${encodeURIComponent(co)}`, { headers: H() });
      if (r.ok) _contracts = await r.json();
    } catch {}

    const el = document.getElementById('page-service-contracts');
    if (!el) return;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-contract"></i> Kontrakty z serwisami</h2>
  <button class="btn-primary" onclick="window.ServiceContractsModule.openModal()"><i class="ti ti-plus"></i> Dodaj kontrakt</button>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Serwis</th><th>NIP</th><th>Kontakt</th><th>Telefon</th><th>Roboczogodz.</th><th>Rabat części</th><th>Ważny do</th><th>Termin płatności</th><th></th></tr></thead>
<tbody>
${_contracts.length ? _contracts.map(c=>{
  const expired = c.contract_to && new Date(c.contract_to) < new Date();
  return `<tr class="${expired?'danger':''}">
  <td>${e(c.workshop_name)}</td>
  <td>${e(c.nip||'—')}</td>
  <td>${e(c.contact_person||'—')}</td>
  <td>${e(c.phone||'—')}</td>
  <td>${c.hourly_rate ? fmtN(c.hourly_rate)+' PLN' : '—'}</td>
  <td>${c.parts_discount ? c.parts_discount+'%' : '—'}</td>
  <td class="${expired?'danger':''}">${e(c.contract_to||'Bezterminowy')}</td>
  <td>${c.payment_days ? c.payment_days+' dni' : '—'}</td>
  <td>
    <button class="btn-icon" data-id="${e(c.id)}" onclick="window.ServiceContractsModule.openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(c.id)}" onclick="window.ServiceContractsModule.deleteContract(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`}).join('') : '<tr><td colspan="9" class="empty">Brak kontraktów</td></tr>'}
</tbody></table></div>`;
  }

  function _parseServices(json) {
    try { return JSON.parse(json||'[]'); } catch { return []; }
  }

  function openModal(id) {
    const c = id ? _contracts.find(x=>x.id===id) : null;
    const modal = document.getElementById('service-contract-modal');
    if (!modal) return;
    const gi = k => document.getElementById(k);
    gi('scm-id').value           = c?.id||'';
    gi('scm-name').value         = c?.workshop_name||'';
    gi('scm-nip').value          = c?.nip||'';
    gi('scm-address').value      = c?.address||'';
    gi('scm-contact').value      = c?.contact_person||'';
    gi('scm-phone').value        = c?.phone||'';
    gi('scm-email').value        = c?.email||'';
    gi('scm-rate').value         = c?.hourly_rate||'';
    gi('scm-discount').value     = c?.parts_discount??0;
    gi('scm-from').value         = c?.contract_from||'';
    gi('scm-to').value           = c?.contract_to||'';
    gi('scm-payment').value      = c?.payment_days??14;
    gi('scm-notes').value        = c?.notes||'';
    // Serwisy
    const covered = _parseServices(c?.services_covered);
    document.querySelectorAll('.scm-service-cb').forEach(cb => {
      cb.checked = covered.includes(cb.value);
    });
    modal.style.display = 'flex';
  }

  function closeModal() { const m=document.getElementById('service-contract-modal'); if(m) m.style.display='none'; }

  async function saveContract() {
    const gi = k => document.getElementById(k);
    const id = gi('scm-id').value;
    if (!gi('scm-name').value.trim()) { alert('Nazwa serwisu jest wymagana'); return; }
    const covered = [...document.querySelectorAll('.scm-service-cb:checked')].map(cb=>cb.value);
    const body = {
      workshop_name:   gi('scm-name').value.trim(),
      nip:             gi('scm-nip').value||null,
      address:         gi('scm-address').value||null,
      contact_person:  gi('scm-contact').value||null,
      phone:           gi('scm-phone').value||null,
      email:           gi('scm-email').value||null,
      hourly_rate:     parseFloat(gi('scm-rate').value)||null,
      parts_discount:  parseFloat(gi('scm-discount').value)||0,
      contract_from:   gi('scm-from').value||null,
      contract_to:     gi('scm-to').value||null,
      payment_days:    parseInt(gi('scm-payment').value)||14,
      services_covered: covered,
      notes:           gi('scm-notes').value||null,
    };
    const method = id ? 'PUT' : 'POST';
    const url = id
      ? `${API()}/api/service-contracts/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/service-contracts?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method, headers:{...H(),'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      closeModal(); await renderServiceContracts();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  async function deleteContract(id) {
    if (!confirm('Usunąć kontrakt?')) return;
    try {
      await fetch(`${API()}/api/service-contracts/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method:'DELETE', headers:H() });
      await renderServiceContracts();
    } catch(ex) { alert('Błąd: '+ex.message); }
  }

  function getServiceCheckboxesHtml() {
    return SERVICES.map(s=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" class="scm-service-cb" value="${e(s)}"> ${e(s)}</label>`).join('');
  }
  window._scmServicesHtml = getServiceCheckboxesHtml;

  window.ServiceContractsModule = { renderServiceContracts, openModal, closeModal, saveContract, deleteContract };
})();
