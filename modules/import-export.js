// ==================== IMPORT / EKSPORT POJAZDÓW ====================
// Obsługuje: mycar.xls (UTF-16 TSV), xlsx, csv

window.TaxOrderImportExport = {

  // Mapowanie nagłówków z mycar.xls → pola pojazdu
  MYCAR_MAP: {
    'Unikalna nazwa':                'unique_name',
    'Nr VIN':                        'vin',
    'Marka':                         'marka',
    'Model':                         'model',
    'Grupa':                         'fleet_group',
    'Rok produkcji':                 'rok',
    'Numer rejestracyjny':           'nrRej',
    'Nr karty paliwowej':            'fuel_card_number',
    'Pojemność silnika':             'pojSilnika',
    'Numer polisy ubezpieczeniowej': 'insurancePolicyNo',
    'Właściciel pojazdu':            'wlasciciel',
    'Nadwozie':                      'bodyType',
    'Data pierwszej rejestracji':    'dataRejestracji',
    'Moc silnika':                   'mocKW',
    'Rodzaj napędu':                 'drivetype',
    'Data zakupu pojazdu':           'purchaseDate',
    'Data montażu GPS':              'gps_install_date',
    'Tachograf':                     'has_tachograph',
    'Czas trwania umowy leasingowej':'leasing_duration',
    'Nr biznesowy':                  'business_number',
    'PIN urządzenia':                'device_pin',
    'Rejestracja SentGeo':           'sentgeo_registered',
    'Rejestracja eToll':             'etoll_registered',
    'Wysyłanie do eToll':            'etoll_send',
    'Numer seryjny urządzenia':      'device_serial',
    'TID':                           'device_tid',
  },

  // Ogólna mapa dla standardowego xlsx/csv (elastyczna)
  GENERIC_MAP: {
    'nr rej':            'nrRej',
    'rejestracyjny':     'nrRej',
    'vin':               'vin',
    'marka':             'marka',
    'model':             'model',
    'rok':               'rok',
    'rok produkcji':     'rok',
    'typ':               'typ',
    'dmc':               'dmc',
    'masa':              'dmc',
    'euro':              'euro',
    'status':            'status',
    'wlasciciel':        'wlasciciel',
    'właściciel':        'wlasciciel',
    'osie':              'osie',
    'zawieszenie':       'zawieszenie',
    'miesiące':          'miesiacePodatku',
  },

  parseDate(val) {
    if (!val) return null;
    const s = String(val).trim();
    // Format: "24.03.2021 00:00:00" lub "24.03.2021"
    const m = s.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    return null;
  },

  parseBool(val) {
    if (!val) return false;
    return String(val).toLowerCase().trim() === 'tak';
  },

  // ── IMPORT z mycar.xls (UTF-16 TSV) ──────────────────────────────
  async importMyCar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          const headers = lines[0].split('\t').map(h => h.trim());
          const rows = [];

          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split('\t');
            const row = {};
            headers.forEach((h, j) => {
              const key = this.MYCAR_MAP[h];
              if (key) row[key] = vals[j]?.trim() || null;
            });
            if (!row.nrRej) continue;

            // Konwersje typów
            row.nrRej = (row.nrRej || '').toUpperCase().replace(/\s/g, '');
            row.rok = parseInt(row.rok) || null;
            row.pojSilnika = parseInt(row.pojSilnika) || null;
            row.mocKW = parseFloat(row.mocKW) || null;
            row.dataRejestracji = this.parseDate(row.dataRejestracji);
            row.purchaseDate = this.parseDate(row.purchaseDate);
            row.gps_install_date = this.parseDate(row.gps_install_date);
            row.has_tachograph = this.parseBool(row.has_tachograph);
            row.sentgeo_registered = this.parseBool(row.sentgeo_registered);
            row.etoll_registered = this.parseBool(row.etoll_registered);
            row.etoll_send = this.parseBool(row.etoll_send);
            row.typ = 'Ciężarowy'; // domyślne — można nadpisać
            row.dmc = 0;
            row.osie = 2;
            row.zawieszenie = 'pneumatyczne';
            row.miesiacePodatku = 12;
            row.status = row.wlasciciel ? 'Własny' : 'Własny';
            rows.push(row);
          }
          resolve({ ok: true, rows, source: 'mycar' });
        } catch(e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-16LE');
    });
  },

  // ── IMPORT z CSV ──────────────────────────────────────────────────
  async importCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const text = e.target.result;
          const sep = text.includes(';') ? ';' : ',';
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          const rawHeaders = lines[0].split(sep).map(h => h.trim().replace(/"/g,'').toLowerCase());
          const rows = [];
          const GMAP = this.GENERIC_MAP;

          // Mapuj nagłówki
          const headerMap = rawHeaders.map(h => {
            for (const [pat, key] of Object.entries(GMAP)) {
              if (h.includes(pat)) return key;
            }
            return h;
          });

          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g,''));
            const row = {};
            headerMap.forEach((key, j) => { row[key] = vals[j] || null; });
            if (!row.nrRej) continue;
            row.nrRej = (row.nrRej || '').toUpperCase().replace(/\s/g,'');
            row.rok = parseInt(row.rok) || null;
            row.dmc = parseInt(row.dmc) || 0;
            row.osie = parseInt(row.osie) || 2;
            row.miesiacePodatku = parseInt(row.miesiacePodatku ?? 12) || 1;
            row.zawieszenie = row.zawieszenie || 'pneumatyczne';
            rows.push(row);
          }
          resolve({ ok: true, rows, source: 'csv' });
        } catch(e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  },

  // ── IMPORT z XLSX (przez SheetJS) ────────────────────────────────
  async importXLSX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (!rawRows.length) { resolve({ ok: false, rows: [] }); return; }

          const GMAP = this.GENERIC_MAP;
          const rawHeaders = Object.keys(rawRows[0]);
          const headerMap = {};
          rawHeaders.forEach(h => {
            const hl = h.toLowerCase().trim();
            for (const [pat, key] of Object.entries(GMAP)) {
              if (hl.includes(pat)) { headerMap[h] = key; return; }
            }
            headerMap[h] = h;
          });

          const rows = rawRows.map(rawRow => {
            const row = {};
            Object.entries(rawRow).forEach(([h, v]) => {
              row[headerMap[h] || h] = v;
            });
            if (!row.nrRej) return null;
            row.nrRej = String(row.nrRej || '').toUpperCase().replace(/\s/g,'');
            row.rok = parseInt(row.rok) || null;
            row.dmc = parseInt(row.dmc) || 0;
            row.osie = parseInt(row.osie) || 2;
            row.miesiacePodatku = parseInt(row.miesiacePodatku ?? 12) || 1;
            row.zawieszenie = row.zawieszenie || 'pneumatyczne';
            return row;
          }).filter(Boolean);

          resolve({ ok: true, rows, source: 'xlsx' });
        } catch(e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  // ── OBSŁUGA PLIKU (dispatch) ──────────────────────────────────────
  async handleFile(file) {
    const name = file.name.toLowerCase();
    let result;
    if (name.endsWith('.csv') || name.endsWith('.tsv')) {
      result = await this.importCSV(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
      result = await this.importXLSX(file);
    } else if (name.endsWith('.xls')) {
      // Spróbuj UTF-16 (mycar.xls format) — fallback do SheetJS
      try { result = await this.importMyCar(file); }
      catch { result = await this.importXLSX(file); }
    } else {
      return { ok: false, error: 'Nieobsługiwany format' };
    }
    return result;
  },

  // ── EKSPORT ───────────────────────────────────────────────────────
  exportXLSX(vehicleList, filename) {
    const hdrs = [
      'Nr rej.','VIN','Marka','Model','Rok','Typ','DMC (kg)','DMC zesp. (kg)',
      'EURO','Status','Właściciel','Osie','Zawieszenie','Mies. pod.',
      'Kat. DT-1','Stawka (zł)','Podatek (zł)','§2',
      'Paliwo','Moc (kW)','Pojemność (cm³)','Miejsca',
      'Data 1. rej.','Data zakupu','Koniec leasingu',
      'Leasingodawca','Nr polisy','Uwagi'
    ];
    const rows = vehicleList.map(v => {
      const tax = (typeof calcTax === 'function') ? calcTax(v) : {};
      return [
        v.nrRej, v.vin, v.marka, v.model, v.rok, v.typ,
        v.dmc, v.dmcZespolu || 0, v.euro, v.status, v.wlasciciel,
        v.osie, v.zawieszenie, v.miesiacePodatku ?? 12,
        tax.cat || '', tax.rate || 0,
        Math.round((tax.amount || 0) * 100) / 100,
        (parseInt(v.rok) || 0) >= 2024 ? 'TAK' : 'NIE',
        v.paliwo || '', v.mocKW || '', v.pojSilnika || '', v.miejscaSied || '',
        v.dataRejestracji || '', v.purchaseDate || '', v.leasingEnd || '',
        v.leasingCompany || '', v.insurancePolicyNo || '', v.uwagi || ''
      ];
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows]);
    ws['!cols'] = hdrs.map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Pojazdy');
    XLSX.writeFile(wb, filename || 'flota_export_' + new Date().toISOString().slice(0,10) + '.xlsx');
    if (typeof toast === 'function') toast('✓ Eksport: ' + vehicleList.length + ' pojazdów');
  },

  exportCSV(vehicleList) {
    const hdrs = ['Nr rej.','VIN','Marka','Model','Rok','Typ','DMC','EURO','Status','Właściciel','Osie','Zawieszenie','Miesiące','Paliwo','Moc kW','Pojemność cm3'];
    const rows = vehicleList.map(v => hdrs.map(h => {
      const map = {'Nr rej.':v.nrRej,'VIN':v.vin,'Marka':v.marka,'Model':v.model,'Rok':v.rok,'Typ':v.typ,'DMC':v.dmc,'EURO':v.euro,'Status':v.status,'Właściciel':v.wlasciciel,'Osie':v.osie,'Zawieszenie':v.zawieszenie,'Miesiące':v.miesiacePodatku,'Paliwo':v.paliwo,'Moc kW':v.mocKW,'Pojemność cm3':v.pojSilnika};
      return '"' + String(map[h] || '').replace(/"/g,'""') + '"';
    }).join(';'));
    const csv = '\uFEFF' + [hdrs.map(h=>'"'+h+'"').join(';'), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'flota_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
    if (typeof toast === 'function') toast('✓ CSV: ' + vehicleList.length + ' pojazdów');
  }
};

