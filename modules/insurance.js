(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtN  = (v, d = 0) => v != null ? parseFloat(v).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtD  = s => s ? s.slice(0, 10) : '—';
  const today = () => new Date().toISOString().slice(0, 10);

  const TYPE_LBL  = { OC:'OC', AC:'AC', NNW:'NNW', Assistance:'Assistance', GAP:'GAP' };
  const TYPE_CLS  = { OC:'ok', AC:'', NNW:'warn', Assistance:'', GAP:'danger' };
  const STAT_LBL  = { active:'Aktywna', expired:'Wygasła', cancelled:'Anulowana' };
  const CLAIM_LBL = { open:'Otwarta', in_progress:'W toku', settled:'Rozliczona', rejected:'Odrzucona' };
  const CLAIM_CLS = { open:'warn', in_progress:'', settled:'ok', rejected:'danger' };

  let _policies = [], _claims = [], _tab = 'policies';

  async function renderInsurance() {
    const co = Co();
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API()}/api/insurance?company=${encodeURIComponent(co)}`, { headers: H() }),
        fetch(`${API()}/api/insurance/claims?company=${encodeURIComponent(co)}`, { headers: H() }),
      ]);
      if (r1.ok) _policies = await r1.json();
      if (r2.ok) _claims   = await r2.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-insurance');
    if (!el) return;

    const expiringSoon = _policies.filter(p => {
      if (p.status !== 'active' || !p.end_date) return false;
      const diff = (new Date(p.end_date) - new Date()) / 86400000;
      return diff >= 0 && diff <= 30;
    });
    const totalPremium = _policies.filter(p => p.status === 'active').reduce((s, p) => s + (p.premium_pln ?? 0), 0);
    const openClaims   = _claims.filter(c => c.status === 'open' || c.status === 'in_progress');

    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-shield-check"></i> Ubezpieczenia floty</h2>
  <div style="display:flex;gap:8px">
    <button class="btn-secondary" onclick="window.InsuranceModule._openClaim()"><i class="ti ti-plus"></i> Nowe roszczenie</button>
    <button class="btn-primary"   onclick="window.InsuranceModule._openPolicy()"><i class="ti ti-plus"></i> Nowa polisa</button>
  </div>
</div>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
  <div class="kpi-chip" style="border-color:var(--green)"><i class="ti ti-shield" style="color:var(--green)"></i><span class="kpi-val" style="color:var(--green)">${_policies.filter(p=>p.status==='active').length}</span><span class="kpi-lbl">Aktywne polisy</span></div>
  <div class="kpi-chip"><i class="ti ti-coin"></i><span class="kpi-val">${fmtN(totalPremium, 2)}</span><span class="kpi-lbl">PLN składka/rok</span></div>
  ${expiringSoon.length ? `<div class="kpi-chip" style="border-color:#f59e0b"><i class="ti ti-clock" style="color:#f59e0b"></i><span class="kpi-val" style="color:#f59e0b">${expiringSoon.length}</span><span class="kpi-lbl">Wygasają ≤30 dni</span></div>` : ''}
  <div class="kpi-chip" style="${openClaims.length?'border-color:#dc2626':''}"><i class="ti ti-alert-triangle" style="${openClaims.length?'color:#dc2626':''}"></i><span class="kpi-val" style="${openClaims.length?'color:#dc2626':''}">${openClaims.length}</span><span class="kpi-lbl">Otwarte roszczenia</span></div>
</div>
${expiringSoon.length ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px">
  <i class="ti ti-alert-triangle" style="color:#d97706"></i> <strong>Uwaga:</strong> ${expiringSoon.length} polis wygasa w ciągu 30 dni:
  ${expiringSoon.map(p => `<strong>${e(p.vehicle_reg||p.policy_number)}</strong> (${fmtD(p.end_date)})`).join(', ')}
</div>` : ''}
<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
  <button class="tab-btn ${_tab==='policies'?'active':''}" onclick="window.InsuranceModule._setTab('policies')">Polisy (${_policies.length})</button>
  <button class="tab-btn ${_tab==='claims'?'active':''}" onclick="window.InsuranceModule._setTab('claims')">Roszczenia (${_claims.length})</button>
