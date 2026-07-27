/**
 * TaxOrder Pro — Gantt harmonogram pojazdów
 * Canvas-based Gantt chart: dostępność pojazdów / rezerwacje / serwis
 */
window.FleetGantt = (function () {
  'use strict';
  const API = () => window._cfApi?.() || window.WORKER_URL;
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || '';
  const e   = s => typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const ROW_H    = 38;
  const LABEL_W  = 180;
  const HDR_H    = 36;
  const COLORS = {
    reservation: { fill: 'rgba(37,99,235,.75)', border: '#1d4ed8', label: 'Rezerwacja' },
    service:     { fill: 'rgba(234,88,12,.75)',  border: '#c2410c', label: 'Serwis' },
    weekend:     { fill: 'rgba(0,0,0,.04)',       border: 'transparent', label: '' },
    today_line:  '#ef4444',
    grid:        'rgba(0,0,0,.06)',
    label_bg:    '#f8fafc',
    text:        '#374151',
    header:      '#1e293b',
  };

  let _vehs        = [];
  let _events      = [];  // { nr_rej, start, end, type, label, color }
  let _viewDays    = 30;
  let _startDate   = _monthStart();
  let _hoveredCell = null;
  let _canvasEl    = null;
  let _tooltip     = null;

  function _monthStart() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0,10);
  }

  async function _load() {
    const co = Co();
    const from = _startDate;
    const endD = new Date(_startDate);
    endD.setDate(endD.getDate() + _viewDays - 1);
    const to = endD.toISOString().slice(0,10);

    try {
      const [vr, sr] = await Promise.all([
        fetch(`${API()}/api/reservations?company=${encodeURIComponent(co)}&from=${from}&to=${to}`, { headers: H() }),
        fetch(`${API()}/api/service-orders?company=${encodeURIComponent(co)}&from=${from}&to=${to}&status=open,in_progress`, { headers: H() }),
      ]);
      _events = [];

      if (vr.ok) {
        const vd = await vr.json();
        const reservations = vd.reservations || vd || [];
        reservations.forEach(r => {
          _events.push({ nr_rej: r.nr_rej, start: (r.start||'').slice(0,10), end: (r.end||r.start||'').slice(0,10), type: 'reservation', label: e(r.user_name || 'Rezerwacja'), notes: e(r.notes || '') });
        });
      }

      if (sr.ok) {
        const sd = await sr.json();
        const orders = sd.orders || sd || [];
        orders.forEach(o => {
          if (!o.nr_rej) return;
          _events.push({ nr_rej: o.nr_rej, start: (o.scheduled_date||o.created_at||'').slice(0,10), end: (o.scheduled_date||o.created_at||'').slice(0,10), type: 'service', label: e(o.type || o.title || 'Serwis'), notes: e(o.description || '') });
        });
      }
    } catch {}

    // Deduplicate & collect vehicles from window.vehs
    if (window.vehs && window.vehs.length) {
      _vehs = window.vehs.map(v => ({ nr_rej: v.nrRej || v.nr_rej, kierowca: v.kierowca || v.data?.kierowca || '' })).filter(v => v.nr_rej);
    } else {
      // Fallback: collect from events
      const s = new Set(_events.map(ev => ev.nr_rej));
      _vehs = [...s].map(nr => ({ nr_rej: nr, kierowca: '' }));
    }
  }

  async function renderFleetGantt() {
    const el = document.getElementById('page-fleet-gantt');
    if (!el) return;
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)"><i class="ti ti-loader" style="font-size:32px"></i></div>`;
    await _load();
    _render(el);
  }

  function _render(el) {
    if (!el) el = document.getElementById('page-fleet-gantt');
    if (!el) return;

    const startD    = new Date(_startDate + 'T00:00:00');
    const endD      = new Date(_startDate + 'T00:00:00');
    endD.setDate(endD.getDate() + _viewDays - 1);
    const monthLabel = startD.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

    const today = new Date().toISOString().slice(0,10);
    const totalH = HDR_H + _vehs.length * ROW_H + 16;

    el.innerHTML = `
<div class="page-header" style="margin-bottom:14px">
  <h2 style="margin:0"><i class="ti ti-chart-gantt"></i> Harmonogram Gantt pojazdów</h2>
  <div style="display:flex;gap:6px">
    <button class="btn-secondary" onclick="window.FleetGantt.exportPng()"><i class="ti ti-download"></i> PNG</button>
    <button class="btn-primary" onclick="window.FleetGantt.renderFleetGantt()"><i class="ti ti-refresh"></i></button>
  </div>
</div>

<!-- Legenda i nawigacja -->
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:12px">
    <button class="btn-icon" onclick="window.FleetGantt.prevPeriod()"><i class="ti ti-chevron-left"></i></button>
    <span style="font-weight:600;min-width:150px;text-align:center">${e(monthLabel)}</span>
    <button class="btn-icon" onclick="window.FleetGantt.nextPeriod()"><i class="ti ti-chevron-right"></i></button>
    <button class="btn-secondary" style="font-size:12px" onclick="window.FleetGantt.goToday()">Dziś</button>
  </div>
  <div style="display:flex;gap:6px">
    <button style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:${_viewDays===7?'var(--primary)':'transparent'};color:${_viewDays===7?'#fff':'var(--text2)'};cursor:pointer;font-size:12px" onclick="window.FleetGantt.setView(7)">7 dni</button>
    <button style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:${_viewDays===14?'var(--primary)':'transparent'};color:${_viewDays===14?'#fff':'var(--text2)'};cursor:pointer;font-size:12px" onclick="window.FleetGantt.setView(14)">14 dni</button>
    <button style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:${_viewDays===30?'var(--primary)':'transparent'};color:${_viewDays===30?'#fff':'var(--text2)'};cursor:pointer;font-size:12px" onclick="window.FleetGantt.setView(30)">30 dni</button>
  </div>
  <div style="display:flex;gap:10px;font-size:12px">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:14px;height:14px;background:rgba(37,99,235,.75);border-radius:3px;display:inline-block"></span>Rezerwacja</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:14px;height:14px;background:rgba(234,88,12,.75);border-radius:3px;display:inline-block"></span>Serwis</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:2px;height:14px;background:#ef4444;display:inline-block"></span>Dziś</span>
  </div>
</div>

<!-- Canvas -->
<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg)">
  <canvas id="fleet-gantt-canvas" width="${LABEL_W + _viewDays * 28 + 20}" height="${Math.max(totalH, 200)}"
    style="display:block;cursor:pointer"
    onclick="window.FleetGantt._handleClick(event)"
    onmousemove="window.FleetGantt._handleHover(event)"
    onmouseleave="window.FleetGantt._hideTooltip()"></canvas>
</div>

${_vehs.length === 0 ? `<div style="padding:20px;text-align:center;color:var(--text3)">Brak pojazdów. Dodaj pojazdy do floty.</div>` : ''}

<!-- Tooltip -->
<div id="gantt-tooltip" style="display:none;position:fixed;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:9999;pointer-events:none;max-width:220px"></div>
`;

    _canvasEl = document.getElementById('fleet-gantt-canvas');
    _tooltip  = document.getElementById('gantt-tooltip');
    if (_canvasEl && _vehs.length) _drawGantt();
  }

  function _drawGantt() {
    const canvas = _canvasEl;
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const W      = canvas.width;
    const dayW   = (W - LABEL_W) / _viewDays;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || window.matchMedia?.('(prefers-color-scheme:dark)')?.matches;

    ctx.clearRect(0, 0, W, canvas.height);

    const today = new Date().toISOString().slice(0,10);
    const startMs = new Date(_startDate + 'T00:00:00').getTime();

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = isDark ? '#1e293b' : '#f8fafc';
    ctx.fillRect(0, 0, LABEL_W, canvas.height);
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fillRect(LABEL_W, 0, W - LABEL_W, canvas.height);

    // ── Weekend shading + day columns ───────────────────────────────────────
    for (let di = 0; di < _viewDays; di++) {
      const d = new Date(startMs + di * 86400000);
      const x = LABEL_W + di * dayW;
      if (d.getDay() === 0 || d.getDay() === 6) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)';
        ctx.fillRect(x, HDR_H, dayW, canvas.height - HDR_H);
      }
      // Vertical grid
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, HDR_H); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    // ── Header: day labels ───────────────────────────────────────────────────
    ctx.fillStyle = isDark ? '#334155' : '#e2e8f0';
    ctx.fillRect(0, 0, W, HDR_H);

    ctx.textAlign = 'center';
    for (let di = 0; di < _viewDays; di++) {
      const d   = new Date(startMs + di * 86400000);
      const x   = LABEL_W + di * dayW + dayW / 2;
      const iso = d.toISOString().slice(0,10);
      const isToday = iso === today;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      if (dayW > 20) {
        ctx.font = `${isToday?'bold ':''}10px sans-serif`;
        ctx.fillStyle = isToday ? '#ef4444' : isWeekend ? '#9ca3af' : (isDark ? '#94a3b8' : '#475569');
        ctx.fillText(d.getDate(), x, HDR_H / 2 + 4);
      }

      // Day-of-week
      if (dayW > 24) {
        const dow = d.toLocaleDateString('pl-PL', { weekday: 'short' }).slice(0,2).toUpperCase();
        ctx.font = '9px sans-serif';
        ctx.fillStyle = isDark ? '#475569' : '#94a3b8';
        ctx.fillText(dow, x, HDR_H - 5);
      }

      // Today red line
      if (isToday) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(LABEL_W + di * dayW + dayW / 2, HDR_H);
        ctx.lineTo(LABEL_W + di * dayW + dayW / 2, canvas.height);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    // ── Month label in header ────────────────────────────────────────────────
    const mLabel = new Date(_startDate + 'T00:00:00').toLocaleDateString('pl-PL', { month: 'long' });
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = isDark ? '#64748b' : '#475569';
    ctx.fillText(mLabel, LABEL_W + (W - LABEL_W) / 2, 14);

    // ── Vehicle rows ─────────────────────────────────────────────────────────
    _vehs.forEach((v, i) => {
      const y = HDR_H + i * ROW_H;

      // Row bg alt
      if (i % 2 === 1) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.018)';
        ctx.fillRect(LABEL_W, y, W - LABEL_W, ROW_H);
      }

      // Horizontal divider
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + ROW_H); ctx.lineTo(W, y + ROW_H); ctx.stroke();

      // Label area
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
      ctx.fillText(v.nr_rej, 10, y + ROW_H / 2 + 4);
      if (v.kierowca) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = isDark ? '#64748b' : '#9ca3af';
        ctx.fillText(v.kierowca.slice(0, 20), 10, y + ROW_H / 2 + 16);
      }

      // Events for this vehicle
      const eventsForRow = _events.filter(ev => ev.nr_rej === v.nr_rej);
      eventsForRow.forEach(ev => {
        const evStart = new Date(ev.start + 'T00:00:00').getTime();
        const evEnd   = new Date(ev.end + 'T00:00:00').getTime();

        const d0 = Math.max(0, Math.round((evStart - startMs) / 86400000));
        const d1 = Math.min(_viewDays - 1, Math.round((evEnd - startMs) / 86400000));
        if (d0 > _viewDays - 1 || d1 < 0) return;

        const xS = LABEL_W + d0 * dayW + 2;
        const xE = LABEL_W + (d1 + 1) * dayW - 2;
        const bW = Math.max(4, xE - xS);
        const bY = y + 5;
        const bH = ROW_H - 10;

        const cfg = ev.type === 'service' ? COLORS.service : COLORS.reservation;

        // Rounded rect
        const radius = 4;
        ctx.fillStyle = cfg.fill;
        ctx.strokeStyle = cfg.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect?.(xS, bY, bW, bH, radius) ?? ctx.rect(xS, bY, bW, bH);
        ctx.fill();
        ctx.stroke();

        // Label text
        if (bW > 30) {
          ctx.fillStyle = '#fff';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'left';
          ctx.save();
          ctx.rect(xS + 3, bY, bW - 6, bH);
          ctx.clip();
          ctx.fillText(ev.label, xS + 4, bY + bH / 2 + 4);
          ctx.restore();
        }
      });
    });

    // ── Label column divider ─────────────────────────────────────────────────
    ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(LABEL_W, 0); ctx.lineTo(LABEL_W, canvas.height); ctx.stroke();
  }

  // ── Interakcje ──────────────────────────────────────────────────────────────
  function _handleClick(evt) {
    const canvas = _canvasEl;
    if (!canvas || !_vehs.length) return;
    const rect = canvas.getBoundingClientRect();
    const x    = evt.clientX - rect.left;
    const y    = evt.clientY - rect.top;
    if (x < LABEL_W || y < HDR_H) return;

    const dayW = (canvas.width - LABEL_W) / _viewDays;
    const dayIdx = Math.floor((x - LABEL_W) / dayW);
    const rowIdx = Math.floor((y - HDR_H) / ROW_H);
    if (rowIdx < 0 || rowIdx >= _vehs.length) return;

    const clickedDate = new Date(new Date(_startDate + 'T00:00:00').getTime() + dayIdx * 86400000).toISOString().slice(0,10);
    const veh = _vehs[rowIdx];

    // Check if clicking on existing event
    const existing = _events.find(ev => ev.nr_rej === veh.nr_rej && clickedDate >= ev.start && clickedDate <= ev.end);
    if (existing) {
      if(typeof toast==='function') toast(`${existing.type==='service'?'Serwis':'Rezerwacja'}: ${veh.nr_rej} — ${existing.label}`);
      return;
    }

    // Open reservation modal via FleetReservationsModule if available
    if (window.FleetReservationsModule?.openModal) {
      window.FleetReservationsModule.openModal(veh.nr_rej, clickedDate);
    } else {
      if(typeof toast==='function') toast(`Wolny slot: ${veh.nr_rej} — ${clickedDate}`);
    }
  }

  function _handleHover(evt) {
    const canvas = _canvasEl;
    if (!canvas || !_vehs.length) return;
    const rect  = canvas.getBoundingClientRect();
    const mx    = evt.clientX - rect.left;
    const my    = evt.clientY - rect.top;
    if (mx < LABEL_W || my < HDR_H) { _hideTooltip(); return; }

    const dayW  = (canvas.width - LABEL_W) / _viewDays;
    const dayIdx = Math.floor((mx - LABEL_W) / dayW);
    const rowIdx = Math.floor((my - HDR_H) / ROW_H);
    if (rowIdx < 0 || rowIdx >= _vehs.length) { _hideTooltip(); return; }

    const hovDate = new Date(new Date(_startDate + 'T00:00:00').getTime() + dayIdx * 86400000).toISOString().slice(0,10);
    const veh = _vehs[rowIdx];
    const ev  = _events.find(ev => ev.nr_rej === veh.nr_rej && hovDate >= ev.start && hovDate <= ev.end);

    if (!_tooltip) return;
    if (ev) {
      _tooltip.style.display = 'block';
      _tooltip.style.left = (evt.clientX + 12) + 'px';
      _tooltip.style.top  = (evt.clientY - 10) + 'px';
      _tooltip.innerHTML  = `<strong>${e(veh.nr_rej)}</strong><br><span style="color:${ev.type==='service'?'var(--orange)':'var(--blue)'}">
        ${e(ev.type==='service'?'Serwis':'Rezerwacja')}
      </span><br>${e(ev.label)}<br>
      <span style="color:var(--text3)">${e(ev.start)} → ${e(ev.end)}</span>
      ${ev.notes ? `<br><span style="color:var(--text3)">${e(ev.notes)}</span>` : ''}`;
    } else {
      _tooltip.style.display = 'block';
      _tooltip.style.left = (evt.clientX + 12) + 'px';
      _tooltip.style.top  = (evt.clientY - 10) + 'px';
      _tooltip.innerHTML  = `<strong>${e(veh.nr_rej)}</strong><br><span style="color:var(--green)">Wolny — ${e(hovDate)}</span><br><small style="color:var(--text3)">Kliknij, aby dodać rezerwację</small>`;
    }
  }

  function _hideTooltip() {
    if (_tooltip) _tooltip.style.display = 'none';
  }

  // ── Nawigacja ────────────────────────────────────────────────────────────────
  function prevPeriod() {
    const d = new Date(_startDate + 'T00:00:00');
    d.setDate(d.getDate() - _viewDays);
    _startDate = d.toISOString().slice(0,10);
    renderFleetGantt();
  }
  function nextPeriod() {
    const d = new Date(_startDate + 'T00:00:00');
    d.setDate(d.getDate() + _viewDays);
    _startDate = d.toISOString().slice(0,10);
    renderFleetGantt();
  }
  function goToday() {
    _startDate = _monthStart();
    renderFleetGantt();
  }
  function setView(days) {
    _viewDays = days;
    renderFleetGantt();
  }

  function exportPng() {
    if (!_canvasEl) return;
    const a = document.createElement('a');
    a.download = `gantt-${_startDate}.png`;
    a.href = _canvasEl.toDataURL('image/png');
    a.click();
  }

  return { renderFleetGantt, prevPeriod, nextPeriod, goToday, setView, exportPng, _handleClick, _handleHover, _hideTooltip };
})();
