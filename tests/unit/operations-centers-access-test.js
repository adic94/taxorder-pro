const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const access = read('modules/access-control.js');
const features = read('modules/feature-config.js');
const worker = read('worker/index.js');
const app = read('app.js');

let pass = 0;
let fail = 0;
function test(label, condition) {
  console.log(`  ${condition ? '✓' : '✗'} ${label}`);
  condition ? pass++ : fail++;
}

console.log('\nCentra operacyjne — katalogi, licencje i sesja\n');

for (const id of ['operations-workbench', 'integration-hub', 'automation-center']) {
  test(`${id}: katalog kontroli dostępu`, access.includes(`id:'${id}'`));
  test(`${id}: konfiguracja widoczności`, features.includes(`key: '${id}'`) || features.includes(`key:'${id}'`));
}

test('API operations podlega licencji transport', worker.includes("['/api/operations',             'transport']"));
test('API integration-hub podlega licencji webhooks', worker.includes("['/api/integration-hub',        'webhooks']"));
test('API automation-center podlega licencji finance', worker.includes("['/api/automation-center',      'finance']"));
test('pakiet Pro obejmuje centrum operacyjne', /AC_PACKAGES[\s\S]*?pro:[\s\S]*?'operations-workbench'/.test(worker));

test('karty nie wysyłają żądania bez tokenu', /async function _loadKarty\(\)[\s\S]{0,300}if \(!localStorage\.getItem\('cf_token'\)\) return;/.test(app));
test('dashboard kart odróżnia brak sesji od błędu API', app.includes('Dane dostępne po zalogowaniu'));
test('odtworzenie UI wymaga tokenu backendu', app.includes('if(savedEmail && savedToken)'));
test('logowanie czyści wcześniejszy błąd kart', /async function doLogin\(\)[\s\S]*?_cardsLoadError = null;[\s\S]*?_loadKarty\(\)/.test(app));
test('app.js zachowuje adres API ustawiony przez konfigurację UAT/local',
  /window\.CF_WORKER_URL\s*=\s*window\.CF_WORKER_URL\s*\|\|\s*window\.CF_API_URL/.test(app));
test('app.js nie nadpisuje bezwarunkowo adresu Workera produkcją',
  !/^window\.CF_WORKER_URL\s*=\s*['"]https:\/\/taxorder-pro-api\.adamus1000\.workers\.dev['"];$/m.test(app));

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
