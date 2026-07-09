## Co zmieniono

<!-- Krótki opis zmian: co dodano / naprawiono / usunięto -->

## Dlaczego

<!-- Motywacja / ticket / zgłoszenie -->

## Checklist przed merge

### Bezpieczeństwo
- [ ] `npm run xss-audit` — brak podatności XSS (`esc()` na wszystkich polach użytkownika)
- [ ] Brak sekretów / tokenów w kodzie (`wrangler secret put` dla kluczy API)
- [ ] Nowe webhooki: URL walidowany na `https://`
- [ ] Nowe `onclick` z danymi użytkownika: używają `data-*` + `dataset.*`

### Frontend
- [ ] `npm run syntax-check` — brak błędów składniowych JS
- [ ] `npm run i18n-check` — tłumaczenia kompletne we wszystkich 7 językach (pl/en/de/uk/lv/lt/et)
- [ ] Nowe `<script>` w `index.html`: uruchomiono `npm run sw-fix` (bump `CACHE_NAME`)
- [ ] Nowe pola numeryczne: używają `??` zamiast `||` (falsy-zero)

### Backend / DB
- [ ] Nowe tabele: plik `worker/schema_vN.sql` z `CREATE TABLE IF NOT EXISTS`
- [ ] Migracja zaaplikowana: `.\deploy.ps1 -Schema vN`
- [ ] Worker nie crashuje: `npm run smoke` po deploymen

### Testy
- [ ] `npm run test:api` przechodzi (lub nie dotyczy tej zmiany)
- [ ] Kluczowe ścieżki przetestowane ręcznie w przeglądarce

### Dokumentacja
- [ ] Nowe endpointy dodane do `CODEBASE_MAP.md`
- [ ] Nowe decyzje architektoniczne — plik `docs/decisions/ADR-NNN-*.md`

---
<!-- Usuń sekcje które nie dotyczą tej zmiany -->
