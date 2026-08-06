/**
 * TaxOrder Pro — Dostepy uzytkownik <-> firma
 *
 * Supabase wycofany (26.07.2026). Poprzednia wersja wolala window.supabaseClient
 * bez guarda — klient nigdy niezainicjalizowany, panel uprawnien rzucal TypeError.
 * Teraz /api/users i /api/company-access (schema_v44).
 */
(function(){
  'use strict';

  const API  = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const tok  = () => localStorage.getItem('cf_token') || '';
  const hdrs = () => ({ Authorization: 'Bearer ' + tok(), 'Content-Type': 'application/json' });

  async function loadUsers(){
    if(!tok()){ alert('Brak sesji — zaloguj sie ponownie.'); return []; }
    try {
      const r = await fetch(API() + '/api/users', { headers: hdrs() });
      if(!r.ok){
        const d = await r.json().catch(() => ({}));
        alert('Blad pobierania uzytkownikow: ' + (d.error || ('HTTP ' + r.status)));
        return [];
      }
      const d = await r.json().catch(() => []);
      const list = Array.isArray(d) ? d : (d.users || []);
      // Normalizacja: worker zwraca 'name', stary kod UI oczekuje 'full_name'
      return list.map(u => ({ ...u, full_name: u.full_name || u.name || u.email }));
    } catch(e){
      console.error('[CompanyAccess] Blad sieci:', e);
      alert('Blad sieci: ' + e.message);
      return [];
    }
  }

  async function loadAccess(userId){
    if(!userId || !tok()) return [];
    try {
      const r = await fetch(API() + '/api/company-access?user_id=' + encodeURIComponent(userId), { headers: hdrs() });
      if(!r.ok){ console.error('[CompanyAccess] HTTP ' + r.status); return []; }
      const d = await r.json().catch(() => ({}));
      return Array.isArray(d.access) ? d.access : [];
    } catch(e){
      console.error('[CompanyAccess] Blad dostepow:', e);
      return [];
    }
  }

  function ensureModal(){
    if(document.getElementById('company-access-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'company-access-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999999;align-items:center;justify-content:center;padding:20px;';

    modal.innerHTML = `
      <div style="background:white;border-radius:14px;width:820px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 8px 40px rgba(0,0,0,.25);padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="margin:0;font-size:18px">Uprawnienia do firm</h2>
          <button type="button" id="ca-close" style="border:none;background:none;font-size:26px;cursor:pointer">×</button>
        </div>

        <label>Użytkownik</label>
        <select id="ca-user" class="fi" style="width:100%;margin:6px 0 16px"></select>

        <div id="ca-table"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button class="btn btn-gray" type="button" id="ca-cancel">Anuluj</button>
          <button class="btn btn-green" type="button" id="ca-save">Zapisz uprawnienia</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('ca-close').addEventListener('click', close);
    document.getElementById('ca-cancel').addEventListener('click', close);
    document.getElementById('ca-save').addEventListener('click', save);
    document.getElementById('ca-user').addEventListener('change', renderAccessTable);
  }

  async function open(){
    ensureModal();

    if(window.TaxOrderCompaniesReadOnly?.loadCompanies){
      await window.TaxOrderCompaniesReadOnly.loadCompanies();
    }

    const users = await loadUsers();
    window.TaxOrderAccessUsers = users;

    const select = document.getElementById('ca-user');
    select.innerHTML = users.map(u =>
      '<option value="' + u.id + '">' + (u.email || u.full_name || u.id) + ' — ' + (u.role || 'brak roli') + '</option>'
    ).join('');

    document.getElementById('company-access-modal').style.display = 'flex';

    await renderAccessTable();
  }

  function close(){
    const modal = document.getElementById('company-access-modal');
    if(modal) modal.style.display = 'none';
  }

  async function renderAccessTable(){
    const userId = document.getElementById('ca-user')?.value;
    const companies = window.TaxOrderCompaniesList || [];

    if(!userId){
      document.getElementById('ca-table').innerHTML = '<p>Brak użytkowników.</p>';
      return;
    }

    const access = await loadAccess(userId);
    const map = {};
    access.forEach(a => map[a.company_id] = a);

    document.getElementById('ca-table').innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Firma</th>
            <th style="text-align:center;padding:8px;border-bottom:1px solid #ddd">Widzi</th>
            <th style="text-align:center;padding:8px;border-bottom:1px solid #ddd">Może edytować</th>
          </tr>
        </thead>
        <tbody>
          ${companies.map(c => {
            const a = map[c.id] || {};
            return `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #eee">
                  <strong>${esc(c.short_name || c.slug)}</strong><br>
                  <span style="font-size:11px;color:#666">${esc(c.name || '')}</span>
                </td>
                <td style="text-align:center;padding:8px;border-bottom:1px solid #eee">
                  <input type="checkbox" class="ca-view" data-company="${c.id}" ${a.can_view ? 'checked' : ''}>
                </td>
                <td style="text-align:center;padding:8px;border-bottom:1px solid #eee">
                  <input type="checkbox" class="ca-edit" data-company="${c.id}" ${a.can_edit ? 'checked' : ''}>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  async function save(){
    const userId = document.getElementById('ca-user')?.value;
    if(!userId){
      alert('Wybierz użytkownika');
      return;
    }

    const companies = window.TaxOrderCompaniesList || [];
    const btn = document.getElementById('ca-save');
    if(btn){ btn.disabled = true; btn.textContent = 'Zapisywanie...'; }

    try {
      for(const c of companies){
        const view = document.querySelector('.ca-view[data-company="' + c.id + '"]')?.checked || false;
        const edit = document.querySelector('.ca-edit[data-company="' + c.id + '"]')?.checked || false;

        // PUT obsluguje oba przypadki: view/edit = nadanie, brak obu = usuniecie
        const r = await fetch(API() + '/api/company-access', {
          method: 'PUT', headers: hdrs(),
          body: JSON.stringify({ user_id: userId, company_id: c.id, can_view: view, can_edit: edit })
        });
        if(!r.ok){
          const d = await r.json().catch(() => ({}));
          alert('Blad zapisu dla ' + (c.short_name || c.id) + ': ' + (d.error || ('HTTP ' + r.status)));
          return;
        }
      }
      if(typeof toast === 'function') toast('✓ Uprawnienia zapisane');
      else alert('Uprawnienia zapisane');
      close();
    } catch(e){
      alert('Blad sieci: ' + e.message);
    } finally {
      if(btn){ btn.disabled = false; btn.textContent = 'Zapisz'; }
    }
  }

  function injectButton(){
    if(document.getElementById('company-access-btn')) return;

    const page = document.getElementById('page-firmy');
    if(!page) return;

    const addBtn = document.getElementById('company-create-btn');
    const target = addBtn || page.querySelector('.pg-title') || page.firstElementChild;
    if(!target) return;

    const btn = document.createElement('button');
    btn.id = 'company-access-btn';
    btn.type = 'button';
    btn.className = 'btn btn-blue';
    btn.style.margin = '10px 0 10px 8px';
    btn.innerHTML = '👥 Uprawnienia firm';
    btn.addEventListener('click', open);

    target.insertAdjacentElement(addBtn ? 'afterend' : 'afterend', btn);
  }

  function start(){
    document.addEventListener('click', function(e){
      if(e.target.closest('#tnb-firmy')){
        setTimeout(injectButton, 700);
      }
    });

    setInterval(function(){
      const page = document.getElementById('page-firmy');
      if(page && page.classList.contains('active')) injectButton();
    }, 1200);

    console.log('[CompanyAccess] Aktywne');
  }

  window.TaxOrderCompanyAccess = {
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
