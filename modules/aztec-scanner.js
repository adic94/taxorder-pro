// ==================== AZTEC SCANNER — Dowód Rejestracyjny ====================
// Dekoduje kod AZTEC z ostatniej strony DR, parsuje dane pojazdu i integruje
// z istniejącym flow openUpdateModal / showManualForm (jak OCR Tesseract).
// Wymaga: @zxing/library (UMD global ZXing) załadowanego w index.html.

window.AztecScanner = {

  _vehId: undefined,
  _parsed: null,
  _rawText: '',

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
            <i class="ti ti-upload"></i>Wgraj plik
            <input type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff,image/*" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer" onchange="AztecScanner._handleFile(this.files[0])">
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
    box.innerHTML = `<i class="ti ${icons[type] || 'ti-info-circle'}"${spin}></i><span>${msg}</span>`;
  },

  // ── Obsługa pliku ─────────────────────────────────────────────────────────
  async _handleFile(file) {
    if (!file) return;

    // Podgląd
    const img = document.getElementById('aztec-preview-img');
    img.style.display = 'block';
    img.src = URL.createObjectURL(file);

    this._setStatus('loading', 'Dekodowanie kodu AZTEC… może chwilę potrwać.');
    document.getElementById('aztec-result').style.display = 'none';

    try {
      const text = await this._decode(file);
      if (!text || !text.trim()) throw new Error('Kod AZTEC pusty lub nieczytelny');
      this._rawText = text;
      this._parsed = this._parse(text);
      this._renderResult(text, this._parsed);
      this._setStatus('ok', 'Kod AZTEC zdekodowany. Sprawdź dane i kliknij „Zastosuj".');
    } catch (e) {
      this._setStatus('warn',
        'Nie znaleziono kodu AZTEC. Upewnij się że zdjęcie pokazuje <strong>ostatnią stronę DR</strong> z kwadratowym kodem. ' +
        'Spróbuj lepszego oświetlenia lub innego kąta. Szczegół: ' + e.message);
      console.error('[AZTEC]', e);
    }
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
  // Format polskiego DR (po 2016): pipe-separated, VIN na poz. ~11
  // [0]=nrRej [1]=PL [2]=nazwisko [3]=imię [4]=PESEL/NIP [5-10]=adres
  // [11]=VIN [12]=marka [13]=model handlowy [14]=typ [15]=rok [16]=kategoria
  // [17]=pojemność cm³ [18]=moc kW [19]=DMC kg [20]=masa własna kg
  // [21]=paliwo [22]=miejsca [23]=data 1.rej [24]=data rej.PL [25]=ważny do
  // [26]=DMC zespołu [27]=osie [28]=zawieszenie
  _parse(text) {
    const d = {};
    const parts = text.split('|').map(s => s.trim());

    const VIN_RE  = /^[A-HJ-NPR-Z0-9]{17}$/i;
    const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;
    const NUM_RE  = /^\d+$/;
    const YEAR_RE = /^\d{4}$/;
    const KAT_RE  = /^[A-Z]\d[A-Z]?$/;   // N3, N2G, O4, M1 …

    const vi = parts.findIndex(p => VIN_RE.test(p));
    if (vi < 0) return d;   // brak VIN — nie parsujemy

    d.vin   = parts[vi].toUpperCase();
    d.nrRej = (parts[0] || '').replace(/\s/g, '').toUpperCase();

    // Dostęp do pól po VIN (z zabezpieczeniem przed undefined)
    const a = off => (parts[vi + off] || '').trim();

    d.marka    = a(1).toUpperCase() || undefined;
    // +2 to model handlowy (pomijamy), +3 to typ
    if (a(3) && !YEAR_RE.test(a(3)) && !KAT_RE.test(a(3)) && !NUM_RE.test(a(3))) {
      d.typ = a(3);
    } else if (a(2) && !YEAR_RE.test(a(2))) {
      d.typ = a(2);
    }

    // Rok produkcji
    if (YEAR_RE.test(a(4)) && +a(4) >= 1970 && +a(4) <= 2100) d.rokProd = a(4);
    else if (YEAR_RE.test(a(3)) && +a(3) >= 1970) d.rokProd = a(3);

    // Kategoria
    if (KAT_RE.test(a(5))) d.kategoria = a(5);

    // Dane techniczne (liczby)
    if (NUM_RE.test(a(6))) d.pojSilnika = a(6);     // pojemność cm³
    if (NUM_RE.test(a(7))) d.mocKW = a(7);           // moc kW
    if (NUM_RE.test(a(8))) d.dmcKg = a(8);           // DMC kg
    if (NUM_RE.test(a(9))) d.masaWlKg = a(9);        // masa własna kg

    // Paliwo — tekst nie-numeryczny
    if (a(10) && !NUM_RE.test(a(10)) && !DATE_RE.test(a(10))) d.paliwo = a(10);

    // Miejsca siedz.
    if (NUM_RE.test(a(11)) && +a(11) < 200) d.miejscaSied = a(11);

    // Data 1. rejestracji (pierwsza z dat)
    for (let off = 12; off <= 15; off++) {
      if (DATE_RE.test(a(off)) && !d.dataRej) { d.dataRej = a(off); break; }
    }

    // DMC zespołu
    if (NUM_RE.test(a(15)) && +a(15) > 1000) d.dmcZespolu = a(15);
    else if (NUM_RE.test(a(14)) && +a(14) > 1000) d.dmcZespolu = a(14);

    // Liczba osi
    if (/^[1-6]$/.test(a(16))) d.liczbaOsi = a(16);
    else if (/^[1-6]$/.test(a(17))) d.liczbaOsi = a(17);

    // Zawieszenie
    const zawRaw = (a(17) || a(18)).toLowerCase();
    if (zawRaw.includes('pneum'))       d.zawieszenie = 'pneumatyczne';
    else if (zawRaw.includes('równ') || zawRaw.includes('rowno')) d.zawieszenie = 'równoważne';
    else if (zawRaw.length > 2)         d.zawieszenie = 'inne';

    // Właściciel (dane pomocnicze — nie mapujemy do pojazdu, tylko do podglądu)
    if (vi >= 3) {
      d._ownerName = [parts[2], parts[3]].filter(Boolean).join(' ').trim();
    }
    if (vi >= 5 && parts[vi - 3]) {
      d._ownerCity = [parts[vi - 3], parts[vi - 2]].filter(Boolean).join(' ').trim();
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
