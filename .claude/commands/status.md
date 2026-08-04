---
description: Generuje zwięzłe podsumowanie stanu projektu do wklejenia w claude.ai
argument-hint: [opcjonalnie: temat, np. "cfm" lub "dt1"]
allowed-tools: Bash(git log*), Bash(git status*), Bash(git diff*), Bash(git stash list*), Read, Glob, Grep
---

Wygeneruj gotowe do wklejenia w claude.ai podsumowanie stanu projektu TaxOrder Pro.
Skupiaj się na tym, co claude.ai musi WIEDZIEĆ — nie na tym, co można wyczytać z kodu.
$ARGUMENTS

## Procedura — wykonaj po kolei

**1. Git**
```
git log --oneline -8
git status --short
git stash list
```

**2. Handoff z CLAUDE.md**
Przeczytaj sekcję `## HANDOFF — STAN PROJEKTU` z `CLAUDE.md`.
Wypisz W TOKU i OTWARTE tematy.

**3. Memory**
Przeczytaj `C:\Users\acichocki\.claude\projects\c--Users-acichocki-Desktop-Program-flotowy-taxorder-pro\memory\MEMORY.md`.
Wymień pliki memory istotne dla bieżącego kontekstu.

**4. Jeśli podano $ARGUMENTS — głębsze info**
Grep po modułach/testach związanych z tematem. Max 3 pliki, max 20 linii każdy.

---

## Format wyjścia

Wygeneruj JEDEN blok Markdown gotowy do kopiowania.
Nagłówek z datą, max ~60 linii łącznie. Nic ponad to.

```
# TaxOrder Pro — handoff [RRRR-MM-DD]

## Stack
CF Pages SPA + Worker (D1 SQLite, R2, KV) | schema v44 | Node portable C:\Users\acichocki\node\

## Ostatnie commity
[8 linii git log --oneline]

## Stan roboczy
[git status --short — jeśli czyste: "drzewo czyste"]

## W toku
[z HANDOFF sekcji CLAUDE.md]

## Otwarte długi
[z HANDOFF sekcji CLAUDE.md]

## Kluczowe pliki
app.js ~9700 ln | worker/index.js ~11500 ln | modules/vehicle-detail.js ~3700 ln

## Bezpieczeństwo — niezmienne zasady
- innerHTML: zawsze esc() na danych z DB
- onclick z danymi: data-* + dataset.*
- numeryczne fallback: ?? nie ||
- izolacja tenanta: każde zapytanie z company_id=?

## Kill switches (konsola przeglądarki)
localStorage.setItem('taxorder_companies_source','local')   // fallback firmy lokalne
localStorage.setItem('taxorder_prefs_kv_source','local')    // fallback prefs lokalne

## Kontekst sesji (jeśli dotyczy $ARGUMENTS)
[wyniki z kroku 4, jeśli podano argument]
```

Po wygenerowaniu bloku napisz jedną linię: co claude.ai może zrobić z tym podsumowaniem
(np. "Wklej to na początku rozmowy z claude.ai — dostanie pełny kontekst bez czytania repo.").
