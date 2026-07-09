/**
 * TaxOrder Pro — Klucze API (eksport/import danych dla integracji zewnętrznych)
 */
window.TaxOrderApiKeys = (function () {

  let list = [];

  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _headers(extra) {
    const t = _token();
    return { ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(extra || {}) };
  }

  async function load() {
    try {
      const resp = await fetch(`${_cfApi()}/api/api-keys`, { headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      list = await resp.json();
    } catch (e) {
      console.warn('[ApiKeys] load error:', e.message);
      list = [];
    }
    render();
  }

  function _companyName(id) { return window.COMPANIES?.[id]?.shortName || id; }
  function _fmtDate(s) { return s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('pl-PL') : '—'; }

  function render() {
    const tbody = document.getElementById('apik-tbody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-key" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak kluczy API</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(k => `<tr style="${k.active ? '' : 'opacity:.5'}">
      <td><strong>${esc(k.name)}</strong></td>
      <td style="font-size:12px">${esc(_companyName(k.company_id))}</td>
      <td style="font-size:12px">${k.scope === 'read_write' ? 'Odczyt i zapis' : 'Tylko odczyt'}</td>
      <td style="font-size:12px">${k.active ? '<span style="color:var(--green,#3B6D11)">Aktywny</span>' : '<span style="color:var(--text3)">Wyłączony</span>'}</td>
      <td style="font-size:12px">${_fmtDate(k.last_used_at)}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="tbtn" data-id="${esc(k.id)}" data-active="${k.active ? '1' : '0'}" onclick="TaxOrderApiKeys.toggleActive(this.dataset.id, this.dataset.active !== '1')" title="${k.active ? 'Wyłącz' : 'Włącz'}"><i class="ti ti-${k.active ? 'lock' : 'lock-open'}"></i></button>
          <button class="tbtn" data-id="${esc(k.id)}" onclick="TaxOrderApiKeys.remove(this.dataset.id)" style="color:var(--red)" title="Usuń"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function openModal() {
    document.getElementById('apikm-name').value = '';
    document.getElementById('apikm-scope').value = 'read';
    const sel = document.getElementById('apikm-company');
    if (sel) sel.innerHTML = Object.values(window.COMPANIES || {}).map(c => `<option value="${esc(c.id)}">${esc(c.shortName)}</option>`).join('');
    document.getElementById('apikm-result').classList.add('hidden');
    document.getElementById('apikm-form').classList.remove('hidden');
    document.getElementById('apikm-save-btn').classList.remove('hidden');
    document.getElementById('apikm-cancel-btn').textContent = 'Anuluj';
    document.getElementById('api-key-modal').classList.remove('hidden');
  }

  function closeModal() { document.getElementById('api-key-modal').classList.add('hidden'); }

  async function save() {
    const name = document.getElementById('apikm-name').value.trim();
    const company_id = document.getElementById('apikm-company').value;
    const scope = document.getElementById('apikm-scope').value;
    if (!name) { toast(t('apikeys.toast.name.req')); return; }
    try {
      const resp = await fetch(`${_cfApi()}/api/api-keys`, {
        method: 'POST', headers: _headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, company_id, scope }),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      document.getElementById('apikm-key-value').textContent = data.key;
      document.getElementById('apikm-form').classList.add('hidden');
      document.getElementById('apikm-result').classList.remove('hidden');
      document.getElementById('apikm-save-btn').classList.add('hidden');
      document.getElementById('apikm-cancel-btn').textContent = 'Zamknij';
      await load();
    } catch (e) {
      toast(t('apikeys.toast.save.err').replace('{0}', e.message));
    }
  }

  function copyKey() {
    const val = document.getElementById('apikm-key-value').textContent;
    navigator.clipboard?.writeText(val).then(() => toast(t('apikeys.toast.copied')));
  }

  async function toggleActive(id, active) {
    try {
      const resp = await fetch(`${_cfApi()}/api/api-keys/${id}`, {
        method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ active }),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      await load();
    } catch (e) {
      toast(t('apikeys.toast.err').replace('{0}', e.message));
    }
  }

  async function remove(id) {
    if (!confirm(t('apikeys.confirm.del'))) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/api-keys/${id}`, { method: 'DELETE', headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast(t('apikeys.toast.deleted'));
      await load();
    } catch (e) {
      toast(t('apikeys.toast.del.err').replace('{0}', e.message));
    }
  }

  return { load, render, openModal, closeModal, save, copyKey, toggleActive, remove };
})();
