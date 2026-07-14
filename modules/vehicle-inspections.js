(function () {
  'use strict';

  const API = window.WORKER_URL || '';
  const co  = () => localStorage.getItem('currentCompany') || '';

  const STATUS_ICON = { ok: '✅', warning: '⚠️', fail: '❌' };
  const STATUS_CLR  = { ok: '#22c55e', warning: '#f59e0b', fail: '#ef4444' };

  const DEFAULT_CHECKLIST = [
    'Światła przednie', 'Światła tylne', 'Hamulce (efektywność)', 'Hamulec ręczny',
    'Opony (zużycie i ciśnienie)', 'Szyba (pęknięcia)', 'Wycieraczki', 'Płyny eksploatacyjne',
    'Pas bezpieczeństwa', 'Gaśnica / apteczka', 'Trójkąt ostrzegawczy', 'Karoseria (uszkodzenia)',
    'Układ kierowniczy', 'Silnik (wycieki)', 'Skrzynia biegów', 'Układ wydechowy',
  ];

  async function api(path, opts = {}) {
    const r = await fetch(`${API}/api/vehicle-inspections${path}?company=${co()}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      ...opts,
    });
    return r.json();
  }

  function renderVehicleInspections() {
    const el = document.getElementById('page-vehicle-inspections');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-clipboard-check"></i> Inspekcje Pojazdów</h2>
        <button class="btn btn-primary" onclick="window.VehicleInspections._openModal()"><i class="ti ti-plus"></i> Nowa inspekcja</button>
      </div>
      <div class="ksef-filters" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="insp-search-reg" class="form-control" style="width:180px" placeholder="Nr rej." oninput="window.VehicleInspections._load()">
        <select id="insp-filter-status" class="form-control" style="width:160px" onchange="window.VehicleInspections._load()">
          <option value="">Wszystkie statusy</option>
          <option value="ok">OK</option>
          <option value="warning">Uwagi</option>
          <option value="fail">Niezdatny</option>
        </select>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Pojazd</th><th>Data inspekcji</th><th>Inspektor</th><th>Przebieg (km)</th><th>Wynik</th><th>Zdjęcia</th><th>Następna</th><th>Akcje</th></tr></thead>
        <tbody id="insp-tbody"><tr><td colspan="8" class="loading-row">Ładowanie...</td></tr></tbody>
      </table></div>
      <div id="insp-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.VehicleInspections._closeModal()">
        <div class="modal-box" style="max-width:700px;max-height:90vh;overflow-y:auto">
          <div class="modal-header"><h3 id="insp-modal-title">Inspekcja pojazdu</h3><button class="modal-close" onclick="window.VehicleInspections._closeModal()">×</button></div>
          <div class="modal-body" id="insp-modal-body"></div>
        </div>
      </div>`;
    _load();
  }

  async function _load() {
    const reg    = document.getElementById('insp-search-reg')?.value || '';
    const status = document.getElementById('insp-filter-status')?.value || '';
    const tbody  = document.getElementById('insp-tbody');
    if (!tbody) return;
    const data = await api(`?reg=${encodeURIComponent(reg)}&status=${status}`);
    const list = data.inspections || [];
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Brak inspekcji</td></tr>'; return; }
    tbody.innerHTML = list.map(ins => {
      const photos = _safeJson(ins.photo_urls, []);
      return `<tr>
        <td><strong>${esc(ins.vehicle_reg || '—')}</strong></td>
        <td>${esc(ins.inspection_date?.slice(0,10) || '—')}</td>
        <td>${esc(ins.inspector_name || '—')}</td>
        <td style="text-align:right">${ins.mileage_km != null ? esc(String(ins.mileage_km)) : '—'}</td>
        <td><span style="color:${STATUS_CLR[ins.overall_status]||'#999'}">${STATUS_ICON[ins.overall_status]||'?'} ${esc(ins.overall_status || '—')}</span></td>
        <td>${photos.length ? `<span title="${photos.length} zdjęć">📷 ${photos.length}</span>` : '—'}</td>
        <td>${ins.next_inspection_date ? esc(ins.next_inspection_date.slice(0,10)) : '—'}</td>
        <td>
          <button class="btn-icon" title="Podgląd" data-id="${esc(ins.id)}" onclick="window.VehicleInspections._openModal(this.dataset.id)"><i class="ti ti-eye"></i></button>
          <button class="btn-icon" title="Drukuj" data-id="${esc(ins.id)}" onclick="window.VehicleInspections._print(this.dataset.id)"><i class="ti ti-printer"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(ins.id)}" onclick="window.VehicleInspections._delete(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  async function _openModal(id) {
    const modal = document.getElementById('insp-modal');
    const body  = document.getElementById('insp-modal-body');
    const title = document.getElementById('insp-modal-title');
    let ins = { checklist: DEFAULT_CHECKLIST.map(item => ({ item, status: 'ok', note: '' })) };
    if (id) {
      const d = await api(`/${id}`);
      ins = d.inspection || ins;
      ins.checklist = _safeJson(ins.checklist, ins.checklist);
    }
    title.textContent = id ? 'Edytuj inspekcję' : 'Nowa inspekcja';
    const checklistRows = ins.checklist.map((c, i) => `
      <tr>
        <td>${esc(typeof c === 'object' ? c.item : c)}</td>
        <td>
          <select class="form-control" name="cl_status_${i}" style="width:110px">
            ${['ok','warning','fail'].map(s=>`<option value="${s}" ${(c.status||'ok')===s?'selected':''}>${s==='ok'?'✅ OK':s==='warning'?'⚠️ Uwagi':'❌ Niezd.'}</option>`).join('')}
          </select>
        </td>
        <td><input class="form-control" name="cl_note_${i}" placeholder="Uwaga..." value="${esc(c.note||'')}"></td>
      </tr>`).join('');
    const photoUrls = _safeJson(ins.photo_urls, []);
    body.innerHTML = `
      <form id="insp-form" onsubmit="window.VehicleInspections._save(event,'${esc(id||'')}',${ins.checklist.length})">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row"><label>Nr rejestracyjny</label><input name="vehicle_reg" class="form-control" required value="${esc(ins.vehicle_reg||'')}"></div>
          <div class="form-row"><label>Data inspekcji *</label><input name="inspection_date" type="date" class="form-control" required value="${esc(ins.inspection_date?.slice(0,10)||new Date().toISOString().slice(0,10))}"></div>
          <div class="form-row"><label>Inspektor</label><input name="inspector_name" class="form-control" value="${esc(ins.inspector_name||'')}"></div>
          <div class="form-row"><label>Przebieg (km)</label><input name="mileage_km" type="number" class="form-control" value="${ins.mileage_km??''}"></div>
          <div class="form-row"><label>Wynik ogólny</label>
            <select name="overall_status" class="form-control">
              ${['ok','warning','fail'].map(s=>`<option value="${s}" ${ins.overall_status===s?'selected':''}>${STATUS_ICON[s]} ${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Następna inspekcja</label><input name="next_inspection_date" type="date" class="form-control" value="${esc(ins.next_inspection_date?.slice(0,10)||'')}"></div>
        </div>
        <h4 style="margin:16px 0 8px">Lista kontrolna</h4>
        <div style="overflow-x:auto"><table class="data-table" style="font-size:0.85em">
          <thead><tr><th>Punkt</th><th>Status</th><th>Uwaga</th></tr></thead>
          <tbody>${checklistRows}</tbody>
        </table></div>
        ${photoUrls.length ? `<div style="margin-top:12px"><b>Zdjęcia (${photoUrls.length})</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${photoUrls.map(u=>`<img src="${esc(u)}" style="height:80px;border-radius:4px;object-fit:cover">`).join('')}</div></div>` : ''}
        <div class="form-row" style="margin-top:12px"><label>URL zdjęć (R2, po przecinku)</label><input name="photo_urls_raw" class="form-control" placeholder="https://..." value="${esc(photoUrls.join(', '))}"></div>
        <div class="form-row"><label>Uwagi ogólne</label><textarea name="notes" class="form-control" rows="2">${esc(ins.notes||'')}</textarea></div>
        <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.VehicleInspections._closeModal()">Anuluj</button><button type="submit" class="btn btn-primary">Zapisz</button></div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _save(e, id, clLen) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    const checklist = [];
    for (let i = 0; i < clLen; i++) {
      const item = DEFAULT_CHECKLIST[i] || `Punkt ${i+1}`;
      checklist.push({ item, status: fd.get(`cl_status_${i}`) || 'ok', note: fd.get(`cl_note_${i}`) || '' });
    }
    const rawPhotos = (body.photo_urls_raw || '').split(',').map(s => s.trim()).filter(Boolean);
    const invalidPhoto = rawPhotos.find(u => u && !u.startsWith('https://'));
    if (invalidPhoto) { alert('URL zdjęcia musi zaczynać się od https://'); return; }
    body.checklist = JSON.stringify(checklist);
    body.photo_urls = JSON.stringify(rawPhotos);
    delete body.photo_urls_raw;
    Object.keys(body).forEach(k => { if (k.startsWith('cl_')) delete body[k]; });
    const method = id ? 'PUT' : 'POST';
    const path   = id ? `/${id}` : '';
    await api(path, { method, body: JSON.stringify(body) });
    _closeModal();
    _load();
  }

  async function _print(id) {
    const d = await api(`/${id}`);
    const ins = d.inspection || {};
    const cl = _safeJson(ins.checklist, []);
    const w = window.open('', '_blank');
    w.document.write(`<html><body style="font-family:sans-serif;padding:20px">
      <h2>Protokół Inspekcji Pojazdu</h2>
      <p><b>Pojazd:</b> ${esc(ins.vehicle_reg||'')} | <b>Data:</b> ${esc(ins.inspection_date?.slice(0,10)||'')} | <b>Inspektor:</b> ${esc(ins.inspector_name||'')}</p>
      <p><b>Przebieg:</b> ${ins.mileage_km ?? '—'} km | <b>Wynik:</b> ${esc(ins.overall_status||'')} | <b>Następna:</b> ${esc(ins.next_inspection_date?.slice(0,10)||'—')}</p>
      <table border="1" cellpadding="5" style="width:100%;border-collapse:collapse">
        <tr style="background:#f0f0f0"><th>Punkt kontrolny</th><th>Status</th><th>Uwaga</th></tr>
        ${cl.map(c=>`<tr><td>${esc(c.item)}</td><td>${esc(c.status)}</td><td>${esc(c.note||'')}</td></tr>`).join('')}
      </table>
      ${ins.notes ? `<p><b>Uwagi:</b> ${esc(ins.notes)}</p>` : ''}
    </body></html>`);
    w.print();
  }

  async function _delete(id) {
    if (!confirm('Usunąć inspekcję?')) return;
    await api(`/${id}`, { method: 'DELETE' });
    _load();
  }

  function _closeModal() {
    const m = document.getElementById('insp-modal');
    if (m) m.style.display = 'none';
  }

  function _safeJson(val, def) {
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return def; }
  }

  window.VehicleInspections = { renderVehicleInspections, _load, _openModal, _save, _print, _delete, _closeModal };
})();
