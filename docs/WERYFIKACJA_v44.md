# Weryfikacja statyczna — branch audyt/2026-07-26

Data: 2026-07-27  
Branch: `audyt/2026-07-26` (3 commity, 16 plików nad main)  
Stan bazowy: commit `f959823`

---

## 1. Wyniki automatycznych audytów

| Test | Wynik |
|------|-------|
| `node --check` (6 kluczowych plików) | ✅ wszystkie OK |
| `audit:all` — syntax (154 pliki) | ✅ wszystkie OK |
| `audit:all` — XSS | ✅ brak podatności |
| `audit:all` — i18n (510 kluczy, 7 języków) | ✅ spójne |
| `audit:all` — SW cache | ✅ CACHE_NAME=`taxorder-v69`, wpisy zgodne z index.html |
| `git log --oneline main..HEAD` | ✅ 3 commity |
| `git diff main --stat` | ✅ 16 plików, 1354+ / 250- |

---

## 2. Porównanie seed vs COMPANIES literal

Porównano 6 firm (mtoilet, gcon, grental, kjrsupply, nwkinvest, wolund).  
Pola: `id`, `nip`, `regon`, `krs`, `ulica`, `dom`, `lokal`, `kod`, `miasto`, `woj`, `organ`, `color`, `wlasciciel`.

**Wynik: ✅ identyczne we wszystkich polach dla wszystkich 6 firm.**

---

## 3. Przegląd handleCompanies + handleCompanyAccess

### handleCompanies (L3155–3249)

| Operacja | Ocena |
|----------|-------|
| GET /api/companies (lista) | ✅ admin widzi wszystko; non-admin filtrowany przez `user_company_access + company_id` |
| GET /api/companies/:id | ⚠️ **BRAK SPRAWDZENIA DOSTĘPU** — patrz §4.1 |
| POST /api/companies | ✅ `_isCompanyAdmin` guard, walidacja slug regex, NIP, długości, COMPANY_FIELDS whitelist, parameterized |
| PUT /api/companies/:id | ✅ admin guard, 404 na brak, COMPANY_FIELDS whitelist, parameterized |
| DELETE /api/companies/:id | ✅ admin guard, soft delete (`active=0`), 404 check `r.meta.changes===0` |

### handleCompanyAccess (L3254–3303)

| Operacja | Ocena |
|----------|-------|
| Cały handler | ✅ admin guard na wejściu (`_isCompanyAdmin`) |
| GET z user_id | ✅ parameterized |
| GET pełna lista | ✅ parameterized + LIMIT 2000 |
| PUT (nadanie dostępu) | ✅ weryfikacja user EXISTS + company EXISTS, UPSERT parameterized |

### _isCompanyAdmin

```javascript
function _isCompanyAdmin(user) {
  return user.role === 'admin' || user.role === 'superadmin';
}
```
✅ poprawne — dwa poziomy uprawnień.

---

## 4. Znalezione dodatkowe podatności (poza zakresem naprawionego patcha)

### 4.1 ⚠️ IDOR — GET /api/companies/:id (MEDIUM)

**Lokalizacja:** `worker/index.js` L3180–3183  
**Problem:** Dowolny zalogowany użytkownik może pobrać pełny rekord dowolnej firmy (NIP, REGON, KRS, adres, organ podatkowy) podając jej slug w URL — bez sprawdzenia czy ma do niej dostęp.

```javascript
// L3180 — brak guard dla non-admin
if (req.method === 'GET' && id) {
  const row = await env.DB.prepare('SELECT * FROM companies WHERE id=?').bind(id).first();
  if (!row) return err('Firma nie znaleziona', 404);
  return json(row);
}
```

**Wpływ:** Najemca A może odczytać dane rejestrowe najemcy B.  
**Uwaga:** Dane w tabeli `companies` są publiczne (KRS) — stąd MEDIUM, nie HIGH.

**Proponowana naprawa** (czekam na decyzję):
```javascript
if (req.method === 'GET' && id) {
  if (!_isCompanyAdmin(user)) {
    const acc = await env.DB.prepare(
      'SELECT 1 FROM user_company_access WHERE user_id=? AND company_id=? AND can_view=1'
    ).bind(user.id, id).first();
    const ownCompany = user.company_id === id;
    if (!acc && !ownCompany) return err('Brak dostępu', 403);
  }
  const row = await env.DB.prepare('SELECT * FROM companies WHERE id=? AND active=1').bind(id).first();
  if (!row) return err('Firma nie znaleziona', 404);
  return json(row);
}
```

