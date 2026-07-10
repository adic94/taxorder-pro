// ==================== RATE READER ====================
// Odczyt stawek z PDF uchwały rady gminy + zapis do Supabase tax_rates
// Używa: Tesseract.js (OCR) + regex + pdf-lib (render stron)

window.TaxOrderRateReader = {

  // Cache stawek pobranych z Supabase: { 'Warszawa_2026': {...} }
  _cache: {},

  // ── POBIERZ STAWKI Z SUPABASE ────────────────────────────────────
  async loadRates(municipality, taxYear) {
    const key = `${municipality}_${taxYear}`;
    if (this._cache[key]) return this._cache[key];
    if (!window.supabaseClient) return null;

    const { data, error } = await window.supabaseClient
      .from('tax_rates')
      .select('*')
      .eq('municipality', municipality)
      .eq('tax_year', taxYear)
      .single();

    if (error || !data) {
      console.warn(`[RateReader] Brak stawek: ${municipality} ${taxYear}`);
      return null;
    }
    this._cache[key] = data;
    console.log(`[RateReader] Załadowano stawki: ${municipality} ${taxYear}`, data);
    return data;
  },

  // ── WYLICZ STAWKĘ DLA POJAZDU NA PODSTAWIE DB ────────────────────
  async getRateFromDb(v, taxYear, municipality) {
    const yr  = taxYear    || (document.getElementById('taxYearDT1') || document.getElementById('taxYear') || {}).value || '2026';
    const mun = municipality || this._getMunicipalityForVehicle(v) || 'Warszawa';
    const rates = await this.loadRates(mun, parseInt(yr));
    if (!rates) return null;

    const dmc      = parseInt(v.dmc) || 0;
    const dmcTeam  = parseInt(v.dmcZespolu) || 0;
    const osie     = parseInt(v.osie) || 2;
    const typ      = (v.typ || '').toLowerCase();
    const isNew    = (parseInt(v.rok) || 0) >= 2024; // §2
    const miesiace = parseInt(v.miesiacePodatku) || 12;

    let cat = null, baseRate = null;

    const isTruck    = typ.includes('cięż') || typ === 'ciężarowy';
    const isTractor  = typ.includes('ciągnik') || typ.includes('siodł') || typ.includes('balast');
    const isTrailer  = typ.includes('przyczepa') || typ.includes('naczepa');
    const isBus      = typ.includes('autobus');

    if (isBus) {
      const seats = parseInt(v.miejscaSied) || 0;
      if (seats < 22) { cat = 'D6'; baseRate = rates.d6_rate; }
      else            { cat = 'D7'; baseRate = rates.d7_rate; }

    } else if (isTruck && dmc < 3500) {
      return null; // zwolniony

    } else if (isTruck && dmc <= 5500) {
      cat = 'D1'; baseRate = isNew ? rates.d1_rate_s2 : rates.d1_rate;

    } else if (isTruck && dmc <= 9000) {
      cat = 'D2'; baseRate = isNew ? rates.d2_rate_s2 : rates.d2_rate;

    } else if (isTruck && dmc < 12000) {
      cat = 'D3'; baseRate = rates.d3_rate;

    } else if (isTruck && dmc >= 12000) {
      if (osie === 2) {
        cat = 'D8';
        if (dmc < 13000)      baseRate = rates.d8_dmc_12_13;
        else if (dmc < 14000) baseRate = rates.d8_dmc_13_14;
        else if (dmc < 15000) baseRate = rates.d8_dmc_14_15;
        else                   baseRate = rates.d8_dmc_15plus;
      } else if (osie === 3) {
        cat = 'D9';
        if (dmc < 17000)      baseRate = rates.d9_dmc_12_17;
        else if (dmc < 19000) baseRate = rates.d9_dmc_17_19;
        else if (dmc < 21000) baseRate = rates.d9_dmc_19_21;
        else if (dmc < 23000) baseRate = rates.d9_dmc_21_23;
        else                   baseRate = rates.d9_dmc_23plus;
      } else {
        cat = 'D10';
        if (dmc < 25000)      baseRate = rates.d10_dmc_12_25;
        else if (dmc < 27000) baseRate = rates.d10_dmc_25_27;
        else if (dmc < 29000) baseRate = rates.d10_dmc_27_29;
        else                   baseRate = rates.d10_dmc_29plus;
      }

    } else if (isTractor) {
      const teamDmc = dmcTeam || dmc;
      if (teamDmc < 12000) {
        cat = 'D4'; baseRate = rates.d4_rate;
      } else if (osie <= 2) {
        cat = 'D11';
        if (teamDmc < 18000)      baseRate = rates.d11_dmc_12_18;
        else if (teamDmc < 25000) baseRate = rates.d11_dmc_18_25;
        else if (teamDmc < 31000) baseRate = rates.d11_dmc_25_31;
        else if (teamDmc < 36000) baseRate = rates.d11_dmc_31_36;
        else                       baseRate = rates.d11_dmc_36plus;
      } else {
        cat = 'D12';
        if (teamDmc < 36000)      baseRate = rates.d12_dmc_12_36;
        else if (teamDmc < 40000) baseRate = rates.d12_dmc_36_40;
        else                       baseRate = rates.d12_dmc_40plus;
      }

    } else if (isTrailer) {
      const teamDmc = dmcTeam || dmc;
      if (teamDmc >= 7000 && teamDmc < 12000) {
        cat = 'D5'; baseRate = rates.d5_rate;
      } else if (teamDmc >= 12000) {
        if (osie === 1) {
          cat = 'D13';
          if (teamDmc < 18000)      baseRate = rates.d13_dmc_12_18;
          else if (teamDmc < 25000) baseRate = rates.d13_dmc_18_25;
          else if (teamDmc < 36000) baseRate = rates.d13_dmc_25_36;
          else                       baseRate = rates.d13_dmc_36plus;
        } else if (osie === 2) {
          cat = 'D14';
          if (teamDmc < 28000)      baseRate = rates.d14_dmc_12_28;
          else if (teamDmc < 33000) baseRate = rates.d14_dmc_28_33;
          else if (teamDmc < 38000) baseRate = rates.d14_dmc_33_38;
          else                       baseRate = rates.d14_dmc_38plus;
        } else {
          cat = 'D15';
          if (teamDmc < 36000)      baseRate = rates.d15_dmc_12_36;
          else if (teamDmc < 38000) baseRate = rates.d15_dmc_36_38;
          else                       baseRate = rates.d15_dmc_38plus;
        }
      }
    }

    if (!baseRate || !cat) return null;
    const amount = Math.round(baseRate * miesiace / 12 * 100) / 100;
    return { cat, rate: baseRate, amount, municipality: mun, taxYear: yr };
  },

  // ── POBIERZ GMINĘ DLA POJAZDU ────────────────────────────────────
  _getMunicipalityForVehicle(v) {
    // Mapowanie właściciela → gmina
    const COMPANY_MUN = {
      'mToilet':    'Warszawa',
      'G-CON':      'Warszawa',
      'G-Rental':   'Warszawa',
      'KJR Supply': 'Warszawa',
      'Wolund':     'Warszawa',
      'NWK Invest': 'Serock',
    };
    return COMPANY_MUN[v.wlasciciel] || 'Warszawa';
  },

  // ── OCR + PARSER PDF UCHWAŁY ──────────────────────────────────────
  async readRatesFromPdf(file, onProgress) {
    const progress = onProgress || (() => {});
    progress('Wczytuję PDF uchwały...');

    // Użyj pdf-lib do renderowania stron jako canvas, potem Tesseract OCR
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;

    if (!pdfjsLib) {
      // Fallback: czytaj bezpośrednio przez FileReader + regex na tekście
      return this._readRatesFromTextFallback(file, progress);
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const maxPages = Math.min(pdf.numPages, 6);
    let fullText = '';

    for (let p = 1; p <= maxPages; p++) {
      progress(`Odczytuję stronę ${p}/${maxPages}...`);
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      fullText += content.items.map(i => i.str).join(' ') + '\n';
    }

    progress('Parsuje stawki...');
    return this._parseRatesFromText(fullText);
  },

  // Fallback — czytaj tekst z pliku przez FileReader (działa na PDF z warstwą tekstową)
  async _readRatesFromTextFallback(file, progress) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => {
        // Wyciągnij tekst z binarnego PDF przez wyrażenia regularne na surowym strumieniu
        const bytes = new Uint8Array(e.target.result);
        let text = '';
        for (let i = 0; i < bytes.length - 3; i++) {
          if (bytes[i] === 40) { // '('
            let str = '';
            let j = i + 1;
            while (j < bytes.length && bytes[j] !== 41 && j - i < 200) {
              if (bytes[j] >= 32 && bytes[j] < 127) str += String.fromCharCode(bytes[j]);
              j++;
            }
            if (str.length > 2) text += str + ' ';
          }
        }
        progress('Parsuje stawki z tekstu PDF...');
        resolve(this._parseRatesFromText(text));
      };
      reader.readAsArrayBuffer(file);
    });
  },

  // ── PARSER STAWEK Z TEKSTU ────────────────────────────────────────
  _parseRatesFromText(text) {
    const result = { found: {}, raw: text.slice(0, 2000) };
    const t = text.replace(/\s+/g, ' ');

    // Wzorce dla polskich uchwał — szuka kwot po etykietach kategorii
    const PATTERNS = [
      // "3,5 tony do 5,5 tony ... 840" lub "D.1 ... 840,00"
      { cat: 'D1',  re: /3[,.]5.*?5[,.]5.*?(\d{3,4})[,.]?(\d{0,2})/i },
      { cat: 'D2',  re: /5[,.]5.*?9\s*ton.*?(\d{3,4})[,.]?(\d{0,2})/i },
      { cat: 'D3',  re: /9\s*ton.*?12\s*ton.*?(\d{3,4})[,.]?(\d{0,2})/i },
      { cat: 'D6',  re: /autobus.*?mniej.*?22.*?(\d{3,4})[,.]?(\d{0,2})/i },
      { cat: 'D7',  re: /autobus.*?22\s*i\s*wi[eę].*?(\d{3,4})[,.]?(\d{0,2})/i },
      // Dla D.9 szukaj "23" ton i wyżej (najczęstsza stawka w uchwale)
      { cat: 'D9_23plus', re: /23\s*ton.*?i.*?wi[eę].*?(\d{3,4})[,.]?(\d{0,2})/i },
      { cat: 'D10_29plus',re: /29\s*ton.*?i.*?wi[eę].*?(\d{3,4})[,.]?(\d{0,2})/i },
    ];

    for (const { cat, re } of PATTERNS) {
      const m = t.match(re);
      if (m) {
        const val = parseFloat(m[1] + (m[2] ? '.' + m[2] : ''));
        if (val > 100 && val < 10000) {
          result.found[cat] = val;
        }
      }
    }

    // Szukaj też wzorca "1 128,00" lub "1128,00" lub "1 128" po D.2
    const amountPattern = /(\d{1,2}\s?\d{3})[,.](\d{2})/g;
    const allAmounts = [];
    let m;
    while ((m = amountPattern.exec(t)) !== null) {
      const val = parseFloat(m[1].replace(/\s/,'') + '.' + m[2]);
      if (val > 200 && val < 10000) allAmounts.push(val);
    }
    result.allAmounts = [...new Set(allAmounts)].sort((a,b) => a-b);

    console.log('[RateReader] Znaleziono kwoty:', result.allAmounts);
    console.log('[RateReader] Sparsowane stawki:', result.found);
    return result;
  },

  // ── ZAPIS STAWEK DO SUPABASE ──────────────────────────────────────
  async saveRatesToDb(municipality, taxYear, rates, meta) {
    if (!window.supabaseClient) return { ok: false };

    const payload = {
      municipality,
      tax_year: parseInt(taxYear),
      resolution_no:   meta?.resolutionNo   || null,
      resolution_date: meta?.resolutionDate || null,
      notes:           meta?.notes          || null,
      updated_at: new Date().toISOString(),
    };

    // Mapuj znalezione stawki
    const FIELD_MAP = {
      D1:        'd1_rate', D2: 'd2_rate', D3: 'd3_rate',
      D4:        'd4_rate', D5: 'd5_rate', D6: 'd6_rate', D7: 'd7_rate',
      D9_23plus: 'd9_dmc_23plus', D10_29plus: 'd10_dmc_29plus',
    };
    for (const [cat, field] of Object.entries(FIELD_MAP)) {
      if (rates[cat] != null) payload[field] = rates[cat];
    }
    // Przekaż też stawki podane ręcznie
    Object.assign(payload, rates._direct || {});

    const { error } = await window.supabaseClient
      .from('tax_rates')
      .upsert(payload, { onConflict: 'municipality,tax_year' });

    if (error) {
      console.error('[RateReader] Błąd zapisu stawek:', error.message);
      return { ok: false, error };
    }

    // Odśwież cache
    delete this._cache[`${municipality}_${taxYear}`];
    console.log('[RateReader] Stawki zapisane:', municipality, taxYear);
    return { ok: true };
  },

  // ── RENDERUJ ZAKŁADKĘ STAWKI ──────────────────────────────────────
  async renderRatesTab() {
    const el = document.getElementById('rates-content');
    if (!el) return;

    const yr  = (document.getElementById('taxYearDT1') || document.getElementById('taxYear') || {}).value || '2026';
    const mun = 'Warszawa';
    const rates = await this.loadRates(mun, parseInt(yr));

    el.innerHTML = `
      <div class="ibox" style="margin-bottom:16px">
        <i class="ti ti-building-bank"></i>
        <div>
          <strong>${mun} ${yr}</strong>
          ${rates ? ` — ${rates.resolution_no || 'brak uchwały'}` : ' — brak stawek w bazie'}
        </div>
        <button class="btn btn-blue" style="margin-left:auto" onclick="TaxOrderRateReader._openPdfUpload()">
          <i class="ti ti-upload"></i>Wgraj PDF uchwały
        </button>
      </div>

      ${rates ? this._renderRatesTable(rates) : `
        <div class="wbox">
          <i class="ti ti-alert-triangle"></i>
          Brak stawek dla gminy <strong>${mun}</strong> na rok <strong>${yr}</strong>.
          Wgraj PDF uchwały rady gminy lub wprowadź stawki ręcznie.
        </div>
      `}

      <!-- Upload modal -->
      <div id="rates-upload-panel" style="display:none;margin-top:16px">
        <div class="card-section">
          <div class="vdfg">
            <div class="vdf">
              <label class="vdl">Gmina</label>
              <input id="ru-mun" class="fi" value="${esc(mun)}">
            </div>
            <div class="vdf">
              <label class="vdl">Rok podatkowy</label>
              <input id="ru-year" class="fi" type="number" value="${yr}">
            </div>
            <div class="vdf">
              <label class="vdl">Nr uchwały</label>
              <input id="ru-resno" class="fi" placeholder="np. XXIX/1065/2025">
            </div>
            <div class="vdf">
              <label class="vdl">Data uchwalenia</label>
              <input id="ru-resdate" class="fi" type="date">
            </div>
          </div>
          <div class="upload-area" onclick="document.getElementById('ru-file').click()" style="margin:12px 0">
            <i class="ti ti-file-type-pdf" style="font-size:32px;color:var(--red)"></i>
            <div>Kliknij aby wybrać PDF uchwały rady gminy</div>
            <div style="font-size:11px;color:var(--text3)">Obsługiwane: PDF z warstwą tekstową (preferowane) lub skan z OCR</div>
            <input type="file" id="ru-file" accept=".pdf" style="display:none" onchange="TaxOrderRateReader._onPdfSelected(this.files[0])">
          </div>
          <div id="ru-progress" style="display:none;font-size:12px;color:var(--text2);margin-bottom:10px"></div>
          <div id="ru-preview" style="display:none"></div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-gray" onclick="document.getElementById('rates-upload-panel').style.display='none'">
              <i class="ti ti-x"></i>Anuluj
            </button>
            <button id="ru-save-btn" class="btn btn-green" style="display:none" onclick="TaxOrderRateReader._saveFromUpload()">
              <i class="ti ti-check"></i>Zapisz stawki do bazy
            </button>
          </div>
        </div>
      </div>
    `;
  },

  _renderRatesTable(r) {
    const row = (label, rate, rateS2) => `
      <tr>
        <td style="font-size:12px;color:var(--text2)">${label}</td>
        <td style="font-family:var(--mono);text-align:right">${rate ? Math.round(rate).toLocaleString('pl-PL') + ' zł' : '—'}</td>
        <td style="font-family:var(--mono);text-align:right;color:var(--blue)">${rateS2 ? Math.round(rateS2).toLocaleString('pl-PL') + ' zł' : '—'}</td>
      </tr>`;

    return `<div class="tbl-wrap"><table>
      <thead><tr><th>Kategoria</th><th style="text-align:right">Stawka §1</th><th style="text-align:right;color:var(--blue)">Stawka §2 (euro)</th></tr></thead>
      <tbody>
        ${row('D.1 Sam.cięż. 3,5–5,5t', r.d1_rate, r.d1_rate_s2)}
        ${row('D.2 Sam.cięż. 5,5–9t',   r.d2_rate, r.d2_rate_s2)}
        ${row('D.3 Sam.cięż. 9–12t',    r.d3_rate, null)}
        ${row('D.9 ≥12t / 3 osie / ≥23t', r.d9_dmc_23plus, null)}
        ${row('D.10 ≥12t / 4+ osie / ≥29t', r.d10_dmc_29plus, null)}
        ${row('D.6 Autobus <22 m.',     r.d6_rate, null)}
        ${row('D.7 Autobus ≥22 m.',     r.d7_rate, null)}
      </tbody>
    </table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">
      <i class="ti ti-info-circle"></i> Uchwała: ${r.resolution_no || '—'} | Rok: ${r.tax_year}
    </div>`;
  },

  _openPdfUpload() {
    document.getElementById('rates-upload-panel').style.display = '';
  },

  _pendingRates: null,

  async _onPdfSelected(file) {
    if (!file) return;
    const prog = el => { document.getElementById('ru-progress').style.display=''; document.getElementById('ru-progress').textContent = el; };
    try {
      const result = await this.readRatesFromPdf(file, prog);
      this._pendingRates = result;
      const preview = document.getElementById('ru-preview');
      preview.style.display = '';
      if (Object.keys(result.found).length) {
        preview.innerHTML = `<div class="ibox"><i class="ti ti-check" style="color:var(--green)"></i>
          Znaleziono ${Object.keys(result.found).length} stawek: ${Object.entries(result.found).map(([k,v])=>`${k}=${v}`).join(', ')}
        </div>
        <div style="font-size:11px;color:var(--text3)">Wszystkie kwoty w PDF: ${result.allAmounts?.join(', ')}</div>`;
        document.getElementById('ru-save-btn').style.display = '';
      } else {
        preview.innerHTML = `<div class="wbox"><i class="ti ti-alert-triangle"></i>
          Nie udało się automatycznie rozpoznać stawek. Wszystkie kwoty znalezione w PDF: 
          <strong>${result.allAmounts?.join(' | ')}</strong>
          <br>Wprowadź stawki ręcznie lub skontaktuj się z supportem.
        </div>`;
      }
      prog('');
    } catch(e) {
      document.getElementById('ru-progress').textContent = 'Błąd odczytu PDF: ' + e.message;
    }
  },

  async _saveFromUpload() {
    if (!this._pendingRates) return;
    const mun     = document.getElementById('ru-mun').value.trim();
    const yr      = document.getElementById('ru-year').value;
    const resNo   = document.getElementById('ru-resno').value.trim();
    const resDate = document.getElementById('ru-resdate').value;
    const r = await this.saveRatesToDb(mun, yr, this._pendingRates.found, {
      resolutionNo: resNo, resolutionDate: resDate || null,
      notes: `Wgrano z PDF: ${new Date().toLocaleDateString('pl-PL')}`
    });
    if (r.ok) {
      toast(`✓ Stawki ${mun} ${yr} zapisane do bazy`);
      document.getElementById('rates-upload-panel').style.display = 'none';
      this.renderRatesTab();
    } else {
      toast('⚠ Błąd zapisu stawek');
    }
  }
};
