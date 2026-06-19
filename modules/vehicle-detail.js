// ==================== VEHICLE DETAIL MODAL ====================
// Karta pojazdu z pełnymi danymi DR, leasingiem, archiwizacją, kartami flotowymi

window.TaxOrderVehicleDetail = {

  open(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    this._currentVehId = vehId;
    this._render(v);
    document.getElementById('vd-modal').style.display = 'flex';
  },

  close() {
    document.getElementById('vd-modal').style.display = 'none';
  },

  async save(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    const g  = id => document.getElementById('vd-' + id)?.value?.trim() || null;
    const gb = id => document.getElementById('vd-' + id)?.checked || false;
    const gi = id => { const val = g(id); return val ? parseInt(val) : null; };
    const gf = id => { const val = g(id); return val ? parseFloat(val) : null; };

    Object.assign(v, {
      // === DOWÓD REJESTRACYJNY ===
      dataRejestracji:      g('dataRej'),          // B
      docDataWydania:       g('docDataWydania'),   // I
      docWaznyDo:           g('docWaznyDo'),        // H
      katPojazdu:           g('katPojazdu'),        // J
      homologacja:          g('homologacja'),       // K
      wariant:              g('wariant'),           // D.2 typ/wariant
      wersja:               g('wersja'),            // D.3 wersja handlowa
      przeznaczenie:        g('przeznaczenie'),
      dmcMax:               gi('dmcMax'),           // F.1
      dmcZespolu:           gi('dmcZespolu2'),      // F.2 DMC zestawu
      masaWlasna:           gi('masaWlasna'),       // G
      ladownosc:            gi('ladownosc'),        // ładowność
      masaPrzyczepyZHam:    gi('masaPrzyczepyZHam'),  // O.1
      masaPrzyczepyBezHam:  gi('masaPrzyczepyBezHam'), // O.2
      rozstawOsi:           gi('rozstawOsi'),       // M.1 mm
      pojSilnika:           gi('pojSilnika'),       // P.1
      mocKW:                gf('mocKW'),            // P.2
      paliwo:               g('paliwo'),            // P.3
      miejscaSied:          gi('miejscaSied'),      // S.1
      miejscaStoj:          gi('miejscaStoj'),      // S.2
      drivetype:            g('driveType'),
      bodyType:             g('bodyType'),
      numerSilnika:         g('numerSilnika'),
      kolorNadwozia:        g('kolorNadwozia'),
      // === UBEZPIECZENIA ===
      ocPolicyNo:    g('ocPolicyNo'),
      ocInsurer:     g('ocInsurer'),
      ocStart:       g('ocStart'),
      ocEnd:         g('ocEnd'),
      ocPremium:     gf('ocPremium'),
      acPolicyNo:    g('acPolicyNo'),
      acInsurer:     g('acInsurer'),
      acStart:       g('acStart'),
      acEnd:         g('acEnd'),
      acPremium:     gf('acPremium'),
      assPolicyNo:   g('assPolicyNo'),
      assInsurer:    g('assInsurer'),
      assEnd:        g('assEnd'),
      // === BADANIA — PRZEGLĄDY ===
      nextInspection:    g('nextInspection'),
      inspectionStation: g('inspectionStation'),
      // === BADANIA — UDT ===
      hasUdt:         gb('hasUdt'),
      udtDeviceType:  g('udtDeviceType'),
      udtDeviceNo:    g('udtDeviceNo'),
      udtCertNo:      g('udtCertNo'),
      udtLastDate:    g('udtLastDate'),
      udtNextDate:    g('udtNextDate'),
      udtResult:      g('udtResult'),
      // === BADANIA — TACHOGRAF ===
      hasTacho:       gb('hasTacho'),
      tachoNo:        g('tachoNo'),
      tachoLastCalib: g('tachoLastCalib'),
      tachoNextCalib: g('tachoNextCalib'),
      // === EKSPLOATACJA ===
      kierowca:       g('kierowca'),
      stanKilometrow: gi('stanKilometrow'),
      kartaOrlen:     g('kartaOrlen'),
      normaSpalania:  gf('normaSpalania'),
      // === WŁASNOŚĆ ===
      ownership_type:    g('ownershipType'),
      leasingCompany:    g('leasingCompany'),
      leasingContractNo: g('leasingContractNo'),
      leasingStart:      g('leasingStart'),
      leasingEnd:        g('leasingEnd'),
      leasingRate:       gf('leasingRate'),
      leasingBuyout:     gf('leasingBuyout'),
      leasingKmLimit:    gi('leasingKmLimit'),
      rentalCompany:     g('rentalCompany'),
      rentalStart:       g('rentalStart'),
      rentalEnd:         g('rentalEnd'),
      // === ZAKUP / SPRZEDAŻ ===
      purchaseDate:   g('purchaseDate'),
      purchasePrice:  gf('purchasePrice'),
      purchaseInvoice:g('purchaseInvoice'),
      dataNabycia:    g('purchaseDate'),
      saleDate:       g('saleDate'),
      saleInvoice:    g('saleInvoice'),
      saleBuyer:      g('saleBuyer'),
      salePrice:      gf('salePrice'),
      dataZbycia:     g('saleDate'),
      dataWycofania:      g('dataWycofania'),
      dataDopuszczenia:   g('dataDopuszczenia'),
      dataWyrejestrowania:g('dataWyrejestrowania'),
      // === OPONY ===
      tireNextChange: g('tireNextChange'),
      tireSeason:     g('tireSeason'),
      tireFL: { size:g('tireFL_size'), brand:g('tireFL_brand'), dot:gi('tireFL_dot'), depth:gf('tireFL_depth'), changed:g('tireFL_changed') },
      tireFR: { size:g('tireFR_size'), brand:g('tireFR_brand'), dot:gi('tireFR_dot'), depth:gf('tireFR_depth'), changed:g('tireFR_changed') },
      tireRL: { size:g('tireRL_size'), brand:g('tireRL_brand'), dot:gi('tireRL_dot'), depth:gf('tireRL_depth'), changed:g('tireRL_changed') },
      tireRR: { size:g('tireRR_size'), brand:g('tireRR_brand'), dot:gi('tireRR_dot'), depth:gf('tireRR_depth'), changed:g('tireRR_changed') },
      tireSP: { size:g('tireSP_size'), brand:g('tireSP_brand'), dot:gi('tireSP_dot') },
      // === UWAGI ===
      uwagi: g('uwagi'),
    });

    // Archiwizacja
    const shouldArchive = gb('archiveVeh');
    if (shouldArchive && v.is_active !== false) {
      v.is_active = false;
      v.archivedAt = new Date().toISOString();
      v.archivedReason = g('archivedReason') || 'sprzedaż';
    } else if (!shouldArchive) {
      v.is_active = true;
      v.archivedAt = null;
    }

    // Zapisz (lokalnie zawsze, chmura jeśli dostępna)
    if (typeof renderVeh === 'function') renderVeh();
    if (typeof renderDash === 'function') renderDash();
    if (window.TaxOrderFleetCloud?.saveVehicle) {
      const r = await window.TaxOrderFleetCloud.saveVehicle(v);
      if (r.ok) {
        toast('✓ Dane pojazdu ' + v.nrRej + ' zapisane');
      } else {
        toast('⚠ Błąd zapisu do chmury — dane zapisane lokalnie');
      }
    } else {
      toast('✓ Dane pojazdu ' + v.nrRej + ' zaktualizowane');
    }
    this.close();
  },

  _render(v) {
    const own = v.ownership_type || 'own';
    const isLeasing = own === 'leasing';
    const isRental  = own === 'rental';
    const isArchived = v.is_active === false;

    const field = (id, label, val, type='text', hint='') => `
      <div class="vdf">
        <label class="vdl">${label}${hint ? `<span class="vdh">${hint}</span>` : ''}</label>
        <input id="vd-${id}" type="${type}" class="fi" value="${val ?? ''}" autocomplete="off">
      </div>`;

    const sel = (id, label, options, val) => `
      <div class="vdf">
        <label class="vdl">${label}</label>
        <select id="vd-${id}" class="fi">
          ${options.map(([v2,l]) => `<option value="${v2}" ${v2===val?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;

    document.getElementById('vd-modal-body').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:0.5px solid var(--border)">
        <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:var(--blue-light);display:flex;align-items:center;justify-content:center">
          <i class="ti ti-truck" style="font-size:24px;color:var(--blue)"></i>
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;font-family:var(--mono)">${v.nrRej}</div>
          <div style="font-size:13px;color:var(--text2)">${v.marka} ${v.model} · ${v.rok || '—'} · ${v.vin || '—'}</div>
        </div>
        ${isArchived ? '<span class="pill pill-red" style="margin-left:auto">ARCHIWUM</span>' : ''}
        <div style="display:flex;gap:8px;${isArchived?'':'margin-left:auto'}">
          ${v.cepikSyncStatus === 'ok' ? '<span class="pill pill-green" style="font-size:10px">CEPiK ✓</span>' :
            v.cepikSyncStatus === 'never' ? '' :
            '<span class="pill pill-amber" style="font-size:10px">CEPiK sync</span>'}
        </div>
      </div>

      <!-- TABS — 8 zakładek, scrollowane -->
      <div id="vd-tabs" style="display:flex;gap:2px;margin-bottom:20px;background:var(--bg3);border-radius:var(--radius);padding:3px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:thin">
        ${[
          ['dr',        '📋 DR'],
          ['insurance', '🛡 Polisy'],
          ['badania',   '🔧 Badania'],
          ['serwis',    '🔩 Serwis'],
          ['opony',     '⭕ Opony'],
          ['eksploatacja','⚙ Eksploatacja'],
          ['koszty',    '⛽ Koszty'],
          ['ownership', '🏢 Własność'],
          ['purchase',  '💰 Zakup/Zbycie'],
          ['archive',   '📦 Archiwum'],
          ['notes',     '📝 Uwagi'],
          ['dokumenty', '📄 Dokumenty'],
          ['mandaty',   '🚨 Mandaty'],
          ['gps',       '🗺 GPS'],
        ].map(([tabKey, fallback], i) => {
          const label = window.t ? (window.t('vd.tab.' + tabKey) !== 'vd.tab.' + tabKey ? window.t('vd.tab.' + tabKey) : fallback) : fallback;
          return `
          <button onclick="TaxOrderVehicleDetail._tab('${tabKey}')" id="vd-tab-${tabKey}"
            style="flex-shrink:0;padding:6px 10px;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-weight:500;white-space:nowrap;
            background:${i===0?'var(--bg)':'transparent'};color:${i===0?'var(--text)':'var(--text2)'}">
            ${label}
          </button>`;
        }).join('')}
      </div>

      <!-- TAB: DOWÓD REJESTRACYJNY -->
      <div id="vd-tab-dr-content" class="vd-tab-content">
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Identyfikacja dokumentu</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('dataRej','B — Data 1. rej. w Polsce', v.dataRejestracji,'date')}
          ${field('docDataWydania','I — Data wydania DR', v.docDataWydania,'date')}
          ${field('docWaznyDo','H — DR ważny do', v.docWaznyDo,'date')}
          ${field('homologacja','K — Nr homologacji', v.homologacja)}
          ${field('katPojazdu','J — Kategoria (M1/N1/N2…)', v.katPojazdu)}
          ${field('wariant','D.2 — Typ / wariant', v.wariant)}
          ${field('wersja','D.3 — Wersja handlowa', v.wersja)}
          ${field('przeznaczenie','Przeznaczenie', v.przeznaczenie,undefined,'ciężarowe / specjalne…')}
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Masy i wymiary</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('dmcMax','F.1 — DMC (kg)', v.dmcMax,'number')}
          ${field('dmcZespolu2','F.2 — DMC zespołu (kg)', v.dmcZespolu,'number')}
          ${field('masaWlasna','G — Masa własna (kg)', v.masaWlasna,'number')}
          ${field('ladownosc','Ładowność (kg)', v.ladownosc,'number')}
          ${field('masaPrzyczepyZHam','O.1 — Masa przyczepy z ham. (kg)', v.masaPrzyczepyZHam,'number')}
          ${field('masaPrzyczepyBezHam','O.2 — Masa przyczepy bez ham. (kg)', v.masaPrzyczepyBezHam,'number')}
          ${field('rozstawOsi','M.1 — Rozstaw osi (mm)', v.rozstawOsi,'number')}
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Silnik i nadwozie</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('pojSilnika','P.1 — Pojemność silnika (cm³)', v.pojSilnika,'number')}
          ${field('mocKW','P.2 — Moc (kW)', v.mocKW,'number')}
          ${field('paliwo','P.3 — Rodzaj paliwa', v.paliwo)}
          ${field('numerSilnika','Nr silnika', v.numerSilnika)}
          ${field('kolorNadwozia','Kolor nadwozia', v.kolorNadwozia)}
          ${sel('driveType','Rodzaj napędu',[
            ['','— nie określono —'],['2x4','2×4'],['4x4','4×4 (AWD/4WD)'],
            ['6x4','6×4'],['6x2','6×2'],['8x4','8×4'],['elektryczny','Elektryczny'],
          ], v.drivetype)}
          ${sel('bodyType','Typ nadwozia',[
            ['','— nie określono —'],['sedan','Sedan'],['kombi','Kombi'],['suv','SUV / Terenowy'],
            ['van','Van / Bus'],['pickup','Pickup'],['ciezarowka','Ciężarówka'],
            ['naczepa','Naczepa'],['przyczepa','Przyczepa'],['inne','Inne'],
          ], v.bodyType)}
          ${field('miejscaSied','S.1 — Miejsca siedzące', v.miejscaSied,'number')}
          ${field('miejscaStoj','S.2 — Miejsca stojące', v.miejscaStoj,'number')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
          <button class="btn btn-amber" style="justify-content:center"
            onclick="AztecScanner.open(${v.id})">
            <i class="ti ti-qrcode"></i>${window.t?.('vd.btn.scan') || 'Skanuj AZTEC z DR'}
          </button>
          <button class="btn btn-blue" style="justify-content:center"
            onclick="TaxOrderVehicleDetail._syncCepik(${v.id})">
            <i class="ti ti-refresh"></i>${window.t?.('vd.btn.sync.cepik') || 'Synchronizuj z CEPiK'}
          </button>
        </div>
      </div>

      <!-- TAB: POLISY / UBEZPIECZENIA -->
      <div id="vd-tab-insurance-content" class="vd-tab-content" style="display:none">
        <div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-shield-check"></i> OC — Ubezpieczenie komunikacyjne obowiązkowe
        </div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('ocPolicyNo','Nr polisy OC', v.ocPolicyNo)}
          ${field('ocInsurer','Ubezpieczyciel OC', v.ocInsurer)}
          ${field('ocStart','Początek OC', v.ocStart,'date')}
          ${field('ocEnd','Koniec OC', v.ocEnd,'date')}
          ${field('ocPremium','Składka OC (zł)', v.ocPremium,'number')}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--blue);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-shield-half"></i> AC / Casco — Ubezpieczenie dobrowolne
        </div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('acPolicyNo','Nr polisy AC', v.acPolicyNo)}
          ${field('acInsurer','Ubezpieczyciel AC', v.acInsurer)}
          ${field('acStart','Początek AC', v.acStart,'date')}
          ${field('acEnd','Koniec AC', v.acEnd,'date')}
          ${field('acPremium','Składka AC (zł)', v.acPremium,'number')}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--amber);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-heart-plus"></i> Assistance / NNW
        </div>
        <div class="vdfg">
          ${field('assPolicyNo','Nr polisy Assistance/NNW', v.assPolicyNo)}
          ${field('assInsurer','Ubezpieczyciel Assistance', v.assInsurer)}
          ${field('assEnd','Ważność Assistance do', v.assEnd,'date')}
        </div>
      </div>

      <!-- TAB: BADANIA TECHNICZNE -->
      <div id="vd-tab-badania-content" class="vd-tab-content" style="display:none">

        <!-- Przegląd techniczny -->
        <div style="font-size:12px;font-weight:600;color:var(--amber);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-car-garage"></i> Przegląd techniczny (SKP)
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          ${field('nextInspection','Termin następnego przeglądu', v.nextInspection,'date')}
          ${field('inspectionStation','Domyślna stacja SKP', v.inspectionStation)}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;color:var(--text2)">Historia przeglądów</div>
          <button class="btn btn-gray" style="font-size:11px;padding:4px 10px" onclick="TaxOrderVehicleDetail._addInspection(${v.id})">
            <i class="ti ti-plus"></i>Dodaj wpis
          </button>
        </div>
        <div id="vd-inspection-history" style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px">
          ${this._renderInspectionHistory(v)}
        </div>

        <!-- UDT -->
        <div style="font-size:12px;font-weight:600;color:var(--red);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-building-factory-2"></i> UDT — Urząd Dozoru Technicznego
        </div>
        <div style="margin-bottom:12px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;padding:10px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
            <input type="checkbox" id="vd-hasUdt" ${v.hasUdt?'checked':''} onchange="document.getElementById('vd-udt-fields').style.display=this.checked?'':'none'">
            <span>Pojazd podlega dozorowi technicznemu UDT</span>
          </label>
        </div>
        <div id="vd-udt-fields" ${v.hasUdt?'':'style="display:none"'}>
          <div class="vdfg" style="margin-bottom:10px">
            ${sel('udtDeviceType','Typ urządzenia UDT',[
              ['','— wybierz —'],
              ['WINDA','Winda / podnośnik'],
              ['HDS','HDS — Hydrauliczny Dźwig Samochodowy'],
              ['zuraw','Żuraw przenośny'],
              ['pompa','Pompa do betonu'],
              ['cysterna','Cysterna / zbiornik ciśnieniowy'],
              ['inne','Inne urządzenie UDT'],
            ], v.udtDeviceType)}
            ${field('udtDeviceNo','Nr fabryczny urządzenia', v.udtDeviceNo)}
            ${field('udtCertNo','Nr decyzji / certyfikatu UDT', v.udtCertNo)}
            ${field('udtLastDate','Data ostatniego badania UDT', v.udtLastDate,'date')}
            ${field('udtNextDate','Termin następnego badania UDT', v.udtNextDate,'date')}
            ${sel('udtResult','Wynik ostatniego badania UDT',[
              ['','— nie określono —'],
              ['pozytywny','✅ Pozytywny'],
              ['warunkowy','⚠ Warunkowy'],
              ['negatywny','❌ Negatywny'],
            ], v.udtResult)}
          </div>
          ${v.udtNextDate ? `<div style="font-size:11px;margin-bottom:8px">Termin UDT: <strong>${new Date(v.udtNextDate).toLocaleDateString('pl-PL')}</strong></div>` : ''}
        </div>

        <!-- Tachograf -->
        <div style="font-size:12px;font-weight:600;color:var(--blue);margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-device-desktop-analytics"></i> Tachograf
        </div>
        <div style="margin-bottom:12px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;padding:10px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
            <input type="checkbox" id="vd-hasTacho" ${v.hasTacho?'checked':''} onchange="document.getElementById('vd-tacho-fields').style.display=this.checked?'':'none'">
            <span>Pojazd wyposażony w tachograf (wymaga legalizacji)</span>
          </label>
        </div>
        <div id="vd-tacho-fields" ${v.hasTacho?'':'style="display:none"'}>
          <div class="vdfg">
            ${field('tachoNo','Nr tachografu', v.tachoNo)}
            ${field('tachoLastCalib','Data ostatniej legalizacji', v.tachoLastCalib,'date')}
            ${field('tachoNextCalib','Termin następnej legalizacji', v.tachoNextCalib,'date')}
          </div>
        </div>
      </div>

      <!-- TAB: SERWIS -->
      <div id="vd-tab-serwis-content" class="vd-tab-content" style="display:none">
        <div id="vd-serwis-body">${window.ServiceModule ? window.ServiceModule.renderServiceTabHtml(v) : '<div style="padding:20px;text-align:center;color:var(--text3)">Ładowanie modułu serwisowego...</div>'}</div>
      </div>

      <!-- TAB: OPONY -->
      <div id="vd-tab-opony-content" class="vd-tab-content" style="display:none">
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:14px">Zmiana sezonowa</div>
        <div class="vdfg" style="margin-bottom:20px">
          ${field('tireNextChange','Termin zmiany opon', v.tireNextChange,'date')}
          <div class="vdf">
            <label class="vdl">Aktualny sezon</label>
            <select id="vd-tireSeason" class="fi">
              <option value="">— nie określono —</option>
              <option value="letnie" ${v.tireSeason==='letnie'?'selected':''}>Letnie</option>
              <option value="zimowe" ${v.tireSeason==='zimowe'?'selected':''}>Zimowe</option>
              <option value="caloroczne" ${v.tireSeason==='caloroczne'?'selected':''}>Całoroczne</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          ${[
            ['FL','Przód lewy (FL)', v.tireFL||{}],
            ['FR','Przód prawy (FR)', v.tireFR||{}],
            ['RL','Tył lewy (RL)', v.tireRL||{}],
            ['RR','Tył prawy (RR)', v.tireRR||{}],
          ].map(([pos,posLabel,tire]) => `
            <div style="background:var(--bg3);border-radius:var(--radius);padding:14px">
              <div style="font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px">
                <i class="ti ti-circle" style="color:var(--text2)"></i>${posLabel}
              </div>
              <div class="vdfg">
                <div class="vdf">
                  <label class="vdl">Rozmiar (np. 235/65 R16)</label>
                  <input id="vd-tire${pos}_size" type="text" class="fi" value="${tire.size||''}" placeholder="205/55R16">
                </div>
                <div class="vdf">
                  <label class="vdl">Marka / producent</label>
                  <input id="vd-tire${pos}_brand" type="text" class="fi" value="${tire.brand||''}" placeholder="np. Michelin">
                </div>
                <div class="vdf">
                  <label class="vdl">Rok prod. (DOT)</label>
                  <input id="vd-tire${pos}_dot" type="number" class="fi" min="2000" max="2030" value="${tire.dot||''}" placeholder="2022">
                </div>
                <div class="vdf">
                  <label class="vdl">Bieżnik (mm)</label>
                  <input id="vd-tire${pos}_depth" type="number" step="0.1" class="fi" value="${tire.depth||''}" placeholder="7.5">
                </div>
                <div class="vdf" style="grid-column:1/-1">
                  <label class="vdl">Data ostatniej wymiany</label>
                  <input id="vd-tire${pos}_changed" type="date" class="fi" value="${tire.changed||''}">
                </div>
              </div>
            </div>`).join('')}
        </div>
        <div style="margin-top:16px;background:var(--bg3);border-radius:var(--radius);padding:14px">
          <div style="font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="ti ti-circle" style="color:var(--text2)"></i>Zapasowe (SP)
          </div>
          <div class="vdfg">
            ${field('tireSP_size','Rozmiar opony zapasowej', v.tireSP?.size||'')}
            ${field('tireSP_brand','Marka', v.tireSP?.brand||'')}
            ${field('tireSP_dot','Rok DOT', v.tireSP?.dot||'','number')}
          </div>
        </div>
      </div>

      <!-- TAB: EKSPLOATACJA -->
      <div id="vd-tab-eksploatacja-content" class="vd-tab-content" style="display:none">
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Kierowca i licznik</div>
        <div class="vdfg" style="margin-bottom:18px">
          <div class="vdf">
            <label class="vdl">Przypisany kierowca
              <span style="font-size:10px;color:var(--blue);cursor:pointer;margin-left:6px" onclick="TaxOrderDrivers.open()" title="Zarządzaj kierowcami">&#9881; kartoteka</span>
            </label>
            <input id="vd-kierowca" type="text" class="fi" value="${v.kierowca??''}" autocomplete="off" list="drivers-datalist" placeholder="Wybierz lub wpisz...">
          </div>
          ${field('stanKilometrow','Stan licznika (km)', v.stanKilometrow,'number')}
          ${field('kartaOrlen','Nr karty flotowej / paliwa', v.kartaOrlen)}
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Dane eksploatacyjne</div>
        <div class="vdfg">
          ${field('normaSpalania','Norma spalania (l/100km)', v.normaSpalania,'number')}
        </div>
      </div>

      <!-- TAB: KOSZTY / TANKOWANIA -->
      <div id="vd-tab-koszty-content" class="vd-tab-content" style="display:none">
        <div id="vd-koszty-body">${this._renderKosztyTab(v)}</div>
      </div>

      <!-- TAB: WŁASNOŚĆ -->
      <div id="vd-tab-ownership-content" class="vd-tab-content" style="display:none">
        <div class="vdfg">
          ${sel('ownershipType','Status własności',[
            ['own','Własność własna'],['leasing','Leasing'],['rental','Wynajem'],
            ['leaseback','Leasing zwrotny'],['service_loan','Pojazd zastępczy']
          ], own)}
        </div>
        <div id="vd-leasing-section" style="${isLeasing?'':'display:none'}">
          <div style="font-size:12px;font-weight:600;color:var(--blue);margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
            <i class="ti ti-building-bank"></i> Dane leasingowe
          </div>
          <div class="vdfg">
            ${field('leasingCompany','Nazwa leasingodawcy', v.leasingCompany)}
            ${field('leasingContractNo','Nr umowy', v.leasingContractNo)}
            ${field('leasingStart','Data rozpoczęcia', v.leasingStart,'date')}
            ${field('leasingEnd','Data zakończenia', v.leasingEnd,'date')}
            ${field('leasingRate','Rata miesięczna (zł netto)', v.leasingRate,'number')}
            ${field('leasingBuyout','Cena wykupu (zł)', v.leasingBuyout,'number')}
            ${field('leasingKmLimit','Limit km w umowie', v.leasingKmLimit,'number')}
          </div>
        </div>
        <div id="vd-rental-section" style="${isRental?'':'display:none'}">
          <div style="font-size:12px;font-weight:600;color:var(--amber);margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
            <i class="ti ti-key"></i> Dane najmu
          </div>
          <div class="vdfg">
            ${field('rentalCompany','Nazwa wynajmującego', v.rentalCompany)}
            ${field('rentalStart','Wynajem od', v.rentalStart,'date')}
            ${field('rentalEnd','Wynajem do', v.rentalEnd,'date')}
          </div>
        </div>
      </div>

      <!-- TAB: ZAKUP / SPRZEDAŻ -->
      <div id="vd-tab-purchase-content" class="vd-tab-content" style="display:none">
        <div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:10px"><i class="ti ti-shopping-cart"></i> Nabycie pojazdu <span style="font-weight:400;font-size:10px;color:var(--text3)">(DT-1/A poz. 8)</span></div>
        <div class="vdfg">
          ${field('purchaseDate','Data nabycia / zakupu', v.purchaseDate||v.dataNabycia,'date')}
          ${field('purchasePrice','Cena zakupu netto (zł)', v.purchasePrice,'number')}
          ${field('purchaseInvoice','Nr faktury zakupu', v.purchaseInvoice)}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--red);margin:20px 0 10px"><i class="ti ti-cash"></i> Sprzedaż / Zbycie pojazdu <span style="font-weight:400;font-size:10px;color:var(--text3)">(DT-1/A poz. 9)</span></div>
        <div class="vdfg">
          ${field('saleDate','Data zbycia / sprzedaży', v.saleDate||v.dataZbycia,'date')}
          ${field('saleInvoice','Nr faktury sprzedaży', v.saleInvoice)}
          ${field('saleBuyer','Nabywca', v.saleBuyer)}
          ${field('salePrice','Cena sprzedaży netto (zł)', v.salePrice,'number')}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--amber);margin:20px 0 10px"><i class="ti ti-car-off"></i> Zmiany stanu w ruchu <span style="font-weight:400;font-size:10px;color:var(--text3)">(DT-1/A poz. 10–12)</span></div>
        <div class="vdfg">
          ${field('dataWycofania','10. Data czasowego wycofania z ruchu', v.dataWycofania,'date')}
          ${field('dataDopuszczenia','11. Data ponownego dopuszczenia do ruchu', v.dataDopuszczenia,'date')}
          ${field('dataWyrejestrowania','12. Data wyrejestrowania', v.dataWyrejestrowania,'date')}
        </div>
      </div>

      <!-- TAB: ARCHIWUM -->
      <div id="vd-tab-archive-content" class="vd-tab-content" style="display:none">
        <div class="vdfg">
          <div class="vdf" style="grid-column:1/-1">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;padding:12px;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border)">
              <input type="checkbox" id="vd-archiveVeh" ${isArchived ? 'checked' : ''} onchange="TaxOrderVehicleDetail._onArchiveToggle(this)">
              <span>Oznacz pojazd jako nieaktywny (archiwum)</span>
            </label>
            ${isArchived ? `<div style="font-size:12px;color:var(--text2);margin-top:6px">Zarchiwizowano: ${v.archivedAt ? new Date(v.archivedAt).toLocaleDateString('pl-PL') : '—'}</div>` : ''}
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Powód archiwizacji</label>
            <select id="vd-archivedReason" class="fi">
              <option value="sprzedaż" ${v.archivedReason==='sprzedaż'?'selected':''}>Sprzedaż pojazdu</option>
              <option value="złomowanie" ${v.archivedReason==='złomowanie'?'selected':''}>Złomowanie</option>
              <option value="kradzież" ${v.archivedReason==='kradzież'?'selected':''}>Kradzież</option>
              <option value="zwrot_leasingu" ${v.archivedReason==='zwrot_leasingu'?'selected':''}>Zwrot do leasingodawcy</option>
              <option value="inne" ${v.archivedReason==='inne'?'selected':''}>Inne</option>
            </select>
          </div>
        </div>
        ${isArchived ? `<div class="wbox" style="margin-top:14px"><i class="ti ti-archive"></i>Ten pojazd jest nieaktywny — nie pojawia się w deklaracjach DT-1.</div>` : ''}
      </div>

      <!-- TAB: UWAGI -->
      <div id="vd-tab-notes-content" class="vd-tab-content" style="display:none">
        <div>
          <label class="vdl">Uwagi do pojazdu</label>
          <textarea id="vd-uwagi" class="fi" style="height:140px;resize:vertical">${v.uwagi || ''}</textarea>
        </div>
      </div>

      <!-- TAB: DOKUMENTY -->
      <div id="vd-tab-dokumenty-content" class="vd-tab-content" style="display:none">
        <div id="vd-dokumenty-body">
          ${window.DocumentsModule ? window.DocumentsModule.renderForVehicle(v) : '<div style="padding:20px;text-align:center;color:var(--text3)">Ładowanie modułu dokumentów...</div>'}
        </div>
      </div>

      <!-- TAB: MANDATY -->
      <div id="vd-tab-mandaty-content" class="vd-tab-content" style="display:none">
        <div id="vd-mandaty-body">
          ${window.FinesModule ? window.FinesModule.renderForVehicle(v.nrRej) : '<div style="padding:20px;text-align:center;color:var(--text3)">Ładowanie modułu mandatów...</div>'}
        </div>
      </div>

      <!-- TAB: GPS HISTORY -->
      <div id="vd-tab-gps-content" class="vd-tab-content" style="display:none">
        <div id="vd-gps-body">${this._renderGpsTab(v)}</div>
      </div>

      <!-- PRZYPISANE KARTY FLOTOWE -->
      <div style="margin-top:20px;padding-top:16px;border-top:0.5px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-credit-card" style="color:var(--blue)"></i>Karty flotowe
          <button class="btn btn-gray" style="font-size:11px;margin-left:auto" onclick="TaxOrderVehicleDetail._addCard(${v.id})">
            <i class="ti ti-plus"></i>Dodaj
          </button>
        </div>
        <div id="vd-cards-list">${this._renderCards(v)}</div>
      </div>
    `;

    // Obsługa zmiany typu własności
    document.getElementById('vd-ownershipType')?.addEventListener('change', function() {
      document.getElementById('vd-leasing-section').style.display = this.value==='leasing' ? '' : 'none';
      document.getElementById('vd-rental-section').style.display  = this.value==='rental'  ? '' : 'none';
    });

    document.getElementById('vd-save-btn').onclick = () => this.save(v.id);
  },

  _renderKosztyTab(v) {
    const history = Array.isArray(v.fuelHistory) ? v.fuelHistory : [];

    // Statystyki
    const now = new Date();
    const thisMonth = now.toISOString().slice(0,7);
    const thisYear  = now.getFullYear().toString();

    const monthFuel   = history.filter(h => (h.date||'').startsWith(thisMonth));
    const yearFuel    = history.filter(h => (h.date||'').startsWith(thisYear));
    const totalLM     = monthFuel.reduce((s,h) => s+(h.liters||0), 0);
    const totalCostM  = monthFuel.reduce((s,h) => s+(h.totalGross||0), 0);
    const totalLY     = yearFuel.reduce((s,h) => s+(h.liters||0), 0);
    const totalCostY  = yearFuel.reduce((s,h) => s+(h.totalGross||0), 0);
    const avgPrice    = history.filter(h=>h.pricePerL).length
      ? (history.filter(h=>h.pricePerL).reduce((s,h)=>s+(h.pricePerL||0),0) / history.filter(h=>h.pricePerL).length).toFixed(3)
      : null;

    // l/100km z kolejnych tankowań z km
    const withKm = [...history].filter(h => h.km != null && h.km > 0 && h.liters > 0).sort((a,b) => a.km - b.km);
    let _effL = 0, _effKm = 0, _effN = 0;
    for (let i = 1; i < withKm.length; i++) {
      const kd = withKm[i].km - withKm[i-1].km;
      if (kd > 10 && kd < 5000) { _effL += withKm[i].liters; _effKm += kd; _effN++; }
    }
    const avgEff = (_effN >= 2 && _effKm > 0) ? (_effL / _effKm * 100).toFixed(1) : null;
    const norm = v.normaSpalania ? parseFloat(v.normaSpalania) : null;
    const effOver = avgEff && norm ? parseFloat(avgEff) > norm * 1.15 : false; // >15% ponad normę
    const effColor = effOver ? 'var(--red)' : avgEff ? 'var(--blue)' : 'var(--text3)';

    const PRODUCT_COLOR = {diesel:'var(--blue)',pb95:'var(--green)',pb98:'var(--amber)',lpg:'var(--red)',mocznik:'var(--text3)',myjnia:'var(--blue)',inne:'var(--text3)'};

    return `
      <!-- Statystyki -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:18px">
        <div style="padding:12px;background:var(--bg3);border-radius:var(--radius);text-align:center">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Ten miesiąc</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--mono)">${totalLM.toFixed(1)} l</div>
          <div style="font-size:11px;color:var(--text2)">${totalCostM.toFixed(2)} zł</div>
        </div>
        <div style="padding:12px;background:var(--bg3);border-radius:var(--radius);text-align:center">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Ten rok</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--mono)">${totalLY.toFixed(1)} l</div>
          <div style="font-size:11px;color:var(--text2)">${totalCostY.toFixed(2)} zł</div>
        </div>
        <div style="padding:12px;background:var(--bg3);border-radius:var(--radius);text-align:center">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Łącznie wpisów</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--mono)">${history.length}</div>
          <div style="font-size:11px;color:var(--text2)">${avgPrice ? `śr. ${avgPrice} zł/l` : '—'}</div>
        </div>
        <div style="padding:12px;background:var(--bg3);border-radius:var(--radius);text-align:center">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Śr. spalanie</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--mono);color:${effColor}">${avgEff ? avgEff+' l' : '—'}</div>
          <div style="font-size:11px;color:var(--text2)">${avgEff ? '/100 km'+(norm?` (norma: ${norm})`:'') : 'brak danych km'}${effOver?' ⚠':''}</div>
        </div>
      </div>

      <!-- Akcje -->
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="btn btn-green" style="font-size:12px" onclick="FuelImport.addManual(${v.id})">
          <i class="ti ti-plus"></i>Dodaj tankowanie
        </button>
        <button class="btn btn-blue" style="font-size:12px" onclick="FuelImport.open()">
          <i class="ti ti-file-import"></i>Import CSV
        </button>
      </div>

      <!-- Historia -->
      ${!history.length ? `
        <div style="text-align:center;padding:2rem;color:var(--text3)">
          <i class="ti ti-gas-station" style="font-size:32px;display:block;margin-bottom:8px"></i>
          Brak tankowań. Dodaj ręcznie lub zaimportuj z pliku CSV karty paliwowej.
        </div>` : `
        <div style="overflow-x:auto">
          <table style="width:100%;font-size:12px;border-collapse:collapse">
            <thead><tr style="background:var(--bg3)">
              <th style="padding:6px 8px;text-align:left">Data</th>
              <th style="padding:6px 8px;text-align:left">Paliwo</th>
              <th style="padding:6px 8px;text-align:right">Litry</th>
              <th style="padding:6px 8px;text-align:right">Cena/l</th>
              <th style="padding:6px 8px;text-align:right">Kwota</th>
              <th style="padding:6px 8px;text-align:left">Stacja</th>
              <th style="padding:6px 8px;text-align:right">km</th>
              <th style="padding:6px 8px"></th>
            </tr></thead>
            <tbody>
              ${history.slice(0,100).map(h => `
                <tr style="border-bottom:0.5px solid var(--border)">
                  <td style="padding:5px 8px;font-family:var(--mono);font-size:11px">${h.date||'—'}<br><span style="color:var(--text3)">${h.time||''}</span></td>
                  <td style="padding:5px 8px">
                    <span style="font-size:10px;font-weight:600;color:${PRODUCT_COLOR[h.product]||'var(--text2)'}">
                      ${(h.product||'—').toUpperCase()}
                    </span>
                  </td>
                  <td style="padding:5px 8px;text-align:right;font-family:var(--mono)">${h.liters!=null?h.liters.toFixed(1):'—'}</td>
                  <td style="padding:5px 8px;text-align:right;font-family:var(--mono);color:var(--text2)">${h.pricePerL!=null?h.pricePerL.toFixed(3):'—'}</td>
                  <td style="padding:5px 8px;text-align:right;font-family:var(--mono);font-weight:500">${h.totalGross!=null?h.totalGross.toFixed(2):'—'}</td>
                  <td style="padding:5px 8px;color:var(--text2);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h.station||''}">${h.station||'—'}</td>
                  <td style="padding:5px 8px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text2)">${h.km!=null?h.km.toLocaleString('pl-PL'):'—'}</td>
                  <td style="padding:5px 8px;text-align:center">
                    <button onclick="FuelImport.removeFuel(${v.id},${h.id})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:2px 4px" title="Usuń">&times;</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${history.length > 100 ? `<div style="text-align:center;padding:8px;font-size:11px;color:var(--text3)">Pokazano 100 z ${history.length} wpisów</div>` : ''}
        </div>`}`;
  },

  _refreshKoszty(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    const el = document.getElementById('vd-koszty-body');
    if (el) el.innerHTML = this._renderKosztyTab(v);
  },

  _renderInspectionHistory(v) {
    const history = Array.isArray(v.inspectionHistory) ? v.inspectionHistory : [];
    if (!history.length) {
      return '<div style="font-size:12px;color:var(--text3);padding:8px 0">Brak wpisów. Kliknij "Dodaj wpis" aby dodać pierwszy przegląd.</div>';
    }
    return [...history]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((ins, i) => {
        const resultColor = ins.result === 'pozytywny' ? 'var(--green)' : ins.result === 'negatywny' ? 'var(--red)' : 'var(--amber)';
        return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg3);border-radius:var(--radius);border-left:3px solid ${resultColor}">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
              <span style="font-family:var(--mono);font-weight:600;font-size:13px">${ins.date ? new Date(ins.date).toLocaleDateString('pl-PL') : '—'}</span>
              <span class="pill" style="font-size:10px;background:${resultColor}20;color:${resultColor}">${ins.result || 'brak wyniku'}</span>
              ${ins.station ? `<span style="font-size:11px;color:var(--text2)">${ins.station}</span>` : ''}
            </div>
            ${ins.notes ? `<div style="font-size:11px;color:var(--text2)">${ins.notes}</div>` : ''}
          </div>
          <button onclick="TaxOrderVehicleDetail._removeInspection(${v.id},${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px 4px;font-size:14px" title="Usuń wpis">&times;</button>
        </div>`;
      }).join('');
  },

  _addInspection(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:480px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-tool" style="color:var(--amber)"></i>Nowy wpis przeglądu — ${v.nrRej}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Data przeglądu</label>
            <input id="_ins-date" type="date" class="fi" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="vdf">
            <label class="vdl">Wynik</label>
            <select id="_ins-result" class="fi">
              <option value="pozytywny">✅ Pozytywny</option>
              <option value="pozytywny z zaleceniami">⚠ Pozytywny z zaleceniami</option>
              <option value="negatywny">❌ Negatywny</option>
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Stacja SKP</label>
            <input id="_ins-station" type="text" class="fi" placeholder="Nazwa stacji" value="${v.inspectionStation||''}">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Uwagi / usterki</label>
            <textarea id="_ins-notes" class="fi" style="height:70px;resize:vertical" placeholder="Opcjonalnie — usterki, zalecenia..."></textarea>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-green" onclick="TaxOrderVehicleDetail._saveInspection(${vehId},this)">
            <i class="ti ti-check"></i>Zapisz wpis
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('_ins-date')?.focus();
  },

  _saveInspection(vehId, btn) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    const date    = document.getElementById('_ins-date')?.value || '';
    const result  = document.getElementById('_ins-result')?.value || '';
    const station = document.getElementById('_ins-station')?.value?.trim() || '';
    const notes   = document.getElementById('_ins-notes')?.value?.trim() || '';
    if (!date) { if (typeof toast === 'function') toast('⚠ Podaj datę przeglądu'); return; }

    if (!Array.isArray(v.inspectionHistory)) v.inspectionHistory = [];
    v.inspectionHistory.push({ date, result, station, notes });

    // Aktualizuj lastInspection na najnowszy
    const sorted = [...v.inspectionHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    v.lastInspection = sorted[0].date;

    btn.closest('[style*=fixed]').remove();
    const histEl = document.getElementById('vd-inspection-history');
    if (histEl) histEl.innerHTML = this._renderInspectionHistory(v);
    if (typeof toast === 'function') toast('✓ Wpis przeglądu dodany — kliknij Zapisz aby utrwalić');
  },

  _removeInspection(vehId, index) {
    const v = vehs.find(x => x.id === vehId);
    if (!v || !Array.isArray(v.inspectionHistory)) return;
    const sorted = [...v.inspectionHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    const toRemove = sorted[index];
    v.inspectionHistory = v.inspectionHistory.filter(ins => ins !== toRemove);
    if (v.inspectionHistory.length) {
      v.lastInspection = [...v.inspectionHistory].sort((a,b)=>new Date(b.date)-new Date(a.date))[0].date;
    } else {
      v.lastInspection = null;
    }
    const histEl = document.getElementById('vd-inspection-history');
    if (histEl) histEl.innerHTML = this._renderInspectionHistory(v);
  },

  _renderCards(v) {
    const cards = (window.flotCards || []).filter(c => c.nrRej === v.nrRej);
    if (!cards.length) return '<div style="font-size:12px;color:var(--text3)">Brak przypisanych kart</div>';
    return cards.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg2);border-radius:var(--radius);margin-bottom:6px;font-size:12px">
        <i class="ti ti-credit-card" style="color:var(--blue)"></i>
        <span style="font-family:var(--mono)">${c.nr}</span>
        <span class="pill pill-gray" style="font-size:10px">${c.typ}</span>
        <span style="color:var(--text2)">${c.dostawca || ''}</span>
        <span class="pill ${c.status==='AKTYWNA'?'pill-green':'pill-red'}" style="font-size:10px;margin-left:auto">${c.status}</span>
      </div>`).join('');
  },

  refreshServiceTab(vehId) {
    const v = (window.vehs||[]).find(x => x.id === vehId);
    const el = document.getElementById('vd-serwis-body');
    if (el && v && window.ServiceModule) el.innerHTML = window.ServiceModule.renderServiceTabHtml(v);
  },

  refresh(vehId) {
    const v = (window.vehs||[]).find(x => String(x.id)===String(vehId));
    if (!v) return;
    const dok = document.getElementById('vd-dokumenty-body');
    if (dok && window.DocumentsModule) dok.innerHTML = window.DocumentsModule.renderForVehicle(v);
    const man = document.getElementById('vd-mandaty-body');
    if (man && window.FinesModule) man.innerHTML = window.FinesModule.renderForVehicle(v.nrRej);
    const gps = document.getElementById('vd-gps-body');
    if (gps) gps.innerHTML = this._renderGpsTab(v);
    this.refreshServiceTab(vehId);
  },

  _renderGpsTab(v) {
    const gps = [...(v.gpsHistory || [])].sort((a,b) => {
      const da = (a.date||'') + (a.time||'');
      const db = (b.date||'') + (b.time||'');
      return da < db ? 1 : da > db ? -1 : 0;
    });

    if (!gps.length) return `
      <div style="text-align:center;padding:40px;color:var(--text3)">
        <i class="ti ti-map-off" style="font-size:36px;display:block;margin-bottom:12px"></i>
        Brak danych GPS dla tego pojazdu.<br>
        <span style="font-size:12px">Zaimportuj dane z MyCar / TEKOM przez <strong>Import GPS</strong> w menu CEPiK.</span>
      </div>`;

    const kms   = gps.filter(r => r.km != null && r.km > 0).map(r => r.km);
    const minKm = kms.length ? Math.min(...kms) : null;
    const maxKm = kms.length ? Math.max(...kms) : null;
    const dates = gps.filter(r => r.date).map(r => r.date).sort();
    const drivers = [...new Set(gps.filter(r=>r.driver).map(r=>r.driver))];

    return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <div class="stat-chip"><span>${gps.length}</span> rekordów GPS</div>
        ${dates.length ? `<div class="stat-chip"><span>${dates[0]}</span> — <span>${dates[dates.length-1]}</span></div>` : ''}
        ${minKm != null ? `<div class="stat-chip"><span>${minKm.toLocaleString('pl-PL')}</span> – <span>${maxKm.toLocaleString('pl-PL')} km</span></div>` : ''}
        ${drivers.length ? `<div class="stat-chip"><span>${drivers.length}</span> kierowców</div>` : ''}
        <button class="btn btn-gray" style="font-size:11px;margin-left:auto" onclick="TaxOrderVehicleDetail._exportGpsCsv(${v.id})">
          <i class="ti ti-download"></i>CSV
        </button>
      </div>
      <div class="tbl-wrap" style="max-height:360px;overflow-y:auto">
        <table style="width:100%;font-size:11px">
          <thead style="position:sticky;top:0"><tr>
            <th>Data</th><th>Czas</th>
            <th style="text-align:right">Km</th>
            <th>Kierowca</th>
            <th style="text-align:right">V max (km/h)</th>
            <th>Lokalizacja</th>
            <th>Zdarzenie</th>
          </tr></thead>
          <tbody>
            ${gps.slice(0,200).map(r => `<tr>
              <td style="font-family:var(--mono);white-space:nowrap">${r.date||'—'}</td>
              <td style="font-family:var(--mono);color:var(--text2)">${r.time||'—'}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.km!=null?r.km.toLocaleString('pl-PL'):'—'}</td>
              <td style="white-space:nowrap">${r.driver||'—'}</td>
              <td style="text-align:right;font-family:var(--mono);color:${r.speed>100?'var(--red)':'var(--text)'}">${r.speed!=null?r.speed:'—'}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)" title="${r.location||''}">${r.location||'—'}</td>
              <td style="font-size:10px;color:var(--text3)">${r.event||''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${gps.length > 200 ? `<div style="text-align:center;padding:8px;font-size:11px;color:var(--text3)">Wyświetlono 200 z ${gps.length} rekordów</div>` : ''}
      </div>`;
  },

  _exportGpsCsv(vehId) {
    const v = (window.vehs||[]).find(x => x.id === vehId);
    if (!v) return;
    const gps = [...(v.gpsHistory||[])].sort((a,b)=>(a.date+a.time)<(b.date+b.time)?1:-1);
    const headers = ['Data','Czas','Nr rej.','Km','Kierowca','V max (km/h)','Lokalizacja','Zdarzenie'];
    const csv = '﻿' + [headers, ...gps.map(r=>[r.date,r.time,r.nrRej,r.km??'',r.driver,r.speed??'',r.location,r.event])]
      .map(row => row.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`gps_${v.nrRej}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast(`✓ GPS CSV: ${gps.length} rekordów`);
  },

  printCard() {
    const v = (window.vehs||[]).find(x => x.id === this._currentVehId);
    if (!v) { toast('⚠ Otwórz kartę pojazdu'); return; }
    const fd = d => d ? new Date(d).toLocaleDateString('pl-PL') : '—';
    const fz = n => n != null ? (+n).toFixed(2).replace('.',',') + ' zł' : '—';
    const row = (lbl, val) => `<tr><td style="padding:5px 10px;color:#6b7280;font-size:11px;width:200px">${lbl}</td><td style="padding:5px 10px;font-weight:600;font-size:12px">${val||'—'}</td></tr>`;
    const svcRows = [...(v.serviceHistory||[])].slice(0,8).map(s=>`
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:5px 10px;font-family:monospace;font-size:11px">${s.date||'—'}</td>
        <td style="padding:5px 10px;font-size:11px">${window.ServiceModule?.SERVICE_TYPES?.[s.type]?.label||s.type||'—'}</td>
        <td style="padding:5px 10px;font-size:11px;color:#6b7280">${s.description||'—'}</td>
        <td style="padding:5px 10px;text-align:right;font-family:monospace;font-size:11px">${s.km?s.km.toLocaleString('pl-PL')+' km':'—'}</td>
        <td style="padding:5px 10px;text-align:right;font-family:monospace;font-size:11px">${s.cost?s.cost.toFixed(2)+' zł':'—'}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Karta pojazdu — ${v.nrRej}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;font-size:12px;color:#1f2937;padding:20px;max-width:800px;margin:0 auto}
h1{font-size:22px;font-weight:800;font-family:monospace;color:#1d4ed8;margin-bottom:2px}
h2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:14px 0 4px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
table{width:100%;border-collapse:collapse}th{background:#f9fafb;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;padding:5px 10px;text-align:left}
@media print{button{display:none}body{padding:8px}}</style></head>
<body>
<button onclick="window.print()" style="float:right;background:#1d4ed8;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;margin-bottom:8px">🖨 Drukuj</button>
<h1>${v.nrRej}</h1>
<div style="color:#6b7280;font-size:13px;margin-bottom:4px">${v.marka} ${v.model} · ${v.rok||'—'} · ${v.typ||'—'}</div>
<div style="font-size:10px;color:#9ca3af;margin-bottom:14px">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} | TaxOrder Pro</div>
<h2>Identyfikacja</h2>
<table>${row('VIN',`<span style="font-family:monospace">${v.vin||'—'}</span>`)}
${row('DMC',(v.dmc||0).toLocaleString('pl-PL')+' kg')}${row('EURO',v.euro)}
${row('Status własności',v.status)}${row('Właściciel',v.wlasciciel)}
${row('Kierowca',v.kierowca)}${row('Stan licznika',v.stanKilometrow!=null?v.stanKilometrow.toLocaleString('pl-PL')+' km':null)}</table>
<h2>Ubezpieczenia</h2>
<table>${row('OC ważne do',fd(v.ocEnd))}${row('Ubezpieczyciel OC',v.ocInsurer)}
${row('Nr polisy OC',v.ocPolicyNo)}${row('Składka OC',fz(v.ocPremium))}
${row('AC ważne do',fd(v.acEnd))}${row('Ubezpieczyciel AC',v.acInsurer)}</table>
<h2>Badania</h2>
<table>${row('Następny przegląd',fd(v.nextInspection))}${row('Stacja SKP',v.inspectionStation)}
${v.hasUdt?row('Badanie UDT',fd(v.udtNextDate)):''}
${v.hasTacho?row('Legalizacja tachografu',fd(v.tachoNextCalib)):''}
${v.tireNextChange?row('Zmiana opon',fd(v.tireNextChange)):''}</table>
${svcRows?`<h2>Historia serwisowa (ostatnie 8)</h2>
<table><thead><tr><th>Data</th><th>Typ</th><th>Opis</th><th style="text-align:right">Km</th><th style="text-align:right">Koszt</th></tr></thead>
<tbody>${svcRows}</tbody></table>`:''}
</body></html>`;
    const win = window.open('', '_blank', 'width=860,height=960');
    if (!win) { toast('⚠ Zezwól na wyskakujące okna w przeglądarce'); return; }
    win.document.write(html); win.document.close();
  },

  _tab(name) {
    document.querySelectorAll('.vd-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="vd-tab-"]').forEach(btn => {
      if (btn.id === 'vd-tabs') return;
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text2)';
      btn.classList.remove('vd-tab-active');
    });
    document.getElementById('vd-tab-' + name + '-content').style.display = '';
    const btn = document.getElementById('vd-tab-' + name);
    if (btn) { btn.style.background = 'var(--bg)'; btn.style.color = 'var(--text)'; }
  },

  _onArchiveToggle(cb) {
    const reason = document.getElementById('vd-archivedReason');
    if (reason) reason.closest('.vdf').style.opacity = cb.checked ? '1' : '0.4';
  },

  async _syncCepik(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    toast('⏳ Synchronizuję z CEPiK: ' + v.nrRej);
    if (window.TaxOrderFleetCloud?.syncFromCepik) {
      const r = await window.TaxOrderFleetCloud.syncFromCepik(v);
      if (r.ok) {
        toast('✅ CEPiK: zaktualizowano ' + r.fields + ' pól dla ' + v.nrRej);
        await window.TaxOrderFleetCloud.loadVehicles(window.currentCompanyId);
        this.close();
        if (typeof renderVeh === 'function') renderVeh();
      } else {
        toast('⚠ CEPiK: ' + (r.message || r.reason || 'błąd'));
      }
    }
  },

  _addCard(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (v && typeof openKartaModal === 'function') {
      this.close();
      openKartaModal();
      setTimeout(() => {
        const f = document.getElementById('km-nrrej');
        if (f) f.value = v.nrRej;
      }, 100);
    }
  },

  _scanInvoice(vehId) {
    this.close();
    if (typeof showPage === 'function') showPage('faktury');
    toast('ℹ Wgraj skan faktury — dane zostaną przypisane do pojazdu');
  }
};