</div>
<div id="ins-tab-content"></div>
<div id="ins-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
  <div id="ins-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(600px,96vw);max-height:92vh;overflow-y:auto"></div>
</div>`;
    _renderTab();
  }

  function _setTab(tab) { _tab = tab; _render(); }

  function _renderTab() {
    const el = document.getElementById('ins-tab-content');
    if (!el) return;
    if (_tab === 'policies') {
      el.innerHTML = `<div class="table-wrap"><table class="data-table">
<thead><tr><th>Nr polisy</th><th>Pojazd</th><th>Typ</th><th>Ubezpieczyciel</th><th>Ważna do</th><th>Składka (PLN)</th><th>Status</th><th></th></tr></thead>
<tbody>
${_policies.length ? _policies.map(p => {
  const diff = p.end_date ? Math.round((new Date(p.end_date) - new Date()) / 86400000) : null;
  const expCls = diff !== null && diff <= 30 && diff >= 0 ? 'color:#d97706;font-weight:600' : diff !== null && diff < 0 ? 'color:#dc2626' : '';
  return `<tr>
  <td style="font-family:monospace;font-size:12px">${e(p.policy_number || '—')}</td>
  <td><strong>${e(p.vehicle_reg || '—')}</strong></td>
  <td><span class="pill ${TYPE_CLS[p.policy_type]||''}">${TYPE_LBL[p.policy_type]||e(p.policy_type)}</span></td>
  <td>${e(p.insurer || '—')}</td>
  <td><span style="${expCls}">${fmtD(p.end_date)} ${diff !== null ? `(${diff < 0 ? Math.abs(diff)+'d temu' : diff+'d'})` : ''}</span></td>
  <td>${fmtN(p.premium_pln, 2)}</td>
  <td><span class="pill ${p.status==='active'?'ok':p.status==='expired'?'danger':''}">${STAT_LBL[p.status]||e(p.status)}</span></td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon" data-id="${e(p.id)}" onclick="window.InsuranceModule._openPolicy(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(p.id)}" onclick="window.InsuranceModule._deletePolicy(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`;}).join('') : '<tr><td colspan="8" class="empty">Brak polis</td></tr>'}
</tbody></table></div>`;
    } else {
      el.innerHTML = `<div class="table-wrap"><table class="data-table">
