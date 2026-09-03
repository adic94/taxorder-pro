/**
 * TaxOrder Pro — Import polis OCR z R2
 * Przepływ: upload → lista plików → OCR (Tesseract) → AI parse → potwierdzenie → zapis do pojazdu
 */
window.TaxOrderPolicyOcr = (function () {

  const API = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const token = () => localStorage.getItem('cf_token');
  const hdrs = (extra = {}) => ({ Authorization: `Bearer ${token()}`, ...extra });
  const company = () => window.currentCompanyId || 'mtoilet';

  let _files = [];
  let _vehs = [];

  // ── API ─────────────────────────────────────────────────────────────────────
  async function _listFiles() {
    const r = await fetch(`${API()}/api/polisy-import?company=${company()}`, { headers: hdrs() });
    const d = r.ok ? await r.json() : {};
    _files = d.files || [];
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

  async function _uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${API()}/api/polisy-import?company=${company()}`, {
      method: 'POST',
      headers: hdrs(),
      body: fd,
    });
    return r.ok;
  }

  async function _deleteFile(r2Key) {
    await fetch(`${API()}/api/polisy-import?company=${company()}&key=${encodeURIComponent(r2Key)}`, {
      method: 'DELETE', headers: hdrs(),
    });
  }

  async function _parseWithAI(ocrText) {
    const r = await fetch(`${API()}/api/polisy-parse`, {
      method: 'POST',
      headers: { ...hdrs(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocrText }),
    });
    const d = r.ok ? await r.json() : {};
    return d.parsed || {};
  }

  async function _savePolisa(nr_rej, polisa, r2Key) {
    const r = await fetch(`${API()}/api/polisy-save?company=${company()}`, {
      method: 'POST',
      headers: { ...hdrs(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nr_rej, polisa, r2Key }),
    });
    return r.ok;
  }

  // ── Render główny ───────────────────────────────────────────────────────────
  async function load() {
    const el = document.getElementById('page-polisy-ocr');
    if (!el) return;
    el.innerHTML = `<div style="padding:20px 24px;max-width:1000px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <i class="ti ti-scan" style="font-size:24px;color:var(--blue)"></i>
        <h2 style="margin:0;font-size:20px">Import polis OCR</h2>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:20px">
        Wgraj skany lub zdjęcia polis (PDF/JPG/PNG) — system rozpozna tekst i automatycznie wypełni dane pojazdu.
      </div>
      <div id="pocr-upload-area" style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:32px;text-align:center;margin-bottom:24px;cursor:pointer;transition:border-color .15s"
        onclick="document.getElementById('pocr-file-input').click()"
        ondragover="event.preventDefault();this.style.borderColor='var(--blue)'"
        ondragleave="this.style.borderColor='var(--border)'"
        ondrop="event.preventDefault();this.style.borderColor='var(--border)';TaxOrderPolicyOcr._onDrop(event)">
        <i class="ti ti-upload" style="font-size:36px;color:var(--text3);display:block;margin-bottom:8px"></i>
        <div style="font-size:14px;color:var(--text2)">Kliknij lub przeciągnij pliki polis</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">PDF, JPG, PNG, WEBP · max 20 MB</div>
        <input type="file" id="pocr-file-input" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none"
          onchange="TaxOrderPolicyOcr._onFilesSelected(this.files)">
      </div>
      <div id="pocr-list-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <strong style="font-size:13px">Pliki oczekujące na przetworzenie</strong>
        <button class="btn btn-gray" style="font-size:11px" onclick="TaxOrderPolicyOcr._refresh()">
          <i class="ti ti-refresh"></i>Odśwież
        </button>
      </div>
      <div id="pocr-list"><div style="text-align:center;padding:40px;color:var(--text3)"><i class="ti ti-loader ti-spin" style="font-size:28px"></i></div></div>
    </div>`;

    await Promise.all([_listFiles(), _loadVehs()]);
    _renderList();
  }

  function _renderList() {
    const el = document.getElementById('pocr-list');
    if (!el) return;
    if (!_files.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3)">
        <i class="ti ti-file-off" style="font-size:36px;display:block;margin-bottom:8px"></i>
        Brak plików w folderze importu — wgraj skany polis powyżej
      </div>`;
      return;
    }
    el.innerHTML = _files.map(f => `
      <div id="pocr-file-${_safeId(f.key)}" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <i class="ti ${f.name.endsWith('.pdf') ? 'ti-file-type-pdf' : 'ti-file-type-jpg'}" style="font-size:24px;color:var(--blue);flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</div>
          <div style="font-size:11px;color:var(--text2)">${_formatSize(f.size)} · ${f.uploaded ? new Date(f.uploaded).toLocaleString('pl-PL') : ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-blue" style="font-size:11px" data-key="${esc(f.key)}" data-name="${esc(f.name)}" onclick="TaxOrderPolicyOcr._processFile(this.dataset.key,this.dataset.name)">
            <i class="ti ti-scan"></i>Przetwórz OCR
          </button>
          <button class="btn btn-gray" style="font-size:11px;color:var(--red)" data-key="${esc(f.key)}" data-name="${esc(f.name)}" onclick="TaxOrderPolicyOcr._confirmDelete(this.dataset.key,this.dataset.name)">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </div>`).join('');
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function _onFilesSelected(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const uploadArea = document.getElementById('pocr-upload-area');
    if (uploadArea) uploadArea.innerHTML = `<i class="ti ti-loader ti-spin" style="font-size:28px;color:var(--blue)"></i><div style="margin-top:8px;color:var(--text2)">Wysyłanie ${files.length} plik(ów)...</div>`;
    let ok = 0;
    for (const f of files) {
      const success = await _uploadFile(f);
      if (success) ok++;
    }
    window.toast?.(`✓ Wgrano ${ok} z ${files.length} pliku(ów)`);
    await _listFiles();
    // Restore upload area
    load();
  }

  function _onDrop(e) {
    const files = e.dataTransfer?.files;
    if (files?.length) _onFilesSelected(files);
  }

  // ── OCR + AI parse ───────────────────────────────────────────────────────────
  async function _processFile(r2Key, fileName) {
    const fileRowEl = document.getElementById(`pocr-file-${  _safeId(r2Key)}`);
    const btn = fileRowEl?.querySelector('.btn-blue');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader ti-spin"></i>OCR...'; }

    try {
      // 1. Pobierz plik z R2
      const r = await fetch(`${API()}/api/docs/file/${r2Key}`, { headers: hdrs() });
      if (!r.ok) throw new Error('Nie można pobrać pliku z R2');
      const blob = await r.blob();

      // 2. Konwertuj PDF na obraz jeśli potrzeba
      let imageBlob = blob;
      if (fileName.toLowerCase().endsWith('.pdf')) {
        imageBlob = await _pdfToImageBlob(blob);
        if (!imageBlob) throw new Error('Nie udało się skonwertować PDF na obraz');
      }

      // 3. OCR
      if (btn) btn.innerHTML = '<i class="ti ti-loader ti-spin"></i>Rozpoznawanie tekstu...';
      const ocrText = await _runOcr(imageBlob);
      if (!ocrText?.trim()) throw new Error('OCR nie zwrócił tekstu — sprawdź jakość skanu');

      // 4. AI parse
      if (btn) btn.innerHTML = '<i class="ti ti-loader ti-spin"></i>Analiza AI...';
      const parsed = await _parseWithAI(ocrText);

      // 5. Pokaż modal potwierdzenia
      _showConfirmModal(r2Key, fileName, ocrText, parsed);

    } catch (ex) {
      window.toast?.(`Błąd: ${  ex.message}`);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-scan"></i>Przetwórz OCR'; }
    }
  }

  async function _pdfToImageBlob(pdfBlob) {
    try {
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) return null;
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      return await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    } catch { return null; }
  }

  async function _runOcr(imageBlob) {
    const url = URL.createObjectURL(imageBlob);
    try {
      if (!window.Tesseract) throw new Error('Tesseract.js nie jest załadowany');
      const { data } = await Tesseract.recognize(url, 'pol', {
        logger: m => { if (m.status === 'recognizing text') { /* progress */ } },
      });
      return data.text || '';
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ── Modal potwierdzenia ──────────────────────────────────────────────────────
  function _showConfirmModal(r2Key, fileName, ocrText, parsed) {
    const typOpts = ['OC','AC','NNW','Assistance'].map(t =>
      `<option value="${t}" ${parsed.typ===t?'selected':''}>${t}</option>`).join('');
    const vehOpts = _vehs
      .filter(v => !v.is_active === false)
      .map(v => `<option value="${esc(v.nr_rej)}" ${parsed.nr_rej && v.nr_rej === parsed.nr_rej ? 'selected' : ''}>${esc(v.nr_rej)}${v.marka ? ` — ${  esc(v.marka)}` : ''}${v.model ? ` ${  esc(v.model)}` : ''}</option>`).join('');

    const pewnosc = parsed.pewnosc || 'niska';
    const pewnosColor = pewnosc==='wysoka' ? '#065f46' : pewnosc==='srednia' ? '#92400e' : '#7f1d1d';
    const pewnossBg  = pewnosc==='wysoka' ? '#d1fae5'  : pewnosc==='srednia' ? '#fef3c7'  : '#fee2e2';

    const html = `<div id="pocr-confirm-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:7000;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:640px;max-width:98vw;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <i class="ti ti-file-certificate" style="font-size:20px;color:var(--blue)"></i>
          <strong style="font-size:16px">Potwierdź dane polisy</strong>
          <button onclick="document.getElementById('pocr-confirm-modal').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:20px;color:var(--text2)">×</button>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:14px">${fileName}</div>

        <div style="display:inline-block;font-size:11px;background:${pewnossBg};color:${pewnosColor};padding:3px 10px;border-radius:99px;margin-bottom:14px">
          Pewność AI: ${pewnosc}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div>
            <label style="font-size:11px;color:var(--text2)">Typ polisy</label>
            <select id="pocr-typ" class="fi">${typOpts}</select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text2)">Pojazd (nr rej)</label>
            <select id="pocr-nrrej" class="fi">${vehOpts}</select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text2)">Nr polisy</label>
            <input id="pocr-nr-polisy" class="fi" value="${esc(parsed.nr_polisy||'')}">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text2)">Ubezpieczyciel</label>
            <input id="pocr-firma" class="fi" value="${esc(parsed.firma||'')}">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text2)">Data od</label>
            <input id="pocr-data-od" type="date" class="fi" value="${parsed.data_od||''}">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text2)">Data do</label>
            <input id="pocr-data-do" type="date" class="fi" value="${parsed.data_do||''}">
          </div>
          <div>
            <label style="font-size:11px;color:var(--text2)">Składka (zł)</label>
            <input id="pocr-skladka" type="number" class="fi" value="${parsed.skladka||''}">
          </div>
        </div>

        <details style="margin-bottom:16px">
          <summary style="font-size:11px;color:var(--text2);cursor:pointer">Pokaż surowy tekst OCR</summary>
          <pre style="font-size:10px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:10px;max-height:180px;overflow-y:auto;white-space:pre-wrap;margin-top:6px">${ocrText.slice(0,3000)}</pre>
        </details>

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="document.getElementById('pocr-confirm-modal').remove()">Anuluj</button>
          <button class="btn btn-blue" id="pocr-save-btn" onclick="TaxOrderPolicyOcr._saveFromModal('${r2Key}')">
            <i class="ti ti-check"></i>Zapisz i archiwizuj starą polisę
          </button>
        </div>
      </div>
    </div>`;
    document.getElementById('pocr-confirm-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  async function _saveFromModal(r2Key) {
    const nr_rej = document.getElementById('pocr-nrrej')?.value;
    if (!nr_rej) { window.toast?.('Wybierz pojazd'); return; }
    const polisa = {
      typ:       document.getElementById('pocr-typ')?.value || 'OC',
      nr_polisy: document.getElementById('pocr-nr-polisy')?.value?.trim() || null,
      firma:     document.getElementById('pocr-firma')?.value?.trim() || null,
      data_od:   document.getElementById('pocr-data-od')?.value || null,
      data_do:   document.getElementById('pocr-data-do')?.value || null,
      skladka:   parseFloat(document.getElementById('pocr-skladka')?.value) || null,
    };

    const btn = document.getElementById('pocr-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader ti-spin"></i>Zapisuję...'; }

    const ok = await _savePolisa(nr_rej, polisa, r2Key);
    document.getElementById('pocr-confirm-modal')?.remove();
    if (ok) {
      window.toast?.(`✓ Polisa ${polisa.typ} zapisana dla ${nr_rej} — stara polisa zarchiwizowana`);
      await _listFiles();
      _renderList();
    } else {
      window.toast?.('Błąd zapisu polisy');
    }
  }

  // ── Usuwanie ──────────────────────────────────────────────────────────────────
  function _confirmDelete(r2Key, fileName) {
    if (!confirm(`Usuń plik "${fileName}" z folderu importu?`)) return;
    _deleteFile(r2Key).then(() => {
      _files = _files.filter(f => f.key !== r2Key);
      _renderList();
      window.toast?.('Plik usunięty');
    });
  }

  async function _refresh() {
    await _listFiles();
    _renderList();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function _safeId(str) { return str.replace(/[^a-z0-9]/gi, '_'); }
  function _formatSize(bytes) {
    if (!bytes) return '?';
    if (bytes < 1024) return `${bytes  } B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)  } KB`;
    return `${(bytes / 1048576).toFixed(1)  } MB`;
  }

  return { load, _onFilesSelected, _onDrop, _processFile, _saveFromModal, _confirmDelete, _refresh };
})();
