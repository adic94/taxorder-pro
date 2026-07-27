---
description: Nowy moduł zgodny z konwencjami projektu – rejestr, i18n, cache, izolacja
argument-hint: <nazwa i krótki opis, np. "opony-sezonowe wymiana opon wg sezonu">
allowed-tools: Bash(npm run *), Bash(node *), Bash(grep *), Read, Glob, Grep, Edit, Write
---

Dodaj moduł: $ARGUMENTS

**Najpierw przedstaw plan i poczekaj na akceptację.** Dopiero potem koduj.

## Lista kontrolna – nic z tego nie jest opcjonalne

**1. Rejestr modułów** – dopisz do `ALL_MODULES` w `modules/access-control.js`:
`{ id, label, cat, pkg, icon }`. Pakiet `basic`/`pro`/`enterprise` uzgodnij ze mną,
bo decyduje o cenie. Ten sam identyfikator dopisz do `_packageModules()` w `worker/index.js`,
jeśli ma być w `basic` lub `pro`.

**2. Licencja** – dopisz prefiks endpointu do `MODULE_ROUTES` w `worker/index.js`.
Mapa jest sortowana po długości prefiksu: dłuższy wygrywa, żeby `/api/fuel-cards`
nie złapało się na `/api/fuel`. Bez tego wpisu moduł jest darmowy dla wszystkich.

**3. Izolacja tenanta** – każde zapytanie z `company_id=?`. Operacje po `id`:
`WHERE id=? AND company_id=?` plus `r.meta.changes === 0` → `404`.

**4. Schemat** – nowy plik `worker/schema_vN.sql` (N = kolejny wolny numer,
sprawdź `ls worker/schema_v*.sql`). Nigdy nie dopisuj do istniejącego pliku.
Do tego `worker/schema_vN_ROLLBACK.sql`. Sprawdź, czy nazwa tabeli nie istnieje
już w innym pliku schematu – mamy 20 zdublowanych.

**5. i18n** – wszystkie klucze w **7 językach**: `pl`, `en`, `de`, `uk`, `lv`,
`lt`, `et`. Języki bałtyckie wynikają z operacji na rynkach LV/LT/EE.
Weryfikacja: `npm run i18n-check`.

**6. Service Worker** – nowy `<script>` w `index.html` musi trafić do
`STATIC_ASSETS` w `sw.js`. Użyj `node tools/autotest/sw-cache-bump.js`,
nie edytuj ręcznie. To podbije też `CACHE_NAME`.

**7. XSS** – dane z API przez `esc()` przed wstawieniem do `innerHTML`.

**8. Nawigacja** – mamy 122 pozycje i to już za dużo. Zanim dodasz kolejną,
sprawdź, czy istniejąca się nie nadaje. Jeśli musisz dodać – powiedz mi,
którą grupę wybrałeś i dlaczego.

## Na koniec

`npm run audit:all` musi przejść. Pokaż mi diff przed commitem.
