(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtDT = s => s ? s.replace('T',' ').slice(0,16) : '—';

  const CAT_LBL  = { vehicle_check:'Kontrola pojazdu', incident:'Zdarzenie', delivery:'Dostawa', general:'Ogólny' };
  const CAT_ICON = { vehicle_check:'ti-car', incident:'ti-alert-triangle', delivery:'ti-package', general:'ti-forms' };
  const FIELD_TYPES = [
    { v:'text',     l:'Tekst (jednoliniowy)' },
    { v:'textarea', l:'Tekst (wieloliniowy)' },
    { v:'number',   l:'Liczba' },
    { v:'select',   l:'Lista wyboru' },
    { v:'checkbox', l:'Tak / Nie' },
    { v:'date',     l:'Data' },
    { v:'photo',    l:'Zdjęcie' },
  ];

  let _templates    = [];
  let _submissions  = [];
  let _editFields   = [];
  let _activeTab    = 'templates';

  async function renderSmartForms() {
    const co = Co();
    try {
      const [tR, sR] = await Promise.all([
        fetch(`${API()}/api/smart-forms?company=${encodeURIComponent(co)}`, { headers: H() }),
        fetch(`${API()}/api/smart-forms/submissions?company=${encodeURIComponent(co)}&limit=50`, { headers: H() }),
      ]);
      if (tR.ok) _templates = await tR.json();
      if (sR.ok) _submissions = await sR.json();
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-smart-forms');
    if (!el) return;
    el.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
  <h2 style="margin:0;font-size:18px"><i class="ti ti-forms"></i> Smart Forms — formularze terenowe</h2>
  <button class="btn btn-primary" onclick="window.SmartForms._openBuilder()"><i class="ti ti-plus"></i> Nowy formularz</button>
</div>

<div style="display:flex;gap:4px;margin-bottom:16px">
  ${['templates','submissions'].map(t=>`<button class="btn${_activeTab===t?' btn-primary':''}" onclick="window.SmartForms._tab('${t}')">
    <i class="ti ${t==='templates'?'ti-template':'ti-inbox'}"></i>
    ${t==='templates'?'Szablony ('+_templates.length+')':'Wypełnione ('+_submissions.length+')'}
  </button>`).join('')}
</div>

<div id="sf-tab">${_renderTab()}</div>

<!-- Modal -->
<div id="sf-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">
  <div id="sf-modal-inner" style="background:var(--bg);border-radius:12px;padding:24px;width:min(700px,96vw);max-height:90vh;overflow-y:auto"></div>
</div>`;
  }

  function _tab(tab) {
    _activeTab = tab;
    const el = document.getElementById('sf-tab');
    if (el) el.innerHTML = _renderTab();
  }

  function _renderTab() {
    return _activeTab === 'templates' ? _renderTemplates() : _renderSubmissions();
  }

  function _renderTemplates() {
    if (!_templates.length) return `<div style="padding:40px;text-align:center;background:var(--bg2);border-radius:12px">
      <i class="ti ti-forms" style="font-size:40px;color:var(--text3)"></i>
      <p style="color:var(--text3)">Brak szablonów. Utwórz pierwszy formularz klikając "Nowy formularz".</p>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        ${Object.entries(CAT_LBL).map(([k,l])=>`<button class="btn btn-sm" onclick="window.SmartForms._quickCreate('${k}')">
          <i class="ti ${CAT_ICON[k]}"></i> ${l}</button>`).join('')}
      </div>
    </div>`;

    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
    ${_templates.map(t => `
    <div style="background:var(--bg2);border-radius:10px;padding:16px;border-top:3px solid #2563eb">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <i class="ti ${CAT_ICON[t.category]||'ti-forms'}" style="color:#2563eb"></i>
            <strong style="font-size:14px">${e(t.name)}</strong>
          </div>
          <div style="font-size:11px;color:var(--text3)">${CAT_LBL[t.category]||e(t.category)} · ${(t.fields||[]).length} pól</div>
          ${t.description?`<div style="font-size:12px;color:var(--text3);margin-top:4px">${e(t.description)}</div>`:''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm" data-id="${e(t.id)}" onclick="window.SmartForms._openFill(this.dataset.id)" title="Wypełnij"><i class="ti ti-pencil"></i></button>
          <button class="btn btn-sm" data-id="${e(t.id)}" onclick="window.SmartForms._editTemplate(this.dataset.id)" title="Edytuj"><i class="ti ti-settings"></i></button>
          <button class="btn btn-sm" data-id="${e(t.id)}" onclick="window.SmartForms._delTemplate(this.dataset.id)" title="Usuń" style="color:#dc2626"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${t.require_signature?'<span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:6px"><i class="ti ti-signature"></i> Podpis</span>':''}
        ${t.require_photo?'<span style="font-size:10px;background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:6px"><i class="ti ti-camera"></i> Zdjęcie</span>':''}
      </div>
      <button class="btn btn-sm" data-id="${e(t.id)}" onclick="window.SmartForms._showSubs(this.dataset.id)" style="margin-top:8px;width:100%;font-size:11px">
        <i class="ti ti-inbox"></i> Historia wypełnień
      </button>
    </div>`).join('')}
    </div>`;
  }

  function _renderSubmissions() {
    if (!_submissions.length) return `<div style="padding:30px;text-align:center;color:var(--text3)">Brak wypełnionych formularzy.</div>`;
    return `<div style="overflow-x:auto"><table class="tach-table">
      <thead><tr><th>Data</th><th>Formularz</th><th>Pojazd</th><th>Kierowca</th><th>Wypełnił</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${_submissions.map(s=>`<tr>
          <td style="font-size:12px">${fmtDT(s.submitted_at)}</td>
          <td style="font-weight:600">${e(s.template_name||'—')}</td>
          <td style="font-size:12px">${e(s.vehicle_reg||'—')}</td>
          <td style="font-size:12px">${e(s.driver_name||'—')}</td>
          <td style="font-size:12px">${e(s.submitted_by||'—')}</td>
          <td><span style="font-size:11px;padding:2px 8px;border-radius:8px;font-weight:600;
            background:${s.status==='action_required'?'#fee2e2':s.status==='reviewed'?'#dcfce7':'#e0f2fe'};
            color:${s.status==='action_required'?'#dc2626':s.status==='reviewed'?'#16a34a':'#0369a1'}">
            ${e(s.status)}</span></td>
          <td><button class="btn btn-sm" data-id="${e(s.id)}" onclick="window.SmartForms._viewSub(this.dataset.id)"><i class="ti ti-eye"></i></button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  function _openBuilder(tmpl = null) {
    _editFields = tmpl ? [...(tmpl.fields||[])] : [];
    const inner = document.getElementById('sf-modal-inner');
    const m     = document.getElementById('sf-modal');
    if (!inner||!m) return;
    _renderBuilder(inner, tmpl);
    m.style.display = 'flex';
  }

  function _renderBuilder(inner, tmpl) {
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0">${tmpl?'Edytuj formularz':'Nowy formularz'}</h3>
  <button onclick="window.SmartForms._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
  <div style="grid-column:1/-1">
    <label style="font-size:12px;color:var(--text3)">Nazwa formularza *</label><br>
    <input type="text" id="sf-name" class="sel" placeholder="np. Kontrola pojazdu przed wyjazdem" value="${e(tmpl?.name||'')}">
  </div>
  <div>
    <label style="font-size:12px;color:var(--text3)">Kategoria</label><br>
    <select id="sf-cat" class="sel">
      ${Object.entries(CAT_LBL).map(([k,l])=>`<option value="${k}" ${tmpl?.category===k?'selected':''}>${l}</option>`).join('')}
    </select>
  </div>
  <div style="display:flex;align-items:center;gap:12px;padding-top:18px">
    <label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="sf-sig" ${tmpl?.require_signature?'checked':''}> Wymagany podpis</label>
    <label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="sf-photo" ${tmpl?.require_photo?'checked':''}> Wymagane zdjęcie</label>
  </div>
  <div style="grid-column:1/-1">
    <label style="font-size:12px;color:var(--text3)">Opis (opcjonalnie)</label><br>
    <input type="text" id="sf-desc" class="sel" value="${e(tmpl?.description||'')}">
  </div>
</div>

<h4 style="font-size:13px;margin:0 0 8px"><i class="ti ti-list"></i> Pola formularza</h4>
<div id="sf-fields">
  ${_editFields.map((f,i)=>_fieldRow(f,i)).join('')}
</div>

<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
  ${FIELD_TYPES.map(ft=>`<button class="btn btn-sm" onclick="window.SmartForms._addField('${ft.v}')">
    <i class="ti ti-plus"></i> ${ft.l}</button>`).join('')}
</div>

<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
  <button class="btn" onclick="window.SmartForms._closeModal()">Anuluj</button>
  <button class="btn btn-primary" onclick="window.SmartForms._saveTemplate('${e(tmpl?.id||'')}')"><i class="ti ti-check"></i> Zapisz formularz</button>
</div>`;
  }

  function _fieldRow(f, i) {
    return `<div style="background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:6px;display:flex;gap:8px;align-items:center">
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center">
        <input type="text" class="sel" style="font-size:13px" placeholder="Etykieta pola" value="${e(f.label||'')}"
          onchange="window.SmartForms._updateField(${i},'label',this.value)">
        <select class="sel" style="font-size:12px" onchange="window.SmartForms._updateField(${i},'type',this.value)">
          ${FIELD_TYPES.map(ft=>`<option value="${ft.v}" ${f.type===ft.v?'selected':''}>${ft.l}</option>`).join('')}
        </select>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap">
          <input type="checkbox" ${f.required?'checked':''} onchange="window.SmartForms._updateField(${i},'required',this.checked)"> Wymagane
        </label>
        ${f.type==='select'?`<div style="grid-column:1/-1"><input type="text" class="sel" style="font-size:12px" placeholder="Opcje oddzielone przecinkiem" value="${e((f.options||[]).join(','))}" onchange="window.SmartForms._updateField(${i},'options',this.value.split(',').map(s=>s.trim()))"></div>`:''}
      </div>
      <button onclick="window.SmartForms._removeField(${i})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:16px">✕</button>
    </div>`;
  }

  function _addField(type) {
    _editFields.push({ type, label: '', required: false });
    const cont = document.getElementById('sf-fields');
    if (cont) cont.innerHTML = _editFields.map((f,i)=>_fieldRow(f,i)).join('');
  }

  function _updateField(i, key, val) { if (_editFields[i]) _editFields[i][key] = val; }
  function _removeField(i) {
    _editFields.splice(i, 1);
    const cont = document.getElementById('sf-fields');
    if (cont) cont.innerHTML = _editFields.map((f,idx)=>_fieldRow(f,idx)).join('');
  }

  async function _saveTemplate(id) {
    const data = {
      name:              document.getElementById('sf-name')?.value?.trim(),
      description:       document.getElementById('sf-desc')?.value||'',
      category:          document.getElementById('sf-cat')?.value||'general',
      require_signature: document.getElementById('sf-sig')?.checked?1:0,
      require_photo:     document.getElementById('sf-photo')?.checked?1:0,
      fields:            _editFields,
    };
    if (!data.name) { alert('Nazwa formularza jest wymagana'); return; }
    try {
      const url = id ? `${API()}/api/smart-forms/${id}?company=${encodeURIComponent(Co())}` : `${API()}/api/smart-forms?company=${encodeURIComponent(Co())}`;
      const r = await fetch(url, { method: id?'PUT':'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (r.ok) { _closeModal(); await renderSmartForms(); }
      else alert('Błąd zapisu');
    } catch (ex) { alert(ex.message); }
  }

  function _openFill(templateId) {
    const tmpl = _templates.find(t => t.id === templateId);
    if (!tmpl) return;
    const inner = document.getElementById('sf-modal-inner');
    const m     = document.getElementById('sf-modal');
    if (!inner||!m) return;

    const fieldsHtml = (tmpl.fields||[]).map((f,i) => {
      let input = '';
      if (f.type==='textarea') input = `<textarea id="fill-${i}" class="sel" rows="3" style="width:100%" ${f.required?'required':''}></textarea>`;
      else if (f.type==='checkbox') input = `<label style="display:flex;align-items:center;gap:6px;margin-top:4px"><input type="checkbox" id="fill-${i}"> Tak</label>`;
      else if (f.type==='select') input = `<select id="fill-${i}" class="sel" ${f.required?'required':''}><option value=""></option>${(f.options||[]).map(o=>`<option value="${e(o)}">${e(o)}</option>`).join('')}</select>`;
      else if (f.type==='photo') input = `<input type="file" id="fill-${i}" class="sel" accept="image/*" capture="environment">`;
      else input = `<input type="${f.type||'text'}" id="fill-${i}" class="sel" ${f.required?'required':''}>`;
      return `<div style="margin-bottom:10px">
        <label style="font-size:12px;color:var(--text3)">${e(f.label||'Pole '+(i+1))}${f.required?' *':''}</label><br>${input}
      </div>`;
    }).join('');

    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <h3 style="margin:0"><i class="ti ${CAT_ICON[tmpl.category]||'ti-forms'}"></i> ${e(tmpl.name)}</h3>
  <button onclick="window.SmartForms._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  <div><label style="font-size:12px;color:var(--text3)">Pojazd (nr rej.)</label><br><input type="text" id="fill-veh" class="sel" placeholder="WA 12345"></div>
  <div><label style="font-size:12px;color:var(--text3)">Kierowca</label><br><input type="text" id="fill-drv" class="sel"></div>
</div>
${fieldsHtml}
<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
  <button class="btn" onclick="window.SmartForms._closeModal()">Anuluj</button>
  <button class="btn btn-primary" data-tmpl-id="${e(tmpl.id)}" data-tmpl-name="${e(tmpl.name)}" data-field-count="${(tmpl.fields||[]).length}"
    onclick="window.SmartForms._submitForm(this.dataset.tmplId,this.dataset.tmplName,parseInt(this.dataset.fieldCount))">
    <i class="ti ti-check"></i> Wyślij formularz
  </button>
</div>`;
    m.style.display = 'flex';
  }

  async function _submitForm(templateId, templateName, fieldCount) {
    const vehicle_reg = document.getElementById('fill-veh')?.value||'';
    const driver_name = document.getElementById('fill-drv')?.value||'';
    const data = {};
    const tmpl = _templates.find(t=>t.id===templateId);
    (tmpl?.fields||[]).forEach((f,i) => {
      const el = document.getElementById(`fill-${i}`);
      if (!el) return;
      data[f.label||`field_${i}`] = f.type==='checkbox' ? el.checked : el.value;
    });
    try {
      const r = await fetch(`${API()}/api/smart-forms/submissions?company=${encodeURIComponent(Co())}`, {
        method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, template_name: templateName, vehicle_reg, driver_name, data })
      });
      if (r.ok) { _closeModal(); await renderSmartForms(); }
      else alert('Błąd wysyłki');
    } catch (ex) { alert(ex.message); }
  }

  async function _delTemplate(id) {
    if (!confirm('Usunąć formularz?')) return;
    await fetch(`${API()}/api/smart-forms/${id}?company=${encodeURIComponent(Co())}`, { method: 'DELETE', headers: H() });
    await renderSmartForms();
  }

  function _editTemplate(id) {
    const tmpl = _templates.find(t=>t.id===id);
    if (tmpl) _openBuilder(tmpl);
  }

  async function _showSubs(templateId) {
    try {
      const r = await fetch(`${API()}/api/smart-forms/${templateId}/submissions?company=${encodeURIComponent(Co())}`, { headers: H() });
      const subs = r.ok ? await r.json() : [];
      const tmpl = _templates.find(t=>t.id===templateId);
      const inner = document.getElementById('sf-modal-inner');
      const m     = document.getElementById('sf-modal');
      if(!inner||!m) return;
      inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <h3 style="margin:0">Historia — ${e(tmpl?.name||'Formularz')}</h3>
  <button onclick="window.SmartForms._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
${subs.length===0?'<p style="color:var(--text3)">Brak wypełnień.</p>':`
<table class="tach-table">
  <thead><tr><th>Data</th><th>Pojazd</th><th>Kierowca</th><th>Wypełnił</th><th>Status</th></tr></thead>
  <tbody>${subs.map(s=>`<tr>
    <td style="font-size:12px">${fmtDT(s.submitted_at)}</td>
    <td>${e(s.vehicle_reg||'—')}</td>
    <td>${e(s.driver_name||'—')}</td>
    <td>${e(s.submitted_by||'—')}</td>
    <td><span style="font-size:11px;padding:2px 8px;border-radius:8px;font-weight:600;
      background:${s.status==='action_required'?'#fee2e2':'#dcfce7'};color:${s.status==='action_required'?'#dc2626':'#16a34a'}">
      ${e(s.status)}</span></td>
  </tr>`).join('')}</tbody>
</table>`}`;
      m.style.display = 'flex';
    } catch (ex) { alert(ex.message); }
  }

  async function _viewSub(id) {
    const sub = _submissions.find(s=>s.id===id);
    if (!sub) return;
    const inner = document.getElementById('sf-modal-inner');
    const m     = document.getElementById('sf-modal');
    if(!inner||!m) return;
    inner.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <h3 style="margin:0">${e(sub.template_name||'Formularz')}</h3>
  <button onclick="window.SmartForms._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
<div style="font-size:12px;color:var(--text3);margin-bottom:12px">${fmtDT(sub.submitted_at)} · ${e(sub.driver_name||'—')} · ${e(sub.vehicle_reg||'—')}</div>
<div style="background:var(--bg2);border-radius:8px;padding:12px;font-size:13px">
  ${sub.data ? Object.entries(JSON.parse(typeof sub.data==='string'?sub.data:'{}')).map(([k,v])=>
    `<div style="margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:6px">
      <span style="color:var(--text3);font-size:11px">${e(k)}</span><br>
      <strong>${e(String(v??'—'))}</strong>
    </div>`).join('') : '<p>Brak danych</p>'}
</div>`;
    m.style.display = 'flex';
  }

  async function _quickCreate(cat) {
    const templates = {
      vehicle_check: { name:'Kontrola pojazdu przed wyjazdem', fields:[
        { type:'checkbox', label:'Poziom oleju silnikowego', required:true },
        { type:'checkbox', label:'Poziom płynu chłodniczego', required:true },
        { type:'checkbox', label:'Ciśnienie opon', required:true },
        { type:'checkbox', label:'Działanie świateł', required:true },
        { type:'checkbox', label:'Brak widocznych uszkodzeń', required:true },
        { type:'select', label:'Ocena ogólna', options:['Sprawny','Wymaga uwagi','Nie nadaje się do jazdy'], required:true },
        { type:'textarea', label:'Uwagi' },
      ]},
      incident: { name:'Protokół zdarzenia drogowego', fields:[
        { type:'date', label:'Data zdarzenia', required:true },
        { type:'text', label:'Miejsce zdarzenia', required:true },
        { type:'text', label:'Opis zdarzenia', required:true },
        { type:'text', label:'Dane drugiego uczestnika' },
        { type:'text', label:'Numer policji/straży' },
        { type:'select', label:'Czy wezwano policję?', options:['Tak','Nie'], required:true },
        { type:'textarea', label:'Dodatkowe informacje' },
      ]},
      delivery: { name:'Potwierdzenie dostawy', fields:[
        { type:'text', label:'Nr zlecenia transportowego', required:true },
        { type:'text', label:'Odbiorca', required:true },
        { type:'date', label:'Data dostawy', required:true },
        { type:'text', label:'Godzina dostawy', required:true },
        { type:'number', label:'Liczba palet/opakowań' },
        { type:'select', label:'Stan ładunku po dostawie', options:['Bez uszkodzeń','Drobne uszkodzenia','Poważne uszkodzenia'], required:true },
        { type:'textarea', label:'Uwagi odbiorcy' },
      ]},
    };
    const def = templates[cat] || { name: CAT_LBL[cat]||'Nowy formularz', fields: [] };
    _editFields = def.fields;
    _openBuilder({ ...def, category: cat });
  }

  function _closeModal() {
    const m = document.getElementById('sf-modal');
    if (m) m.style.display = 'none';
  }

  window.SmartForms = { renderSmartForms, _tab, _openBuilder, _openFill, _submitForm, _saveTemplate, _delTemplate, _editTemplate, _showSubs, _viewSub, _quickCreate, _addField, _updateField, _removeField, _closeModal };
})();
