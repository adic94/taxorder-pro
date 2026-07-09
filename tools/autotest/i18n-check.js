#!/usr/bin/env node
/**
 * TaxOrder Pro — i18n Completeness Checker
 * Sprawdza:
 *   1. Czy każdy klucz zdefiniowany w języku bazowym (PL) istnieje we wszystkich językach
 *   2. Czy każdy klucz używany w HTML (data-i18n="...") i JS (t('...')) jest zdefiniowany w PL
 *   3. Ostrzeżenia o potencjalnie nieużywanych kluczach
 *
 * Użycie: node tools/autotest/i18n-check.js [--strict]
 *   --strict: klucze użyte w kodzie ale niezdefiniowane = exit 1
 *
 * Exit code 1 jeśli są braki w tłumaczeniach.
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '../..');
const I18N    = path.join(ROOT, 'modules/i18n.js');
const HTML    = path.join(ROOT, 'index.html');
const strict  = process.argv.includes('--strict');

// ── 1. Parse i18n.js ────────────────────────────────────────────────────────

const i18nSrc = fs.readFileSync(I18N, 'utf8');

// Znajdź kody języków z tablicy LANGUAGES
const langCodesMatch = i18nSrc.match(/const LANGUAGES\s*=\s*\[([\s\S]*?)\]/);
const LANG_CODES = langCodesMatch
  ? [...langCodesMatch[1].matchAll(/code:\s*'([a-z]{2})'/g)].map(m => m[1])
  : ['pl','en','de','uk','lv','lt','et'];

// Dla każdego języka wyodrębnij jego słownik kluczy
const DICT = {}; // { 'pl': Set<string>, 'en': Set<string>, ... }

for (const lang of LANG_CODES) {
  DICT[lang] = new Set();

  // Znajdź pozycję `lang: {`
  const startIdx = i18nSrc.search(new RegExp(`\\n    ${lang}:\\s*\\{`));
  if (startIdx === -1) continue;

  // Znajdź kolejny język (lub koniec DICT) — granica sekcji
  const nextLangIdx = (() => {
    const remaining = i18nSrc.slice(startIdx + 1);
    for (const otherLang of LANG_CODES) {
      if (otherLang === lang) continue;
      const pos = remaining.search(new RegExp(`\\n    ${otherLang}:\\s*\\{`));
      if (pos !== -1) return startIdx + 1 + pos;
    }
    return i18nSrc.length;
  })();

  const section = i18nSrc.slice(startIdx, nextLangIdx);

  // Wyodrębnij klucze z sekcji: 'klucz.i18n': lub "klucz.i18n":
  const keyMatches = section.matchAll(/['"]([a-zA-Z0-9_.]+)['"]\s*:/g);
  for (const m of keyMatches) {
    DICT[lang].add(m[1]);
  }
}

const BASE_LANG  = 'pl';
const BASE_KEYS  = DICT[BASE_LANG] || new Set();

// ── 2. Scan HTML and JS for used keys ───────────────────────────────────────

const SCAN_FILES = [
  'index.html',
  'app.js',
  ...fs.readdirSync(path.join(ROOT, 'modules')).map(f => `modules/${f}`).filter(f => f.endsWith('.js')),
];

const usedKeys = new Set();

for (const rel of SCAN_FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');

  // data-i18n="klucz"
  for (const m of src.matchAll(/data-i18n="([^"]+)"/g)) usedKeys.add(m[1]);
  for (const m of src.matchAll(/data-i18n='([^']+)'/g))  usedKeys.add(m[1]);

  // t('klucz') lub window.t('klucz') lub t("klucz")
  for (const m of src.matchAll(/\bt\(['"]([a-zA-Z0-9_.]+)['"]\)/g)) usedKeys.add(m[1]);
  for (const m of src.matchAll(/window\.t\(['"]([a-zA-Z0-9_.]+)['"]\)/g)) usedKeys.add(m[1]);
}

// ── 3. Analiza ────────────────────────────────────────────────────────────────

let totalIssues = 0;
const missingPerLang = {}; // { 'en': ['key1', ...], ... }

for (const lang of LANG_CODES) {
  if (lang === BASE_LANG) continue;
  const missing = [...BASE_KEYS].filter(k => !DICT[lang].has(k));
  if (missing.length) missingPerLang[lang] = missing;
  totalIssues += missing.length;
}

// Klucze używane w kodzie ale niezdefiniowane w PL
const undefinedUsed = [...usedKeys].filter(k => !BASE_KEYS.has(k));

// Klucze zdefiniowane w PL ale nieużywane w kodzie (ostrzeżenie, nie błąd)
const unusedInCode = [...BASE_KEYS].filter(k => !usedKeys.has(k));

// ── 4. Raport ────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║      TaxOrder — i18n Completeness Check             ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

console.log(`Języki: ${LANG_CODES.join(', ')}  (baza: ${BASE_LANG})`);
console.log(`Klucze w PL: ${BASE_KEYS.size}  |  Używane w kodzie: ${usedKeys.size}\n`);

// Braki tłumaczeń
if (Object.keys(missingPerLang).length === 0) {
  console.log('✅ Wszystkie klucze PL mają tłumaczenia we wszystkich językach.\n');
} else {
  console.log('❌ Brakujące tłumaczenia:\n');
  for (const [lang, keys] of Object.entries(missingPerLang)) {
    console.log(`  [${lang.toUpperCase()}] brak ${keys.length} kluczy:`);
    for (const k of keys.slice(0, 20)) {
      console.log(`    • '${k}'`);
    }
    if (keys.length > 20) console.log(`    … i ${keys.length - 20} więcej`);
    console.log();
  }
}

// Klucze używane ale niezdefiniowane
if (undefinedUsed.length) {
  console.log(`⚠️  Klucze używane w kodzie ale BRAK w i18n.js (${undefinedUsed.length}):`);
  for (const k of undefinedUsed.slice(0, 15)) {
    console.log(`    • '${k}'`);
  }
  if (undefinedUsed.length > 15) console.log(`    … i ${undefinedUsed.length - 15} więcej`);
  console.log();
  if (strict) totalIssues += undefinedUsed.length;
}

// Nieużywane klucze (info, nie błąd)
if (unusedInCode.length) {
  console.log(`ℹ️  Klucze w i18n.js nieużywane w skanowanych plikach (${unusedInCode.length}) — możliwy martwy kod:`);
  for (const k of unusedInCode.slice(0, 10)) {
    console.log(`    • '${k}'`);
  }
  if (unusedInCode.length > 10) console.log(`    … i ${unusedInCode.length - 10} więcej`);
  console.log();
}

if (totalIssues === 0) {
  console.log('✅ i18n w porządku.\n');
} else {
  console.log(`❌ Łącznie problemów: ${totalIssues}`);
  console.log('Wzorzec dodawania klucza (wszystkie 7 języków):\n');
  console.log("  'klucz.nowy': { pl: '...', en: '...', de: '...', uk: '...', lv: '...', lt: '...', et: '...' }");
  console.log('\n  Lub dodaj klucz w każdej sekcji językowej w modules/i18n.js\n');
}

process.exit(totalIssues > 0 ? 1 : 0);