---

### 4.2 ⚠️ IDOR — GET /api/folder-monitor/queue?company=X (MEDIUM)

**Lokalizacja:** `worker/index.js` L3095–3111 (`handleFmQueue`)  
**Problem:** Parametr `?company=` nie jest walidowany — użytkownik firmy A może podać `?company=B` i odczytać kolejkę OCR firmy B. Patch z §2.1 AUDYT naprawił PATCH/DELETE (`handleFmQueueItem`), ale GET pozostał podatny.

```javascript
// L3096 — company z URL param, brak auth check
const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
// dalej: WHERE company_id=? — scope jest, ale company pochodzi z requestu!
```

**Proponowana naprawa:**
```javascript
async function handleFmQueue(request, env, user, url) {
  const company = url.searchParams.get('company') || user.company_id || 'mtoilet';
  // Nowy guard:
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    if (user.company_id && user.company_id !== company) return err('Brak dostępu', 403);
  }
  // ... reszta bez zmian
```

---

### 4.3 ⚠️ Nullable company_id — bypass w handleDocWorkflow (LOW-MEDIUM)

**Lokalizacja:** `worker/index.js` L8909–8911  
**Problem:** Sprawdzenie dostępu jest oparte na `user.company_id`, który jest nullable (schema_v22). Użytkownik bez przypisanej firmy (`company_id = null`) może podać dowolną firmę w `?company=` i nie zostanie zablokowany — warunek `if (user.company_id && ...)` jest fałszywy dla null.

```javascript
const company = url.searchParams.get('company') || user.company_id;
if (!company) return err('Brak company');
// Poniższy check POMIJA użytkowników z company_id=null:
if (user.company_id && user.company_id !== company && user.role !== 'superadmin')
  return err('Brak dostępu', 403);
```

**Ten sam wzorzec może dotyczyć innych handlerów** (nie sprawdziłem wszystkich — zakres audytu to nowe handlery z tego patcha).

**Proponowana naprawa:**
```javascript
// Zastąp warunek:
if (user.role !== 'superadmin' && user.company_id !== company)
  return err('Brak dostępu', 403);
```
(zakłada, że każdy user bez company_id powinien być traktowany jak brak dostępu)

---

## 5. Supabase — żywe referencje w załadowanych modułach

| Moduł | Status |
|-------|--------|
| `companies-readonly.js` | ✅ zmigrowany w patchu — tylko komentarz historyczny |
| `company-access.js` | ✅ zmigrowany |
| `company-create.js` | ✅ zmigrowany |
| `rate-reader.js` | ✅ ma `console.warn` guard, nie crashuje |
| `fleet-cloud.js` | ⚠️ 12 wywołań `supabaseClient` (L115, 123, 140, 159, 161, 223, 227, 259, 264, 279, 280) — ma guardy `if (!window.supabaseClient) return { ok: false }`, **nie crashuje, ale cały moduł jest martwy** |

`fleet-cloud.js` jest poza zakresem tego patcha — raportuje jedynie dla kompletności.

---

## 6. IDOR audit — handleDocWorkflow, handleFmIngest

| Handler | Ocena |
|---------|-------|
| `handleDocWorkflow` | ⚠️ nullable company_id bypass (§4.3); poza tym SQL z `company_id=?` ✅ |
| `handleFmIngest` (POST) | ✅ non-admin weryfikuje `users.company_id` przez SELECT |
| `handleFmQueue` (GET) | ⚠️ IDOR (§4.2) |
| `handleFmQueueItem` (PATCH/DELETE) | ✅ naprawione w patchu — `AND company_id=?` + 404 check |

---

## 7. Podsumowanie decyzji wymaganych przed Fazą 2

| # | Decyzja | Wpływ |
|---|---------|-------|
| A | Naprawić §4.1 (GET /api/companies/:id)? | Worker deploy |
| B | Naprawić §4.2 (GET folder-monitor/queue)? | Worker deploy |
| C | Naprawić §4.3 (nullable company_id w doc-workflow)? | Worker deploy |
| D | Rotacja klucza Supabase (projekt opeqckxxdqicszfycolb)? | Panel Supabase (tylko Ty) |
| E | Migracja DB schema_v44 (zdalnie)? | **Wymaga Twojej zgody** |

Faza 2 (migracja DB) może ruszyć niezależnie od A/B/C — są to zmiany tylko w Worker, nie w schemacie.
