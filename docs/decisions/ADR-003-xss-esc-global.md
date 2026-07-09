---
id: ADR-003
title: Globalna funkcja esc() jako jedyna metoda escapowania XSS
date: 2024-06-01
status: zaakceptowane
---

## Kontekst

Przy używaniu `innerHTML` z danymi z bazy danych istnieje ryzyko XSS. Potrzebna była prosta, nieomylna metoda ochrony.

## Decyzja

Globalna funkcja `esc()` zdefiniowana w `index.html`:
```javascript
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
```

**Reguła bezwzględna**: każde `${pole}` w `innerHTML` musi być owiniete w `esc()`.

Wyjątki tylko dla:
- Liczb obliczanych przez nasz kod (`r.amount.toFixed(2)`, `Number(x)`)
- Stałych stringów z kodu (`"—"`, klasy CSS, ikony `ti ti-*`)
- HTML generowanego przez nasz kod z już-escapowanych danych (`rowH()` w `printCard()`)

## Konsekwencje

- Audyt automatyczny: `tools/autotest/xss-audit.js` + pre-commit hook
- Testy Playwright: `tests/e2e/xss.spec.js`
- `rowH()` w `printCard()` to escape hatch — używać tylko gdy wewnątrz i tak jest `esc()`
