/**
 * TaxOrder Pro — Moduł HR (urlopy, badania lekarskie, psychotechniczne)
 * Szkolenia kierowców są w modules/driver-training.js — tu tylko link.
 *
 * SCHEMA_NEEDED:
 * CREATE TABLE IF NOT EXISTS hr_leaves (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   driver_id TEXT,
 *   driver_name TEXT NOT NULL,
 *   leave_type TEXT DEFAULT 'annual',
 *   from_date TEXT NOT NULL,
 *   to_date TEXT NOT NULL,
 *   days_count INTEGER DEFAULT 0,
 *   status TEXT DEFAULT 'pending',
 *   approved_by TEXT,
 *   notes TEXT,
 *   created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
 * );
 * CREATE TABLE IF NOT EXISTS hr_medical_exams (
 *   id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(10)))),
 *   company_id TEXT NOT NULL,
 *   driver_id TEXT,
 *   driver_name TEXT NOT NULL,
 *   exam_type TEXT DEFAULT 'periodic',
 *   exam_date TEXT NOT NULL,
 *   valid_until TEXT NOT NULL,
 *   notes TEXT,
 *   created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
 * );
 * CREATE INDEX IF NOT EXISTS idx_hr_leaves ON hr_leaves(company_id, status);
 * CREATE INDEX IF NOT EXISTS idx_hr_exams ON hr_medical_exams(company_id, exam_type, valid_until);
 *
 * ENDPOINT_NEEDED:
 * GET    /api/hr-leaves?company=X           — list leaves
 * POST   /api/hr-leaves                     — create leave request
 * PUT    /api/hr-leaves/:id                 — update (approve/reject/edit)
 * DELETE /api/hr-leaves/:id                 — delete
 * GET    /api/hr-medical-exams?company=X&type=periodic  — list exams
 * POST   /api/hr-medical-exams              — add exam
 * DELETE /api/hr-medical-exams/:id          — delete exam
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || { Authorization: `Bearer ${localStorage.getItem('cf_token')}` };
  const Co  = () => window._cfCo?.() || window.currentCompanyId || localStorage.getItem('currentCompany') || '';

  const LEAVE_LABEL  = { annual: 'Wypoczynkowy', sick: 'Chorobowy', unpaid: 'Bezpłatny', other: 'Inny' };
  const STATUS_LABEL = { pending: 'Oczekuje', approved: 'Zatwierdzony', rejected: 'Odrzucony' };
  const STATUS_CLR   = { pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444' };
  const EXAM_LABEL   = { periodic: 'Okresowe', admission: 'Wstępne', night: 'Nocne', psycho: 'Psychotechniczne' };

  let _activeTab = 'leaves';

  // ── API helpers ───────────────────────────────────────────────────────────

  async function _api(method, path, body) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API()}${path}${sep}company=${encodeURIComponent(Co())}`;
    const opts = { method, headers: { 'Content-Type': 'application/json', ...H() } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.json().catch(() => ({}));
  }

  function _daysUntil(dateStr) {
    return Math.round((new Date(dateStr) - Date.now()) / 86400000);
  }

  function _fmtDate(ds) {
    if (!ds) return '—';
    return String(ds).slice(0, 10);
  }

  function _calcDays(from, to) {
    if (!from || !to) return 0;
    return Math.max(0, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  }

  // ── Render main page ──────────────────────────────────────────────────────

  function renderHrModule() {
    const el = document.getElementById('page-hr-module');
    if (!el) return;

    el.innerHTML = `
      <div class="page-header">
        <h2><i class="ti ti-users"></i> HR — Zarządzanie Kierowcami</h2>
      </div>

      <div class="tabs-bar" style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--border,#e2e8f0);padding-bottom:0">
        <button class="tab-btn" id="hr-tab-leaves"      onclick="window.HrModule._switchTab('leaves')"    style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">Urlopy</button>
        <button class="tab-btn" id="hr-tab-medical"     onclick="window.HrModule._switchTab('medical')"   style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">Badania lekarskie</button>
        <button class="tab-btn" id="hr-tab-psycho"      onclick="window.HrModule._switchTab('psycho')"    style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600">Psychotechniczne</button>
        <a class="tab-btn" href="#" onclick="window.DriverTraining?.renderDriverTraining?.();return false"
           style="padding:8px 16px;border:none;background:none;cursor:pointer;font-weight:600;text-decoration:none;color:inherit">
          Szkolenia ↗
        </a>
      </div>

      <div id="hr-tab-content"></div>

      <div id="hr-modal" class="modal-backdrop" style="display:none" onclick="if(event.target===this)window.HrModule._closeModal()">
        <div class="modal-box" style="max-width:560px">
          <div class="modal-header">
            <h3 id="hr-modal-title">Rekord HR</h3>
            <button class="modal-close" onclick="window.HrModule._closeModal()">×</button>
          </div>
          <div class="modal-body" id="hr-modal-body"></div>
        </div>
      </div>`;

    _switchTab(_activeTab);
  }

  function _switchTab(tab) {
    _activeTab = tab;
    ['leaves', 'medical', 'psycho'].forEach(t => {
      const btn = document.getElementById(`hr-tab-${t}`);
      if (btn) btn.style.borderBottom = t === tab ? '2px solid #3b82f6' : 'none';
    });
    const content = document.getElementById('hr-tab-content');
    if (!content) return;
    if (tab === 'leaves')  _renderLeavesTab(content);
    if (tab === 'medical') _renderExamsTab(content, 'periodic');
    if (tab === 'psycho')  _renderExamsTab(content, 'psycho');
  }

  // ── URLOPY TAB ─────────────────────────────────────────────────────────────

  function _renderLeavesTab(container) {
    container.innerHTML = `
      <div id="hr-kpi-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <select id="hr-leave-type-filter" class="form-control" style="width:180px" onchange="window.HrModule._loadLeaves()">
          <option value="">Wszystkie typy</option>
          ${Object.entries(LEAVE_LABEL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <select id="hr-leave-status-filter" class="form-control" style="width:160px" onchange="window.HrModule._loadLeaves()">
          <option value="">Wszystkie statusy</option>
          ${Object.entries(STATUS_LABEL).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
        </select>
        <input id="hr-leave-search" class="form-control" style="width:200px" placeholder="Kierowca..." oninput="window.HrModule._loadLeaves()">
        <button class="btn btn-primary" style="margin-left:auto" onclick="window.HrModule._openLeaveModal()">
          <i class="ti ti-plus"></i> Nowy wniosek
        </button>
      </div>
      <div id="hr-calendar" style="margin-bottom:16px"></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Kierowca</th><th>Typ</th><th>Od</th><th>Do</th><th>Dni</th><th>Status</th><th>Akcje</th>
          </tr></thead>
          <tbody id="hr-leaves-tbody"><tr><td colspan="7" class="loading-row">Ładowanie...</td></tr></tbody>
        </table>
      </div>`;
    _loadLeaves();
  }

  async function _loadLeaves() {
    const type   = document.getElementById('hr-leave-type-filter')?.value || '';
    const status = document.getElementById('hr-leave-status-filter')?.value || '';
    const q      = document.getElementById('hr-leave-search')?.value || '';
    const tbody  = document.getElementById('hr-leaves-tbody');
    if (!tbody) return;

    const data   = await _api('GET', `/api/hr-leaves?type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
    const list   = data.leaves || [];
    const today  = list.filter(l => l.status === 'approved' && l.from_date <= new Date().toISOString().slice(0,10) && l.to_date >= new Date().toISOString().slice(0,10)).length;
    const onLeave = today;
    const pending = list.filter(l => l.status === 'pending').length;

    const kpi = document.getElementById('hr-kpi-row');
    if (kpi) {
      kpi.innerHTML = [
        { lbl: 'Na urlopie dziś', val: onLeave, clr: '#3b82f6', icon: 'ti-user-check' },
        { lbl: 'Zaplanowane wnioski', val: pending, clr: '#f59e0b', icon: 'ti-clock' },
        { lbl: 'Łącznie urlopów', val: list.length, clr: '#64748b', icon: 'ti-calendar' },
      ].map(k => `
        <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:160px">
          <i class="ti ${k.icon}" style="font-size:1.6em;color:${k.clr}"></i>
          <div><div style="font-size:1.5em;font-weight:700;color:${k.clr}">${k.val}</div><div style="font-size:.8em;color:var(--text-muted)">${k.lbl}</div></div>
        </div>`).join('');
    }

    _renderLeaveCalendar(list);

    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Brak urlopów</td></tr>'; return; }

    tbody.innerHTML = list.map(l => `
      <tr>
        <td>${esc(l.driver_name || '—')}</td>
        <td>${esc(LEAVE_LABEL[l.leave_type] ?? l.leave_type ?? '—')}</td>
        <td>${esc(_fmtDate(l.from_date))}</td>
        <td>${esc(_fmtDate(l.to_date))}</td>
        <td style="text-align:center">${l.days_count ?? 0}</td>
        <td><span style="padding:2px 8px;border-radius:12px;font-size:.8em;font-weight:600;background:${STATUS_CLR[l.status]||'#94a3b8'}20;color:${STATUS_CLR[l.status]||'#94a3b8'}">${esc(STATUS_LABEL[l.status] ?? l.status ?? '—')}</span></td>
        <td style="white-space:nowrap">
          ${l.status === 'pending' ? `
            <button class="btn-icon" title="Zatwierdź" data-id="${esc(l.id)}" onclick="window.HrModule._approveLeave(this.dataset.id,'approved')"><i class="ti ti-check" style="color:#22c55e"></i></button>
            <button class="btn-icon" title="Odrzuć" data-id="${esc(l.id)}" onclick="window.HrModule._approveLeave(this.dataset.id,'rejected')"><i class="ti ti-x" style="color:#ef4444"></i></button>
          ` : ''}
          <button class="btn-icon" title="Edytuj" data-id="${esc(l.id)}" onclick="window.HrModule._openLeaveModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(l.id)}" onclick="window.HrModule._deleteLeave(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  function _renderLeaveCalendar(leaves) {
    const el = document.getElementById('hr-calendar');
    if (!el) return;
    const approved = leaves.filter(l => l.status === 'approved');
    if (!approved.length) { el.innerHTML = ''; return; }

    // Build a simple heatmap of current month
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();
    const days  = new Date(year, month + 1, 0).getDate();
    const monthName = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

    const dayData = Array.from({ length: days }, (_, i) => {
      const d = `${year}-${String(month + 1).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`;
      const who = approved.filter(l => l.from_date <= d && l.to_date >= d).map(l => esc(l.driver_name));
      return { d, who };
    });

    el.innerHTML = `
      <div style="background:var(--bg-card,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:10px;padding:14px">
        <div style="font-weight:600;margin-bottom:10px"><i class="ti ti-calendar-event"></i> Urlopy — ${esc(monthName)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${dayData.map(({ d, who }) => {
            const dayNum = d.slice(8);
            const color  = who.length === 0 ? 'var(--bg,#fff)' : who.length === 1 ? '#bbf7d0' : '#fde68a';
            return `<div title="${who.join(', ') || 'Brak urlopów'}" style="width:28px;height:28px;border-radius:6px;background:${color};border:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:center;font-size:.75em;font-weight:600;cursor:default">${esc(dayNum)}</div>`;
          }).join('')}
        </div>
        <div style="margin-top:8px;display:flex;gap:12px;font-size:.8em">
          <span><span style="display:inline-block;width:12px;height:12px;background:#bbf7d0;border-radius:3px"></span> 1 osoba</span>
          <span><span style="display:inline-block;width:12px;height:12px;background:#fde68a;border-radius:3px"></span> 2+ osoby</span>
        </div>
      </div>`;
  }

  async function _openLeaveModal(id) {
    const body  = document.getElementById('hr-modal-body');
    const title = document.getElementById('hr-modal-title');
    const modal = document.getElementById('hr-modal');
    let r = {};
    if (id) {
      const d = await _api('GET', `/api/hr-leaves/${id}`);
      r = d.leave || {};
    }
    title.textContent = id ? 'Edytuj wniosek urlopowy' : 'Nowy wniosek urlopowy';
    body.innerHTML = `
      <form id="hr-leave-form" data-id="${esc(id || '')}" onsubmit="window.HrModule._saveLeave(event,this.dataset.id)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row" style="grid-column:1/-1"><label>Kierowca *</label>
            <input name="driver_name" class="form-control" required value="${esc(r.driver_name || '')}">
          </div>
          <div class="form-row"><label>Typ urlopu</label>
            <select name="leave_type" class="form-control">
              ${Object.entries(LEAVE_LABEL).map(([v,l]) => `<option value="${v}" ${r.leave_type === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Status</label>
            <select name="status" class="form-control">
              ${Object.entries(STATUS_LABEL).map(([v,l]) => `<option value="${v}" ${r.status === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Data od *</label>
            <input name="from_date" type="date" class="form-control" required value="${esc(r.from_date?.slice(0,10) || '')}" oninput="window.HrModule._recalcDays()">
          </div>
          <div class="form-row"><label>Data do *</label>
            <input name="to_date" type="date" class="form-control" required value="${esc(r.to_date?.slice(0,10) || '')}" oninput="window.HrModule._recalcDays()">
          </div>
          <div class="form-row"><label>Liczba dni</label>
            <input name="days_count" type="number" id="hr-leave-days" class="form-control" value="${r.days_count ?? 0}" min="0">
          </div>
          <div class="form-row"><label>Zatwierdził</label>
            <input name="approved_by" class="form-control" value="${esc(r.approved_by || '')}">
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label>
            <textarea name="notes" class="form-control" rows="2">${esc(r.notes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.HrModule._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  function _recalcDays() {
    const from = document.querySelector('#hr-leave-form [name=from_date]')?.value;
    const to   = document.querySelector('#hr-leave-form [name=to_date]')?.value;
    const inp  = document.getElementById('hr-leave-days');
    if (inp && from && to) inp.value = _calcDays(from, to);
  }

  async function _saveLeave(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.days_count = +body.days_count;
    await _api(id ? 'PUT' : 'POST', id ? `/api/hr-leaves/${id}` : '/api/hr-leaves', body);
    _closeModal();
    _loadLeaves();
  }

  async function _approveLeave(id, status) {
    await _api('PUT', `/api/hr-leaves/${id}`, { status });
    _loadLeaves();
  }

  async function _deleteLeave(id) {
    if (!confirm('Usunąć wniosek urlopowy?')) return;
    await _api('DELETE', `/api/hr-leaves/${id}`);
    _loadLeaves();
  }

  // ── BADANIA TAB ───────────────────────────────────────────────────────────

  function _renderExamsTab(container, examType) {
    const label = examType === 'psycho' ? 'Badania psychotechniczne' : 'Badania lekarskie';
    const icon  = examType === 'psycho' ? 'ti-brain' : 'ti-stethoscope';
    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <input id="hr-exam-search" class="form-control" style="width:240px" placeholder="Kierowca..." oninput="window.HrModule._loadExams('${examType}')">
        <button class="btn btn-primary" style="margin-left:auto" onclick="window.HrModule._openExamModal(null,'${examType}')">
          <i class="ti ti-plus"></i> Dodaj badanie
        </button>
      </div>
      <div id="hr-exam-alerts" style="margin-bottom:12px"></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Kierowca</th><th>Typ</th><th>Data badania</th><th>Ważne do</th><th>Pozostało dni</th><th>Status</th><th>Akcje</th>
          </tr></thead>
          <tbody id="hr-exams-tbody"><tr><td colspan="7" class="loading-row">Ładowanie...</td></tr></tbody>
        </table>
      </div>`;
    _loadExams(examType);
  }

  async function _loadExams(examType) {
    const q     = document.getElementById('hr-exam-search')?.value || '';
    const tbody = document.getElementById('hr-exams-tbody');
    if (!tbody) return;

    const data  = await _api('GET', `/api/hr-medical-exams?type=${encodeURIComponent(examType)}&q=${encodeURIComponent(q)}`);
    const list  = data.exams || [];

    const alerts = document.getElementById('hr-exam-alerts');
    const expiring = list.filter(e => { const d = _daysUntil(e.valid_until); return d >= 0 && d <= 30; });
    if (alerts) {
      alerts.innerHTML = expiring.length
        ? `<div class="alert-banner warning"><i class="ti ti-alert-triangle"></i> <strong>${expiring.length} kierowca(ów)</strong> ma badanie wygasające w ciągu 30 dni: ${expiring.map(e => esc(e.driver_name)).join(', ')}</div>`
        : '';
    }

    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Brak rekordów badań</td></tr>'; return; }

    tbody.innerHTML = list.map(e => {
      const days = _daysUntil(e.valid_until);
      const clr  = days < 0 ? '#ef4444' : days <= 30 ? '#f59e0b' : '#22c55e';
      const lbl  = days < 0 ? 'Wygasło' : days <= 30 ? `Wygasa za ${days} dni` : 'Ważne';
      return `<tr>
        <td>${esc(e.driver_name || '—')}</td>
        <td>${esc(EXAM_LABEL[e.exam_type] ?? e.exam_type ?? '—')}</td>
        <td>${esc(_fmtDate(e.exam_date))}</td>
        <td>${esc(_fmtDate(e.valid_until))}</td>
        <td style="color:${clr};font-weight:600;text-align:center">${days}</td>
        <td><span style="padding:2px 8px;border-radius:12px;font-size:.8em;font-weight:600;background:${clr}20;color:${clr}">${esc(lbl)}</span></td>
        <td>
          <button class="btn-icon" title="Edytuj" data-id="${esc(e.id)}" data-type="${esc(examType)}" onclick="window.HrModule._openExamModal(this.dataset.id,this.dataset.type)"><i class="ti ti-edit"></i></button>
          <button class="btn-icon danger" title="Usuń" data-id="${esc(e.id)}" onclick="window.HrModule._deleteExam(this.dataset.id)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  async function _openExamModal(id, examType) {
    const body  = document.getElementById('hr-modal-body');
    const title = document.getElementById('hr-modal-title');
    const modal = document.getElementById('hr-modal');
    let r = { exam_type: examType || 'periodic' };
    if (id) {
      const d = await _api('GET', `/api/hr-medical-exams/${id}`);
      r = d.exam || r;
    }
    const isLeave = false; // distinguishes exam modal from leave modal
    title.textContent = id ? 'Edytuj badanie' : 'Nowe badanie';
    body.innerHTML = `
      <form id="hr-exam-form" data-id="${esc(id || '')}" data-exam-type="${esc(examType || r.exam_type || 'periodic')}" onsubmit="window.HrModule._saveExam(event,this.dataset.id,this.dataset.examType)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-row" style="grid-column:1/-1"><label>Kierowca *</label>
            <input name="driver_name" class="form-control" required value="${esc(r.driver_name || '')}">
          </div>
          <div class="form-row"><label>Typ badania</label>
            <select name="exam_type" class="form-control">
              ${Object.entries(EXAM_LABEL).map(([v,l]) => `<option value="${v}" ${r.exam_type === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Data badania *</label>
            <input name="exam_date" type="date" class="form-control" required value="${esc(r.exam_date?.slice(0,10) || '')}">
          </div>
          <div class="form-row"><label>Ważne do *</label>
            <input name="valid_until" type="date" class="form-control" required value="${esc(r.valid_until?.slice(0,10) || '')}">
          </div>
          <div class="form-row" style="grid-column:1/-1"><label>Uwagi</label>
            <textarea name="notes" class="form-control" rows="2">${esc(r.notes || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" onclick="window.HrModule._closeModal()">Anuluj</button>
          <button type="submit" class="btn btn-primary">Zapisz</button>
        </div>
      </form>`;
    modal.style.display = 'flex';
  }

  async function _saveExam(e, id, examType) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    await _api(id ? 'PUT' : 'POST', id ? `/api/hr-medical-exams/${id}` : '/api/hr-medical-exams', body);
    _closeModal();
    _loadExams(examType || body.exam_type || 'periodic');
  }

  async function _deleteExam(id) {
    if (!confirm('Usunąć rekord badania?')) return;
    await _api('DELETE', `/api/hr-medical-exams/${id}`);
    _loadExams(_activeTab === 'psycho' ? 'psycho' : 'periodic');
  }

  function _closeModal() {
    const m = document.getElementById('hr-modal');
    if (m) m.style.display = 'none';
  }

  window.HrModule = {
    renderHrModule,
    _switchTab,
    _loadLeaves,
    _loadExams,
    _openLeaveModal,
    _saveLeave,
    _approveLeave,
    _deleteLeave,
    _recalcDays,
    _openExamModal,
    _saveExam,
    _deleteExam,
    _closeModal,
  };
})();
