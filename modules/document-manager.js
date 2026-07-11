/**
 * DocumentsModule — smart zarządzanie dokumentami per pojazd/VIN
 * Auto-klasyfikacja (OC, AC, przegląd…) + detekcja VIN z PDF/pliku
 */
(function () {
  'use strict';

  const API = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const tok = () => localStorage.getItem('cf_token') || '';
  const company = () => localStorage.getItem('cf_company') || 'mtoilet';

  // ─── Typy dokumentów ──────────────────────────────────────────────────────
  const DOC_TYPES = {
    oc:        { label: 'Polisa OC',            icon: 'ti-shield-check',    color: '#2563eb', bg: '#eff6ff' },
    ac:        { label: 'Polisa AC',            icon: 'ti-shield',          color: '#7c3aed', bg: '#f5f3ff' },
    przeglad:  { label: 'Przegląd techniczny',  icon: 'ti-tool',            color: '#059669', bg: '#f0fdf4' },
    leasing:   { label: 'Umowa leasingu',       icon: 'ti-building-bank',   color: '#0891b2', bg: '#ecfeff' },
    dowod_rej: { label: 'Dowód rejestracyjny',  icon: 'ti-id',              color: '#d97706', bg: '#fffbeb' },
    faktura:   { label: 'Faktura',              icon: 'ti-receipt',         color: '#dc2626', bg: '#fef2f2' },
    serwis:    { label: 'Faktura serwisowa',    icon: 'ti-settings',        color: '#64748b', bg: '#f8fafc' },
    ubezp:     { label: 'Ubezpieczenie',        icon: 'ti-shield-half',     color: '#6d28d9', bg: '#faf5ff' },
    mandat:    { label: 'Mandat',               icon: 'ti-alert-triangle',  color: '#b45309', bg: '#fef3c7' },
    inne:      { label: 'Inne',                 icon: 'ti-file',            color: '#94a3b8', bg: '#f8fafc' },
  };

  // Reguły klasyfikacji (te same co w Workerze — redundancja celowa dla offline UX)
  const DOC_TYPE_RULES = [
    { type: 'oc',        re: [/\boc\b/i, /odpowiedzia.*cywil/i, /ubezp.*komun/i, /polisa.*oc/i, /oc[-_]polisa/i] },
    { type: 'ac',        re: [/\bac\b/i, /autocasco/i, /ubezp.*\bac\b/i, /ac[-_\s]polisa/i, /\bkasko\b/i] },
    { type: 'przeglad',  re: [/badanie[\s_-]?tech/i, /stacja[\s_-]?kontrol/i, /przegl[aą]d[\s_-]?tech/i, /\bskt\b/i] },
    { type: 'leasing',   re: [/leasing/i, /umowa[\s_-]?leas/i, /leasodawca/i] },
    { type: 'dowod_rej', re: [/dow[oó]d[\s_-]?rej/i, /rejestracyjny/i, /\bcrd\b/i] },
    { type: 'faktura',   re: [/\bfaktura\b/i, /\bfvat\b/i, /\binvoice\b/i, /\brachun/i] },
    { type: 'serwis',    re: [/\bserwis\b/i, /\bnaprawa\b/i, /\bwarsztat\b/i, /zlecenie[\s_-]?serwis/i] },
    { type: 'ubezp',     re: [/\bubezpiecz/i, /\bpolisa\b/i] },
    { type: 'mandat',    re: [/\bmandat\b/i, /wykroczen/i] },
  ];

  function classifyDoc(filename, text = '') {
    const src = (filename + ' ' + text).toLowerCase();
    for (const { type, re } of DOC_TYPE_RULES) {
      if (re.some(r => r.test(src))) return type;
    }
    return 'inne';
  }

  function extractVin(text) {
    const matches = text.match(/[A-HJ-NPR-Z0-9]{17}/g) || [];
    return matches.find(v => new Set(v).size > 4) || null;
  }

  // ─── Ekstrakcja daty ważności z treści dokumentu ──────────────────────────
  // Obsługiwane wzorce: polisy OC/AC, przeglądy techniczne
  const _EXPIRY_PATTERNS = [
    /wa[żz]n[ay]\s*do\s*[:\s]\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4})/i,
    /termin\s+wa[żz]no[śs]ci\s*[:\s]\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4})/i,
    /data\s+zako[ńn]czenia\s*[:\s]\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4})/i,
    /koniec\s+okresu\s*[:\s]\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4})/i,
    /do\s+dnia\s*[:\s]\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4})/i,
    /okres\s+ubezp[a-z]*\s*[:\s].*?[-–]\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4})/i,
    /ubezpiecz[a-z]*\s+do\s*[:\s]\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4})/i,
    /\bdo\b\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4})/i,
  ];

  function _parsePLDate(str) {
    if (!str) return null;
    const parts = str.split(/[.\-\/]/);
    if (parts.length !== 3) return null;
    let [a, b, c] = parts.map(Number);
    // DD.MM.YYYY
    if (c >= 2020 && c <= 2040 && a <= 31 && b <= 12) {
      return `${c}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
    }
    // YYYY.MM.DD
    if (a >= 2020 && a <= 2040 && b <= 12 && c <= 31) {
      return `${a}-${String(b).padStart(2,'0')}-${String(c).padStart(2,'0')}`;
    }
    return null;
  }

  function extractExpiryDate(text) {
    for (const pat of _EXPIRY_PATTERNS) {
      const m = text.match(pat);
      if (m) {
        const d = _parsePLDate(m[1]);
        if (d) return d;
      }
    }
    // Fallback: wszystkie daty DD.MM.YYYY → najdalsza przyszła
    const allMatches = [...text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)];
    const futureDates = allMatches
      .map(m => _parsePLDate(`${m[1]}.${m[2]}.${m[3]}`))
      .filter(Boolean)
      .filter(d => d > new Date().toISOString().slice(0, 10))
      .sort();
    return futureDates[futureDates.length - 1] || null; // najdalszy termin
  }

  // ─── Ekstrakcja numeru polisy / dokumentu ─────────────────────────────────
  function extractDocNumber(text) {
    const patterns = [
      /(?:numer|nr|no\.?)\s+polisy\s*[:\s]+([A-Z0-9\/\-]{5,30})/i,
      /polisa\s+(?:nr|numer)\s*[:\s]+([A-Z0-9\/\-]{5,30})/i,
      /(?:seria\s+i\s+numer|nr\s+dokumentu)\s*[:\s]+([A-Z0-9\/\-]{5,30})/i,
      /nr\s+badania\s*[:\s]+([A-Z0-9\/\-]{5,30})/i,
      /numer\s+zlecenia\s*[:\s]+([A-Z0-9\/\-]{5,30})/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) return m[1].trim();
    }
    return null;
  }

  // ─── Auto-fill daty do pojazdu — pola wg typu dokumentu ──────────────────
  const _VEHICLE_FIELD_MAP = {
    oc:       { field: 'ocEnd',            label: 'OC — data końca' },
    ac:       { field: 'acEnd',            label: 'AC — data końca' },
    przeglad: { field: 'nextInspection',   label: 'Przegląd — termin' },
    leasing:  { field: 'leasingEnd',       label: 'Leasing — koniec' },
  };

  async function applyExpiryToVehicle(vehicleId, docType, expiryDate) {
    const fieldMap = _VEHICLE_FIELD_MAP[docType];
    if (!fieldMap || !expiryDate) return false;
    const v = (window.vehs || []).find(x => String(x.id) === String(vehicleId));
    if (!v) return false;
    v[fieldMap.field] = expiryDate;
    try {
      const res = await window.FleetCloud?.saveVehicle(v);
      if (res?.ok) {
        window.toast?.(`✓ Zaktualizowano "${fieldMap.label}" → ${expiryDate}`);
        return true;
      }
    } catch {}
    window.toast?.('Błąd zapisu do pojazdu', 'error');
    return false;
  }

  // ─── OCR faktury → propozycja wpisu serwisowego ──────────────────────────
  function extractInvoiceData(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    // Kwota brutto — różne wzorce polskich faktur
    let amount = null;
    const amtPatterns = [
      /(?:do zap.aty|razem|total|brutto)[:\s]*(\d[\d\s]*[,.]?\d{2})/i,
      /(\d{1,6}[,\s]\d{2})\s*z.?\b/,
      /\b(\d{1,6})\s*,\s*(\d{2})\s*(?:PLN|zł|zl)\b/i,
    ];
    for (const p of amtPatterns) {
      const m = text.match(p);
      if (m) {
        const raw = (m[1] + (m[2] ? '.' + m[2] : '')).replace(/\s/g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 10 && val < 500000) { amount = val; break; }
      }
    }
    // Data dokumentu (pierwsza znaleziona data w formacie DD.MM.YYYY lub YYYY-MM-DD)
    let date = null;
    const dm = text.match(/(\d{4}-\d{2}-\d{2})|(\d{2}[./]\d{2}[./]\d{4})/);
    if (dm) {
      const raw = dm[0];
      if (raw.includes('-')) date = raw;
      else {
        const parts = raw.split(/[./]/);
        if (parts.length === 3) date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
    }
    // Nazwa kontrahenta / warsztatu
    let workshop = null;
    const wm = text.match(/(?:sprzedawca|wystawca|firma|us.ugodawca)[:\s]+([A-Z][^\n]{3,60})/i);
    if (wm) workshop = wm[1].trim().slice(0, 80);
    // NIP
    let nip = null;
    const nm = text.match(/NIP[:\s]*(\d{3}[- ]?\d{3}[- ]?\d{2}[- ]?\d{2}|\d{10})/i);
    if (nm) nip = nm[1].replace(/[- ]/g, '');
    // Nr faktury
    let invoiceNo = null;
    const im = text.match(/(?:faktura|nr faktury|invoice)[:\s]*([A-Z0-9\/_-]{4,25})/i);
    if (im) invoiceNo = im[1].trim();
    if (!amount && !date) return null;
    return { amount, date: date || new Date().toISOString().slice(0, 10), workshop, nip, invoiceNo };
  }

  async function _createServiceEntryFromInvoice(vehicleId, invoiceData, docType) {
    const v = (window.vehs || []).find(x => String(x.id) === String(vehicleId));
    if (!v || !invoiceData) return;
    const type = docType === 'faktura' ? 'naprawa' : docType === 'serwis' ? 'serwis' : 'inne';
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      date: invoiceData.date,
      type,
      km: null,
      cost: invoiceData.amount,
      costNet: invoiceData.amount ? parseFloat((invoiceData.amount / 1.23).toFixed(2)) : null,
      currency: 'PLN',
      vatRate: 23,
      workshop: invoiceData.workshop || '',
      workshopNip: invoiceData.nip || '',
      invoiceNo: invoiceData.invoiceNo || '',
      parts: '',
      notes: 'Auto-import z OCR faktury',
      createdAt: new Date().toISOString(),
    };
    if (!v.serviceHistory) v.serviceHistory = [];
    v.serviceHistory.push(entry);
    try {
      const res = await window.FleetCloud?.saveVehicle(v);
      if (res?.ok) {
        window.toast?.(`✓ Dodano wpis serwisowy z faktury (${(invoiceData.amount || 0).toFixed(2)} zł)`);
        return true;
      }
    } catch {}
    window.toast?.('Błąd zapisu wpisu serwisowego', 'error');
    return false;
  }

  // ─── Ekstrakcja tekstu z PDF (pdf.js jest ładowany w index.html) ──────────
  async function extractPdfText(file) {
    if (!window.pdfjsLib) return '';
    try {
      const buf  = await file.arrayBuffer();
      const pdf  = await pdfjsLib.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const content = await page.getTextContent();
      return content.items.map(i => i.str).join(' ').slice(0, 2000);
    } catch { return ''; }
  }

  // Miniaturowa ekstrakcja z JPG/PNG przez Tesseract (wolniejsza, tylko do detekcji VIN)
  async function extractImageText(file) {
    if (!window.Tesseract) return '';
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'pol+eng', {
        logger: () => {},
      });
      return (text || '').slice(0, 2000);
    } catch { return ''; }
  }

  async function extractTextFromFile(file) {
    if (!file) return '';
    const mime = file.type || '';
    if (mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return extractPdfText(file);
    }
    if (mime.startsWith('image/')) {
      return extractImageText(file);
    }
    return '';
  }

  // ─── API calls ────────────────────────────────────────────────────────────
  async function fetchDocs(params) {
    const q = new URLSearchParams({ company: company(), ...params });
    const r = await fetch(`${API()}/api/docs?${q}`, {
      headers: { Authorization: `Bearer ${tok()}` },
    });
    if (!r.ok) return [];
    return r.json();
  }

  async function uploadDoc(file, meta) {
    const fd = new FormData();
    fd.append('file', file);
    if (meta.nrRej)       fd.append('nrRej',       meta.nrRej);
    if (meta.vin)         fd.append('vin',          meta.vin);
    if (meta.vehicle_id)  fd.append('vehicle_id',   String(meta.vehicle_id));
    if (meta.doc_type)    fd.append('doc_type',     meta.doc_type);
    if (meta.textHint)    fd.append('textHint',     meta.textHint.slice(0, 2000));
    if (meta.notes)       fd.append('notes',        meta.notes);
    if (meta.expiry_date) fd.append('expiry_date',  meta.expiry_date);
    if (meta.doc_number)  fd.append('doc_number',   meta.doc_number);
    fd.append('company', company());

    const r = await fetch(`${API()}/api/docs/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok()}` },
      body: fd,
    });
    return r.json();
  }

  async function deleteDocById(id) {
    await fetch(`${API()}/api/docs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok()}` },
    });
  }

  async function patchDoc(id, data) {
    await fetch(`${API()}/api/docs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  // ─── Helpers renderowania ─────────────────────────────────────────────────
  function fileUrl(r2Key) {
    return `${API()}/api/docs/file/${r2Key}`;
  }

  function typeChip(type) {
    const t = DOC_TYPES[type] || DOC_TYPES.inne;
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:2px 8px;border-radius:99px;background:${t.bg};color:${t.color};border:1px solid ${t.color}33">
      <i class="ti ${t.icon}" style="font-size:10px"></i>${esc(t.label)}
    </span>`;
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function formatDate(dt) {
    if (!dt) return '';
    return dt.slice(0, 16).replace('T', ' ');
  }

  function iconForMime(mime) {
    if (!mime) return 'ti-file';
    if (mime === 'application/pdf') return 'ti-file-type-pdf';
    if (mime.startsWith('image/'))  return 'ti-photo';
    if (mime.includes('word'))      return 'ti-file-type-docx';
    if (mime.includes('sheet') || mime.includes('excel')) return 'ti-file-type-xls';
    return 'ti-file';
  }

  // ─── Render per pojazd (wywoływane z vehicle-detail) ──────────────────────
  function renderForVehicle(v) {
    return `<div id="dm-vehicle-docs-${esc(String(v.id))}" style="min-height:80px">
      <div style="display:flex;align-items:center;justify-content:center;padding:24px;color:var(--text3)">
        <i class="ti ti-loader-2" style="font-size:20px;animation:spin 1s linear infinite"></i>
      </div>
    </div>`;
  }

  async function loadForVehicle(v) {
    const containerId = `dm-vehicle-docs-${v.id}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    const docs = await fetchDocs(v.vin ? { vin: v.vin } : { nrRej: v.nrRej });
    container.innerHTML = _renderVehicleDocsHtml(v, docs);
    _attachDropZone(container, v);
  }

  function _renderVehicleDocsHtml(v, docs) {
    const grouped = {};
    for (const d of docs) {
      const t = d.doc_type || 'inne';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(d);
    }

    const vinLine = v.vin
      ? `<span style="font-size:10px;color:var(--text3);font-family:monospace">VIN: ${esc(v.vin)}</span>`
      : '';

    const uploadBtn = `
      <button class="btn btn-blue" style="font-size:12px"
        onclick="DocumentsModule._openUpload(${v.id})">
        <i class="ti ti-upload"></i>Dodaj dokument
      </button>`;

    if (!docs.length) {
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase">Dokumenty pojazdu</div>
            ${vinLine}
          </div>
          ${uploadBtn}
        </div>
        <div id="dm-drop-zone-${v.id}" style="border:2px dashed var(--border);border-radius:var(--radius);padding:32px;text-align:center;color:var(--text3);transition:background .15s">
          <i class="ti ti-file-upload" style="font-size:36px;display:block;margin-bottom:10px;opacity:.4"></i>
          <div style="font-size:13px;font-weight:500">Przeciągnij plik tutaj lub kliknij "Dodaj dokument"</div>
          <div style="font-size:11px;margin-top:4px">PDF, JPG, PNG, DOCX — auto-klasyfikacja i detekcja VIN</div>
        </div>`;
    }

    const today = new Date().toISOString().slice(0, 10);
    const rows = docs.map(d => {
      const expiry = d.expiry_date || '';
      const expiryColor = !expiry ? '' :
        expiry < today                              ? '#dc2626' :
        expiry <= new Date(Date.now() + 30*864e5).toISOString().slice(0,10) ? '#b45309' :
        '#059669';
      const expiryBg = !expiry ? '' :
        expiry < today ? '#fef2f2' :
        expiry <= new Date(Date.now() + 30*864e5).toISOString().slice(0,10) ? '#fffbeb' : '#f0fdf4';
      const expiryIcon = !expiry ? '' :
        expiry < today ? 'ti-alert-circle' :
        expiry <= new Date(Date.now() + 30*864e5).toISOString().slice(0,10) ? 'ti-clock' : 'ti-calendar-check';

      return `
      <tr>
        <td style="padding:6px 8px">
          <i class="ti ${iconForMime(d.mime_type)}" style="font-size:16px;color:var(--text3)"></i>
        </td>
        <td style="padding:6px 8px;max-width:180px">
          <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.name)}">${esc(d.name)}</div>
          <div style="font-size:10px;color:var(--text3)">${formatDate(d.uploaded_at)}${d.file_size ? ' · ' + formatSize(d.file_size) : ''}${d.doc_number ? ' · ' + esc(d.doc_number) : ''}</div>
        </td>
        <td style="padding:6px 8px">${typeChip(d.doc_type || 'inne')}</td>
        <td style="padding:6px 8px;white-space:nowrap">
          ${expiry
            ? `<span style="font-size:10px;padding:2px 7px;border-radius:99px;background:${expiryBg};color:${expiryColor};border:1px solid ${expiryColor}44;display:inline-flex;align-items:center;gap:3px">
                <i class="ti ${expiryIcon}" style="font-size:9px"></i>${expiry}
              </span>`
            : '<span style="font-size:10px;color:var(--text3)">—</span>'
          }
        </td>
        <td style="padding:6px 8px;white-space:nowrap">
          <a href="${fileUrl(d.r2_key)}" target="_blank" rel="noopener"
             style="font-size:11px;color:var(--blue);text-decoration:none;margin-right:6px"
             title="Otwórz / pobierz"><i class="ti ti-download"></i></a>
          <button onclick="DocumentsModule._changeType('${esc(d.id)}','${esc(d.doc_type||'inne')}',${v.id})"
            style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:11px;padding:0 4px" title="Zmień typ">
            <i class="ti ti-edit"></i>
          </button>
          <button onclick="DocumentsModule._del('${esc(d.id)}',${v.id})"
            style="background:none;border:none;cursor:pointer;color:var(--red);font-size:11px;padding:0 4px" title="Usuń">
            <i class="ti ti-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase">Dokumenty pojazdu</div>
          ${vinLine}
          <span style="font-size:11px;color:var(--text3)">(${docs.length})</span>
        </div>
        ${uploadBtn}
      </div>
      <div id="dm-drop-zone-${v.id}" style="border:2px dashed transparent;border-radius:var(--radius);transition:background .15s;min-height:4px"></div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="padding:4px 8px;font-size:10px;font-weight:600;color:var(--text3);text-align:left;width:28px"></th>
              <th style="padding:4px 8px;font-size:10px;font-weight:600;color:var(--text3);text-align:left">Nazwa pliku</th>
              <th style="padding:4px 8px;font-size:10px;font-weight:600;color:var(--text3);text-align:left">Typ</th>
              <th style="padding:4px 8px;font-size:10px;font-weight:600;color:var(--text3);text-align:left">Ważny do</th>
              <th style="padding:4px 8px;font-size:10px;font-weight:600;color:var(--text3);text-align:left">Akcje</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Drag & drop na zakładce dokumenty
  function _attachDropZone(container, v) {
    const zone = container.querySelector(`[id^="dm-drop-zone-"]`);
    if (!zone) return;
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.style.background = 'var(--blue-light,#eff6ff)';
      zone.style.borderColor = 'var(--blue)';
    });
    zone.addEventListener('dragleave', () => {
      zone.style.background = '';
      zone.style.borderColor = '';
    });
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      zone.style.background = '';
      zone.style.borderColor = '';
      const files = [...(e.dataTransfer.files || [])];
      if (!files.length) return;
      for (const file of files) {
        await _processAndUpload(file, v);
      }
      loadForVehicle(v);
    });
  }

  // ─── Upload modal (per pojazd) ─────────────────────────────────────────────
  let _uploadVehicle = null;

  function _openUpload(vehicleId) {
    _uploadVehicle = (window.vehs || []).find(x => String(x.id) === String(vehicleId));
    if (!_uploadVehicle) return;
    const m = document.getElementById('dm-upload-modal');
    if (!m) return;
    document.getElementById('dm-upload-veh-label').textContent =
      `${_uploadVehicle.nrRej || '?'} — ${_uploadVehicle.marka || ''} ${_uploadVehicle.model || ''}`.trim();
    document.getElementById('dm-upload-vin-label').textContent =
      _uploadVehicle.vin ? `VIN: ${_uploadVehicle.vin}` : 'VIN nieznany';
    document.getElementById('dm-upload-file').value = '';
    document.getElementById('dm-upload-preview').innerHTML = '';
    document.getElementById('dm-upload-status').innerHTML = '';
    m.style.display = 'flex';
  }

  function _closeUpload() {
    const m = document.getElementById('dm-upload-modal');
    if (m) m.style.display = 'none';
    _uploadVehicle = null;
  }

  async function _handleUploadFileChange(input) {
    const file = input.files[0];
    if (!file) return;
    const statusEl = document.getElementById('dm-upload-status');
    statusEl.innerHTML = `<span style="color:var(--text3)"><i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Analizuję plik…</span>`;

    const text       = await extractTextFromFile(file);
    const detVin     = extractVin(text + ' ' + file.name);
    const docType    = classifyDoc(file.name, text);
    const expiry     = extractExpiryDate(text);
    const docNum     = extractDocNumber(text);

    input._textHint = text;

    const vinMatch    = _uploadVehicle?.vin && detVin && detVin === _uploadVehicle.vin;
    const vinMismatch = _uploadVehicle?.vin && detVin && detVin !== _uploadVehicle.vin;
    const fieldMap    = _VEHICLE_FIELD_MAP[docType];

    // Auto-uzupełnij pola w modalu
    document.getElementById('dm-upload-type-sel').value = docType;
    if (expiry) document.getElementById('dm-upload-expiry').value = expiry;
    if (docNum) document.getElementById('dm-upload-docnum').value = docNum;

    document.getElementById('dm-upload-preview').innerHTML = `
      <div style="font-size:12px;color:var(--text2);padding:6px 0">
        <i class="ti ${iconForMime(file.type)}" style="font-size:14px;margin-right:4px"></i>
        <strong>${esc(file.name)}</strong>
        ${file.size ? ` <span style="color:var(--text3)">(${formatSize(file.size)})</span>` : ''}
      </div>`;

    const vinChip = detVin
      ? `<span style="font-size:10px;font-family:monospace;padding:2px 8px;border-radius:99px;background:${vinMatch ? '#f0fdf4' : vinMismatch ? '#fef3c7' : '#f8fafc'};color:${vinMatch ? '#059669' : vinMismatch ? '#b45309' : 'var(--text2)'};border:1px solid ${vinMatch ? '#a7f3d0' : vinMismatch ? '#fde68a' : 'var(--border)'}">
          <i class="ti ${vinMatch ? 'ti-check' : 'ti-alert-triangle'}" style="font-size:9px"></i>
          VIN z dok.: ${esc(detVin)}${vinMismatch ? ' ≠ pojazd' : ''}
        </span>` : '';

    const applyBtn = expiry && fieldMap && _uploadVehicle
      ? `<button type="button" onclick="DocumentsModule._applyExpiryNow()" style="font-size:10px;padding:3px 10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:99px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <i class="ti ti-arrow-right" style="font-size:9px"></i>Zastosuj ${esc(fieldMap.label)} do pojazdu
        </button>` : '';

    // OCR faktury — wykryj kwotę i zaproponuj wpis serwisowy
    let invoiceChip = '';
    let invoiceHint = null;
    if (['faktura', 'serwis'].includes(docType)) {
      invoiceHint = extractInvoiceData(text);
      if (invoiceHint?.amount) {
        const amtStr = esc(invoiceHint.amount.toFixed(2));
        const wsStr  = invoiceHint.workshop ? ` · ${esc(invoiceHint.workshop.slice(0, 30))}` : '';
        invoiceChip = `<button type="button" onclick="DocumentsModule._applyInvoiceNow()" style="font-size:10px;padding:3px 10px;background:#f0fdf4;border:1px solid #a7f3d0;color:#059669;border-radius:99px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <i class="ti ti-tool" style="font-size:9px"></i>Dodaj wpis serwisowy ${amtStr} zł${wsStr}
        </button>`;
      }
    }
    input._invoiceHint = invoiceHint;

    statusEl.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px">
        ${typeChip(docType)}
        ${vinChip}
        ${expiry ? `<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:#f0fdf4;color:#059669;border:1px solid #a7f3d0"><i class="ti ti-calendar-check" style="font-size:9px"></i> Termin: ${expiry}</span>` : ''}
        ${docNum ? `<span style="font-size:10px;font-family:monospace;padding:2px 8px;border-radius:99px;background:#f8fafc;color:var(--text2);border:1px solid var(--border)">Nr: ${esc(docNum)}</span>` : ''}
        ${applyBtn}
        ${invoiceChip}
      </div>`;

    // Zapis do input._expiry / _docNum dla _submitUpload
    input._expiry = expiry || '';
    input._docNum = docNum || '';
  }

  async function _applyInvoiceNow() {
    const input   = document.getElementById('dm-upload-file');
    const docType = document.getElementById('dm-upload-type-sel').value;
    const hint    = input._invoiceHint;
    if (!hint || !_uploadVehicle) return;
    await _createServiceEntryFromInvoice(_uploadVehicle.id, hint, docType);
  }

  async function _applyExpiryNow() {
    const input = document.getElementById('dm-upload-file');
    const expiry  = document.getElementById('dm-upload-expiry').value;
    const docType = document.getElementById('dm-upload-type-sel').value;
    if (!expiry || !_uploadVehicle) return;
    await applyExpiryToVehicle(_uploadVehicle.id, docType, expiry);
  }

  async function _submitUpload() {
    if (!_uploadVehicle) return;
    const input = document.getElementById('dm-upload-file');
    const file  = input?.files[0];
    if (!file) { window.toast?.('Wybierz plik'); return; }

    const btn = document.getElementById('dm-upload-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Wysyłam…';

    const expiry  = document.getElementById('dm-upload-expiry')?.value || input._expiry || '';
    const docNum  = document.getElementById('dm-upload-docnum')?.value || input._docNum || '';
    const docType = document.getElementById('dm-upload-type-sel').value;

    try {
      const res = await uploadDoc(file, {
        nrRej:       _uploadVehicle.nrRej,
        vin:         _uploadVehicle.vin || '',
        vehicle_id:  _uploadVehicle.id,
        doc_type:    docType,
        textHint:    input._textHint || '',
        notes:       document.getElementById('dm-upload-notes').value,
        expiry_date: expiry,
        doc_number:  docNum,
      });

      if (res.ok) {
        // Auto-zastosuj termin do pojazdu jeśli pasuje
        if (expiry && _VEHICLE_FIELD_MAP[docType]) {
          await applyExpiryToVehicle(_uploadVehicle.id, docType, expiry);
        }
        window.toast?.('Dokument dodany');
        _closeUpload();
        loadForVehicle(_uploadVehicle);
      } else {
        window.toast?.(res.error || 'Błąd zapisu', 'error');
      }
    } catch (e) {
      window.toast?.('Błąd sieci: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-upload"></i>Wyślij';
    }
  }

  async function _processAndUpload(file, v) {
    const text    = await extractTextFromFile(file);
    const docType = classifyDoc(file.name, text);
    const expiry  = extractExpiryDate(text);
    const docNum  = extractDocNumber(text);
    const res = await uploadDoc(file, {
      nrRej:       v.nrRej,
      vin:         v.vin || '',
      vehicle_id:  v.id,
      doc_type:    docType,
      textHint:    text,
      expiry_date: expiry || '',
      doc_number:  docNum || '',
    });
    if (res.ok && expiry && _VEHICLE_FIELD_MAP[docType]) {
      await applyExpiryToVehicle(v.id, docType, expiry);
    }
    return res;
  }

  async function _del(id, vehicleId) {
    if (!confirm('Usunąć dokument?')) return;
    await deleteDocById(id);
    const v = (window.vehs || []).find(x => String(x.id) === String(vehicleId));
    if (v) loadForVehicle(v);
    _renderGlobalPage();
  }

  async function _changeType(id, currentType, vehicleId) {
    const types = Object.entries(DOC_TYPES)
      .map(([k, v]) => `${k}:${v.label}`)
      .join('\n');
    const choice = prompt(`Wybierz typ dokumentu:\n${types}\n\nObecny: ${currentType}\nWpisz kod (np. oc, ac, przeglad…):`);
    if (!choice || !DOC_TYPES[choice.trim()]) return;
    await patchDoc(id, { doc_type: choice.trim() });
    const v = (window.vehs || []).find(x => String(x.id) === String(vehicleId));
    if (v) loadForVehicle(v);
    _renderGlobalPage();
  }

  // ─── Globalna strona dokumentów (page-dok-smart) ───────────────────────────
  async function _renderGlobalPage() {
    const pg = document.getElementById('page-dok-smart');
    if (!pg || pg.style.display === 'none') return;

    const filterVin  = document.getElementById('dm-global-filter-vin')?.value || '';
    const filterType = document.getElementById('dm-global-filter-type')?.value || '';
    const search     = (document.getElementById('dm-global-search')?.value || '').toLowerCase();

    const listEl = document.getElementById('dm-global-list');
    if (!listEl) return;
    listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3)"><i class="ti ti-loader-2" style="animation:spin 1s linear infinite;font-size:20px"></i></div>`;

    let docs = await fetchDocs({});
    if (filterVin)  docs = docs.filter(d => (d.vin||'').includes(filterVin.toUpperCase()));
    if (filterType) docs = docs.filter(d => (d.doc_type||'inne') === filterType);
    if (search)     docs = docs.filter(d =>
      (d.name||'').toLowerCase().includes(search) ||
      (d.nr_rej||'').toLowerCase().includes(search) ||
      (d.vin||'').toLowerCase().includes(search)
    );

    if (!docs.length) {
      listEl.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">
        <i class="ti ti-files" style="font-size:48px;display:block;margin-bottom:12px;opacity:.3"></i>
        <div style="font-size:14px">Brak dokumentów</div>
        <div style="font-size:12px;margin-top:4px">Wgraj pierwszy plik używając przycisku "Wgraj dokument"</div>
      </div>`;
      return;
    }

    // Grupuj po VIN/nrRej
    const byVeh = {};
    for (const d of docs) {
      const key = d.vin || d.nr_rej || 'nieprzypisane';
      if (!byVeh[key]) byVeh[key] = { vin: d.vin, nrRej: d.nr_rej, docs: [] };
      byVeh[key].docs.push(d);
    }

    const html = Object.entries(byVeh).map(([key, group]) => {
      const veh = (window.vehs || []).find(v =>
        (group.vin && v.vin === group.vin) || v.nrRej === group.nrRej
      );

      const header = `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg2);border-radius:var(--radius) var(--radius) 0 0;border:1px solid var(--border);border-bottom:none">
          <i class="ti ti-truck" style="font-size:15px;color:var(--blue)"></i>
          <div>
            <div style="font-size:13px;font-weight:600">${esc(veh ? `${veh.nrRej} — ${veh.marka||''} ${veh.model||''}`.trim() : key)}</div>
            ${group.vin ? `<div style="font-size:10px;font-family:monospace;color:var(--text3)">VIN: ${esc(group.vin)}</div>` : ''}
          </div>
          <span style="margin-left:auto;font-size:11px;color:var(--text3)">${group.docs.length} dok.</span>
          ${veh ? `<button class="btn btn-blue" style="font-size:11px;padding:4px 10px"
            onclick="DocumentsModule._openUpload(${veh.id})">
            <i class="ti ti-plus"></i>Dodaj
          </button>` : ''}
        </div>`;

      const rows = group.docs.map(d => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 12px;width:28px">
            <i class="ti ${iconForMime(d.mime_type)}" style="font-size:16px;color:var(--text3)"></i>
          </td>
          <td style="padding:8px 12px;max-width:220px">
            <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.name)}">${esc(d.name)}</div>
            <div style="font-size:10px;color:var(--text3)">${formatDate(d.uploaded_at)}${d.file_size ? ' · ' + formatSize(d.file_size) : ''}</div>
          </td>
          <td style="padding:8px 12px">${typeChip(d.doc_type||'inne')}</td>
          <td style="padding:8px 12px">
            ${d.detected_vin
              ? `<span style="font-size:10px;font-family:monospace;color:var(--text3)">${esc(d.detected_vin)}</span>`
              : '<span style="font-size:10px;color:var(--text3)">—</span>'}
          </td>
          <td style="padding:8px 12px;white-space:nowrap">
            <a href="${fileUrl(d.r2_key)}" target="_blank" rel="noopener"
               style="font-size:11px;color:var(--blue);margin-right:8px;text-decoration:none" title="Pobierz">
              <i class="ti ti-download"></i>
            </a>
            ${veh ? `<button onclick="DocumentsModule._changeType('${esc(d.id)}','${esc(d.doc_type||'inne')}',${veh.id})"
              style="background:none;border:none;cursor:pointer;color:var(--text2);font-size:11px;padding:0 4px" title="Zmień typ">
              <i class="ti ti-edit"></i>
            </button>
            <button onclick="DocumentsModule._del('${esc(d.id)}',${veh.id})"
              style="background:none;border:none;cursor:pointer;color:var(--red);font-size:11px;padding:0 4px" title="Usuń">
              <i class="ti ti-trash"></i>
            </button>` : ''}
          </td>
        </tr>`).join('');

      return `
        <div style="margin-bottom:16px;border-radius:var(--radius);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
          ${header}
          <div style="border:1px solid var(--border);border-top:none">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid var(--border);background:var(--bg)">
                  <th style="padding:4px 12px;font-size:10px;font-weight:600;color:var(--text3);width:28px"></th>
                  <th style="padding:4px 12px;font-size:10px;font-weight:600;color:var(--text3);text-align:left">Nazwa</th>
                  <th style="padding:4px 12px;font-size:10px;font-weight:600;color:var(--text3);text-align:left">Typ</th>
                  <th style="padding:4px 12px;font-size:10px;font-weight:600;color:var(--text3);text-align:left">VIN z dok.</th>
                  <th style="padding:4px 12px;font-size:10px;font-weight:600;color:var(--text3)"></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');

    listEl.innerHTML = html;
  }

  // ─── Globalny upload modal (bez kontekstu pojazdu — detekcja VIN) ──────────
  let _globalUploadFile = null;
  let _globalUploadText = '';
  let _globalDetectedVin = null;

  function openGlobalUpload() {
    _globalUploadFile = null;
    _globalUploadText = '';
    _globalDetectedVin = null;
    const m = document.getElementById('dm-global-upload-modal');
    if (!m) return;
    document.getElementById('dm-gu-file').value = '';
    document.getElementById('dm-gu-preview').innerHTML = '';
    document.getElementById('dm-gu-match').innerHTML = '';
    document.getElementById('dm-gu-type-sel').value = 'inne';
    document.getElementById('dm-gu-vehicle-sel').innerHTML = _buildVehicleOptions();
    m.style.display = 'flex';
  }

  function _buildVehicleOptions() {
    const vehs = (window.vehs || []).sort((a, b) => (a.nrRej || '').localeCompare(b.nrRej || ''));
    return '<option value="">-- wybierz pojazd --</option>' +
      vehs.map(v => `<option value="${esc(String(v.id))}" data-vin="${esc(v.vin||'')}">${esc(v.nrRej||'?')} — ${esc((v.marka||'') + ' ' + (v.model||''))}</option>`).join('');
  }

  async function _handleGuFileChange(input) {
    const file = input.files[0];
    if (!file) return;
    _globalUploadFile = file;

    const previewEl = document.getElementById('dm-gu-preview');
    const matchEl   = document.getElementById('dm-gu-match');
    previewEl.innerHTML = `<span style="color:var(--text3)"><i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Analizuję…</span>`;
    matchEl.innerHTML = '';

    _globalUploadText = await extractTextFromFile(file);
    _globalDetectedVin = extractVin(_globalUploadText + ' ' + file.name);
    const docType  = classifyDoc(file.name, _globalUploadText);
    const expiry   = extractExpiryDate(_globalUploadText);
    const docNum   = extractDocNumber(_globalUploadText);

    document.getElementById('dm-gu-type-sel').value = docType;
    if (expiry) document.getElementById('dm-gu-expiry').value = expiry;
    if (docNum) document.getElementById('dm-gu-docnum').value = docNum;

    previewEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <i class="ti ${iconForMime(file.type)}" style="font-size:16px;color:var(--text3)"></i>
        <span style="font-size:12px;font-weight:500">${esc(file.name)}</span>
        <span style="font-size:11px;color:var(--text3)">${formatSize(file.size)}</span>
        ${typeChip(docType)}
        ${expiry ? `<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:#f0fdf4;color:#059669;border:1px solid #a7f3d0"><i class="ti ti-calendar-check" style="font-size:9px"></i> ${expiry}</span>` : ''}
        ${docNum ? `<span style="font-size:10px;font-family:monospace;padding:2px 8px;border-radius:99px;background:#f8fafc;color:var(--text2);border:1px solid var(--border)">${esc(docNum)}</span>` : ''}
      </div>`;

    if (_globalDetectedVin) {
      const matchedVeh = (window.vehs || []).find(v => v.vin === _globalDetectedVin);
      const sel = document.getElementById('dm-gu-vehicle-sel');
      if (matchedVeh) {
        sel.value = String(matchedVeh.id);
        matchEl.innerHTML = `
          <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:var(--radius);padding:8px 12px;font-size:12px;color:#059669">
            <i class="ti ti-check" style="font-size:13px"></i>
            <strong>VIN wykryto w dokumencie:</strong> ${esc(_globalDetectedVin)}<br>
            Automatycznie przypisano do: <strong>${esc(matchedVeh.nrRej)} — ${esc(matchedVeh.marka||'')} ${esc(matchedVeh.model||'')}</strong>
          </div>`;
      } else {
        matchEl.innerHTML = `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:var(--radius);padding:8px 12px;font-size:12px;color:#b45309">
            <i class="ti ti-alert-triangle" style="font-size:13px"></i>
            <strong>VIN z dokumentu: ${esc(_globalDetectedVin)}</strong> — nie znaleziono pojazdu w flocie.<br>
            Wybierz pojazd ręcznie poniżej lub zostaw bez przypisania.
          </div>`;
      }
    }
  }

  async function _submitGlobalUpload() {
    const file = _globalUploadFile;
    if (!file) { window.toast?.('Wybierz plik'); return; }

    const sel = document.getElementById('dm-gu-vehicle-sel');
    const selectedId = sel?.value || '';
    const veh = (window.vehs || []).find(v => String(v.id) === selectedId);

    const btn = document.getElementById('dm-gu-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Wysyłam…';

    try {
      const docType  = document.getElementById('dm-gu-type-sel').value;
      const expiry   = document.getElementById('dm-gu-expiry')?.value || '';
      const docNum   = document.getElementById('dm-gu-docnum')?.value || '';
      const res = await uploadDoc(file, {
        nrRej:       veh?.nrRej || '',
        vin:         (veh?.vin || _globalDetectedVin || '').toUpperCase(),
        vehicle_id:  veh?.id || '',
        doc_type:    docType,
        textHint:    _globalUploadText,
        notes:       document.getElementById('dm-gu-notes').value,
        expiry_date: expiry,
        doc_number:  docNum,
      });

      if (res.ok) {
        if (expiry && veh && _VEHICLE_FIELD_MAP[docType]) {
          await applyExpiryToVehicle(veh.id, docType, expiry);
        }
        window.toast?.('Dokument wgrany' + (veh ? ` → ${veh.nrRej}` : ''));
        document.getElementById('dm-global-upload-modal').style.display = 'none';
        _globalUploadFile = null;
        _renderGlobalPage();
      } else {
        window.toast?.(res.error || 'Błąd zapisu', 'error');
      }
    } catch (e) {
      window.toast?.('Błąd sieci: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-upload"></i>Wgraj';
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  window.DocumentsModule = {
    renderForVehicle,
    loadForVehicle,
    openGlobalUpload,
    _renderGlobalPage,
    _openUpload,
    _closeUpload,
    _submitUpload,
    _applyExpiryNow,
    _applyInvoiceNow,
    _handleUploadFileChange,
    _handleGuFileChange,
    _submitGlobalUpload,
    _del,
    _changeType,
    applyExpiryToVehicle,
    DOC_TYPES,
  };
})();
