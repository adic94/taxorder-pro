/**
 * TaxOrder Pro — Web Notifications
 * Powiadomienia przeglądarkowe o wygasających OC/AC/przeglądach
 * Wysyła max raz dziennie per pojazd + typ terminu
 */
window.TaxOrderNotifications = (function () {

  const STORAGE_KEY = 'taxNotifSent';
  const WARN_DAYS = 14;

  function _getSent() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function _markSent(key) {
    const sent = _getSent();
    sent[key] = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sent));
  }

  function _wasSentToday(key) {
    const sent = _getSent();
    return sent[key] === new Date().toISOString().slice(0, 10);
  }

  // Czyści stare wpisy (>30 dni) żeby localStorage nie puchła
  function _cleanup() {
    const sent = _getSent();
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const cleaned = {};
    for (const [k, v] of Object.entries(sent)) {
      if (v >= cutoff) cleaned[k] = v;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  }

  function _daysUntil(dateStr) {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr) - new Date()) / 86400000);
  }

  function _send(title, body, tag) {
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        tag,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: false,
      });
    } catch (e) {
      console.warn('[Notifications]', e.message);
    }
  }

  function check() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const vehs = window.vehs || [];
    const now = new Date();
    _cleanup();

    let sent = 0;
    vehs.forEach(v => {
      const checks = [
        { field: 'ocEnd',          label: 'OC',                date: v.ocEnd },
        { field: 'acEnd',          label: 'AC',                date: v.acEnd },
        { field: 'nextInspection', label: 'Przegląd tech.',    date: v.nextInspection },
        ...(v.hasUdt && v.udtNextDate ? [{ field: 'udtNextDate', label: 'Badanie UDT', date: v.udtNextDate }] : []),
        ...(v.hasTacho && v.tachoNextCalib ? [{ field: 'tachoNextCalib', label: 'Legalizacja tacho', date: v.tachoNextCalib }] : []),
        // Alerty serwisowe z historii serwisów
        ...(v.serviceHistory || [])
          .filter(s => s.nextServiceDate)
          .map(s => ({ field: 'svc_'+s.id, label: (window.ServiceModule?.SERVICE_TYPES?.[s.type]?.label || 'Serwis'), date: s.nextServiceDate })),
        // Alert zmiany opon
        ...(v.tireNextChange ? [{ field: 'tireChange', label: 'Zmiana opon', date: v.tireNextChange }] : []),
        // Alerty dokumentów z DocumentsModule
        ...(window.DocumentsModule?.getDocAlerts(v, WARN_DAYS) || []),
      ];

      checks.forEach(({ field, label, date }) => {
        const days = _daysUntil(date);
        if (days === null || days > WARN_DAYS) return;

        const key = `${v.nrRej}__${field}`;
        if (_wasSentToday(key)) return;

        const dateStr = new Date(date).toLocaleDateString('pl-PL');
        let title, body;
        if (days < 0) {
          title = `❌ ${v.nrRej} — ${label} WYGASŁO`;
          body = `${v.marka} ${v.model}\nTermin: ${dateStr} (${Math.abs(days)} dni temu)`;
        } else if (days === 0) {
          title = `🚨 ${v.nrRej} — ${label} wygasa DZISIAJ`;
          body = `${v.marka} ${v.model}`;
        } else {
          title = `⚠ ${v.nrRej} — ${label} wygasa za ${days} dni`;
          body = `${v.marka} ${v.model}\nTermin: ${dateStr}`;
        }

        _send(title, body, key);
        _markSent(key);
        sent++;
      });

      // KM-based service alerts
      (v.serviceHistory||[]).filter(s => s.nextServiceKm && v.stanKilometrow).forEach(s => {
        const kmLeft = +s.nextServiceKm - (+v.stanKilometrow||0);
        if (kmLeft > 500) return;
        const key = `${v.nrRej}__svc_km_${s.id}`;
        if (_wasSentToday(key)) return;
        const svcLabel = window.ServiceModule?.SERVICE_TYPES?.[s.type]?.label || 'Serwis';
        let title, body;
        if (kmLeft <= 0) {
          title = `❌ ${v.nrRej} — ${svcLabel} PRZETERMINOWANY (km)`;
          body = `${v.marka} ${v.model}\nPrzekroczono o ${Math.abs(Math.round(kmLeft))} km`;
        } else {
          title = `⚠ ${v.nrRej} — ${svcLabel} za ${Math.round(kmLeft)} km`;
          body = `${v.marka} ${v.model}\nPlan: ${s.nextServiceKm} km, stan: ${v.stanKilometrow} km`;
        }
        _send(title, body, key);
        _markSent(key);
        sent++;
      });
    });

    // Alert wygasającego prawa jazdy kierowców
    (window.TaxOrderDrivers?.getAll() || []).forEach(d => {
      if (!d.licenseExpiry) return;
      const days = _daysUntil(d.licenseExpiry);
      if (days === null || days > WARN_DAYS) return;

      const key = `drv_${d.id}__licenseExpiry`;
      if (_wasSentToday(key)) return;

      const dateStr = new Date(d.licenseExpiry).toLocaleDateString('pl-PL');
      let title, body;
      if (days < 0) {
        title = `❌ ${d.name} — Prawo jazdy WYGASŁO`;
        body = `Termin: ${dateStr} (${Math.abs(days)} dni temu)`;
      } else if (days === 0) {
        title = `🚨 ${d.name} — Prawo jazdy wygasa DZISIAJ`;
        body = `Sprawdź dokument przed wyjazdem`;
      } else {
        title = `⚠ ${d.name} — Prawo jazdy wygasa za ${days} dni`;
        body = `Termin: ${dateStr}`;
      }

      _send(title, body, key);
      _markSent(key);
      sent++;
    });

    if (sent > 0) console.log(`[Notifications] Wysłano ${sent} powiadomień`);

    // Jeśli mamy subskrypcję push serwera, wyślij alerty do wszystkich urządzeń firmy
    const storedSub = localStorage.getItem(PUSH_SUB_KEY);
    if (sent > 0 && storedSub) {
      const urgent = getActiveAlerts(7).filter(a => a.expired || a.urgent);
      if (urgent.length > 0) {
        const company_id = window.currentCompanyId || 'default';
        const firstAlert = urgent[0];
        fetch(`${_cfApi()}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id,
            title: `TaxOrder Pro — ${urgent.length} alert${urgent.length > 1 ? 'y' : ''}`,
            message: `${firstAlert.nrRej}: ${firstAlert.label} ${firstAlert.expired ? 'WYGASŁO' : `wygasa za ${firstAlert.days} dni`}${urgent.length > 1 ? ` (+${urgent.length-1} więcej)` : ''}`,
            url: '/?page=pojazdy',
            urgent: true,
          }),
        }).catch(() => {});
      }
    }
  }

  async function requestAndCheck() {
    if (!('Notification' in window)) {
      console.log('[Notifications] Przeglądarka nie obsługuje Web Notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      check();
      return;
    }

    if (Notification.permission === 'denied') return;

    // Poproś o zgodę tylko gdy mamy coś do pokazania
    const vehs = window.vehs || [];
    const hasAlerts = vehs.some(v => {
      const dates = [v.ocEnd, v.acEnd, v.nextInspection];
      if (v.hasUdt && v.udtNextDate) dates.push(v.udtNextDate);
      if (v.hasTacho && v.tachoNextCalib) dates.push(v.tachoNextCalib);
      return dates.some(d => { const days = _daysUntil(d); return days !== null && days <= WARN_DAYS; });
    });
    if (!hasAlerts) return;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      check();
    }
  }

  // Zwraca listę wszystkich aktywnych alertów floty (bez filtra "already sent")
  function getActiveAlerts(thresholdDays) {
    const days  = thresholdDays ?? WARN_DAYS;
    const vehs  = window.vehs || [];
    const alerts = [];

    vehs.forEach(v => {
      const checks = [
        { field: 'ocEnd',          label: 'OC',                date: v.ocEnd },
        { field: 'acEnd',          label: 'AC',                date: v.acEnd },
        { field: 'nextInspection', label: 'Przegląd tech.',    date: v.nextInspection },
        ...(v.hasUdt && v.udtNextDate   ? [{ field: 'udtNextDate',    label: 'Badanie UDT',      date: v.udtNextDate }]    : []),
        ...(v.hasTacho && v.tachoNextCalib ? [{ field: 'tachoNextCalib', label: 'Legalizacja tacho', date: v.tachoNextCalib }] : []),
        ...(v.tireNextChange ? [{ field: 'tireChange', label: 'Zmiana opon', date: v.tireNextChange }] : []),
        ...(v.serviceHistory||[])
          .filter(s => s.nextServiceDate)
          .map(s => ({ field: 'svc_'+s.id, label: (window.ServiceModule?.SERVICE_TYPES?.[s.type]?.label || 'Serwis'), date: s.nextServiceDate })),
      ];

      checks.forEach(({ field, label, date }) => {
        const d = _daysUntil(date);
        if (d === null || d > days) return;
        alerts.push({
          nrRej:  v.nrRej,
          marka:  v.marka,
          model:  v.model,
          label,
          date,
          days: d,
          urgent: d <= 7,
          expired: d < 0,
        });
      });
    });

    // Alert wygasającego prawa jazdy kierowców
    (window.TaxOrderDrivers?.getAll() || []).forEach(d => {
      if (!d.licenseExpiry) return;
      const dd = _daysUntil(d.licenseExpiry);
      if (dd === null || dd > days) return;
      alerts.push({
        nrRej: '👤 ' + d.name,
        marka: '', model: '',
        label: 'Prawo jazdy',
        date: d.licenseExpiry,
        days: dd,
        urgent: dd <= 7,
        expired: dd < 0,
      });
    });

    alerts.sort((a, b) => a.days - b.days);
    return alerts;
  }

  // Aktualizuje badge na dzwonku w topbarze
  function _updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const alerts = getActiveAlerts();
    const urgent = alerts.filter(a => a.urgent || a.expired).length;
    if (urgent > 0) {
      badge.textContent = urgent > 99 ? '99+' : urgent;
      badge.style.display = 'block';
    } else if (alerts.length > 0) {
      badge.textContent = alerts.length;
      badge.style.display = 'block';
      badge.style.background = 'var(--amber)';
    } else {
      badge.style.display = 'none';
    }
  }

  // Otwiera Centrum Powiadomień (modal)
  async function openCenter() {
    const alerts = getActiveAlerts(60); // szersze okno w centrum
    const perm   = 'Notification' in window ? Notification.permission : 'unsupported';
    const pushSt = await getPushStatus();

    const permHtml = perm === 'granted'
      ? `<div class="gbox" style="margin-bottom:12px"><i class="ti ti-check"></i> Powiadomienia przeglądarkowe <b>włączone</b></div>`
      : perm === 'denied'
      ? `<div class="ebox" style="margin-bottom:12px"><i class="ti ti-alert-circle"></i> Powiadomienia <b>zablokowane</b> — odblokuj w ustawieniach przeglądarki</div>`
      : `<div class="wbox" style="margin-bottom:12px"><i class="ti ti-bell-ringing"></i>
          Powiadomienia nieaktywne &nbsp;
          <button class="btn btn-blue" style="font-size:11px;padding:4px 10px;margin-left:8px"
            onclick="Notification.requestPermission().then(p=>{if(p==='granted'){window.TaxOrderNotifications.check();document.getElementById('notif-center-modal')?.remove();window.TaxOrderNotifications.openCenter();}})">
            Zezwól
          </button>
        </div>`;

    const pushHtml = pushSt === 'unsupported' ? '' : pushSt === 'subscribed'
      ? `<div class="gbox" style="margin-bottom:12px;display:flex;align-items:center;gap:10px">
          <span style="flex:1"><i class="ti ti-device-mobile"></i> Powiadomienia <b>push</b> aktywne — działają gdy aplikacja jest zamknięta</span>
          <button class="btn btn-gray" style="font-size:11px" onclick="window.TaxOrderNotifications.unsubscribeFromPush().then(()=>{document.getElementById('notif-center-modal')?.remove();window.TaxOrderNotifications.openCenter();})">Wyłącz</button>
        </div>`
      : `<div class="wbox" style="margin-bottom:12px;display:flex;align-items:center;gap:10px">
          <span style="flex:1"><i class="ti ti-device-mobile-off"></i> Powiadomienia <b>push</b> nieaktywne (wymagane gdy aplikacja zamknięta)</span>
          <button class="btn btn-blue" style="font-size:11px" onclick="window.TaxOrderNotifications.subscribeToPush().then(ok=>{if(ok){document.getElementById('notif-center-modal')?.remove();window.TaxOrderNotifications.openCenter();}})">Włącz push</button>
        </div>`;

    const expired  = alerts.filter(a => a.expired);
    const urgent7  = alerts.filter(a => !a.expired && a.days <= 7);
    const soon     = alerts.filter(a => !a.expired && a.days > 7);

    function _groupHtml(list, color, label) {
      if (!list.length) return '';
      const rows = list.map(a => {
        const dateStr = a.date ? new Date(a.date).toLocaleDateString('pl-PL') : '—';
        const daysStr = a.expired
          ? `<span style="color:var(--red);font-weight:700">Wygasło ${Math.abs(a.days)} dni temu</span>`
          : `<span style="color:${color};font-weight:600">za ${a.days} dni</span>`;
        return `<tr>
          <td style="font-weight:600">${a.nrRej}</td>
          <td>${a.marka} ${a.model}</td>
          <td>${a.label}</td>
          <td>${dateStr}</td>
          <td>${daysStr}</td>
          <td><button class="btn btn-gray" style="font-size:10px;padding:3px 8px"
            onclick="showPage('pojazdy');document.getElementById('notif-center-modal')?.remove()">Otwórz</button></td>
        </tr>`;
      }).join('');
      return `<div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">${label} (${list.length})</div>
        <div class="tbl-wrap" style="overflow-x:auto">
        <table style="min-width:500px">
          <thead><tr>
            <th>Nr rej.</th><th>Pojazd</th><th>Rodzaj</th><th>Termin</th><th>Pozostało</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div></div>`;
    }

    const body = (!alerts.length)
      ? `<div class="gbox"><i class="ti ti-circle-check"></i> Brak alertów — flota OK</div>`
      : _groupHtml(expired, 'var(--red)', '❌ Przeterminowane')
      + _groupHtml(urgent7, 'var(--amber)', '⚠ Pilne — 7 dni')
      + _groupHtml(soon, 'var(--text2)', '📅 Nadchodzące — 60 dni');

    const html = `<div id="notif-center-modal"
      style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:5000;display:flex;align-items:center;justify-content:center"
      onclick="if(event.target===this)this.remove()">
      <div style="background:var(--bg2);border-radius:var(--radius-lg);width:900px;max-width:97vw;max-height:90vh;
        overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.25);display:flex;flex-direction:column">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0;position:sticky;top:0;background:var(--bg2);z-index:1">
          <i class="ti ti-bell" style="font-size:20px;color:var(--blue)"></i>
          <div style="font-size:16px;font-weight:700;flex:1">Centrum Powiadomień</div>
          <button class="btn btn-gray" style="font-size:11px" onclick="window.TaxOrderNotifications.check()">
            <i class="ti ti-refresh"></i> Sprawdź teraz
          </button>
          <button onclick="document.getElementById('notif-center-modal')?.remove()"
            style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--text2);padding:4px;line-height:1">×</button>
        </div>
        <div style="padding:16px 20px">
          ${permHtml}
          ${pushHtml}
          ${body}
        </div>
      </div>
    </div>`;

    document.getElementById('notif-center-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // Auto-check co godzinę (tylko gdy permissja = granted)
  let _autoCheckTimer = null;
  function _startAutoCheck() {
    if (_autoCheckTimer) return;
    _autoCheckTimer = setInterval(() => {
      if (Notification.permission === 'granted') check();
      _updateBadge();
    }, 60 * 60 * 1000); // co godzinę
  }

  // ── Push subscription (VAPID / Server Push) ──────────────────────────────
  // Używa window.CF_WORKER_URL jeśli zdefiniowane w app.js, inaczej prod default
  function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
  const PUSH_SUB_KEY = 'taxPushSubscribed';

  async function _getVapidPublicKey() {
    try {
      const r = await fetch(`${_cfApi()}/api/push/vapid-public-key`);
      if (!r.ok) return null;
      const d = await r.json();
      return d.key || null;
    } catch { return null; }
  }

  function _urlBase64ToUint8(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast('⚠ Przeglądarka nie obsługuje Push API'); return false;
    }
    const reg = await navigator.serviceWorker.ready;
    const vapidKey = await _getVapidPublicKey();
    if (!vapidKey) { toast('⚠ Serwer push niedostępny — skonfiguruj klucze VAPID'); return false; }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8(vapidKey),
    });

    const company_id = window.currentCompanyId || 'default';
    const r = await fetch(`${_cfApi()}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), company_id, label: navigator.userAgent.slice(0, 50) }),
    });

    if (!r.ok) { toast('❌ Błąd rejestracji push — ' + (await r.json().catch(() => ({}))).error); return false; }

    localStorage.setItem(PUSH_SUB_KEY, JSON.stringify({ company_id, endpoint: sub.endpoint }));
    toast('✓ Powiadomienia push aktywne — otrzymasz alerty nawet gdy aplikacja jest zamknięta');
    return true;
  }

  async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) { localStorage.removeItem(PUSH_SUB_KEY); return; }
    await fetch(`${_cfApi()}/api/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe();
    localStorage.removeItem(PUSH_SUB_KEY);
    toast('✓ Powiadomienia push wyłączone');
  }

  async function getPushStatus() {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return 'unsupported';
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg) return 'no-sw';
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    return sub ? 'subscribed' : 'not-subscribed';
  }

  return { requestAndCheck, check, getActiveAlerts, openCenter, updateBadge: _updateBadge, startAutoCheck: _startAutoCheck, subscribeToPush, unsubscribeFromPush, getPushStatus };
})();
