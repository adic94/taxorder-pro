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

---

## 8. Naprawy IDOR 27.07.2026

Data: 2026-07-27  
Decyzje A, B, C zatwierdzone przez właściciela projektu.

### 8.1 Status napraw §4.1, §4.2, §4.3

Wszystkie trzy podatności zostały naprawione w `worker/index.js` i zweryfikowane:

#### §4.1 — GET /api/companies/:id (naprawione)

Lokalizacja: `worker/index.js` L3183–3192

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

Non-admin użytkownik może odczytać tylko:
- firmę przypisaną do swojego konta (`user.company_id === id`), lub
- firmę, do której ma jawny wpis w `user_company_access` z `can_view=1`.

#### §4.2 — GET /api/folder-monitor/queue?company=X (naprawione)

Lokalizacja: `worker/index.js` L3097–3099

```javascript
if (user.role !== 'admin' && user.role !== 'superadmin') {
  if (user.company_id && user.company_id !== company) return err('Brak dostępu', 403);
}
```

Guard dodany przed użyciem parametru `company` do zapytania DB.

#### §4.3 — nullable company_id bypass w handleDocWorkflow (naprawione)

Lokalizacja: `worker/index.js` L8963

```javascript
if (user.role !== 'superadmin' && user.company_id !== company)
  return err('Brak dostępu', 403);
```

Usunięto warunek `user.company_id && ...` — użytkownik z `company_id = null` teraz zawsze dostaje 403, chyba że jest superadminem.

**Sprawdzenie przed zaostrzeniem warunku — weryfikacja w D1:**
```sql
SELECT COUNT(*) FROM users WHERE company_id IS NULL AND active=1;
-- Wynik: 0 wierszy
```
Brak aktywnych użytkowników bez przypisanej firmy — zmiana nie odcina żadnego legalnego użytkownika.

---

### 8.2 Skan IDOR — wszystkie handlery z `searchParams.get('company')`

**Zakres:** `worker/index.js` — 120 miejsc odwołujących się do `url.searchParams.get('company')`.

**Luka metodologiczna poprzedniego audytu:** sprawdzano czy zapytanie SQL ma filtr `company_id`, ale nie skąd pochodzi jego wartość. Handlery ze scopem SQL budowanym z parametru URL (bez walidacji właściciela) przechodziły audyt czysto.

#### Architektura ochrony — centralized guard (L8620–8625)

```javascript
if (user && !user._apiKey && user.role !== 'admin') {
  const reqCompany = url.searchParams.get('company');
  if (reqCompany && reqCompany !== user.company_id) {
    return err('Brak dostępu do tej firmy', 403);
  }
}
```

Guard działa na poziomie `handleRequest` — **przed** wywołaniem jakiegokolwiek handlera szczegółowego. Pokrywa non-admin użytkowników z sesją tokenową. Admin i superadmin są celowo wyłączeni z tego guardu (multi-tenant operacje).

#### Kategoryzacja 120 handlerów

| Kategoria | Liczba | Opis |
|-----------|--------|------|
| Chronione przez centralized guard | ~106 | Non-admin sesja: `?company=obca` → 403 z guardu zanim handler uruchomi |
| Admin-only (guard nie potrzebny) | ~8 | Handler sam sprawdza `_isCompanyAdmin` na wejściu |
| Luki strukturalne — pre-auth / webhook | ~4 | Opisane poniżej |
| Fałszywe alarmy — parametr wyłącznie outbound | ~2 | Handler buduje URL odpowiedzi, nie zapytanie DB |

#### Luki strukturalne (wymagają decyzji — nie naprawione bez zgody)

**Luka 1 — `handlePzStart` (trasa OAuth PZ, pre-auth):**
Handler obsługuje inicjację połączenia z zewnętrznym systemem PZ (PKP Cargo / systemy partnerskie). Uruchamia się przed pełnym sprawdzeniem sesji — `user` może być null lub webhook-user. Parametr `?company=` trafia do DB bez walidacji właściciela.

*Ryzyko:* ograniczone — ten endpoint wymaga też poprawnie skonfigurowanego klucza OAuth partnera. Sama znajomość `?company=` nie wystarczy do odczytania danych.

**Luka 2 — handlery z `webhookUser`:**
Kilka handlerów (m.in. webhook inbound, notyfikacje z zewnętrznych systemów) używa tożsamości `webhookUser` zamiast sesji. `webhookUser` nie przechodzi przez centralized guard (`user._apiKey = true` → guard pomijany). Parametr `?company=` decyduje o scopie zapisu.

*Ryzyko:* zależy od tego, kto zna URL webhook + token. Jeśli atakujący zna oba — może zapisać dane do obcej firmy. Weryfikacja tokena webhooka (`webhook_token` per firma) istnieje, ale nie waliduje, czy token należy do firmy z `?company=`.

**Decyzja właściciela do podjęcia:** czy luki 1 i 2 wymagają naprawy w Fazie 3? Zaproponuję konkretne poprawki po otrzymaniu decyzji.

---

### 8.3 Wyniki audit:all po naprawach

