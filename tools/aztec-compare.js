/**
 * TaxOrder Pro — porównanie dwóch ścieżek dekodowania Aztec na PRAWDZIWYM dowodzie.
 *
 * Uruchom:
 *   npm i --no-save @zxing/library@0.20.0        # jednorazowo, jeśli brak
 *   node tools/aztec-compare.js <sciezka-do-zdjecia.jpg>
 *
 * ŚCIEŻKA A — obecna, produkcyjna: ZXing z wymuszonym CHARACTER_SET ISO-8859-1,
 *   bajty odzyskiwane przez `text.charCodeAt(i) & 0xFF`. Odwzorowanie
 *   `tryAztecFromCanvas()` z app.js — trzymaj zgodne, jeśli tamta się zmieni.
 *
 * ŚCIEŻKA B — `modules/aztec-detector.js`: kaskada 9 strategii, 42 próby.
 *   Jest ładowana w index.html, ale w APLIKACJI nikt jej nie woła — używają jej
 *   wyłącznie narzędzia deweloperskie. Wola `.getText()` BEZ wskazówki
 *   CHARACTER_SET, czego skutków dla ładunku BINARNEGO nikt nie sprawdził.
 *
 * PYTANIE, NA KTÓRE TO ODPOWIADA: czy ścieżka B zwraca bajty zdatne do NRV2E.
 * `tools/aztec-bench.html` tego NIE mierzy — porównuje wyłącznie skuteczność
 * DETEKCJI i nigdy nie konwertuje wyniku z powrotem na bajty. Dlatego detektora
 * nie wolno podpiąć na podstawie tamtego benchmarku.
 *
 * KRYTERIUM: pierwsze 4 bajty ładunku DR to długość po dekompresji (uint32 LE),
 * którą `handleAztec` w Workerze przyjmuje w zakresie 10..131072. Ładunek
 * zniekształcony przez konwersję znakową prawie na pewno wypadnie poza ten zakres.
 *
 * UWAGA NA DANE: dowód rejestracyjny zawiera VIN i dane właściciela. Trzymaj
 * zdjęcie POZA repozytorium; skrypt nic nie zapisuje i drukuje wyłącznie
 * pierwsze bajty w postaci szesnastkowej.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const SELFTEST = process.argv.includes('--selftest');
const obraz = SELFTEST ? null : process.argv[2];
if (!SELFTEST && (!obraz || !fs.existsSync(obraz))) {
  console.error('Podaj ścieżkę do zdjęcia dowodu: node tools/aztec-compare.js <plik>');
  console.error('albo uruchom kontrolę wierności bajtów:  node tools/aztec-compare.js --selftest');
  process.exit(2);
}

/**
 * Ładunek kontrolny dla --selftest. Zawiera bajty z zakresu 0x80–0x9F, czyli te,
 * na których wykłada się konwersja znakowa: w CP1252 `0x80` to znak euro (U+20AC),
 * więc `charCodeAt(i) & 0xFF` zwraca 0xAC zamiast 0x80. NRV2E produkuje dowolne
 * bajty, więc ten zakres w prawdziwym dowodzie WYSTĄPI.
 */
const KONTROLNY = [100, 0, 0, 0, 0x80, 0x81, 0x8D, 0x90, 0x9F, 0xFF, 0x41, 0x42, 0xAB, 0x7A];

// Chromium jest preinstalowany w tym środowisku; wersja z node_modules szuka innego
// builda i podpowiada `npx playwright install` — nie uruchamiaj go, wskaż binarkę.
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ZXING = path.join(ROOT, 'node_modules', '@zxing', 'library', 'umd', 'index.min.js');

