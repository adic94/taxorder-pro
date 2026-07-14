(function () {
  'use strict';
  const API = window.WORKER_URL || '';
  const co  = () => localStorage.getItem('currentCompany') || '';
  let _pollingTimer = null;

  async function api(path, opts={}) {
    const r = await fetch(`${API}/api/messages${path}?company=${co()}`, { headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('authToken')}`}, ...opts });
    return r.json();
  }

  function renderMessenger() {
    const el = document.getElementById('page-messenger');
    if (!el) return;
    if (_pollingTimer) clearInterval(_pollingTimer);
    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-message-circle"></i> Komunikator Wewnętrzny</h2>
        <button class="btn btn-primary" onclick="window.MessengerModule._openCompose()"><i class="ti ti-send"></i> Nowa wiadomość</button>
      </div>
      <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;height:calc(100vh - 200px)">
        <div style="border:1px solid var(--border,#e2e8f0);border-radius:8px;overflow-y:auto">
          <div style="padding:10px;border-bottom:1px solid var(--border)">
            <input id="msg-search" class="form-control" placeholder="Szukaj wiadomości..." oninput="window.MessengerModule._loadList()">
          </div>
          <div id="msg-list"></div>
        </div>
        <div id="msg-thread" style="border:1px solid var(--border,#e2e8f0);border-radius:8px;display:flex;flex-direction:column">
          <div style="flex:1;padding:16px;overflow-y:auto;color:var(--text-muted)" id="msg-thread-body">
            <div style="text-align:center;margin-top:60px"><i class="ti ti-message-off" style="font-size:3em"></i><br>Wybierz wiadomość</div>
          </div>
        </div>
      </div>
      <div id="msg-compose-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.MessengerModule._closeCompose()">
        <div class="modal-box" style="max-width:540px">
          <div class="modal-header"><h3>Nowa wiadomość</h3><button class="modal-close" onclick="window.MessengerModule._closeCompose()">×</button></div>
          <div class="modal-body">
            <form id="msg-compose-form" onsubmit="window.MessengerModule._send(event)">
              <div class="form-row"><label>Odbiorca (email / ID)</label><input name="to_user" class="form-control" required placeholder="Email lub ID użytkownika"></div>
              <div class="form-row"><label>Powiązany pojazd (opcjonalnie)</label><input name="vehicle_reg" class="form-control" placeholder="Nr rej."></div>
              <div class="form-row"><label>Temat</label><input name="subject" class="form-control" placeholder="Temat wiadomości"></div>
              <div class="form-row"><label>Treść *</label><textarea name="body" class="form-control" rows="5" required placeholder="Wpisz wiadomość..."></textarea></div>
              <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="window.MessengerModule._closeCompose()">Anuluj</button><button type="submit" class="btn btn-primary"><i class="ti ti-send"></i> Wyślij</button></div>
            </form>
          </div>
        </div>
      </div>`;
    _loadList();
    _pollingTimer = setInterval(_loadList, 30000);
  }

  async function _loadList() {
    const q = document.getElementById('msg-search')?.value || '';
    const listEl = document.getElementById('msg-list');
    if (!listEl) return;
    const data = await api(`?q=${encodeURIComponent(q)}`);
    const msgs = data.messages || [];
    if (!msgs.length) { listEl.innerHTML = '<div style="padding:16px;color:var(--text-muted);text-align:center">Brak wiadomości</div>'; return; }
    listEl.innerHTML = msgs.map(m => `
      <div class="msg-item" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;${!m.read_at?'font-weight:600':''}" data-id="${esc(m.id)}" onclick="window.MessengerModule._openThread(this.dataset.id)">
        <div style="display:flex;justify-content:space-between;gap:4px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.from_user||'—')}</span>
          <span style="font-size:.8em;color:var(--text-muted);white-space:nowrap">${esc(m.created_at?.slice(0,10)||'')}</span>
        </div>
        <div style="font-size:.85em;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.subject||'(bez tematu)')}</div>
        ${m.vehicle_reg?`<div style="font-size:.78em"><span class="pill">${esc(m.vehicle_reg)}</span></div>`:''}
      </div>`).join('');
  }

  async function _openThread(id) {
    const threadEl = document.getElementById('msg-thread-body');
    if (!threadEl) return;
    const data = await api(`/${id}/thread`);
    const thread = data.thread || [];
    await api(`/${id}/read`, { method:'POST', body:'{}' });
    threadEl.innerHTML = thread.length
      ? thread.map(m => `<div style="margin-bottom:16px;padding:12px;border-radius:8px;background:var(--bg-card,#f8fafc);border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <strong>${esc(m.from_user||'—')}</strong>
            <span style="font-size:.8em;color:var(--text-muted)">${esc(m.created_at?.replace('T',' ').slice(0,16)||'')}</span>
          </div>
          ${m.subject?`<div style="font-weight:600;margin-bottom:4px">${esc(m.subject)}</div>`:''}
          <div style="white-space:pre-wrap;word-break:break-word">${esc(m.body||'')}</div>
          ${m.vehicle_reg?`<div style="margin-top:6px"><span class="pill"><i class="ti ti-car"></i> ${esc(m.vehicle_reg)}</span></div>`:''}
        </div>`).join('')
      : '<div style="color:var(--text-muted)">Brak wiadomości w wątku</div>';
    _loadList();
  }

  function _openCompose() { document.getElementById('msg-compose-modal').style.display='flex'; }
  function _closeCompose() { document.getElementById('msg-compose-modal').style.display='none'; }

  async function _send(ev) {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    await api('', { method:'POST', body: JSON.stringify(body) });
    _closeCompose();
    ev.target.reset();
    _loadList();
  }

  window.MessengerModule = { renderMessenger, _loadList, _openThread, _openCompose, _closeCompose, _send };
})();
