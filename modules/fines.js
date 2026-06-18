/**
 * TaxOrder Pro — Moduł Mandatów i Naruszeń
 * Rejestr mandatów per pojazd/kierowca, alerty płatności
 */
window.FinesModule = (function () {

  const FINE_TYPES = {
    predkosc:     { label:'Przekroczenie prędkości',   icon:'ti-gauge',           color:'var(--red)' },
    fotoradar:    { label:'Fotoradar / CANARD',         icon:'ti-camera',          color:'var(--red)' },
    parking:      { label:'Nieprawidłowe parkowanie',   icon:'ti-parking',         color:'var(--amber)' },
    sygnalizacja: { label:'Naruszenie sygnalizacji',    icon:'ti-traffic-lights',  color:'var(--red)' },
    dokumenty:    { label:'Brak / nieważne dokumenty',  icon:'ti-id',              color:'var(--amber)' },
    itd:          { label:'Kontrola ITD / ważenie',     icon:'ti-truck',           color:'var(--blue)' },
    tachograf:    { label:'Naruszenie czasu jazdy/tacho',icon:'ti-clock',          color:'var(--amber)' },
    masa:         { label:'Przekroczenie masy (DMC)',   icon:'ti-weight',          color:'var(--amber)' },
    ladowanie:    { label:'Nieprawidłowe załadowanie',  icon:'ti-package',         color:'var(--amber)' },
    alkohol:      { label:'Badanie na trzeźwość',       icon:'ti-bottle',          color:'var(--red)' },
    inne:         { label:'Inne naruszenie',            icon:'ti-alert-triangle',  color:'#71717a' },
  };

  const KEY = 'taxFines';
  let _fines = [];

  function _load() {
    try { _fines = JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { _fines = []; }
  }
  function _persist() { localStorage.setItem(KEY, JSON.stringify(_fines)); }
  function _mkid() { return String(Date.now()) + String(Math.random()).slice(2,8); }
  function _fmtDate(d) { if (!d) return '—'; const [y,m,dd]=d.split('-'); return `${dd}.${m}.${y}`; }
  function _days(d) { return d ? Math.round((new Date(d)-new Date())/86400000) : null; }

  // ── Globalne okno ─────────────────────────────────────────────────────────
  function open() {
    _load();
    document.getElementById('fines-modal').style.display = 'flex';
    _render();
  }
  function close() { document.getElementById('fines-modal').style.display = 'none'; }

  function _render() {
    const el = document.getElementById('fines-modal-body');
    if (!el) return;
    _load();

    const unpaid   = _fines.filter(f => !f.paid);
    const overdue  = unpaid.filter(f => f.deadline && _days(f.deadline) < 0);
    const totalAmt = _fines.reduce((s,f) => s+(f.amount||0), 0);
    const unpaidAmt = unpaid.reduce((s,f) => s+(f.amount||0), 0);

    const cols = ['Nr rej.','Kierowca','Data','Typ','Kwota','Płatność do','Status',''];
    el.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
        <div class="stat-chip ${overdue.length?'stat-chip-amber':''}"><span>${_fines.length}</span> mandatów</div>
        <div class="stat-chip ${unpaid.length?'stat-chip-amber':''}"><span>${unpaid.length}</span> nieopłaconych</div>
        <div class="stat-chip" style="${overdue.length?'border-color:var(--red)':''}"><span>${overdue.length}</span> po terminie</div>
        <div class="stat-chip stat-chip-amber"><span>${unpaidAmt.toFixed(0)} zł</span> do zapłaty</div>
        <div class="stat-chip"><span>${totalAmt.toFixed(0)} zł</span> łącznie</div>
        <button class="btn btn-blue" style="font-size:11px;margin-left:auto" onclick="FinesModule.add()">
          <i class="ti ti-plus"></i>Dodaj mandat
        </button>
        <button class="btn btn-green" style="font-size:11px" onclick="FinesModule.exportExcel()">
          <i class="ti ti-download"></i>Excel
        </button>
      </div>
      ${_fines.length ? `
      <div class="tbl-wrap"><table style="width:100%;font-size:12px">
        <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>
          ${[..._fines].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(f => {
            const t = FINE_TYPES[f.type] || FINE_TYPES.inne;
            const dl = f.deadline ? _days(f.deadline) : null;
            const isPaid = !!f.paid;
            const rowBg = !isPaid && dl !== null && dl < 0 ? 'background:rgba(239,68,68,.06)' : '';
            const statusHtml = isPaid
              ? `<span style="color:var(--green);font-size:11px">✓ Zapłacono ${f.paidDate?_fmtDate(f.paidDate):''}</span>`
              : dl !== null
                ? `<span style="color:${dl<0?'var(--red)':dl<=7?'var(--red)':dl<=14?'var(--amber)':'var(--text2)'};font-weight:600">${dl<0?'Po terminie '+Math.abs(dl)+' dni':'Za '+dl+' dni'}</span>`
                : '<span style="color:var(--text3)">—</span>';
            return `<tr style="${rowBg}">
              <td style="font-family:var(--mono);font-weight:700">${f.nrRej||'—'}</td>
              <td>${f.driverName||'—'}</td>
              <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(f.date)}</td>
              <td><span style="color:${t.color}"><i class="ti ${t.icon}"></i> ${t.label}</span></td>
              <td style="font-family:var(--mono);font-weight:700;text-align:right">${f.amount?f.amount.toFixed(2)+' zł':'—'}</td>
              <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(f.deadline)}</td>
              <td>${statusHtml}</td>
              <td style="white-space:nowrap">
                ${!isPaid?`<button class="btn btn-green" style="font-size:10px;padding:2px 8px" onclick="FinesModule.markPaid('${f.id}')">Zapłacono</button> `:''}
                <button class="btn btn-gray" style="font-size:10px;padding:2px 8px" onclick="FinesModule.edit('${f.id}')">✏</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>` : `
      <div style="text-align:center;padding:40px;color:var(--text3)">
        <i class="ti ti-check" style="font-size:36px;display:block;margin-bottom:10px;color:var(--green)"></i>
        Brak zarejestrowanych mandatów.
      </div>`}`;
  }

  // ── Dodaj / edytuj ────────────────────────────────────────────────────────
  function add(vehId) { _showForm(null, vehId); }
  function edit(fineId) { _load(); _showForm(_fines.find(f=>f.id===fineId)); }

  function _showForm(ex, vehId) {
    _load();
    const typeOpts = Object.entries(FINE_TYPES).map(([k,t]) =>
      `<option value="${k}" ${(ex?.type||'predkosc')===k?'selected':''}>${t.label}</option>`
    ).join('');
    const vehOpts = (window.vehs||[]).map(v =>
      `<option value="${v.nrRej}" ${(ex?.nrRej||vehId?.toString())===v.nrRej?'selected':''}>${v.nrRej} — ${v.marka} ${v.model}</option>`
    ).join('');
    const driverOpts = (window.TaxOrderDrivers?.getAll()||JSON.parse(localStorage.getItem('taxDrivers')||'[]')).map(d =>
      `<option value="${d.name}" ${ex?.driverName===d.name?'selected':''}>${d.name}</option>`
    ).join('');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:540px;max-width:98vw;max-height:92vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-alert-triangle" style="color:var(--red)"></i>${ex?'Edytuj':'Dodaj'} mandat / naruszenie
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Pojazd *</label>
            <select id="_fn-veh" class="fi">
              <option value="">— brak przypisania —</option>${vehOpts}
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Kierowca</label>
            <input id="_fn-driver" type="text" class="fi" list="_fn-driver-list" value="${ex?.driverName||''}" placeholder="Wybierz lub wpisz">
            <datalist id="_fn-driver-list">${driverOpts}</datalist>
          </div>
          <div class="vdf">
            <label class="vdl">Typ naruszenia *</label>
            <select id="_fn-type" class="fi">${typeOpts}</select>
          </div>
          <div class="vdf">
            <label class="vdl">Data zdarzenia *</label>
            <input id="_fn-date" type="date" class="fi" value="${ex?.date||new Date().toISOString().slice(0,10)}">
          </div>
          <div class="vdf">
            <label class="vdl">Kwota mandatu (zł)</label>
            <input id="_fn-amount" type="number" step="0.01" class="fi" value="${ex?.amount||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Termin płatności</label>
            <input id="_fn-deadline" type="date" class="fi" value="${ex?.deadline||''}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Opis / okoliczności</label>
            <input id="_fn-desc" type="text" class="fi" placeholder="np. Przekroczenie prędkości 70km/h w strefie 50" value="${ex?.description||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Nr mandatu / serii</label>
            <input id="_fn-no" type="text" class="fi" value="${ex?.fineNo||''}" placeholder="np. AX12345678">
          </div>
          <div class="vdf">
            <label class="vdl">Wystawił (organ)</label>
            <input id="_fn-issuer" type="text" class="fi" value="${ex?.issuer||''}" placeholder="np. Policja, ITD, Straż Miejska">
          </div>
          <div class="vdf">
            <label class="vdl">Liczba punktów karnych</label>
            <input id="_fn-points" type="number" min="0" max="15" class="fi" value="${ex?.points||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Uwagi</label>
            <input id="_fn-notes" type="text" class="fi" value="${ex?.notes||''}">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          ${ex?`<button class="btn btn-gray" style="color:var(--red);margin-right:auto" onclick="FinesModule.remove('${ex.id}',this)"><i class="ti ti-trash"></i>Usuń</button>`:''}
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-blue" onclick="FinesModule.save('${ex?.id||''}',this)"><i class="ti ti-check"></i>Zapisz</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }

  function save(fineId, btn) {
    _load();
    const g  = id => document.getElementById(id)?.value?.trim()||'';
    const gf = id => { const v=g(id); return v?parseFloat(v.replace(',','.')):null; };
    const gi = id => { const v=g(id); return v?parseInt(v):null; };

    const record = {
      id: fineId || _mkid(),
      nrRej:      g('_fn-veh'),
      driverName: g('_fn-driver'),
      type:       g('_fn-type'),
      date:       g('_fn-date'),
      amount:     gf('_fn-amount'),
      deadline:   g('_fn-deadline'),
      description:g('_fn-desc'),
      fineNo:     g('_fn-no'),
      issuer:     g('_fn-issuer'),
      points:     gi('_fn-points'),
      notes:      g('_fn-notes'),
      paid:       fineId ? (_fines.find(f=>f.id===fineId)?.paid||false) : false,
      createdAt:  new Date().toISOString(),
    };

    if (!record.date) { toast('⚠ Podaj datę zdarzenia'); return; }
    const idx = _fines.findIndex(f=>f.id===fineId);
    if (fineId && idx>=0) _fines[idx]=record; else _fines.push(record);
    _persist();
    btn.closest('[style*=fixed]').remove();
    toast('✓ Mandat zapisany');
    _render();
    if (typeof renderDash==='function') renderDash();
  }

  function remove(fineId, btn) {
    _load();
    _fines = _fines.filter(f=>f.id!==fineId);
    _persist();
    btn.closest('[style*=fixed]').remove();
    toast('Mandat usunięty');
    _render();
  }

  function markPaid(fineId) {
    _load();
    const f = _fines.find(x=>x.id===fineId);
    if (f) { f.paid=true; f.paidDate=new Date().toISOString().slice(0,10); }
    _persist();
    toast('✓ Mandat oznaczony jako zapłacony');
    _render();
    if (typeof renderDash==='function') renderDash();
  }

  // ── Dla vehicle-detail ────────────────────────────────────────────────────
  function renderForVehicle(nrRej) {
    _load();
    const vFines = _fines.filter(f=>f.nrRej===nrRej);
    if (!vFines.length) return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-blue" style="font-size:12px" onclick="FinesModule.add('${nrRej}')"><i class="ti ti-plus"></i>Dodaj mandat</button>
      </div>
      <div style="text-align:center;padding:24px;color:var(--text3)">Brak mandatów dla tego pojazdu.</div>`;
    const unpaid = vFines.filter(f=>!f.paid);
    const total  = vFines.reduce((s,f)=>s+(f.amount||0),0);
    return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <div class="stat-chip ${unpaid.length?'stat-chip-amber':''}"><span>${vFines.length}</span> mandatów</div>
        <div class="stat-chip"><span>${total.toFixed(0)} zł</span> łącznie</div>
        ${unpaid.length?`<div class="stat-chip stat-chip-amber"><span>${unpaid.length}</span> nieopłaconych</div>`:''}
        <button class="btn btn-blue" style="font-size:12px;margin-left:auto" onclick="FinesModule.add('${nrRej}')"><i class="ti ti-plus"></i>Dodaj</button>
      </div>
      <div class="tbl-wrap"><table style="width:100%;font-size:11px">
        <thead><tr><th>Data</th><th>Typ</th><th>Opis</th><th>Kwota</th><th>Termin</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${[...vFines].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(f=>{
            const t=FINE_TYPES[f.type]||FINE_TYPES.inne;
            const dl=f.deadline?_days(f.deadline):null;
            return `<tr>
              <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(f.date)}</td>
              <td><span style="color:${t.color}"><i class="ti ${t.icon}"></i> ${t.label}</span></td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.description||'—'}</td>
              <td style="font-family:var(--mono);font-weight:700">${f.amount?f.amount.toFixed(2)+' zł':'—'}</td>
              <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(f.deadline)}</td>
              <td>${f.paid?`<span style="color:var(--green);font-size:10px">✓ Zapłacono</span>`:`<span style="color:${dl!==null&&dl<0?'var(--red)':'var(--amber)'};font-size:10px">${dl!==null&&dl<0?'Po terminie':'Do zapłaty'}</span>`}</td>
              <td style="white-space:nowrap">
                ${!f.paid?`<button class="btn btn-green" style="font-size:10px;padding:2px 6px" onclick="FinesModule.markPaid('${f.id}')">✓</button> `:''}
                <button class="btn btn-gray" style="font-size:10px;padding:2px 6px" onclick="FinesModule.edit('${f.id}')">✏</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
  }

  // ── Alerty do dashboard ───────────────────────────────────────────────────
  function getUnpaidAlerts() {
    _load();
    return _fines.filter(f => !f.paid && f.deadline && _days(f.deadline) <= 14);
  }

  function exportExcel() {
    if (typeof XLSX==='undefined') { toast('⚠ Brak XLSX'); return; }
    _load();
    const headers = ['Nr rej.','Kierowca','Data','Typ','Kwota (zł)','Termin płatności','Zapłacono','Data zapłaty','Opis','Nr mandatu','Wystawił','Punkty'];
    const data = [headers, ..._fines.map(f=>[
      f.nrRej||'', f.driverName||'', f.date||'',
      FINE_TYPES[f.type]?.label||f.type||'',
      f.amount||'', f.deadline||'', f.paid?'TAK':'NIE', f.paidDate||'',
      f.description||'', f.fineNo||'', f.issuer||'', f.points||'',
    ])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Mandaty');
    XLSX.writeFile(wb, `mandaty_${new Date().toISOString().slice(0,7)}.xlsx`);
    toast('✓ Eksport mandatów gotowy');
  }

  return { open, close, add, edit, save, remove, markPaid, renderForVehicle, getUnpaidAlerts, exportExcel, FINE_TYPES };
})();
