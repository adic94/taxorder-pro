/**
 * Narzędzie deweloperskie: generuje SQL do wstawienia konta testowego do D1.
 *
 * Użycie:
 *   node tools/create-test-user.js <email> <haslo>
 *
 * Następnie skopiuj wygenerowany SQL i wykonaj:
 *   .\node_modules\.bin\wrangler.cmd d1 execute taxorder-pro --remote --command="<SQL>"
 *
 * Potem ustaw w GitHub Actions:
 *   TEST_EMAIL = <email>
 *   TEST_PASS  = <haslo>
 */

const crypto = require('crypto');

async function hashPwd(password, salt) {
  return new Promise((resolve, reject) => {
    // Identyczne parametry jak worker/index.js: PBKDF2, SHA-256, 100 000 iteracji, 32 bajty
    crypto.pbkdf2(password, salt, 100_000, 32, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('base64'));
    });
  });
}

async function main() {
  const email    = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Użycie: node tools/create-test-user.js <email> <haslo>');
    console.error('Przykład: node tools/create-test-user.js ci-test@taxorder.pl Testowe123!');
    process.exit(1);
  }

  const salt = crypto.randomBytes(16).toString('base64');
  const hash = await hashPwd(password, salt);

  const sql = `INSERT INTO users (email, password_hash, salt, name, company_slug, role, active)
VALUES ('${email.toLowerCase()}', '${hash}', '${salt}', 'CI Test User', 'mtoilet', 'admin', 1)
ON CONFLICT(email) DO UPDATE SET password_hash='${hash}', salt='${salt}', active=1, role='admin';`;

  console.log('\n=== Wygenerowany SQL ===\n');
  console.log(sql);
  console.log('\n=== Następne kroki ===\n');
  console.log('1. Wykonaj SQL w D1 (wymagany zalogowany wrangler):');
  console.log(`   .\\node_modules\\.bin\\wrangler.cmd d1 execute taxorder-pro --remote --command="${sql.replace(/\n/g, ' ')}"`);
  console.log('\n2. Ustaw secrety w GitHub Actions → Settings → Secrets:');
  console.log(`   TEST_EMAIL = ${email.toLowerCase()}`);
  console.log(`   TEST_PASS  = ${password}`);
  console.log('\n3. Push do main — CI powinno przejść.\n');
}

main().catch(e => { console.error(e.message); process.exit(1); });
