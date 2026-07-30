/**
 * TaxOrder Pro — Aztec Detector (czysty silnik, bez interfejsu)
 * Kaskada 9 strategii, max 42 próby, budżet czasu 6 s.
 *
 * API:
 *   const r = await TaxOrderAztecDetector.detect(canvas, { budget: 6000 });
 *   // r === null przy porażce
 *   // r === { text, strategy, attempts, timeMs } przy sukcesie
 *
 * Wymaga: window.ZXing załadowanego przed tym plikiem (z index.html).
 *
 * Etapy 0–1 odtwarzają dokładnie to, co robią tryAztecFromCanvas (app.js)
 * i AztecScanner._decode (aztec-scanner.js). Etapy 2–5 to rozszerzenia.
 */
window.TaxOrderAztecDetector = (function () {

  // ── Rotacja ──────────────────────────────────────────────────────────────────
  // Obsługuje zarówno wielokrotności 90° jak i dowolne kąty (np. ±8°, ±15°).
  function _rotate(src, deg) {
    if (deg === 0) return src;
    const rad = deg * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const W = src.width, H = src.height;
    const nw = Math.round(W * cos + H * sin);
    const nh = Math.round(W * sin + H * cos);
    const c = document.createElement('canvas');
    c.width = nw; c.height = nh;
    const ctx = c.getContext('2d');
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(rad);
    ctx.drawImage(src, -W / 2, -H / 2);
    return c;
  }

  // ── Piksel → luminancja (BT.601) ─────────────────────────────────────────────
  function _pixelsToLum(data, N) {
    const lum = new Uint8Array(N);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      lum[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }
    return lum;
  }

  // ── Rozciąganie kontrastu (percentyle p2 – p98) ───────────────────────────────
  function _contrastStretch(src, p2 = 2, p98 = 98) {
    const ctx = src.getContext('2d');
    const id = ctx.getImageData(0, 0, src.width, src.height);
    const d = id.data;
    const N = d.length >> 2;
    const lum = _pixelsToLum(d, N);

    // Percentyle przez histogram (O(N) zamiast sortowania)
    const hist = new Uint32Array(256);
    for (let i = 0; i < N; i++) hist[lum[i]]++;
    const lo_n = Math.floor(N * p2 / 100);
    const hi_n = Math.floor(N * p98 / 100);
    let lo = 0, hi = 255, cum = 0;
    for (let v = 0; v < 256; v++) {
      cum += hist[v];
      if (cum <= lo_n) lo = v;
      if (cum >= hi_n) { hi = v; break; }
    }
    const range = (hi - lo) || 1;

    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const octx = out.getContext('2d');
    const od = octx.createImageData(src.width, src.height);
    const op = od.data;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const v = Math.max(0, Math.min(255, ((lum[j] - lo) / range * 255) | 0));
      op[i] = op[i + 1] = op[i + 2] = v;
      op[i + 3] = 255;
    }
    octx.putImageData(od, 0, 0);
    return out;
  }

  // ── Binaryzacja Otsu ──────────────────────────────────────────────────────────
  function _otsu(src) {
    const ctx = src.getContext('2d');
    const d = ctx.getImageData(0, 0, src.width, src.height).data;
    const N = d.length >> 2;
    const lum = _pixelsToLum(d, N);

    const hist = new Float64Array(256);
    for (let i = 0; i < N; i++) hist[lum[i]]++;
    for (let i = 0; i < 256; i++) hist[i] /= N;

    let sumTotal = 0;
    for (let i = 0; i < 256; i++) sumTotal += i * hist[i];

    let sumB = 0, wB = 0, maxVar = 0, thresh = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB <= 0) continue;
      const wF = 1 - wB;
      if (wF <= 0) break;
      sumB += t * hist[t];
      const muB = sumB / wB;
      const muF = (sumTotal - sumB) / wF;
      const v = wB * wF * (muB - muF) ** 2;
      if (v > maxVar) { maxVar = v; thresh = t; }
    }

    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const octx = out.getContext('2d');
    const od = octx.createImageData(src.width, src.height);
    const op = od.data;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const v = lum[j] <= thresh ? 0 : 255;
      op[i] = op[i + 1] = op[i + 2] = v;
      op[i + 3] = 255;
    }
    octx.putImageData(od, 0, 0);
    return out;
  }

  // ── Kafelkowanie z zakładką ───────────────────────────────────────────────────
  // overlap=0.25 oznacza, że każdy kafelek zachodzi na sąsiada o 25% swojego wymiaru.
  function _tiles(src, nx, ny, overlap = 0.25) {
    const W = src.width, H = src.height;
    const sx = W / nx, sy = H / ny;
    const tw = Math.min(W, Math.round(sx * (1 + overlap)));
    const th = Math.min(H, Math.round(sy * (1 + overlap)));
    const result = [];
    for (let r = 0; r < ny; r++) {
      for (let col = 0; col < nx; col++) {
        const x = Math.max(0, Math.min(W - tw, Math.round(col * sx - sx * overlap / 2)));
        const y = Math.max(0, Math.min(H - th, Math.round(r * sy - sy * overlap / 2)));
        const t = document.createElement('canvas');
        t.width = tw; t.height = th;
        t.getContext('2d').drawImage(src, x, y, tw, th, 0, 0, tw, th);
        result.push(t);
      }
    }
    return result;
  }

  // ── Powiększenie ×2 ──────────────────────────────────────────────────────────
  function _scale2x(src) {
    const out = document.createElement('canvas');
    out.width = src.width * 2; out.height = src.height * 2;
    out.getContext('2d').drawImage(src, 0, 0, out.width, out.height);
    return out;
  }

  // ── Jedna próba dekodowania (1 canvas + 1 binarizer) ─────────────────────────
  // Zwraca tekst przy sukcesie, null przy porażce.
  function _tryOne(canvas, Binarizer, hints) {
    try {
      const lum = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      const rdr = new ZXing.MultiFormatReader();
      rdr.setHints(hints);
      const text = rdr.decode(new ZXing.BinaryBitmap(new Binarizer(lum))).getText();
      if (text) return text;
    } catch { /* brak kodu */ }
    return null;
  }

  // ── Próba S0 przez RGBLuminanceSource (dokładne odwzorowanie app.js) ─────────
  // app.js:tryAztecFromCanvas używa RGBLuminanceSource, nie HTMLCanvasElementLuminanceSource.
  function _tryOneRGB(canvas, hints) {
    try {
      const id = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const argb = new Int32Array(canvas.width * canvas.height);
      const d = id.data;
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        argb[j] = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      }
      const lum = new ZXing.RGBLuminanceSource(argb, canvas.width, canvas.height);
      const rdr = new ZXing.MultiFormatReader();
      rdr.setHints(hints);
      const text = rdr.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum))).getText();
      if (text) return text;
    } catch { /* brak kodu */ }
    return null;
  }

  // ── Główna funkcja detekcji ───────────────────────────────────────────────────
  /**
   * @param {HTMLCanvasElement} canvas  — obraz wejściowy (nie musi być obrócony)
   * @param {{ budget?: number }} opts  — opcjonalny budżet ms (domyślnie 6000)
   * @returns {Promise<{text:string, strategy:string, attempts:number, timeMs:number}|null>}
   */
  async function detect(canvas, opts = {}) {
    if (!window.ZXing) return null;

    const budget = opts.budget ?? 6000;
    const t0 = Date.now();
    const MAX = 42;
    let attempts = 0;

    const hints = new Map([
      [ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.AZTEC]],
      [ZXing.DecodeHintType.TRY_HARDER, true],
    ]);

    const MAIN_ROTS  = [0, 90, 270, 180];
    const EXTRA_ROTS = [8, -8, 15, -15];

    // Testuje jeden canvas jednym binarizerem; liczy próbę i sprawdza budżet.
    function _attempt(c, Binarizer, label) {
      if (attempts >= MAX || Date.now() - t0 > budget) return null;
      attempts++;
      const text = Binarizer === 'RGB'
        ? _tryOneRGB(c, hints)
        : _tryOne(c, Binarizer, hints);
      if (text) return { text, strategy: label };
      return null;
    }

    let r;

    // S0 — odwzorowanie app.js/dr-import: RGBLuminanceSource + HybridBinarizer, 4 obroty (4 prób)
    for (const deg of MAIN_ROTS) {
      r = _attempt(_rotate(canvas, deg), 'RGB', `S0:rgb-hybrid:rot${deg}`);
      if (r) return _finish(r);
    }

    // S1 — odwzorowanie aztec-scanner: HTMLCanvas + GlobalHistogramBinarizer, 4 obroty (4 prób)
    for (const deg of MAIN_ROTS) {
      r = _attempt(_rotate(canvas, deg), ZXing.GlobalHistogramBinarizer, `S1:ghb:rot${deg}`);
      if (r) return _finish(r);
    }

    // S2a — kontrast (p2–p98) + HybridBinarizer, 4 obroty (4 prób)
    const cs = _contrastStretch(canvas);
    for (const deg of MAIN_ROTS) {
      r = _attempt(_rotate(cs, deg), ZXing.HybridBinarizer, `S2a:cs-hybrid:rot${deg}`);
      if (r) return _finish(r);
    }

    // S2b — kontrast (p2–p98) + GlobalHistogramBinarizer, 4 obroty (4 prób)
    for (const deg of MAIN_ROTS) {
      r = _attempt(_rotate(cs, deg), ZXing.GlobalHistogramBinarizer, `S2b:cs-ghb:rot${deg}`);
      if (r) return _finish(r);
    }

    // S3 — Otsu + HybridBinarizer, 4 obroty (4 prób)
    const ot = _otsu(canvas);
    for (const deg of MAIN_ROTS) {
      r = _attempt(_rotate(ot, deg), ZXing.HybridBinarizer, `S3:otsu:rot${deg}`);
      if (r) return _finish(r);
    }

    // S4a — obroty pośrednie + HybridBinarizer (4 prób)
    for (const deg of EXTRA_ROTS) {
      r = _attempt(_rotate(canvas, deg), ZXing.HybridBinarizer, `S4a:hybrid:rot${deg}`);
      if (r) return _finish(r);
    }

    // S4b — obroty pośrednie + GlobalHistogramBinarizer (4 prób)
    for (const deg of EXTRA_ROTS) {
      r = _attempt(_rotate(canvas, deg), ZXing.GlobalHistogramBinarizer, `S4b:ghb:rot${deg}`);
      if (r) return _finish(r);
    }

    // S5a — kafelkowanie 2×2, zakładka 25%, HybridBinarizer (4 prób)
    for (const tile of _tiles(canvas, 2, 2)) {
      r = _attempt(tile, ZXing.HybridBinarizer, 'S5a:tile2x2');
      if (r) return _finish(r);
    }

    // S5b — kafelkowanie 3×3, zakładka 25%, HybridBinarizer (9 prób)
    for (const tile of _tiles(canvas, 3, 3)) {
      r = _attempt(tile, ZXing.HybridBinarizer, 'S5b:tile3x3');
      if (r) return _finish(r);
    }

    // S5c — powiększenie ×2 + HybridBinarizer (1 próba) → łącznie max 42
    r = _attempt(_scale2x(canvas), ZXing.HybridBinarizer, 'S5c:2x');
    if (r) return _finish(r);

    return null;

    function _finish(res) {
      return { text: res.text, strategy: res.strategy, attempts, timeMs: Date.now() - t0 };
    }
  }

  return { detect };
})();
