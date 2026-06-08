(function(){
  async function loadCompanies(){
    if(!window.supabaseClient){
      console.warn('[CompaniesCloud] Brak supabaseClient');
      return null;
    }

    const { data, error } = await window.supabaseClient
      .from('companies')
      .select('*')
      .order('short_name', { ascending: true });

    if(error){
      console.error('[CompaniesCloud] Błąd pobierania firm:', error);
      return null;
    }

    const companies = {};
    (data || []).forEach(c => {
      companies[c.slug] = {
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
    });

    window.COMPANIES_DB = companies;
    console.log('[CompaniesCloud] Pobrano firmy z Supabase:', Object.keys(companies).length);

    return companies;
  }

  async function syncToApp(){
    const companies = await loadCompanies();
    if(!companies || !Object.keys(companies).length) return false;

    if(window.COMPANIES){
      Object.keys(window.COMPANIES).forEach(k => delete window.COMPANIES[k]);
      Object.assign(window.COMPANIES, companies);
    }

    if(typeof window.updateCompanyUI === 'function') window.updateCompanyUI();
    if(typeof window.renderCompanyOverview === 'function') window.renderCompanyOverview();
    if(typeof window.renderAllCompaniesSummary === 'function') window.renderAllCompaniesSummary();

    return true;
  }

  async function saveCompany(payload){
    const row = {
      slug: payload.slug,
      short_name: payload.shortName,
      name: payload.name,
      nip: payload.nip,
      regon: payload.regon,
      krs: payload.krs,
      city: payload.miasto,
      street: payload.ulica,
      building_no: payload.dom,
      postal_code: payload.kod,
      woj: payload.woj,
      organ: payload.organ,
      color: payload.color,
      owner_label: payload.wlasciciel
    };

    const { data, error } = await window.supabaseClient
      .from('companies')
      .upsert(row, { onConflict: 'slug' })
      .select()
      .single();

    if(error){
      console.error('[CompaniesCloud] Błąd zapisu firmy:', error);
      throw error;
    }

    await syncToApp();
    return data;
  }

  async function deleteCompany(slug){
    const { error } = await window.supabaseClient
      .from('companies')
      .delete()
      .eq('slug', slug);

    if(error){
      console.error('[CompaniesCloud] Błąd usuwania firmy:', error);
      throw error;
    }

    await syncToApp();
    return true;
  }

  window.TaxOrderCompanies = {
    loadCompanies,
    syncToApp,
    saveCompany,
    deleteCompany
  };
})();
