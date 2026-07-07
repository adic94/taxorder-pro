// ==================== VEHICLE DETAIL MODAL ====================
// Karta pojazdu z pełnymi danymi DR, leasingiem, archiwizacją, kartami flotowymi

window.TaxOrderVehicleDetail = {

  open(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    this._currentVehId = vehId;
    this._render(v);
    document.getElementById('vd-modal').style.display = 'flex';
    setTimeout(() => this._initTabScroll(), 0);
  },

  close() {
    document.getElementById('vd-modal').style.display = 'none';
  },

  async deleteVehicle() {
    const vehId = this._currentVehId;
    const v = (window.vehs || []).find(x => x.id === vehId);
    if (!v) return;
    if (!confirm(t('vd.confirm.del.vehicle').replace('{0}', v.nrRej).replace('{1}', v.marka).replace('{2}', v.model))) return;

    // Usuń z lokalnej tablicy i zamknij modal
    const idx = window.vehs.indexOf(v);
    if (idx !== -1) window.vehs.splice(idx, 1);
    selected.delete(vehId);
    this.close();
    if (typeof renderVeh === 'function') renderVeh();
    if (typeof updateCounters === 'function') updateCounters();

    // Usuń z bazy danych (Supabase)
    if (v.dbId && window.TaxOrderFleetCloud?.deleteVehicle) {
      const result = await window.TaxOrderFleetCloud.deleteVehicle(v);
      if (result.ok) {
        toast(`✓ Usunięto ${v.nrRej}`);
      } else {
        toast(`⚠ ${v.nrRej} usunięty lokalnie — błąd sync z bazą`);
      }
    } else {
      toast(`✓ Usunięto ${v.nrRej}`);
    }
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
      ocCoversAc:    gb('ocCoversAc'),
      acPolicyNo:    g('acPolicyNo'),
      acInsurer:     g('acInsurer'),
      acStart:       g('acStart'),
      acEnd:         g('acEnd'),
      acPremium:     gf('acPremium'),
      ocCoversAss:   gb('ocCoversAss'),
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
      saleBuyerNip:   g('saleBuyerNip'),
      salePrice:      gf('salePrice'),
      dataZbycia:     g('saleDate'),
      dataWycofania:      g('dataWycofania'),
      dataDopuszczenia:   g('dataDopuszczenia'),
      dataWyrejestrowania:g('dataWyrejestrowania'),
      // === OPONY ===
      tireNextChange: g('tireNextChange'),
      tireSeason:     g('tireSeason'),
      twinWheels: gb('twinWheels'),
      tireFL:  { size:g('tireFL_size'),  brand:g('tireFL_brand'),  dot:g('tireFL_dot'),  depth:gf('tireFL_depth'),  changed:g('tireFL_changed') },
      tireFR:  { size:g('tireFR_size'),  brand:g('tireFR_brand'),  dot:g('tireFR_dot'),  depth:gf('tireFR_depth'),  changed:g('tireFR_changed') },
      tireRL:  { size:g('tireRL_size'),  brand:g('tireRL_brand'),  dot:g('tireRL_dot'),  depth:gf('tireRL_depth'),  changed:g('tireRL_changed') },
      tireRR:  { size:g('tireRR_size'),  brand:g('tireRR_brand'),  dot:g('tireRR_dot'),  depth:gf('tireRR_depth'),  changed:g('tireRR_changed') },
      tireRLi: { size:g('tireRLi_size'), brand:g('tireRLi_brand'), dot:g('tireRLi_dot'), depth:gf('tireRLi_depth'), changed:g('tireRLi_changed') },
      tireRRi: { size:g('tireRRi_size'), brand:g('tireRRi_brand'), dot:g('tireRRi_dot'), depth:gf('tireRRi_depth'), changed:g('tireRRi_changed') },
      tireSP:  { size:g('tireSP_size'),  brand:g('tireSP_brand'),  dot:g('tireSP_dot') },
      // === UWAGI ===
      uwagi: g('uwagi'),
      // === PODATEK DT-1 ===
      gmina:           g('gmina') || 'Warszawa',
      miesiacePodatku: gi('miesiacePodatku') || 12,
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

    // Audit trail
    this._logAudit('save', vehId, { nrRej: v.nrRej });

    // Zapisz (lokalnie zawsze, chmura jeśli dostępna)
    if (typeof renderVeh === 'function') renderVeh();
    if (typeof renderDash === 'function') renderDash();
    if (window.TaxOrderFleetCloud?.saveVehicle) {
      const r = await window.TaxOrderFleetCloud.saveVehicle(v);
      if (r.ok) {
        toast(t('vd.toast.saved').replace('{0}', v.nrRej));
      } else {
        toast(t('vd.toast.save.local'));
      }
    } else {
      toast(t('vd.toast.updated').replace('{0}', v.nrRej));
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
        <div style="display:flex;align-items:center;gap:8px;${isArchived?'':'margin-left:auto'}">
          ${v.cepikSyncStatus === 'ok' ? '<span class="pill pill-green" style="font-size:10px">CEPiK ✓</span>' :
            v.cepikSyncStatus === 'never' ? '' :
            '<span class="pill pill-amber" style="font-size:10px">CEPiK sync</span>'}
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" onclick="TaxOrderVehicleDetail.printCard()">
            <i class="ti ti-printer"></i>Drukuj kartę
          </button>
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" onclick="TaxOrderDamages.openModal(null, '${v.nrRej}')">
            <i class="ti ti-alert-triangle"></i>Zgłoś szkodę
          </button>
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" onclick="TaxOrderServiceOrders.openModal(null, '${v.nrRej}')">
            <i class="ti ti-clipboard-list"></i>Zlecenie serwisowe
          </button>
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" onclick="TaxOrderHandoverProtocol.openModal(null, '${v.nrRej}')">
            <i class="ti ti-file-signature"></i>Protokół
          </button>
        </div>
      </div>

      <!-- TABS — scrollowane z przyciskami nawigacji -->
      <div style="position:relative;margin-bottom:20px">
        <button id="vd-tabs-prev" onclick="TaxOrderVehicleDetail._scrollTabs(-1)"
          style="position:absolute;left:0;top:0;bottom:0;z-index:2;border:none;background:linear-gradient(to right,var(--bg3) 55%,transparent);padding:0 14px 0 4px;cursor:pointer;display:none;align-items:center;border-radius:var(--radius) 0 0 var(--radius)">
          <i class="ti ti-chevron-left" style="font-size:14px;color:var(--text2)"></i>
        </button>
        <div id="vd-tabs" style="display:flex;gap:2px;background:var(--bg3);border-radius:var(--radius);padding:3px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none">
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
          ['karty',     '💳 Karty'],
          ['konserwacja','🔨 Konserwacja'],
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
        <button id="vd-tabs-next" onclick="TaxOrderVehicleDetail._scrollTabs(1)"
          style="position:absolute;right:0;top:0;bottom:0;z-index:2;border:none;background:linear-gradient(to left,var(--bg3) 55%,transparent);padding:0 4px 0 14px;cursor:pointer;display:none;align-items:center;border-radius:0 var(--radius) var(--radius) 0">
          <i class="ti ti-chevron-right" style="font-size:14px;color:var(--text2)"></i>
        </button>
      </div>

      <!-- TAB: DOWÓD REJESTRACYJNY -->
      <div id="vd-tab-dr-content" class="vd-tab-content">
        <!-- Przełącznik widok DR / formularz -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button id="vd-drview-btn-form" onclick="TaxOrderVehicleDetail._toggleDrView(false)"
            style="flex:1;padding:5px 10px;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-weight:600;background:var(--bg);color:var(--text);box-shadow:0 0 0 1.5px var(--border)">
            <i class="ti ti-forms"></i> Formularz
          </button>
          <button id="vd-drview-btn-view" onclick="TaxOrderVehicleDetail._toggleDrView(true)"
            style="flex:1;padding:5px 10px;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-weight:600;background:transparent;color:var(--text2)">
            <i class="ti ti-id-badge-2"></i> Podgląd DR
          </button>
        </div>
        <!-- Wizualny podgląd DR (ukryty domyślnie) -->
        <div id="vd-dr-view" style="display:none">${this._renderDrView(v)}</div>
        <!-- Sekcje formularza -->
        <div id="vd-dr-form-sections">
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

        <!-- PODATEK DT-1 — podgląd kategorii i kwoty w oparciu o dane DR -->
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px">Podatek DT-1</div>
          <div id="vd-dt1-box">${this._renderDt1Box(v)}</div>
          <div class="vdfg" style="margin-top:8px">
            <div class="vdf">
              <label class="vdl">Gmina (stawki)</label>
              <select id="vd-gmina" class="fi"
                onchange="document.getElementById('vd-dt1-box').innerHTML=TaxOrderVehicleDetail._renderDt1BoxFromForm(${v.id})">
                ${(window.GminyRates ? GminyRates.listGminy() : ['Warszawa']).map(gn => `<option ${(v.gmina||'Warszawa')===gn?'selected':''}>${gn}</option>`).join('')}
              </select>
            </div>
            <div class="vdf">
              <label class="vdl">Miesiące podatkowe</label>
              <input type="number" id="vd-miesiacePodatku" class="fi" min="1" max="12"
                value="${v.miesiacePodatku||12}"
                onchange="document.getElementById('vd-dt1-box').innerHTML=TaxOrderVehicleDetail._renderDt1BoxFromForm(${v.id})">
            </div>
          </div>
        </div>
        </div><!-- /vd-dr-form-sections -->
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
        <div style="margin-bottom:10px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
            <input type="checkbox" id="vd-ocCoversAc" ${v.ocCoversAc?'checked':''}
              onchange="TaxOrderVehicleDetail._syncOcAc(this.checked)">
            <span>Polisa OC zawiera AC/Casco — ten sam numer polisy i daty</span>
          </label>
        </div>
        <div id="vd-ac-fields" class="vdfg" style="margin-bottom:18px;${v.ocCoversAc?'opacity:.5;pointer-events:none':''}">
          ${field('acPolicyNo','Nr polisy AC', v.ocCoversAc ? (v.ocPolicyNo||v.acPolicyNo) : v.acPolicyNo)}
          ${field('acInsurer','Ubezpieczyciel AC', v.ocCoversAc ? (v.ocInsurer||v.acInsurer) : v.acInsurer)}
          ${field('acStart','Początek AC', v.ocCoversAc ? (v.ocStart||v.acStart) : v.acStart,'date')}
          ${field('acEnd','Koniec AC', v.ocCoversAc ? (v.ocEnd||v.acEnd) : v.acEnd,'date')}
          ${field('acPremium','Składka AC (zł)', v.acPremium,'number')}
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--amber);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-heart-plus"></i> Assistance / NNW
        </div>
        <div style="margin-bottom:10px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
            <input type="checkbox" id="vd-ocCoversAss" ${v.ocCoversAss?'checked':''}
              onchange="TaxOrderVehicleDetail._syncOcAss(this.checked)">
            <span>Polisa OC zawiera Assistance/NNW — ten sam numer polisy</span>
          </label>
        </div>
        <div id="vd-ass-fields" class="vdfg" style="${v.ocCoversAss?'opacity:.5;pointer-events:none':''}">
          ${field('assPolicyNo','Nr polisy Assistance/NNW', v.ocCoversAss ? (v.ocPolicyNo||v.assPolicyNo) : v.assPolicyNo)}
          ${field('assInsurer','Ubezpieczyciel Assistance', v.ocCoversAss ? (v.ocInsurer||v.assInsurer) : v.assInsurer)}
          ${field('assEnd','Ważność Assistance do', v.ocCoversAss ? (v.ocEnd||v.assEnd) : v.assEnd,'date')}
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
          <div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px">
            <div style="font-size:12px;font-weight:600;color:var(--text2)">Historia wpisów UDT</div>
            <button class="btn btn-gray" style="font-size:11px;padding:4px 10px" onclick="TaxOrderVehicleDetail._addUdtEntry(${v.id})">
              <i class="ti ti-plus"></i>Dodaj wpis
            </button>
          </div>
          <div id="vd-udt-history">${this._renderUdtHistory(v)}</div>
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
          <div class="vdfg" style="margin-bottom:10px">
            ${field('tachoNo','Nr tachografu', v.tachoNo)}
            ${field('tachoLastCalib','Data ostatniej legalizacji', v.tachoLastCalib,'date')}
            ${field('tachoNextCalib','Termin następnej legalizacji', v.tachoNextCalib,'date')}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px">
            <div style="font-size:12px;font-weight:600;color:var(--text2)">Historia legalizacji tachografu</div>
            <button class="btn btn-gray" style="font-size:11px;padding:4px 10px" onclick="TaxOrderVehicleDetail._addTachoEntry(${v.id})">
              <i class="ti ti-plus"></i>Dodaj wpis
            </button>
          </div>
          <div id="vd-tacho-history">${this._renderTachoHistory(v)}</div>
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

        <!-- Koła bliźniacze -->
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border-radius:var(--radius);margin-bottom:16px;border:1px solid var(--border)">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600">
            <input type="checkbox" id="vd-twinWheels" ${v.twinWheels?'checked':''}
              onchange="TaxOrderVehicleDetail._toggleTwinWheels(this.checked)">
            Koła bliźniacze na tylnej osi
          </label>
          <span style="font-size:11px;color:var(--text3)">— włącz aby zdefiniować opony wewnętrzne i zewnętrzne tylnej osi</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" id="vd-tires-grid">
          ${[
            ['FL','Przód lewy (FL)', v.tireFL||{}],
            ['FR','Przód prawy (FR)', v.tireFR||{}],
            ['RL','Tył lewy — zewnętrzna (RL)', v.tireRL||{}],
            ['RR','Tył prawy — zewnętrzna (RR)', v.tireRR||{}],
          ].map(([pos,posLabel,tire]) => `
            <div style="background:var(--bg3);border-radius:var(--radius);padding:14px">
              <div style="font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px">
                <i class="ti ti-circle" style="color:var(--text2)"></i>${posLabel}
              </div>
              ${TaxOrderVehicleDetail._tireFieldsHtml(pos, tire)}
            </div>`).join('')}

          <!-- Koła bliźniacze — wewnętrzne (widoczne gdy zaznaczono) -->
          <div id="vd-twin-RL" style="background:var(--bg3);border-radius:var(--radius);padding:14px;border:2px dashed var(--blue);${v.twinWheels?'':'display:none'}">
            <div style="font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px">
              <i class="ti ti-circle-dashed" style="color:var(--blue)"></i>Tył lewy — wewnętrzna (RLi)
            </div>
            ${TaxOrderVehicleDetail._tireFieldsHtml('RLi', v.tireRLi||{})}
          </div>
          <div id="vd-twin-RR" style="background:var(--bg3);border-radius:var(--radius);padding:14px;border:2px dashed var(--blue);${v.twinWheels?'':'display:none'}">
            <div style="font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px">
              <i class="ti ti-circle-dashed" style="color:var(--blue)"></i>Tył prawy — wewnętrzna (RRi)
            </div>
            ${TaxOrderVehicleDetail._tireFieldsHtml('RRi', v.tireRRi||{})}
          </div>
        </div>

        <div style="margin-top:16px;background:var(--bg3);border-radius:var(--radius);padding:14px">
          <div style="font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="ti ti-circle" style="color:var(--text2)"></i>Zapasowe (SP)
          </div>
          <div class="vdfg">
            ${field('tireSP_size','Rozmiar opony zapasowej', v.tireSP?.size||'')}
            ${field('tireSP_brand','Marka', v.tireSP?.brand||'')}
            <div class="vdf">
              <label class="vdl">Rok DOT (4 cyfry, np. 3523)</label>
              <input id="vd-tireSP_dot" type="text" class="fi" maxlength="4" pattern="\\d{4}"
                value="${v.tireSP?.dot||''}" placeholder="3523"
                oninput="TaxOrderVehicleDetail._showDotInfo(this,'vd-tireSP_dot_info')">
              <div id="vd-tireSP_dot_info" style="font-size:10px;color:var(--blue);margin-top:2px">${TaxOrderVehicleDetail._dotInfo(v.tireSP?.dot)}</div>
            </div>
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
          ${field('saleBuyer','Nabywca (nazwa)', v.saleBuyer)}
          <div class="vdf">
            <label class="vdl">NIP nabywcy</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="vd-saleBuyerNip" type="text" class="fi" value="${v.saleBuyerNip||''}"
                placeholder="10 cyfr" maxlength="13" style="flex:1"
                oninput="this.value=this.value.replace(/[^0-9-]/g,'')">
              <button type="button" class="btn btn-gray" style="padding:4px 8px;font-size:11px;white-space:nowrap"
                onclick="TaxOrderVehicleDetail._nipLookup(document.getElementById('vd-saleBuyerNip').value,'vd-saleBuyer','_sale-nip-status')">
                <i class="ti ti-search"></i>Zaczytaj
              </button>
            </div>
            <div id="_sale-nip-status" style="font-size:10px;color:var(--blue);margin-top:2px"></div>
          </div>
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
          <div style="padding:20px;text-align:center;color:var(--text3)"><i class="ti ti-loader-2" style="font-size:20px"></i></div>
        </div>
      </div>

      <!-- TAB: GPS HISTORY -->
      <div id="vd-tab-gps-content" class="vd-tab-content" style="display:none">
        <div id="vd-gps-body">${this._renderGpsTab(v)}</div>
      </div>

      <!-- TAB: KARTY FLOTOWE -->
      <div id="vd-tab-karty-content" class="vd-tab-content" style="display:none">
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:14px">Przypisane karty flotowe</div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-blue" style="font-size:12px" onclick="TaxOrderVehicleDetail._addCard(${v.id})">
            <i class="ti ti-plus"></i>Dodaj kartę
          </button>
        </div>
        <div id="vd-cards-list">${this._renderCards(v)}</div>
      </div>

      <!-- TAB: KONSERWACJA -->
      <div id="vd-tab-konserwacja-content" class="vd-tab-content" style="display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase">Elementy konserwacji</div>
          <button class="btn btn-blue" style="font-size:12px" onclick="TaxOrderVehicleDetail._addMaintItem(${v.id})">
            <i class="ti ti-plus"></i>Dodaj element
          </button>
        </div>
        <div id="vd-maint-list">${this._renderMaintItems(v)}</div>
        ${!(v.stanKilometrow) ? `<div class="wbox" style="margin-top:12px;font-size:12px"><i class="ti ti-alert-triangle"></i> Uzupełnij licznik km w zakładce DR aby alerty km-based działały poprawnie.</div>` : ''}
      </div>
    `;

    // Async load fines after HTML is in DOM
    if (window.FinesModule) {
      window.FinesModule.renderForVehicle(v.nrRej).then(html => {
        const man = document.getElementById('vd-mandaty-body');
        if (man && html) man.innerHTML = html;
      });
    }

    // Obsługa zmiany typu własności
    document.getElementById('vd-ownershipType')?.addEventListener('change', function() {
      document.getElementById('vd-leasing-section').style.display = this.value==='leasing' ? '' : 'none';
      document.getElementById('vd-rental-section').style.display  = this.value==='rental'  ? '' : 'none';
    });

    document.getElementById('vd-save-btn').onclick = () => this.save(v.id);
    const ocrBtn = document.getElementById('vd-ocr-btn');
    if (ocrBtn) ocrBtn.onclick = () => this._openOcrScan(v.id);
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
            ${ins.docNr ? `<div style="font-size:10px;color:var(--text3)">Dok.: ${ins.docNr}${ins.nip?' · NIP: '+ins.nip:''}</div>` : ''}
            ${ins.notes ? `<div style="font-size:11px;color:var(--text2)">${ins.notes}</div>` : ''}
            ${ins.addedBy ? `<div style="font-size:10px;color:var(--text3)">Dodał: ${ins.addedBy}</div>` : ''}
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
            <label class="vdl">Stacja SKP / nazwa</label>
            <input id="_ins-station" type="text" class="fi" placeholder="Nazwa stacji" value="${v.inspectionStation||''}">
          </div>
          <div class="vdf">
            <label class="vdl">Nr dokumentu / zaświadczenia</label>
            <input id="_ins-doc" type="text" class="fi" placeholder="np. SKP/2025/001">
          </div>
          <div class="vdf">
            <label class="vdl">NIP stacji SKP</label>
            <div style="display:flex;gap:6px">
              <input id="_ins-nip" type="text" class="fi" placeholder="10 cyfr" maxlength="13" style="flex:1"
                oninput="this.value=this.value.replace(/[^0-9-]/g,'')">
              <button type="button" class="btn btn-gray" style="padding:3px 8px;font-size:11px"
                onclick="TaxOrderVehicleDetail._nipLookup(document.getElementById('_ins-nip').value,'_ins-station','_ins-nip-st')">
                <i class="ti ti-search"></i>
              </button>
            </div>
            <div id="_ins-nip-st" style="font-size:10px;color:var(--blue);margin-top:2px"></div>
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
    const docNr   = document.getElementById('_ins-doc')?.value?.trim() || '';
    const nip     = document.getElementById('_ins-nip')?.value?.replace(/[^0-9]/g,'') || '';
    const notes   = document.getElementById('_ins-notes')?.value?.trim() || '';
    if (!date) { if (typeof toast === 'function') toast(t('vd.toast.inspection.req')); return; }

    if (!Array.isArray(v.inspectionHistory)) v.inspectionHistory = [];
    v.inspectionHistory.push({
      date, result, station, docNr, nip, notes,
      addedBy: window.currentUser?.name || window.currentUser?.email || null,
      addedAt: new Date().toISOString()
    });
    this._logAudit('inspection_add', vehId, { date, result });

    // Aktualizuj lastInspection na najnowszy
    const sorted = [...v.inspectionHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    v.lastInspection = sorted[0].date;

    btn.closest('[style*=fixed]').remove();
    const histEl = document.getElementById('vd-inspection-history');
    if (histEl) histEl.innerHTML = this._renderInspectionHistory(v);
    if (typeof toast === 'function') toast(t('vd.toast.inspection.added'));
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

  // ── UDT history ──────────────────────────────────────────────────────────
  _renderUdtHistory(v) {
    const hist = Array.isArray(v.udtHistory) ? v.udtHistory : [];
    if (!hist.length) return '<div style="font-size:12px;color:var(--text3);padding:6px 0">Brak wpisów. Kliknij "Dodaj wpis" aby dodać pierwszy.</div>';
    return [...hist].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((e,i)=>`
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius);border-left:3px solid var(--red);margin-bottom:6px;font-size:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <span style="font-family:var(--mono);font-weight:600">${e.date?new Date(e.date).toLocaleDateString('pl-PL'):'—'}</span>
            <span class="pill pill-gray" style="font-size:10px">${e.typ||'badanie'}</span>
            ${e.result?`<span class="pill" style="font-size:10px;background:${{pozytywny:'var(--green)20',warunkowy:'var(--amber)20',negatywny:'var(--red)20'}[e.result]||'#eee'};color:${{pozytywny:'var(--green)',warunkowy:'var(--amber)',negatywny:'var(--red)'}[e.result]||'#666'}">${e.result}</span>`:''}
          </div>
          ${e.docNr?`<div style="font-size:10px;color:var(--text3)">Dok.: ${e.docNr}${e.nip?' · NIP: '+e.nip:''}</div>`:''}
          ${e.firma?`<div style="font-size:11px;color:var(--text2)">${e.firma}</div>`:''}
          ${e.notes?`<div style="font-size:11px;color:var(--text2)">${e.notes}</div>`:''}
          ${e.addedBy?`<div style="font-size:10px;color:var(--text3)">Dodał: ${e.addedBy}</div>`:''}
        </div>
        <button onclick="TaxOrderVehicleDetail._removeUdtEntry(${v.id},${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px 4px;font-size:14px">&times;</button>
      </div>`).join('');
  },

  _addUdtEntry(vehId) {
    const v = (window.vehs||[]).find(x=>x.id===vehId);
    if (!v) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:480px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-building-factory-2" style="color:var(--red)"></i>Nowy wpis UDT — ${v.nrRej}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Data badania/wpisu</label>
            <input id="_udt-date" type="date" class="fi" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="vdf">
            <label class="vdl">Typ wpisu</label>
            <select id="_udt-typ" class="fi">
              <option value="badanie">Badanie UDT</option>
              <option value="rejestracja">Rejestracja urządzenia</option>
              <option value="modernizacja">Modernizacja</option>
              <option value="naprawa">Naprawa / wymiana</option>
              <option value="inne">Inne</option>
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Wynik</label>
            <select id="_udt-result" class="fi">
              <option value="">— nie określono —</option>
              <option value="pozytywny">✅ Pozytywny</option>
              <option value="warunkowy">⚠ Warunkowy</option>
              <option value="negatywny">❌ Negatywny</option>
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Nr decyzji / dokumentu</label>
            <input id="_udt-doc" type="text" class="fi" placeholder="np. UDT/2025/123">
          </div>
          <div class="vdf">
            <label class="vdl">NIP inspektora / firmy</label>
            <div style="display:flex;gap:6px">
              <input id="_udt-nip" type="text" class="fi" placeholder="10 cyfr" maxlength="13" style="flex:1"
                oninput="this.value=this.value.replace(/[^0-9-]/g,'')">
              <button type="button" class="btn btn-gray" style="padding:3px 8px;font-size:11px"
                onclick="TaxOrderVehicleDetail._nipLookup(document.getElementById('_udt-nip').value,'_udt-firma','_udt-nip-st')">
                <i class="ti ti-search"></i>
              </button>
            </div>
            <div id="_udt-nip-st" style="font-size:10px;color:var(--blue);margin-top:2px"></div>
          </div>
          <div class="vdf">
            <label class="vdl">Nazwa firmy / inspektora</label>
            <input id="_udt-firma" type="text" class="fi" placeholder="Uzupełnia się automatycznie z NIP">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Uwagi</label>
            <textarea id="_udt-notes" class="fi" style="height:60px;resize:vertical"></textarea>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-green" onclick="TaxOrderVehicleDetail._saveUdtEntry(${vehId},this)">
            <i class="ti ti-check"></i>Zapisz wpis
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('_udt-date')?.focus();
  },

  _saveUdtEntry(vehId, btn) {
    const v = (window.vehs||[]).find(x=>x.id===vehId);
    if (!v) return;
    const date  = document.getElementById('_udt-date')?.value || '';
    if (!date) { toast(t('vd.toast.date.req')); return; }
    const entry = {
      date,
      typ:    document.getElementById('_udt-typ')?.value || '',
      result: document.getElementById('_udt-result')?.value || '',
      docNr:  document.getElementById('_udt-doc')?.value?.trim() || '',
      nip:    document.getElementById('_udt-nip')?.value?.replace(/[^0-9]/g,'') || '',
      firma:  document.getElementById('_udt-firma')?.value?.trim() || '',
      notes:  document.getElementById('_udt-notes')?.value?.trim() || '',
      addedBy: window.currentUser?.name || window.currentUser?.email || null,
      addedAt: new Date().toISOString()
    };
    if (!Array.isArray(v.udtHistory)) v.udtHistory = [];
    v.udtHistory.push(entry);
    if (entry.date) v.udtLastDate = [...v.udtHistory].sort((a,b)=>new Date(b.date)-new Date(a.date))[0].date;
    btn.closest('[style*=fixed]').remove();
    const el = document.getElementById('vd-udt-history');
    if (el) el.innerHTML = this._renderUdtHistory(v);
    this._logAudit('udt_add', vehId, { date, typ: entry.typ });
    toast(t('vd.toast.udt.added'));
  },

  _removeUdtEntry(vehId, index) {
    const v = (window.vehs||[]).find(x=>x.id===vehId);
    if (!v || !Array.isArray(v.udtHistory)) return;
    const sorted = [...v.udtHistory].sort((a,b)=>new Date(b.date)-new Date(a.date));
    v.udtHistory = v.udtHistory.filter(e=>e!==sorted[index]);
    this._logAudit('udt_remove', vehId, {});
    const el = document.getElementById('vd-udt-history');
    if (el) el.innerHTML = this._renderUdtHistory(v);
  },

  // ── Tachograph history ────────────────────────────────────────────────────
  _renderTachoHistory(v) {
    const hist = Array.isArray(v.tachoHistory) ? v.tachoHistory : [];
    if (!hist.length) return '<div style="font-size:12px;color:var(--text3);padding:6px 0">Brak wpisów. Kliknij "Dodaj wpis" aby dodać pierwszą legalizację.</div>';
    return [...hist].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((e,i)=>`
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius);border-left:3px solid var(--blue);margin-bottom:6px;font-size:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <span style="font-family:var(--mono);font-weight:600">${e.date?new Date(e.date).toLocaleDateString('pl-PL'):'—'}</span>
            <span class="pill pill-gray" style="font-size:10px">${e.typ||'legalizacja'}</span>
            ${e.wazneDo?`<span style="font-size:10px;color:var(--text2)">ważne do: ${new Date(e.wazneDo).toLocaleDateString('pl-PL')}</span>`:''}
          </div>
          ${e.certNr?`<div style="font-size:10px;color:var(--text3)">Cert.: ${e.certNr}${e.nip?' · NIP: '+e.nip:''}</div>`:''}
          ${e.firma?`<div style="font-size:11px;color:var(--text2)">${e.firma}</div>`:''}
          ${e.notes?`<div style="font-size:11px;color:var(--text2)">${e.notes}</div>`:''}
          ${e.addedBy?`<div style="font-size:10px;color:var(--text3)">Dodał: ${e.addedBy}</div>`:''}
        </div>
        <button onclick="TaxOrderVehicleDetail._removeTachoEntry(${v.id},${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px 4px;font-size:14px">&times;</button>
      </div>`).join('');
  },

  _addTachoEntry(vehId) {
    const v = (window.vehs||[]).find(x=>x.id===vehId);
    if (!v) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:var(--radius-lg);padding:24px;width:480px;max-width:98vw;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="font-size:15px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-device-desktop-analytics" style="color:var(--blue)"></i>Nowy wpis tachografu — ${v.nrRej}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Data legalizacji</label>
            <input id="_tch-date" type="date" class="fi" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="vdf">
            <label class="vdl">Typ wpisu</label>
            <select id="_tch-typ" class="fi">
              <option value="legalizacja">Legalizacja tachografu</option>
              <option value="kalibracja">Kalibracja</option>
              <option value="wymiana">Wymiana tachografu</option>
              <option value="naprawa">Naprawa</option>
              <option value="inne">Inne</option>
            </select>
          </div>
          <div class="vdf">
            <label class="vdl">Ważność do (następna legalizacja)</label>
            <input id="_tch-wazne" type="date" class="fi">
          </div>
          <div class="vdf">
            <label class="vdl">Nr świadectwa / certyfikatu</label>
            <input id="_tch-cert" type="text" class="fi" placeholder="nr certyfikatu legalizacji">
          </div>
          <div class="vdf">
            <label class="vdl">NIP warsztatu</label>
            <div style="display:flex;gap:6px">
              <input id="_tch-nip" type="text" class="fi" placeholder="10 cyfr" maxlength="13" style="flex:1"
                oninput="this.value=this.value.replace(/[^0-9-]/g,'')">
              <button type="button" class="btn btn-gray" style="padding:3px 8px;font-size:11px"
                onclick="TaxOrderVehicleDetail._nipLookup(document.getElementById('_tch-nip').value,'_tch-firma','_tch-nip-st')">
                <i class="ti ti-search"></i>
              </button>
            </div>
            <div id="_tch-nip-st" style="font-size:10px;color:var(--blue);margin-top:2px"></div>
          </div>
          <div class="vdf">
            <label class="vdl">Nazwa warsztatu</label>
            <input id="_tch-firma" type="text" class="fi" placeholder="Uzupełnia się automatycznie z NIP">
          </div>
          <div class="vdf" style="grid-column:1/-1">
            <label class="vdl">Uwagi</label>
            <textarea id="_tch-notes" class="fi" style="height:55px;resize:vertical"></textarea>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Anuluj</button>
          <button class="btn btn-green" onclick="TaxOrderVehicleDetail._saveTachoEntry(${vehId},this)">
            <i class="ti ti-check"></i>Zapisz wpis
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('_tch-date')?.focus();
  },

  _saveTachoEntry(vehId, btn) {
    const v = (window.vehs||[]).find(x=>x.id===vehId);
    if (!v) return;
    const date = document.getElementById('_tch-date')?.value || '';
    if (!date) { toast(t('vd.toast.date.req')); return; }
    const entry = {
      date,
      typ:    document.getElementById('_tch-typ')?.value || '',
      wazneDo:document.getElementById('_tch-wazne')?.value || '',
      certNr: document.getElementById('_tch-cert')?.value?.trim() || '',
      nip:    document.getElementById('_tch-nip')?.value?.replace(/[^0-9]/g,'') || '',
      firma:  document.getElementById('_tch-firma')?.value?.trim() || '',
      notes:  document.getElementById('_tch-notes')?.value?.trim() || '',
      addedBy: window.currentUser?.name || window.currentUser?.email || null,
      addedAt: new Date().toISOString()
    };
    if (!Array.isArray(v.tachoHistory)) v.tachoHistory = [];
    v.tachoHistory.push(entry);
    if (entry.wazneDo) v.tachoNextCalib = entry.wazneDo;
    if (entry.date) v.tachoLastCalib = [...v.tachoHistory].sort((a,b)=>new Date(b.date)-new Date(a.date))[0].date;
    btn.closest('[style*=fixed]').remove();
    const el = document.getElementById('vd-tacho-history');
    if (el) el.innerHTML = this._renderTachoHistory(v);
    this._logAudit('tacho_add', vehId, { date, typ: entry.typ });
    toast(t('vd.toast.tacho.added'));
  },

  _removeTachoEntry(vehId, index) {
    const v = (window.vehs||[]).find(x=>x.id===vehId);
    if (!v || !Array.isArray(v.tachoHistory)) return;
    const sorted = [...v.tachoHistory].sort((a,b)=>new Date(b.date)-new Date(a.date));
    v.tachoHistory = v.tachoHistory.filter(e=>e!==sorted[index]);
    this._logAudit('tacho_remove', vehId, {});
    const el = document.getElementById('vd-tacho-history');
    if (el) el.innerHTML = this._renderTachoHistory(v);
  },

  _renderMaintItems(v) {
    const items = v.maintenanceItems || [];
    if (!items.length) return '<div style="font-size:12px;color:var(--text3);padding:20px;text-align:center"><i class="ti ti-tool" style="font-size:28px;display:block;margin-bottom:6px"></i>Brak elementów konserwacji. Dodaj element lub przypisz szablon w Centrum Powiadomień.</div>';
    const now = new Date();
    return items.map(item => {
      const daysDue = item.nextDate ? Math.round((new Date(item.nextDate) - now) / 86400000) : null;
      const kmDue   = (item.nextKm && v.stanKilometrow) ? item.nextKm - v.stanKilometrow : null;
      const isOk    = (daysDue === null || daysDue > 14) && (kmDue === null || kmDue > 500);
      const color   = daysDue !== null && daysDue < 0 || kmDue !== null && kmDue < 0 ? 'var(--red)' : (!isOk ? 'var(--amber)' : 'var(--green)');
      return `<div style="background:var(--bg3);border-radius:var(--radius);border-left:3px solid ${color};padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-weight:600;font-size:13px">${item.label || item.typeId}</div>
          ${item.intervalDays ? `<div style="font-size:11px;color:var(--text2)">Cykl: co ${item.intervalDays} dni</div>` : ''}
          ${item.intervalKm   ? `<div style="font-size:11px;color:var(--text2)">Cykl: co ${item.intervalKm} km</div>` : ''}
        </div>
        <div style="min-width:120px;font-size:12px">
          ${item.nextDate ? `<div>📅 ${new Date(item.nextDate).toLocaleDateString('pl-PL')}</div>` : ''}
          ${daysDue !== null ? `<div style="color:${color};font-weight:600">${daysDue < 0 ? `Wygasło ${Math.abs(daysDue)} dni temu` : `za ${daysDue} dni`}</div>` : ''}
          ${item.nextKm ? `<div>🔢 ${item.nextKm.toLocaleString('pl-PL')} km</div>` : ''}
          ${kmDue !== null ? `<div style="color:${kmDue<0?'var(--red)':'var(--text2)'}${kmDue<500&&kmDue>=0?';color:var(--amber)':''}">za ${kmDue} km</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="tbtn" onclick="TaxOrderVehicleDetail._editMaintItem(${v.id},'${item.id}')" title="Edytuj"><i class="ti ti-pencil"></i></button>
          <button class="tbtn" style="color:var(--red)" onclick="TaxOrderVehicleDetail._deleteMaintItem(${v.id},'${item.id}')" title="Usuń"><i class="ti ti-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  },

  _addMaintItem(vId) { this._openMaintModal(vId, null); },
  _editMaintItem(vId, itemId) {
    const v = (window.vehs||[]).find(v=>v.id===vId);
    const item = (v?.maintenanceItems||[]).find(m=>m.id===itemId);
    if (item) this._openMaintModal(vId, item);
  },

  _openMaintModal(vId, item) {
    const types = window._ns_alertTypes || [];
    const typeOpts = types.map(a => `<option value="${a.id}" ${item?.typeId===a.id?'selected':''}>${a.name}</option>`).join('');
    const fmtDate = d => d ? new Date(d).toISOString().slice(0,10) : '';
    const html = `<div id="maint-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:5002;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:420px;max-width:95vw;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <strong style="font-size:15px">${item?'Edytuj':'Dodaj'} element konserwacji</strong>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
          <div class="f"><label>Typ</label><select id="mi-type" class="fi">${typeOpts||'<option value="">—</option>'}</select></div>
          <div class="f"><label>Własna nazwa (opcjonalna)</label><input id="mi-label" class="fi" value="${item?.label||''}" placeholder="np. Olej 10W-40 Shell"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="f"><label>Ostatnia data</label><input id="mi-lastDate" type="date" class="fi" value="${fmtDate(item?.lastDate)}"></div>
            <div class="f"><label>Ostatnie km</label><input id="mi-lastKm" type="number" class="fi" value="${item?.lastKm||''}" placeholder="np. 145000"></div>
            <div class="f"><label>Interwał dni</label><input id="mi-intDays" type="number" class="fi" value="${item?.intervalDays||''}" placeholder="np. 365"></div>
            <div class="f"><label>Interwał km</label><input id="mi-intKm" type="number" class="fi" value="${item?.intervalKm||''}" placeholder="np. 15000"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button class="btn btn-gray" onclick="document.getElementById('maint-modal').remove()">Anuluj</button>
          <button class="btn btn-blue" onclick="TaxOrderVehicleDetail._saveMaintItem(${vId},'${item?.id||''}')"><i class="ti ti-check"></i>Zapisz</button>
        </div>
      </div>
    </div>`;
    document.getElementById('maint-modal')?.remove();
    // Załaduj typy alertów jeśli nie ma
    if (!types.length) {
      fetch(`${window.CF_WORKER_URL||'https://taxorder-pro-api.adamus1000.workers.dev'}/api/alert-types?company=${window.currentCompanyId||'mtoilet'}`,
        { headers: { Authorization: 'Bearer ' + (localStorage.getItem('cf_token')||'') } })
        .then(r=>r.json()).then(list=>{ window._ns_alertTypes=list; document.getElementById('mi-type').innerHTML=list.map(a=>`<option value="${a.id}" ${item?.typeId===a.id?'selected':''}>${a.name}</option>`).join(''); }).catch(()=>{});
    }
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async _saveMaintItem(vId, existingId) {
    const v = (window.vehs||[]).find(v=>v.id===vId);
    if (!v) return;
    const typeId   = document.getElementById('mi-type')?.value;
    const label    = document.getElementById('mi-label')?.value?.trim() || null;
    const lastDate = document.getElementById('mi-lastDate')?.value || null;
    const lastKm   = parseInt(document.getElementById('mi-lastKm')?.value) || null;
    const intDays  = parseInt(document.getElementById('mi-intDays')?.value) || null;
    const intKm    = parseInt(document.getElementById('mi-intKm')?.value) || null;
    const nextDate = (lastDate && intDays) ? new Date(new Date(lastDate).getTime() + intDays*86400000).toISOString().slice(0,10) : null;
    const nextKm   = (lastKm && intKm) ? lastKm + intKm : null;

    if (!v.maintenanceItems) v.maintenanceItems = [];
    if (existingId) {
      const idx = v.maintenanceItems.findIndex(m=>m.id===existingId);
      if (idx >= 0) v.maintenanceItems[idx] = { id: existingId, typeId, label, lastDate, lastKm, intervalDays: intDays, intervalKm: intKm, nextDate, nextKm };
    } else {
      v.maintenanceItems.push({ id: crypto.randomUUID(), typeId, label, lastDate, lastKm, intervalDays: intDays, intervalKm: intKm, nextDate, nextKm });
    }
    await this.save(vId, true);
    document.getElementById('maint-modal')?.remove();
    document.getElementById('vd-maint-list').innerHTML = this._renderMaintItems(v);
    window.toast?.('✓ Element konserwacji zapisany');
  },

  async _deleteMaintItem(vId, itemId) {
    if (!confirm(t('vd.confirm.del.maintenance'))) return;
    const v = (window.vehs||[]).find(v=>v.id===vId);
    if (!v) return;
    v.maintenanceItems = (v.maintenanceItems||[]).filter(m=>m.id!==itemId);
    await this.save(vId, true);
    document.getElementById('vd-maint-list').innerHTML = this._renderMaintItems(v);
    window.toast?.('✓ Element usunięty');
  },

  _renderCards(v) {
    const cards = (window.getFlotCards?.() || []).filter(c => c.nr_rej === v.nrRej);
    if (!cards.length) return '<div style="font-size:12px;color:var(--text3)">Brak przypisanych kart. Kliknij "Dodaj" aby przypisać.</div>';
    const STATUS_CLS = { AKTYWNA:'pill-green', ZABLOKOWANA:'pill-red', NIEAKTYWNA:'pill-gray' };
    return cards.map(c => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg3);border-radius:var(--radius);margin-bottom:6px;font-size:12px;border-left:3px solid var(--blue)">
        <i class="ti ti-credit-card" style="color:var(--blue);font-size:16px;flex-shrink:0;margin-top:2px"></i>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-family:var(--mono);font-weight:600;font-size:13px">${(c.card_no||'').replace(/\d(?=\d{4})/g,'•')}</span>
            <span class="pill pill-blue" style="font-size:10px">${c.type||'—'}</span>
            <span class="pill ${STATUS_CLS[c.status]||'pill-gray'}" style="font-size:10px">${c.status||'—'}</span>
          </div>
          ${c.provider?`<div style="font-size:11px;color:var(--text2);margin-top:2px"><i class="ti ti-building" style="font-size:10px"></i> ${c.provider}</div>`:''}
          ${c.notes?`<div style="font-size:11px;color:var(--text3)">${c.notes}</div>`:''}
        </div>
        <button onclick="TaxOrderVehicleDetail._removeCard('${v.nrRej}','${c.id}')" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px 4px;font-size:14px" title="Usuń kartę">&times;</button>
      </div>`).join('');
  },

  async _removeCard(nrRej, cardId) {
    if (!confirm(t('vd.confirm.del.card'))) return;
    const api = window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
    const tok = localStorage.getItem('cf_token');
    const co = window.currentCompanyId || 'mtoilet';
    const hdrs = { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) };
    try {
      const r = await fetch(`${api}/api/fleet-cards/${cardId}?company=${co}`, { method: 'DELETE', headers: hdrs });
      if (!r.ok) { toast(t('vd.toast.card.err').replace('{0}', r.status)); return; }
    } catch { toast(t('vd.toast.conn')); return; }
    const v = (window.vehs||[]).find(x => x.nrRej === nrRej);
    const listEl = document.getElementById('vd-cards-list');
    if (typeof window.getFlotCards === 'function') {
      const cards = window.getFlotCards();
      const idx = cards.findIndex(c => c.id === cardId);
      if (idx !== -1) cards.splice(idx, 1);
    }
    if (listEl && v) listEl.innerHTML = this._renderCards(v);
    toast(t('vd.toast.card.deleted'));
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
    if (man && window.FinesModule) {
      man.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)"><i class="ti ti-loader-2" style="font-size:20px"></i></div>';
      window.FinesModule.renderForVehicle(v.nrRej).then(html => { if (html) man.innerHTML = html; });
    }
    const gps = document.getElementById('vd-gps-body');
    if (gps) gps.innerHTML = this._renderGpsTab(v);
    this.refreshServiceTab(vehId);
  },

  _toggleDrView(showView) {
    const view   = document.getElementById('vd-dr-view');
    const form   = document.getElementById('vd-dr-form-sections');
    const btnF   = document.getElementById('vd-drview-btn-form');
    const btnV   = document.getElementById('vd-drview-btn-view');
    if (!view || !form) return;
    view.style.display  = showView ? '' : 'none';
    form.style.display  = showView ? 'none' : '';
    if (btnF) {
      btnF.style.background  = showView ? 'transparent' : 'var(--bg)';
      btnF.style.color       = showView ? 'var(--text2)' : 'var(--text)';
      btnF.style.boxShadow   = showView ? 'none' : '0 0 0 1.5px var(--border)';
    }
    if (btnV) {
      btnV.style.background = showView ? 'var(--bg)' : 'transparent';
      btnV.style.color      = showView ? 'var(--text)' : 'var(--text2)';
      btnV.style.boxShadow  = showView ? '0 0 0 1.5px var(--border)' : 'none';
    }
  },

  _renderDrView(v) {
    const f = (val, unit = '') => {
      if (val == null || val === '' || val === 0) return '<span style="color:var(--text3)">—</span>';
      return `<strong>${val}</strong>${unit ? ' <span style="color:var(--text3);font-size:10px">' + unit + '</span>' : ''}`;
    };
    const row = (code, label, val, unit = '') => `
      <tr>
        <td style="font-size:9px;font-weight:700;color:var(--text3);white-space:nowrap;padding:2px 6px 2px 0;vertical-align:top;min-width:30px">${code}</td>
        <td style="font-size:9.5px;color:var(--text2);padding:2px 8px 2px 0;white-space:nowrap;vertical-align:top">${label}</td>
        <td style="font-size:11px;color:var(--text);padding:2px 0;vertical-align:top">${f(val, unit)}</td>
      </tr>`;

    return `
      <div style="
        background:linear-gradient(135deg,#f8f6f2 0%,#efe9de 100%);
        border:2px solid #c8b89a;
        border-radius:8px;
        padding:14px 16px;
        font-family:'Courier New',monospace;
        position:relative;
        overflow:hidden;
        box-shadow:0 2px 8px rgba(0,0,0,.12)
      ">
        <!-- Nagłówek -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;border-bottom:1px solid #c8b89a;padding-bottom:8px">
          <div>
            <div style="font-size:9px;font-weight:700;letter-spacing:.12em;color:#5a4a35;text-transform:uppercase">Rzeczpospolita Polska</div>
            <div style="font-size:13px;font-weight:700;letter-spacing:.06em;color:#2a1f0f;margin-top:1px">DOWÓD REJESTRACYJNY</div>
            <div style="font-size:8px;color:#7a6a55;margin-top:2px;font-style:italic">Registration certificate / Carte grise</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:8px;color:#7a6a55;margin-bottom:2px">A — Nr rejestracyjny</div>
            <div style="
              background:#1a3a6e;color:#fff;
              font-size:15px;font-weight:700;letter-spacing:.08em;
              padding:4px 12px;border-radius:4px;
              border:2px solid #0d2050
            ">${v.nrRej || '—'}</div>
            <div style="font-size:8px;color:#7a6a55;margin-top:4px">🇵🇱 POL</div>
          </div>
        </div>

        <!-- Dane pojazdu -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">
          <table style="border-collapse:collapse">
            ${row('B', 'Data 1. rej.', v.dataRejestracji)}
            ${row('D.1', 'Marka', v.marka)}
            ${row('D.2', 'Typ', v.wariant)}
            ${row('D.3', 'Model', v.model)}
            ${row('E', 'VIN / nr identyf.', v.vin)}
            ${row('J', 'Kategoria', v.katPojazdu)}
            ${row('K', 'Nr homologacji', v.homologacja)}
          </table>
          <table style="border-collapse:collapse">
            ${row('F.1', 'DMC', v.dmcMax, 'kg')}
            ${row('F.2', 'DMC ładunku', v.ladownosc, 'kg')}
            ${row('F.3', 'DMC zesp.', v.dmcZespolu, 'kg')}
            ${row('G', 'Masa własna', v.masaWlasna, 'kg')}
            ${row('O.1', 'Przycz. z ham.', v.masaPrzyczepyZHam, 'kg')}
            ${row('O.2', 'Przycz. bez ham.', v.masaPrzyczepyBezHam, 'kg')}
            ${row('P.1', 'Pojemność', v.pojSilnika, 'cm³')}
            ${row('P.2', 'Moc', v.mocKW, 'kW')}
            ${row('P.3', 'Paliwo', v.paliwo)}
            ${row('S.1', 'Miejsca siedz.', v.miejscaSied)}
          </table>
        </div>

        <!-- Stopka -->
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #c8b89a;display:flex;justify-content:space-between;font-size:9px;color:#7a6a55">
          <span>H — Ważny do: ${v.docWaznyDo ? `<strong style="color:#2a1f0f">${v.docWaznyDo}</strong>` : '<em>bez daty ważności</em>'}</span>
          <span>I — Wydany: ${v.docDataWydania ? `<strong style="color:#2a1f0f">${v.docDataWydania}</strong>` : '<span style="color:var(--text3)">—</span>'}</span>
        </div>

        <!-- Watermark -->
        <div style="
          position:absolute;top:50%;left:50%;
          transform:translate(-50%,-50%) rotate(-30deg);
          font-size:48px;font-weight:900;
          color:rgba(200,184,154,.18);
          pointer-events:none;white-space:nowrap;
          font-family:serif
        ">DR</div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button class="btn btn-amber" style="flex:1;justify-content:center"
          onclick="AztecScanner.open(${v.id})">
          <i class="ti ti-qrcode"></i> Skanuj AZTEC
        </button>
      </div>`;
  },

  _renderDt1Box(v) {
    const tax = window.calcTax ? calcTax(v) : null;
    if (!tax || !tax.cat) {
      return `<div style="padding:10px 14px;background:var(--bg3);border-radius:var(--radius);font-size:12px;color:var(--text2)">
        <i class="ti ti-info-circle"></i> Pojazd nie podlega podatkowi DT-1 (DMC ≤ 3,5t lub typ specjalny)
      </div>`;
    }
    return this._dt1Chips(tax, v);
  },

  _renderDt1BoxFromForm(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return '';
    const gmina = document.getElementById('vd-gmina')?.value || v.gmina || 'Warszawa';
    const m = parseInt(document.getElementById('vd-miesiacePodatku')?.value) || v.miesiacePodatku || 12;
    const vProxy = { ...v, gmina, miesiacePodatku: m };
    const tax = window.calcTax ? calcTax(vProxy) : null;
    if (!tax || !tax.cat) {
      return `<div style="padding:10px 14px;background:var(--bg3);border-radius:var(--radius);font-size:12px;color:var(--text2)">
        <i class="ti ti-info-circle"></i> Pojazd nie podlega podatkowi DT-1
      </div>`;
    }
    return this._dt1Chips(tax, vProxy);
  },

  _dt1Chips(tax, v) {
    const chip = (label, val, color) => `
      <div style="background:var(--bg3);border-radius:var(--radius);padding:9px 10px;text-align:center">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">${label}</div>
        <div style="font-size:15px;font-weight:700;font-family:var(--mono);color:${color||'var(--text)'}">${val}</div>
      </div>`;
    const gmina = v.gmina || 'Warszawa';
    return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
      ${chip('Kategoria', tax.cat, 'var(--blue)')}
      ${chip('Stawka roczna', tax.rate.toLocaleString('pl-PL')+' zł')}
      ${chip('Kwota', tax.amount.toLocaleString('pl-PL')+' zł', 'var(--green)')}
      ${chip('Rok prod.', tax.isNew ? '≥2024 ✓' : '<2024', tax.isNew ? 'var(--green)' : 'var(--text2)')}
    </div>
    <div style="margin-top:6px;font-size:11px;color:var(--text3)">
      <i class="ti ti-map-pin" style="font-size:10px"></i> Gmina: <b>${gmina}</b> · ${v.miesiacePodatku||12} miesięcy
      ${gmina !== 'Warszawa' ? '<span style="color:var(--amber)"> · stawki własnej gminy</span>' : ''}
    </div>`;
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

    // Punkty z współrzędnymi dla mapy
    const withCoords = gps.filter(r => r.lat != null && r.lon != null && !isNaN(r.lat) && !isNaN(r.lon));
    const mapId = `gps-map-${v.id}`;

    // Uruchom mapę po wyrenderowaniu HTML (jeśli Leaflet dostępny)
    if (withCoords.length > 0) {
      setTimeout(() => {
        const container = document.getElementById(mapId);
        if (!container || !window.L) return;
        if (container._leaflet_id) { container._leaflet_id = null; container.innerHTML = ''; }
        const coords = withCoords.map(r => [r.lat, r.lon]);
        const map = window.L.map(container, { zoomControl: true });
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors', maxZoom: 18
        }).addTo(map);
        // Trasa jako linia
        const polyline = window.L.polyline(coords, { color: '#185FA5', weight: 3, opacity: .8 }).addTo(map);
        // Punkt startowy (zielony) i końcowy (czerwony)
        window.L.circleMarker(coords[0], { radius: 7, color: '#3B6D11', fillColor: '#5fb336', fillOpacity: 1 })
          .bindPopup(`Start: ${withCoords[0].date} ${withCoords[0].time||''}`).addTo(map);
        if (coords.length > 1) {
          window.L.circleMarker(coords[coords.length-1], { radius: 7, color: '#A32D2D', fillColor: '#d44a4a', fillOpacity: 1 })
            .bindPopup(`Koniec: ${withCoords[withCoords.length-1].date} ${withCoords[withCoords.length-1].time||''}`).addTo(map);
        }
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
      }, 150);
    }

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
      ${withCoords.length > 0 ? `
        <div id="${mapId}" style="height:280px;border-radius:var(--radius-lg);margin-bottom:16px;border:1px solid var(--border);z-index:0"></div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px;margin-top:-8px">
          <i class="ti ti-map-pin"></i> ${withCoords.length} z ${gps.length} rekordów z współrzędnymi GPS · dane OpenStreetMap
        </div>
      ` : ''}
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
    if (!v) { toast(t('vd.toast.open.card')); return; }
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
    // DT-1 tax block
    const tax = window.calcTax ? window.calcTax(v) : null;
    const dt1Html = tax ? `
<h2>Podatek DT-1</h2>
<table>
  ${row('Kategoria podatku', tax.exempt ? 'Zwolniony (pojazd specjalny)' : tax.cat||'—')}
  ${!tax.exempt && tax.stawkaRoczna != null ? row('Stawka roczna', fz(tax.stawkaRoczna)) : ''}
  ${!tax.exempt && tax.kwota != null ? row(`Kwota (${v.miesiacePodatku||12} mies.)`, `<span style="color:#1d4ed8;font-weight:700">${fz(tax.kwota)}</span>`) : ''}
  ${!tax.exempt && tax.gminaName ? row('Gmina stawek', tax.gminaName) : ''}
</table>` : '';
    // TCO summary
    const yr = String(new Date().getFullYear());
    const fuelCost = (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(yr)).reduce((s,h)=>s+(+h.totalCost||0),0);
    const svcCost  = (v.serviceHistory||[]).filter(h=>(h.date||'').startsWith(yr)).reduce((s,h)=>s+(+h.cost||0),0);
    const insCost  = (v.ocPremium||0) + (v.acPremium||0) + (v.assistPremium||0);
    const tcoTotal = fuelCost + svcCost + insCost;
    const kmPts    = (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(yr)&&h.km>0).sort((a,b)=>a.km-b.km);
    const kmDriven = kmPts.length>=2 ? kmPts[kmPts.length-1].km - kmPts[0].km : null;
    const tcoHtml  = tcoTotal > 0 ? `
<h2>TCO ${yr}</h2>
<table>
  ${row('Paliwo', fz(fuelCost))}
  ${row('Serwis / naprawy', fz(svcCost))}
  ${row('Ubezpieczenia', fz(insCost))}
  ${row('Łącznie', `<span style="color:#1d4ed8;font-weight:700">${fz(tcoTotal)}</span>`)}
  ${kmDriven ? row('Koszt/km', fz(tcoTotal/kmDriven).replace(' zł','')+' zł/km') : ''}
</table>` : '';
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
${row('DMC',(v.dmc||v.dmcMax||0).toLocaleString('pl-PL')+' kg')}${row('EURO',v.euro)}
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
${dt1Html}
${tcoHtml}
${svcRows?`<h2>Historia serwisowa (ostatnie 8)</h2>
<table><thead><tr><th>Data</th><th>Typ</th><th>Opis</th><th style="text-align:right">Km</th><th style="text-align:right">Koszt</th></tr></thead>
<tbody>${svcRows}</tbody></table>`:''}
</body></html>`;
    const win = window.open('', '_blank', 'width=860,height=960');
    if (!win) { toast(t('vd.toast.popups')); return; }
    win.document.write(html); win.document.close();
  },

  _scrollTabs(dir) {
    const tabs = document.getElementById('vd-tabs');
    if (tabs) tabs.scrollBy({ left: dir * 220, behavior: 'smooth' });
  },

  _initTabScroll() {
    const tabs = document.getElementById('vd-tabs');
    const prev = document.getElementById('vd-tabs-prev');
    const next = document.getElementById('vd-tabs-next');
    if (!tabs || !prev || !next) return;
    const update = () => {
      prev.style.display = tabs.scrollLeft < 4 ? 'none' : 'flex';
      next.style.display = tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 4 ? 'none' : 'flex';
    };
    tabs.addEventListener('scroll', update);
    update();
  },

  _tab(name) {
    document.querySelectorAll('.vd-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[id^="vd-tab-"]').forEach(btn => {
      if (btn.id === 'vd-tabs') return;
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text2)';
      btn.classList.remove('vd-tab-active');
    });
    const contentEl = document.getElementById('vd-tab-' + name + '-content');
    if (contentEl) contentEl.style.display = '';
    const btn = document.getElementById('vd-tab-' + name);
    if (btn) {
      btn.style.background = 'var(--bg)';
      btn.style.color = 'var(--text)';
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  },

  _onArchiveToggle(cb) {
    const reason = document.getElementById('vd-archivedReason');
    if (reason) reason.closest('.vdf').style.opacity = cb.checked ? '1' : '0.4';
  },

  async _syncCepik(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;

    // Pobierz lub poproś o token CEPiK
    let token = (localStorage.getItem('cepik_bearer_token') || '').trim();
    if (!token) {
      token = prompt(
        'Podaj Bearer token CEPiK (z portalu cpa.gov.pl):\n\n' +
        '1. Zaloguj się na https://cpa.gov.pl\n' +
        '2. Wyszukaj API "CEPiK" → Subskrybuj\n' +
        '3. Wygeneruj token (OAuth2 client_credentials)\n\n' +
        'Token zostanie zapamiętany lokalnie.'
      );
      if (!token?.trim()) return;
      localStorage.setItem('cepik_bearer_token', token.trim());
    }

    toast(t('vd.toast.cepik.loading').replace('{0}', v.nrRej));
    const woj = _cepikWojFromNrRej(v.nrRej);

    try {
      const resp = await fetch(
        `${window.CF_WORKER_URL}/api/cepik/pojazdy?nr=${encodeURIComponent(v.nrRej)}&woj=${woj}`,
        { headers: { 'X-Cepik-Token': token }, signal: AbortSignal.timeout(15000) }
      );

      if (resp.status === 401 || resp.status === 403) {
        localStorage.removeItem('cepik_bearer_token');
        return toast(t('vd.toast.cepik.token'));
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        return toast(`⚠ CEPiK HTTP ${resp.status}: ${txt.slice(0, 120)}`);
      }

      const payload = await resp.json();
      const attrs = payload?.data?.[0]?.attributes;
      if (!attrs) return toast(t('vd.toast.cepik.notfound').replace('{0}', v.nrRej));

      const formMap = _cepikMapToForm(attrs);
      let filled = 0;
      for (const [formId, val] of Object.entries(formMap)) {
        if (val == null || val === '') continue;
        const el = document.getElementById('vd-' + formId);
        if (el) { el.value = val; filled++; }
      }

      // Zapisz status synchronizacji w obiekcie pojazdu
      v.cepikSyncStatus = 'ok';
      v.cepikSyncDate   = new Date().toISOString().slice(0, 10);

      toast(`✅ CEPiK: uzupełniono ${filled} pól dla ${v.nrRej}`);
    } catch (e) {
      toast(t('vd.toast.cepik.err').replace('{0}', e.message));
    }
  },

  _addCard(vehId) {
    const v = (window.vehs||[]).find(x => x.id === vehId);
    if (!v) return;
    if (typeof openKartaModal === 'function') {
      openKartaModal(null);
      setTimeout(() => {
        const el = document.getElementById('km-nrrej');
        if (el) { el.value = v.nrRej; }
      }, 50);
    } else {
      toast(t('vd.toast.fleet.na'));
    }
  },

  _scanInvoice(vehId) {
    this.close();
    if (typeof showPage === 'function') showPage('faktury');
    toast(t('vd.toast.upload.hint'));
  },

  // ── OC → AC/Ass sync helpers ─────────────────────────────────────────────
  _syncOcAc(on) {
    const wrap = document.getElementById('vd-ac-fields');
    if (!wrap) return;
    wrap.style.opacity = on ? '.5' : '';
    wrap.style.pointerEvents = on ? 'none' : '';
    if (on) {
      const g = id => document.getElementById('vd-' + id)?.value || '';
      const s = id => { const el = document.getElementById('vd-' + id); if (el) el.value = g(id.replace('ac','oc').replace('Ac','Oc')); };
      document.getElementById('vd-acPolicyNo') && (document.getElementById('vd-acPolicyNo').value = g('ocPolicyNo'));
      document.getElementById('vd-acInsurer')  && (document.getElementById('vd-acInsurer').value  = g('ocInsurer'));
      document.getElementById('vd-acStart')    && (document.getElementById('vd-acStart').value    = g('ocStart'));
      document.getElementById('vd-acEnd')      && (document.getElementById('vd-acEnd').value      = g('ocEnd'));
    }
  },

  _syncOcAss(on) {
    const wrap = document.getElementById('vd-ass-fields');
    if (!wrap) return;
    wrap.style.opacity = on ? '.5' : '';
    wrap.style.pointerEvents = on ? 'none' : '';
    if (on) {
      const g = id => document.getElementById('vd-' + id)?.value || '';
      document.getElementById('vd-assPolicyNo') && (document.getElementById('vd-assPolicyNo').value = g('ocPolicyNo'));
      document.getElementById('vd-assInsurer')  && (document.getElementById('vd-assInsurer').value  = g('ocInsurer'));
      document.getElementById('vd-assEnd')      && (document.getElementById('vd-assEnd').value      = g('ocEnd'));
    }
  },

  // ── NIP lookup (MF Biała Lista) ───────────────────────────────────────────
  _nipLookup(nip, nameInputId, statusId) {
    const clean = (nip||'').replace(/[^0-9]/g,'');
    if (clean.length !== 10) return;
    const statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.textContent = 'Szukam...';
    const today = new Date().toISOString().slice(0,10);
    fetch(`https://wl.mf.gov.pl/api/check/nip/${clean}?date=${today}`)
      .then(r => r.ok ? r.json() : Promise.reject('http'))
      .then(data => {
        const name = data?.result?.subject?.name;
        if (name) {
          const el = document.getElementById(nameInputId);
          if (el) el.value = name;
          if (statusEl) statusEl.textContent = '✓ ' + name.slice(0,60);
        } else {
          if (statusEl) statusEl.textContent = 'Nie znaleziono w BL';
        }
      })
      .catch(() => { if (statusEl) statusEl.textContent = ''; });
  },

  _logAudit(action, vehId, changes) {
    try {
      const log = JSON.parse(localStorage.getItem('auditLog')||'[]');
      log.push({
        ts: new Date().toISOString(),
        uid: window.currentUser?.id || null,
        user: window.currentUser?.name || window.currentUser?.email || 'nieznany',
        action,
        vehId,
        changes: changes || {}
      });
      if (log.length > 3000) log.splice(0, log.length - 3000);
      localStorage.setItem('auditLog', JSON.stringify(log));
    } catch(e) {}
  },

  // ── DOT helpers ───────────────────────────────────────────────────────────
  _dotInfo(dot) {
    if (!dot || String(dot).length !== 4) return '';
    const s = String(dot);
    const week = parseInt(s.slice(0, 2));
    const yr   = parseInt('20' + s.slice(2, 4));
    if (isNaN(week) || isNaN(yr) || week < 1 || week > 53) return '';
    const age = new Date().getFullYear() - yr;
    const ageWarn = age >= 6 ? ' ⚠ opona stara!' : age >= 4 ? ' ⚡ zbliża się wymiana' : '';
    return `${week}. tydzień ${yr} r.${ageWarn}`;
  },

  _showDotInfo(input, infoId) {
    const el = document.getElementById(infoId);
    if (el) el.textContent = this._dotInfo(input.value);
  },

  _toggleTwinWheels(on) {
    ['vd-twin-RL','vd-twin-RR'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? '' : 'none';
    });
  },

  // ── Pola jednej opony ─────────────────────────────────────────────────────
  _tireFieldsHtml(pos, tire) {
    const dotInfo = this._dotInfo(tire.dot);
    return `<div class="vdfg">
      <div class="vdf">
        <label class="vdl">Rozmiar (np. 235/65 R16)</label>
        <input id="vd-tire${pos}_size" type="text" class="fi" value="${tire.size||''}" placeholder="205/55R16">
      </div>
      <div class="vdf">
        <label class="vdl">Marka / producent</label>
        <input id="vd-tire${pos}_brand" type="text" class="fi" value="${tire.brand||''}" placeholder="np. Michelin">
      </div>
      <div class="vdf">
        <label class="vdl">Rok DOT (4 cyfry, np. 3523)</label>
        <input id="vd-tire${pos}_dot" type="text" class="fi" maxlength="4" pattern="\\d{4}"
          value="${tire.dot||''}" placeholder="3523"
          oninput="TaxOrderVehicleDetail._showDotInfo(this,'vd-tire${pos}_dot_info')">
        <div id="vd-tire${pos}_dot_info" style="font-size:10px;color:var(--blue);margin-top:2px">${dotInfo}</div>
      </div>
      <div class="vdf">
        <label class="vdl">Bieżnik (mm)</label>
        <input id="vd-tire${pos}_depth" type="number" step="0.1" class="fi" value="${tire.depth||''}" placeholder="7.5">
      </div>
      <div class="vdf" style="grid-column:1/-1">
        <label class="vdl">Data ostatniej wymiany</label>
        <input id="vd-tire${pos}_changed" type="date" class="fi" value="${tire.changed||''}">
      </div>
    </div>`;
  },

  // ── OCR skanowanie dowodu ─────────────────────────────────────────────────
  _openOcrScan(vehId) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,.pdf,.heic,.heif,.tiff,.tif,.webp,.dng,.psd';
    inp.multiple = true;
    inp.onchange = async () => {
      if (!inp.files.length) return;
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9900;display:flex;align-items:center;justify-content:center';
      ov.innerHTML = `<div style="background:var(--bg2);border-radius:var(--radius-lg);padding:28px;width:540px;max-width:96vw;max-height:90vh;overflow-y:auto">
        <div style="font-size:15px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px"><i class="ti ti-scan" style="color:var(--blue)"></i>Skanowanie dokumentu</div>
        <div id="ocr-scan-progress" style="color:var(--text2);font-size:13px;margin-bottom:12px">Przetwarzanie ${inp.files.length} pliku/plików…</div>
        <div id="ocr-scan-result" style="font-size:12px;font-family:var(--mono);background:var(--bg3);border-radius:var(--radius);padding:12px;max-height:300px;overflow-y:auto;white-space:pre-wrap;margin-bottom:14px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Zamknij</button>
          <button id="ocr-fill-btn" class="btn btn-blue" style="display:none" onclick="TaxOrderVehicleDetail._fillFromOcr(${vehId},window._ocrExtracted);this.closest('[style*=fixed]').remove()">
            <i class="ti ti-check"></i>Wypełnij pola
          </button>
        </div>
      </div>`;
      document.body.appendChild(ov);

      let allText = '';
      const prog = document.getElementById('ocr-scan-progress');
      const res  = document.getElementById('ocr-scan-result');

      if (!window.Tesseract) {
        if (prog) prog.textContent = '⚠ Tesseract OCR nie jest załadowany';
        return;
      }

      for (let i = 0; i < inp.files.length; i++) {
        const file = inp.files[i];
        if (prog) prog.textContent = `OCR plik ${i+1}/${inp.files.length}: ${file.name}…`;
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        try {
          if (isPdf) {
            if (!window.pdfjsLib) throw new Error('PDF.js nie jest załadowany — odśwież stronę');
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            for (let p = 1; p <= pdfDoc.numPages; p++) {
              if (prog) prog.textContent = `PDF ${file.name}: renderowanie str. ${p}/${pdfDoc.numPages}…`;
              const page = await pdfDoc.getPage(p);
              const viewport = page.getViewport({scale: 2.5});
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
              if (prog) prog.textContent = `OCR str. ${p}/${pdfDoc.numPages}: ${file.name}…`;
              const result = await window.Tesseract.recognize(canvas, 'pol+eng', {
                logger: m => { if (m.status === 'recognizing text' && prog) prog.textContent = `PDF str. ${p}/${pdfDoc.numPages}: ${Math.round((m.progress||0)*100)}%`; }
              });
              allText += '\n' + result.data.text;
              if (res) res.textContent = allText.trim();
            }
          } else {
            const result = await window.Tesseract.recognize(file, 'pol+eng', {
              logger: m => { if (m.status === 'recognizing text' && prog) prog.textContent = `Plik ${i+1}/${inp.files.length}: ${Math.round((m.progress||0)*100)}%`; }
            });
            allText += '\n' + result.data.text;
            if (res) res.textContent = allText.trim();
          }
        } catch(e) {
          allText += `\n[Błąd: ${e.message}]`;
          if (res) res.textContent = allText.trim();
        }
      }

      window._ocrExtracted = this._parseOcrText(allText);
      if (prog) prog.textContent = '✅ OCR zakończony — przejrzyj wynik i kliknij "Wypełnij pola"';
      const fillBtn = document.getElementById('ocr-fill-btn');
      if (fillBtn && Object.keys(window._ocrExtracted).length) fillBtn.style.display = '';
    };
    inp.click();
  },

  _parseOcrText(text) {
    const found = {};
    const vinM = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    if (vinM) found.vin = vinM[1];
    const regM = text.match(/\b([A-Z]{2,3}\s?[A-Z0-9]{4,5})\b/);
    if (regM) found.nrRej = regM[1].replace(/\s/g,'');
    const dmcM = text.match(/F\.?1[:\s]*(\d{3,6})/i) || text.match(/DMC[:\s]*(\d{3,6})/i);
    if (dmcM) found.dmc = parseInt(dmcM[1]);
    const massM = text.match(/G[:\s]*(\d{3,6})/);
    if (massM) found.masaWlasna = parseInt(massM[1]);
    const axleM = text.match(/L[:\s]*(\d)/i);
    if (axleM) found.osie = parseInt(axleM[1]);
    const fuelM = text.match(/(diesel|benzyna|petrol|lpg|elektryczny|hybrid)/i);
    if (fuelM) found.paliwo = fuelM[1].toLowerCase();
    return found;
  },

  _fillFromOcr(vehId, data) {
    if (!data) return;
    const map = {
      vin:'vd-vin', nrRej:'vd-nrRej', paliwo:'vd-paliwo',
      dmc:'vd-dmcMax', dmcKg:'vd-dmcMax',
      masaWlasna:'vd-masaWlasna', masaWlKg:'vd-masaWlasna',
      dataRej:'vd-dataRej',
      kategoria:'vd-katPojazdu',
      homologacja:'vd-homologacja',
      marka:'vd-marka', model:'vd-model', rok:'vd-rok',
    };
    let filled = 0;
    Object.entries(map).forEach(([k, elId]) => {
      if (data[k] != null) {
        const el = document.getElementById(elId);
        if (el && !el.value) { el.value = data[k]; filled++; }
      }
    });
    toast(`✅ OCR: wypełniono ${filled} pól`);
  },
};

