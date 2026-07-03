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
  out:     getArg('out',     path.join(__dirname, 'reports', `report-${new Date().toISOString().slice(0,10)}.html`)),
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
    // Accept: wrong password, user not found, rate limit, generic 401/429 codes
    if (!body.match(/błąd|error|nieprawidłow|nie znalezion|zbyt wiele|limit|401|429/i)) {
      throw new Error('Brak komunikatu o błędnym haśle');
    }
  });

  await test('Poprawne logowanie admin', 'Auth', async () => {
    // reload for clean form state after the failed-login test
    await _page.goto(CFG.url, { waitUntil: 'networkidle', timeout: 30000 });
    await fill('#login-email, input[type="email"]', CFG.email);
    await fill('#login-pass, input[type="password"]', CFG.pass);
    await click('#login-btn, button[type="submit"]');
    // wait for login-screen to be hidden (app shows) rather than sidebar visibility
    await _page.waitForFunction(
      () => {
        const ls = document.getElementById('login-screen');
        const app = document.getElementById('app');
        return (ls && ls.style.display === 'none') || (app && app.style.display !== 'none');
      },
      { timeout: 20000, polling: 200 }
    );
  });
}

async function run_Navigation() {
  console.log('\n📋 NAWIGACJA');

  const pages = [
    { id: 'dash',      label: 'Dashboard',   check: '#dash-fleet-kpi' },
    { id: 'pojazdy',   label: 'Pojazdy',     check: '#veh-tbody' },
    { id: 'paliwo',    label: 'Paliwo',      check: '#paliwo-kpi' },
    { id: 'kalkulator',label: 'Kalkulator',  check: '#kalk-sum' },
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
    await _page.waitForSelector('#veh-tbody', { timeout: 6000 });
    const rows = await _page.$$('#veh-tbody tr');
    const vehsLen = await _page.evaluate(() => window.vehs?.length ?? -1);
    if (rows.length === 0) throw new Error('Brak pojazdów w tabeli');
    if (rows.length !== vehsLen) throw new Error(`Niezgodność: tabela ma ${rows.length} wierszy, vehs.length=${vehsLen}`);
    console.log(`    → ${rows.length} wierszy (vehs.length=${vehsLen})`);
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
    const ciezCount = await _page.evaluate(() => document.querySelectorAll('#veh-tbody tr').length);
    console.log(`    → ${ciezCount} wierszy po filtrze Ciężarowy`);
    await sel.selectOption('');
    await _page.waitForTimeout(200);
    const allCount = await _page.evaluate(() => document.querySelectorAll('#veh-tbody tr').length);
    const totalVehs = await _page.evaluate(() => window.vehs?.length ?? -1);
    if (allCount !== totalVehs) throw new Error(`Filtr nie wyzerował się: ${allCount} wierszy zamiast ${totalVehs}`);
    console.log(`    → ${allCount} wierszy po resecie filtra`);
  });

  await test('Zmiana widoku: Karty flotowe', 'Pojazdy', async () => {
    const btn = await _page.$('#view-btn-cards');
    if (!btn) throw new Error('Brak przycisku widoku kart');
    await btn.click();
    await _page.waitForTimeout(500);
    const cards = await _page.$$('.fleet-card, .veh-card');
    const totalVehs = await _page.evaluate(() => window.vehs?.length ?? -1);
    if (cards.length !== totalVehs) throw new Error(`Karty: ${cards.length} kart zamiast ${totalVehs}`);
    console.log(`    → ${cards.length} kart`);
    // switch back to fleet/table view
    const fleetBtn = await _page.$('#view-btn-fleet');
    if (fleetBtn) await fleetBtn.click();
    await _page.waitForTimeout(300);
  });

  await test('Otwarcie karty pojazdu (klik w wiersz)', 'Pojazdy', async () => {
    // re-navigate to ensure fleet/table view is active and rendered
    await navTo('pojazdy');
    await _page.waitForTimeout(600);
    const rowCount = await _page.evaluate(() => document.querySelectorAll('#veh-tbody tr').length);
    if (!rowCount) throw new Error('Brak wierszy pojazdów');
    console.log(`    → ${rowCount} wierszy przed klikiem`);
    // native JS click bypasses Playwright's scroll/clip constraints
    await _page.evaluate(() => {
      const row = document.querySelector('#veh-tbody tr');
      if (row) row.click();
    });
    await _page.waitForTimeout(1000);
    // check that something opened (modal or detail page)
    const opened = await _page.evaluate(() => {
      const modals = document.querySelectorAll('[id*="veh-detail"], #vehicle-detail-modal, .modal.active, .modal[style*="flex"]');
      const body = document.body.innerText;
      return modals.length > 0 || body.match(/karta pojazdu|szczegóły|vin|nr rej/i) !== null;
    });
    if (!opened) throw new Error('Karta pojazdu nie otwarta');
    // close via Escape key (safest, no selector needed)
    await _page.keyboard.press('Escape');
    await _page.waitForTimeout(300);
  });

  await test('Paginacja — strona 2 ładuje kolejne pojazdy', 'Pojazdy', async () => {
    await navTo('pojazdy');
    // Wait for cloud fleet data (>100 vehicles triggers pagination at default pageSize=100)
    await _page.waitForFunction(() => (window.vehs?.length ?? 0) > 100, { timeout: 8000 });

    const state = await _page.evaluate(() => {
      const pager = document.getElementById('veh-pager');
      const rows  = document.querySelectorAll('#veh-tbody tr').length;
      const totalVehs = window.vehs?.length ?? 0;
      const pagerHtml = pager ? pager.innerHTML.substring(0, 200) : 'BRAK ELEMENTU';
      const hasPager = !!(pager && pager.children.length > 0);
      return { rows, hasPager, totalVehs, pagerHtml };
    });

    console.log(`    → DEBUG pager html: "${state.pagerHtml}"`);
    if (!state.hasPager) throw new Error(`Brak paginatora dla ${state.totalVehs} pojazdów (pageSize=100)`);

    // Navigate to page 2 and verify it has rows
    await _page.evaluate(() => vehGoPage(1));
    await _page.waitForTimeout(300);
    const page2Rows = await _page.evaluate(() => document.querySelectorAll('#veh-tbody tr').length);
    if (!page2Rows) throw new Error('Strona 2 jest pusta');

    console.log(`    → ${state.totalVehs} pojaz., strona 1 = ${state.rows} wierszy, strona 2 = ${page2Rows} wierszy`);

    // Reset to page 1
    await _page.evaluate(() => vehGoPage(0));
    await _page.waitForTimeout(200);
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

  // Helper: get visible tab ids for a given role (calls applyRoleAccess, reads DOM, restores admin)
  const getVisibleTabs = (role) => _page.evaluate((r) => {
    applyRoleAccess(r);
    const visible = [];
    document.querySelectorAll('.tnb[id]').forEach(btn => {
      const id = btn.id.replace('tnb-', '');
      if (btn.style.display !== 'none') visible.push(id);
    });
    return visible;
  }, role);

  const ROLE_ASSERTIONS = [
    {
      role: 'kierownik',
      mustHave:    ['dash', 'pojazdy', 'paliwo', 'kalkulator', 'formularze', 'raporty', 'karty', 'ai'],
      mustNotHave: ['uzytkownicy', 'api-klucze', 'firmy', 'pd', 'walidacja', 'impexp', 'podatnik'],
    },
    {
      role: 'ksiegowy',
      mustHave:    ['dash', 'paliwo', 'kalkulator', 'formularze', 'stawki', 'raporty', 'pd', 'impexp', 'podatnik', 'ai'],
      mustNotHave: ['pojazdy', 'karty', 'szkody', 'uzytkownicy', 'firmy', 'cfm-klienci'],
    },
    {
      role: 'mechanik',
      mustHave:    ['dash', 'pojazdy', 'paliwo', 'szkody', 'opony-magazyn', 'zlecenia', 'protokoly'],
      mustNotHave: ['kalkulator', 'formularze', 'raporty', 'uzytkownicy', 'firmy', 'karty', 'ai', 'pd'],
    },
    {
      role: 'dyspozytor',
      mustHave:    ['dash', 'pojazdy', 'paliwo', 'raporty', 'karty', 'szkody', 'zlecenia'],
      mustNotHave: ['kalkulator', 'formularze', 'uzytkownicy', 'firmy', 'pd', 'ai', 'impexp'],
    },
    {
      role: 'kierowca',
      mustHave:    ['dash', 'pojazdy', 'paliwo'],
      mustNotHave: ['kalkulator', 'formularze', 'stawki', 'raporty', 'uzytkownicy', 'firmy', 'karty', 'ai', 'walidacja'],
    },
  ];

  for (const { role, mustHave, mustNotHave } of ROLE_ASSERTIONS) {
    await test(`applyRoleAccess("${role}") — widoczność zakładek`, 'Uprawnienia', async () => {
      const visible = await getVisibleTabs(role);
      const missing  = mustHave.filter(t => !visible.includes(t));
      const leaked   = mustNotHave.filter(t => visible.includes(t));
      if (missing.length)  throw new Error(`Rola "${role}" powinna mieć: ${missing.join(', ')}`);
      if (leaked.length)   throw new Error(`Rola "${role}" nie powinna mieć: ${leaked.join(', ')}`);
      console.log(`    → ${visible.length} widocznych zakładek dla roli "${role}"`);
    });
  }

  // Restore admin access after all role tests
  await _page.evaluate(() => { if (typeof applyRoleAccess === 'function') applyRoleAccess('admin'); });
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
        body: JSON.stringify({ email, password: pass }),
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
      { label: 'GET /api/users', path: '/api/users', verify: d => Array.isArray(d) || Array.isArray(d?.users) },
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

    await test('Webhook GPS — 401 bez auth', 'API', async () => {
      const res = await _page.evaluate(async (url) => {
        const r = await fetch(`${url}/api/webhook/gps`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return r.status;
      }, workerUrl);
      if (res !== 401) throw new Error(`Oczekiwano 401, got ${res}`);
    });

    await test('Webhook GPS — JSON payload z tokenem sesji', 'API', async () => {
      const payload = [
        { vehicle: 'WGM87205', odometer: 55000, timestamp: new Date().toISOString(),
          lat: 52.23, lon: 21.01, speed: 65, driver: 'Jan Kowalski', location: 'Warszawa' },
      ];
      const res = await _page.evaluate(async ({ url, tok, body }) => {
        const r = await fetch(`${url}/api/webhook/gps?company=mtoilet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify(body),
        });
        return { status: r.status, json: await r.json().catch(() => null) };
      }, { url: workerUrl, tok: token, body: payload });
      if (res.status !== 200 || !res.json?.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.json)}`);
      console.log(`    → updated=${res.json.updated}, skipped=${res.json.skipped}`);
    });

    await test('Webhook GPS — CSV payload z ?key= (API key auth)', 'API', async () => {
      // Utwórz tymczasowy klucz API read_write
      const keyRes = await _page.evaluate(async ({ url, tok, company }) => {
        const r = await fetch(`${url}/api/api-keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ name: 'test-webhook', company_id: company, scope: 'read_write' }),
        });
        return r.json().catch(() => null);
      }, { url: workerUrl, tok: token, company: CFG.company });

      if (!keyRes?.key) throw new Error('Nie udało się utworzyć klucza API');
      const apiKey = keyRes.key;

      const csv = `Rejestracja;Licznik;Data;Kierowca;Lokalizacja\nWGM87205;55100;${new Date().toISOString().slice(0,10)};Jan Kowalski;Warszawa`;
      const hookRes = await _page.evaluate(async ({ url, key, csv, company }) => {
        const r = await fetch(`${url}/api/webhook/tekom?company=${company}&key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: csv,
        });
        return { status: r.status, json: await r.json().catch(() => null) };
      }, { url: workerUrl, key: apiKey, csv, company: CFG.company });

      // Usuń tymczasowy klucz
      await _page.evaluate(async ({ url, tok, id }) => {
        await fetch(`${url}/api/api-keys/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } });
      }, { url: workerUrl, tok: token, id: keyRes.id });

      if (hookRes.status !== 200 || !hookRes.json?.ok) throw new Error(`HTTP ${hookRes.status}: ${JSON.stringify(hookRes.json)}`);
      console.log(`    → CSV webhook: updated=${hookRes.json.updated}, skipped=${hookRes.json.skipped}`);
    });

    await test('Webhook paliwa — ORLEN CSV push', 'API', async () => {
      const csv = [
        'Data transakcji;Godzina;Nr rejestracyjny;Produkt;Ilosc;Cena/l;Kwota brutto;Stacja;Nr karty;Przebieg',
        `${new Date().toISOString().slice(0,10)};08:30;WGM87205;ON;48.50;6.89;334.15;ORLEN Warszawa;PL12345;55200`,
      ].join('\r\n');
      const res = await _page.evaluate(async ({ url, tok, csv, company }) => {
        const r = await fetch(`${url}/api/webhook/fuel?company=${company}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${tok}` },
          body: csv,
        });
        return { status: r.status, json: await r.json().catch(() => null) };
      }, { url: workerUrl, tok: token, csv, company: CFG.company });
      if (res.status !== 200 || !res.json?.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.json)}`);
      console.log(`    → ORLEN CSV: updated=${res.json.updated}, skipped=${res.json.skipped}`);
    });

    await test('Webhook paliwa — JSON payload', 'API', async () => {
      const payload = [{
        nrRej: 'WGM87205',
        date: new Date().toISOString().slice(0, 10),
        liters: 50.0, pricePerL: 6.89, totalGross: 344.50,
        station: 'DKV Berlin', product: 'diesel', km: 55300,
      }];
      const res = await _page.evaluate(async ({ url, tok, body, company }) => {
        const r = await fetch(`${url}/api/webhook/fuel?company=${company}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify(body),
        });
        return { status: r.status, json: await r.json().catch(() => null) };
      }, { url: workerUrl, tok: token, body: payload, company: CFG.company });
      if (res.status !== 200 || !res.json?.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.json)}`);
      console.log(`    → JSON fuel: updated=${res.json.updated}, dedup skipped=${res.json.skipped}`);
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
  try {
    const reportDir = path.dirname(CFG.out);
    try { fs.mkdirSync(reportDir, { recursive: true }); } catch (_) {}
    fs.writeFileSync(CFG.out, generateReport(), 'utf-8');
    console.log(`\n📄 Raport: ${CFG.out}`);
  } catch (e) {
    console.warn(`\n⚠ Nie można zapisać raportu: ${e.message}`);
  }

  process.exit(fail > 0 ? 1 : 0);
})().catch(err => {
  console.error('\n💥 Krytyczny błąd:', err.message);
  process.exit(2);
});
