// ==================== AZTEC SCANNER — Dowód Rejestracyjny ====================
// Dekoduje kod AZTEC z ostatniej strony DR, parsuje dane pojazdu i integruje
// z istniejącym flow openUpdateModal / showManualForm (jak OCR Tesseract).
// Wymaga: @zxing/library (UMD global ZXing) załadowanego w index.html.

window.AztecScanner = {

  _vehId: undefined,
  _parsed: null,
  _rawText: '',
  _lastScanDataUrl: null,   // ostatni skan — podgląd (zwykle ostatnia strona PDF)
  _firstPageDataUrl: null,  // strona 1 PDF — dane pojazdu dla OCR fallback

  // ── Punkt wejścia ─────────────────────────────────────────────────────────
  open(vehId) {
    this._vehId = vehId;
    this._parsed = null;
    this._rawText = '';
    this._ensureModal();

    const m = document.getElementById('aztec-modal');
    m.style.display = 'flex';

    // Reset stanu
    this._setStatus('photo', 'Wybierz zdjęcie ostatniej strony dowodu rejestracyjnego — tej ze wzorem AZTEC (kwadratowy kod).');
    document.getElementById('aztec-preview-img').style.display = 'none';
    document.getElementById('aztec-result').style.display = 'none';
    // Reset file inputs
    m.querySelectorAll('input[type=file]').forEach(i => { i.value = ''; });
  },

  close() {
    const m = document.getElementById('aztec-modal');
    if (m) m.style.display = 'none';
  },

  // ── Modal DOM ─────────────────────────────────────────────────────────────
  _ensureModal() {
    if (document.getElementById('aztec-modal')) return;
    const div = document.createElement('div');
    div.id = 'aztec-modal';
    div.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10100;align-items:center;justify-content:center;padding:16px';
    div.innerHTML = `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:16px;padding:28px 24px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.35)">
        <!-- Nagłówek -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="width:44px;height:44px;border-radius:12px;background:var(--amber-light,#fff8e7);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ti-qrcode" style="font-size:22px;color:var(--amber,#d97706)"></i>
          </div>
          <div>
            <div style="font-size:16px;font-weight:700">Skanuj kod AZTEC z DR</div>
            <div style="font-size:12px;color:var(--text2)">Ostatnia strona dowodu rejestracyjnego</div>
          </div>
          <button onclick="AztecScanner.close()" style="margin-left:auto;background:none;border:none;font-size:24px;line-height:1;cursor:pointer;color:var(--text2);padding:4px">×</button>
        </div>

        <!-- Status -->
        <div id="aztec-status-box" class="ibox" style="margin-bottom:14px;font-size:13px"></div>

        <!-- Przyciski wyboru pliku -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <label class="btn btn-blue" style="justify-content:center;cursor:pointer;position:relative">
            <i class="ti ti-camera"></i>Aparat (mobile)
            <input type="file" accept="image/*" capture="environment" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer" onchange="AztecScanner._handleFile(this.files[0])">
          </label>
          <label class="btn btn-gray" style="justify-content:center;cursor:pointer;position:relative">
            <i class="ti ti-upload"></i>Wgraj plik / PDF
            <input type="file" accept="image/*,application/pdf,.pdf" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer" onchange="AztecScanner._handleFile(this.files[0])">
          </label>
        </div>

        <!-- Podgląd zdjęcia -->
        <img id="aztec-preview-img" style="display:none;width:100%;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;max-height:260px;object-fit:contain;background:#000">

        <!-- Wynik dekodowania -->
        <div id="aztec-result" style="display:none">
          <div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--green,#16a34a);display:flex;align-items:center;gap:6px">
            <i class="ti ti-circle-check"></i>Dane zdekodowane z kodu AZTEC
          </div>
          <div id="aztec-fields" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg,10px);padding:14px;margin-bottom:10px;font-size:12px"></div>
          <details style="margin-bottom:12px">
            <summary style="cursor:pointer;font-size:11px;color:var(--text3);padding:5px;user-select:none">🔍 Surowy tekst kodu AZTEC (rozwiń)</summary>
            <pre id="aztec-raw" style="font-size:10px;font-family:var(--mono,'monospace');background:var(--bg3);padding:10px;border-radius:var(--radius,6px);max-height:140px;overflow-y:auto;margin-top:6px;white-space:pre-wrap;word-break:break-all;color:var(--text2)"></pre>
          </details>
          <button class="btn btn-green" style="width:100%;justify-content:center;font-size:14px;padding:12px" onclick="AztecScanner._apply()">
            <i class="ti ti-check"></i>Zastosuj dane do pojazdu
          </button>
        </div>
      </div>`;
    document.body.appendChild(div);
  },

  _setStatus(type, msg) {
    const box = document.getElementById('aztec-status-box');
    if (!box) return;
    const icons = { photo: 'ti-photo', loading: 'ti-loader', ok: 'ti-circle-check', warn: 'ti-alert-triangle' };
    const classes = { photo: 'ibox', loading: 'ibox', ok: 'gbox', warn: 'wbox' };
    const spin = type === 'loading' ? ' style="animation:spin 1s linear infinite"' : '';
    box.className = classes[type] || 'ibox';
    box.innerHTML = `<i class="ti ${icons[type] || 'ti-info-circle'}"${spin}></i><span>${(window.esc||String)(msg)}</span>`;
  },

  // ── Obsługa pliku ─────────────────────────────────────────────────────────
  async _handleFile(file) {
    if (!file) return;
    this._firstPageDataUrl = null;
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

    const previewImg = document.getElementById('aztec-preview-img');
    if (!isPdf && previewImg) {
      previewImg.style.display = 'block';
      previewImg.src = URL.createObjectURL(file);
    }

    this._setStatus('loading', isPdf
      ? 'Odczytuję strony PDF i szukam kodu AZTEC…'
      : 'Dekodowanie kodu AZTEC… może chwilę potrwać.');
    document.getElementById('aztec-result').style.display = 'none';

    try {
      let text;
      if (isPdf) {
        text = await this._decodeFromPdf(file);
      } else {
        // Załaduj obraz przed dekodowaniem — potrzebne dla OCR fallback
        const dataUrl = await this._fileToDataUrl(file);
        this._lastScanDataUrl = dataUrl;
        if (previewImg) { previewImg.style.display = 'block'; previewImg.src = dataUrl; }
        text = await this._decode(file);
      }
      if (!text || !text.trim()) throw new Error('Kod AZTEC pusty lub nieczytelny');
      this._rawText = text;
      this._parsed = this._parse(text);
      this._renderResult(text, this._parsed);
      this._setStatus('ok', 'Kod AZTEC zdekodowany. Sprawdź dane i kliknij „Zastosuj".');
    } catch (e) {
      console.warn('[AZTEC]', e.message);
      // Automatyczny fallback: OCR przez AI gdy AZTEC nieczytelny
      if (this._lastScanDataUrl) {
        try {
          this._setStatus('loading', 'Szukam danych przez AI OCR…');
          const d = await this._ocrFallback();
          this._parsed = d;
          this._rawText = '';
          this._renderOcrResult(d);
          this._setStatus('ok', 'Dane odczytane przez AI OCR. Sprawdź i kliknij „Zastosuj".');
          return;
        } catch (ocrErr) {
          console.error('[OCR fallback]', ocrErr.message);
        }
      }
      this._setStatus('warn', 'Nie udało się odczytać danych z dowodu rejestracyjnego. Upewnij się że wgrywasz właściwy plik i spróbuj ponownie.');
    }
  },

  // ── Dekodowanie PDF — renderuje każdą stronę i szuka kodu AZTEC ──────────
  async _decodeFromPdf(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js niedostępny — odśwież stronę');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
    const numPages = pdf.numPages;

    // Zacznij od ostatniej strony (Aztec jest z tyłu DR), potem od początku
    const order = [];
    for (let i = numPages; i >= 1; i--) order.push(i);

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.AZTEC]);

    // Próbuj przy dwóch różnych skalach: 2.5× i 3.5×
    for (const scale of [2.5, 3.5]) {
      for (const pageNum of order) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        if (scale === 2.5) {
          const jpg = canvas.toDataURL('image/jpeg', 0.88);
          // Strona 1 — dane pojazdu (niezbędne dla OCR starego "Dowód Stały")
          if (pageNum === 1) this._firstPageDataUrl = jpg;
          // Ostatnia strona — podgląd w modal + nowe DR mogą mieć AZTEC właśnie tu
          if (pageNum === numPages) {
            this._lastScanDataUrl = jpg;
            const previewImg = document.getElementById('aztec-preview-img');
            if (previewImg) { previewImg.style.display = 'block'; previewImg.src = jpg; }
          }
        }

        // Spróbuj zdekodować AZTEC ze wszystkich rotacji + dwa binarizery
        for (let rot = 0; rot < 4; rot++) {
          const c = rot === 0 ? canvas : this._rotateCanvas(canvas, rot * 90);
          const lum = new ZXing.HTMLCanvasElementLuminanceSource(c);
          for (const Binarizer of [ZXing.HybridBinarizer, ZXing.GlobalHistogramBinarizer]) {
            try {
              const rdr = new ZXing.MultiFormatReader();
              rdr.setHints(hints);
              const result = rdr.decode(new ZXing.BinaryBitmap(new Binarizer(lum)));
              this._lastScanDataUrl = canvas.toDataURL('image/jpeg', 0.92);
              const previewImg = document.getElementById('aztec-preview-img');
              if (previewImg) { previewImg.style.display = 'block'; previewImg.src = this._lastScanDataUrl; }
              return result.getText();
            } catch { /* następna kombinacja */ }
          }
        }
      }
    }
    throw new Error(`Nie znaleziono kodu AZTEC w ${numPages}-stronicowym PDF`);
  },

  async _fileToDataUrl(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = e => res(e.target.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  },

  // ── Dekodowanie ZXing ─────────────────────────────────────────────────────
  async _decode(file) {
    if (typeof ZXing === 'undefined') {
      throw new Error('Biblioteka ZXing nie załadowana — odśwież stronę.');
    }

    const canvas = await this._fileToCanvas(file);
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.AZTEC]);

    // Próbuj 4 orientacje (obrót co 90°)
    for (let rot = 0; rot < 4; rot++) {
      const c = rot === 0 ? canvas : this._rotateCanvas(canvas, rot * 90);
      try {
        const lum = new ZXing.HTMLCanvasElementLuminanceSource(c);
        const bin = new ZXing.HybridBinarizer(lum);
        const bmp = new ZXing.BinaryBitmap(bin);
        const rdr = new ZXing.MultiFormatReader();
        rdr.setHints(hints);
        return rdr.decode(bmp).getText();
      } catch { /* następna orientacja */ }
    }

    // Ostatnia szansa: skaluj obraz i próbuj jeszcze raz (dla zdjęć o niskiej rozdzielczości)
    const small = this._scaleCanvas(canvas, 0.5);
    const lum2 = new ZXing.HTMLCanvasElementLuminanceSource(small);
    const rdr2 = new ZXing.MultiFormatReader();
    rdr2.setHints(hints);
    return rdr2.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum2))).getText();
  },

  async _fileToCanvas(file) {
    const dataUrl = await new Promise(res => {
      const fr = new FileReader();
      fr.onload = e => res(e.target.result);
      fr.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    // Skaluj do max 4000px jeśli obraz jest bardzo duży (wydajność ZXing)
    const MAX = 4000;
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > MAX || h > MAX) {
      const s = Math.min(MAX / w, MAX / h);
      w = Math.round(w * s); h = Math.round(h * s);
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  },

  _rotateCanvas(src, deg) {
    const c = document.createElement('canvas');
    const sw = deg === 90 || deg === 270 ? src.height : src.width;
    const sh = deg === 90 || deg === 270 ? src.width  : src.height;
    c.width = sw; c.height = sh;
    const ctx = c.getContext('2d');
    ctx.translate(sw / 2, sh / 2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  },

  _scaleCanvas(src, factor) {
    const c = document.createElement('canvas');
    c.width  = Math.round(src.width  * factor);
    c.height = Math.round(src.height * factor);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  },

  // ── Parser danych DR ──────────────────────────────────────────────────────
  // Obsługuje DWA formaty polskiego DR:
  //
  // NOWY FORMAT (BAS/BAV/BAY, rozporządzenie MiR 2017, Dz.U. poz. 2355):
  //   [0]=seria [1]=nrDR [2]=organ [3]=nrRej [4]=marka [5]=typ [6]=wariant
  //   [7]=wersja [8]=model [9]=VIN [10]=data1rej [11]=dataRejAkt [12]=kategoria
  //   [13..16]=dane właściciela (RODO) [17]=f1_dmc [18]=f2_dmc_lad [19]=f3_dmc_zesp
  //   [20]=g_masa_wl [21]=o1 [22]=o2 [23]=p1_poj [24]=p2_moc [25]=p3_paliwo
  //   [26]=liczba_osi [27]=s1_miejsca [28]=s2_stoj [29]=nr_homologacji
  //
  // STARY FORMAT (sprzed 2017, właściciel PRZED VIN, VIN na poz. ~11):
  //   [0]=nrRej [1]=PL [2]=nazwisko [3]=imię [4..10]=adres+PESEL [11]=VIN
  //   [12]=marka [13]=model [14]=typ [15]=rok [16]=kategoria [17]=poj [18]=moc
  //   [19]=DMC [20]=masa [21]=paliwo [22]=miejsca ...
  _parse(text) {
    const d = {};
    const parts = text.split('|').map(s => s.trim());

    const VIN_RE  = /^[A-HJ-NPR-Z0-9]{17}$/i;
    const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;
    const NUM_RE  = /^\d+$/;
    const YEAR_RE = /^\d{4}$/;
    const KAT_RE  = /^[A-Z]\d[A-Z]?$/;

    const vi = parts.findIndex(p => VIN_RE.test(p));
    if (vi < 0) return d;

    d.vin = parts[vi].toUpperCase();

    const p = idx => (parts[idx] || '').trim();
    const num = idx => NUM_RE.test(p(idx)) ? p(idx) : undefined;

    if (vi === 9) {
      // ── NOWY FORMAT (BAS/BAV/BAY) ────────────────────────────────────────
      d.nrRej    = p(3).replace(/\s/g, '').toUpperCase() || p(0).replace(/\s/g,'').toUpperCase();
      d.marka    = p(4).toUpperCase() || undefined;
      d.typ      = p(5) || undefined;
      d.model    = p(8) || undefined;
      if (DATE_RE.test(p(10))) d.dataRej = p(10);
      if (KAT_RE.test(p(12))) d.kategoria = p(12);
      // Technika (nowy format: właściciel zajmuje pola 13-16)
      d.dmcKg     = num(17);   // F.1 DMC
      d.masaWlKg  = num(20);   // G masa własna
      d.pojSilnika = num(23);  // P.1 pojemność
      d.mocKW      = num(24);  // P.2 moc kW
      d.paliwo     = p(25) || undefined;   // P.3
      d.dmcZespolu = num(19);  // F.3 DMC zespołu
      if (/^[1-6]$/.test(p(26))) d.liczbaOsi = p(26);
      if (NUM_RE.test(p(27)) && +p(27) < 200) d.miejscaSied = p(27);
      if (NUM_RE.test(p(28)) && +p(28) < 200) d.miejscaStoj = p(28);
      d.homologacja = p(29) || undefined;
      d.seriaDR     = p(0) || undefined;
      d.nrDR        = p(1) || undefined;
    } else {
      // ── STARY FORMAT (właściciel przed VIN) ──────────────────────────────
      d.nrRej = p(0).replace(/\s/g, '').toUpperCase();
      const a = off => p(vi + off);

      d.marka = a(1).toUpperCase() || undefined;
      if (a(3) && !YEAR_RE.test(a(3)) && !KAT_RE.test(a(3)) && !NUM_RE.test(a(3))) {
        d.typ = a(3);
      } else if (a(2) && !YEAR_RE.test(a(2))) {
        d.typ = a(2);
      }
      if (YEAR_RE.test(a(4)) && +a(4) >= 1970) d.rokProd = a(4);
      else if (YEAR_RE.test(a(3)) && +a(3) >= 1970) d.rokProd = a(3);
      if (KAT_RE.test(a(5))) d.kategoria = a(5);
      if (NUM_RE.test(a(6))) d.pojSilnika = a(6);
      if (NUM_RE.test(a(7))) d.mocKW = a(7);
      if (NUM_RE.test(a(8))) d.dmcKg = a(8);
      if (NUM_RE.test(a(9))) d.masaWlKg = a(9);
      if (a(10) && !NUM_RE.test(a(10)) && !DATE_RE.test(a(10))) d.paliwo = a(10);
      if (NUM_RE.test(a(11)) && +a(11) < 200) d.miejscaSied = a(11);
      for (let off = 12; off <= 15; off++) {
        if (DATE_RE.test(a(off)) && !d.dataRej) { d.dataRej = a(off); break; }
      }
      if (NUM_RE.test(a(15)) && +a(15) > 1000) d.dmcZespolu = a(15);
      else if (NUM_RE.test(a(14)) && +a(14) > 1000) d.dmcZespolu = a(14);
      if (/^[1-6]$/.test(a(16))) d.liczbaOsi = a(16);
      // Właściciel przed VIN
      if (vi >= 3) {
        d._ownerName = [parts[2], parts[3]].filter(Boolean).join(' ').trim();
      }
    }

    // Usuń puste wartości
    Object.keys(d).forEach(k => { if (!d[k] && d[k] !== 0) delete d[k]; });

    return d;
  },

  // ── Wyświetlanie wyników ──────────────────────────────────────────────────
  _renderResult(rawText, d) {
    const row = (lbl, val, mono) => val
      ? `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--border)">
           <span style="font-size:11px;color:var(--text2);min-width:150px;flex-shrink:0">${lbl}</span>
           <strong style="font-size:12px;${mono ? 'font-family:var(--mono,monospace)' : ''}">${val}</strong>
         </div>` : '';

    const fields = [
      row('Nr rejestracyjny (A)', d.nrRej, true),
      row('VIN (E)', d.vin, true),
      row('Marka (D.1)', d.marka),
      row('Typ / model (D.2)', d.typ),
      row('Rok produkcji', d.rokProd),
      row('Kategoria (J)', d.kategoria),
      row('DMC (F.1) kg', d.dmcKg),
      row('Masa własna (G) kg', d.masaWlKg),
      row('DMC zespołu (F.3) kg', d.dmcZespolu),
      row('Pojemność (P.1) cm³', d.pojSilnika),
      row('Moc (P.2) kW', d.mocKW),
      row('Paliwo (P.3)', d.paliwo),
      row('Miejsca siedz. (S.1)', d.miejscaSied),
      row('Liczba osi (L)', d.liczbaOsi),
      row('Zawieszenie', d.zawieszenie),
      row('Data 1. rejestracji (B)', d.dataRej),
    ].join('');

    const ownerInfo = d._ownerName
      ? `<div style="font-size:11px;color:var(--text2);margin-top:8px;padding-top:8px;border-top:0.5px solid var(--border)">
           👤 Właściciel: <strong>${d._ownerName}</strong>${d._ownerCity ? ' · ' + d._ownerCity : ''}
         </div>` : '';

    document.getElementById('aztec-fields').innerHTML =
      (fields || '<span style="color:var(--text3)">Nie rozpoznano pól — sprawdź surowy tekst poniżej</span>') + ownerInfo;

    document.getElementById('aztec-raw').textContent = rawText;
    document.getElementById('aztec-result').style.display = 'block';
  },

  // ── OCR fallback — /api/ai/ocr (PaddleOCR → CF AI → Groq) ──────────────
  async _ocrFallback() {
    // Dla PDF: strona 1 ma dane pojazdu (też w starym "Dowód Stały")
    // Dla zdjęć: użyj ostatniego skanu
    const pages = [this._firstPageDataUrl, this._lastScanDataUrl].filter(Boolean);
    if (!pages.length) throw new Error('Brak obrazu do OCR');

    const token = localStorage.getItem('cf_token') || '';
    const workerUrl = window.CF_WORKER_URL || '';

    for (const dataUrl of pages) {
      const semiIdx = dataUrl.indexOf(';');
      const mimeType = dataUrl.slice(5, semiIdx) || 'image/jpeg';
      const imageBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      try {
        const resp = await fetch(`${workerUrl}/api/ai/ocr`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType }),
          signal: AbortSignal.timeout(35000),
        });
        if (!resp.ok) continue;
        const result = await resp.json();
        if (result.ok && result.fields) {
          const f = result.fields;
          // Sprawdź czy znaleziono cokolwiek użytecznego
          if (f.nrRej || f.vin || f.marka || f.dmcKg) return f;
        }
      } catch { /* spróbuj kolejnej strony */ }
    }
    throw new Error('OCR nie odnalazł danych w dokumencie');
  },

  // ── Wyświetlanie wyników OCR — ten sam układ co AZTEC ale inne etykiety ─
  _renderOcrResult(d) {
    const hdr = document.querySelector('#aztec-result > div:first-child');
    if (hdr) {
      hdr.style.color = 'var(--blue,#2563eb)';
      hdr.innerHTML = '<i class="ti ti-brain"></i> Dane odczytane przez AI OCR — sprawdź przed zastosowaniem';
    }
    const smry = document.querySelector('#aztec-result details summary');
    if (smry) smry.textContent = '🔍 JSON z AI OCR (rozwiń)';
    this._renderResult(JSON.stringify(d, null, 2), d);
  },

  // ── Zastosowanie danych ───────────────────────────────────────────────────
  _apply() {
    if (!this._parsed) return;

    const d = {
      nrRej:     this._parsed.nrRej,
      vin:       this._parsed.vin,
      marka:     this._parsed.marka,
      typ:       this._parsed.typ,
      rokProd:   this._parsed.rokProd,
      kategoria: this._parsed.kategoria,
      dmcKg:     this._parsed.dmcKg,
      dmcZespolu:this._parsed.dmcZespolu,
      masaWlKg:  this._parsed.masaWlKg,
      pojSilnika:this._parsed.pojSilnika,
      mocKW:     this._parsed.mocKW,
      paliwo:    this._parsed.paliwo,
      miejscaSied:this._parsed.miejscaSied,
      liczbaOsi: this._parsed.liczbaOsi,
      zawieszenie:this._parsed.zawieszenie,
      dataRej:   this._parsed.dataRej,
      typDokumentu: 'AZTEC',
      pewnosc:   'AZTEC'
    };

    this.close();

    if (this._vehId !== undefined && typeof openUpdateModal === 'function') {
      // Bezpośrednia aktualizacja konkretnego pojazdu
      openUpdateModal(this._vehId, d);
    } else if (typeof showManualForm === 'function') {
      // Fallback: przejdź do strony OCR i pokaż formularz
      if (typeof showPage === 'function') showPage('skan');
      showManualForm(d, this._rawText, null);
    }
  }
};
