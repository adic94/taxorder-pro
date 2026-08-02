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

---

## 11. Test wielopodmiotowości na danych produkcyjnych — 2026-07-31

### Kontekst

Po migracji 24 pojazdów do właściwych firm (gcon 21, kjrsupply 2, nwkinvest 1) i usunięciu 8 pojazdów podwykonawców zewnętrznych baza zawiera po raz pierwszy realne dane w 4 tenantach:

| company_id | pojazdy |
|---|---|
| mtoilet | 193 |
| gcon | 21 |
| kjrsupply | 2 |
| nwkinvest | 1 |

Metodologia: tymczasowe konto testowe `izolacja-test@taxorder.pl` (rola `user`, company_id=`gcon`), usunięte po teście.

---

### 11.1 Test izolacji tenantów

| Endpoint | Parametr | Oczekiwane | Faktyczne | Status |
|---|---|---|---|---|
| GET /api/vehicles | (brak) | 21 (gcon) | 21 | ✅ |
| GET /api/vehicles | ?company=mtoilet | 403 | 403 | ✅ |
| GET /api/vehicles | ?company=gcon | 21 | 21 | ✅ |
| GET /api/companies | (brak) | tylko gcon | 1 firma (gcon) | ✅ |
| GET /api/tenants | (brak) | 403 (superadmin) | 404 — brak endpointu | ⚠️ |
| GET /api/dashboard | ?company=mtoilet | 403 | 403 | ✅ |
| GET /api/reports | ?company=mtoilet | 403 | 403 | ✅ |
| GET /api/documents | ?company=mtoilet | 403 | 403 | ✅ |
| PUT /api/vehicles/WGM87205 | ?company=mtoilet | 403 | 403 | ✅ |
| PUT /api/vehicles/WGM87205 | (brak) | 200, zapis do gcon | 200, (gcon, WGM87205) | ✅ zapis do własnej firmy |
| DELETE /api/vehicles/WGM87205 | ?company=mtoilet | 403 | 403 | ✅ |

**Wynik: izolacja działa dla wszystkich przetestowanych endpointów.**

Mechanizm: centralized guard (L8620–8625 w `handleRequest`), dokumentowany w §8.2. Potwierdzone empirycznie na pierwszym zbiorze danych wielu tenantów. Żaden wyciek danych mtoilet do gcon-user nie wystąpił.

Artefakt testu: PUT bez `?company=` stworzył rekord `(gcon, WGM87205)` — izolacja poprawna (zapis tylko do własnej firmy), artefakt usunięty po teście.

---

### 11.2 Panel najemców (`/api/tenants` + `tenant-panel.js`)

| Element | Stan |
|---|---|
| `GET /api/tenants` | 404 — endpoint nie istnieje w Worker |
| `modules/tenant-panel.js` | Plik nie istnieje w repozytorium |
| Tabela `company_packages` | Istnieje, ale pusta (0 wierszy) |
| Tabela `subscriptions` | Nie istnieje |

**Wniosek:** moduł tenant-panel i odpowiadający endpoint Worker nie zostały zaimplementowane. Liczba pojazdów per firma dostępna przez `GET /api/companies` (jako admin). Brak pakietów/licencji = wszystkie firmy mają domyślnie pełny dostęp do funkcji.

**Rekomendacja:** task backlog — implementacja `/api/tenants` i `tenant-panel.js` jako kolejny etap roadmapy multi-tenant.

---

### 11.3 Uzupełnienie WGM87205 (ID=1) z danych DR

Pojazd ID=1 (Fuso Canter, WGM87205) miał `wlasciciel=NULL` i `vin=NULL`. Znaleziony w checkpoincie DR (plik: `WGM87205 stały dowód mT.pdf`, seria DR: BAV6328358). Zaktualizowane pola:

| Pole | Przed | Po |
|---|---|---|
| `data.vin` | null | `TYBFECX1ELDC03229` |
| `data.wlasciciel` | null | `mToilet` |
| `data.dmc` | 8500 | 8550 (z DR) |
| `data.dmcMax` | (brak) | 8550 |
| `data.dmcZespolu` | 0 | 12050 (z DR) |

Operacja: `UPDATE vehicles SET data = json_set(...) WHERE id=1` — changes=1 ✅

---

## 12. Weryfikacja danych DT-1 przeciwko checkpointowi DR — 2026-07-31

### Kontekst

217 pojazdów w D1 porównano z 978 zdekodowanymi dowodami rejestracyjnymi w checkpoincie (`dr-extractor-checkpoint.ndjson`). Klucz dopasowania: VIN (priorytet), nr_rej (zapasowy). Porównywano pola F.1 (DMC) i F.3 (DMC zespołu). Pola `liczbaOsi` i `zawieszenie` pominięte — niereliabilne w nowym formacie DR (pole liczbaOsi zawiera miasto, zawieszenie — wartości numeryczne zamiast opisu).

Time Travel bookmark **przed** UPDATE: `000001bb-00000000-000050b9-17c1beda4c6baae89a059ebd484672dd`
Time Travel bookmark **po** UPDATE: `000001bb-0000000e-000050b9-e469234286b077418f96641a581cdc1b`

### 12.1 Wyniki dopasowania

| Metoda | Liczba |
|---|---|
| Dopasowano po VIN | 183 |
| Dopasowano po nr_rej | 4 |
| Bez dopasowania (brak DR w checkpoincie) | 30 |
| **Łącznie przebadanych** | **187** |

Pojazdy bez dopasowania (30): 12 myjek ciśnieniowych KRANZLE (niestandardowe VIN FF-/CK-/GJ-), Skoda WI820NW, CAN-AM WW187A, kilka Mercedes (NIK276, WWL5...) i Fuso WU6647K — brak tych DR w bazie skanów. Nie wymagają działania.

### 12.2 Grupy

| Grupa | Opis | Liczba |
|---|---|---|
| A — ZGODNE | DMC i DMC zespołu zgodne z DR | 14 |
| B — BRAKUJĄCE w D1 | Pole zerowe w D1, wartość obecna w DR | 171 |
| C — ROZBIEŻNE | Obie strony mają wartość, ale różną | 2 |

