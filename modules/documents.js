/**
 * TaxOrder Pro — Moduł Dokumentów
 * Przechowywanie metadanych dokumentów per pojazd (linki, daty ważności)
 */
window.DocumentsModule = (function () {

  const DOC_TYPES = {
    oc:          { label:'Polisa OC',                 icon:'ti-shield',           color:'var(--green)' },
    ac:          { label:'Polisa AC / CASCO',         icon:'ti-shield-check',     color:'var(--blue)' },
    nnw:         { label:'Polisa NNW',                icon:'ti-shield-half',      color:'var(--blue)' },
    cargo:       { label:'Ubezpieczenie cargo',       icon:'ti-package',          color:'var(--blue)' },
    przeglad:    { label:'Protokół przeglądu tech.', icon:'ti-clipboard-check',  color:'var(--amber)' },
    udt:         { label:'Protokół UDT',             icon:'ti-crane',            color:'var(--amber)' },
    adr:         { label:'Świadectwo ADR',            icon:'ti-alert-triangle',   color:'var(--red)' },
    tachograf:   { label:'Karta cecho. tachografu',  icon:'ti-clock',            color:'var(--amber)' },
    reg:         { label:'Dowód rejestracyjny',      icon:'ti-id',               color:'var(--text2)' },
    faktura:     { label:'Faktura zakupu',            icon:'ti-receipt',          color:'var(--text2)' },
    leasing:     { label:'Umowa leasingowa',          icon:'ti-file-description', color:'var(--blue)' },
    najem:       { label:'Umowa najmu',               icon:'ti-writing',          color:'var(--blue)' },
    upoważ:      { label:'Upoważnienie do pojazdu',  icon:'ti-user-check',       color:'var(--text2)' },
    dtreport:    { label:'Deklaracja DT-1',          icon:'ti-calculator',       color:'var(--blue)' },
    inne:        { label:'Inny dokument',             icon:'ti-file',             color:'var(--text3)' },
  };

  function _mkid() { return String(Date.now()) + String(Math.random()).slice(2,8); }
  function _fmtDate(d) { if (!d) return '—'; const [y,m,dd]=d.split('-'); return `${dd}.${m}.${y}`; }
  function _days(d) { return d ? Math.round((new Date(d)-new Date())/86400000) : null; }

  // ── Render dla vehicle-detail tab ─────────────────────────────────────────
  function renderForVehicle(v) {
    const docs = v.documents || [];
    const typeOpts = Object.entries(DOC_TYPES).map(([k,t]) =>
      `<option value="${k}">${t.label}</option>`
    ).join('');

    return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <div class="stat-chip"><span>${docs.length}</span> dokumentów</div>
        ${docs.filter(d=>d.expiry&&_days(d.expiry)<=30&&_days(d.expiry)>=0).length
          ? `<div class="stat-chip stat-chip-amber"><span>${docs.filter(d=>d.expiry&&_days(d.expiry)<=30&&_days(d.expiry)>=0).length}</span> wygasają wkrótce</div>` : ''}
        <button class="btn btn-blue" style="font-size:12px;margin-left:auto" onclick="DocumentsModule.add('${v.id}')">
          <i class="ti ti-plus"></i>Dodaj dokument
        </button>
      </div>
      ${docs.length ? `
      <div class="tbl-wrap"><table style="width:100%;font-size:11px">
        <thead><tr><th>Typ</th><th>Nazwa / opis</th><th>Wystawiony</th><th>Ważny do</th><th>Link/URL</th><th></th></tr></thead>
        <tbody>
          ${[...docs].sort((a,b)=>(a.expiry||'9999')>(b.expiry||'9999')?1:-1).map(d => {
            const t = DOC_TYPES[d.type] || DOC_TYPES.inne;
            const dl = d.expiry ? _days(d.expiry) : null;
            const expiryColor = dl===null?'var(--text3)':dl<0?'var(--red)':dl<=14?'var(--red)':dl<=30?'var(--amber)':'var(--green)';
            return `<tr>
              <td><span style="color:${t.color}"><i class="ti ${t.icon}"></i> ${t.label}</span></td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${d.name||'—'}</td>
              <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(d.issued)}</td>
              <td style="font-family:var(--mono);white-space:nowrap;color:${expiryColor};font-weight:${dl!==null&&dl<=30?'700':'400'}">
                ${d.expiry ? _fmtDate(d.expiry)+(dl!==null?` (${dl<0?Math.abs(dl)+' dni temu':'za '+dl+' dni'})`:'') : '—'}
              </td>
              <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis">
                ${d.url ? `<a href="${d.url}" target="_blank" style="color:var(--blue);font-size:10px"><i class="ti ti-external-link"></i> Otwórz</a>` : '—'}
              </td>
              <td style="white-space:nowrap">
                <button class="btn btn-gray" style="font-size:10px;padding:2px 6px" onclick="DocumentsModule.edit('${v.id}','${d.id}')">✏</button>
                <button class="btn btn-gray" style="font-size:10px;padding:2px 6px;color:var(--red)" onclick="DocumentsModule.remove('${v.id}','${d.id}',this)"><i class="ti ti-trash"></i></button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>` : `
      <div style="text-align:center;padding:24px;color:var(--text3)">
        <i class="ti ti-files" style="font-size:32px;display:block;margin-bottom:8px"></i>
        Brak dokumentów dla tego pojazdu.
      </div>`}`;
  }

  // ── Dodaj / edytuj ────────────────────────────────────────────────────────
  function add(vehId) { _showForm(vehId, null); }
  function edit(vehId, docId) {
    const v = (window.vehs||[]).find(x=>x.id===vehId||x.id==vehId);
    if (!v) return;
    const d = (v.documents||[]).find(x=>x.id===docId||x.id==docId);
    if (!d) return;
    _showForm(vehId, d);
  }

  function _showForm(vehId, ex) {
    const typeOpts = Object.entries(DOC_TYPES).map(([k,t]) =>
      `<option value="${k}" ${(ex?.type||'inne')===k?'selected':''}>${t.label}</option>`
    ).join('');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:520px;max-width:98vw;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-files" style="color:var(--blue)"></i>${ex?'Edytuj':'Dodaj'} dokument
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Typ dokumentu *</label>
            <select id="_doc-type" class="fi">${typeOpts}</select>
          </div>
          <div class="vdf">
            <label class="vdl">Nazwa / opis *</label>
            <input id="_doc-name" type="text" class="fi" placeholder="np. OC PZU 2025/26" value="${ex?.name||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Data wystawienia</label>
            <input id="_doc-issued" type="date" class="fi" value="${ex?.issued||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Ważny do</label>
            <input id="_doc-expiry" type="date" class="fi" value="${ex?.expiry||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Numer dokumentu</label>
            <input id="_doc-number" type="text" class="fi" placeholder="np. PZU/2025/001234" value="${ex?.docNumber||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Towarzystwo / wystawca</label>
            <input id="_doc-issuer" type="text" class="fi" placeholder="np. PZU S.A." value="${ex?.issuer||''}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Link / URL (skan, chmura)</label>
            <input id="_doc-url" type="url" class="fi" placeholder="https://drive.google.com/..." value="${ex?.url||''}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Uwagi</label>
            <input id="_doc-notes" type="text" class="fi" value="${ex?.notes||''}">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-blue" onclick="DocumentsModule.save('${vehId}','${ex?.id||''}',this)">
            <i class="ti ti-check"></i>Zapisz
          </button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }

  async function save(vehId, docId, btn) {
    const g  = id => document.getElementById(id)?.value?.trim()||'';
    const v  = (window.vehs||[]).find(x=>String(x.id)===String(vehId));
    if (!v) return;

    const name = g('_doc-name');
    if (!name) { toast('⚠ Podaj nazwę dokumentu'); return; }

    if (!v.documents) v.documents = [];
    const record = {
      id:         docId || _mkid(),
      type:       g('_doc-type'),
      name,
      issued:     g('_doc-issued'),
      expiry:     g('_doc-expiry'),
      docNumber:  g('_doc-number'),
      issuer:     g('_doc-issuer'),
      url:        g('_doc-url'),
      notes:      g('_doc-notes'),
      createdAt:  new Date().toISOString(),
    };

    const idx = v.documents.findIndex(d=>d.id===docId||d.id==docId);
    if (docId && idx>=0) v.documents[idx]=record; else v.documents.push(record);

    btn.disabled=true; btn.textContent='Zapisuję…';
    try {
      if (window.TaxOrderFleetCloud?.saveVehicle) await window.TaxOrderFleetCloud.saveVehicle(v);
      else localStorage.setItem('taxVehicles', JSON.stringify(window.vehs||[]));
      toast('✓ Dokument zapisany');
      btn.closest('[style*=fixed]').remove();
      if (window.TaxOrderVehicleDetail?.refresh) window.TaxOrderVehicleDetail.refresh(vehId);
    } catch(e) {
      toast('⚠ Błąd zapisu: '+e.message);
      btn.disabled=false; btn.textContent='Zapisz';
    }
  }

  async function remove(vehId, docId, btn) {
    const v = (window.vehs||[]).find(x=>String(x.id)===String(vehId));
    if (!v) return;
    v.documents = (v.documents||[]).filter(d=>d.id!==docId&&d.id!=docId);
    btn.disabled=true;
    try {
      if (window.TaxOrderFleetCloud?.saveVehicle) await window.TaxOrderFleetCloud.saveVehicle(v);
      else localStorage.setItem('taxVehicles', JSON.stringify(window.vehs||[]));
      toast('Dokument usunięty');
      if (window.TaxOrderVehicleDetail?.refresh) window.TaxOrderVehicleDetail.refresh(vehId);
    } catch(e) {
      toast('⚠ Błąd: '+e.message);
      btn.disabled=false;
    }
  }

  // ── Alerty dla notifications ───────────────────────────────────────────────
  function getDocAlerts(v, days=30) {
    return (v.documents||[])
      .filter(d => d.expiry && _days(d.expiry) !== null && _days(d.expiry) <= days)
      .map(d => ({ field:'doc_'+d.id, label:(DOC_TYPES[d.type]?.label||'Dokument')+': '+d.name, date:d.expiry }));
  }

  return { DOC_TYPES, renderForVehicle, add, edit, save, remove, getDocAlerts };
})();
