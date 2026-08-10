/**
 * TaxOrder Pro — Folder Monitor
 * Obserwuje lokalne foldery (File System Access API) i importuje dokumenty:
 *   polisa / dr (dowód rej.) / paliwo / serwis
 * Eksportuje: window.FolderMonitor
 */
(function () {
  'use strict';

  const IDB_NAME       = 'taxorder-fm';
  const STORE_HANDLES  = 'handles';
  const STORE_DONE     = 'processed';
  const LS_SETTINGS    = 'fm_settings';
  const LS_QUEUE       = 'fm_queue';

  const DEFAULTS = {
    enabled:  false,
    mode:     'manual',   // 'auto' | 'manual' | 'notify'
    interval: 10,         // minuty (tryb auto)
    types:    ['polisa', 'dr', 'paliwo', 'serwis'],
  };

  const TYPE_META = {
    polisa: { label: 'Polisa',        icon: 'ti-shield-check', color: 'var(--green)' },
    dr:     { label: 'Dowód rej.',    icon: 'ti-id-badge',     color: 'var(--blue)' },
    paliwo: { label: 'Faktura paliwo',icon: 'ti-gas-station',  color: 'var(--amber)' },
    serwis: { label: 'Serwis',        icon: 'ti-tool',         color: '#9b59b6' },
  };

  let _settings  = {};
  let _db        = null;
  let _autoTimer = null;
  let _queue     = [];
  let _scanning  = false;

  // ─── IndexedDB ──────────────────────────────────────────────────────────────
  function _openIdb() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_HANDLES)) db.createObjectStore(STORE_HANDLES, { keyPath: 'type' });
        if (!db.objectStoreNames.contains(STORE_DONE))    db.createObjectStore(STORE_DONE,    { keyPath: 'key' });
      };
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror   = e => rej(e.target.error);
    });
  }

  async function _idbGet(store, key) {
    const db = await _openIdb();
    return new Promise((res, rej) => {
      const tx  = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = e => res(e.target.result ?? null);
      req.onerror   = rej;
    });
  }

  async function _idbPut(store, value) {
    const db = await _openIdb();
    return new Promise((res, rej) => {
      const tx  = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = res;
      tx.onerror    = rej;
    });
  }

  async function _idbDelete(store, key) {
    const db = await _openIdb();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = res;
      tx.onerror    = rej;
    });
  }

  // ─── Ustawienia ─────────────────────────────────────────────────────────────
  function _loadSettings() {
    try   { _settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}') }; }
    catch { _settings = { ...DEFAULTS }; }
  }

  function _saveSettings() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(_settings));
  }

  // ─── Kolejka ────────────────────────────────────────────────────────────────
  function _loadQueue() {
    try   { _queue = JSON.parse(localStorage.getItem(LS_QUEUE) || '[]'); }
    catch { _queue = []; }
    // pliki File nie przetrwają serialyzacji — tracą referencję
    _queue.forEach(q => { if (!q.file) q.status = q.status === 'processing' ? 'pending' : q.status; });
  }

  function _saveQueue() {
    const serializable = _queue.slice(-100).map(q => ({ ...q, file: undefined }));
    localStorage.setItem(LS_QUEUE, JSON.stringify(serializable));
  }

  function _addToQueue(item) {
    if (_queue.find(q => q.fileKey === item.fileKey)) return false;
    _queue.unshift(item);
    _saveQueue();
    _updateBadge();
    return true;
  }

  function _pendingCount() { return _queue.filter(q => q.status === 'pending').length; }

  function _updateBadge() {
    const n     = _pendingCount();
    const badge = document.getElementById('fm-badge');
    if (!badge) return;
    badge.textContent = n;
    badge.style.display = n > 0 ? '' : 'none';
  }

  // ─── Wykrywanie typu z nazwy pliku ──────────────────────────────────────────
  function _detectType(filename) {
    const f = filename.toLowerCase();
    if (/\boc\b|\bac\b|polisa|ubezp|towar|pzu|hdi|ergo|allianz|interrisk|generali|wiener/.test(f)) return 'polisa';
    if (/\bdr\b|dow[oó]d|rejestr/.test(f)) return 'dr';
    if (/paliw|tank|diesel|benzyn|faktura.{0,10}pal|fuel/.test(f)) return 'paliwo';
    if (/serwis|naprawa|protok|warsztat|service/.test(f)) return 'serwis';
    return 'unknown';
  }

  // ─── Skanuj katalog ─────────────────────────────────────────────────────────
  async function _scanDir(dirHandle, type) {
    const newItems = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind !== 'file') continue;
      if (!/\.(pdf|jpg|jpeg|png|webp|bmp|tif|tiff)$/i.test(name)) continue;
      const file         = await handle.getFile();
      const detectedType = type || _detectType(name);
      if (detectedType === 'unknown') continue;
      const key  = `${detectedType}:${name}:${file.size}`;
      const done = await _idbGet(STORE_DONE, key);
      if (done) continue;
      newItems.push({ file, name, type: detectedType, fileKey: key });
    }
    return newItems;
  }

  // ─── OCR / analiza pliku ────────────────────────────────────────────────────
  async function _processItem(qItem) {
    if (!qItem.file) { qItem.status = 'error'; qItem.error = 'Plik niedostępny — przeskanuj folder ponownie'; _saveQueue(); _renderQueue(); return; }
    qItem.status = 'processing';
    qItem.error  = null;
    _renderQueue();

    try {
      if (qItem.type === 'dr') {
        const result = await window.TaxOrderDrImport?._extractFromBlob(qItem.file, qItem.file.type);
        qItem.result   = result?.fields ?? null;
        qItem.ocrModel = result?.method  ?? 'OCR';
      } else {
        const b64 = await _toBase64(qItem.file);
        const API = (window.CF_API_URL || '').replace(/\/$/, '');
        const tok = localStorage.getItem('cf_token');
        const r   = await fetch(`${API}/api/ai/ocr-doc`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (tok || '') },
          body:    JSON.stringify({ imageBase64: b64, mimeType: qItem.file.type, docType: qItem.type }),
        });
        const d = await r.json().catch(() => ({}));
        qItem.result   = d.fields ?? null;
        qItem.ocrModel = d.model  ?? '';
      }
      qItem.status = qItem.result ? 'ready' : 'error';
      qItem.error  = qItem.result ? null : 'Nie rozpoznano danych z dokumentu';
    } catch (e) {
      qItem.status = 'error';
      qItem.error  = e.message;
    }
    _saveQueue();
    _renderQueue();
    _updateBadge();
  }

  async function _importItem(qItem) {
    if (!qItem.result) return;
    const API     = (window.CF_API_URL || '').replace(/\/$/, '');
    const company = window.currentCompanyId || 'mtoilet';
    const tok     = localStorage.getItem('cf_token');
    const H       = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (tok || '') };
    qItem.status  = 'importing';
    _renderQueue();

    try {
      const f = qItem.result;
      if (qItem.type === 'polisa') {
        const r = await fetch(`${API}/api/policies-db`, {
          method: 'POST', headers: H,
          body: JSON.stringify({
            company_id:    company,
            nr_rej:        f.nrRej         || '',
            vin:           f.vin           || '',
            type:          f.typ           || 'OC',
            policy_number: f.nrPolisy      || '',
            insurer:       f.towarzystwo   || '',
            start_date:    f.dataOd        || '',
            end_date:      f.dataDo        || '',
            premium:       f.skladka       ? parseFloat(f.skladka) : null,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else if (qItem.type === 'dr') {
        const nrRej = (f.nrRej || '').toUpperCase().replace(/\s/g, '');
        if (nrRej && window.vehs) {
          const existing = window.vehs.find(v => v.nrRej === nrRej);
          if (existing) {
            if (f.vin    && !existing.vin)   existing.vin    = f.vin;
            if (f.dmcKg  && !existing.dmc)   { existing.dmc  = parseFloat(f.dmcKg); existing.dmcMax = existing.dmc; }
            if (f.marka  && !existing.marka) existing.marka  = f.marka.toUpperCase();
            if (f.rokProd && !existing.rok)  existing.rok    = parseInt(f.rokProd);
            await window.TaxOrderFleetCloud?.saveVehicle(existing);
            if (typeof renderVeh === 'function') renderVeh();
          } else {
            if (typeof toast === 'function') toast(`ℹ DR: pojazd ${nrRej} nie w bazie — dodaj go ręcznie`);
          }
        }
      } else if (qItem.type === 'paliwo') {
        await fetch(`${API}/api/fuel`, {
          method: 'POST', headers: H,
          body: JSON.stringify({
            company_id: company, nr_rej: f.nrRej || '',
            date:       f.dataFaktury || '',
            liters:     f.litry       ? parseFloat(f.litry) : null,
            amount:     f.cenaBrutto  ? parseFloat(f.cenaBrutto) : null,
            fuel_type:  f.rodzajPaliwa || '',
            invoice_no: f.nrFaktury   || '',
            station:    f.stacja      || '',
          }),
        });
      } else if (qItem.type === 'serwis') {
        await fetch(`${API}/api/service-records`, {
          method: 'POST', headers: H,
          body: JSON.stringify({
            company_id:  company, nr_rej: f.nrRej || '',
            date:        f.dataSerwisu || '',
            description: f.rodzajUslugi || '',
            cost:        f.kosztBrutto  ? parseFloat(f.kosztBrutto) : null,
            mileage:     f.przebieg     ? parseInt(f.przebieg)      : null,
            workshop:    f.warsztat     || '',
          }),
        });
      }
      await _idbPut(STORE_DONE, { key: qItem.fileKey, importedAt: Date.now() });
      qItem.status = 'imported';
      if (typeof toast === 'function') toast(`✓ Zaimportowano: ${esc(qItem.filename)}`);
    } catch (e) {
      qItem.status = 'error';
      qItem.error  = 'Import: ' + e.message;
    }
    _saveQueue();
    _renderQueue();
    _updateBadge();
  }

  // ─── Pełne skanowanie ───────────────────────────────────────────────────────
  async function _runScan() {
    if (_scanning) return 0;
    _scanning = true;
    let newCount = 0;

    for (const type of (_settings.types || [])) {
      const hEntry = await _idbGet(STORE_HANDLES, type);
      if (!hEntry?.handle) continue;
      const dirHandle = hEntry.handle;

      // Sprawdź / poproś o uprawnienie
      let perm = await dirHandle.queryPermission({ mode: 'read' }).catch(() => 'denied');
      if (perm === 'prompt') {
        try { perm = await dirHandle.requestPermission({ mode: 'read' }); }
        catch { perm = 'denied'; }
      }
      if (perm !== 'granted') continue;

      const items = await _scanDir(dirHandle, type).catch(() => []);
      for (const it of items) {
        const qItem = {
          id:        Date.now() + Math.random(),
          filename:  it.name,
          type:      it.type,
          fileKey:   it.fileKey,
          file:      it.file,
          status:    'pending',
          result:    null,
          error:     null,
          scannedAt: Date.now(),
        };
        if (_addToQueue(qItem)) newCount++;
      }
    }

    _scanning = false;
    _renderQueue();

    if (newCount > 0) {
      _updateBadge();
      if (_settings.mode === 'notify' || _settings.mode === 'auto') {
        if (typeof toast === 'function') toast(`📂 ${newCount} nowych dokumentów do importu`);
        openQueue();
      }
    }
    return newCount;
  }

  // ─── Timer auto ────────────────────────────────────────────────────────────
  function _startAuto() {
    if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; }
    if (!_settings.enabled || _settings.mode !== 'auto') return;
    const ms = (_settings.interval || 10) * 60_000;
    _autoTimer = setInterval(_runScan, ms);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function _toBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = e => res(e.target.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  // ─── UI: Modal ustawień ────────────────────────────────────────────────────
  function openSettings() {
    _renderSettings();
    document.getElementById('fm-settings-modal')?.classList.remove('hidden');
  }

  function _closeSettings() {
    document.getElementById('fm-settings-modal')?.classList.add('hidden');
  }

  function _renderSettings() {
    const body = document.getElementById('fm-settings-body');
    if (!body) return;
    const s = _settings;

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:18px">

        <!-- Tryb -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Tryb działania</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px" id="fm-mode-grid">
            ${[
              { v:'manual', icon:'ti-hand-click', lbl:'Ręczny',          desc:'Klikasz "Skanuj" gdy chcesz' },
              { v:'auto',   icon:'ti-refresh',    lbl:'Auto',             desc:'Skanuje co N minut' },
              { v:'notify', icon:'ti-bell',        lbl:'Powiadomienie',   desc:'Skanuje i pokazuje badge' },
            ].map(m => `
              <label class="fm-mode-card" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;border:2px solid ${s.mode===m.v?'var(--blue)':'var(--border)'};border-radius:var(--radius);cursor:pointer;background:${s.mode===m.v?'color-mix(in srgb,var(--blue) 8%,transparent)':'var(--bg3)'};transition:all .15s;text-align:center">
                <input type="radio" name="fm-mode" value="${m.v}" ${s.mode===m.v?'checked':''} style="display:none">
                <i class="ti ${m.icon}" style="font-size:20px;color:${s.mode===m.v?'var(--blue)':'var(--text3)'}"></i>
                <span style="font-size:12px;font-weight:700">${m.lbl}</span>
                <span style="font-size:10px;color:var(--text3)">${m.desc}</span>
              </label>`).join('')}
          </div>
        </div>

        <!-- Interwał auto -->
        <div id="fm-interval-row" style="display:${s.mode==='auto'?'flex':'none'};align-items:center;gap:10px;background:var(--bg3);padding:10px 14px;border-radius:var(--radius)">
          <i class="ti ti-clock" style="color:var(--text3)"></i>
          <span style="font-size:12px">Skanuj co</span>
          <select id="fm-interval" class="fi" style="width:90px">
            ${[5,10,15,30,60].map(v => `<option value="${v}" ${Number(s.interval)===v?'selected':''}>${v} min</option>`).join('')}
          </select>
          <span style="font-size:12px;color:var(--text3)">minut</span>
        </div>

        <!-- Foldery -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Obserwowane foldery</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${Object.entries(TYPE_META).map(([key, m]) => `
              <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg3);border-radius:var(--radius)">
                <i class="ti ${m.icon}" style="color:${m.color};font-size:16px;width:18px;flex-shrink:0;text-align:center"></i>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600">${m.label}</div>
                  <div id="fm-path-${key}" style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Nie skonfigurowany</div>
                </div>
                <button class="btn btn-gray btn-sm" onclick="window.FolderMonitor._pickFolder('${key}')"><i class="ti ti-folder-open"></i> Wybierz</button>
                <button class="btn btn-gray btn-sm" id="fm-clear-${key}" style="display:none;padding:4px 8px" title="Usuń" onclick="window.FolderMonitor._clearFolder('${key}')"><i class="ti ti-x"></i></button>
              </div>`).join('')}
          </div>
        </div>

        <!-- Aktywne typy -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Aktywne typy dokumentów</div>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            ${Object.entries(TYPE_META).map(([key, m]) => `
              <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
                <input type="checkbox" id="fm-type-${key}" ${(s.types||[]).includes(key)?'checked':''}>
                <i class="ti ${m.icon}" style="color:${m.color}"></i> ${m.label}
              </label>`).join('')}
          </div>
        </div>

      </div>`;

    // Mode-radio UI update
    body.querySelectorAll('input[name="fm-mode"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('fm-interval-row').style.display = r.value === 'auto' ? 'flex' : 'none';
        body.querySelectorAll('.fm-mode-card').forEach(card => {
          const inp = card.querySelector('input[name="fm-mode"]');
          const active = inp?.checked;
          card.style.borderColor = active ? 'var(--blue)' : 'var(--border)';
          card.style.background  = active ? 'color-mix(in srgb,var(--blue) 8%,transparent)' : 'var(--bg3)';
          card.querySelector('i').style.color = active ? 'var(--blue)' : 'var(--text3)';
        });
      });
    });

    // Załaduj nazwy folderów z IDB
    Object.keys(TYPE_META).forEach(async key => {
      const h = await _idbGet(STORE_HANDLES, key);
      const pathEl  = document.getElementById('fm-path-' + key);
      const clearEl = document.getElementById('fm-clear-' + key);
      if (h?.name && pathEl) {
        pathEl.textContent = h.name;
        if (clearEl) clearEl.style.display = '';
      }
    });
  }

  async function _pickFolder(type) {
    if (!window.showDirectoryPicker) {
      if (typeof toast === 'function') toast('⚠ Wybór folderu wymaga Chrome lub Edge (76+)');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      await _idbPut(STORE_HANDLES, { type, handle, name: handle.name });
      const pathEl  = document.getElementById('fm-path-' + type);
      const clearEl = document.getElementById('fm-clear-' + type);
      if (pathEl)  pathEl.textContent = handle.name;
      if (clearEl) clearEl.style.display = '';
      if (typeof toast === 'function') toast(`✓ Folder "${esc(handle.name)}" → ${TYPE_META[type]?.label}`);
    } catch (e) {
      if (e.name !== 'AbortError' && typeof toast === 'function') toast('⚠ ' + e.message);
    }
  }

  async function _clearFolder(type) {
    await _idbDelete(STORE_HANDLES, type);
    const pathEl  = document.getElementById('fm-path-' + type);
    const clearEl = document.getElementById('fm-clear-' + type);
    if (pathEl)  pathEl.textContent = 'Nie skonfigurowany';
    if (clearEl) clearEl.style.display = 'none';
  }

  function _saveSettingsFromModal() {
    const modeEl = document.querySelector('#fm-settings-modal input[name="fm-mode"]:checked');
    _settings.mode     = modeEl?.value || 'manual';
    _settings.interval = parseInt(document.getElementById('fm-interval')?.value || '10');
    _settings.enabled  = true;
    _settings.types    = Object.keys(TYPE_META).filter(k => document.getElementById('fm-type-' + k)?.checked);
    _saveSettings();
    _startAuto();
    _closeSettings();
    if (typeof toast === 'function') toast('✓ Ustawienia monitora folderów zapisane');
  }

  // ─── UI: Modal kolejki ─────────────────────────────────────────────────────
  function openQueue() {
    document.getElementById('fm-queue-modal')?.classList.remove('hidden');
    _renderQueue();
  }

  function _closeQueue() {
    document.getElementById('fm-queue-modal')?.classList.add('hidden');
  }

  function _renderQueue() {
    const listEl = document.getElementById('fm-queue-list');
    if (!listEl) return;

    if (!_queue.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:28px;color:var(--text3)"><i class="ti ti-inbox" style="font-size:26px;display:block;margin-bottom:8px"></i>Kolejka pusta</div>';
    } else {
      const STATUS = {
        pending:   { icon: 'ti-clock',             color: 'var(--text3)',  lbl: 'Oczekuje' },
        processing:{ icon: 'ti-loader ti-spin',    color: 'var(--blue)',   lbl: 'Analizuję...' },
        importing: { icon: 'ti-loader ti-spin',    color: 'var(--blue)',   lbl: 'Importuję...' },
        ready:     { icon: 'ti-check',             color: 'var(--amber)',  lbl: 'Gotowy do importu' },
        imported:  { icon: 'ti-check-circle',      color: 'var(--green)',  lbl: 'Zaimportowany' },
        error:     { icon: 'ti-alert-circle',      color: 'var(--red)',    lbl: 'Błąd' },
      };
      listEl.innerHTML = _queue.map((q, i) => {
        const st  = STATUS[q.status] || STATUS.pending;
        const tm  = TYPE_META[q.type] || TYPE_META.serwis;
        const nrRej = q.result?.nrRej || '';
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--border);font-size:12px">
            <i class="ti ${st.icon}" style="color:${st.color};font-size:16px;width:18px;flex-shrink:0"></i>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.filename)}</div>
              <div style="color:var(--text3);margin-top:2px;display:flex;gap:6px;align-items:center">
                <span style="background:${tm.color};color:#fff;padding:1px 6px;border-radius:99px;font-size:10px">${tm.label}</span>
                ${nrRej ? `<span>${esc(nrRej)}</span>` : ''}
                ${q.error ? `<span style="color:var(--red)">${esc(q.error)}</span>` : ''}
                ${q.ocrModel ? `<span style="opacity:.5">${esc(q.ocrModel)}</span>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0">
              ${q.status === 'pending'  ? `<button class="btn btn-blue btn-sm" onclick="window.FolderMonitor._queueAction(${i},'analyze')"><i class="ti ti-eye"></i> Analizuj</button>` : ''}
              ${q.status === 'ready'    ? `<button class="btn btn-green btn-sm" onclick="window.FolderMonitor._queueAction(${i},'import')"><i class="ti ti-download"></i> Importuj</button>` : ''}
              ${q.status === 'error'    ? `<button class="btn btn-gray btn-sm" onclick="window.FolderMonitor._queueAction(${i},'analyze')"><i class="ti ti-refresh"></i></button>` : ''}
              ${q.status === 'imported' ? `<span style="color:var(--green);font-size:11px"><i class="ti ti-check"></i> Gotowe</span>` : ''}
              <button class="btn btn-gray btn-sm" onclick="window.FolderMonitor._queueAction(${i},'remove')" style="padding:3px 7px"><i class="ti ti-x"></i></button>
            </div>
          </div>`;
      }).join('');
    }

    // Przyciski bulk
    const hasPending  = _queue.some(q => q.status === 'pending');
    const hasReady    = _queue.some(q => q.status === 'ready');
    document.getElementById('fm-btn-analyze')?.style.setProperty('display', hasPending ? '' : 'none');
    document.getElementById('fm-btn-import')?.style.setProperty('display', hasReady   ? '' : 'none');
    const cnt = document.getElementById('fm-queue-count');
    if (cnt) cnt.textContent = _queue.length ? `(${_queue.length})` : '';
  }

  async function _queueAction(idx, action) {
    const q = _queue[idx];
    if (!q) return;
    if (action === 'analyze') await _processItem(q);
    else if (action === 'import') await _importItem(q);
    else if (action === 'remove') { _queue.splice(idx, 1); _saveQueue(); _renderQueue(); _updateBadge(); }
  }

  async function _analyzeAll() {
    for (const q of [..._queue]) {
      if (q.status === 'pending' || q.status === 'error') await _processItem(q);
    }
  }

  async function _importAll() {
    for (const q of [..._queue]) {
      if (q.status === 'ready') await _importItem(q);
    }
  }

  // ─── Publiczne API ──────────────────────────────────────────────────────────
  async function scan() {
    if (typeof toast === 'function') toast('🔍 Skanowanie folderów...');
    const n = await _runScan();
    if (n === 0 && typeof toast === 'function') toast('Brak nowych dokumentów w folderach');
    if (n > 0) openQueue();
  }

  // ─── Detekcja możliwości przeglądarki ──────────────────────────────────────
  function _hasFsApi() {
    return typeof window.showDirectoryPicker === 'function';
  }

  // ─── Tryb agenta — polling kolejki z Workera ────────────────────────────────
  let _agentPollTimer = null;
  let _lastAgentPoll  = 0;

  async function _pollAgentQueue() {
    const API     = (window.CF_API_URL || '').replace(/\/$/, '');
    const company = window.currentCompanyId || 'mtoilet';
    const token   = localStorage.getItem('cf_token');
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/folder-monitor/queue?company=${encodeURIComponent(company)}&limit=100`, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!r.ok) return;
      const rows = await r.json().catch(() => []);
      if (!Array.isArray(rows)) return;
      _lastAgentPoll = Date.now();

      let added = 0;
      for (const row of rows) {
        if (_queue.find(q => q.agentId === row.id)) continue;
        _queue.unshift({
          id:        Date.now() + Math.random(),
          agentId:   row.id,
          filename:  row.filename,
          type:      row.doc_type,
          fileKey:   'agent:' + row.id,
          file:      null,
          status:    row.status === 'ocr_done' ? 'ready' : row.status === 'error' ? 'error' : 'pending',
          result:    row.ocr_result || null,
          ocrModel:  row.ocr_model || '',
          error:     row.error_msg || null,
          scannedAt: new Date(row.created_at).getTime(),
          source:    'agent',
          agentName: row.agent_name || 'agent',
        });
        added++;
      }
      if (added > 0) {
        _saveQueue();
        _renderQueue();
        _updateBadge();
      }
      // Aktualizuj status w ustawieniach (jeśli otwarty)
      _updateAgentStatus();
    } catch (_) {}
  }

  function _updateAgentStatus() {
    const el = document.getElementById('fm-agent-status');
    if (!el) return;
    const ago = _lastAgentPoll ? Math.round((Date.now() - _lastAgentPoll) / 1000) : null;
    if (!ago) {
      el.innerHTML = '<span style="color:var(--text3)">Nie połączono</span>';
    } else {
      el.innerHTML = `<span style="color:var(--green)"><i class="ti ti-circle-check"></i> Ostatni odbiór: ${ago < 60 ? ago + 's temu' : Math.round(ago/60) + 'min temu'}</span>`;
    }
  }

  function _startAgentPoll() {
    if (_agentPollTimer) clearInterval(_agentPollTimer);
    _agentPollTimer = setInterval(_pollAgentQueue, 30_000);
  }

  // Nadpisz _renderSettings — dodaj sekcję agenta i info o przeglądarce
  const _renderSettingsOrig = _renderSettings;
  function _renderSettingsWithAgent() {
    _renderSettingsOrig();
    const body = document.getElementById('fm-settings-body');
    if (!body) return;

    const fsSupported = _hasFsApi();
    const browserInfo = fsSupported
      ? `<span style="color:var(--green)"><i class="ti ti-check"></i> Twoja przeglądarka obsługuje bezpośrednie czytanie folderów</span>`
      : `<span style="color:var(--amber)"><i class="ti ti-info-circle"></i> Twoja przeglądarka (Firefox/Safari) nie obsługuje File System Access API</span>`;

    const agentSection = document.createElement('div');
    agentSection.style.cssText = 'border-top:1px solid var(--border);margin-top:20px;padding-top:18px';
    agentSection.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
        <i class="ti ti-server" style="color:var(--blue)"></i> Tryb agenta lokalnego (Node.js) — każda przeglądarka
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">
        Lokalny agent Node.js obserwuje foldery i wysyła dokumenty do TaxOrder Pro przez HTTP.
        Działa w tle jako skrypt — Firefox, Chrome, Edge, Safari.
      </div>
      <div style="background:var(--bg3);border-radius:var(--radius);padding:12px 14px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;margin-bottom:8px">Jak uruchomić:</div>
        <ol style="font-size:12px;color:var(--text2);margin:0;padding-left:18px;line-height:1.8">
          <li>Znajdź pliki w: <code style="font-size:11px;background:var(--bg2);padding:1px 5px;border-radius:3px">taxorder-pro/tools/folder-watcher/</code></li>
          <li>Skopiuj <code style="font-size:11px;background:var(--bg2);padding:1px 5px;border-radius:3px">config.example.json</code> → <code style="font-size:11px;background:var(--bg2);padding:1px 5px;border-radius:3px">config.json</code></li>
          <li>Wpisz token: <code style="font-size:11px;background:var(--bg2);padding:1px 5px;border-radius:3px">F12 → Console → localStorage.getItem("cf_token")</code></li>
          <li>Ustaw ścieżki do folderów w config.json</li>
          <li>Uruchom: <code style="font-size:11px;background:var(--bg2);padding:1px 5px;border-radius:3px">start.bat</code> (Windows) lub <code style="font-size:11px;background:var(--bg2);padding:1px 5px;border-radius:3px">.\start.ps1</code> (PowerShell)</li>
        </ol>
      </div>
      <div style="display:flex;align-items:center;gap:10px;font-size:12px">
        <span>Status agenta:</span>
        <span id="fm-agent-status"><span style="color:var(--text3)">Sprawdzam...</span></span>
        <button class="btn btn-gray btn-sm" onclick="window.FolderMonitor._pollAgentQueue()"><i class="ti ti-refresh"></i> Odśwież</button>
      </div>
      <div style="margin-top:12px;font-size:12px;padding:6px 10px;border-radius:var(--radius);background:${fsSupported ? 'color-mix(in srgb,var(--green) 10%,transparent)' : 'color-mix(in srgb,var(--amber) 12%,transparent)'}">
        ${browserInfo}
      </div>`;
    body.appendChild(agentSection);
    // Zaktualizuj status
    setTimeout(_updateAgentStatus, 200);
    _pollAgentQueue();
  }

  // ─── Nadpisz _importItem dla pozycji z agenta ───────────────────────────────
  const _importItemOrig = _importItem;
  async function _importItemWithAgent(qItem) {
    if (qItem.source === 'agent' && qItem.agentId) {
      // Najpierw importuj dane
      await _importItemOrig(qItem);
      // Potem oznacz w DB Workera
      if (qItem.status === 'imported') {
        const API   = (window.CF_API_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem('cf_token');
        await fetch(`${API}/api/folder-monitor/queue/${encodeURIComponent(qItem.agentId)}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') },
          body:    JSON.stringify({ status: 'imported' }),
        }).catch(() => {});
      }
    } else {
      await _importItemOrig(qItem);
    }
  }

  async function init() {
    _loadSettings();
    _loadQueue();
    await _openIdb();
    _updateBadge();
    _startAuto();
    _startAgentPoll();
    // Pierwsze odpytanie agenta po 5s
    setTimeout(_pollAgentQueue, 5000);
    if (_settings.enabled && _settings.mode === 'auto') {
      setTimeout(_runScan, 4000);
    }
    console.log('[FolderMonitor] Zaladowany | tryb:', _settings.mode, '| FsAPI:', _hasFsApi());
  }

  window.FolderMonitor = {
    init,
    openSettings: () => { _renderSettingsWithAgent(); document.getElementById('fm-settings-modal')?.classList.remove('hidden'); },
    openQueue, scan,
    _pickFolder, _clearFolder, _saveSettingsFromModal,
    _processItem,
    _importItem: _importItemWithAgent,
    _queueAction: async (idx, action) => {
      const q = _queue[idx];
      if (!q) return;
      if (action === 'analyze') await _processItem(q);
      else if (action === 'import') await _importItemWithAgent(q);
      else if (action === 'remove') {
        // Oznacz w workerze jako skipped jeśli z agenta
        if (q.source === 'agent' && q.agentId) {
          const API = (window.CF_API_URL || '').replace(/\/$/, '');
          const tok = localStorage.getItem('cf_token');
          fetch(`${API}/api/folder-monitor/queue/${encodeURIComponent(q.agentId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (tok || '') },
            body: JSON.stringify({ status: 'skipped' }),
          }).catch(() => {});
        }
        _queue.splice(idx, 1);
        _saveQueue();
        _renderQueue();
        _updateBadge();
      }
    },
    _analyzeAll,
    _importAll: async () => { for (const q of [..._queue]) { if (q.status === 'ready') await _importItemWithAgent(q); } },
    _closeSettings, _closeQueue,
    _pollAgentQueue,
    get _queue() { return _queue; },
  };
})();
