/**
 * TaxOrder Pro — Obieg dokumentów
 * Workflow statusów dla dokumentów flotowych + audit trail + konfigurowalny routing
 */
(function () {
  'use strict';

  const API  = () => window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const tok  = () => localStorage.getItem('cf_token') || '';
  const co   = () => window.currentCompanyId || localStorage.getItem('cf_company') || '';
  const hdrs = () => ({ Authorization: 'Bearer ' + tok(), 'Content-Type': 'application/json' });
  const me   = () => window.currentUser || {};

  // ── Domyślne statusy (gdy firma nie ma własnego szablonu) ─────────────────
  const DEFAULT_STATUSES = [
    { id: 'nowy',              label: 'Nowy',              color: '#94a3b8', order: 0 },
    { id: 'w_weryfikacji',     label: 'W weryfikacji',     color: '#f59e0b', order: 1 },
    { id: 'do_zatwierdzenia',  label: 'Do zatwierdzenia',  color: '#3b82f6', order: 2 },
    { id: 'zatwierdzony',      label: 'Zatwierdzony',      color: '#22c55e', order: 3, is_final: true },
    { id: 'odrzucony',         label: 'Odrzucony',         color: '#ef4444', order: 4, is_final: true },
    { id: 'archiwum',          label: 'Archiwum',          color: '#6b7280', order: 5, is_final: true },
  ];

  const PRIORITY_LABELS = { urgent: 'Pilny', high: 'Wysoki', normal: 'Normalny', low: 'Niski' };
  const PRIORITY_COLORS = { urgent: 'var(--red)', high: '#f59e0b', normal: 'var(--text3)', low: 'var(--text3)' };

  const DOC_TYPE_LABELS = {
    oc:'Polisa OC', ac:'Polisa AC', nnw:'NNW', cargo:'Cargo', przeglad:'Przegląd tech.',
    udt:'UDT', adr:'ADR', tachograf:'Tachograf', reg:'Dowód rej.', faktura:'Faktura',
    leasing:'Leasing', najem:'Najem', upoważ:'Upoważnienie', dtreport:'DT-1',
    serwis:'Serwis', ubezp:'Ubezpieczenie', mandat:'Mandat', inne:'Inne',
  };
  const DOC_TYPE_ICONS = {
    oc:'ti-shield-check', ac:'ti-shield', nnw:'ti-shield-half', cargo:'ti-package',
    przeglad:'ti-clipboard-check', udt:'ti-crane', adr:'ti-alert-triangle',
    tachograf:'ti-clock', reg:'ti-id', faktura:'ti-receipt', leasing:'ti-building-bank',
    najem:'ti-writing', upoważ:'ti-user-check', dtreport:'ti-calculator',
    serwis:'ti-tool', ubezp:'ti-shield-half', mandat:'ti-gavel', inne:'ti-file',
  };

  let _docs = [];
  let _statuses = DEFAULT_STATUSES;
  let _templates = [];
  let _view = UserPrefs.get('dwf_view', 'kanban'); // kanban | table
  let _filterStatus = '';
  let _filterType = '';
  let _filterPriority = '';

  function _fmtDate(d) {
    if (!d) return '—';
    try { const [y,m,dd] = d.slice(0,10).split('-'); return `${dd}.${m}.${y}`; } catch { return d; }
  }
  function _daysLeft(ds) {
    if (!ds) return null;
    const diff = Math.round((new Date(ds.slice(0,10)) - new Date().setHours(0,0,0,0)) / 86400000);
    return diff;
  }
  function _statusObj(id) {
    return _statuses.find(s => s.id === id) || { id, label: id, color: '#94a3b8' };
  }

  // ── API calls ─────────────────────────────────────────────────────────────
  async function _fetchDocs() {
    const params = new URLSearchParams({ company: co() });
    if (_filterStatus)   params.set('status', _filterStatus);
    if (_filterType)     params.set('doc_type', _filterType);
    if (_filterPriority) params.set('priority', _filterPriority);
    const r = await fetch(`${API()}/api/doc-workflow/list?${params}`, { headers: hdrs() });
    if (!r.ok) return;
    const d = await r.json();
    _docs = d.documents || [];
  }

  async function _fetchTemplates() {
    const r = await fetch(`${API()}/api/doc-workflow/templates?company=${co()}`, { headers: hdrs() });
    if (!r.ok) return;
    const d = await r.json();
    _templates = d.templates || [];
    // Load statuses from default template or use DEFAULT_STATUSES
    const def = _templates.find(t => t.is_default);
    if (def) {
      try { _statuses = JSON.parse(def.statuses); } catch { _statuses = DEFAULT_STATUSES; }
    } else {
      _statuses = DEFAULT_STATUSES;
    }
  }

  async function _fetchStats() {
    const r = await fetch(`${API()}/api/doc-workflow/stats?company=${co()}`, { headers: hdrs() });
    if (!r.ok) return {};
    return r.json();
  }

  async function _updateStatus(docId, payload) {
    const r = await fetch(`${API()}/api/doc-workflow/${docId}/status?company=${co()}`, {
      method: 'PUT', headers: hdrs(), body: JSON.stringify(payload)
    });
    return r.ok;
  }

  async function _fetchHistory(docId) {
    const r = await fetch(`${API()}/api/doc-workflow/${docId}/history?company=${co()}`, { headers: hdrs() });
    if (!r.ok) return [];
    const d = await r.json();
    return d.history || [];
  }

  // ── Główna strona ─────────────────────────────────────────────────────────
  async function renderPage() {
    const pg = document.getElementById('page-doc-workflow');
    if (!pg) return;
    pg.innerHTML = `<div style="padding:20px;color:var(--text2);font-size:13px"><i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Ładowanie obiegu dokumentów…</div>`;
    await Promise.all([_fetchTemplates(), _fetchDocs()]);
    _render();
  }

  function _render() {
    const pg = document.getElementById('page-doc-workflow');
    if (!pg) return;

    const filteredDocs = _docs.filter(d => {
      if (_filterStatus && d.workflow_status !== _filterStatus) return false;
      if (_filterType && d.doc_type !== _filterType) return false;
      if (_filterPriority && d.workflow_priority !== _filterPriority) return false;
      return true;
    });

    const statCounts = {};
    _statuses.forEach(s => { statCounts[s.id] = _docs.filter(d => d.workflow_status === s.id).length; });

    pg.innerHTML = `
      <div class="page-header" style="padding:0 20px">
        <h2 class="page-title"><i class="ti ti-arrows-transfer-up"></i> Obieg Dokumentów</h2>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-gray" onclick="DocWorkflow.showTemplates()" title="Konfiguracja szablonów workflow">
            <i class="ti ti-settings"></i> Szablony
          </button>
          <div class="view-toggle" style="display:flex;gap:2px;background:var(--bg2);padding:3px;border-radius:var(--radius);border:1px solid var(--border)">
            <button class="btn ${_view==='kanban'?'btn-blue':'btn-ghost'}" onclick="DocWorkflow._setView('kanban')" title="Kanban">
              <i class="ti ti-layout-columns"></i>
            </button>
            <button class="btn ${_view==='table'?'btn-blue':'btn-ghost'}" onclick="DocWorkflow._setView('table')" title="Tabela">
              <i class="ti ti-table"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Status KPI bar -->
      <div style="display:flex;gap:8px;padding:12px 20px;overflow-x:auto;flex-wrap:nowrap">
        <button class="stat-chip ${!_filterStatus?'stat-chip-blue':''}" onclick="DocWorkflow._filterBy('status','')">
          Wszystkie <span>${_docs.length}</span>
        </button>
        ${_statuses.map(s => `
          <button class="stat-chip ${_filterStatus===s.id?'stat-chip-blue':''}"
            onclick="DocWorkflow._filterBy('status','${s.id}')"
            style="border-left:3px solid ${s.color}">
            ${esc(s.label)} <span style="background:${s.color}20;color:${s.color}">${statCounts[s.id] ?? 0}</span>
          </button>
        `).join('')}
      </div>

      <!-- Filters -->
      <div style="display:flex;gap:8px;padding:0 20px 12px;flex-wrap:wrap;align-items:center">
        <select class="form-select" style="width:160px;font-size:12px" onchange="DocWorkflow._filterBy('type',this.value)">
          <option value="">Wszystkie typy</option>
          ${Object.entries(DOC_TYPE_LABELS).map(([k,v]) => `<option value="${k}" ${_filterType===k?'selected':''}>${v}</option>`).join('')}
        </select>
        <select class="form-select" style="width:130px;font-size:12px" onchange="DocWorkflow._filterBy('priority',this.value)">
          <option value="">Wszystkie priorytety</option>
          ${Object.entries(PRIORITY_LABELS).map(([k,v]) => `<option value="${k}" ${_filterPriority===k?'selected':''}>${v}</option>`).join('')}
        </select>
        ${(_filterStatus||_filterType||_filterPriority) ? `<button class="btn btn-gray" onclick="DocWorkflow._clearFilters()" style="font-size:11px"><i class="ti ti-x"></i> Wyczyść filtry</button>` : ''}
        <span style="margin-left:auto;font-size:12px;color:var(--text3)">${filteredDocs.length} dokumentów</span>
      </div>

      <!-- Main content -->
      <div style="padding:0 20px 20px" id="dwf-content">
        ${_view === 'kanban' ? _renderKanban(filteredDocs) : _renderTable(filteredDocs)}
      </div>
    `;
  }

  // ── Kanban ────────────────────────────────────────────────────────────────
  function _renderKanban(docs) {
    return `<div style="display:flex;gap:12px;overflow-x:auto;align-items:flex-start;padding-bottom:8px">
      ${_statuses.map(s => {
        const colDocs = docs.filter(d => (d.workflow_status || 'nowy') === s.id);
        return `
          <div style="min-width:240px;max-width:280px;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:7px 10px;
                        background:var(--bg2);border-radius:var(--radius);border-left:3px solid ${s.color}">
              <span style="font-size:12px;font-weight:700;color:var(--text)">${esc(s.label)}</span>
              <span style="margin-left:auto;font-size:11px;font-weight:700;background:${s.color}20;
                           color:${s.color};padding:2px 7px;border-radius:10px">${colDocs.length}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${colDocs.length ? colDocs.map(d => _renderCard(d)).join('') : `
                <div style="padding:16px;text-align:center;color:var(--text3);font-size:11px;
                             border:1px dashed var(--border);border-radius:var(--radius)">
                  Brak dokumentów
                </div>`}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  }

  function _renderCard(d) {
    const st = _statusObj(d.workflow_status || 'nowy');
    const icon = DOC_TYPE_ICONS[d.doc_type] || 'ti-file';
    const typeLabel = DOC_TYPE_LABELS[d.doc_type] || d.doc_type || '—';
    const dl = _daysLeft(d.expiry_date);
    const expiryStr = d.expiry_date ? (dl < 0 ? `<span style="color:var(--red);font-weight:700">Wygasł ${Math.abs(dl)}d temu</span>` :
                      dl <= 14 ? `<span style="color:var(--red);font-weight:700">Wygasa za ${dl}d</span>` :
                      dl <= 30 ? `<span style="color:#f59e0b">Wygasa za ${dl}d</span>` :
                      `<span style="color:var(--text3)">do ${_fmtDate(d.expiry_date)}</span>`) : '';
    const prioColor = PRIORITY_COLORS[d.workflow_priority] || 'var(--text3)';
    const prioBadge = d.workflow_priority && d.workflow_priority !== 'normal'
      ? `<span style="font-size:9px;font-weight:700;color:${prioColor};text-transform:uppercase;letter-spacing:.05em">${PRIORITY_LABELS[d.workflow_priority] || ''}</span>` : '';

    return `
      <div class="card" style="padding:12px;cursor:pointer;transition:box-shadow .15s;border-left:2px solid ${st.color}"
           onclick="DocWorkflow.showChangeStatus('${d.id}')">
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
          <i class="ti ${icon}" style="font-size:15px;color:var(--text3);margin-top:1px;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.name)}">${esc(d.name)}</div>
            <div style="font-size:10.5px;color:var(--text3)">${typeLabel}</div>
          </div>
          ${prioBadge}
        </div>
        ${d.nr_rej ? `<div style="font-size:10.5px;color:var(--text2);margin-bottom:4px"><i class="ti ti-car" style="font-size:10px"></i> ${esc(d.nr_rej)}</div>` : ''}
        ${expiryStr ? `<div style="font-size:10.5px;margin-bottom:4px">${expiryStr}</div>` : ''}
        ${d.workflow_assigned_name ? `<div style="font-size:10.5px;color:var(--text2)"><i class="ti ti-user" style="font-size:10px"></i> ${esc(d.workflow_assigned_name)}</div>` : ''}
        ${d.workflow_due_date ? `<div style="font-size:10.5px;color:var(--text3)"><i class="ti ti-calendar-due" style="font-size:10px"></i> Termin: ${_fmtDate(d.workflow_due_date)}</div>` : ''}
      </div>`;
  }

  // ── Table view ────────────────────────────────────────────────────────────
  function _renderTable(docs) {
    if (!docs.length) return `<div class="empty-state"><i class="ti ti-arrows-transfer-up"></i><p>Brak dokumentów spełniających kryteria</p></div>`;
    return `<div class="tbl-wrap"><table style="width:100%">
      <thead><tr>
        <th>Dokument</th><th>Typ</th><th>Pojazd</th><th>Status</th><th>Priorytet</th><th>Przypisany do</th><th>Ważny do</th><th>Termin</th><th></th>
      </tr></thead>
      <tbody>
        ${docs.map(d => {
          const st = _statusObj(d.workflow_status || 'nowy');
          const icon = DOC_TYPE_ICONS[d.doc_type] || 'ti-file';
          const typeLabel = DOC_TYPE_LABELS[d.doc_type] || d.doc_type || '—';
          const dl = _daysLeft(d.expiry_date);
          const expiryColor = dl === null ? 'var(--text3)' : dl < 0 ? 'var(--red)' : dl <= 14 ? 'var(--red)' : dl <= 30 ? '#f59e0b' : 'var(--green)';
          return `<tr>
            <td style="max-width:180px"><div style="font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.name)}">${esc(d.name)}</div></td>
            <td><span style="color:var(--text2);font-size:11px"><i class="ti ${icon}"></i> ${typeLabel}</span></td>
            <td style="font-size:11px">${d.nr_rej ? esc(d.nr_rej) : (d.vin ? esc(d.vin.slice(-6)) : '—')}</td>
            <td><span style="font-size:11px;font-weight:600;color:${st.color};background:${st.color}18;padding:2px 8px;border-radius:10px">${esc(st.label)}</span></td>
            <td style="font-size:11px;color:${PRIORITY_COLORS[d.workflow_priority]}">${PRIORITY_LABELS[d.workflow_priority] || '—'}</td>
            <td style="font-size:11px">${d.workflow_assigned_name ? esc(d.workflow_assigned_name) : '<span style="color:var(--text3)">—</span>'}</td>
            <td style="font-size:11px;color:${expiryColor};font-weight:${dl !== null && dl <= 30 ? '700' : '400'};font-family:var(--mono)">${d.expiry_date ? _fmtDate(d.expiry_date) : '—'}</td>
            <td style="font-size:11px;font-family:var(--mono)">${d.workflow_due_date ? _fmtDate(d.workflow_due_date) : '—'}</td>
            <td>
              <button class="btn btn-gray" style="font-size:11px;padding:3px 8px" onclick="DocWorkflow.showChangeStatus('${d.id}')">
                <i class="ti ti-edit"></i> Status
              </button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  // ── Modal: zmiana statusu ─────────────────────────────────────────────────
  async function showChangeStatus(docId) {
    const doc = _docs.find(d => d.id === docId);
    if (!doc) return;
    const history = await _fetchHistory(docId);
    const st = _statusObj(doc.workflow_status || 'nowy');
    const curIdx = _statuses.findIndex(s => s.id === (doc.workflow_status || 'nowy'));

    const histHtml = history.length ? history.map(h => `
      <div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
        <i class="ti ti-arrow-right" style="color:var(--text3);font-size:12px;margin-top:2px;flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;color:var(--text)">
            ${esc(h.status_from || 'nowy')} → ${esc(h.status_to)}
          </div>
          <div style="font-size:10.5px;color:var(--text3)">${esc(h.changed_by_name || h.changed_by || '?')} · ${h.created_at?.slice(0,16).replace('T',' ')}</div>
          ${h.comment ? `<div style="font-size:11px;color:var(--text2);font-style:italic;margin-top:2px">${esc(h.comment)}</div>` : ''}
        </div>
      </div>`).join('') : `<div style="font-size:12px;color:var(--text3);padding:8px 0">Brak historii zmian</div>`;

    const html = `
      <div class="modal-overlay" id="dwf-modal" onclick="if(event.target===this)DocWorkflow._closeModal()">
        <div class="modal" style="max-width:520px;width:100%" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="ti ti-arrows-transfer-up"></i> Zmiana statusu dokumentu</h3>
            <button class="btn btn-ghost" onclick="DocWorkflow._closeModal()"><i class="ti ti-x"></i></button>
          </div>
          <div class="modal-body" style="padding:16px 20px">
            <!-- Doc info -->
            <div style="background:var(--bg2);border-radius:var(--radius);padding:10px 14px;margin-bottom:16px">
              <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(doc.name)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:3px">
                ${DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type || '—'}
                ${doc.nr_rej ? ` · <i class="ti ti-car"></i> ${esc(doc.nr_rej)}` : ''}
                ${doc.expiry_date ? ` · Ważny do: ${_fmtDate(doc.expiry_date)}` : ''}
              </div>
              <div style="margin-top:6px">
                <span style="font-size:11px;font-weight:600;color:${st.color};background:${st.color}18;padding:2px 8px;border-radius:10px">
                  Obecny: ${esc(st.label)}
                </span>
              </div>
            </div>

            <!-- Quick status buttons -->
            <div style="margin-bottom:14px">
              <div class="form-label">Nowy status</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${_statuses.map((s, i) => `
                  <button class="btn ${s.id === (doc.workflow_status || 'nowy') ? 'btn-blue' : 'btn-gray'}"
                    style="font-size:11px;border-left:3px solid ${s.color}"
                    onclick="DocWorkflow._selectStatus(this,'${s.id}')">
                    ${esc(s.label)}
                  </button>`).join('')}
              </div>
            </div>

            <!-- Assign to -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
              <div>
                <div class="form-label">Przypisz do</div>
                <input type="text" id="dwf-assign-name" class="form-control" placeholder="Imię i nazwisko"
                  value="${esc(doc.workflow_assigned_name || '')}" style="font-size:12px">
              </div>
              <div>
                <div class="form-label">Termin realizacji</div>
                <input type="date" id="dwf-due-date" class="form-control"
                  value="${doc.workflow_due_date || ''}" style="font-size:12px">
              </div>
            </div>

            <!-- Priority -->
            <div style="margin-bottom:14px">
              <div class="form-label">Priorytet</div>
              <select id="dwf-priority" class="form-select" style="font-size:12px">
                ${Object.entries(PRIORITY_LABELS).map(([k,v]) => `<option value="${k}" ${doc.workflow_priority===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>

            <!-- Comment -->
            <div style="margin-bottom:14px">
              <div class="form-label">Komentarz (opcjonalny)</div>
              <textarea id="dwf-comment" class="form-control" rows="2" placeholder="Uwagi do zmiany statusu…" style="font-size:12px;resize:vertical"></textarea>
            </div>

            <!-- History -->
            <details style="margin-bottom:8px">
              <summary style="font-size:12px;font-weight:600;color:var(--text2);cursor:pointer;padding:6px 0">
                <i class="ti ti-history"></i> Historia zmian (${history.length})
              </summary>
              <div style="padding:8px 0 0">${histHtml}</div>
            </details>
          </div>
          <div class="modal-footer">
            <button class="btn btn-gray" onclick="DocWorkflow._closeModal()">Anuluj</button>
            <button class="btn btn-blue" id="dwf-save-btn" onclick="DocWorkflow._saveStatus('${docId}')">
              <i class="ti ti-check"></i> Zapisz status
            </button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    // Remember selected status
    document.getElementById('dwf-modal')._selectedStatus = doc.workflow_status || 'nowy';
  }

  function _selectStatus(btn, statusId) {
    document.querySelectorAll('#dwf-modal .btn').forEach(b => {
      if (b === btn) b.classList.replace('btn-gray', 'btn-blue');
      else if (b.onclick?.toString()?.includes('_selectStatus')) b.classList.replace('btn-blue', 'btn-gray');
    });
    document.getElementById('dwf-modal')._selectedStatus = statusId;
  }

  async function _saveStatus(docId) {
    const modal = document.getElementById('dwf-modal');
    const newStatus  = modal._selectedStatus;
    const assignName = document.getElementById('dwf-assign-name')?.value?.trim() || null;
    const dueDate    = document.getElementById('dwf-due-date')?.value || null;
    const priority   = document.getElementById('dwf-priority')?.value || 'normal';
    const comment    = document.getElementById('dwf-comment')?.value?.trim() || null;
    const btn = document.getElementById('dwf-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Zapisuję…'; }
    const ok = await _updateStatus(docId, { status: newStatus, assigned_name: assignName, due_date: dueDate, priority, comment });
    if (ok) {
      toast('✓ Status dokumentu zaktualizowany');
      _closeModal();
      await _fetchDocs();
      _render();
    } else {
      toast('Błąd zapisu statusu', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Zapisz status'; }
    }
  }

  function _closeModal() {
    document.getElementById('dwf-modal')?.remove();
  }

  // ── Szablony workflow ─────────────────────────────────────────────────────
  async function showTemplates() {
    const tpls = _templates;
    const html = `
      <div class="modal-overlay" id="dwf-tpl-modal" onclick="if(event.target===this)document.getElementById('dwf-tpl-modal')?.remove()">
        <div class="modal" style="max-width:640px;width:100%" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="ti ti-settings"></i> Szablony obiegu dokumentów</h3>
            <button class="btn btn-ghost" onclick="document.getElementById('dwf-tpl-modal')?.remove()"><i class="ti ti-x"></i></button>
          </div>
          <div class="modal-body" style="padding:16px 20px">
            <p style="font-size:12px;color:var(--text2);margin-bottom:14px">
              Zdefiniuj własne ścieżki zatwierdzeń dla dokumentów flotowych. Domyślny szablon określa dostępne statusy dla całej firmy.
            </p>
            ${!tpls.length ? `<div style="text-align:center;padding:20px;color:var(--text3)"><i class="ti ti-template" style="font-size:28px;display:block;margin-bottom:8px"></i>
              Brak szablonów — kliknij "Nowy szablon" aby dodać</div>` : tpls.map(t => {
              let sts = [];
              try { sts = JSON.parse(t.statuses); } catch {}
              return `<div class="card" style="padding:12px;margin-bottom:10px">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  <div>
                    <span style="font-size:13px;font-weight:700;color:var(--text)">${esc(t.name)}</span>
                    ${t.is_default ? ` <span class="badge badge-blue" style="font-size:10px">Domyślny</span>` : ''}
                  </div>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-gray" style="font-size:11px" onclick="DocWorkflow._editTemplate('${t.id}')"><i class="ti ti-edit"></i></button>
                    <button class="btn btn-gray" style="font-size:11px;color:var(--red)" onclick="DocWorkflow._deleteTemplate('${t.id}')"><i class="ti ti-trash"></i></button>
                  </div>
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">
                  ${sts.map(s => `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${s.color}20;color:${s.color};font-weight:600">${esc(s.label)}</span>`).join(' → ')}
                </div>
              </div>`;
            }).join('')}
            <button class="btn btn-blue" style="margin-top:8px" onclick="DocWorkflow._newTemplate()">
              <i class="ti ti-plus"></i> Nowy szablon
            </button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function _newTemplate() {
    document.getElementById('dwf-tpl-modal')?.remove();
    _showTemplateForm(null);
  }

  async function _editTemplate(id) {
    const tpl = _templates.find(t => t.id === id);
    document.getElementById('dwf-tpl-modal')?.remove();
    _showTemplateForm(tpl);
  }

  async function _deleteTemplate(id) {
    if (!confirm('Usunąć szablon? Dokumenty zachowają swoje statusy.')) return;
    const r = await fetch(`${API()}/api/doc-workflow/templates/${id}?company=${co()}`, { method: 'DELETE', headers: hdrs() });
    if (r.ok) { toast('✓ Szablon usunięty'); document.getElementById('dwf-tpl-modal')?.remove(); await _fetchTemplates(); showTemplates(); }
    else toast('Błąd usuwania szablonu', 'error');
  }

  function _showTemplateForm(tpl) {
    let statuses = tpl ? [] : JSON.parse(JSON.stringify(DEFAULT_STATUSES));
    if (tpl) { try { statuses = JSON.parse(tpl.statuses); } catch { statuses = JSON.parse(JSON.stringify(DEFAULT_STATUSES)); } }

    const renderStatusList = () => statuses.map((s, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--bg2);border-radius:var(--radius);margin-bottom:5px">
        <input type="color" value="${s.color}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0"
          onchange="DocWorkflow._tplUpdateStatus(${i},'color',this.value)">
        <input type="text" value="${s.label}" class="form-control" style="font-size:12px;flex:1"
          onchange="DocWorkflow._tplUpdateStatus(${i},'label',this.value)">
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text3);white-space:nowrap">
          <input type="checkbox" ${s.is_final?'checked':''} onchange="DocWorkflow._tplUpdateStatus(${i},'is_final',this.checked)"> Końcowy
        </label>
        <button class="btn btn-ghost" style="font-size:11px;color:var(--red)" onclick="DocWorkflow._tplRemoveStatus(${i})"><i class="ti ti-trash"></i></button>
      </div>`).join('');

    const html = `
      <div class="modal-overlay" id="dwf-tpl-form-modal" onclick="if(event.target===this)document.getElementById('dwf-tpl-form-modal')?.remove()">
        <div class="modal" style="max-width:500px;width:100%" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3><i class="ti ti-template"></i> ${tpl ? 'Edytuj' : 'Nowy'} szablon workflow</h3>
            <button class="btn btn-ghost" onclick="document.getElementById('dwf-tpl-form-modal')?.remove()"><i class="ti ti-x"></i></button>
          </div>
          <div class="modal-body" style="padding:16px 20px">
            <div style="margin-bottom:12px">
              <div class="form-label">Nazwa szablonu</div>
              <input type="text" id="tpl-name" class="form-control" value="${esc(tpl?.name || '')}" placeholder="np. Zatwierdz. polis OC/AC">
            </div>
            <div style="margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text2)">
                  <input type="checkbox" id="tpl-default" ${tpl?.is_default?'checked':''}> Ustaw jako domyślny (dla całej firmy)
                </label>
              </div>
            </div>
            <div style="margin-bottom:6px">
              <div class="form-label">Statusy (kolejność = przepływ dokumentu)</div>
              <div id="tpl-status-list">${renderStatusList()}</div>
              <button class="btn btn-gray" style="font-size:11px;margin-top:6px" onclick="DocWorkflow._tplAddStatus()">
                <i class="ti ti-plus"></i> Dodaj status
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-gray" onclick="document.getElementById('dwf-tpl-form-modal')?.remove()">Anuluj</button>
            <button class="btn btn-blue" onclick="DocWorkflow._saveTemplate('${tpl?.id || ''}')">
              <i class="ti ti-check"></i> ${tpl ? 'Zapisz' : 'Utwórz'}
            </button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('dwf-tpl-form-modal')._statuses = statuses;
  }

  function _tplAddStatus() {
    const modal = document.getElementById('dwf-tpl-form-modal');
    modal._statuses.push({ id: 'status_' + Date.now(), label: 'Nowy status', color: '#94a3b8', order: modal._statuses.length });
    _refreshTplStatusList(modal);
  }
  function _tplRemoveStatus(i) {
    const modal = document.getElementById('dwf-tpl-form-modal');
    modal._statuses.splice(i, 1);
    _refreshTplStatusList(modal);
  }
  function _tplUpdateStatus(i, field, val) {
    const modal = document.getElementById('dwf-tpl-form-modal');
    if (modal._statuses[i]) modal._statuses[i][field] = val;
  }
  function _refreshTplStatusList(modal) {
    const list = document.getElementById('tpl-status-list');
    if (!list) return;
    const statuses = modal._statuses;
    list.innerHTML = statuses.map((s, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--bg2);border-radius:var(--radius);margin-bottom:5px">
        <input type="color" value="${s.color}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0"
          onchange="DocWorkflow._tplUpdateStatus(${i},'color',this.value)">
        <input type="text" value="${esc(s.label)}" class="form-control" style="font-size:12px;flex:1"
          oninput="DocWorkflow._tplUpdateStatus(${i},'label',this.value)">
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text3);white-space:nowrap">
          <input type="checkbox" ${s.is_final?'checked':''} onchange="DocWorkflow._tplUpdateStatus(${i},'is_final',this.checked)"> Końcowy
        </label>
        <button class="btn btn-ghost" style="font-size:11px;color:var(--red)" onclick="DocWorkflow._tplRemoveStatus(${i})"><i class="ti ti-trash"></i></button>
      </div>`).join('');
  }

  async function _saveTemplate(existingId) {
    const modal = document.getElementById('dwf-tpl-form-modal');
    const name = document.getElementById('tpl-name')?.value?.trim();
    const isDefault = document.getElementById('tpl-default')?.checked;
    const statuses = modal._statuses;
    if (!name) { toast('Podaj nazwę szablonu', 'error'); return; }
    if (!statuses.length) { toast('Dodaj co najmniej jeden status', 'error'); return; }
    const payload = { name, statuses, doc_types: [], is_default: isDefault };
    const r = existingId
      ? await fetch(`${API()}/api/doc-workflow/templates/${existingId}?company=${co()}`, { method: 'PUT', headers: hdrs(), body: JSON.stringify(payload) })
      : await fetch(`${API()}/api/doc-workflow/templates?company=${co()}`, { method: 'POST', headers: hdrs(), body: JSON.stringify(payload) });
    if (r.ok) {
      toast('✓ Szablon zapisany');
      modal.remove();
      await _fetchTemplates();
      _render();
    } else {
      toast('Błąd zapisu szablonu', 'error');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _setView(v) {
    _view = v;
    UserPrefs.set('dwf_view', v);
    _render();
  }
  function _filterBy(type, val) {
    if (type === 'status')   _filterStatus = val;
    if (type === 'type')     _filterType = val;
    if (type === 'priority') _filterPriority = val;
    _render();
  }
  function _clearFilters() {
    _filterStatus = ''; _filterType = ''; _filterPriority = '';
    _render();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.DocWorkflow = {
    renderPage,
    showChangeStatus,
    showTemplates,
    _setView,
    _filterBy,
    _clearFilters,
    _selectStatus,
    _saveStatus,
    _closeModal,
    _newTemplate,
    _editTemplate,
    _deleteTemplate,
    _tplAddStatus,
    _tplRemoveStatus,
    _tplUpdateStatus,
    _saveTemplate,
  };

})();
