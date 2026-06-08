(function(){
  async function loadCompanies(){
    if(!window.supabaseClient){
      console.warn('[CompaniesReadOnly] Brak supabaseClient');
      return [];
    }

    const { data, error } = await window.supabaseClient
      .from('companies')
      .select('id, slug, short_name, name, nip, regon, city, street, building_no, postal_code, color, owner_label')
      .order('short_name');

    if(error){
      console.error('[CompaniesReadOnly] Błąd:', error);
      return [];
    }

    window.TaxOrderCompaniesList = data || [];
    console.log('[CompaniesReadOnly] Firmy:', window.TaxOrderCompaniesList);
    return window.TaxOrderCompaniesList;
  }

  window.TaxOrderCompaniesReadOnly = {
    loadCompanies
  };
})();
