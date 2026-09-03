/**
 * TaxOrder Pro — Walidator VIES
 * Weryfikuje numery VAT UE przez VIES (proxy Worker).
 * Eksportuje: window.ViesValidatorModule
 *   - renderViesValidator() — strona z formularzem, batch i historią
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.() || window.currentCompanyId || '';

  const LS_HISTORY = 'taxorder_vies_history';

  const EU_COUNTRIES = [
    ['AT','Austria'],['BE','Belgia'],['BG','Bułgaria'],['CY','Cypr'],
    ['CZ','Czechy'],['DE','Niemcy'],['DK','Dania'],['EE','Estonia'],
    ['ES','Hiszpania'],['FI','Finlandia'],['FR','Francja'],['GB','Wielka Brytania'],
    ['GR','Grecja'],['HR','Chorwacja'],['HU','Węgry'],['IE','Irlandia'],
    ['IT','Włochy'],['LT','Litwa'],['LU','Luksemburg'],['LV','Łotwa'],
    ['MT','Malta'],['NL','Holandia'],['PL','Polska'],['PT','Portugalia'],
    ['RO','Rumunia'],['SE','Szwecja'],['SI','Słowenia'],['SK','Słowacja'],
  ];

  const COUNTRY_OPTIONS = EU_COUNTRIES.map(([code, name]) =>
    `<option value="${code}"${code === 'PL' ? ' selected' : ''}>${code} — ${esc(name)}</option>`
  ).join('');

  // ── State dla przetwarzania batch ──────────────────────────────────────────
  let _batchRunning = false;
  let _batchResults = [];

  // ── Storage helpers ────────────────────────────────────────────────────────
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
    localStorage.setItem(LS_HISTORY, JSON.stringify(hist.slice(0, 20)));
  }

  // ── Core check function ────────────────────────────────────────────────────
  async function _checkVat(countryCode, vatNumber) {
    const vat = (countryCode + vatNumber).replace(/\s+/g, '');
    try {
      const url  = `${API()}/api/vies-check?vat=${encodeURIComponent(vat)}&company=${encodeURIComponent(Co())}`;
      const resp = await fetch(url, { headers: _hdrs() });

      if (resp.status === 404 || resp.status === 501) {
        return { ok: false, setup: true, error: 'Skonfiguruj integrację VIES w ustawieniach Workera' };
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return { ok: false, error: err.error || `Błąd HTTP ${resp.status}` };
      }
      const data = await resp.json();
      return { ok: true, ...data };
    } catch (e) {
      return { ok: false, error: e.message || 'Błąd połączenia z backendem' };
    }
  }

  // ── Main page render ───────────────────────────────────────────────────────
  function renderViesValidator() {
    const pg = document.getElementById('page-vies-validator');
    if (!pg) return;

    pg.innerHTML = `
      <div style="padding:20px 24px 8px">
        <h2 style="margin:0 0 4px;font-size:18px;font-weight:700">
          <i class="ti ti-shield-check"></i> Walidator VIES — numery VAT UE
        </h2>
        <p style="margin:0;font-size:13px;color:var(--text3)">
          Weryfikuj numery VAT w systemie VIES Komisji Europejskiej.
          Wymaga skonfigurowanego endpointu proxy w Workerze.
        </p>
      </div>

      <div style="padding:16px 24px 0;display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1200px">

        <!-- Część A: Weryfikacja pojedynczego numeru -->
        <div>
          <div style="background:var(--surface);border:1px solid var(--border);
                      border-radius:10px;padding:20px;margin-bottom:20px">
            <div style="font-size:14px;font-weight:700;margin-bottom:14px">
              <i class="ti ti-search"></i> Sprawdź pojedynczy numer VAT
            </div>
            <div style="display:flex;gap:8px;margin-bottom:10px">
              <div>
                <div class="form-label">Kraj</div>
                <select id="vies-country" class="form-select"
                  style="width:160px;margin-top:4px">
                  ${COUNTRY_OPTIONS}
                </select>
              </div>
              <div style="flex:1">
                <div class="form-label">Numer VAT (bez prefixu kraju)</div>
                <input id="vies-vat-input" class="form-input" type="text"
                  placeholder="np. 5260304440"
                  style="width:100%;margin-top:4px;font-family:var(--mono,monospace)"
                  onkeydown="if(event.key==='Enter') ViesValidatorModule.doCheck()">
              </div>
            </div>
            <button id="vies-check-btn" class="btn btn-blue" onclick="ViesValidatorModule.doCheck()">
              <i class="ti ti-shield-search"></i> Sprawdź w VIES
            </button>
            <div id="vies-result" style="margin-top:14px"></div>
          </div>

          <!-- Część C: Historia -->
          <div style="background:var(--surface);border:1px solid var(--border);
                      border-radius:10px;padding:20px">
            <div style="font-size:14px;font-weight:700;margin-bottom:12px">
              <i class="ti ti-history"></i> Historia weryfikacji
            </div>
            <div id="vies-history"></div>
          </div>
        </div>

        <!-- Część B: Weryfikacja wsadowa -->
        <div>
          <div style="background:var(--surface);border:1px solid var(--border);
                      border-radius:10px;padding:20px">
            <div style="font-size:14px;font-weight:700;margin-bottom:6px">
              <i class="ti ti-file-upload"></i> Weryfikacja wsadowa (CSV)
            </div>
            <p style="font-size:12px;color:var(--text3);margin:0 0 14px">
              Wgraj plik CSV — jeden wpis na linię w formacie
              <code>KOD;NR_VAT</code>, np. <code>PL;5260304440</code>
            </p>
            <label style="display:block;border:2px dashed var(--border);border-radius:8px;
                          padding:20px;text-align:center;cursor:pointer;
                          font-size:13px;color:var(--text3);margin-bottom:12px"
              id="vies-drop-zone">
              <i class="ti ti-upload" style="font-size:24px;display:block;margin-bottom:6px"></i>
              Kliknij lub przeciągnij plik CSV
              <input type="file" accept=".csv,.txt" style="display:none"
                id="vies-file-input" onchange="ViesValidatorModule._onFileSelect(this)">
            </label>
            <div id="vies-batch-preview"
              style="font-size:12px;color:var(--text3);margin-bottom:10px"></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button id="vies-batch-btn" class="btn btn-blue"
                onclick="ViesValidatorModule.startBatch()" disabled>
                <i class="ti ti-play"></i> Rozpocznij weryfikację
              </button>
              <button class="btn" onclick="ViesValidatorModule._exportBatchCsv()"
                id="vies-export-btn" style="display:none">
                <i class="ti ti-download"></i> Eksportuj wyniki CSV
              </button>
            </div>
            <!-- Progress -->
            <div id="vies-progress-wrap" style="display:none;margin-top:14px">
              <div style="display:flex;justify-content:space-between;
                          font-size:12px;color:var(--text3);margin-bottom:4px">
                <span id="vies-progress-label">Przetwarzam…</span>
                <span id="vies-progress-pct">0%</span>
              </div>
              <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden">
                <div id="vies-progress-bar"
                  style="background:var(--blue,#3b82f6);height:100%;width:0%;
                         transition:width .3s ease"></div>
              </div>
            </div>
            <!-- Batch results table -->
            <div id="vies-batch-results" style="margin-top:16px;overflow-x:auto"></div>
          </div>
        </div>

      </div>
      <div style="height:24px"></div>
    `;

    // Drag & drop
    const zone = document.getElementById('vies-drop-zone');
    if (zone) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--blue,#3b82f6)'; });
      zone.addEventListener('dragleave', () => { zone.style.borderColor = 'var(--border)'; });
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.style.borderColor = 'var(--border)';
        const file = e.dataTransfer?.files?.[0];
        if (file) _loadCsvFile(file);
      });
      zone.addEventListener('click', () => document.getElementById('vies-file-input')?.click());
    }

    _renderHistory();
  }

  // ── Pojedynczy check ───────────────────────────────────────────────────────
  async function doCheck() {
    const country = document.getElementById('vies-country')?.value || 'PL';
    const vatRaw  = (document.getElementById('vies-vat-input')?.value || '').trim();
    const btn     = document.getElementById('vies-check-btn');
    const result  = document.getElementById('vies-result');
    if (!result) return;

    if (!vatRaw) {
      result.innerHTML = `<div style="color:var(--amber,#f59e0b)">
        <i class="ti ti-alert-triangle"></i> Podaj numer VAT.
      </div>`;
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Sprawdzam…'; }
    result.innerHTML = '<div style="color:var(--text3)"><i class="ti ti-loader-2"></i> Odpytuję VIES…</div>';

    const res = await _checkVat(country, vatRaw);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-shield-search"></i> Sprawdź w VIES'; }

    result.innerHTML = _buildResultHtml(country, vatRaw, res);

    if (!res.setup) {
      _addHistory({
        country, vat: vatRaw,
        valid: res.valid ?? false,
        name:  res.name || '',
      });
      _renderHistory();
    }
  }

  function _buildResultHtml(country, vat, res) {
    if (res.setup) {
      return `
        <div style="background:var(--surface2,#fff8ed);border:1px solid var(--amber,#f59e0b);
                    border-radius:8px;padding:14px">
          <div style="font-weight:600;margin-bottom:6px;color:var(--amber,#f59e0b)">
            <i class="ti ti-settings"></i> ${esc(res.error)}
          </div>
          <div style="font-size:12px;color:var(--text3)">
            Dodaj endpoint <code>/api/vies-check</code> w <code>worker/index.js</code> jako proxy
            do <code>https://ec.europa.eu/taxation_customs/vies/services/checkVatService</code>.<br>
            Możesz też sprawdzić ręcznie na
            <a href="https://vies.ec.europa.eu" target="_blank" rel="noopener">vies.ec.europa.eu</a>.
          </div>
        </div>`;
    }
    if (!res.ok && !res.valid) {
      return `
        <div style="background:var(--surface2,#fff1f1);border:1px solid var(--red,#ef4444);
                    border-radius:8px;padding:14px">
          <div style="font-weight:600;color:var(--red,#ef4444)">
            <i class="ti ti-x"></i> ${res.error ? esc(res.error) : `Numer ${esc(country)}${esc(vat)} — nieprawidłowy lub nieaktywny`}
          </div>
        </div>`;
    }
    // Valid
    return `
      <div style="background:var(--surface2,#f0fff4);border:1px solid var(--green,#22c55e);
                  border-radius:8px;padding:14px">
        <div style="font-weight:600;color:var(--green,#22c55e);margin-bottom:8px">
          <i class="ti ti-circle-check"></i> Numer VAT aktywny
        </div>
        <table style="border-collapse:collapse;font-size:13px;width:100%">
          <tr>
            <td style="color:var(--text3);padding:3px 10px 3px 0;width:100px">Numer VAT</td>
            <td style="font-family:var(--mono,monospace)">${esc(country)}${esc(vat)}</td>
          </tr>
          ${res.name ? `<tr>
            <td style="color:var(--text3);padding:3px 10px 3px 0">Nazwa</td>
            <td>${esc(res.name)}</td>
          </tr>` : ''}
          ${res.address ? `<tr>
            <td style="color:var(--text3);padding:3px 10px 3px 0">Adres</td>
            <td>${esc(res.address)}</td>
          </tr>` : ''}
          ${res.requestDate ? `<tr>
            <td style="color:var(--text3);padding:3px 10px 3px 0">Data zapytania</td>
            <td>${esc(res.requestDate)}</td>
          </tr>` : ''}
        </table>
      </div>`;
  }

  // ── Batch — wczytanie pliku CSV ────────────────────────────────────────────
  let _batchItems = [];

  function _onFileSelect(input) {
    const file = input?.files?.[0];
    if (file) _loadCsvFile(file);
  }

  function _loadCsvFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const text  = e.target?.result || '';
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      _batchItems = [];
      let skipped = 0;

      for (const line of lines) {
        const parts = line.split(/[;,\t]/);
        if (parts.length >= 2) {
          const code = parts[0].trim().toUpperCase();
          const num  = parts[1].trim();
          if (code && num) { _batchItems.push({ country: code, vat: num }); }
          else skipped++;
        } else {
          skipped++;
        }
      }

      const preview = document.getElementById('vies-batch-preview');
      if (preview) {
        preview.innerHTML = `Wczytano <strong>${_batchItems.length}</strong> pozycji${
           skipped ? `, pominięto ${skipped} nieprawidłowych linii` : ''}`;
      }
      const btn = document.getElementById('vies-batch-btn');
      if (btn) btn.disabled = _batchItems.length === 0;

      const exportBtn = document.getElementById('vies-export-btn');
      if (exportBtn) exportBtn.style.display = 'none';
      const results = document.getElementById('vies-batch-results');
      if (results) results.innerHTML = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  // ── Batch — przetwarzanie ──────────────────────────────────────────────────
  async function startBatch() {
    if (_batchRunning || !_batchItems.length) return;
    _batchRunning = true;
    _batchResults = [];

    const btn       = document.getElementById('vies-batch-btn');
    const wrap      = document.getElementById('vies-progress-wrap');
    const bar       = document.getElementById('vies-progress-bar');
    const pctEl     = document.getElementById('vies-progress-pct');
    const labelEl   = document.getElementById('vies-progress-label');
    const exportBtn = document.getElementById('vies-export-btn');

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Przetważam…'; }
    if (wrap) wrap.style.display = 'block';
    if (exportBtn) exportBtn.style.display = 'none';

    const total = _batchItems.length;

    for (let i = 0; i < total; i++) {
      const item = _batchItems[i];
      const pct  = Math.round(((i) / total) * 100);
      if (bar)    bar.style.width    = `${pct  }%`;
      if (pctEl)  pctEl.textContent  = `${pct  }%`;
      if (labelEl) labelEl.textContent = `Sprawdzam ${i + 1} / ${total}: ${item.country}${item.vat}`;

      const res = await _checkVat(item.country, item.vat);
      _batchResults.push({
        country: item.country,
        vat:     item.vat,
        valid:   res.valid ?? false,
        name:    res.name    || '',
        address: res.address || '',
        error:   res.error   || '',
        setup:   res.setup   || false,
      });

      _renderBatchTable();

      // 500 ms przerwa między zapytaniami (poszanowanie limitów VIES)
      if (i < total - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (bar)    bar.style.width    = '100%';
    if (pctEl)  pctEl.textContent  = '100%';
    if (labelEl) labelEl.textContent = `Zakończono — ${total} pozycji`;
    if (btn)  { btn.disabled = false; btn.innerHTML = '<i class="ti ti-play"></i> Rozpocznij weryfikację'; }
    if (exportBtn) exportBtn.style.display = '';
    _batchRunning = false;
  }

  function _renderBatchTable() {
    const el = document.getElementById('vies-batch-results');
    if (!el || !_batchResults.length) return;

    const rows = _batchResults.map((r, i) => {
      let pillHtml, pillCls;
      if (r.setup) {
        pillCls  = 'pill-amber';
        pillHtml = 'Błąd setup';
      } else if (r.valid) {
        pillCls  = 'pill-green';
        pillHtml = 'Aktywny';
      } else {
        pillCls  = 'pill-red';
        pillHtml = 'Nieaktywny';
      }
      return `<tr>
        <td style="font-size:11px;color:var(--text3)">${i + 1}</td>
        <td style="font-family:var(--mono,monospace);white-space:nowrap">
          ${esc(r.country)}${esc(r.vat)}
        </td>
        <td><span class="pill ${pillCls}">${pillHtml}</span></td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(r.name || (r.error ? r.error : '—'))}
        </td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <table class="data-table" style="font-size:12px">
        <thead><tr>
          <th style="width:32px">#</th>
          <th>Numer VAT</th>
          <th>Wynik</th>
          <th>Nazwa / Info</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── Batch CSV export ───────────────────────────────────────────────────────
  function _csvCell(v) {
    const s    = String(v ?? '');
    const safe = /^[=+\-@\t\r\n]/.test(s) ? `\t${  s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function _exportBatchCsv() {
    if (!_batchResults.length) return;
    const hdr  = '"Kraj";"NR VAT";"Aktywny";"Nazwa";"Adres";"Błąd"';
    const rows = _batchResults.map(r => [
      r.country, r.vat,
      r.valid ? 'TAK' : 'NIE',
      r.name || '', r.address || '', r.error || '',
    ].map(_csvCell).join(';'));
    const csv  = [hdr, ...rows].join('\r\n');
    const blob = new Blob([`﻿${  csv}`], { type: 'text/csv;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `vies-wyniki-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // ── Historia ───────────────────────────────────────────────────────────────
  function _renderHistory() {
    const el = document.getElementById('vies-history');
    if (!el) return;
    const hist = _loadHistory();

    if (!hist.length) {
      el.innerHTML = '<div style="font-size:13px;color:var(--text3)">Brak historii weryfikacji.</div>';
      return;
    }

    const rows = hist.map(h => {
      const pillCls  = h.valid ? 'pill-green' : 'pill-red';
      const pillText = h.valid ? 'Aktywny'    : 'Nieaktywny';
      return `<tr>
        <td style="font-size:11px;color:var(--text3);white-space:nowrap">
          ${h.ts ? new Date(h.ts).toLocaleDateString('pl-PL') : '—'}
        </td>
        <td style="font-family:var(--mono,monospace);font-size:12px">${esc(h.country || '')}</td>
        <td style="font-family:var(--mono,monospace);font-size:12px">${esc(h.vat || '')}</td>
        <td><span class="pill ${pillCls}" style="font-size:10px">${pillText}</span></td>
        <td style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">
          ${esc(h.name || '—')}
        </td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table class="data-table" style="font-size:12px">
          <thead><tr>
            <th>Data</th><th>Kraj</th><th>NR VAT</th><th>Wynik</th><th>Nazwa firmy</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.ViesValidatorModule = {
    renderViesValidator,
    doCheck,
    startBatch,
    _onFileSelect,
    _exportBatchCsv,
  };

})();
