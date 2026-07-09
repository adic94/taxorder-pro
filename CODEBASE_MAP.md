# TaxOrder Pro — Mapa kodu
# Szybki przewodnik po architekturze dla AI i deweloperów

## API Endpoints (worker/index.js)

### Publiczne (bez autoryzacji)
| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/auth/login` | Logowanie → token JWT |
| POST | `/api/auth/logout` | Wylogowanie |
| POST | `/api/errors` | Przyjmowanie błędów JS z frontendu |
| GET | `/api/push/vapid-public-key` | Klucz VAPID dla push notifications |
| POST | `/api/push/subscribe` | Subskrypcja push |
| DELETE | `/api/push/subscribe` | Odsubskrypcja push |
| POST | `/api/aztec` | Odczyt kodu Aztec |
| POST | `/api/ai/ocr` | OCR dokumentów (Cloudflare AI) |
| GET | `/api/cepik/token` | Token sesji CEPiK |
| GET | `/api/cepik/pojazdy` | Dane pojazdu z CEPiK |
| GET | `/api/cepik/kierowca` | Dane kierowcy z CEPiK |

### Wymagają zalogowania (Bearer token)
| Metoda | Ścieżka | Opis | Rola |
|--------|---------|------|------|
| GET | `/api/auth/me` | Dane zalogowanego użytkownika | każda |
| PUT | `/api/users/me/password` | Zmiana hasła | każda |
| GET | `/api/dashboard/stats` | Statystyki pulpitu | każda |
| GET | `/api/export?company=X` | Eksport całej floty do JSON | admin/kierownik |
| POST | `/api/import?company=X` | Import floty z JSON | admin/kierownik |
| GET/POST/PUT/DELETE | `/api/vehicles` | CRUD pojazdów | każda |
| POST | `/api/vehicles/bulk` | Upsert wielu pojazdów | każda |
| GET/PUT | `/api/state/:company` | Stan firmy (rok, taxpayer, selected) | każda |
| GET/PUT | `/api/prefs` | Preferencje użytkownika | każda |
| GET/POST/DELETE | `/api/docs` | Dokumenty (R2) | każda |
| GET/POST/PUT/DELETE | `/api/damages` | Szkody | każda |
| GET/POST/PUT/DELETE | `/api/tires` | Opony | każda |
| GET/POST/PUT/DELETE | `/api/service-orders` | Zlecenia serwisowe | każda |
| GET/POST/PUT/DELETE | `/api/protocols` | Protokoły zdawczo-odbiorcze | każda |
| GET/POST/PUT/DELETE | `/api/cfm-clients` | Klienci CFM | każda |
| GET/POST/PUT/DELETE | `/api/cfm-contracts` | Kontrakty CFM | każda |
| GET/POST/PUT/DELETE | `/api/cfm-invoices` | Faktury CFM | każda |
| GET/POST/PUT/DELETE | `/api/drivers` | Kierowcy | każda |
| GET/POST/PUT/DELETE | `/api/fines` | Mandaty | każda |
| GET/POST/PUT/DELETE | `/api/fleet-cards` | Karty flotowe | każda |
| GET/POST/PUT/DELETE | `/api/reservations` | Rezerwacje | każda |
| GET/POST/PUT/DELETE | `/api/dt1-declarations` | Historia deklaracji DT-1 | każda |
| GET/POST/PUT/DELETE | `/api/webhooks` | Webhooki wychodzące | admin/kierownik |
| POST | `/api/webhooks/:id/test` | Test webhooka | admin/kierownik |
| GET/POST/PUT/DELETE | `/api/api-keys` | Klucze API | tylko admin |
| GET/DELETE | `/api/errors` | Logi błędów JS | każda |
| GET/POST/PUT/DELETE | `/api/alert-types` | Typy alertów | każda |
| GET/PUT | `/api/notif-prefs` | Preferencje powiadomień | każda |
| GET/DELETE | `/api/notif-log` | Logi powiadomień | każda |
| GET/POST/PUT/DELETE | `/api/maintenance-templates` | Szablony konserwacji | każda |
| POST | `/api/notif-trigger` | Ręczne wyzwolenie powiadomień | admin |
| POST | `/api/ai/chat` | Chat z AI (Claude) | każda |
| GET/POST | `/api/tekom` | Integracja Tekom GPS | każda |
| POST | `/api/tekom/config` | Konfiguracja Tekom | każda |
| POST | `/api/tekom/test` | Test połączenia Tekom | każda |
| POST | `/api/tekom/sync` | Synchronizacja GPS | każda |
| GET | `/api/tekom/etoll` | Dane eTOLL z Tekom | każda |
| POST | `/api/webhook/gps` | Webhook przychodzący GPS/Tekom | publiczny |
| POST | `/api/webhook/fuel` | Webhook przychodzący paliwo | publiczny |
| GET/POST | `/api/polisy-import` | Import polis ubezpieczenia | każda |
| POST | `/api/polisy-save` | Zapis polis | każda |
| POST | `/api/polisy-parse` | Parsowanie PDF polisy (AI) | każda |
| GET/POST | `/api/dr-import` | Import dowodów rejestracyjnych | każda |
| POST | `/api/dr-save` | Zapis danych z DR | każda |
| GET | `/api/push/generate-keys` | Generuj klucze VAPID | każda |
| POST | `/api/push/send` | Wyślij push notification | każda |
| GET/POST/PUT/DELETE | `/api/users` | Zarządzanie użytkownikami | admin |

### Zadania cykliczne (CRON)
| Schedule | Funkcja | Opis |
|----------|---------|------|
| `0 3 * * *` | `runNightlyAnalysis` | Analiza błędów JS przez Claude + GitHub Issue |
| `0 7 * * *` | `runDailyAlerts` | Alerty o wygasających OC/przeglądach/etc. |
| `0 1 * * *` | `runWeeklyCleanup` | Czyszczenie starych sesji i logów |

---

## Moduły Frontend (modules/*.js)

### Dane i logika biznesowa
| Plik | Eksport | Opis |
|------|---------|------|
| `tax-engine.js` | `window.TaxEngine` | Silnik DT-1: getCat(), getRate(), calcTax() |
| `gminy-rates.js` | `window.GminyRates` | Stawki podatkowe per gmina |
| `dt1-generator.js` | `window.DT1Generator`, `window.calcMiesiacePodatku` | Generator deklaracji DT-1 |
| `dt1-xml.js` | `window.DT1XML` | Eksport DT-1 do XML |
| `dt1-declarations.js` | `window.Dt1Declarations` | Historia złożonych deklaracji |
| `i18n.js` | `window.I18n`, `window.t()` | Tłumaczenia PL/EN/DE/UA/RU/CZ/SK |
| `storage.js` | `window.Storage` | Lokalne przechowywanie danych |

### Cloudflare / Backend
| Plik | Eksport | Opis |
|------|---------|------|
| `cf-cloud.js` | `window.TaxOrderAuth`, `window.TaxOrderFleetCloud`, `window.TaxOrderStateSync`, `window.TaxOrderPrefs`, `window.TaxOrderDocs` | Klient D1 API (główny backend) |
| `fleet-cloud.js` | `window.TaxOrderFleetCloud` | Klient Supabase (alternatywny backend) |
| `error-tracker.js` | `window.TaxOrderErrorTracker` | Śledzenie błędów JS → /api/errors |

### Strony / Widoki
| Plik | Eksport | Strona/Funkcja |
|------|---------|----------------|
| `vehicle-detail.js` | `window.TaxOrderVehicleDetail` | Karta pojazdu (pełny formularz) |
| `alert-dashboard.js` | `window.TaxOrderAlertDashboard` | Dashboard alertów floty |
| `damages.js` | `window.TaxOrderDamages` | Zarządzanie szkodami |
| `drivers.js` | `window.TaxOrderDrivers` | Zarządzanie kierowcami |
| `service.js` | `window.ServiceModule` | Historia serwisowa |
| `service-orders.js` | `window.TaxOrderServiceOrders` | Zlecenia serwisowe |
| `tires-warehouse.js` | `window.TaxOrderTires` | Magazyn opon |
| `documents.js` | `window.DocumentsModule` | Dokumenty pojazdu |
| `fleet-map.js` | `window.FleetMap` | Mapa GPS floty (Leaflet) |
| `fleet-calendar.js` | `window.FleetCalendar` | Kalendarz floty |
| `handover-protocol.js` | `window.TaxOrderHandoverProtocol` | Protokoły zdawczo-odbiorcze |
| `fines.js` | `window.FinesModule` | Mandaty |
| `reports.js` | `window.FleetReports` | Raporty TCO, eksport |
| `diagnostics.js` | `window.TaxOrderDiagnostics` | Diagnostyka systemu |
| `dashboard-nav.js` | `window.TaxOrderDashNav` | Nawigacja pulpitu |

### CFM (Zarządzanie flotą klientów)
| Plik | Eksport | Opis |
|------|---------|------|
| `cfm-clients.js` | `window.TaxOrderCfmClients` | Klienci zewnętrzni CFM |
| `cfm-contracts.js` | `window.TaxOrderCfmContracts` | Kontrakty CFM |
| `cfm-invoices.js` | `window.TaxOrderCfmInvoices` | Faktury CFM |

### Integracje zewnętrzne
| Plik | Eksport | Opis |
|------|---------|------|
| `tekom-sync.js` | `window.TekomSync` | Synchronizacja GPS Tekom |
| `tekom-import.js` | `window.TekomImport` | Import danych Tekom |
| `etoll-import.js` | `window.ETollImport` | Import CSV z eTOLL |
| `cepik-xml.js` | `window.CepikXML` | Parsowanie danych CEPiK |
| `policy-ocr.js` | `window.TaxOrderPolicyOcr` | OCR polis ubezpieczenia |
| `aztec-scanner.js` | `window.AztecScanner` | Skaner kodów Aztec (DR) |
| `dr-import.js` | `window.TaxOrderDrImport` | Import dowodów rejestracyjnych |

### Import/Eksport
| Plik | Eksport | Opis |
|------|---------|------|
| `import-export.js` | `window.TaxOrderImportExport` | Eksport/import danych floty |
| `csv-import.js` | `window.CSVImport` | Import CSV pojazdów |
| `vehicle-import.js` | `window.VehicleImport` | Import pojazdów (różne formaty) |
| `fuel-import.js` | `window.FuelImport` | Import danych paliwa |
| `zsia-importer.js` | `window.ZsiaImporter` | Import ZSIA |

### Administracja
| Plik | Eksport | Opis |
|------|---------|------|
| `api-keys.js` | `window.TaxOrderApiKeys` | Zarządzanie kluczami API |
| `webhooks-ui.js` | `window.WebhooksUI` | UI webhooków wychodzących |
| `notifications.js` | `window.TaxOrderNotifications` | System powiadomień push |
| `notification-settings.js` | `window.TaxOrderNotifSettings` | Ustawienia powiadomień |
| `backup.js` | `window.FleetBackup` | Backup lokalny |
| `cloud-backup.js` | `window.CloudBackup` | Backup do chmury |
| `rate-reader.js` | `window.TaxOrderRateReader` | Odczyt stawek z pliku |
| `companies-readonly.js` | `window.TaxOrderCompaniesReadOnly` | Lista firm (tylko odczyt) |
| `company-access.js` | — | Dostęp firm dla użytkowników |
| `company-create.js` | — | Tworzenie nowych firm |

---

## Baza danych D1 — Tabele i relacje

```
vehicles          → główna tabela pojazdów (dane w kolumnie JSON `data`)
├── damage_reports    (nr_rej FK)
│   └── damage_photos (damage_id FK)
├── tires             (nr_rej FK)
├── service_orders    (nr_rej FK)
├── handover_protocols (nr_rej FK)
│   └── protocol_photos
├── documents         (nr_rej FK)
├── fleet_cards       (nr_rej FK)
├── reservations      (nr_rej FK)
└── fines             (nr_rej FK)

