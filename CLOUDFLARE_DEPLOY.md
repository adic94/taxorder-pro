# TaxOrder Pro — Wdrożenie Cloudflare

## Wymagania wstępne
- Konto Cloudflare (darmowe wystarczy)
- Node.js zainstalowany (do Wrangler CLI)
- Terminal / PowerShell

---

## Krok 1 — Zainstaluj Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

---

## Krok 2 — Utwórz zasoby Cloudflare

Uruchom każdą komendę osobno i zanotuj zwrócone ID:

```bash
# D1 SQLite — baza pojazdów / użytkowników
wrangler d1 create taxorder-pro
# → skopiuj "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# R2 — pliki dokumentów
wrangler r2 bucket create taxorder-docs

# KV — opcjonalnie (prefs fallback)
wrangler kv namespace create PREFS
# → skopiuj "id": "yyyyyyyy..."
```

---

## Krok 3 — Uzupełnij wrangler.toml

Otwórz plik `wrangler.toml` i wklej ID z poprzedniego kroku:

```toml
[[d1_databases]]
database_id = "WKLEJ_TUTAJ_D1_ID"

[[kv_namespaces]]
id = "WKLEJ_TUTAJ_KV_ID"
```

---

## Krok 4 — Inicjalizuj bazę danych

⚠️ **NIE używaj `worker/schema.sql`** — to przestarzały plik z pierwszej wersji
projektu (7 tabel: `users`, `sessions`, `vehicles`, `company_states`, `user_prefs`,
`documents`, `push_subscriptions`). Baza ma dziś **49 plików `schema_v*.sql`**
(kolejne migracje) plus kilka `migration_v*.sql` (przebudowy strukturalne).
Wdrożenie samym `schema.sql` da bazę bez firm, KSeF, tachografów, floty
rezerwacji i dziesiątek innych tabel — Worker zacznie padać na `no such table`
przy pierwszym użyciu czegokolwiek poza podstawowym CRUD-em pojazdów.

Zastosuj wszystkie pliki schematu **w kolejności numerycznej**, z pominięciem
plików `_ROLLBACK` (to jest ta sama zasada, której pilnuje `nightly-report.yml`):

```bash
# Lokalna (do testów)
for f in $(ls worker/schema_v*.sql | grep -v ROLLBACK | sort -V); do
  wrangler d1 execute taxorder-pro --file="$f"
done

# Zdalna (produkcja)
for f in $(ls worker/schema_v*.sql | grep -v ROLLBACK | sort -V); do
  wrangler d1 execute taxorder-pro --file="$f" --remote
done
```

Następnie zastosuj migracje strukturalne (nie wchodzą przez nocny automat,
zawsze ręcznie — każda zawiera w nagłówku uzasadnienie, dlaczego jest osobno):

```bash
for f in $(ls worker/migration_v*.sql | grep -v ROLLBACK | sort -V); do
  wrangler d1 execute taxorder-pro --file="$f" --remote
done
```

Po każdym kroku warto sprawdzić realny stan zamiast ufać brakowi błędu:
`wrangler d1 execute taxorder-pro --remote --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table'"`
— docelowo powinno wyjść ok. 130+ tabel.

---

## Krok 5 — Deployuj Worker

```bash
wrangler deploy
```

Po deploymencie Wrangler wyświetli URL w stylu:
```
https://taxorder-pro.TWOJA-SUBDOMENA.workers.dev
```

---

## Krok 6 — Ustaw hasło administratora

1. Otwórz w przeglądarce (zastąp URL swoim):
   ```
   https://taxorder-pro.TWOJA-SUBDOMENA.workers.dev/api/auth/setup?password=admin2025
   ```

2. Skopiuj wartość `hash` z odpowiedzi JSON.

3. Zaktualizuj bazę hashem:
   ```bash
   wrangler d1 execute taxorder-pro --remote --command="UPDATE users SET password_hash='WKLEJ_HASH' WHERE email='adamus1000@gmail.com'"
   ```

---

## Krok 7 — Skonfiguruj aplikację

Otwórz `taxorder-pro/config/cf-config.js` i wstaw swój URL:

```js
window.CF_API_URL = 'https://taxorder-pro.TWOJA-SUBDOMENA.workers.dev';
```

---

## Krok 8 — Testowanie lokalne

Możesz testować Worker lokalnie bez deploymentu:

```bash
wrangler dev
# → Worker dostępny na http://localhost:8787
```

W `cf-config.js` zmień URL na:
```js
window.CF_API_URL = 'http://localhost:8787';
```

---

## Dane logowania (domyślne)

| Pole    | Wartość             |
|---------|---------------------|
| Email   | adamus1000@gmail.com |
| Hasło   | admin2025           |

**Zmień hasło po pierwszym logowaniu!**

---

## Diagnostyka

```bash
# Sprawdź logi Workera
wrangler tail

# Sprawdź D1 ręcznie
wrangler d1 execute taxorder-pro --remote --command="SELECT * FROM users"
wrangler d1 execute taxorder-pro --remote --command="SELECT COUNT(*) FROM vehicles"
```

---

## Architektura

```
[Przeglądarka]
    │
    ├─ config/cf-config.js       → URL Workera
    ├─ modules/cf-cloud.js       → Klient API (auth, flota, prefs, docs)
    └─ app.js                    → Hooki: setV, switchCompany, saveCompanyState
         │
         ▼ fetch (JWT Bearer token)
[Cloudflare Worker]
    ├─ /api/auth/*               → login, logout, me, setup
    ├─ /api/vehicles/*           → CRUD pojazdów
    ├─ /api/state/:companyId     → stan firmy (taxpayer, selected, rok)
    ├─ /api/prefs                → preferencje kolumn
    ├─ /api/docs/*               → metadane dokumentów
    └─ /api/users/*              → zarządzanie użytkownikami (admin)
         │
         ├─ D1 (SQLite)         → users, sessions, vehicles, company_states, documents
         ├─ R2 (Object Storage) → pliki dokumentów
         └─ KV                  → sesje (opcjonalnie)
```