```
npm run audit:all — 2026-07-27

Syntax check (169 pliki):     ✅ wszystkie OK
XSS audit:                    ✅ brak podatności
i18n (525 kluczy, 7 języków): ✅ spójne
SW cache (CACHE_NAME=taxorder-v71): ✅ zgodne z index.html
```

Naprawiono przy okazji: 3 pliki nowych modułów (`debt-collection.js`, `external-panel.js`, `fuel-import-scheduler.js`) miały zagnieżdżony komentarz blokowy `/* ... */` wewnątrz `/** ... */` — niepoprawna składnia JS powodująca błąd `SyntaxError: Unexpected token '*'`. Poprawiono na komentarze jednoliniowe `// SCHEMA_NEEDED: ...`.

---

## 9. Zamknięcie Bloku 6 — 28.07.2026

Data: 2026-07-28  
Weryfikacja na podstawie kodu + zapytań D1. Decyzja właściciela projektu: Blok 6 zamknięty bez zmian.

### 9.1 Fałszywe alarmy z §8

#### handlePzStart — FAŁSZYWY ALARM (zweryfikowany przez właściciela)

Endpoint inicjuje OAuth i **musi** działać bez uwierzytelnienia. Parametr `?company=` nie daje żadnych uprawnień:
- `handlePzCallback` (L437+) szuka użytkownika po `pz_sub` albo `email`
- przy braku konta zwraca `no_account` **bez tworzenia sesji**
- sesja wiązana jest z `dbUser.id` (rekord z DB), nie z parametrem URL
- allowlist na `app_url` (regex ograniczony do `taxorder-pro.pages.dev` + localhost) — poprawna ochrona przed open redirect

**Wniosek:** brak podatności. Nie ruszać.

#### Handlery GPS i paliwowy (webhook) — FAŁSZYWY ALARM (zweryfikowany przez właściciela)

`handleGpsWebhook` (L3852) i `handleFuelWebhook` (L3968) mają lokalny guard:
```javascript
if (user._apiKey && user.company_id && user.company_id !== company)
  return err('Brak dostępu do tej firmy', 403);
```
Parametr `?company=` nie decyduje o scopie bez walidacji. Guard działa dla kluczy API z przypisaną firmą.

---

### 9.2 Weryfikacja D1 — api_keys i users

```sql
-- Zapytanie 1: klucze API bez company_id
SELECT id, name, company_id FROM api_keys WHERE company_id IS NULL OR company_id = '';
-- Wynik: 0 wierszy ✅

-- Zapytanie 2: aktywni użytkownicy bez company_id (kontekst §4.3)
SELECT COUNT(*) AS n FROM users WHERE company_id IS NULL AND active = 1;
-- Wynik: n = 0 ✅
```

**Wniosek:** wzorzec `user.company_id &&` (który pomija kontrolę przy null) jest faktycznie nieosiągalny dla obu ścieżek:
- `api_keys.company_id` — NOT NULL w definicji tabeli, 0 wierszy null w bazie
- `users.company_id` — nullable od schema_v22, ale 0 aktywnych userów z wartością null

---

### 9.3 Pełna lista wzorca `user.company_id &&` w worker/index.js

| Linia | Handler | Wzorzec | Uwaga |
|-------|---------|---------|-------|
| L3098 | `handleFmQueue` | `if (user.company_id && user.company_id !== company)` | Fix §4.2; wewnątrz bloku `if (role !== 'admin')` |
| L3865 | `handleGpsWebhook` | `if (user._apiKey && user.company_id && ...)` | Webhook; api_keys.company_id NOT NULL |
| L3981 | `handleFuelWebhook` | `if (user._apiKey && user.company_id && ...)` | Webhook; api_keys.company_id NOT NULL |
| L11972 | `handleFuelImportScheduler` | `if (user.company_id && ... && user.role !== 'superadmin')` | Nowy moduł; users null = 0 |
| L12216 | `handleDebtCollection` | j.w. | Nowy moduł |
| L12450 | `handleExternalAccess` | j.w. | Nowy moduł |
| L12494 | `handleDriverRanking` | j.w. | Nowy moduł |
| L12603 | `handleRouteProfitability` | j.w. | Nowy moduł |

Wzorzec w 5 nowych handlerach (L11972–L12603) pochodzi z jednego szablonu — skopiowany przy tworzeniu modułów. Logicznie słabszy niż `user.role !== 'superadmin' && user.company_id !== company` (wzorzec po naprawie §4.3), ale bezpieczny przy aktualnym stanie danych.

**Decyzja właściciela (28.07.2026):** nie ujednolicać wzorca — luka nieosiągalna, ryzyko regresu przy masowej zmianie wyższe niż ryzyko podatności. Rewizja przy pierwszym nullowym company_id w users.

**Wzorzec pozostaje świadomie, objęty monitoringiem — naprawa dopiero przy wykryciu użytkownika bez firmy.**

Monitoring wdrożony w `.github/workflows/nightly-report.yml` (job `security-nullcheck`): każdej nocy o 03:30 UTC uruchamia zapytanie `SELECT COUNT(*) AS n FROM users WHERE company_id IS NULL AND active = 1`. Wynik > 0 powoduje niepowodzenie jobu z komunikatem wskazującym na ten paragraf i listę 8 handlerów.
