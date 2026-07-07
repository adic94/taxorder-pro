/**
 * TaxOrder Pro — Magazyn Opon
 * Cykl życia opon: magazyn ↔ zamontowana na pojeździe ↔ złomowana, z historią przełożeń
 */
window.TaxOrderTires = (function () {

  let list = [];
  let editId = null;

  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _headers(extra) {
    const t = _token();
    return { ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(extra || {}) };
  }
  function _company() { return window.currentCompanyId || 'mtoilet'; }

  const POZYCJE = { FL: 'Przód lewy', FR: 'Przód prawy', RL: 'Tył lewy', RR: 'Tył prawy', RLi: 'Tył lewy wew.', RRi: 'Tył prawy wew.', SP: 'Zapasowa' };
  const STATUS_PILL = { MAGAZYN: 'pill-blue', ZAMONTOWANA: 'pill-green', ZLOMOWANA: 'pill-gray' };
  const STATUS_LBL = { MAGAZYN: 'Magazyn', ZAMONTOWANA: 'Zamontowana', ZLOMOWANA: 'Złomowana' };

  async function load() {
    try {
      const resp = await fetch(`${_cfApi()}/api/tires?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      list = await resp.json();
    } catch (e) {
      console.warn('[Tires] load error:', e.message);
      list = [];
    }
    render();
  }

  function render() {
    const tbody = document.getElementById('opony-tbody');
    if (!tbody) return;
    const q = (document.getElementById('opn-search')?.value || '').toLowerCase();
    const st = document.getElementById('opn-status')?.value || '';
    const filtered = list.filter(t =>
      (!q || (t.rozmiar || '').toLowerCase().includes(q) || (t.marka || '').toLowerCase().includes(q) || (t.nr_rej || '').toLowerCase().includes(q)) &&
      (!st || t.status === st)
    );
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-circle-dot" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak opon w magazynie</td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(t => `<tr>
      <td><span class="pill ${STATUS_PILL[t.status] || 'pill-gray'}">${STATUS_LBL[t.status] || t.status}</span></td>
      <td style="font-family:var(--mono)">${t.rozmiar || '—'}</td>
      <td>${t.marka || '—'}</td>
      <td style="font-family:var(--mono);font-size:11px">${t.dot || '—'}</td>
      <td>${t.bieznik_mm != null ? t.bieznik_mm + ' mm' : '—'}</td>
      <td>${t.sezon || '—'}</td>
      <td style="font-size:12px">${t.status === 'ZAMONTOWANA' ? `<strong style="font-family:var(--mono)">${t.nr_rej}</strong> (${POZYCJE[t.pozycja] || t.pozycja})` : (t.lokalizacja_magazyn || '—')}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${t.status === 'MAGAZYN' ? `<button class="tbtn" onclick="TaxOrderTires.openMountModal('${t.id}')" title="Zamontuj"><i class="ti ti-tool"></i></button>` : ''}
          ${t.status === 'ZAMONTOWANA' ? `<button class="tbtn" onclick="TaxOrderTires.unmount('${t.id}')" title="Zdemontuj"><i class="ti ti-arrow-back-up"></i></button>` : ''}
          <button class="tbtn" onclick="TaxOrderTires.showHistory('${t.id}')" title="Historia"><i class="ti ti-history"></i></button>
          <button class="tbtn" onclick="TaxOrderTires.openModal('${t.id}')"><i class="ti ti-edit"></i></button>
          <button class="tbtn" onclick="TaxOrderTires.scrap('${t.id}')" style="color:var(--red)" title="Złomuj"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function openModal(id) {
    editId = id || null;
    const t = id ? list.find(x => x.id === id) : null;
    document.getElementById('opm-title').textContent = t ? 'Edytuj oponę' : 'Dodaj oponę do magazynu';
    document.getElementById('opm-rozmiar').value = t?.rozmiar || '';
    document.getElementById('opm-marka').value = t?.marka || '';
    document.getElementById('opm-dot').value = t?.dot || '';
    document.getElementById('opm-bieznik').value = t?.bieznik_mm ?? '';
    document.getElementById('opm-sezon').value = t?.sezon || '';
    document.getElementById('opm-lokalizacja').value = t?.lokalizacja_magazyn || '';
    document.getElementById('opm-zakup').value = t?.data_zakupu || '';
    document.getElementById('opm-uwagi').value = t?.uwagi || '';
    document.getElementById('opona-modal').classList.remove('hidden');
  }

  function closeModal() { document.getElementById('opona-modal').classList.add('hidden'); }

  async function save() {
    const body = {
      company_id: _company(),
      rozmiar: document.getElementById('opm-rozmiar').value.trim(),
      marka: document.getElementById('opm-marka').value.trim(),
      dot: document.getElementById('opm-dot').value.trim(),
      bieznik_mm: document.getElementById('opm-bieznik').value ? parseFloat(document.getElementById('opm-bieznik').value) : null,
      sezon: document.getElementById('opm-sezon').value,
      lokalizacja_magazyn: document.getElementById('opm-lokalizacja').value.trim(),
      data_zakupu: document.getElementById('opm-zakup').value || null,
      uwagi: document.getElementById('opm-uwagi').value.trim(),
    };
    try {
      const resp = editId
        ? await fetch(`${_cfApi()}/api/tires/${editId}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
        : await fetch(`${_cfApi()}/api/tires`, { method: 'POST', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Opona zapisana');
      closeModal();
      await load();
    } catch (e) {
      toast('⚠ Błąd zapisu: ' + e.message);
    }
  }

  function openMountModal(id) {
    editId = id;
    const dl = document.getElementById('opm-mount-veh-list');
    if (dl) dl.innerHTML = (window.vehs || []).map(v => `<option value="${v.nrRej}">${v.nrRej} — ${v.marka} ${v.model}</option>`).join('');
    document.getElementById('opm-mount-nrrej').value = '';
    document.getElementById('opm-mount-pozycja').value = 'FL';
    document.getElementById('opona-mount-modal').classList.remove('hidden');
  }

  function closeMountModal() { document.getElementById('opona-mount-modal').classList.add('hidden'); }

  async function confirmMount() {
    const nrRej = document.getElementById('opm-mount-nrrej').value.trim().toUpperCase();
    const pozycja = document.getElementById('opm-mount-pozycja').value;
    if (!nrRej) { toast('⚠ Wybierz pojazd'); return; }
    try {
      const resp = await fetch(`${_cfApi()}/api/tires/${editId}`, {
        method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ akcja: 'ZAMONTUJ', nr_rej: nrRej, pozycja })
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast(t('tw.toast.mounted').replace('{0}', nrRej).replace('{1}', POZYCJE[pozycja]));
      closeMountModal();
      await load();
    } catch (e) {
      toast(t('tw.toast.mount.err').replace('{0}', e.message));
    }
  }

  async function unmount(id) {
    if (!confirm('Zdemontować oponę i przenieść do magazynu?')) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/tires/${id}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ akcja: 'ZDEMONTUJ' }) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Opona przeniesiona do magazynu');
      await load();
    } catch (e) {
      toast('⚠ Błąd: ' + e.message);
    }
  }

  async function scrap(id) {
    if (!confirm('Złomować oponę? Tej operacji nie można cofnąć.')) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/tires/${id}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ akcja: 'ZLOMUJ' }) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast('✓ Opona złomowana');
      await load();
    } catch (e) {
      toast('⚠ Błąd: ' + e.message);
    }
  }

  function showHistory(id) {
    const t = list.find(x => x.id === id);
    if (!t) return;
    const rows = (t.historia || []).slice().reverse().map(h =>
      `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
        <strong>${h.akcja}</strong> — ${new Date(h.data).toLocaleString('pl-PL')}
        ${h.nrRej ? `<br><span style="color:var(--text2)">${h.nrRej}${h.pozycja ? ' / ' + (POZYCJE[h.pozycja] || h.pozycja) : ''}</span>` : ''}
      </div>`
    ).join('') || '<div style="color:var(--text3);font-size:12px">Brak historii</div>';
    document.getElementById('opona-history-body').innerHTML = rows;
    document.getElementById('opona-history-modal').classList.remove('hidden');
  }

  function closeHistory() { document.getElementById('opona-history-modal').classList.add('hidden'); }

  return { load, render, openModal, closeModal, save, openMountModal, closeMountModal, confirmMount, unmount, scrap, showHistory, closeHistory, POZYCJE };
})();
