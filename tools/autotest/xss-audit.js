#!/usr/bin/env node
/**
 * TaxOrder Pro — automatyczny audyt XSS
 * Wykrywa miejsca gdzie dane użytkownika mogą trafiać do innerHTML bez esc()
 *
 * Uruchomienie: node tools/autotest/xss-audit.js
 */

const fs   = require('fs');
const path = require('path');

// Pola, które NIE wymagają esc() — obliczane przez nasz kod
const SAFE_PATTERNS = [
  /\.toLocaleString\(/,
  /\.toFixed\(/,
  /\.toLocaleDateString\(/,
  /new Date\(/,
  /Number\(/,
  /parseInt\(/,
  /parseFloat\(/,
  /fz\(/,       // formatuj złotówki
  /fd\(/,       // formatuj datę
  /esc\(/,      // już owinięte
  /pillLbl\[/,  // z naszego słownika (safe jeśli nie ma fallback || x.field)
  /pillCls\[/,
  /STATUS_CLS\[/,
  /t\('/,       // i18n
  /window\.t\(/,
  /tnb-/,       // stałe CSS klasy
  /ti ti-/,     // ikony
  /"—"/,        // stały string
  /'—'/,
];

// Słowa kluczowe sugerujące dane użytkownika
const DANGEROUS_FIELD_PATTERNS = [
  /\bname\b/, /\bnazwa\b/, /\bopis\b/, /\bnrRej\b/, /\bnr_rej\b/,
  /\bemail\b/, /\btelefon\b/, /\bulica\b/, /\bmiasto\b/, /\bnip\b/,
  /\bprovider\b/, /\bnotes\b/, /\bdescription\b/, /\breason\b/,
  /\bold\b/, /\bnew\b/, /\bdate\b/, /\bperiod\b/, /\bokres\b/,
  /\buwagi\b/, /\binsurer\b/, /\bpolicyNo\b/, /\bstation\b/,
  /\.cache\b/, /client_name/, /nr_faktury/, /termin/,
];

const FILES_TO_CHECK = [
  'app.js',
  'modules/vehicle-detail.js',
  'modules/cfm-clients.js',
  'modules/cfm-contracts.js',
  'modules/cfm-invoices.js',
  'modules/damages.js',
  'modules/drivers.js',
  'modules/api-keys.js',
  'modules/alert-dashboard.js',
  'modules/tekom-sync.js',
  'modules/fleet-map.js',
  'modules/notification-settings.js',
  'modules/dt1-declarations.js',
  'modules/webhooks-ui.js',
  'modules/handover-protocol.js',
  'modules/service-orders.js',
  'modules/fines.js',
  'modules/documents.js',
  'modules/inspection-calendar.js',
  'modules/fleet-calendar.js',
  'modules/reports.js',
  'modules/service.js',
  'modules/notifications.js',
  'modules/fuel-import.js',
  'modules/ai-chat.js',
  'modules/companies-readonly.js',
  'modules/company-access.js',
  'modules/cepik-xml.js',
  'modules/etoll-import.js',
  'modules/diagnostics.js',
];

const ROOT = path.resolve(__dirname, '../..');

let totalIssues = 0;
const report = [];

for (const relFile of FILES_TO_CHECK) {
  const filePath = path.join(ROOT, relFile);
  if (!fs.existsSync(filePath)) continue;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const fileIssues = [];

  lines.forEach((line, i) => {
    // Interesują nas linie z innerHTML i template literals
    if (!line.includes('innerHTML') && !line.includes('insertAdjacentHTML')) return;

    // Szukamy ${...} bez esc(
    const matches = line.matchAll(/\$\{([^}]+)\}/g);
    for (const m of matches) {
      const expr = m[1];

      // Pomiń jeśli to esc() lub znany bezpieczny wzorzec
      const isSafe = SAFE_PATTERNS.some(p => p.test(expr));
      if (isSafe) continue;

      // Sprawdź czy wyrażenie wygląda jak dane użytkownika
      const isDangerous = DANGEROUS_FIELD_PATTERNS.some(p => p.test(expr));
      if (!isDangerous) continue;

      fileIssues.push({ line: i + 1, expr: expr.trim(), code: line.trim() });
      totalIssues++;
    }

    // Specjalny przypadek: fallback || bez esc na końcu (np. pillLbl[x] || x.status)
    const pillFallback = line.match(/pillLbl\[\w+\.(\w+)\]\s*\|\|\s*\w+\.(\w+)/);
    if (pillFallback && !line.includes('esc(')) {
      fileIssues.push({
        line: i + 1,
        expr: pillFallback[0],
        code: line.trim(),
        note: 'Fallback || bez esc() — surowy status z DB'
      });
      totalIssues++;
    }
  });

  if (fileIssues.length) {
    report.push({ file: relFile, issues: fileIssues });
  }
}

// Wynik
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║        TaxOrder XSS Audit — Wyniki                  ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

if (report.length === 0) {
  console.log('✅ Brak potencjalnych podatności XSS w sprawdzanych plikach!\n');
} else {
  for (const { file, issues } of report) {
    console.log(`\n📄 ${file} (${issues.length} problemów):`);
    for (const iss of issues) {
      console.log(`  Linia ${iss.line}: \x1b[33m${iss.expr}\x1b[0m`);
      if (iss.note) console.log(`    ⚠️  ${iss.note}`);
    }
  }
  console.log(`\n⚠️  Łącznie: ${totalIssues} potencjalnych problemów XSS\n`);
  console.log('Rozwiązanie: każde pole z danymi użytkownika → esc(wartość)\n');
}

process.exit(totalIssues > 0 ? 1 : 0);
