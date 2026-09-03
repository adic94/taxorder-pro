(function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const ACTION_CLS = { CREATE: 'ok', UPDATE: 'warn', DELETE: 'danger', LOGIN: '', EXPORT: '' };
  let _logs = [], _offset = 0, _hasMore = true;

  async function renderAuditLog(reset) {
    if (reset !== false) { _logs = []; _offset = 0; _hasMore = true; }
    const co   = Co();
    const et   = document.getElementById('al-filter-type')?.value   || '';
    const act  = document.getElementById('al-filter-action')?.value || '';
    const from = document.getElementById('al-filter-from')?.value   || '';
    const to   = document.getElementById('al-filter-to')?.value     || '';
    const params = new URLSearchParams({ company: co, limit: 50 });
    if (et && et !== 'all')  params.set('entity_type', et);
    if (act && act !== 'all') params.set('action', act);
    if (from) params.set('from', from);
    if (to)   params.set('to', to);
    try {
      const r = await fetch(`${API()}/api/audit-log?${params}`, { headers: H() });
      if (r.ok) {
        const data = await r.json();
        if (reset !== false) _logs = data; else _logs = [..._logs, ...data];
        _hasMore = data.length >= 50;
        _offset += data.length;
      }
    } catch {}
    _render();
  }

  function _render() {
    const el = document.getElementById('page-audit-log');
    if (!el) return;
    el.innerHTML = `
<div class="page-header">
  <h2><i class="ti ti-history"></i> Historia zmian (Audit log)</h2>
</div>
<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
  <select id="al-filter-type" onchange="window.AuditLogModule.renderAuditLog(true)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="all">Wszystkie typy</option>
    ${['vehicle','driver','policy','service','fuel','fine','fault','reservation','approval'].map(t => `<option value="${t}">${t}</option>`).join('')}
  </select>
  <select id="al-filter-action" onchange="window.AuditLogModule.renderAuditLog(true)" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
    <option value="all">Wszystkie akcje</option>
    ${['CREATE','UPDATE','DELETE','LOGIN','EXPORT'].map(a => `<option value="${a}">${a}</option>`).join('')}
  </select>
  <input id="al-filter-from" type="date" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
  <input id="al-filter-to"   type="date" style="padding:6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card)">
  <button class="btn-secondary" onclick="window.AuditLogModule.renderAuditLog(true)">Filtruj</button>
</div>
<div class="table-wrap"><table class="data-table">
<thead><tr><th>Data/czas</th><th>Użytkownik</th><th>Akcja</th><th>Typ</th><th>ID encji</th><th>Szczegóły</th></tr></thead>
<tbody>
${_logs.length ? _logs.map(l => {
  const details = l.details ? (typeof l.details === 'string' ? l.details : JSON.stringify(l.details)) : '';
  const truncated = details.length > 60 ? `${details.slice(0, 60)  }...` : details;
  return `<tr>
  <td style="white-space:nowrap;font-size:12px">${e(l.created_at?.replace('T',' ').slice(0,19)||'')}</td>
  <td style="font-size:12px">${e(l.user_email||'system')}</td>
  <td><span class="pill ${e(ACTION_CLS[l.action]||'')}">${e(l.action)}</span></td>
  <td><code style="font-size:11px">${e(l.entity_type)}</code></td>
  <td style="font-size:11px;color:var(--text-muted)">${e(l.entity_id||'—')}</td>
  <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e(details)}">${e(truncated)}</td>
</tr>`;
}).join('') : '<tr><td colspan="6" class="empty">Brak wpisów w logu</td></tr>'}
</tbody></table></div>
${_hasMore ? `<div style="text-align:center;margin-top:12px"><button class="btn-secondary" onclick="window.AuditLogModule.loadMore()">Pokaż więcej</button></div>` : ''}`;
  }

  async function loadMore() { await renderAuditLog(false); }

  window.AuditLogModule = { renderAuditLog, loadMore };
})();
