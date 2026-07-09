/**
 * TaxOrder Pro — Kontrakty CFM (1 pojazd = 1 kontrakt; klient = firma z systemu LUB klient zewnętrzny)
 */
window.TaxOrderCfmContracts = (function () {

  let list = [];
  let editId = null;

  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _headers(extra) {
    const t = _token();
    return { ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(extra || {}) };
  }
  function _company() { return window.currentCompanyId || 'mtoilet'; }

  function _clientName(c) {
    if (c.client_type === 'COMPANY') return window.COMPANIES?.[c.client_ref]?.shortName || c.client_name_cache || c.client_ref;
    return c.client_name_cache || (window.TaxOrderCfmClients?.getAll() || []).find(x => x.id === c.client_ref)?.nazwa || '—';
  }

  async function load() {
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-contracts?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      list = await resp.json();
    } catch (e) {
      console.warn('[CfmContracts] load error:', e.message);
      list = [];
    }
    render();
  }

  function getAll() { return list; }

  function render() {
    const tbody = document.getElementById('cfmu-tbody');
    if (!tbody) return;
    const q = (document.getElementById('cfmu-search')?.value || '').toLowerCase();
    const st = document.getElementById('cfmu-status')?.value || '';
    const filtered = list.filter(c =>
      (!q || (c.nr_rej || '').toLowerCase().includes(q) || _clientName(c).toLowerCase().includes(q)) &&
      (!st || c.status === st)
    );
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-file-description" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak kontraktów CFM</td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(c => `<tr>
      <td><strong style="font-family:var(--mono)">${esc(c.nr_rej)}</strong></td>
      <td style="font-size:12px">${esc(_clientName(c))}</td>
      <td style="font-size:12px">${c.typ_umowy === 'LEASING' ? 'Leasing' : 'Najem'}</td>
      <td style="font-size:11px">${esc(c.data_od || '—')} → ${esc(c.data_do || 'bezterminowo')}</td>
      <td style="font-family:var(--mono)">${c.stawka_miesieczna != null ? Number(c.stawka_miesieczna).toLocaleString('pl-PL') + ' zł' : '—'}</td>
      <td style="text-align:center">${c.refakturowanie_kosztow ? '<i class="ti ti-check" style="color:var(--green)"></i>' : '—'}</td>
      <td><span class="pill ${c.status === 'AKTYWNY' ? 'pill-green' : 'pill-gray'}">${c.status === 'AKTYWNY' ? 'Aktywny' : 'Zakończony'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="tbtn" onclick="TaxOrderCfmContracts.openModal('${c.id}')"><i class="ti ti-edit"></i></button>
          ${c.status === 'AKTYWNY' ? `<button class="tbtn" onclick="TaxOrderCfmContracts.endContract('${c.id}')" title="Zakończ"><i class="ti ti-square-x"></i></button>` : ''}
          <button class="tbtn" onclick="TaxOrderCfmContracts.remove('${c.id}')" style="color:var(--red)"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function _populateClientPickers(c) {
    const companySel = document.getElementById('cfmum-client-company');
    const extSel = document.getElementById('cfmum-client-external');
    if (companySel) {
      companySel.innerHTML = Object.values(window.COMPANIES || {})
        .filter(co => co.id !== _company())
        .map(co => `<option value="${esc(co.id)}">${esc(co.shortName)}</option>`).join('');
    }
    if (extSel) {
      extSel.innerHTML = (window.TaxOrderCfmClients?.getAll() || [])
        .map(cl => `<option value="${esc(cl.id)}">${esc(cl.nazwa)}</option>`).join('');
    }
    const isExternal = c?.client_type === 'EXTERNAL';
    document.getElementById('cfmum-client-type').value = isExternal ? 'EXTERNAL' : 'COMPANY';
    _toggleClientType();
    if (c) {
      if (isExternal) extSel.value = c.client_ref;
      else companySel.value = c.client_ref;
    }
  }

  function _toggleClientType() {
    const type = document.getElementById('cfmum-client-type').value;
    document.getElementById('cfmum-client-company-wrap').style.display = type === 'COMPANY' ? 'block' : 'none';
    document.getElementById('cfmum-client-external-wrap').style.display = type === 'EXTERNAL' ? 'block' : 'none';
  }

  function openModal(id, presetNrRej) {
    editId = id || null;
    const c = id ? list.find(x => x.id === id) : null;
    document.getElementById('cfmum-title').textContent = c ? 'Edytuj kontrakt' : 'Nowy kontrakt CFM';
    document.getElementById('cfmum-nrrej').value = c?.nr_rej || presetNrRej || '';
    const dl = document.getElementById('cfmum-veh-list');
    if (dl) dl.innerHTML = (window.vehs || []).map(v => `<option value="${esc(v.nrRej)}">${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}</option>`).join('');
    _populateClientPickers(c);
    document.getElementById('cfmum-typ').value = c?.typ_umowy || 'NAJEM';
    document.getElementById('cfmum-od').value = c?.data_od || new Date().toISOString().slice(0, 10);
    document.getElementById('cfmum-do').value = c?.data_do || '';
    document.getElementById('cfmum-stawka').value = c?.stawka_miesieczna ?? '';
    document.getElementById('cfmum-dzien').value = c?.dzien_platnosci ?? 10;
    document.getElementById('cfmum-refaktura').checked = c ? !!c.refakturowanie_kosztow : true;
    document.getElementById('cfmum-uwagi').value = c?.uwagi || '';
    document.getElementById('cfm-contract-modal').classList.remove('hidden');
  }

  function closeModal() { document.getElementById('cfm-contract-modal').classList.add('hidden'); }

  async function save() {
    const nrRej = document.getElementById('cfmum-nrrej').value.trim().toUpperCase();
    if (!nrRej) { toast('⚠ Wybierz pojazd'); return; }
    const clientType = document.getElementById('cfmum-client-type').value;
    const clientRef = clientType === 'COMPANY'
      ? document.getElementById('cfmum-client-company').value
      : document.getElementById('cfmum-client-external').value;
    if (!clientRef) { toast('⚠ Wybierz klienta'); return; }
    const clientName = clientType === 'COMPANY'
      ? window.COMPANIES?.[clientRef]?.shortName
      : (window.TaxOrderCfmClients?.getAll() || []).find(x => x.id === clientRef)?.nazwa;

    const body = {
      company_id: _company(),
      nr_rej: nrRej,
      client_type: clientType,
      client_ref: clientRef,
      client_name_cache: clientName || null,
      typ_umowy: document.getElementById('cfmum-typ').value,
      data_od: document.getElementById('cfmum-od').value || null,
      data_do: document.getElementById('cfmum-do').value || null,
      stawka_miesieczna: document.getElementById('cfmum-stawka').value ? parseFloat(document.getElementById('cfmum-stawka').value) : null,
      dzien_platnosci: parseInt(document.getElementById('cfmum-dzien').value) || 10,
      refakturowanie_kosztow: document.getElementById('cfmum-refaktura').checked,
      uwagi: document.getElementById('cfmum-uwagi').value.trim(),
    };
    try {
      const resp = editId
        ? await fetch(`${_cfApi()}/api/cfm-contracts/${editId}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
        : await fetch(`${_cfApi()}/api/cfm-contracts`, { method: 'POST', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Kontrakt zapisany');
      closeModal();
      await load();
    } catch (e) {
      toast('⚠ Błąd zapisu: ' + e.message);
    }
  }

  async function endContract(id) {
    if (!confirm('Zakończyć kontrakt? Nie będzie już uwzględniany przy generowaniu faktur.')) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-contracts/${id}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status: 'ZAKONCZONY', data_do: new Date().toISOString().slice(0, 10) }) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Kontrakt zakończony');
      await load();
    } catch (e) {
      toast('⚠ Błąd: ' + e.message);
    }
  }

  async function remove(id) {
    if (!confirm('Usunąć kontrakt?')) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-contracts/${id}`, { method: 'DELETE', headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Kontrakt usunięty');
      await load();
    } catch (e) {
      toast('⚠ Błąd usuwania: ' + e.message);
    }
  }

  return { load, render, getAll, openModal, closeModal, save, endContract, remove, _toggleClientType, _clientName };
})();