(async () => {
  if (!fs.existsSync(ZXING)) {
    console.error('Brak @zxing/library. Uruchom: npm i --no-save @zxing/library@0.20.0');
    process.exit(2);
  }
  const { chromium } = require(path.join(ROOT, 'node_modules', '@playwright', 'test'));

  // --selftest: generujemy wlasny kod Aztec o ZNANYM ladunku, zeby zmierzyc
  // WIERNOSC BAJTOW, a nie tylko skutecznosc detekcji.
  let obrazBuf;
  if (SELFTEST) {
    const Z = require(path.join(ROOT, 'node_modules', '@zxing', 'library'));
    const code = Z.AztecEncoder.encode(Uint8Array.from(KONTROLNY), 33, Z.AztecEncoder.DEFAULT_AZTEC_LAYERS);
    const m = code.getMatrix();
    const px = []; for (let y=0;y<m.getHeight();y++){const r=[];for(let x=0;x<m.getWidth();x++)r.push(m.get(x,y)?1:0);px.push(r);}
    const b0 = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const p0 = await b0.newPage();
    const S=10,Q=40,W=m.getWidth()*S+2*Q,H=m.getHeight()*S+2*Q;
    const du = await p0.evaluate(({px,S,Q,W,H})=>{
      const c=document.createElement('canvas');c.width=W;c.height=H;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';
      for(let i=0;i<px.length;i++)for(let j=0;j<px[i].length;j++)if(px[i][j])x.fillRect(Q+j*S,Q+i*S,S,S);
      return c.toDataURL('image/png');
    },{px,S,Q,W,H});
    await b0.close();
    obrazBuf = Buffer.from(du.split(',')[1],'base64');
  }

  // Serwer lokalny: strona ładuje ZXing z DYSKU, nie z CDN — kontener nie ma sieci.
  const srv = http.createServer((req, res) => {
    const mapa = {
      '/': ['text/html', Buffer.from('<!doctype html><meta charset="utf-8"><title>aztec</title>')],
      '/zxing.js': ['application/javascript', fs.readFileSync(ZXING)],
      '/detector.js': ['application/javascript', fs.readFileSync(path.join(ROOT, 'modules', 'aztec-detector.js'))],
      '/obraz': ['application/octet-stream', SELFTEST ? obrazBuf : fs.readFileSync(obraz)],
    };
    const wpis = mapa[req.url];
    if (!wpis) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': wpis[0] });
    res.end(wpis[1]);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.addScriptTag({ url: '/zxing.js' });
  await page.addScriptTag({ url: '/detector.js' });

  const wynik = await page.evaluate(async () => {
    const img = new Image();
    await new Promise(res => { img.onload = res; img.onerror = res; img.src = '/obraz'; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    if (!canvas.width) return { blad: 'nie udało się wczytać obrazu' };

    // Odwrócenie windows-1252 — kopia `_aztecTextToBytes` z app.js. Trzymaj zgodne:
    // to jedyne miejsce, w którym mierzymy wierność bajtów, więc rozjazd tutaj
    // ukryłby dokładnie ten błąd, który ten skrypt ma wykrywać.
    const CP = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,
      0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,
      0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,
      0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
    const naBajty = t => { const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); u[i] = CP[c] !== undefined ? CP[c] : (c & 0xFF); } return u; };
    // Stara konwersja — pokazujemy w selfteście, co dokładnie naprawiono.
    const naBajtyStare = t => { const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i) & 0xFF; return u; };

    // ── Ścieżka A: dokładnie jak tryAztecFromCanvas() w app.js ──────────────
    function sciezkaA(c) {
      try {
        const hints = new Map([
          [ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.AZTEC]],
          [ZXing.DecodeHintType.TRY_HARDER, true],
          [ZXing.DecodeHintType.CHARACTER_SET, 'ISO-8859-1'],
        ]);
        const reader = new ZXing.MultiFormatReader(); reader.setHints(hints);
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const argb = new Int32Array(c.width * c.height);
        for (let i = 0; i < argb.length; i++) argb[i] = (d.data[i*4] << 16) | (d.data[i*4+1] << 8) | d.data[i*4+2];
        const lum = new ZXing.RGBLuminanceSource(argb, c.width, c.height);
        const r = reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum)));
        return { ok: true, bajty: Array.from(naBajty(r.getText())), bajtyStare: Array.from(naBajtyStare(r.getText())) };
      } catch (e) { return { ok: false, blad: String(e && e.message || e).slice(0, 120) }; }
    }

    // Aplikacja próbuje czterech obrotów — odwzorowujemy to samo.
    let A = { ok: false, blad: 'brak wyniku' };
    for (const deg of [0, 90, 270, 180]) {
      const c = document.createElement('canvas');
      const obr = deg % 180 !== 0;
      c.width = obr ? canvas.height : canvas.width;
      c.height = obr ? canvas.width : canvas.height;
      const cx = c.getContext('2d');
      cx.translate(c.width / 2, c.height / 2); cx.rotate(deg * Math.PI / 180);
      cx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      const r = sciezkaA(c);
      if (r.ok) { A = { ...r, obrot: deg }; break; }
      A = r;
    }

    // ── Ścieżka B: TaxOrderAztecDetector ────────────────────────────────────
    let B;
    try {
      const r = await window.TaxOrderAztecDetector.detect(canvas, { budget: 10000 });
      B = r ? { ok: true, strategia: r.strategy, proby: r.attempts, bajty: Array.from(naBajty(r.text)), bajtyStare: Array.from(naBajtyStare(r.text)) }
            : { ok: false, blad: 'detect() zwrócił null' };
    } catch (e) { B = { ok: false, blad: String(e && e.message || e).slice(0, 120) }; }

    return { A, B };
  });

  await browser.close(); srv.close();

  if (wynik.blad) { console.error(wynik.blad); process.exit(1); }

  const hex = b => b.slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(' ');
  // Kryterium z handleAztec(): pierwsze 4 bajty to długość po dekompresji (uint32 LE).
  const naglowekOk = b => { if (!b || b.length < 8) return false; const n = b[0] | (b[1]<<8) | (b[2]<<16) | (b[3]*0x1000000); return n >= 10 && n <= 131072; };

  console.log('\nPorównanie ścieżek dekodowania Aztec\n');
  for (const [nazwa, r] of [['A (obecna, ISO-8859-1)', wynik.A], ['B (TaxOrderAztecDetector)', wynik.B]]) {
    if (!r.ok) { console.log(`  ${nazwa.padEnd(28)} ✗ ${r.blad}`); continue; }
    const ok = naglowekOk(r.bajty);
    const dl = r.bajty[0] | (r.bajty[1]<<8) | (r.bajty[2]<<16) | (r.bajty[3]*0x1000000);
    console.log(`  ${nazwa.padEnd(28)} ${ok ? '✓' : '✗'} bajtów=${r.bajty.length} nagłówek=${dl} ${ok ? '(w zakresie 10..131072)' : '(POZA zakresem — ładunek zniekształcony)'}`);
    console.log(`  ${' '.repeat(30)}pierwsze bajty: ${hex(r.bajty)}`);
    if (r.strategia) console.log(`  ${' '.repeat(30)}strategia: ${r.strategia}, prób: ${r.proby}`);
  }

  if (SELFTEST) {
    console.log('\nKontrola wierności bajtów (ładunek znany):');
    console.log(`  oczekiwano: ${hex(KONTROLNY)}`);
    let bledy = 0;
    for (const [nazwa, r] of [['A', wynik.A], ['B', wynik.B]]) {
      if (!r.ok) { console.log(`  ${nazwa}: ✗ nie odczytano`); bledy++; continue; }
      const zgodne = r.bajty.length === KONTROLNY.length && r.bajty.every((x,i)=>x===KONTROLNY[i]);
      const zle = r.bajty.map((x,i)=>x!==KONTROLNY[i]?`poz.${i}: ${KONTROLNY[i].toString(16)}→${x.toString(16)}`:null).filter(Boolean);
      console.log(`  ${nazwa}: ${zgodne?'✓ bajty wierne':'✗ ZNIEKSZTAŁCONE — '+zle.join(', ')}`);
      if (r.bajtyStare) {
        const zleStare = r.bajtyStare.map((x,i)=>x!==KONTROLNY[i]?`${KONTROLNY[i].toString(16)}→${x.toString(16)}`:null).filter(Boolean);
        console.log(`     bez naprawy (charCodeAt & 0xFF): ${zleStare.length?'✗ '+zleStare.join(', '):'✓ wierne'}`);
      }
      if (!zgodne) bledy++;
    }
    console.log(bledy
      ? '\n  Konwersja znakowa psuje bajty 0x80–0x9F (CP1252). Ładunek NRV2E zawiera dowolne\n  bajty, więc dotyczy to prawdziwych dowodów. Trzeba czytać bajty bez warstwy tekstowej.\n'
      : '\n  Obie ścieżki zachowują bajty wiernie.\n');
    process.exit(bledy ? 1 : 0);
  }

  const aOk = wynik.A.ok && naglowekOk(wynik.A.bajty);
  const bOk = wynik.B.ok && naglowekOk(wynik.B.bajty);
  console.log('\nWniosek:');
  if (bOk && aOk) {
    const zgodne = wynik.A.bajty.length === wynik.B.bajty.length && wynik.A.bajty.every((x, i) => x === wynik.B.bajty[i]);
    console.log(zgodne
      ? '  Obie ścieżki dają IDENTYCZNE bajty — detektor można podpiąć bez zmiany zachowania.'
      : '  Obie dają poprawny nagłówek, ale RÓŻNE bajty — sprawdź, która wersja parsuje się w Workerze.');
  } else if (bOk) {
    console.log('  Tylko ścieżka B daje użyteczny ładunek — detektor jest lepszy, warto podpiąć.');
  } else if (aOk) {
    console.log('  Tylko ścieżka A daje użyteczny ładunek. NIE podpinaj detektora: jego .getText()');
    console.log('  bez CHARACTER_SET zniekształca bajty binarne. Najpierw popraw detektor.');
  } else {
    console.log('  Żadna ścieżka nie odczytała kodu z tego zdjęcia — spróbuj ostrzejszego ujęcia.');
  }
  console.log('');
})();
