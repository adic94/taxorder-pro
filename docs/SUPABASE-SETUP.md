# 🗄️ Opcja B: Konfiguracja Supabase — Przewodnik

## 📋 Spis treści
1. [Tworzenie projektu Supabase](#tworzenie-projektu)
2. [Tworzenie tabel](#tworzenie-tabel)
3. [Konfiguracja w aplikacji](#konfiguracja-aplikacji)
4. [Migracja danych](#migracja-danych)
5. [Testowanie](#testowanie)

---

## 🚀 Tworzenie projektu

### Krok 1: Zarejestruj się w Supabase
1. Wejdź na https://supabase.com
2. Kliknij **"Sign Up"**
3. Zaloguj się przez GitHub lub email

### Krok 2: Stwórz nowy projekt
1. W dashboardzie kliknij **"New Project"**
2. Wpisz nazwę: `taxorder-fleet-manager`
3. Wybierz region (Polska: `eu-west-1` - Ireland lub `eu-central-1` - Frankfurt)
4. Ustaw hasło: **zapisz je bezpiecznie!**
5. Kliknij **"Create new project"**

### Krok 3: Pobierz klucze API
1. Przejdź do **Settings → API**
2. Skopiuj:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_KEY`

---

## 🗄️ Tworzenie tabel

### Krok 1: Otwórz SQL Editor
1. W Supabase, przejdź do **SQL Editor**
2. Kliknij **"New Query"**

### Krok 2: Wklej migracje
1. Otwórz plik `docs/supabase-migrations.sql`
2. Skopiuj CAŁĄ zawartość
3. Wklej do SQL Editora w Supabase
4. Kliknij **"Run"**

✅ Wszystkie tabele zostały utworzone!

---

## ⚙️ Konfiguracja w aplikacji

### Metoda 1: Zmienne środowiskowe (REKOMENDOWANE)

Utwórz plik `.env` w głównym katalogu projektu:

```env
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_KEY
REACT_APP_SUPABASE_SERVICE_KEY=YOUR_SERVICE_KEY
```

### Metoda 2: Bezpośrednio w kodzie (tymczasowo)

W `modules/supabase-manager.js`, linia 8-11:

```javascript
const SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_ANON_KEY',
  serviceKey: 'YOUR_SERVICE_KEY',
  enabled: false
};
```

### Metoda 3: Cloudflare Pages (produkcja)

W Cloudflare Pages, dodaj zmienne środowiskowe:

1. Projekt → Settings → Environment variables
2. Dodaj:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
3. Deploy

---

## 📤 Migracja danych

### Krok 1: Dodaj kolumnę UUID do lokalnych danych

W `modules/integration.js`, po zalogowaniu:

```javascript
function migrateLocalDataToSupabase() {
  const user = getCurrentUser();
  const companyId = user.companyId;
  
  // Dodaj UUID do pojazdów
  if (!vehs[0]?.id?.startsWith('veh-')) {
    vehs.forEach(v => {
      if (!v.id) v.id = 'veh-' + Date.now();
    });
  }
  
  // Wyślij do Supabase
  vehs.forEach(async (v) => {
    await SupabaseManager.addVehicle({
      company_id: companyId,
      ...v
    });
  });
}
```

### Krok 2: Synchronizuj dane

```javascript
// Po zalogowaniu
await SupabaseManager.syncFromSupabase(userCompanyId);
```

---

## ✅ Testowanie

### Test 1: Połączenie
```javascript
SupabaseManager.initSupabase();
if (SupabaseManager.isSupabaseEnabled()) {
  console.log('✅ Supabase jest dostępny');
}
```

### Test 2: Dodaj pojazd
```javascript
await SupabaseManager.addVehicle({
  company_id: 'test-company',
  nr_rej: 'WA 12345',
  marka: 'Volvo',
  model: 'FH16',
  rok: 2020
});
```

### Test 3: Pobierz pojazdy
```javascript
const vehicles = await SupabaseManager.getVehicles('test-company');
console.log(vehicles);
```

---

## 🔐 Bezpieczeństwo

### Row Level Security (RLS)
✅ **Włączone** - Użytkownicy mogą czytać/edytować tylko dane swojej firmy

### Uwierzytelnianie
- Email + Hasło (Supabase Auth)
- Session tokeny
- JWT

### Szyfrowanie
- HTTPS (automatyczne)
- Klucze API nie są przechowywane w kodzie (używaj zmiennych środowiskowych)

---

## 📊 Struktura bazy danych

```
users (użytkownicy)
├── id (UUID)
├── email
├── password_hash
├── role (admin, accountant, fleet_manager, viewer)
├── company_id (FK)
└── ...

companies (firmy)
├── id (UUID)
├── name
├── nip
├── regon
└── ...

vehicles (pojazdy)
├── id (UUID)
├── company_id (FK)
├── nr_rej
├── marka
├── vin
├── dmc
└── ...

drivers (kierowcy)
├── id (UUID)
├── company_id (FK)
├── first_name
├── last_name
└── vehicles (JSON array)

documents (dokumenty)
├── id (UUID)
├── vehicle_id (FK)
├── type (OC, BadaniaTechniczne, DPF)
├── expiry_date
└── ...

costs (koszty)
├── id (UUID)
├── vehicle_id (FK)
├── company_id (FK)
├── type (paliwo, naprawa, ubezpieczenie)
├── amount
└── ...

taxes_dt1 (podatki DT-1)
├── id (UUID)
├── company_id (FK)
├── tax_year
├── vehicles (JSON)
└── total_amount

integrations (integracje)
├── id (UUID)
├── company_id (FK)
├── service (CEPiK, eHanuta)
├── enabled
└── api_key_encrypted
```

---

## 🎯 Następne kroki

1. ✅ **Opublikuj migracje SQL** (`supabase-migrations.sql`)
2. ✅ **Skonfiguruj zmienne środowiskowe**
3. ✅ **Testuj połączenie**
4. 📅 **Opcja C** - Rozwiń moduły (Kierowcy, Koszty, Raporty)

