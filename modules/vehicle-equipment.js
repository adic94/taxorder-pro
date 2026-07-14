/**
 * TaxOrder Pro — Moduł Wyposażenia Pojazdów
 * Zarządza akcesoriami/wyposażeniem per pojazd (v.equipment[]).
 * Dane zapisywane do JSON blob pojazdu przez window.setV().
 */
(function () {
  'use strict';

  const API = () => window._cfApi?.() || window.CF_WORKER_URL || '';
  const H   = () => window._cfHdrs?.() || {};
  const Co  = () => window._cfCo?.()   || window.currentCompanyId || 'mtoilet';

  const CATEGORIES = ['Elektronika', 'Bezpieczeństwo', 'Nawigacja', 'Inne'];
  const CAT_PILL = {
    'Elektronika':    'pill-blue',
    'Bezpieczeństwo': 'pill-red',
    'Nawigacja':      'pill-green',
    'Inne':           'pill-amber',
  };

  // ── Filter state (persists across re-renders) ──────────────────────────────
  let _filterText   = '';
  let _filterCat    = '';
  let _filterActive = true;
  let _expandedVehs = new Set();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _today() { return new Date().toLocaleDateString('sv'); }

  function _fmtDate(d) {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  function _fmtVal(n) {
    return (n ?? 0).toLocaleString('pl-PL') + ' zł';
  }

  function _getEquipment(v) {
    try {
      const raw = v.equipment;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') return JSON.parse(raw);
      return [];
    } catch { return []; }
  }

  function _isActive(eq) { return !eq.removeDate; }

  function _catPill(cat) {
    const cls = CAT_PILL[cat] || 'pill-amber';
    return `<span class="pill ${cls}" style="font-size:11px">${esc(cat ?? 'Inne')}</span>`;
  }

  // ── Equipment CRUD ─────────────────────────────────────────────────────────
  function addEquipment(vehId, formData) {
    const v = (window.vehs || []).find(x => x.id === vehId);
    if (!v) return;
    const eq = _getEquipment(v);
    const rawVal = parseFloat(formData.value);
    eq.push({
      id:          'eq_' + Date.now(),
      name:        formData.name || '',
      category:    formData.category || 'Inne',
      serialNo:    formData.serialNo || '',
      installDate: formData.installDate || _today(),
      removeDate:  null,
      value:       Number.isNaN(rawVal) ? 0 : rawVal,
      notes:       formData.notes || '',
    });
    if (typeof setV === 'function') setV(vehId, 'equipment', eq);
    _expandedVehs.add(vehId);
    renderVehicleEquipment();
    window.toast?.('Wyposażenie dodane');
  }

  function editEquipment(vehId, eqId, formData) {
    const v = (window.vehs || []).find(x => x.id === vehId);
    if (!v) return;
    const eq = _getEquipment(v);
    const idx = eq.findIndex(x => x.id === eqId);
    if (idx === -1) return;
    const rawVal = parseFloat(formData.value);
    eq[idx] = {
      ...eq[idx],
      name:        formData.name        ?? eq[idx].name,
      category:    formData.category    ?? eq[idx].category,
      serialNo:    formData.serialNo    ?? eq[idx].serialNo,
      installDate: formData.installDate ?? eq[idx].installDate,
      value:       formData.value !== undefined ? (Number.isNaN(rawVal) ? 0 : rawVal) : (eq[idx].value ?? 0),
      notes:       formData.notes       ?? eq[idx].notes,
    };
    if (typeof setV === 'function') setV(vehId, 'equipment', eq);
    _expandedVehs.add(vehId);
    renderVehicleEquipment();
    window.toast?.('Wyposażenie zaktualizowane');
  }

  function removeEquipment(vehId, eqId) {
    const v = (window.vehs || []).find(x => x.id === vehId);
    if (!v) return;
    const eq = _getEquipment(v);
    const idx = eq.findIndex(x => x.id === eqId);
    if (idx === -1) return;
    eq[idx] = { ...eq[idx], removeDate: _today() };
    if (typeof setV === 'function') setV(vehId, 'equipment', eq);
    _expandedVehs.add(vehId);
    renderVehicleEquipment();
    window.toast?.('Wyposażenie zdemontowane');
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function _closeModal() {
    const m = document.getElementById('eq-modal');
    if (m) m.style.display = 'none';
  }

  function _ensureModal() {
    let modal = document.getElementById('eq-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'eq-modal';
      modal.style.cssText =
        'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function _catOptions(selected) {
    return CATEGORIES.map(c =>
      `<option value="${esc(c)}" ${c === selected ? 'selected' : ''}>${esc(c)}</option>`
    ).join('');
  }

  function _modalFields(data) {
    return `
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Nazwa wyposażenia *</label>
        <input id="eq-f-name" type="text" class="form-input" style="width:100%;box-sizing:border-box"
          placeholder="np. Kamera cofania" value="${esc(data.name ?? '')}">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Kategoria</label>
        <select id="eq-f-cat" class="form-input" style="width:100%;box-sizing:border-box">
          ${_catOptions(data.category ?? 'Elektronika')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Nr seryjny</label>
        <input id="eq-f-serial" type="text" class="form-input" style="width:100%;box-sizing:border-box"
          placeholder="np. SN123456" value="${esc(data.serialNo ?? '')}">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Data montażu</label>
        <input id="eq-f-install" type="date" class="form-input" style="width:100%;box-sizing:border-box"
          value="${esc(data.installDate ?? _today())}">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Wartość (PLN)</label>
        <input id="eq-f-value" type="number" class="form-input" style="width:100%;box-sizing:border-box"
          min="0" step="0.01" placeholder="0.00" value="${esc(String(data.value ?? ''))}">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Uwagi</label>
        <textarea id="eq-f-notes" class="form-input"
          style="width:100%;box-sizing:border-box;resize:vertical;min-height:60px"
          placeholder="Opcjonalne uwagi">${esc(data.notes ?? '')}</textarea>
      </div>`;
  }

  // ── Part C — Add modal (per-vehicle) ──────────────────────────────────────
  function openAddModal(vehId) {
    const v = (window.vehs || []).find(x => x.id === vehId);
    const modal = _ensureModal();
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div style="background:var(--bg,#fff);border-radius:12px;padding:28px;width:460px;max-width:95vw;
        box-shadow:0 8px 32px rgba(0,0,0,.22);max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h3 style="margin:0;font-size:17px">Dodaj wyposażenie</h3>
          <button class="btn btn-icon" onclick="VehicleEquipmentModule._closeModal()"><i class="ti ti-x"></i></button>
        </div>
        ${v ? `<div style="font-size:12px;color:var(--text2,#6b7280);margin-bottom:16px">
          <i class="ti ti-truck" style="margin-right:4px"></i>
          ${esc(v.nrRej ?? '')} &mdash; ${esc(v.marka ?? '')} ${esc(v.model ?? '')}
        </div>` : ''}
        <div style="display:flex;flex-direction:column;gap:12px">
          ${_modalFields({ category: 'Elektronika', installDate: _today() })}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button class="btn btn-secondary" onclick="VehicleEquipmentModule._closeModal()">Anuluj</button>
          <button class="btn btn-blue"
            data-vehid="${vehId}"
            onclick="VehicleEquipmentModule._saveFromModal(parseInt(this.dataset.vehid), null)">
            <i class="ti ti-check"></i>Zapisz
          </button>
        </div>
      </div>`;
  }

  // ── Edit modal ─────────────────────────────────────────────────────────────
  function openEditModal(vehId, eqId) {
    const v = (window.vehs || []).find(x => x.id === vehId);
    if (!v) return;
    const eq = _getEquipment(v).find(x => x.id === eqId);
    if (!eq) return;
    const modal = _ensureModal();
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div style="background:var(--bg,#fff);border-radius:12px;padding:28px;width:460px;max-width:95vw;
        box-shadow:0 8px 32px rgba(0,0,0,.22);max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h3 style="margin:0;font-size:17px">Edytuj wyposażenie</h3>
          <button class="btn btn-icon" onclick="VehicleEquipmentModule._closeModal()"><i class="ti ti-x"></i></button>
        </div>
        <div style="font-size:12px;color:var(--text2,#6b7280);margin-bottom:16px">
          <i class="ti ti-truck" style="margin-right:4px"></i>
          ${esc(v.nrRej ?? '')} &mdash; ${esc(v.marka ?? '')} ${esc(v.model ?? '')}
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${_modalFields(eq)}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button class="btn btn-secondary" onclick="VehicleEquipmentModule._closeModal()">Anuluj</button>
          <button class="btn btn-blue"
            data-vehid="${vehId}"
            data-eqid="${esc(eqId)}"
            onclick="VehicleEquipmentModule._saveFromModal(parseInt(this.dataset.vehid), this.dataset.eqid)">
            <i class="ti ti-check"></i>Zapisz
          </button>
        </div>
      </div>`;
  }

  function _saveFromModal(vehId, eqId) {
    const name = document.getElementById('eq-f-name')?.value?.trim();
    if (!name) { window.toast?.('Podaj nazwę wyposażenia'); return; }
    const rawVal = parseFloat(document.getElementById('eq-f-value')?.value ?? '');
    const formData = {
      name,
      category:    document.getElementById('eq-f-cat')?.value              || 'Inne',
      serialNo:    document.getElementById('eq-f-serial')?.value?.trim()   || '',
      installDate: document.getElementById('eq-f-install')?.value          || _today(),
      value:       Number.isNaN(rawVal) ? 0 : rawVal,
      notes:       document.getElementById('eq-f-notes')?.value?.trim()    || '',
    };
    _closeModal();
    if (eqId) {
      editEquipment(vehId, eqId, formData);
    } else {
      addEquipment(vehId, formData);
    }
  }

  // ── Global add modal (with vehicle picker) ─────────────────────────────────
  function _openGlobalAddModal() {
    const vehs = window.vehs || [];
    const vehOptions = vehs.map(v =>
      `<option value="${v.id}">${esc(v.nrRej ?? '')} — ${esc(v.marka ?? '')} ${esc(v.model ?? '')}</option>`
    ).join('');
    const modal = _ensureModal();
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div style="background:var(--bg,#fff);border-radius:12px;padding:28px;width:460px;max-width:95vw;
        box-shadow:0 8px 32px rgba(0,0,0,.22);max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h3 style="margin:0;font-size:17px">Dodaj wyposażenie</h3>
          <button class="btn btn-icon" onclick="VehicleEquipmentModule._closeModal()"><i class="ti ti-x"></i></button>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Pojazd *</label>
            <select id="eq-f-veh" class="form-input" style="width:100%;box-sizing:border-box">${vehOptions}</select>
          </div>
          ${_modalFields({ category: 'Elektronika', installDate: _today() })}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button class="btn btn-secondary" onclick="VehicleEquipmentModule._closeModal()">Anuluj</button>
          <button class="btn btn-blue" onclick="VehicleEquipmentModule._saveFromGlobalModal()">
            <i class="ti ti-check"></i>Zapisz
          </button>
        </div>
      </div>`;
  }

  function _saveFromGlobalModal() {
    const vehId = parseInt(document.getElementById('eq-f-veh')?.value ?? '');
    const name = document.getElementById('eq-f-name')?.value?.trim();
    if (!name) { window.toast?.('Podaj nazwę wyposażenia'); return; }
    const rawVal = parseFloat(document.getElementById('eq-f-value')?.value ?? '');
    const formData = {
      name,
      category:    document.getElementById('eq-f-cat')?.value              || 'Inne',
      serialNo:    document.getElementById('eq-f-serial')?.value?.trim()   || '',
      installDate: document.getElementById('eq-f-install')?.value          || _today(),
      value:       Number.isNaN(rawVal) ? 0 : rawVal,
      notes:       document.getElementById('eq-f-notes')?.value?.trim()    || '',
    };
    _closeModal();
    addEquipment(vehId, formData);
  }

  // ── Expand / collapse per-vehicle sub-table ────────────────────────────────
  function toggleExpand(vehId) {
    if (_expandedVehs.has(vehId)) {
      _expandedVehs.delete(vehId);
    } else {
      _expandedVehs.add(vehId);
    }
    const sub  = document.getElementById(`eq-sub-${vehId}`);
    const icon = document.getElementById(`eq-icon-${vehId}`);
    if (sub)  sub.style.display = _expandedVehs.has(vehId) ? '' : 'none';
    if (icon) icon.className = _expandedVehs.has(vehId) ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
  }

  // ── Filter controls ────────────────────────────────────────────────────────
  function applyFilters() {
    _filterText   = document.getElementById('eq-search')?.value       ?? '';
    _filterCat    = document.getElementById('eq-cat-filter')?.value   ?? '';
    _filterActive = document.getElementById('eq-active-only')?.checked ?? true;
    renderVehicleEquipment();
  }

  // ── Main render ───────────────────────────────────────────────────────────
  function renderVehicleEquipment() {
    const el = document.getElementById('page-vehicle-equipment');
    if (!el) return;

    const vehs = window.vehs || [];
    const searchLow = _filterText.toLowerCase();

    // Part E — KPI aggregates (across all vehicles, ignoring current filters)
    let totalActiveCount = 0;
    let totalActiveValue = 0;
    const catFreq = {};
    vehs.forEach(v => {
      _getEquipment(v).forEach(eq => {
        if (!_isActive(eq)) return;
        totalActiveCount++;
        totalActiveValue += eq.value ?? 0;
        const cat = eq.category || 'Inne';
        catFreq[cat] = (catFreq[cat] ?? 0) + 1;
      });
    });
    const topCat = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    const kpisHtml = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        <div class="stat-chip">
          <span style="font-size:18px;font-weight:700">${totalActiveCount}</span>
          <span style="font-size:11px;color:var(--text2,#6b7280);display:block">aktywnych pozycji</span>
        </div>
        <div class="stat-chip">
          <span style="font-size:18px;font-weight:700">${totalActiveValue.toLocaleString('pl-PL')} zł</span>
          <span style="font-size:11px;color:var(--text2,#6b7280);display:block">łączna wartość</span>
        </div>
        <div class="stat-chip">
          <span style="font-size:18px;font-weight:700">${esc(topCat)}</span>
          <span style="font-size:11px;color:var(--text2,#6b7280);display:block">najpopularniejsza kategoria</span>
        </div>
      </div>`;

    // Part A — Filter bar
    const catFilterOpts = ['', ...CATEGORIES].map(c =>
      `<option value="${esc(c)}" ${_filterCat === c ? 'selected' : ''}>${c ? esc(c) : 'Wszystkie kategorie'}</option>`
    ).join('');

    const filterHtml = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <input id="eq-search" type="search" class="form-input" style="width:210px"
          placeholder="Szukaj pojazdu / wyposażenia..."
          value="${esc(_filterText)}"
          oninput="VehicleEquipmentModule.applyFilters()">
        <select id="eq-cat-filter" class="form-input" style="width:180px"
          onchange="VehicleEquipmentModule.applyFilters()">
          ${catFilterOpts}
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;white-space:nowrap">
          <input type="checkbox" id="eq-active-only"
            ${_filterActive ? 'checked' : ''}
            onchange="VehicleEquipmentModule.applyFilters()">
          Tylko aktywne
        </label>
        <button class="btn btn-blue" style="margin-left:auto"
          onclick="VehicleEquipmentModule._openGlobalAddModal()">
          <i class="ti ti-plus"></i>Dodaj wyposażenie
        </button>
      </div>`;

    // Part B — Vehicle rows with expandable equipment sub-tables
    const vehicleRows = vehs.map(v => {
      const allEq = _getEquipment(v);
      let visibleEq = _filterActive ? allEq.filter(_isActive) : allEq;
      if (_filterCat) visibleEq = visibleEq.filter(eq => eq.category === _filterCat);

      // Text search: if vehicle matches, show all its visible equipment; else filter equipment by name/serial
      if (searchLow) {
        const vehMatch =
          (v.nrRej ?? '').toLowerCase().includes(searchLow) ||
          (v.marka  ?? '').toLowerCase().includes(searchLow) ||
          (v.model  ?? '').toLowerCase().includes(searchLow);
        if (!vehMatch) {
          visibleEq = visibleEq.filter(eq =>
            (eq.name     ?? '').toLowerCase().includes(searchLow) ||
            (eq.serialNo ?? '').toLowerCase().includes(searchLow)
          );
        }
        if (!vehMatch && !visibleEq.length) return '';
      } else {
        if (!visibleEq.length) return '';
      }

      const activeCount = allEq.filter(_isActive).length;
      const totalVal = visibleEq.reduce((s, eq) => s + (eq.value ?? 0), 0);
      const isExpanded = _expandedVehs.has(v.id);
      const preview = visibleEq.slice(0, 3).map(eq => esc(eq.name ?? '')).join(', ')
        + (visibleEq.length > 3 ? ` +${visibleEq.length - 3} więcej` : '');

      // Part B sub-table rows
      const eqRows = visibleEq.map(eq => {
        const active = _isActive(eq);
        return `<tr style="${active ? '' : 'opacity:.55'}">
          <td>${esc(eq.name ?? '')}</td>
          <td>${_catPill(eq.category ?? 'Inne')}</td>
          <td style="color:var(--text2,#6b7280);font-size:11px">${esc(eq.serialNo ?? '—')}</td>
          <td style="font-size:12px">${esc(_fmtDate(eq.installDate))}</td>
          <td style="font-size:12px">
            ${eq.removeDate
              ? `<span style="color:var(--red,#dc2626)">${esc(_fmtDate(eq.removeDate))}</span>`
              : '<span style="color:var(--green,#16a34a)">Aktywne</span>'}
          </td>
          <td style="text-align:right">${esc(_fmtVal(eq.value))}</td>
          <td style="color:var(--text2,#6b7280);font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(eq.notes ?? '')}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm" title="Edytuj"
                data-vehid="${v.id}"
                data-eqid="${esc(eq.id ?? '')}"
                onclick="VehicleEquipmentModule.openEditModal(parseInt(this.dataset.vehid), this.dataset.eqid)">
                <i class="ti ti-pencil"></i>
              </button>
              ${active ? `
              <button class="btn btn-sm btn-amber" title="Zdemontuj"
                data-vehid="${v.id}"
                data-eqid="${esc(eq.id ?? '')}"
                onclick="if(confirm('Zdemontować to wyposażenie?'))VehicleEquipmentModule.removeEquipment(parseInt(this.dataset.vehid),this.dataset.eqid)">
                <i class="ti ti-tool"></i>Usuń
              </button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');

      return `
        <tr style="background:var(--bg2,#f9fafb)">
          <td>
            <button class="btn btn-sm btn-icon" style="margin-right:6px"
              data-vehid="${v.id}"
              onclick="VehicleEquipmentModule.toggleExpand(parseInt(this.dataset.vehid))">
              <i id="eq-icon-${v.id}" class="ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}"></i>
            </button>
            <a href="#" data-nrrej="${esc(v.nrRej ?? '')}"
              onclick="event.preventDefault();if(window.showVehicleDetail)showVehicleDetail(this.dataset.nrrej)"
              style="font-weight:600;color:var(--blue,#3b82f6)">
              ${esc(v.nrRej ?? '')}
            </a>
          </td>
          <td>${esc(v.marka ?? '')} ${esc(v.model ?? '')}</td>
          <td style="text-align:center">
            <span class="pill pill-blue" style="font-size:11px">${activeCount}</span>
          </td>
          <td style="text-align:right;font-weight:600">${totalVal.toLocaleString('pl-PL')} zł</td>
          <td style="color:var(--text2,#6b7280);font-size:12px">${preview}</td>
          <td>
            <button class="btn btn-sm btn-blue" style="font-size:11px"
              data-vehid="${v.id}"
              onclick="VehicleEquipmentModule.openAddModal(parseInt(this.dataset.vehid))">
              <i class="ti ti-plus"></i>Dodaj
            </button>
          </td>
        </tr>
        <tr id="eq-sub-${v.id}" style="${isExpanded ? '' : 'display:none'}">
          <td colspan="6" style="padding:0 0 0 28px;background:var(--bg,#fff)">
            <table class="data-table" style="font-size:12px;width:100%;margin:0">
              <thead>
                <tr style="background:var(--bg2,#f9fafb)">
                  <th>Nazwa</th>
                  <th>Kategoria</th>
                  <th>Nr seryjny</th>
                  <th>Data montażu</th>
                  <th>Status</th>
                  <th style="text-align:right">Wartość</th>
                  <th>Uwagi</th>
                  <th style="width:100px"></th>
                </tr>
              </thead>
              <tbody>
                ${eqRows || '<tr><td colspan="8" style="text-align:center;color:var(--text2,#6b7280);padding:12px">Brak wyposażenia</td></tr>'}
              </tbody>
            </table>
          </td>
        </tr>`;
    }).filter(Boolean).join('');

    const tableHtml = vehicleRows
      ? `<div class="card" style="overflow:hidden">
          <div style="overflow-x:auto">
            <table class="data-table" style="font-size:13px">
              <thead>
                <tr>
                  <th>Nr rej.</th>
                  <th>Marka / Model</th>
                  <th style="text-align:center">Szt.</th>
                  <th style="text-align:right">Wartość</th>
                  <th>Wyposażenie</th>
                  <th style="width:80px"></th>
                </tr>
              </thead>
              <tbody>${vehicleRows}</tbody>
            </table>
          </div>
        </div>`
      : `<div class="card" style="padding:40px;text-align:center;color:var(--text2,#6b7280)">
          <i class="ti ti-package-off" style="font-size:36px;display:block;margin-bottom:10px"></i>
          Brak wyposażenia pasującego do filtrów
        </div>`;

    el.innerHTML = `
      <div style="padding:20px;max-width:1400px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <i class="ti ti-tool" style="font-size:24px;color:var(--blue,#3b82f6)"></i>
          <h2 style="margin:0;font-size:20px;font-weight:700">Wyposażenie pojazdów</h2>
        </div>
        ${kpisHtml}
        ${filterHtml}
        ${tableHtml}
      </div>`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.VehicleEquipmentModule = {
    renderVehicleEquipment,
    openAddModal,
    openEditModal,
    removeEquipment,
    toggleExpand,
    applyFilters,
    _closeModal,
    _saveFromModal,
    _openGlobalAddModal,
    _saveFromGlobalModal,
  };
})();
