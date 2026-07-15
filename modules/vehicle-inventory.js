/**
 * TaxOrder Pro — Moduł Inwentaryzacji Floty
 * Dane persystowane w D1 (tabela fleet_inventory_sessions, schema v38).
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.() || window.currentCompanyId || '';

  // ── In-memory state ────────────────────────────────────────────────────────
  let _active  = null;   // aktywna sesja (null jeśli brak)
  let _history = [];     // ukończone sesje (max 20, malejąco)
  let _noteTimer = null; // debounce timerId

  // ── API helper ─────────────────────────────────────────────────────────────
  async function _api(method, path, body) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API()}${path}${sep}company=${Co()}`;
    const opts = { method, headers: { 'Content-Type': 'application/json', ...H() } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return r.json().catch(() => ({}));
  }

  // Normalizuje rekord z DB (pola JSON jako string) do obiektu roboczego
  function _parse(s) {
    if (!s) return null;
    let cv = s.checked_vehicles;
    let nt = s.notes;
    if (typeof cv === 'string') { try { cv = JSON.parse(cv); } catch { cv = []; } }
    if (typeof nt === 'string') { try { nt = JSON.parse(nt); } catch { nt = {}; } }
    return { ...s, checkedVehicles: cv || [], notes: nt || {} };
  }

  async function _fetchSessions() {
    const data = await _api('GET', '/api/fleet-inventory').catch(() => ({ sessions: [] }));
    const all  = (data.sessions || []).map(_parse);
    _active  = all.find(s => s.status === 'active') || null;
    _history = all.filter(s => s.status === 'completed')
                   .sort((a, b) => (b.session_date || '').localeCompare(a.session_date || ''))
                   .slice(0, 20);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _today() { return new Date().toLocaleDateString('sv'); }

  function _fmtDate(d) {
    if (!d) return '—';
    const p = String(d).split('-');
    return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d;
  }

  function _buildPutBody(s) {
    return {
      session_date:     s.session_date,
      status:           s.status,
      checked_vehicles: s.checkedVehicles ?? [],  // Worker robi JSON.stringify
      notes:            s.notes ?? {},             // Worker robi JSON.stringify
      vehicle_count:    (window.vehs || []).length,
      checked_count:    (s.checkedVehicles ?? []).length,
    };
  }

  // ── Session management ─────────────────────────────────────────────────────
  async function startSession() {
    const res = await _api('POST', '/api/fleet-inventory', {
      session_date:  _today(),
      vehicle_count: (window.vehs || []).length,
    });
    if (res.error) { alert('Błąd: ' + res.error); return; }
    renderVehicleInventory();  // re-fetchuje _active przez _fetchSessions()
  }

  async function cancelSession() {
    if (!_active) return;
    if (!confirm('Anulować aktywną inwentaryzację? Wszystkie dane sesji zostaną utracone.')) return;
    await _api('DELETE', `/api/fleet-inventory/${_active.id}`);
    renderVehicleInventory();
  }

  async function completeSession() {
    if (!_active) return;
    await _api('PUT', `/api/fleet-inventory/${_active.id}/complete`, {});
    window.toast?.('Inwentaryzacja zakończona');
    renderVehicleInventory();
  }

  // ── Per-vehicle actions ────────────────────────────────────────────────────
  async function toggleVehicleCheck(nrRej, checked) {
    if (!_active || _active.status !== 'active') return;
    if (checked) {
      if (!_active.checkedVehicles.includes(nrRej)) _active.checkedVehicles.push(nrRej);
    } else {
      _active.checkedVehicles = _active.checkedVehicles.filter(x => x !== nrRej);
    }
    _updateProgress();
    await _api('PUT', `/api/fleet-inventory/${_active.id}`, _buildPutBody(_active));
  }

  function updateNote(nrRej, field, value) {
    if (!_active || _active.status !== 'active') return;
    if (!_active.notes[nrRej]) _active.notes[nrRej] = {};
    _active.notes[nrRej][field] = value;
    clearTimeout(_noteTimer);
    _noteTimer = setTimeout(async () => {
      await _api('PUT', `/api/fleet-inventory/${_active.id}`, _buildPutBody(_active));
    }, 800);
  }

  function _updateProgress() {
    if (!_active) return;
    const vehs    = window.vehs || [];
    const checked = (_active.checkedVehicles ?? []).length;
    const total   = vehs.length;
    const pct     = total ? Math.round((checked / total) * 100) : 0;

    const bar     = document.getElementById('inv-progress-bar');
    const lbl     = document.getElementById('inv-progress-label');
    const banner  = document.getElementById('inv-banner-count');
    if (bar)    bar.style.width   = pct + '%';
    if (lbl)    lbl.textContent   = `${checked} / ${total} pojazdów (${pct}%)`;
    if (banner) banner.textContent = `${checked} / ${total}`;

    document.querySelectorAll('#inv-checklist-body tr[data-nrrej]').forEach(row => {
      const isChecked = (_active.checkedVehicles ?? []).includes(row.dataset.nrrej);
      row.style.background = isChecked ? 'var(--green-light,#f0fdf4)' : '';
    });
  }

  // ── Print report ───────────────────────────────────────────────────────────
  function printInventoryReport(sessionData) {
    const vehs = window.vehs || [];
    const _e   = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const rows = vehs.map(v => {
      const nr        = v.nrRej ?? '';
      const isChecked = (sessionData.checkedVehicles ?? []).includes(nr);
      const note      = (sessionData.notes ?? {})[nr] ?? {};
      return `<tr class="${isChecked ? 'found' : 'missing'}">
        <td style="text-align:center">${isChecked ? '&#10003;' : '&#10007;'}</td>
        <td>${_e(nr)}</td>
        <td>${_e(v.marka ?? '')} ${_e(v.model ?? '')}</td>
        <td>${_e(v.kierowca ?? '—')}</td>
        <td>${_e(v.oddzial ?? '—')}</td>
        <td>${_e(note.lokalizacja ?? '')}</td>
        <td>${_e(note.uwagi ?? '')}</td>
      </tr>`;
    }).join('');

    const checked = (sessionData.checkedVehicles ?? []).length;
    const html    = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8">
<title>Raport inwentaryzacji ${_e(_fmtDate(sessionData.session_date))}</title>
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
<p>Data: ${_e(_fmtDate(sessionData.session_date))}</p>
<p>Sprawdzono: ${checked} / ${vehs.length} &nbsp;|&nbsp; Brak: ${vehs.length - checked}</p>
<p>Status: ${sessionData.status === 'completed' ? 'Zakończona' : 'Aktywna'}</p>
<table>
<thead><tr><th>Status</th><th>Nr rej.</th><th>Marka / Model</th><th>Kierowca</th>
<th>Oddział</th><th>Lokalizacja</th><th>Uwagi</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin-top:14px;font-size:10px;color:#999">Wygenerowano: ${_e(new Date().toLocaleString('pl-PL'))} | TaxOrder Pro</p>
</body></html>`;

    const win = window.open('', '_blank', 'width=960,height=720');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert('Zablokowane wyskakujące okienko — zezwól w przeglądarce i spróbuj ponownie.');
  }

  function printHistoryReport(id) {
    const s = _history.find(x => x.id === id);
    if (s) printInventoryReport(s);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  async function renderVehicleInventory() {
    const el = document.getElementById('page-vehicle-inventory');
    if (!el) return;

    // Pokaż spinner podczas ładowania
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">
      <i class="ti ti-loader" style="font-size:28px"></i><br>Ładowanie…</div>`;

    await _fetchSessions();

    const vehs     = window.vehs || [];
    const isActive = !!(_active && _active.status === 'active');

    // ── Part A — baner aktywnej sesji ──────────────────────────────────────
    let bannerHtml = '';
    if (isActive) {
      const cnt = (_active.checkedVehicles ?? []).length;
      bannerHtml = `
        <div style="background:var(--blue-light,#eff6ff);border:1px solid var(--blue,#3b82f6);
             border-radius:8px;padding:12px 16px;margin-bottom:16px;
             display:flex;align-items:center;flex-wrap:wrap;gap:12px">
          <i class="ti ti-clipboard-check" style="color:var(--blue,#3b82f6);font-size:20px"></i>
          <strong>Aktywna inwentaryzacja: ${esc(_fmtDate(_active.session_date))}</strong>
          <span style="color:var(--text2,#6b7280)">
            Sprawdzono: <span id="inv-banner-count">${cnt} / ${vehs.length}</span> pojazdów
          </span>
          <div style="margin-left:auto;display:flex;gap:8px">
            <button class="btn btn-green" style="font-size:12px"
              onclick="VehicleInventoryModule.completeSession()">
              <i class="ti ti-check"></i>Zakończ
            </button>
            <button class="btn btn-red" style="font-size:12px"
              onclick="VehicleInventoryModule.cancelSession()">
              <i class="ti ti-x"></i>Anuluj
            </button>
          </div>
        </div>`;
    }

    // ── Part B — przycisk startu ───────────────────────────────────────────
    let startHtml = '';
    if (!isActive) {
      startHtml = `
        <div style="margin-bottom:20px">
          <button class="btn btn-blue" onclick="VehicleInventoryModule.startSession()">
            <i class="ti ti-plus"></i>Rozpocznij inwentaryzację
          </button>
        </div>`;
    }

    // ── Part C — lista kontrolna ───────────────────────────────────────────
    let checklistHtml = '';
    if (isActive) {
      const cnt = (_active.checkedVehicles ?? []).length;
      const pct = vehs.length ? Math.round((cnt / vehs.length) * 100) : 0;

      const rows = vehs.map(v => {
        const nr        = v.nrRej ?? '';
        const isChecked = (_active.checkedVehicles ?? []).includes(nr);
        const note      = (_active.notes ?? {})[nr] ?? {};
        return `<tr data-nrrej="${esc(nr)}"
          style="${isChecked ? 'background:var(--green-light,#f0fdf4)' : ''}">
          <td style="text-align:center">
            <input type="checkbox" ${isChecked ? 'checked' : ''}
              data-nrrej="${esc(nr)}"
              onchange="VehicleInventoryModule.toggleVehicleCheck(this.dataset.nrrej,this.checked)">
          </td>
          <td>
            <a href="#" data-nrrej="${esc(nr)}"
              onclick="event.preventDefault();if(window.showVehicleDetail)showVehicleDetail(this.dataset.nrrej)"
              style="color:var(--blue,#3b82f6);font-weight:500">
              ${esc(nr)}
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
              data-nrrej="${esc(nr)}"
              oninput="VehicleInventoryModule.updateNote(this.dataset.nrrej,'lokalizacja',this.value)">
          </td>
          <td>
            <input type="text" class="form-input"
              style="width:130px;font-size:12px;padding:3px 6px"
              placeholder="Uwagi"
              value="${esc(note.uwagi ?? '')}"
              data-nrrej="${esc(nr)}"
              oninput="VehicleInventoryModule.updateNote(this.dataset.nrrej,'uwagi',this.value)">
          </td>
          <td>
            <button class="btn btn-sm btn-icon" title="Otwórz kartę pojazdu"
              data-nrrej="${esc(nr)}"
              onclick="if(window.showVehicleDetail)showVehicleDetail(this.dataset.nrrej)">
              <i class="ti ti-external-link"></i>
            </button>
          </td>
        </tr>`;
      }).join('');

      checklistHtml = `
        <div class="card" style="margin-bottom:16px;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border,#e5e7eb);
               display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span style="font-weight:600">Lista kontrolna pojazdów</span>
            <span id="inv-progress-label" style="font-size:12px;color:var(--text2,#6b7280)">
              ${cnt} / ${vehs.length} pojazdów (${pct}%)
            </span>
          </div>
          <div style="padding:10px 16px 4px">
            <div style="background:var(--border,#e5e7eb);border-radius:4px;height:8px;overflow:hidden">
              <div id="inv-progress-bar"
                style="height:100%;width:${pct}%;background:var(--blue,#3b82f6);
                       transition:width .3s;border-radius:4px"></div>
            </div>
          </div>
          <div style="overflow-x:auto;padding:8px 16px 16px">
            <table class="data-table" style="font-size:12px;min-width:720px">
              <thead>
                <tr>
                  <th style="width:44px">&#10003;</th>
                  <th>Nr rej.</th><th>Marka / Model</th>
                  <th>Kierowca</th><th>Oddział</th>
                  <th>Lokalizacja</th><th>Uwagi</th>
                  <th style="width:44px"></th>
                </tr>
              </thead>
              <tbody id="inv-checklist-body">${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    // ── Part D — historia ──────────────────────────────────────────────────
    let historyHtml = '';
    const hist = _history.slice(0, 5);
    if (hist.length) {
      const histRows = hist.map(s => {
        const chk  = (s.checkedVehicles ?? []).length;
        const miss = vehs.length - chk;
        return `<tr>
          <td>${esc(_fmtDate(s.session_date))}</td>
          <td>${chk}</td>
          <td>${miss > 0 ? `<span style="color:var(--red,#dc2626)">${miss}</span>` : '0'}</td>
          <td><span class="pill pill-green" style="font-size:11px">Zakończona</span></td>
          <td>
            <button class="btn btn-sm" style="font-size:11px"
              data-sid="${esc(s.id)}"
              onclick="VehicleInventoryModule.printHistoryReport(this.dataset.sid)">
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
