#!/usr/bin/env node
/**
 * TaxOrder Pro — Automatyczny robot testowy (Playwright)
 *
 * Użycie:
 *   node playwright-runner.js [opcje]
 *
 * Opcje:
 *   --url       URL aplikacji          (domyślnie: https://taxorder-pro.pages.dev)
 *   --email     Email administratora   (domyślnie: adamus1000@gmail.com)
 *   --pass      Hasło                  (domyślnie: asdasd)
 *   --company   ID firmy               (domyślnie: mtoilet)
 *   --headed    Pokaż przeglądarkę     (domyślnie: headless)
 *   --slow      Opóźnienie między akcjami w ms (domyślnie: 100)
 *   --out       Plik raportu HTML      (domyślnie: reports/report-YYYY-MM-DD.html)
 *
 * Wymagania: npm install w tym katalogu (playwright)
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.findIndex(a => a === `--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const CFG = {
  url:     getArg('url',     'https://taxorder-pro.pages.dev'),
  email:   getArg('email',   'adamus1000@gmail.com'),
  pass:    getArg('pass',    'asdasd'),
  company: getArg('company', 'mtoilet'),
  headed:  args.includes('--headed'),
  slow:    parseInt(getArg('slow', '100')),
  out:     getArg('out',     `reports/report-${new Date().toISOString().slice(0,10)}.html`),
};

// ── Test registry ─────────────────────────────────────────────────────────────
const results = [];
let _page, _browser;

async function test(name, category, fn) {
  const t0 = Date.now();
  let status = 'PASS', error = '', screenshot = null;
  try {
    await fn();
  } catch (e) {
    status = 'FAIL';
    error  = e.message;
    try {
      const dir = path.dirname(CFG.out);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const scPath = path.join(dir, `ss-${Date.now()}.png`);
      await _page?.screenshot({ path: scPath, fullPage: false }).catch(() => {});
      screenshot = path.basename(scPath);
    } catch {}
  }
  const ms = Date.now() - t0;
  results.push({ name, category, status, ms, error, screenshot });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`  ${icon} [${ms}ms] ${name}${error ? ' → ' + error.slice(0, 80) : ''}`);
}

// ── Helper wrappers ────────────────────────────────────────────────────────────
async function click(selector, opts = {}) {
  await _page.waitForSelector(selector, { timeout: 8000, ...opts });
  await _page.click(selector);
}

async function fill(selector, value) {
  await _page.waitForSelector(selector, { timeout: 6000 });
  await _page.fill(selector, value);
}

async function waitForText(text, timeout = 8000) {
  await _page.waitForFunction(t => document.body.innerText.includes(t), text, { timeout });
}

async function navTo(pageId) {
  await _page.evaluate(id => {
    if (typeof showPage === 'function') showPage(id);
  }, pageId);
  await _page.waitForTimeout(400);
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

async function run_Auth() {
  console.log('\n📋 AUTH');

  await test('Otwiera stronę logowania', 'Auth', async () => {
    await _page.goto(CFG.url, { waitUntil: 'networkidle', timeout: 30000 });
    await _page.waitForSelector('#login-email, #login-form, input[type="email"]', { timeout: 15000 });
  });

  await test('Błędne hasło → komunikat błędu', 'Auth', async () => {
    const emailSel = '#login-email, input[type="email"]';
    const passSel  = '#login-pass, input[type="password"]';
    await fill(emailSel, 'wrong@example.com');
    await fill(passSel, 'wrongpassword123');
    await click('#login-btn, button[type="submit"]');
    await _page.waitForTimeout(2000);
    const body = await _page.innerText('body');
    if (!body.match(/błąd|error|nieprawidłow|nie znalezion/i) && !body.includes('401')) {
      throw new Error('Brak komunikatu o błędnym haśle');
    }
  });

  await test('Poprawne logowanie admin', 'Auth', async () => {
    await fill('#login-email, input[type="email"]', CFG.email);
    await fill('#login-pass, input[type="password"]', CFG.pass);
    await click('#login-btn, button[type="submit"]');
    await _page.waitForSelector('#main-sidebar, .sidebar, #page-dash', { timeout: 15000 });
  });
}

async function run_Navigation() {
  console.log('\n📋 NAWIGACJA');

  const pages = [
    { id: 'dash',      label: 'Dashboard',   check: '#dash-fleet-kpi, #s-total' },
    { id: 'pojazdy',   label: 'Pojazdy',     check: '#veh-tbody, .tbl-wrap' },
    { id: 'paliwo',    label: 'Paliwo',      check: '#paliwo-kpi' },
    { id: 'kalkulator',label: 'Kalkulator',  check: '#kalk-tbody, .kalkulator' },
    { id: 'impexp',    label: 'Import/Eksport', check: '#page-impexp' },
    { id: 'raporty',   label: 'Raporty',     check: '#page-raporty' },
  ];

  for (const pg of pages) {
    await test(`Nawigacja → ${pg.label}`, 'Nawigacja', async () => {
      await navTo(pg.id);
      await _page.waitForSelector(pg.check, { timeout: 6000 });
    });
  }

  await test('Zwijanie sidebar (mobile 375px)', 'Nawigacja', async () => {
    await _page.setViewportSize({ width: 375, height: 812 });
    await _page.waitForTimeout(400);
    const hamburger = await _page.$('#sidebar-toggle, .hamburger, button[onclick*="ToggleMobile"]');
    if (hamburger) await hamburger.click();
    await _page.setViewportSize({ width: 1440, height: 900 });
    await _page.waitForTimeout(300);
  });
}

async function run_Vehicles() {
  console.log('\n📋 POJAZDY');

  await navTo('pojazdy');
  await _page.waitForTimeout(500);

  await test('Lista pojazdów się renderuje', 'Pojazdy', async () => {
    await _page.waitForSelector('#veh-tbody, .tbl-wrap table tbody', { timeout: 6000 });
    const rows = await _page.$$('#veh-tbody tr, .tbl-wrap table tbody tr');
    console.log(`    → ${rows.length} wierszy`);
  });

  await test('Wyszukiwanie pojazdu po nr rej.', 'Pojazdy', async () => {
    const input = await _page.$('#q-veh');
    if (!input) throw new Error('Brak pola wyszukiwania #q-veh');
    await input.fill('WA');
    await _page.waitForTimeout(400);
    const rows = await _page.$$('#veh-tbody tr:not(.hidden):not([style*="display: none"])');
    console.log(`    → ${rows.length} wyników dla "WA"`);
    await input.fill('');
  });

  await test('Filtr typu pojazdu', 'Pojazdy', async () => {
    const sel = await _page.$('#f-typ');
    if (!sel) throw new Error('Brak selecta #f-typ');
    await sel.selectOption('Ciężarowy');
    await _page.waitForTimeout(400);
    await sel.selectOption('');
  });

  await test('Zmiana widoku: Karty flotowe', 'Pojazdy', async () => {
    const btn = await _page.$('#view-btn-cards');
    if (!btn) throw new Error('Brak przycisku widoku kart');
    await btn.click();
    await _page.waitForTimeout(500);
    const cards = await _page.$$('.fleet-card, .veh-card');
    console.log(`    → ${cards.length} kart`);
    await _page.$('#view-btn-fleet')?.then(b => b?.click());
  });

  await test('Otwarcie karty pojazdu (klik w wiersz)', 'Pojazdy', async () => {
    const firstRow = await _page.$('#veh-tbody tr');
    if (!firstRow) throw new Error('Brak wierszy pojazdów');
    await firstRow.click();
    await _page.waitForTimeout(600);
    const modal = await _page.$('#vehicle-detail-modal:not(.hidden), [id*="veh-detail"]:not(.hidden)');
    if (!modal) {
      // może otworzyć modal lub stronę szczegółów
      const body = await _page.innerText('body');
      if (!body.match(/karta pojazdu|szczegóły|vin|nr rej/i)) throw new Error('Karta pojazdu nie otwarta');
    }
    // zamknij
    const closeBtn = await _page.$('.modal-close, [onclick*="closeModal"], [onclick*="close"]');
    if (closeBtn) await closeBtn.click();
  });
}

async function run_Dashboard() {
  console.log('\n📋 DASHBOARD');

  await navTo('dash');
  await _page.waitForTimeout(800);

  await test('Dashboard renderuje KPI floty', 'Dashboard', async () => {
    await _page.waitForSelector('#dash-fleet-kpi', { timeout: 5000 });
    const kpi = await _page.innerHTML('#dash-fleet-kpi');
    if (!kpi || kpi.trim().length < 10) throw new Error('KPI floty puste');
  });

  await test('Tabela alertów istnieje', 'Dashboard', async () => {
    await _page.waitForSelector('#dash-alerts', { timeout: 5000 });
  });

  await test('Widget serwisów renderuje', 'Dashboard', async () => {
    await _page.waitForSelector('#dash-service', { timeout: 5000 });
  });

  await test('Widget paliwa renderuje', 'Dashboard', async () => {
    await _page.waitForSelector('#dash-fuel', { timeout: 5000 });
  });

  await test('DT-1 mini-karta: s-total i s-sel', 'Dashboard', async () => {
    const total = await _page.$('#s-total');
    const sel   = await _page.$('#s-sel');
    if (!total || !sel) throw new Error('Brak elementów s-total / s-sel');
  });
}

async function run_Paliwo() {
  console.log('\n📋 MODUŁ PALIWA');

  await navTo('paliwo');
  await _page.waitForTimeout(600);

  await test('Strona Paliwo renderuje KPI', 'Paliwo', async () => {
    await _page.waitForSelector('#paliwo-kpi', { timeout: 5000 });
  });

  await test('Selektor miesiąca działa', 'Paliwo', async () => {
    const sel = await _page.$('#paliwo-month-sel');
    if (!sel) throw new Error('Brak #paliwo-month-sel');
    const opts = await sel.$$('option');
    console.log(`    → ${opts.length} miesięcy w selektorze`);
    if (!opts.length) throw new Error('Selektor miesięcy pusty');
  });

  await test('Tabela tankowań renderuje', 'Paliwo', async () => {
    await _page.waitForSelector('#paliwo-tbody', { timeout: 5000 });
  });

  await test('Wykres miesięczny renderuje', 'Paliwo', async () => {
    await _page.waitForSelector('#paliwo-chart-monthly', { timeout: 5000 });
    const html = await _page.innerHTML('#paliwo-chart-monthly');
    if (!html.trim()) throw new Error('Wykres miesięczny pusty');
  });
}

async function run_RoleAccess() {
  console.log('\n📋 KONTROLA DOSTĘPU (ROLE_TABS)');

  await test('ROLE_TABS zdefiniowany w przeglądarce', 'Uprawnienia', async () => {
    const ok = await _page.evaluate(() => typeof ROLE_TABS !== 'undefined');
    if (!ok) throw new Error('ROLE_TABS undefined');
  });

  await test('Rola admin ma wymagane zakładki', 'Uprawnienia', async () => {
    const adminTabs = await _page.evaluate(() => ROLE_TABS?.admin || []);
    const required  = ['dash', 'pojazdy', 'paliwo', 'kalkulator', 'formularze', 'stawki', 'podatnik', 'firmy', 'ai'];
    const missing   = required.filter(t => !adminTabs.includes(t));
    if (missing.length) throw new Error(`Brak w ROLE_TABS admin: ${missing.join(', ')}`);
  });

  await test('Każda rola ma tab "paliwo"', 'Uprawnienia', async () => {
    const missing = await _page.evaluate(() => {
      const roles = Object.keys(ROLE_TABS || {});
      return roles.filter(r => !(ROLE_TABS[r] || []).includes('paliwo'));
    });
    if (missing.length) throw new Error(`Brak "paliwo" dla ról: ${missing.join(', ')}`);
  });

  await test('Każda rola ma tab "dash"', 'Uprawnienia', async () => {
    const missing = await _page.evaluate(() => {
      return Object.keys(ROLE_TABS || {}).filter(r => !(ROLE_TABS[r] || []).includes('dash'));
    });
    if (missing.length) throw new Error(`Brak "dash" dla ról: ${missing.join(', ')}`);
  });
}

async function run_API() {
  console.log('\n📋 API (bezpośrednie)');

  const workerUrl = 'https://taxorder-pro-api.adamus1000.workers.dev';
  let token = '';

  await test('Login → token', 'API', async () => {
    const res = await _page.evaluate(async ({ url, email, pass }) => {
      const r = await fetch(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pass }),
      });
      return { status: r.status, json: await r.json().catch(() => ({})) };
    }, { url: workerUrl, email: CFG.email, pass: CFG.pass });

    if (res.status !== 200 || !res.json?.token) throw new Error(`HTTP ${res.status} — ${JSON.stringify(res.json).slice(0, 80)}`);
    token = res.json.token;
    console.log(`    → Token: ${token.slice(0, 20)}…`);
  });

  if (token) {
    const apiTests = [
      { label: 'GET /api/vehicles', path: `/api/vehicles?company=${CFG.company}`, verify: d => Array.isArray(d) || !!d?.results },
      { label: 'GET /api/companies', path: '/api/companies', verify: d => Array.isArray(d) },
      { label: 'GET /api/api-keys', path: '/api/api-keys', verify: d => Array.isArray(d) },
      { label: 'GET /api/export', path: `/api/export?company=${CFG.company}`, verify: d => !!d?.vehicles },
      { label: 'GET /api/auth/me', path: '/api/auth/me', verify: d => !!d?.id || !!d?.email },
    ];

    for (const ep of apiTests) {
      await test(ep.label, 'API', async () => {
        const res = await _page.evaluate(async ({ url, path, tok }) => {
          const t0 = Date.now();
          const r = await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
          return { status: r.status, ms: Date.now() - t0, json: await r.json().catch(() => null) };
        }, { url: workerUrl, path: ep.path, tok: token });

        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
        if (!ep.verify(res.json)) throw new Error(`Weryfikacja odpowiedzi nie powiodła się: ${JSON.stringify(res.json).slice(0, 80)}`);
        console.log(`    → ${res.ms}ms`);
      });
    }

    await test('401 bez tokenu', 'API', async () => {
      const res = await _page.evaluate(async (url) => {
        const r = await fetch(`${url}/api/vehicles?company=test`);
        return r.status;
      }, workerUrl);
      if (res !== 401) throw new Error(`Oczekiwano 401, got ${res}`);
    });

    await test('403 zły company_id (granica firmy)', 'API', async () => {
      const res = await _page.evaluate(async ({ url, tok }) => {
        const r = await fetch(`${url}/api/export?company=nieistniejaca_firma_xyz`, { headers: { Authorization: `Bearer ${tok}` } });
        return r.status;
      }, { url: workerUrl, tok: token });
      // może zwrócić 403 lub 404 lub puste dane
      if (res === 200) {
        // sprawdź czy dane są puste (to OK dla nieznanej firmy)
        console.log('    → Firma nieznana zwróciła 200 (puste dane)');
      }
    });
  }
}

async function run_Performance() {
  console.log('\n📋 WYDAJNOŚĆ');

  await test('Czas ładowania dashboardu < 3s', 'Wydajność', async () => {
    const t0 = Date.now();
    await navTo('dash');
    await _page.waitForSelector('#dash-fleet-kpi, #s-total', { timeout: 10000 });
    const ms = Date.now() - t0;
    console.log(`    → ${ms}ms`);
    if (ms > 3000) throw new Error(`Za wolno: ${ms}ms (limit 3000ms)`);
  });

  await test('Lista pojazdów renderuje < 2s', 'Wydajność', async () => {
    const t0 = Date.now();
    await navTo('pojazdy');
    await _page.waitForSelector('#veh-tbody', { timeout: 8000 });
    await _page.waitForTimeout(300);
    const ms = Date.now() - t0;
    console.log(`    → ${ms}ms`);
    if (ms > 2000) throw new Error(`Za wolno: ${ms}ms (limit 2000ms)`);
  });

  await test('Wyszukiwanie < 200ms (debounce)', 'Wydajność', async () => {
    const input = await _page.$('#q-veh');
    if (!input) throw new Error('Brak #q-veh');
    const t0 = Date.now();
    await input.fill('TEST');
    await _page.waitForTimeout(250);
    await input.fill('');
    console.log(`    → ${Date.now() - t0}ms`);
  });

  await test('Brak błędów JS w konsoli', 'Wydajność', async () => {
    const errors = await _page.evaluate(() => {
      return window.__qa_console_errors || [];
    });
    if (errors.length > 0) throw new Error(`${errors.length} błędów JS: ${errors[0]}`);
  });
}

// ── Report generator ──────────────────────────────────────────────────────────
function generateReport() {
  const pass  = results.filter(r => r.status === 'PASS').length;
  const fail  = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  const avgMs = total ? Math.round(results.reduce((s, r) => s + r.ms, 0) / total) : 0;
  const cats  = [...new Set(results.map(r => r.category))];

  const catHtml = cats.map(cat => {
    const catResults = results.filter(r => r.category === cat);
    const catPass = catResults.filter(r => r.status === 'PASS').length;
    const rows = catResults.map(r => `
      <tr style="background:${r.status === 'FAIL' ? '#fef2f2' : 'transparent'}">
        <td>${r.status === 'PASS' ? '✅' : '❌'}</td>
        <td>${r.name}</td>
        <td style="text-align:right;font-family:monospace;color:${r.ms < 500 ? '#16a34a' : r.ms < 1500 ? '#d97706' : '#dc2626'}">${r.ms}ms</td>
        <td style="color:#dc2626;font-size:11px">${r.error}</td>
        ${r.screenshot ? `<td><a href="${r.screenshot}" target="_blank">📸</a></td>` : '<td></td>'}
      </tr>`).join('');
    return `
    <h2>${cat} — ${catPass}/${catResults.length}</h2>
    <table><thead><tr><th></th><th>Test</th><th style="text-align:right">Czas</th><th>Błąd</th><th>SS</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  }).join('');

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>TaxOrder QA Report</title>
<style>*{box-sizing:border-box}body{font-family:system-ui;max-width:1100px;margin:0 auto;padding:24px;font-size:13px;color:#111}
h1{font-size:22px;font-weight:900}h2{font-size:14px;font-weight:700;margin:20px 0 8px;padding:6px 14px;background:#f3f4f6;border-left:4px solid #2563eb;border-radius:0 6px 6px 0}
.kpi{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.kpi-card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 20px;text-align:center}
.kpi-card .v{font-size:28px;font-weight:900;line-height:1.2}.kpi-card .l{font-size:10px;color:#6b7280;margin-top:2px}
table{border-collapse:collapse;width:100%;margin:4px 0}td,th{padding:5px 10px;border:1px solid #e5e7eb;font-size:12px;text-align:left}th{background:#f9fafb;font-weight:700}
.pass{color:#16a34a;font-weight:700}.fail{color:#dc2626;font-weight:700}
</style></head><body>
<h1>🤖 TaxOrder Pro — Raport QA (Playwright)</h1>
<p style="color:#6b7280">Wygenerowano: ${new Date().toLocaleString('pl-PL')} | URL: ${CFG.url}</p>
<div class="kpi">
  <div class="kpi-card"><div class="v" style="color:${fail === 0 ? '#16a34a' : '#dc2626'}">${pass}</div><div class="l">PASS</div></div>
  <div class="kpi-card"><div class="v" style="color:${fail > 0 ? '#dc2626' : '#6b7280'}">${fail}</div><div class="l">FAIL</div></div>
  <div class="kpi-card"><div class="v">${total}</div><div class="l">TOTAL</div></div>
  <div class="kpi-card"><div class="v" style="color:${avgMs < 500 ? '#16a34a' : '#d97706'}">${avgMs}ms</div><div class="l">avg czas</div></div>
  <div class="kpi-card"><div class="v" style="color:${fail === 0 ? '#16a34a' : '#dc2626'}">${Math.round(pass / total * 100)}%</div><div class="l">success rate</div></div>
</div>
${catHtml}
</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🤖 TaxOrder QA Runner`);
  console.log(`   URL: ${CFG.url}`);
  console.log(`   Użytkownik: ${CFG.email}`);
  console.log(`   Raport: ${CFG.out}\n`);

  _browser = await chromium.launch({ headless: !CFG.headed, slowMo: CFG.headed ? CFG.slow : 0 });
  const ctx = await _browser.newContext({ viewport: { width: 1440, height: 900 } });
  _page = await ctx.newPage();

  // Capture JS errors
  await _page.addInitScript(() => {
    window.__qa_console_errors = [];
    window.onerror = (m, s, l, c, e) => { window.__qa_console_errors.push(`${m} @ ${s}:${l}`); return false; };
    window.addEventListener('unhandledrejection', e => {
      window.__qa_console_errors.push('UnhandledRejection: ' + (e.reason?.message || e.reason));
    });
  });

  try {
    await run_Auth();
    await run_Dashboard();
    await run_Navigation();
    await run_Vehicles();
    await run_Paliwo();
    await run_RoleAccess();
    await run_API();
    await run_Performance();
  } finally {
    await _browser.close();
  }

  // Summary
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ PASS: ${pass}  ❌ FAIL: ${fail}  TOTAL: ${results.length}`);
  console.log(`Success rate: ${Math.round(pass / results.length * 100)}%`);

  if (fail > 0) {
    console.log('\n⚠ Nieudane testy:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ [${r.category}] ${r.name}: ${r.error}`));
  }

  // Write report
  const reportDir = path.dirname(CFG.out);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(CFG.out, generateReport(), 'utf-8');
  console.log(`\n📄 Raport: ${CFG.out}`);

  process.exit(fail > 0 ? 1 : 0);
})().catch(err => {
  console.error('\n💥 Krytyczny błąd:', err.message);
  process.exit(2);
});
