/*
 * ENDPOINT_NEEDED: POST /api/predictive-ai
 * Handler (in worker/index.js):
 *   Receives: { company_id: string }
 *   Returns:  { recommendations: Array<{
 *                vehicle_reg: string,
 *                status: 'overdue'|'soon'|'ok',
 *                days_until: number|null,       // negative = overdue
 *                km_until: number|null,
 *                ai_recommendation: string,
 *                confidence: 'high'|'medium'|'low',
 *                alerts: Array<{ type: string, label: string, status: string }>
 *              }> }
 *
 *   Algorithm:
 *   1. Validate session.
 *   2. Query D1: last 6 months of service_orders + predictive_maintenance_alerts
 *      joined with vehicles (avg daily km = (current_km - min_km_6mo) / 180).
 *   3. Build a per-vehicle history summary string.
 *   4. Call Claude claude-haiku-4-5-20251001 with the summary:
 *        "For each vehicle below, predict next required maintenance, urgency,
 *         and write a 1-sentence recommendation in Polish. Respond as JSON array."
 *   5. Merge Claude output with D1 alert data.
 *   6. Return { recommendations }.
 *
 * This module EXTENDS window.PredictiveMaintenance (modules/predictive-maintenance.js).
 * It does NOT duplicate existing functionality — it adds the AI recommendations panel.
 */

