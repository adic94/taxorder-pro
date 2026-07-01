import fs from 'fs';
import { createCanvas, Image } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// NodeCanvasFactory wymagany przez pdfjs-dist w Node.js
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(canvasAndCtx, width, height) {
    canvasAndCtx.canvas.width = width;
    canvasAndCtx.canvas.height = height;
  }
  destroy(canvasAndCtx) {
    canvasAndCtx.canvas.width = 0;
    canvasAndCtx.canvas.height = 0;
    canvasAndCtx.canvas = null;
    canvasAndCtx.context = null;
  }
}

// ImageDecoder dla pdfjs w Node.js
class NodeImageDecoder {
  constructor(params) { this._params = params; }
  get completed() { return true; }
  async decode() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = Buffer.from(this._params.data);
    });
  }
  close() {}
}

const PDF_PATH = 'C:/Users/acichocki/AppData/Local/Temp/dr_test.pdf';

(async () => {
  console.log('Konwertuję PDF na obraz (NodeCanvasFactory)...');
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));

  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    CanvasFactory: NodeCanvasFactory,
    isNodeJS: true,
  });

  const pdf = await loadingTask.promise;
  console.log(`PDF: ${pdf.numPages} stron`);

  const page = await pdf.getPage(1);
  const scale = 3.5;
  const viewport = page.getViewport({ scale });

  const canvasFactory = new NodeCanvasFactory();
  const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
  context.fillStyle = 'white';
  context.fillRect(0, 0, viewport.width, viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
    canvasFactory,
  }).promise;

  const buf = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync('ocr_dr_render.jpg', buf);
  console.log(`Obraz: ${buf.length} bytes (${Math.round(buf.length/1024)} KB), wymiary: ${viewport.width}x${viewport.height}`);

  const b64 = buf.toString('base64');
  console.log('Wysyłam do OCR API...');
  const resp = await fetch('https://taxorder-pro-api.adamus1000.workers.dev/api/ai/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: b64, mimeType: 'image/jpeg' }),
  });
  const result = await resp.json();
  console.log('Status HTTP:', resp.status);
  console.log('=== WYNIK OCR ===');
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error('BŁĄD:', e.message, '\n', e.stack); process.exit(1); });
