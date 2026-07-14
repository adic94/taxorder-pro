/**
 * TaxOrder Pro — Widok Kanban Floty
 * Prezentuje pojazdy jako karty pogrupowane wg statusu w 5 kolumnach.
 * Obsługuje przeciąganie kart między kolumnami (HTML5 drag & drop).
 */
(function () {
  'use strict';

  const e = s => typeof esc === 'function'
    ? esc(s)
    : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── Konfiguracja kolumn ─────────────────────────────────────────────────────
  const COLS = [
    { status: 'aktywny',        label: 'Aktywny',        headerColor: '#16a34a', bgColor: '#f0fdf4' },
    { status: 'serwis',         label: 'Serwis',         headerColor: '#d97706', bgColor: '#fffbeb' },
    { status: 'rezerwacja',     label: 'Rezerwacja',     headerColor: '#2563eb', bgColor: '#eff6ff' },
    { status: 'wyrejestrowany', label: 'Wyrejestrowany', headerColor: '#6b7280', bgColor: '#f9fafb' },
    { status: 'sprzedany',      label: 'Sprzedany',      headerColor: '#dc2626', bgColor: '#fef2f2' },
  ];

  const VALID_STATUSES = new Set(COLS.map(c => c.status));

  const PILL_STYLE = {
    aktywny:        'background:#dcfce7;color:#166534',
    serwis:         'background:#fef9c3;color:#92400e',
    rezerwacja:     'background:#dbeafe;color:#1e40af',
    wyrejestrowany: 'background:#f3f4f6;color:#374151',
    sprzedany:      'background:#fee2e2;color:#991b1b',
  };

  // ID pojazdu aktualnie przeciąganego (nie używamy dataTransfer aby uniknąć problemów cross-browser)
  let _draggedId = null;

  // ── Pomocnicze ─────────────────────────────────────────────────────────────

  function _statusPill(status) {
    const s = String(status ?? '');
    const style = PILL_STYLE[s] ?? 'background:#f3f4f6;color:#374151';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;${style}">${e(s || '—')}</span>`;
  }

  // ── Karta pojazdu ───────────────────────────────────────────────────────────
  function _card(v) {
    const title = [v.marka, v.model].filter(Boolean).join(' ');
    return `<div
      draggable="true"
      data-id="${e(String(v.id ?? ''))}"
      data-nrrej="${e(v.nrRej ?? '')}"
      style="background:var(--bg-card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:box-shadow .15s,opacity .15s;user-select:none"
      onclick="window.FleetKanbanModule._onCardClick(this.dataset.nrrej)"
      ondragstart="window.FleetKanbanModule._onDragStart(this.dataset.id)"
      ondragend="window.FleetKanbanModule._onDragEnd(this)"
    >
      <div style="font-weight:700;font-size:14px;margin-bottom:3px">${e(v.nrRej ?? '—')}</div>
      ${title ? `<div style="font-size:12px;color:var(--text-muted,#6b7280);margin-bottom:3px">${e(title)}</div>` : ''}
      ${v.kierowca ? `<div style="font-size:12px;color:var(--text2,#374151);margin-bottom:4px"><i class="ti ti-user" style="font-size:11px"></i> ${e(v.kierowca)}</div>` : ''}
      ${_statusPill(v.status)}
    </div>`;
  }

  // ── Kolumna Kanban ──────────────────────────────────────────────────────────
  function _col(col, vehs) {
    const cards = vehs.filter(v => String(v.status ?? '').toLowerCase() === col.status);
    return `<div style="flex:1;min-width:180px;max-width:260px;display:flex;flex-direction:column">
      <div style="background:${col.headerColor};color:#fff;border-radius:8px 8px 0 0;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:13px;flex-shrink:0">
        ${e(col.label)}
        <span style="background:rgba(255,255,255,.28);border-radius:999px;padding:1px 9px;font-size:12px;font-weight:700">${cards.length}</span>
      </div>
      <div
        data-status="${e(col.status)}"
        style="flex:1;min-height:140px;background:${col.bgColor};border:2px dashed transparent;border-top:none;border-radius:0 0 8px 8px;padding:8px;transition:border-color .15s,background .15s"
        ondragover="event.preventDefault();this.style.borderColor='${col.headerColor}'"
        ondragleave="this.style.borderColor='transparent'"
        ondrop="window.FleetKanbanModule._onDrop(this.dataset.status);this.style.borderColor='transparent'"
      >
        ${cards.length
          ? cards.map(_card).join('')
          : `<div style="color:var(--text-muted,#9ca3af);font-size:12px;text-align:center;padding-top:20px">Brak pojazdów</div>`
        }
      </div>
    </div>`;
  }

  // ── Render główny ───────────────────────────────────────────────────────────
  function renderFleetKanban() {
    const el = document.getElementById('page-fleet-kanban');
    if (!el) return;
    const vehs = window.vehs || [];
    const total = vehs.length;

    el.innerHTML = `
<div class="page-header" style="margin-bottom:16px">
  <h2 style="display:flex;align-items:center;gap:8px"><i class="ti ti-layout-kanban"></i> Widok Kanban — Flota</h2>
  <span style="font-size:13px;color:var(--text-muted,#6b7280)">${total} pojazd${total === 1 ? '' : total < 5 ? 'y' : 'ów'} łącznie</span>
</div>
<div style="display:flex;gap:12px;align-items:flex-start;overflow-x:auto;padding-bottom:12px;min-height:300px">
  ${COLS.map(col => _col(col, vehs)).join('')}
</div>
<p style="font-size:11px;color:var(--text-muted,#9ca3af);margin-top:4px">
  <i class="ti ti-drag-drop" style="font-size:12px"></i> Przeciągnij kartę pojazdu do innej kolumny, aby zmienić status
</p>`;
  }

  // ── Obsługa zdarzeń ─────────────────────────────────────────────────────────

  function _onCardClick(nrRej) {
    if (typeof window.showVehicleDetail === 'function') {
      window.showVehicleDetail(nrRej);
    }
  }

  function _onDragStart(id) {
    _draggedId = id;
  }

  function _onDragEnd(el) {
    // Przywróć wygląd karty jeśli drop nie nastąpił w kolumnie
    if (el && el.style) el.style.opacity = '';
  }

  function _onDrop(newStatus) {
    if (!_draggedId) return;

    // Walidacja statusu — tylko nasze własne wartości
    if (!VALID_STATUSES.has(newStatus)) {
      _draggedId = null;
      return;
    }

    const vehs = window.vehs || [];
    const v = vehs.find(x => String(x.id ?? '') === String(_draggedId));

    if (!v) { _draggedId = null; return; }

    const prevStatus = String(v.status ?? '');
    if (prevStatus === newStatus) { _draggedId = null; return; }

    // Zapisz nowy status
    if (typeof window.setV === 'function') {
      window.setV(v.id, 'status', newStatus);
    }

    // Optymistyczna aktualizacja lokalnego obiektu
    v.status = newStatus;
    _draggedId = null;

    // Przerysuj widok
    renderFleetKanban();
  }

  // ── Eksport ─────────────────────────────────────────────────────────────────
  window.FleetKanbanModule = {
    renderFleetKanban,
    _onCardClick,
    _onDragStart,
    _onDragEnd,
    _onDrop,
  };
})();