// ─── CEPiK helpers ────────────────────────────────────────────────────────────

function _cepikWojFromNrRej(nrRej) {
  const WOJ = {
    // 3-literowe prefiksy → kod województwa (2-cyfrowy)
    'WGM':'14','WWL':'14','WPR':'14','WAR':'14','WGS':'14',
    'GDA':'22','KRA':'12','WRO':'02','POZ':'30','LDZ':'10',
    // 2-literowe
    'WA':'14','WB':'14','WE':'14','WL':'14','WP':'14','WU':'14','WW':'14','WZ':'14',
    'GD':'22','KR':'12','WR':'02','PO':'30','LD':'10','LU':'06','LB':'08',
    'BI':'20','BK':'20','BL':'20','BY':'04','CB':'04','TO':'04',
    'EL':'10','KI':'26','KN':'12','OP':'16','RZ':'18','SK':'26','SL':'24','SZ':'32','ZG':'08',
  };
  const p = (nrRej || '').toUpperCase().replace(/[^A-Z]/g, '');
  return WOJ[p.slice(0,3)] || WOJ[p.slice(0,2)] || '14';
}

function _cepikMapToForm(a) {
  const FUEL = {
    'benzyna':'benzyna','olej napędowy':'olej napędowy','diesel':'olej napędowy',
    'gaz (lpg)':'LPG','lpg':'LPG','cng':'CNG','elektryczny':'elektryczny',
    'hybryda':'hybrydowy','hybryda plug-in':'hybrydowy PHEV',
  };
  const rawFuel = Array.isArray(a['rodzaj-paliwa']) ? a['rodzaj-paliwa'][0] : (a['rodzaj-paliwa'] || '');
  const paliwo  = FUEL[(rawFuel || '').toLowerCase()] || rawFuel;
  return {
    dataRej:     a['data-pierwszej-rejestracji-w-kraju']       || '',
    docWaznyDo:  a['data-waznosci-dowodu-rejestracyjnego']      || '',
    katPojazdu:  a['kategoria-pojazdu-wg-homologacji']          || '',
    dmcMax:      a['dopuszczalna-masa-calkowita']               || '',
    masaWlasna:  a['masa-wlasna']                              || '',
    pojSilnika:  a['pojemnosc-skokowa-silnika']                 || '',
    mocKW:       a['maksymalna-moc-netto-silnika']              || '',
    paliwo,
    miejscaSied: a['liczba-miejsc-siedzacych']                  || '',
    numerSilnika:a['numer-silnika']                             || '',
    kolorNadwozia:a['kolor']                                    || '',
  };
}
