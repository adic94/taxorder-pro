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
  let _trendData = [];
  let _uploadResults = [];
  let _selectedFileId = null;
  const _driverFilter = '';
  let _driversList = []; // kierowcy z kartoteki do powiązania

  // ── utils ──────────────────────────────────────────────────────────────────

  function _api(path, opts) {
    const url = `${API()}/api/tacho-ddd/${path}${path.includes('?')?'&':'?'}company=${encodeURIComponent(Co())}`;
    return fetch(url, { headers: H(), ...opts });
  }

  function _fmtDate(d) {
    if (!d) return '—';
    try { return new Date(`${d  }T00:00:00Z`).toLocaleDateString('pl-PL'); } catch { return d; }
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
      const [sR, fR, cR, dR, vhR, tR] = await Promise.all([
        _api('stats'), _api('files'), _api('calendar'), _api('drivers'), _api('vehicles'), _api('trend?months=6')
      ]);
      if (sR.ok)  _statsData    = await sR.json();
      if (fR.ok)  _filesData    = await fR.json();
      if (cR.ok)  _calData      = await cR.json();
      if (dR.ok)  _driversData  = await dR.json();
      if (vhR.ok) _vehiclesData = await vhR.json();
      if (tR.ok)  _trendData    = await tR.json();
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
.tach-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9200;display:flex;align-items:flex-start;justify-content:center;padding-top:40px;overflow-y:auto}
.tach-modal{background:var(--bg);border-radius:14px;width:90%;max-width:900px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,.2)}
.day-acts{display:flex;flex-direction:column;gap:2px;margin:4px 0}
.day-row{display:flex;align-items:center;gap:8px;font-size:12px}
.day-label{width:80px;color:var(--text3)}
.day-bar-wrap{flex:1;height:16px;background:var(--bg2);border-radius:4px;overflow:hidden;display:flex}
.bar-seg{height:100%;transition:.2s}
.tach-trend-bar{display:inline-block;background:var(--blue);border-radius:3px 3px 0 0;min-height:2px;transition:.3s}
.tach-comparison-col{background:var(--bg2);border-radius:10px;padding:16px;flex:1}
</style>

<div class="page-header">
  <h2><i class="ti ti-device-tablet-search"></i> Tachografy — analiza czasu pracy (EU 561/2006)</h2>
</div>

