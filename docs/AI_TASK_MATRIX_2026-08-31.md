# TaxOrder Pro — macierz pracy narzędzi AI

Stan: 2026-08-31. Źródłem prawdy dla kolejki, blokad i przekazań jest MCP `cooperation`.

## Zasady wspólne

1. Na początku: `cooperation_bootstrap`, `cooperation_session_start`, `cooperation_context`.
2. Audyty zaczynają się w trybie tylko do odczytu. Kod zmienia się dopiero po zatwierdzeniu znaleziska.
3. Przed zapisem obowiązuje `file_lock_acquire`; po pracy `activity_add`, `artifact_register` i zakończenie sesji.
4. Zakazane są migracje i wdrożenia produkcyjne. Testy zdalne kierujemy wyłącznie do UAT.
5. Każde znalezisko musi zawierać dowód `plik:linia`, priorytet P0–P3 i minimalny test reprodukcji.

## Podział bez nakładania się plików

| Narzędzie | Zadanie | Tryb / wynik | ID |
|---|---|---|---|
| Claude Code | Eksport wszystkich pól DR do jednego XLSX i bezpieczna skrzynka dokumentów/OCR | Implementacja + testy; bez plików UAT | `37d5aa93-1935-43dc-809f-0ab5aa1e0c69` |
| Gemini Code Assist | Audyt schema → API → tenant/role/license → UI/nawigacja | Tylko raport `docs/audits/GEMINI_CROSS_LAYER_AUDIT.md` | `467a368a-4ad3-451d-87eb-4389514206fb` |
| Continue / CodeGPT | Bezpieczeństwo importu/eksportu i izolacji danych | Tylko raport `docs/audits/CODEGPT_SECURITY_FORMAT_AUDIT.md` | `2665f480-2a79-43a7-b9b0-b1b3656374b7` |
| Codex Desktop | Izolowane UAT A–F, testy domeny API i bramki wydania | `tools/uat`, Playwright, preflight; bez produkcji | `131792f6-d12e-4573-b61f-2d1bdf4e26eb` |

## Uruchomienie w VS Code

W czacie wybranego narzędzia wystarczy polecenie:

> Odczytaj `cooperation_context` dla projektu `taxorder-pro`, przejmij otwarty handoff skierowany do Twojego narzędzia i wykonaj przypisane zadanie zgodnie z macierzą `docs/AI_TASK_MATRIX_2026-08-31.md`. Najpierw pracuj tylko odczytowo; nie dotykaj produkcji.

GitHub Copilot nie został przydzielony, ponieważ na tej maszynie nie jest zainstalowany. Zainstalowane są Claude Code, Gemini Code Assist, Continue, CodeGPT, Codex, ESLint i Playwright.

## Aktualny stan bramek

- `npm run audit:all`: 36/36 bramek, 360 PASS, 0 FAIL.
- UAT centrum operacyjnego: 3/3 scenariusze Playwright.
- Test regresyjny konfiguracji API: 16 PASS, 0 FAIL.
- Produkcja nie została zmieniona.
