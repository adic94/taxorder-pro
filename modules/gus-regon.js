/**
 * TaxOrder Pro — Moduł GUS REGON
 * Wyszukiwarka firm po NIP przez GUS BIR1 (proxy Worker).
 * Eksportuje: window.GusRegonModule
 *   - renderGusRegon()           — strona standalone
 *   - lookupNip(nip, callback)   — callable z innych stron
 *   - renderWidget(id, callback) — inline widget do osadzenia
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.() || window.currentCompanyId || '';

  const LS_HISTORY = 'taxorder_gus_history';

  // Bufor do kopiowania — unika przekazywania danych przez onclick
  let _copyBuffer = '';

  // Callbacki widgetów per containerId
  const _widgetCallbacks = {};

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _token() { return localStorage.getItem('cf_token') || ''; }
  function _hdrs() {
    const t = _token();
    return t ? { Authorization: `Bearer ${  t}` } : {};
  }

  function _loadHistory() {
    try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); } catch { return []; }
  }

  function _addHistory(entry) {
    const hist = _loadHistory();
    hist.unshift({ ...entry, ts: new Date().toISOString() });
    localStorage.setItem(LS_HISTORY, JSON.stringify(hist.slice(0, 10)));
  }

  function _cleanNip(raw) { return String(raw ?? '').replace(/\D/g, ''); }
  function _isValidNip(nip) { return /^\d{10}$/.test(nip); }

  // ── Core API call ──────────────────────────────────────────────────────────
  /**
   * Pobiera dane firmy po NIP z backendu (proxy GUS BIR1).
   * @param {string} nip       — 10-cyfrowy NIP (znaki niebędące cyframi są ignorowane)
   * @param {Function} callback — (data, errorMsg?) — data=null gdy błąd
   */
  async function lookupNip(nip, callback) {
    const clean = _cleanNip(nip);
    if (!_isValidNip(clean)) {
      callback(null, 'NIP musi składać się z dokładnie 10 cyfr');
      return;
    }
    try {
      const url  = `${API()}/api/gus-regon?nip=${encodeURIComponent(clean)}&company=${encodeURIComponent(Co())}`;
      const resp = await fetch(url, { headers: _hdrs() });

      if (resp.status === 404 || resp.status === 501 || resp.status === 501) {
        callback(null, 'Skonfiguruj integrację GUS w ustawieniach Workera');
        return;
      }
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        callback(null, errData.error || `Błąd serwera (HTTP ${resp.status})`);
        return;
      }
      const data = await resp.json();
      _addHistory({ nip: clean, name: data.name || '' });
      callback(data);
    } catch (e) {
      callback(null, e.message || 'Błąd połączenia z backendem');
    }
  }

  // ── Standalone page ────────────────────────────────────────────────────────
  function renderGusRegon() {
    const pg = document.getElementById('page-gus-regon');
    if (!pg) return;

    pg.innerHTML = `
      <div style="padding:20px 24px 8px">
        <h2 style="margin:0 0 4px;font-size:18px;font-weight:700">
          <i class="ti ti-building-bank"></i> GUS REGON — Wyszukiwarka firm
        </h2>
        <p style="margin:0;font-size:13px;color:var(--text3)">
          Wyszukaj dane firmy po NIP w rejestrze GUS BIR1.
          Wymaga skonfigurowanego endpointu w Workerze.
        </p>
      </div>

      <div style="padding:16px 24px 24px;max-width:660px">

        <!-- Formularz wyszukiwania -->
        <div style="background:var(--surface);border:1px solid var(--border);
                    border-radius:10px;padding:20px;margin-bottom:20px">
          <div class="form-label" style="margin-bottom:8px;font-weight:600">NIP firmy</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input id="gus-nip-input" class="form-input" type="text" maxlength="13"
              placeholder="np. 5260304440"
              style="width:200px;font-family:var(--mono,monospace);letter-spacing:1px"
              oninput="GusRegonModule._onNipInput(this)"
              onkeydown="if(event.key==='Enter') GusRegonModule.doLookup()">
            <button id="gus-lookup-btn" class="btn btn-blue" onclick="GusRegonModule.doLookup()">
              <i class="ti ti-search"></i> Wyszukaj w GUS
            </button>
          </div>
          <div id="gus-nip-hint" style="font-size:11px;color:var(--text3);margin-top:5px;min-height:16px"></div>
        </div>

        <!-- Wynik -->
        <div id="gus-result" style="display:none;background:var(--surface);
             border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:20px"></div>

        <!-- Historia -->
        <div>
          <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text2)">
            Ostatnie wyszukiwania (ostatnie 10)
          </div>
          <div id="gus-history-list"></div>
        </div>
      </div>
    `;

    _renderHistory();
  }

  function _onNipInput(el) {
    const nip  = _cleanNip(el.value);
    const hint = document.getElementById('gus-nip-hint');
    if (!hint) return;
    if (nip.length === 0)  { hint.textContent = ''; return; }
    if (nip.length < 10)   { hint.textContent = `${nip.length}/10 cyfr`; hint.style.color = 'var(--amber,#f59e0b)'; return; }
    if (nip.length === 10) { hint.textContent = '10 cyfr — gotowe'; hint.style.color = 'var(--green,#22c55e)'; return; }
    hint.textContent = 'Zbyt długi NIP'; hint.style.color = 'var(--red,#ef4444)';
  }

  async function doLookup() {
    const input  = document.getElementById('gus-nip-input');
    const btn    = document.getElementById('gus-lookup-btn');
    const result = document.getElementById('gus-result');
    if (!input || !result) return;

    const nip = _cleanNip(input.value);
    result.style.display = 'block';

    if (!_isValidNip(nip)) {
      result.innerHTML = `<div style="color:var(--red,#ef4444)">
        <i class="ti ti-alert-circle"></i> NIP musi składać się z dokładnie 10 cyfr.
      </div>`;
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Szukam…'; }
    result.innerHTML = '<div style="color:var(--text3)"><i class="ti ti-loader-2"></i> Odpytuję GUS…</div>';

    lookupNip(nip, (data, errMsg) => {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-search"></i> Wyszukaj w GUS'; }

      if (errMsg) {
        const isSetup = errMsg.includes('Workera');
        result.innerHTML = `
          <div style="display:flex;align-items:flex-start;gap:10px">
            <i class="ti ti-alert-triangle" style="color:var(--amber,#f59e0b);font-size:18px;margin-top:1px"></i>
            <div>
              <div style="font-weight:600;margin-bottom:4px">${esc(errMsg)}</div>
              ${isSetup ? `<div style="font-size:12px;color:var(--text3)">
                Dodaj endpoint <code>/api/gus-regon</code> w pliku <code>worker/index.js</code>,
                skonfiguruj klucz API GUS BIR1 i wdróż Worker.
              </div>` : ''}
            </div>
          </div>
        `;
        return;
      }

      result.innerHTML = _buildResultHtml(data);
      _renderHistory();
    });
  }

  function _buildResultHtml(data) {
    // Budujemy tekst do schowka (dane surowe, nie escapowane HTML)
    _copyBuffer = [
      `Nazwa: ${data.name || ''}`,
      `NIP: ${data.nip || ''}`,
      `REGON: ${data.regon || ''}`,
      `Adres: ${data.address || ''}`,
      `PKD: ${data.pkd || ''}`,
      `Forma prawna: ${data.legalForm || ''}`,
      `Status: ${data.status || ''}`,
    ].join('\n');

    const active      = String(data.status || '').toLowerCase().includes('aktyw');
    const statusColor = active ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)';

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:8px">
        <strong style="font-size:14px">${esc(data.name || '—')}</strong>
        <span style="color:${statusColor};font-size:12px;font-weight:600;white-space:nowrap">
          ${esc(data.status || '—')}
        </span>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:14px">
        <tr>
          <td style="color:var(--text3);padding:4px 10px 4px 0;width:110px;white-space:nowrap">NIP</td>
          <td style="font-family:var(--mono,monospace)">${esc(data.nip || '—')}</td>
        </tr>
        <tr>
          <td style="color:var(--text3);padding:4px 10px 4px 0">REGON</td>
          <td style="font-family:var(--mono,monospace)">${esc(data.regon || '—')}</td>
        </tr>
        <tr>
          <td style="color:var(--text3);padding:4px 10px 4px 0">Adres</td>
          <td>${esc(data.address || '—')}</td>
        </tr>
        <tr>
          <td style="color:var(--text3);padding:4px 10px 4px 0">PKD</td>
          <td>${esc(data.pkd || '—')}</td>
        </tr>
        <tr>
          <td style="color:var(--text3);padding:4px 10px 4px 0">Forma prawna</td>
          <td>${esc(data.legalForm || '—')}</td>
        </tr>
      </table>
      <button class="btn" onclick="GusRegonModule._copyToClipboard()" style="font-size:12px">
        <i class="ti ti-copy"></i> Skopiuj dane
      </button>
    `;
  }

  function _copyToClipboard() {
    const text = _copyBuffer;
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (window.toast) toast('Dane skopiowane do schowka');
      }).catch(() => _copyFallback(text));
    } else {
      _copyFallback(text);
    }
  }

  function _copyFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); if (window.toast) toast('Dane skopiowane do schowka'); }
    catch { if (window.toast) toast('Nie udało się skopiować — zaznacz ręcznie'); }
    document.body.removeChild(ta);
  }

  function _renderHistory() {
    const el = document.getElementById('gus-history-list');
    if (!el) return;
    const hist = _loadHistory();

    if (!hist.length) {
      el.innerHTML = '<div style="font-size:13px;color:var(--text3)">Brak historii wyszukiwań.</div>';
      return;
    }

    el.innerHTML = hist.map(h => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;
           background:var(--surface);border:1px solid var(--border);
           border-radius:8px;font-size:13px;margin-bottom:6px">
        <span style="font-family:var(--mono,monospace);color:var(--text2);white-space:nowrap">
          ${esc(h.nip || '—')}
        </span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(h.name || '—')}
        </span>
        <span style="font-size:11px;color:var(--text3);white-space:nowrap">
          ${h.ts ? new Date(h.ts).toLocaleDateString('pl-PL') : '—'}
        </span>
        <button class="tbtn" title="Szukaj ponownie"
          data-nip="${esc(h.nip || '')}"
          onclick="GusRegonModule._historyRepeat(this.dataset.nip)">
          <i class="ti ti-refresh"></i>
        </button>
      </div>
    `).join('');
  }

  function _historyRepeat(nip) {
    const input = document.getElementById('gus-nip-input');
    if (input) input.value = nip;
    doLookup();
  }

  // ── Reusable widget (do osadzania na innych stronach) ──────────────────────
  /**
   * Wstrzykuje kompaktowy widget NIP → GUS do podanego kontenera.
   * @param {string}   containerId       — id elementu DOM
   * @param {Function} onResultCallback  — (data) wywoływany po udanym wyszukiwaniu
   */
  function renderWidget(containerId, onResultCallback) {
    const el = document.getElementById(containerId);
    if (!el) return;
    _widgetCallbacks[containerId] = onResultCallback;

    // Budujemy unikalne id inputu na podstawie containerId (bez danych użytkownika w onclick)
    const inputId  = `gw-nip-${containerId}`;
    const statusId = `gw-st-${containerId}`;

    el.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <input id="${esc(inputId)}" class="form-input" type="text" maxlength="13"
          placeholder="NIP (10 cyfr)"
          style="width:160px;font-family:var(--mono,monospace)"
          data-container="${esc(containerId)}"
          onkeydown="if(event.key==='Enter') GusRegonModule._widgetLookup(this.dataset.container)">
        <button class="btn btn-blue" style="font-size:12px;padding:6px 12px"
          data-container="${esc(containerId)}"
          onclick="GusRegonModule._widgetLookup(this.dataset.container)">
          <i class="ti ti-search"></i> GUS
        </button>
        <span id="${esc(statusId)}" style="font-size:12px;color:var(--text3)"></span>
      </div>
    `;
  }

  function _widgetLookup(containerId) {
    const inputId  = `gw-nip-${containerId}`;
    const statusId = `gw-st-${containerId}`;
    const input    = document.getElementById(inputId);
    const statusEl = document.getElementById(statusId);
    if (!input) return;
    if (statusEl) statusEl.textContent = 'Szukam…';

    lookupNip(input.value, (data, errMsg) => {
      if (errMsg) {
        if (statusEl) statusEl.textContent = errMsg;
        return;
      }
      if (statusEl) statusEl.textContent = esc(data.name || 'Znaleziono');
      const cb = _widgetCallbacks[containerId];
      if (typeof cb === 'function') cb(data);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.GusRegonModule = {
    renderGusRegon,
    lookupNip,
    renderWidget,
    doLookup,
    _onNipInput,
    _copyToClipboard,
    _historyRepeat,
    _widgetLookup,
  };

})();