**Szczegóły grupy B (171 pojazdów):** Niemal wszystkie mają poprawne `dmc` w D1, ale brakuje `dmcZespolu` (pole domyślnie = 0). DR dostarcza wartości DMC zespołu z dokumentów F.3. Jeden wyjątek: **WA995AL ANDRE 2152N** — `dmc = 0` w D1, DR = 22 000 kg (kat. N3, >12 t) — brakujące DMC pojazdu, nie tylko zespołu.

**Pliki poza repo:**
- `dt1-brakujace-B.json` — pełna lista grupy B
- `dt1-backup-przed-update-B.json` — stan przed UPDATE (rollback)
- `dt1-rozbieznosci-C.txt` / `.json` — lista grupy C do ręcznej weryfikacji

### 12.3 Wpływ na podatek DT-1

| | Liczba pojazdów |
|---|---|
| Zmiana kategorii podatkowej z grupy B | **1** |
| Zmiana kategorii podatkowej z grupy C | 0 |
| **ŁĄCZNIE ryzyko zmiany stawki** | **1** |

Pojazd zmieniający kategorię: **WA995AL ANDRE 2152N** (mtoilet, ID=325) — brak DMC w D1 (było 0), DR: 22 000 kg → kat. N3 (>12 t). Po uzupełnieniu pojazd podlega opodatkowaniu DT-1.

Rozkład różnic w grupie C:
- < 100 kg (prawdop. zabudowa): 1 pojazd (WL2813N: 7500 vs 7490 kg, diff = 10 kg)
- > 500 kg (błąd wpisu lub inna wersja): 1 pojazd (WA8920J: 10 500 vs 9 500 kg, diff = 1000 kg)

Obie rozbieżności C pozostają bez zmiany — decyzja do weryfikacji z księgowością.

### 12.4 Wykonane UPDATE

Zakres: tylko grupa B (171 pojazdów), pola brakujące (dmc lub dmcZespolu = 0 w D1, > 0 w DR).

```sql
-- wrangler d1 execute taxorder-pro --remote --file=dt1-update-B.sql
-- 171 queries processed, 171 rows written, 172 changes
```

Wynik: ✅ 171/171 zmian. Spot-check:

| ID | nr_rej | dmc po | dmcZespolu po |
|---|---|---|---|
| 325 | WA995AL | 22 000 | 0 (brak w DR) |
| 7 | WGM0065L | 8 800 | 10 000 |
| 151 | WA0677L | 27 000 | 40 000 |
| 344 | WGM7656A | 9 500 | 13 000 |

---

### 12.5 Pojazdy podlegające DT-1 bez dowodu w archiwum

Z 30 pojazdów niedopasowanych do checkpointu DR — 16 ma dmc ≥ 3 500 kg i potencjalnie podlega DT-1. Brak DR oznacza brak możliwości weryfikacji danych podatkowych.

| nr_rej | marka | model | dmc (kg) | dt1_category | dt1_tax_amount |
|---|---|---|---|---|---|
| WZ320KA | MAN | TGM 4X4-G | 11 990 | D3 | 1 344 zł |
| NIK276 | Mercedes | Atego 2-G | 9 500 | — | — |
| WWL5358K | Mercedes | Atego 2-G | 9 500 | — | — |
| WWL5406K | Mercedes | Atego 2-G | 9 500 | — | — |
| WZ234HW | Mercedes | Atego 2-M | 9 500 | D3 | 1 344 zł |
| WZ236HW | Mercedes | Atego 2-M | 9 500 | D3 | 1 344 zł |
| WZ695FE | Mercedes | Atego 2-M | 9 500 | D3 | 1 488 zł |
| WZ961FF | Mercedes | Atego 2-M | 9 500 | D3 | 1 488 zł |
| WZ962FF | Mercedes | Atego 2-M | 9 500 | D3 | 1 488 zł |
| WZ971CS | Mercedes | Atego 2-M | 9 500 | D3 | 1 488 zł |
| WU6647K | Fuso | Canter 7/15 | 7 500 | D2 | 1 128 zł |
| WPR7520T | MAN | TGE 6.160 5.5T | 5 500 | D1 | 840 zł |
| WU6528M | Mercedes | Sprinter 5.5T 2.2 CDI | 5 500 | D1 | 840 zł |
| WZ846FL | Mercedes | Sprinter 5.5T 2.2 CDI | 5 500 | D1 | 840 zł |
| WZ931CV | Mercedes | Sprinter 5.5T 2.2 CDI | 5 500 | D1 | 840 zł |
| WWL5563K | Mercedes | Sprinter 5.5T 3.0 CDI | 5 500 | — | — |

Uwagi:
- 4 pojazdy (NIK276, WWL5358K, WWL5406K, WWL5563K) mają `dt1_category = null` — dane podatkowe nie zostały jeszcze obliczone w aplikacji.
- Różnica 1 344 vs 1 488 zł w D3 (9 500 kg): `ciezar_9_12_new` (rok ≥ 2024) vs `ciezar_9_12_old`.
- Żaden z 30 niedopasowanych nie jest przyczepą/naczepą z dmc ≥ 7 000 kg.

---

### 12.6 WA995AL — ślady rozliczeń i wyliczenie DT-1

#### Ślady w D1

- **dt1_declarations** (mtoilet): 0 wierszy — żadna deklaracja DT-1 nie została dotąd wygenerowana dla tej firmy. Tabela nie ma kolumny `nr_rej`; rozliczenia są zagregowane per spółka i rok.
- **documents** (nr_rej='WA995AL', vehicle_id=325): 0 dokumentów — pojazd nie ma żadnych plików w systemie.

Wniosek: WA995AL nigdy nie figurował w rozliczeniu DT-1. Zgadza się z faktem, że `dmc=0` przed korektą.

#### Wyliczenie DT-1 (TYLKO DO WGLĄDU — nie zapisano w D1)

Dane wejściowe (`TaxEngine.calcTax(v)`):

