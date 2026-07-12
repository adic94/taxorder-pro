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
              <span style="color:var(--text3)">Login:</span><span style="font-weight:500">${esc(cfg.login || '—')}</span>
              ${cfg.serverName ? `<span style="color:var(--text3)">Serwer:</span><span>${esc(cfg.serverName)}</span>` : ''}
              ${cfg.dbName     ? `<span style="color:var(--text3)">Baza:</span><span>${esc(cfg.dbName)}</span>` : ''}
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
              <input id="tekom-login" type="text" class="fi" placeholder="np. adamc" value="${esc(cfg?.login||'')}">
            </div>
            <div class="vdf">
              <label class="vdl">Hasło MyCar *</label>
              <input id="tekom-pass" type="password" class="fi" placeholder="hasło do logowania">
            </div>
            <div class="vdf">
              <label class="vdl">Nazwa serwera <span style="color:var(--text3)">(opcjonalnie)</span></label>
              <input id="tekom-server" type="text" class="fi" placeholder="domyślny serwer" value="${esc(cfg?.serverName||'')}">
            </div>
            <div class="vdf">
              <label class="vdl">Baza danych <span style="color:var(--text3)">(opcjonalnie)</span></label>
              <input id="tekom-db" type="text" class="fi" placeholder="domyślna baza" value="${esc(cfg?.dbName||'')}">
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
        ${cfg?.configured ? `
          <!-- E-toll widget -->
          <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="ti ti-road" style="color:var(--blue)"></i>
              <span style="font-weight:500;font-size:13px">Salda e-Toll</span>
              <button class="btn btn-gray" style="font-size:11px;margin-left:auto" onclick="TekomSync.refreshEtoll()">
                <i class="ti ti-refresh"></i>Sprawdź
              </button>
            </div>
            <div id="tekom-etoll-result" style="font-size:12px;color:var(--text3)">
              Kliknij "Sprawdź" aby pobrać aktualne salda e-Toll z Tekom
            </div>
          </div>` : ''}

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
            <p style="margin-top:8px;color:var(--text3)">Dane logowania są przechowywane bezpiecznie w Cloudflare KV. Hasło nie jest nigdy zwracane przez API.</p>
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
        if (res) res.innerHTML = `<div style="color:var(--red);padding:8px">${(window.esc||String)(d.error || 'Błąd zapisu')}</div>`;
      }
    } catch(e) {
      if (res) res.innerHTML = `<div style="color:var(--red);padding:8px">Błąd sieci: ${(window.esc||String)(e.message)}</div>`;
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
              <div style="font-weight:600;color:#065f46"><i class="ti ti-circle-check"></i> ${esc(d.msg)}</div>
              ${d.sampleVehicles?.length ? `
                <div style="margin-top:8px;font-size:11px;color:#047857">
                  Przykładowe pojazdy: ${d.sampleVehicles.map(v => esc(v.Registration||v.registration||String(v).slice(0,40))).join(', ')}
                </div>` : ''}
            </div>`;
        } else {
          res.innerHTML = `
            <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:var(--radius);padding:12px">
              <div style="font-weight:600;color:#991b1b"><i class="ti ti-alert-triangle"></i> Błąd połączenia</div>
              <div style="font-size:12px;margin-top:4px;color:#7f1d1d">${esc(d.msg)}</div>
            </div>`;
        }
      }
    } catch(e) {
      if (res) res.innerHTML = `<div style="color:var(--red)">Błąd: ${(window.esc||String)(e.message)}</div>`;
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
      if (res) res.innerHTML = `<div style="color:var(--red)">Błąd: ${(window.esc||String)(e.message)}</div>`;
    }
  }

  async function refreshEtoll() {
    const res = document.getElementById('tekom-etoll-result');
    if (res) res.innerHTML = '<span style="color:var(--text3)"><i class="ti ti-loader ti-spin"></i> Pobieranie sald e-Toll...</span>';

    try {
      const r = await fetch(_url('/api/tekom/etoll'), { headers: _hdrs() });
      const d = await r.json();
      if (!res) return;
      if (!d.ok) {
        res.innerHTML = `<span style="color:var(--red)">Błąd: ${(window.esc||String)(d.msg)}</span>`;
        return;
      }
      const devs = d.devices || [];
      if (!devs.length) {
        res.innerHTML = '<span style="color:var(--text3)">Brak urządzeń e-Toll w systemie Tekom lub odpowiedź pusta.</span>';
        return;
      }
      res.innerHTML = devs.map(dev => {
        const plate = dev.Registration || dev.registration || dev.PlateNo || dev.plateNo || dev.VehicleRegistration || '—';
        const balance = dev.Balance || dev.balance || dev.Amount || dev.amount || dev.CurrentBalance || null;
        const deviceId = dev.DeviceId || dev.deviceId || dev.Id || dev.id || dev.EtollId || '';
        const status = dev.Status || dev.status || '';
        const low = balance !== null && Number(balance) < 50;
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:0.5px solid var(--border)">
            <i class="ti ti-road" style="color:${low ? 'var(--red)' : 'var(--green)'}"></i>
            <span style="font-weight:500;font-family:var(--mono);min-width:80px">${plate}</span>
            ${deviceId ? `<span style="font-size:10px;color:var(--text3)">${deviceId}</span>` : ''}
            <span style="margin-left:auto;font-weight:700;color:${low ? 'var(--red)' : 'var(--text1)'}">
              ${balance !== null ? Number(balance).toFixed(2) + ' zł' : '—'}
              ${low ? ' ⚠ Niskie saldo!' : ''}
            </span>
            ${status ? `<span style="font-size:10px;color:var(--text3)">${status}</span>` : ''}
          </div>`;
      }).join('');
    } catch(e) {
      if (res) res.innerHTML = `<span style="color:var(--red)">Błąd: ${(window.esc||String)(e.message)}</span>`;
    }
  }

  return { renderSection, saveConfig, testConnection, runSync, refreshEtoll };
})();
