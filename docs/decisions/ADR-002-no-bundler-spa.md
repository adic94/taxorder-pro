---
id: ADR-002
title: SPA bez bundlera (vanilla JS, natywne moduły przez window.*)
date: 2024-01-01
status: zaakceptowane
---

## Kontekst

Potrzebowaliśmy prostego, łatwego w debugowaniu frontendu bez nadmiernej złożoności build pipeline.

## Decyzja

Brak Webpack/Vite/Rollup. Każdy moduł to osobny `<script>` w `index.html` eksportujący obiekt na `window.*`.

Pattern modułu:
```javascript
window.NazwaModulu = (function () {
  async function load() { /* ... */ }
  return { load };
})();
```

## Konsekwencje

- Każdy nowy `<script>` wymaga bump `CACHE_NAME` w `sw.js` (Service Worker cache)
- Brak tree-shaking — wszystkie moduły ładowane zawsze (akceptowalne dla tej skali)
- Łatwe debugowanie w DevTools bez source map
- `esc()` musi być zdefiniowana globalnie w `index.html` przed pierwszym użyciem
