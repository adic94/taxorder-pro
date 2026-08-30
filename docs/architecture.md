# TaxOrder Fleet Manager Enterprise

## Architektura systemu

### Frontend

- HTML5
- CSS3
- JavaScript ES2023
- Cloudflare Pages (statyczny frontend SPA)

### Backend

- Cloudflare Worker (`worker/index.js`)
- Cloudflare Queues (powiadomienia)
- Cloudflare R2 (dokumenty)
- Cloudflare KV (preferencje, cache i limity)

### Baza danych

- Cloudflare D1 (SQLite)
- Migracje: `worker/schema_vN.sql`

### Moduły

1. Dashboard
2. Pojazdy
3. Kierowcy
4. Dokumenty
5. Koszty
6. Leasing
7. Polisy i szkody
8. Rezerwacje
9. Podatki DT-1
10. Raporty
11. Integracje
12. Administracja

### Integracje

- Symfonia
- enova365
- SaldeoSMART
- SAP
- e-TOLL
- GPS
- OCR

### Role użytkowników

- Administrator
- Fleet Manager
- Księgowość
- Administracja
- Zarząd