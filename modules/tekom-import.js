/**
 * TaxOrder Pro — Import GPS / MyCar / TEKOM CSV
 * Aktualizuje stan licznika pojazdów z danych GPS, rejestruje trasy
 */
window.TekomImport = (function () {

  // Znane nagłówki CSV z różnych systemów GPS
  const FIELD_ALIASES = {
    nrRej:    ['rejestracja','nrrej','nr_rej','registration','vehicle','pojazd','tablica'],
    date:     ['data','date','dzien','day','datetime','data_czas'],
    time:     ['czas','time','godzina','hour'],
    km:       ['km','odometer','licznik','przebieg','mileage','stan_km','odometer_km','odometr'],
    driver:   ['kierowca','driver','operator','osoba'],
    speed:    ['predkosc','speed','v_max','v_avg'],
    lat:      ['lat','latitude','szerokosc'],
    lon:      ['lon','lng','longitude','dlugosc'],
    location: ['lokalizacja','location','miejsce','adres','address'],
    event:    ['zdarzenie','event','typ','status'],
  };

  const SAMPLE_CSV = `Rejestracja;Data;Czas;Licznik;Kierowca;Prędkość max;Lokalizacja
WGM87205;2025-06-01;08:30:00;45230;Jan Kowalski;72;ul. Przykładowa 1, Warszawa
WGM87205;2025-06-01;17:15:00;45312;Jan Kowalski;89;ul. Testowa 5, Warszawa
WZ124HW;2025-06-01;07:45:00;12430;Adam Nowak;65;al. Jerozolimskie 120, Warszawa`;

  let _parsed = [];
  let _schema = null;
  let _fileContent = '';
  let _pendingLines = [];
  let _pendingSep = ';';

  function open() {
    document.getElementById('tekom-modal').style.display = 'flex';
    _reset();
  }
  function close() {
    document.getElementById('tekom-modal').style.display = 'none';
    _reset();
  }
  function _reset() { _parsed = []; _schema = null; _fileContent = ''; _pendingLines = []; _pendingSep = ';'; _renderStep(1); }

  // ── Krok 1: Wczytaj plik ─────────────────────────────────────────────────
  function handleFile(input) {
    const f = input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      _fileContent = e.target.result;
      _detectAndParse(_fileContent);
    };
    reader.readAsText(f, 'UTF-8');
  }

  function _detectAndParse(text) {
    // Wykryj separator
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) { toast('⚠ Plik jest pusty'); return; }

    const header = lines[0];
    const sep = [';','|','\t',','].find(s => header.includes(s)) || ';';

    const headers = header.split(sep).map(h => h.trim().replace(/^["']|["']$/g,'').toLowerCase()
      .replace(/ę/g,'e').replace(/ó/g,'o').replace(/ą/g,'a').replace(/ś/g,'s')
      .replace(/ł/g,'l').replace(/ż|ź/g,'z').replace(/ć/g,'c').replace(/ń/g,'n')
      .replace(/[^a-z0-9_]/g,'_'));

    // Mapowanie nagłówków → pola
    _schema = {};
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      const idx = headers.findIndex(h => aliases.some(a =>
        h === a || h.startsWith(a) || a.startsWith(h)
      ));
      if (idx >= 0) _schema[field] = idx;
    }

    if (_schema.nrRej === undefined) {
      toast('⚠ Nie znaleziono kolumny z numerem rejestracyjnym. Sprawdź format pliku.');
      _showSchemaMapper(headers, sep, lines);
      return;
    }

    _parsed = lines.slice(1).map(line => {
      const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g,''));
      const get = f => (_schema[f] !== undefined ? cols[_schema[f]] : '') || '';
      const km = _schema.km !== undefined ? parseFloat(get('km').replace(/\s/g,'').replace(',','.')) : null;
      let dateStr = get('date');
      if (!dateStr.includes('-') && dateStr.includes('.')) {
        const [d,m,y] = dateStr.split('.');
        dateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      }
      return {
        nrRej:    get('nrRej').toUpperCase().replace(/\s/g,''),
        date:     dateStr,
        time:     get('time'),
        km:       isNaN(km) ? null : km,
        driver:   get('driver'),
        speed:    parseFloat(get('speed')) || null,
        location: get('location'),
        event:    get('event'),
      };
    }).filter(r => r.nrRej);

    _renderStep(2);
  }

  function _showSchemaMapper(headers, sep, lines) {
    // Przechowaj w zmiennych modułu — nie przez onclick payload
    _pendingLines = lines.slice(1);
    _pendingSep   = sep;
    const el = document.getElementById('tekom-step1-body');
    if (!el) return;
    const fieldOpts = ['', ...Object.keys(FIELD_ALIASES)].map(f => `<option value="${f}">${f||'— pomiń —'}</option>`).join('');
    el.innerHTML = `
      <div class="wbox" style="margin-bottom:14px"><i class="ti ti-info-circle"></i>
        Nie rozpoznano nagłówków automatycznie. Przypisz kolumny ręcznie:
      </div>
      <div class="tbl-wrap"><table style="width:100%;font-size:12px">
        <thead><tr><th>Kolumna CSV</th><th>Mapuj jako</th><th>Przykład</th></tr></thead>
        <tbody>
          ${headers.map((h, i) => {
            const ex = lines[1]?.split(sep)?.[i]?.trim() || '';
            return `<tr>
              <td style="font-family:var(--mono)">${h}</td>
              <td><select id="_tk-map-${i}" class="fi" style="padding:4px 6px;font-size:11px">${fieldOpts}</select></td>
              <td style="color:var(--text2);font-size:11px">${ex}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <button class="btn btn-blue" onclick="TekomImport._applyManualSchema(${JSON.stringify(headers)})">
          <i class="ti ti-arrow-right"></i>Dalej
        </button>
      </div>`;
  }

  function _applyManualSchema(headers) {
    _schema = {};
    headers.forEach((h, i) => {
      const sel = document.getElementById(`_tk-map-${i}`);
      if (sel?.value) _schema[sel.value] = i;
    });
    const sep = _pendingSep;
    _parsed = _pendingLines.map(line => {
      const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g,''));
      const get = f => (_schema[f] !== undefined ? cols[_schema[f]] : '') || '';
      const km = _schema.km !== undefined ? parseFloat(get('km').replace(/\s/g,'').replace(',','.')) : null;
      return {
        nrRej: get('nrRej').toUpperCase().replace(/\s/g,''),
        date:  get('date'), time: get('time'),
        km: isNaN(km) ? null : km,
        driver: get('driver'), speed: parseFloat(get('speed'))||null,
        location: get('location'), event: get('event'),
      };
    }).filter(r => r.nrRej);
    _renderStep(2);
  }

  // ── Krok 2: Podgląd i potwierdzenie ──────────────────────────────────────
  function _renderStep(step) {
    const el = document.getElementById('tekom-step1-body');
    if (!el) return;

    if (step === 1) {
      el.innerHTML = `
        <div style="text-align:center;padding:24px">
          <i class="ti ti-file-spreadsheet" style="font-size:40px;color:var(--blue);display:block;margin-bottom:12px"></i>
          <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
            Obsługiwane systemy: MyCar, TEKOM, GPS Protracker, Fleet Complete, Webfleet, NAVIFLEET
          </div>
          <label class="btn btn-blue" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            <i class="ti ti-upload"></i>Wybierz plik CSV
            <input type="file" accept=".csv,.txt" style="display:none" onchange="TekomImport.handleFile(this)">
          </label>
          <div style="margin-top:16px">
            <button class="btn btn-gray" style="font-size:11px" onclick="TekomImport.downloadSample()">
              <i class="ti ti-download"></i>Pobierz przykładowy CSV
            </button>
          </div>
          <div style="margin-top:14px;font-size:11px;color:var(--text3)">
            Separator: średnik (;) lub tabulator. Kodowanie: UTF-8 lub Windows-1250.
          </div>
        </div>`;
      document.getElementById('tekom-step2-body').style.display = 'none';
      document.getElementById('tekom-step1-body').style.display = '';
      return;
    }

    if (step === 2) {
      // Wyznacz max km per pojazd
      const maxKm = {};
      _parsed.forEach(r => {
        if (r.km != null && r.nrRej) {
          if (maxKm[r.nrRej] == null || r.km > maxKm[r.nrRej]) maxKm[r.nrRej] = r.km;
        }
      });

      const knownVehs = new Set((window.vehs||[]).map(v => v.nrRej));
      const unknownNrRej = [...new Set(_parsed.map(r => r.nrRej))].filter(n => !knownVehs.has(n));

      const step2El = document.getElementById('tekom-step2-body');
      step2El.style.display = '';
      document.getElementById('tekom-step1-body').style.display = 'none';

      step2El.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <div class="stat-chip"><span>${_parsed.length}</span> rekordów</div>
          <div class="stat-chip"><span>${new Set(_parsed.map(r=>r.nrRej)).size}</span> pojazdów</div>
          <div class="stat-chip"><span>${_parsed.filter(r=>r.km!=null).length}</span> z odczytem km</div>
          ${unknownNrRej.length ? `<div class="stat-chip stat-chip-amber"><span>${unknownNrRej.length}</span> nieznanych nr rej.</div>` : ''}
        </div>

        ${unknownNrRej.length ? `
        <div class="wbox" style="margin-bottom:12px"><i class="ti ti-alert-triangle"></i>
          Nieznane tablice rejestracyjne (brak w bazie pojazdów): ${unknownNrRej.map(n=>`<strong>${n}</strong>`).join(', ')}
        </div>` : ''}

        <div style="font-size:12px;font-weight:600;margin-bottom:8px">Aktualizacje stanu licznika:</div>
        <div class="tbl-wrap"><table style="width:100%;font-size:12px">
          <thead><tr><th>Nr rej.</th><th>Aktualny km</th><th>Maks. z GPS</th><th>Zmiana</th><th>Status</th></tr></thead>
          <tbody>
            ${Object.entries(maxKm).map(([nrRej, newKm]) => {
              const v = (window.vehs||[]).find(x => x.nrRej === nrRej);
              const currKm = v?.stanKilometrow || 0;
              const diff = newKm - currKm;
              return `<tr>
                <td style="font-family:var(--mono);font-weight:700">${nrRej}</td>
                <td style="font-family:var(--mono)">${currKm ? currKm.toLocaleString('pl-PL') : '—'}</td>
                <td style="font-family:var(--mono);color:var(--blue);font-weight:600">${newKm.toLocaleString('pl-PL')}</td>
                <td style="font-family:var(--mono);color:${diff>0?'var(--green)':diff<0?'var(--red)':'var(--text3)'}">${diff>0?'+'+diff.toLocaleString('pl-PL'):diff.toLocaleString('pl-PL')} km</td>
                <td>${!v?`<span style="color:var(--text3)">nieznany pojazd</span>`:diff<0?`<span style="color:var(--amber)">⚠ cofnięty licznik</span>`:`<span style="color:var(--green)">✓ ok</span>`}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>

        <div style="font-size:12px;font-weight:600;margin:16px 0 8px">Opcje importu:</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px">
            <input type="checkbox" id="_tk-update-km" checked>
            Aktualizuj stan licznika (km) pojazdów
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px">
            <input type="checkbox" id="_tk-update-driver">
            Aktualizuj przypisanego kierowcę (z ostatniego wpisu)
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px">
            <input type="checkbox" id="_tk-save-trips" checked>
            Zapisz historię tras w pojeździe (gpsHistory)
          </label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="TekomImport._renderStep(1)"><i class="ti ti-arrow-left"></i>Wróć</button>
          <button class="btn btn-blue" onclick="TekomImport.doImport()"><i class="ti ti-check"></i>Importuj (${_parsed.length} rekordów)</button>
        </div>`;
    }
  }

  async function doImport() {
    const updateKm     = document.getElementById('_tk-update-km')?.checked;
    const updateDriver = document.getElementById('_tk-update-driver')?.checked;
    const saveTrips    = document.getElementById('_tk-save-trips')?.checked;

    const maxKm = {}, lastDriver = {};
    _parsed.forEach(r => {
      if (r.km != null && r.nrRej) {
        if (maxKm[r.nrRej] == null || r.km > maxKm[r.nrRej]) maxKm[r.nrRej] = r.km;
      }
      if (r.driver && r.nrRej) lastDriver[r.nrRej] = r.driver;
    });

    let updated = 0, skipped = 0;

    for (const v of (window.vehs || [])) {
      let changed = false;
      const trips = _parsed.filter(r => r.nrRej === v.nrRej);
      if (!trips.length) continue;

      if (updateKm && maxKm[v.nrRej] != null) {
        const newKm = maxKm[v.nrRej];
        if (newKm > (v.stanKilometrow || 0)) {
          v.stanKilometrow = Math.round(newKm);
          changed = true;
        } else { skipped++; }
      }

      if (updateDriver && lastDriver[v.nrRej]) {
        v.kierowca = lastDriver[v.nrRej];
        changed = true;
      }

      if (saveTrips) {
        if (!Array.isArray(v.gpsHistory)) v.gpsHistory = [];
        const existingDates = new Set(v.gpsHistory.map(g => g.date + g.time));
        const newTrips = trips.filter(r => !existingDates.has(r.date + r.time));
        if (newTrips.length) { v.gpsHistory.push(...newTrips); changed = true; }
      }

      if (changed) {
        updated++;
        if (window.TaxOrderFleetCloud?.saveVehicle) {
          await window.TaxOrderFleetCloud.saveVehicle(v).catch(() => {});
        }
      }
    }

    localStorage.setItem('taxVehicles', JSON.stringify(window.vehs));
    if (typeof renderVeh === 'function') renderVeh();
    if (typeof renderDash === 'function') renderDash();
    close();
    toast(`✓ GPS import: zaktualizowano ${updated} pojazdów, pominięto ${skipped} wpisów`);
  }

  function downloadSample() {
    const bom = '﻿';
    const blob = new Blob([bom + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tekom_gps_przyklad.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return { open, close, handleFile, doImport, downloadSample, _renderStep, _applyManualSchema };
})();
