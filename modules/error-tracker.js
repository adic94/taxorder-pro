/**
 * TaxOrder Pro — Frontend Error Tracker
 * Przechwytuje niezłapane błędy JS i unhandled promise rejections,
 * sanitizuje (usuwa tokeny/hasła) i wysyła do POST /api/errors.
 * Rate limit: max 5 błędów na 60 sekund per sesja.
 */
window.TaxOrderErrorTracker = (() => {
  const ENDPOINT  = '/api/errors';
  const RATE_MAX  = 5;
  const RATE_WIN  = 60_000;    // ms
  const DEDUP_TTL = 30_000;    // ignoruj ten sam błąd przez 30s

  let _sent    = 0;
  let _winStart = Date.now();
  const _recent = new Map();   // key -> timestamp (dedup)

  // Wzorce które nie interesują: sieć, CSP, rozszerzenia przeglądarki
  const IGNORE_RE = [
    /net::ERR_/i,
    /ResizeObserver loop/i,
    /Non-Error promise rejection/i,
    /extension:\/\//i,
    /chrome-extension:\/\//i,
    /Script error\.?$/i,   // cross-origin — brak info, nic nie zrobimy
  ];

  // Usuwa tokeny, hasła i GUID-y z tekstów błędów
  function sanitize(s) {
    if (!s || typeof s !== 'string') return s;
    return s
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/password[=:]["']?[^"',\s}]+/gi, 'password=[REDACTED]')
      .replace(/[a-f0-9]{40,}/gi, '[HASH]')           // długie hasze
      .replace(/[a-z0-9]{20,}/gi, match =>            // base64 tokeny (krótkie: zachowaj)
        match.length > 40 ? '[TOKEN]' : match)
      .substring(0, 500);
  }

  function shouldIgnore(msg) {
    if (!msg) return true;
    return IGNORE_RE.some(re => re.test(msg));
  }

  function rateOk() {
    const now = Date.now();
    if (now - _winStart > RATE_WIN) { _sent = 0; _winStart = now; }
    return _sent < RATE_MAX;
  }

  function dedupKey(msg, url) { return `${msg}|${url}`; }

  function send(payload) {
    if (shouldIgnore(payload.error_msg)) return;
    const key = dedupKey(payload.error_msg, payload.url);
    const now  = Date.now();
    if (_recent.has(key) && now - _recent.get(key) < DEDUP_TTL) return;
    if (!rateOk()) return;

    _sent++;
    _recent.set(key, now);

    // Dorzuć kontekst użytkownika jeśli jest w localStorage
    try {
      const tok = localStorage.getItem('cf_token');
      if (tok) payload.has_session = true;
      const cid = localStorage.getItem('cf_company');
      if (cid) payload.company_id = cid;
    } catch { /* localStorage może być niedostępny */ }

    payload.app_version = (window.APP_VERSION || document.documentElement.dataset.ver || '').substring(0, 30);

    fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      keepalive: true,   // wysyłaj nawet przy beforeunload
    }).catch(() => { /* błąd reportowania — ignoruj cicho */ });
  }

  window.addEventListener('error', ev => {
    send({
      error_msg:   sanitize(ev.message),
      error_stack: sanitize(ev.error?.stack),
      error_type:  'uncaught',
      url:         (ev.filename || location.href).substring(0, 200),
      user_agent:  navigator.userAgent.substring(0, 200),
      line:        ev.lineno,
      col:         ev.colno,
    });
  });

  window.addEventListener('unhandledrejection', ev => {
    const reason = ev.reason;
    const msg  = reason?.message || String(reason);
    const stk  = reason?.stack;
    send({
      error_msg:   sanitize(msg),
      error_stack: sanitize(stk),
      error_type:  'promise',
      url:         location.href.substring(0, 200),
      user_agent:  navigator.userAgent.substring(0, 200),
    });
  });

  // Publiczne API do ręcznego raportowania błędów
  return {
    report(message, detail = {}) {
      send({
        error_msg:   sanitize(String(message)),
        error_stack: sanitize(detail.stack),
        error_type:  'manual',
        url:         (detail.url || location.href).substring(0, 200),
        user_agent:  navigator.userAgent.substring(0, 200),
      });
    },
  };
})();
