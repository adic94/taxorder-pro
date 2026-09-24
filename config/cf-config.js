/**
 * TaxOrder Pro — Cloudflare Worker URL
 *
 * Po deploymencie: wrangler deploy
 * Zastąp poniższy URL adresem wygenerowanym przez Cloudflare, np.:
 *   https://taxorder-pro.twoja-subdomena.workers.dev
 *
 * Lokalny development (wrangler dev):
 *   window.CF_API_URL = 'http://localhost:8787';
 */
// Kontrolowany harness UAT może ustawić wartość przed załadowaniem strony przez
// addInitScript. Brak override zachowuje dokładnie dotychczasową produkcję.
window.CF_API_URL    = window.__TAXORDER_API_URL__ || 'https://taxorder-pro-api.adamus1000.workers.dev';
window.CF_WORKER_URL = window.CF_API_URL;   // alias dla starszych modułów