| Pole | Wartość |
|---|---|
| typ | Przyczepa |
| dmc (F.1) | 22 000 kg |
| dmcZespolu (F.3) | 0 (brak w DR) |
| osie | 2 |
| zawieszenie | pneumatyczne |
| rok | 2017 (isNew = false) |
| miesiacePodatku | 12 |

Logika krok po kroku:

```
getCat():
  dT = 22 000/1000 = 22 t
  dzT = 0/1000 = 0 t
  refZ = 0 > 0 ? 0 : 22 → refZ = 22 t   ← F.3=0, fallback na F.1
  typ.includes("przyczepa") → TRUE
  refZ=22 >= 12 → TRUE; osie=2 → "D14"

getRate():
  przyczepa, refZ=22 >= 12, osie=2
  refZ=22 < 28 → S.przyczepa_ge12_2os_lt28 = 1 488 zł/rok

calcTax():
  amount = round((1 488 × 12) / 12) = 1 488 zł
```

**Wynik: kategoria D14, podatek 1 488 zł/rok.**

Weryfikacja porównawcza: identyczna ścieżka kodu jak dla WW117AF (Przyczepa, 18 t, 3 osie → D15). WA995AL ma 2 osie → D14, co jest prawidłowe. WW424AP i WW6202Y to pojazdy `typ=Ciężarowy` (ciągniki), nie przyczepy — ich analiza w §12.9.

Kluczowa uwaga: TaxEngine używa `refZ = dmcZespolu` jeśli > 0, lub `dmc` jako fallback. Ponieważ DR nie zawierał F.3 dla tej przyczepy (co jest normalne — F.3 pochodzi z dowodu ciągnika, nie przyczepy), system poprawnie opiera się na F.1 = 22 t. Wynik jest poprawny podatkowo.

---

### 12.7 Liczba osi — nieosiągalna z checkpointu DR

#### Przyczyna

Wszystkie 17 DR dla pojazdów >= 12 t mają format `new`. W nowym formacie DR pole `liczbaOsi` mapuje na pozycję 44 w pliku tekstowym — jest to jednak pole organu wydającego (np. „WARSZAWA", „KAMPINOS"), a nie liczba osi z pola **L** dowodu rejestracyjnego. Mapowanie `_DR_NEW.liczbaOsi:44` w `worker/index.js:2767` jest błędne dla tego formatu.

#### Wyniki KROK 2 — tabela

| nr_rej | dmc (kg) | axles D1 | osie z DR | zgodne? |
|---|---|---|---|---|
| WA1697F | 32 000 | 2 | ? (nowy format) | — |
| WA2609J | 32 000 | 2 | ? | — |
| WZ464FY | 32 000 | 2 | ? | — |
| WZ621FY | 30 000 | 2 | ? | — |
| WZ899GJ | 28 000 | 2 | ? | — |
| WA0677L | 27 000 | 3 | ? | — |
| WA4789F | 27 000 | 2 | ? | — |
| WA9885J | 26 000 | 2 | ? | — |
| WW564AJ | 26 000 | 2 | ? | — |
| WW1659X | 26 000 | 3 | ? | — |
| WW424AP | 26 000 | 3 | ? | — |
| WW6202Y | 26 000 | 3 | ? | — |
| WA995AL | 22 000 | 2 | ? | — |
| WW117AF | 18 000 | 3 | ? | — |
| WZ209LJ | 16 200 | 3 | ? | — |
| WW1670X | 16 000 | 3 | ? | — |
| WW024AF | 14 000 | 2 | ? | — |

Wniosek: **liczba osi z DR niedostępna dla żadnego z 17 pojazdów** poprzez checkpoint NDJSON.

Dodatkowe obserwacje z checkpointu (pole `dmcKg` dla 17 pojazdów — format new):

| nr_rej | dmc D1 (kg) | dmc DR (kg) |
|---|---|---|
| WA1697F | 32 000 | 37 000 |
| WA2609J | 32 000 | 36 000 |
| WA4789F | 27 000 | 33 000 |
| WZ464FY | 32 000 | 28 000 |
| WW6202Y | 26 000 | 28 500 |
| WW424AP | 26 000 | 27 000 |
| WA9885J | 26 000 | 27 000 |
| WW564AJ | 26 000 | 27 000 |
| WZ621FY | 30 000 | 30 000 ✓ |
| WZ899GJ | 28 000 | 28 000 ✓ |

Pierwsze 8 wierszy: rozbieżności DMC zamaskowane przez klasyfikację grupy B (szczegóły w §12.10).

---

### 12.8 KROK 3/4 — Korekta liczby osi z nazwy modelu (oczekuje na decyzję)

Przy braku danych z DR jedynym pewnym źródłem jest nomenklatura modelu zawierająca konfigurację kół:

| nr_rej | model | axles_count D1 | osie z modelu | pewność |
|---|---|---|---|---|
| WA1697F | Volvo FMX **8x4** | 2 | **4** | PEWNE — 8 kół, 4 osie |
| WZ899GJ | Volvo FMX **6x2** | 2 | **3** | PEWNE — 6 kół, 3 osie |

Dla pozostałych pojazdów (FH 540, R580, R520, R490, Actros) model nie zawiera konfiguracji kół — nie można jednoznacznie ustalić liczby osi bez DR.

#### Wpływ na DT-1 po korekcie (hipotetyczny)

| nr_rej | dmc | kat przed | stawka przed | kat po | stawka po | różnica |
|---|---|---|---|---|---|---|
| WA1697F | 32 000 kg | D8 (2 osie) | 2 184 zł | D10 (4 osie, ≥ 29 t) | 4 296 zł | **+2 112 zł** |
| WZ899GJ | 28 000 kg | D8 (2 osie) | 2 184 zł | D9 (3 osie, ≥ 23 t) | 2 760 zł | **+576 zł** |
| **Łącznie** | | | **4 368 zł** | | **7 056 zł** | **+2 688 zł/rok** |

**Status:** korekta wstrzymana — oczekuje na decyzję. Jeśli akceptujesz korektę z nazw modeli, wykonam Time Travel bookmark i UPDATE dla obu pojazdów (axles_count i data.osie).

