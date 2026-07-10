// ==================== WEBHOOKI WYCHODZĄCE — UI ====================
window.WebhooksUI = (function () {

  const API_EVENTS = [
    { value: 'alert',           label: 'Alerty & Terminy (OC, przegląd, serwis)' },
    { value: 'dt1_generated',   label: 'Generowanie DT-1 PDF' },
    { value: 'inspection_due',  label: 'Przegląd techniczny — wygaśnięcie' },
    { value: 'damage_added',    label: 'Nowa szkoda dodana do pojazdu' },
    { value: 'fuel_anomaly',    label: 'Anomalia w tankowaniu' },
    { value: '*',               label: 'Wszystkie zdarzenia' },
  ];

  let _hooks = [];

  function _apiBase() { return window.TaxOrderFleetCloud?.apiBase || ''; }
  function _company() { return window.TaxOrderFleetCloud?.getCompanyId?.() || 'mtoilet'; }
  function _token()   { return localStorage.getItem('cf_token') || ''; }

  async function load() {
    try {
      const r = await fetch(`${_apiBase()}/api/webhooks?company=${encodeURIComponent(_company())}`,
        { headers: { Authorization: 'Bearer ' + _token() } });
      if (r.ok) _hooks = await r.json();
    } catch { _hooks = []; }
    _render();
  }

  function _render() {
    const el = document.getElementById('webhooks-list');
    if (!el) return;
    if (!_hooks.length) {
      el.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3)">
        <i class="ti ti-webhook" style="font-size:40px;display:block;margin-bottom:12px"></i>
        <div style="font-size:14px;font-weight:500;margin-bottom:6px">Brak skonfigurowanych webhooków</div>
        <div style="font-size:12px">Dodaj URL, na który system będzie wysyłał POST przy wybranych zdarzeniach.</div>
      </div>`;
      return;
    }
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
      ${_hooks.map(h => {
        let events = [];
        try { events = JSON.parse(h.events||'[]'); } catch {}
        const evLabels = esc(events.map(e => API_EVENTS.find(x=>x.value===e)?.label || e).join(', '));
        const status = h.last_status ? (h.last_status < 300 ? '#16a34a' : '#dc2626') : '#9ca3af';
        const lastFired = h.last_fired_at ? new Date(h.last_fired_at).toLocaleString('pl-PL') : 'Nigdy';
        return `
        <div style="border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;background:var(--bg);display:flex;align-items:flex-start;gap:14px">
          <div style="width:10px;height:10px;border-radius:50%;background:${h.active?'#16a34a':'#9ca3af'};flex-shrink:0;margin-top:4px"></div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;margin-bottom:2px">${esc(h.name)}</div>
            <div style="font-size:11px;color:var(--text2);font-family:var(--mono);word-break:break-all;margin-bottom:6px">${esc(h.url)}</div>
            <div style="font-size:11px;color:var(--text3)">Zdarzenia: ${evLabels}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">
              Ostatnie wywołanie: ${lastFired}
              ${h.last_status ? `<span style="color:${status};font-weight:600;margin-left:6px">HTTP ${h.last_status}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-gray" style="padding:5px 10px;font-size:11px" title="Test" data-id="${esc(h.id)}" onclick="WebhooksUI.test(this.dataset.id)"><i class="ti ti-send"></i></button>
            <button class="btn btn-gray" style="padding:5px 10px;font-size:11px" title="${h.active?'Dezaktywuj':'Aktywuj'}" data-id="${esc(h.id)}" data-active="${h.active?'1':'0'}" onclick="WebhooksUI.toggle(this.dataset.id,this.dataset.active!=='1')">
              <i class="ti ti-${h.active?'pause':'play'}"></i>
            </button>
            <button class="btn btn-gray" style="padding:5px 10px;font-size:11px;color:var(--red)" title="Usuń" data-id="${esc(h.id)}" onclick="WebhooksUI.del(this.dataset.id)"><i class="ti ti-trash"></i></button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function openModal(data = {}) {
    let modal = document.getElementById('webhook-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'webhook-modal';
    modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center;padding:24px';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius-lg);padding:28px;width:560px;max-width:97vw;box-shadow:0 8px 48px rgba(0,0,0,.4)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
          <i class="ti ti-webhook" style="font-size:20px;color:var(--blue)"></i>
          <span style="font-size:17px;font-weight:700">Nowy webhook</span>
          <button onclick="document.getElementById('webhook-modal').remove()" style="margin-left:auto;background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3)">×</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">Nazwa</label>
            <input id="wh-name" class="fi" placeholder="np. Teams — Alert floty" value="${esc(data.name||'')}">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">URL endpointu</label>
            <input id="wh-url" class="fi" placeholder="https://hooks.teams.microsoft.com/..." value="${esc(data.url||'')}">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;margin-bottom:6px;display:block">Zdarzenia (zaznacz które mają wyzwalać webhook)</label>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${API_EVENTS.map(ev => `
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius)">
                <input type="checkbox" class="wh-ev" value="${ev.value}" ${(data.events||['alert']).includes(ev.value)?'checked':''}>
                <span>${ev.label}</span>
              </label>`).join('')}
            </div>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">Sekret (opcjonalnie — wysyłany jako nagłówek X-TaxOrder-Signature)</label>
            <input id="wh-secret" class="fi" placeholder="Zostaw puste jeśli nie potrzebujesz weryfikacji" value="${esc(data.secret||'')}">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn btn-gray" style="flex:1" onclick="document.getElementById('webhook-modal').remove()">Anuluj</button>
          <button class="btn btn-blue" style="flex:1" onclick="WebhooksUI.save()"><i class="ti ti-device-floppy"></i>Zapisz webhook</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  async function save() {
    const name   = document.getElementById('wh-name')?.value?.trim();
    const url    = document.getElementById('wh-url')?.value?.trim();
    const secret = document.getElementById('wh-secret')?.value?.trim();
    const events = [...document.querySelectorAll('.wh-ev:checked')].map(el => el.value);
    if (!name) { if (typeof toast === 'function') toast('Podaj nazwę'); return; }
    if (!url)  { if (typeof toast === 'function') toast('Podaj URL'); return; }
    if (!events.length) { if (typeof toast === 'function') toast('Wybierz co najmniej jedno zdarzenie'); return; }

    try {
      const r = await fetch(`${_apiBase()}/api/webhooks?company=${encodeURIComponent(_company())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token() },
        body: JSON.stringify({ name, url, events, secret: secret || null }),
      });
      if (r.ok) {
        document.getElementById('webhook-modal')?.remove();
        if (typeof toast === 'function') toast('✓ Webhook dodany');
        await load();
      } else {
        if (typeof toast === 'function') toast('Błąd zapisu');
      }
    } catch(e) { if (typeof toast === 'function') toast('Błąd: ' + e.message); }
  }

  async function test(id) {
    if (typeof toast === 'function') toast('⏳ Wysyłam test...');
    try {
      const r = await fetch(`${_apiBase()}/api/webhooks/${id}/test?company=${encodeURIComponent(_company())}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + _token() },
      });
      const res = await r.json();
      if (res.ok) { if (typeof toast === 'function') toast(`✓ Test OK — HTTP ${res.status}`); }
      else { if (typeof toast === 'function') toast(`⚠ Test nieudany: ${res.error||res.status}`); }
      await load();
    } catch(e) { if (typeof toast === 'function') toast('Błąd: ' + e.message); }
  }

  async function toggle(id, active) {
    await fetch(`${_apiBase()}/api/webhooks/${id}?company=${encodeURIComponent(_company())}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token() },
      body: JSON.stringify({ active }),
    });
    await load();
  }

  async function del(id) {
    if (!confirm('Usunąć ten webhook?')) return;
    await fetch(`${_apiBase()}/api/webhooks/${id}?company=${encodeURIComponent(_company())}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + _token() },
    });
    await load();
  }

  return { load, openModal, save, test, toggle, del };
})();
