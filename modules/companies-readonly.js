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

  function renderCompaniesPanel(){
    const el = document.getElementById('companies-grid');
    if(!el){
      console.warn('[CompaniesReadOnly] Brak #companies-grid');
      return;
    }

    const list = window.TaxOrderCompaniesList || [];

    el.innerHTML = list.map(c => `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="width:12px;height:12px;border-radius:50%;background:${c.color || '#185FA5'}"></div>
          <strong>${c.short_name || c.slug}</strong>
        </div>
        <div style="font-size:12px;color:var(--text2);min-height:34px">${c.name || ''}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.6">
          NIP: ${c.nip || '—'}<br>
          REGON: ${c.regon || '—'}<br>
          ${c.street || ''} ${c.building_no || ''}, ${c.postal_code || ''} ${c.city || ''}
        </div>
      </div>
    `).join('');
  }

  async function loadAndRenderCompanies(){
    await loadCompanies();
    renderCompaniesPanel();
  }

  window.TaxOrderCompaniesReadOnly = {
    loadCompanies,
    renderCompaniesPanel,
    loadAndRenderCompanies
  };
})();