window.PredictiveMaintenanceAI = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                             */
  /* ------------------------------------------------------------------ */
  const _api  = () => window._cfApi?.()  || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const _hdrs = (extra) => window._cfHdrs ? window._cfHdrs(extra) : { 'Content-Type': 'application/json', ...extra };
  const _co   = () => window._cfCo?.()   || window.currentCompanyId || '';

  /* ------------------------------------------------------------------ */
  /*  Module state                                                        */
  /* ------------------------------------------------------------------ */
  let _recs        = [];      // last fetched recommendations
  let _generating  = false;

  /* ------------------------------------------------------------------ */
  /*  CSS injection (runs once)                                           */
  /* ------------------------------------------------------------------ */
  (function _injectStyles() {
    if (document.getElementById('pm-ai-styles')) return;
    const s = document.createElement('style');
    s.id = 'pm-ai-styles';
    s.textContent = `
      /* ---- AI panel wrapper ---- */
      .pm-ai-wrap {
        max-width: 900px;
        margin: 0 auto;
      }
      .pm-ai-wrap h2 {
        margin-bottom: 4px;
      }
      .pm-ai-subtitle {
        color: var(--text-muted, #6b7280);
        font-size: 0.88rem;
        margin-bottom: 20px;
      }

      /* ---- Section headers ---- */
      .pm-ai-section-title {
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .05em;
        color: var(--text-muted, #6b7280);
        margin: 20px 0 8px 0;
      }

      /* ---- Vehicle card ---- */
      .pm-ai-cards {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 20px;
      }
      .pm-ai-card {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 14px 16px;
        border-radius: 10px;
        border: 1px solid var(--border-color, #e5e7eb);
        background: var(--card-bg, #fff);
        transition: box-shadow 0.15s;
      }
      .pm-ai-card:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,.07);
      }
      .pm-ai-card.overdue {
        border-left: 4px solid #ef4444;
        background: rgba(239,68,68,.03);
      }
      .pm-ai-card.soon {
        border-left: 4px solid #f59e0b;
        background: rgba(245,158,11,.03);
      }
      .pm-ai-card.ok {
        border-left: 4px solid #22c55e;
        background: rgba(34,197,94,.03);
      }
      .pm-ai-status-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 4px;
      }
      .pm-ai-status-dot.overdue { background: #ef4444; }
      .pm-ai-status-dot.soon    { background: #f59e0b; }
      .pm-ai-status-dot.ok      { background: #22c55e; }
      .pm-ai-card-body {
        flex: 1;
        min-width: 0;
      }
      .pm-ai-card-top {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 4px;
      }
      .pm-ai-reg {
        font-weight: 700;
        font-size: 1rem;
        color: var(--text-color, #111827);
      }
      .pm-ai-label {
        font-size: 0.82rem;
        color: var(--text-muted, #6b7280);
      }
      .pm-ai-label.overdue { color: #ef4444; font-weight: 600; }
      .pm-ai-label.soon    { color: #f59e0b; font-weight: 600; }
      .pm-ai-recommendation {
        font-size: 0.88rem;
        color: var(--text-color, #374151);
        margin-top: 4px;
        font-style: italic;
      }
      .pm-ai-alerts {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }
      .pm-ai-alert-pill {
        font-size: 0.72rem;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid currentColor;
      }
      .pm-ai-alert-pill.overdue { color: #ef4444; }
      .pm-ai-alert-pill.soon    { color: #f59e0b; }
      .pm-ai-alert-pill.ok      { color: #22c55e; }
      .pm-ai-confidence {
        font-size: 0.72rem;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--badge-bg, #f3f4f6);
        color: var(--text-muted, #6b7280);
        margin-left: auto;
        flex-shrink: 0;
        align-self: flex-start;
      }

      /* ---- Bottom bar ---- */
      .pm-ai-actions {
        display: flex;
        gap: 10px;
        margin-top: 16px;
        flex-wrap: wrap;
        align-items: center;
      }
      .pm-ai-last-update {
        font-size: 0.75rem;
        color: var(--text-muted, #6b7280);
        margin-left: auto;
      }

      /* ---- Empty / loading states ---- */
      .pm-ai-empty {
        text-align: center;
        color: var(--text-muted, #6b7280);
        padding: 40px 0;
        font-size: 0.9rem;
      }
      .pm-ai-ok-summary {
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid var(--border-color, #e5e7eb);
        background: var(--card-bg, #f9fafb);
        font-size: 0.88rem;
        color: var(--text-muted, #6b7280);
      }
    `;
    document.head.appendChild(s);
  })();

  /* ------------------------------------------------------------------ */
  /*  Render entry point                                                  */
  /* ------------------------------------------------------------------ */
  function renderPage() {
    const page = document.getElementById('page-predictive-maintenance-ai');
    if (!page) return;
    page.innerHTML = `
      <div class="pm-ai-wrap">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px">
          <h2><i class="ti ti-robot"></i> Predykcyjny Serwis AI</h2>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline" onclick="PredictiveMaintenanceAI.refresh()">
              <i class="ti ti-refresh"></i> Odśwież
            </button>
            <button class="btn btn-primary" id="pm-ai-gen-btn" onclick="PredictiveMaintenanceAI.generateReport()">
              <i class="ti ti-brain"></i> Generuj raport AI
            </button>
          </div>
        </div>
        <p class="pm-ai-subtitle">
          AI analizuje historię serwisową i przebieg dzienny każdego pojazdu,
          aby przewidzieć kolejne wymagane czynności serwisowe.
        </p>
        <div id="pm-ai-content"><div class="pm-ai-empty"><i class="ti ti-loader"></i> Ładowanie...</div></div>
        <div class="pm-ai-actions">
          <button class="btn btn-outline" onclick="PredictiveMaintenanceAI.openBaseModule()">
            <i class="ti ti-list"></i> Wszystkie alerty (tabela)
          </button>
          <span class="pm-ai-last-update" id="pm-ai-ts"></span>
        </div>
      </div>`;
    _fetchAndRender();
  }

  /* ------------------------------------------------------------------ */
  /*  Data fetching                                                       */
  /* ------------------------------------------------------------------ */
  async function _fetchAndRender() {
    const content = document.getElementById('pm-ai-content');
    if (!content) return;
    try {
      // Re-use the existing predictive-maintenance endpoint to get current alerts
      const resp = await fetch(
        `${_api()}/api/predictive-maintenance?company=${encodeURIComponent(_co())}`,
        { headers: _hdrs() }
      );
      const data  = await resp.json();
      const alerts = data.alerts || [];
      // If we have cached AI recs, merge; otherwise show plain alert view
      _renderAlerts(alerts, _recs);
    } catch {
      if (content) content.innerHTML = '<p class="pm-ai-empty">Błąd pobierania danych serwisowych.</p>';
    }
  }

  function _renderAlerts(alerts, aiRecs) {
    const content = document.getElementById('pm-ai-content');
    if (!content) return;

    if (!alerts.length) {
      content.innerHTML = '<p class="pm-ai-empty">Brak zdefiniowanych alertów serwisowych. Dodaj je w module Serwis Predykcyjny.</p>';
      return;
    }

    // Group by status
    const overdue = alerts.filter(a => a.status === 'overdue');
    const soon    = alerts.filter(a => a.status === 'soon');
    const ok      = alerts.filter(a => a.status === 'ok');

    const urgentAlerts = [...overdue, ...soon];

    // Build a lookup for AI recs keyed by vehicle_reg
    const recByReg = {};
    for (const r of aiRecs) {
      recByReg[r.vehicle_reg] = r;
    }

    let html = '';

    // --- Urgent section ---
    if (urgentAlerts.length) {
      html += `<div class="pm-ai-section-title">⚠️ Wymagają uwagi (${urgentAlerts.length} ${_inflect(urgentAlerts.length, 'pojazd', 'pojazdy', 'pojazdów')})</div>`;
      html += '<div class="pm-ai-cards">';
      html += urgentAlerts.map(a => _cardHtml(a, recByReg[a.vehicle_reg] ?? null)).join('');
      html += '</div>';
    }

    // --- OK section (collapsed summary) ---
    if (ok.length) {
      html += `<div class="pm-ai-section-title">✅ Pojazdy OK (${ok.length} ${_inflect(ok.length, 'pojazd', 'pojazdy', 'pojazdów')})</div>`;
      html += `<div class="pm-ai-ok-summary">
        ${ok.map(a => `<span style="margin-right:12px"><strong>${esc(a.vehicle_reg)}</strong> — ${esc(_serviceLabel(a))}</span>`).join('')}
      </div>`;
    }

    content.innerHTML = html || '<p class="pm-ai-empty">Brak danych do wyświetlenia.</p>';
  }

  function _cardHtml(a, rec) {
    const status    = a.status === 'overdue' ? 'overdue' : 'soon';
    const labelText = _serviceLabel(a);
    const aiText    = rec?.ai_recommendation ?? null;
    const confidence = rec?.confidence ?? null;
    const alertPills = `<span class="pm-ai-alert-pill ${esc(status)}">${esc(_typeLabel(a.alert_type))}</span>`;

    return `
      <div class="pm-ai-card ${esc(status)}">
        <div class="pm-ai-status-dot ${esc(status)}"></div>
        <div class="pm-ai-card-body">
          <div class="pm-ai-card-top">
            <span class="pm-ai-reg">${esc(a.vehicle_reg)}</span>
            <span class="pm-ai-label ${esc(status)}">${esc(labelText)}</span>
            ${confidence ? `<span class="pm-ai-confidence">Pewność AI: ${esc(confidence)}</span>` : ''}
          </div>
          ${aiText
            ? `<div class="pm-ai-recommendation"><i class="ti ti-robot" style="font-size:.8em"></i> ${esc(aiText)}</div>`
            : ''}
          <div class="pm-ai-alerts">${alertPills}</div>
        </div>
      </div>`;
  }

  function _serviceLabel(a) {
    if (a.status === 'overdue') return 'PRZETERMINOWANY';
    if (a.predicted_due_date) {
      const daysLeft = Math.round(
        (new Date(a.predicted_due_date) - new Date()) / 86400000
      );
      if (!isNaN(daysLeft)) {
        return `za ${daysLeft} ${_inflect(daysLeft, 'dzień', 'dni', 'dni')}`;
      }
    }
    if (a.predicted_due_km != null && a.current_km != null) {
      const kmLeft = (a.predicted_due_km ?? 0) - (a.current_km ?? 0);
      return `za ${kmLeft > 0 ? kmLeft : 0} km`;
    }
    return 'Wkrótce';
  }

  const TYPE_LABELS = {
    oil_change:   'Olej',
    tires:        'Opony',
    brake_fluid:  'Płyn ham.',
    inspection:   'Przegląd',
    belt:         'Rozrząd',
    coolant:      'Chłodnica',
    battery:      'Akumulator',
    custom:       'Niestandardowy',
  };
  function _typeLabel(t) { return TYPE_LABELS[t] ?? t; }

  function _inflect(n, one, few, many) {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
  }

  /* ------------------------------------------------------------------ */
  /*  AI report generation                                                */
  /* ------------------------------------------------------------------ */
  async function generateReport() {
    if (_generating) return;
    _generating = true;
    const btn = document.getElementById('pm-ai-gen-btn');
    if (btn) btn.disabled = true;
    if (btn) btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Generowanie...';

    const ts = document.getElementById('pm-ai-ts');
    try {
      const resp = await fetch(`${_api()}/api/predictive-ai`, {
        method:  'POST',
        headers: _hdrs(),
        body:    JSON.stringify({ company_id: _co() }),
      });
      const data = await resp.json();
      _recs = data.recommendations || [];
      _fetchAndRender();

      if (ts) ts.textContent = `Ostatnia aktualizacja AI: ${new Date().toLocaleTimeString('pl-PL')}`;
      typeof toast === 'function' && toast(`Raport AI wygenerowany dla ${_recs.length} pojazdów`);
    } catch {
      typeof toast === 'function' && toast('Błąd generowania raportu AI');
    } finally {
      _generating = false;
      if (btn) btn.disabled = false;
      if (btn) btn.innerHTML = '<i class="ti ti-brain"></i> Generuj raport AI';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public helpers                                                      */
  /* ------------------------------------------------------------------ */
  function refresh() {
    _recs = [];
    const ts = document.getElementById('pm-ai-ts');
    if (ts) ts.textContent = '';
    _fetchAndRender();
  }

  function openBaseModule() {
    // Delegate to existing module render if it's available
    if (typeof window.PredictiveMaintenance?.renderPredictiveMaintenance === 'function') {
      window.PredictiveMaintenance.renderPredictiveMaintenance();
    } else {
      typeof toast === 'function' && toast('Otwórz moduł Serwis Predykcyjny z menu.');
    }
  }

  return { renderPage, refresh, generateReport, openBaseModule };
})();
