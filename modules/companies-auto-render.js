(function(){
  function startCompaniesAutoRender(){
    const btn = document.getElementById('tnb-firmy');

    if(!btn){
      console.warn('[CompaniesAutoRender] Brak przycisku #tnb-firmy');
      return;
    }

    btn.addEventListener('click', function(){
      setTimeout(async function(){
        if(window.TaxOrderCompaniesReadOnly && typeof window.TaxOrderCompaniesReadOnly.loadAndRenderCompanies === 'function'){
          await window.TaxOrderCompaniesReadOnly.loadAndRenderCompanies();
        } else {
          console.warn('[CompaniesAutoRender] Brak TaxOrderCompaniesReadOnly.loadAndRenderCompanies');
        }
      }, 200);
    });

    console.log('[CompaniesAutoRender] Aktywne');
  }

  window.TaxOrderCompaniesAutoRender = {
    start: startCompaniesAutoRender
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', startCompaniesAutoRender);
  } else {
    startCompaniesAutoRender();
  }
})();
