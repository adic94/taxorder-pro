// ==================== VEHICLE DETAIL MODAL ====================
// Karta pojazdu z pełnymi danymi DR, leasingiem, archiwizacją, kartami flotowymi

// Wszystkie zakładki karty pojazdu — kolejność domyślna
const VD_TABS = [
  { id: 'dr',           label: '📋 DR',           i18n: 'vd.tab.dr' },
  { id: 'insurance',    label: '🛡 OC/AC/NNW',     i18n: 'vd.tab.insurance' },
  { id: 'badania',      label: '🔧 Badania',       i18n: 'vd.tab.badania' },
  { id: 'serwis',       label: '🔩 Serwis',        i18n: 'vd.tab.serwis' },
  { id: 'opony',        label: '⭕ Opony',          i18n: 'vd.tab.opony' },
  { id: 'eksploatacja', label: '⚙ Eksploatacja',  i18n: 'vd.tab.eksploatacja' },
  { id: 'koszty',       label: '⛽ Koszty',         i18n: 'vd.tab.koszty' },
  { id: 'ownership',    label: '🏢 Własność',      i18n: 'vd.tab.ownership' },
  { id: 'purchase',     label: '💰 Zakup/Zbycie',  i18n: 'vd.tab.purchase' },
  { id: 'archive',      label: '📦 Archiwum',      i18n: 'vd.tab.archive' },
  { id: 'notes',        label: '📝 Uwagi',          i18n: 'vd.tab.notes' },
  { id: 'dokumenty',    label: '📄 Dokumenty',     i18n: 'vd.tab.dokumenty' },
  { id: 'polisy',       label: '🛡 Polisy',         i18n: 'vd.tab.polisy' },
  { id: 'harmonogram',  label: '🔨 Harmonogram',   i18n: 'vd.tab.harmonogram' },
  { id: 'mandaty',      label: '🚨 Mandaty',       i18n: 'vd.tab.mandaty' },
  { id: 'gps',          label: '🗺 GPS',            i18n: 'vd.tab.gps' },
  { id: 'karty',        label: '💳 Karty',          i18n: 'vd.tab.karty' },
  { id: 'konserwacja',  label: '🔨 Konserwacja',   i18n: 'vd.tab.konserwacja' },
  { id: 'changelog',   label: '🕐 Historia zmian', i18n: 'vd.tab.changelog' },
];

// Mapowanie 5 super-zakładek na istniejące zakładki
const VD_SUPER_TABS = {
  przeglad:   ['dr', 'insurance', 'badania'],
  dokumenty:  ['dokumenty', 'polisy'],
  historia:   ['serwis', 'eksploatacja', 'opony', 'mandaty', 'changelog'],
  koszty:     ['koszty', 'ownership', 'purchase', 'harmonogram'],
  ustawienia: ['archive', 'notes', 'gps', 'karty', 'konserwacja'],
};
const VD_SUPER_LABELS = {
  przeglad:   { icon: 'ti-eye',      label: 'Przegląd'   },
  dokumenty:  { icon: 'ti-files',    label: 'Dokumenty'  },
  historia:   { icon: 'ti-history',  label: 'Historia'   },
  koszty:     { icon: 'ti-coins',    label: 'Koszty'     },
  ustawienia: { icon: 'ti-settings', label: 'Ustawienia' },
};

