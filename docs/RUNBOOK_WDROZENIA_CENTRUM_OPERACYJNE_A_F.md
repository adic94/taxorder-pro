# Runbook wdrożenia centrum operacyjnego A–F

## 1. Warunki wejścia

1. Zaplanowane okno serwisowe i osoba odpowiedzialna za decyzję rollback.
2. Osobny tenant/UAT oraz konto `admin` i `kierowca`.
3. Aktualny eksport D1 zapisany poza repozytorium.
4. Zielone `npm run audit:all` oraz `npm run release:preflight`.
5. Potwierdzone Cloudflare credentials. Nie wpisywać sekretów do plików ani D1.

## 2. Backup

Z katalogu projektu utworzyć katalog poza repo i wykonać:

```powershell
npx wrangler d1 export taxorder-pro --remote --output "C:\bezpieczny-katalog\taxorder-pro-przed-v54-v57.sql"
```

Sprawdzić, że plik istnieje i ma niezerowy rozmiar. Nie kontynuować bez backupu.

## 3. Migracje — dokładnie w tej kolejności

Każdą migrację wykonać osobno. Po każdej uruchomić preflight; oczekiwane jest, że raport nadal wskaże tabele kolejnych wersji jako brakujące.

```powershell
npx wrangler d1 execute taxorder-pro --remote --file worker/migration_v54_operations_axis.sql
npx wrangler d1 execute taxorder-pro --remote --file worker/migration_v55_operations_pod_settlement.sql
npx wrangler d1 execute taxorder-pro --remote --file worker/migration_v56_integration_platform.sql
npx wrangler d1 execute taxorder-pro --remote --file worker/migration_v57_cost_automation.sql
npm run release:preflight:remote
```

Preflight końcowy musi być zielony. Nie uruchamiać rollbacku v54 po zapisaniu nowych operacji bez analizy zależności.

## 4. UAT przed publikacją

Uruchomić przeciw środowisku testowemu:

```powershell
$env:TEST_URL="https://adres-uat"
$env:TEST_TOKEN="token-konta-testowego"
npm run test:e2e:operations
```

Ręcznie potwierdzić:

- import zlecenia: dry-run → commit → jedna operacja;
- konflikt zasobu blokuje commit planu;
- kierowca widzi wyłącznie własne zadanie;
- brak POD blokuje zakończenie/rozliczenie;
- akceptacja rozliczenia tworzy jeden szkic faktury;
- ponowienie importu nie tworzy duplikatu;
- reguły automatyzacji pozostają `dry_run`;
- przygotowanie dokumentu ERP nie wysyła go na zewnątrz.

## 5. Publikacja

Workflow `deploy-worker.yml` sam uruchamia audyt i zdalny preflight. Dopiero potem publikuje Worker. Publikację Pages wykonać zgodnie z dotychczasowym procesem projektu. Po publikacji uruchomić smoke test uwierzytelniony.

## 6. Stopniowa aktywacja

1. Pozostawić wszystkie automatyzacje w `dry_run` przez co najmniej jeden pełny cykl danych.
2. Przejrzeć explainable log i fałszywe alarmy paliwo/GPS.
3. Najpierw aktywować alert paliwowy, potem bramkę serwisową.
4. Harmonogramy leasingowe zatwierdzać per umowa.
5. ERPNext przetestować w sandboxie.
6. enova365/Comarch aktywować dopiero po zatwierdzonym mapowaniu i uzgodnieniu zwrotnym.

## 7. Kryteria rollbacku

Rollback rozważyć przy: błędach tenant isolation, duplikacji dokumentów, niemożności odtworzenia statusu operacji lub trwałych błędach 5xx. Najpierw zatrzymać reguły i adaptery. Przywrócenie backupu D1 jest decyzją awaryjną, ponieważ usuwa dane zapisane po backupie.

Rollbacki SQL są przeznaczone do pustego/nieużywanego wdrożenia i wykonuje się je odwrotnie: v57 → v56 → v55 → v54. Przed każdym rollbackiem wykonać nowy eksport D1.
