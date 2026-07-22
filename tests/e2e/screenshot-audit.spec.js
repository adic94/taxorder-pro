/**
 * Screenshot Audit — robi screenshoty wszystkich 119 stron aplikacji.
 * Wymaga działającego serwera (http-server) na porcie 3000.
 *
 * Tryby:
 *  - TEST_TOKEN: prawdziwy token z localStorage (pełne dane)
 *  - bez tokenu: injectuje pusty token — widać layout bez danych
 *
 * Wyniki: tests/results/screenshots/<page-id>.png
 * Raport:  tests/results/screenshots/index.html
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const OUT = path.join(process.cwd(), 'tests/results/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  'dash','paliwo','pojazdy','kalkulator','formularze','pd','stawki','podatnik',
  'walidacja','raporty','ocr','faktury','pdfexport','dok-smart','policies',
  'service-schedule','mileage-claims','oddzialy','impexp','karty','szkody',
  'opony-magazyn','zlecenia','protokoly','cfm-klienci','cfm-kontrakty',
  'cfm-faktury','alert-dashboard','powiadomienia','polisy-ocr','dr-import',
  'terminarz','mapa','uzytkownicy','api-klucze','cepik','firmy','dt1-historia',
  'webhooks','errors-admin','fuel-db','budgets','faults','driver-shifts','tacho',
  'benchmark','fk-export','exec-dashboard','approvals','driver-profiles',
  'driver-performance','reservations','fleet-policies','spare-parts',
  'service-contracts','supplier-invoices','transport-orders','driver-schedule',
  'driver-scoring','tco','co2-report','budget-annual','fuel-card-import',
  'approval-levels','audit-log','driver-panel','budzet','ai',
  'fleet-kanban','ev-fleet','vehicle-equipment','vehicle-inventory','delegations',
  'leasing-schedule','vehicle-value','gus-regon','vies-validator','feature-config',
  'fleet-reservations','epp-vat','integrations','tachograph','ev-charging',
  'insurance','route-billing','fleet-kpi','zapier-ui','access-control',
  'trip-private','geofencing','driver-wages','route-cost','smart-forms',
  'gps-integrations','ksef','vehicle-inspections','fleet-renewal','driver-training',
  'fleet-limits','parking','internal-rental','carpooling','gdpr','currency',
  'predictive-maintenance','warranties','suppliers','fleet-disposal',
  'report-builder','cmr','sent','messenger','vehicle-qr','jpk','edoreczenia',
  'video-telematics','esg-report','driver-worktime','kalendarz',
];

const TOKEN   = process.env.TEST_TOKEN   || '';
const COMPANY = process.env.TEST_COMPANY || 'mtoilet';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  // nothing — screenshots done inside the single test below
});

test('screenshot wszystkich stron', async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Inject auth — z prawdziwym tokenem będą dane, bez tokenu — layout
  await page.evaluate(({ token, company }) => {
    if (token) localStorage.setItem('cf_token', token);
    localStorage.setItem('currentCompany', company);
  }, { token: TOKEN, company: COMPANY });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Poczekaj aż SPA się załaduje (login screen lub dash)
  await page.waitForSelector('#login-screen, #page-dash', { timeout: 15_000 }).catch(() => {});

  const results = [];

  for (const id of PAGES) {
    // Pokaż stronę
    await page.evaluate((pid) => {
      if (typeof window.showPage === 'function') window.showPage(pid);
      else {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const el = document.getElementById('page-' + pid);
        if (el) el.classList.add('active');
      }
    }, id);

    // Krótkie czekanie na animacje/ładowanie
    await page.waitForTimeout(400);

    const outFile = path.join(OUT, `${id}.png`);
    await page.screenshot({ path: outFile, fullPage: false });

    // Sprawdź czy strona renderuje się w .content (nie poza nim)
    const inContent = await page.evaluate((pid) => {
      const el = document.getElementById('page-' + pid);
      if (!el) return 'NO_ELEMENT';
      const content = document.querySelector('.content');
      if (!content) return 'NO_CONTENT';
      return content.contains(el) ? 'OK' : 'OUTSIDE';
    }, id);

    // Sprawdź czy jest widoczna treść (nie tylko pusta strona)
    const hasContent = await page.evaluate((pid) => {
      const el = document.getElementById('page-' + pid);
      if (!el) return false;
      return el.innerText.trim().length > 10;
    }, id);

    results.push({ id, inContent, hasContent });
    process.stdout.write(`  [${results.length}/${PAGES.length}] #page-${id} — ${inContent} ${hasContent ? '(treść)' : '(puste)'}\n`);
  }

  // Generuj raport HTML
  const issues = results.filter(r => r.inContent !== 'OK');
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>TaxOrder Pro — Screenshot Audit</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f1117; color: #e0e0e0; padding: 20px; }
  h1 { font-size: 20px; margin-bottom: 4px; color: #fff; }
  .meta { font-size: 13px; color: #888; margin-bottom: 20px; }
  .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 10px; padding: 12px 20px; min-width: 120px; }
  .stat-n { font-size: 28px; font-weight: 700; }
  .stat-n.ok { color: #22c55e; }
  .stat-n.warn { color: #f59e0b; }
  .stat-n.err { color: #ef4444; }
  .stat-l { font-size: 12px; color: #888; margin-top: 2px; }
  .issues { background: #1e1118; border: 1px solid #7f1d1d; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
  .issues h2 { color: #ef4444; font-size: 14px; margin-bottom: 10px; }
  .issues li { font-size: 13px; margin-left: 18px; line-height: 1.8; color: #fca5a5; }
  .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .filter-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid #2a2d3a; background: #1a1d27; color: #aaa; cursor: pointer; font-size: 12px; }
  .filter-btn.active { background: #2563eb; border-color: #2563eb; color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .card { background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 10px; overflow: hidden; }
  .card.bad { border-color: #ef4444; }
  .card img { width: 100%; height: 180px; object-fit: cover; object-position: top; display: block; cursor: zoom-in; border-bottom: 1px solid #2a2d3a; }
  .card-footer { padding: 10px 12px; display: flex; align-items: center; gap: 8px; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
  .badge.ok { background: #14532d; color: #86efac; }
  .badge.err { background: #7f1d1d; color: #fca5a5; }
  .badge.empty { background: #1c1917; color: #78716c; }
  .card-id { font-size: 12px; color: #ccc; font-weight: 600; }
  /* Lightbox */
  #lb { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.9); z-index: 9999; align-items: center; justify-content: center; }
  #lb.open { display: flex; }
  #lb img { max-width: 95vw; max-height: 95vh; border-radius: 8px; box-shadow: 0 0 60px rgba(0,0,0,.8); }
  #lb-close { position: fixed; top: 16px; right: 20px; font-size: 28px; color: #fff; cursor: pointer; background: none; border: none; }
