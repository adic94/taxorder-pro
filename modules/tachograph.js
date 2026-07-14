(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.() || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const SEVERITY = {
    most_serious: { label: 'Bardzo poważne', color: '#7c0000', bg: '#fde8e8' },
    very_serious:  { label: 'Bardzo poważne', color: '#b91c1c', bg: '#fee2e2' },
    serious:       { label: 'Poważne',        color: '#b45309', bg: '#fef3c7' },
    minor:         { label: 'Nieznaczne',     color: '#0369a1', bg: '#e0f2fe' },
  };
  const ACTIVITY_COLOR = {
    driving:      { bg: '#dc2626', label: 'Jazda' },
    work:         { bg: '#d97706', label: 'Praca' },
    availability: { bg: '#2563eb', label: 'Dyspozycja' },
    rest:         { bg: '#16a34a', label: 'Odpoczynek' },
  };

  let _activeTab = 'dashboard';
  let _filesData = [];
  let _statsData = {};
  let _calData   = [];
  let _violData  = [];
  let _driversData = [];
  let _vehiclesData = [];
  let _uploadResults = [];
  let _selectedFileId = null;
  let _driverFilter = '';

  // ── utils ──────────────────────────────────────────────────────────────────

  function _api(path, opts) {
    const url = `${API()}/api/tacho-ddd/${path}?company=${encodeURIComponent(Co())}`;
    return fetch(url, { headers: H(), ...opts });
  }

  function _fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d + 'T00:00:00Z').toLocaleDateString('pl-PL'); } catch { return d; }
  }

  function _fmtMin(min) {
    if (!min && min !== 0) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  function _driverName(row) {
    const s = [row.driver_surname, row.driver_firstname].filter(Boolean).join(' ');
    return s || row.card_number || '—';
  }

  function _sevChip(sev) {
    const sv = SEVERITY[sev] || SEVERITY.minor;
    return `<span style="background:${sv.bg};color:${sv.color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${e(sv.label)}</span>`;
  }

  // ── główny render ──────────────────────────────────────────────────────────

  async function renderTachograph() {
    const el = document.getElementById('page-tachograph');
    if (!el) return;
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">
      <i class="ti ti-loader" style="font-size:32px"></i><br>Ładowanie danych tachografu...</div>`;
    await _loadAll();
    _renderMain();
  }

  async function _loadAll() {
    try {
      const [sR, fR, cR, dR, vhR] = await Promise.all([
        _api('stats'), _api('files'), _api('calendar'), _api('drivers'), _api('vehicles')
      ]);
      if (sR.ok) _statsData    = await sR.json();
      if (fR.ok) _filesData    = await fR.json();
      if (cR.ok) _calData      = await cR.json();
      if (dR.ok) _driversData  = await dR.json();
      if (vhR.ok) _vehiclesData = await vhR.json();
    } catch {}
    try {
      const vR = await _api('violations');
      if (vR.ok) _violData = await vR.json();
    } catch {}
  }

  function _renderMain() {
    const el = document.getElementById('page-tachograph');
    if (!el) return;
    el.innerHTML = `
<style>
.tach-tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap}
.tach-tab{padding:8px 16px;border:none;border-radius:8px;background:var(--bg2);color:var(--text2);cursor:pointer;font-size:13px;font-weight:500;transition:.15s}
.tach-tab.active,.tach-tab:hover{background:var(--blue);color:#fff}
.tach-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px}
.tach-stat{background:var(--bg2);border-radius:10px;padding:16px;text-align:center}
.tach-stat-val{font-size:28px;font-weight:700;color:var(--text)}
.tach-stat-lbl{font-size:12px;color:var(--text3);margin-top:4px}
.tach-upload-zone{border:2px dashed var(--border);border-radius:12px;padding:48px;text-align:center;cursor:pointer;transition:.2s;background:var(--bg2)}
.tach-upload-zone.drag{border-color:var(--blue);background:var(--blue-light,#eff6ff)}
.tach-upload-zone:hover{border-color:var(--blue)}
.tach-table{width:100%;border-collapse:collapse;font-size:13px}
.tach-table th{text-align:left;padding:8px 10px;background:var(--bg2);color:var(--text3);font-weight:600;border-bottom:2px solid var(--border)}
.tach-table td{padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
.tach-table tr:hover td{background:var(--bg2)}
.tach-act-bar{display:flex;height:18px;border-radius:4px;overflow:hidden;min-width:120px}
.tach-overdue{background:#fef2f2;border-left:4px solid #dc2626;padding:10px 14px;border-radius:4px;font-size:13px;margin-bottom:8px}
.tach-ok{background:#f0fdf4;border-left:4px solid #16a34a;padding:10px 14px;border-radius:4px;font-size:13px;margin-bottom:8px}
.tach-upload-item{display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg2);border-radius:8px;margin-bottom:8px;font-size:13px}
.tach-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:flex;align-items:flex-start;justify-content:center;padding-top:40px;overflow-y:auto}
.tach-modal{background:var(--bg);border-radius:14px;width:90%;max-width:860px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,.2)}
.day-acts{display:flex;flex-direction:column;gap:2px;margin:4px 0}
.day-row{display:flex;align-items:center;gap:8px;font-size:12px}
.day-label{width:80px;color:var(--text3)}
.day-bar-wrap{flex:1;height:16px;background:var(--bg2);border-radius:4px;overflow:hidden;display:flex}
.bar-seg{height:100%;transition:.2s}
</style>

<div class="page-header">
  <h2><i class="ti ti-device-tablet-search"></i> Tachografy — analiza czasu pracy (EU 561/2006)</h2>
</div>

<div class="tach-tabs">
  ${['dashboard','upload','files','drivers','vehicles','violations','calendar'].map(t => {
    const labels = {dashboard:'Dashboard',upload:'Wczytaj DDD',files:'Pliki',drivers:'Kierowcy',vehicles:'Pojazdy',violations:'Naruszenia',calendar:'Kalendarz'};
    const icons  = {dashboard:'ti-dashboard',upload:'ti-upload',files:'ti-folder',drivers:'ti-id-badge',vehicles:'ti-truck',violations:'ti-alert-triangle',calendar:'ti-calendar-week'};
    return `<button class="tach-tab${_activeTab===t?' active':''}" onclick="window.TachographModule._setTab('${t}')">
      <i class="ti ${icons[t]}"></i> ${labels[t]}
    </button>`;
  }).join('')}
</div>

<div id="tach-content">${_renderTab(_activeTab)}</div>
    `;
    _bindUpload();
  }

  function _setTab(tab) {
    _activeTab = tab;
    const el = document.getElementById('tach-content');
    if (el) el.innerHTML = _renderTab(tab);
    document.querySelectorAll('.tach-tab').forEach(b => {
      const map = {dashboard:'dash',upload:'wczyt',files:'plik',drivers:'kierow',vehicles:'pojaz',violations:'narus',calendar:'kalen'};
      b.classList.toggle('active', b.textContent.trim().toLowerCase().includes(map[tab] || tab));
    });
    if (tab === 'upload') _bindUpload();
  }

  function _renderTab(tab) {
    if (tab === 'dashboard')  return _renderDashboard();
    if (tab === 'upload')     return _renderUpload();
    if (tab === 'files')      return _renderFiles();
    if (tab === 'drivers')    return _renderDrivers();
    if (tab === 'vehicles')   return _renderVehicles();
    if (tab === 'violations') return _renderViolations();
    if (tab === 'calendar')   return _renderCalendar();
    return '';
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────

  function _renderDashboard() {
    const st = _statsData;
    const overdue = _calData.filter(r => r.overdue);
    const recentViols = _violData.slice(0, 8);

    return `
<div class="tach-stat-grid">
  <div class="tach-stat"><div class="tach-stat-val">${e(st.drivers ?? 0)}</div><div class="tach-stat-lbl"><i class="ti ti-id-badge"></i> Kierowcy z danymi</div></div>
  <div class="tach-stat"><div class="tach-stat-val">${e(st.files ?? 0)}</div><div class="tach-stat-lbl"><i class="ti ti-file"></i> Wczytane pliki DDD</div></div>
  <div class="tach-stat"><div class="tach-stat-val" style="color:${(st.violations_this_month ?? 0) > 0 ? '#dc2626' : 'inherit'}">${e(st.violations_this_month ?? 0)}</div><div class="tach-stat-lbl"><i class="ti ti-alert-triangle"></i> Naruszenia ten miesiąc</div></div>
  <div class="tach-stat"><div class="tach-stat-val" style="color:${overdue.length > 0 ? '#dc2626' : '#16a34a'}">${e(overdue.length)}</div><div class="tach-stat-lbl"><i class="ti ti-clock-exclamation"></i> Przeterminowane (&gt;28 dni)</div></div>
</div>

${overdue.length > 0 ? `
<div style="margin-bottom:20px">
  <h3 style="font-size:14px;margin-bottom:10px;color:#dc2626"><i class="ti ti-alert-triangle"></i> Kierowcy bez aktualnych danych (&gt;28 dni)</h3>
  ${overdue.map(r => `
  <div class="tach-overdue">
    <strong>${e(_driverName(r))}</strong>
    ${r.card_number ? `<span style="color:var(--text3);margin-left:8px;font-size:12px">Karta: ${e(r.card_number)}</span>` : ''}
    — ostatnie dane: <strong>${_fmtDate(r.last_data)}</strong>
    (<strong style="color:#dc2626">${e(r.days_since_last)} dni temu</strong>)
    — wymagane pobranie danych z karty kierowcy
  </div>`).join('')}
</div>` : `<div class="tach-ok" style="margin-bottom:20px"><i class="ti ti-check"></i> Wszyscy kierowcy mają aktualne dane (≤28 dni)</div>`}

<h3 style="font-size:14px;margin-bottom:10px"><i class="ti ti-alert"></i> Ostatnie naruszenia</h3>
${recentViols.length === 0 ? '<p style="color:var(--text3)">Brak naruszeń</p>' : `
<table class="tach-table">
  <thead><tr><th>Data</th><th>Kierowca</th><th>Naruszenie</th><th>Powaga</th><th>Podstawa</th></tr></thead>
  <tbody>
    ${recentViols.map(v => `<tr>
      <td>${_fmtDate(v.violation_date)}</td>
      <td>${e(_driverName(v))}</td>
      <td>${e(v.description || v.violation_type)}</td>
      <td>${_sevChip(v.severity)}</td>
      <td style="font-size:11px;color:var(--text3)">${e(v.regulation || '—')}</td>
    </tr>`).join('')}
  </tbody>
</table>`}

<div style="margin-top:20px;padding:14px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <strong>Jak korzystać:</strong> Przejdź do zakładki <em>Wczytaj DDD</em>, przeciągnij pliki .DDD z karty kierowcy lub jednostki pokładowej.
  System automatycznie wykrywa dane kierowcy, analizuje aktywności i sprawdza naruszenia EU 561/2006.
  Pliki DDD pobierasz ze swojego czytnika kart (np. CDS, DigiScan, Optac) lub z oprogramowania pojazdu.
</div>
    `;
  }

  // ── UPLOAD ────────────────────────────────────────────────────────────────

  function _renderUpload() {
    const items = _uploadResults.map(r => `
      <div class="tach-upload-item">
        <i class="ti ${r.ok ? 'ti-check' : 'ti-x'}" style="color:${r.ok ? '#16a34a' : '#dc2626'};font-size:18px;flex-shrink:0"></i>
        <div style="flex:1">
          <div style="font-weight:600">${e(r.file)}</div>
          ${r.ok ? `
            <div style="font-size:12px;color:var(--text3)">
              Kierowca: <strong>${r.driver ? e(r.driver.surname + ' ' + (r.driver.firstName||'')) : '?'}</strong>
              · Dni: <strong>${r.days}</strong>
              · Naruszenia: <strong style="color:${r.violations>0?'#dc2626':'inherit'}">${r.violations}</strong>
              ${r.driverLinked ? `· <span style="color:#16a34a"><i class="ti ti-check"></i> Powiązano z kierowcą</span>` : ''}
              ${r.vehicleLinked ? `· <span style="color:#16a34a"><i class="ti ti-check"></i> Powiązano z pojazdem</span>` : ''}
              ${r.parseErrors?.length ? `· <span style="color:#b45309">Ostrzeżenia parsera: ${e(r.parseErrors.join(', '))}</span>` : ''}
            </div>` : `<div style="font-size:12px;color:#dc2626">${e(r.error || 'Błąd')}</div>`}
        </div>
        ${r.ok ? `<button class="btn btn-sm" onclick="window.TachographModule._showFile('${e(r.id)}')">Podgląd</button>` : ''}
      </div>`).join('');

    return `
<div style="max-width:700px">
  <div class="tach-upload-zone" id="tach-drop-zone" onclick="document.getElementById('tach-file-input').click()">
    <i class="ti ti-cloud-upload" style="font-size:48px;color:var(--blue);margin-bottom:12px"></i>
    <p style="font-size:16px;font-weight:600;margin:0 0 6px">Przeciągnij pliki DDD tutaj</p>
    <p style="color:var(--text3);margin:0;font-size:13px">lub kliknij aby wybrać pliki</p>
    <p style="color:var(--text3);margin:6px 0 0;font-size:12px">Obsługiwane formaty: .DDD (karta kierowcy i jednostka pojazdu)</p>
  </div>
  <input type="file" id="tach-file-input" multiple accept=".ddd,.DDD" style="display:none">

  ${_uploadResults.length > 0 ? `
  <div style="margin-top:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 style="font-size:14px;margin:0">Wyniki importu</h3>
      <button class="btn btn-sm" onclick="window.TachographModule._clearResults()">Wyczyść</button>
    </div>
    ${items}
  </div>` : ''}

  <div style="margin-top:24px;padding:14px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
    <strong><i class="ti ti-info-circle"></i> Jak pobrać pliki DDD?</strong><br>
    1. <strong>Karta kierowcy:</strong> włóż kartę do czytnika USB (np. ACS ACR38, Towitoko, SCM) i użyj programu DigiScan, CDS lub Optac do pobrania pliku DDD.<br>
    2. <strong>Jednostka pokładowa (VU):</strong> połącz kablem z tachografem pojazdu (VDO, Stoneridge, Actia) lub użyj zdalnego pobierania (DTCO Remote, Webfleet).<br>
    3. Pliki możesz też pobrać z platform telematycznych jeśli masz skonfigurowaną integrację (zakładka <em>Integracje</em>).<br>
    4. Prawny wymóg: dane muszą być pobierane minimum co 28 dni (karta kierowcy) i co 90 dni (tachograf).
  </div>
</div>
    `;
  }

  function _bindUpload() {
    setTimeout(() => {
      const zone  = document.getElementById('tach-drop-zone');
      const input = document.getElementById('tach-file-input');
      if (!zone || !input) return;

      zone.addEventListener('dragover', ev => { ev.preventDefault(); zone.classList.add('drag'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
      zone.addEventListener('drop', ev => {
        ev.preventDefault(); zone.classList.remove('drag');
        _uploadFiles([...ev.dataTransfer.files]);
      });
      input.addEventListener('change', () => { _uploadFiles([...input.files]); input.value = ''; });
    }, 100);
  }

  async function _uploadFiles(files) {
    if (!files.length) return;
    const ddd = files.filter(f => f.name.toUpperCase().endsWith('.DDD'));
    if (!ddd.length) { alert('Wybierz pliki w formacie .DDD'); return; }

    const zone = document.getElementById('tach-drop-zone');
    if (zone) zone.innerHTML = `<i class="ti ti-loader" style="font-size:32px;color:var(--blue)"></i><br><br>Przesyłanie i analizowanie ${ddd.length} pliku(ów)...`;

    const fd = new FormData();
    ddd.forEach(f => fd.append('file', f));

    try {
      const r = await fetch(`${API()}/api/tacho-ddd/upload?company=${encodeURIComponent(Co())}`,
        { method: 'POST', headers: H(), body: fd });
      const data = await r.json();
      _uploadResults = data.results || [];
    } catch (ex) {
      _uploadResults = [{ file: 'upload', ok: false, error: ex.message }];
    }

    await _loadAll();
    _setTab('upload');
  }

  function _clearResults() {
    _uploadResults = [];
    _setTab('upload');
  }

  // ── PLIKI ─────────────────────────────────────────────────────────────────

  function _renderFiles() {
    if (!_filesData.length) return '<p style="color:var(--text3);padding:20px">Brak wczytanych plików DDD. Przejdź do zakładki <em>Wczytaj DDD</em> aby dodać pierwsze pliki.</p>';

    return `
<div style="display:flex;justify-content:flex-end;margin-bottom:12px">
  <button class="btn" onclick="window.TachographModule._setTab('upload')"><i class="ti ti-upload"></i> Wczytaj DDD</button>
</div>
<table class="tach-table">
  <thead>
    <tr>
      <th>Kierowca / Nr karty</th>
      <th>Typ</th>
      <th>Okres</th>
      <th>Dni</th>
      <th style="color:#dc2626">Naruszenia</th>
      <th>Status</th>
      <th>Wczytano</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    ${_filesData.map(f => {
      const statusColor = f.parse_status === 'ok' ? '#16a34a' : f.parse_status === 'partial' ? '#b45309' : '#dc2626';
      const statusLabel = { ok: 'OK', partial: 'Częściowy', error: 'Błąd', pending: 'Oczekuje' }[f.parse_status] || f.parse_status;
      const uploadDate  = f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString('pl-PL') : '—';
      return `<tr>
        <td>
          <strong>${e([f.driver_surname, f.driver_firstname].filter(Boolean).join(' ') || '—')}</strong>
          ${f.card_number ? `<br><span style="font-size:11px;color:var(--text3)">Karta: ${e(f.card_number)}</span>` : ''}
          <br><span style="font-size:11px;color:var(--text3)">${e(f.file_name)}</span>
        </td>
        <td><span style="font-size:11px;background:var(--bg2);padding:2px 6px;border-radius:4px">${f.file_type === 'card' ? 'Karta kier.' : f.file_type === 'vu' ? 'Jedn. poj.' : e(f.file_type)}</span></td>
        <td style="font-size:12px">${_fmtDate(f.period_start)}<br>${_fmtDate(f.period_end)}</td>
        <td style="text-align:center">${e(f.activities_count ?? '—')}</td>
        <td style="text-align:center">
          ${f.violations_count > 0
            ? `<span style="color:#dc2626;font-weight:700;font-size:15px">${e(f.violations_count)}</span>`
            : `<span style="color:#16a34a">0</span>`}
        </td>
        <td><span style="color:${statusColor};font-weight:600;font-size:12px">${statusLabel}</span></td>
        <td style="font-size:12px;color:var(--text3)">${uploadDate}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm" onclick="window.TachographModule._showFile('${e(f.id)}')"><i class="ti ti-eye"></i></button>
          <button class="btn btn-sm" style="color:#dc2626;margin-left:4px"
            data-fid="${e(f.id)}" data-fname="${e(f.file_name)}" onclick="window.TachographModule._delFile(this.dataset.fid,this.dataset.fname)">
            <i class="ti ti-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join('')}
  </tbody>
</table>`;
  }

  // ── KIEROWCY ──────────────────────────────────────────────────────────────

  function _renderDrivers() {
    if (!_driversData.length) return `
<p style="color:var(--text3);padding:20px">Brak danych o kierowcach.
  Wczytaj pliki DDD z kart kierowców aby zobaczyć archiwum per kierowca.</p>`;

    return `
<h3 style="font-size:14px;margin:0 0 14px"><i class="ti ti-id-badge"></i> Archiwum kart kierowców (${_driversData.length})</h3>
<table class="tach-table">
  <thead>
    <tr>
      <th>Kierowca</th>
      <th>Nr karty</th>
      <th>Data ur.</th>
      <th>Ważność karty</th>
      <th style="text-align:center">Pliki</th>
      <th style="text-align:center;color:#dc2626">Naruszenia</th>
      <th>Pierwsze dane</th>
      <th>Ostatnie dane</th>
      <th>Status</th>
      <th>Powiązanie</th>
    </tr>
  </thead>
  <tbody>
    ${_driversData.map(d => {
      const name       = _driverName(d);
      const daysSince  = d.days_since_last ?? 999;
      const overdue    = daysSince > 28;
      const statusColor = overdue ? '#dc2626' : '#16a34a';
      const statusLabel = overdue
        ? `Przeterminowane (${daysSince > 900 ? 'brak danych' : daysSince + ' dni temu'})`
        : `OK (${daysSince} dni temu)`;
      const driverKey = encodeURIComponent((d.driver_surname||'') + '|' + (d.driver_firstname||''));

      return `<tr>
        <td>
          <strong style="cursor:pointer;color:var(--blue)" onclick="window.TachographModule._showDriverFiles('${e(driverKey)}','${e(name)}')">${e(name)}</strong>
          <br><span style="font-size:11px;color:var(--text3)">${e(d.driver_birth_date ? 'Ur. ' + _fmtDate(d.driver_birth_date) : '')}</span>
        </td>
        <td style="font-size:12px;font-family:monospace">${e(d.card_number || '—')}</td>
        <td style="font-size:12px">${_fmtDate(d.driver_birth_date)}</td>
        <td style="font-size:12px">${d.card_expiry ? `<span style="color:${new Date(d.card_expiry) < new Date() ? '#dc2626' : 'inherit'}">${_fmtDate(d.card_expiry)}</span>` : '—'}</td>
        <td style="text-align:center">
          <span style="background:var(--bg2);padding:2px 8px;border-radius:10px;font-weight:600">${e(d.file_count)}</span>
        </td>
        <td style="text-align:center">
          ${(d.total_violations ?? 0) > 0
            ? `<span style="color:#dc2626;font-weight:700">${e(d.total_violations)}</span>`
            : `<span style="color:#16a34a">0</span>`}
        </td>
        <td style="font-size:12px">${_fmtDate(d.first_data)}</td>
        <td style="font-size:12px;font-weight:600;color:${statusColor}">${_fmtDate(d.last_data)}</td>
        <td>
          <span style="font-size:11px;color:${statusColor};font-weight:600">${statusLabel}</span>
        </td>
        <td>
          ${d.driver_id
            ? `<span style="color:#16a34a;font-size:11px"><i class="ti ti-check"></i> Powiązano</span>`
            : `<span style="color:var(--text3);font-size:11px"><i class="ti ti-unlink"></i> Brak powiązania</span>`}
        </td>
      </tr>`;
    }).join('')}
  </tbody>
</table>

<div style="margin-top:14px;padding:12px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <i class="ti ti-info-circle"></i>
  <strong>Powiązanie z kartoteką:</strong> System automatycznie dopasowuje kierowców z DDD do kartoteki kierowców po nazwisku.
  Jeśli brak powiązania, sprawdź czy nazwisko kierowcy w DDD zgadza się z wpisanym w zakładce Kierowcy.
</div>`;
  }

  async function _showDriverFiles(driverKey, name) {
    _showModal(`<div style="padding:20px;text-align:center"><i class="ti ti-loader" style="font-size:28px"></i><br>Ładowanie...</div>`);
    try {
      const r = await fetch(
        `${API()}/api/tacho-ddd/driver-files/${driverKey}?company=${encodeURIComponent(Co())}`,
        { headers: H() }
      );
      const files = r.ok ? await r.json() : [];
      _showModal(`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h2 style="margin:0;font-size:18px"><i class="ti ti-id-badge"></i> ${e(name)} — historia plików DDD</h2>
  <button onclick="window.TachographModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer">✕</button>
</div>
${files.length === 0 ? '<p style="color:var(--text3)">Brak plików</p>' : `
<table class="tach-table">
  <thead><tr><th>Plik</th><th>Okres</th><th>Naruszenia</th><th>Aktywności</th><th>Status</th><th></th></tr></thead>
  <tbody>
    ${files.map(f => `<tr>
      <td style="font-size:12px">${e(f.file_name)}</td>
      <td style="font-size:12px">${_fmtDate(f.period_start)} – ${_fmtDate(f.period_end)}</td>
      <td style="text-align:center">${f.violations_count > 0 ? `<span style="color:#dc2626;font-weight:700">${f.violations_count}</span>` : '0'}</td>
      <td style="text-align:center">${e(f.activities_count ?? '—')}</td>
      <td style="font-size:11px">${f.parse_status === 'ok' ? '<span style="color:#16a34a">OK</span>' : e(f.parse_status)}</td>
      <td><button class="btn btn-sm" onclick="window.TachographModule._closeModal();setTimeout(()=>window.TachographModule._showFile('${e(f.id)}'),50)"><i class="ti ti-eye"></i></button></td>
    </tr>`).join('')}
  </tbody>
</table>`}`);
    } catch (ex) { _closeModal(); alert('Błąd: ' + ex.message); }
  }

  // ── POJAZDY ────────────────────────────────────────────────────────────────

  function _renderVehicles() {
    if (!_vehiclesData.length) return `
<p style="color:var(--text3);padding:20px">Brak danych o pojazdach z tachografów.
  Pojazdy są wykrywane automatycznie z plików DDD (karta kierowcy zawiera listę używanych pojazdów).</p>`;

    return `
<h3 style="font-size:14px;margin:0 0 14px"><i class="ti ti-truck"></i> Pojazdy w danych tachografów (${_vehiclesData.length})</h3>
<table class="tach-table">
  <thead>
    <tr>
      <th>Rejestracja</th>
      <th style="text-align:center">Pliki kart</th>
      <th style="text-align:center;color:#dc2626">Naruszenia</th>
      <th>Pierwsze użycie</th>
      <th>Ostatnie użycie</th>
      <th>Powiązanie</th>
    </tr>
  </thead>
  <tbody>
    ${_vehiclesData.map(v => `<tr>
      <td><strong>${e(v.vehicle_reg || '—')}</strong></td>
      <td style="text-align:center">
        <span style="background:var(--bg2);padding:2px 8px;border-radius:10px;font-weight:600">${e(v.file_count ?? 0)}</span>
      </td>
      <td style="text-align:center">
        ${(v.total_violations ?? 0) > 0
          ? `<span style="color:#dc2626;font-weight:700">${e(v.total_violations)}</span>`
          : `<span style="color:#16a34a">0</span>`}
      </td>
      <td style="font-size:12px">${_fmtDate(v.first_use)}</td>
      <td style="font-size:12px">${_fmtDate(v.last_use)}</td>
      <td>
        ${v.vehicle_id
          ? `<span style="color:#16a34a;font-size:11px"><i class="ti ti-check"></i> Powiązano z flotą</span>`
          : `<span style="color:var(--text3);font-size:11px"><i class="ti ti-unlink"></i> Brak w flocie</span>`}
      </td>
    </tr>`).join('')}
  </tbody>
</table>

<div style="margin-top:14px;padding:12px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <i class="ti ti-info-circle"></i>
  Pojazdy są wykrywane z pola <em>Używane pojazdy</em> w kartach kierowców (blok DDD 0x0606).
  Powiązanie z flotą następuje automatycznie po nr rejestracyjnym (musi się zgadzać co do znaku).
</div>`;
  }

  // ── NARUSZENIA ─────────────────────────────────────────────────────────────

  function _renderViolations(severity, dateFrom, dateTo) {
    const sev = severity || '';
    const df  = dateFrom || '';
    const dt  = dateTo || '';

    return `
<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
  <div>
    <label style="font-size:12px;color:var(--text3)">Powaga</label><br>
    <select id="viol-sev" class="sel" style="width:160px" onchange="window.TachographModule._filterViols()">
      <option value="">Wszystkie</option>
      <option value="very_serious" ${sev==='very_serious'?'selected':''}>Bardzo poważne</option>
      <option value="serious" ${sev==='serious'?'selected':''}>Poważne</option>
      <option value="minor" ${sev==='minor'?'selected':''}>Nieznaczne</option>
    </select>
  </div>
  <div>
    <label style="font-size:12px;color:var(--text3)">Od daty</label><br>
    <input type="date" id="viol-df" class="sel" value="${e(df)}" onchange="window.TachographModule._filterViols()">
  </div>
  <div>
    <label style="font-size:12px;color:var(--text3)">Do daty</label><br>
    <input type="date" id="viol-dt" class="sel" value="${e(dt)}" onchange="window.TachographModule._filterViols()">
  </div>
</div>

<div style="display:flex;gap:8px;margin-bottom:16px;font-size:12px">
  ${Object.entries(SEVERITY).filter(([k]) => k !== 'most_serious').map(([k, v]) => {
    const cnt = _violData.filter(x => x.severity === k).length;
    return `<span style="background:${v.bg};color:${v.color};padding:4px 12px;border-radius:12px;font-weight:600">${v.label}: ${cnt}</span>`;
  }).join('')}
</div>

${_violData.length === 0 ? '<p style="color:var(--text3)">Brak naruszeń. Wczytaj pliki DDD aby uruchomić analizę.</p>' : `
<table class="tach-table">
  <thead>
    <tr><th>Data</th><th>Kierowca</th><th>Naruszenie</th><th>Szczegóły</th><th>Powaga</th><th>Podstawa prawna</th></tr>
  </thead>
  <tbody>
    ${_violData.map(v => `<tr>
      <td style="white-space:nowrap">${_fmtDate(v.violation_date)}</td>
      <td>${e([v.driver_surname, v.driver_firstname].filter(Boolean).join(' ') || '—')}</td>
      <td style="font-weight:600;font-size:12px">${e(_violTypeLabel(v.violation_type))}</td>
      <td style="font-size:12px;color:var(--text2)">${e(v.description || '—')}<br>
        ${v.actual_value && v.limit_value ? `<span style="color:var(--text3)">Fakt: ${_fmtMin(v.actual_value)} / Limit: ${_fmtMin(v.limit_value)}</span>` : ''}
      </td>
      <td>${_sevChip(v.severity)}</td>
      <td style="font-size:11px;color:var(--text3)">${e(v.regulation || '—')}</td>
    </tr>`).join('')}
  </tbody>
</table>`}

<div style="margin-top:20px;padding:14px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <strong>Klasyfikacja naruszeń (EU 2016/403):</strong>
  <span style="color:#b91c1c;font-weight:600">Bardzo poważne (B)</span> — przekroczenie limitów o ponad 20% · ograniczenie działalności, zawieszenie
  &nbsp;|&nbsp; <span style="color:#b45309;font-weight:600">Poważne (P)</span> — przekroczenie 10–20%
  &nbsp;|&nbsp; <span style="color:#0369a1;font-weight:600">Nieznaczne (N)</span> — przekroczenie do 10%
</div>`;
  }

  function _violTypeLabel(type) {
    const labels = {
      daily_driving_over_10h:     'Przekroczenie dobowego czasu jazdy > 10h',
      daily_driving_over_9h:      'Przekroczenie dobowego czasu jazdy > 9h',
      continuous_driving_over_4h30: 'Ciągły czas jazdy > 4,5h bez przerwy',
      weekly_driving_over_56h:    'Przekroczenie tygodniowego czasu jazdy > 56h',
    };
    return labels[type] || type;
  }

  async function _filterViols() {
    const sev = document.getElementById('viol-sev')?.value || '';
    const df  = document.getElementById('viol-df')?.value || '';
    const dt  = document.getElementById('viol-dt')?.value || '';
    try {
      let url = `violations`;
      const ps = [];
      if (sev) ps.push('severity=' + encodeURIComponent(sev));
      if (df)  ps.push('date_from=' + df);
      if (dt)  ps.push('date_to=' + dt);
      const qStr = ps.length ? '&' + ps.join('&') : '';
      const r = await fetch(`${API()}/api/tacho-ddd/violations?company=${encodeURIComponent(Co())}${qStr}`, { headers: H() });
      if (r.ok) _violData = await r.json();
    } catch {}
    const el = document.getElementById('tach-content');
    if (el) el.innerHTML = _renderViolations(sev, df, dt);
  }

  // ── KALENDARZ ─────────────────────────────────────────────────────────────

  function _renderCalendar() {
    if (!_calData.length) return '<p style="color:var(--text3);padding:20px">Brak danych. Wczytaj pliki DDD aby zobaczyć kalendarz pokrycia.</p>';

    const today = new Date().toISOString().slice(0, 10);
    const COLS  = 28; // ostatnie 28 dni

    const days = [];
    for (let i = COLS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    return `
<div style="font-size:12px;color:var(--text3);margin-bottom:12px">
  Zielony = dane dostępne · Czerwony = brak danych w tym dniu · Szary = przed pierwszym plikiem
  &nbsp;·&nbsp; Wymóg prawny: pobieranie co 28 dni
</div>
<div style="overflow-x:auto">
<table style="border-collapse:collapse;font-size:12px">
  <thead>
    <tr>
      <th style="padding:6px 10px;text-align:left;white-space:nowrap;background:var(--bg2)">Kierowca</th>
      <th style="padding:4px 2px;text-align:left;background:var(--bg2)">Ostatnie dane</th>
      <th style="padding:4px 2px;text-align:center;background:var(--bg2)">Dni</th>
      ${days.map(d => {
        const dt = new Date(d + 'T00:00:00Z');
        const label = dt.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
        const isToday = d === today;
        return `<th style="padding:2px 1px;width:22px;text-align:center;font-size:10px;${isToday ? 'color:var(--blue);font-weight:700' : 'color:var(--text3)'}">${label}</th>`;
      }).join('')}
    </tr>
  </thead>
  <tbody>
    ${_calData.map(r => {
      const name    = _driverName(r);
      const lastDate = r.last_data;
      const daysSince = r.days_since_last;
      const rowColor  = r.overdue ? '#b91c1c' : '#16a34a';

      const cells = days.map(day => {
        // Sprawdź czy mamy dane dla tego dnia
        const hasFile = _filesData.some(f => {
          const driverMatch = f.driver_surname === r.driver_surname && f.driver_firstname === r.driver_firstname;
          return driverMatch && f.period_start && f.period_end && day >= f.period_start && day <= f.period_end;
        });
        const beforeFirst = r.first_data && day < r.first_data;
        const bg = beforeFirst ? 'var(--bg2)' : (hasFile ? '#bbf7d0' : '#fecaca');
        return `<td style="width:22px;height:22px;background:${bg};border:1px solid var(--border);border-radius:3px"></td>`;
      }).join('');

      return `<tr>
        <td style="padding:4px 10px;white-space:nowrap;font-weight:600">${e(name)}</td>
        <td style="padding:4px 6px;white-space:nowrap;color:${rowColor};font-weight:600">${_fmtDate(lastDate)}</td>
        <td style="padding:4px 6px;text-align:center;color:${rowColor};font-weight:700">${daysSince === 999 ? '—' : e(daysSince)}</td>
        ${cells}
      </tr>`;
    }).join('')}
  </tbody>
</table>
</div>

<div style="display:flex;gap:12px;margin-top:12px;font-size:12px">
  <span><span style="display:inline-block;width:14px;height:14px;background:#bbf7d0;border-radius:2px;vertical-align:middle"></span> Dane dostępne</span>
  <span><span style="display:inline-block;width:14px;height:14px;background:#fecaca;border-radius:2px;vertical-align:middle"></span> Brak danych</span>
  <span><span style="display:inline-block;width:14px;height:14px;background:var(--bg2);border-radius:2px;vertical-align:middle"></span> Przed pierwszym plikiem</span>
</div>`;
  }

  // ── MODAL SZCZEGÓŁÓW PLIKU ─────────────────────────────────────────────────

  async function _showFile(fileId) {
    _selectedFileId = fileId;
    _showModal('<div style="padding:32px;text-align:center"><i class="ti ti-loader" style="font-size:32px"></i></div>');
    try {
      const r = await _api(`files/${fileId}`);
      if (!r.ok) { _closeModal(); alert('Błąd pobierania danych'); return; }
      const data = await r.json();
      _renderFileModal(data);
    } catch (ex) { _closeModal(); alert('Błąd: ' + ex.message); }
  }

  function _renderFileModal(f) {
    const name = [f.driver_surname, f.driver_firstname].filter(Boolean).join(' ') || '—';

    // Grupowanie aktywności po dacie
    const byDate = {};
    for (const a of f.activities || []) {
      if (!byDate[a.activity_date]) byDate[a.activity_date] = [];
      byDate[a.activity_date].push(a);
    }

    const activityBars = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, acts]) => {
      const segs = acts.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(a => {
        const pct = ((a.duration_min ?? 0) / 1440 * 100).toFixed(1);
        const col = ACTIVITY_COLOR[a.activity_type]?.bg || '#666';
        const lbl = `${a.activity_type} ${a.start_time}-${a.end_time} (${_fmtMin(a.duration_min)})`;
        return `<div class="bar-seg" style="width:${pct}%;background:${col}" title="${e(lbl)}"></div>`;
      }).join('');

      const totals = {};
      for (const a of acts) {
        totals[a.activity_type] = (totals[a.activity_type] || 0) + (a.duration_min ?? 0);
      }
      const summary = Object.entries(totals).map(([k, v]) => {
        const c = ACTIVITY_COLOR[k] || { bg: '#666', label: k };
        return `<span style="color:${c.bg};font-size:11px">${c.label}: ${_fmtMin(v)}</span>`;
      }).join(' · ');

      return `<div class="day-row">
        <div class="day-label">${_fmtDate(date)}</div>
        <div class="day-bar-wrap" style="position:relative" title="${e(date)}">${segs}</div>
        <div style="font-size:11px;color:var(--text3);min-width:220px;margin-left:8px">${summary}</div>
      </div>`;
    }).join('');

    const violRows = (f.violations || []).map(v => `<tr>
      <td>${_fmtDate(v.violation_date)}</td>
      <td style="font-size:12px">${e(_violTypeLabel(v.violation_type))}</td>
      <td>${_sevChip(v.severity)}</td>
      <td style="font-size:11px">${e(v.description || '—')}</td>
    </tr>`).join('');

    const vehRows = (f.vehicles || []).map(v => `<tr>
      <td>${e(v.vehicle_reg || '—')}</td>
      <td>${_fmtDate(v.first_use)}</td>
      <td>${_fmtDate(v.last_use)}</td>
    </tr>`).join('');

    _showModal(`
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
  <div>
    <h2 style="margin:0 0 4px;font-size:20px">${e(name)}</h2>
    <div style="font-size:13px;color:var(--text3)">
      Plik: ${e(f.file_name)} · Typ: ${f.file_type === 'card' ? 'Karta kierowcy' : 'Jednostka pojazdu'}
      ${f.card_number ? ` · Karta: ${e(f.card_number)}` : ''}
      ${f.driver_birth_date ? ` · Data ur.: ${_fmtDate(f.driver_birth_date)}` : ''}
    </div>
    <div style="font-size:13px;color:var(--text3);margin-top:4px">
      Okres: ${_fmtDate(f.period_start)} – ${_fmtDate(f.period_end)}
      · Aktywności: ${f.activities_count || 0}
      · Naruszenia: <span style="color:${(f.violations_count||0)>0?'#dc2626':'inherit'};font-weight:700">${f.violations_count || 0}</span>
    </div>
  </div>
  <button onclick="window.TachographModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3)">✕</button>
</div>

${Object.keys(byDate).length > 0 ? `
<h3 style="font-size:14px;margin:0 0 10px">Aktywności dzienne</h3>
<div style="display:flex;gap:12px;margin-bottom:8px;font-size:11px">
  ${Object.entries(ACTIVITY_COLOR).map(([k, v]) => `<span><span style="display:inline-block;width:10px;height:10px;background:${v.bg};border-radius:2px;vertical-align:middle"></span> ${v.label}</span>`).join('')}
</div>
<div class="day-acts">${activityBars}</div>
` : '<p style="color:var(--text3);font-size:13px">Brak sparsowanych aktywności (format nieobsługiwany lub błąd parsowania)</p>'}

${f.violations?.length > 0 ? `
<h3 style="font-size:14px;margin:16px 0 8px;color:#dc2626"><i class="ti ti-alert-triangle"></i> Wykryte naruszenia</h3>
<table class="tach-table"><thead><tr><th>Data</th><th>Naruszenie</th><th>Powaga</th><th>Szczegóły</th></tr></thead>
<tbody>${violRows}</tbody></table>` : ''}

${f.vehicles?.length > 0 ? `
<h3 style="font-size:14px;margin:16px 0 8px"><i class="ti ti-truck"></i> Używane pojazdy</h3>
<table class="tach-table"><thead><tr><th>Rejestracja</th><th>Od</th><th>Do</th></tr></thead>
<tbody>${vehRows}</tbody></table>` : ''}

<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);text-align:right">
  <button class="btn btn-sm" style="color:#dc2626" data-fid="${e(f.id)}" data-fname="${e(f.file_name)}"
    onclick="window.TachographModule._delFile(this.dataset.fid,this.dataset.fname);window.TachographModule._closeModal()">
    <i class="ti ti-trash"></i> Usuń plik
  </button>
</div>`);
  }

  async function _delFile(id, name) {
    if (!confirm(`Usunąć plik "${name}" i wszystkie dane?`)) return;
    try {
      const r = await fetch(`${API()}/api/tacho-ddd/files/${encodeURIComponent(id)}?company=${encodeURIComponent(Co())}`,
        { method: 'DELETE', headers: H() });
      if (!r.ok) { alert('Błąd usuwania'); return; }
      await _loadAll();
      _setTab('files');
    } catch (ex) { alert('Błąd: ' + ex.message); }
  }

  // ── MODAL ─────────────────────────────────────────────────────────────────

  function _showModal(html) {
    let overlay = document.getElementById('tach-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tach-modal-overlay';
      overlay.className = 'tach-modal-overlay';
      overlay.addEventListener('click', ev => { if (ev.target === overlay) _closeModal(); });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="tach-modal">${html}</div>`;
    overlay.style.display = 'flex';
  }

  function _closeModal() {
    const o = document.getElementById('tach-modal-overlay');
    if (o) o.style.display = 'none';
  }

  // ── exports ────────────────────────────────────────────────────────────────

  window.TachographModule = {
    renderTachograph, _setTab, _uploadFiles, _clearResults,
    _showFile, _closeModal, _delFile, _filterViols, _showDriverFiles
  };
})();
