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
    });

    if (sent > 0) console.log(`[Notifications] Wysłano ${sent} powiadomień`);
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

  return { requestAndCheck, check };
})();