---

### 12.9 KROK 5 — WW424AP, WW6202Y, WW1659X: Ciężarowy, nie przyczepy

Pojazdy typ=Ciężarowy z dmcZespolu > 0 to ciągniki siodłowe i pojazdy z żurawiem HDS, nie przyczepy. TaxEngine dla Ciężarowy używa `dT = dmc/1000`, nie `refZ` — dmcZespolu nie wpływa na kategorię ani stawkę.

| nr_rej | model | typ | dmc | axles | dmcZ | dt1_cat | dt1_tax |
|---|---|---|---|---|---|---|---|
| WW424AP | Volvo FH 500 HDS | Ciężarowy | 26 000 | 3 | 40 000 | null | null |
| WW6202Y | Volvo FH-6X2R 420 | Ciężarowy | 26 000 | 3 | 40 000 | null | null |
| WW1659X | Scania P94 | Ciężarowy | 26 000 | 3 | 0 | null | null |

Wyliczenie TaxEngine (dla każdego z trzech):
- `dT = 26 t`, osie = 3 → kat D9
- `dT = 26 ≥ 23` → `ciezar_ge12_3os_ge23` = **2 760 zł/rok**

Zmiana dmcZespolu z 0 na 40 000 (wykonana w §12.4 dla WW424AP i WW6202Y) nie zmienia kategorii — ścieżka Ciężarowy ignoruje `refZ`. **Brak problemu z fallbackiem F.3→F.1 dla tych pojazdów.**

`dt1_cat = null` oznacza, że DT-1 nie zostało obliczone w aplikacji (pojazdy nie miały otwartego widoku DT-1). Brak deklaracji dt1_declarations dla firm gcon — nie wygenerowano rozliczeń.

---

### 12.10 Ukryte rozbieżności DMC — 8 pojazdów (zamaskowane przez grupę B)

#### Przyczyna masowania

Skrypt `dt1-verify.js` klasyfikuje do grupy B pojazdy z brakującym DMC **lub** dmcZespolu. Priorytet: jeśli `dmcZMissing=true`, pojazd ląduje w B — nawet gdy jednocześnie `dmcDiffer=true`. UPDATE grupy B uzupełniał tylko `dmcZespolu` (gdy brakujące); istniejące pole `dmc` pozostało bez zmian, choć różniło się od DR.

#### Lista rozbieżności

| nr_rej | marka | model | dmc D1 | dmc DR | diff |
|---|---|---|---|---|---|
| WA4789F | Scania | R540 Wodolejka | 27 000 | 33 000 | +6 000 |
| WA1697F | Volvo | FMX 8x4 | 32 000 | 37 000 | +5 000 |
| WA2609J | Volvo | FH 540 Szambiarka | 32 000 | 36 000 | +4 000 |
| WZ464FY | Volvo | FH 540 Wodolejka | 32 000 | 28 000 | −4 000 |
| WW6202Y | Volvo | FH-6X2R 420 | 26 000 | 28 500 | +2 500 |
| WW424AP | Volvo | FH 500 HDS | 26 000 | 27 000 | +1 000 |
| WA9885J | Mercedes | Actros | 26 000 | 27 000 | +1 000 |
| WW564AJ | Scania | R520 | 26 000 | 27 000 | +1 000 |

#### Wpływ podatkowy

Dla wszystkich 8 pojazdów: `axles_count = 2` i `dmc ≥ 15 t` → kategoria D8, stawka `ciezar_ge12_2os_ge15 = 2 184 zł`. Po korekcie dmc pozostają w przedziale ≥ 15 t → **stawka bez zmian**. Wyjątek: WA1697F po korekcie osi (§12.8) zmieni kategorię D8→D10 niezależnie od wartości dmc (37 t ≥ 29 t → 4 296 zł).

Rozbieżności DMC wymagają korekty dla dokładności danych, nie dla podatku. Decyzja do weryfikacji z dokumentami pojazdu.

---

### 12.11 Audyt mapowania _DR_NEW — wyniki KROK 1–3 (2026-08-01)

#### KROK 2 — Właściwa pozycja pola L (liczba osi)

Cel: znaleźć pozycję `liczbaOsi` w 67-polowym rekordzie mCEPiK Aztec.

Metoda: zdekodowanie surowych DR z pliku PDF przez pełny pipeline (Playwright pdf.js → JPEG 4×skala → zxing-wasm Node.js → NRV2E → UTF-16LE), wypisanie wszystkich 67 pozycji.

**Wyniki dekodowania:**

| Pojazd | Konfiguracja | Oczekiwane osie | pos 33 (dr-extractor) | **pos 44 (worker)** |
|---|---|---|---|---|
| WZ899GJ Volvo FM | 6X2 | 3 | "WARSZAWA" ✗ | **"3" ✓** |
| WK63469 Scania R420 | 4X2 | 2 | "WARSZAWA" ✗ | **"2" ✓** |

**Wniosek: `liczbaOsi` to pozycja 44, nie 33.**

- Mapowanie w `worker/index.js` → `_DR_NEW.liczbaOsi:44` → **POPRAWNE** (brak zmian)
- Mapowanie w `tools/dr-extractor.js` → `DR_NEW.liczbaOsi:33` → **BŁĘDNE** (wymaga zmiany na 44)

#### Dodatkowe odkrycia z surowego rekordu

Na podstawie WZ899GJ i WK63469 (obie 67 pól):

| Pozycja | Aktualna etykieta (dr-extractor) | Faktyczna zawartość | Status |
|---|---|---|---|
| 31 | `kategoriaDR` | NIP właściciela (9 cyfr, np. 382123092) | Błędna etykieta |
| 32 | `nadwozie` | Kod pocztowy właściciela (np. "03-226") | Błędna etykieta |
| 33 | `liczbaOsi` | Miasto właściciela (np. "WARSZAWA") | Błędna pozycja i etykieta |
| 43 | *(brak mapowania)* | K — numer homologacji (np. "PL\*2770\*06") | Niezamapowane |
| 44 | *(brak w dr-extractor)* | **L — liczba osi (np. "2", "3", "4")** | Brak w DR_NEW |
| 54 | `rokProdukcji` | Rodzaj pojazdu (np. "SAMOCHÓD CIĘŻAROWY", "CIĄGNIK SAMOCHODOWY") | Błędna etykieta |
| 55 | `podrodzaj` | Przeznaczenie (np. "PRZEWÓZ WODY") | Błędna etykieta |
| 56 | `przeznaczenie` | Rok produkcji (np. "2016", "2008") | Błędna etykieta |

