#!/usr/bin/env node
/** Zasiewa wyłącznie D1 UAT syntetycznym tenantem i kontem TEST_* z .env. */
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = path.join(ROOT, 'wrangler.uat.toml');
const config = fs.readFileSync(CONFIG, 'utf8');
if (!config.includes('database_name = "taxorder-pro-uat"') ||
    !config.includes('database_id = "aee5038e-e7d4-4ae5-af51-b11fe7ae9008"')) {
  throw new Error('Odmowa: config nie wskazuje zatwierdzonej bazy UAT.');
}

const email = process.env.TEST_EMAIL || '';
const password = process.env.TEST_PASS || '';
if (!/^[^'\s]+@[^'\s]+$/.test(email) || !password || password.length > 256) {
  throw new Error('Ustaw poprawne TEST_EMAIL i TEST_PASS w .env.');
}

const quote = value => `'${String(value).replace(/'/g, "''")}'`;
const salt = crypto.randomBytes(16).toString('base64');
const hash = 'v2_' + crypto.pbkdf2Sync(password, salt, 10_000, 32, 'sha256').toString('base64');
const normalizedEmail = email.trim().toLowerCase();
const sql = [
  'DELETE FROM user_company_access',
  'DELETE FROM company_packages',
  'DELETE FROM companies',
  'DELETE FROM users',
  `INSERT INTO companies(id,short_name,name,color,created_by) VALUES('uat-demo','UAT Demo','TaxOrder UAT — dane syntetyczne','#2563EB','uat-seed')`,
  `INSERT INTO users(email,name,password_hash,role,active,salt,company_id) VALUES(${quote(normalizedEmail)},'Administrator UAT',${quote(hash)},'admin',1,${quote(salt)},'uat-demo')`,
  `INSERT INTO user_company_access(user_id,company_id,can_view,can_edit,granted_by) SELECT id,'uat-demo',1,1,'uat-seed' FROM users WHERE email=${quote(normalizedEmail)}`,
  `INSERT INTO company_packages(company_id,package_name,active,notes) VALUES('uat-demo','enterprise',1,'Izolowane środowisko UAT')`,
].join('; ');

const wrangler = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const result = spawnSync(process.execPath, [wrangler,
  'd1', 'execute', 'taxorder-pro-uat', '--remote', '--config', CONFIG,
  '--command', sql, '--json',
], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'Zasiew UAT nie powiódł się.');
  process.exit(result.status || 1);
}
console.log('UAT seeded: tenant=uat-demo, admin=TEST_EMAIL, dane produkcyjne=0.');