users
├── sessions          (user_id FK)
├── api_keys          (created_by FK)
├── notification_prefs (user_id FK)
├── user_prefs        (user_id FK)
└── push_subscriptions (user_id FK)

cfm_clients
├── cfm_contracts     (client_ref FK)
└── cfm_invoices      (client_ref FK)

dt1_declarations  (company_id)
webhooks          (company_id)
error_logs        (user_id FK)
notification_log  (user_id FK)
alert_types       (company_id)
maintenance_templates (company_id)
company_states    (company_id)
drivers           (company_id)
```

---

## Jak dodać nową stronę/moduł

1. Utwórz `modules/nazwa.js` z wzorcem:
   ```javascript
   window.NazwaModulu = (function () {
     async function load() { /* fetch + render */ }
     function render() { /* innerHTML z esc() */ }
     return { load, render };
   })();
   ```
2. Dodaj `<script src="modules/nazwa.js"></script>` do `index.html`
3. Dodaj `<div class="page" id="page-nazwa">` do `index.html`
4. Podepnij w `showPage()` w `app.js`
5. Dodaj klucz i18n w `modules/i18n.js` (7 języków)
6. Bump `CACHE_NAME` w `sw.js`

## Jak dodać nowy endpoint API

1. Utwórz funkcję `async function handleNazwa(req, env, user, url, path)` w `worker/index.js`
2. Zarejestruj w `handleRequest()`:
   ```javascript
   if (path.startsWith('/api/nazwa')) {
     if (!user) return err('Nieautoryzowany', 401);
     return handleNazwa(request, env, user, url, path);
   }
   ```
3. Jeśli potrzeba nowej tabeli → nowy plik `worker/schema_vN.sql`
4. `.\deploy.ps1 -Schema vN`