Pozycje 3–6 = organ wydający (urząd rejestracji); 15–37 = dane właściciela (imię/firma, NIP, kod pocztowy, miasto, ulica, numer).

#### KROK 1 — Sanity check 988 wpisów checkpointu

| Pole | Valid | Invalid | %valid | Uwagi |
|---|---|---|---|---|
| seriaDr | 988 | 0 | 100% | OK |
| nrRej | 900 | 88 | 91% | 88 niestandardowych tablic (obcych lub specjalnych) |
| marka | 988 | 0 | 100% | OK |
| vin | 985 | 3 | 100% | 3 niestandardowe (stare pojazdy bez VIN) |
| dmcKg (F.1) | 962 | 11 | 99% | 11 poniżej 750 kg (lekkie przyczepy) |
| dmcKg2 (F.2) | 961 | 25 | 97% | 25 poniżej 750 kg |
| dmcZespolu (F.3) | 653 | 0 | 100% | OK (335 bez wartości = pojazdy bez przyczepy) |
| masaWlKg (G) | 854 | 134 | 86% | 134 poniżej 500 kg — lekkie przyczepy |
| kategoria (J) | 774 | 102 | 88% | 102 = kategorie specjalne (N1G, R3a, L3e...) |
| pojSilnika (P.1) | 688 | 0 | 100% | OK |
| mocKW (P.2) | 687 | 0 | 100% | OK |
| miejscaSied (S.1) | 687 | 0 | 100% | OK |
| **liczbaOsi (pos 33)** | **0** | **988** | **0%** | **Wszystkie to miasta — mapowanie BŁĘDNE** |
| paliwo (pos 50) | — | — | — | Format zmienny: "D" (nowe DR) lub "ON (Olej napędowy)" (stare DR) |
| dataRej (pos 51) | — | — | — | Format zmienny: "2016-04-04" (ISO) lub "02.05.2019" (PL) |

Relacje logiczne DMC: F.1 ≥ G zawsze (973 par, 0 anomalii) ✓ | F.2 ≤ F.1: 970 OK, **2 anomalie** (F.2 > F.1, niemożliwe — prawdopodobnie błąd w DR konkretnych pojazdów) | F.3 > F.1: 653 ciągników (oczekiwane dla zestawów) ✓

#### KROK 3 — Analiza dmcKg (F.1 vs F.2)

Rozbieżności DMC w §12.10 (w obie strony: +6000, −4000) tłumaczy różnica F.1 / F.2:
- **F.1 (pos 38)** = technicznie dopuszczalna DMC (wyższa)
- **F.2 (pos 39)** = operacyjna DMC dopuszczona przez organ rejestrujący (może być niższa)

Jeśli D1 miał zapisaną wartość z F.2 (ograniczoną przez pozwolenie), a checkpoint trzyma F.1 — różnica idzie "w dół". Jeśli D1 miał wartość z innego źródła — różnica może iść "w górę". Mapowanie `dmcKg:38` i `dmcKg2:39` w obu plikach (worker + dr-extractor) jest POPRAWNE.

#### Podsumowanie: co wymaga zmiany

| # | Plik | Zmiana | Priorytet |
|---|---|---|---|
| 1 | `tools/dr-extractor.js` | `liczbaOsi: 33` → `liczbaOsi: 44` | Wymagane przed kolejnym checkpointem |
| 2 | `tools/dr-extractor.js` | Etykiety: `rokProdukcji:56`, `przeznaczenie:55`, nowe `rodzajPojazdu:54` | Wymagane |
| 3 | `worker/index.js` | Brak zmian — `_DR_NEW.liczbaOsi:44` jest POPRAWNE | — |
| 4 | D1 `axles_count` | WZ899GJ: 2→3 (potwierdzone z DR pos 44 = "3") | ✓ Wykonane 2026-08-02 |
| 5 | D1 `axles_count` | WA1697F: 2→4 (DR potwierdzone: pos 44 = "4", VIN YV2JG20G9BA714219) | ✓ Wykonane 2026-08-02 |

KROK 4 wykonany — zob. §12.12 (kompletny audyt 17 pojazdów ≥12t).

---

#### KROK 4 — porównanie D1 axles_count vs DR pos 44 (2026-08-02)

Zakres: 11 kluczowych pojazdów z listy D1 (7 suspektów z axles_count=2 i dmc≥18t + 4 sanity-check z axles_count=3). Wszystkie miały pliki PDF w checkpoincie; wszystkie zdekodowane pomyślnie (strategia s4_p1 — skala 4.0, strona 1).

| nr_rej | marka | model | D1 osie | DR pos 44 | Status | Uwagi |
|---|---|---|---|---|---|---|
| WZ899GJ | Volvo | FMX 6x2 | 3 | 3 | ✓ match | poprawiono wcześniej w tej sesji |
| WW6202Y | Volvo | FH-6X2R 420 | 3 | 3 | ✓ match | |
| WW424AP | Volvo | FH 500 HDS | 3 | 3 | ✓ match | |
| WA0677L | Scania | R490 Szambiarka | 3 | 3 | ✓ match | |
| **WA1697F** | Volvo | FMX 8x4 | **2** | **4** | **ROZBIEŻNOŚĆ** | czeka na decyzję |
| **WA2609J** | Volvo | FH 540 Szambiarka | **2** | **4** | **ROZBIEŻNOŚĆ** | |
| **WZ464FY** | Volvo | FH 540 Wodolejka | **2** | **3** | **ROZBIEŻNOŚĆ** | |
| **WZ621FY** | Scania | R580 | **2** | **3** | **ROZBIEŻNOŚĆ** | |
| **WA4789F** | Scania | R540 Wodolejka | **2** | **4** | **ROZBIEŻNOŚĆ** | |
| **WA9885J** | Mercedes | Actros | **2** | **3** | **ROZBIEŻNOŚĆ** | |
| **WW564AJ** | Scania | R520 | **2** | **3** | **ROZBIEŻNOŚĆ** | |

