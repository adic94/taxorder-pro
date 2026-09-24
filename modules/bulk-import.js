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
  const PLATE_RX    = /\b([A-Z]{2,3})[\s.\-_]?([A-Z0-9]{3,6})\b/g;
  // Regex na VIN (17 znaków, bez liter I/O/Q wg normy ISO 3779)
  const VIN_RX      = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
  // Rozszerzenia Excel/CSV
  const EXCEL_TYPES = /\.(xlsx|xls|csv|ods|tsv)$/i;

  // Klasyfikacja po nazwie pliku
  const TYPE_MAP = [
    { type: 'dr',         rx: /\bdr\b|dowod[\s_\-]?rejestr|registration|d[\s_\-]?r[\s_\-]?\d/i },
    { type: 'oc',         rx: /\boc\b|polisa|ubezpiecz|insurance|warta|pzu|allianz|hdi|axa|ergo|uniqa|mtu|proama|trasti|generali/i },
    { type: 'ac',         rx: /\bac\b|casco|autocasco|assistance/i },
    { type: 'invoice',    rx: /faktura|invoice|\bfv\b|\bvat\b|rachunek|paragon/i },
    { type: 'inspection', rx: /przeglad|przegl|inspection|\bskp\b|diagnosta|badanie[\s_]?tech/i },
    { type: 'handover',   rx: /protokol|przekazanie|handover|zdanie|odbioru|protokol[\s_]?zd/i },
    { type: 'service',    rx: /serwis|naprawa|warsztat|service|repair|usterka/i },
    { type: 'spreadsheet',rx: /\.(xlsx?|csv|ods|tsv)$/i },
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
    spreadsheet:{ label: 'Arkusz/CSV',               icon: 'ti-table',            col: '#166534' },
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

  // Pewność zwracana przez `/api/bulk/classify` (AI Groq Vision, worker/index.js:13440)
  // jest PER DOKUMENT (deklarowana przez model), nie per pole — model nie jest o to
  // proszony przy ekstrakcji (`/api/bulk/extract` w ogóle nie zwraca confidence).
  // Odznaka pokazuje więc dokładnie to, co system faktycznie wie, bez udawania
  // dokładniejszego sygnału, którego nikt nie policzył.
  const CONF_META = {
    high:   { label: 'pewne',    col: '#16a34a' },
    medium: { label: 'sprawdź',  col: '#d97706' },
    low:    { label: 'niepewne', col: '#dc2626' },
  };
  function _confBadge(conf) {
    const m = CONF_META[conf];
    if (!m) return '';
    return ` <span style="font-size:9px;padding:1px 5px;border-radius:99px;border:1px solid ${m.col};color:${m.col}" title="Pewność zgłoszona przez AI (per dokument)">${m.label}</span>`;
  }

  // ── Stan modułu ────────────────────────────────────────────────────────────
  let _queue   = [];
  let _running = false;
  let _paused  = false;
  let _stop    = false;
  let _scrollY = 0;

  // ── Pomocnicze ─────────────────────────────────────────────────────────────
  function _classifyByName(name) {
    // Pliki Excel/CSV: rozpoznaj po rozszerzeniu (przed normalizacją)
    if (EXCEL_TYPES.test(name)) return 'spreadsheet';
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

  // Wyciąga wszystkie VIN-y z dowolnego tekstu
  function _vinsFromText(text) {
    const up = text.toUpperCase();
    return [...up.matchAll(VIN_RX)].map(m => m[1]);
  }

  // Dopasowuje pojazd po VIN w window.vehs
  function _matchByVin(vin) {
    if (!vin || vin.length !== 17) return null;
    const up = vin.toUpperCase();
    return (window.vehs || []).find(v => {
      const vv = (v.vin || '').toUpperCase().trim();
      return vv && vv === up;
    }) || null;
  }

  // Wyciąga tablice rej. z dowolnego tekstu (dla Excel/CSV)
  function _platesFromText(text) {
    const up = text.toUpperCase();
    const matches = [...up.matchAll(/\b([A-Z]{2,3})[\s.\-_]?([A-Z0-9]{3,6})\b/g)];
    const result = [];
    const seen   = new Set();
    for (const m of matches) {
      const candidate = (m[1] + m[2]).replace(/\s/g, '');
      if (candidate.length >= 5 && candidate.length <= 8 && /\d/.test(candidate) && !seen.has(candidate)) {
        seen.add(candidate);
        result.push(candidate);
      }
    }
    return result;
  }

  function _matchVehicle(plate) {
    if (!plate) return null;
    const norm = plate.toUpperCase().replace(/[\s\-\.]/g, '');
    return (window.vehs || []).find(v => {
      const vp = ((v.nrRej || v.nr_rej || '')).toUpperCase().replace(/[\s\-\.]/g, '');
      return vp === norm || (norm.length >= 5 && (vp.startsWith(norm) || norm.startsWith(vp)));
    }) || null;
  }

  // Próbuje VIN (najpierw, bo unikalny), potem tablice — zwraca { veh, plate } dla pierwszego trafienia
  function _matchVehicleFromName(name) {
    const norm = name.replace(/[_\-\.]+/g, ' ');
    // VIN jest bardziej unikalny niż tablica — szukaj go najpierw
    const vins = _vinsFromText(norm);
    for (const vin of vins) {
      const veh = _matchByVin(vin);
      if (veh) return { veh, plate: (veh.nrRej || veh.nr_rej || null) };
    }
    // Fallback: dopasowanie po tablicy
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

  // Render lekki pod API wizyjne (nie pod dekodowanie Aztec) — te same 150 DPI/JPEG 0.92
  // co `modules/dr-import.js` PDF_OCR, żeby nie było trzeciej kopii "jakie ustawienia
  // renderu PDF pod OCR". WYŻSZA gęstość (300 DPI, jak w PDF_AZTEC) jest tu niepotrzebna
  // i tylko powiększa payload — model językowy czyta tekst, nie moduły kodu 2D.
  const PDF_VISION = { dpi: 150, format: 'image/jpeg', quality: 0.92 };

  async function _pdfPageCount(file) {
    try {
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
      return pdf.numPages;
    } catch { return 1; }
  }

  async function _pdfPageBlob(file, pageNum, opts = PDF_VISION) {
    try {
      const pdf  = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
      const page = await pdf.getPage(pageNum);
      const vp   = page.getViewport({ scale: (opts.dpi || 150) / 72 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      return await new Promise(res => canvas.toBlob(res, opts.format || 'image/jpeg', opts.quality));
    } catch { return null; }
  }

  /**
   * Plik gotowy do wysłania do `/api/bulk/classify`/`/api/bulk/extract`.
   *
   * PRZED TĄ ZMIANĄ dla PDF-ów szedł do tych endpointów SUROWY plik PDF zakodowany
   * base64 z `mimeType: 'application/pdf'` — endpoint wysyła go dalej do modelu
   * WIZYJNEGO (`_bulkGroqVision`, worker/index.js:13444/13476), który oczekuje obrazu,
   * nie strumienia PDF. AI OCR całej skrzynki dla PDF-ów (większość realnych skanów)
   * był więc cichym zgadywaniem albo błędem API, nie prawdziwą ekstrakcją.
   *
   * `pageHint` pozwala wymusić konkretną stronę (np. ostatnią dla DR, gdzie kod Aztec
   * i część adnotacji bywają na końcu — patrz `modules/aztec-scanner.js`); domyślnie
   * strona 1, bo większość dokumentów flotowych (faktury, polisy, protokoły) niesie
   * kluczowe dane na pierwszej stronie.
   */
  async function _fileForApi(file, pageHint) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      return { blob: file, mimeType: file.type || 'image/jpeg' };
    }
    const strona = pageHint || 1;
    const blob = await _pdfPageBlob(file, strona, PDF_VISION);
    if (!blob) return { blob: file, mimeType: file.type || 'application/pdf', renderFailed: true };
    return { blob, mimeType: PDF_VISION.format };
  }

  // Wyciąga tekst z PDF bez OCR (dla PDF-ów wygenerowanych elektronicznie, nie skanów)
  async function _extractPdfText(file) {
    const buf = await file.arrayBuffer();
    // Użyj latin-1 aby zachować bajty PDF bez przekształceń
    const raw = new TextDecoder('latin-1').decode(buf);
    const pieces = [];
    // Operator Tj — pojedynczy ciąg: (tekst)Tj
    const tjRx = /\(([^)\\]{0,200}(?:\\.[^)\\]{0,200})*)\)\s*Tj/g;
    for (const m of raw.matchAll(tjRx)) pieces.push(m[1]);
    // Operator TJ — tablica ciągów: [(tekst1)(tekst2)]TJ
    const tjArrRx = /\[([^\]]{0,500})\]\s*TJ/g;
    for (const m of raw.matchAll(tjArrRx)) {
      const strRx = /\(([^)\\]{0,200}(?:\\.[^)\\]{0,200})*)\)/g;
      for (const s of m[1].matchAll(strRx)) pieces.push(s[1]);
    }
    return pieces.join(' ');
  }

  // Odczytuje zawartość pliku Excel/CSV jako tekst (do wyszukiwania VIN i tablic)
  async function _extractExcelText(file) {
    if (!window.XLSX) throw new Error('Biblioteka XLSX niedostępna');
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = e => {
        try {
          const isCsv = /\.csv$/i.test(file.name);
          const data  = isCsv ? e.target.result : new Uint8Array(e.target.result);
          const wb    = window.XLSX.read(data, { type: isCsv ? 'string' : 'array' });
          const text  = wb.SheetNames.map(n => window.XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
          res(text);
        } catch (err) { rej(err); }
      };
      fr.onerror = rej;
      if (/\.csv$/i.test(file.name)) fr.readAsText(file, 'utf-8');
      else fr.readAsArrayBuffer(file);
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
  // `blob` musi być już OBRAZEM (JPEG/PNG) — dla PDF-ów wywołujący renderuje stronę
  // przez `_fileForApi`/`_pdfPageBlob` PRZED wywołaniem; te dwie funkcje same tego
  // nie robią, żeby nie renderować tej samej strony dwa razy w jednym przebiegu.
  async function _apiClassify(blob, mimeType, filename) {
    try {
      const base64 = await _toBase64(blob);
      const r = await fetch(`${API()}/api/bulk/classify`, {
        method:  'POST',
        headers: { ...hdrs(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mimeType: mimeType || blob.type || 'image/jpeg', filename }),
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  async function _apiExtract(blob, mimeType, docType) {
    try {
      const base64 = await _toBase64(blob);
      const r = await fetch(`${API()}/api/bulk/extract`, {
        method:  'POST',
        headers: { ...hdrs(), 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mimeType: mimeType || blob.type || 'image/jpeg', docType }),
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

      // Ślad źródeł dla eksportu DR (modules/dr-export.js) — ta sama mechanika co
      // w modules/dr-import.js: bez zmiany schematu D1, przez /api/docs. Bulk-import
      // idzie zawsze przez AI Vision (Groq), nigdy przez dekodowanie Aztec, więc
      // źródło jest jednoznacznie 'ocr'.
      //
      // UWAGA: prompt handleBulkExtract (worker/index.js:13465) zwraca dla typu 'dr'
      // klucze rok/pojemnosc/moc/dataWaznosci — INNE niż kanoniczne rokProd/pojSilnika/
      // mocKW z modules/dr-fields.js. `scalRekordy` po prostu je zignoruje (nie ma dla
      // nich wpisu w katalogu), więc nic się nie psuje — ale te cztery pola NIE trafią
      // do eksportu DR przez tę ścieżkę. Nie przemianowuję ich tutaj na spudłowane
      // dopasowanie — to by było zgadywanie; realna naprawa to ujednolicenie promptu
      // ekstrakcji z katalogiem, osobne zadanie.
      if (window.TaxOrderDrExport) {
        const pola = {};
        for (const [k, v] of Object.entries(item.data || {})) {
          if (v == null || v === '') continue;
          pola[k] = { wartosc: v, zrodlo: 'ocr' };
        }
        window.TaxOrderDrExport.emitAuditSidecar({ vin: item.data?.vin || null, nrRej: vehicleNr, pola, odrzucone: [] }).catch(() => {});
      }
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

  // ── Przetwarzanie pliku Excel/CSV (bez AI Vision, szukanie VIN/tablic w treści) ────────────────
  async function _processExcelItem(item) {
    try {
      item.status = 'identifying';
      _renderProgress();

      const text = await _extractExcelText(item.file);

      // VIN (unikalny) ma priorytet
      let veh = null;
      for (const vin of _vinsFromText(text)) {
        veh = _matchByVin(vin);
        if (veh) { item.plate = (veh.nrRej || veh.nr_rej || null); break; }
      }

      // Fallback: szukaj tablicy rejestracyjnej w treści pliku
      if (!veh) {
        for (const plate of _platesFromText(text)) {
          veh = _matchVehicle(plate);
          if (veh) { item.plate = plate; break; }
        }
      }

      if (!veh) {
        item.status = 'unmatched';
        item.error  = 'Nie znaleziono VIN ani tablicy rejestracyjnej w pliku';
        return;
      }

      item.vehicleId = veh.id;
      item.vehicleNr = (veh.nrRej || veh.nr_rej || '').toUpperCase();
      item.status    = 'matched';
    } catch (e) {
      item.status = 'error';
      item.error  = e.message;
    }
    _renderProgress();
  }

  // ── Przetwarzanie jednego pliku ───────────────────────────────────────────
  async function _processItem(item) {
    // Pliki Excel/CSV: odczyt tekstu zamiast AI Vision
    if (EXCEL_TYPES.test(item.name)) return _processExcelItem(item);

    try {
      // Krok 1: klasyfikacja po nazwie + szybkie dopasowanie pojazdu (VIN → tablica)
      item.type = _classifyByName(item.name);
      const { veh: vehFromName, plate: plateFromName } = _matchVehicleFromName(item.name);
      item.plate = plateFromName;
      let veh    = vehFromName;

      // Krok 1b: dla PDF — próba ekstrakcji tekstu bez OCR (szybciej, bez zużycia API)
      if (!veh && /\.pdf$/i.test(item.name)) {
        try {
          const pdfText = await _extractPdfText(item.file);
          if (pdfText.length > 20) {
            for (const vin of _vinsFromText(pdfText)) {
              veh = _matchByVin(vin);
              if (veh) { item.plate = (veh.nrRej || veh.nr_rej || item.plate); break; }
            }
            if (!veh) {
              for (const plate of _platesFromText(pdfText)) {
                veh = _matchVehicle(plate);
                if (veh) { item.plate = plate; break; }
              }
            }
          }
        } catch { /* PDF zaszyfrowany lub binarny — idź do AI OCR */ }
      }

      // Krok 2: jeśli nadal nie dopasowano → AI OCR dla numeru rej. i klasyfikacji.
      // Dla PDF: strona 1 najpierw; gdy nic nie dała I dokument ma więcej stron,
      // spróbuj OSTATNIEJ (DR ma tam kod Aztec i adnotacje — patrz aztec-scanner.js;
      // wielostronicowe protokoły/faktury bywają podsumowane na ostatniej stronie).
      const jestPdf = /\.pdf$/i.test(item.name) || item.file.type === 'application/pdf';
      let strony = 1;
      if (!veh) {
        item.status = 'identifying';
        _renderProgress();
        const { blob, mimeType, renderFailed } = await _fileForApi(item.file, 1);
        if (renderFailed) item._renderWarn = 'Nie udało się wyrenderować PDF do obrazu — OCR pominięty';
        let ai = renderFailed ? null : await _apiClassify(blob, mimeType, item.name);

        if ((!ai || (!ai.plate && !ai.vin)) && jestPdf) {
          strony = await _pdfPageCount(item.file);
          if (strony > 1) {
            const ostatnia = await _fileForApi(item.file, strony);
            if (!ostatnia.renderFailed) {
              const ai2 = await _apiClassify(ostatnia.blob, ostatnia.mimeType, item.name);
              if (ai2 && (ai2.plate || ai2.vin)) { ai = ai2; item._stronaUzyta = strony; }
            }
          }
        }

        if (ai) {
          item.confidence = ai.confidence || null;
          if (ai.plate) { item.plate = ai.plate; }
          if (ai.type && item.type === 'other') { item.type = ai.type; }
          // VIN z AI (dokładniejszy od tablicy)
          if (ai.vin) {
            veh = _matchByVin(ai.vin) || null;
            if (veh) item.plate = (veh.nrRej || veh.nr_rej || item.plate);
          }
          if (!veh) veh = _matchVehicle(item.plate);
        }
      }

      if (!veh) {
        item.status = 'unmatched';
        item.error  = 'Nie znaleziono pojazdu' + (item.plate ? ': ' + item.plate : ' — brak numeru rej.');
        return;
      }

      item.vehicleId = veh.id;
      item.vehicleNr = (veh.nrRej || veh.nr_rej || '').toUpperCase();

      // Krok 3: wyciąganie danych strukturalnych (AI) — ta sama strona, na której
      // udało się dopasować pojazd w kroku 2 (żeby nie renderować drugi raz stronę,
      // która i tak nie zawiera danych; dla obrazów i dopasowania z nazwy/treści PDF
      // to po prostu strona 1).
      item.status = 'extracting';
      _renderProgress();
      const stronaEkstrakcji = item._stronaUzyta || 1;
      const { blob: exBlob, mimeType: exMime, renderFailed: exRenderFailed } = await _fileForApi(item.file, stronaEkstrakcji);
      const extracted = exRenderFailed ? null : await _apiExtract(exBlob, exMime, item.type);
      item.data = extracted?.fields || extracted || {};
      // Jeśli AI znalazł tablicę/VIN w treści i my jeszcze nie mamy — próbuj dopasować
      if (extracted?.vin && !item.vehicleNr) {
        const vehByVin = _matchByVin(extracted.vin);
        if (vehByVin) {
          item.vehicleId = vehByVin.id;
          item.vehicleNr = (vehByVin.nrRej || vehByVin.nr_rej || '').toUpperCase();
        }
      }
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
  /**
   * Twarda bramka preview/approve. WCZEŚNIEJ przycisk "Zapisz dopasowane" leciał
   * prosto do `_doSaveAll()` — każdy wiersz oznaczony "matched" (w tym cichym,
   * automatycznym dopasowaniem z nazwy pliku albo AI OCR o niskiej pewności) szedł
   * do bazy bez pokazania człowiekowi, CO konkretnie zostanie zapisane. Teraz najpierw
   * pokazujemy podsumowanie i wymagamy jawnego kliknięcia.
   */
  function _saveAll() {
    const ready = _queue.filter(i => i.status === 'matched');
    if (!ready.length) { window.toast?.('Brak gotowych rekordów do zapisania'); return; }

    const existing = document.getElementById('bi-confirm-modal');
    if (existing) existing.remove();

    const niepewne = ready.filter(i => i.confidence === 'low' || !i.vehicleNr);
    const wgTypu = {};
    for (const i of ready) wgTypu[i.type] = (wgTypu[i.type] || 0) + 1;
    const podsumowanieTypow = Object.entries(wgTypu)
      .map(([t, n]) => `${(TYPE_META[t] || TYPE_META.other).label}: <strong>${n}</strong>`).join(' · ');

    const wiersze = ready.slice(0, 12).map(i => `
      <div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(i.name)}">${esc(i.name)}</span>
        <span style="width:90px;flex-shrink:0;font-weight:600">${esc(i.vehicleNr || '—')}</span>
        <span style="width:110px;flex-shrink:0;color:var(--text2)">${esc((TYPE_META[i.type] || TYPE_META.other).label)}</span>
        ${_confBadge(i.confidence)}
      </div>`).join('');

    const html = `<div id="bi-confirm-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10500;display:flex;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)this.remove()">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:560px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 60px rgba(0,0,0,.35)">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
          <i class="ti ti-shield-check" style="font-size:20px;color:var(--blue)"></i>
          <strong>Zatwierdź zapis ${ready.length} dokumentów</strong>
          <button onclick="document.getElementById('bi-confirm-modal').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:20px">×</button>
        </div>
        <div style="padding:14px 20px;overflow-y:auto;flex:1">
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px">${podsumowanieTypow}</div>
          ${niepewne.length ? `<div style="font-size:12px;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:var(--radius);padding:8px 12px;margin-bottom:10px">
            <i class="ti ti-alert-triangle"></i> ${niepewne.length} dok. z niepewnym dopasowaniem (AI OCR, niska pewność) — sprawdź nr rej. przed zatwierdzeniem.
          </div>` : ''}
          ${wiersze}
          ${ready.length > 12 ? `<div style="font-size:11px;color:var(--text3);padding:6px 0">…i ${ready.length - 12} więcej</div>` : ''}
        </div>
        <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="document.getElementById('bi-confirm-modal').remove()">Anuluj</button>
          <button class="btn btn-green" onclick="document.getElementById('bi-confirm-modal').remove();BulkImport._doSaveAll()"><i class="ti ti-device-floppy"></i> Zatwierdź i zapisz</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  async function _doSaveAll() {
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
          ${_confBadge(item.confidence)}
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
            <input type="file" id="bi-file-input" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.ods,.tsv" webkitdirectory style="display:none" onchange="BulkImport._onFileInput(this)">
          </label>
          <label class="btn btn-gray" style="cursor:pointer" title="Dodaj pliki bez struktury folderów">
            <i class="ti ti-files"></i>Wybierz pliki
            <input type="file" id="bi-file-input2" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.ods,.tsv" style="display:none" onchange="BulkImport._onFileInput(this)">
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
          Identyfikacja: 1. VIN/tablica w nazwie pliku, 2. treść pliku (Excel/CSV), 3. AI OCR (Groq Vision).
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
      .filter(f => /\.(pdf|jpg|jpeg|png|webp|xlsx|xls|csv|ods|tsv)$/i.test(f.name));
    if (!files.length) { window.toast?.('Brak obsługiwanych plików (PDF, JPG, PNG, WEBP, XLSX, CSV)'); return; }

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
          confidence:null,
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
    _doSaveAll,
    _openAssignPicker,
    _filterAssign,
    _assignVeh,
    _removeItem,
    _clearDone,
    _clearAll,
    _renderQueue,
  };
})();
