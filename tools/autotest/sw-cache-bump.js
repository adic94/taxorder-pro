#!/usr/bin/env node
/**
 * TaxOrder Pro — Service Worker Cache Bump
 * Porównuje <script src="modules/..."> z index.html z STATIC_ASSETS w sw.js.
 *
 * Tryby:
 *   --check   tylko sprawdź, nie zmieniaj (exit 1 jeśli jest niezgodność)
 *   --fix     dodaj brakujące skrypty do STATIC_ASSETS i bump CACHE_NAME
 *             (domyślny tryb gdy uruchomiony bez flag)
 *
 * Użycie:
 *   node tools/autotest/sw-cache-bump.js          # sprawdź + napraw
 *   node tools/autotest/sw-cache-bump.js --check  # tylko sprawdź (do CI)
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '../..');
const SW_FILE = path.join(ROOT, 'sw.js');
const HTML_FILE = path.join(ROOT, 'index.html');
const CHECK_ONLY = process.argv.includes('--check');

// ── 1. Zbierz skrypty z index.html ──────────────────────────────────────────

const htmlSrc = fs.readFileSync(HTML_FILE, 'utf8');
const htmlScripts = new Set();

for (const m of htmlSrc.matchAll(/<script\s+src="([^"]+\.js)"/g)) {
  const src = m[1];
  // Pomiń zewnętrzne URL-e (CDN) — SW nie może cachować cross-origin zasobów
  if (src.startsWith('http://') || src.startsWith('https://')) continue;
  htmlScripts.add(src.startsWith('/') ? src : '/' + src);
}

// ── 2. Zbierz STATIC_ASSETS z sw.js ─────────────────────────────────────────

let swSrc = fs.readFileSync(SW_FILE, 'utf8');

// Wyciągnij CACHE_NAME
const cacheNameMatch = swSrc.match(/const CACHE_NAME\s*=\s*'([^']+)'/);
const currentCacheName = cacheNameMatch?.[1] ?? 'taxorder-v1';

// Wyciągnij elementy STATIC_ASSETS
const swAssets = new Set();
const assetsMatch = swSrc.match(/const STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (assetsMatch) {
  for (const m of assetsMatch[1].matchAll(/'([^']+)'/g)) {
    swAssets.add(m[1]);
  }
}

// ── 3. Analiza różnic ────────────────────────────────────────────────────────

const missingInSw   = [...htmlScripts].filter(s => !swAssets.has(s));
const extraInSw     = [...swAssets].filter(s =>
  s.startsWith('/modules/') && !htmlScripts.has(s)
);

// ── 4. Raport ────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║      TaxOrder — Service Worker Cache Check          ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

console.log(`CACHE_NAME aktualny: '${currentCacheName}'`);
console.log(`Skrypty w index.html: ${htmlScripts.size}`);
console.log(`Wpisy w STATIC_ASSETS: ${swAssets.size}\n`);

if (missingInSw.length === 0 && extraInSw.length === 0) {
  console.log('✅ STATIC_ASSETS jest zgodne z index.html — bump niepotrzebny.\n');
  process.exit(0);
}

if (missingInSw.length) {
  console.log(`❌ Brak w STATIC_ASSETS (${missingInSw.length} skryptów z index.html):`);
  for (const s of missingInSw) console.log(`    • ${s}`);
  console.log();
}

if (extraInSw.length) {
  console.log(`ℹ️  W STATIC_ASSETS ale brak w index.html (${extraInSw.length}) — możliwy martwy wpis:`);
  for (const s of extraInSw) console.log(`    • ${s}`);
  console.log();
}

if (CHECK_ONLY) {
  console.log('Tryb --check: nie wprowadzono zmian.');
  console.log('Uruchom bez --check aby automatycznie naprawić:\n');
  console.log('  node tools/autotest/sw-cache-bump.js\n');
  process.exit(missingInSw.length > 0 ? 1 : 0);
}

// ── 5. Napraw — dodaj brakujące skrypty i bump CACHE_NAME ───────────────────

// Bump CACHE_NAME: taxorder-v11 → taxorder-v12
const newCacheName = currentCacheName.replace(/(\d+)$/, n => String(Number(n) + 1));

// Zbuduj nową listę STATIC_ASSETS (dopisz brakujące przed zamknięciem `]`)
const newAssets = [...swAssets, ...missingInSw].sort((a, b) => {
  // app.js, index.html, style.css na górze; modules/ w kolejności alfabetycznej
  const aM = a.startsWith('/modules/');
  const bM = b.startsWith('/modules/');
  if (aM !== bM) return aM ? 1 : -1;
  return a.localeCompare(b);
});

const newAssetsBlock = newAssets.map(s => `  '${s}'`).join(',\n');
const newStaticAssets = `const STATIC_ASSETS = [\n${newAssetsBlock},\n];`;

// Zamień w sw.js
let newSwSrc = swSrc
  .replace(/const CACHE_NAME\s*=\s*'[^']+'/, `const CACHE_NAME = '${newCacheName}'`)
  .replace(/const STATIC_ASSETS\s*=\s*\[[\s\S]*?\];/, newStaticAssets);

fs.writeFileSync(SW_FILE, newSwSrc, 'utf8');

console.log(`✅ sw.js zaktualizowany:`);
console.log(`   CACHE_NAME: '${currentCacheName}' → '${newCacheName}'`);
console.log(`   Dodano ${missingInSw.length} brakujących skryptów do STATIC_ASSETS\n`);
console.log('Pamiętaj: commituj sw.js razem z index.html!\n');
