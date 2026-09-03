/**
 * TaxOrder Pro — Dodawanie firmy (najemcy)
 *
 * Supabase wycofany (26.07.2026). Poprzednia wersja wolala window.supabaseClient
 * bez guarda — klient nigdy niezainicjalizowany, zapis konczyl sie TypeError
 * i onboarding nowej firmy nie dzialal. Teraz POST /api/companies (schema_v44).
 */
(function(){
  'use strict';

  const API  = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const tok  = () => localStorage.getItem('cf_token') || '';
  const hdrs = () => ({ Authorization: `Bearer ${  tok()}`, 'Content-Type': 'application/json' });

  function slugify(text){
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 40);
  }

  function ensureModal(){
    if(document.getElementById('company-create-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'company-create-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999999;align-items:center;justify-content:center;padding:20px;';

    modal.innerHTML = `
      <div style="background:white;border-radius:14px;width:720px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 8px 40px rgba(0,0,0,.25);padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="margin:0;font-size:18px">Dodaj firmę</h2>
          <button type="button" id="cc-close" style="border:none;background:none;font-size:26px;cursor:pointer">×</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <input id="cc-short-name" class="fi" placeholder="Nazwa skrócona, np. G-CON">
          <input id="cc-slug" class="fi" placeholder="Slug, np. gcon">
          <input id="cc-name" class="fi" placeholder="Pełna nazwa" style="grid-column:1/-1">
          <input id="cc-nip" class="fi" placeholder="NIP">
          <input id="cc-regon" class="fi" placeholder="REGON">
          <input id="cc-krs" class="fi" placeholder="KRS">
          <input id="cc-color" class="fi" type="color" value="#185FA5">
          <input id="cc-street" class="fi" placeholder="Ulica">
          <input id="cc-building-no" class="fi" placeholder="Nr budynku">
          <input id="cc-postal-code" class="fi" placeholder="Kod pocztowy">
          <input id="cc-city" class="fi" placeholder="Miasto">
          <input id="cc-woj" class="fi" placeholder="Województwo" value="MAZOWIECKIE">
          <input id="cc-owner-label" class="fi" placeholder="Etykieta właściciela pojazdów">
          <input id="cc-organ" class="fi" placeholder="Organ podatkowy" style="grid-column:1/-1">
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button class="btn btn-gray" type="button" id="cc-cancel">Anuluj</button>
          <button class="btn btn-green" type="button" id="cc-save">Zapisz firmę</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('cc-close').addEventListener('click', close);
    document.getElementById('cc-cancel').addEventListener('click', close);
    document.getElementById('cc-save').addEventListener('click', save);

    document.getElementById('cc-short-name').addEventListener('input', function(){
      const slug = document.getElementById('cc-slug');
      if(slug && !slug.dataset.touched) slug.value = slugify(this.value);
    });

    document.getElementById('cc-slug').addEventListener('input', function(){
      this.dataset.touched = '1';
    });
  }

  function open(){
    ensureModal();
    document.getElementById('company-create-modal').style.display = 'flex';
  }

  function close(){
    const modal = document.getElementById('company-create-modal');
    if(modal) modal.style.display = 'none';
  }

  function val(id){
    return document.getElementById(id)?.value?.trim() || '';
  }

  async function save(){
    // Nazwy pol zgodne ze schema_v44 (ulica/dom/kod/miasto, nie street/building_no)
    const row = {
      id:         slugify(val('cc-slug') || val('cc-short-name')),
      short_name: val('cc-short-name'),
      name:       val('cc-name'),
      nip:        val('cc-nip').replace(/\D/g, ''),
      regon:      val('cc-regon'),
      krs:        val('cc-krs'),
      miasto:     val('cc-city'),
      ulica:      val('cc-street'),
      dom:        val('cc-building-no'),
      kod:        val('cc-postal-code'),
      woj:        val('cc-woj'),
      organ:      val('cc-organ'),
      color:      val('cc-color') || '#185FA5',
      wlasciciel: val('cc-owner-label') || val('cc-short-name')
    };

    if(!row.id || !row.short_name || !row.name){
      alert('Uzupelnij nazwe skrocona, slug i pelna nazwe.');
      return;
    }
    if(row.nip && row.nip.length !== 10){
      alert('NIP musi miec dokladnie 10 cyfr.');
      return;
    }
    if(!tok()){
      alert('Brak sesji — zaloguj sie ponownie.');
      return;
    }

    const btn = document.getElementById('cc-save');
    if(btn){ btn.disabled = true; btn.textContent = 'Zapisywanie...'; }

    try {
      const r = await fetch(`${API()  }/api/companies`, {
        method: 'POST', headers: hdrs(), body: JSON.stringify(row)
      });
      const d = await r.json().catch(() => ({}));

      if(!r.ok){
        alert(`Blad zapisu: ${  d.error || (`HTTP ${  r.status}`)}`);
        return;
      }

      close();
      if(window.TaxOrderCompaniesReadOnly?.loadAndRenderCompanies){
        await window.TaxOrderCompaniesReadOnly.loadAndRenderCompanies();
      }
      if(typeof toast === 'function') toast('✓ Firma dodana');
      else alert('Firma dodana');
    } catch(e){
      alert(`Blad sieci: ${  e.message}`);
    } finally {
      if(btn){ btn.disabled = false; btn.textContent = 'Zapisz firme'; }
    }
  }

  function injectButton(){
    if(document.getElementById('company-create-btn')) return;

    const page = document.getElementById('page-firmy');
    if(!page) return;

    const title = page.querySelector('.pg-title') || page.firstElementChild;
    if(!title) return;

    const btn = document.createElement('button');
    btn.id = 'company-create-btn';
    btn.type = 'button';
    btn.className = 'btn btn-green';
    btn.style.margin = '10px 0';
    btn.innerHTML = '<i class="ti ti-plus"></i>Dodaj firmę';
    btn.addEventListener('click', open);

    title.insertAdjacentElement('afterend', btn);
  }

  function start(){
    document.addEventListener('click', function(e){
      if(e.target.closest('#tnb-firmy')){
        setTimeout(injectButton, 500);
      }
    });

    setInterval(function(){
      const page = document.getElementById('page-firmy');
      if(page && page.classList.contains('active')) injectButton();
    }, 1000);

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
