// ==================== IMPORT POJAZDÓW Z EXCEL ====================
// Wczytuje arkusz Excel i importuje pojazdy do floty

window.VehicleImport = (function () {

  // Mapowanie możliwych nazw kolumn Excel → pola obiektu pojazdu
  const COL_MAP = {
    'nrrej':        'nrRej',
    'nr rej':       'nrRej',
    'numer rejestracyjny': 'nrRej',
    'rejestracja':  'nrRej',
    'marka':        'marka',
    'model':        'model',
    'rok':          'rok',
    'rok produkcji':'rok',
    'rocznik':      'rok',
    'typ':          'typ',
    'rodzaj':       'typ',
    'dmc':          'dmc',
    'dmc [kg]':     'dmc',
    'masa':         'dmc',
    'dmc [t]':      '_dmcT',
    'dmczespolu':   'dmcZespolu',
    'dmc zespołu':  'dmcZespolu',
    'dmc zespolu':  'dmcZespolu',
    'vin':          'vin',
    'nr vin':       'vin',
    'euro':         'euro',
    'norma euro':   'euro',
    'status':       'status',
    'właściciel':   'wlasciciel',
    'wlasciciel':   'wlasciciel',
    'właściciel/firma': 'wlasciciel',
    'firma':        'wlasciciel',
    'gmina':        'gmina',
    'osie':         'osie',
    'liczba osi':   'osie',
    'zawieszenie':  'zawieszenie',
    'paliwo':       'paliwo',
    'rodzaj paliwa':'paliwo',
    'miejsca':      'miejsca',
    'kierowca':     'kierowca',
    'oc':           'ocEnd',
    'oc koniec':    'ocEnd',
    'oc do':        'ocEnd',
    'ac koniec':    'acEnd',
    'ac do':        'acEnd',
    'przegląd':     'nextInspection',
    'data przeglądu': 'nextInspection',
    'nastepny przeglad': 'nextInspection',
    'przeglad':     'nextInspection',
    'notatki':      'notes',
    'uwagi':        'notes',
  };

  let _pendingRows = [];

  function openModal() {
    let modal = document.getElementById('vimport-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'vimport-modal';
    modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center;padding:24px';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius-lg);padding:28px;width:640px;max-width:97vw;box-shadow:0 8px 48px rgba(0,0,0,.4);max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <i class="ti ti-table-import" style="color:var(--green);font-size:18px"></i>
          <span style="font-size:17px;font-weight:700">${t('vi.title')}</span>
          <button onclick="document.getElementById('vimport-modal').remove()" style="margin-left:auto;background:none;border:none;font-size:22px;cursor:pointer;color:var(--text3);line-height:1">×</button>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:18px">
          Wgraj plik .xlsx lub .csv z danymi pojazdów. Kolumny są rozpoznawane automatycznie.
        </div>

        <!-- Pobierz szablon -->
        <div style="background:var(--bg2);border-radius:var(--radius);padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
          <i class="ti ti-download" style="color:var(--blue)"></i>
          <span style="font-size:12px;flex:1">Pobierz gotowy szablon Excel z nagłówkami kolumn:</span>
          <button class="btn btn-gray" style="font-size:11px" onclick="VehicleImport.downloadTemplate()"><i class="ti ti-download"></i>${t('vi.btn.template')}</button>
        </div>

        <!-- Drop zone -->
        <div id="vi-dropzone" style="border:2px dashed var(--border2);border-radius:var(--radius-lg);padding:2.5rem;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:14px"
          ondragover="event.preventDefault();this.style.borderColor='var(--green)'"
          ondragleave="this.style.borderColor='var(--border2)'"
          ondrop="event.preventDefault();VehicleImport.handleFile(event.dataTransfer.files[0])"
          onclick="document.getElementById('vi-file').click()">
          <i class="ti ti-table-import" style="font-size:40px;color:var(--text3);display:block;margin-bottom:10px"></i>
          <div style="font-size:14px;font-weight:500">Przeciągnij plik lub kliknij aby wybrać</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px">Obsługiwane: .xlsx, .xls, .csv · Max 5 MB</div>
          <input type="file" id="vi-file" accept=".xlsx,.xls,.csv" style="display:none" onchange="VehicleImport.handleFile(this.files[0])">
        </div>

        <!-- Podgląd -->
        <div id="vi-preview"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    _pendingRows = [];
  }

  function downloadTemplate() {
    if (typeof XLSX === 'undefined') { if (typeof toast === 'function') toast('⚠ XLSX niedostępne'); return; }
    const headers = ['nrRej','marka','model','rok','typ','dmc','dmcZespolu','vin','euro','status','wlasciciel','gmina','osie','zawieszenie','paliwo','miejsca','kierowca'];
    const example = ['WA1234B','Mercedes','Actros',2022,'Ciężarowy',18000,0,'WDBJF65J12B123456','EURO 6','Własny','Firma XYZ','Warszawa',3,'pneumatyczne','ON',0,''];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, example]), 'Pojazdy');
    XLSX.writeFile(wb, 'szablon_import_pojazdow.xlsx');
    if (typeof toast === 'function') toast('✓ Szablon pobrany');
  }

  function handleFile(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') { if (typeof toast === 'function') toast('⚠ Biblioteka XLSX niedostępna'); return; }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!raw.length) { if (typeof toast === 'function') toast('⚠ Pusty arkusz'); return; }
        _pendingRows = _mapRows(raw);
        _showPreview(_pendingRows);
      } catch (err) {
        if (typeof toast === 'function') toast('❌ Błąd odczytu pliku: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  let _unmappedCols = [];

  function _mapRows(raw) {
    const unmapped = new Set();
    const rows = raw.map(row => {
      const mapped = {
        osie: 2, zawieszenie: 'pneumatyczne', dmcZespolu: 0, miesiacePodatku: 12,
        fuelHistory: [], serviceHistory: [], gpsHistory: [], inspectionHistory: [],
      };
      Object.entries(row).forEach(([col, val]) => {
        const key = COL_MAP[col.toLowerCase().trim()];
        if (!key) { if (col.trim()) unmapped.add(col.trim()); return; }
        if (key === '_dmcT') {
          mapped['dmc'] = Math.round(parseFloat(val) * 1000) || 0;
        } else if (['rok','dmc','dmcZespolu','osie','miesiacePodatku','miejsca'].includes(key)) {
          mapped[key] = parseInt(val) || 0;
        } else {
          mapped[key] = String(val).trim();
        }
      });
      return mapped;
    }).filter(v => v.nrRej);
    _unmappedCols = [...unmapped];
    return rows;
  }

  function _showPreview(rows) {
    const el = document.getElementById('vi-preview');
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = `<div style="color:var(--red);font-size:13px">${t('vi.err.noreg')}</div>`;
      return;
    }

    const existing = new Set((window.vehs || []).map(v => v.nrRej));
    const newCount = rows.filter(r => !existing.has(r.nrRej)).length;
    const updCount = rows.filter(r => existing.has(r.nrRej)).length;

    el.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">
        ${rows.length} ${t('common.vehicles')}
        <span style="font-weight:400;font-size:12px;color:var(--green);margin-left:8px">${newCount} ${t('vi.toast.new')}</span>
        <span style="font-weight:400;font-size:12px;color:var(--amber);margin-left:8px">${updCount} ${t('vi.toast.upd')}</span>
      </div>
      ${_unmappedCols.length ? `
      <div style="background:rgba(245,175,25,.12);border:1px solid var(--amber);border-radius:var(--radius);padding:10px 12px;margin-bottom:12px;font-size:11px">
        <div style="font-weight:700;color:var(--amber);margin-bottom:4px">⚠ Nierozpoznane kolumny (zostaną pominięte):</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${_unmappedCols.map(c=>`<span style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-family:monospace">${c}</span>`).join('')}</div>
        <div style="color:var(--text2);margin-top:4px">Upewnij się, że nagłówki kolumn są poprawne lub użyj szablonu.</div>
      </div>` : ''}
      <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:14px">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:var(--bg2);position:sticky;top:0">
              <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border)">${t('vi.col.plate')}</th>
              <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border)">${t('vi.col.brand')}</th>
              <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border)">${t('vi.col.model')}</th>
              <th style="padding:5px 8px;text-align:right;border-bottom:1px solid var(--border)">${t('vi.col.dmc')}</th>
              <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border)">${t('vi.col.type')}</th>
              <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border)">${t('vi.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const isUpd = existing.has(r.nrRej);
              return `<tr style="${isUpd ? 'background:rgba(245,175,25,.08)' : ''}">
                <td style="padding:4px 8px;border-bottom:1px solid var(--border);font-weight:600">${r.nrRej} ${isUpd?`<span style="color:var(--amber);font-size:10px">[${t('vi.toast.upd')}]</span>`:''}</td>
                <td style="padding:4px 8px;border-bottom:1px solid var(--border)">${r.marka||'—'}</td>
                <td style="padding:4px 8px;border-bottom:1px solid var(--border)">${r.model||'—'}</td>
                <td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right">${r.dmc ? (r.dmc/1000).toFixed(1)+'t' : '—'}</td>
                <td style="padding:4px 8px;border-bottom:1px solid var(--border)">${r.typ||'—'}</td>
                <td style="padding:4px 8px;border-bottom:1px solid var(--border)">${r.status||'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-green" onclick="VehicleImport.doImport()" style="flex:1;justify-content:center">
          <i class="ti ti-check"></i>${t('vi.btn.import')} (${rows.length})
        </button>
        <button class="btn btn-gray" onclick="document.getElementById('vi-preview').innerHTML='';document.getElementById('vi-file').value=''">
          ${t('btn.cancel')}
        </button>
      </div>`;
  }

  function doImport() {
    const rows = _pendingRows;
    if (!rows.length) return;
    const vehs = window.vehs || [];
    const existingMap = Object.fromEntries(vehs.map((v, i) => [v.nrRej, i]));
    let added = 0, updated = 0;

    rows.forEach(r => {
      const idx = existingMap[r.nrRej];
      if (idx != null) {
        // Aktualizuj istniejący (bez nadpisywania historii)
        const skip = new Set(['id', 'dbId', 'fuelHistory', 'serviceHistory', 'gpsHistory', 'inspectionHistory']);
        Object.entries(r).forEach(([k, v]) => { if (!skip.has(k) && v !== '' && v != null) vehs[idx][k] = v; });
        updated++;
      } else {
        const newV = { ...r, id: vehs.length + added };
        vehs.push(newV);
        added++;
      }
    });

    window.vehs = vehs;

    // Zapisz do Supabase / localStorage
    if (typeof window.FleetCloud !== 'undefined' && typeof FleetCloud.saveVehicles === 'function') {
      FleetCloud.saveVehicles(vehs);
    } else if (typeof setTaxOrderVehicles === 'function') {
      setTaxOrderVehicles(vehs);
    }

    if (typeof renderVeh === 'function') renderVeh();
    if (typeof updateCounters === 'function') updateCounters();
    if (typeof toast === 'function') toast(`✅ Import: ${added} ${t('vi.toast.new')} + ${updated} ${t('vi.toast.upd')}`);
    document.getElementById('vimport-modal')?.remove();
    _pendingRows = [];
  }

  return { openModal, handleFile, doImport, downloadTemplate };
})();