<div class="tach-tabs">
  ${['dashboard','upload','files','drivers','vehicles','violations','calendar','trend','comparison','compliance','remote'].map(t => {
    const labels = {dashboard:'Dashboard',upload:'Wczytaj DDD',files:'Pliki',drivers:'Kierowcy',vehicles:'Pojazdy',violations:'Naruszenia',calendar:'Kalendarz',trend:'Trend',comparison:'Porównanie',compliance:'Zgodność',remote:'Zdalny pobór'};
    const icons  = {dashboard:'ti-dashboard',upload:'ti-upload',files:'ti-folder',drivers:'ti-id-badge',vehicles:'ti-truck',violations:'ti-alert-triangle',calendar:'ti-calendar-week',trend:'ti-chart-bar',comparison:'ti-chart-arcs',compliance:'ti-shield-check',remote:'ti-cloud-download'};
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
    if (tab === 'remote') _loadFlespiStatus();
  }

  function _renderTab(tab) {
    if (tab === 'dashboard')  return _renderDashboard();
    if (tab === 'upload')     return _renderUpload();
    if (tab === 'files')      return _renderFiles();
    if (tab === 'drivers')    return _renderDrivers();
    if (tab === 'vehicles')   return _renderVehicles();
    if (tab === 'violations') return _renderViolations();
    if (tab === 'calendar')   return _renderCalendar();
    if (tab === 'trend')      return _renderTrend();
    if (tab === 'comparison') return _renderComparison();
    if (tab === 'compliance') { _loadCompliance(); return '<div id="compliance-content" style="padding:20px;text-align:center"><i class="ti ti-loader"></i> Ładowanie raportu zgodności...</div>'; }
    if (tab === 'remote')     return _renderRemote();
    return '';
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────

  function _renderDashboard() {
    const st = _statsData;
    const overdue = _calData.filter(r => r.overdue);
    const recentViols = _violData.slice(0, 8);
    setTimeout(() => _loadTodayStatus(), 50);

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

<h3 style="font-size:14px;margin:0 0 10px"><i class="ti ti-activity"></i> Status bieżący kierowców (dane z dziś)</h3>
<div id="tacho-status-today" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-bottom:20px">
  <div style="padding:12px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
    <i class="ti ti-loader"></i> Ładowanie statusu...
  </div>
</div>

<div style="margin-top:20px;padding:14px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <strong>Jak korzystać:</strong> Wczytaj pliki .DDD z karty kierowcy lub jednostki pokładowej. System automatycznie analizuje naruszenia EU 561/2006 i Dyrektywy DYR 2002/15/WE.
  Zdalny pobór: skonfiguruj integrację z <em>Flespi</em> lub <em>Teltonika</em> w zakładce <em>Zdalny pobór</em>.
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
              Kierowca: <strong>${r.driver ? e(`${r.driver.surname  } ${  r.driver.firstName||''}`) : '?'}</strong>
              · Dni: <strong>${r.days}</strong>
              · Naruszenia: <strong style="color:${r.violations>0?'#dc2626':'inherit'}">${r.violations}</strong>
              ${r.driverLinked ? `· <span style="color:#16a34a"><i class="ti ti-check"></i> Powiązano z kierowcą</span>` : ''}
              ${r.vehicleLinked ? `· <span style="color:#16a34a"><i class="ti ti-check"></i> Powiązano z pojazdem</span>` : ''}
              ${r.parseErrors?.length ? `· <span style="color:#b45309">Ostrzeżenia parsera: ${e(r.parseErrors.join(', '))}</span>` : ''}
            </div>` : `<div style="font-size:12px;color:#dc2626">${e(r.error || 'Błąd')}</div>`}
        </div>
        ${r.ok ? `<button class="btn btn-sm" data-fid="${e(r.id)}" onclick="window.TachographModule._showFile(this.dataset.fid)">Podgląd</button>` : ''}
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
      const statusLabel = { ok: 'OK', partial: 'Częściowy', error: 'Błąd', pending: 'Oczekuje' }[f.parse_status] || e(f.parse_status);
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
          <button class="btn btn-sm" data-fid="${e(f.id)}" onclick="window.TachographModule._showFile(this.dataset.fid)"><i class="ti ti-eye"></i></button>
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
      <th>CPC/Kwalifikacja</th>
      <th>Powiązanie</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    ${_driversData.map(d => {
      const name       = _driverName(d);
      const daysSince  = d.days_since_last ?? 999;
      const overdue    = daysSince > 28;
      const statusColor = overdue ? '#dc2626' : '#16a34a';
      const statusLabel = overdue
        ? `Przeterminowane (${daysSince > 900 ? 'brak danych' : `${daysSince  } dni temu`})`
        : `OK (${daysSince} dni temu)`;
      const driverKey = encodeURIComponent(`${d.driver_surname||''  }|${  d.driver_firstname||''}`);

      // CPC expiry status
      let cpcHtml = '<span style="color:var(--text3);font-size:11px">—</span>';
      if (d.cpc_expiry_date) {
        const daysLeft = Math.round((new Date(d.cpc_expiry_date) - new Date()) / 86400000);
        const cpcColor = daysLeft < 0 ? '#dc2626' : daysLeft < 60 ? '#d97706' : '#16a34a';
        cpcHtml = `<span style="font-size:11px;color:${cpcColor};font-weight:600">${_fmtDate(d.cpc_expiry_date)}</span>
          <br><span style="font-size:10px;color:${cpcColor}">${daysLeft < 0 ? 'WYGASŁA' : daysLeft < 60 ? `za ${daysLeft}d` : 'ważna'}</span>
          ${d.cpc_training_hours ? `<br><span style="font-size:10px;color:var(--text3)">${e(String(d.cpc_training_hours))}/35h</span>` : ''}`;
      }

      return `<tr>
        <td>
          <strong style="cursor:pointer;color:var(--blue)" data-dkey="${e(driverKey)}" data-dname="${e(name)}" onclick="window.TachographModule._showDriverFiles(this.dataset.dkey,this.dataset.dname)">${e(name)}</strong>
          <br><span style="font-size:11px;color:var(--text3)">${e(d.driver_birth_date ? `Ur. ${  _fmtDate(d.driver_birth_date)}` : '')}</span>
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
        <td>${cpcHtml}</td>
        <td>
          ${d.driver_id
            ? `<span style="color:#16a34a;font-size:11px"><i class="ti ti-check"></i> Powiązano</span>`
            : `<button class="btn btn-sm" data-dkey="${e(driverKey)}" data-dname="${e(name)}"
                onclick="window.TachographModule._showLinkModal(this.dataset.dkey,this.dataset.dname)">
                <i class="ti ti-link"></i> Powiąż
               </button>`}
        </td>
        <td style="display:flex;gap:4px">
          <button class="btn btn-sm" data-dkey="${e(driverKey)}" data-dname="${e(name)}"
            onclick="window.TachographModule._showDriverAnalysis(this.dataset.dkey,this.dataset.dname)"
            title="Analiza wieloplikowa — 90 dni">
            <i class="ti ti-chart-dots"></i>
          </button>
          <button class="btn btn-sm" data-dkey="${e(driverKey)}" data-dname="${e(name)}"
            onclick="window.TachographModule._showDriverStatement(this.dataset.dkey,this.dataset.dname)"
            title="Zaświadczenie o aktywności">
            <i class="ti ti-file-text"></i>
          </button>
          <button class="btn btn-sm" data-dkey="${e(driverKey)}" data-dname="${e(name)}"
            onclick="window.TachographModule._showInspectorView(this.dataset.dkey,this.dataset.dname)"
            title="Widok do kontroli ITD / policji" style="background:#fff3cd;color:#856404">
            <i class="ti ti-car-crash"></i>
          </button>
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
  <button onclick="window.TachographModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
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
      <td><button class="btn btn-sm" data-fid="${e(f.id)}" onclick="window.TachographModule._closeModal();setTimeout(()=>window.TachographModule._showFile(this.dataset.fid),50)"><i class="ti ti-eye"></i></button></td>
    </tr>`).join('')}
  </tbody>
</table>`}`);
    } catch (ex) { _closeModal(); alert(`Błąd: ${  ex.message}`); }
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
      <th>Kalibracja VU</th>
      <th>Pobr. VU (90d)</th>
      <th>Powiązanie</th>
    </tr>
  </thead>
  <tbody>
    ${_vehiclesData.map(v => {
      // Calibration status
      let calibHtml = '<span style="color:var(--text3);font-size:11px">—</span>';
      if (v.tacho_calibration_next) {
        const daysLeft = Math.round((new Date(v.tacho_calibration_next) - new Date()) / 86400000);
        const cc = daysLeft < 0 ? '#dc2626' : daysLeft < 30 ? '#d97706' : '#16a34a';
        calibHtml = `<span style="font-size:11px;color:${cc};font-weight:600">${_fmtDate(v.tacho_calibration_next)}</span>
          <br><span style="font-size:10px;color:${cc}">${daysLeft < 0 ? 'PRZETERMINOWANA' : daysLeft < 30 ? `za ${daysLeft}d` : 'OK'}</span>`;
      }
      // VU download overdue
      let vuHtml = '<span style="color:var(--text3);font-size:11px">—</span>';
      if (v.tacho_vu_last_download) {
        const daysSince = Math.round((new Date() - new Date(v.tacho_vu_last_download)) / 86400000);
        const vc = daysSince > 90 ? '#dc2626' : daysSince > 75 ? '#d97706' : '#16a34a';
        vuHtml = `<span style="font-size:11px;color:${vc};font-weight:600">${_fmtDate(v.tacho_vu_last_download)}</span>
          <br><span style="font-size:10px;color:${vc}">${daysSince > 90 ? 'PRZETERMINOWANE!' : `${daysSince  } dni temu`}</span>`;
      }
      return `<tr>
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
      <td>${calibHtml}</td>
      <td>${vuHtml}</td>
      <td>
        ${v.vehicle_id
          ? `<span style="color:#16a34a;font-size:11px"><i class="ti ti-check"></i> Powiązano z flotą</span>`
          : `<span style="color:var(--text3);font-size:11px"><i class="ti ti-unlink"></i> Brak w flocie</span>`}
      </td>
    </tr>`;
    }).join('')}
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

<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;flex-wrap:wrap">
  <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px">
    ${Object.entries(SEVERITY).map(([k, v]) => {
      const cnt = _violData.filter(x => x.severity === k || (k === 'very_serious' && x.severity === 'most_serious')).length;
      if (k === 'most_serious') return '';
      return `<span style="background:${v.bg};color:${v.color};padding:4px 12px;border-radius:12px;font-weight:600">${v.label}: ${cnt}</span>`;
    }).join('')}
    ${_violData.length > 0 ? `<span style="background:var(--bg2);padding:4px 12px;border-radius:12px;font-weight:600">
      Kary: <strong style="color:#dc2626">${_violData.reduce((s,v)=>s+(v.penalty_pln??0),0).toLocaleString('pl-PL')} PLN</strong>
    </span>` : ''}
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-sm" onclick="window.TachographModule._exportCSV('violations')"><i class="ti ti-download"></i> CSV naruszeń</button>
    <button class="btn btn-sm" onclick="window.TachographModule._exportCSV('activities')"><i class="ti ti-download"></i> CSV aktywności</button>
  </div>
</div>

${_violData.length === 0 ? '<p style="color:var(--text3)">Brak naruszeń. Wczytaj pliki DDD aby uruchomić analizę.</p>' : `
<div style="overflow-x:auto">
<table class="tach-table">
  <thead>
    <tr><th>Data</th><th>Kierowca</th><th>Naruszenie</th><th>Szczegóły</th><th>Powaga</th><th>Kara PLN</th><th>Podstawa prawna</th></tr>
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
      <td style="font-weight:700;color:${(v.penalty_pln??0)>0?'#dc2626':'var(--text3)'}">
        ${(v.penalty_pln ?? 0) > 0 ? `${e(String(v.penalty_pln))} PLN` : '—'}
      </td>
      <td style="font-size:11px;color:var(--text3)">${e(v.regulation || '—')}</td>
    </tr>`).join('')}
  </tbody>
</table>
</div>`}

<div style="margin-top:20px;padding:14px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <strong>Klasyfikacja naruszeń (EU 2016/403):</strong>
  <span style="color:#b91c1c;font-weight:600">Bardzo poważne (B)</span> — przekroczenie limitów o ponad 20% · ograniczenie działalności, zawieszenie
  &nbsp;|&nbsp; <span style="color:#b45309;font-weight:600">Poważne (P)</span> — przekroczenie 10–20%
  &nbsp;|&nbsp; <span style="color:#0369a1;font-weight:600">Nieznaczne (N)</span> — przekroczenie do 10%
</div>`;
  }

  function _violTypeLabel(type) {
    const labels = {
      daily_driving_over_10h:       'Dobowy czas jazdy > 10h (Art.6 ust.1)',
      daily_driving_over_9h:        'Dobowy czas jazdy > 9h (Art.6 ust.1)',
      continuous_driving_over_4h30: 'Ciągły czas jazdy > 4,5h bez przerwy (Art.7)',
      weekly_driving_over_56h:      'Tygodniowy czas jazdy > 56h (Art.6 ust.2)',
      two_week_driving_over_90h:    'Suma 2 tyg. > 90h (Art.6 ust.3)',
      daily_rest_under_9h:          'Odpoczynek dobowy < 9h (Art.8)',
      daily_rest_under_11h:         'Odpoczynek dobowy < 11h (Art.8 ust.1)',
      weekly_rest_under_24h:        'Odpoczynek tygodniowy < 24h (Art.8 ust.6)',
      weekly_rest_under_45h:        'Odpoczynek tygodniowy < 45h (Art.8 ust.6)',
    };
    return labels[type] || type;
  }

  async function _filterViols() {
    const sev = document.getElementById('viol-sev')?.value || '';
    const df  = document.getElementById('viol-df')?.value || '';
    const dt  = document.getElementById('viol-dt')?.value || '';
    try {
      const url = `violations`;
      const ps = [];
      if (sev) ps.push(`severity=${  encodeURIComponent(sev)}`);
      if (df)  ps.push(`date_from=${  df}`);
      if (dt)  ps.push(`date_to=${  dt}`);
      const qStr = ps.length ? `&${  ps.join('&')}` : '';
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
        const dt = new Date(`${d  }T00:00:00Z`);
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
    } catch (ex) { _closeModal(); alert(`Błąd: ${  ex.message}`); }
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
        return `<span style="color:${c.bg};font-size:11px">${e(c.label)}: ${_fmtMin(v)}</span>`;
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
  <button onclick="window.TachographModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3)" aria-label="Zamknij">✕</button>
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

<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
  <div style="display:flex;gap:8px">
    <button class="btn btn-sm" data-fid="${e(f.id)}"
      onclick="window.TachographModule._generatePDF(this.dataset.fid)">
      <i class="ti ti-file-type-pdf"></i> Pobierz raport PDF
    </button>
    <button class="btn btn-sm" data-dname="${e([f.driver_surname,f.driver_firstname].filter(Boolean).join(' '))}" data-start="${e(f.period_start||'')}" data-end="${e(f.period_end||'')}"
      onclick="window.TachographModule._showStatementFromFile(this.dataset.dname,this.dataset.start,this.dataset.end)"
      title="Zaświadczenie o aktywności kierowcy">
      <i class="ti ti-file-text"></i> Zaświadczenie
    </button>
  </div>
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
    } catch (ex) { alert(`Błąd: ${  ex.message}`); }
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

  // ── STATUS BIEŻĄCY ────────────────────────────────────────────────────────

  async function _loadTodayStatus() {
    const el = document.getElementById('tacho-status-today');
    if (!el || !_driversData.length) {
      if (el) el.innerHTML = '<p style="font-size:12px;color:var(--text3);grid-column:1/-1">Brak kierowców z danymi DDD.</p>';
      return;
    }

    // Pobieramy status dla max 12 kierowców (najaktywniejszych)
    const toCheck = _driversData.slice(0, 12);
    const results = await Promise.all(toCheck.map(async d => {
      const key = encodeURIComponent(`${d.driver_surname||''  }|${  d.driver_firstname||''}`);
      try {
        const r = await fetch(`${API()}/api/tacho-ddd/remaining/${key}?company=${encodeURIComponent(Co())}`, { headers: H() });
        return r.ok ? { ...(await r.json()), _name: _driverName(d) } : null;
      } catch { return null; }
    }));

    const cards = results.filter(Boolean).map(r => {
      if (!r.data_available) {
        return `<div style="background:var(--bg2);border-radius:8px;padding:12px;border-left:3px solid var(--border)">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px">${e(r._name)}</div>
          <div style="font-size:11px;color:var(--text3)">Brak danych na dziś</div>
        </div>`;
      }
      const drivePct = Math.min(100, Math.round(r.driving_today / r.daily_limit * 100));
      const contPct  = Math.min(100, Math.round(r.continuous_driving / 270 * 100));
      const driveColor = drivePct > 90 ? '#dc2626' : drivePct > 70 ? '#d97706' : '#16a34a';
      const contColor  = contPct > 90 ? '#dc2626' : contPct > 70 ? '#d97706' : '#16a34a';

      return `<div style="background:var(--bg2);border-radius:8px;padding:12px;border-left:3px solid ${driveColor}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:13px">${e(r._name)}</strong>
          ${r.crew_mode ? '<span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:8px">Podw. obsada</span>' : ''}
          ${r.needs_break_now ? '<span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:8px">⚠ PRZERWA!</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Jazda dziś: ${_fmtMin(r.driving_today)} / ${_fmtMin(r.daily_limit)}</div>
        <div style="height:6px;background:var(--border);border-radius:3px;margin-bottom:6px">
          <div style="height:6px;background:${driveColor};border-radius:3px;width:${drivePct}%;transition:.3s"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Ciągła jazda: ${_fmtMin(r.continuous_driving)} (przerwa za ${_fmtMin(r.break_needed_in)})</div>
        <div style="height:4px;background:var(--border);border-radius:3px">
          <div style="height:4px;background:${contColor};border-radius:3px;width:${contPct}%;transition:.3s"></div>
        </div>
        <div style="margin-top:6px;font-size:11px;color:var(--text3)">
          Pozostało dziś: <strong style="color:${driveColor}">${_fmtMin(r.remaining_daily)}</strong>
          ${r.last_activity ? `· Ost. aktywność: ${e(r.last_activity.type)} do ${e(r.last_activity.end||'?')}` : ''}
        </div>
      </div>`;
    });

    el.innerHTML = cards.length ? cards.join('') : '<p style="font-size:12px;color:var(--text3);grid-column:1/-1">Brak danych z dzisiejszego dnia. Dane tachografu dostępne są po wczytaniu pliku DDD z karty kierowcy.</p>';
  }

  // ── ZGODNOŚĆ (COMPLIANCE) ─────────────────────────────────────────────────

  async function _loadCompliance() {
    const el = document.getElementById('compliance-content');
    if (!el) return;
    const df = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const dt = new Date().toISOString().slice(0,10);
    try {
      const r = await _api(`compliance-report&date_from=${df}&date_to=${dt}`);
      if (!r.ok) throw new Error('API error');
      const data = await r.json();
      el.innerHTML = _renderComplianceData(data, df, dt);
    } catch (ex) {
      el.innerHTML = `<p style="color:#dc2626;padding:20px">Błąd: ${e(ex.message)}</p>`;
    }
  }

  function _renderComplianceData(data, df, dt) {
    const rateColor = data.compliance_rate >= 80 ? '#16a34a' : data.compliance_rate >= 60 ? '#d97706' : '#dc2626';
    return `
<h3 style="font-size:14px;margin:0 0 16px"><i class="ti ti-shield-check"></i> Raport zgodności kierowców</h3>

<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
  <div>
    <label style="font-size:12px;color:var(--text3)">Od</label><br>
    <input type="date" id="cpl-df" class="sel" value="${e(df)}" onchange="window.TachographModule._reloadCompliance()">
  </div>
  <div>
    <label style="font-size:12px;color:var(--text3)">Do</label><br>
    <input type="date" id="cpl-dt" class="sel" value="${e(dt)}" onchange="window.TachographModule._reloadCompliance()">
  </div>
  <div style="align-self:flex-end">
    <button class="btn btn-sm" onclick="window.TachographModule._exportCompliancePDF()"><i class="ti ti-file-type-pdf"></i> Eksport PDF</button>
  </div>
</div>

<div class="tach-stat-grid" style="margin-bottom:20px">
  <div class="tach-stat">
    <div class="tach-stat-val" style="color:${rateColor}">${data.compliance_rate}%</div>
    <div class="tach-stat-lbl">Wskaźnik zgodności</div>
  </div>
  <div class="tach-stat">
    <div class="tach-stat-val" style="color:#16a34a">${data.compliant_drivers}</div>
    <div class="tach-stat-lbl">Kierowcy bez naruszeń</div>
  </div>
  <div class="tach-stat">
    <div class="tach-stat-val" style="color:${data.total_violations>0?'#dc2626':'inherit'}">${data.total_violations}</div>
    <div class="tach-stat-lbl">Łączne naruszenia</div>
  </div>
  <div class="tach-stat">
    <div class="tach-stat-val" style="color:${data.total_penalty>0?'#dc2626':'inherit'}">${(data.total_penalty||0).toLocaleString('pl-PL')} PLN</div>
    <div class="tach-stat-lbl">Łączne kary</div>
  </div>
</div>

<div style="overflow-x:auto">
<table class="tach-table">
  <thead>
    <tr>
      <th>Kierowca</th>
      <th>Nr karty</th>
      <th style="text-align:center">Pliki</th>
      <th style="text-align:center">Naruszenia</th>
      <th style="text-align:center">Bardzo poważne</th>
      <th style="text-align:center">Poważne</th>
      <th style="text-align:center">Nieznaczne</th>
      <th style="text-align:right">Kary PLN</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    ${(data.drivers||[]).map(d => {
      const ok = d.compliant;
      return `<tr>
        <td><strong>${e([d.driver_surname,d.driver_firstname].filter(Boolean).join(' ')||'—')}</strong></td>
        <td style="font-size:11px;font-family:monospace">${e(d.card_number||'—')}</td>
        <td style="text-align:center">${e(d.file_count??0)}</td>
        <td style="text-align:center;font-weight:700;color:${(d.violation_count??d.total_violations??0)>0?'#dc2626':'#16a34a'}">${e(String(d.violation_count??d.total_violations??0))}</td>
        <td style="text-align:center;color:#b91c1c">${e(String(d.very_serious??0))}</td>
        <td style="text-align:center;color:#b45309">${e(String(d.serious??0))}</td>
        <td style="text-align:center;color:#0369a1">${e(String(d.minor??0))}</td>
        <td style="text-align:right;font-weight:700;color:${(d.penalty_total||0)>0?'#dc2626':'inherit'}">${(d.penalty_total||0)>0?`${(d.penalty_total).toLocaleString('pl-PL')} PLN`:'—'}</td>
        <td>
          ${ok
            ? '<span style="color:#16a34a;font-size:11px;font-weight:600"><i class="ti ti-check"></i> Zgodny</span>'
            : '<span style="color:#dc2626;font-size:11px;font-weight:600"><i class="ti ti-alert-triangle"></i> Naruszenia</span>'}
        </td>
      </tr>`;
    }).join('')}
  </tbody>
</table>
</div>

<div style="margin-top:12px;padding:12px;background:var(--bg2);border-radius:8px;font-size:11px;color:var(--text3)">
  Okres: ${e(data.date_from)} – ${e(data.date_to)} · Łącznie kierowców: ${e(String(data.total_drivers??0))}
  · Eksport CSV: <button class="btn btn-sm" onclick="window.TachographModule._exportCSV('violations')">Naruszenia</button>
</div>`;
  }

  async function _reloadCompliance() {
    const df = document.getElementById('cpl-df')?.value;
    const dt = document.getElementById('cpl-dt')?.value;
    const el = document.getElementById('compliance-content');
    if (!el || !df || !dt) return;
    el.innerHTML = '<div style="padding:20px;text-align:center"><i class="ti ti-loader"></i></div>';
    try {
      const r = await _api(`compliance-report&date_from=${df}&date_to=${dt}`);
      const data = r.ok ? await r.json() : {};
      el.innerHTML = _renderComplianceData(data, df, dt);
    } catch {}
  }

  async function _exportCompliancePDF() {
    const PDFLib = window.PDFLib;
    if (!PDFLib?.PDFDocument) { alert('pdf-lib nie jest załadowana'); return; }
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    const df = document.getElementById('cpl-df')?.value || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const dt = document.getElementById('cpl-dt')?.value || new Date().toISOString().slice(0,10);
    const r  = await _api(`compliance-report&date_from=${df}&date_to=${dt}`);
    if (!r.ok) { alert('Błąd pobierania danych'); return; }
    const data = await r.json();

    const doc  = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontB= await doc.embedFont(StandardFonts.HelveticaBold);
    let page   = doc.addPage([595, 842]);
    let y      = 792;

    const drawT = (t, opts={}) => {
      page.drawText(String(t).slice(0,200), { x:opts.x||50, y, size:opts.size||10, font:opts.bold?fontB:font, color:opts.color||rgb(0,0,0) });
      y -= (opts.lh || (opts.size||10)+4);
    };

    page.drawRectangle({ x:0, y:812, width:595, height:30, color:rgb(0.04,0.12,0.25) });
    page.drawText('RAPORT ZGODNOŚCI KIEROWCÓW — EU 561/2006 / DYR 2002/15/WE', { x:50, y:820, size:11, font:fontB, color:rgb(1,1,1) });
    y = 800;
    drawT(`Okres: ${df} – ${dt}   |   Zgodność: ${data.compliance_rate}%   |   Łączne kary: ${(data.total_penalty||0).toLocaleString('pl-PL')} PLN`, { size:9, color:rgb(0.4,0.4,0.4) });
    y -= 10;

    const cols = [50,200,265,310,355,400,450,510];
    const hdrs = ['Kierowca','Karta','Pliki','Naruszeń','B.Poważne','Poważne','Nieznaczne','Kara PLN'];
    hdrs.forEach((h,i) => page.drawText(h, { x:cols[i], y, size:8, font:fontB, color:rgb(0.5,0.5,0.5) }));
    y -= 4;
    page.drawLine({ start:{x:50,y}, end:{x:545,y}, thickness:0.5, color:rgb(0.8,0.8,0.8) });
    y -= 12;

    for (const d of (data.drivers||[])) {
      if (y < 60) { page = doc.addPage([595,842]); y=800; }
      const row = [
        [d.driver_surname,d.driver_firstname].filter(Boolean).join(' ')||'—',
        d.card_number||'—',
        String(d.file_count??0),
        String(d.violation_count??d.total_violations??0),
        String(d.very_serious??0),
        String(d.serious??0),
        String(d.minor??0),
        (d.penalty_total||0)>0?String(d.penalty_total):'—',
      ];
      const isViol = (d.violation_count??d.total_violations??0) > 0;
      row.forEach((cell,i) => {
        page.drawText(cell, { x:cols[i], y, size:9, font,
          color: i===3&&isViol ? rgb(0.75,0,0) : rgb(0,0,0) });
      });
      y -= 13;
    }

    const bytes = await doc.save();
    const blob  = new Blob([bytes], { type:'application/pdf' });
    const link  = document.createElement('a');
    link.href   = URL.createObjectURL(blob);
    link.download = `raport_zgodnosci_${df}_${dt}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ── ZDALNY POBÓR (FLESPI / TELTONIKA) ────────────────────────────────────

  function _renderRemote() {
    return `
<h3 style="font-size:14px;margin:0 0 16px"><i class="ti ti-cloud-download"></i> Zdalny pobór danych tachografu</h3>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:20px">

  <!-- Flespi -->
  <div style="background:var(--bg2);border-radius:12px;padding:20px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div style="width:40px;height:40px;background:#0066ff;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">F</div>
      <div>
        <h4 style="margin:0;font-size:15px">Flespi IoT Hub</h4>
        <p style="margin:0;font-size:11px;color:var(--text3)">Obsługuje: Teltonika FMC640/650, Ruptela FMtco4 i inne</p>
      </div>
    </div>

    <div id="flespi-status" style="margin-bottom:14px;font-size:12px;color:var(--text3)">
      <i class="ti ti-loader"></i> Sprawdzanie konfiguracji...
    </div>

    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text3)">Token Flespi (Bearer Token)</label><br>
      <input type="password" id="flespi-token" class="sel" style="width:100%;max-width:380px;margin-top:4px" placeholder="eyJhbGciOi... lub FlespiToken XXXX">
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text3)">ID urządzeń (opcjonalne — przecinek-oddzielone, puste = wszystkie)</label><br>
      <input type="text" id="flespi-devices" class="sel" style="width:100%;max-width:380px;margin-top:4px" placeholder="123456,789012">
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn" onclick="window.TachographModule._saveFlespiConfig()"><i class="ti ti-device-floppy"></i> Zapisz konfigurację</button>
      <button class="btn btn-primary" id="flespi-sync-btn" onclick="window.TachographModule._runFlespiSync()"><i class="ti ti-refresh"></i> Synchronizuj teraz</button>
    </div>
    <div id="flespi-result" style="margin-top:12px;font-size:12px"></div>
  </div>

  <!-- Teltonika TachoSync -->
  <div style="background:var(--bg2);border-radius:12px;padding:20px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div style="width:40px;height:40px;background:#ff6900;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px">T</div>
      <div>
        <h4 style="margin:0;font-size:15px">Teltonika TachoSync</h4>
        <p style="margin:0;font-size:11px;color:var(--text3)">Urządzenia FMC640, FMM640, FMB630 z modułem tachografu</p>
      </div>
    </div>
    <div style="padding:12px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text3);margin-bottom:14px">
      <strong>Integracja TachoSync API</strong> wymaga konta partnerskiego Teltonika oraz urządzeń FMC640/FMM650 z podpiętym kablem tachografu.
      Po uzyskaniu poświadczeń API skonfiguruj integrację tutaj.
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text3)">Server URL TachoSync API</label><br>
      <input type="text" id="tacho-sync-url" class="sel" style="width:100%;max-width:380px;margin-top:4px" placeholder="https://api.tacho.teltonika.lt">
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text3)">Token API (Bearer)</label><br>
      <input type="password" id="tacho-sync-token" class="sel" style="width:100%;max-width:380px;margin-top:4px" placeholder="...">
    </div>
    <button class="btn" onclick="window.TachographModule._saveTeltonika()" style="margin-right:8px"><i class="ti ti-device-floppy"></i> Zapisz</button>
    <div id="teltonika-result" style="margin-top:10px;font-size:12px"></div>
  </div>

</div>

<div style="margin-top:20px;padding:14px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
  <strong><i class="ti ti-info-circle"></i> Jak skonfigurować Flespi?</strong><br>
  1. Utwórz konto na <strong>flespi.com</strong> (plan Free lub Commercial od 130 EUR/mies.)<br>
  2. Pobierz i uruchom <strong>Tacho Bridge Application</strong> na komputerze z czytnikiem tachografu lub w pojeździe z modułem Teltonika/Ruptela<br>
  3. Wygeneruj token w panelu Flespi (sekcja <em>Tokens</em>) i wklej go powyżej<br>
  4. Kliknij "Synchronizuj teraz" — system automatycznie pobierze i przeanalizuje nowe pliki DDD<br>
  5. Synchronizacja odbywa się też automatycznie co noc (cron 03:00)
</div>`;
  }

  async function _loadFlespiStatus() {
    const el = document.getElementById('flespi-status');
    if (!el) return;
    try {
      const r = await _api('flespi-config');
      if (!r.ok) { el.innerHTML = '<span style="color:var(--text3)">Nie skonfigurowano</span>'; return; }
      const cfg = await r.json();
      if (!cfg.configured) {
        el.innerHTML = '<span style="color:var(--text3)"><i class="ti ti-circle-x"></i> Nie skonfigurowano</span>';
        return;
      }
      document.getElementById('flespi-devices').value = (cfg.device_ids||[]).join(',');
      const syncInfo = cfg.last_sync ? `Ost. sync: ${new Date(cfg.last_sync).toLocaleString('pl-PL')} · Pliki: ${cfg.files_synced||0}` : 'Nigdy nie synchronizowano';
      el.innerHTML = `<span style="color:#16a34a"><i class="ti ti-check"></i> Skonfigurowano · Token: ••••</span><br>
        <span style="color:var(--text3)">${e(syncInfo)}</span>
        ${cfg.sync_error ? `<br><span style="color:#dc2626">Ostatni błąd: ${e(cfg.sync_error)}</span>` : ''}`;
    } catch { el.innerHTML = '<span style="color:var(--text3)">Błąd pobierania statusu</span>'; }
  }

  async function _saveFlespiConfig() {
    const token    = document.getElementById('flespi-token')?.value?.trim();
    const devStr   = document.getElementById('flespi-devices')?.value?.trim();
    const device_ids = devStr ? devStr.split(',').map(s=>s.trim()).filter(Boolean) : [];
    if (!token) { alert('Wpisz token Flespi'); return; }
    try {
      const r = await fetch(`${API()}/api/tacho-ddd/flespi-config?company=${encodeURIComponent(Co())}`, {
        method:'PUT', headers:{...H(),'Content-Type':'application/json'},
        body: JSON.stringify({ token, device_ids })
      });
      const res = document.getElementById('flespi-result');
      if (r.ok) {
        if (res) res.innerHTML = '<span style="color:#16a34a"><i class="ti ti-check"></i> Konfiguracja zapisana</span>';
        await _loadFlespiStatus();
      } else {
        if (res) res.innerHTML = '<span style="color:#dc2626">Błąd zapisu</span>';
      }
    } catch (ex) {
      const res = document.getElementById('flespi-result');
      if (res) res.innerHTML = `<span style="color:#dc2626">${e(ex.message)}</span>`;
    }
  }

  async function _runFlespiSync() {
    const btn = document.getElementById('flespi-sync-btn');
    const res = document.getElementById('flespi-result');
    if (btn) btn.disabled = true;
    if (res) res.innerHTML = '<i class="ti ti-loader"></i> Synchronizowanie z Flespi...';
    try {
      const r = await fetch(`${API()}/api/tacho-ddd/flespi-sync?company=${encodeURIComponent(Co())}`, {
        method:'POST', headers: H()
      });
      const data = r.ok ? await r.json() : { ok:false, error: r.status };
      if (res) {
        if (data.ok) {
          res.innerHTML = `<span style="color:#16a34a"><i class="ti ti-check"></i> Zsynchronizowano: ${data.files} nowych plików (${data.devices_checked} urządzeń)</span>`;
          await _loadAll();
        } else {
          res.innerHTML = `<span style="color:#dc2626">Błąd: ${e(JSON.stringify(data))}</span>`;
        }
      }
    } catch (ex) {
      if (res) res.innerHTML = `<span style="color:#dc2626">${e(ex.message)}</span>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function _saveTeltonika() {
    const url   = document.getElementById('tacho-sync-url')?.value?.trim();
    const token = document.getElementById('tacho-sync-token')?.value?.trim();
    const res   = document.getElementById('teltonika-result');
    if (!url || !token) { alert('Wpisz URL serwera i token'); return; }
    try {
      const r = await fetch(`${API()}/api/tacho-ddd/flespi-config?company=${encodeURIComponent(Co())}`, {
        method:'PUT', headers:{...H(),'Content-Type':'application/json'},
        body: JSON.stringify({ token, server_url: url, _provider: 'teltonika_tacho' })
      });
      if (res) res.innerHTML = r.ok ? '<span style="color:#16a34a">Zapisano konfigurację Teltonika</span>' : '<span style="color:#dc2626">Błąd zapisu</span>';
    } catch (ex) {
      if (res) res.innerHTML = `<span style="color:#dc2626">${e(ex.message)}</span>`;
    }
  }

  // ── INSPEKCJA DROGOWA (KONTROLA ITD) ─────────────────────────────────────

  async function _showInspectorView(driverKey, driverName) {
    const [sn, fn] = decodeURIComponent(driverKey).split('|');
    _showModal('<div style="padding:20px;text-align:center"><i class="ti ti-loader"></i> Ładowanie danych do kontroli...</div>');
    try {
      // Pobierz ostatnie 28 dni aktywności
      const dt = new Date().toISOString().slice(0,10);
      const df = new Date(Date.now()-28*86400000).toISOString().slice(0,10);
      const [calR, violR, remR] = await Promise.all([
        _api(`driver-analysis/${encodeURIComponent(driverKey)}&date_from=${df}&date_to=${dt}`),
        _api(`violations&date_from=${df}&date_to=${dt}`),
        _api(`remaining/${encodeURIComponent(driverKey)}`),
      ]);

      const analysis = calR.ok ? await calR.json() : { summary:{}, violations:[] };
      const allViols = violR.ok ? (await violR.json()).filter(v => {
        const ds = (v.driver_surname||'').toLowerCase(), df2 = (v.driver_firstname||'').toLowerCase();
        return ds.includes((sn||'').toLowerCase()) || df2.includes((fn||'').toLowerCase());
      }) : [];
      const rem = remR.ok ? await remR.json() : null;

      const today = new Date().toLocaleDateString('pl-PL');
      const s = analysis.summary || {};

      _showModal(`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
  <h3 style="margin:0;font-size:15px"><i class="ti ti-car-crash"></i> Widok do kontroli ITD/policji</h3>
  <div style="display:flex;gap:8px">
    <button class="btn btn-sm" onclick="window.print()"><i class="ti ti-printer"></i> Drukuj</button>
    <button onclick="window.TachographModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
  </div>
</div>
<div style="font-size:10px;color:var(--text3);margin-bottom:12px">
  Art. 34 ust. 3 Rozp. 165/2014 WE · Wygenerowano: ${today} · Okres: ostatnie 28 dni
</div>

<table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px">
  <tr><td style="padding:4px 8px;border:1px solid var(--border);background:var(--bg2);font-weight:600;width:40%">Kierowca</td><td style="padding:4px 8px;border:1px solid var(--border)">${e(driverName)}</td></tr>
  <tr><td style="padding:4px 8px;border:1px solid var(--border);background:var(--bg2);font-weight:600">Łączny czas jazdy (28 dni)</td><td style="padding:4px 8px;border:1px solid var(--border)">${_fmtMin(s.driving_total??0)}</td></tr>
  <tr><td style="padding:4px 8px;border:1px solid var(--border);background:var(--bg2);font-weight:600">Czas pracy (28 dni)</td><td style="padding:4px 8px;border:1px solid var(--border)">${_fmtMin((s.driving_total??0)+(s.work_total??0))}</td></tr>
  <tr><td style="padding:4px 8px;border:1px solid var(--border);background:var(--bg2);font-weight:600">Naruszenia (28 dni)</td><td style="padding:4px 8px;border:1px solid var(--border);color:${(s.violations_total??0)>0?'#dc2626':'#16a34a'};font-weight:700">${s.violations_total??0} ${(s.penalty_total??0)>0?`(${s.penalty_total} PLN kary)`:''}</td></tr>
  ${rem?.data_available ? `
  <tr><td style="padding:4px 8px;border:1px solid var(--border);background:var(--bg2);font-weight:600">Jazda dziś</td><td style="padding:4px 8px;border:1px solid var(--border)">${_fmtMin(rem.driving_today)} / ${_fmtMin(rem.daily_limit)} (pozostało: ${_fmtMin(rem.remaining_daily)})</td></tr>
  <tr><td style="padding:4px 8px;border:1px solid var(--border);background:var(--bg2);font-weight:600">Status przerwy</td><td style="padding:4px 8px;border:1px solid var(--border);color:${rem.needs_break_now?'#dc2626':'#16a34a'}">${rem.needs_break_now?'⚠ PRZERWA WYMAGANA TERAZ':`Przerwa za ${_fmtMin(rem.break_needed_in)}`}</td></tr>
  ` : ''}
</table>

${allViols.length>0 ? `
<h4 style="font-size:12px;color:#dc2626;margin:0 0 8px"><i class="ti ti-alert-triangle"></i> Naruszenia w ostatnich 28 dniach</h4>
<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px">
  <thead><tr style="background:var(--bg2)">
    <th style="padding:4px 8px;border:1px solid var(--border)">Data</th>
    <th style="padding:4px 8px;border:1px solid var(--border)">Naruszenie</th>
    <th style="padding:4px 8px;border:1px solid var(--border)">Waga</th>
    <th style="padding:4px 8px;border:1px solid var(--border)">Kara</th>
  </tr></thead>
  <tbody>
    ${allViols.slice(0,20).map(v=>`<tr>
      <td style="padding:4px 8px;border:1px solid var(--border)">${_fmtDate(v.violation_date)}</td>
      <td style="padding:4px 8px;border:1px solid var(--border)">${e(v.description||v.violation_type)}</td>
      <td style="padding:4px 8px;border:1px solid var(--border)">${_sevChip(v.severity)}</td>
      <td style="padding:4px 8px;border:1px solid var(--border)">${(v.penalty_pln??0)>0?`${e(String(v.penalty_pln))} PLN`:'—'}</td>
    </tr>`).join('')}
  </tbody>
</table>` : '<p style="color:#16a34a;font-size:12px"><i class="ti ti-check"></i> Brak naruszeń w ostatnich 28 dniach</p>'}

<div style="display:flex;justify-content:space-between;margin-top:20px">
  <div style="text-align:center"><div style="width:180px;border-top:1px solid #333;padding-top:6px;font-size:10px;color:var(--text3)">Podpis kierowcy</div></div>
  <div style="text-align:center"><div style="width:180px;border-top:1px solid #333;padding-top:6px;font-size:10px;color:var(--text3)">Podpis inspektora</div></div>
</div>`);
    } catch (ex) { _closeModal(); alert(`Błąd: ${  ex.message}`); }
  }

  // ── TREND ─────────────────────────────────────────────────────────────────

  function _renderTrend() {
    if (!_trendData.length) {
      return '<p style="color:var(--text3);padding:20px">Brak danych do wykresu trendu. Wczytaj pliki DDD aby zobaczyć historię naruszeń.</p>';
    }

    const maxTotal = Math.max(..._trendData.map(m => m.total), 1);
    const chartH = 200;
    const barW   = Math.max(30, Math.floor(540 / _trendData.length) - 8);

    const bars = _trendData.map((m, i) => {
      const x = i * (barW + 8) + 30;
      const totalH = Math.round((m.total / maxTotal) * chartH);
      const sH  = Math.round(((m.serious ?? 0) / maxTotal) * chartH);
      const vsH = Math.round(((m.very_serious ?? 0) / maxTotal) * chartH);
      const minH = Math.round(((m.minor ?? 0) / maxTotal) * chartH);

      const stackY = chartH;
      const stackParts = [
        { h: minH,  color: '#bfdbfe', label: 'Nieznaczne' },
        { h: sH,    color: '#fcd34d', label: 'Poważne' },
        { h: vsH,   color: '#f87171', label: 'Bardzo poważne' },
      ];

      let yOff = stackY;
      const rects = stackParts.map(p => {
        if (!p.h) return '';
        yOff -= p.h;
        return `<rect x="${x}" y="${yOff}" width="${barW}" height="${p.h}" fill="${p.color}" rx="2"/>`;
      }).join('');

      const label = m.month.slice(5); // MM
      const year  = m.month.slice(0, 4).slice(-2); // YY
      return `${rects}
        <text x="${x + barW/2}" y="${chartH + 16}" text-anchor="middle" font-size="10" fill="currentColor">${label}/${year}</text>
        <text x="${x + barW/2}" y="${chartH - totalH - 4}" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">${m.total}</text>`;
    }).join('');

    const svgW = _trendData.length * (barW + 8) + 60;

    return `
<h3 style="font-size:14px;margin:0 0 16px"><i class="ti ti-chart-bar"></i> Trend naruszeń (ostatnie 6 miesięcy)</h3>

<div style="display:flex;gap:12px;margin-bottom:16px;font-size:12px;flex-wrap:wrap">
  <span><span style="display:inline-block;width:12px;height:12px;background:#f87171;border-radius:2px;vertical-align:middle"></span> Bardzo poważne</span>
  <span><span style="display:inline-block;width:12px;height:12px;background:#fcd34d;border-radius:2px;vertical-align:middle"></span> Poważne</span>
  <span><span style="display:inline-block;width:12px;height:12px;background:#bfdbfe;border-radius:2px;vertical-align:middle"></span> Nieznaczne</span>
</div>

<div style="overflow-x:auto;background:var(--bg2);padding:20px;border-radius:12px">
  <svg width="${svgW}" height="${chartH + 40}" style="display:block">
    <line x1="20" y1="0" x2="20" y2="${chartH}" stroke="currentColor" stroke-opacity=".2" stroke-width="1"/>
    <line x1="20" y1="${chartH}" x2="${svgW - 10}" y2="${chartH}" stroke="currentColor" stroke-opacity=".2" stroke-width="1"/>
    ${bars}
  </svg>
</div>

<div style="margin-top:16px">
<table class="tach-table">
  <thead><tr><th>Miesiąc</th><th>Łącznie</th><th>Bardzo poważne</th><th>Poważne</th><th>Nieznaczne</th></tr></thead>
  <tbody>
    ${_trendData.map(m => `<tr>
      <td style="font-weight:600">${m.month}</td>
      <td style="font-weight:700;color:${m.total>0?'#dc2626':'#16a34a'}">${m.total}</td>
      <td>${m.very_serious ?? 0}</td>
      <td>${m.serious ?? 0}</td>
      <td>${m.minor ?? 0}</td>
    </tr>`).join('')}
    <tr style="background:var(--bg2)">
      <td style="font-weight:700">SUMA</td>
      <td style="font-weight:700;color:#dc2626">${_trendData.reduce((s,m)=>s+m.total,0)}</td>
      <td style="font-weight:700">${_trendData.reduce((s,m)=>s+(m.very_serious??0),0)}</td>
      <td style="font-weight:700">${_trendData.reduce((s,m)=>s+(m.serious??0),0)}</td>
      <td style="font-weight:700">${_trendData.reduce((s,m)=>s+(m.minor??0),0)}</td>
    </tr>
  </tbody>
</table>
</div>`;
  }

  // ── PORÓWNANIE KIEROWCÓW ────────────────────────────────────────────────────

  function _renderComparison() {
    const options = _driversData.map(d =>
      `<option value="${e(`${d.driver_surname||''}|${d.driver_firstname||''}`)}">${e(_driverName(d))}</option>`
    ).join('');

    return `
<h3 style="font-size:14px;margin:0 0 16px"><i class="ti ti-chart-arcs"></i> Porównanie kierowców</h3>

<div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap">
  <div>
    <label style="font-size:12px;color:var(--text3)">Kierowca 1</label><br>
    <select id="cmp-d1" class="sel" style="width:200px"><option value="">— wybierz —</option>${options}</select>
  </div>
  <div>
    <label style="font-size:12px;color:var(--text3)">Kierowca 2</label><br>
    <select id="cmp-d2" class="sel" style="width:200px"><option value="">— wybierz —</option>${options}</select>
  </div>
  <div>
    <label style="font-size:12px;color:var(--text3)">Od daty</label><br>
    <input type="date" id="cmp-df" class="sel">
  </div>
  <div>
    <label style="font-size:12px;color:var(--text3)">Do daty</label><br>
    <input type="date" id="cmp-dt" class="sel">
  </div>
  <button class="btn" onclick="window.TachographModule._runComparison()"><i class="ti ti-chart-arcs"></i> Porównaj</button>
</div>

<div id="cmp-result"></div>`;
  }

  async function _runComparison() {
    const d1 = document.getElementById('cmp-d1')?.value;
    const d2 = document.getElementById('cmp-d2')?.value;
    const df = document.getElementById('cmp-df')?.value;
    const dt = document.getElementById('cmp-dt')?.value;

    if (!d1 || !d2) { alert('Wybierz dwóch kierowców'); return; }
    if (d1 === d2)  { alert('Wybierz różnych kierowców'); return; }

    const el = document.getElementById('cmp-result');
    if (el) el.innerHTML = '<div style="padding:16px;text-align:center"><i class="ti ti-loader"></i> Pobieranie danych...</div>';

    try {
      let url = `comparison?driver1=${encodeURIComponent(d1)}&driver2=${encodeURIComponent(d2)}`;
      if (df) url += `&date_from=${df}`;
      if (dt) url += `&date_to=${dt}`;
      const r = await _api(url);
      if (!r.ok) throw new Error('API error');
      const data = await r.json();
      if (el) el.innerHTML = _renderCompResult(data.driver1, data.driver2);
    } catch (ex) {
      if (el) el.innerHTML = `<p style="color:#dc2626">Błąd: ${e(ex.message)}</p>`;
    }
  }

  function _renderCompResult(d1, d2) {
    function col(d, vs) {
      const rows = vs.map(([lbl, k, fmt]) => {
        const v = d[k] ?? 0;
        return `<tr><td style="font-size:12px;color:var(--text3)">${e(lbl)}</td><td style="font-weight:600">${fmt ? fmt(v) : e(String(v))}</td></tr>`;
      }).join('');
      return `
<div class="tach-comparison-col">
  <h4 style="margin:0 0 12px;font-size:15px">${e(d.name)}</h4>
  <table style="width:100%;border-collapse:collapse">${rows}</table>
</div>`;
    }

    const fields = [
      ['Pliki DDD',            'files',               null],
      ['Czas jazdy łącznie',   'driving_total',        _fmtMin],
      ['Czas pracy łącznie',   'work_total',           _fmtMin],
      ['Odpoczynek łącznie',   'rest_total',           _fmtMin],
      ['Dyspozycja łącznie',   'availability_total',   _fmtMin],
      ['Liczba naruszeń',      'violations',           null],
      ['Łączne kary PLN',      'penalty_total',        v => `${v.toLocaleString('pl-PL')  } PLN`],
    ];

    return `
<div style="display:flex;gap:16px;flex-wrap:wrap">
  ${col(d1, fields)}
  <div style="display:flex;align-items:center;font-size:24px;color:var(--text3);padding:0 8px">VS</div>
  ${col(d2, fields)}
</div>

<div style="margin-top:16px">
  <h4 style="font-size:13px;margin:0 0 8px">Podsumowanie</h4>
  ${_buildCompSummary(d1, d2)}
</div>`;
  }

  function _buildCompSummary(d1, d2) {
    const items = [];
    if (d1.driving_total > d2.driving_total) items.push(`<strong>${e(d1.name)}</strong> jeździ więcej o ${_fmtMin(d1.driving_total - d2.driving_total)}`);
    else if (d2.driving_total > d1.driving_total) items.push(`<strong>${e(d2.name)}</strong> jeździ więcej o ${_fmtMin(d2.driving_total - d1.driving_total)}`);
    if (d1.violations > d2.violations) items.push(`<strong>${e(d1.name)}</strong> ma więcej naruszeń (+${d1.violations - d2.violations})`);
    else if (d2.violations > d1.violations) items.push(`<strong>${e(d2.name)}</strong> ma więcej naruszeń (+${d2.violations - d1.violations})`);
    if (!items.length) return '<p style="color:var(--text3);font-size:13px">Wyniki porównywalne.</p>';
    return `<ul style="font-size:13px;margin:0;padding-left:16px">${  items.map(i => `<li>${i}</li>`).join('')  }</ul>`;
  }

  // ── PDF RAPORT ─────────────────────────────────────────────────────────────

  async function _generatePDF(fileId) {
    const PDFLib = window.PDFLib;
    if (!PDFLib?.PDFDocument) { alert('pdf-lib nie jest załadowana'); return; }
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    let f;
    try {
      const r = await _api(`report-data/${fileId}`);
      if (!r.ok) throw new Error('API error');
      f = await r.json();
    } catch (ex) { alert(`Błąd pobierania danych: ${  ex.message}`); return; }

    const doc   = await PDFDocument.create();
    const font  = await doc.embedFont(StandardFonts.Helvetica);
    const fontB = await doc.embedFont(StandardFonts.HelveticaBold);

    const W = 595, H = 842; // A4
    let page = doc.addPage([W, H]);
    let y    = H - 50;

    function addPageIfNeeded(needed = 40) {
      if (y < needed) {
        page = doc.addPage([W, H]);
        y = H - 50;
      }
    }

    function drawText(text, opts = {}) {
      const { x = 50, size = 10, bold = false, color } = opts;
      page.drawText(String(text).slice(0, 200), {
        x, y, size, font: bold ? fontB : font,
        color: color || rgb(0, 0, 0),
      });
      y -= (opts.lineH || size + 4);
    }

    const driverName = [f.driver_surname, f.driver_firstname].filter(Boolean).join(' ') || '—';
    const gray = rgb(0.5, 0.5, 0.5);
    const red  = rgb(0.75, 0, 0);
    const blue = rgb(0, 0, 0.5);

    // Nagłówek
    page.drawRectangle({ x: 0, y: H - 80, width: W, height: 80, color: rgb(0.04, 0.12, 0.25) });
    page.drawText('RAPORT CZASU PRACY KIEROWCY — EU 561/2006', { x: 50, y: H - 35, size: 13, font: fontB, color: rgb(1,1,1) });
    page.drawText(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} przez TaxOrder Pro`, { x: 50, y: H - 52, size: 8, font, color: rgb(0.7,0.7,0.7) });
    y = H - 100;

    drawText(driverName, { size: 16, bold: true, lineH: 22 });
    drawText(`Karta nr: ${f.card_number || '—'}  ·  Okres: ${f.period_start || '—'} — ${f.period_end || '—'}`, { size: 10, color: gray });
    drawText(`Naruszenia: ${f.violations_count || 0}  ·  Aktywności: ${f.activities_count || 0}  ·  Plik: ${f.file_name || '—'}`, { size: 9, color: gray });
    y -= 10;

    // Linia
    page.drawLine({ start: { x: 50, y }, end: { x: W - 50, y }, thickness: 0.5, color: gray });
    y -= 14;

    // Aktywności dzienne
    drawText('AKTYWNOŚCI DZIENNE', { size: 11, bold: true, color: blue });
    y -= 4;

    const byDate = {};
    for (const a of (f.activities || [])) {
      if (!byDate[a.activity_date]) byDate[a.activity_date] = {};
      byDate[a.activity_date][a.activity_type] = (byDate[a.activity_date][a.activity_type] || 0) + (a.duration_min || 0);
    }

    const COL = [50, 130, 185, 240, 295, 360];
    const HDR = ['Data', 'Jazda', 'Praca', 'Dyspozycja', 'Odpoczynek', 'Razem'];
    HDR.forEach((h, i) => { page.drawText(h, { x: COL[i], y, size: 8, font: fontB, color: gray }); });
    y -= 4;
    page.drawLine({ start: { x: 50, y }, end: { x: W - 50, y }, thickness: 0.3, color: gray });
    y -= 12;

    for (const [date, tots] of Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))) {
      addPageIfNeeded(20);
      const total = Object.values(tots).reduce((s, v) => s + v, 0);
      const row = [
        new Date(`${date  }T00:00:00Z`).toLocaleDateString('pl-PL'),
        _fmtMin(tots.driving), _fmtMin(tots.work), _fmtMin(tots.availability),
        _fmtMin(tots.rest), _fmtMin(total),
      ];
      row.forEach((cell, i) => {
        if (cell !== '—') page.drawText(cell, { x: COL[i], y, size: 9, font });
      });
      y -= 13;
    }

    // Naruszenia
    if ((f.violations || []).length > 0) {
      addPageIfNeeded(60);
      y -= 8;
      page.drawLine({ start: { x: 50, y }, end: { x: W - 50, y }, thickness: 0.3, color: gray });
      y -= 14;
      drawText('WYKRYTE NARUSZENIA', { size: 11, bold: true, color: red });
      y -= 4;

      for (const v of f.violations) {
        addPageIfNeeded(32);
        const sev = SEVERITY[v.severity] || SEVERITY.minor;
        drawText(`• ${new Date(`${v.violation_date||'2000-01-01'  }T00:00:00Z`).toLocaleDateString('pl-PL')} — ${v.description || v.violation_type}`, { size: 9 });
        y += 2;
        drawText(`  ${v.regulation || ''}  |  ${sev.label}${(v.penalty_pln||0)>0?` | Kara: ${v.penalty_pln} PLN`:''}`, { size: 8, color: gray, lineH: 16 });
        y -= 4;
      }
    }

    // Podpisy
    addPageIfNeeded(80);
    y -= 20;
    page.drawLine({ start: { x: 50, y }, end: { x: W - 50, y }, thickness: 0.3, color: gray });
    y -= 30;
    page.drawLine({ start: { x: 50, y }, end: { x: 220, y }, thickness: 0.5, color: gray });
    page.drawLine({ start: { x: 300, y }, end: { x: 470, y }, thickness: 0.5, color: gray });
    y -= 12;
    page.drawText('Podpis kierowcy', { x: 100, y, size: 8, font, color: gray });
    page.drawText('Podpis pracodawcy / dysponenta', { x: 300, y, size: 8, font, color: gray });

    const bytes = await doc.save();
    const blob  = new Blob([bytes], { type: 'application/pdf' });
    const link  = document.createElement('a');
    link.href   = URL.createObjectURL(blob);
    link.download = `tacho_raport_${driverName.replace(/\s+/g,'_')}_${f.period_start || 'brak'}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ── CSV EXPORT ─────────────────────────────────────────────────────────────

  function _exportCSV(type) {
    const df = document.getElementById('viol-df')?.value || '';
    const dt = document.getElementById('viol-dt')?.value || '';
    let url = `${API()}/api/tacho-ddd/export-csv?company=${encodeURIComponent(Co())}&type=${type}`;
    if (df) url += `&date_from=${df}`;
    if (dt) url += `&date_to=${dt}`;

    const link = document.createElement('a');
    link.href  = url;
    // Worker zwróci Content-Disposition: attachment — przeglądarka pobierze plik
    link.click();
  }

  // ── RĘCZNE POWIĄZANIE ─────────────────────────────────────────────────────

  async function _showLinkModal(driverKey, driverName) {
    _showModal('<div style="padding:20px;text-align:center"><i class="ti ti-loader"></i> Ładowanie kierowców...</div>');
    try {
      const r = await fetch(`${API()}/api/drivers?company=${encodeURIComponent(Co())}`, { headers: H() });
      _driversList = r.ok ? (await r.json()).drivers || [] : [];
    } catch { _driversList = []; }

    const opts = _driversList.map(d =>
      `<option value="${e(d.id)}">${e(d.name || d.id)}</option>`
    ).join('');

    _showModal(`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <h3 style="margin:0;font-size:16px"><i class="ti ti-link"></i> Powiąż z kartoteką kierowców</h3>
  <button onclick="window.TachographModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
</div>
<p style="font-size:13px;color:var(--text3);margin:0 0 16px">
  Kierowca w DDD: <strong>${e(driverName)}</strong>
</p>
<div style="margin-bottom:16px">
  <label style="font-size:12px;color:var(--text3)">Powiąż z kierowcą z kartoteki:</label><br><br>
  <select id="link-driver-select" class="sel" style="width:100%;max-width:400px">
    <option value="">— brak powiązania —</option>
    ${opts}
  </select>
</div>
<div style="display:flex;gap:8px;justify-content:flex-end">
  <button class="btn" onclick="window.TachographModule._closeModal()">Anuluj</button>
  <button class="btn btn-primary" data-dkey="${e(driverKey)}"
    onclick="window.TachographModule._saveLinkDriver(this.dataset.dkey)">
    <i class="ti ti-check"></i> Zapisz powiązanie
  </button>
</div>`);
  }

  async function _saveLinkDriver(driverKey) {
    const driverId = document.getElementById('link-driver-select')?.value || '';
    const [surname, firstname] = decodeURIComponent(driverKey).split('|');

    // Pobierz id ostatniego pliku danego kierowcy
    try {
      const filesR = await fetch(`${API()}/api/tacho-ddd/driver-files/${driverKey}?company=${encodeURIComponent(Co())}`, { headers: H() });
      const files = filesR.ok ? await filesR.json() : [];
      const putPromises = files.map(f =>
        fetch(`${API()}/api/tacho-ddd/files/${f.id}/link?company=${encodeURIComponent(Co())}`, {
          method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ driver_id: driverId || null })
        })
      );
      await Promise.all(putPromises);
      _closeModal();
      await _loadAll();
      _setTab('drivers');
    } catch (ex) { alert(`Błąd: ${  ex.message}`); }
  }

  // ── ANALIZA WIELOPLIKOWA KIEROWCY ─────────────────────────────────────────

  async function _showDriverAnalysis(driverKey, driverName) {
    _showModal(`<div style="padding:30px;text-align:center"><i class="ti ti-loader" style="font-size:28px"></i><br><br>Ładowanie analizy dla: <strong>${e(driverName)}</strong>...</div>`);
    try {
      const dt = new Date().toISOString().slice(0,10);
      const df = new Date(Date.now()-90*86400000).toISOString().slice(0,10);
      const r  = await _api(`driver-analysis/${encodeURIComponent(driverKey)}&date_from=${df}&date_to=${dt}`);
      if (!r.ok) throw new Error(`API ${  r.status}`);
      const data = await r.json();
      const s    = data.summary || {};
      const viols= data.violations || [];
      const files= data.files || [];

      const totalMin = (s.driving_total??0) + (s.work_total??0) + (s.availability_total??0) + (s.rest_total??0);
      const drivePct = totalMin ? Math.round((s.driving_total??0)/totalMin*100) : 0;
      const workPct  = totalMin ? Math.round((s.work_total??0)/totalMin*100) : 0;
      const restPct  = totalMin ? Math.round((s.rest_total??0)/totalMin*100) : 0;

      const violsBySev = viols.reduce((acc,v)=>{ acc[v.severity]=(acc[v.severity]||0)+1; return acc; }, {});
      const penTotal   = viols.reduce((sum,v)=>sum+(v.penalty_pln||0), 0);

      _showModal(`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <div>
    <h2 style="margin:0;font-size:17px"><i class="ti ti-user-search"></i> ${e(driverName)}</h2>
    <div style="font-size:12px;color:var(--text3);margin-top:2px">Analiza wieloplikowa · Okres: ${e(df)} – ${e(dt)}</div>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <button class="btn btn-sm" data-dkey="${e(driverKey)}" data-dname="${e(driverName)}" onclick="window.TachographModule._showInspectorView(this.dataset.dkey,this.dataset.dname)" title="Widok do kontroli ITD" style="background:#fff3cd;color:#856404"><i class="ti ti-car-crash"></i> Kontrola ITD</button>
    <button onclick="window.TachographModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
  </div>
</div>

<div class="tach-stat-grid" style="margin-bottom:16px">
  <div class="tach-stat">
    <div class="tach-stat-val">${files.length}</div>
    <div class="tach-stat-lbl"><i class="ti ti-file"></i> Analizowane pliki</div>
  </div>
  <div class="tach-stat">
    <div class="tach-stat-val">${_fmtMin(s.driving_total??0)}</div>
    <div class="tach-stat-lbl"><i class="ti ti-steering-wheel"></i> Łączna jazda</div>
  </div>
  <div class="tach-stat">
    <div class="tach-stat-val" style="color:${(s.violations_total??0)>0?'#dc2626':'#16a34a'}">${s.violations_total??viols.length}</div>
    <div class="tach-stat-lbl"><i class="ti ti-alert-triangle"></i> Naruszenia</div>
  </div>
  <div class="tach-stat">
    <div class="tach-stat-val" style="color:${penTotal>0?'#dc2626':'inherit'}">${penTotal>0?`${penTotal.toLocaleString('pl-PL')} PLN`:'—'}</div>
    <div class="tach-stat-lbl"><i class="ti ti-receipt"></i> Łączne kary</div>
  </div>
</div>

<!-- Pasek aktywności -->
${totalMin>0?`<div style="margin-bottom:16px">
  <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
    <span style="color:#dc2626"><i class="ti ti-steering-wheel"></i> Jazda ${drivePct}%</span>
    <span style="color:#d97706"><i class="ti ti-briefcase"></i> Praca ${workPct}%</span>
    <span style="color:#16a34a"><i class="ti ti-moon"></i> Odpoczynek ${restPct}%</span>
  </div>
  <div style="display:flex;height:12px;border-radius:6px;overflow:hidden">
    <div style="width:${drivePct}%;background:#dc2626"></div>
    <div style="width:${workPct}%;background:#d97706"></div>
    <div style="width:${totalMin?Math.round((s.availability_total??0)/totalMin*100):0}%;background:#2563eb"></div>
    <div style="width:${restPct}%;background:#16a34a"></div>
  </div>
</div>`:''}

<!-- Naruszenia wg wagi -->
${Object.keys(violsBySev).length>0?`<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
  ${(violsBySev.very_serious??violsBySev.most_serious)?`<span style="background:#fee2e2;color:#dc2626;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600"><i class="ti ti-alert-octagon"></i> Bardzo poważne: ${(violsBySev.very_serious??0)+(violsBySev.most_serious??0)}</span>`:''}
  ${violsBySev.serious?`<span style="background:#fef3c7;color:#b45309;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600"><i class="ti ti-alert-triangle"></i> Poważne: ${violsBySev.serious}</span>`:''}
  ${violsBySev.minor?`<span style="background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600"><i class="ti ti-info-circle"></i> Nieznaczne: ${violsBySev.minor}</span>`:''}
</div>`:''}

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
  <!-- Pliki -->
  <div>
    <h4 style="font-size:13px;margin:0 0 8px"><i class="ti ti-files"></i> Analizowane pliki (${files.length})</h4>
    <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
      ${files.length?files.map(f=>`
      <div style="padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600">${e(f.file_name||`${f.period_start} – ${f.period_end}`)}</div>
          <div style="color:var(--text3)">${_fmtDate(f.period_start)} – ${_fmtDate(f.period_end)}</div>
        </div>
        <div style="text-align:right">
          ${(f.violations_count||0)>0?`<span style="color:#dc2626;font-weight:700">${f.violations_count} nar.</span>`:'<span style="color:#16a34a;font-size:11px">Brak</span>'}
          <br><button class="btn btn-sm" style="font-size:10px;padding:2px 6px;margin-top:2px"
            data-fid="${e(f.id)}" onclick="window.TachographModule._closeModal();setTimeout(()=>window.TachographModule._showFile(this.dataset.fid),50)">
            <i class="ti ti-eye"></i>
          </button>
        </div>
      </div>`).join(''):'<div style="padding:12px;color:var(--text3);font-size:12px">Brak plików</div>'}
    </div>
  </div>

  <!-- Statystyki szczegółowe -->
  <div>
    <h4 style="font-size:13px;margin:0 0 8px"><i class="ti ti-chart-bar"></i> Statystyki szczegółowe</h4>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr><td style="padding:4px 8px;color:var(--text3)">Łączna jazda</td><td style="padding:4px 8px;font-weight:600">${_fmtMin(s.driving_total??0)}</td></tr>
      <tr style="background:var(--bg2)"><td style="padding:4px 8px;color:var(--text3)">Czas pracy</td><td style="padding:4px 8px;font-weight:600">${_fmtMin(s.work_total??0)}</td></tr>
      <tr><td style="padding:4px 8px;color:var(--text3)">Dyspozycja</td><td style="padding:4px 8px;font-weight:600">${_fmtMin(s.availability_total??0)}</td></tr>
      <tr style="background:var(--bg2)"><td style="padding:4px 8px;color:var(--text3)">Odpoczynek</td><td style="padding:4px 8px;font-weight:600">${_fmtMin(s.rest_total??0)}</td></tr>
      <tr><td style="padding:4px 8px;color:var(--text3)">Nr karty</td><td style="padding:4px 8px;font-family:monospace;font-size:11px">${e(s.card_number||data.card_number||'—')}</td></tr>
      <tr style="background:var(--bg2)"><td style="padding:4px 8px;color:var(--text3)">Ważność karty</td><td style="padding:4px 8px">
        ${s.card_expiry?`<span style="color:${new Date(s.card_expiry)<new Date()?'#dc2626':'#16a34a'}">${_fmtDate(s.card_expiry)}</span>`:'—'}
      </td></tr>
    </table>
  </div>
</div>

<!-- Naruszenia -->
${viols.length>0?`
<h4 style="font-size:13px;margin:0 0 8px"><i class="ti ti-alert-triangle" style="color:#dc2626"></i> Naruszenia w okresie (${viols.length})</h4>
<div style="max-height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
<table class="tach-table" style="margin:0">
  <thead><tr><th>Data</th><th>Naruszenie</th><th>Waga</th><th style="text-align:right">Kara</th></tr></thead>
  <tbody>
    ${viols.slice(0,50).map(v=>`<tr>
      <td style="font-size:11px">${_fmtDate(v.violation_date)}</td>
      <td style="font-size:11px">${e(v.description||v.violation_type)}</td>
      <td>${_sevChip(v.severity)}</td>
      <td style="text-align:right;font-size:11px">${(v.penalty_pln??0)>0?`${e(String(v.penalty_pln))} PLN`:'—'}</td>
    </tr>`).join('')}
  </tbody>
</table>
</div>
${viols.length>50?`<div style="font-size:11px;color:var(--text3);padding:6px">Pokazano 50 z ${viols.length} naruszeń</div>`:''}
`:`<div style="padding:12px;background:var(--bg);border-radius:8px;text-align:center;color:#16a34a;font-size:13px"><i class="ti ti-circle-check"></i> Brak naruszeń w analizowanym okresie</div>`}

<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
  <button class="btn btn-sm" onclick="window.TachographModule._exportCSV('violations')"><i class="ti ti-table-export"></i> Eksport CSV</button>
  <button class="btn btn-sm" onclick="window.TachographModule._closeModal()">Zamknij</button>
</div>`);
    } catch(ex) { _closeModal(); alert(`Błąd analizy: ${  ex.message}`); }
  }

  // ── ZAŚWIADCZENIE ─────────────────────────────────────────────────────────

  async function _showDriverStatement(driverKey, driverName) {
    const [sn, fn] = decodeURIComponent(driverKey).split('|');
    _showModal('<div style="padding:20px;text-align:center"><i class="ti ti-loader"></i> Ładowanie danych...</div>');
    try {
      const filesR = await fetch(`${API()}/api/tacho-ddd/driver-files/${driverKey}?company=${encodeURIComponent(Co())}`, { headers: H() });
      const files = filesR.ok ? await filesR.json() : [];
      if (!files.length) { _showModal('<div style="padding:20px"><p>Brak plików DDD dla tego kierowcy.</p><button class="btn" onclick="window.TachographModule._closeModal()">Zamknij</button></div>'); return; }
      const latest = files[0];
      await _showStatementFromFile(driverName, latest.period_start, latest.period_end, latest.id);
    } catch (ex) { _closeModal(); alert(`Błąd: ${  ex.message}`); }
  }

  async function _showStatementFromFile(driverName, periodStart, periodEnd, fileId) {
    _showModal('<div style="padding:20px;text-align:center"><i class="ti ti-loader"></i> Ładowanie aktywności...</div>');
    let fileData = null;
    if (fileId) {
      try {
        const r = await _api(`report-data/${fileId}`);
        if (r.ok) fileData = await r.json();
      } catch {}
    }

    const today = new Date().toLocaleDateString('pl-PL');
    const byDate = {};
    for (const a of (fileData?.activities || [])) {
      if (!byDate[a.activity_date]) byDate[a.activity_date] = {};
      byDate[a.activity_date][a.activity_type] = (byDate[a.activity_date][a.activity_type] || 0) + (a.duration_min || 0);
    }

    const tableRows = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date, tots]) => {
      const total = Object.values(tots).reduce((s,v)=>s+v,0);
      return `<tr style="font-size:12px">
        <td style="padding:5px 8px;border:1px solid #ccc">${new Date(`${date}T00:00:00Z`).toLocaleDateString('pl-PL')}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;text-align:center">${_fmtMin(tots.driving??0)}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;text-align:center">${_fmtMin(tots.work??0)}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;text-align:center">${_fmtMin(tots.availability??0)}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;text-align:center">${_fmtMin(tots.rest??0)}</td>
        <td style="padding:5px 8px;border:1px solid #ccc;text-align:center;font-weight:600">${_fmtMin(total)}</td>
      </tr>`;
    }).join('');

    _showModal(`
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
  <h3 style="margin:0;font-size:16px"><i class="ti ti-file-text"></i> Zaświadczenie o aktywności kierowcy</h3>
  <div style="display:flex;gap:8px">
    <button class="btn btn-sm" onclick="window.print()"><i class="ti ti-printer"></i> Drukuj</button>
    <button onclick="window.TachographModule._closeModal()" style="background:none;border:none;font-size:22px;cursor:pointer" aria-label="Zamknij">✕</button>
  </div>
</div>
<div id="tacho-statement-print" style="font-family:Arial,sans-serif;font-size:13px">
  <div style="text-align:center;margin-bottom:16px">
    <h2 style="font-size:16px;margin:0 0 4px">ZAŚWIADCZENIE O AKTYWNOŚCI KIEROWCY</h2>
    <p style="margin:0;font-size:11px;color:#666">Podstawa prawna: Rozporządzenie WE 561/2006 Art. 34 ust. 3</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px">
    <tr><td style="padding:4px 8px;border:1px solid #ccc;width:35%;background:#f5f5f5;font-weight:600">Imię i nazwisko kierowcy</td><td style="padding:4px 8px;border:1px solid #ccc">${e(driverName)}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ccc;background:#f5f5f5;font-weight:600">Karta kierowcy nr</td><td style="padding:4px 8px;border:1px solid #ccc">${e(fileData?.card_number||'—')}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ccc;background:#f5f5f5;font-weight:600">Okres</td><td style="padding:4px 8px;border:1px solid #ccc">${e(periodStart||'—')} – ${e(periodEnd||'—')}</td></tr>
    <tr><td style="padding:4px 8px;border:1px solid #ccc;background:#f5f5f5;font-weight:600">Data wystawienia</td><td style="padding:4px 8px;border:1px solid #ccc">${today}</td></tr>
  </table>
  ${tableRows ? `
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead><tr style="background:#f5f5f5">
      <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px">Data</th>
      <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px">Jazda</th>
      <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px">Praca</th>
      <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px">Dyspozycja</th>
      <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px">Odpoczynek</th>
      <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px">Razem</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>` : '<p style="color:#999;font-size:12px">Brak danych aktywności w tym pliku.</p>'}
  <div style="display:flex;justify-content:space-between;margin-top:30px">
    <div style="text-align:center">
      <div style="width:200px;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#666">Podpis kierowcy</div>
    </div>
    <div style="text-align:center">
      <div style="width:200px;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#666">Pieczęć i podpis pracodawcy</div>
    </div>
  </div>
</div>`);
  }

  // ── exports ────────────────────────────────────────────────────────────────

  window.TachographModule = {
    renderTachograph, _setTab, _uploadFiles, _clearResults,
    _showFile, _closeModal, _delFile, _filterViols, _showDriverFiles,
    _runComparison, _generatePDF, _exportCSV,
    _showLinkModal, _saveLinkDriver,
    _showDriverStatement, _showStatementFromFile,
    _reloadCompliance, _exportCompliancePDF,
    _saveFlespiConfig, _runFlespiSync, _saveTeltonika,
    _showInspectorView, _showDriverAnalysis,
  };
})();

