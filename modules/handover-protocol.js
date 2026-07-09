/**
 * TaxOrder Pro — Protokoły zdawczo-odbiorcze
 * Wydanie/zdanie pojazdu: stan licznika/paliwa, wyposażenie, zdjęcia, podpisy elektroniczne
 */
window.TaxOrderHandoverProtocol = (function () {

  let list = [];
  let editId = null;
  let pendingPhotos = [];
  let equipment = [];
  const DEFAULT_EQUIPMENT = ['Gaśnica', 'Trójkąt ostrzegawczy', 'Apteczka', 'Koło zapasowe / zestaw naprawczy', 'Kluczyk zapasowy', 'Dokumenty pojazdu'];

  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _headers(extra) {
    const t = _token();
    return { ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(extra || {}) };
  }
  function _company() { return window.currentCompanyId || 'mtoilet'; }

  async function load() {
    try {
      const resp = await fetch(`${_cfApi()}/api/protocols?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      list = await resp.json();
    } catch (e) {
      console.warn('[Protocols] load error:', e.message);
      list = [];
    }
    render();
  }

  function render() {
    const tbody = document.getElementById('protokoly-tbody');
    if (!tbody) return;
    const q = (document.getElementById('prt-search')?.value || '').toLowerCase();
    const filtered = list.filter(p => !q || (p.nr_rej || '').toLowerCase().includes(q));
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-file-signature" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak protokołów</td></tr>`;
      return;
    }
    tbody.innerHTML = filtered.map(p => `<tr>
      <td><strong style="font-family:var(--mono)">${p.nr_rej || '—'}</strong></td>
      <td><span class="pill ${p.typ === 'WYDANIE' ? 'pill-blue' : 'pill-amber'}">${p.typ === 'WYDANIE' ? 'Wydanie' : 'Zdanie'}</span></td>
      <td style="font-size:12px">${p.data ? new Date(p.data).toLocaleDateString('pl-PL') : '—'}</td>
      <td style="font-size:12px">${p.osoba_wydajaca || '—'} → ${p.osoba_odbierajaca || '—'}</td>
      <td style="font-family:var(--mono)">${p.stan_licznika != null ? Number(p.stan_licznika).toLocaleString('pl-PL') + ' km' : '—'}</td>
      <td style="text-align:center">
        ${(p.photos || []).length ? `<i class="ti ti-photo"></i> ${p.photos.length}` : ''}
        ${p.podpis_wydajacy && p.podpis_odbierajacy ? ' <i class="ti ti-signature" style="color:var(--green)" title="Podpisany"></i>' : ''}
      </td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="tbtn" onclick="TaxOrderHandoverProtocol.openModal('${p.id}')"><i class="ti ti-edit"></i></button>
          <button class="tbtn" onclick="TaxOrderHandoverProtocol.print('${p.id}')" title="Drukuj"><i class="ti ti-printer"></i></button>
          <button class="tbtn" onclick="TaxOrderHandoverProtocol.remove('${p.id}')" style="color:var(--red)"><i class="ti ti-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
  }

  function openModal(id, presetNrRej) {
    editId = id || null;
    pendingPhotos = [];
    const p = id ? list.find(x => x.id === id) : null;
    equipment = p?.wyposazenie?.length ? p.wyposazenie : DEFAULT_EQUIPMENT.map(nazwa => ({ nazwa, obecne: true }));

    document.getElementById('prm-title').textContent = p ? 'Edytuj protokół' : 'Nowy protokół zdawczo-odbiorczy';
    document.getElementById('prm-nrrej').value = p?.nr_rej || presetNrRej || '';
    document.getElementById('prm-typ').value = p?.typ || 'WYDANIE';
    document.getElementById('prm-data').value = p?.data ? p.data.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const dlVeh = document.getElementById('prm-veh-list');
    if (dlVeh) dlVeh.innerHTML = (window.vehs || []).map(v => `<option value="${esc(v.nrRej)}">${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}</option>`).join('');
    const dlDrv = document.getElementById('prm-driver-list');
    if (dlDrv) dlDrv.innerHTML = (window.TaxOrderDrivers?.getAll() || []).map(d => `<option value="${esc(d.name)}">`).join('');
    document.getElementById('prm-wydajaca').value = p?.osoba_wydajaca || '';
    document.getElementById('prm-odbierajaca').value = p?.osoba_odbierajaca || '';
    document.getElementById('prm-licznik').value = p?.stan_licznika ?? '';
    document.getElementById('prm-paliwo').value = p?.stan_paliwa || 'Pełny';
    document.getElementById('prm-uszkodzenia').value = p?.uszkodzenia_opis || '';
    document.getElementById('prm-uwagi').value = p?.uwagi || '';
    document.getElementById('prm-photo-btn').style.display = p ? 'inline-flex' : 'none';
    _renderEquipment();
    _renderPhotos(p?.photos || []);
    _clearSignaturePad('wydajacy');
    _clearSignaturePad('odbierajacy');
    if (p?.podpis_wydajacy) _loadSignature('wydajacy', p.podpis_wydajacy);
    if (p?.podpis_odbierajacy) _loadSignature('odbierajacy', p.podpis_odbierajacy);
    document.getElementById('protokol-modal').classList.remove('hidden');
    setTimeout(() => { _initSignaturePad('wydajacy'); _initSignaturePad('odbierajacy'); }, 50);
  }

  function closeModal() { document.getElementById('protokol-modal').classList.add('hidden'); }

  function _renderEquipment() {
    const el = document.getElementById('prm-equipment-list');
    if (!el) return;
    el.innerHTML = equipment.map((eq, i) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0">
        <input type="checkbox" ${eq.obecne ? 'checked' : ''} onchange="TaxOrderHandoverProtocol._toggleEquip(${i})">
        <span style="flex:1">${esc(eq.nazwa)}</span>
        <button onclick="TaxOrderHandoverProtocol._removeEquip(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px">×</button>
      </label>`).join('');
  }
  function _toggleEquip(i) { equipment[i].obecne = !equipment[i].obecne; }
  function _removeEquip(i) { equipment.splice(i, 1); _renderEquipment(); }
  function addEquip() {
    const val = document.getElementById('prm-equip-new').value.trim();
    if (!val) return;
    equipment.push({ nazwa: val, obecne: true });
    document.getElementById('prm-equip-new').value = '';
    _renderEquipment();
  }

  // ── Podpis elektroniczny (własny canvas, bez zewnętrznej biblioteki) ──
  const _pads = {};
  function _initSignaturePad(key) {
    const canvas = document.getElementById('sig-' + key);
    if (!canvas || _pads[key]?.bound) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    let drawing = false, last = null;
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const start = e => { drawing = true; last = pos(e); e.preventDefault(); };
    const move = e => {
      if (!drawing) return;
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; e.preventDefault();
    };
    const end = () => { drawing = false; };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start); canvas.addEventListener('touchmove', move); canvas.addEventListener('touchend', end);
    _pads[key] = { bound: true };
  }
  function _clearSignaturePad(key) {
    const canvas = document.getElementById('sig-' + key);
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
  function clearSignature(key) { _clearSignaturePad(key); }
  function _loadSignature(key, base64) {
    const canvas = document.getElementById('sig-' + key);
    if (!canvas || !base64) return;
    const img = new Image();
    img.onload = () => canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = base64;
  }
  function _getSignature(key) {
    const canvas = document.getElementById('sig-' + key);
    if (!canvas) return null;
    const blank = document.createElement('canvas');
    blank.width = canvas.width; blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) return null; // nic nie narysowano
    return canvas.toDataURL('image/png');
  }

  function _renderPhotos(photos) {
    const grid = document.getElementById('prm-photos-grid');
    if (!grid) return;
    grid.innerHTML = photos.map(p => `
      <div style="position:relative;width:70px;height:70px">
        <img src="${_cfApi()}/api/docs/file/${p.r2_key}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
      </div>`).join('');
  }

  async function save() {
    const nrRej = document.getElementById('prm-nrrej').value.trim().toUpperCase();
    if (!nrRej) { toast(t('hp.toast.nrreg.req')); return; }
    const body = {
      company_id: _company(),
      nr_rej: nrRej,
      typ: document.getElementById('prm-typ').value,
      data: document.getElementById('prm-data').value || null,
      osoba_wydajaca: document.getElementById('prm-wydajaca').value.trim(),
      osoba_odbierajaca: document.getElementById('prm-odbierajaca').value.trim(),
      stan_licznika: document.getElementById('prm-licznik').value ? parseInt(document.getElementById('prm-licznik').value) : null,
      stan_paliwa: document.getElementById('prm-paliwo').value,
      wyposazenie: equipment,
      uszkodzenia_opis: document.getElementById('prm-uszkodzenia').value.trim(),
      uwagi: document.getElementById('prm-uwagi').value.trim(),
      podpis_wydajacy: _getSignature('wydajacy'),
      podpis_odbierajacy: _getSignature('odbierajacy'),
    };
    try {
      let id = editId;
      if (id) {
        const resp = await fetch(`${_cfApi()}/api/protocols/${id}`, { method: 'PUT', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
      } else {
        const resp = await fetch(`${_cfApi()}/api/protocols`, { method: 'POST', headers: _headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        id = data.id;
        for (const file of pendingPhotos) await _uploadOne(id, file);
        pendingPhotos = [];
      }
      toast(t('hp.toast.saved'));
      closeModal();
      await load();
    } catch (e) {
      toast(t('hp.toast.save.err').replace('{0}', e.message));
    }
  }

  async function _uploadOne(protocolId, file) {
    const fd = new FormData();
    fd.append('file', file);
    const resp = await fetch(`${_cfApi()}/api/protocols/${protocolId}/photo`, { method: 'POST', headers: _headers(), body: fd });
    if (!resp.ok) throw new Error('Upload zdjęcia nie powiódł się');
    return resp.json();
  }

  async function uploadPhotos(input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    if (!editId) {
      pendingPhotos.push(...files);
      toast(t('hp.toast.photos.pending').replace('{0}', files.length));
      input.value = '';
      return;
    }
    try {
      for (const file of files) await _uploadOne(editId, file);
      const resp = await fetch(`${_cfApi()}/api/protocols?company=${encodeURIComponent(_company())}`, { headers: _headers() });
      const fresh = await resp.json();
      list = fresh;
      _renderPhotos(fresh.find(x => x.id === editId)?.photos || []);
      toast(t('hp.toast.photos.added'));
    } catch (e) {
      toast(t('hp.toast.upload.err').replace('{0}', e.message));
    }
    input.value = '';
  }

  async function remove(id) {
    if (!confirm(t('hp.confirm.del'))) return;
    try {
      const resp = await fetch(`${_cfApi()}/api/protocols/${id}`, { method: 'DELETE', headers: _headers() });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      toast(t('hp.toast.deleted'));
      await load();
    } catch (e) {
      toast(t('hp.toast.del.err').replace('{0}', e.message));
    }
  }

  function print(id) {
    const p = list.find(x => x.id === id);
    if (!p) return;
    const w = window.open('', '_blank');
    const equip = (p.wyposazenie || []).map(e => `<li>${e.obecne ? '☑' : '☐'} ${esc(e.nazwa)}</li>`).join('');
    const safeSig = s => s && s.startsWith('data:image/') ? s : null;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Protokół ${esc(p.nr_rej)}</title>
      <style>body{font-family:sans-serif;padding:30px;max-width:700px;margin:0 auto}
      h1{font-size:18px}table{width:100%;border-collapse:collapse;margin:14px 0}
      td{padding:6px 4px;border-bottom:1px solid #ddd;font-size:13px}
      .sig{display:flex;gap:30px;margin-top:30px}.sig img{width:200px;border:1px solid #ccc}</style></head>
      <body>
      <h1>Protokół ${p.typ === 'WYDANIE' ? 'wydania' : 'zdania'} pojazdu ${esc(p.nr_rej)}</h1>
      <table>
        <tr><td>Data</td><td>${p.data ? new Date(p.data).toLocaleDateString('pl-PL') : '—'}</td></tr>
        <tr><td>Osoba wydająca</td><td>${esc(p.osoba_wydajaca || '—')}</td></tr>
        <tr><td>Osoba odbierająca</td><td>${esc(p.osoba_odbierajaca || '—')}</td></tr>
        <tr><td>Stan licznika</td><td>${p.stan_licznika != null ? p.stan_licznika + ' km' : '—'}</td></tr>
        <tr><td>Stan paliwa</td><td>${esc(p.stan_paliwa || '—')}</td></tr>
        <tr><td>Uszkodzenia</td><td>${esc(p.uszkodzenia_opis || 'brak')}</td></tr>
        <tr><td>Uwagi</td><td>${esc(p.uwagi || '—')}</td></tr>
      </table>
      <strong>Wyposażenie:</strong><ul>${equip}</ul>
      <div class="sig">
        <div>Podpis wydającego<br>${safeSig(p.podpis_wydajacy) ? `<img src="${p.podpis_wydajacy}">` : '— brak —'}</div>
        <div>Podpis odbierającego<br>${safeSig(p.podpis_odbierajacy) ? `<img src="${p.podpis_odbierajacy}">` : '— brak —'}</div>
      </div>
      <script>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  return { load, render, openModal, closeModal, save, uploadPhotos, remove, print, addEquip, clearSignature, _toggleEquip, _removeEquip };
})();
