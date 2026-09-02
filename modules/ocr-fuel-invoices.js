/*
 * SCHEMA_NEEDED: no new tables needed — uses existing fuel_records and vehicles.
 *
 * ENDPOINT_NEEDED: POST /api/ocr-fuel
 * Handler (in worker/index.js):
 *   Receives: { image_base64: string, mime_type: string, company: string }
 *   Returns:  { extracted: { date, plate, station, fuel_type, liters, price_per_liter, total_pln } }
 *             | { error: string }
 *
 *   Algorithm:
 *   1. Validate session (Authorization header).
 *   2. Call Claude claude-haiku-4-5-20251001 with vision:
 *        messages: [{ role:'user', content:[
 *          { type:'image', source:{ type:'base64', media_type, data: image_base64 } },
 *          { type:'text',  text: 'Extract fuel receipt data as JSON only — no markdown:
 *            { "date":"YYYY-MM-DD","plate":"AA 12345","station":"...","fuel_type":"diesel|pb95|pb98|lpg|ev",
 *              "liters":0.0,"price_per_liter":0.000,"total_pln":0.00 }
 *            If a field is not found set it to null.' }
 *        ]}]
 *   3. Parse the JSON from Claude response.
 *   4. Return { extracted: { ... } } or { error: '...' }.
 */

