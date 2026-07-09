/**
 * TaxOrder Pro — Szkody
 * Rejestr zgłoszonych szkód pojazdów floty, ze zdjęciami (D1 + R2 przez Worker API)
 */
window.TaxOrderDamages = (function () {

  let list = [];
  let editId = null;
  let pendingPhotos = []; // zdjęcia dodane przed pierwszym zapisem (id zgłoszenia jeszcze nie istnieje)

  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _headers(extra) {
    const t = _token();
    return { ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(extra || {}) };
  }
  function _company() { return window.currentCompanyId || 'mtoilet'; }

  async function load() {
    try {
      const resp = await fetch(`${_cfApi()}/api/damages?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      list = await resp.json();
    } catch (e) {
      console.warn('[Damages] load error:', e.message);
      list = [];
    }
    render();
  }

  function render() {
    const tbody = document.getElementById('szkody-tbody');
    if (!tbody) return;
    const q = (document.getElementById('szk-search')?.value || '').toLowerCase();
    const st = document.getElementById('szk-status')?.value || '';
    const filtered = list.filter(d =>
      (!q || (d.nr_rej || '').toLowerCase().includes(q) || (d.opis || '').toLowerCase().includes(q)) &&
      (!st || d.status === st)
    );
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-alert-triangle" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak zgłoszonych szkód</td></tr>`;
      return;
    }
    const pillCls = { ZGLOSZONA: 'pill-amber', W_TRAKCIE: 'pill-blue', ZAMKNIETA: 'pill-green' };
    const pillLbl = { ZGLOSZONA: 'Zgłoszona', W_TRAKCIE: 'W trakcie', ZAMKNIETA: 'Zamknięta' };
    tbody.innerHTML = filtered.map(d => `<tr>
      <td><strong style="font-family:var(--mono)">${esc(d.nr_rej || '—')}</strong></td>
      <td style="font-size:12px">${d.data_zdarzenia ? new Date(d.data_zdarzenia).toLocaleDateString('pl-PL') : '—'}</td>
      <td style="font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.opis || '—')}</td>
      <td><span class="pill ${pillCls[d.status] || 'pill-gray'}">${pillLbl[d.status] || esc(d.status)}</span></td>
      <td style="font-family:var(--mono)">${d.koszt != null ? Number(d.koszt).toLocaleString('pl-PL') + ' zł' : '—'}</td>
      <td style="text-align:center">${(d.photos || []).length ? `<i class="ti ti-photo"></i> ${d.photos.length}` : '—'}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="tbtn" onclick="TaxOrderDamages.openModal('${d.id}')"><i class="ti ti-edit"></i></button>
          <button class="tbtn" onclick="TaxOrderDamages.remove('${d.id}')" style="color:var(--red)"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function openModal(id, presetNrRej) {
    editId = id || null;
    pendingPhotos = [];
    const d = id ? list.find(x => x.id === id) : null;
    document.getElementById('szm-title').textContent = d ? 'Edytuj zgłoszenie' : 'Zgłoś szkodę';
    document.getElementById('szm-nrrej').value = d?.nr_rej || presetNrRej || '';
    document.getElementById('szm-data').value = d?.data_zdarzenia || '';
    document.getElementById('szm-status').value = d?.status || 'ZGLOSZONA';
    document.getElementById('szm-koszt').value = d?.koszt ?? '';
    document.getElementById('szm-zglaszajacy').value = d?.zglaszajacy || '';
    document.getElementById('szm-opis').value = d?.opis || '';
    document.getElementById('szm-przyczyna').value = d?.przyczyna || '';
    document.getElementById('szm-uwagi').value = d?.uwagi || '';
    const dl = document.getElementById('szm-veh-list');
    if (dl) dl.innerHTML = (window.vehs || []).map(v => `<option value="${esc(v.nrRej)}">${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}</option>`).join('');
    document.getElementById('szm-photo-btn').style.display = d ? 'inline-flex' : 'none';
    _renderPhotos(d?.photos || []);
    document.getElementById('szkoda-modal').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('szkoda-modal').classList.add('hidden');
  }

  function _renderPhotos(photos) {
    const grid = document.getElementById('szm-photos-grid');
    if (!grid) return;
    grid.innerHTML = photos.map(p => `
      <div style="position:relative;width:70px;height:70px">
        <img src="${_cfApi()}/api/docs/file/${p.r2_key}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
        <button onclick="TaxOrderDamages.removePhoto('${p.id}')" style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1">×</button>
      </div>`).join('');
  }

  async function save() {
    const nrRej = document.getElementById('szm-nrrej').value.trim().toUpperCase();
    if (!nrRej) { toast(t('dmg.toast.nrreg.req')); return; }
    const body = {
      company_id: _company(),
      nr_rej: nrRej,
      data_zdarzenia: document.getElementById('szm-data').value || null,
      status: document.getElementById('szm-status').value,
      koszt: document.getElementById('szm-koszt').value ? parseFloat(document.getElementById('szm-koszt').value) : null,
      zglaszajacy: document.getElementById('szm-zglaszajacy').value.trim(),
      opis: document.getElementById('szm-opis').value.trim(),
      przyczyna: document.getElementById('szm-przyczyna').value.trim(),
      uwagi: document.getElementById('szm-uwagi').value.trim(),
    };
    try {
      let id = editId;
      if (id) {
        const resp = await fetch(`${_cfApi()}/api/damages/${id}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
      } else {
        const resp = await fetch(`${_cfApi()}/api/damages`, { method: 'POST', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        id = data.id;
        // Wyślij zdjęcia dodane przed zapisem (nowe zgłoszenie nie miało jeszcze id)
        for (const file of pendingPhotos) await _uploadOne(id, file);
        pendingPhotos = [];
      }
      toast(t('dmg.toast.saved'));
      closeModal();
      await load();
    } catch (e) {
      toast(t('dmg.toast.save.err').replace('{0}', e.message));
    }
  }

  async function _uploadOne(damageId, file) {
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch(`${_cfApi()}/api/damages/${damageId}/photo`, { method: 'POST', headers: _headers(), body: fd });
    if (!resp.ok) throw new Error('Upload zdjęcia nie powiódł się');
    return resp.json();
  }

  async function uploadPhotos(input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    if (!editId) {
      // Zgłoszenie jeszcze niezapisane — zapamiętaj do wysłania po save()
      pendingPhotos.push(...files);
      toast(t('dmg.toast.photos.pending').replace('{0}', files.length));
      input.value = '';
      return;
    }
    try {
      for (const file of files) await _uploadOne(editId, file);
      const resp = await fetch(`${_cfApi()}/api/damages?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      const fresh = await resp.json();
      list = fresh;
      const d = fresh.find(x => x.id === editId);
      _renderPhotos(d?.photos || []);
      toast(t('dmg.toast.photos.added'));
    } catch (e) {
      toast(t('dmg.toast.upload.err').replace('{0}', e.message));
    }
    input.value = '';
  }

  async function removePhoto(photoId) {
    if (!confirm(t('dmg.confirm.del.photo'))) return;
    try {
      const delResp = await fetch(`${_cfApi()}/api/damages/photo/${photoId}`, { method: 'DELETE', headers: _headers() });
      if (!delResp.ok) throw new Error('HTTP ' + delResp.status);
      const resp = await fetch(`${_cfApi()}/api/damages?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      const fresh = await resp.json();
      list = fresh;
      const d = fresh.find(x => x.id === editId);
      _renderPhotos(d?.photos || []);
    } catch (e) {
      toast(t('dmg.toast.photo.del.err').replace('{0}', e.message));
    }
  }

  async function remove(id) {
    if (!confirm(t('dmg.confirm.del'))) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/damages/${id}`, { method: 'DELETE', headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast(t('dmg.toast.deleted'));
      await load();
    } catch (e) {
      toast(t('dmg.toast.del.err').replace('{0}', e.message));
    }
  }

  return { load, render, openModal, closeModal, save, uploadPhotos, removePhoto, remove };
})();
