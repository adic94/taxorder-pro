/**
 * Kompleksowy test OCR — Dowód rejestracyjny WPR0365T
 * PDF jest SKANEM (nie ma warstwy tekstu) — renderujemy przez pdfjs-dist z canvas
 */
import fs from 'fs';
import { createCanvas, Image, createImageData } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Patch globalThis żeby pdfjs-dist znalazł Image z modułu canvas
globalThis.Image = Image;
globalThis.createImageData = createImageData;

const PDF_PATH = 'C:/Users/acichocki/AppData/Local/Temp/dr_test.pdf';
const API = 'https://taxorder-pro-api.adamus1000.workers.dev';

class NodeCanvasFactory {
  create(w, h) {
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    return { canvas: c, context: ctx };
  }
  reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
  destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; }
}

async function renderPdfPage(pageNum, scale = 3.5) {
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const pdf = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    nativeImageDecoderSupport: 'none',
  }).promise;

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const factory = new NodeCanvasFactory();
  const { canvas, context } = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));

  await page.render({ canvasContext: context, viewport, canvasFactory: factory }).promise;
  return canvas.toBuffer('image/jpeg', { quality: 0.95 });
}

async function callOcrApi(b64, label) {
  console.log(`\n  → OCR API [${label}]...`);
  const resp = await fetch(`${API}/api/ai/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: b64, mimeType: 'image/jpeg' }),
  });
  const r = await resp.json();
  console.log(`  Model: ${r.model || '?'}`);
  if (r.fields) {
    const f = r.fields;
    console.log(`  nrRej:    ${f.nrRej || '(brak)'}`);
    console.log(`  vin:      ${f.vin   || '(brak)'}`);
    console.log(`  marka:    ${f.marka || '(brak)'}`);
    console.log(`  dataRej:  ${f.dataRej || '(brak)'}`);
    console.log(`  dmcKg:    ${f.dmcKg || '(brak)'}`);
    console.log(`  kategoria:${f.kategoria || '(brak)'}`);
    console.log(`  przeznaczenie: ${f.przeznaczenie || '(brak)'}`);
    console.log('  Wszystkie pola:', JSON.stringify(f));
  } else {
    console.log('  Odpowiedź:', JSON.stringify(r));
  }
  return r;
}

(async () => {
  console.log('══════════════════════════════════════════════════');
  console.log('  TEST OCR — WPR0365T dowód stały.pdf (skan)');
  console.log('══════════════════════════════════════════════════');

  // Renderuj strony
  for (const pageNum of [1, 2]) {
    console.log(`\n[${pageNum}/2] Renderowanie strony ${pageNum}...`);
    let buf;
    try {
      buf = await renderPdfPage(pageNum, 3.5);
      const outFile = `test_page${pageNum}.jpg`;
      fs.writeFileSync(outFile, buf);
      console.log(`  OK: ${Math.round(buf.length/1024)} KB → ${outFile}`);
    } catch (e) {
      console.log(`  BŁĄD renderowania: ${e.message}`);
      // Spróbuj niższy scale
      try {
        buf = await renderPdfPage(pageNum, 2.0);
        const outFile = `test_page${pageNum}_low.jpg`;
        fs.writeFileSync(outFile, buf);
        console.log(`  OK (scale 2.0): ${Math.round(buf.length/1024)} KB → ${outFile}`);
      } catch (e2) {
        console.log(`  BŁĄD (scale 2.0): ${e2.message}`);
        continue;
      }
    }

    // Sprawdź obraz
    const preview = buf.slice(0, 100);
    const allWhite = [...buf.slice(0, 3000)].every(b => b > 250);
    if (allWhite) {
      console.log('  ⚠ Obraz wygląda na biały — renderowanie nieprawidłowe');
      continue;
    }

    await callOcrApi(buf.toString('base64'), `Strona ${pageNum}`);
  }

  // Sprawdź logi wrangler tail
  console.log('\n══════════════════════════════════════════════════');
  const logFile = 'C:/Users/acichocki/AppData/Local/Temp/wrangler_tail.log';
  try {
    const logs = fs.readFileSync(logFile, 'utf8');
    const ocrLines = logs.split('\n').filter(l => l.includes('OCR') || l.includes('VIN') || l.includes('vin'));
    if (ocrLines.length) {
      console.log(`\n[LOGI WORKERA — ${ocrLines.length} wpisów OCR/VIN]:`);
      ocrLines.forEach(l => console.log(' ', l));
    } else {
      console.log('\nBrak logów OCR w wrangler tail (może jeszcze nie nadeszły)');
    }
  } catch { console.log('\nBrak pliku logów wrangler tail'); }
})().catch(e => { console.error('BŁĄD:', e.message, '\n', e.stack?.split('\n').slice(0,5).join('\n')); process.exit(1); });
