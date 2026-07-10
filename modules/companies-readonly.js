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
          <div style="width:12px;height:12px;border-radius:50%;background:${/^#[0-9a-fA-F]{3,6}$/.test(c.color||'') ? c.color : '#185FA5'}"></div>
          <strong>${esc(c.short_name || c.slug)}</strong>
        </div>
        <div style="font-size:12px;color:var(--text2);min-height:34px">${esc(c.name || '')}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.6">
          NIP: ${esc(c.nip || '—')}<br>
          REGON: ${esc(c.regon || '—')}<br>
          ${esc(c.street || '')} ${esc(c.building_no || '')}, ${esc(c.postal_code || '')} ${esc(c.city || '')}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn btn-red" type="button" data-id="${esc(c.id)}" data-name="${esc(c.short_name || c.slug || '')}" onclick="window.TaxOrderCompaniesReadOnly.deleteCompany(this.dataset.id, this.dataset.name)">
            Usuń
          </button>
        </div>
      </div>
    `).join('');
  }

  async function loadAndRenderCompanies(){
    await loadCompanies();
    renderCompaniesPanel();
  }

  async function deleteCompany(id, name){
  if(!id){
    alert('Brak ID firmy');
    return;
  }

  if(!confirm('Czy na pewno usunąć firmę: ' + (name || id) + '?')){
    return;
  }

  const result = await window.supabaseClient
    .from('companies')
    .delete()
    .eq('id', id);

  if(result.error){
    console.error('[CompaniesReadOnly] Błąd usuwania:', result.error);
    alert('Błąd usuwania: ' + result.error.message);
    return;
  }

  if(typeof toast === 'function'){
    toast('✓ Firma usunięta');
  }

  await loadAndRenderCompanies();
}

window.TaxOrderCompaniesReadOnly = {
    loadCompanies,
    renderCompaniesPanel,
    loadAndRenderCompanies,
    deleteCompany
  };
})();