window.TaxOrderVehicleDetail = {

  open(vehId) {
    const v = vehs.find(x => x.id === vehId);
    if (!v) return;
    this._currentVehId = vehId;
    this._dirty = false;
    this._render(v);
    // Aktywuj super-tab (pamięta ostatnio wybrany) i aktywuj pierwszą zakładkę w grupie
    this._superTab(this._activeSuperTab || 'przeglad');
    document.getElementById('vd-modal').style.display = 'flex';
    setTimeout(() => this._initTabScroll(), 0);
    const nrRej = v.nrRej || v.nr_rej || '';
    if (nrRej) history.replaceState(null, '', '?veh=' + encodeURIComponent(nrRej));
  },

  close() {
    if (this._dirty && !confirm('Masz niezapisane zmiany. Zamknąć bez zapisania?')) return;
    this._dirty = false;
    if (this._vdCharts) { Object.values(this._vdCharts).forEach(c => { try { c.destroy(); } catch {} }); this._vdCharts = {}; }
    document.getElementById('vd-modal').style.display = 'none';
    history.replaceState(null, '', window.location.pathname);
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

    const _prevKm = v.stanKilometrow;
    const _AUDIT_FIELDS = ['marka','model','rok','vin','typ','dmcMax','paliwo','kierowca','stanKilometrow','normaSpalania','ocEnd','acEnd','nextInspection','status','ownership_type','miesiacePodatku','gmina','uwagi','leasingEnd','leasingRate','leasingCompany'];
    const _prevSnap = {};
    _AUDIT_FIELDS.forEach(f => { _prevSnap[f] = v[f]; });

    Object.assign(v, {
      // === IDENTYFIKACJA POJAZDU ===
      marka:                g('marka'),
      model:                g('model'),
      rok:                  gi('rok'),
      vin:                  g('vin'),
      typ:                  g('typ'),
      // === DOWÓD REJESTRACYJNY ===
      dataRejestracji:      g('dataRej'),          // B
      krajRejestracji:      g('krajRejestracji'),
      docDataWydania:       g('docDataWydania'),   // I
      docWaznyDo:           g('docWaznyDo'),        // H
      katPojazdu:           g('katPojazdu'),        // J
      homologacja:          g('homologacja'),       // K
      wariant:              g('wariant'),           // D.2 typ/wariant
      wersja:               g('wersja'),            // D.3 wersja handlowa
      przeznaczenie:        g('przeznaczenie'),
      dmcMax:               gi('dmcMax'),           // F.1
      dmc:                  gi('dmcMax'),           // sync dmc = dmcMax (form field)
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
      nrGwarancji:          g('nrGwarancji'),
      iloscZbiornikow:      gi('iloscZbiornikow'),
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
      assStart:      g('assStart'),
      assEnd:        g('assEnd'),
      assPremium:    gf('assPremium'),
      // === GAP ===
      gapPolicyNo:   g('gapPolicyNo'),
      gapInsurer:    g('gapInsurer'),
      gapStart:      g('gapStart'),
      gapEnd:        g('gapEnd'),
      gapPremium:    gf('gapPremium'),
      gapValue:      gf('gapValue'),
      // === Zielona Karta ===
      greenCardNo:     g('greenCardNo'),
      greenCardInsurer:g('greenCardInsurer'),
      greenCardEnd:    g('greenCardEnd'),
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
      assetCode:      g('assetCode'),
      kierowca:       g('kierowca'),
      stanKilometrow: gi('stanKilometrow'),
      kartaOrlen:     g('kartaOrlen'),
      normaSpalania:  gf('normaSpalania'),
      statusPojazdu:    g('statusPojazdu'),
      statusUzytkowania:g('statusUzytkowania'),
      nrFlotowy:        g('nrFlotowy'),
      euro:             g('euro'),
      co2:              gi('co2'),
      // === DANE OPERACYJNE (ZSI) ===
      orlenPin:              g('orlenPin'),
      nrWypisuLicencji:      g('nrWypisuLicencji'),
      nrBiznesowy:           g('nrBiznesowy'),
      idTekom:               g('idTekom'),
      depozyt:               g('depozyt'),
      przyczepaNrRej:        g('przyczepaNrRej'),
      viatoll:               gb('viatoll'),
      odpisVat:              gb('odpisVat'),
      hakHolowniczy:         gb('hakHolowniczy'),
      daneZTekom:            gb('daneZTekom'),
      nrEwidencyjny:         g('nrEwidencyjny'),
      kartaPaliwowa:         g('kartaPaliwowa'),
      nrRFID:                g('nrRFID'),
      gpsDeviceSerial:       g('gpsDeviceSerial'),
      pinUrzadzenia:         g('pinUrzadzenia'),
      tid:                   g('tid'),
      mpkKonto:              g('mpkKonto'),
      grupaPojazdow:         g('grupaPojazdow'),
      podtypPojazdu:         g('podtypPojazdu'),
      wlascicielPojazdu:     g('wlascicielPojazdu'),
      opiekun:               g('opiekun'),
      obszarPojazdu:         g('obszarPojazdu'),
      pojazdUprzywilejowany: gb('pojazdUprzywilejowany'),
      pojazdKluczykowy:      gb('pojazdKluczykowy'),
      autostrady:            gb('autostrady'),
      uzytekPrywatny:        gb('uzytekPrywatny'),
      pojazdGPS:             gb('pojazdGPS'),
      przewozWlasny:         gb('przewozWlasny'),
      rejestracjaEtoll:      gb('rejestracjaEtoll'),
      wysylanieEtoll:        gb('wysylanieEtoll'),
      // === SERWISOWANIE OLEJU ===
      lastOilChangeKm:       gi('lastOilChangeKm'),
      oilChangeInterval:     gi('oilChangeInterval'),
      oilChangeRemainingKm:  gi('oilChangeRemainingKm'),
      // === PARAMETRY SPECJALISTYCZNE ===
      rodzajSamochodu:        g('rodzajSamochodu'),
      pojemnoscZbiornikaNaWode:   gi('pojemnoscZbiornikaNaWode'),
      pojemnoscZbiornikaNaScieke: gi('pojemnoscZbiornikaNaScieke'),
      iloscKabin:             gi('iloscKabin'),
      iloscKontenerow:        gi('iloscKontenerow'),
      obrotJalowy:            gi('obrotJalowy'),
      predkoscMaks:           gi('predkoscMaks'),
      przewoziKabiny:         gb('przewoziKabiny'),
      przewoziKontenery:      gb('przewoziKontenery'),
      przewoziOgrodzenia:     gb('przewoziOgrodzenia'),
      // === OZNACZENIA OSI ===
      konfiguracjaOsi:      g('konfiguracjaOsi'),
      // === WYPOSAŻENIE POJAZDU ===
      skrzyniaBiegow:       g('skrzyniaBiegow'),
      liczbaBiegow:         gi('liczbaBiegow'),
      klimatyzacja:         g('klimatyzacja'),
      kameraCofa:           gb('kameraCofa'),
      czujnikiPark:         g('czujnikiPark'),
      tempomatTyp:          g('tempomatTyp'),
      adasSystemy:          g('adasSystemy'),
      dashcam:              gb('dashcam'),
      hakNosnosc:           gi('hakNosnosc'),
      alkolock:             gb('alkolock'),
      nagrzewnicaPostojowa: gb('nagrzewnicaPostojowa'),
      nagrzewnicaMarka:     g('nagrzewnicaMarka'),
      // === ADBLUE / DPF ===
      pojemnoscAdblue:      gf('pojemnoscAdblue'),
      adblueOstatniData:    g('adblueOstatniData'),
      adblueOstatniKm:      gi('adblueOstatniKm'),
      dpfDataRegeneracji:   g('dpfDataRegeneracji'),
      dpfDataWymiany:       g('dpfDataWymiany'),
      dpfKmWymiany:         gi('dpfKmWymiany'),
      // === ADR / CERTYFIKATY ===
      hasAdr:                    gb('hasAdr'),
      adrKlasa:                  g('adrKlasa'),
      adrNrSwiadectwa:           g('adrNrSwiadectwa'),
      adrDataWaznosci:           g('adrDataWaznosci'),
      hasAtpCert:                gb('hasAtpCert'),
      atpKlasa:                  g('atpKlasa'),
      atpDataWaznosci:           g('atpDataWaznosci'),
      certSanitarnyNr:           g('certSanitarnyNr'),
      certSanitarnyData:         g('certSanitarnyData'),
      licencjaTransportowaNr:    g('licencjaTransportowaNr'),
      licencjaTransportowaData:  g('licencjaTransportowaData'),
      zezwoleniePonadgabarytowe: g('zezwoleniePonadgabarytowe'),
      // === BEZPIECZEŃSTWO ===
      gaznicaDataWaznosci:   g('gaznicaDataWaznosci'),
      apteczkaDataWaznosci:  g('apteczkaDataWaznosci'),
      trojkatOstrzegawczy:   gb('trojkatOstrzegawczy'),
      kamizelki:             gi('kamizelki'),
      kliny:                 gi('kliny'),
      // === FINANSOWE / WARTOŚĆ ===
      wartoscRynkowa:        gf('wartoscRynkowa'),
      wartoscUbezpieczeniowa:gf('wartoscUbezpieczeniowa'),
      wartoscKsiegowaNetto:  gf('wartoscKsiegowaNetto'),
      stawkaAmortyzacji:     gf('stawkaAmortyzacji'),
      szacowanyKosztMies:    gf('szacowanyKosztMies'),
      nrSrodkaTrwalego:      g('nrSrodkaTrwalego'),
      // === ZABUDOWA SPECJALISTYCZNA ===
      markaZabudowy:         g('markaZabudowy'),
      rokZabudowy:           gi('rokZabudowy'),
      nrFabrycznyZabudowy:   g('nrFabrycznyZabudowy'),
      dataOstatnejDezynfekcji: g('dataOstatnejDezynfekcji'),
      typPompy:              g('typPompy'),
      strefyObslugi:         g('strefyObslugi'),
      // === POJEMNOŚĆ BAKÓW ===
      pojemnoscBaku1:        gf('pojemnoscBaku1'),
      nazwaBaku1:            g('nazwaBaku1'),
      pojemnoscBaku2:        gf('pojemnoscBaku2'),
      nazwaBaku2:            g('nazwaBaku2'),
      // === KLIMATYZACJA — SERWIS ===
      dataSerwisuKlimy:      g('dataSerwisuKlimy'),
      rodzajCzynnikalOCH:    g('rodzajCzynnikalOCH'),
      iloscCzynnikalOCH:     gf('iloscCzynnikalOCH'),
      // === SERWIS TECHNIKALIA ===
      roztrzadDataWymiany:   g('roztrzadDataWymiany'),
      roztrzadKmWymiany:     gi('roztrzadKmWymiany'),
      sprzegloKmWymiany:     gi('sprzegloKmWymiany'),
      plynHamDataWymiany:    g('plynHamDataWymiany'),
      plynChlodDataWymiany:  g('plynChlodDataWymiany'),
      akumulatorRokWymiany:  gi('akumulatorRokWymiany'),
      filtrPowietrzaKm:      gi('filtrPowietrzaKm'),
      filtrKabinyKm:         gi('filtrKabinyKm'),
      filtrPaliwaKm:         gi('filtrPaliwaKm'),
      // === EV / HYBRYDA ===
      pojemnoscBaterii:      gf('pojemnoscBaterii'),
      zasiegWLTP:            gi('zasiegWLTP'),
      zlaczeLadowania:       g('zlaczeLadowania'),
      mocLadowaniaAC:        gf('mocLadowaniaAC'),
      mocLadowaniaDC:        gf('mocLadowaniaDC'),
      stanBateriiSoH:        gf('stanBateriiSoH'),
      dataWymianiBaterii:    g('dataWymianiBaterii'),
      // === PODWOZIE / HAMULCE ===
      typZawieszenia:        g('typZawieszenia'),
      typHamulcow:           g('typHamulcow'),
      cisnRoboczeZbiornika:  gf('cisnRoboczeZbiornika'),
      wydajnoscPompy:        gf('wydajnoscPompy'),
      // === SERWIS — KONTAKT ===
      serwisNazwa:           g('serwisNazwa'),
      serwisTelefon:         g('serwisTelefon'),
      serwisAdres:           g('serwisAdres'),
      serwisGwarancyjny:     gb('serwisGwarancyjny'),
      // === KIEROWCA — PRAWO JAZDY / CEPiK ===
      kierowcaImie:          g('kierowcaImie'),
      kierowcaNazwisko:      g('kierowcaNazwisko'),
      kierowcaKategorieJazdy:g('kierowcaKategorieJazdy'),
      kierowcaNrPrawJazdy:   g('kierowcaNrPrawJazdy'),
      kierowcaDataWaznPJ:    g('kierowcaDataWaznPJ'),
      cepikStatus:           v.cepikStatus ?? null,
      cepikLastCheck:        v.cepikLastCheck ?? null,
      cepikKategorie:        v.cepikKategorie ?? null,
      // === WERYFIKACJA LOKALIZACJI ===
      ostatniePotwierdzenieLokal: g('ostatniePotwierdzenieLokal'),
      osobaPotwierdzajaca:        g('osobaPotwierdzajaca'),
      iloscTagow:                 gi('iloscTagow'),
      // === WŁASNOŚĆ ===
      ownership_type:    g('ownershipType'),
      leasingCompany:      g('leasingCompany'),
      leasingUser:         g('leasingUser'),
      leasingContractNo:   g('leasingContractNo'),
      leasingType:         g('leasingType'),
      leasingStart:        g('leasingStart'),
      leasingEnd:          g('leasingEnd'),
      leasingRate:         gf('leasingRate'),
      leasingBuyout:       gf('leasingBuyout'),
      leasingResidual:     gf('leasingResidual'),
      leasingKmLimit:      gi('leasingKmLimit'),
      leasingGapRequired:  gb('leasingGapRequired'),
      leasingLessorRef:    g('leasingLessorRef'),
      rentalCompany:       g('rentalCompany'),
      rentalStart:         g('rentalStart'),
      rentalEnd:           g('rentalEnd'),
      rentalRate:          gf('rentalRate'),
      rentalDeposit:       gf('rentalDeposit'),
      rentalPolicyNo:      g('rentalPolicyNo'),
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
      branch_id: gi('branchId'),
      uwagi: g('uwagi'),
      // === PODATEK DT-1 ===
      gmina:           g('gmina') || 'Warszawa',
      miesiacePodatku: gi('miesiacePodatku') ?? 12,
    });

    // Historia przebiegu km — zapisz punkt jeśli km wzrósł lub zmienił się
    if (v.stanKilometrow != null && v.stanKilometrow > 0) {
      if (!Array.isArray(v.kmHistory)) v.kmHistory = [];
      const today = new Date().toISOString().slice(0, 10);
      const last  = v.kmHistory[v.kmHistory.length - 1];
      if (_prevKm == null || v.stanKilometrow !== _prevKm) {
        if (!last || last.date !== today || last.km !== v.stanKilometrow) {
          v.kmHistory.push({ date: today, km: v.stanKilometrow });
        }
      }
    }

    // Walidacja pól technicznych
    const _typ = (v.typ||'').toLowerCase();
    const _isPrzyczepa = _typ.includes('przy') || _typ.includes('nacz');
    if (!_isPrzyczepa && v.dmcMax && (v.dmcMax < 100 || v.dmcMax > 200000)) {
      if (!confirm(`DMC (F.1) wynosi ${v.dmcMax} kg — czy to prawidłowa wartość?`)) return;
    }
    if (v.rok && (v.rok < 1900 || v.rok > new Date().getFullYear() + 1)) {
      toast(`⚠ Rok produkcji ${v.rok} wydaje się nieprawidłowy — oczekiwany zakres 1900–${new Date().getFullYear() + 1}`);
      return;
    }
    if (!_isPrzyczepa && !v.kierowca && v.is_active !== false) {
      toast('⚠ Brak przypisanego kierowcy — zaktualizuj w zakładce Eksploatacja');
    }

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

    // Audit trail — per-vehicle changelog with field diffs
    const _diffs = [];
    _AUDIT_FIELDS.forEach(f => {
      const oldVal = _prevSnap[f], newVal = v[f];
      if (String(oldVal ?? '') !== String(newVal ?? '')) _diffs.push({ field: f, old: oldVal ?? null, new: newVal ?? null });
    });
    if (!Array.isArray(v.changeLog)) v.changeLog = [];
    v.changeLog.push({
      ts: new Date().toISOString(),
      user: window.currentUser?.name || window.currentUser?.email || 'nieznany',
      fields: _diffs,
    });
    if (v.changeLog.length > 200) v.changeLog.splice(0, v.changeLog.length - 200);
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
    this._dirty = false;
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
        <input id="vd-${id}" type="${type}" class="fi" value="${esc(val) ?? ''}" autocomplete="off">
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
          <div style="font-size:18px;font-weight:700;font-family:var(--mono)">${esc(v.nrRej)}</div>
          <div style="font-size:13px;color:var(--text2)">${esc(v.marka)} ${esc(v.model)} · ${esc(v.rok || '—')} · ${esc(v.vin || '—')}</div>
        </div>
        ${isArchived ? '<span class="pill pill-red" style="margin-left:auto">ARCHIWUM</span>' : ''}
        <div style="display:flex;align-items:center;gap:8px;${isArchived?'':'margin-left:auto'}">
          ${v.cepikSyncStatus === 'ok' ? '<span class="pill pill-green" style="font-size:10px">CEPiK ✓</span>' :
            v.cepikSyncStatus === 'never' ? '' :
            '<span class="pill pill-amber" style="font-size:10px">CEPiK sync</span>'}
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" onclick="TaxOrderVehicleDetail.printCard()">
            <i class="ti ti-printer"></i>Drukuj kartę
          </button>
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" onclick="TaxOrderVehicleDetail.printQr(${v.id})" title="Drukuj kartę QR pojazdu">
            <i class="ti ti-qrcode"></i>QR
          </button>
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" title="Kopiuj link do pojazdu" data-nrrej="${esc(v.nrRej)}" onclick="TaxOrderVehicleDetail._copyLink(this.dataset.nrrej)">
            <i class="ti ti-link"></i>Link
          </button>
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" data-nrrej="${esc(v.nrRej)}" onclick="TaxOrderDamages.openModal(null, this.dataset.nrrej)">
            <i class="ti ti-alert-triangle"></i>Zgłoś szkodę
          </button>
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" data-nrrej="${esc(v.nrRej)}" onclick="TaxOrderServiceOrders.openModal(null, this.dataset.nrrej)">
            <i class="ti ti-clipboard-list"></i>Zlecenie serwisowe
          </button>
          <button class="btn btn-gray" style="font-size:11px;padding:5px 10px" data-nrrej="${esc(v.nrRej)}" onclick="TaxOrderHandoverProtocol.openModal(null, this.dataset.nrrej)">
            <i class="ti ti-file-signature"></i>Protokół
          </button>
        </div>
      </div>

      <!-- SUPER-TABS: 5 głównych grup -->
      <div id="vd-super-tabs" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
        ${this._renderSuperTabs()}
      </div>

      <!-- TABS — scrollowane z przyciskami nawigacji -->
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
        <div style="position:relative;flex:1;min-width:0">
          <button id="vd-tabs-prev" onclick="TaxOrderVehicleDetail._scrollTabs(-1)"
            style="position:absolute;left:0;top:0;bottom:0;z-index:2;border:none;background:linear-gradient(to right,var(--bg3) 55%,transparent);padding:0 14px 0 4px;cursor:pointer;display:none;align-items:center;border-radius:var(--radius) 0 0 var(--radius)">
            <i class="ti ti-chevron-left" style="font-size:14px;color:var(--text2)"></i>
          </button>
          <div id="vd-tabs" style="display:flex;gap:2px;background:var(--bg3);border-radius:var(--radius);padding:3px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none">
          ${(() => {
            const cfg = this._getVdTabsCfg();
            const firstVisible = cfg.order.find(id => !cfg.hidden.includes(id));
            return cfg.order.map((id, i) => {
              const tabDef = VD_TABS.find(x => x.id === id);
              if (!tabDef) return '';
              const label = window.t ? (window.t(tabDef.i18n) !== tabDef.i18n ? window.t(tabDef.i18n) : tabDef.label) : tabDef.label;
              const isFirst = id === firstVisible;
              const hidden = cfg.hidden.includes(id);
              return `<button onclick="TaxOrderVehicleDetail._tab('${id}')" id="vd-tab-${id}"
                style="flex-shrink:0;padding:6px 10px;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-weight:500;white-space:nowrap;order:${i};
                display:${hidden ? 'none' : 'inline-flex'};align-items:center;
                background:${isFirst ? 'var(--bg)' : 'transparent'};color:${isFirst ? 'var(--text)' : 'var(--text2)'}">
                ${label}
              </button>`;
            }).join('');
          })()}
          </div>
          <button id="vd-tabs-next" onclick="TaxOrderVehicleDetail._scrollTabs(1)"
            style="position:absolute;right:0;top:0;bottom:0;z-index:2;border:none;background:linear-gradient(to left,var(--bg3) 55%,transparent);padding:0 4px 0 14px;cursor:pointer;display:none;align-items:center;border-radius:0 var(--radius) var(--radius) 0">
            <i class="ti ti-chevron-right" style="font-size:14px;color:var(--text2)"></i>
          </button>
        </div>
        <button onclick="TaxOrderVehicleDetail.openVdTabsCfg()" title="Dostosuj zakładki"
          style="flex-shrink:0;background:var(--bg3);border:none;border-radius:var(--radius);width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text3)">
          <i class="ti ti-settings" style="font-size:14px"></i>
        </button>
      </div>
      <div style="margin-bottom:16px"></div>

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
        <!-- Drop zone: wgraj PDF DR bezpośrednio w karcie pojazdu -->
        <div id="vd-dr-dropzone"
          ondragover="event.preventDefault();this.style.borderColor='var(--blue)';this.style.background='var(--blue-light,#eff6ff)'"
          ondragleave="this.style.borderColor='var(--border2)';this.style.background=''"
          ondrop="event.preventDefault();this.style.borderColor='var(--border2)';this.style.background='';(function(f,vid){AztecScanner.open(vid);if(f)AztecScanner._handleFile(f).then(()=>TaxOrderVehicleDetail._refreshDrView(vid))})(event.dataTransfer.files[0],${v.id})"
          style="border:1.5px dashed var(--border2);border-radius:var(--radius-lg,10px);padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:all .15s;font-size:12px;color:var(--text2)"
          onclick="document.getElementById('vd-dr-file-${v.id}').click()">
          <i class="ti ti-file-upload" style="font-size:18px;flex-shrink:0;color:var(--text3)"></i>
          <span>Przeciągnij PDF dowodu rejestracyjnego lub <u style="color:var(--blue);cursor:pointer">kliknij aby wybrać</u></span>
          <input type="file" id="vd-dr-file-${v.id}" accept="image/*,application/pdf,.pdf" style="display:none"
            onchange="(function(f,vid){AztecScanner.open(vid);if(f)AztecScanner._handleFile(f).then(()=>TaxOrderVehicleDetail._refreshDrView(vid))})(this.files[0],${v.id})">
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Identyfikacja pojazdu</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('marka','D.1 — Marka', v.marka)}
          ${field('model','Model', v.model)}
          ${field('rok','Rok produkcji', v.rok,'number')}
          ${field('vin','E — VIN / nr identyfikacyjny', v.vin)}
          ${field('typ','Typ pojazdu', v.typ)}
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Identyfikacja dokumentu</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('dataRej','B — Data 1. rej. w Polsce', v.dataRejestracji,'date')}
          ${field('krajRejestracji','Kraj rejestracji', v.krajRejestracji,undefined,'np. Polska, Litwa…')}
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
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Konfiguracja osi</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${sel('konfiguracjaOsi','Oznaczenie osi (układ napędowy)',[
            ['','— nie określono —'],
            ['4x2','4×2 — solówka / ciągnik siodłowy (1 oś napędowa, 1 skrętna)'],
            ['4x4','4×4 — napęd na 4 koła (PSP, terenowe, lekkie wywrotki)'],
            ['6x2','6×2 — 3 osie, 1 napędowa, tylna wleczona nieskrętna'],
            ['6x2*4','6×2*4 — ostatnia oś wleczona SKRĘTNA (śmieciarka, dystrybucja)'],
            ['6x2/4','6×2/4 — oś pchana przed napędem skrętna (ciągniki UK)'],
            ['6x4','6×4 — klasyczny budowlany: 2 tylne napędowe (wywrotki, gruszki)'],
            ['6x6','6×6 — pełny napęd terenowy (wojsko, energetyka)'],
            ['8x2/4','8×2/4 — 4 osie, 2 przednie skrętne, 1 napędowa, 1 wleczona'],
            ['8x2*6','8×2*6 — 3 osie skrętne, żurawie HDS miejskie (Scania G500)'],
            ['8x4','8×4 — standardowa wywrotka 4-osiowa (2 napędowe z tyłu)'],
            ['8x4/4','8×4/4 — 8×4 z 4 kołami sterowanymi z przodu'],
            ['8x4*4','8×4*4 — tridem: ostatnia oś wleczona skrętna, dobra zwrotność'],
            ['8x8','8×8 — pełny napęd, pojazdy pustyniowe / kopalniane'],
            ['10x4','10×4 — 5 osi, pompy do betonu powyżej 50 m'],
            ['10x4*6','10×4*6 — ciężkie tridem, ostatnia oś skrętna'],
            ['10x6*4','10×6*4 — 3 osie napędowe, 2 skrętne'],
            ['10x6*2','10×6*2 — spec. holenderskie (Ginaf, Terberg), kopalniane'],
          ], v.konfiguracjaOsi||'')}
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Silnik i nadwozie</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('pojSilnika','P.1 — Pojemność silnika (cm³)', v.pojSilnika,'number')}
          ${field('mocKW','P.2 — Moc (kW)', v.mocKW,'number')}
          ${field('paliwo','P.3 — Rodzaj paliwa', v.paliwo)}
          ${field('iloscZbiornikow','Liczba zbiorników paliwa', v.iloscZbiornikow,'number')}
          ${field('pojemnoscBaku1','Pojemność baku głównego (l)', v.pojemnoscBaku1,'number')}
          ${field('nazwaBaku1','Nazwa baku głównego', v.nazwaBaku1,undefined,'np. główny, dieselowy…')}
          ${field('pojemnoscBaku2','Pojemność baku dodatkowego (l)', v.pojemnoscBaku2,'number')}
          ${field('nazwaBaku2','Nazwa baku dodatkowego', v.nazwaBaku2,undefined,'np. AdBlue, LPG, zapasowy…')}
          ${field('numerSilnika','Nr silnika', v.numerSilnika)}
          ${field('nrGwarancji','Nr karty gwarancyjnej', v.nrGwarancji)}
          ${field('kolorNadwozia','Kolor nadwozia', v.kolorNadwozia)}
          ${sel('skrzyniaBiegow','Skrzynia biegów',[
            ['','— nie określono —'],
            ['manualna','Manualna'],
            ['automatyczna','Automatyczna (AT)'],
            ['robotizowana','Zautomatyzowana (AMT/ASG)'],
            ['cvt','Bezstopniowa (CVT)'],
            ['dwusprzegłowa','Dwusprzęgłowa (DSG/DCT)'],
          ], v.skrzyniaBiegow||'')}
          ${field('liczbaBiegow','Liczba biegów', v.liczbaBiegow,'number')}
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
              <label class="vdl">Gmina (stawki) <span style="font-weight:400;font-size:10px;color:var(--text3)">— zacznij pisać</span></label>
              <input type="text" id="vd-gmina" class="fi" autocomplete="off"
                value="${esc(v.gmina||'Warszawa')}"
                placeholder="Wpisz nazwę gminy…"
                onfocus="TaxOrderVehicleDetail._attachTerytGmina(this,${v.id})"
                onchange="document.getElementById('vd-dt1-box').innerHTML=TaxOrderVehicleDetail._renderDt1BoxFromForm(${v.id})">
            </div>
            <div class="vdf">
              <label class="vdl">Miesiące podatkowe
                <span style="font-weight:400;font-size:10px;color:var(--text3)">(z dat: nabycia, zbycia, wycofania)</span>
              </label>
              <div style="display:flex;gap:6px;align-items:center">
                <input type="number" id="vd-miesiacePodatku" class="fi" min="1" max="12"
                  value="${v.miesiacePodatku??12}" style="flex:1"
                  onchange="document.getElementById('vd-dt1-box').innerHTML=TaxOrderVehicleDetail._renderDt1BoxFromForm(${v.id})">
                <button type="button" class="btn btn-gray" style="padding:4px 8px;font-size:11px;white-space:nowrap"
                  title="Oblicz automatycznie z dat nabycia, zbycia i wycofania z ruchu"
                  onclick="TaxOrderVehicleDetail._autoCalcMiesiace(${v.id})">
                  <i class="ti ti-calculator"></i>Auto
                </button>
              </div>
              <div id="vd-miesiace-hint" style="font-size:10px;color:var(--text3);margin-top:2px"></div>
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
        <div style="margin-bottom:18px">
          <button class="btn btn-gray" style="font-size:11px" onclick="window.open('https://www.ufg.pl/inf_o_ubezpieczeniu/','_blank')" title="Sprawdź ubezpieczenie OC w UFG">
            <i class="ti ti-external-link" style="color:#059669"></i>Weryfikuj OC w UFG
          </button>
          <span style="font-size:10px;color:var(--text3);margin-left:8px">Otwiera portal UFG — wpisz nr rej: <strong style="font-family:var(--mono)">${esc(v.nrRej||'')}</strong></span>
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
          ${field('assStart','Początek Assistance', v.ocCoversAss ? (v.ocStart||v.assStart) : v.assStart,'date')}
          ${field('assEnd','Ważność Assistance do', v.ocCoversAss ? (v.ocEnd||v.assEnd) : v.assEnd,'date')}
          ${field('assPremium','Składka Assistance (zł)', v.assPremium,'number')}
        </div>

        <div style="font-size:12px;font-weight:600;color:var(--red);margin-top:20px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-shield-x"></i> GAP — Gwarantowana Różnica Wartości
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Ubezpieczenie GAP pokrywa różnicę między wartością rynkową a wartością kredytu/leasingu w razie szkody całkowitej.</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('gapPolicyNo','Nr polisy GAP', v.gapPolicyNo)}
          ${field('gapInsurer','Ubezpieczyciel GAP', v.gapInsurer)}
          ${field('gapStart','Początek GAP', v.gapStart,'date')}
          ${field('gapEnd','Koniec GAP', v.gapEnd,'date')}
          ${field('gapPremium','Składka GAP (zł)', v.gapPremium,'number')}
          ${field('gapValue','Wartość objęta GAP (zł)', v.gapValue,'number')}
        </div>

        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-world"></i> Zielona Karta — ubezpieczenie zagraniczne
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Dokument potwierdzający posiadanie OC przy wyjazdach za granicę.</div>
        <div class="vdfg">
          ${field('greenCardNo','Nr Zielonej Karty', v.greenCardNo)}
          ${field('greenCardInsurer','Ubezpieczyciel ZK', v.greenCardInsurer)}
          ${field('greenCardEnd','Ważność Zielonej Karty do', v.greenCardEnd,'date')}
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

        <!-- ADR -->
        <div style="font-size:12px;font-weight:600;color:var(--amber);margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-flame"></i> ADR — Przewóz materiałów niebezpiecznych
        </div>
        <div style="margin-bottom:12px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;padding:10px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
            <input type="checkbox" id="vd-hasAdr" ${v.hasAdr?'checked':''} onchange="document.getElementById('vd-adr-fields').style.display=this.checked?'':'none'">
            <span>Pojazd posiada certyfikat ADR</span>
          </label>
        </div>
        <div id="vd-adr-fields" ${v.hasAdr?'':'style="display:none"'}>
          <div class="vdfg" style="margin-bottom:10px">
            ${sel('adrKlasa','Klasa ADR',[
              ['','— wybierz klasę —'],
              ['1','Klasa 1 — Materiały wybuchowe'],
              ['2','Klasa 2 — Gazy'],
              ['3','Klasa 3 — Ciecze zapalne'],
              ['4.1','Klasa 4.1 — Ciała stałe zapalne'],
              ['4.2','Klasa 4.2 — Substancje samozapalne'],
              ['5.1','Klasa 5.1 — Substancje utleniające'],
              ['6.1','Klasa 6.1 — Substancje toksyczne'],
              ['6.2','Klasa 6.2 — Substancje zakaźne'],
              ['7','Klasa 7 — Materiały promieniotwórcze'],
              ['8','Klasa 8 — Substancje żrące'],
              ['9','Klasa 9 — Różne substancje niebezpieczne'],
            ], v.adrKlasa||'')}
            ${field('adrNrSwiadectwa','Nr świadectwa dopuszczenia ADR', v.adrNrSwiadectwa)}
            ${field('adrDataWaznosci','Data ważności certyfikatu ADR', v.adrDataWaznosci,'date')}
          </div>
        </div>

        <!-- Certyfikaty specjalne -->
        <div style="font-size:12px;font-weight:600;color:var(--blue);margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-certificate"></i> Certyfikaty i licencje
        </div>
        <div style="margin-bottom:10px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;padding:10px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
            <input type="checkbox" id="vd-hasAtpCert" ${v.hasAtpCert?'checked':''} onchange="document.getElementById('vd-atp-fields').style.display=this.checked?'':'none'">
            <span>Certyfikat ATP — transport chłodniczy</span>
          </label>
        </div>
        <div id="vd-atp-fields" ${v.hasAtpCert?'':'style="display:none"'}>
          <div class="vdfg" style="margin-bottom:10px">
            ${sel('atpKlasa','Klasa ATP',[
              ['','— wybierz —'],
              ['FRC','FRC — Izotermiczny mroźny'],
              ['FNA','FNA — Izotermiczny chłodzony'],
              ['IRC','IRC — Normalna izotermia'],
            ], v.atpKlasa||'')}
            ${field('atpDataWaznosci','Data ważności certyfikatu ATP', v.atpDataWaznosci,'date')}
          </div>
        </div>
        <div class="vdfg" style="margin-bottom:10px">
          ${field('certSanitarnyNr','Nr certyfikatu sanitarnego', v.certSanitarnyNr)}
          ${field('certSanitarnyData','Data ważności certyfikatu sanitarnego', v.certSanitarnyData,'date')}
          ${field('licencjaTransportowaNr','Nr licencji transportowej', v.licencjaTransportowaNr)}
          ${field('licencjaTransportowaData','Data ważności licencji transportowej', v.licencjaTransportowaData,'date')}
          ${field('zezwoleniePonadgabarytowe','Zezwolenie na przewóz nienormatywny (kategoria)', v.zezwoleniePonadgabarytowe,undefined,'np. I, II, III, IV…')}
        </div>

        <!-- Bezpieczeństwo — wyposażenie ratunkowe -->
        <div style="font-size:12px;font-weight:600;color:var(--red);margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-first-aid-kit"></i> Wyposażenie ratunkowe i bezpieczeństwo
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          ${field('gaznicaDataWaznosci','Gaśnica — data legalizacji / ważności', v.gaznicaDataWaznosci,'date')}
          ${field('apteczkaDataWaznosci','Apteczka — data ważności', v.apteczkaDataWaznosci,'date')}
          ${field('kamizelki','Kamizelki odblaskowe (szt.)', v.kamizelki,'number')}
          ${field('kliny','Kliny pod koła (szt.)', v.kliny,'number')}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;padding:7px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border);white-space:nowrap">
            <input type="checkbox" id="vd-trojkatOstrzegawczy" ${v.trojkatOstrzegawczy?'checked':''}> <i class="ti ti-triangle" style="font-size:13px;color:var(--text3)"></i>Trójkąt ostrzegawczy
          </label>
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
                value="${esc(v.tireSP?.dot||'')}" placeholder="3523"
                oninput="TaxOrderVehicleDetail._showDotInfo(this,'vd-tireSP_dot_info')">
              <div id="vd-tireSP_dot_info" style="font-size:10px;color:var(--blue);margin-top:2px">${TaxOrderVehicleDetail._dotInfo(v.tireSP?.dot)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB: EKSPLOATACJA -->
      <div id="vd-tab-eksploatacja-content" class="vd-tab-content" style="display:none">
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Oddział floty</div>
        <div class="vdfg" style="margin-bottom:18px">
          <div class="vdf">
            <label class="vdl">Oddział
              <span style="font-size:10px;color:var(--blue);cursor:pointer;margin-left:6px" onclick="showPage('oddzialy')" title="Zarządzaj oddziałami">&#9881; zarządzaj</span>
            </label>
            <select id="vd-branchId" class="fi">
              <option value="">— brak oddziału —</option>
              ${(window._branches||[]).map(b=>`<option value="${b.id}" ${b.id==v.branch_id?'selected':''}>${esc(b.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Kierowca i licznik</div>
        <div class="vdfg" style="margin-bottom:18px">
          <div class="vdf">
            <label class="vdl">Przypisany kierowca
              <span style="font-size:10px;color:var(--blue);cursor:pointer;margin-left:6px" onclick="TaxOrderDrivers.open()" title="Zarządzaj kierowcami">&#9881; kartoteka</span>
            </label>
            <input id="vd-kierowca" type="text" class="fi" value="${esc(v.kierowca??'')}" autocomplete="off" list="drivers-datalist" placeholder="Wybierz lub wpisz...">
          </div>
          ${field('stanKilometrow','Stan licznika (km)', v.stanKilometrow,'number')}
          ${field('kartaOrlen','Nr karty flotowej / paliwa', v.kartaOrlen)}
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Status i identyfikacja</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${sel('statusPojazdu','Status pojazdu',[
            ['dostepny','✅ Dostępny'],
            ['w_serwisie','🔧 W serwisie'],
            ['w_delegacji','🚗 W delegacji / wynajęty'],
            ['remont','⚠️ Remont / wyłączony'],
            ['zlomowanie','🗑️ Do złomowania'],
            ['zatrzymany','🚫 Zatrzymany / zajęty'],
          ], v.statusPojazdu||'dostepny')}
          ${field('nrFlotowy','Nr flotowy / wewnętrzny', v.nrFlotowy, 'text', '(własny nr identyf. w flocie, np. F-001)')}
          ${field('assetCode','Kod środka trwałego (AssetCode)', v.assetCode, 'text', '(np. ST000001)')}
          ${field('normaSpalania','Norma spalania (l/100km)', v.normaSpalania,'number')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--blue);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">
          <i class="ti ti-license" style="font-size:13px"></i> Kierowca — prawo jazdy i weryfikacja CEPiK
        </div>
        <div class="vdfg" style="margin-bottom:12px">
          ${field('kierowcaImie','Imię kierowcy', v.kierowcaImie)}
          ${field('kierowcaNazwisko','Nazwisko kierowcy', v.kierowcaNazwisko)}
          ${field('kierowcaNrPrawJazdy','Nr blankietu prawa jazdy', v.kierowcaNrPrawJazdy,undefined,'seria + numer, np. PL01/123456')}
          ${field('kierowcaKategorieJazdy','Kategorie uprawnień', v.kierowcaKategorieJazdy,undefined,'np. B, C, C+E, D…')}
          ${field('kierowcaDataWaznPJ','Prawo jazdy ważne do', v.kierowcaDataWaznPJ,'date')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap">
          <button type="button" class="btn btn-blue" style="font-size:12px"
            onclick="TaxOrderVehicleDetail._cepikKierowcaCheck(${v.id})">
            <i class="ti ti-search"></i>Sprawdź w CEPiK 2.0
          </button>
          <div id="vd-cepik-status-${v.id}" style="font-size:12px">
            ${(()=>{
              if (!v.cepikStatus) return '<span style="color:var(--text3)">— nie sprawdzano —</span>';
              const map = {
                valid:     '<span style="color:var(--green)">✅ Uprawnienia aktywne</span>',
                suspended: '<span style="color:var(--red)">🚫 Dokument zatrzymany</span>',
                expired:   '<span style="color:var(--amber)">⚠ Uprawnienia wygasłe</span>',
                not_found: '<span style="color:var(--amber)">❓ Nie znaleziono w CEPiK</span>',
                error:     '<span style="color:var(--red)">⛔ Błąd weryfikacji</span>',
              };
              const statusHtml = map[v.cepikStatus] || esc(v.cepikStatus);
              const dateStr = v.cepikLastCheck ? new Date(v.cepikLastCheck).toLocaleString('pl-PL') : '';
              return statusHtml + (dateStr ? `<span style="color:var(--text3);margin-left:8px;font-size:10px">sprawdzono ${dateStr}</span>` : '');
            })()}
          </div>
          ${v.cepikKategorie ? `<div style="font-size:11px;color:var(--text2);background:var(--bg3);border-radius:4px;padding:4px 10px">Kategorie CEPiK: <strong>${esc(v.cepikKategorie)}</strong></div>` : ''}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Emisje i normy</div>
        <div class="vdfg">
          ${sel('euro','Norma emisji spalin',[
            ['','— nie określono —'],
            ['Euro 1','Euro 1'],['Euro 2','Euro 2'],['Euro 3','Euro 3'],
            ['Euro 4','Euro 4'],['Euro 5','Euro 5'],['Euro 6','Euro 6'],
            ['Euro 6d','Euro 6d (najnowsza)'],['EEV','EEV (ciężarowe)'],
            ['BEV','BEV (elektryczny)'],['HEV','HEV (hybryda)'],
            ['PHEV','PHEV (hybryda plug-in)'],
          ], v.euro||'')}
          ${field('co2','Emisja CO2 (g/km)', v.co2,'number')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-top:18px;margin-bottom:10px">Dane operacyjne</div>
        <div class="vdfg" style="margin-bottom:14px">
          ${sel('statusUzytkowania','Status użytkowania',[
            ['na_stale','Na stałe'],
            ['sezonowy','Sezonowy'],
            ['rezerwowy','Rezerwowy'],
            ['do_dyspozycji','Do dyspozycji'],
            ['w_naprawie','W naprawie'],
          ], v.statusUzytkowania||'na_stale')}
          ${field('orlenPin','Orlen PIN (karta paliwowa)', v.orlenPin)}
          ${field('nrWypisuLicencji','Nr wypisu z licencji transportowej', v.nrWypisuLicencji)}
          ${field('nrBiznesowy','Nr biznesowy', v.nrBiznesowy)}
          ${field('idTekom','ID TEKOM', v.idTekom)}
          ${field('depozyt','Depozyt / lokalizacja', v.depozyt)}
          ${field('przyczepaNrRej','Przyczepa (nr rej.)', v.przyczepaNrRej)}
          ${field('nrEwidencyjny','Nr ewidencyjny (wewnętrzny)', v.nrEwidencyjny)}
          ${field('kartaPaliwowa','Nr karty paliwowej', v.kartaPaliwowa)}
          ${field('nrRFID','Nr RFID pojazdu', v.nrRFID)}
          ${field('mpkKonto','Konto MPK / centrum kosztów', v.mpkKonto)}
          ${field('grupaPojazdow','Grupa pojazdu (MyCar)', v.grupaPojazdow,undefined,'np. Ciężarowe, Dostawcze…')}
          ${field('podtypPojazdu','Podtyp pojazdu', v.podtypPojazdu,undefined,'np. Asenizacyjny, Dostawczy…')}
          ${field('wlascicielPojazdu','Właściciel prawny pojazdu', v.wlascicielPojazdu,undefined,'np. G-CON, SANTANDER Leasing…')}
          ${field('opiekun','Opiekun pojazdu', v.opiekun)}
          ${field('obszarPojazdu','Obszar / baza pojazdu', v.obszarPojazdu,undefined,'np. Baza Warszawa…')}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">
          ${[
            ['viatoll','Viatoll','ti-road'],
            ['odpisVat','Odpis VAT','ti-receipt-tax'],
            ['hakHolowniczy','Hak holowniczy','ti-anchor'],
            ['daneZTekom','Dane z TEKOM','ti-database'],
            ['pojazdGPS','Opomiarowany GPS','ti-satellite'],
            ['uzytekPrywatny','Użytek prywatny','ti-home'],
            ['pojazdUprzywilejowany','Uprzywilejowany','ti-urgent'],
            ['pojazdKluczykowy','Kluczykowy','ti-key'],
            ['autostrady','Autostrady','ti-arrows-right'],
            ['przewozWlasny','Przewóz własny','ti-truck'],
            ['rejestracjaEtoll','Rejestracja eToll','ti-receipt'],
            ['wysylanieEtoll','Wysyłanie do eToll','ti-send'],
          ].map(([id, label, icon]) => `
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;padding:7px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border);white-space:nowrap">
              <input type="checkbox" id="vd-${id}" ${v[id]?'checked':''}> <i class="ti ${icon}" style="font-size:13px;color:var(--text3)"></i>${label}
            </label>`).join('')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Serwisowanie — olej silnikowy</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('lastOilChangeKm','Przebieg przy ostatniej wymianie oleju (km)', v.lastOilChangeKm,'number')}
          ${field('oilChangeInterval','Częstotliwość wymiany oleju (km)', v.oilChangeInterval,'number')}
          <div class="vdf">
            <label class="vdl">Wymiana oleju za (km)</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="vd-oilChangeRemainingKm" type="number" class="fi" value="${v.oilChangeRemainingKm??''}" style="flex:1">
              <button type="button" class="btn btn-gray" style="padding:4px 8px;font-size:11px;white-space:nowrap"
                onclick="(function(){ const last=+document.getElementById('vd-lastOilChangeKm').value||0; const int=+document.getElementById('vd-oilChangeInterval').value||0; const km=+document.getElementById('vd-stanKilometrow').value||0; if(last&&int&&km){ const r=last+int-km; document.getElementById('vd-oilChangeRemainingKm').value=r; } })()">
                <i class="ti ti-calculator"></i>Auto
              </button>
            </div>
            ${(()=>{ const r = v.oilChangeRemainingKm; if(!r) return ''; const cl = r < 0 ? 'var(--red)' : r < 1000 ? 'var(--amber)' : 'var(--green)'; return `<div style="font-size:10px;color:${cl};margin-top:2px">${r < 0 ? `Przekroczone o ${Math.abs(r).toLocaleString('pl-PL')} km` : `Pozostało ${r.toLocaleString('pl-PL')} km`}</div>`; })()}
          </div>
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-top:18px;margin-bottom:10px">AdBlue / filtr DPF</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('pojemnoscAdblue','Pojemność zbiornika AdBlue (l)', v.pojemnoscAdblue,'number')}
          ${field('adblueOstatniData','Data ostatniego uzupełnienia AdBlue', v.adblueOstatniData,'date')}
          ${field('adblueOstatniKm','Przebieg przy uzupełnieniu AdBlue (km)', v.adblueOstatniKm,'number')}
          ${field('dpfDataRegeneracji','Data ostatniej regeneracji DPF/FAP', v.dpfDataRegeneracji,'date')}
          ${field('dpfDataWymiany','Data wymiany filtra DPF/FAP', v.dpfDataWymiany,'date')}
          ${field('dpfKmWymiany','Przebieg przy wymianie DPF (km)', v.dpfKmWymiany,'number')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Parametry specjalistyczne</div>
        <div class="vdfg" style="margin-bottom:14px">
          ${field('rodzajSamochodu','Rodzaj samochodu', v.rodzajSamochodu, 'text', '(np. Standard, Ciężarowy, Cysterna...)')}
          ${field('pojemnoscZbiornikaNaWode','Pojemność zbiornika na wodę (l)', v.pojemnoscZbiornikaNaWode,'number')}
          ${field('pojemnoscZbiornikaNaScieke','Pojemność zbiornika na ścieki (l)', v.pojemnoscZbiornikaNaScieke,'number')}
          ${field('iloscKabin','Ilość przewożonych kabin', v.iloscKabin,'number')}
          ${field('iloscKontenerow','Ilość przewożonych kontenerów', v.iloscKontenerow,'number')}
          ${field('obrotJalowy','Obroty biegu jałowego (RPM)', v.obrotJalowy,'number')}
          ${field('predkoscMaks','Prędkość maks. / ogranicznik (km/h)', v.predkoscMaks,'number')}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">
          ${[
            ['przewoziKabiny','Przewozi kabiny','ti-home'],
            ['przewoziKontenery','Przewozi kontenery','ti-box'],
            ['przewoziOgrodzenia','Przewozi ogrodzenia','ti-border-all'],
          ].map(([id, label, icon]) => `
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;padding:7px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border);white-space:nowrap">
              <input type="checkbox" id="vd-${id}" ${v[id]?'checked':''}> <i class="ti ${icon}" style="font-size:13px;color:var(--text3)"></i>${label}
            </label>`).join('')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Weryfikacja lokalizacji</div>
        <div class="vdfg" style="margin-bottom:6px">
          ${field('ostatniePotwierdzenieLokal','Ostatnie potwierdzenie lokalizacji', v.ostatniePotwierdzenieLokal,'date')}
          ${field('osobaPotwierdzajaca','Osoba potwierdzająca', v.osobaPotwierdzajaca)}
          ${field('iloscTagow','Ilość tagów RFID przypisanych', v.iloscTagow,'number')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-top:18px;margin-bottom:10px">GPS / Telematyka</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('gpsDeviceSerial','Nr seryjny urządzenia GPS (TEKOM)', v.gpsDeviceSerial)}
          ${field('pinUrzadzenia','PIN urządzenia GPS', v.pinUrzadzenia)}
          ${field('tid','TID TEKOM (klucz synchronizacji)', v.tid)}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Wyposażenie pojazdu</div>
        <div class="vdfg" style="margin-bottom:14px">
          ${sel('klimatyzacja','Klimatyzacja',[
            ['','— brak / nie określono —'],
            ['manualna','Manualna'],
            ['automatyczna','Automatyczna (AC auto)'],
            ['dwustrefowa','Dwustrefowa'],
            ['trojstrefowa','Trójstrefowa'],
          ], v.klimatyzacja||'')}
          ${sel('czujnikiPark','Czujniki parkowania',[
            ['','— brak —'],
            ['tyl','Tylko tył'],
            ['przod_tyl','Przód i tył'],
          ], v.czujnikiPark||'')}
          ${sel('tempomatTyp','Tempomat',[
            ['','— brak —'],
            ['klasyczny','Klasyczny (cruise control)'],
            ['adaptacyjny','Adaptacyjny (ACC)'],
          ], v.tempomatTyp||'')}
          ${field('adasSystemy','Systemy ADAS (aktywne systemy bezp.)', v.adasSystemy,undefined,'np. BSM, LDW, FCWS, AEB…')}
          ${field('hakNosnosc','Nośność haka holowniczego (kg)', v.hakNosnosc,'number')}
          ${field('nagrzewnicaMarka','Nagrzewnica postojowa — marka/model', v.nagrzewnicaMarka,undefined,'np. Webasto, Eberspächer…')}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">
          ${[
            ['kameraCofa','Kamera cofania','ti-camera'],
            ['dashcam','Kamera dashcam','ti-video'],
            ['alkolock','Alkolock','ti-flask'],
            ['nagrzewnicaPostojowa','Nagrzewnica postojowa','ti-flame'],
          ].map(([id, label, icon]) => `
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;padding:7px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border);white-space:nowrap">
              <input type="checkbox" id="vd-${id}" ${v[id]?'checked':''}> <i class="ti ${icon}" style="font-size:13px;color:var(--text3)"></i>${label}
            </label>`).join('')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Zabudowa specjalistyczna</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('markaZabudowy','Marka / producent zabudowy', v.markaZabudowy,undefined,'np. Wuko, Hauer, Faun…')}
          ${field('rokZabudowy','Rok zabudowy', v.rokZabudowy,'number')}
          ${field('nrFabrycznyZabudowy','Nr fabryczny zabudowy', v.nrFabrycznyZabudowy)}
          ${field('typPompy','Typ pompy / osprzętu', v.typPompy,undefined,'np. pompa ssąco-tłocząca, HDS…')}
          ${field('cisnRoboczeZbiornika','Ciśnienie robocze zbiornika (bar)', v.cisnRoboczeZbiornika,'number')}
          ${field('wydajnoscPompy','Wydajność pompy (l/h lub m³/h)', v.wydajnoscPompy,'number')}
          ${field('dataOstatnejDezynfekcji','Data ostatniej dezynfekcji / przeglądu sanitarnego', v.dataOstatnejDezynfekcji,'date')}
          ${field('strefyObslugi','Strefy / gminy obsługi', v.strefyObslugi,undefined,'np. Warszawa, Praga-Płd…')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Serwis — interwały techniczne</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('roztrzadDataWymiany','Rozrząd — data wymiany', v.roztrzadDataWymiany,'date')}
          ${field('roztrzadKmWymiany','Rozrząd — przebieg wymiany (km)', v.roztrzadKmWymiany,'number')}
          ${field('sprzegloKmWymiany','Sprzęgło — przebieg wymiany (km)', v.sprzegloKmWymiany,'number')}
          ${field('plynHamDataWymiany','Płyn hamulcowy — data wymiany', v.plynHamDataWymiany,'date')}
          ${field('plynChlodDataWymiany','Płyn chłodniczy — data wymiany', v.plynChlodDataWymiany,'date')}
          ${field('akumulatorRokWymiany','Akumulator — rok wymiany', v.akumulatorRokWymiany,'number')}
          ${field('filtrPowietrzaKm','Filtr powietrza — ostatnia wymiana (km)', v.filtrPowietrzaKm,'number')}
          ${field('filtrKabinyKm','Filtr kabiny / pyłkowy — ostatnia wymiana (km)', v.filtrKabinyKm,'number')}
          ${field('filtrPaliwaKm','Filtr paliwa — ostatnia wymiana (km)', v.filtrPaliwaKm,'number')}
          ${field('dataSerwisuKlimy','Klimatyzacja — data ostatniego serwisu', v.dataSerwisuKlimy,'date')}
          ${sel('rodzajCzynnikalOCH','Klimatyzacja — czynnik chłodniczy',[
            ['','— nie określono —'],
            ['R134a','R134a (stary standard)'],
            ['R1234yf','R1234yf (nowy standard Euro 6+)'],
            ['R744','R744 / CO₂ (elektryczne, premium)'],
          ], v.rodzajCzynnikalOCH||'')}
          ${field('iloscCzynnikalOCH','Klimatyzacja — ilość czynnika (g)', v.iloscCzynnikalOCH,'number')}
        </div>

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Podwozie i hamulce</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${sel('typZawieszenia','Typ zawieszenia',[
            ['','— nie określono —'],
            ['resory','Resory piórowe'],
            ['sprezyny','Sprężyny + amortyzatory'],
            ['pneumatyczne','Pneumatyczne (air suspension)'],
            ['mieszane','Mieszane (przód sprężyny, tył pneumatyczne)'],
          ], v.typZawieszenia||'')}
          ${sel('typHamulcow','Typ układu hamulcowego',[
            ['','— nie określono —'],
            ['tarczowe','Tarczowe (przód i tył)'],
            ['bębenkowe','Bębenkowe (przód i tył)'],
            ['mieszane','Mieszane (przód tarczowe, tył bębenkowe)'],
            ['ebs','EBS — Electronic Braking System'],
            ['ebs_abs','EBS + ABS'],
          ], v.typHamulcow||'')}
        </div>

        ${(()=>{const ft=(v.paliwo||'').toLowerCase(); if(!ft.includes('elektr')&&!ft.includes('hybryd')&&!ft.includes('bev')&&!ft.includes('hev')) return ''; return `
        <div style="font-size:11px;font-weight:600;color:var(--green);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">EV / Hybryda — parametry baterii</div>
        <div class="vdfg" style="margin-bottom:18px">
          ${field('pojemnoscBaterii','Pojemność baterii (kWh)', v.pojemnoscBaterii,'number')}
          ${field('zasiegWLTP','Zasięg WLTP (km)', v.zasiegWLTP,'number')}
          ${sel('zlaczeLadowania','Złącze ładowania',[
            ['','— nie określono —'],
            ['Type2','Type 2 / Mennekes (AC)'],
            ['CCS','CCS Combo 2 (DC)'],
            ['CHAdeMO','CHAdeMO (DC)'],
            ['CSS_Type2','CCS + Type 2'],
          ], v.zlaczeLadowania||'')}
          ${field('mocLadowaniaAC','Moc ładowania AC (kW)', v.mocLadowaniaAC,'number')}
          ${field('mocLadowaniaDC','Moc ładowania DC (kW)', v.mocLadowaniaDC,'number')}
          ${field('stanBateriiSoH','Stan zdrowia baterii SoH (%)', v.stanBateriiSoH,'number')}
          ${field('dataWymianiBaterii','Data wymiany / planowej wymiany baterii', v.dataWymianiBaterii,'date')}
        </div>`; })()}

        <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:10px">Autoryzowany serwis</div>
        <div class="vdfg" style="margin-bottom:6px">
          ${field('serwisNazwa','Nazwa warsztatu / ASO', v.serwisNazwa)}
          ${field('serwisTelefon','Telefon serwisu', v.serwisTelefon,undefined,'+48…')}
          ${field('serwisAdres','Adres serwisu', v.serwisAdres)}
          <div class="vdf" style="grid-column:1/-1">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
              <input type="checkbox" id="vd-serwisGwarancyjny" ${v.serwisGwarancyjny?'checked':''}>
              <span>Pojazd objęty gwarancją producenta</span>
            </label>
          </div>
        </div>

        <div id="vd-km-history"></div>
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
          ${field('wlascicielPojazdu','Właściciel prawny pojazdu', v.wlascicielPojazdu,undefined,'np. G-CON Sp. z o.o., SANTANDER Leasing…')}
        </div>
        <div id="vd-leasing-section" style="${isLeasing?'':'display:none'}">
          <div style="font-size:12px;font-weight:600;color:var(--blue);margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
            <i class="ti ti-building-bank"></i> Dane leasingowe
          </div>
          <div class="vdfg">
            ${sel('leasingType','Typ leasingu',[
              ['operacyjny','Leasing operacyjny (koszty = rata)'],
              ['finansowy','Leasing finansowy / kapitałowy'],
              ['zwrotny','Leasing zwrotny (leaseback)'],
            ], v.leasingType||'operacyjny')}
            ${field('leasingCompany','Leasingodawca (firma leasingowa)', v.leasingCompany)}
            ${field('leasingUser','Leasingobiorca (użytkownik pojazdu)', v.leasingUser)}
            ${field('leasingContractNo','Nr umowy leasingowej', v.leasingContractNo)}
            ${field('leasingLessorRef','Nr ewidencji u leasingodawcy', v.leasingLessorRef)}
            ${field('leasingStart','Data rozpoczęcia leasingu', v.leasingStart,'date')}
            ${field('leasingEnd','Data zakończenia leasingu', v.leasingEnd,'date')}
            ${field('leasingRate','Rata miesięczna (zł netto)', v.leasingRate,'number')}
            ${field('leasingBuyout','Cena wykupu (zł)', v.leasingBuyout,'number')}
            ${field('leasingResidual','Wartość rezydualna (zł)', v.leasingResidual,'number')}
            ${field('leasingKmLimit','Limit km w umowie leasingu', v.leasingKmLimit,'number')}
            <div class="vdf" style="grid-column:1/-1">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:8px 12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
                <input type="checkbox" id="vd-leasingGapRequired" ${v.leasingGapRequired?'checked':''}>
                <span>Ubezpieczenie GAP wymagane przez leasingodawcę</span>
              </label>
            </div>
          </div>
        </div>
        <div id="vd-rental-section" style="${isRental?'':'display:none'}">
          <div style="font-size:12px;font-weight:600;color:var(--amber);margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
            <i class="ti ti-key"></i> Dane najmu
          </div>
          <div class="vdfg">
            ${field('rentalCompany','Nazwa wynajmującego', v.rentalCompany)}
            ${field('rentalPolicyNo','Nr umowy najmu', v.rentalPolicyNo)}
            ${field('rentalStart','Wynajem od', v.rentalStart,'date')}
            ${field('rentalEnd','Wynajem do', v.rentalEnd,'date')}
            ${field('rentalRate','Stawka (zł / dobę lub mies.)', v.rentalRate,'number')}
            ${field('rentalDeposit','Kaucja (zł)', v.rentalDeposit,'number')}
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
              <input id="vd-saleBuyerNip" type="text" class="fi" value="${esc(v.saleBuyerNip||'')}"
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
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
          <i class="ti ti-chart-bar"></i> Wartość i finanse
        </div>
        <div class="vdfg">
          ${field('nrSrodkaTrwalego','Nr środka trwałego (FK)', v.nrSrodkaTrwalego)}
          ${field('wartoscRynkowa','Wartość rynkowa aktualna (zł)', v.wartoscRynkowa,'number')}
          ${field('wartoscUbezpieczeniowa','Wartość ubezpieczeniowa / suma AC (zł)', v.wartoscUbezpieczeniowa,'number')}
          ${field('wartoscKsiegowaNetto','Wartość księgowa netto (zł)', v.wartoscKsiegowaNetto,'number')}
          ${field('stawkaAmortyzacji','Stawka amortyzacji (%)', v.stawkaAmortyzacji,'number')}
          ${field('szacowanyKosztMies','Szacowany koszt miesięczny / TCO (zł)', v.szacowanyKosztMies,'number')}
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

        <!-- Zmiana numeru rejestracyjnego -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <i class="ti ti-license-plate" style="font-size:16px;color:var(--blue)"></i>
            <strong style="font-size:13px">Zmiana numeru rejestracyjnego</strong>
          </div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:10px">
            Zmiana zaktualizuje numer we wszystkich powiązanych rekordach (dokumenty, szkody, opony, zlecenia, protokoły, umowy CFM). Stary numer zostanie zarchiwizowany w historii.
          </div>
          <button class="btn btn-gray" style="font-size:12px" data-nrrej="${esc(v.nrRej)}" onclick="TaxOrderVehicleDetail._openChangeNrRej(${v.id}, this.dataset.nrrej)">
            <i class="ti ti-arrows-exchange"></i>Zmień numer rejestracyjny
          </button>
          ${v.rejestracjaHistory?.length ? `
          <div style="margin-top:12px">
            <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px">Historia numerów rejestracyjnych:</div>
            ${v.rejestracjaHistory.map(h => `
              <div style="font-size:11px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:5px 10px;margin-bottom:4px">
                <strong>${esc(h.old)}</strong> → <strong>${esc(h.new)}</strong>
                <span style="color:var(--text2);margin-left:8px">${esc(h.date || '')}</span>
                ${h.reason ? `<span style="color:var(--text2);margin-left:6px">· ${esc(h.reason)}</span>` : ''}
              </div>`).join('')}
          </div>` : ''}
        </div>
      </div>

      <!-- TAB: UWAGI -->
      <div id="vd-tab-notes-content" class="vd-tab-content" style="display:none">
        <div>
          <label class="vdl">Uwagi do pojazdu <span style="font-size:10px;color:var(--text3);font-weight:400;margin-left:6px">szybkie szablony:</span></label>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
            ${['Pojazd w serwisie','Oczekuje na OC','Oczekuje na przegląd','Uszkodzone lusterko','Pojazd zastępczy','Do zbycia','Pojazd zatrzymany'].map(tpl =>
              `<button class="btn btn-gray" style="font-size:10px;padding:3px 8px;height:auto" data-tpl="${esc(tpl)}" onclick="TaxOrderVehicleDetail._insertNote(this.dataset.tpl)">${esc(tpl)}</button>`
            ).join('')}
          </div>
          <textarea id="vd-uwagi" class="fi" style="height:120px;resize:vertical">${esc(v.uwagi || '')}</textarea>
        </div>
      </div>

      <!-- TAB: DOKUMENTY -->
      <div id="vd-tab-dokumenty-content" class="vd-tab-content" style="display:none">
        <div id="vd-dokumenty-body">
          ${window.DocumentsModule ? window.DocumentsModule.renderForVehicle(v) : '<div style="padding:20px;text-align:center;color:var(--text3)">Ładowanie modułu dokumentów...</div>'}
        </div>
      </div>

      <!-- TAB: POLISY -->
      <div id="vd-tab-polisy-content" class="vd-tab-content" style="display:none">
        <div id="vd-polisy-body">
          <div style="padding:20px;text-align:center;color:var(--text3)"><i class="ti ti-loader-2" style="font-size:20px"></i></div>
        </div>
      </div>

      <!-- TAB: HARMONOGRAM SERWISOWY -->
      <div id="vd-tab-harmonogram-content" class="vd-tab-content" style="display:none">
        <div id="vd-harmonogram-body">
          <div style="padding:20px;text-align:center;color:var(--text3)"><i class="ti ti-loader-2" style="font-size:20px"></i></div>
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

      <!-- TAB: HISTORIA ZMIAN -->
      <div id="vd-tab-changelog-content" class="vd-tab-content" style="display:none">
        <div id="vd-changelog-body">${this._renderChangelogTab(v)}</div>
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

    // Dirty detection — nasłuchuj zmian w polach formularza
    const _self = this;
    const _markDirty = () => { _self._dirty = true; };
    const _body = document.getElementById('vd-modal-body');
    if (_body) {
      _body.addEventListener('input',  _markDirty, { once: false });
      _body.addEventListener('change', _markDirty, { once: false });
    }
  },

  _renderKosztyTab(v) {
    const history = Array.isArray(v.fuelHistory) ? v.fuelHistory : [];

    // Statystyki
    const now = new Date();
    const thisMonth = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
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

      <!-- Wykres trendu spalania — wypełniany przez _renderFuelChart() -->
      <div id="vd-fuel-chart-wrap" style="margin-bottom:14px"></div>

      <!-- TCO (Total Cost of Ownership) YTD -->
      ${(() => {
        const yr = String(new Date().getFullYear());
        const svcCostY = (v.serviceHistory||[]).filter(h=>(h.date||'').startsWith(yr)).reduce((s,h)=>s+(h.cost??0),0);
        const insCostY = (+(v.ocPremium)||0) + (+(v.acPremium)||0) + (+(v.assistPremium)||0);
        const tcoTotal = totalCostY + svcCostY + insCostY;
        if (!tcoTotal) return '';
        const pctFuel = tcoTotal > 0 ? totalCostY / tcoTotal * 100 : 0;
        const pctSvc  = tcoTotal > 0 ? svcCostY  / tcoTotal * 100 : 0;
        const pctIns  = tcoTotal > 0 ? insCostY  / tcoTotal * 100 : 0;
        return `<div style="background:var(--bg3);border-radius:var(--radius);padding:14px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px">TCO ${yr} — całkowity koszt posiadania</div>
          <div style="display:flex;gap:4px;height:8px;border-radius:4px;overflow:hidden;margin-bottom:10px">
            ${pctFuel>0?`<div style="width:${pctFuel.toFixed(1)}%;background:var(--amber)" title="Paliwo ${totalCostY.toFixed(0)} zł"></div>`:''}
            ${pctSvc>0 ?`<div style="width:${pctSvc.toFixed(1)}%;background:var(--blue)"  title="Serwis ${svcCostY.toFixed(0)} zł"></div>`:''}
            ${pctIns>0 ?`<div style="width:${pctIns.toFixed(1)}%;background:var(--green)" title="Ubezpieczenia ${insCostY.toFixed(0)} zł"></div>`:''}
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px">
            ${totalCostY>0?`<span><i class="ti ti-droplet" style="color:var(--amber)"></i> Paliwo <b>${totalCostY.toFixed(0)} zł</b></span>`:''}
            ${svcCostY>0 ?`<span><i class="ti ti-tools"   style="color:var(--blue)"></i>  Serwis <b>${svcCostY.toFixed(0)} zł</b></span>`:''}
            ${insCostY>0 ?`<span><i class="ti ti-shield"  style="color:var(--green)"></i>  Ubezp. <b>${insCostY.toFixed(0)} zł</b></span>`:''}
            <span style="margin-left:auto;font-weight:700;font-size:13px">${tcoTotal.toFixed(0)} zł</span>
          </div>
        </div>`;
      })()}

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
                  <td style="padding:5px 8px;font-family:var(--mono);font-size:11px">${esc(h.date||'—')}<br><span style="color:var(--text3)">${esc(h.time||'')}</span></td>
                  <td style="padding:5px 8px">
                    <span style="font-size:10px;font-weight:600;color:${PRODUCT_COLOR[h.product]||'var(--text2)'}">
                      ${esc((h.product||'—').toUpperCase())}
                    </span>
                  </td>
                  <td style="padding:5px 8px;text-align:right;font-family:var(--mono)">${h.liters!=null?h.liters.toFixed(1):'—'}</td>
                  <td style="padding:5px 8px;text-align:right;font-family:var(--mono);color:var(--text2)">${h.pricePerL!=null?h.pricePerL.toFixed(3):'—'}</td>
                  <td style="padding:5px 8px;text-align:right;font-family:var(--mono);font-weight:500">${h.totalGross!=null?h.totalGross.toFixed(2):'—'}</td>
                  <td style="padding:5px 8px;color:var(--text2);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(h.station||'')}">${esc(h.station||'—')}</td>
                  <td style="padding:5px 8px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text2)">${h.km!=null?h.km.toLocaleString('pl-PL'):'—'}</td>
                  <td style="padding:5px 8px;text-align:center">
                    <button onclick="FuelImport.removeFuel(${v.id},${h.id})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:2px 4px" title="Usuń" aria-label="Zamknij">&times;</button>
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
              <span class="pill" style="font-size:10px;background:${resultColor}20;color:${resultColor}">${esc(ins.result || 'brak wyniku')}</span>
              ${ins.station ? `<span style="font-size:11px;color:var(--text2)">${esc(ins.station)}</span>` : ''}
            </div>
            ${ins.docNr ? `<div style="font-size:10px;color:var(--text3)">Dok.: ${esc(ins.docNr)}${ins.nip?' · NIP: '+esc(ins.nip):''}</div>` : ''}
            ${ins.notes ? `<div style="font-size:11px;color:var(--text2)">${esc(ins.notes)}</div>` : ''}
            ${ins.addedBy ? `<div style="font-size:10px;color:var(--text3)">Dodał: ${esc(ins.addedBy)}</div>` : ''}
          </div>
          <button onclick="TaxOrderVehicleDetail._removeInspection(${v.id},${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px 4px;font-size:14px" title="Usuń wpis" aria-label="Zamknij">&times;</button>
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
          <i class="ti ti-tool" style="color:var(--amber)"></i>Nowy wpis przeglądu — ${esc(v.nrRej)}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Data przeglądu</label>
            <input id="_ins-date" type="date" class="fi" value="${(d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date())}">
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
            <input id="_ins-station" type="text" class="fi" placeholder="Nazwa stacji" value="${esc(v.inspectionStation||'')}">
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
            <span class="pill pill-gray" style="font-size:10px">${esc(e.typ||'badanie')}</span>
            ${e.result?`<span class="pill" style="font-size:10px;background:${{pozytywny:'var(--green)20',warunkowy:'var(--amber)20',negatywny:'var(--red)20'}[e.result]||'#eee'};color:${{pozytywny:'var(--green)',warunkowy:'var(--amber)',negatywny:'var(--red)'}[e.result]||'#666'}">${esc(e.result)}</span>`:''}
          </div>
          ${e.docNr?`<div style="font-size:10px;color:var(--text3)">Dok.: ${esc(e.docNr)}${e.nip?' · NIP: '+esc(e.nip):''}</div>`:''}
          ${e.firma?`<div style="font-size:11px;color:var(--text2)">${esc(e.firma)}</div>`:''}
          ${e.notes?`<div style="font-size:11px;color:var(--text2)">${esc(e.notes)}</div>`:''}
          ${e.addedBy?`<div style="font-size:10px;color:var(--text3)">Dodał: ${esc(e.addedBy)}</div>`:''}
        </div>
        <button onclick="TaxOrderVehicleDetail._removeUdtEntry(${v.id},${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px 4px;font-size:14px" aria-label="Zamknij">&times;</button>
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
          <i class="ti ti-building-factory-2" style="color:var(--red)"></i>Nowy wpis UDT — ${esc(v.nrRej)}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Data badania/wpisu</label>
            <input id="_udt-date" type="date" class="fi" value="${(d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date())}">
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
            <span class="pill pill-gray" style="font-size:10px">${esc(e.typ||'legalizacja')}</span>
            ${e.wazneDo?`<span style="font-size:10px;color:var(--text2)">ważne do: ${new Date(e.wazneDo).toLocaleDateString('pl-PL')}</span>`:''}
          </div>
          ${e.certNr?`<div style="font-size:10px;color:var(--text3)">Cert.: ${esc(e.certNr)}${e.nip?' · NIP: '+esc(e.nip):''}</div>`:''}
          ${e.firma?`<div style="font-size:11px;color:var(--text2)">${esc(e.firma)}</div>`:''}
          ${e.notes?`<div style="font-size:11px;color:var(--text2)">${esc(e.notes)}</div>`:''}
          ${e.addedBy?`<div style="font-size:10px;color:var(--text3)">Dodał: ${esc(e.addedBy)}</div>`:''}
        </div>
        <button onclick="TaxOrderVehicleDetail._removeTachoEntry(${v.id},${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px 4px;font-size:14px" aria-label="Zamknij">&times;</button>
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
          <i class="ti ti-device-desktop-analytics" style="color:var(--blue)"></i>Nowy wpis tachografu — ${esc(v.nrRej)}
        </div>
        <div class="vdfg" style="margin-bottom:14px">
          <div class="vdf">
            <label class="vdl">Data legalizacji</label>
            <input id="_tch-date" type="date" class="fi" value="${(d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date())}">
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
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return items.map(item => {
      const daysDue = item.nextDate ? Math.round((new Date(item.nextDate.includes('T') ? item.nextDate : item.nextDate + 'T00:00:00') - now) / 86400000) : null;
      const kmDue   = (item.nextKm && v.stanKilometrow) ? item.nextKm - v.stanKilometrow : null;
      const isOk    = (daysDue === null || daysDue > 14) && (kmDue === null || kmDue > 500);
      const color   = daysDue !== null && daysDue < 0 || kmDue !== null && kmDue < 0 ? 'var(--red)' : (!isOk ? 'var(--amber)' : 'var(--green)');
      return `<div style="background:var(--bg3);border-radius:var(--radius);border-left:3px solid ${color};padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="font-weight:600;font-size:13px">${esc(item.label || (window._ns_alertTypes||[]).find(a=>a.id===item.typeId)?.name || item.typeId || '')}</div>
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
          <button class="tbtn" data-vid="${v.id}" data-iid="${esc(item.id)}" onclick="TaxOrderVehicleDetail._editMaintItem(+this.dataset.vid,this.dataset.iid)" title="Edytuj"><i class="ti ti-pencil"></i></button>
          <button class="tbtn" style="color:var(--red)" data-vid="${v.id}" data-iid="${esc(item.id)}" onclick="TaxOrderVehicleDetail._deleteMaintItem(+this.dataset.vid,this.dataset.iid)" title="Usuń"><i class="ti ti-trash"></i></button>
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
    const typeOpts = types.map(a => `<option value="${esc(a.id)}" ${item?.typeId===a.id?'selected':''}>${esc(a.name)}</option>`).join('');
    const fmtDate = d => { if (!d) return ''; const dt = new Date(d.includes('T') ? d : d + 'T00:00:00'); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); };
    const html = `<div id="maint-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:5002;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:420px;max-width:95vw;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <strong style="font-size:15px">${item?'Edytuj':'Dodaj'} element konserwacji</strong>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
          <div class="f"><label>Typ</label><select id="mi-type" class="fi">${typeOpts||'<option value="">—</option>'}</select></div>
          <div class="f"><label>Własna nazwa (opcjonalna)</label><input id="mi-label" class="fi" value="${esc(item?.label||'')}" placeholder="np. Olej 10W-40 Shell"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="f"><label>Ostatnia data</label><input id="mi-lastDate" type="date" class="fi" value="${fmtDate(item?.lastDate)}"></div>
            <div class="f"><label>Ostatnie km</label><input id="mi-lastKm" type="number" class="fi" value="${item?.lastKm||''}" placeholder="np. 145000"></div>
            <div class="f"><label>Interwał dni</label><input id="mi-intDays" type="number" class="fi" value="${item?.intervalDays||''}" placeholder="np. 365"></div>
            <div class="f"><label>Interwał km</label><input id="mi-intKm" type="number" class="fi" value="${item?.intervalKm||''}" placeholder="np. 15000"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button class="btn btn-gray" onclick="document.getElementById('maint-modal').remove()">Anuluj</button>
          <button class="btn btn-blue" data-vid="${vId}" data-iid="${esc(item?.id||'')}" onclick="TaxOrderVehicleDetail._saveMaintItem(+this.dataset.vid,this.dataset.iid)"><i class="ti ti-check"></i>Zapisz</button>
        </div>
      </div>
    </div>`;
    document.getElementById('maint-modal')?.remove();
    // Załaduj typy alertów jeśli nie ma
    if (!types.length) {
      fetch(`${window.CF_WORKER_URL||'https://taxorder-pro-api.adamus1000.workers.dev'}/api/alert-types?company=${window.currentCompanyId||'mtoilet'}`,
        { headers: { Authorization: 'Bearer ' + (localStorage.getItem('cf_token')||'') } })
        .then(r=>r.json()).then(list=>{ window._ns_alertTypes=list; document.getElementById('mi-type').innerHTML=list.map(a=>`<option value="${esc(String(a.id))}" ${item?.typeId===a.id?'selected':''}>${esc(a.name)}</option>`).join(''); }).catch(()=>{});
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
    const nextDate = (lastDate && intDays) ? (() => { const d = new Date(lastDate + 'T00:00:00'); d.setDate(d.getDate() + intDays); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })() : null;
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
            <span style="font-family:var(--mono);font-weight:600;font-size:13px">${esc((c.card_no||'').replace(/\d(?=\d{4})/g,'•'))}</span>
            <span class="pill pill-blue" style="font-size:10px">${esc(c.type||'—')}</span>
            <span class="pill ${STATUS_CLS[c.status]||'pill-gray'}" style="font-size:10px">${esc(c.status||'—')}</span>
          </div>
          ${c.provider?`<div style="font-size:11px;color:var(--text2);margin-top:2px"><i class="ti ti-building" style="font-size:10px"></i> ${esc(c.provider)}</div>`:''}
          ${c.notes?`<div style="font-size:11px;color:var(--text3)">${esc(c.notes)}</div>`:''}
        </div>
        <button data-nrrej="${esc(v.nrRej)}" data-cardid="${c.id}" onclick="TaxOrderVehicleDetail._removeCard(this.dataset.nrrej, this.dataset.cardid)" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:2px 4px;font-size:14px" title="Usuń kartę" aria-label="Zamknij">&times;</button>
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

  _refreshDrView(vehId) {
    const v = (window.vehs || []).find(x => x.id === vehId);
    const el = document.getElementById('vd-dr-view');
    if (v && el) el.innerHTML = this._renderDrView(v);
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
      return `<strong>${esc(String(val))}</strong>${unit ? ' <span style="color:var(--text3);font-size:10px">' + unit + '</span>' : ''}`;
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
            ">${esc(v.nrRej || '—')}</div>
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
          <span>H — Ważny do: ${v.docWaznyDo ? `<strong style="color:#2a1f0f">${esc(v.docWaznyDo)}</strong>` : '<em>bez daty ważności</em>'}</span>
          <span>I — Wydany: ${v.docDataWydania ? `<strong style="color:#2a1f0f">${esc(v.docDataWydania)}</strong>` : '<span style="color:var(--text3)">—</span>'}</span>
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
      <!-- Akcje pod DR -->
      <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn btn-amber" style="justify-content:center"
          onclick="AztecScanner.open(${v.id})">
          <i class="ti ti-qrcode"></i> Skanuj AZTEC
        </button>
        <label class="btn btn-gray" style="justify-content:center;cursor:pointer;position:relative">
          <i class="ti ti-file-upload"></i> Importuj PDF
          <input type="file" accept="image/*,application/pdf,.pdf"
            style="position:absolute;opacity:0;inset:0;cursor:pointer"
            onchange="(function(f,vid){AztecScanner.open(vid);if(f)AztecScanner._handleFile(f)})(this.files[0],${v.id})">
        </label>
      </div>
      ${window.AztecScanner?._lastScanDataUrl ? `
      <!-- Wariant B: side-by-side ze skanem -->
      <div style="margin-top:14px;padding-top:10px;border-top:1px dashed #c8b89a">
        <div style="font-size:9px;color:#7a6a55;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Ostatni skan dokumentu</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start">
          <div>
            <img src="${window.AztecScanner._lastScanDataUrl}"
              style="width:100%;border-radius:6px;border:1px solid #c8b89a;object-fit:contain;max-height:220px;background:#fff"
              alt="Skan DR">
          </div>
          <div style="font-size:9.5px;color:var(--text2);padding:4px">
            <div style="font-weight:700;color:var(--text);margin-bottom:6px">Dane w systemie vs. skan</div>
            <div style="display:flex;flex-direction:column;gap:3px">
              ${[
                ['A', 'Nr rej.', v.nrRej],
                ['D.1', 'Marka', v.marka],
                ['E', 'VIN', v.vin ? v.vin.slice(0,8)+'…' : null],
                ['F.1', 'DMC', v.dmcMax ? v.dmcMax+' kg' : null],
                ['G', 'Masa wł.', v.masaWlasna ? v.masaWlasna+' kg' : null],
                ['P.3', 'Paliwo', v.paliwo],
              ].map(([code, label, val]) => `<div style="display:flex;gap:4px;align-items:baseline">
                <span style="font-size:8px;font-weight:700;color:#7a6a55;min-width:24px">${code}</span>
                <span style="min-width:52px">${label}:</span>
                <span style="font-weight:600;color:${val ? 'var(--text)' : 'var(--text3)'}">${val ? esc(String(val)) : '—'}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>` : ''}`;
  },

  _attachTerytGmina(el, vehId) {
    if (!window.TerytAutocomplete) return;
    TerytAutocomplete.attach(el, {
      onSelect: () => {
        const box = document.getElementById('vd-dt1-box');
        if (box) box.innerHTML = TaxOrderVehicleDetail._renderDt1BoxFromForm(vehId);
      },
    });
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
    const m = parseInt(document.getElementById('vd-miesiacePodatku')?.value ?? v.miesiacePodatku ?? 12) || 1;
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
      <i class="ti ti-map-pin" style="font-size:10px"></i> Gmina: <b>${esc(gmina)}</b> · ${v.miesiacePodatku??12} miesięcy
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
          .bindPopup(`Start: ${esc(withCoords[0].date)} ${esc(withCoords[0].time||'')}`).addTo(map);
        if (coords.length > 1) {
          window.L.circleMarker(coords[coords.length-1], { radius: 7, color: '#A32D2D', fillColor: '#d44a4a', fillOpacity: 1 })
            .bindPopup(`Koniec: ${esc(withCoords[withCoords.length-1].date)} ${esc(withCoords[withCoords.length-1].time||'')}`).addTo(map);
        }
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
      }, 150);
    }

    return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <div class="stat-chip"><span>${gps.length}</span> rekordów GPS</div>
        ${dates.length ? `<div class="stat-chip"><span>${esc(dates[0])}</span> — <span>${esc(dates[dates.length-1])}</span></div>` : ''}
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
              <td style="font-family:var(--mono);white-space:nowrap">${esc(r.date||'—')}</td>
              <td style="font-family:var(--mono);color:var(--text2)">${esc(r.time||'—')}</td>
              <td style="text-align:right;font-family:var(--mono)">${r.km!=null?r.km.toLocaleString('pl-PL'):'—'}</td>
              <td style="white-space:nowrap">${esc(r.driver||'—')}</td>
              <td style="text-align:right;font-family:var(--mono);color:${r.speed>100?'var(--red)':'var(--text)'}">${r.speed!=null?r.speed:'—'}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)" title="${esc(r.location||'')}">${esc(r.location||'—')}</td>
              <td style="font-size:10px;color:var(--text3)">${esc(r.event||'')}</td>
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
    const _c = v => { const s=String(v??''); return '"'+(/^[=+\-@]/.test(s)?'\t'+s:s).replace(/"/g,'""')+'"'; };
    const csv = '﻿' + [headers, ...gps.map(r=>[r.date,r.time,r.nrRej,r.km??'',r.driver,r.speed??'',r.location,r.event])]
      .map(row => row.map(_c).join(';')).join('\r\n');
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
    const row  = (lbl, val) => `<tr><td style="padding:5px 10px;color:#6b7280;font-size:11px;width:200px">${lbl}</td><td style="padding:5px 10px;font-weight:600;font-size:12px">${val != null && val !== '' ? esc(String(val)) : '—'}</td></tr>`;
    const rowH = (lbl, val) => `<tr><td style="padding:5px 10px;color:#6b7280;font-size:11px;width:200px">${lbl}</td><td style="padding:5px 10px;font-weight:600;font-size:12px">${val||'—'}</td></tr>`;
    const svcRows = [...(v.serviceHistory||[])].slice(0,8).map(s=>`
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:5px 10px;font-family:monospace;font-size:11px">${esc(s.date||'—')}</td>
        <td style="padding:5px 10px;font-size:11px">${esc(window.ServiceModule?.SERVICE_TYPES?.[s.type]?.label||s.type||'—')}</td>
        <td style="padding:5px 10px;font-size:11px;color:#6b7280">${esc(s.description||'—')}</td>
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
  ${!tax.exempt && tax.kwota != null ? rowH(`Kwota (${v.miesiacePodatku||12} mies.)`, `<span style="color:#1d4ed8;font-weight:700">${fz(tax.kwota)}</span>`) : ''}
  ${!tax.exempt && tax.gminaName ? row('Gmina stawek', tax.gminaName) : ''}
</table>` : '';
    // TCO summary
    const yr = String(new Date().getFullYear());
    const fuelCost = (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(yr)).reduce((s,h)=>s+(h.totalCost??0),0);
    const svcCost  = (v.serviceHistory||[]).filter(h=>(h.date||'').startsWith(yr)).reduce((s,h)=>s+(h.cost??0),0);
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
  ${rowH('Łącznie', `<span style="color:#1d4ed8;font-weight:700">${fz(tcoTotal)}</span>`)}
  ${kmDriven ? row('Koszt/km', fz(tcoTotal/kmDriven).replace(' zł','')+' zł/km') : ''}
</table>` : '';
    // Company branding from localStorage (set in Settings)
    const _rawLogo = localStorage.getItem('print_company_logo') || '';
    const cLogo = (_rawLogo.startsWith('https://') || _rawLogo.startsWith('data:image/')) ? _rawLogo : '';
    const cName   = localStorage.getItem('print_company_name')  || localStorage.getItem('cf_company') || '';
    const cNip    = localStorage.getItem('print_company_nip')   || '';
    const cAddr   = localStorage.getItem('print_company_addr')  || '';
    const logoHtml = cLogo
      ? `<img src="${cLogo}" style="height:48px;object-fit:contain;margin-right:16px" alt="logo">`
      : '';
    const brandingHtml = (cName || cNip || cAddr)
      ? `<div style="display:flex;align-items:center;padding:10px 16px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:14px">
           ${logoHtml}
           <div>
             ${cName ? `<div style="font-size:14px;font-weight:700">${esc(cName)}</div>` : ''}
             ${cNip  ? `<div style="font-size:11px;color:#6b7280">NIP: ${esc(cNip)}</div>` : ''}
             ${cAddr ? `<div style="font-size:11px;color:#6b7280">${esc(cAddr)}</div>` : ''}
           </div>
         </div>`
      : '';
    const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8">
<title>Karta pojazdu — ${esc(v.nrRej)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;font-size:12px;color:#1f2937;padding:20px;max-width:800px;margin:0 auto}
h1{font-size:22px;font-weight:800;font-family:monospace;color:#1d4ed8;margin-bottom:2px}
h2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:14px 0 4px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
table{width:100%;border-collapse:collapse}th{background:#f9fafb;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;padding:5px 10px;text-align:left}
@media print{button{display:none}body{padding:8px}}</style></head>
<body>
<button onclick="window.print()" style="float:right;background:#1d4ed8;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;margin-bottom:8px">🖨 Drukuj</button>
${brandingHtml}
<h1>${esc(v.nrRej)}</h1>
<div style="color:#6b7280;font-size:13px;margin-bottom:4px">${esc(v.marka)} ${esc(v.model)} · ${esc(v.rok||'—')} · ${esc(v.typ||'—')}</div>
<div style="font-size:10px;color:#9ca3af;margin-bottom:14px">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} | TaxOrder Pro</div>
<h2>Identyfikacja</h2>
<table>${rowH('VIN',`<span style="font-family:monospace">${esc(v.vin||'—')}</span>`)}
${row('DMC',(v.dmc??v.dmcMax??0).toLocaleString('pl-PL')+' kg')}${v.euro?row('Norma Euro',v.euro):''}${v.co2?row('Emisja CO2',v.co2+' g/km'):''}
${v.nrFlotowy?row('Nr flotowy',v.nrFlotowy):''}
${row('Status własności',v.ownership_type||v.status)}${row('Właściciel',v.wlasciciel)}
${row('Kierowca',v.kierowca)}${row('Stan licznika',v.stanKilometrow!=null?v.stanKilometrow.toLocaleString('pl-PL')+' km':null)}</table>
<h2>Ubezpieczenia</h2>
<table>${row('OC ważne do',fd(v.ocEnd))}${row('Ubezpieczyciel OC',v.ocInsurer)}
${row('Nr polisy OC',v.ocPolicyNo)}${row('Składka OC',fz(v.ocPremium))}
${row('AC ważne do',fd(v.acEnd))}${row('Ubezpieczyciel AC',v.acInsurer)}
${v.gapEnd?row('GAP ważne do',fd(v.gapEnd)):''}${v.gapInsurer?row('Ubezpieczyciel GAP',v.gapInsurer):''}
${v.greenCardNo?row('Zielona Karta',v.greenCardNo+' (do: '+fd(v.greenCardEnd)+')'):''}
</table>
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

  async printQr(vehId) {
    const v = (window.vehs||[]).find(x => x.id === vehId);
    if (!v) { toast('Otwórz kartę pojazdu'); return; }
    if (typeof QRCode === 'undefined') { toast('Ładowanie biblioteki QR...'); return; }

    const qrData = [
      'NR:' + (v.nrRej||''),
      'VIN:' + (v.vin||''),
      v.marka||'', v.model||'',
      'ROK:' + (v.rok||''),
      'KIEROWCA:' + (v.kierowca||''),
    ].filter(Boolean).join('\n');

    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, qrData, { width: 280, margin: 2, color: { dark: '#1e3a5f', light: '#ffffff' } });
    const qrImg = canvas.toDataURL('image/png');

    const fd = d => d ? new Date(d).toLocaleDateString('pl-PL') : '—';
    const tax = window.calcTax ? window.calcTax(v) : null;

    const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8">
<title>QR — ${v.nrRej||''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,.12);padding:28px 32px;width:360px;display:flex;flex-direction:column;align-items:center;gap:16px;border:2px solid #e2e8f0}
.badge{background:#1e3a5f;color:#fff;font-family:monospace;font-size:28px;font-weight:800;letter-spacing:.04em;padding:8px 20px;border-radius:8px;text-align:center;word-break:break-all}
.model{color:#475569;font-size:14px;font-weight:600;text-align:center}
.qr{border-radius:10px;border:4px solid #e2e8f0}
table{width:100%;border-collapse:collapse;font-size:11px}
td{padding:4px 8px;border-bottom:1px solid #f1f5f9}
td:first-child{color:#64748b;width:120px}
td:last-child{font-weight:600;color:#1e293b}
.footer{font-size:9px;color:#94a3b8;text-align:center;margin-top:4px}
.tax-pill{background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:700;padding:4px 12px;border-radius:99px}
@media print{body{padding:0;background:#fff}.card{box-shadow:none;border:1px solid #e2e8f0}button{display:none}}
</style></head>
<body>
<div class="card">
  <button onclick="window.print()" style="align-self:flex-end;background:#1e3a5f;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:11px">🖨 Drukuj</button>
  <div class="badge">${esc(v.nrRej||'—')}</div>
  <div class="model">${esc(v.marka||'')} ${esc(v.model||'')} · ${esc(String(v.rok||'—'))}</div>
  <img src="${qrImg}" class="qr" width="200" height="200" alt="QR">
  <table>
    ${v.vin ? `<tr><td>VIN</td><td style="font-family:monospace;font-size:10px">${esc(v.vin)}</td></tr>` : ''}
    ${v.kierowca ? `<tr><td>Kierowca</td><td>${esc(v.kierowca)}</td></tr>` : ''}
    ${v.ocEnd ? `<tr><td>OC ważne do</td><td>${fd(v.ocEnd)}</td></tr>` : ''}
    ${v.nextInspection ? `<tr><td>Następny przegląd</td><td>${fd(v.nextInspection)}</td></tr>` : ''}
    ${v.stanKilometrow != null ? `<tr><td>Stan km</td><td>${v.stanKilometrow.toLocaleString('pl-PL')} km</td></tr>` : ''}
    ${tax && tax.cat && !tax.exempt ? `<tr><td>Podatek DT-1</td><td>${esc(tax.cat)}</td></tr>` : ''}
  </table>
  ${tax && tax.kwota > 0 && !tax.exempt ? `<div class="tax-pill">DT-1: ${(+tax.kwota).toFixed(2).replace('.',',')} zł</div>` : ''}
  <div class="footer">TaxOrder Pro · ${new Date().toLocaleDateString('pl-PL')}</div>
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=440,height=700');
    if (!win) { toast('Zezwól na otwieranie okien popup'); return; }
    win.document.write(html); win.document.close();
  },

  // ── Konfiguracja zakładek ──────────────────────────────────
  _VD_TABS_LS: 'taxorder-vd-tabs',

  _getVdTabsCfg() {
    try {
      const raw = localStorage.getItem(this._VD_TABS_LS);
      if (!raw) return this._vdTabsDefault();
      const cfg = JSON.parse(raw);
      const known = new Set(cfg.order || []);
      VD_TABS.forEach(t => { if (!known.has(t.id)) cfg.order.push(t.id); });
      cfg.hidden = cfg.hidden || [];
      return cfg;
    } catch { return this._vdTabsDefault(); }
  },

  _vdTabsDefault() {
    return { order: VD_TABS.map(t => t.id), hidden: [] };
  },

  openVdTabsCfg() {
    const cfg = this._getVdTabsCfg();
    const oldList = document.getElementById('vd-tabs-cfg-list');
    if (!oldList) return;
    // Klonuj węzeł bez dzieci — usuwa poprzednie listenery dragstart/dragend/dragover
    const list = oldList.cloneNode(false);
    oldList.parentNode.replaceChild(list, oldList);
    list.innerHTML = cfg.order.map(id => {
      const tabDef = VD_TABS.find(x => x.id === id);
      if (!tabDef) return '';
      const label = window.t ? (window.t(tabDef.i18n) !== tabDef.i18n ? window.t(tabDef.i18n) : tabDef.label) : tabDef.label;
      const hidden = cfg.hidden.includes(id);
      return `<li data-vdtab="${id}" draggable="true"
        style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--border);cursor:grab;user-select:none">
        <i class="ti ti-grip-vertical" style="color:var(--text3);font-size:17px;flex-shrink:0;pointer-events:none"></i>
        <input type="checkbox" id="vdtc-${id}" ${hidden ? '' : 'checked'} style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
        <label for="vdtc-${id}" style="flex:1;cursor:pointer;font-size:13px;pointer-events:none">${label}</label>
      </li>`;
    }).join('');
    this._initVdTabsDnd(list);
    document.getElementById('modal-vd-tabs-cfg').style.display = 'flex';
  },

  closeVdTabsCfg() {
    document.getElementById('modal-vd-tabs-cfg').style.display = 'none';
  },

  saveVdTabsCfg() {
    const list = document.getElementById('vd-tabs-cfg-list');
    const items = [...list.querySelectorAll('[data-vdtab]')];
    const order = items.map(el => el.dataset.vdtab);
    const hidden = items.filter(el => !el.querySelector('input').checked).map(el => el.dataset.vdtab);
    if (hidden.length >= order.length) { toast('⚠ Przynajmniej jedna zakładka musi być widoczna'); return; }
    try { localStorage.setItem(this._VD_TABS_LS, JSON.stringify({ order, hidden })); } catch {}
    this.closeVdTabsCfg();
    if (this._currentVehId) this.open(this._currentVehId);
    toast('✓ Układ zakładek zapisany');
  },

  resetVdTabsCfg() {
    localStorage.removeItem(this._VD_TABS_LS);
    this.closeVdTabsCfg();
    if (this._currentVehId) this.open(this._currentVehId);
    toast('Przywrócono domyślny układ zakładek');
  },

  _initVdTabsDnd(list) {
    let dragging = null;
    list.addEventListener('dragstart', e => {
      dragging = e.target.closest('[data-vdtab]');
      if (dragging) { dragging.style.opacity = '0.45'; dragging.style.cursor = 'grabbing'; }
    });
    list.addEventListener('dragend', () => {
      if (dragging) { dragging.style.opacity = ''; dragging.style.cursor = 'grab'; dragging = null; }
    });
    list.addEventListener('dragover', e => {
      e.preventDefault();
      const over = e.target.closest('[data-vdtab]');
      if (over && dragging && over !== dragging) {
        const rect = over.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) over.before(dragging);
        else over.after(dragging);
      }
    });
  },
  // ───────────────────────────────────────────────────────────

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

  // ─── Super-tabs ──────────────────────────────────────────────────────────────

  _activeSuperTab: 'przeglad',

  _renderSuperTabs() {
    const active = this._activeSuperTab || 'przeglad';
    return Object.entries(VD_SUPER_LABELS).map(([id, def]) => {
      const isActive = id === active;
      return `<button id="vd-st-${id}" onclick="TaxOrderVehicleDetail._superTab('${id}')"
        style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;
        border:2px solid ${isActive ? 'var(--blue)' : 'var(--border)'};border-radius:var(--radius);
        cursor:pointer;font-size:12px;font-weight:${isActive ? '700' : '500'};
        background:${isActive ? 'var(--blue)' : 'var(--bg)'};color:${isActive ? '#fff' : 'var(--text2)'};
        transition:all .15s">
        <i class="ti ${def.icon}" style="font-size:14px"></i>${def.label}
      </button>`;
    }).join('');
  },

  _superTab(group) {
    this._activeSuperTab = group;
    const groupTabs = VD_SUPER_TABS[group] || [];
    const cfg = this._getVdTabsCfg();
    // Odśwież wygląd przycisków super-tab
    Object.keys(VD_SUPER_TABS).forEach(id => {
      const btn = document.getElementById('vd-st-' + id);
      if (!btn) return;
      const active = id === group;
      btn.style.background   = active ? 'var(--blue)' : 'var(--bg)';
      btn.style.color        = active ? '#fff' : 'var(--text2)';
      btn.style.borderColor  = active ? 'var(--blue)' : 'var(--border)';
      btn.style.fontWeight   = active ? '700' : '500';
    });
    // Pokaż/ukryj przyciski zakładek
    VD_TABS.forEach(t => {
      const btn = document.getElementById('vd-tab-' + t.id);
      if (!btn) return;
      const inGroup = groupTabs.includes(t.id);
      const notHidden = !cfg.hidden.includes(t.id);
      btn.style.display = (inGroup && notHidden) ? 'inline-flex' : 'none';
    });
    // Aktywuj pierwszą widoczną zakładkę w grupie
    const firstTab = groupTabs.find(id => {
      const btn = document.getElementById('vd-tab-' + id);
      return btn && btn.style.display !== 'none';
    });
    if (firstTab) this._tab(firstTab);
  },

  // ─── Zakładki (istniejąca logika + auto-switch super-tab) ─────────────────

  _tab(name) {
    // Auto-switch super-tab jeśli zakładka należy do innej grupy
    const targetGroup = Object.entries(VD_SUPER_TABS).find(([, tabs]) => tabs.includes(name))?.[0];
    if (targetGroup && targetGroup !== this._activeSuperTab) {
      this._activeSuperTab = targetGroup;
      const groupTabs = VD_SUPER_TABS[targetGroup] || [];
      const cfg = this._getVdTabsCfg();
      Object.keys(VD_SUPER_TABS).forEach(id => {
        const btn = document.getElementById('vd-st-' + id);
        if (!btn) return;
        const active = id === targetGroup;
        btn.style.background  = active ? 'var(--blue)' : 'var(--bg)';
        btn.style.color       = active ? '#fff' : 'var(--text2)';
        btn.style.borderColor = active ? 'var(--blue)' : 'var(--border)';
      });
      VD_TABS.forEach(t => {
        const btn = document.getElementById('vd-tab-' + t.id);
        if (!btn) return;
        btn.style.display = (groupTabs.includes(t.id) && !cfg.hidden.includes(t.id)) ? 'inline-flex' : 'none';
      });
    }

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
    // Renderuj wykresy/changelog po przełączeniu zakładki
    const v = (window.vehs||[]).find(x => x.id === this._currentVehId);
    if (v) {
      if (name === 'eksploatacja') this._renderKmChart(v);
      if (name === 'koszty')       this._renderFuelChart(v);
      if (name === 'changelog') {
        const el = document.getElementById('vd-changelog-body');
        if (el) el.innerHTML = this._renderChangelogTab(v);
      }
      if (name === 'dokumenty') {
        window.DocumentsModule?.loadForVehicle(v);
      }
      if (name === 'polisy') {
        const body = document.getElementById('vd-polisy-body');
        if (body) {
          const div = window.PoliciesModule?.renderForVehicle(v);
          if (div) { body.innerHTML = ''; body.appendChild(div); }
        }
      }
      if (name === 'harmonogram') {
        const body = document.getElementById('vd-harmonogram-body');
        if (body) {
          const div = window.ServiceScheduleModule?.renderForVehicle(v);
          if (div) { body.innerHTML = ''; body.appendChild(div); }
        }
      }
    }
  },

  _renderChangelogTab(v) {
    const log = [...(v.changeLog || [])].reverse();
    if (!log.length) return `
      <div style="text-align:center;padding:2.5rem 1rem;color:var(--text3)">
        <i class="ti ti-history" style="font-size:40px;display:block;margin-bottom:12px;opacity:.4"></i>
        <div style="font-size:13px">Brak historii zmian.</div>
        <div style="font-size:11px;margin-top:4px">Po pierwszym zapisaniu karty pojazdu zmiany będą tu widoczne.</div>
      </div>`;

    const FIELD_LABELS = {
      marka:'Marka', model:'Model', rok:'Rok', vin:'VIN', typ:'Typ pojazdu',
      dmcMax:'DMC (kg)', paliwo:'Paliwo', kierowca:'Kierowca',
      stanKilometrow:'Stan licznika', normaSpalania:'Norma spalania',
      ocEnd:'OC — koniec', acEnd:'AC — koniec', nextInspection:'Przegląd — termin',
      status:'Status', ownership_type:'Typ własności', miesiacePodatku:'Mies. podatku',
      gmina:'Gmina', uwagi:'Uwagi', leasingEnd:'Leasing — koniec',
      leasingRate:'Rata leasingowa', leasingCompany:'Leasingodawca',
    };

    return log.map(entry => `
      <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:${entry.fields?.length ? '8px' : '0'}">
          <i class="ti ti-edit" style="color:var(--blue);flex-shrink:0"></i>
          <span style="font-weight:600;font-size:12px">${esc(entry.user || 'nieznany')}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:auto;white-space:nowrap">${new Date(entry.ts).toLocaleString('pl-PL')}</span>
        </div>
        ${entry.fields?.length ? `
          <div style="display:flex;flex-direction:column;gap:3px">
            ${entry.fields.map(f => `
              <div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 0;border-top:1px solid var(--bg3)">
                <span style="min-width:130px;color:var(--text3);flex-shrink:0">${FIELD_LABELS[f.field] || esc(f.field)}</span>
                <span style="color:var(--red,#ef4444);text-decoration:line-through;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(f.old ?? '—'))}</span>
                <i class="ti ti-arrow-right" style="color:var(--text3);flex-shrink:0;font-size:10px"></i>
                <span style="color:var(--green,#22c55e);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(f.new ?? '—'))}</span>
              </div>`).join('')}
          </div>` : `<div style="font-size:11px;color:var(--text3)">Zapisano (bez wykrytych zmian w śledzonych polach)</div>`}
      </div>`).join('');
  },

  _renderKmChart(v) {
    const el = document.getElementById('vd-km-history');
    if (!el) return;
    if (!this._vdCharts) this._vdCharts = {};
    if (this._vdCharts.km) { try { this._vdCharts.km.destroy(); } catch {} this._vdCharts.km = null; }

    const hist = [...(v.kmHistory || [])].sort((a, b) => a.date < b.date ? -1 : 1).slice(-24);
    if (hist.length < 2) {
      el.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:10px 0;margin-top:12px"><i class="ti ti-info-circle"></i> Historia przebiegu pojawi się po kolejnym zapisaniu ze zmienionym stanem licznika.</div>`;
      return;
    }
    const isDark = document.documentElement.classList.contains('dark');
    const tc = isDark ? '#9ca3af' : '#6b7280';
    el.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin:18px 0 8px">Historia przebiegu km</div>
      <div style="position:relative;height:140px"><canvas id="vd-km-canvas"></canvas></div>
    `;
    if (!window.Chart) return;
    this._vdCharts.km = new window.Chart(document.getElementById('vd-km-canvas'), {
      type: 'line',
      data: {
        labels: hist.map(h => h.date.slice(5)),
        datasets: [{ label: 'km', data: hist.map(h => h.km), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)', fill: true, tension: 0.3, pointRadius: 3 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: tc, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: tc, font: { size: 10 }, callback: v => v.toLocaleString('pl-PL') }, grid: { color: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)' } },
        },
      },
    });
  },

  _renderFuelChart(v) {
    const el = document.getElementById('vd-fuel-chart-wrap');
    if (!el) return;
    if (!this._vdCharts) this._vdCharts = {};
    if (this._vdCharts.fuel) { try { this._vdCharts.fuel.destroy(); } catch {} this._vdCharts.fuel = null; }

    const history = [...(v.fuelHistory || [])].filter(h => h.km != null && h.km > 0 && h.liters > 0).sort((a, b) => a.km - b.km);
    if (history.length < 3) { el.innerHTML = ''; return; }

    // Segmenty l/100km między kolejnymi tankowaniami z km
    const segments = [];
    for (let i = 1; i < history.length; i++) {
      const kd = history[i].km - history[i-1].km;
      if (kd > 10 && kd < 5000) {
        const month = (history[i].date || '').slice(0, 7);
        if (month) segments.push({ month, l100: history[i].liters / kd * 100 });
      }
    }
    if (!segments.length) { el.innerHTML = ''; return; }

    // Średnia l/100 km per miesiąc
    const byMonth = {};
    segments.forEach(s => {
      if (!byMonth[s.month]) byMonth[s.month] = { sum: 0, n: 0 };
      byMonth[s.month].sum += s.l100;
      byMonth[s.month].n++;
    });
    const labels = Object.keys(byMonth).sort().slice(-12);
    const data   = labels.map(m => +(byMonth[m].sum / byMonth[m].n).toFixed(2));
    const norm   = v.normaSpalania ? parseFloat(v.normaSpalania) : null;

    const isDark = document.documentElement.classList.contains('dark');
    const tc = isDark ? '#9ca3af' : '#6b7280';
    const gc = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)';

    el.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px">Spalanie miesięczne (l/100 km)</div>
      <div style="position:relative;height:160px"><canvas id="vd-fuel-canvas"></canvas></div>
    `;
    if (!window.Chart) return;

    const datasets = [{
      label: 'l/100 km',
      data,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: data.map(d => norm && d > norm * 1.15 ? '#ef4444' : '#3b82f6'),
    }];
    if (norm) datasets.push({ label: `Norma (${norm} l)`, data: labels.map(() => norm), borderColor: '#22c55e', borderDash: [4,4], fill: false, pointRadius: 0 });

    this._vdCharts.fuel = new window.Chart(document.getElementById('vd-fuel-canvas'), {
      type: 'line',
      data: { labels: labels.map(m => m.slice(5)), datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: !!norm, labels: { color: tc, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw} l/100km` } },
        },
        scales: {
          x: { ticks: { color: tc, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: tc, font: { size: 10 }, callback: val => val + ' l' }, grid: { color: gc }, suggestedMin: Math.max(0, Math.min(...data) - 2) },
        },
      },
    });
  },

  _copyLink(nrRej) {
    const url = window.location.origin + window.location.pathname + '?veh=' + encodeURIComponent(nrRej);
    navigator.clipboard?.writeText(url).then(() => {
      window.toast?.('✓ Link skopiowany do schowka: ' + url);
    }).catch(() => {
      prompt('Skopiuj link pojazdu:', url);
    });
  },

  _onArchiveToggle(cb) {
    const reason = document.getElementById('vd-archivedReason');
    if (reason) reason.closest('.vdf').style.opacity = cb.checked ? '1' : '0.4';
  },

  _openChangeNrRej(vehId, oldNrRej) {
    const reasons = [
      ['', '— wybierz powód —'],
      ['tablice_wtorne', 'Tablice wtórne (nowe tablice, ten sam numer)'],
      ['zmiana_numeru', 'Zmiana numeru rejestracyjnego'],
      ['rejestracja_zagraniczna', 'Import / rejestracja zagraniczna'],
      ['inne', 'Inne'],
    ];
    const html = `<div id="change-nrrej-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:6000;display:flex;align-items:center;justify-content:center"
      onclick="if(event.target===this)this.remove()">
      <div style="background:var(--bg);border-radius:var(--radius-lg);width:420px;max-width:95vw;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,.25)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <i class="ti ti-arrows-exchange" style="font-size:20px;color:var(--blue)"></i>
          <strong style="font-size:16px">Zmiana numeru rejestracyjnego</strong>
          <button onclick="document.getElementById('change-nrrej-modal').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:20px;color:var(--text2)" aria-label="Zamknij">×</button>
        </div>
        <div class="f" style="margin-bottom:12px">
          <label style="font-size:12px;color:var(--text2)">Obecny numer</label>
          <input class="fi" value="${esc(oldNrRej)}" readonly style="opacity:.6">
        </div>
        <div class="f" style="margin-bottom:12px">
          <label style="font-size:12px;color:var(--text2)">Nowy numer rejestracyjny</label>
          <input id="new-nrrej-input" class="fi" placeholder="np. WGM12345" style="text-transform:uppercase">
        </div>
        <div class="f" style="margin-bottom:20px">
          <label style="font-size:12px;color:var(--text2)">Powód zmiany</label>
          <select id="change-nrrej-reason" class="fi">
            ${reasons.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:var(--radius);padding:10px;font-size:11px;color:#92400e;margin-bottom:16px">
          <i class="ti ti-alert-triangle"></i> Operacja zaktualizuje numer we wszystkich powiązanych rekordach i jest nieodwracalna.
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-gray" onclick="document.getElementById('change-nrrej-modal').remove()">Anuluj</button>
          <button class="btn btn-blue" data-vid="${vehId}" data-nrrej="${esc(oldNrRej)}" onclick="TaxOrderVehicleDetail._doChangeNrRej(+this.dataset.vid,this.dataset.nrrej)">
            <i class="ti ti-arrows-exchange"></i>Zmień
          </button>
        </div>
      </div>
    </div>`;
    document.getElementById('change-nrrej-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('new-nrrej-input')?.focus();
  },

  async _doChangeNrRej(vehId, oldNrRej) {
    const newNrRej = (document.getElementById('new-nrrej-input')?.value || '').trim().toUpperCase();
    const reason = document.getElementById('change-nrrej-reason')?.value || '';
    if (!newNrRej) { window.toast?.('Podaj nowy numer rejestracyjny'); return; }
    if (!reason) { window.toast?.('Wybierz powód zmiany'); return; }
    const btn = document.querySelector('#change-nrrej-modal .btn-blue');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader ti-spin"></i>Zmieniam...'; }

    const API = window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
    const token = localStorage.getItem('cf_token');
    const company = window.currentCompanyId || 'mtoilet';
    const r = await fetch(`${API}/api/vehicles/change-nrrej?company=${company}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ old_nr_rej: oldNrRej, new_nr_rej: newNrRej, reason, company_id: company }),
    });
    const d = await r.json().catch(() => ({}));
    document.getElementById('change-nrrej-modal')?.remove();
    if (r.ok) {
      window.toast?.(`✓ Numer rejestracyjny zmieniony: ${oldNrRej} → ${newNrRej}`);
      // Przeładuj listę pojazdów i zamknij kartę
      if (typeof window.loadVehicles === 'function') await window.loadVehicles();
      document.getElementById('vehicle-detail-panel')?.remove();
    } else {
      window.toast?.('Błąd: ' + (d.error || r.status));
    }
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

  async _cepikKierowcaCheck(vehId) {
    const imie      = (document.getElementById('vd-kierowcaImie')?.value      || '').trim();
    const nazwisko  = (document.getElementById('vd-kierowcaNazwisko')?.value  || '').trim();
    const nrBlankietu = (document.getElementById('vd-kierowcaNrPrawJazdy')?.value || '').trim();
    if (!imie || !nazwisko || !nrBlankietu) {
      return toast('Wpisz imię, nazwisko i numer blankietu prawa jazdy przed sprawdzeniem');
    }
    const statusEl = document.getElementById(`vd-cepik-status-${vehId}`);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--text3)">⏳ Sprawdzanie…</span>';

    try {
      const r = await fetch(`${window.CF_WORKER_URL}/api/cepik/kierowca-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('cf_token') || '') },
        body: JSON.stringify({ imie, nazwisko, nrBlankietu, vehId }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await r.json().catch(() => ({ ok: false, message: 'Błąd odpowiedzi serwera' }));

      if (!d.configured) {
        if (statusEl) statusEl.innerHTML =
          `<span style="color:var(--warning)">⚠ API CEPiK 2.0 nie skonfigurowane</span><br>
           <small style="color:var(--text3)">${esc(d.message || '')}</small>`;
        return;
      }
      if (!d.ok) {
        if (statusEl) statusEl.innerHTML =
          `<span style="color:var(--danger)">✗ ${esc(d.message || 'Błąd weryfikacji')}</span>`;
        return;
      }

      const statusMap = {
        valid:      '<span style="color:var(--success)">✓ Uprawnienia ważne</span>',
        suspended:  '<span style="color:var(--danger)">✗ Prawo jazdy zatrzymane</span>',
        expired:    '<span style="color:var(--warning)">⚠ Prawo jazdy wygasło</span>',
        not_found:  '<span style="color:var(--text3)">Brak danych w CEPiK</span>',
      };
      const statusHtml = statusMap[d.status] ?? `<span>${esc(d.status || 'Nieznany')}</span>`;
      const katHtml = d.kategorie ? `<br><small>Kat: ${esc(d.kategorie)}</small>` : '';
      const dataHtml = d.dataWaznosci ? `<br><small>Ważne do: ${esc(d.dataWaznosci)}</small>` : '';
      const checkDate = new Date().toISOString().slice(0,10);

      if (statusEl) statusEl.innerHTML =
        `${statusHtml}${katHtml}${dataHtml}<br><small style="color:var(--text3)">Sprawdzono: ${esc(checkDate)}</small>`;

      // Aktualizuj lokalne pole kierowcaKategorieJazdy jeśli CEPiK zwrócił kategorie
      if (d.kategorie) {
        const katEl = document.getElementById('vd-kierowcaKategorieJazdy');
        if (katEl && !katEl.value) katEl.value = d.kategorie;
      }
    } catch (e) {
      if (statusEl) statusEl.innerHTML =
        `<span style="color:var(--danger)">✗ Błąd: ${esc(e.message)}</span>`;
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

  // ── Auto-obliczanie miesięcy podatkowych z dat pojazdu ───────────────────
  _autoCalcMiesiace(vehId) {
    if (typeof window.calcMiesiacePodatku !== 'function') return;
    const v = (window.vehs || []).find(x => x.id === vehId);
    if (!v) return;

    // Zbierz aktualne wartości z formularza
    const g  = id => document.getElementById('vd-' + id)?.value?.trim() || null;
    const vProxy = {
      ...v,
      purchaseDate:       g('purchaseDate')       || v.purchaseDate,
      dataNabycia:        g('purchaseDate')       || v.dataNabycia,
      saleDate:           g('saleDate')           || v.saleDate,
      dataZbycia:         g('saleDate')           || v.dataZbycia,
      dataWycofania:      g('dataWycofania')      || v.dataWycofania,
      dataDopuszczenia:   g('dataDopuszczenia')   || v.dataDopuszczenia,
      dataWyrejestrowania:g('dataWyrejestrowania')|| v.dataWyrejestrowania,
    };

    const rok = new Date().getFullYear();
    const m = window.calcMiesiacePodatku(vProxy, rok);

    const inp = document.getElementById('vd-miesiacePodatku');
    if (inp) {
      inp.value = Math.max(1, m || 12);
      inp.dispatchEvent(new Event('change'));
    }

    const hint = document.getElementById('vd-miesiace-hint');
    if (hint) {
      if (!vProxy.purchaseDate && !vProxy.dataNabycia) {
        hint.textContent = `Brak daty nabycia — przyjęto pełny rok (${rok}).`;
      } else {
        const parts = [];
        if (vProxy.purchaseDate || vProxy.dataNabycia) {
          parts.push(`Nabycie: ${vProxy.purchaseDate || vProxy.dataNabycia}`);
        }
        if (vProxy.saleDate || vProxy.dataZbycia || vProxy.dataWyrejestrowania) {
          parts.push(`Zbycie/wyrej.: ${vProxy.saleDate || vProxy.dataZbycia || vProxy.dataWyrejestrowania}`);
        }
        if (vProxy.dataWycofania) {
          parts.push(`Wycofanie: ${vProxy.dataWycofania}${vProxy.dataDopuszczenia ? ' → ' + vProxy.dataDopuszczenia : ' (bez daty przywrócenia)'}`);
        }
        hint.textContent = `Auto: ${m} mies. (${rok}) · ${parts.join(' · ')}`;
      }
    }
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
      document.getElementById('vd-assStart')    && (document.getElementById('vd-assStart').value    = g('ocStart'));
      document.getElementById('vd-assEnd')      && (document.getElementById('vd-assEnd').value      = g('ocEnd'));
    }
  },

  // ── NIP lookup (MF Biała Lista) ───────────────────────────────────────────
  _nipLookup(nip, nameInputId, statusId) {
    const clean = (nip||'').replace(/[^0-9]/g,'');
    if (clean.length !== 10) return;
    const statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.textContent = 'Szukam...';
    const today = (d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date());
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

  _insertNote(tpl) {
    const ta = document.getElementById('vd-uwagi');
    if (!ta) return;
    const cur = ta.value.trim();
    ta.value = cur ? cur + '\n' + tpl : tpl;
    this._dirty = true;
    ta.focus();
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
        <input id="vd-tire${pos}_size" type="text" class="fi" value="${esc(tire.size||'')}" placeholder="205/55R16">
      </div>
      <div class="vdf">
        <label class="vdl">Marka / producent</label>
        <input id="vd-tire${pos}_brand" type="text" class="fi" value="${esc(tire.brand||'')}" placeholder="np. Michelin">
      </div>
      <div class="vdf">
        <label class="vdl">Rok DOT (4 cyfry, np. 3523)</label>
        <input id="vd-tire${pos}_dot" type="text" class="fi" maxlength="4" pattern="\\d{4}"
          value="${esc(tire.dot||'')}" placeholder="3523"
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
