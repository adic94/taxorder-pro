#!/usr/bin/env node
/**
 * TaxOrder Pro — Syntax check JS
 * Uruchamia `node --check` na każdym pliku JS projektu.
 * Wykrywa błędy składniowe PRZED deplojem (błąd w worker/index.js = crash 100% żądań).
 *
 * Użycie: node tools/autotest/syntax-check.js
 * Exit code 1 jeśli jakikolwiek plik ma błąd składniowy.
 */

const { execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// Pliki do sprawdzenia (kolejność: backend → frontend core → moduły)
const EXPLICIT_FILES = [
  'worker/index.js',
  'app.js',
  'sw.js',
  'tools/autotest/xss-audit.js',
  'tools/autotest/syntax-check.js',
  'tools/autotest/i18n-check.js',
  'tools/generate-changelog.js',
];

// Automatyczne zbieranie modules/*.js
const MODULES_DIR = path.join(ROOT, 'modules');
const moduleFiles = fs.readdirSync(MODULES_DIR)
  .filter(f => f.endsWith('.js'))
  .map(f => `modules/${f}`);

const ALL_FILES = [...EXPLICIT_FILES, ...moduleFiles];

let errors = 0;
let checked = 0;

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║    TaxOrder — Syntax Check (node --check)   ║');
console.log('╚══════════════════════════════════════════════╝\n');

for (const rel of ALL_FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  checked++;
  try {
    execFileSync(process.execPath, ['--check', abs], { stdio: 'pipe' });
    process.stdout.write(`  ✅ ${rel}\n`);
  } catch (e) {
    const msg = (e.stderr?.toString() || e.stdout?.toString() || e.message)
      .replace(abs, rel)
      .trim();
    console.error(`\n  ❌ ${rel}`);
    console.error(`     ${msg.split('\n').join('\n     ')}\n`);
    errors++;
  }
}

console.log(`\n${'─'.repeat(52)}`);
if (errors === 0) {
  console.log(`✅ Wszystkie ${checked} pliki poprawne składniowo.\n`);
} else {
  console.log(`❌ ${errors}/${checked} plików ma błędy składniowe.\n`);
  console.log('Popraw błędy przed deplojem — błąd w worker/index.js powoduje crash całego API.\n');
}

process.exit(errors > 0 ? 1 : 0);