**Wynik: 4 OK / 7 ROZBIEŻNOŚCI / 0 nieodczytanych.**

#### Wpływ podatkowy rozbieżności (pełny rok, miesiace_podatku=12)

Wszystkie 7 pojazdów ma aktualnie `dt1_category='D8'` (2 osie, ≥12t, 2 184 zł).

| nr_rej | DMC | Osie DR | Nowa kat. | Nowa stawka | Zmiana |
|---|---|---|---|---|---|
| WA1697F | 32 000 kg | 4 | D10 | 4 296 zł | +2 112 zł |
| WA2609J | 32 000 kg | 4 | D10 | 4 296 zł | +2 112 zł |
| WA4789F | 27 000 kg | 4 | D10 | 4 296 zł | +2 112 zł |
| WZ464FY | 32 000 kg | 3 | D9 | 2 760 zł | +576 zł |
| WZ621FY | 30 000 kg | 3 | D9 | 2 760 zł | +576 zł |
| WA9885J | 26 000 kg | 3 | D9 | 2 760 zł | +576 zł |
| WW564AJ | 26 000 kg | 3 | D9 | 2 760 zł | +576 zł |

**Łączna korekta: +8 640 zł/rok** (7 × D8 → D9/D10).

#### ✓ Korekty D1 wykonane (2026-08-02)

Time-travel bookmark przed korektą: `000001c8-00000000-000050bb-eb157d8907312f478e2fa951773bfbc3`
Backup stanu: `backup-axles-pre-correction-2026-08-02.json` (poza repo)

| nr_rej | zmiana axles | zmiana kategorii | stara stawka | nowa stawka | diff |
|---|---|---|---|---|---|
| WA1697F | 2 → 4 | D8 → D10 | 2 184 zł | 4 296 zł | +2 112 zł |
| WA2609J | 2 → 4 | D8 → D10 | 2 184 zł | 4 296 zł | +2 112 zł |
| WA4789F | 2 → 4 | D8 → D10 | 2 184 zł | **2 880 zł** | +696 zł |
| WZ464FY | 2 → 3 | D8 → D9 | 2 184 zł | 2 760 zł | +576 zł |
| WZ621FY | 2 → 3 | D8 → D9 | 2 184 zł | 2 760 zł | +576 zł |
| WA9885J | 2 → 3 | D8 → D9 | 2 184 zł | 2 760 zł | +576 zł |
| WW564AJ | 2 → 3 | D8 → D9 | 2 184 zł | 2 760 zł | +576 zł |

Uwaga WA4789F: dmc=27 000 kg → `ciezar_ge12_4os_lt29 = 2 880 zł` (nie 4 296 zł jak dla ≥29t).

**Suma korekty mtoilet: +7 224 zł/rok** (razem z WZ899GJ: +7 800 zł/rok).

Suma DT-1 po korekcie per firma:

| company_id | pojazdy | suma DT-1 |
|---|---|---|
| mtoilet | 193 | **201 096 zł** |
| gcon | 21 | 27 360 zł |
| kjrsupply | 2 | 4 248 zł |
| nwkinvest | 1 | 1 128 zł |

---

#### Weryfikacja: D1 WZ899GJ po korekcie (2026-08-02)

```
id=155, company_id='mtoilet', nr_rej='WZ899GJ'
axles_count:     2 → 3          ✓
dt1_category:    D8 → D9        ✓
dt1_tax_amount:  2184 → 2760 zł ✓
data.osie:       2 → 3          ✓
updated_at:      2026-08-02 08:39:01
```

Różnica podatku: **+576 zł/rok** (D8 ciezar_ge12_3os = 2 760 zł).

---

#### Weryfikacja: worker `_DR_NEW` pozycje 54/55/56 (2026-08-02)

Worker `worker/index.js` linii 2766–2768:

```javascript
const _DR_NEW = { seriaDr:1, nrRej:7, marka:8, typ:9, model:12, vin:13,
  dmcKg:38, dmcKg2:39, dmcZespolu:40, masaWlKg:41, kategoria:42, liczbaOsi:44,
  pojSilnika:48, mocKW:49, paliwo:50, dataRej:51, miejscaSied:52 };
```

**Pozycje 54/55/56 NIE SĄ zmapowane w workerze.** Worker nigdy nie zapisuje `rokProdukcji`, `rodzajPojazdu`, `przeznaczenie` do kolumny `data`.

Weryfikacja D1 (10 najnowszych pojazdów z wypełnionym JSON):

| nr_rej | data.rokProdukcji | data.rodzajPojazdu | data.przeznaczenie |
|---|---|---|---|
| WGM89755 | null | null | null |
| WL3597R | null | null | null |
| WA5535C | null | null | null |
| WGM0065L | null | null | null |
| WZ124HW | null | null | null |
| WZ122HW | null | null | null |
| WZ123HW | null | null | null |
| WZ389HM | null | null | null |
| WZ390HM | null | null | null |
| WL7611V | null | null | null |

**Wniosek:** Brak danych w D1 dla tych pól jest poprawny — worker ich nie pobiera z DR. Jeśli te pola mają być zapisywane, należy dodać je do `_DR_NEW` w workerze (poza zakresem bieżącego audytu). Checkpoint `dr-extractor.js` po naprawie etykiet będzie je zapisywał lokalnie.

---

#### WA1697F — wynik retry decode (2026-08-02)

Pipeline: Playwright pdf.js → strona **2** (nie strona 1!) → skala **6.0** (nie 4.0!) → zxing-wasm → NRV2E → 67 pól.

