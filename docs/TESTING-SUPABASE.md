# 🧪 Testowanie Supabase - Instrukcja

## 🎯 Cel
Zweryfikować czy połączenie z Supabase działa prawidłowo i wszystkie operacje na bazie danych funkcjonują.

---

## 📋 PRZEDWARUNKI

Zanim zaczniesz testy, musisz mieć:

✅ **Projekt w Supabase** (https://supabase.com)
- [ ] Zalogowany account
- [ ] Stworzony projekt `taxorder-fleet-manager`
- [ ] Pobrane klucze API (URL i anon key)

✅ **SQL Migracje uruchomione**
- [ ] Wszystkie tabele utworzone w SQL Editorze
- [ ] Brak błędów przy tworzeniu tabel

✅ **Konfiguracja w kodzie**
- [ ] Edytowany plik `modules/supabase-manager.js`
- [ ] Wpisane właściwe URL i klucze

---

## 🚀 KROKI TESTOWANIA

### Krok 1: Dodaj plik testów do index.html

Wtedy do sekcji `<head>` w `index.html`, dodaj:

```html
<!-- Ładuj test suite TYLKO w development -->
<script src="modules/test-suite.js"></script>
```

Or jeśli chcesz warunkowe ładowanie (produkcja vs development):

```html
<script>
  // Ładuj test-suite tylko w localhost
  if (window.location.hostname === 'localhost') {
    const script = document.createElement('script');
    script.src = 'modules/test-suite.js';
    document.head.appendChild(script);
  }
</script>
```

### Krok 2: Otwórz aplikację w przeglądarce

```
https://localhost:5000/index.html
(lub twój URL)
```

### Krok 3: Otwórz DevTools (Developer Console)

**Windows/Linux**: `Ctrl + Shift + I`  
**Mac**: `Cmd + Option + I`

Lub kliknij prawym przyciskiem → "Inspect Element" → zakładka "Console"

### Krok 4: Uruchom polecenie help

W konsoli wpisz:

```javascript
testHelp()
```

Ukażą się dostępne testy.

---

## 🔧 TESTY DO WYKONANIA

### TEST 1: Sprawdzenie konfiguracji

```javascript
test2_config()
```

**Oczekiwany wynik:**
```
✓ URL: https://YOUR_PROJECT.supabase.co
✓ anonKey: ✓ (ustawiony)
✓ serviceKey: ✓ (ustawiony)
✓ Konfiguracja OK
```

**Jeśli błąd:**
- Sprawdź czy zmienne w `modules/supabase-manager.js` są prawidłowe
- Czy URL nie zawiera "YOUR_PROJECT"?

---

### TEST 2: Połączenie

```javascript
await test3_connect()
```

**Oczekiwany wynik:**
```
✅ Połączenie z Supabase UDANE! ✅
```

**Jeśli błąd:**
- "CORS error" → Supabase blokuje twój origin
  - **Rozwiązanie**: Testuj na Cloudflare Pages lub dodaj origin do CORS w Supabase
- "Connection refused" → Baza danych nie odpowiada
  - **Rozwiązanie**: Sprawdź czy projekt w Supabase jest aktywny
- "Invalid API key" → Klucz nieprawidłowy
  - **Rozwiązanie**: Skopiuj ponownie z Supabase Settings → API

---

### TEST 3: Pobierz pojazdy

```javascript
await test4_getVehicles()
```

**Oczekiwany wynik:**
```
✓ Pobrano 0 pojazd(ów)  (brak danych to OK na początek)
```

lub

```
✓ Pobrano 5 pojazd(ów)
✓ Pojazdy: [{...}, {...}, ...]
```

**Jeśli błąd:**
- "Unauthorized" → Brak dostępu do tabeli vehicles
  - **Rozwiązanie**: Sprawdź RLS policies w Supabase

---

### TEST 4: Dodaj pojazd

```javascript
const newVeh = await test5_addVehicle('WA-TEST-001')
```

**Oczekiwany wynik:**
```
✅ Pojazd dodany: 550e8400-e29b-41d4-a716-446655440000
✓ Dane pojazdu: {id: '...', nr_rej: 'WA-TEST-001', ...}
```

**Jeśli błąd:**
- "Unauthorized" → Brak uprawnień do INSERT
  - **Rozwiązanie**: Sprawdź RLS dla INSERT
- "duplicate key" → Pojazd z tym numerem już istnieje
  - **Rozwiązanie**: Użyj innego numeru rejestracyjnego

**Zapisz ID pojazdu** — będzie potrzebny do następnych testów!

---

### TEST 5: Aktualizuj pojazd

Zastąp `VEHICLE_ID` ID z TEST 4:

```javascript
await test6_updateVehicle('550e8400-e29b-41d4-a716-446655440000')
```

**Oczekiwany wynik:**
```
✅ Pojazd zaktualizowany
✓ Nowe dane: {id: '...', dmc: 6000, euro: 'EURO 5', ...}
```

---

### TEST 6: Operacje na dokumentach

```javascript
await test8_documents('550e8400-e29b-41d4-a716-446655440000')
```

**Oczekiwany wynik:**
```
✓ Dokumenty pojazdu (0):
✅ Dokument dodany
✓ Dokument: {id: '...', type: 'OC', ...}
```

---

### TEST 7: Operacje na kosztach

```javascript
await test9_costs('550e8400-e29b-41d4-a716-446655440000')
```

**Oczekiwany wynik:**
```
✓ Koszty pojazdu (0):
✅ Koszt dodany
✓ Koszt: {id: '...', amount: 250.50, type: 'paliwo', ...}
```

---

### TEST 8: Synchronizacja

```javascript
await test7_sync('mtoilet')
```

**Oczekiwany wynik:**
```
✓ Synchronizacja z Supabase...
✅ Synchronizacja UDANA
✓ FleetManager.DB.vehicles: 1
✓ FleetManager.DB.documents: 1
✓ FleetManager.DB.costs: 1
```

---

## 🎯 PEŁNY TEST

Uruchom wszystkie testy naraz:

```javascript
await testFull()
```

Aplikkacja:
1. Zainicjuje Supabase
2. Sprawdzi konfigurację
3. Testuje połączenie
4. Pobierze pojazdy
5. Doda nowy pojazd
6. Zaktualizuje pojazd
7. Doda dokument
8. Doda koszt
9. Zsynchronizuje dane

**Jeśli wszystko zadziała** → ✅ **Supabase konfiguracja OK!**

---

## 📊 WERYFIKACJA W SUPABASE UI

Po uruchomieniu testów, przejdź do:

https://app.supabase.com → Twój projekt → **Table Editor**

Powinnowna zobaczyć:
- ✅ `vehicles` - 1 nowy pojazd
- ✅ `documents` - 1 nowy dokument
- ✅ `costs` - 1 nowy koszt

---

## 🐛 TROUBLESHOOTING

### Problem: "SUPABASE_CONFIG nie znaleziony"
```javascript
// Sprawdź czy SupabaseManager załadowany
console.log(window.SupabaseManager)

// Jeśli undefined, plik nie załadował się
// Rozwiązanie: Dodaj <script src="modules/supabase-manager.js"></script> do index.html
```

### Problem: "Brak danych w bazie"
```javascript
// Sprawdź czy tabele istnieją w Supabase
// Table Editor → czy widać vehicles, documents, costs?

// Jeśli nie:
// 1. Wejdź do SQL Editor
// 2. Wklej zawartość docs/supabase-migrations.sql
// 3. Kliknij "Run"
```

### Problem: "CORS error"
```
Error: Access to XMLHttpRequest from origin 'http://localhost:5000' 
has been blocked by CORS policy
```

**Rozwiązanie:**
1. Wejdź do Supabase → Settings → API
2. Przewiń do "CORS Settings"
3. Dodaj: `http://localhost:5000`
4. Odśwież stronę (Ctrl+Shift+R)

---

## ✅ CHECKLIST

- [ ] Projekt w Supabase stworzony
- [ ] Klucze API skopiowane
- [ ] SQL migracje uruchomione
- [ ] modules/supabase-manager.js skonfigurowany
- [ ] modules/test-suite.js dodany do index.html
- [ ] test2_config() przechodzi
- [ ] test3_connect() przechodzi
- [ ] test4_getVehicles() przechodzi
- [ ] test5_addVehicle() przechodzi
- [ ] Dane widoczne w Supabase UI
- [ ] testFull() przechodzi bez błędów

---

## 🎉 Sukces!

Jeśli wszystkie testy przejdą, to oznacza że:

✅ Supabase jest prawidłowo skonfigurowany  
✅ Baza danych jest dostępna  
✅ API funkcjonuje  
✅ Możemy przejść do **OPCJI C** — rozwinięcia modułów

---

**Napisz "Gotowe! Testy przeszły." lub opisz błędy które napotkałeś.**
