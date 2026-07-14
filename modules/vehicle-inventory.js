/**
 * TaxOrder Pro — Moduł Inwentaryzacji Floty
 * Sesja inwentaryzacyjna, lista kontrolna pojazdów, historia i raport druku.
 * Dane sesji: localStorage 'taxorder_inv_session' / 'taxorder_inv_history'
 */
(function () {
  'use strict';

  const INV_SESSION_KEY = 'taxorder_inv_session';
  const INV_HISTORY_KEY = 'taxorder_inv_history';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _getSession() {
    try { return JSON.parse(localStorage.getItem(INV_SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function _saveSession(session) {
    localStorage.setItem(INV_SESSION_KEY, JSON.stringify(session));
  }

  function _getHistory() {
    try { return JSON.parse(localStorage.getItem(INV_HISTORY_KEY) || '[]'); }
    catch { return []; }
  }

  function _saveHistory(arr) {
    localStorage.setItem(INV_HISTORY_KEY, JSON.stringify(arr));
  }

  function _today() {
    return new Date().toLocaleDateString('sv'); // YYYY-MM-DD
  }

  function _fmtDate(d) {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  // ── Session management ─────────────────────────────────────────────────────
  function startSession() {
    const session = {
      id: 'inv_' + Date.now(),
      date: _today(),
      status: 'active',
      checkedVehicles: [],
      notes: {},
    };
    _saveSession(session);
    renderVehicleInventory();
  }

  function cancelSession() {
    if (!confirm('Anulować aktywną inwentaryzację? Wszystkie dane sesji zostaną utracone.')) return;
    localStorage.removeItem(INV_SESSION_KEY);
    renderVehicleInventory();
  }

  function completeSession() {
    const session = _getSession();
    if (!session) return;
    session.status = 'completed';
    const history = _getHistory();
    history.unshift({ ...session });
    _saveHistory(history.slice(0, 20));
    localStorage.removeItem(INV_SESSION_KEY);
    window.toast?.('Inwentaryzacja zakończona');
    renderVehicleInventory();
  }

  // ── Per-vehicle actions ────────────────────────────────────────────────────
  function toggleVehicleCheck(nrRej, checked) {
    const session = _getSession();
    if (!session || session.status !== 'active') return;
    if (checked) {
      if (!session.checkedVehicles.includes(nrRej)) session.checkedVehicles.push(nrRej);
    } else {
      session.checkedVehicles = session.checkedVehicles.filter(x => x !== nrRej);
    }
    _saveSession(session);
    _updateProgress(session);
  }

  function updateNote(nrRej, field, value) {
    const session = _getSession();
    if (!session || session.status !== 'active') return;
    if (!session.notes[nrRej]) session.notes[nrRej] = {};
    session.notes[nrRej][field] = value;
    _saveSession(session);
  }

  function _updateProgress(session) {
    const vehs = window.vehs || [];
    const checked = (session.checkedVehicles ?? []).length;
    const total = vehs.length;
    const pct = total ? Math.round((checked / total) * 100) : 0;
    const bar = document.getElementById('inv-progress-bar');
    const lbl = document.getElementById('inv-progress-label');
    const bannerCount = document.getElementById('inv-banner-count');
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = `${checked} / ${total} pojazdów (${pct}%)`;
    if (bannerCount) bannerCount.textContent = `${checked} / ${total}`;
    // Update row highlight without full re-render
    document.querySelectorAll('#inv-checklist-body tr[data-nrrej]').forEach(row => {
      const isChecked = (session.checkedVehicles ?? []).includes(row.dataset.nrrej);
      row.style.background = isChecked ? 'var(--green-light,#f0fdf4)' : '';
    });
  }

  // ── Print report (Part E) ─────────────────────────────────────────────────
  function printInventoryReport(sessionData) {
    const vehs = window.vehs || [];
    // Local escape — used to build the new window's HTML safely
    const _e = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const rows = vehs.map(v => {
      const isChecked = (sessionData.checkedVehicles ?? []).includes(v.nrRej);
      const note = (sessionData.notes ?? {})[v.nrRej] ?? {};
      const cls = isChecked ? 'found' : 'missing';
      return `<tr class="${cls}">
        <td style="text-align:center">${isChecked ? '&#10003;' : '&#10007;'}</td>
        <td>${_e(v.nrRej ?? '')}</td>
        <td>${_e(v.marka ?? '')} ${_e(v.model ?? '')}</td>
        <td>${_e(v.kierowca ?? '—')}</td>
        <td>${_e(v.oddzial ?? '—')}</td>
        <td>${_e(note.lokalizacja ?? '')}</td>
        <td>${_e(note.uwagi ?? '')}</td>
      </tr>`;
    }).join('');

    const checkedCount = (sessionData.checkedVehicles ?? []).length;
    const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8">
<title>Raport inwentaryzacji ${_e(_fmtDate(sessionData.date))}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11px;padding:20px;color:#111}
h1{font-size:16px;margin:0 0 4px}p{margin:2px 0;color:#555}
table{width:100%;border-collapse:collapse;margin-top:14px}
th{background:#f0f0f0;font-weight:700;padding:6px;text-align:left;border:1px solid #ccc}
td{padding:5px 6px;border:1px solid #ddd}
tr.found td{color:#065f46}tr.missing td{color:#b91c1c;background:#fef2f2}
@media print{button{display:none}}
</style></head><body>
<h1>Raport inwentaryzacji floty</h1>
<p>Data: ${_e(_fmtDate(sessionData.date))}</p>
<p>Sprawdzono: ${checkedCount} / ${vehs.length} &nbsp;|&nbsp; Brak: ${vehs.length - checkedCount}</p>
<p>Status: ${sessionData.status === 'completed' ? 'Zakończona' : 'Aktywna'}</p>
<table>
<thead><tr><th>Status</th><th>Nr rej.</th><th>Marka / Model</th><th>Kierowca</th><th>Oddział</th><th>Lokalizacja</th><th>Uwagi</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin-top:14px;font-size:10px;color:#999">Wygenerowano: ${_e(new Date().toLocaleString('pl-PL'))}</p>
</body></html>`;

    const win = window.open('', '_blank', 'width=960,height=720');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
  }

  function printHistoryReport(idx) {
    const history = _getHistory();
    if (idx < 0 || idx >= history.length) return;
    printInventoryReport(history[idx]);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function renderVehicleInventory() {
    const el = document.getElementById('page-vehicle-inventory');
    if (!el) return;

    const session = _getSession();
    const vehs = window.vehs || [];
    const isActive = !!(session && session.status === 'active');

    // Part A — active session banner
    let bannerHtml = '';
    if (isActive) {
      const checked = (session.checkedVehicles ?? []).length;
      bannerHtml = `
        <div style="background:var(--blue-light,#eff6ff);border:1px solid var(--blue,#3b82f6);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;flex-wrap:wrap;gap:12px">
          <i class="ti ti-clipboard-check" style="color:var(--blue,#3b82f6);font-size:20px"></i>
          <strong>Aktywna inwentaryzacja: ${esc(_fmtDate(session.date))}</strong>
          <span style="color:var(--text2,#6b7280)">Sprawdzono: <span id="inv-banner-count">${checked} / ${vehs.length}</span> pojazdów</span>
          <div style="margin-left:auto;display:flex;gap:8px">
            <button class="btn btn-green" style="font-size:12px" onclick="VehicleInventoryModule.completeSession()">
              <i class="ti ti-check"></i>Zakończ
            </button>
            <button class="btn btn-red" style="font-size:12px" onclick="VehicleInventoryModule.cancelSession()">
              <i class="ti ti-x"></i>Anuluj
            </button>
          </div>
        </div>`;
    }

    // Part B — start button (when no active session)
    let startHtml = '';
    if (!isActive) {
      startHtml = `
        <div style="margin-bottom:20px">
          <button class="btn btn-blue" onclick="VehicleInventoryModule.startSession()">
            <i class="ti ti-plus"></i>Rozpocznij inwentaryzację
          </button>
        </div>`;
    }

    // Part C — checklist table (only when active)
    let checklistHtml = '';
    if (isActive) {
      const checked = (session.checkedVehicles ?? []).length;
      const pct = vehs.length ? Math.round((checked / vehs.length) * 100) : 0;

      const rows = vehs.map(v => {
        const nrRej = v.nrRej ?? '';
        const isChecked = (session.checkedVehicles ?? []).includes(nrRej);
        const note = (session.notes ?? {})[nrRej] ?? {};
        return `<tr data-nrrej="${esc(nrRej)}" style="${isChecked ? 'background:var(--green-light,#f0fdf4)' : ''}">
          <td style="text-align:center">
            <input type="checkbox" ${isChecked ? 'checked' : ''}
              data-nrrej="${esc(nrRej)}"
              onchange="VehicleInventoryModule.toggleVehicleCheck(this.dataset.nrrej, this.checked)">
          </td>
          <td>
            <a href="#" data-nrrej="${esc(nrRej)}"
              onclick="event.preventDefault();if(window.showVehicleDetail)showVehicleDetail(this.dataset.nrrej)"
              style="color:var(--blue,#3b82f6);font-weight:500">
              ${esc(nrRej)}
            </a>
          </td>
          <td>${esc(v.marka ?? '')} ${esc(v.model ?? '')}</td>
          <td>${esc(v.kierowca ?? '—')}</td>
          <td>${esc(v.oddzial ?? '—')}</td>
          <td>
            <input type="text" class="form-input"
              style="width:110px;font-size:12px;padding:3px 6px"
              placeholder="Lokalizacja"
              value="${esc(note.lokalizacja ?? '')}"
              data-nrrej="${esc(nrRej)}"
              oninput="VehicleInventoryModule.updateNote(this.dataset.nrrej,'lokalizacja',this.value)">
          </td>
          <td>
            <input type="text" class="form-input"
              style="width:130px;font-size:12px;padding:3px 6px"
              placeholder="Uwagi"
              value="${esc(note.uwagi ?? '')}"
              data-nrrej="${esc(nrRej)}"
              oninput="VehicleInventoryModule.updateNote(this.dataset.nrrej,'uwagi',this.value)">
          </td>
          <td>
            <button class="btn btn-sm btn-icon" title="Otwórz kartę pojazdu"
              data-nrrej="${esc(nrRej)}"
              onclick="if(window.showVehicleDetail)showVehicleDetail(this.dataset.nrrej)">
              <i class="ti ti-external-link"></i>
            </button>
          </td>
        </tr>`;
      }).join('');

      checklistHtml = `
        <div class="card" style="margin-bottom:16px;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border,#e5e7eb);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span style="font-weight:600">Lista kontrolna pojazdów</span>
            <span id="inv-progress-label" style="font-size:12px;color:var(--text2,#6b7280)">${checked} / ${vehs.length} pojazdów (${pct}%)</span>
          </div>
          <div style="padding:10px 16px 4px">
            <div style="background:var(--border,#e5e7eb);border-radius:4px;height:8px;overflow:hidden">
              <div id="inv-progress-bar"
                style="height:100%;width:${pct}%;background:var(--blue,#3b82f6);transition:width .3s;border-radius:4px"></div>
            </div>
          </div>
          <div style="overflow-x:auto;padding:8px 16px 16px">
            <table class="data-table" style="font-size:12px;min-width:720px">
              <thead>
                <tr>
                  <th style="width:44px">&#10003;</th>
                  <th>Nr rej.</th>
                  <th>Marka / Model</th>
                  <th>Kierowca</th>
                  <th>Oddział</th>
                  <th>Lokalizacja</th>
                  <th>Uwagi</th>
                  <th style="width:44px"></th>
                </tr>
              </thead>
              <tbody id="inv-checklist-body">${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    // Part D — history (last 5 completed sessions)
    let historyHtml = '';
    const history = _getHistory().slice(0, 5);
    if (history.length) {
      const histRows = history.map((s, idx) => {
        const chk = (s.checkedVehicles ?? []).length;
        const miss = vehs.length - chk;
        return `<tr>
          <td>${esc(_fmtDate(s.date))}</td>
          <td>${chk}</td>
          <td>${miss > 0 ? `<span style="color:var(--red,#dc2626)">${miss}</span>` : '0'}</td>
          <td><span class="pill pill-green" style="font-size:11px">Zakończona</span></td>
          <td>
            <button class="btn btn-sm" style="font-size:11px"
              data-hidx="${idx}"
              onclick="VehicleInventoryModule.printHistoryReport(parseInt(this.dataset.hidx))">
              <i class="ti ti-printer"></i>Raport
            </button>
          </td>
        </tr>`;
      }).join('');

      historyHtml = `
        <div class="card" style="overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border,#e5e7eb)">
            <span style="font-weight:600">Historia inwentaryzacji (ostatnie 5)</span>
          </div>
          <div style="overflow-x:auto">
            <table class="data-table" style="font-size:13px">
              <thead>
                <tr><th>Data</th><th>Sprawdzono</th><th>Brak</th><th>Status</th><th>Akcja</th></tr>
              </thead>
              <tbody>${histRows}</tbody>
            </table>
          </div>
        </div>`;
    }

    el.innerHTML = `
      <div style="padding:20px;max-width:1400px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <i class="ti ti-clipboard-list" style="font-size:24px;color:var(--blue,#3b82f6)"></i>
          <h2 style="margin:0;font-size:20px;font-weight:700">Inwentaryzacja floty</h2>
        </div>
        ${bannerHtml}
        ${startHtml}
        ${checklistHtml}
        ${historyHtml}
      </div>`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.VehicleInventoryModule = {
    renderVehicleInventory,
    startSession,
    cancelSession,
    completeSession,
    toggleVehicleCheck,
    updateNote,
    printInventoryReport,
    printHistoryReport,
  };
})();
