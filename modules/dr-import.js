/**
 * TaxOrder Pro — Import Dowodów Rejestracyjnych z R2
 * Pipeline: upload → lista → Aztec barcode (ZXing) → AI OCR fallback → modal → zapis
 * Obsługuje: aktywne pojazdy (aktualizacja), archiwizowane (reaktywacja + aktualizacja), nowe (dodanie)
 */
window.TaxOrderDrImport = (function () {

  const API = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const token = () => localStorage.getItem('cf_token');
  const hdrs = (extra = {}) => ({ Authorization: `Bearer ${token()}`, ...extra });
  const company = () => window.currentCompanyId || 'mtoilet';

  let _files = [];
  let _vehs = [];

  // ── API calls ────────────────────────────────────────────────────────────────
  async function _listFiles() {
    const r = await fetch(`${API()}/api/dr-import?company=${company()}`, { headers: hdrs() });
    _files = r.ok ? ((await r.json()).files || []) : [];
  }

  async function _loadVehs() {
    const r = await fetch(`${API()}/api/vehicles?company=${company()}`, { headers: hdrs() });
    const rows = r.ok ? await r.json() : [];
    _vehs = rows.map(row => {
      let data = {};
      try { data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}); } catch {}
      return { ...row, ...data };
    });
  }

  async function _uploadFiles(fileList) {
    let ok = 0;
    for (const f of Array.from(fileList)) {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch(`${API()}/api/dr-import?company=${company()}`, { method: 'POST', headers: hdrs(), body: fd });
      if (r.ok) ok++;
    }
    return ok;
  }

  async function _deleteFile(r2Key) {
    await fetch(`${API()}/api/dr-import?company=${company()}&key=${encodeURIComponent(r2Key)}`, {
      method: 'DELETE', headers: hdrs(),
    });
  }

  async function _saveDr(nr_rej, fields, r2Key, unarchive, createIfMissing) {
    const r = await fetch(`${API()}/api/dr-save?company=${company()}`, {
      method: 'POST',
      headers: { ...hdrs(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nr_rej, fields, r2Key, unarchive, createIfMissing }),
    });
    return r.ok ? await r.json() : null;
  }

  // ── Aztec + OCR pipeline ─────────────────────────────────────────────────────
  async function _extractFromBlob(blob, mimeType) {
    // 1. Spróbuj Aztec (100% dokładność dla polskich DR)
    const aztecFields = await _tryAztecBlob(blob, mimeType);
    if (aztecFields) return { fields: aztecFields, method: 'AZTEC' };

    // 2. Fallback: AI OCR przez /api/ai/ocr
    const aiFields = await _tryAiOcr(blob, mimeType);
    if (aiFields) return { fields: aiFields, method: 'AI' };

    return null;
  }

  async function _tryAztecBlob(blob, mimeType) {
    try {
      // Potrzebujemy ZXing (globalna funkcja z app.js)
      if (typeof loadZXing !== 'function') return null;
      await loadZXing();
      if (!window.ZXing) return null;

      const base64 = await _blobToBase64(blob);
      const img = new Image();
      await new Promise(res => { img.onload = res; img.onerror = res; img.src = `data:${mimeType};base64,${base64}`; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);

      // Próbuj 4 obroty (DR może być skan poziomy/pionowy)
      for (const deg of [0, 90, 270, 180]) {
        const rotated = typeof _rotateCanvas === 'function' ? _rotateCanvas(canvas, deg) : canvas;
        const bytes = typeof tryAztecFromCanvas === 'function' ? await tryAztecFromCanvas(rotated) : null;
        if (bytes && bytes.length >= 8) {
          let b64 = ''; for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
          const r = await fetch(`${API()}/api/aztec`, {
            method: 'POST',
            headers: { ...hdrs(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ bytesBase64: btoa(b64) }),
          });
          if (r.ok) {
            const d = await r.json();
            if (d.ok && d.fields && d.fields.nrRej) return d.fields;
          }
        }
      }
    } catch { /* fallthrough */ }
    return null;
  }

  async function _tryAiOcr(blob, mimeType) {
    try {
      const base64 = await _blobToBase64(blob);
      const r = await fetch(`${API()}/api/ai/ocr`, {
        method: 'POST',
        headers: { ...hdrs(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.fields || null;
    } catch { return null; }
  }

  async function _blobToBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result.split(',')[1]);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  async function load() {
    const el = document.getElementById('page-dr-import');
    if (!el) return;
    el.innerHTML = `<div style="padding:20px 24px;max-width:1050px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <i class="ti ti-id-badge" style="font-size:24px;color:var(--blue)"></i>
        <h2 style="margin:0;font-size:20px">Import Dowodów Rejestracyjnych</h2>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:20px">
        Wgraj skany/zdjęcia DR — system wykryje kod Aztec (100% dokładność) lub użyje AI OCR i automatycznie zaktualizuje dane pojazdu.
      </div>

      <!-- Upload area -->
      <div id="dri-upload-area" style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:28px;text-align:center;margin-bottom:20px;cursor:pointer;transition:border-color .15s"
        onclick="document.getElementById('dri-file-input').click()"
        ondragover="event.preventDefault();this.style.borderColor='var(--blue)'"
        ondragleave="this.style.borderColor='var(--border)'"
        ondrop="event.preventDefault();this.style.borderColor='var(--border)';TaxOrderDrImport._onDrop(event)">
        <i class="ti ti-upload" style="font-size:36px;color:var(--text3);display:block;margin-bottom:8px"></i>
        <div style="font-size:14px;color:var(--text2)">Kliknij lub przeciągnij skany DR</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">JPG, PNG, WEBP, PDF · Kod Aztec wykrywany automatycznie</div>
        <input type="file" id="dri-file-input" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" style="display:none"
          onchange="TaxOrderDrImport._onFiles(this.files)">
      </div>

      <!-- Opcja: przetwórz wszystkie -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <strong style="font-size:13px">Pliki oczekujące</strong>
        <div style="display:flex;gap:6px">
          <button class="btn btn-blue" style="font-size:11px" id="dri-batch-btn" onclick="TaxOrderDrImport._batchAll()" title="Przetwórz wszystkie pliki z folderu automatycznie">
            <i class="ti ti-player-play"></i>Przetwórz wszystkie
          </button>
          <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderDrImport._refresh()">
            <i class="ti ti-refresh"></i>Odśwież
          </button>
        </div>
      </div>
      <div id="dri-list"><div style="text-align:center;padding:40px"><i class="ti ti-loader ti-spin" style="font-size:28px"></i></div></div>
    </div>`;

    await Promise.all([_listFiles(), _loadVehs()]);
    _renderList();
  }

  function _renderList() {
    const el = document.getElementById('dri-list');
    if (!el) return;
    if (!_files.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3)">
        <i class="ti ti-folder-off" style="font-size:36px;display:block;margin-bottom:8px"></i>
        Brak plików w folderze importu — wgraj skany DR powyżej
      </div>`;
      return;
    }
    el.innerHTML = _files.map(f => {
      const isImg = /\.(jpg|jpeg|png|webp)$/i.test(f.name);
      return `<div id="dri-row-${_sid(f.key)}" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <i class="ti ${isImg ? 'ti-photo' : 'ti-file-type-pdf'}" style="font-size:24px;color:var(--blue);flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</div>
          <div style="font-size:11px;color:var(--text2)">${_fmtSize(f.size)} · ${f.uploaded ? new Date(f.uploaded).toLocaleString('pl-PL') : ''}</div>
        </div>
        <div id="dri-status-${_sid(f.key)}" style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-blue" style="font-size:11px" onclick="TaxOrderDrImport._process('${f.key}','${f.name}')">
            <i class="ti ti-scan"></i>Aztec/OCR
          </button>
          <button class="btn btn-gray" style="font-size:11px;color:var(--red)" onclick="TaxOrderDrImport._del('${f.key}','${f.name}')">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  // ── Upload ────────────────────────────────────────────────────────────────────
  async function _onFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const area = document.getElementById('dri-upload-area');
    if (area) area.innerHTML = `<i class="ti ti-loader ti-spin" style="font-size:28px;color:var(--blue)"></i><div style="margin-top:8px">Wysyłanie ${files.length} plik(ów)...</div>`;
    const n = await _uploadFiles(files);
    window.toast?.(`✓ Wgrano ${n} z ${files.length} pliku(ów) do folderu DR`);
    await _listFiles();
    load(); // re-render page
  }

  function _onDrop(e) {
    const files = e.dataTransfer?.files;
    if (files?.length) _onFiles(files);
  }

  // ── Batch processing (przetwórz wszystkie) ───────────────────────────────────
  async function _batchAll() {
    if (!_files.length) { window.toast?.('Brak plików do przetworzenia'); return; }
    const btn = document.getElementById('dri-batch-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader ti-spin"></i>Przetwarzam...'; }

    let processed = 0, failed = 0;
    for (const f of _files) {
      const statusEl = document.getElementById('dri-status-' + _sid(f.key));
      if (statusEl) statusEl.innerHTML = '<i class="ti ti-loader ti-spin" style="color:var(--blue)"></i>';
      try {
        const result = await _extractFile(f.key, f.name);
        if (result) {
          const veh = _findVeh(result.fields.nrRej);
          if (veh) {
            await _saveDr(veh.nr_rej, result.fields, f.key, false, false);
            if (statusEl) statusEl.innerHTML = `<span style="color:var(--green);font-size:11px"><i class="ti ti-check"></i> ${veh.nr_rej} zaktualizowany (${result.method})</span>`;
            processed++;
          } else {
            if (statusEl) statusEl.innerHTML = `<span style="color:var(--amber);font-size:11px"><i class="ti ti-alert-triangle"></i> ${result.fields.nrRej || '?'} — nie znaleziono pojazdu</span>
              <button class="btn btn-gray" style="font-size:10px" onclick="TaxOrderDrImport._process('${f.key}','${f.name}')"><i class="ti ti-hand"></i>Ręcznie</button>`;
            failed++;
          }
        } else {
          if (statusEl) statusEl.innerHTML = `<span style="color:var(--red);font-size:11px"><i class="ti ti-x"></i> Nie udało się odczytać</span>
            <button class="btn btn-gray" style="font-size:10px" onclick="TaxOrderDrImport._process('${f.key}','${f.name}')"><i class="ti ti-hand"></i>Ręcznie</button>`;
          failed++;
        }
      } catch {
        failed++;
      }
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-player-play"></i>Przetwórz wszystkie'; }
    window.toast?.(`✓ Batch: ${processed} zaktualizowanych, ${failed} wymaga uwagi`);
    await _listFiles();
  }

  // ── Single file processing ───────────────────────────────────────────────────
  async function _process(r2Key, fileName) {
    const statusEl = document.getElementById('dri-status-' + _sid(r2Key));
    if (statusEl) statusEl.innerHTML = '<i class="ti ti-loader ti-spin" style="color:var(--blue)"></i> Odczytuję...';

    const result = await _extractFile(r2Key, fileName);

    if (!result) {
      if (statusEl) statusEl.innerHTML = `<button class="btn btn-blue" style="font-size:11px" onclick="TaxOrderDrImport._process('${r2Key}','${fileName}')"><i class="ti ti-scan"></i>Aztec/OCR</button>
        <button class="btn btn-gray" style="font-size:11px;color:var(--red)" onclick="TaxOrderDrImport._del('${r2Key}','${fileName}')"><i class="ti ti-trash"></i></button>`;
      window.toast?.('Nie udało się odczytać danych z pliku — sprawdź jakość skanu');
      return;
    }

    if (statusEl) statusEl.innerHTML = `<button class="btn btn-blue" style="font-size:11px" onclick="TaxOrderDrImport._process('${r2Key}','${fileName}')"><i class="ti ti-scan"></i>Aztec/OCR</button>
      <button class="btn btn-gray" style="font-size:11px;color:var(--red)" onclick="TaxOrderDrImport._del('${r2Key}','${fileName}')"><i class="ti ti-trash"></i></button>`;

    _showModal(r2Key, fileName, result.fields, result.method);
  }

  async function _extractFile(r2Key, fileName) {
    // Pobierz plik z R2
    const r = await fetch(`${API()}/api/docs/file/${r2Key}`, { headers: hdrs() });
    if (!r.ok) return null;
    let blob = await r.blob();
    let mimeType = blob.type || 'image/jpeg';

    // PDF → obraz (strona 1)
    if (fileName.toLowerCase().endsWith('.pdf') && window.pdfjsLib) {
      blob = await _pdfPage1Blob(blob) || blob;
      mimeType = 'image/jpeg';
    }

    return await _extractFromBlob(blob, mimeType);
  }

  async function _pdfPage1Blob(pdfBlob) {
    try {
      const pdf = await window.pdfjsLib.getDocument({ data: await pdfBlob.arrayBuffer() }).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      return await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    } catch { return null; }
  }

  // ── Modal potwierdzenia ───────────────────────────────────────────────────────
  function _showModal(r2Key, fileName, fields, method) {
    const nrRej = (fields.nrRej || '').toUpperCase().replace(/\s/g, '');
    const veh = _findVeh(nrRej);
    const isArchived = veh?.is_active === false;
    const isNew = !veh;

    const badge = method === 'AZTEC'
      ? `<span style="font-size:11px;background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:99px"><i class="ti ti-qrcode"></i> Kod Aztec — 100% pewność</span>`
      : `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:99px"><i class="ti ti-brain"></i> AI OCR</span>`;

    const statusBadge = isArchived
      ? `<span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:99px;margin-left:6px"><i class="ti ti-archive"></i> ARCHIWUM</span>`
      : isNew
      ? `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:99px;margin-left:6px"><i class="ti ti-plus"></i> Nowy pojazd</span>`
      : `<span style="font-size:11px;background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:99px;margin-left:6px"><i class="ti ti-check"></i> Znaleziony w bazie</span>`;

    const vehInfo = veh ? `${veh.marka || ''} ${veh.model || ''}`.trim() : '';

    const fi = (id, label, val, type = 'text') =>
      `<div><label style="font-size:11px;color:var(--text2)">${label}</label>
       <input id="dri-f-${id}" type="${type}" class="fi" value="${val || ''}"></div>`;

    const html = `<div id="dri-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:7000;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:16px"
      onclick="if(event.target===this)this.remove()">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:680px;max-width:98vw;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <i class="ti ti-id-badge" style="font-size:20px;color:var(--blue)"></i>
          <strong style="font-size:16px">Potwierdź dane DR</strong>
          <button onclick="document.getElementById('dri-modal').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:20px">×</button>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:12px">${fileName}</div>

        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:16px">
          ${badge}
          ${statusBadge}
          ${vehInfo ? `<span style="font-size:11px;color:var(--text2);margin-left:4px">${vehInfo}</span>` : ''}
        </div>

        ${isArchived ? `<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:var(--radius);padding:10px;font-size:12px;color:#92400e;margin-bottom:14px">
          <i class="ti ti-alert-triangle"></i> Ten pojazd jest zarchiwizowany.
          <label style="display:flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer">
            <input type="checkbox" id="dri-unarchive" checked>
            <span>Reaktywuj pojazd (odznacz z archiwum)</span>
          </label>
        </div>` : ''}

        ${isNew ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--radius);padding:10px;font-size:12px;color:#1d4ed8;margin-bottom:14px">
          <i class="ti ti-info-circle"></i> Pojazd <strong>${nrRej}</strong> nie istnieje w bazie.
          <label style="display:flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer">
            <input type="checkbox" id="dri-create" checked>
            <span>Dodaj jako nowy pojazd</span>
          </label>
        </div>` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          ${fi('nrRej', 'Nr rejestracyjny', nrRej)}
          ${fi('marka', 'Marka (D.1)', fields.marka)}
          ${fi('typ', 'Model / Typ (D.2)', fields.typ)}
          ${fi('vin', 'VIN (E)', fields.vin)}
          ${fi('dmcKg', 'DMC F.1 (kg)', fields.dmcKg, 'number')}
          ${fi('dmcZespolu', 'DMC zespołu F.3 (kg)', fields.dmcZespolu, 'number')}
          ${fi('masaWlKg', 'Masa własna G (kg)', fields.masaWlKg, 'number')}
          ${fi('liczbaOsi', 'Liczba osi (L)', fields.liczbaOsi, 'number')}
          ${fi('paliwo', 'Paliwo (P.3)', fields.paliwo)}
          ${fi('dataRej', 'Data rejestracji', fields.dataRej)}
          ${fi('kategoria', 'Kategoria DR (J)', fields.kategoria)}
          ${fi('pojSilnika', 'Poj. silnika cm³', fields.pojSilnika, 'number')}
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="document.getElementById('dri-modal').remove()">Anuluj</button>
          <button class="btn btn-blue" id="dri-save-btn" onclick="TaxOrderDrImport._save('${r2Key}',${isArchived},${isNew})">
            <i class="ti ti-check"></i>${isNew ? 'Dodaj pojazd' : isArchived ? 'Reaktywuj i zaktualizuj' : 'Zaktualizuj dane pojazdu'}
          </button>
        </div>
      </div>
    </div>`;

    document.getElementById('dri-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  async function _save(r2Key, isArchived, isNew) {
    const g = id => document.getElementById('dri-f-' + id)?.value?.trim() || null;
    const nr_rej = g('nrRej');
    if (!nr_rej) { window.toast?.('Podaj numer rejestracyjny'); return; }

    const fields = {
      nrRej:      nr_rej,
      marka:      g('marka'),
      typ:        g('typ'),
      vin:        g('vin'),
      dmcKg:      g('dmcKg'),
      dmcZespolu: g('dmcZespolu'),
      masaWlKg:   g('masaWlKg'),
      liczbaOsi:  g('liczbaOsi'),
      paliwo:     g('paliwo'),
      dataRej:    g('dataRej'),
      kategoria:  g('kategoria'),
      pojSilnika: g('pojSilnika'),
    };

    const unarchive = isArchived && (document.getElementById('dri-unarchive')?.checked ?? true);
    const createIfMissing = isNew && (document.getElementById('dri-create')?.checked ?? true);

    const btn = document.getElementById('dri-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader ti-spin"></i>Zapisuję...'; }

    const result = await _saveDr(nr_rej, fields, r2Key, unarchive, createIfMissing);
    document.getElementById('dri-modal')?.remove();

    if (result) {
      window.toast?.(`✓ ${result.created ? 'Dodano nowy pojazd' : 'Zaktualizowano'}: ${nr_rej}`);
      if (typeof window.loadVehicles === 'function') window.loadVehicles();
      await _listFiles();
      _renderList();
    } else {
      window.toast?.('Błąd zapisu danych DR');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────
  function _findVeh(nrRej) {
    if (!nrRej) return null;
    const n = nrRej.toUpperCase().replace(/\s/g, '');
    return _vehs.find(v => (v.nr_rej || '').toUpperCase().replace(/\s/g, '') === n) || null;
  }

  async function _del(r2Key, name) {
    if (!confirm(`Usuń "${name}" z folderu DR?`)) return;
    await _deleteFile(r2Key);
    _files = _files.filter(f => f.key !== r2Key);
    _renderList();
    window.toast?.('Plik usunięty');
  }

  async function _refresh() {
    await _listFiles();
    _renderList();
  }

  function _sid(str) { return str.replace(/[^a-z0-9]/gi, '_'); }
  function _fmtSize(b) {
    if (!b) return '?';
    return b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  }

  return { load, _onFiles, _onDrop, _process, _batchAll, _save, _del, _refresh };
})();
