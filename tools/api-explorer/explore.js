/**
 * TaxOrder Pro — API Explorer
 *
 * Otwiera prawdziwą przeglądarkę Chrome. TY logujesz się ręcznie do zewnętrznego
 * portalu (Tekom, ORLEN, itp.) — Twoje hasło NIGDY nie przechodzi przez ten skrypt
 * ani przez asystenta AI. W tle skrypt podsłuchuje wszystkie wywołania API, które
 * wykonuje strona, i po zakończeniu zapisuje raport (JSON + czytelny HTML).
 *
 * Wynikowy raport wyślij do asystenta AI — na jego podstawie zaprojektuje
 * prawdziwą integrację z TaxOrder Pro.
 *
 * Użycie:
 *   npm install
 *   npx playwright install chromium
 *   node explore.js tekom
 *   node explore.js orlen
 *   node explore.js https://dowolny-inny-portal.pl/login
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PRESETS = {
  tekom:    { name: 'Tekom MyCar',    url: 'https://mycar.tekom.pl/authentication/login' },
  orlen:    { name: 'ORLEN Flota',    url: 'https://flota.orlen.pl/' },
  taxorder: { name: 'TaxOrder Pro',   url: 'https://taxorder-pro.pages.dev' },
};

const arg = process.argv[2];
if (!arg) {
  console.log('Użycie: node explore.js <tekom|orlen|pełny-URL>');
  process.exit(1);
}
const preset = PRESETS[arg.toLowerCase()] || { name: arg, url: arg.startsWith('http') ? arg : 'https://' + arg };

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT_DIR = path.join(__dirname, 'reports');
const JSON_OUT = path.join(OUT_DIR, `${arg.toLowerCase()}_${STAMP}.json`);
const HTML_OUT = path.join(OUT_DIR, `${arg.toLowerCase()}_${STAMP}.html`);

// Pomijamy statyczne zasoby — interesują nas tylko wywołania danych
const STATIC_EXT = /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|map|webp|gif)(\?|$)/i;
const isDataRequest = (url) => !STATIC_EXT.test(url) &&
  (/\/api\/|\/rest\/|\/v[0-9]+\/|\.json(\?|$)|\/graphql/i.test(url));

const captured = new Map(); // key: "METHOD url" -> entry
let authHeadersSeen = new Map(); // header name -> przykładowa wartość (zanonimizowana częściowo)

function maskToken(val) {
  if (!val || val.length < 12) return val;
  return val.slice(0, 8) + '…' + val.slice(-4) + ` (długość: ${val.length})`;
}

async function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  TaxOrder Pro — API Explorer: ${preset.name.padEnd(33)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  1. Otworzy się przeglądarka Chrome                            ║');
  console.log('║  2. Zaloguj się RĘCZNIE — Twoje hasło nigdzie nie jest          ║');
  console.log('║     zapisywane ani wysyłane przez ten skrypt                   ║');
  console.log('║  3. Przejdź po WSZYSTKICH sekcjach: lista pojazdów, mapa,       ║');
  console.log('║     raporty, historia tras, ustawienia, eksporty itp.           ║');
  console.log('║  4. Gdy skończysz, wróć do tego okna terminala i naciśnij Enter ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  page.on('request', (req) => {
    const url = req.url();
    if (!isDataRequest(url)) return;
    const key = `${req.method()} ${url.split('?')[0]}`;
    const headers = req.headers();
    // Zarejestruj typy nagłówków autoryzacyjnych (bez pełnego ujawniania w konsoli)
    if (headers['authorization']) authHeadersSeen.set('Authorization', maskToken(headers['authorization']));
    if (headers['x-api-key']) authHeadersSeen.set('X-Api-Key', maskToken(headers['x-api-key']));
    if (!captured.has(key)) {
      captured.set(key, {
        method: req.method(),
        urlSample: url,
        callCount: 0,
        requestHeaders: headers,
        requestBodySample: req.postData() || null,
        responseStatus: null,
        responseBodySample: null,
      });
    }
    captured.get(key).callCount++;
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    if (!isDataRequest(url)) return;
    const key = `${resp.request().method()} ${url.split('?')[0]}`;
    const entry = captured.get(key);
    if (!entry || entry.responseBodySample) return; // zachowaj pierwszą udaną próbkę
    entry.responseStatus = resp.status();
    try {
      const text = await resp.text();
      try {
        const parsed = JSON.parse(text);
        entry.responseBodySample = JSON.stringify(parsed, null, 2).slice(0, 4000);
      } catch {
        entry.responseBodySample = text.slice(0, 1500);
      }
    } catch { /* body niedostępne (np. redirect) */ }
  });

  await page.goto(preset.url).catch((e) => console.log('Uwaga: nie udało się od razu otworzyć strony —', e.message));
  console.log(`Przeglądarka otwarta: ${preset.url}`);
  console.log('Skrypt nasłuchuje w tle. Zaloguj się i klikaj po dashboardzie...\n');

  // Zapisuj checkpoint co 30s — żeby nie gubić danych przy nagłym zamknięciu
  const saveCheckpoint = () => {
    try {
      const ep = [...captured.values()].sort((a, b) => a.urlSample.localeCompare(b.urlSample));
      fs.writeFileSync(JSON_OUT + '.checkpoint', JSON.stringify({ target: preset, generatedAt: new Date().toISOString(), totalUniqueEndpoints: ep.length, endpoints: ep }, null, 2), 'utf-8');
    } catch {}
  };
  const checkpointTimer = setInterval(saveCheckpoint, 30000);

  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => { clearInterval(checkpointTimer); resolve(); });
    browser.on('disconnected', () => { clearInterval(checkpointTimer); resolve(); });
    // Fallback: zamknij po 30 minutach
    setTimeout(() => { clearInterval(checkpointTimer); resolve(); }, 30 * 60 * 1000);
    console.log('>>> Zamknij okno przeglądarki gdy skończysz — raport zostanie zapisany automatycznie <<<');
  });

  let cookies = [];
  let storageSnapshot = {};
  try {
    cookies = await context.cookies();
    storageSnapshot = await page.evaluate(() => ({
      localStorage: Object.fromEntries(Object.entries(localStorage || {})),
      sessionStorage: Object.fromEntries(Object.entries(sessionStorage || {})),
    }));
  } catch { /* strona mogła się już zamknąć */ }

  await browser.close().catch(() => {}); // ignoruj błąd jeśli już zamknięta

  const endpoints = [...captured.values()].sort((a, b) => a.urlSample.localeCompare(b.urlSample));
  const report = {
    target: preset,
    generatedAt: new Date().toISOString(),
    totalUniqueEndpoints: endpoints.length,
    authHeaderTypesDetected: Object.fromEntries(authHeadersSeen),
    cookieNames: cookies.map((c) => c.name),
    localStorageKeys: Object.keys(storageSnapshot.localStorage || {}),
    sessionStorageKeys: Object.keys(storageSnapshot.sessionStorage || {}),
    endpoints,
  };

  fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(HTML_OUT, buildHtml(report), 'utf-8');

  console.log('');
  console.log(`✓ Przechwycono ${endpoints.length} unikalnych endpointów API`);
  console.log(`✓ Raport JSON: ${JSON_OUT}`);
  console.log(`✓ Raport HTML: ${HTML_OUT}`);
  console.log('');
  console.log('Otwórz plik HTML w przeglądarce żeby przejrzeć, albo wyślij oba pliki do asystenta AI.');
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildHtml(report) {
  const rows = report.endpoints.map((e) => `
    <details style="border:1px solid #ddd;border-radius:6px;margin-bottom:8px;padding:8px 12px">
      <summary style="cursor:pointer;font-family:monospace;font-size:13px">
        <span style="display:inline-block;width:60px;font-weight:700;color:${e.method === 'GET' ? '#185FA5' : e.method === 'POST' ? '#3B6D11' : '#BA7517'}">${esc(e.method)}</span>
        ${esc(e.urlSample)}
        <span style="color:#888;font-size:11px">(wywołań: ${e.callCount}, status: ${e.responseStatus ?? '?'})</span>
      </summary>
      <div style="margin-top:8px;font-size:12px">
        ${e.requestBodySample ? `<div><strong>Request body:</strong><pre style="background:#f5f5f5;padding:8px;overflow:auto;max-height:200px">${esc(e.requestBodySample)}</pre></div>` : ''}
        ${e.responseBodySample ? `<div><strong>Response sample:</strong><pre style="background:#f0f7ff;padding:8px;overflow:auto;max-height:300px">${esc(e.responseBodySample)}</pre></div>` : '<div style="color:#888">brak przechwyconej odpowiedzi</div>'}
      </div>
    </details>`).join('');

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>API Explorer — ${esc(report.target.name)}</title>
  <style>body{font-family:-apple-system,Segoe UI,sans-serif;max-width:1000px;margin:30px auto;padding:0 16px;background:#fafafa}
  h1{font-size:20px}.meta{background:#fff;border:1px solid #ddd;border-radius:8px;padding:14px;margin-bottom:20px;font-size:13px}
  .meta div{margin-bottom:4px}</style></head><body>
  <h1>API Explorer — ${esc(report.target.name)}</h1>
  <div class="meta">
    <div><strong>Wygenerowano:</strong> ${esc(report.generatedAt)}</div>
    <div><strong>Cel:</strong> ${esc(report.target.url)}</div>
    <div><strong>Unikalnych endpointów:</strong> ${report.totalUniqueEndpoints}</div>
    <div><strong>Typy nagłówków autoryzacji wykryte:</strong> ${esc(JSON.stringify(report.authHeaderTypesDetected))}</div>
    <div><strong>Klucze localStorage:</strong> ${esc(report.localStorageKeys.join(', ') || '—')}</div>
    <div><strong>Nazwy ciasteczek:</strong> ${esc(report.cookieNames.join(', ') || '—')}</div>
  </div>
  ${rows || '<p>Brak przechwyconych endpointów — czy strona w ogóle się załadowała?</p>'}
  </body></html>`;
}

run().catch((err) => { console.error('Błąd:', err.message); process.exit(1); });
