(function(){
  function slugify(text){
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 40);
  }

  function ensureCompanyCreateModal(){
    if(document.getElementById('company-create-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'company-create-modal';
    modal.className = 'modal-bg hidden';
    modal.innerHTML = `
      <div style="background:var(--bg2);border-radius:14px;width:720px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <strong>Dodaj firmę</strong>
          <button onclick="TaxOrderCompanyCreate.close()" style="border:none;background:none;font-size:24px;cursor:pointer">×</button>
        </div>

        <div style="padding:20px 22px">
          <div class="fg">
            <div class="f">
              <label>Nazwa skrócona</label>
              <input id="cc-short-name" class="fi" placeholder="np. G-CON">
            </div>
            <div class="f">
              <label>Slug</label>
              <input id="cc-slug" class="fi" placeholder="np. gcon">
            </div>
            <div class="f full">
              <label>Pełna nazwa</label>
              <input id="cc-name" class="fi" placeholder="Pełna nazwa spółki">
            </div>
            <div class="f">
              <label>NIP</label>
              <input id="cc-nip" class="fi" placeholder="10 cyfr">
            </div>
            <div class="f">
              <label>REGON</label>
              <input id="cc-regon" class="fi">
            </div>
            <div class="f">
              <label>KRS</label>
              <input id="cc-krs" class="fi">
            </div>
            <div class="f">
              <label>Ulica</label>
              <input id="cc-street" class="fi">
            </div>
            <div class="f">
              <label>Nr budynku</label>
              <input id="cc-building-no" class="fi">
            </div>
            <div class="f">
              <label>Kod pocztowy</label>
              <input id="cc-postal-code" class="fi">
            </div>
            <div class="f">
              <label>Miasto</label>
              <input id="cc-city" class="fi">
            </div>
            <div class="f">
              <label>Województwo</label>
              <input id="cc-woj" class="fi" value="MAZOWIECKIE">
            </div>
            <div class="f">
              <label>Kolor</label>
              <input id="cc-color" class="fi" type="color" value="#185FA5">
            </div>
            <div class="f full">
              <label>Organ podatkowy</label>
              <input id="cc-organ" class="fi" placeholder="np. Prezydent m.st. Warszawy">
            </div>
            <div class="f full">
              <label>Etykieta właściciela pojazdów</label>
              <input id="cc-owner-label" class="fi" placeholder="np. GCON">
            </div>
          </div>
        </div>

        <div style="padding:16px 22px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="TaxOrderCompanyCreate.close()">Anuluj</button>
          <button class="btn btn-green" onclick="TaxOrderCompanyCreate.save()">
            <i class="ti ti-device-floppy"></i>Zapisz firmę
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const shortName = document.getElementById('cc-short-name');
    const slug = document.getElementById('cc-slug');

    if(shortName && slug){
      shortName.addEventListener('input', function(){
        if(!slug.dataset.touched){
          slug.value = slugify(shortName.value);
        }
      });

      slug.addEventListener('input', function(){
        slug.dataset.touched = '1';
      });
    }
  }

  function open(){
    ensureCompanyCreateModal();
    document.getElementById('company-create-modal').classList.remove('hidden');
  }

  function close(){
    document.getElementById('company-create-modal')?.classList.add('hidden');
  }

  function getVal(id){
    return document.getElementById(id)?.value?.trim() || '';
  }

  async function save(){
    if(!window.supabaseClient){
      alert('Brak połączenia z Supabase');
      return;
    }

    const row = {
      slug: slugify(getVal('cc-slug') || getVal('cc-short-name')),
      short_name: getVal('cc-short-name'),
      name: getVal('cc-name'),
      nip: getVal('cc-nip').replace(/\D/g, ''),
      regon: getVal('cc-regon'),
      krs: getVal('cc-krs'),
      street: getVal('cc-street'),
      building_no: getVal('cc-building-no'),
      postal_code: getVal('cc-postal-code'),
      city: getVal('cc-city'),
      woj: getVal('cc-woj'),
      organ: getVal('cc-organ'),
      color: getVal('cc-color') || '#185FA5',
      owner_label: getVal('cc-owner-label') || getVal('cc-short-name')
    };

    if(!row.slug || !row.short_name || !row.name){
      alert('Uzupełnij: nazwa skrócona, slug i pełna nazwa.');
      return;
    }

    if(row.nip && row.nip.length !== 10){
      alert('NIP powinien mieć 10 cyfr.');
      return;
    }

    const result = await window.supabaseClient
      .from('companies')
      .insert(row)
      .select()
      .single();

    if(result.error){
      console.error('[CompanyCreate] Błąd zapisu:', result.error);
      alert('Błąd zapisu firmy: ' + result.error.message);
      return;
    }

    close();

    if(window.TaxOrderCompaniesReadOnly?.loadAndRenderCompanies){
      await window.TaxOrderCompaniesReadOnly.loadAndRenderCompanies();
    }

    if(typeof toast === 'function'){
      toast('✓ Firma dodana');
    } else {
      alert('Firma dodana');
    }
  }

  function injectButton(){
    const grid = document.getElementById('companies-grid');
    if(!grid) return;

    if(document.getElementById('company-create-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'company-create-btn-wrap';
    wrapper.style.gridColumn = '1 / -1';
    wrapper.style.marginBottom = '10px';

    wrapper.innerHTML = `
      <button id="company-create-btn" class="btn btn-green" onclick="TaxOrderCompanyCreate.open()">
        <i class="ti ti-plus"></i>Dodaj firmę
      </button>
    `;

    grid.prepend(wrapper);
  }

  function start(){
    document.addEventListener('click', function(e){
      if(!e.target.closest('#tnb-firmy')) return;

      setTimeout(function(){
        injectButton();
      }, 400);
    });

    console.log('[CompanyCreate] Aktywne');
  }

  window.TaxOrderCompanyCreate = {
    open,
    close,
    save,
    injectButton
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
