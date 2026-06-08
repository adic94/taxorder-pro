(function(){
  const log = (...a) => console.log('[CompanyManager]', ...a);

  function cleanNip(nip){
    return String(nip || '').replace(/\D/g, '');
  }

  function mapRow(c){
    return {
      id: c.slug,
      dbId: c.id,
      shortName: c.short_name || c.slug,
      name: c.name || '',
      nip: c.nip || '',
      regon: c.regon || '',
      krs: c.krs || '',
      ulica: c.street || '',
      dom: c.building_no || '',
      lokal: c.apartment_no || '',
      kod: c.postal_code || '',
      miasto: c.city || '',
      woj: c.woj || '',
      organ: c.organ || '',
      color: c.color || '#185FA5',
      wlasciciel: c.owner_label || c.short_name || c.slug
    };
  }

  function toRow(c){
    const slug = (c.slug || c.id || c.shortName || c.name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 40);

    return {
      slug,
      short_name: c.shortName || c.short_name || slug,
      name: c.name || '',
      nip: cleanNip(c.nip),
      regon: c.regon || '',
      krs: c.krs || '',
      city: c.miasto || c.city || '',
      street: c.ulica || c.street || '',
      building_no: c.dom || c.building_no || '',
      postal_code: c.kod || c.postal_code || '',
      woj: c.woj || '',
      organ: c.organ || '',
      color: c.color || '#185FA5',
      owner_label: c.wlasciciel || c.owner_label || c.shortName || slug
    };
  }

  async function loadCompanies(){
    if(!window.supabaseClient){
      console.warn('[CompanyManager] Brak window.supabaseClient');
      return {};
    }

    const { data, error } = await window.supabaseClient
      .from('companies')
      .select('*')
      .order('short_name', { ascending:true });

    if(error){
      console.error('[CompanyManager] Błąd pobierania firm:', error);
      return {};
    }

    const obj = {};
    (data || []).forEach(c => {
      obj[c.slug] = mapRow(c);
    });

    window.COMPANIES_DB = obj;

    if(typeof window.TaxOrderSetCompanies === 'function'){
      window.TaxOrderSetCompanies(obj);
    }

    renderCompanySelector();
    renderCompanyAdmin();

    log('Pobrano firm:', Object.keys(obj).length);
    return obj;
  }

  function renderCompanySelector(){
    const sel = document.getElementById('company-selector');
    if(!sel || !window.COMPANIES_DB) return;

    const current = localStorage.getItem('dt1_current_company') || Object.keys(window.COMPANIES_DB)[0] || 'mtoilet';

    sel.innerHTML = Object.values(window.COMPANIES_DB).map(c =>
      `<option value="${c.id}">${c.shortName}</option>`
    ).join('');

    if(window.COMPANIES_DB[current]) sel.value = current;
  }

  function ensureModal(){
    if(document.getElementById('company-modal')) return;

    const div = document.createElement('div');
    div.id = 'company-modal';
    div.className = 'modal-bg hidden';
    div.innerHTML = `
      <div style="background:var(--bg2);border-radius:14px;width:720px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <strong id="company-modal-title">Firma</strong>
          <button onclick="TaxOrderCompanyManager.closeModal()" style="border:none;background:none;font-size:24px;cursor:pointer">×</button>
        </div>

        <div style="padding:20px 22px">
          <input type="hidden" id="cm-original-slug">

          <div style="display:flex;gap:8px;margin-bottom:14px">
            <input id="cm-nip-search" class="fi" placeholder="Wpisz NIP i pobierz dane" style="flex:1">
            <button class="btn btn-blue" onclick="TaxOrderCompanyManager.fetchByNip()">
              <i class="ti ti-search"></i>Pobierz po NIP
            </button>
          </div>

          <div class="fg">
            <div class="f"><label>Skrót</label><input id="cm-shortName"></div>
            <div class="f"><label>Slug</label><input id="cm-slug" placeholder="np. gcon"></div>
            <div class="f full"><label>Pełna nazwa</label><input id="cm-name"></div>
            <div class="f"><label>NIP</label><input id="cm-nip"></div>
            <div class="f"><label>REGON</label><input id="cm-regon"></div>
            <div class="f"><label>KRS</label><input id="cm-krs"></div>
            <div class="f"><label>Ulica</label><input id="cm-ulica"></div>
            <div class="f"><label>Nr domu</label><input id="cm-dom"></div>
            <div class="f"><label>Nr lokalu</label><input id="cm-lokal"></div>
            <div class="f"><label>Kod pocztowy</label><input id="cm-kod"></div>
            <div class="f"><label>Miasto</label><input id="cm-miasto"></div>
            <div class="f"><label>Województwo</label><input id="cm-woj"></div>
            <div class="f full"><label>Organ podatkowy</label><input id="cm-organ"></div>
            <div class="f"><label>Kolor</label><input id="cm-color" type="color" value="#185FA5"></div>
            <div class="f"><label>Etykieta właściciela pojazdów</label><input id="cm-wlasciciel"></div>
          </div>
        </div>

        <div style="padding:16px 22px;border-top:1px solid var(--border);display:flex;gap:10px">
          <button class="btn btn-gray" onclick="TaxOrderCompanyManager.closeModal()">Anuluj</button>
          <button class="btn btn-green" onclick="TaxOrderCompanyManager.saveFromModal()">
            <i class="ti ti-device-floppy"></i>Zapisz firmę
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function openModal(slug){
    ensureModal();

    const c = slug && window.COMPANIES_DB ? window.COMPANIES_DB[slug] : null;

    document.getElementById('company-modal-title').textContent = c ? 'Edytuj firmę' : 'Dodaj firmę';
    document.getElementById('cm-original-slug').value = c?.id || '';

    const fields = {
      shortName: c?.shortName || '',
      slug: c?.id || '',
      name: c?.name || '',
      nip: c?.nip || '',
      regon: c?.regon || '',
      krs: c?.krs || '',
      ulica: c?.ulica || '',
      dom: c?.dom || '',
      lokal: c?.lokal || '',
      kod: c?.kod || '',
      miasto: c?.miasto || '',
      woj: c?.woj || '',
      organ: c?.organ || '',
      color: c?.color || '#185FA5',
      wlasciciel: c?.wlasciciel || ''
    };

    Object.entries(fields).forEach(([k,v]) => {
      const el = document.getElementById('cm-' + k);
      if(el) el.value = v;
    });

    document.getElementById('cm-nip-search').value = c?.nip || '';
    document.getElementById('company-modal').classList.remove('hidden');
  }

  function closeModal(){
    document.getElementById('company-modal')?.classList.add('hidden');
  }

  async function fetchByNip(){
    const nip = cleanNip(document.getElementById('cm-nip-search')?.value || document.getElementById('cm-nip')?.value);

    if(nip.length !== 10){
      toast?.('⚠ Wpisz poprawny NIP 10 cyfr');
      return;
    }

    try{
      const today = new Date().toISOString().slice(0,10);
      const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`;
      const res = await fetch(url);
      const json = await res.json();

      const s = json?.result?.subject;
      if(!s){
        toast?.('Nie znaleziono firmy po NIP');
        return;
      }

      const address = s.workingAddress || s.residenceAddress || '';

      document.getElementById('cm-name').value = s.name || '';
      document.getElementById('cm-nip').value = nip;
      document.getElementById('cm-regon').value = s.regon || '';

      if(!document.getElementById('cm-shortName').value){
        document.getElementById('cm-shortName').value = (s.name || '').split(' ')[0] || nip;
      }

      if(!document.getElementById('cm-slug').value){
        document.getElementById('cm-slug').value =
          (document.getElementById('cm-shortName').value || nip)
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '')
          .slice(0,40);
      }

      if(address){
        const parts = address.split(',').map(x => x.trim());
        document.getElementById('cm-miasto').value = parts.at(-1) || '';
        document.getElementById('cm-ulica').value = parts[0] || '';
      }

      toast?.('✓ Dane pobrane po NIP');
    }catch(e){
      console.error(e);
      toast?.('⚠ Nie udało się pobrać danych po NIP');
    }
  }

  async function saveFromModal(){
    const payload = {};
    ['shortName','slug','name','nip','regon','krs','ulica','dom','lokal','kod','miasto','woj','organ','color','wlasciciel']
      .forEach(k => payload[k] = document.getElementById('cm-' + k)?.value?.trim() || '');

    if(!payload.slug || !payload.name){
      toast?.('⚠ Uzupełnij slug i nazwę firmy');
      return;
    }

    const row = toRow(payload);

    const { error } = await window.supabaseClient
      .from('companies')
      .upsert(row, { onConflict:'slug' });

    if(error){
      console.error(error);
      toast?.('Błąd zapisu firmy: ' + error.message);
      return;
    }

    closeModal();
    await loadCompanies();
    toast?.('✓ Firma zapisana');
  }

  async function deleteCompany(slug){
    const c = window.COMPANIES_DB?.[slug];
    if(!c) return;

    if(!confirm(`Usunąć firmę ${c.shortName}?`)) return;

    const { error } = await window.supabaseClient
      .from('companies')
      .delete()
      .eq('slug', slug);

    if(error){
      console.error(error);
      toast?.('Błąd usuwania firmy: ' + error.message);
      return;
    }

    await loadCompanies();
    toast?.('✓ Firma usunięta');
  }

  function renderCompanyAdmin(){
    const grid = document.getElementById('companies-grid');
    if(!grid || !window.COMPANIES_DB) return;

    const rows = Object.values(window.COMPANIES_DB).map(c => {
      const isCurrent = localStorage.getItem('dt1_current_company') === c.id;
      return `
        <div style="background:${isCurrent ? c.color + '11' : 'var(--bg2)'};border:2px solid ${isCurrent ? c.color : 'var(--border)'};border-radius:12px;padding:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:12px;height:12px;border-radius:50%;background:${c.color}"></div>
            <div style="font-weight:700">${c.shortName}</div>
            <span style="font-size:10px;color:var(--text2);margin-left:auto">${c.nip || ''}</span>
          </div>
          <div style="font-size:12px;color:var(--text2);min-height:36px">${c.name}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:8px">${c.ulica || ''} ${c.dom || ''}, ${c.kod || ''} ${c.miasto || ''}</div>
          <div style="display:flex;gap:6px;margin-top:12px">
            <button class="btn btn-blue" onclick="switchCompany('${c.id}')"><i class="ti ti-login"></i>Przełącz</button>
            <button class="btn btn-gray" onclick="TaxOrderCompanyManager.openModal('${c.id}')"><i class="ti ti-edit"></i>Edytuj</button>
            <button class="btn btn-red" onclick="TaxOrderCompanyManager.deleteCompany('${c.id}')"><i class="ti ti-trash"></i>Usuń</button>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = `
      <div style="grid-column:1/-1;margin-bottom:10px">
        <button class="btn btn-green" onclick="TaxOrderCompanyManager.openModal()">
          <i class="ti ti-plus"></i>Dodaj firmę
        </button>
      </div>
      ${rows}
    `;
  }

  window.TaxOrderCompanyManager = {
    loadCompanies,
    renderCompanySelector,
    renderCompanyAdmin,
    openModal,
    closeModal,
    fetchByNip,
    saveFromModal,
    deleteCompany
  };
})();