window.OcrFuelInvoices = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                             */
  /* ------------------------------------------------------------------ */
  const _api  = () => window._cfApi?.()  || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const _hdrs = (extra) => window._cfHdrs ? window._cfHdrs(extra) : { 'Content-Type': 'application/json', ...extra };
  const _co   = () => window._cfCo?.()   || window.currentCompanyId || '';

  /* ------------------------------------------------------------------ */
  /*  Module state                                                        */
  /* ------------------------------------------------------------------ */
  let _extracted    = null;
  let _imageBase64  = null;
  let _vehicles     = [];

  /* ------------------------------------------------------------------ */
  /*  CSS injection (runs once)                                           */
  /* ------------------------------------------------------------------ */
  (function _injectStyles() {
    if (document.getElementById('ocr-fuel-styles')) return;
    const s = document.createElement('style');
    s.id = 'ocr-fuel-styles';
    s.textContent = `
      .ocr-wrap {
        max-width: 640px;
        margin: 0 auto;
      }
      .ocr-wrap h2 { margin-bottom: 6px; }
      .ocr-desc {
        color: var(--text-muted, #6b7280);
        font-size: 0.88rem;
        margin-bottom: 18px;
      }
      .ocr-upload-area {
        border: 2px dashed var(--border-color, #d1d5db);
        border-radius: 12px;
        padding: 32px 20px;
        text-align: center;
        background: var(--card-bg, #f9fafb);
        margin-bottom: 20px;
        transition: border-color 0.2s;
      }
      .ocr-upload-area.drag-over {
        border-color: var(--accent, #2563eb);
        background: var(--accent-light, #eff6ff);
      }
      .ocr-upload-area i {
        font-size: 2.5rem;
        color: var(--text-muted, #6b7280);
        display: block;
        margin-bottom: 8px;
      }
      .ocr-upload-area p {
        color: var(--text-muted, #6b7280);
        font-size: 0.88rem;
        margin: 0 0 12px 0;
      }
      .ocr-upload-area .btn-outline {
        cursor: pointer;
        margin: 0 4px;
      }
      .ocr-thumbnail {
        max-width: 100%;
        max-height: 260px;
        border-radius: 8px;
        border: 1px solid var(--border-color, #e5e7eb);
        display: block;
        margin: 0 auto 16px auto;
        object-fit: contain;
      }
      .ocr-form h3 {
        margin: 0 0 14px 0;
        font-size: 1rem;
        color: var(--text-color, #111827);
      }
      .ocr-form .form-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 12px;
      }
      .ocr-form .form-row label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-muted, #6b7280);
      }
      .ocr-form .form-row small {
        font-size: 0.75rem;
        color: var(--text-muted, #6b7280);
      }
      .ocr-actions {
        display: flex;
        gap: 8px;
        margin-top: 20px;
        flex-wrap: wrap;
      }
      .ocr-form input,
      .ocr-form select {
        width: 100%;
        box-sizing: border-box;
      }
      .error { color: var(--danger, #ef4444); }
    `;
    document.head.appendChild(s);
  })();

  /* ------------------------------------------------------------------ */
  /*  Render                                                              */
  /* ------------------------------------------------------------------ */
  function renderPage() {
    const page = document.getElementById('page-ocr-fuel');
    if (!page) return;
    _extracted   = null;
    _imageBase64 = null;
    _loadVehicles();
    page.innerHTML = `
      <div class="ocr-wrap">
        <h2><i class="ti ti-scan"></i> OCR Faktury Paliw</h2>
        <p class="ocr-desc">Wgraj zdjęcie lub PDF paragonu/faktury paliw — AI wyekstrahuje dane i zapisze do ewidencji.</p>
        <div class="ocr-upload-area" id="ocr-drop-area">
          <i class="ti ti-cloud-upload"></i>
          <p>Przeciągnij plik lub wybierz z dysku / aparatu</p>
          <label class="btn btn-outline">
            <input type="file" id="ocrfuel-file" accept="image/*,application/pdf"
              onchange="OcrFuelInvoices.handleFile(this.files[0])" style="display:none">
            <i class="ti ti-folder-open"></i> Wybierz plik
          </label>
          <label class="btn btn-outline">
            <input type="file" id="ocrfuel-camera" accept="image/*" capture="environment"
              onchange="OcrFuelInvoices.handleFile(this.files[0])" style="display:none">
            <i class="ti ti-camera"></i> Kamera
          </label>
        </div>
        <div id="ocrfuel-preview" style="display:none"></div>
        <div id="ocrfuel-result"  style="display:none"></div>
      </div>`;

    // Drag-and-drop wiring
    const drop = document.getElementById('ocr-drop-area');
    if (drop) {
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag-over'); });
      drop.addEventListener('dragleave', ()  => { drop.classList.remove('drag-over'); });
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        const f = e.dataTransfer?.files?.[0];
        if (f) OcrFuelInvoices.handleFile(f);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  File handling                                                       */
  /* ------------------------------------------------------------------ */
  async function handleFile(file) {
    if (!file) return;
    const preview = document.getElementById('ocrfuel-preview');
    const result  = document.getElementById('ocrfuel-result');
    if (!preview || !result) return;

    preview.style.display = 'block';
    preview.innerHTML = '<div class="spinner"></div> Wczytywanie pliku...';
    result.style.display = 'none';

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      // Strip data URL prefix to get raw base64
      _imageBase64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/jpeg';

      if (file.type.startsWith('image/')) {
        preview.innerHTML = `<img src="${dataUrl}" class="ocr-thumbnail" alt="Podgląd faktury">`;
      } else {
        preview.innerHTML = `<p><i class="ti ti-file-type-pdf"></i> ${esc(file.name)}</p>`;
      }

      await _extractWithAI(_imageBase64, mimeType);
    };
    reader.readAsDataURL(file);
  }

  async function _extractWithAI(base64, mimeType) {
    const result = document.getElementById('ocrfuel-result');
    if (!result) return;
    result.style.display = 'block';
    result.innerHTML = '<div class="spinner"></div> AI analizuje fakturę...';

    try {
      const resp = await fetch(`${_api()}/api/ocr-fuel`, {
        method:  'POST',
        headers: _hdrs(),
        body:    JSON.stringify({
          image_base64: base64,
          mime_type:    mimeType,
          company:      _co(),
        }),
      });
      const data = await resp.json();
      if (data.extracted) {
        _extracted = data.extracted;
        _renderForm(data.extracted);
      } else {
        result.innerHTML = `<p class="error">Nie udało się wyekstrahować danych: ${esc(data.error || 'Nieznany błąd')}</p>`;
      }
    } catch {
      result.innerHTML = '<p class="error">Błąd połączenia z AI.</p>';
    }
  }

  function _renderForm(d) {
    const result = document.getElementById('ocrfuel-result');
    if (!result) return;

    const vehicleOptions = _vehicles.map(v =>
      `<option value="${esc(String(v.id ?? ''))}" data-reg="${esc(v.nr_rej || '')}">${esc(v.nr_rej || '')} — ${esc(v.marka || '')} ${esc(v.model || '')}</option>`
    ).join('');

    result.innerHTML = `
      <div class="ocr-form">
        <h3><i class="ti ti-check"></i> Wyekstrahowane dane</h3>
        <div class="form-row">
          <label>Data</label>
          <input type="date" id="ocr-data" class="form-control" value="${esc(d.date || '')}">
        </div>
        <div class="form-row">
          <label>Pojazd</label>
          <select id="ocr-vehicle" class="form-control">
            <option value="">-- wybierz pojazd --</option>
            ${vehicleOptions}
          </select>
          <small>AI rozpoznał tablicę: <b>${esc(d.plate || 'nie znaleziono')}</b></small>
        </div>
        <div class="form-row">
          <label>Stacja</label>
          <input type="text" id="ocr-station" class="form-control" value="${esc(d.station || '')}">
        </div>
        <div class="form-row">
          <label>Typ paliwa</label>
          <select id="ocr-fuel-type" class="form-control">
            <option value="diesel"   ${d.fuel_type === 'diesel'  ? 'selected' : ''}>Diesel</option>
            <option value="pb95"     ${d.fuel_type === 'pb95'    ? 'selected' : ''}>PB 95</option>
            <option value="pb98"     ${d.fuel_type === 'pb98'    ? 'selected' : ''}>PB 98</option>
            <option value="lpg"      ${d.fuel_type === 'lpg'     ? 'selected' : ''}>LPG</option>
            <option value="elektryk" ${d.fuel_type === 'ev'      ? 'selected' : ''}>Elektryczny (kWh)</option>
          </select>
        </div>
        <div class="form-row">
          <label>Litry / kWh</label>
          <input type="number" id="ocr-liters" class="form-control" step="0.01" value="${d.liters ?? ''}">
        </div>
        <div class="form-row">
          <label>Cena / L (PLN)</label>
          <input type="number" id="ocr-price" class="form-control" step="0.001" value="${d.price_per_liter ?? ''}">
        </div>
        <div class="form-row">
          <label>Suma PLN</label>
          <input type="number" id="ocr-total" class="form-control" step="0.01" value="${d.total_pln ?? ''}">
        </div>
        <div class="ocr-actions">
          <button class="btn btn-primary" onclick="OcrFuelInvoices.save()">
            <i class="ti ti-device-floppy"></i> Zapisz do ewidencji paliwa
          </button>
          <button class="btn btn-outline" onclick="OcrFuelInvoices.renderPage()">Anuluj</button>
        </div>
      </div>`;

    // Auto-select vehicle when the recognised plate matches one in the list
    if (d.plate) {
      const normalised = d.plate.replace(/\s/g, '').toLowerCase();
      const sel = document.getElementById('ocr-vehicle');
      if (sel) {
        for (const opt of sel.options) {
          if (opt.dataset.reg && opt.dataset.reg.replace(/\s/g, '').toLowerCase() === normalised) {
            opt.selected = true;
            break;
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Save                                                                */
  /* ------------------------------------------------------------------ */
  async function save() {
    const vehicle_id  = document.getElementById('ocr-vehicle')?.value;
    const data_tanko  = document.getElementById('ocr-data')?.value;
    const litery      = parseFloat(document.getElementById('ocr-liters')?.value)  || 0;
    const cena_brutto = parseFloat(document.getElementById('ocr-total')?.value)   || 0;
    const stacja      = document.getElementById('ocr-station')?.value?.trim() ?? '';
    const rodzaj      = document.getElementById('ocr-fuel-type')?.value ?? 'diesel';

    if (!vehicle_id)  { typeof toast === 'function' && toast('Wybierz pojazd'); return; }
    if (!litery)      { typeof toast === 'function' && toast('Wpisz ilość litrów'); return; }

    try {
      const resp = await fetch(`${_api()}/api/fuel-records`, {
        method:  'POST',
        headers: _hdrs(),
        body:    JSON.stringify({
          vehicle_id,
          data_tanko,
          litery,
          cena_brutto,
          stacja,
          rodzaj,
          company: _co(),
          zrodlo:  'ocr',
        }),
      });
      if (resp.ok) {
        typeof toast === 'function' && toast('Zapisano do ewidencji paliwa');
        renderPage();
      } else {
        const err = await resp.json().catch(() => ({}));
        typeof toast === 'function' && toast(`Błąd zapisu: ${esc(err.error || String(resp.status))}`);
      }
    } catch {
      typeof toast === 'function' && toast('Błąd połączenia');
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Vehicle list loader                                                 */
  /* ------------------------------------------------------------------ */
  async function _loadVehicles() {
    try {
      const resp = await fetch(
        `${_api()}/api/vehicles?company=${encodeURIComponent(_co())}`,
        { headers: _hdrs() }
      );
      const data = await resp.json();
      _vehicles = data.vehicles || (Array.isArray(data) ? data : []);
    } catch {
      _vehicles = [];
    }
  }

  return { renderPage, handleFile, save };
})();