```
POS  7: WA 1697F                   (nrRej)
POS 13: YV2JG20G9BA714219          (VIN ✓ — pasuje do oczekiwanego)
POS 44: 4                          (liczba osi ✓ — 8×4 potwierdzone)
POS 38: 37000                      (F.1 DMC kg — potwierdza §12.10: D1 ma 32 000)
POS 39: 32000                      (F.2 DMC kg — to wartość w D1)
POS 40: 40000                      (F.3 DMC zespołu kg)
POS 41: 13675                      (G masa własna kg)
POS 51: 2011-07-11                 (data pierwszej rejestracji)
POS 54: SAMOCHÓD CIĘŻAROWY         (rodzaj pojazdu)
POS 55: PRZEWÓZ WODY               (przeznaczenie)
POS 56: 2011                       (rok produkcji)
```

**Dlaczego poprzednia próba nie powiodła się:** strona 1 PDF to strona tytułowa bez kodu Aztec; kod Aztec jest na stronie 2. Poprzedni skrypt próbował tylko strony 1 przy skali 4.0.

**Wniosek: axles_count D1 = 2 jest błędem. Korekta WA1697F 2→4 czeka na decyzję.**

Po korekcie: axles_count=4, DMC=37000 → kategoria **D10** (≥12t, ≥4 osie = 4 296 zł, pełny rok).
Zmiana podatku: 2 184 zł (D8) → 4 296 zł (D10), **różnica +2 112 zł/rok**.

---

### 12.12 Kompletny audyt pojazdów ≥12t — pozostałe 6 (2026-08-02)

Kontynuacja §12.11. Łączna baza: 17 pojazdów z DT-1 ≥12t (D8–D15 + WA995AL bez kategorii).
W §12.11 zaudytowano 11; tu pozostałe 6.

Metoda: decode DR pos 44, strategia multi-page (max strona 3), skale 4.0 / 6.0 / 8.0.

| nr_rej | typ | D1 kat. | D1 osie | DR osie | Status | Uwagi |
|---|---|---|---|---|---|---|
| WW1659X | Ciężarowy | D9 | 3 | 3 | ✓ match | Scania P94, rok=1999 |
| WW1670X | Ciężarowy | D9 | **3** | **2** | **ROZBIEŻNOŚĆ** | MAN 18.225 LC, rok=2003 |
| WW024AF | Przyczepa | D14 | 2 | 2 | ✓ match | Gfollner APL 2/4 TL, rok=2015 |
| WW117AF | Przyczepa | D15 | **3** | **2** | **ROZBIEŻNOŚĆ** | Sonst ANH. Hersteller, rok=2016 |
| WZ209LJ | Przyczepa | D15 | **3** | **2** | **ROZBIEŻNOŚĆ** | Meprozet PN-1, rok=2025 |
| WA995AL | Przyczepa | null | 2 | 2 | ✓ match | [NIE ZAPISUJ wyliczenia] |

**3 OK / 3 ROZBIEŻNOŚCI (D1 ma ZA DUŻO osi).**

#### Analiza wpływu podatkowego rozbieżności §12.12

Rozbieżności idą w ODWROTNYM kierunku niż §12.11 — D1 zawyża liczbę osi.

| nr_rej | marka | dmc | D1 osie→DR | Stara kat./stawka | Nowa kat./stawka | Zmiana |
|---|---|---|---|---|---|---|
| WW1670X | MAN 18.225 LC | 16 000 kg | 3 → 2 | D9 / 1 488 zł | D8 / **2 184 zł** | **+696 zł** |
| WW117AF | Sonst ANH. | 18 000 kg | 3 → 2 | D15 / 1 872 zł | D14 / **1 488 zł** | **−384 zł** |
| WZ209LJ | Meprozet PN-1 | 16 200 kg | 3 → 2 | D15 / 1 872 zł | D14 / **1 488 zł** | **−384 zł** |

Obliczenia TaxEngine (wszystkie `typ='Przyczepa'` lub `'Ciężarowy'`, `miesiace=12`):
- WW1670X (Ciężarowy, dT=16): D8 → `ciezar_ge12_2os_ge15 = 2 184 zł` (wyższe niż D9@16t=1 488!)
- WW117AF (Przyczepa, dT=18): D14 → `przyczepa_ge12_2os_lt28 = 1 488 zł`
- WZ209LJ (Przyczepa, dT=16.2): D14 → `przyczepa_ge12_2os_lt28 = 1 488 zł`

#### WA995AL — wniosek z decode

DR potwierdza: osie=2, rodzaj="PRZYCZEPA CIĘŻAROWA", przeznaczenie="PRZEWÓZ WODY", rok=2017.
D1 axles_count=2 — poprawne. dt1_category=null — zgodnie z wcześniejszym ograniczeniem, bez zmian.
Per TaxEngine byłoby D14 (2 osie, dmc=22t < 28t → 1 488 zł), ale wyliczenia nie zapisywać.

#### Podsumowanie całego audytu (§12.11 + §12.12)

Przebadano: **17/17 pojazdów ≥12t**.

| Kategoria | Liczba | Status |
|---|---|---|
| ✓ D1 = DR (bez zmian) | 7 | WA0677L, WW024AF, WW1659X, WW424AP, WW6202Y, WA995AL†, WZ899GJ\* |
| ✓ D1 poprawiony (za mało osi) | 7 | WA1697F, WA2609J, WA4789F, WZ464FY, WZ621FY, WA9885J, WW564AJ |
| ✓ D1 poprawiony (za dużo osi) | 2 | WW117AF, WZ209LJ |
| ⚠ Wstrzymany do wyjaśnienia | 1 | WW1670X (anomalia podatkowa — zob. niżej) |

\* WZ899GJ poprawiono we wcześniejszej sesji.
† WA995AL: match, bez zmian kategorii per ograniczenie.

#### ✓ WW117AF i WZ209LJ — korekta wykonana (2026-08-02)

Time-travel bookmark przed korektą: `000001c9-00000000-000050bb-18d43306e84365365b9eda666e4c13c1`

Oba pojazdy: `company_id='gcon'` (nie mtoilet!).

