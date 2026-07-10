/**
 * TaxOrder Pro — Klienci CFM (zewnętrzni, spoza listy firm systemu)
 */
window.TaxOrderCfmClients = (function () {

  let list = [];
  let editId = null;

  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _headers(extra) {
    const t = _token();
    return { ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(extra || {}) };
  }
  function _company() { return window.currentCompanyId || 'mtoilet'; }

  async function load() {
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-clients?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      list = await resp.json();
    } catch (e) {
      console.warn('[CfmClients] load error:', e.message);
      list = [];
    }
    render();
  }

  function getAll() { return list; }

  function render() {
    const tbody = document.getElementById('cfmk-tbody');
    if (!tbody) return;
    const q = (document.getElementById('cfmk-search')?.value || '').toLowerCase();
    const filtered = list.filter(c => !q || (c.nazwa || '').toLowerCase().includes(q) || (c.nip || '').includes(q));
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-building-store" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak klientów zewnętrznych CFM</td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(c => `<tr>
      <td><strong>${esc(c.nazwa)}</strong></td>
      <td style="font-family:var(--mono);font-size:12px">${esc(c.nip || '—')}</td>
      <td style="font-size:12px">${esc(c.miasto || '—')}</td>
      <td style="font-size:12px">${esc(c.osoba_kontaktowa || '—')}</td>
      <td style="font-size:12px">${esc(c.email || c.telefon || '—')}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="tbtn" data-id="${esc(c.id)}" onclick="TaxOrderCfmClients.openModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="tbtn" data-id="${esc(c.id)}" onclick="TaxOrderCfmClients.remove(this.dataset.id)" style="color:var(--red)"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function openModal(id) {
    editId = id || null;
    const c = id ? list.find(x => x.id === id) : null;
    document.getElementById('cfmkm-title').textContent = c ? 'Edytuj klienta' : 'Nowy klient zewnętrzny';
    document.getElementById('cfmkm-nazwa').value = c?.nazwa || '';
    document.getElementById('cfmkm-nip').value = c?.nip || '';
    document.getElementById('cfmkm-regon').value = c?.regon || '';
    document.getElementById('cfmkm-ulica').value = c?.ulica || '';
    document.getElementById('cfmkm-kod').value = c?.kod || '';
    document.getElementById('cfmkm-miasto').value = c?.miasto || '';
    document.getElementById('cfmkm-email').value = c?.email || '';
    document.getElementById('cfmkm-telefon').value = c?.telefon || '';
    document.getElementById('cfmkm-osoba').value = c?.osoba_kontaktowa || '';
    document.getElementById('cfmkm-uwagi').value = c?.uwagi || '';
    document.getElementById('cfm-client-modal').classList.remove('hidden');
  }

  function closeModal() { document.getElementById('cfm-client-modal').classList.add('hidden'); }

  async function save() {
    const nazwa = document.getElementById('cfmkm-nazwa').value.trim();
    if (!nazwa) { toast('⚠ Wpisz nazwę klienta'); return; }
    const body = {
      company_id: _company(),
      nazwa,
      nip: document.getElementById('cfmkm-nip').value.trim(),
      regon: document.getElementById('cfmkm-regon').value.trim(),
      ulica: document.getElementById('cfmkm-ulica').value.trim(),
      kod: document.getElementById('cfmkm-kod').value.trim(),
      miasto: document.getElementById('cfmkm-miasto').value.trim(),
      email: document.getElementById('cfmkm-email').value.trim(),
      telefon: document.getElementById('cfmkm-telefon').value.trim(),
      osoba_kontaktowa: document.getElementById('cfmkm-osoba').value.trim(),
      uwagi: document.getElementById('cfmkm-uwagi').value.trim(),
    };
    try {
      const resp = editId
        ? await fetch(`${_cfApi()}/api/cfm-clients/${editId}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
        : await fetch(`${_cfApi()}/api/cfm-clients`, { method: 'POST', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Klient zapisany');
      closeModal();
      await load();
    } catch (e) {
      toast('⚠ Błąd zapisu: ' + e.message);
    }
  }

  async function remove(id) {
    if (!confirm('Usunąć klienta? (kontrakty powiązane z tym klientem pozostaną, ale stracą odniesienie)')) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/cfm-clients/${id}`, { method: 'DELETE', headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Klient usunięty');
      await load();
    } catch (e) {
      toast('⚠ Błąd usuwania: ' + e.message);
    }
  }

  return { load, render, getAll, openModal, closeModal, save, remove };
})();
