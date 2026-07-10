/**
 * TaxOrder Pro — Moduł Mandatów i Naruszeń
 * Rejestr mandatów per pojazd/kierowca — dane w D1 (wcześniej localStorage)
 */
window.FinesModule = (function () {

  const FINE_TYPES = {
    predkosc:     { label:'Przekroczenie prędkości',    icon:'ti-gauge',          color:'var(--red)' },
    fotoradar:    { label:'Fotoradar / CANARD',          icon:'ti-camera',         color:'var(--red)' },
    parking:      { label:'Nieprawidłowe parkowanie',    icon:'ti-parking',        color:'var(--amber)' },
    sygnalizacja: { label:'Naruszenie sygnalizacji',     icon:'ti-traffic-lights', color:'var(--red)' },
    dokumenty:    { label:'Brak / nieważne dokumenty',   icon:'ti-id',             color:'var(--amber)' },
    itd:          { label:'Kontrola ITD / ważenie',      icon:'ti-truck',          color:'var(--blue)' },
    tachograf:    { label:'Naruszenie czasu jazdy/tacho',icon:'ti-clock',          color:'var(--amber)' },
    masa:         { label:'Przekroczenie masy (DMC)',    icon:'ti-weight',         color:'var(--amber)' },
    ladowanie:    { label:'Nieprawidłowe załadowanie',   icon:'ti-package',        color:'var(--amber)' },
    alkohol:      { label:'Badanie na trzeźwość',        icon:'ti-bottle',         color:'var(--red)' },
    inne:         { label:'Inne naruszenie',             icon:'ti-alert-triangle', color:'#71717a' },
  };

  const LS_KEY = 'taxFines';
  const API     = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const token   = () => localStorage.getItem('cf_token');
  const hdrs    = () => ({ 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}) });
  const company = () => window.currentCompanyId || 'mtoilet';

  let _fines   = [];
  let _loaded  = false;
  let _loading = false;

  function _fmtDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}.${m}.${y}`; }
  function _days(ds) { if (!ds) return null; const d = new Date(ds.includes('T') ? ds : ds + 'T00:00:00'); if (isNaN(d)) return null; const t = new Date(); t.setHours(0,0,0,0); return Math.round((d-t)/86400000); }

  // ── Migracja localStorage → D1 (jednorazowa) ─────────────────────────────
  async function _migrateLocalStorage() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    let old;
    try { old = JSON.parse(raw); } catch { localStorage.removeItem(LS_KEY); return; }
    if (!Array.isArray(old) || !old.length) { localStorage.removeItem(LS_KEY); return; }

    const co = company();
    let migrated = 0;
    for (const f of old) {
      const body = {
        id:          f.id || crypto.randomUUID(),
        nr_rej:      f.nrRej      || null,
        driver_name: f.driverName || null,
        type:        f.type       || 'inne',
        date:        f.date       || new Date().toLocaleDateString('sv'),
        amount:      f.amount     ?? null,
        deadline:    f.deadline   || null,
        description: f.description|| null,
        fine_no:     f.fineNo     || null,
        issuer:      f.issuer     || null,
        points:      f.points     ?? null,
        notes:       f.notes      || null,
        paid:        f.paid ? 1 : 0,
        paid_date:   f.paidDate   || null,
      };
      try {
        const r = await fetch(`${API()}/api/fines?company=${co}`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
        if (r.ok) migrated++;
      } catch { /* network — skip individual record */ }
    }
    if (migrated > 0) {
      localStorage.removeItem(LS_KEY);
      if (typeof toast === 'function') toast(t('fines.toast.migrated').replace('{0}', migrated));
    }
  }

  // ── Ładowanie z API ───────────────────────────────────────────────────────
  // Zawsze ładuje WSZYSTKIE mandaty firmy — filtr per pojazd stosowany w pamięci.
  // Nie przyjmuje nrRej aby uniknąć nadpisania globalnego cache częściowymi danymi.
  async function _load() {
    if (_loading) return;
    _loading = true;
    try {
      await _migrateLocalStorage();
      const r = await fetch(`${API()}/api/fines?company=${company()}&limit=1000`, { headers: hdrs() });
      const d = r.ok ? await r.json() : {};
      _fines  = d.fines || [];
      _loaded = true;
    } catch {
      _fines = [];
    } finally {
      _loading = false;
    }
  }

  // ── Globalne okno ─────────────────────────────────────────────────────────
  async function open() {
    document.getElementById('fines-modal').style.display = 'flex';
    document.getElementById('fines-modal-body').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)"><i class="ti ti-loader-2" style="font-size:28px"></i></div>';
    await _load();
    _render();
  }
  function close() { document.getElementById('fines-modal').style.display = 'none'; }

  function _render() {
    const el = document.getElementById('fines-modal-body');
    if (!el) return;

    const unpaid    = _fines.filter(f => !f.paid);
    const overdue   = unpaid.filter(f => f.deadline && _days(f.deadline) < 0);
    const totalAmt  = _fines.reduce((s, f) => s + (f.amount || 0), 0);
    const unpaidAmt = unpaid.reduce((s, f) => s + (f.amount || 0), 0);

    const cols = ['Nr rej.', 'Kierowca', 'Data', 'Typ', 'Kwota', 'Płatność do', 'Status', ''];
    el.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
        <div class="stat-chip ${overdue.length ? 'stat-chip-amber' : ''}"><span>${_fines.length}</span> mandatów</div>
        <div class="stat-chip ${unpaid.length ? 'stat-chip-amber' : ''}"><span>${unpaid.length}</span> nieopłaconych</div>
        <div class="stat-chip" style="${overdue.length ? 'border-color:var(--red)' : ''}"><span>${overdue.length}</span> po terminie</div>
        <div class="stat-chip stat-chip-amber"><span>${unpaidAmt.toFixed(0)} zł</span> do zapłaty</div>
        <div class="stat-chip"><span>${totalAmt.toFixed(0)} zł</span> łącznie</div>
        <button class="btn btn-blue" style="font-size:11px;margin-left:auto" onclick="FinesModule.add()">
          <i class="ti ti-plus"></i>Dodaj mandat
        </button>
        <button class="btn btn-green" style="font-size:11px" onclick="FinesModule.exportExcel()">
          <i class="ti ti-download"></i>Excel
        </button>
        <button class="btn btn-gray" style="font-size:11px" onclick="exportFinesCsv()" title="Eksportuj mandaty do CSV">
          <i class="ti ti-file-download"></i>CSV
        </button>
      </div>
      ${_fines.length ? `
      <div class="tbl-wrap"><table style="width:100%;font-size:12px">
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>
          ${[..._fines].sort((a, b) => new Date(b.date) - new Date(a.date)).map(f => {
            const t  = FINE_TYPES[f.type] || FINE_TYPES.inne;
            const dl = f.deadline ? _days(f.deadline) : null;
            const paid   = !!f.paid;
            const rowBg  = !paid && dl !== null && dl < 0 ? 'background:rgba(239,68,68,.06)' : '';
            const status = paid
              ? `<span style="color:var(--green);font-size:11px">✓ Zapłacono ${f.paid_date ? _fmtDate(f.paid_date) : ''}</span>`
              : dl !== null
                ? `<span style="color:${dl<0 ? 'var(--red)' : dl<=14 ? 'var(--amber)' : 'var(--text2)'};font-weight:600">${dl<0 ? 'Po terminie '+Math.abs(dl)+' dni' : 'Za '+dl+' dni'}</span>`
                : '<span style="color:var(--text3)">—</span>';
            return `<tr style="${rowBg}">
              <td style="font-family:var(--mono);font-weight:700">${esc(f.nr_rej || '—')}</td>
              <td>${esc(f.driver_name || '—')}</td>
              <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(f.date)}</td>
              <td><span style="color:${t.color}"><i class="ti ${t.icon}"></i> ${t.label}</span></td>
              <td style="font-family:var(--mono);font-weight:700;text-align:right">${f.amount ? f.amount.toFixed(2) + ' zł' : '—'}</td>
              <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(f.deadline)}</td>
              <td>${status}</td>
              <td style="white-space:nowrap">
                ${!paid ? `<button class="btn btn-green" style="font-size:10px;padding:2px 8px" data-id="${esc(f.id)}" onclick="FinesModule.markPaid(this.dataset.id)">Zapłacono</button> ` : ''}
                <button class="btn btn-gray" style="font-size:10px;padding:2px 8px" data-id="${esc(f.id)}" onclick="FinesModule.edit(this.dataset.id)">✏</button>
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
  function edit(fineId) { _showForm(_fines.find(f => f.id === fineId) || null); }

  function _showForm(ex, vehId) {
    const typeOpts = Object.entries(FINE_TYPES).map(([k, t]) =>
      `<option value="${k}" ${(ex?.type || 'predkosc') === k ? 'selected' : ''}>${t.label}</option>`
    ).join('');
    const vehOpts = (window.vehs || []).map(v =>
      `<option value="${esc(v.nrRej)}" ${(ex?.nr_rej || vehId?.toString()) === v.nrRej ? 'selected' : ''}>${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}</option>`
    ).join('');
    const driverOpts = (window.TaxOrderDrivers?.getAll() || []).map(d =>
      `<option value="${esc(d.name)}" ${ex?.driver_name === d.name ? 'selected' : ''}>${esc(d.name)}</option>`
    ).join('');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:540px;max-width:98vw;max-height:92vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-alert-triangle" style="color:var(--red)"></i>${ex ? 'Edytuj' : 'Dodaj'} mandat / naruszenie
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
            <input id="_fn-driver" type="text" class="fi" list="_fn-driver-list" value="${esc(ex?.driver_name || '')}" placeholder="Wybierz lub wpisz">
            <datalist id="_fn-driver-list">${driverOpts}</datalist>
          </div>
          <div class="vdf">
            <label class="vdl">Typ naruszenia *</label>
            <select id="_fn-type" class="fi">${typeOpts}</select>
          </div>
          <div class="vdf">
            <label class="vdl">Data zdarzenia *</label>
            <input id="_fn-date" type="date" class="fi" value="${ex?.date || (d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date())}">
          </div>
          <div class="vdf">
            <label class="vdl">Kwota mandatu (zł)</label>
            <input id="_fn-amount" type="number" step="0.01" class="fi" value="${ex?.amount || ''}">
          </div>
          <div class="vdf">
            <label class="vdl">Termin płatności</label>
            <input id="_fn-deadline" type="date" class="fi" value="${ex?.deadline || ''}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Opis / okoliczności</label>
            <input id="_fn-desc" type="text" class="fi" placeholder="np. Przekroczenie prędkości 70km/h w strefie 50" value="${esc(ex?.description || '')}">
          </div>
          <div class="vdf">
            <label class="vdl">Nr mandatu / serii</label>
            <input id="_fn-no" type="text" class="fi" value="${esc(ex?.fine_no || '')}" placeholder="np. AX12345678">
          </div>
          <div class="vdf">
            <label class="vdl">Wystawił (organ)</label>
            <input id="_fn-issuer" type="text" class="fi" value="${esc(ex?.issuer || '')}" placeholder="np. Policja, ITD, Straż Miejska">
          </div>
          <div class="vdf">
            <label class="vdl">Liczba punktów karnych</label>
            <input id="_fn-points" type="number" min="0" max="15" class="fi" value="${ex?.points || ''}">
          </div>
          <div class="vdf">
            <label class="vdl">Uwagi</label>
            <input id="_fn-notes" type="text" class="fi" value="${esc(ex?.notes || '')}">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          ${ex ? `<button class="btn btn-gray" style="color:var(--red);margin-right:auto" data-id="${esc(ex.id)}" onclick="FinesModule.remove(this.dataset.id,this)"><i class="ti ti-trash"></i>Usuń</button>` : ''}
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-blue" data-id="${esc(ex?.id||'')}" onclick="FinesModule.save(this.dataset.id,this)"><i class="ti ti-check"></i>Zapisz</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }

  async function save(fineId, btn) {
    const g  = id => document.getElementById(id)?.value?.trim() || '';
    const gf = id => { const v = g(id); return v ? parseFloat(v.replace(',', '.')) : null; };
    const gi = id => { const v = g(id); return v ? parseInt(v) : null; };

    if (!g('_fn-date')) { toast(t('fines.toast.date.req')); return; }

    btn.disabled = true;
    const body = {
      nr_rej:      g('_fn-veh')    || null,
      driver_name: g('_fn-driver') || null,
      type:        g('_fn-type')   || 'inne',
      date:        g('_fn-date'),
      amount:      gf('_fn-amount'),
      deadline:    g('_fn-deadline') || null,
      description: g('_fn-desc')   || null,
      fine_no:     g('_fn-no')     || null,
      issuer:      g('_fn-issuer') || null,
      points:      gi('_fn-points'),
      notes:       g('_fn-notes')  || null,
    };

    try {
      let r;
      if (fineId) {
        r = await fetch(`${API()}/api/fines/${fineId}?company=${company()}`, {
          method: 'PUT', headers: hdrs(), body: JSON.stringify(body),
        });
      } else {
        r = await fetch(`${API()}/api/fines?company=${company()}`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
      }
      if (!r.ok) { toast(t('fines.toast.save.err').replace('{0}', r.status)); btn.disabled = false; return; }
      btn.closest('[style*=fixed]').remove();
      toast(t('fines.toast.saved'));
      await _load();
      _render();
      if (typeof renderDash === 'function') renderDash();
    } catch {
      toast(t('fines.toast.conn'));
      btn.disabled = false;
    }
  }

  async function remove(fineId, btn) {
    try {
      const r = await fetch(`${API()}/api/fines/${fineId}?company=${company()}`, {
        method: 'DELETE', headers: hdrs(),
      });
      if (!r.ok) { toast(t('fines.toast.del.err').replace('{0}', r.status)); return; }
      btn.closest('[style*=fixed]').remove();
      toast(t('fines.toast.deleted'));
      await _load();
      _render();
    } catch { toast(t('fines.toast.conn')); }
  }

  async function markPaid(fineId) {
    try {
      const r = await fetch(`${API()}/api/fines/${fineId}?company=${company()}`, {
        method: 'PUT', headers: hdrs(),
        body: JSON.stringify({ paid: 1, paid_date: (d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date()) }),
      });
      if (!r.ok) { toast(t('fines.toast.err').replace('{0}', r.status)); return; }
      toast(t('fines.toast.paid'));
      const f = _fines.find(x => x.id === fineId);
      if (f) { f.paid = 1; f.paid_date = (d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date()); }
      _render();
      if (typeof renderDash === 'function') renderDash();
    } catch { toast(t('fines.toast.conn')); }
  }

  // ── Dla vehicle-detail ────────────────────────────────────────────────────
  async function renderForVehicle(nrRej) {
    await _load();
    const vFines = _fines.filter(f => f.nr_rej === nrRej);
    const cont   = document.getElementById('fines-vehicle-container');

    const html = !vFines.length
      ? `<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
           <button class="btn btn-blue" style="font-size:12px" data-nr="${esc(nrRej)}" onclick="FinesModule.add(this.dataset.nr)"><i class="ti ti-plus"></i>Dodaj mandat</button>
         </div>
         <div style="text-align:center;padding:24px;color:var(--text3)">Brak mandatów dla tego pojazdu.</div>`
      : (() => {
          const unpaid = vFines.filter(f => !f.paid);
          const total  = vFines.reduce((s, f) => s + (f.amount || 0), 0);
          return `
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
              <div class="stat-chip ${unpaid.length ? 'stat-chip-amber' : ''}"><span>${vFines.length}</span> mandatów</div>
              <div class="stat-chip"><span>${total.toFixed(0)} zł</span> łącznie</div>
              ${unpaid.length ? `<div class="stat-chip stat-chip-amber"><span>${unpaid.length}</span> nieopłaconych</div>` : ''}
              <button class="btn btn-blue" style="font-size:12px;margin-left:auto" data-nr="${esc(nrRej)}" onclick="FinesModule.add(this.dataset.nr)"><i class="ti ti-plus"></i>Dodaj</button>
            </div>
            <div class="tbl-wrap"><table style="width:100%;font-size:11px">
              <thead><tr><th>Data</th><th>Typ</th><th>Opis</th><th>Kwota</th><th>Termin</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${[...vFines].sort((a, b) => new Date(b.date) - new Date(a.date)).map(f => {
                  const t  = FINE_TYPES[f.type] || FINE_TYPES.inne;
                  const dl = f.deadline ? _days(f.deadline) : null;
                  return `<tr>
                    <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(f.date)}</td>
                    <td><span style="color:${t.color}"><i class="ti ${t.icon}"></i> ${t.label}</span></td>
                    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.description || '—')}</td>
                    <td style="font-family:var(--mono);font-weight:700">${f.amount ? f.amount.toFixed(2) + ' zł' : '—'}</td>
                    <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(f.deadline)}</td>
                    <td>${f.paid
                      ? `<span style="color:var(--green);font-size:10px">✓ Zapłacono</span>`
                      : `<span style="color:${dl !== null && dl < 0 ? 'var(--red)' : 'var(--amber)'};font-size:10px">${dl !== null && dl < 0 ? 'Po terminie' : 'Do zapłaty'}</span>`}</td>
                    <td style="white-space:nowrap">
                      ${!f.paid ? `<button class="btn btn-green" style="font-size:10px;padding:2px 6px" data-id="${esc(f.id)}" onclick="FinesModule.markPaid(this.dataset.id)">✓</button> ` : ''}
                      <button class="btn btn-gray" style="font-size:10px;padding:2px 6px" data-id="${esc(f.id)}" onclick="FinesModule.edit(this.dataset.id)">✏</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table></div>`;
        })();

    if (cont) { cont.innerHTML = html; } else { return html; }
  }

  // ── Alerty do dashboard ───────────────────────────────────────────────────
  async function getUnpaidAlerts() {
    if (!_loaded) await _load();
    return _fines.filter(f => !f.paid && f.deadline && _days(f.deadline) <= 14);
  }

  function getUnpaidAlertsSync() {
    return _fines.filter(f => !f.paid && f.deadline && _days(f.deadline) <= 14);
  }

  function getAllSync() { return [..._fines]; }

  function exportExcel() {
    if (typeof XLSX === 'undefined') { toast(t('fines.toast.xlsx.na')); return; }
    const headers = ['Nr rej.','Kierowca','Data','Typ','Kwota (zł)','Termin płatności','Zapłacono','Data zapłaty','Opis','Nr mandatu','Wystawił','Punkty'];
    const data = [headers, ..._fines.map(f => [
      f.nr_rej || '', f.driver_name || '', f.date || '',
      FINE_TYPES[f.type]?.label || f.type || '',
      f.amount || '', f.deadline || '', f.paid ? 'TAK' : 'NIE', f.paid_date || '',
      f.description || '', f.fine_no || '', f.issuer || '', f.points || '',
    ])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Mandaty');
    XLSX.writeFile(wb, `mandaty_${new Date().toISOString().slice(0, 7)}.xlsx`);
    toast(t('fines.toast.export.ok'));
  }

  async function getAll() { if (!_loaded) await _load(); return [..._fines]; }

  return { open, close, add, edit, save, remove, markPaid, renderForVehicle, getUnpaidAlerts, getUnpaidAlertsSync, getAllSync, exportExcel, getAll, load: _load, FINE_TYPES };
})();