| nr_rej | axles_count | osie_json | dt1_category | dt1_tax_amount | updated_at |
|---|---|---|---|---|---|
| WW117AF | 3 → **2** | 3 → **2** | D15 → **D14** | 1872 → **1488 zł** | 2026-08-02 20:16:41 |
| WZ209LJ | 3 → **2** | 3 → **2** | D15 → **D14** | 1872 → **1488 zł** | 2026-08-02 20:16:41 |

Zmiana podatku: −384 zł/rok każdy = **−768 zł/rok** łącznie dla gcon.

#### ⚠ WW1670X — wstrzymane, anomalia podatkowa wyjaśniona

WW1670X: `Ciężarowy`, dmc=16 000 kg, aktualnie D9/3 osie/1488 zł.

DR pos 44 = 2 osie → przy 2 osiach podatek wzrósłby do 2 184 zł (+696 zł).

Mechanizm TaxEngine ([modules/tax-engine.js:145-163](../modules/tax-engine.js)):

```
Ciężarowy ≥12t, 2 osie (D8):
  dT < 13t → 1 200    dT 13-14t → 1 488    dT 14-15t → 1 680    dT ≥ 15t → 2 184

Ciężarowy ≥12t, 3 osie (D9):
  dT < 17t → 1 488    17-19t → 1 704    19-21t → 1 872    21-23t → 2 136    ≥23t → 2 760

Ciężarowy ≥12t, 4+ osie (D10):
  dT < 25t → 1 488    25-27t → 1 824    27-29t → 2 880    ≥29t → 4 296
```

WW1670X (dT=16): 2 osie → 16≥15 → **2 184 zł**; 3 osie → 16<17 → **1 488 zł**.

**Tabela nie ma błędu — to jest zgodne z ustawą** (art. 10 ust. 1 pkt 2 u.p.o.l.).
Prawo różnicuje progi DMC zależnie od liczby osi: 16t na 3 osiach to dolny bracket 3-osiowych
(lekki pojazd z dobrze rozłożonym naciskiem), ale 16t na 2 osiach to najwyższy bracket 2-osiowych
(wyższy nacisk na oś = większe niszczenie drogi). Efekt: mniej osi ≠ zawsze niższy podatek
w okolicach granicznych wartości DMC.

**Wniosek:** D1 ma 3 osie, DR mówi 2 → pojazd niedopłacał 696 zł/rok.
Korekta jest zasadna, ale skutkuje wzrostem podatku. Czeka na Twoją decyzję.

#### ✓ WW1670X — korekta wykonana (2026-08-02)

Time-travel bookmark przed korektą: `000001ca-00000000-000050bb-71682179467d134d95d1687ac904606f`
`company_id='kjrsupply'`

```
axles_count:    3 → 2     ✓
osie_json:      3 → 2     ✓
dt1_category:   D9 → D8   ✓
dt1_tax_amount: 1488 → 2184 zł  ✓
updated_at:     2026-08-02 20:21:25
```

---

### 12.13 Podsumowanie końcowe audytu DT-1 (§12.11–12.12)

#### Lista wszystkich skorygowanych pojazdów

| nr_rej | firma | os. przed | os. po | kat. przed | kat. po | stawka przed | stawka po | Δ zł/rok |
|---|---|---|---|---|---|---|---|---|
| WZ899GJ | mtoilet | 2 | 3 | D8 | D9 | 2 184 | 2 760 | **+576** |
| WA1697F | mtoilet | 2 | 4 | D8 | D10 | 2 184 | 4 296 | **+2 112** |
| WA2609J | mtoilet | 2 | 4 | D8 | D10 | 2 184 | 4 296 | **+2 112** |
| WA4789F | mtoilet | 2 | 4 | D8 | D10 | 2 184 | 2 880 | **+696** |
| WZ464FY | mtoilet | 2 | 3 | D8 | D9 | 2 184 | 2 760 | **+576** |
| WZ621FY | mtoilet | 2 | 3 | D8 | D9 | 2 184 | 2 760 | **+576** |
| WA9885J | mtoilet | 2 | 3 | D8 | D9 | 2 184 | 2 760 | **+576** |
| WW564AJ | mtoilet | 2 | 3 | D8 | D9 | 2 184 | 2 760 | **+576** |
| WW117AF | gcon | 3 | 2 | D15 | D14 | 1 872 | 1 488 | **−384** |
| WZ209LJ | gcon | 3 | 2 | D15 | D14 | 1 872 | 1 488 | **−384** |
| WW1670X | kjrsupply | 3 | 2 | D9 | D8 | 1 488 | 2 184 | **+696** |

#### Suma DT-1 per firma — przed/po audycie i różnica

| firma | suma przed audytem | suma po audycie | różnica |
|---|---|---|---|
| mtoilet | 193 296 zł | **201 096 z��** | **+7 800 zł** |
| gcon | 27 360 zł | **26 592 zł** | **−768 zł** |
| kjrsupply | 4 248 zł | **4 944 zł** | **+696 zł** |
| nwkinvest | 1 128 zł | **1 128 zł** | 0 zł |
| **RAZEM** | **226 032 zł** | **233 760 zł** | **+7 728 zł** |

Suma "przed" obliczona przez odwrócenie korekt z zapisanych stanów i backupów.

#### Wnioski

- Audyt objął **17/17** pojazdów z kategorii DT-1 ≥12t (D8–D15).
- Metoda: decode DR pos 44 (liczba osi) przez Playwright→zxing-wasm pipeline; porównanie z D1 `axles_count`.
- Źródłem błędów była stara wersja `dr-extractor.js` z mapowaniem `liczbaOsi:33` (dane właściciela) zamiast `liczbaOsi:44` (pole L z DR). Worker miał poprawne mapowanie od początku, ale część pojazdów była wczytana z innego źródła lub manualnie.
- Korekty zwiększyły łączny podatek o **+7 728 zł/rok** — wszystkie firmy (niedoszacowanie osi było na niekorzyść budżetu gminy).
- Niezmienny: WA995AL (ograniczenie `dt1_category=null` celowe).

**§12 zamknięty.**
