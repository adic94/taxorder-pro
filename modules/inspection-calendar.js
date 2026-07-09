/**
 * TaxOrder Pro — Terminarz przeglądów i ubezpieczeń
 * Pokazuje nadchodzące terminy (OC, AC, przegląd tech., UDT, tachograf)
 * posortowane po liczbie dni. Eksport do ICS z alarmami 14-dniowymi.
 */
window.TaxOrderInspectionCalendar = (function () {

  let _horizon = 90;  // dni do przodu
  let _filter  = '';  // '' | 'oc' | 'ac' | 'insp' | 'udt' | 'tacho'

  function _days(ds) {
    if (!ds) return null;
    const d = new Date(ds.includes('T') ? ds : ds + 'T00:00:00');
    if (isNaN(d)) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
  }

  function _fmtDate(ds) {
    if (!ds) return '—';
    const d = new Date(ds.includes('T') ? ds : ds + 'T00:00:00');
    return isNaN(d) ? ds : d.toLocaleDateString('pl-PL');
  }

  function _pill(days) {
    if (days === null) return '<span style="color:var(--text3)">—</span>';
    if (days < 0)   return `<span class="pill pill-red">Minął ${Math.abs(days)} dni temu</span>`;
    if (days === 0) return `<span class="pill pill-red">Dziś!</span>`;
    if (days <= 7)  return `<span class="pill pill-red">${days} dni</span>`;
    if (days <= 30) return `<span class="pill pill-amber">${days} dni</span>`;
    return `<span class="pill pill-green">${days} dni</span>`;
  }

  function _rowBg(days) {
    if (days < 0)    return 'background:rgba(220,38,38,.05)';
    if (days <= 7)   return 'background:rgba(245,158,11,.05)';
    return '';
  }

  const ENTRY_DEFS = [
    { type: 'oc',    label: 'OC',            icon: 'ti-shield-check',  field: 'ocEnd' },
    { type: 'ac',    label: 'AC/Casco',       icon: 'ti-shield-half',   field: 'acEnd' },
    { type: 'insp',  label: 'Przegląd tech.', icon: 'ti-tools',         field: 'nextInspection' },
    { type: 'udt',   label: 'UDT',            icon: 'ti-certificate',   field: 'udtNextDate' },
    { type: 'tacho', label: 'Tachograf',      icon: 'ti-speedometer',   field: 'tachoNextCalib' },
  ];

  function _buildRows() {
    const rows = [];
    (window.vehs || []).filter(v => v.is_active !== false).forEach(v => {
      ENTRY_DEFS.forEach(({ type, label, icon, field }) => {
        const date = v[field];
        if (!date) return;
        const days = _days(date);
        if (days === null) return;
        if (_filter && _filter !== type) return;
        if (days > _horizon) return;
        rows.push({ v, type, label, icon, date, days });
      });
    });
    return rows.sort((a, b) => a.days - b.days);
  }

  function _updateStats(rows) {
    const set = (id, n) => { const e = document.getElementById(id); if (e) e.textContent = n; };
    set('insp-stat-expired', rows.filter(r => r.days < 0).length);
    set('insp-stat-7',       rows.filter(r => r.days >= 0 && r.days <= 7).length);
    set('insp-stat-30',      rows.filter(r => r.days > 7  && r.days <= 30).length);
    set('insp-stat-ok',      rows.filter(r => r.days > 30).length);
  }

  function load() { render(); }

  function render() {
    const tbody = document.getElementById('insp-cal-tbody');
    if (!tbody) return;

    const rows = _buildRows();
    _updateStats(rows);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem;color:var(--text3)">
        <i class="ti ti-circle-check" style="font-size:40px;display:block;margin-bottom:10px;color:var(--green)"></i>
        <div style="font-size:14px;font-weight:500">Brak terminów do wyświetlenia</div>
        <div style="font-size:12px;margin-top:4px">Horyzont: ${_horizon} dni${_filter ? ` · filtr: ${ENTRY_DEFS.find(d=>d.type===_filter)?.label||_filter}` : ''}</div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `<tr style="${_rowBg(r.days)}">
      <td style="font-family:var(--mono);font-weight:700;white-space:nowrap">${esc(r.v.nrRej || '—')}</td>
      <td style="font-size:12px">${esc([r.v.marka, r.v.model].filter(Boolean).join(' ') || '—')}</td>
      <td style="font-size:12px"><i class="ti ${r.icon}" style="margin-right:5px;color:var(--blue)"></i>${esc(r.label)}</td>
      <td style="font-family:var(--mono);font-size:12px;white-space:nowrap">${_fmtDate(r.date)}</td>
      <td>${_pill(r.days)}</td>
      <td>
        <button class="tbtn" data-id="${esc(String(r.v.id ?? ''))}"
          onclick="if(typeof TaxOrderVehicleDetail!=='undefined') TaxOrderVehicleDetail.open(parseInt(this.dataset.id))"
          title="Otwórz kartę pojazdu"><i class="ti ti-external-link"></i></button>
      </td>
    </tr>`).join('');
  }

  function setHorizon(val) {
    _horizon = parseInt(val) || 90;
    render();
  }

  function setFilter(val) {
    _filter = val || '';
    render();
  }

  // ── ICS Export ────────────────────────────────────────────────────────────────
  function exportIcs() {
    const rows = _buildRows();
    if (!rows.length) { if (typeof toast === 'function') toast('Brak terminów do eksportu'); return; }

    const pad = (n, l = 2) => String(n).padStart(l, '0');
    function toIcsDate(ds) {
      const d = new Date(ds.includes('T') ? ds : ds + 'T00:00:00');
      if (isNaN(d)) return null;
      return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TaxOrder Pro//Terminarz przeglądów//PL',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Terminarz floty — TaxOrder Pro',
      'X-WR-TIMEZONE:Europe/Warsaw',
    ];

    rows.forEach(r => {
      const dtDate = toIcsDate(r.date);
      if (!dtDate) return;
      // DTEND dla all-day = następny dzień
      const d = new Date(r.date.includes('T') ? r.date : r.date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const dtEnd = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
      const uid = `taxorder-${r.v.nrRej}-${r.type}-${r.date}`.replace(/[^a-zA-Z0-9@._-]/g, '_') + '@taxorder-pro';
      const summary = `[${r.label}] ${r.v.nrRej || '?'}${r.v.marka ? ' ' + r.v.marka : ''}${r.v.model ? ' ' + r.v.model : ''}`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${dtDate}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${summary.replace(/[,\\;]/g, s => '\\' + s)}`,
        `DESCRIPTION:Termin ${r.label} dla pojazdu ${r.v.nrRej || '?'}. Wygenerowano przez TaxOrder Pro.`,
        `CATEGORIES:${r.label}`,
        'BEGIN:VALARM',
        'TRIGGER:-P30D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Przypomnienie 30 dni: ${summary}`,
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-P7D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Przypomnienie 7 dni: ${summary}`,
        'END:VALARM',
        'END:VEVENT',
      );
    });

    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `terminarz-floty-${new Date().toISOString().substring(0, 10)}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    if (typeof toast === 'function') toast(`✓ Eksportowano ${rows.length} terminów do pliku ICS`);
  }

  return { load, render, setHorizon, setFilter, exportIcs };
})();
