/**
 * TaxOrder Pro — Integracja Tekom / MyCar API
 * Automatyczny sync stanu km i GPS z systemu GPS MyCar (TEKOM Technologia).
 * Endpoint: https://api-mcdesktop.tekom.pl/api/
 */
window.TekomSync = (function () {

  function _api() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  function _token() { return localStorage.getItem('cf_token'); }
  function _co() { return window.currentCompanyId || 'mtoilet'; }
  function _hdrs(extra) {
    const t = _token();
    return { ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(extra || {}) };
  }
  function _url(path) { return `${_api()}${path}?company=${_co()}`; }

  let _cfg = null; // cache konfiguracji

  async function loadConfig() {
    try {
      const r = await fetch(_url('/api/tekom'), { headers: _hdrs() });
      _cfg = r.ok ? await r.json() : null;
    } catch { _cfg = null; }
    return _cfg;
  }

  function _fmtDate(s) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString('pl-PL'); } catch { return s; }
  }

  // ── Render głównej sekcji integracji ─────────────────────────────────────
  async function renderSection(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div style="padding:20px;color:var(--text3)"><i class="ti ti-loader ti-spin"></i> Ładowanie...</div>';

    const cfg = await loadConfig();

    el.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;max-width:560px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <i class="ti ti-map-pin" style="font-size:22px;color:var(--blue)"></i>
          <div>
            <div style="font-weight:600;font-size:14px">Integracja Tekom / MyCar GPS</div>
            <div style="font-size:11px;color:var(--text3)">Automatyczny odczyt stanu licznika i pozycji GPS z systemu MyCar</div>
          </div>
          <span style="margin-left:auto;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;${cfg?.configured ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'}">
            ${cfg?.configured ? '● Skonfigurowane' : '○ Nie skonfigurowane'}
          </span>
        </div>

        ${cfg?.configured ? `
          <div style="background:var(--bg3);border-radius:var(--radius);padding:12px;margin-bottom:16px;font-size:12px">
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px">
              <span style="color:var(--text3)">Login:</span><span style="font-weight:500">${cfg.login || '—'}</span>
              ${cfg.serverName ? `<span style="color:var(--text3)">Serwer:</span><span>${cfg.serverName}</span>` : ''}
              ${cfg.dbName     ? `<span style="color:var(--text3)">Baza:</span><span>${cfg.dbName}</span>` : ''}
              <span style="color:var(--text3)">Ostatni sync:</span>
              <span>${cfg.lastSync ? _fmtDate(cfg.lastSync) + ` (${cfg.lastSyncVehicles||0} pojazdów)` : 'Nigdy'}</span>
            </div>
          </div>` : ''}

        <!-- Formularz konfiguracji -->
        <div id="tekom-cfg-form">
          <div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
            ${cfg?.configured ? 'Zmień konfigurację' : 'Skonfiguruj połączenie'}
          </div>
          <div class="vdfg" style="margin-bottom:12px">
            <div class="vdf">
              <label class="vdl">Login MyCar *</label>
              <input id="tekom-login" type="text" class="fi" placeholder="np. adamc" value="${cfg?.login||''}">
            </div>
            <div class="vdf">
              <label class="vdl">Hasło MyCar *</label>
              <input id="tekom-pass" type="password" class="fi" placeholder="hasło do logowania">
            </div>
            <div class="vdf">
              <label class="vdl">Nazwa serwera <span style="color:var(--text3)">(opcjonalnie)</span></label>
              <input id="tekom-server" type="text" class="fi" placeholder="domyślny serwer" value="${cfg?.serverName||''}">
            </div>
            <div class="vdf">
              <label class="vdl">Baza danych <span style="color:var(--text3)">(opcjonalnie)</span></label>
              <input id="tekom-db" type="text" class="fi" placeholder="domyślna baza" value="${cfg?.dbName||''}">
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-blue" onclick="TekomSync.saveConfig()">
              <i class="ti ti-device-floppy"></i>Zapisz konfigurację
            </button>
            ${cfg?.configured ? `
              <button class="btn btn-gray" onclick="TekomSync.testConnection()">
                <i class="ti ti-plug-connected"></i>Test połączenia
              </button>
              <button class="btn btn-green" onclick="TekomSync.runSync()">
                <i class="ti ti-refresh"></i>Synchronizuj teraz
              </button>` : ''}
          </div>
        </div>

        <div id="tekom-result" style="margin-top:14px"></div>

        <!-- Jak to działa -->
        <details style="margin-top:16px;font-size:12px;color:var(--text2)">
          <summary style="cursor:pointer;font-weight:500;color:var(--text1)">Jak działa synchronizacja?</summary>
          <div style="margin-top:8px;line-height:1.7">
            <p>Po skonfigurowaniu TaxOrder Pro łączy się z API MyCar (<code>api-mcdesktop.tekom.pl</code>) i:</p>
            <ul style="margin:6px 0 0 16px">
              <li>Pobiera listę pojazdów z aktualnym stanem licznika</li>
              <li>Dopasowuje pojazdy po numerze rejestracyjnym</li>
              <li>Aktualizuje stan km tylko jeśli nowy odczyt jest wyższy</li>
              <li>Zapisuje ostatnią pozycję GPS do historii pojazdu</li>
            </ul>
            <p style="margin-top:8px;color:var(--text3)">Dane logowania są przechowywane bezpiecznie w Cloudflare KV (szyfrowane). Hasło nie jest nigdy zwracane przez API.</p>
            <p style="margin-top:6px">Tekom MyCar musi być skonfigurowany w Twojej firmie. Użyj tych samych danych co do aplikacji desktopowej MyCar.</p>
          </div>
        </details>
      </div>`;
  }

  async function saveConfig() {
    const login = document.getElementById('tekom-login')?.value?.trim();
    const pass  = document.getElementById('tekom-pass')?.value;
    const server= document.getElementById('tekom-server')?.value?.trim();
    const db    = document.getElementById('tekom-db')?.value?.trim();

    if (!login || !pass) { window.toast?.('Podaj login i hasło'); return; }

    const res = document.getElementById('tekom-result');
    if (res) res.innerHTML = '<span style="color:var(--text3)"><i class="ti ti-loader ti-spin"></i> Zapisywanie...</span>';

    try {
      const r = await fetch(_url('/api/tekom/config'), {
        method: 'POST',
        headers: _hdrs({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ login, password: pass, serverName: server, dbName: db }),
      });
      const d = await r.json();
      if (d.ok) {
        window.toast?.('✓ Konfiguracja Tekom zapisana');
        renderSection('tekom-section');
      } else {
        if (res) res.innerHTML = `<div style="color:var(--red);padding:8px">${d.error || 'Błąd zapisu'}</div>`;
      }
    } catch(e) {
      if (res) res.innerHTML = `<div style="color:var(--red);padding:8px">Błąd sieci: ${e.message}</div>`;
    }
  }

  async function testConnection() {
    const res = document.getElementById('tekom-result');
    if (res) res.innerHTML = '<span style="color:var(--text3)"><i class="ti ti-loader ti-spin"></i> Testowanie połączenia z MyCar...</span>';

    try {
      const r = await fetch(_url('/api/tekom/test'), {
        method: 'POST',
        headers: _hdrs({ 'Content-Type': 'application/json' }),
      });
      const d = await r.json();
      if (res) {
        if (d.ok) {
          res.innerHTML = `
            <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:var(--radius);padding:12px">
              <div style="font-weight:600;color:#065f46"><i class="ti ti-circle-check"></i> ${d.msg}</div>
              ${d.sampleVehicles?.length ? `
                <div style="margin-top:8px;font-size:11px;color:#047857">
                  Przykładowe pojazdy: ${d.sampleVehicles.map(v => v.Registration||v.registration||JSON.stringify(v).slice(0,40)).join(', ')}
                </div>` : ''}
            </div>`;
        } else {
          res.innerHTML = `
            <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:var(--radius);padding:12px">
              <div style="font-weight:600;color:#991b1b"><i class="ti ti-alert-triangle"></i> Błąd połączenia</div>
              <div style="font-size:12px;margin-top:4px;color:#7f1d1d">${d.msg}</div>
            </div>`;
        }
      }
    } catch(e) {
      if (res) res.innerHTML = `<div style="color:var(--red)">Błąd: ${e.message}</div>`;
    }
  }

  async function runSync() {
    const res = document.getElementById('tekom-result');
    if (res) res.innerHTML = '<span style="color:var(--text3)"><i class="ti ti-loader ti-spin"></i> Synchronizuję dane z MyCar...</span>';

    try {
      const r = await fetch(_url('/api/tekom/sync'), {
        method: 'POST',
        headers: _hdrs({ 'Content-Type': 'application/json' }),
      });
      const d = await r.json();
      if (res) {
        const color = d.ok ? '#d1fae5' : '#fee2e2';
        const borderColor = d.ok ? '#6ee7b7' : '#fca5a5';
        const textColor = d.ok ? '#065f46' : '#991b1b';
        res.innerHTML = `
          <div style="background:${color};border:1px solid ${borderColor};border-radius:var(--radius);padding:12px">
            <div style="font-weight:600;color:${textColor}"><i class="ti ti-${d.ok?'circle-check':'alert-triangle'}"></i> ${d.msg}</div>
            ${d.ok && d.unmatched > 0 ? `<div style="font-size:11px;margin-top:4px;color:#047857">Nieznane nr rej.: ${d.unmatched} (nie zarejestrowane w TaxOrder Pro)</div>` : ''}
          </div>`;
      }

      if (d.ok) {
        // Odśwież dane pojazdów w pamięci jeśli możliwe
        if (typeof window.TaxOrderFleetCloud?.loadVehicles === 'function') {
          await window.TaxOrderFleetCloud.loadVehicles();
        }
        renderSection('tekom-section');
      }
    } catch(e) {
      if (res) res.innerHTML = `<div style="color:var(--red)">Błąd: ${e.message}</div>`;
    }
  }

  return { renderSection, saveConfig, testConnection, runSync };
})();