</style>
</head>
<body>
<h1>TaxOrder Pro — Screenshot Audit</h1>
<div class="meta">Wygenerowano: ${new Date().toLocaleString('pl-PL')} · ${PAGES.length} stron · ${TOKEN ? 'z auth' : 'bez auth (layout only)'}</div>

<div class="stats">
  <div class="stat"><div class="stat-n ok">${results.filter(r=>r.inContent==='OK').length}</div><div class="stat-l">w .content</div></div>
  <div class="stat"><div class="stat-n err">${issues.length}</div><div class="stat-l">poza .content</div></div>
  <div class="stat"><div class="stat-n warn">${results.filter(r=>r.hasContent).length}</div><div class="stat-l">ma treść</div></div>
  <div class="stat"><div class="stat-n" style="color:#64748b">${results.filter(r=>!r.hasContent).length}</div><div class="stat-l">puste</div></div>
</div>

${issues.length ? `<div class="issues"><h2>⚠ Strony poza .content (${issues.length})</h2><ul>${issues.map(r=>`<li>#page-${r.id} — ${r.inContent}</li>`).join('')}</ul></div>` : ''}

<div class="filter-bar">
  <button class="filter-btn active" onclick="filter('all',this)">Wszystkie (${PAGES.length})</button>
  <button class="filter-btn" onclick="filter('bad',this)">Poza .content (${issues.length})</button>
  <button class="filter-btn" onclick="filter('empty',this)">Puste (${results.filter(r=>!r.hasContent).length})</button>
  <button class="filter-btn" onclick="filter('content',this)">Z treścią (${results.filter(r=>r.hasContent).length})</button>
</div>

<div class="grid" id="grid">
${results.map(r => `
  <div class="card ${r.inContent !== 'OK' ? 'bad' : ''}" data-ok="${r.inContent==='OK'}" data-has="${r.hasContent}">
    <img src="${r.id}.png" alt="${r.id}" onclick="lb(this.src)" loading="lazy">
    <div class="card-footer">
      <div class="card-id">#page-${r.id}</div>
      <span class="badge ${r.inContent==='OK'?'ok':'err'}">${r.inContent}</span>
      ${!r.hasContent ? '<span class="badge empty">puste</span>' : ''}
    </div>
  </div>`).join('')}
</div>

<div id="lb"><button id="lb-close" onclick="document.getElementById('lb').classList.remove('open')">×</button><img id="lb-img" src="" alt=""></div>

<script>
function lb(src){ document.getElementById('lb-img').src=src; document.getElementById('lb').classList.add('open'); }
document.getElementById('lb').addEventListener('click',function(e){ if(e.target===this) this.classList.remove('open'); });
function filter(type, btn){
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.card').forEach(c=>{
    const ok=c.dataset.ok==='true', has=c.dataset.has==='true';
    if(type==='all') c.style.display='';
    else if(type==='bad') c.style.display=ok?'none':'';
    else if(type==='empty') c.style.display=has?'none':'';
    else if(type==='content') c.style.display=has?'':'none';
  });
}
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
  console.log(`\n✅ Screenshoty: ${OUT}`);
  console.log(`📋 Raport: ${path.join(OUT, 'index.html')}`);
  if (issues.length) {
    console.log(`⚠ ${issues.length} stron poza .content:`, issues.map(r=>r.id).join(', '));
  }

  expect(issues).toHaveLength(0);
});
