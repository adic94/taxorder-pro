/**
 * TaxOrder Pro — Zlecenia serwisowe
 * Workflow: zgłoszenie → autoryzacja/odrzucenie → realizacja
 * Po realizacji wpis trafia automatycznie do v.serviceHistory (alerty notifications.js bez zmian)
 */
window.TaxOrderServiceOrders = (function () {

  let list = [];
  let realizeId = null;

  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _headers(extra) {
    const t = _token();
    return { ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(extra || {}) };
  }
  function _company() { return window.currentCompanyId || 'mtoilet'; }
  function _typeLabel(typ) { return window.ServiceModule?.SERVICE_TYPES?.[typ]?.label || typ || '—'; }

  async function load() {
    try {
      const resp = await fetch(`${_cfApi()}/api/service-orders?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      list = await resp.json();
    } catch (e) {
      console.warn('[ServiceOrders] load error:', e.message);
      list = [];
    }
    render();
  }

  function render() {
    const tbody = document.getElementById('zlecenia-tbody');
    if (!tbody) return;
    const q = (document.getElementById('zlc-search')?.value || '').toLowerCase();
    const st = document.getElementById('zlc-status')?.value || '';
    const filtered = list.filter(o =>
      (!q || (o.nr_rej || '').toLowerCase().includes(q) || (o.opis || '').toLowerCase().includes(q)) &&
      (!st || o.status === st)
    );
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-clipboard-list" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak zleceń serwisowych</td></tr>`;
      return;
    }
    const pillCls = { ZGLOSZONE: 'pill-amber', AUTORYZOWANE: 'pill-blue', ODRZUCONE: 'pill-red', ZREALIZOWANE: 'pill-green' };
    const pillLbl = { ZGLOSZONE: 'Zgłoszone', AUTORYZOWANE: 'Autoryzowane', ODRZUCONE: 'Odrzucone', ZREALIZOWANE: 'Zrealizowane' };
    tbody.innerHTML = filtered.map(o => `<tr>
      <td><strong style="font-family:var(--mono)">${o.nr_rej || '—'}</strong></td>
      <td style="font-size:12px">${_typeLabel(o.typ)}</td>
      <td style="font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.opis || '—'}</td>
      <td><span class="pill ${pillCls[o.status] || 'pill-gray'}">${pillLbl[o.status] || o.status}</span></td>
      <td style="font-family:var(--mono)">${o.koszt_szacowany != null ? Number(o.koszt_szacowany).toLocaleString('pl-PL') + ' zł' : '—'}</td>
      <td style="font-size:11px;color:var(--text2)">${new Date(o.created_at).toLocaleDateString('pl-PL')}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${o.status === 'ZGLOSZONE' ? `
            <button class="tbtn" onclick="TaxOrderServiceOrders.authorize('${o.id}')" title="Autoryzuj" style="color:var(--green)"><i class="ti ti-check"></i></button>
            <button class="tbtn" onclick="TaxOrderServiceOrders.reject('${o.id}')" title="Odrzuć" style="color:var(--red)"><i class="ti ti-x"></i></button>
          ` : ''}
          ${o.status === 'AUTORYZOWANE' ? `<button class="tbtn" onclick="TaxOrderServiceOrders.openRealizeModal('${o.id}')" title="Zrealizuj"><i class="ti ti-tool"></i></button>` : ''}
          <button class="tbtn" onclick="TaxOrderServiceOrders.remove('${o.id}')" style="color:var(--red)"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function openModal(id, presetNrRej) {
    const dl = document.getElementById('zlc-veh-list');
    if (dl) dl.innerHTML = (window.vehs || []).map(v => `<option value="${v.nrRej}">${v.nrRej} — ${v.marka} ${v.model}</option>`).join('');
    const typSel = document.getElementById('zlm-typ');
    if (typSel && window.ServiceModule?.SERVICE_TYPES) {
      typSel.innerHTML = Object.entries(window.ServiceModule.SERVICE_TYPES)
        .map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');
    }
    document.getElementById('zlm-nrrej').value = presetNrRej || '';
    document.getElementById('zlm-opis').value = '';
    document.getElementById('zlm-zglaszajacy').value = '';
    document.getElementById('zlm-koszt').value = '';
    document.getElementById('zlm-warsztat').value = '';
    document.getElementById('zlecenie-modal').classList.remove('hidden');
  }

  function closeModal() { document.getElementById('zlecenie-modal').classList.add('hidden'); }

  async function save() {
    const nrRej = document.getElementById('zlm-nrrej').value.trim().toUpperCase();
    if (!nrRej) { toast(t('so.toast.nrreg.req')); return; }
    const body = {
      company_id: _company(),
      nr_rej: nrRej,
      typ: document.getElementById('zlm-typ').value,
      opis: document.getElementById('zlm-opis').value.trim(),
      zglaszajacy: document.getElementById('zlm-zglaszajacy').value.trim(),
      koszt_szacowany: document.getElementById('zlm-koszt').value ? parseFloat(document.getElementById('zlm-koszt').value) : null,
      warsztat: document.getElementById('zlm-warsztat').value.trim(),
    };
    try {
      const resp = await fetch(`${_cfApi()}/api/service-orders`, { method: 'POST', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast(t('so.toast.submitted'));
      closeModal();
      await load();
    } catch (e) {
      toast(t('so.toast.save.err').replace('{0}', e.message));
    }
  }

  async function authorize(id) {
    const autoryzowal = (window.currentUser?.name || window.currentUser?.email || prompt('Kto autoryzuje?') || '').trim();
    if (!autoryzowal) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/service-orders/${id}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ akcja: 'AUTORYZUJ', autoryzowal }) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast(t('so.toast.authorized'));
      await load();
    } catch (e) {
      toast(t('so.toast.err').replace('{0}', e.message));
    }
  }

  async function reject(id) {
    const powod = prompt('Powód odrzucenia:');
    if (powod === null) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/service-orders/${id}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ akcja: 'ODRZUC', powod_odrzucenia: powod }) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast(t('so.toast.rejected'));
      await load();
    } catch (e) {
      toast(t('so.toast.err').replace('{0}', e.message));
    }
  }

  function openRealizeModal(id) {
    realizeId = id;
    document.getElementById('zlr-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('zlr-km').value = '';
    document.getElementById('zlr-koszt').value = '';
    document.getElementById('zlr-nastepny-termin').value = '';
    document.getElementById('zlr-nastepny-km').value = '';
    document.getElementById('zlecenie-realizacja-modal').classList.remove('hidden');
  }

  function closeRealizeModal() { document.getElementById('zlecenie-realizacja-modal').classList.add('hidden'); }

  async function confirmRealize() {
    const order = list.find(o => o.id === realizeId);
    if (!order) return;
    const body = {
      akcja: 'ZREALIZUJ',
      data_realizacji: document.getElementById('zlr-data').value || null,
      km_realizacji: document.getElementById('zlr-km').value ? parseInt(document.getElementById('zlr-km').value) : null,
      koszt_rzeczywisty: document.getElementById('zlr-koszt').value ? parseFloat(document.getElementById('zlr-koszt').value) : null,
      nastepny_termin: document.getElementById('zlr-nastepny-termin').value || null,
      nastepny_km: document.getElementById('zlr-nastepny-km').value ? parseInt(document.getElementById('zlr-nastepny-km').value) : null,
    };
    try {
      const resp = await fetch(`${_cfApi()}/api/service-orders/${realizeId}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || 'HTTP ' + resp.status);
      }
      _syncToServiceHistory(order, body);
      toast(t('so.toast.done'));
      closeRealizeModal();
      await load();
    } catch (e) {
      toast(t('so.toast.done.err').replace('{0}', e.message));
    }
  }

  // Dopisuje zakończone zlecenie do v.serviceHistory — identyczny kształt jak service.js saveService()
  async function _syncToServiceHistory(order, realizeBody) {
    const v = (window.vehs || []).find(x => x.nrRej === order.nr_rej);
    if (!v) return;
    if (!Array.isArray(v.serviceHistory)) v.serviceHistory = [];
    v.serviceHistory.push({
      id: 'so_' + order.id,
      date: realizeBody.data_realizacji || new Date().toISOString().slice(0, 10),
      type: order.typ,
      description: order.opis,
      km: realizeBody.km_realizacji,
      cost: realizeBody.koszt_rzeczywisty,
      workshop: order.warsztat,
      nextServiceDate: realizeBody.nastepny_termin,
      nextServiceKm: realizeBody.nastepny_km,
      notes: 'Z modułu Zlecenia serwisowe',
      createdBy: window.currentUser?.id,
      createdAt: new Date().toISOString(),
    });
    v.serviceHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (window.TaxOrderFleetCloud?.saveVehicle) await window.TaxOrderFleetCloud.saveVehicle(v);
    window.TaxOrderVehicleDetail?.refreshServiceTab?.(v.id);
  }

  async function remove(id) {
    if (!confirm(t('so.confirm.del'))) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/service-orders/${id}`, { method: 'DELETE', headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast(t('so.toast.deleted'));
      await load();
    } catch (e) {
      toast(t('so.toast.del.err').replace('{0}', e.message));
    }
  }

  return { load, render, openModal, closeModal, save, authorize, reject, openRealizeModal, closeRealizeModal, confirmRealize, remove };
})();
