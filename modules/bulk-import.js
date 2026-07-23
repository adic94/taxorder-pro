/**
 * TaxOrder Pro — Masowy Import Dokumentów Flotowych
 * Pipeline: wybierz folder → skanuj → klasyfikuj → identyfikuj pojazd → wyciągnij dane → zapisz
 * Obsługuje: DR, OC/AC, faktury, przeglądy SKP, protokoły przekazania
 * Skala: 2000+ plików z wirtualną listą i concurrency control
 */
window.BulkImport = (function () {
  'use strict';

  const API      = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const getToken = () => localStorage.getItem('cf_token');
  const company  = () => window.currentCompanyId || 'mtoilet';
  const hdrs     = (extra = {}) => ({ Authorization: `Bearer ${getToken()}`, ...extra });

  // ── Stałe ────────────────────────────────────────────────────────────────
  const CONCURRENCY  = 4;    // max równoległych requestów AI
  const BATCH_DELAY  = 400;  // ms między seriami (rate-limit safety)
  const ROW_H        = 52;   // wysokość wiersza w px
  const VISIBLE_ROWS = 16;   // liczba widocznych wierszy (virtual scroll)

  // Regex na polskie numery rejestracyjne (WA12345, WGM8720S, itp.)
  const PLATE_RX = /\b([A-Z]{2,3})[\s.\-_]?([A-Z0-9]{3,6})\b/g;

  // Klasyfikacja po nazwie pliku
  const TYPE_MAP = [
    { type: 'dr',         rx: /\bdr\b|dowod[\s_\-]?rejestr|registration|d[\s_\-]?r[\s_\-]?\d/i },
    { type: 'oc',         rx: /\boc\b|polisa|ubezpiecz|insurance|warta|pzu|allianz|hdi|axa|ergo|uniqa|mtu|proama|trasti|generali/i },
    { type: 'ac',         rx: /\bac\b|casco|autocasco|assistance/i },
    { type: 'invoice',    rx: /faktura|invoice|\bfv\b|\bvat\b|rachunek|paragon/i },
    { type: 'inspection', rx: /przeglad|przegl|inspection|\bskp\b|diagnosta|badanie[\s_]?tech/i },
    { type: 'handover',   rx: /protokol|przekazanie|handover|zdanie|odbioru|protokol[\s_]?zd/i },
    { type: 'service',    rx: /serwis|naprawa|warsztat|service|repair|usterka/i },
    { type: 'other',      rx: /.*/ },
  ];

  const TYPE_META = {
    dr:         { label: 'Dowód Rejestracyjny',      icon: 'ti-id-badge',         col: '#2563eb' },
    oc:         { label: 'Polisa OC',                icon: 'ti-shield-check',     col: '#16a34a' },
    ac:         { label: 'Polisa AC/Casco',          icon: 'ti-shield',           col: '#059669' },
    invoice:    { label: 'Faktura',                  icon: 'ti-receipt',          col: '#7c3aed' },
    inspection: { label: 'Przegląd SKP',             icon: 'ti-checkup-list',     col: '#d97706' },
    handover:   { label: 'Protokół przekazania',     icon: 'ti-clipboard-check',  col: '#0891b2' },
    service:    { label: 'Serwis/Naprawa',           icon: 'ti-tool',             col: '#dc2626' },
    other:      { label: 'Inny',                     icon: 'ti-file',             col: '#6b7280' },
  };

  const STATUS_META = {
    pending:     { label: 'Oczekuje',      cls: 'var(--text3)' },
    classifying: { label: 'Klasyfikuję…',  cls: 'var(--blue)'  },
    identifying: { label: 'Szukam pojazdu…',cls: 'var(--blue)' },
    extracting:  { label: 'Wyciągam dane…',cls: 'var(--blue)'  },
    matched:     { label: 'Gotowy',        cls: '#16a34a'      },
    unmatched:   { label: 'Brak pojazdu',  cls: '#d97706'      },
    saving:      { label: 'Zapisuję…',     cls: 'var(--blue)'  },
    done:        { label: 'Zapisano ✓',    cls: '#16a34a'      },
    error:       { label: 'Błąd',          cls: '#dc2626'      },
    skipped:     { label: 'Pominięty',     cls: 'var(--text3)' },
  };

  // ── Stan modułu ────────────────────────────────────────────────────────────
  let _queue   = [];
  let _running = false;
  let _paused  = false;
  let _stop    = false;
  let _scrollY = 0;

  // ── Pomocnicze ─────────────────────────────────────────────────────────────
  function _classifyByName(name) {
    // Normalizuj _ i - do spacji, żeby \bDR\b matchowało DR_WGM...
    const normalized = name.replace(/[_\-]+/g, ' ');
    for (const { type, rx } of TYPE_MAP) if (rx.test(normalized)) return type;
    return 'other';
  }

  function _platesFromName(name) {
    const up = name.toUpperCase().replace(/[_\-\s\.]+/g, ' ');
    const matches = [...up.matchAll(/\b([A-Z]{2,3})[\s]?([A-Z0-9]{3,6})\b/g)];
    const result = [];
    for (const m of matches) {
      const candidate = (m[1] + m[2]).replace(/\s/g, '');
      if (
        candidate.length >= 5 && candidate.length <= 8 &&
        /^[A-Z]{2,3}/.test(candidate) &&
        /\d/.test(candidate)  // polskie tablice ZAWSZE mają cyfry — eliminuje FAKTURA, POLISA itp.
      ) {
        result.push(candidate);
      }
    }
    return result;
  }

  // Backward-compat alias — zwraca pierwszy kandydat (przed dopasowaniem do pojazdu)
  function _plateFromName(name) { return _platesFromName(name)[0] || null; }

  function _matchVehicle(plate) {
    if (!plate) return null;
    const norm = plate.toUpperCase().replace(/[\s\-\.]/g, '');
    return (window.vehs || []).find(v => {
      const vp = ((v.nrRej || v.nr_rej || '')).toUpperCase().replace(/[\s\-\.]/g, '');
      return vp === norm || (norm.length >= 5 && (vp.startsWith(norm) || norm.startsWith(vp)));
    }) || null;
  }

  // Próbuje wszystkich kandydatów z nazwy pliku — zwraca { veh, plate } dla pierwszego trafienia
  function _matchVehicleFromName(name) {
    const plates = _platesFromName(name);
    for (const plate of plates) {
      const veh = _matchVehicle(plate);
      if (veh) return { veh, plate };
    }
    return { veh: null, plate: plates[0] || null };
  }

  async function _toBase64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload  = () => res(fr.result.split(',')[1]);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  function _stat() {
    const counts = { pending:0, matched:0, unmatched:0, done:0, error:0, processing:0 };
    for (const item of _queue) {
      if (['classifying','identifying','extracting','saving'].includes(item.status)) counts.processing++;
      else counts[item.status] = (counts[item.status] || 0) + 1;
    }
    return counts;
  }

  // ── API calls ──────────────────────────────────────────────────────────────
  async function _apiClassify(file) {
    try {
      const base64  = await _toBase64(file);
      const r = await fetch(`${API()}/api/bulk/classify`, {
        method:  'POST',
        headers: { ...hdrs(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg', filename: file.name }),
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  async function _apiExtract(file, docType) {
    try {
      const base64 = await _toBase64(file);
      const r = await fetch(`${API()}/api/bulk/extract`, {
        method:  'POST',
        headers: { ...hdrs(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg', docType }),
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  async function _uploadFile(file, vehicleNr, docType) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('nrRej', vehicleNr);
    fd.append('doc_type', docType || 'other');
    const r = await fetch(
      `${API()}/api/docs/upload?company=${company()}`,
      { method: 'POST', headers: hdrs(), body: fd }
    );
    if (!r.ok) throw new Error('Upload HTTP ' + r.status);
    const d = await r.json();
    return d.key || null;
  }

  async function _saveDoc(item) {
    const vehicleNr = item.vehicleNr;

    // Wgraj plik do R2 przez istniejący endpoint /api/docs/upload
    item.r2Key = await _uploadFile(item.file, vehicleNr, item.type);

    if (item.type === 'dr') {
      // DR: użyj istniejącego /api/dr-save do uzupełnienia pól pojazdu
      const r = await fetch(`${API()}/api/dr-save?company=${company()}`, {
        method: 'POST',
        headers: { ...hdrs(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ nr_rej: vehicleNr, fields: item.data || {}, r2Key: item.r2Key }),
      });
      if (!r.ok) throw new Error('DR save ' + r.status);
    } else if (item.type === 'oc' || item.type === 'ac') {
      // Polisy: zapisz dane polisy do tabeli polisy
      const r = await fetch(`${API()}/api/bulk/save-policy?company=${company()}`, {
        method: 'POST',
        headers: { ...hdrs(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ nr_rej: vehicleNr, typ: item.type.toUpperCase(), data: item.data || {}, r2Key: item.r2Key }),
      });
      if (!r.ok) throw new Error('Policy save ' + r.status);
    }
    // Pozostałe typy: dokument jest już zapisany w /api/docs/upload (tabela documents)
  }

  // ── Przetwarzanie jednego pliku ───────────────────────────────────────────
  async function _processItem(item) {
    try {
      // Krok 1: klasyfikacja po nazwie + szybkie dopasowanie pojazdu (wszystkie kandydaty tablic)
      item.type = _classifyByName(item.name);
      const { veh: vehFromName, plate: plateFromName } = _matchVehicleFromName(item.name);
      item.plate = plateFromName;
      let veh    = vehFromName;

      // Krok 2: jeśli nie dopasowano → AI OCR dla numeru rej. i klasyfikacji
      if (!veh) {
        item.status = 'identifying';
        _renderProgress();
        const ai = await _apiClassify(item.file);
        if (ai) {
          if (ai.plate) { item.plate = ai.plate; }
          if (ai.type && item.type === 'other') { item.type = ai.type; }
          veh = _matchVehicle(item.plate);
        }
      }

      if (!veh) {
        item.status = 'unmatched';
        item.error  = 'Nie znaleziono pojazdu' + (item.plate ? ': ' + item.plate : ' — brak numeru rej.');
        return;
      }

      item.vehicleId = veh.id;
      item.vehicleNr = (veh.nrRej || veh.nr_rej || '').toUpperCase();

      // Krok 3: wyciąganie danych strukturalnych
      item.status = 'extracting';
      _renderProgress();
      const extracted = await _apiExtract(item.file, item.type);
      item.data = extracted?.fields || extracted || {};
      if (extracted?.plate && !item.plate) item.plate = extracted.plate;

      item.status = 'matched';
    } catch (e) {
      item.status = 'error';
      item.error  = e.message;
    }
    _renderProgress();
  }

  // ── Batch processor ───────────────────────────────────────────────────────
  async function _runQueue() {
    if (_running) return;
    _running = true;
    _paused  = false;
    _stop    = false;
    _updateStartBtn();

    const pending = _queue.filter(i => i.status === 'pending');
    let i = 0;

    while (i < pending.length && !_stop) {
      if (_paused) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }
      const batch = pending.slice(i, i + CONCURRENCY);
      batch.forEach(item => { item.status = 'classifying'; });
      _renderQueue();
      await Promise.all(batch.map(_processItem));
      i += CONCURRENCY;
      _renderQueue();
      _renderProgress();
      if (i < pending.length && !_stop) await new Promise(r => setTimeout(r, BATCH_DELAY));
    }

    _running = false;
    _updateStartBtn();
    _renderQueue();
    _renderProgress();
    if (!_stop) {
      const s = _stat();
      window.toast?.(`Przetwarzanie zakończone — ${s.matched} dopasowanych, ${s.unmatched} bez pojazdu, ${s.error} błędów`);
    }
  }

  // ── Zapisz wszystkie dopasowane ───────────────────────────────────────────
  async function _saveAll() {
    const ready = _queue.filter(i => i.status === 'matched');
    if (!ready.length) { window.toast?.('Brak gotowych rekordów do zapisania'); return; }

    const btn = document.getElementById('bi-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Zapisywanie…'; }

    let saved = 0, failed = 0;
    for (const item of ready) {
      item.status = 'saving';
      _renderProgress();
      try {
        await _saveDoc(item);
        item.status = 'done';
        saved++;
      } catch (e) {
        item.status = 'error';
        item.error  = e.message;
        failed++;
      }
      _renderQueue();
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i> Zapisz dopasowane'; }
    _renderProgress();
    window.toast?.(`✓ Zapisano ${saved} dok.${failed ? `, ${failed} błędów` : ''}`);

    // Odśwież pojazdy
    if (saved > 0 && window.TaxOrderFleetCloud?.loadVehicles) {
      TaxOrderFleetCloud.loadVehicles().then(() => { window.renderVeh?.(); });
    }
  }

  // ── Ręczne przypisanie pojazdu ────────────────────────────────────────────
  function _openAssignPicker(itemId) {
    const item = _queue.find(i => i.id === itemId);
    if (!item) return;

    const existing = document.getElementById('bi-assign-modal');
    if (existing) existing.remove();

    const vehs = (window.vehs || []).slice(0, 300); // max 300 w modalu
    const html = `<div id="bi-assign-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:480px;max-width:96vw;padding:20px;box-shadow:0 8px 40px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <strong>Przypisz pojazd</strong>
          <span style="font-size:11px;color:var(--text2);margin-left:4px">${esc(item.name)}</span>
          <button onclick="document.getElementById('bi-assign-modal').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:20px">×</button>
        </div>
        <input id="bi-assign-search" type="text" class="fi" placeholder="Szukaj: numer rej., marka, model…" style="margin-bottom:8px" oninput="BulkImport._filterAssign(this.value)">
        <div id="bi-assign-list" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius)">
          ${vehs.map(v => `<div class="bi-assign-row" style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border)" data-item-id="${esc(item.id)}" data-veh-id="${esc(v.id)}" onclick="BulkImport._assignVeh(this.dataset.itemId,this.dataset.vehId)">
            <strong>${esc(v.nrRej || v.nr_rej || '—')}</strong>
            <span style="color:var(--text2);margin-left:8px">${esc(v.marka || '')} ${esc(v.model || '')}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function _filterAssign(q) {
    const up = q.toUpperCase();
    document.querySelectorAll('.bi-assign-row').forEach(row => {
      row.style.display = row.textContent.toUpperCase().includes(up) ? '' : 'none';
    });
  }

  function _assignVeh(itemId, vehId) {
    const item = _queue.find(i => i.id === itemId);
    const veh  = (window.vehs || []).find(v => String(v.id) === String(vehId));
    if (item && veh) {
      item.vehicleId = veh.id;
      item.vehicleNr = (veh.nrRej || veh.nr_rej || '').toUpperCase();
      item.status    = 'matched';
      item.error     = null;
    }
    document.getElementById('bi-assign-modal')?.remove();
    _renderQueue();
    _renderProgress();
  }

  // ── Wirtualna lista ────────────────────────────────────────────────────────
  function _renderQueue() {
    const wrap = document.getElementById('bi-queue-scroll');
    const body = document.getElementById('bi-queue-body');
    if (!wrap || !body) return;

    const total = _queue.length;
    if (!total) {
      body.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px"><i class="ti ti-files" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak plików — wgraj folder</div>';
      return;
    }

    const containerH = wrap.clientHeight || ROW_H * VISIBLE_ROWS;
    const startIdx   = Math.max(0, Math.floor(_scrollY / ROW_H) - 2);
    const endIdx     = Math.min(total - 1, startIdx + Math.ceil(containerH / ROW_H) + 4);

    let rows = '';
    for (let i = startIdx; i <= endIdx; i++) {
      const item = _queue[i];
      const tm   = TYPE_META[item.type]   || TYPE_META.other;
      const sm   = STATUS_META[item.status] || { label: esc(item.status), cls: 'var(--text3)' };
      const isProcessing = ['classifying','identifying','extracting','saving'].includes(item.status);

      rows += `<div style="position:absolute;top:${i * ROW_H}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--border);font-size:12px;background:var(--bg)${item.status==='done'?';opacity:.6':''}">
        <span style="width:22px;text-align:center;color:${tm.col};flex-shrink:0"><i class="ti ${tm.icon}"></i></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text1)" title="${esc(item.name)}">${esc(item.name)}</span>
        <span style="width:130px;flex-shrink:0;color:var(--text2);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tm.label)}</span>
        <span style="width:110px;flex-shrink:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(item.vehicleNr||item.plate||item.error||'')}">
          ${item.vehicleNr ? esc(item.vehicleNr) : (item.plate ? '<span style="color:var(--text3)">'+esc(item.plate)+'?</span>' : '<span style="color:var(--text3)">—</span>')}
        </span>
        <span style="width:120px;flex-shrink:0;color:${sm.cls}">
          ${isProcessing ? '<i class="ti ti-loader ti-spin" style="font-size:11px"></i> ' : ''}${esc(sm.label)}
        </span>
        <div style="flex-shrink:0;display:flex;gap:4px">
          ${item.status === 'unmatched' || item.status === 'error'
            ? `<button class="btn btn-gray" style="padding:2px 7px;font-size:11px" data-id="${esc(item.id)}" onclick="BulkImport._openAssignPicker(this.dataset.id)"><i class="ti ti-hand-finger"></i></button>`
            : ''}
          ${item.status === 'matched'
            ? `<button class="btn btn-gray" style="padding:2px 7px;font-size:11px" data-id="${esc(item.id)}" onclick="BulkImport._openAssignPicker(this.dataset.id)"><i class="ti ti-edit"></i></button>`
            : ''}
          ${item.status === 'error' && item.error
            ? `<button class="btn btn-gray" style="padding:2px 7px;font-size:11px" title="${esc(item.error||'')}" onclick="alert(this.title)"><i class="ti ti-info-circle"></i></button>`
            : ''}
          <button class="btn btn-gray" style="padding:2px 7px;font-size:11px;color:var(--red)" data-id="${esc(item.id)}" onclick="BulkImport._removeItem(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </div>
      </div>`;
    }

    body.style.height = (total * ROW_H) + 'px';
    body.style.position = 'relative';
    body.innerHTML = rows;
  }

  function _renderProgress() {
    const s   = _stat();
    const total = _queue.length;
    const done  = s.done + s.matched;
    const pct   = total ? Math.round((done / total) * 100) : 0;

    const el = document.getElementById('bi-progress-wrap');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap;margin-bottom:6px">
        <span><strong>${total}</strong> plików</span>
        <span style="color:#16a34a"><strong>${s.matched}</strong> dopasowanych</span>
        <span style="color:#16a34a"><strong>${s.done}</strong> zapisanych</span>
        <span style="color:#d97706"><strong>${s.unmatched}</strong> bez pojazdu</span>
        <span style="color:#dc2626"><strong>${s.error}</strong> błędów</span>
        <span style="color:var(--text3)"><strong>${s.pending + s.processing}</strong> pozostało</span>
      </div>
      <div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:var(--blue);transition:width .3s;border-radius:99px"></div>
      </div>`;
  }

  function _updateStartBtn() {
    const btn = document.getElementById('bi-start-btn');
    if (!btn) return;
    if (_running && !_paused) {
      btn.innerHTML = '<i class="ti ti-player-pause"></i> Wstrzymaj';
      btn.className = 'btn btn-amber';
    } else if (_paused) {
      btn.innerHTML = '<i class="ti ti-player-play"></i> Wznów';
      btn.className = 'btn btn-blue';
    } else {
      btn.innerHTML = '<i class="ti ti-player-play"></i> Uruchom';
      btn.className = 'btn btn-blue';
    }
  }

  function _removeItem(id) {
    const idx = _queue.findIndex(i => i.id === id);
    if (idx >= 0) _queue.splice(idx, 1);
    _renderQueue();
    _renderProgress();
  }

  // ── Otwiera panel importu ─────────────────────────────────────────────────
  function open() {
    const existing = document.getElementById('bi-modal');
    if (existing) { existing.style.display = 'flex'; return; }

    const html = `<div id="bi-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9500;display:flex;align-items:stretch;justify-content:center;padding:16px">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:100%;max-width:1100px;display:flex;flex-direction:column;box-shadow:0 8px 60px rgba(0,0,0,.35)">

        <!-- Nagłówek -->
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0">
          <i class="ti ti-folder-open" style="font-size:22px;color:var(--blue)"></i>
          <div>
            <div style="font-size:17px;font-weight:700">Masowy import dokumentów flotowych</div>
            <div style="font-size:11px;color:var(--text2)">DR, polisy OC/AC, faktury, przeglądy — automatyczne przypisanie do pojazdów</div>
          </div>
          <button onclick="BulkImport.close()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:24px;color:var(--text2)">×</button>
        </div>

        <!-- Pasek akcji -->
        <div style="padding:10px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0">
          <!-- Wgraj folder -->
          <label class="btn btn-blue" style="cursor:pointer" title="Wybierz folder lub pliki do importu">
            <i class="ti ti-folder-plus"></i>Dodaj pliki / folder
            <input type="file" id="bi-file-input" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" webkitdirectory style="display:none" onchange="BulkImport._onFileInput(this)">
          </label>
          <label class="btn btn-gray" style="cursor:pointer" title="Dodaj pliki bez struktury folderów">
            <i class="ti ti-files"></i>Wybierz pliki
            <input type="file" id="bi-file-input2" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="BulkImport._onFileInput(this)">
          </label>

          <div style="width:1px;height:24px;background:var(--border)"></div>

          <!-- Filtr typów -->
          <select id="bi-type-filter" class="fi" style="height:32px;font-size:12px;padding:0 8px" onchange="BulkImport._renderQueue()">
            <option value="">Wszystkie typy</option>
            ${Object.entries(TYPE_META).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>

          <!-- Filtr statusów -->
          <select id="bi-status-filter" class="fi" style="height:32px;font-size:12px;padding:0 8px" onchange="BulkImport._renderQueue()">
            <option value="">Wszystkie statusy</option>
            <option value="matched">Gotowe do zapisu</option>
            <option value="unmatched">Bez pojazdu</option>
            <option value="done">Zapisane</option>
            <option value="error">Błędy</option>
          </select>

          <div style="margin-left:auto;display:flex;gap:6px">
            <button id="bi-start-btn" class="btn btn-blue" onclick="BulkImport._toggleRun()"><i class="ti ti-player-play"></i> Uruchom</button>
            <button id="bi-save-btn" class="btn btn-green" onclick="BulkImport._saveAll()"><i class="ti ti-device-floppy"></i> Zapisz dopasowane</button>
            <button class="btn btn-gray" onclick="BulkImport._clearDone()" title="Usuń zapisane z kolejki"><i class="ti ti-eraser"></i></button>
            <button class="btn btn-gray" style="color:var(--red)" onclick="BulkImport._clearAll()" title="Wyczyść całą kolejkę"><i class="ti ti-trash"></i></button>
          </div>
        </div>

        <!-- Pasek postępu -->
        <div id="bi-progress-wrap" style="padding:8px 20px;border-bottom:1px solid var(--border);flex-shrink:0">
          <div style="font-size:12px;color:var(--text3)">Wgraj pliki, a następnie kliknij "Uruchom" aby przetworzyć.</div>
        </div>

        <!-- Nagłówek tabeli -->
        <div style="padding:6px 12px;display:flex;gap:8px;font-size:11px;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border);flex-shrink:0">
          <span style="width:22px;flex-shrink:0"></span>
          <span style="flex:1">Nazwa pliku</span>
          <span style="width:130px;flex-shrink:0">Typ dokumentu</span>
          <span style="width:110px;flex-shrink:0">Pojazd (nr rej.)</span>
          <span style="width:120px;flex-shrink:0">Status</span>
          <span style="width:80px;flex-shrink:0">Akcje</span>
        </div>

        <!-- Lista (wirtualna) -->
        <div id="bi-queue-scroll" style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:0" onscroll="BulkImport._onScroll(this)">
          <div id="bi-queue-body"></div>
        </div>

        <!-- Stopka ze statusem -->
        <div style="padding:8px 20px;border-top:1px solid var(--border);font-size:11px;color:var(--text2);flex-shrink:0">
          <i class="ti ti-info-circle"></i>
          Identyfikacja: 1. regex w nazwie pliku, 2. AI OCR (Groq Vision) jako fallback.
          Ręczne przypisanie: kliknij <i class="ti ti-hand-finger"></i> przy pozycji "Bez pojazdu".
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    _renderQueue();
    _renderProgress();
  }

  function close() {
    const el = document.getElementById('bi-modal');
    if (el) el.style.display = 'none';
  }

  // ── Wgrywanie plików ───────────────────────────────────────────────────────
  function _onFileInput(input) {
    const files = Array.from(input.files || [])
      .filter(f => /\.(pdf|jpg|jpeg|png|webp)$/i.test(f.name));
    if (!files.length) { window.toast?.('Brak obsługiwanych plików (PDF, JPG, PNG, WEBP)'); return; }

    let added = 0;
    for (const f of files) {
      // Unikaj duplikatów po nazwie + rozmiarze
      const exists = _queue.some(i => i.name === f.name && i.file.size === f.size);
      if (!exists) {
        _queue.push({
          id:        'bi_' + Math.random().toString(36).slice(2),
          file:      f,
          name:      f.name,
          type:      _classifyByName(f.name),
          plate:     _platesFromName(f.name)[0] || null,
          vehicleId: null,
          vehicleNr: null,
          status:    'pending',
          data:      {},
          r2Key:     null,
          error:     null,
        });
        added++;
      }
    }

    // Wstępne dopasowanie pojazdu z nazwy pliku (szybkie, bez API) — iteruje przez wszystkich kandydatów
    for (const item of _queue.filter(i => i.status === 'pending')) {
      const { veh, plate } = _matchVehicleFromName(item.name);
      if (plate) item.plate = plate;
      if (veh) {
        item.vehicleId = veh.id;
        item.vehicleNr = (veh.nrRej || veh.nr_rej || '').toUpperCase();
      }
    }

    input.value = '';
    _renderQueue();
    _renderProgress();
    window.toast?.(`Dodano ${added} pliku(ów) do kolejki — łącznie ${_queue.length}`);
  }

  function _onScroll(el) {
    _scrollY = el.scrollTop;
    _renderQueue();
  }

  function _toggleRun() {
    if (!_running) {
      if (!_queue.filter(i => i.status === 'pending').length) {
        window.toast?.('Brak plików ze statusem "Oczekuje"');
        return;
      }
      _runQueue();
    } else if (_paused) {
      _paused = false;
      _updateStartBtn();
    } else {
      _paused = true;
      _updateStartBtn();
    }
  }

  function _clearDone() {
    _queue = _queue.filter(i => i.status !== 'done');
    _renderQueue();
    _renderProgress();
  }

  function _clearAll() {
    if (_running) { _stop = true; _paused = false; }
    _queue = [];
    _renderQueue();
    _renderProgress();
  }

  // ── Export publiczny ───────────────────────────────────────────────────────
  return {
    open,
    close,
    _onFileInput,
    _onScroll,
    _toggleRun,
    _saveAll,
    _openAssignPicker,
    _filterAssign,
    _assignVeh,
    _removeItem,
    _clearDone,
    _clearAll,
    _renderQueue,
  };
})();
