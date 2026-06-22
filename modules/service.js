/**
 * TaxOrder Pro — Moduł Serwisowy
 * Historia napraw, planowane przeglądy, alerty serwisowe per pojazd
 */
window.ServiceModule = (function () {

  const SERVICE_TYPES = {
    // === PRZEGLĄDY / DOKUMENTY ===
    przeglad:          { label:'Przegląd techniczny (SKP)',     icon:'ti-clipboard-check',   color:'var(--blue)',    group:'Przeglądy / Dokumenty' },
    przeglad_wewn:     { label:'Przegląd wewnętrzny floty',    icon:'ti-checklist',          color:'var(--blue)',    group:'Przeglądy / Dokumenty' },
    gasnicy:           { label:'Gaśnice / wyposażenie BHP',    icon:'ti-fire-extinguisher',  color:'var(--red)',     group:'Przeglądy / Dokumenty' },
    oprogramowanie:    { label:'Aktualizacja oprogramowania',   icon:'ti-cpu',                color:'var(--blue)',    group:'Przeglądy / Dokumenty' },
    // === SILNIK ===
    wymiana_oleju:     { label:'Wymiana oleju + filtrów',       icon:'ti-droplet',            color:'var(--amber)',   group:'Silnik' },
    filtr:             { label:'Filtry (powietrza / kabiny)',   icon:'ti-filter',             color:'var(--green)',   group:'Silnik' },
    rozrzad:           { label:'Rozrząd / pasek / łańcuch',    icon:'ti-rotate-clockwise',   color:'var(--red)',     group:'Silnik' },
    turbo:             { label:'Turbosprężarka',                icon:'ti-wind',               color:'var(--amber)',   group:'Silnik' },
    wtryski:           { label:'Pompa wtryskowa / wtryskiwacze',icon:'ti-droplet-2',          color:'var(--amber)',   group:'Silnik' },
    chlodnica:         { label:'Układ chłodzenia / chłodnica', icon:'ti-thermometer',         color:'var(--blue)',    group:'Silnik' },
    uklad_wydechowy:   { label:'Układ wydechowy / DPF / EGR',  icon:'ti-flame',              color:'#71717a',        group:'Silnik' },
    // === NAPĘD / PODWOZIE ===
    sprzeglo:          { label:'Sprzęgło',                      icon:'ti-settings-2',         color:'#71717a',        group:'Napęd / Podwozie' },
    skrzynia_biegow:   { label:'Skrzynia biegów',               icon:'ti-adjustments-horizontal', color:'#71717a',   group:'Napęd / Podwozie' },
    most_napedowy:     { label:'Most napędowy / półosie',       icon:'ti-arrows-diff',        color:'#71717a',        group:'Napęd / Podwozie' },
    hamulce:           { label:'Układ hamulcowy',               icon:'ti-circle-half-2',      color:'var(--red)',     group:'Napęd / Podwozie' },
    zawieszenie:       { label:'Zawieszenie / amortyzatory',    icon:'ti-arrows-vertical',    color:'#71717a',        group:'Napęd / Podwozie' },
    ukl_kierowniczy:   { label:'Układ kierowniczy',             icon:'ti-steering-wheel',     color:'var(--blue)',    group:'Napęd / Podwozie' },
    // === OPONY ===
    opony_zmiana:      { label:'Zmiana opon (sezon)',           icon:'ti-circle',             color:'var(--green)',   group:'Opony' },
    opony_naprawa:     { label:'Naprawa opony / wyważanie',    icon:'ti-circle-x',           color:'var(--amber)',   group:'Opony' },
    // === ELEKTRYKA ===
    akumulator:        { label:'Akumulator',                    icon:'ti-battery-charging',   color:'var(--amber)',   group:'Elektryka' },
    alternator:        { label:'Alternator / rozrusznik',       icon:'ti-plug-connected',     color:'var(--amber)',   group:'Elektryka' },
    elektryka:         { label:'Elektryka / instalacja',        icon:'ti-bolt',               color:'var(--amber)',   group:'Elektryka' },
    klimatyzacja:      { label:'Klimatyzacja / ogrzewanie',     icon:'ti-snowflake',          color:'var(--blue)',    group:'Elektryka' },
    // === NADWOZIE / KABINA ===
    blacharstwo:       { label:'Blacharstwo / lakiernia',       icon:'ti-color-swatch',       color:'#71717a',        group:'Nadwozie / Kabina' },
    szyby:             { label:'Szyby / lusterka',              icon:'ti-photo',              color:'var(--blue)',    group:'Nadwozie / Kabina' },
    kabina:            { label:'Tapicerka / wnętrze kabiny',   icon:'ti-armchair',           color:'#71717a',        group:'Nadwozie / Kabina' },
    // === ZABUDOWA POJAZDU ===
    zabudowa_chlodnia: { label:'Zabudowa — chłodnia (agregat)',icon:'ti-temperature-minus',   color:'#0ea5e9',        group:'Zabudowa pojazdu' },
    zabudowa_izoterma: { label:'Zabudowa — izoterma',          icon:'ti-box',                color:'#0ea5e9',        group:'Zabudowa pojazdu' },
    zabudowa_winda:    { label:'Zabudowa — winda załadowcza',  icon:'ti-arrow-bar-up',       color:'var(--green)',   group:'Zabudowa pojazdu' },
    zabudowa_hds:      { label:'Zabudowa — dźwig HDS / żuraw', icon:'ti-crane',              color:'var(--amber)',   group:'Zabudowa pojazdu' },
    zabudowa_wywrotka: { label:'Zabudowa — wywrotka',          icon:'ti-truck',              color:'#71717a',        group:'Zabudowa pojazdu' },
    zabudowa_pompa:    { label:'Zabudowa — pompa / beczka',    icon:'ti-droplet-half',       color:'#0ea5e9',        group:'Zabudowa pojazdu' },
    zabudowa_plandeka: { label:'Zabudowa — plandeka / brezent',icon:'ti-tent',               color:'#71717a',        group:'Zabudowa pojazdu' },
    zabudowa_skrzynia: { label:'Zabudowa — skrzynia ładunkowa',icon:'ti-package',            color:'#71717a',        group:'Zabudowa pojazdu' },
    zabudowa_specjalna:{ label:'Zabudowa — specjalna / inne',  icon:'ti-building-factory',   color:'var(--amber)',   group:'Zabudowa pojazdu' },
    // === AWARIE / INNE ===
    naprawa:           { label:'Naprawa awaryjna',              icon:'ti-tools',              color:'var(--red)',     group:'Awarie / Inne' },
    holowanie:         { label:'Holowanie / pomoc drogowa',     icon:'ti-truck-loading',      color:'var(--red)',     group:'Awarie / Inne' },
    inne:              { label:'Inne',                          icon:'ti-dots',               color:'#71717a',        group:'Awarie / Inne' },
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _fmtDate(d) {
    if (!d) return '—';
    const [y,m,day] = d.split('-');
    return `${day}.${m}.${y}`;
  }

  function _daysDiff(dateStr) {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr) - new Date()) / 86400000);
  }

  function _urgencyColor(days) {
    if (days === null) return 'var(--text3)';
    if (days < 0) return 'var(--red)';
    if (days <= 14) return 'var(--red)';
    if (days <= 30) return 'var(--amber)';
    return 'var(--text2)';
  }

  function _makeid() { return String(Date.now()) + String(Math.random()).slice(2); }

  // ── Nadchodzące serwisy (dla całej floty) ─────────────────────────────────
  function getUpcomingServices(days) {
    days = days === undefined ? 90 : days;
    const result = [];
    (window.vehs || []).forEach(v => {
      (v.serviceHistory || []).forEach(s => {
        if (!s.nextServiceDate && !s.nextServiceKm) return;
        const d = s.nextServiceDate ? _daysDiff(s.nextServiceDate) : null;
        if (d !== null && d <= days) result.push({ v, s, days: d });
      });
    });
    return result.sort((a, b) => (a.days || 0) - (b.days || 0));
  }

  // ── Globalne okno ─────────────────────────────────────────────────────────
  function open() {
    document.getElementById('service-modal').style.display = 'flex';
    _renderServiceModal();
  }

  function close() {
    document.getElementById('service-modal').style.display = 'none';
  }

  function _renderServiceModal() {
    const el = document.getElementById('service-modal-body');
    if (!el) return;

    const upcoming = getUpcomingServices(90);
    const overdue  = upcoming.filter(x => x.days < 0);
    const soon30   = upcoming.filter(x => x.days >= 0 && x.days <= 30);
    const later    = upcoming.filter(x => x.days > 30);

    const now = new Date();
    const recent = [];
    (window.vehs || []).forEach(v => {
      (v.serviceHistory || []).forEach(s => {
        const d = _daysDiff(s.date);
        if (d !== null && d >= -30 && d <= 0) recent.push({ v, s });
      });
    });
    recent.sort((a, b) => new Date(b.s.date) - new Date(a.s.date));

    // Koszty serwisowe bieżącego roku
    const yr = now.getFullYear().toString();
    let yrCost = 0;
    (window.vehs || []).forEach(v => (v.serviceHistory || []).forEach(s => {
      if ((s.date || '').startsWith(yr)) yrCost += (s.cost || 0);
    }));

    el.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
        <div class="stat-chip ${overdue.length ? 'stat-chip-amber' : ''}"><span>${overdue.length}</span> zaległe</div>
        <div class="stat-chip"><span>${soon30.length}</span> w ciągu 30 dni</div>
        <div class="stat-chip"><span>${later.length}</span> do 90 dni</div>
        <div class="stat-chip stat-chip-green"><span>${recent.length}</span> wykonane (30 dni)</div>
        <div class="stat-chip stat-chip-amber"><span>${yrCost.toFixed(0)} zł</span> serwis ${yr}</div>
        <button class="btn btn-blue" style="font-size:11px;margin-left:auto" onclick="ServiceModule.addServiceGlobal()">
          <i class="ti ti-plus"></i>Dodaj serwis
        </button>
      </div>

      ${overdue.length ? `
        <div style="font-size:12px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">🔴 Zaległe</div>
        ${_upcomingTable(overdue)}
        <div style="margin-bottom:20px"></div>` : ''}

      ${soon30.length ? `
        <div style="font-size:12px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">🟡 W ciągu 30 dni</div>
        ${_upcomingTable(soon30)}
        <div style="margin-bottom:20px"></div>` : ''}

      ${later.length ? `
        <div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">📅 31–90 dni</div>
        ${_upcomingTable(later)}
        <div style="margin-bottom:20px"></div>` : ''}

      ${recent.length ? `
        <div style="font-size:12px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">✅ Ostatnio wykonane (30 dni)</div>
        <div class="tbl-wrap"><table style="width:100%;font-size:12px">
          <thead><tr><th>Data</th><th>Nr rej.</th><th>Pojazd</th><th>Typ</th><th>Opis</th><th>Km</th><th>Koszt</th><th>Warsztat</th></tr></thead>
          <tbody>
            ${recent.map(({ v, s }) => {
              const t = SERVICE_TYPES[s.type] || SERVICE_TYPES.inne;
              return `<tr style="cursor:pointer" onclick="TaxOrderVehicleDetail.open(${v.id})">
                <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(s.date)}</td>
                <td style="font-family:var(--mono);font-weight:700">${v.nrRej}</td>
                <td>${v.marka} ${v.model}</td>
                <td><span style="color:${t.color}"><i class="ti ${t.icon}"></i> ${t.label}</span></td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.description || '—'}</td>
                <td style="font-family:var(--mono);text-align:right">${s.km ? s.km.toLocaleString('pl-PL') : '—'}</td>
                <td style="font-family:var(--mono);font-weight:600">${s.cost ? s.cost.toFixed(2)+' zł' : '—'}</td>
                <td>${s.workshop || '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>` : ''}

      ${!overdue.length && !soon30.length && !later.length && !recent.length ?
        `<div style="text-align:center;padding:40px;color:var(--text3)">
          <i class="ti ti-check" style="font-size:36px;display:block;margin-bottom:10px;color:var(--green)"></i>
          Brak zaplanowanych serwisów. Dodaj historię serwisową w kartach pojazdów.
        </div>` : ''}`;
  }

  function _upcomingTable(items) {
    return `<div class="tbl-wrap"><table style="width:100%;font-size:12px">
      <thead><tr><th>Nr rej.</th><th>Pojazd</th><th>Typ</th><th>Termin</th><th>Następne km</th><th>Dni</th><th></th></tr></thead>
      <tbody>
        ${items.map(({ v, s }) => {
          const t = SERVICE_TYPES[s.type] || SERVICE_TYPES.inne;
          const days = s.nextServiceDate ? _daysDiff(s.nextServiceDate) : null;
          return `<tr>
            <td onclick="TaxOrderVehicleDetail.open(${v.id})" style="cursor:pointer;font-family:var(--mono);font-weight:700">${v.nrRej}</td>
            <td>${v.marka} ${v.model}</td>
            <td><span style="color:${t.color}"><i class="ti ${t.icon}"></i> ${t.label}</span></td>
            <td style="font-family:var(--mono)">${_fmtDate(s.nextServiceDate)}</td>
            <td style="font-family:var(--mono)">${s.nextServiceKm ? s.nextServiceKm.toLocaleString('pl-PL')+' km' : '—'}</td>
            <td style="font-weight:700;color:${_urgencyColor(days)}">${days !== null ? (days < 0 ? `${Math.abs(days)} temu` : `za ${days}`) : '—'}</td>
            <td><button class="btn btn-gray" style="font-size:10px;padding:2px 8px" onclick="ServiceModule.addService(${v.id})"><i class="ti ti-plus"></i>Dodaj</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  // ── Dodaj/edytuj serwis ───────────────────────────────────────────────────
  function addService(vehId, serviceId) {
    const v = (window.vehs || []).find(x => x.id == vehId);
    if (!v) return;
    const ex = serviceId ? (v.serviceHistory || []).find(s => s.id == serviceId) : null;

    const selectedType = ex?.type || 'wymiana_oleju';
    const groups = {};
    Object.entries(SERVICE_TYPES).forEach(([k, t]) => {
      const g = t.group || 'Inne';
      if (!groups[g]) groups[g] = [];
      groups[g].push([k, t]);
    });
    const typeOpts = Object.entries(groups).map(([grp, items]) =>
      `<optgroup label="─── ${grp} ───">
        ${items.map(([k, t]) => `<option value="${k}" ${selectedType === k ? 'selected' : ''}>${t.label}</option>`).join('')}
      </optgroup>`
    ).join('');

    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9300;display:flex;align-items:center;justify-content:center;padding:1rem';
    const canEdit = !ex || window.currentUser?.role === 'admin' || window.currentUser?.role === 'dyspozytor';
    const defCurr = ex?.currency || 'PLN';
    const defVat  = ex?.vatRate  != null ? ex.vatRate : 23;
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:620px;max-width:98vw;max-height:92vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-tools" style="color:var(--blue)"></i>${ex ? 'Edytuj' : 'Dodaj'} serwis — <span style="font-family:var(--mono)">${v.nrRej}</span>
          <span style="font-size:12px;font-weight:400;color:var(--text2);margin-left:4px">${v.marka} ${v.model}</span>
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Typ serwisu *</label>
            <select id="_svc-type" class="fi">${typeOpts}</select>
          </div>
          <div class="vdf">
            <label class="vdl">Data wykonania *</label>
            <div style="display:flex;gap:6px">
              <input id="_svc-date" type="date" class="fi" value="${ex?.date || new Date().toISOString().slice(0,10)}" style="flex:1">
              <input id="_svc-date-txt" type="text" class="fi" placeholder="DD.MM.RRRR" maxlength="10" style="width:110px"
                oninput="ServiceModule._parseDateText(this)" value="${ex?.date ? ex.date.split('-').reverse().join('.') : ''}">
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Wpisz datę lub wybierz z kalendarza</div>
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Opis / zakres prac</label>
            <input id="_svc-desc" type="text" class="fi" placeholder="np. Wymiana oleju 5W-40 + filtr oleju" value="${ex?.description || ''}">
          </div>
          <div class="vdf">
            <label class="vdl">Przebieg przy serwisie (km)</label>
            <input id="_svc-km" type="number" class="fi" value="${ex?.km || v.stanKilometrow || ''}">
          </div>

          <!-- Waluta i VAT -->
          <div class="vdf">
            <label class="vdl">Waluta naprawy</label>
            <select id="_svc-currency" class="fi" onchange="ServiceModule._onCurrencyChange(this)">
              <option value="PLN" ${defCurr==='PLN'?'selected':''}>PLN — złoty</option>
              <option value="EUR" ${defCurr==='EUR'?'selected':''}>EUR — euro</option>
              <option value="USD" ${defCurr==='USD'?'selected':''}>USD — dolar am.</option>
              <option value="GBP" ${defCurr==='GBP'?'selected':''}>GBP — funt</option>
              <option value="CZK" ${defCurr==='CZK'?'selected':''}>CZK — korona cz.</option>
              <option value="NOK" ${defCurr==='NOK'?'selected':''}>NOK — korona nor.</option>
              <option value="CHF" ${defCurr==='CHF'?'selected':''}>CHF — frank szw.</option>
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Stawka VAT</label>
            <select id="_svc-vat" class="fi" onchange="ServiceModule._calcNetto(document.getElementById('_svc-cost'))">
              <option value="23" ${defVat==23?'selected':''}>23% (standard)</option>
              <option value="8"  ${defVat==8?'selected':''}>8%</option>
              <option value="5"  ${defVat==5?'selected':''}>5%</option>
              <option value="0"  ${defVat==0?'selected':''}>0% (zwolniony)</option>
            </select>
          </div>
          <div id="_svc-curr-info" style="grid-column:1/-1;font-size:11px;color:var(--amber);display:${defCurr!=='PLN'?'block':'none'}">
            ⚠ Koszty w walucie obcej — wartości w PLN przelicz ręcznie lub wpisz w walucie oryginalnej
          </div>

          <div class="vdf">
            <label class="vdl">Koszt brutto (<span id="_svc-curr-lbl">${defCurr}</span>)</label>
            <input id="_svc-cost" type="number" step="0.01" class="fi" value="${ex?.cost || ''}"
              oninput="ServiceModule._calcNetto(this)" placeholder="0.00">
          </div>
          <div class="vdf">
            <label class="vdl">Koszt netto (<span id="_svc-curr-lbl2">${defCurr}</span>)</label>
            <input id="_svc-costn" type="number" step="0.01" class="fi" value="${ex?.costNet || ''}"
              oninput="ServiceModule._calcBrutto(this)" placeholder="0.00">
          </div>

          <!-- Warsztat -->
          <div class="vdf">
            <label class="vdl">Warsztat / serwis</label>
            <input id="_svc-workshop" type="text" class="fi" placeholder="np. ASO Volkswagen Warszawa" value="${ex?.workshop || ''}">
          </div>
          <div class="vdf">
            <label class="vdl">NIP warsztatu / serwisu</label>
            <input id="_svc-nip" type="text" class="fi" placeholder="000-000-00-00" maxlength="13"
              oninput="this.value=this.value.replace(/[^0-9-]/g,'')" value="${ex?.workshopNip || ''}">
          </div>
          <div class="vdf">
            <label class="vdl">Nr faktury / zlecenia</label>
            <input id="_svc-invoice" type="text" class="fi" value="${ex?.invoiceNo || ''}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Wymienione części / materiały</label>
            <input id="_svc-parts" type="text" class="fi" placeholder="np. filtr oleju, filtr powietrza, olej 5l 5W-40" value="${ex?.parts || ''}">
          </div>
          <div class="vdf">
            <label class="vdl">Następny serwis — data</label>
            <input id="_svc-nextdate" type="date" class="fi" value="${ex?.nextServiceDate || ''}">
          </div>
          <div class="vdf">
            <label class="vdl">Następny serwis — km</label>
            <input id="_svc-nextkm" type="number" class="fi" placeholder="np. 175000" value="${ex?.nextServiceKm || ''}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Uwagi</label>
            <input id="_svc-notes" type="text" class="fi" value="${ex?.notes || ''}">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          ${ex && canEdit ? `<button class="btn btn-gray" style="color:var(--red);margin-right:auto" onclick="ServiceModule.removeService(${vehId},'${ex.id}',this)">
            <i class="ti ti-trash"></i>Usuń</button>` : ''}
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-blue" onclick="ServiceModule.saveService(${vehId},'${ex ? ex.id : ''}',this)">
            <i class="ti ti-check"></i>Zapisz serwis
          </button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    document.getElementById('_svc-desc')?.focus();
  }

  function addServiceGlobal() {
    const vs = window.vehs || [];
    if (!vs.length) { toast('Brak pojazdów w bazie'); return; }
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9400;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:420px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:700;margin-bottom:16px">Wybierz pojazd</div>
        <select id="_svc-pick-veh" class="fi" style="margin-bottom:16px">
          ${vs.map(v => `<option value="${v.id}">${v.nrRej} — ${v.marka} ${v.model}</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-blue" onclick="const id=+document.getElementById('_svc-pick-veh').value;this.closest('[style*=fixed]').remove();ServiceModule.addService(id)">
            <i class="ti ti-arrow-right"></i>Dalej
          </button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }

  async function saveService(vehId, serviceId, btn) {
    const v = (window.vehs || []).find(x => x.id == vehId);
    if (!v) return;
    const g  = id => document.getElementById(id)?.value?.trim() || '';
    const gf = id => { const val = g(id); return val ? parseFloat(val.replace(',', '.')) : null; };
    const gi = id => { const val = g(id); return val ? parseInt(val) : null; };

    const date = g('_svc-date');
    const type = g('_svc-type');
    if (!date) { toast('⚠ Podaj datę serwisu'); return; }

    const record = {
      id: serviceId || _makeid(),
      date, type,
      description:    g('_svc-desc'),
      km:             gi('_svc-km'),
      cost:           gf('_svc-cost'),
      costNet:        gf('_svc-costn'),
      currency:       g('_svc-currency') || 'PLN',
      vatRate:        parseInt(g('_svc-vat') || '23'),
      workshop:       g('_svc-workshop'),
      workshopNip:    g('_svc-nip'),
      invoiceNo:      g('_svc-invoice'),
      parts:          g('_svc-parts'),
      nextServiceDate:g('_svc-nextdate'),
      nextServiceKm:  gi('_svc-nextkm'),
      notes:          g('_svc-notes'),
      createdBy:      window.currentUser?.id,
      createdAt:      ex?.createdAt || new Date().toISOString(),
    };

    if (!Array.isArray(v.serviceHistory)) v.serviceHistory = [];
    const idx = v.serviceHistory.findIndex(s => s.id == serviceId);
    if (serviceId && idx >= 0) v.serviceHistory[idx] = record;
    else v.serviceHistory.push(record);
    v.serviceHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    btn.closest('[style*=fixed]').remove();
    if (window.TaxOrderFleetCloud?.saveVehicle) await window.TaxOrderFleetCloud.saveVehicle(v);
    toast('✓ Serwis zapisany');
    if (typeof renderDash === 'function') renderDash();
    window.TaxOrderVehicleDetail?.refreshServiceTab?.(v.id);
    if (document.getElementById('service-modal-body')) _renderServiceModal();
  }

  async function removeService(vehId, serviceId, btn) {
    const v = (window.vehs || []).find(x => x.id == vehId);
    if (!v) return;
    v.serviceHistory = (v.serviceHistory || []).filter(s => s.id != serviceId);
    btn.closest('[style*=fixed]').remove();
    if (window.TaxOrderFleetCloud?.saveVehicle) await window.TaxOrderFleetCloud.saveVehicle(v);
    toast('Serwis usunięty');
    window.TaxOrderVehicleDetail?.refreshServiceTab?.(v.id);
    if (document.getElementById('service-modal-body')) _renderServiceModal();
  }

  // ── Zakładka Serwis w vehicle-detail (HTML) ───────────────────────────────
  function renderServiceTabHtml(v) {
    const history = (v.serviceHistory || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const planned = history.filter(s => s.nextServiceDate || s.nextServiceKm);

    const yr = new Date().getFullYear().toString();
    const yearCost  = history.filter(s => (s.date||'').startsWith(yr)).reduce((sum, s) => sum + (s.cost||0), 0);
    const totalCost = history.reduce((sum, s) => sum + (s.cost||0), 0);

    return `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
        <div class="stat-chip"><span>${history.length}</span> serwisów</div>
        <div class="stat-chip stat-chip-amber"><span>${yearCost.toFixed(0)} zł</span> w ${yr} r.</div>
        <div class="stat-chip"><span>${totalCost.toFixed(0)} zł</span> łącznie</div>
        <button class="btn btn-blue" style="font-size:12px;margin-left:auto" onclick="ServiceModule.addService(${v.id})">
          <i class="ti ti-plus"></i>Dodaj serwis
        </button>
      </div>

      ${planned.length ? `
        <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Zaplanowane</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:18px">
          ${planned.map(s => {
            const t = SERVICE_TYPES[s.type] || SERVICE_TYPES.inne;
            const days = s.nextServiceDate ? _daysDiff(s.nextServiceDate) : null;
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius);border-left:3px solid ${t.color}">
              <i class="ti ${t.icon}" style="color:${t.color};font-size:16px;flex-shrink:0"></i>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600">${t.label}${s.description ? ' — ' + s.description : ''}</div>
                <div style="font-size:11px;color:var(--text2)">
                  ${s.nextServiceKm ? 'km ' + s.nextServiceKm.toLocaleString('pl-PL') + ' · ' : ''}
                  ${s.nextServiceDate ? _fmtDate(s.nextServiceDate) : ''}
                </div>
              </div>
              ${days !== null ? `<span style="font-size:12px;font-weight:700;color:${_urgencyColor(days)}">${days < 0 ? Math.abs(days)+' dni temu' : 'za '+days+' dni'}</span>` : ''}
              <button class="btn btn-gray" style="font-size:10px;padding:2px 8px" onclick="ServiceModule.addService(${v.id},'${s.id}')">✏</button>
            </div>`;
          }).join('')}
        </div>` : ''}

      <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Historia serwisowa</div>
      ${history.length ? `
        <div class="tbl-wrap"><table style="width:100%;font-size:11px">
          <thead><tr>
            <th>Data</th><th>Typ</th><th>Opis</th><th>Km</th>
            <th>Brutto</th><th>Netto</th><th>VAT</th><th>Warsztat</th><th>NIP</th><th>Faktura</th><th style="text-align:center"></th>
          </tr></thead>
          <tbody>
            ${history.map(s => {
              const t = SERVICE_TYPES[s.type] || SERVICE_TYPES.inne;
              const curr = s.currency || 'PLN';
              const canEdit = window.currentUser?.role === 'admin' || window.currentUser?.role === 'dyspozytor';
              return `<tr>
                <td style="font-family:var(--mono);white-space:nowrap">${_fmtDate(s.date)}</td>
                <td><span style="color:${t.color}"><i class="ti ${t.icon}"></i> ${t.label}</span></td>
                <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.description||''}">${s.description||'—'}</td>
                <td style="font-family:var(--mono);text-align:right">${s.km ? s.km.toLocaleString('pl-PL') : '—'}</td>
                <td style="font-family:var(--mono);font-weight:600;text-align:right;white-space:nowrap">${s.cost ? s.cost.toFixed(2)+' '+curr : '—'}</td>
                <td style="font-family:var(--mono);text-align:right;white-space:nowrap">${s.costNet ? s.costNet.toFixed(2)+' '+curr : '—'}</td>
                <td style="font-size:10px;color:var(--text3)">${s.vatRate != null ? s.vatRate+'%' : '—'}</td>
                <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.workshop||''}">${s.workshop||'—'}</td>
                <td style="font-family:var(--mono);font-size:10px;color:var(--text2)">${s.workshopNip||'—'}</td>
                <td style="font-family:var(--mono);font-size:10px">${s.invoiceNo||'—'}</td>
                <td style="text-align:center;white-space:nowrap">
                  ${canEdit ? `<button class="btn btn-gray" style="font-size:10px;padding:2px 8px" onclick="ServiceModule.addService(${v.id},'${s.id}')">✏</button>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>` : `<div style="text-align:center;padding:20px;color:var(--text3)">Brak historii serwisowej. Kliknij "Dodaj serwis" aby rozpocząć.</div>`}`;
  }

  // ── Helpers dla formularza serwisu ───────────────────────────────────────
  function _calcNetto(bruttoEl) {
    const brutto = parseFloat(bruttoEl?.value);
    const vat = parseInt(document.getElementById('_svc-vat')?.value || '23');
    const nettoEl = document.getElementById('_svc-costn');
    if (!isNaN(brutto) && nettoEl) nettoEl.value = (brutto / (1 + vat / 100)).toFixed(2);
  }

  function _calcBrutto(nettoEl) {
    const netto = parseFloat(nettoEl?.value);
    const vat = parseInt(document.getElementById('_svc-vat')?.value || '23');
    const bruttoEl = document.getElementById('_svc-cost');
    if (!isNaN(netto) && bruttoEl) bruttoEl.value = (netto * (1 + vat / 100)).toFixed(2);
  }

  function _onCurrencyChange(sel) {
    const curr = sel.value;
    document.getElementById('_svc-curr-lbl')?.childNodes[0] && (document.getElementById('_svc-curr-lbl').textContent = curr);
    document.getElementById('_svc-curr-lbl2')?.childNodes[0] && (document.getElementById('_svc-curr-lbl2').textContent = curr);
    const info = document.getElementById('_svc-curr-info');
    if (info) info.style.display = curr !== 'PLN' ? 'block' : 'none';
  }

  function _parseDateText(el) {
    const val = el.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
      const dateEl = document.getElementById('_svc-date');
      if (dateEl && !isNaN(new Date(iso))) dateEl.value = iso;
    }
  }

  return {
    open, close,
    addService, addServiceGlobal, saveService, removeService,
    renderServiceTabHtml,
    getUpcomingServices,
    SERVICE_TYPES,
    _calcNetto, _calcBrutto, _onCurrencyChange, _parseDateText,
  };
})();
