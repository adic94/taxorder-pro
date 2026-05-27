# TaxOrder Pro - Cloudflare Pages

Statyczna aplikacja webowa do obliczania podatku od pojazdów (formularz DT-1 i DT-1/A) dla polskiego Ministerstwa Finansów.

## ✨ Cechy

- 📄 Obsługa formularzy **DT-1** i **DT-1/A**
- 🚗 Zarządzanie flotą pojazdów
- 💰 Automatyczne obliczanie podatku
- 📊 Generowanie raportów Excel
- 🔐 Bezpieczne przechowywanie danych lokalnie (localStorage)
- 📱 Responsywny interfejs
- 🌐 Funkcjonuje bez backendu (pure static)
- 🚀 Gotowe do Cloudflare Pages

## 📋 Wymagania

- Nowoczesna przeglądarka (Chrome, Firefox, Safari, Edge)
- Obsługa JavaScript ES6+
- Obsługa Web Workers (do OCR)

## 🚀 Wdrożenie na Cloudflare Pages

### Metoda 1: Git (rekomendowana)

1. **Zaloguj się** na [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Przejdź** do **Pages** → **Create a project**
3. **Wybierz** opcję **Connect to Git**
4. **Autoryzuj** dostęp do GitHub
5. **Wybierz** repozytorium `adic94/taxorder-pro`
6. **Skonfiguruj build settings:**
   - **Project name:** `taxorder-pro` (lub dowolna nazwa)
   - **Production branch:** `main`
   - **Build command:** (pozostaw puste - aplikacja jest static)
   - **Build output directory:** `/` (root)
7. **Kliknij** "Save and Deploy"

### Metoda 2: Drag & Drop

1. Przygotuj wszystkie pliki (`.zip` lub folder)
2. Przejdź do [Cloudflare Pages](https://dash.cloudflare.com/pages)
3. Kliknij **Create a project** → **Upload assets**
4. Przeciągnij folder lub ZIP na okno
5. Cloudflare automatycznie wgra wszystkie pliki

### Metoda 3: Wrangler CLI

```bash
# Zainstaluj Wrangler
npm install -g wrangler

# Zaloguj się
wrangler login

# Wdróż projekt
wrangler pages deploy .
```

## 📁 Struktura plików

```
taxorder-pro/
├── index.html              # Główna strona aplikacji
├── app.js                  # Logika aplikacji (246 KB)
├── style.css               # Style CSS
├── pdf-lib.min.js          # Biblioteka do manipulacji PDF
├── fontkit.umd.min.js      # Obsługa czcionek
├── assets/                 # Zasoby (jeśli dodane)
│   ├── DT1formularz.pdf    # Formularz DT-1
│   ├── DT1Azalacznik.pdf   # Załącznik DT-1/A
│   └── Roboto.ttf          # Czcionka Roboto
├── .gitignore              # Pliki do ignorowania
└── README.md               # Ta instrukcja
```

## 🔧 Konfiguracja lokalna

### Uruchomienie lokalnie (do testów)

**Opcja 1: Python**
```bash
python -m http.server 8000
# Otwórz http://localhost:8000
```

**Opcja 2: Node.js + http-server**
```bash
npm install -g http-server
http-server
# Otwórz http://localhost:8080
```

**Opcja 3: Live Server (VS Code)**
- Zainstaluj rozszerzenie "Live Server"
- Kliknij prawym przyciskiem na `index.html`
- Wybierz "Open with Live Server"

## ⚙️ Ścieżki plików

Wszystkie ścieżki w kodzie są **względne**:

```javascript
// ✅ Prawidłowo (względna ścieżka)
fetch('./assets/DT1formularz.pdf')

// ❌ Nieprawidłowo (absolutna ścieżka)
fetch('/assets/DT1formularz.pdf')
fetch('file:///path/to/assets/DT1formularz.pdf')
```

## 🔐 Bezpieczeństwo i CORS

- Aplikacja działa w pełni klient-side (brak wysyłania danych do serwera)
- Dane przechowywane w `localStorage` są dostępne tylko z tej domeny
- Cloudflare Pages automatycznie ustawia prawidłowe nagłówki CORS
- PDF i zasoby ładują się przez HTTPS

## 📊 Obsługiwane funkcje

- ✅ Tworzenie flotacji pojazdów
- ✅ Obliczanie podatku (różne stawki)
- ✅ Generowanie formularzy DT-1
- ✅ Generowanie załączników DT-1/A
- ✅ Eksport do Excel
- ✅ Import z Excel
- ✅ OCR (rozpoznawanie tekstu z PDF)
- ✅ Zarządzanie użytkownikami
- ✅ Przechowywanie danych offline
- ✅ Pobieranie PDF z wypełnionymi danymi

## 📝 Informacje o domenie

Po deploymencie na Cloudflare Pages otrzymasz:

```
Domena: https://taxorder-pro.pages.dev
Lub: Twoja własna domena (jeśli dodasz)
```

### Dodanie własnej domeny

1. Przejdź do **Pages** → Twój projekt
2. **Settings** → **Custom domain**
3. Wprowadź swoją domenę
4. Skonfiguruj DNS (Cloudflare przeprowadzi Cię przez proces)

## 🐛 Troubleshooting

### "Nie można załadować PDF"
- Sprawdź, czy pliki `DT1formularz.pdf` i `DT1Azalacznik.pdf` są w folderze
- Upewnij się, że ścieżki są względne: `./assets/DT1formularz.pdf`
- Otwórz DevTools (F12) i sprawdź konsolę pod kątem błędów CORS

### "Czcionka nie ładuje się"
- Sprawdź ścieżkę do pliku `Roboto.ttf`
- Upewnij się, że MIME type dla TTF jest prawidłowy (Cloudflare powinien obsługiwać automatycznie)

### "localStorage nie działa"
- Sprawdź, czy przeglądarka obsługuje localStorage
- Sprawdź ustawienia prywatności/incognito (mogą blokować localStorage)

### "Aplikacja nie startuje"
- Otwórz DevTools (F12) → Console
- Sprawdź pod kątem błędów JavaScriptu
- Sprawdź Network tab - czy wszystkie zasoby się ładują

## 🌍 HTTPS

Cloudflare Pages **automatycznie** obsługuje HTTPS z certyfikatem SSL/TLS. Wszystkie połączenia są szyfrowane.

## 📞 Wsparcie

- 📖 [Dokumentacja Cloudflare Pages](https://developers.cloudflare.com/pages/)
- 🐛 [Issues w repozytorium](https://github.com/adic94/taxorder-pro/issues)
- 💬 [Cloudflare Community](https://community.cloudflare.com/)

## 📄 Licencja

Projekt przeznaczony do użytku z formularzami Ministerstwa Finansów RP.

---

**Status:** ✅ Gotowe do produkcji na Cloudflare Pages  
**Ostatnia aktualizacja:** 2026-05-27  
**Wersja:** 1.0.0 (Cloudflare Ready)
