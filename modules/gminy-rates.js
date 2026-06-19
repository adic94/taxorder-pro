// ==================== STAWKI DT-1 PER GMINA ====================
// Obsługuje różne stawki podatku od środków transportu dla każdej gminy w Polsce

window.GminyRates = (function () {

  const LS_KEY = 'taxGminyRates';

  // Kompletny schemat stawek — każdy klucz odpowiada jednej gałęzi calcTax()
  const SCHEMA = [
    // Autobusy
    { key:'bus_any_new',    label:'Autobus (rok≥2024)',                  cat:'D6/D7', default:1320 },
    { key:'bus_lt30',       label:'Autobus < 30 miejsc (starsze)',        cat:'D6',    default:1488 },
    { key:'bus_ge30',       label:'Autobus ≥ 30 miejsc (starsze)',        cat:'D7',    default:1872 },
    // Naczepy/Przyczepy 7–12t
    { key:'tr_7_12_new',    label:'Naczepa/Przyczepa 7–12t (rok≥2024)',  cat:'D5',    default:1128 },
    { key:'tr_7_12_old',    label:'Naczepa/Przyczepa 7–12t (starsze)',   cat:'D5',    default:1248 },
    // Naczepy ≥12t — 1 oś (D13)
    { key:'tr_1ax_lt18',    label:'Naczepa ≥12t, 1oś, 12–18t',          cat:'D13',   default:744  },
    { key:'tr_1ax_18_25',   label:'Naczepa ≥12t, 1oś, 18–25t',          cat:'D13',   default:840  },
    { key:'tr_1ax_25_36',   label:'Naczepa ≥12t, 1oś, 25–36t',          cat:'D13',   default:984  },
    { key:'tr_1ax_gt36',    label:'Naczepa ≥12t, 1oś, >36t',            cat:'D13',   default:1128 },
    // Naczepy ≥12t — 2 osie (D14)
    { key:'tr_2ax_lt28',    label:'Naczepa ≥12t, 2osie, 12–28t',        cat:'D14',   default:1488 },
    { key:'tr_2ax_28_33',   label:'Naczepa ≥12t, 2osie, 28–33t',        cat:'D14',   default:1776 },
    { key:'tr_2ax_33_38',   label:'Naczepa ≥12t, 2osie, 33–38t',        cat:'D14',   default:2256 },
    { key:'tr_2ax_ge38',    label:'Naczepa ≥12t, 2osie, ≥38t',          cat:'D14',   default:2976 },
    // Naczepy ≥12t — 3+ osie (D15)
    { key:'tr_3ax_le36',    label:'Naczepa ≥12t, 3+osie, ≤36t',         cat:'D15',   default:1872 },
    { key:'tr_3ax_36_38',   label:'Naczepa ≥12t, 3+osie, 36–38t',       cat:'D15',   default:2040 },
    { key:'tr_3ax_ge38',    label:'Naczepa ≥12t, 3+osie, ≥38t',         cat:'D15',   default:2232 },
    // Ciągniki siodłowe 3,5–12t (D4)
    { key:'ct_lt12_new',    label:'Ciągnik 3,5–12t (rok≥2024)',          cat:'D4',    default:1248 },
    { key:'ct_lt12_old',    label:'Ciągnik 3,5–12t (starsze)',           cat:'D4',    default:1392 },
    // Ciągniki siodłowe ≥12t — 2 osie (D11)
    { key:'ct_2ax_lt18',    label:'Ciągnik ≥12t, 2osie, 12–18t',        cat:'D11',   default:1128 },
    { key:'ct_2ax_18_25',   label:'Ciągnik ≥12t, 2osie, 18–25t',        cat:'D11',   default:1680 },
    { key:'ct_2ax_25_31',   label:'Ciągnik ≥12t, 2osie, 25–31t',        cat:'D11',   default:2232 },
    { key:'ct_2ax_31_36',   label:'Ciągnik ≥12t, 2osie, 31–36t',        cat:'D11',   default:3384 },
    { key:'ct_2ax_gt36',    label:'Ciągnik ≥12t, 2osie, >36t',          cat:'D11',   default:3384 },
    // Ciągniki siodłowe ≥12t — 3+ osie (D12)
    { key:'ct_3ax_le36',    label:'Ciągnik ≥12t, 3+osie, ≤36t',         cat:'D12',   default:2784 },
    { key:'ct_3ax_36_40',   label:'Ciągnik ≥12t, 3+osie, 36–40t',       cat:'D12',   default:2832 },
    { key:'ct_3ax_ge40',    label:'Ciągnik ≥12t, 3+osie, ≥40t',         cat:'D12',   default:4200 },
    // Samochody ciężarowe 3,5–12t
    { key:'car_lt55_new',   label:'Sam.cięż. 3,5–5,5t (rok≥2024)',      cat:'D1',    default:744  },
    { key:'car_lt55_old',   label:'Sam.cięż. 3,5–5,5t (starsze)',       cat:'D1',    default:840  },
    { key:'car_55_90_new',  label:'Sam.cięż. 5,5–9t (rok≥2024)',        cat:'D2',    default:1008 },
    { key:'car_55_90_old',  label:'Sam.cięż. 5,5–9t (starsze)',         cat:'D2',    default:1128 },
    { key:'car_90_12_new',  label:'Sam.cięż. 9–12t (rok≥2024)',         cat:'D3',    default:1344 },
    { key:'car_90_12_old',  label:'Sam.cięż. 9–12t (starsze)',          cat:'D3',    default:1488 },
    // Sam. ciężarowe ≥12t — 2 osie (D8)
    { key:'car_2ax_lt13',   label:'Sam.cięż. ≥12t, 2osie, 12–13t',     cat:'D8',    default:1200 },
    { key:'car_2ax_13_14',  label:'Sam.cięż. ≥12t, 2osie, 13–14t',     cat:'D8',    default:1488 },
    { key:'car_2ax_14_15',  label:'Sam.cięż. ≥12t, 2osie, 14–15t',     cat:'D8',    default:1680 },
    { key:'car_2ax_ge15',   label:'Sam.cięż. ≥12t, 2osie, ≥15t',       cat:'D8',    default:2184 },
    // Sam. ciężarowe ≥12t — 3 osie (D9)
    { key:'car_3ax_lt17',   label:'Sam.cięż. ≥12t, 3osie, 12–17t',     cat:'D9',    default:1488 },
    { key:'car_3ax_17_19',  label:'Sam.cięż. ≥12t, 3osie, 17–19t',     cat:'D9',    default:1704 },
    { key:'car_3ax_19_21',  label:'Sam.cięż. ≥12t, 3osie, 19–21t',     cat:'D9',    default:1872 },
    { key:'car_3ax_21_23',  label:'Sam.cięż. ≥12t, 3osie, 21–23t',     cat:'D9',    default:2136 },
    { key:'car_3ax_ge23',   label:'Sam.cięż. ≥12t, 3osie, ≥23t',       cat:'D9',    default:2760 },
    // Sam. ciężarowe ≥12t — 4+ osie (D10)
    { key:'car_4ax_lt25',   label:'Sam.cięż. ≥12t, 4+osie, 12–25t',    cat:'D10',   default:1488 },
    { key:'car_4ax_25_27',  label:'Sam.cięż. ≥12t, 4+osie, 25–27t',    cat:'D10',   default:1824 },
    { key:'car_4ax_27_29',  label:'Sam.cięż. ≥12t, 4+osie, 27–29t',    cat:'D10',   default:2880 },
    { key:'car_4ax_ge29',   label:'Sam.cięż. ≥12t, 4+osie, ≥29t',      cat:'D10',   default:4296 },
  ];

  const SCHEMA_MAP = Object.fromEntries(SCHEMA.map(s => [s.key, s]));
  const WARSZAWA_DEFAULTS = Object.fromEntries(SCHEMA.map(s => [s.key, s.default]));

  // ── Persistence ──────────────────────────────────────────────────────────

  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
  }
  function _save(data) { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {} }

  function listGminy() {
    return ['Warszawa', ...Object.keys(_load())];
  }

  function getGminaRates(name) {
    if (!name || name === 'Warszawa') return { ...WARSZAWA_DEFAULTS };
    const data = _load();
    if (!data[name]) return { ...WARSZAWA_DEFAULTS };
    return { ...WARSZAWA_DEFAULTS, ...data[name] };
  }

  function saveGminaRates(name, rates) {
    if (!name || name === 'Warszawa') return;
    const data = _load();
    data[name] = rates;
    _save(data);
  }

  function deleteGmina(name) {
    if (!name || name === 'Warszawa') return;
    const data = _load();
    delete data[name];
    _save(data);
  }

  function copyFrom(targetName, sourceName) {
    const src = getGminaRates(sourceName);
    saveGminaRates(targetName, { ...src });
  }

  // ── Rate key lookup — mirrors every branch of app.js getRate() ───────────

  function getRateKey(v) {
    const dT   = (v.dmc || 0) / 1000;
    const dzT  = (v.dmcZespolu || 0) / 1000;
    const refZ = dzT > 0 ? dzT : dT;
    const typ  = (v.typ || '').toLowerCase();
    const osie = parseInt(v.osie) || 2;
    const isNew = (parseInt(v.rok) || 0) >= 2024;

    if (typ.includes('specjaln') || (v.przeznaczenie || '').toLowerCase().includes('specjaln')) return null;

    if (typ.includes('autobus')) {
      if (isNew) return 'bus_any_new';
      return (parseInt(v.miejsca) || 0) < 30 ? 'bus_lt30' : 'bus_ge30';
    }

    if (typ.includes('naczepa') || typ.includes('przyczepa')) {
      if (refZ >= 7 && refZ < 12) return isNew ? 'tr_7_12_new' : 'tr_7_12_old';
      if (refZ >= 12) {
        if (osie === 1) {
          if (refZ < 18)  return 'tr_1ax_lt18';
          if (refZ < 25)  return 'tr_1ax_18_25';
          if (refZ <= 36) return 'tr_1ax_25_36';
          return 'tr_1ax_gt36';
        }
        if (osie === 2) {
          if (refZ < 28)  return 'tr_2ax_lt28';
          if (refZ < 33)  return 'tr_2ax_28_33';
          if (refZ < 38)  return 'tr_2ax_33_38';
          return 'tr_2ax_ge38';
        }
        if (refZ <= 36) return 'tr_3ax_le36';
        if (refZ < 38)  return 'tr_3ax_36_38';
        return 'tr_3ax_ge38';
      }
      return null;
    }

    if (typ.includes('ciągnik') || typ.includes('ciagnik')) {
      if (refZ >= 3.5 && refZ < 12) return isNew ? 'ct_lt12_new' : 'ct_lt12_old';
      if (refZ >= 12) {
        if (osie <= 2) {
          if (refZ < 18)  return 'ct_2ax_lt18';
          if (refZ < 25)  return 'ct_2ax_18_25';
          if (refZ < 31)  return 'ct_2ax_25_31';
          if (refZ <= 36) return 'ct_2ax_31_36';
          return 'ct_2ax_gt36';
        }
        if (refZ <= 36) return 'ct_3ax_le36';
        if (refZ < 40)  return 'ct_3ax_36_40';
        return 'ct_3ax_ge40';
      }
      return null;
    }

    // Samochód ciężarowy
    if (dT <= 3.5) return null;
    if (dT < 12) {
      if (isNew) {
        if (dT <= 5.5) return 'car_lt55_new';
        if (dT <= 9)   return 'car_55_90_new';
        return 'car_90_12_new';
      }
      if (dT <= 5.5) return 'car_lt55_old';
      if (dT <= 9)   return 'car_55_90_old';
      return 'car_90_12_old';
    }
    if (osie === 2) {
      if (dT < 13) return 'car_2ax_lt13';
      if (dT < 14) return 'car_2ax_13_14';
      if (dT < 15) return 'car_2ax_14_15';
      return 'car_2ax_ge15';
    }
    if (osie === 3) {
      if (dT < 17) return 'car_3ax_lt17';
      if (dT < 19) return 'car_3ax_17_19';
      if (dT < 21) return 'car_3ax_19_21';
      if (dT < 23) return 'car_3ax_21_23';
      return 'car_3ax_ge23';
    }
    if (dT < 25) return 'car_4ax_lt25';
    if (dT < 27) return 'car_4ax_25_27';
    if (dT < 29) return 'car_4ax_27_29';
    return 'car_4ax_ge29';
  }

  function getGminaRate(v) {
    const key = getRateKey(v);
    if (!key) return null;
    const rates = getGminaRates(v.gmina || 'Warszawa');
    const val = rates[key];
    return val != null ? val : null;
  }

  // ── Modal UI ──────────────────────────────────────────────────────────────

  const GROUPS = [
    { label: 'Autobusy',                              keys: ['bus_any_new','bus_lt30','bus_ge30'] },
    { label: 'Naczepy/Przyczepy 7–12t (D5)',          keys: ['tr_7_12_new','tr_7_12_old'] },
    { label: 'Naczepy/Przyczepy ≥12t — 1 oś (D13)',  keys: ['tr_1ax_lt18','tr_1ax_18_25','tr_1ax_25_36','tr_1ax_gt36'] },
    { label: 'Naczepy/Przyczepy ≥12t — 2 osie (D14)', keys: ['tr_2ax_lt28','tr_2ax_28_33','tr_2ax_33_38','tr_2ax_ge38'] },
    { label: 'Naczepy/Przyczepy ≥12t — 3+ osie (D15)', keys: ['tr_3ax_le36','tr_3ax_36_38','tr_3ax_ge38'] },
    { label: 'Ciągniki siodłowe 3,5–12t (D4)',        keys: ['ct_lt12_new','ct_lt12_old'] },
    { label: 'Ciągniki siodłowe ≥12t — 2 osie (D11)', keys: ['ct_2ax_lt18','ct_2ax_18_25','ct_2ax_25_31','ct_2ax_31_36','ct_2ax_gt36'] },
    { label: 'Ciągniki siodłowe ≥12t — 3+ osie (D12)', keys: ['ct_3ax_le36','ct_3ax_36_40','ct_3ax_ge40'] },
    { label: 'Samochody ciężarowe 3,5–12t',            keys: ['car_lt55_new','car_lt55_old','car_55_90_new','car_55_90_old','car_90_12_new','car_90_12_old'] },
    { label: 'Sam. ciężarowe ≥12t — 2 osie (D8)',     keys: ['car_2ax_lt13','car_2ax_13_14','car_2ax_14_15','car_2ax_ge15'] },
    { label: 'Sam. ciężarowe ≥12t — 3 osie (D9)',     keys: ['car_3ax_lt17','car_3ax_17_19','car_3ax_19_21','car_3ax_21_23','car_3ax_ge23'] },
    { label: 'Sam. ciężarowe ≥12t — 4+ osie (D10)',   keys: ['car_4ax_lt25','car_4ax_25_27','car_4ax_27_29','car_4ax_ge29'] },
  ];

  function openModal(editGmina) {
    let modal = document.getElementById('gminy-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'gminy-modal';
    modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:flex-start;justify-content:center;padding:40px 16px 40px;overflow-y:auto';
    modal.innerHTML = _buildHtml(editGmina || null);
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  function _buildHtml(editGmina) {
    const gminy   = listGminy();
    const editing = editGmina ? getGminaRates(editGmina) : null;

    const gminyRows = gminy.map(g => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
        <i class="ti ti-map-pin" style="color:var(--blue);font-size:14px"></i>
        <span style="flex:1;font-weight:600;font-size:13px">${g}</span>
        ${g === 'Warszawa'
          ? '<span style="font-size:11px;color:var(--text3)">wbudowane (max MF 2026)</span>'
          : `<button class="btn btn-gray" style="font-size:11px" onclick="GminyRates.openModal('${g}')"><i class="ti ti-pencil"></i>Edytuj</button>
             <button class="btn btn-red" style="font-size:11px" onclick="GminyRates._del('${g}')"><i class="ti ti-trash"></i></button>`
        }
      </div>`).join('');

    const rateEditor = !editing ? '' : GROUPS.map(g => `
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">${g.label}</div>
        ${g.keys.map(k => {
          const s = SCHEMA_MAP[k]; if (!s) return '';
          const val = editing[k] ?? s.default;
          return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
            <label style="flex:1;font-size:12px;color:var(--text)">${s.label}</label>
            <input type="number" id="gr-${k}" value="${val}" min="0" style="width:88px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:12px;text-align:right">
            <span style="font-size:11px;color:var(--text3);width:18px">zł</span>
            <button class="btn btn-gray" title="Przywróć Warszawa" style="font-size:10px;padding:2px 7px;min-width:24px" onclick="document.getElementById('gr-${k}').value=${s.default}">W</button>
          </div>`;
        }).join('')}
      </div>`).join('');

    return `
      <div style="background:var(--bg);border-radius:var(--radius-lg);padding:24px 28px;width:660px;max-width:97vw;box-shadow:0 8px 48px rgba(0,0,0,.4)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <i class="ti ti-map-pin" style="color:var(--blue);font-size:18px"></i>
          <span style="font-size:17px;font-weight:700">${editing ? `Stawki DT-1 — ${editGmina}` : 'Stawki DT-1 per gmina'}</span>
          <button onclick="document.getElementById('gminy-modal').remove()" style="margin-left:auto;background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);line-height:1">×</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:20px">
          ${editing ? 'Edytuj stawki dla tej gminy. Przycisk <b>W</b> przywraca stawkę Warszawa 2026.' : 'Każda gmina może mieć własne stawki (do maksimum wg obwieszczenia MF). Dodaj swoją gminę i ustaw stawki.'}
        </div>

        ${editing ? `
          <div style="max-height:65vh;overflow-y:auto;padding-right:6px">${rateEditor}</div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-green" onclick="GminyRates._save('${editGmina}')" style="flex:1;justify-content:center"><i class="ti ti-check"></i>Zapisz stawki ${editGmina}</button>
            <button class="btn btn-gray" onclick="GminyRates.openModal()"><i class="ti ti-list"></i>Lista gmin</button>
          </div>
        ` : `
          <div style="margin-bottom:20px">${gminyRows}</div>
          <div style="background:var(--bg2);border-radius:var(--radius);padding:14px">
            <div style="font-size:13px;font-weight:600;margin-bottom:10px"><i class="ti ti-plus"></i> Dodaj gminę</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="text" id="new-gmina-name" placeholder="Nazwa gminy (np. Kraków)" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
              <label style="font-size:12px;color:var(--text2);align-self:center">Skopiuj z:</label>
              <select id="new-gmina-src" style="padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
                ${gminy.map(g => `<option>${g}</option>`).join('')}
              </select>
              <button class="btn btn-blue" onclick="GminyRates._add()"><i class="ti ti-plus"></i>Dodaj</button>
            </div>
          </div>
        `}
      </div>`;
  }

  function _add() {
    const name = (document.getElementById('new-gmina-name')?.value || '').trim();
    const src  = document.getElementById('new-gmina-src')?.value || 'Warszawa';
    if (!name) { if (typeof toast === 'function') toast('Podaj nazwę gminy'); return; }
    if (name === 'Warszawa') { if (typeof toast === 'function') toast('Warszawa to stawka domyślna'); return; }
    copyFrom(name, src);
    if (typeof toast === 'function') toast(`✓ Gmina "${name}" dodana`);
    openModal(name);
  }

  function _del(name) {
    if (!confirm(`Usunąć stawki dla gminy "${name}"?\nPojazdy tej gminy wrócą do stawek Warszawa.`)) return;
    deleteGmina(name);
    if (typeof toast === 'function') toast(`Gmina "${name}" usunięta`);
    openModal();
  }

  function _save(name) {
    const rates = {};
    SCHEMA.forEach(s => {
      const el = document.getElementById('gr-' + s.key);
      if (el) rates[s.key] = parseFloat(el.value) || s.default;
    });
    saveGminaRates(name, rates);
    if (typeof toast === 'function') toast(`✓ Stawki dla "${name}" zapisane`);
    openModal();
    if (typeof renderVeh === 'function') renderVeh();
    if (typeof renderFormularze === 'function') renderFormularze();
  }

  return {
    SCHEMA, WARSZAWA_DEFAULTS,
    getRateKey, getGminaRate, getGminaRates,
    listGminy, saveGminaRates, deleteGmina, copyFrom,
    openModal, _add, _del, _save,
  };
})();