<thead><tr><th>Pojazd</th><th>Data szkody</th><th>Nr szkody</th><th>Opis</th><th>Kwota szkody</th><th>Wypłacono</th><th>Status</th><th></th></tr></thead>
<tbody>
${_claims.length ? _claims.map(c => `<tr>
  <td><strong>${e(c.vehicle_reg || '—')}</strong></td>
  <td>${fmtD(c.claim_date)}</td>
  <td style="font-family:monospace;font-size:11px">${e(c.claim_number || '—')}</td>
  <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(c.description || '—')}</td>
  <td>${fmtN(c.claim_amount_pln, 2)} PLN</td>
  <td>${c.settled_amount_pln ? fmtN(c.settled_amount_pln, 2) + ' PLN' : '—'}</td>
  <td><span class="pill ${CLAIM_CLS[c.status]||''}">${CLAIM_LBL[c.status]||e(c.status)}</span></td>
  <td style="display:flex;gap:4px">
    <button class="btn-icon" data-id="${e(c.id)}" onclick="window.InsuranceModule._openClaim(this.dataset.id)"><i class="ti ti-edit"></i></button>
    <button class="btn-icon danger" data-id="${e(c.id)}" onclick="window.InsuranceModule._deleteClaim(this.dataset.id)"><i class="ti ti-trash"></i></button>
  </td>
</tr>`).join('') : '<tr><td colspan="8" class="empty">Brak roszczeń</td></tr>'}
</tbody></table></div>`;
    }
  }

  function _openPolicy(id) {
    const p = id ? _policies.find(x => x.id === id) : null;
    const inner = document.getElementById('ins-modal-inner');
    const modal = document.getElementById('ins-modal');
    if (!inner || !modal) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0"><i class="ti ti-shield"></i> ${p ? 'Edytuj polisę' : 'Nowa polisa'}</h3>
  <button onclick="window.InsuranceModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<input type="hidden" id="ins-pid" value="${e(p?.id||'')}">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
  <div><label style="font-size:12px;color:var(--text3)">Nr polisy *</label><br><input type="text" id="ins-polno" class="sel" value="${e(p?.policy_number||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Pojazd (nr rej.)</label><br><input type="text" id="ins-vreg" class="sel" value="${e(p?.vehicle_reg||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Typ ubezpieczenia</label><br>
    <select id="ins-ptype" class="sel">${Object.keys(TYPE_LBL).map(k=>`<option value="${k}" ${p?.policy_type===k?'selected':''}>${k}</option>`).join('')}</select>
  </div>
  <div><label style="font-size:12px;color:var(--text3)">Ubezpieczyciel</label><br><input type="text" id="ins-insurer" class="sel" value="${e(p?.insurer||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Data początku</label><br><input type="date" id="ins-start" class="sel" value="${e(p?.start_date?.slice(0,10)||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Data końca *</label><br><input type="date" id="ins-end" class="sel" value="${e(p?.end_date?.slice(0,10)||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Składka roczna (PLN)</label><br><input type="number" id="ins-prem" class="sel" step="0.01" value="${p?.premium_pln??''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Suma ubezpieczenia (PLN)</label><br><input type="number" id="ins-sum" class="sel" step="0.01" value="${p?.sum_insured_pln??''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Udział własny (PLN)</label><br><input type="number" id="ins-ded" class="sel" step="0.01" value="${p?.deductible_pln??''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Broker</label><br><input type="text" id="ins-broker" class="sel" value="${e(p?.broker||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Kontakt do brokera</label><br><input type="text" id="ins-brokcon" class="sel" value="${e(p?.broker_contact||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Status</label><br>
    <select id="ins-pstatus" class="sel">${Object.entries(STAT_LBL).map(([k,v])=>`<option value="${k}" ${(p?.status||'active')===k?'selected':''}>${v}</option>`).join('')}</select>
  </div>
</div>
<div style="margin:10px 0"><label style="font-size:12px;color:var(--text3)">Uwagi</label><br><textarea id="ins-pnotes" class="sel" rows="2">${e(p?.notes||'')}</textarea></div>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
  <input type="checkbox" id="ins-autorenew" ${p?.auto_renew?'checked':''}>
  <label for="ins-autorenew" style="font-size:13px">Automatyczne wznowienie</label>
</div>
<div style="display:flex;gap:8px;justify-content:flex-end">
  <button class="btn" onclick="window.InsuranceModule._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.InsuranceModule._savePolicy()"><i class="ti ti-device-floppy"></i> Zapisz</button>
</div>`;
    modal.style.display = 'flex';
  }

  async function _savePolicy() {
    const id     = document.getElementById('ins-pid')?.value;
    const polNo  = document.getElementById('ins-polno')?.value?.trim();
    const endDt  = document.getElementById('ins-end')?.value;
    if (!polNo) { alert('Nr polisy jest wymagany'); return; }
    if (!endDt)  { alert('Data końca jest wymagana'); return; }
    const body = {
      policy_number: polNo, vehicle_reg: document.getElementById('ins-vreg')?.value || null,
      policy_type: document.getElementById('ins-ptype')?.value,
      insurer: document.getElementById('ins-insurer')?.value || null,
      start_date: document.getElementById('ins-start')?.value || null,
      end_date: endDt,
      premium_pln: parseFloat(document.getElementById('ins-prem')?.value) || 0,
      sum_insured_pln: parseFloat(document.getElementById('ins-sum')?.value) || null,
      deductible_pln: parseFloat(document.getElementById('ins-ded')?.value) || 0,
      broker: document.getElementById('ins-broker')?.value || null,
      broker_contact: document.getElementById('ins-brokcon')?.value || null,
      status: document.getElementById('ins-pstatus')?.value,
      auto_renew: document.getElementById('ins-autorenew')?.checked ? 1 : 0,
      notes: document.getElementById('ins-pnotes')?.value || null,
    };
    const url = id
      ? `${API()}/api/insurance/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/insurance?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      _closeModal(); await renderInsurance();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  async function _deletePolicy(id) {
    if (!confirm('Usunąć polisę?')) return;
    try {
      await fetch(`${API()}/api/insurance/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderInsurance();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  function _openClaim(id) {
    const c = id ? _claims.find(x => x.id === id) : null;
    const inner = document.getElementById('ins-modal-inner');
    const modal = document.getElementById('ins-modal');
    if (!inner || !modal) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0"><i class="ti ti-alert-triangle"></i> ${c ? 'Edytuj roszczenie' : 'Nowe roszczenie'}</h3>
  <button onclick="window.InsuranceModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<input type="hidden" id="ins-cid" value="${e(c?.id||'')}">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
  <div><label style="font-size:12px;color:var(--text3)">Pojazd (nr rej.)</label><br><input type="text" id="ins-cvreg" class="sel" value="${e(c?.vehicle_reg||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Data szkody *</label><br><input type="date" id="ins-cdate" class="sel" value="${e(c?.claim_date?.slice(0,10)||today())}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Nr szkody (od ubezpieczyciela)</label><br><input type="text" id="ins-clno" class="sel" value="${e(c?.claim_number||'')}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Kwota szkody (PLN)</label><br><input type="number" id="ins-clamt" class="sel" step="0.01" value="${c?.claim_amount_pln??''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Wypłacono (PLN)</label><br><input type="number" id="ins-clsett" class="sel" step="0.01" value="${c?.settled_amount_pln??''}"></div>
  <div><label style="font-size:12px;color:var(--text3)">Status</label><br>
    <select id="ins-clstatus" class="sel">${Object.entries(CLAIM_LBL).map(([k,v])=>`<option value="${k}" ${(c?.status||'open')===k?'selected':''}>${v}</option>`).join('')}</select>
  </div>
</div>
<div style="margin:10px 0"><label style="font-size:12px;color:var(--text3)">Opis zdarzenia *</label><br><textarea id="ins-cldesc" class="sel" rows="3">${e(c?.description||'')}</textarea></div>
<div style="margin-bottom:12px"><label style="font-size:12px;color:var(--text3)">Uwagi</label><br><textarea id="ins-clnotes" class="sel" rows="2">${e(c?.notes||'')}</textarea></div>
<div style="display:flex;gap:8px;justify-content:flex-end">
  <button class="btn" onclick="window.InsuranceModule._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.InsuranceModule._saveClaim()"><i class="ti ti-device-floppy"></i> Zapisz</button>
</div>`;
    modal.style.display = 'flex';
  }

  async function _saveClaim() {
    const id   = document.getElementById('ins-cid')?.value;
    const date = document.getElementById('ins-cdate')?.value;
    const desc = document.getElementById('ins-cldesc')?.value?.trim();
    if (!date) { alert('Data szkody wymagana'); return; }
    if (!desc) { alert('Opis zdarzenia wymagany'); return; }
    const body = {
      vehicle_reg: document.getElementById('ins-cvreg')?.value || null,
      claim_date: date, description: desc,
      claim_number: document.getElementById('ins-clno')?.value || null,
      claim_amount_pln: parseFloat(document.getElementById('ins-clamt')?.value) || 0,
      settled_amount_pln: parseFloat(document.getElementById('ins-clsett')?.value) || null,
      status: document.getElementById('ins-clstatus')?.value || 'open',
      notes: document.getElementById('ins-clnotes')?.value || null,
    };
    const url = id
      ? `${API()}/api/insurance/claims/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`
      : `${API()}/api/insurance/claims?company=${encodeURIComponent(Co())}`;
    try {
      const r = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      _closeModal(); await renderInsurance();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  async function _deleteClaim(id) {
    if (!confirm('Usunąć roszczenie?')) return;
    try {
      await fetch(`${API()}/api/insurance/claims/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
      await renderInsurance();
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  function _closeModal() {
    const m = document.getElementById('ins-modal');
    if (m) m.style.display = 'none';
  }

  window.InsuranceModule = { renderInsurance, _setTab, _openPolicy, _savePolicy, _deletePolicy, _openClaim, _saveClaim, _deleteClaim, _closeModal };
})();
