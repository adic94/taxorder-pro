/*
 * SCHEMA_NEEDED: endpoint POST /api/rag-chat
 * Handler (in worker/index.js):
 *   Receives: { question: string, company_id: string }
 *   Returns:  { answer: string, sql_used: string, row_count: number }
 *
 *   Algorithm:
 *   1. Validate session (x-session / Authorization)
 *   2. Build a system prompt that describes the D1 schema (vehicles, fuel_records,
 *      service_orders, policies, damages, drivers, predictive_maintenance_alerts, etc.)
 *   3. Call Claude claude-haiku-4-5-20251001 with the user question → ask it to produce
 *      a single SQL query + answer template JSON: { sql, answer_template }
 *   4. Execute the returned SQL on D1 with company_id as a bind parameter
 *   5. Interpolate results into answer_template
 *   6. Return { answer, sql_used, row_count }
 */

window.RagManagerChat = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Helpers — delegate to global app helpers when available             */
  /* ------------------------------------------------------------------ */
  const _api  = () => window._cfApi?.()  || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const _hdrs = (extra) => window._cfHdrs ? window._cfHdrs(extra) : { 'Content-Type': 'application/json', ...extra };
  const _co   = () => window._cfCo?.()   || window.currentCompanyId || '';

  /* ------------------------------------------------------------------ */
  /*  Module state                                                        */
  /* ------------------------------------------------------------------ */
  let _messages = [];
  let _loading  = false;

  const EXAMPLE_QUESTIONS = [
    'Ile pojazdów ma przegląd w tym miesiącu?',
    'Który kierowca spalił najwięcej paliwa w lipcu?',
    'Jakie są łączne koszty paliwa od początku roku?',
    'Ile szkód zgłoszono w ostatnim kwartale?',
    'Które pojazdy mają wygasające OC w ciągu 30 dni?',
  ];

  /* ------------------------------------------------------------------ */
  /*  CSS injection (runs once)                                           */
  /* ------------------------------------------------------------------ */
  (function _injectStyles() {
    if (document.getElementById('rag-chat-styles')) return;
    const s = document.createElement('style');
    s.id = 'rag-chat-styles';
    s.textContent = `
      .rag-chat-wrap {
        max-width: 800px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        height: calc(100vh - 120px);
        min-height: 480px;
        gap: 0;
      }
      .rag-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0 12px 0;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
        margin-bottom: 12px;
        flex-shrink: 0;
      }
      .rag-chat-header h2 { margin: 0; font-size: 1.25rem; }
      .rag-model-badge {
        background: var(--accent-light, #eff6ff);
        color: var(--accent, #2563eb);
        border-radius: 999px;
        padding: 2px 10px;
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid var(--accent, #2563eb);
      }
      .rag-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
        flex-shrink: 0;
      }
      .rag-suggestion {
        background: var(--card-bg, #f9fafb);
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 999px;
        padding: 4px 12px;
        font-size: 0.78rem;
        cursor: pointer;
        color: var(--text-color, #111827);
        transition: background 0.15s, border-color 0.15s;
      }
      .rag-suggestion:hover {
        background: var(--accent-light, #eff6ff);
        border-color: var(--accent, #2563eb);
        color: var(--accent, #2563eb);
      }
      .rag-messages {
        flex-grow: 1;
        overflow-y: auto;
        min-height: 300px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px 0;
      }
      .rag-empty {
        color: var(--text-muted, #6b7280);
        text-align: center;
        margin-top: 40px;
        font-size: 0.9rem;
      }
      .rag-msg {
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }
      .rag-msg-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 1rem;
        background: var(--border-color, #e5e7eb);
        color: var(--text-muted, #6b7280);
      }
      .rag-msg-user .rag-msg-avatar {
        background: var(--accent, #2563eb);
        color: #fff;
      }
      .rag-msg-body {
        flex: 1;
        min-width: 0;
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 0.92rem;
        line-height: 1.55;
      }
      .rag-msg-user .rag-msg-body {
        background: var(--accent-light, #eff6ff);
        border: 1px solid var(--accent, #2563eb);
        align-self: flex-end;
        color: var(--text-color, #111827);
      }
      .rag-msg-assistant .rag-msg-body {
        background: var(--card-bg, #f9fafb);
        border-left: 3px solid var(--accent, #2563eb);
        border-top: 1px solid var(--border-color, #e5e7eb);
        border-bottom: 1px solid var(--border-color, #e5e7eb);
        border-right: 1px solid var(--border-color, #e5e7eb);
      }
      .rag-msg-text { white-space: pre-wrap; word-break: break-word; }
      .rag-sql {
        margin-top: 8px;
        font-size: 0.78rem;
      }
      .rag-sql summary {
        cursor: pointer;
        color: var(--text-muted, #6b7280);
        user-select: none;
      }
      .rag-sql pre {
        margin: 4px 0 0 0;
        background: var(--code-bg, #1e293b);
        color: #e2e8f0;
        padding: 8px 10px;
        border-radius: 6px;
        overflow-x: auto;
        font-size: 0.75rem;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .rag-rows {
        display: inline-block;
        margin-top: 6px;
        font-size: 0.72rem;
        background: var(--badge-bg, #f3f4f6);
        border-radius: 999px;
        padding: 1px 8px;
        color: var(--text-muted, #6b7280);
      }
      .rag-typing {
        color: var(--text-muted, #6b7280);
        font-size: 0.85rem;
        padding: 6px 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .rag-input-bar {
        display: flex;
        gap: 8px;
        padding: 12px 0 4px 0;
        flex-shrink: 0;
        border-top: 1px solid var(--border-color, #e5e7eb);
        margin-top: 8px;
      }
      .rag-input-bar input {
        flex: 1;
        min-width: 0;
      }
      .rag-note {
        font-size: 0.72rem;
        color: var(--text-muted, #6b7280);
        margin: 6px 0 0 0;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(s);
  })();

  /* ------------------------------------------------------------------ */
  /*  Render                                                              */
  /* ------------------------------------------------------------------ */
  function renderPage() {
    const page = document.getElementById('page-rag-chat');
    if (!page) return;
    _messages = [];
    _loading  = false;
    page.innerHTML = `
      <div class="rag-chat-wrap">
        <div class="rag-chat-header">
          <h2><i class="ti ti-robot"></i> Asystent AI TaxOrder</h2>
          <span class="rag-model-badge">Claude Haiku · D1 SQL</span>
        </div>
        <div class="rag-suggestions">
          ${EXAMPLE_QUESTIONS.map(q =>
            `<button class="rag-suggestion" data-q="${esc(q)}" onclick="RagManagerChat.ask(this.dataset.q)">${esc(q)}</button>`
          ).join('')}
        </div>
        <div class="rag-messages" id="rag-messages"></div>
        <div class="rag-input-bar">
          <input id="rag-input" class="form-control" type="text"
            placeholder="Zadaj pytanie o flotę..." maxlength="500"
            onkeydown="if(event.key==='Enter')RagManagerChat.sendMessage()">
          <button class="btn btn-primary" onclick="RagManagerChat.sendMessage()">
            <i class="ti ti-send"></i> Wyślij
          </button>
        </div>
        <p class="rag-note">AI korzysta z Twoich danych z bazy D1. Odpowiedzi generowane przez Claude.</p>
      </div>`;
    _renderMessages();
  }

  function _renderMessages() {
    const box = document.getElementById('rag-messages');
    if (!box) return;
    if (_messages.length === 0) {
      box.innerHTML = '<p class="rag-empty">Zadaj pytanie o Twoją flotę. AI przeanalizuje dane i odpowie.</p>';
      return;
    }
    box.innerHTML = _messages.map(m => `
      <div class="rag-msg rag-msg-${esc(m.role)}">
        <div class="rag-msg-avatar">
          ${m.role === 'user' ? '<i class="ti ti-user"></i>' : '<i class="ti ti-robot"></i>'}
        </div>
        <div class="rag-msg-body">
          <div class="rag-msg-text">${esc(m.content)}</div>
          ${m.sql
            ? `<details class="rag-sql"><summary>SQL</summary><pre>${esc(m.sql)}</pre></details>`
            : ''}
          ${m.rowCount != null
            ? `<span class="rag-rows">${esc(String(m.rowCount))} wierszy</span>`
            : ''}
        </div>
      </div>`).join('');
    box.scrollTop = box.scrollHeight;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                          */
  /* ------------------------------------------------------------------ */
  async function ask(question) {
    const input = document.getElementById('rag-input');
    if (input) input.value = question;
    await sendMessage();
  }

  async function sendMessage() {
    if (_loading) return;
    const input    = document.getElementById('rag-input');
    const question = input?.value?.trim();
    if (!question) return;
    input.value = '';
    _messages.push({ role: 'user', content: question });
    _loading = true;
    _renderMessages();

    // typing indicator
    const box = document.getElementById('rag-messages');
    if (box) {
      box.insertAdjacentHTML('beforeend',
        '<div class="rag-typing" id="rag-typing"><i class="ti ti-dots"></i> AI myśli...</div>');
      box.scrollTop = box.scrollHeight;
    }

    try {
      const resp = await fetch(`${_api()}/api/rag-chat`, {
        method:  'POST',
        headers: _hdrs(),
        body:    JSON.stringify({ question, company_id: _co() }),
      });
      const data = await resp.json();
      document.getElementById('rag-typing')?.remove();

      if (data.answer) {
        _messages.push({
          role:     'assistant',
          content:  data.answer,
          sql:      data.sql_used ?? null,
          rowCount: data.row_count ?? null,
        });
      } else {
        _messages.push({
          role:    'assistant',
          content: data.error || 'Nie udało się uzyskać odpowiedzi.',
        });
      }
    } catch {
      document.getElementById('rag-typing')?.remove();
      _messages.push({ role: 'assistant', content: 'Błąd połączenia z AI. Sprawdź sieć.' });
    }

    _loading = false;
    _renderMessages();
  }

  return { renderPage, sendMessage, ask };
})();
