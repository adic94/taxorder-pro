#!/usr/bin/env node
/**
 * Bramka: klucze API wystawione dla INNEJ firmy niż firma admina muszą dać się
 * później zobaczyć i odwołać, nie tylko utworzyć.
 *
 * PO CO. `handleApiKeys` (worker/index.js) wymaga `user.role==='admin'` na WEJŚCIU
 * do każdej metody — więc jedyny wywołujący to zawsze admin. `modules/api-keys.js`
 * (`openModal()`) pokazuje mu dropdown ze WSZYSTKIMI firmami (`window.COMPANIES`),
 * więc `POST /api/api-keys` z `company_id` inną niż `user.company_id` jest
 * przewidzianym, reklamowanym w UI przypadkiem użycia — spójnym z resztą aplikacji
 * ("jedno konto operatora zarządza kilkoma spółkami klienckimi", CLAUDE.md).
 *
 * Do 03.09.2026 `GET`/`PUT`/`DELETE` filtrowały jednak `WHERE company_id=?`
 * bindowane do `user.company_id` (admina), a NIE do firmy, dla której klucz
 * faktycznie powstał. Skutek: klucz wystawiony dla innej firmy niż admina
 * — utworzony poprawnie, zwraca się raz w odpowiedzi POST — znikał z listy na
 * zawsze i nie dało się go PÓŹNIEJ wyłączyć ani usunąć przez UI. Sam klucz
 * DZIAŁA dalej (`worker/index.js:284` uwierzytelnia po `key_hash` bez filtra
 * company_id), więc to żywy, nieodwoływalny sekret — gorsze niż zwykły bug
 * funkcjonalny, bo dotyczy zdolności do cofnięcia dostępu.
 *
 * Naprawa: `GET`/`PUT`/`DELETE` nie filtrują już po `company_id` — ten sam
 * model zaufania co `GET/PUT/DELETE /api/companies` dla admina (handler i tak
 * wymaga roli admin na wejściu, więc scoping po `company_id` administratora
 * nie chroni niczego, tylko chowa dane).
 *
 * CO SPRAWDZA. Wycina ciało `handleApiKeys` z worker/index.js (nie kopiuje) i
 * sprawdza SAM TEKST zapytań SQL — ten sam wzorzec ekstrakcji co
 * tests/unit/rag-chat-sql-guard-test.js i tools/aztec-compare.js. Nie odtwarza
 * pełnego środowiska D1 (INSERT/UPDATE/DELETE + krypto), bo o poprawności
 * decyduje wyłącznie KSZTAŁT zapytania, nie dane w bazie.
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error('FAIL:', msg); }
}

const ROOT = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');

const OD = 'async function handleApiKeys(req, env, user, url, path) {';
const DO = 'async function handleDt1Declarations(req, env, user, url, path) {';
const i = src.indexOf(OD), j = src.indexOf(DO);
if (i < 0 || j < 0 || j < i) {
  console.error('Nie znaleziono handleApiKeys w worker/index.js.');
  console.error(`Kotwice: "${OD}" oraz "${DO}" — jeśli kod przeniesiono, popraw je tutaj.`);
  process.exit(2);
}
const body = src.slice(i, j);

ok(body.length > 200, 'wycięte ciało handleApiKeys jest podejrzanie krótkie — ekstrakcja się rozjechała');

// --- [1] GET nie filtruje po company_id — admin widzi klucze WSZYSTKICH firm ---
{
  const getMatch = body.match(/req\.method === 'GET'[\s\S]{0,700}?env\.DB\.prepare\(\s*['"`]([\s\S]*?)['"`]\s*\)([\s\S]{0,80})/);
  ok(!!getMatch, 'nie znaleziono zapytania SQL w gałęzi GET handleApiKeys');
  if (getMatch) {
    ok(!/company_id\s*=/i.test(getMatch[1]),
      `GET nadal filtruje po company_id w samym SQL — klucze innych firm znowu będą niewidoczne: ${getMatch[1]}`);
    ok(!/\.bind\(\s*user\.company_id\s*\)/.test(getMatch[0]),
      'GET wciąż bindował user.company_id jako parametr zapytania');
  }
}

// --- [2] PUT i DELETE identyfikują wiersz WYŁĄCZNIE po id, nie po company_id admina ---
{
  const putMatch = body.match(/UPDATE api_keys SET[^'"`]*['"`]/);
  ok(!!putMatch, 'nie znaleziono UPDATE api_keys w gałęzi PUT');
  if (putMatch) {
    ok(!/company_id\s*=\s*\?/i.test(putMatch[0]),
      `PUT /api/api-keys/:id nadal wymaga dopasowania company_id — klucz innej firmy znowu nie da się zmienić: ${putMatch[0]}`);
  }

  const delMatch = body.match(/DELETE FROM api_keys WHERE[^'"`]*['"`]/);
  ok(!!delMatch, 'nie znaleziono DELETE FROM api_keys w gałęzi DELETE');
  if (delMatch) {
    ok(!/company_id\s*=\s*\?/i.test(delMatch[0]),
      `DELETE /api/api-keys/:id nadal wymaga dopasowania company_id — klucz innej firmy znowu nie da się usunąć: ${delMatch[0]}`);
  }
}

// --- [3] Audyt: utworzenie, zmiana i usunięcie klucza są logowane -----------------
{
  ok(/klucz_api_utworzony/.test(body), 'POST /api/api-keys nie loguje utworzenia klucza do audit_logs');
  ok(/klucz_api_zmieniony/.test(body), 'PUT /api/api-keys/:id nie loguje zmiany klucza do audit_logs');
  ok(/klucz_api_usuniety/.test(body), 'DELETE /api/api-keys/:id nie loguje usunięcia klucza do audit_logs');
}

console.log(`\nWynik: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
