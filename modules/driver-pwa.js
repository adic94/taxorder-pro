/* SCHEMA_NEEDED: driver_trips
   Deploy via: wrangler d1 execute taxorder-pro --remote --file=worker/schema_v44.sql

CREATE TABLE IF NOT EXISTS driver_trips (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  company_id TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT,
  vehicle_id TEXT,
  vehicle_reg TEXT,
  start_km INTEGER,
  end_km INTEGER,
  start_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  end_at TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_dt_company ON driver_trips(company_id, driver_id, start_at DESC);
*/

(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.WORKER_URL || '';
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtDT = s => s ? s.replace('T', ' ').slice(0, 16) : '—';

  let _activeTrip = null;

  // ─── STYLES ──────────────────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('driver-pwa-styles')) return;
    const style = document.createElement('style');
    style.id = 'driver-pwa-styles';
    style.textContent = `
      body.driver-mode .sidebar { width: 0 !important; overflow: hidden !important; }
      body.driver-mode .main-content { margin-left: 0 !important; }
      #page-driver-pwa .dpwa-btn {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        width: 100%; padding: 16px 20px; border: none; border-radius: 12px;
        font-size: 16px; font-weight: 600; cursor: pointer;
        transition: opacity .15s, transform .1s;
      }
      #page-driver-pwa .dpwa-btn:active { opacity: .8; transform: scale(.98); }
      #page-driver-pwa .dpwa-btn:disabled { opacity: .4; cursor: not-allowed; }
      #page-driver-pwa .dpwa-btn.green  { background: #16a34a; color: #fff; }
      #page-driver-pwa .dpwa-btn.red    { background: #dc2626; color: #fff; }
      #page-driver-pwa .dpwa-btn.blue   { background: #2563eb; color: #fff; }
      #page-driver-pwa .dpwa-btn.gray   { background: var(--bg2, #f1f5f9); color: var(--text, #1e293b); border: 1px solid var(--border, #e2e8f0); }
      #page-driver-pwa .dpwa-trip-row   {
        padding: 12px 14px; border-radius: 10px;
        background: var(--bg2, #f1f5f9); margin-bottom: 8px; font-size: 13px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  // ─── INIT ────────────────────────────────────────────────────────────────────
  function init() {
    const params = new URLSearchParams(window.location.search);
    const isDriverMode = params.get('mode') === 'driver';
    const userRole = window.currentUser?.role || localStorage.getItem('userRole') || '';
    _injectStyles();
    if (isDriverMode || userRole === 'kierowca') {
      document.body.classList.add('driver-mode');
    }
  }

  // ─── RENDER DASHBOARD ────────────────────────────────────────────────────────
  async function renderDashboard() {
    const el = document.getElementById('page-driver-pwa');
    if (!el) return;

    const user = window.currentUser || {};
    const driverName  = e(user.name || user.email || 'Kierowca');
    const vehicleReg  = e(user.vehicle_reg || '');
    const vehicleMake = e(user.vehicle_make || '');
    const today = new Date().toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    el.innerHTML = `
<div style="max-width:480px;margin:0 auto;padding:16px">

  <!-- Nagłówek -->
  <div style="margin-bottom:20px">
    <h2 style="margin:0 0 4px;font-size:20px">Cześć, ${driverName}</h2>
    ${vehicleReg ? `
    <div style="display:flex;align-items:center;gap:8px;color:var(--text3,#64748b);font-size:14px;margin-bottom:4px">
      <i class="ti ti-car"></i>
      <span>Pojazd: <strong style="color:var(--text,#1e293b)">${vehicleReg}</strong>${vehicleMake ? ` · ${  vehicleMake}` : ''}</span>
    </div>` : ''}
    <div style="font-size:12px;color:var(--text3,#64748b)">${e(today)}</div>
  </div>

  <!-- Status aktywnej trasy (wypełniany przez JS) -->
  <div id="dpwa-active-trip" style="margin-bottom:16px"></div>

  <!-- Przyciski akcji -->
  <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
    <button class="dpwa-btn green" id="dpwa-start-btn" onclick="window.DriverPWA.startTrip()">
      <i class="ti ti-player-play" style="font-size:20px"></i> Rozpocznij trasę
    </button>
    <button class="dpwa-btn red" id="dpwa-end-btn" onclick="window.DriverPWA._openEndTripModal()">
      <i class="ti ti-player-stop" style="font-size:20px"></i> Zakończ trasę
    </button>
    <button class="dpwa-btn blue" onclick="window.DriverPWA.scanDocument()">
      <i class="ti ti-camera" style="font-size:20px"></i> Skanuj dokument
    </button>
    <button class="dpwa-btn gray" onclick="window.DriverPWA._openMessageModal()">
      <i class="ti ti-message-circle" style="font-size:20px"></i> Wiadomość do dyspozytora
    </button>
  </div>

  <!-- Trasy dziś -->
  <div>
    <h3 style="font-size:14px;font-weight:600;margin:0 0 12px;color:var(--text3,#64748b)">
      <i class="ti ti-route"></i> Moje trasy dziś
    </h3>
    <div id="dpwa-trips-list">
      <div style="text-align:center;padding:24px;color:var(--text3)">
        <i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Ładowanie...
      </div>
    </div>
  </div>
</div>

<!-- ── Modal: Rozpocznij trasę ── -->
<div id="dpwa-start-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:9200;align-items:center;justify-content:center"
     onclick="if(event.target===this)this.style.display='none'">
  <div style="background:var(--bg,#fff);border-radius:16px;padding:24px;width:min(420px,95vw);box-shadow:0 20px 60px rgba(0,0,0,.25)">
    <h3 style="margin:0 0 18px;font-size:17px"><i class="ti ti-player-play" style="color:#16a34a"></i> Rozpocznij trasę</h3>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Nr rejestracyjny *</label>
      <input id="dpwa-start-reg" class="sel" style="width:100%;box-sizing:border-box" placeholder="np. WA 12345"
             value="${vehicleReg}">
    </div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Stan licznika START (km) *</label>
      <input id="dpwa-start-km" type="number" class="sel" style="width:100%;box-sizing:border-box"
             placeholder="np. 45200" min="0">
    </div>
    <div style="margin-bottom:20px">
      <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Uwagi (opcjonalnie)</label>
      <input id="dpwa-start-notes" class="sel" style="width:100%;box-sizing:border-box"
             placeholder="Cel podróży, klient...">
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn" style="flex:1" onclick="document.getElementById('dpwa-start-modal').style.display='none'">Anuluj</button>
      <button class="btn btn-primary" style="flex:2" onclick="window.DriverPWA._submitStartTrip()">
        <i class="ti ti-player-play"></i> Ruszam!
      </button>
    </div>
  </div>
</div>

<!-- ── Modal: Zakończ trasę ── -->
<div id="dpwa-end-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:9200;align-items:center;justify-content:center"
     onclick="if(event.target===this)this.style.display='none'">
  <div style="background:var(--bg,#fff);border-radius:16px;padding:24px;width:min(420px,95vw);box-shadow:0 20px 60px rgba(0,0,0,.25)">
    <h3 style="margin:0 0 18px;font-size:17px"><i class="ti ti-player-stop" style="color:#dc2626"></i> Zakończ trasę</h3>
    <div id="dpwa-end-summary" style="margin-bottom:14px"></div>
    <div style="margin-bottom:12px">
      <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Stan licznika STOP (km) *</label>
      <input id="dpwa-end-km" type="number" class="sel" style="width:100%;box-sizing:border-box"
             placeholder="np. 45310" min="0">
    </div>
    <div style="margin-bottom:20px">
      <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Uwagi</label>
      <textarea id="dpwa-end-notes" class="sel" style="width:100%;box-sizing:border-box;resize:vertical" rows="2"
                placeholder="Notatki z trasy..."></textarea>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn" style="flex:1" onclick="document.getElementById('dpwa-end-modal').style.display='none'">Anuluj</button>
      <button class="btn" style="flex:2;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:10px;font-size:14px;font-weight:600;cursor:pointer"
              onclick="window.DriverPWA._submitEndTrip()">
        <i class="ti ti-player-stop"></i> Zakończ trasę
      </button>
    </div>
  </div>
</div>

<!-- ── Modal: Wiadomość do dyspozytora ── -->
<div id="dpwa-msg-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:9200;align-items:center;justify-content:center"
     onclick="if(event.target===this)this.style.display='none'">
  <div style="background:var(--bg,#fff);border-radius:16px;padding:24px;width:min(420px,95vw);box-shadow:0 20px 60px rgba(0,0,0,.25)">
    <h3 style="margin:0 0 18px;font-size:17px"><i class="ti ti-message-circle" style="color:#2563eb"></i> Wiadomość do dyspozytora</h3>
    <div style="margin-bottom:16px">
      <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Treść wiadomości *</label>
      <textarea id="dpwa-msg-text" class="sel" style="width:100%;box-sizing:border-box;resize:vertical" rows="4"
                placeholder="Wpisz wiadomość..."></textarea>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn" style="flex:1" onclick="document.getElementById('dpwa-msg-modal').style.display='none'">Anuluj</button>
      <button class="btn btn-primary" style="flex:2" onclick="window.DriverPWA._submitMessage()">
        <i class="ti ti-send"></i> Wyślij
      </button>
    </div>
  </div>
</div>`;

    _injectStyles();
    await _loadTrips();
  }

  // ─── LOAD TODAY'S TRIPS ──────────────────────────────────────────────────────
  async function _loadTrips() {
    const listEl = document.getElementById('dpwa-trips-list');
    if (!listEl) return;
    const user  = window.currentUser || {};
    const today = new Date().toISOString().slice(0, 10);
    try {
      const r = await fetch(
        `${API()}/api/driver-trips?company=${encodeURIComponent(Co())}&driver_id=${encodeURIComponent(user.id ?? '')}&date=${today}`,
        { headers: H() }
      );
      const trips = r.ok ? await r.json() : [];
      _renderTrips(trips, listEl);
    } catch {
      listEl.innerHTML = '<div style="color:#dc2626;font-size:13px;padding:8px">Błąd ładowania tras. Sprawdź połączenie.</div>';
    }
  }

  function _renderTrips(trips, listEl) {
    if (!trips.length) {
      listEl.innerHTML = `
<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">
  <i class="ti ti-route-off" style="font-size:2em;display:block;margin-bottom:8px"></i>
  Brak zarejestrowanych tras dziś
</div>`;
      _activeTrip = null;
      _updateButtons();
      return;
    }

    _activeTrip = trips.find(t => t.status === 'active') ?? null;
    _updateButtons();

    // Active trip banner
    const activeTripBanner = document.getElementById('dpwa-active-trip');
    if (activeTripBanner && _activeTrip) {
      activeTripBanner.innerHTML = `
<div style="padding:12px 14px;border-radius:10px;background:#fef9c3;border:1px solid #fde68a;display:flex;align-items:center;gap:10px">
  <i class="ti ti-player-play" style="color:#854d0e;font-size:18px"></i>
  <div>
    <div style="font-weight:600;color:#854d0e;font-size:13px">Trasa aktywna</div>
    <div style="font-size:12px;color:#713f12">${e(_activeTrip.vehicle_reg ?? '—')} · start: ${e(String(_activeTrip.start_km ?? '—'))} km · ${fmtDT(_activeTrip.start_at)}</div>
  </div>
</div>`;
    } else if (activeTripBanner) {
      activeTripBanner.innerHTML = '';
    }

    listEl.innerHTML = trips.map(t => {
      const startKm  = t.start_km ?? null;
      const endKm    = t.end_km ?? null;
      const distance = (startKm != null && endKm != null) ? `${endKm - startKm  } km` : '—';
      const pill = t.status === 'active'
        ? '<span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">W trasie</span>'
        : '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">Zakończona</span>';
      return `
<div class="dpwa-trip-row">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
    <span style="font-weight:700;font-size:14px">${e(t.vehicle_reg ?? '—')}</span>
    ${pill}
  </div>
  <div style="color:var(--text3);font-size:12px;margin-bottom:4px">
    ${fmtDT(t.start_at)}${t.end_at ? ` → ${  fmtDT(t.end_at)}` : ' → trwa...'}
  </div>
  <div>
    Start: <strong>${e(String(startKm ?? '—'))}</strong> km
    ${endKm != null ? ` &nbsp;·&nbsp; Stop: <strong>${e(String(endKm))}</strong> km &nbsp;·&nbsp; Dystans: <strong>${distance}</strong>` : ''}
  </div>
  ${t.notes ? `<div style="margin-top:6px;font-size:12px;color:var(--text3);font-style:italic">${e(t.notes)}</div>` : ''}
</div>`;
    }).join('');
  }

  function _updateButtons() {
    const startBtn = document.getElementById('dpwa-start-btn');
    const endBtn   = document.getElementById('dpwa-end-btn');
    const hasActive = !!_activeTrip;
    if (startBtn) {
      startBtn.disabled = hasActive;
    }
    if (endBtn) {
      endBtn.disabled = !hasActive;
    }
  }

  // ─── START TRIP ──────────────────────────────────────────────────────────────
  function startTrip(vehicleReg) {
    const modal = document.getElementById('dpwa-start-modal');
    if (!modal) return;
    if (vehicleReg) {
      const regInput = document.getElementById('dpwa-start-reg');
      if (regInput) regInput.value = vehicleReg;
    }
    document.getElementById('dpwa-start-km').value   = '';
    document.getElementById('dpwa-start-notes').value = '';
    modal.style.display = 'flex';
  }

  async function _submitStartTrip() {
    const reg   = document.getElementById('dpwa-start-reg')?.value?.trim() ?? '';
    const kmStr = document.getElementById('dpwa-start-km')?.value?.trim()  ?? '';
    const notes = document.getElementById('dpwa-start-notes')?.value?.trim() ?? '';
    if (!reg)   { alert('Podaj numer rejestracyjny'); return; }
    if (!kmStr) { alert('Podaj stan licznika'); return; }
    const startKm = parseInt(kmStr, 10);
    if (isNaN(startKm) || startKm < 0) { alert('Nieprawidłowy stan licznika'); return; }
    const user = window.currentUser || {};
    try {
      const r = await fetch(`${API()}/api/driver-trips?company=${encodeURIComponent(Co())}`, {
        method: 'POST',
        headers: { ...H(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_reg: reg,
          driver_id:   user.id   ?? '',
          driver_name: user.name ?? user.email ?? '',
          start_km:    startKm,
          notes
        })
      });
      if (r.ok) {
        document.getElementById('dpwa-start-modal').style.display = 'none';
        await _loadTrips();
      } else {
        const d = await r.json().catch(() => ({}));
        alert(`Błąd: ${  d.error || r.status}`);
      }
    } catch (ex) { alert(ex.message); }
  }

  // ─── END TRIP ────────────────────────────────────────────────────────────────
  function endTrip(tripId) {
    // Can be called externally with a specific tripId
    if (tripId && (!_activeTrip || _activeTrip.id !== tripId)) {
      _activeTrip = { id: tripId };
    }
    _openEndTripModal();
  }

  function _openEndTripModal() {
    if (!_activeTrip) { alert('Brak aktywnej trasy do zakończenia'); return; }
    const summaryEl = document.getElementById('dpwa-end-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
<div style="padding:10px 12px;background:var(--bg2,#f8fafc);border-radius:8px;font-size:13px">
  <strong>${e(_activeTrip.vehicle_reg ?? '—')}</strong>
  &nbsp;·&nbsp; start: <strong>${e(String(_activeTrip.start_km ?? '—'))}</strong> km
  <br><span style="color:var(--text3)">Wyjazd: ${fmtDT(_activeTrip.start_at)}</span>
</div>`;
    }
    document.getElementById('dpwa-end-km').value    = '';
    document.getElementById('dpwa-end-notes').value = '';
    document.getElementById('dpwa-end-modal').style.display = 'flex';
  }

  async function _submitEndTrip() {
    if (!_activeTrip) return;
    const kmStr = document.getElementById('dpwa-end-km')?.value?.trim()   ?? '';
    const notes = document.getElementById('dpwa-end-notes')?.value?.trim() ?? '';
    if (!kmStr) { alert('Podaj stan licznika STOP'); return; }
    const endKm = parseInt(kmStr, 10);
    if (isNaN(endKm) || endKm < 0) { alert('Nieprawidłowy stan licznika'); return; }
    const startKm = _activeTrip.start_km ?? null;
    if (startKm != null && endKm < startKm) {
      alert(`Stan licznika STOP (${endKm}) nie może być mniejszy niż START (${startKm})`);
      return;
    }
    try {
      const r = await fetch(
        `${API()}/api/driver-trips/${encodeURIComponent(_activeTrip.id)}?company=${encodeURIComponent(Co())}`,
        {
          method: 'PUT',
          headers: { ...H(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ end_km: endKm, notes, status: 'completed' })
        }
      );
      if (r.ok) {
        _activeTrip = null;
        document.getElementById('dpwa-end-modal').style.display = 'none';
        await _loadTrips();
      } else {
        const d = await r.json().catch(() => ({}));
        alert(`Błąd: ${  d.error || r.status}`);
      }
    } catch (ex) { alert(ex.message); }
  }

  // ─── SCAN DOCUMENT ───────────────────────────────────────────────────────────
  function scanDocument() {
    const input = document.createElement('input');
    input.type    = 'file';
    input.accept  = 'image/*';
    input.capture = 'environment';   // tylna kamera na urządzeniach mobilnych
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0] ?? null;
      document.body.removeChild(input);
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company', Co());
      const user = window.currentUser || {};
      if (user.vehicle_reg) formData.append('vehicle_reg', user.vehicle_reg);
      try {
        // H() may contain Authorization; omit Content-Type (browser sets multipart boundary)
        const headers = { ...H() };
        delete headers['Content-Type'];
        const r = await fetch(`${API()}/api/docs/upload`, { method: 'POST', headers, body: formData });
        if (r.ok) {
          alert('Dokument przesłany pomyślnie.');
        } else {
          const d = await r.json().catch(() => ({}));
          alert(`Błąd przesyłania: ${  d.error ?? r.status}`);
        }
      } catch (ex) { alert(ex.message); }
    };
    input.click();
  }

  // ─── SEND MESSAGE ────────────────────────────────────────────────────────────
  function _openMessageModal() {
    const modal = document.getElementById('dpwa-msg-modal');
    if (!modal) return;
    document.getElementById('dpwa-msg-text').value = '';
    modal.style.display = 'flex';
  }

  async function sendMessage(text) {
    const msg = text ?? document.getElementById('dpwa-msg-text')?.value?.trim() ?? '';
    if (!msg) { alert('Wpisz treść wiadomości'); return false; }
    const user = window.currentUser || {};
    try {
      const r = await fetch(
        `${API()}/api/messages?company=${encodeURIComponent(Co())}`,
        {
          method: 'POST',
          headers: { ...H(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_user:     'dyspozytor',
            subject:     'Wiadomość od kierowcy',
            body:        msg,
            vehicle_reg: user.vehicle_reg ?? ''
          })
        }
      );
      if (r.ok) { alert('Wiadomość wysłana.'); return true; }
      const d = await r.json().catch(() => ({}));
      alert(`Błąd wysyłania: ${  d.error ?? r.status}`);
      return false;
    } catch (ex) { alert(ex.message); return false; }
  }

  async function _submitMessage() {
    const ok = await sendMessage();
    if (ok) document.getElementById('dpwa-msg-modal').style.display = 'none';
  }

  // ─── EXPORT ─────────────────────────────────────────────────────────────────
  window.DriverPWA = {
    init,
    renderDashboard,
    startTrip,
    endTrip,
    scanDocument,
    sendMessage,
    // internals exposed for inline onclick handlers
    _openEndTripModal,
    _openMessageModal,
    _submitStartTrip,
    _submitEndTrip,
    _submitMessage,
  };
})();
