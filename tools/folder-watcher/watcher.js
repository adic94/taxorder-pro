#!/usr/bin/env node
/**
 * TaxOrder Pro — Folder Watcher Agent
 * Obserwuje lokalne foldery i wysyła dokumenty do TaxOrder Pro przez HTTP.
 * Działa z KAŻDĄ przeglądarką (Firefox, Chrome, Edge, Safari) — nie wymaga
 * File System Access API w przeglądarce.
 *
 * Wymaga tylko Node.js — bez npm install (tylko moduły wbudowane w Node).
 *
 * Uruchomienie:
 *   node watcher.js                    — tryb polling co intervalSec sekund
 *   node watcher.js --scan             — jedno skanowanie i wyjście
 *   node watcher.js --watch            — inotify/FSEvents (szybsze na Linux/macOS)
 *
 * Konfiguracja: config.json (skopiuj z config.example.json)
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const https  = require('https');
const http   = require('http');
const os     = require('os');
const crypto = require('crypto');

// ─── Konfiguracja ─────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SENT_PATH   = path.join(__dirname, '.sent.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('\n[!] Brak pliku config.json');
    console.error('    Skopiuj config.example.json → config.json i uzupełnij dane.\n');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('[!] Błąd parsowania config.json:', e.message);
    process.exit(1);
  }
}

const cfg = loadConfig();
const {
  apiUrl     = 'https://taxorder-pro-api.adamus1000.workers.dev',
  token      = '',
  company    = 'mtoilet',
  intervalSec = 60,
  folders    = {},   // { polisa: "C:\\...", dr: "...", paliwo: "...", serwis: "..." }
  verbose    = false,
} = cfg;

if (!token) {
  console.error('[!] Brak tokenu w config.json. Pobierz z przeglądarki: localStorage.getItem("cf_token")');
  process.exit(1);
}

const AGENT_NAME = os.hostname();
const ARGS = new Set(process.argv.slice(2));

// ─── Historia wysłanych plików ─────────────────────────────────────────────────

let sent = {};
try { sent = JSON.parse(fs.readFileSync(SENT_PATH, 'utf8')); } catch {}

function saveSent() {
  try { fs.writeFileSync(SENT_PATH, JSON.stringify(sent, null, 2)); } catch {}
}

function fileKey(filePath, stat) {
  return `${filePath}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
}

function isAlreadySent(key) {
  return !!sent[key];
}

function markSent(key, filename) {
  sent[key] = { sentAt: Date.now(), file: filename };
  // Wyczyść wpisy starsze niż 30 dni
  const cutoff = Date.now() - 30 * 24 * 3600_000;
  for (const k of Object.keys(sent)) {
    if ((sent[k].sentAt || 0) < cutoff) delete sent[k];
  }
  saveSent();
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function apiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const base  = apiUrl.replace(/\/$/, '');
    const full  = base + endpoint;
    let url;
    try { url = new URL(full); } catch (e) { return reject(new Error('Nieprawidłowy apiUrl: ' + full)); }
    const data  = JSON.stringify(body);
    const lib   = url.protocol === 'https:' ? https : http;
    const opts  = {
      method:   'POST',
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      headers:  {
        'Content-Type':   'application/json',
        'Authorization':  'Bearer ' + token,
        'Content-Length': Buffer.byteLength(data),
        'User-Agent':     `TaxOrder-FolderWatcher/1.0 Node/${process.version}`,
      },
      timeout: 60_000,
    };
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(data);
    req.end();
  });
}

async function sendHeartbeat() {
  try {
    await apiPost('/api/folder-monitor/heartbeat', { agentName: AGENT_NAME, company });
  } catch {}
}

// ─── Wykrywanie MIME ──────────────────────────────────────────────────────────

function mimeFromExt(filename) {
  const ext = path.extname(filename).toLowerCase();
  const MAP  = {
    '.pdf':  'application/pdf',
    '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.bmp':  'image/bmp',
    '.tif':  'image/tiff', '.tiff': 'image/tiff',
  };
  return MAP[ext] || 'application/octet-stream';
}

const ALLOWED_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff']);

// ─── Wysyłanie pliku ──────────────────────────────────────────────────────────

async function sendFile(filePath, docType) {
  let stat;
  try { stat = fs.statSync(filePath); } catch { return; }
  if (!stat.isFile()) return;

  const key = fileKey(filePath, stat);
  if (isAlreadySent(key)) {
    if (verbose) console.log(`  · Pominięto (już wysłano): ${path.basename(filePath)}`);
    return;
  }

  const filename = path.basename(filePath);
  const mimeType = mimeFromExt(filename);

  if (verbose) console.log(`  → Wysyłam: ${filename} (${docType}, ${(stat.size / 1024).toFixed(1)} KB)`);

  let fileBase64;
  try {
    const buf = fs.readFileSync(filePath);
    fileBase64 = buf.toString('base64');
  } catch (e) {
    console.error(`  [!] Błąd odczytu ${filename}: ${e.message}`);
    return;
  }

  try {
    const r = await apiPost('/api/folder-monitor/ingest', {
      filename, docType, fileBase64, mimeType, company,
      agentName: AGENT_NAME,
    });
    if (r.status === 200 || r.status === 201) {
      const dup = r.body?.duplicate ? ' (duplikat — pominięto OCR)' : '';
      console.log(`  ✓ ${filename}${dup}`);
      markSent(key, filename);
    } else if (r.status === 401) {
      console.error(`  [!] Błąd autoryzacji (401). Zaktualizuj token w config.json.`);
      console.error(`      Pobierz nowy token: F12 → Console → localStorage.getItem("cf_token")`);
    } else {
      const errMsg = r.body?.error || JSON.stringify(r.body).slice(0, 80);
      console.error(`  [!] HTTP ${r.status}: ${errMsg}`);
    }
  } catch (e) {
    console.error(`  [!] Błąd sieci: ${e.message}`);
  }
}

// ─── Skanowanie folderu ───────────────────────────────────────────────────────

async function scanFolder(folderPath, docType) {
  if (!folderPath) return 0;
  if (!fs.existsSync(folderPath)) {
    console.warn(`  [!] Folder nie istnieje: ${folderPath}`);
    return 0;
  }

  let count = 0;
  let files;
  try { files = fs.readdirSync(folderPath); } catch (e) {
    console.error(`  [!] Błąd odczytu folderu ${folderPath}: ${e.message}`);
    return 0;
  }

  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) continue;
    await sendFile(path.join(folderPath, name), docType);
    count++;
  }
  return count;
}

// ─── Tryb --watch (FSEvents / inotify) ───────────────────────────────────────

function startWatchMode() {
  console.log('\n[Watch] Tryb obserwacji pliku (fs.watch). Naciśnij Ctrl+C aby zatrzymać.\n');

  const watchers = [];
  for (const [docType, folderPath] of Object.entries(folders)) {
    if (!folderPath || !fs.existsSync(folderPath)) continue;
    console.log(`  [Watch] Obserwuję: ${folderPath} (${docType})`);

    // Pierwsze pełne skanowanie
    scanFolder(folderPath, docType);

    // Obserwuj zmiany
    const watcher = fs.watch(folderPath, { persistent: true }, (eventType, filename) => {
      if (!filename) return;
      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) return;
      if (eventType === 'rename' || eventType === 'change') {
        const full = path.join(folderPath, filename);
        setTimeout(() => sendFile(full, docType), 500); // krótki delay po zapisie
      }
    });
    watchers.push(watcher);
  }

  // Heartbeat co 2 min
  setInterval(sendHeartbeat, 2 * 60_000);
  sendHeartbeat();

  process.on('SIGINT', () => {
    console.log('\n[Watch] Zatrzymano.');
    watchers.forEach(w => w.close());
    process.exit(0);
  });
}

// ─── Tryb polling ─────────────────────────────────────────────────────────────

async function runScan() {
  const now = new Date().toLocaleTimeString('pl-PL');
  console.log(`\n[${now}] Skanowanie...`);

  let total = 0;
  for (const [docType, folderPath] of Object.entries(folders)) {
    if (!folderPath) continue;
    const n = await scanFolder(folderPath, docType);
    total += n;
  }

  if (!total) console.log('  — Brak nowych plików');
  await sendHeartbeat();
}

// ─── Główna pętla ─────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║  TaxOrder Pro — Folder Watcher Agent             ║');
  console.log('║  Działa ze wszystkimi przeglądarkami (FF, Chrome) ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`\nAPI:   ${apiUrl}`);
  console.log(`Firma: ${company} | Agent: ${AGENT_NAME}`);
  console.log('\nFoldery:');
  for (const [type, dir] of Object.entries(folders)) {
    const status = !dir ? '(pominięty)' : fs.existsSync(dir) ? '✓' : '✗ (nie istnieje)';
    console.log(`  ${type.padEnd(8)} → ${dir || '—'}  ${status}`);
  }

  if (ARGS.has('--scan')) {
    // Jednorazowe skanowanie
    await runScan();
    process.exit(0);
  } else if (ARGS.has('--watch')) {
    startWatchMode();
  } else {
    // Tryb polling
    console.log(`\nTryb: polling co ${intervalSec}s. Naciśnij Ctrl+C aby zatrzymać.\n`);
    await runScan();
    setInterval(runScan, intervalSec * 1_000);
  }
}

main().catch(e => {
  console.error('\n[!] Krytyczny błąd:', e.message);
  process.exit(1);
});
