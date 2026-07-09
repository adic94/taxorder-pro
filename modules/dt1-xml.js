/**
 * TaxOrder Pro — Eksport DT-1 / DT-1A do XML
 *
 * Struktura zgodna z oficjalnym schematem MF DT-1(6):
 *   http://crd.gov.pl/wzor/2019/02/28/7206/
 *
 * Źródło weryfikacji:
 *   - schemat.xsd z Hogart RTM Lite (Structure/Podmiot1/P_B*)
 *   - styl.xsl z Hogart RTM Lite (kolejność pól sekcji D)
 *   - Rzeczywisty plik DT-1 wygenerowany + podpisany przez
 *     moja.warszawa19115.pl (potwierdzenie kolejności P_B*)
 *
 * Mapowanie kategorii D formularza → pola XML:
 *   D.1  (ciężarowe 3.5–5.5t)        P_20 P_21 P_22  P_23
 *   D.2  (ciężarowe 5.5–9t)           P_24 P_25 P_26  P_27
 *   D.3  (ciężarowe 9–12t)            P_28 P_29 P_30  P_31
 *   D.4  (ciągniki 3.5–12t)           P_32 P_33 P_34  P_35
 *   D.5  (przyczepy/naczepy 7–12t)    P_36 P_37 P_38  P_39
 *   D.6  (autobusy < 22 miejsc)       P_40 P_41 P_42  P_43
 *   D.7  (autobusy ≥ 22 miejsc)       P_44 P_45 P_46  P_47
 *   D.8  (ciężarowe ≥12t, 2 osie)     P_48 P_49 P_50  P_51
 *   D.9  (ciężarowe ≥12t, 3 osie)     P_52 P_53 P_54  P_55
 *   D.10 (ciężarowe ≥12t, 4+ osie)    P_56 P_57 P_58  P_59
 *   D.11 (ciągniki ≥12t, ≤2 osie)     P_60 P_61 P_62  P_63
 *   D.12 (ciągniki ≥12t, 3+ osie)     P_64 P_65 P_66  P_67
 *   D.13 (przyczepy/naczepy ≥12t, 1)  P_68 P_69 P_70  P_71
 *   D.14 (przyczepy/naczepy ≥12t, 2)  P_72 P_73 P_74  P_75
 *   D.15 (przyczepy/naczepy ≥12t, 3+) P_76 P_77 P_78  P_79
 *   Suma ogółem P_80, rata I P_81, rata II P_82
 *
 * Format liczników per kategoria (P_X0..P_X3):
 *   P_N0 = liczba pojazdów wyłączny właściciel
 *   P_N1 = liczba pojazdów współwłaściciel wpisany jako 1. w DR
 *   P_N2 = liczba pojazdów współwłaściciel NIE wpisany jako 1.
 *   P_N3 = kwota podatku
 *
 * Kolejność pól P_B w DT-1/A (zweryfikowana na rzeczywistym pliku XML):
 *   P_B1  własność słownie ("właściciel" / "współwłaściciel-1" / "współwłaściciel-2")
 *   P_B2  typ pojazdu słownie ("samochód ciężarowy" itp.)
 *   P_B3  data pierwszej rejestracji (YYYY-MM-DD)
 *   P_B4  numer rejestracyjny
 *   P_B5  numer VIN
 *   P_B6  marka i model (format "Marka/Model")
 *   P_B7  rok produkcji
 *   P_B8  data nabycia (YYYY-MM-DD)
 *   P_B9  data wycofania z ruchu (YYYY-MM-DD lub puste)
 *   P_B10 data dopuszczenia do ruchu (YYYY-MM-DD lub puste)
 *   P_B11 data wyrejestrowania (YYYY-MM-DD lub puste)
 *   P_B12 puste
 *   P_B13 puste
 *   P_B14 DMC w tonach (polska notacja z przecinkiem, np. "9,5")
 *   P_B15 DMC zestawu w tonach (dla naczep/ciągników, lub puste)
 *   P_B16 liczba osi
 *   P_B17 zawieszenie słownie ("pneumatyczne" / "mechaniczne" / "inne")
 *   P_B18 puste
 *   P_B19 puste
 *   P_B20 liczba miesięcy podatkowych
 *   P_B20_1 norma ekologiczna (np. "Euro (UE/EKG ONZ) Euro 6/VI" lub puste)
 *   P_B20_gazowa..P_B20_7 paliwa alternatywne (puste jeśli nie dotyczy)
 *   P_B21 kwota podatku
 *   P_B22 puste
 */
window.DT1XML = (function () {

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function _fmt2(n)    { return n != null ? Number(n).toFixed(2) : '0.00'; }
  function _fmtDate(d) { if (!d) return ''; try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; } }

  // kg → tony, polska notacja z przecinkiem (np. 9500 → "9,5")
  function _fmtT(kg) {
    if (!kg) return '';
    const t = Number(kg) / 1000;
    return t.toString().replace('.', ',');
  }

  // Przyczyny złożenia deklaracji (poz.18 formularza)
  const CEL_MAP = {
    'DEKLARACJA SKLADANA DO 15 LUTEGO':       '1',
    'POWSTANIE OBOWIAZKU W TRAKCIE ROKU':     '2',
    'WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU':   '3',
    'ZMIANA MIEJSCA ZAMIESZKANIA LUB SIEDZIBY': '4',
    'KOREKTA DEKLARACJI':                     '5',
    'PRZEDLUZENIE WYCOFANIA':                 '6',
  };

  // Kategoria DT-1 → [P_count_wlasciciel, P_count_wspolwl1, P_count_wspolwl2, P_kwota]
  const CAT_POS = {
    D1:  [20, 21, 22, 23],
    D2:  [24, 25, 26, 27],
    D3:  [28, 29, 30, 31],
    D4:  [32, 33, 34, 35],
    D5:  [36, 37, 38, 39],
    D6:  [40, 41, 42, 43],
    D7:  [44, 45, 46, 47],
    D8:  [48, 49, 50, 51],
    D9:  [52, 53, 54, 55],
    D10: [56, 57, 58, 59],
    D11: [60, 61, 62, 63],
    D12: [64, 65, 66, 67],
    D13: [68, 69, 70, 71],
    D14: [72, 73, 74, 75],
    D15: [76, 77, 78, 79],
  };

  const POUCZENIE = 'W przypadku niewpłacenia w obowiązującym terminie kwoty podatku (raty podatku) od środków transportowych z poz. 81 i 82 lub wpłacenia jej w niepełnej wysokości, niniejsza deklaracja stanowi podstawę do wystawienia tytułu wykonawczego, zgodnie z przepisami ustawy z dnia 17 czerwca 1966 r. o postępowaniu egzekucyjnym w administracji (Dz. U. z 2018 r. poz. 1314, z późn. zm.). Za podanie nieprawdy lub zatajenie prawdy i przez to narażenie podatku na uszczuplenie grozi odpowiedzialność przewidziana w Kodeksie karnym skarbowym.';

  function _getFormData() {
    const g = id => (document.getElementById(id) || {}).value || '';
    return {
      yr:           g('taxYearDT1') || g('taxYear') || String(new Date().getFullYear()),
      nip:          g('tp-nip').replace(/[-\s]/g, ''),
      name:         g('tp-name'),
      street:       g('tp-street'),
      houseNo:      g('tp-house-no') || '',
      city:         g('tp-city'),
      postcode:     g('tp-postcode'),
      gmina:        g('tp-gmina') || '',
      urzadNazwa:   g('tp-urzad-nazwa') || g('tp-gmina') || '',
      kodUrzedu:    g('tp-kod-urzedu') || '',
      cel:          CEL_MAP[g('tp-cel')] || '1',
      rodzaj:       g('tp-rodzaj') || 'niefizyczny',
      pesel:        g('tp-pesel') || '',
      nazwisko:     g('tp-nazwisko') || '',
      imie:         g('tp-imie') || '',
    };
  }

  function _taxableVehs() {
    const allVehs = window.vehs || [];
    const sel = window.selected || new Set();
    const list = sel.size > 0
      ? allVehs.filter(v => sel.has(v.id))
      : allVehs.filter(v => v.is_active !== false);
    return list.map(v => {
      const cat    = typeof getCat === 'function' ? getCat(v) : (window.TaxEngine?.getCat(v) ?? null);
      const taxR   = window.TaxEngine?.calcTax(v) ?? {};
      const rate   = taxR.rate ?? (typeof getRate === 'function' ? getRate(v) : 0) ?? 0;
      const months = Math.min(Math.max(parseInt(v.miesiacePodatku) || 12, 1), 12);
      const amount = cat ? Math.round((rate * months) / 12 * 100) / 100 : 0;
      return { v, cat, rate, amount, months };
    }).filter(x => x.cat);
  }

  function _nsDecl() {
    return [
      'xmlns:wnio="http://crd.gov.pl/wzor/2019/02/28/7206/"',
      'xmlns:adr="http://crd.gov.pl/xml/schematy/adres/2009/11/09/"',
      'xmlns:inst="http://crd.gov.pl/xml/schematy/instytucja/2009/11/16/"',
      'xmlns:meta="http://crd.gov.pl/xml/schematy/meta/2009/11/16/"',
      'xmlns:oso="http://crd.gov.pl/xml/schematy/osoba/2009/11/16/"',
      'xmlns:str="http://crd.gov.pl/xml/schematy/struktura/2009/11/16/"',
      'xmlns:ds="http://www.w3.org/2000/09/xmldsig#"',
      'xmlns:xs="http://www.w3.org/2001/XMLSchema"',
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      'xsi:schemaLocation="http://crd.gov.pl/wzor/2019/02/28/7206/ http://crd.gov.pl/wzor/2019/02/28/7206/schemat.xsd"',
    ].join('\n                 ');
  }

  function _buildOpisDokumentu(form, today) {
    return [
      `  <wnio:OpisDokumentu>`,
      `    <str:CID>@epuap.gov.pl</str:CID>`,
      `    <meta:Data typDaty="stworzony">`,
      `      <meta:Czas>${today}</meta:Czas>`,
      `    </meta:Data>`,
      `    <meta:Identyfikator typIdentyfikatora="idFormularza">`,
      `      <meta:Wartosc>TaxOrderPro/DT-1_6</meta:Wartosc>`,
      `    </meta:Identyfikator>`,
      `    <meta:RodzajDokumentu>`,
      `      <meta:Kategoria>tekst</meta:Kategoria>`,
      `    </meta:RodzajDokumentu>`,
      `    <meta:Jezyk kodJezyka="pol"/>`,
      `    <meta:OpisDokumentu>DEKLARACJA NA PODATEK OD ŚRODKÓW TRANSPORTOWYCH</meta:OpisDokumentu>`,
      `  </wnio:OpisDokumentu>`,
    ].join('\n');
  }

  function _buildDaneDokumentu(form) {
    const isFiz = form.rodzaj === 'fizyczny';
    return [
      `  <wnio:DaneDokumentu>`,
      `    <str:Adresaci>`,
      `      <meta:Podmiot>`,
      `        <inst:Instytucja>`,
      `          <inst:NazwaInstytucji>${_esc(form.urzadNazwa.toUpperCase())}</inst:NazwaInstytucji>`,
      `        </inst:Instytucja>`,
      `      </meta:Podmiot>`,
      `    </str:Adresaci>`,
      `    <str:Nadawcy>`,
      `      <meta:Podmiot>`,
      `        <oso:Osoba>`,
      `          <oso:IdOsoby>`,
      `            <oso:PESEL>${_esc(isFiz ? form.pesel : '')}</oso:PESEL>`,
      `            <oso:NIP>${_esc(form.nip)}</oso:NIP>`,
      `          </oso:IdOsoby>`,
      `          <oso:Imie>${_esc(isFiz ? form.imie : '')}</oso:Imie>`,
      `          <oso:Nazwisko>${_esc(isFiz ? form.nazwisko : '')}</oso:Nazwisko>`,
      `          <adr:Adres>`,
      `            <adr:KodPocztowy>${_esc(form.postcode)}</adr:KodPocztowy>`,
      `            <adr:Miejscowosc>${_esc(form.city)}</adr:Miejscowosc>`,
      `            <adr:Ulica>${_esc(form.street)}</adr:Ulica>`,
      `            <adr:Budynek>${_esc(form.houseNo)}</adr:Budynek>`,
      `          </adr:Adres>`,
      `        </oso:Osoba>`,
      `      </meta:Podmiot>`,
      `    </str:Nadawcy>`,
      `  </wnio:DaneDokumentu>`,
    ].join('\n');
  }

  function _buildPodmiot1(form) {
    const isFiz = form.rodzaj === 'fizyczny';
    const r = isFiz ? '1' : '2';
    return [
      `    <wnio:Podmiot1 rodzaj="${r}" rola="podatnik">`,
      `      <wnio:OsobaNiefizyczna>`,
      `        <wnio:NIP>${isFiz ? '' : _esc(form.nip)}</wnio:NIP>`,
      `        <wnio:NazwaPelna>${isFiz ? '' : _esc(form.name)}</wnio:NazwaPelna>`,
      `      </wnio:OsobaNiefizyczna>`,
      `      <wnio:OsobaFizyczna>`,
      `        <wnio:NIP>${isFiz ? _esc(form.nip) : ''}</wnio:NIP>`,
      `        <oso:PESEL>${_esc(form.pesel)}</oso:PESEL>`,
      `        <oso:Nazwisko>${_esc(isFiz ? form.nazwisko : '')}</oso:Nazwisko>`,
      `        <oso:Imie>${_esc(isFiz ? form.imie : '')}</oso:Imie>`,
      `        <wnio:DataUrodzenia/>`,
      `      </wnio:OsobaFizyczna>`,
      `      <wnio:AdresZamieszkaniaSiedziby rodzajAdresu="RAD">`,
      `        <adr:KodPocztowy>${_esc(form.postcode)}</adr:KodPocztowy>`,
      `        <adr:Miejscowosc>${_esc(form.city)}</adr:Miejscowosc>`,
      `        <adr:Ulica>${_esc(form.street)}</adr:Ulica>`,
      `        <adr:Budynek>${_esc(form.houseNo)}</adr:Budynek>`,
      `        <adr:Lokal/>`,
      `        <adr:Kraj>PL</adr:Kraj>`,
      `        <adr:Gmina>${_esc(form.gmina)}</adr:Gmina>`,
      `        <adr:Uwagi/>`,
      `      </wnio:AdresZamieszkaniaSiedziby>`,
      `    </wnio:Podmiot1>`,
    ].join('\n');
  }

  // ── DT-1 (główna deklaracja) ──────────────────────────────────────────────────
  function exportXML() {
    const form    = _getFormData();
    const taxable = _taxableVehs();

    if (!taxable.length) { toast('⚠ Brak pojazdów opodatkowanych do eksportu'); return; }

    const cats = {};
    for (const { v, cat, amount } of taxable) {
      if (!cats[cat]) cats[cat] = { n0: 0, n1: 0, n2: 0, amount: 0 };
      const own = (v.ownership_type || 'właściciel');
      if      (own === 'współwłaściciel-1') cats[cat].n1++;
      else if (own === 'współwłaściciel-2') cats[cat].n2++;
      else                                                        cats[cat].n0++;
      cats[cat].amount += amount;
    }

    const total = taxable.reduce((s, x) => s + x.amount, 0);
    const r1    = Math.round(total / 2);
    const r2    = Math.round(total) - r1;
    const today = new Date().toISOString().slice(0, 10);

    const x = [];
    x.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`);
    x.push(`<?xml-stylesheet type="text/xsl" href="http://crd.gov.pl/wzor/2019/02/28/7206/styl.xsl"?>`);
    x.push(`<wnio:Dokument ${_nsDecl()}>`);

    x.push(_buildOpisDokumentu(form, today));
    x.push(_buildDaneDokumentu(form));

    x.push(`  <wnio:TrescDokumentu format="text/xml; charset=&quot;utf-8&quot;" kodowanie="XML">`);
    x.push(`    <wnio:Wartosc>`);

    x.push(`      <wnio:Naglowek>`);
    x.push(`        <wnio:KodFormularza>DT-1</wnio:KodFormularza>`);
    x.push(`        <wnio:WariantFormularza>6</wnio:WariantFormularza>`);
    x.push(`        <wnio:Rok>${_esc(form.yr)}</wnio:Rok>`);
    x.push(`        <wnio:WersjaSchemy>1-0</wnio:WersjaSchemy>`);
    x.push(`      </wnio:Naglowek>`);

    x.push(`      <wnio:MiejsceSkladaniaDeklaracji>${_esc(form.urzadNazwa || form.gmina)}</wnio:MiejsceSkladaniaDeklaracji>`);
    x.push(_buildPodmiot1(form));
    x.push(`      <wnio:PrzyczynyZlozeniaDeklaracji>${form.cel}</wnio:PrzyczynyZlozeniaDeklaracji>`);
    x.push(`      <wnio:PoprzednieMiejsceSkladania/>`);
    x.push(`      <wnio:DataZmiany/>`);

    // Kategorie D.1–D.15 — wszystkie P_20..P_82 muszą być obecne (wartość 0 gdy puste)
    const allP = {};
    for (const [cat, data] of Object.entries(cats)) {
      const pos = CAT_POS[cat];
      if (!pos) continue;
      allP[pos[0]] = data.n0;
      allP[pos[1]] = data.n1;
      allP[pos[2]] = data.n2;
      allP[pos[3]] = _fmt2(data.amount);
    }
    for (let i = 20; i <= 79; i++) {
      x.push(`      <wnio:P_${i}>${allP[i] != null ? allP[i] : '0'}</wnio:P_${i}>`);
    }
    x.push(`      <wnio:P_80>${_fmt2(total)}</wnio:P_80>`);
    x.push(`      <wnio:P_81>${r1}</wnio:P_81>`);
    x.push(`      <wnio:P_82>${r2}</wnio:P_82>`);

    x.push(`      <wnio:Pouczenie>${_esc(POUCZENIE)}</wnio:Pouczenie>`);

    // DT-1/A wewnątrz deklaracji (per schemat)
    x.push(`      <wnio:Zalacznik_DT-1A>`);
    for (const { v, cat, amount, months } of taxable) {
      x.push(_buildPB(v, cat, amount, months));
    }
    x.push(`      </wnio:Zalacznik_DT-1A>`);

    x.push(`    </wnio:Wartosc>`);
    x.push(`  </wnio:TrescDokumentu>`);
    x.push(`</wnio:Dokument>`);

    _download(x.join('\n'), `DT-1_${form.nip}_${form.yr}.xml`);
    toast(`✓ DT-1 XML: ${taxable.length} pojazd(ów), podatek ${_fmt2(total)} zł`);
  }

  // ── Budowanie rekordu P_B (jeden pojazd w DT-1/A) ────────────────────────────
  function _buildPB(v, cat, amount, months) {
    const own = (v.ownership_type || 'właściciel');
    const typ = (v.typ || '').toLowerCase();
    const dmc = v.dmc ?? v.dmcMax ?? 0;
    const isNacz = typ.includes('naczepa') || typ.includes('przyczepa');
    const isCiag = typ.includes('ciągnik') || typ.includes('ciagnik');

    const markaModel = [v.marka, v.model].filter(Boolean).join('/') || '';

    const lines = [];
    lines.push(`        <wnio:P_B>`);
    lines.push(`          <wnio:P_B1>${_esc(own)}</wnio:P_B1>`);
    lines.push(`          <wnio:P_B2>${_esc(v.typ || '')}</wnio:P_B2>`);
    lines.push(`          <wnio:P_B3>${_esc(_fmtDate(v.dataRejestracji || v.dataRej || ''))}</wnio:P_B3>`);
    lines.push(`          <wnio:P_B4>${_esc(v.nrRej || v.nr_rej || '')}</wnio:P_B4>`);
    lines.push(`          <wnio:P_B5>${_esc(v.vin || '')}</wnio:P_B5>`);
    lines.push(`          <wnio:P_B6>${_esc(markaModel)}</wnio:P_B6>`);
    lines.push(`          <wnio:P_B7>${v.rok || ''}</wnio:P_B7>`);
    lines.push(`          <wnio:P_B8>${_esc(_fmtDate(v.dataNabycia || v.purchaseDate || ''))}</wnio:P_B8>`);
    lines.push(`          <wnio:P_B9>${_esc(_fmtDate(v.dataWycofania || ''))}</wnio:P_B9>`);
    lines.push(`          <wnio:P_B10>${_esc(_fmtDate(v.dataDopuszczenia || ''))}</wnio:P_B10>`);
    lines.push(`          <wnio:P_B11>${_esc(_fmtDate(v.dataWyrejestrowania || v.saleDate || ''))}</wnio:P_B11>`);
    lines.push(`          <wnio:P_B12/>`);
    lines.push(`          <wnio:P_B13/>`);
    lines.push(`          <wnio:P_B14>${_fmtT(dmc)}</wnio:P_B14>`);
    lines.push(`          <wnio:P_B15>${(isNacz || isCiag) && v.dmcZespolu > 0 ? _fmtT(v.dmcZespolu) : ''}</wnio:P_B15>`);
    lines.push(`          <wnio:P_B16>${parseInt(v.osie) || 2}</wnio:P_B16>`);
    lines.push(`          <wnio:P_B17>${_esc(v.zawieszenie || '')}</wnio:P_B17>`);
    lines.push(`          <wnio:P_B18/>`);
    lines.push(`          <wnio:P_B19/>`);
    lines.push(`          <wnio:P_B20>${months}</wnio:P_B20>`);
    lines.push(`          <wnio:P_B20_1>${_esc(v.normaNorma || v.normaEuro || '')}</wnio:P_B20_1>`);
    lines.push(`          <wnio:P_B20_gazowa/>`);
    lines.push(`          <wnio:P_B20_elektryczny/>`);
    lines.push(`          <wnio:P_B20_hybrydowy/>`);
    lines.push(`          <wnio:P_B20_gaz_ziemny/>`);
    lines.push(`          <wnio:P_B20_wodor/>`);
    lines.push(`          <wnio:P_B20_7/>`);
    lines.push(`          <wnio:P_B21>${_fmt2(amount)}</wnio:P_B21>`);
    lines.push(`          <wnio:P_B22/>`);
    lines.push(`        </wnio:P_B>`);
    return lines.join('\n');
  }

  // Eksport samego DT-1/A jako osobny plik (do podglądu/debugowania)
  function exportAttachmentXML() {
    const form    = _getFormData();
    const taxable = _taxableVehs();
    if (!taxable.length) { toast('⚠ Brak pojazdów'); return; }

    const today = new Date().toISOString().slice(0, 10);
    const x = [];
    x.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`);
    x.push(`<wnio:Dokument ${_nsDecl()}>`);
    x.push(`  <wnio:TrescDokumentu format="text/xml; charset=&quot;utf-8&quot;" kodowanie="XML">`);
    x.push(`    <wnio:Wartosc>`);
    x.push(`      <wnio:Naglowek>`);
    x.push(`        <wnio:KodFormularza>DT-1/A</wnio:KodFormularza>`);
    x.push(`        <wnio:WariantFormularza>6</wnio:WariantFormularza>`);
    x.push(`        <wnio:Rok>${_esc(form.yr)}</wnio:Rok>`);
    x.push(`        <wnio:WersjaSchemy>1-0</wnio:WersjaSchemy>`);
    x.push(`      </wnio:Naglowek>`);
    x.push(`      <wnio:Zalacznik_DT-1A>`);
    for (const { v, cat, amount, months } of taxable) {
      x.push(_buildPB(v, cat, amount, months));
    }
    x.push(`      </wnio:Zalacznik_DT-1A>`);
    x.push(`    </wnio:Wartosc>`);
    x.push(`  </wnio:TrescDokumentu>`);
    x.push(`</wnio:Dokument>`);

    _download(x.join('\n'), `DT-1A_${form.nip}_${form.yr}.xml`);
    toast(`✓ DT-1/A XML: ${taxable.length} pojazd(ów)`);
  }

  function _download(xml, filename) {
    const blob = new Blob([xml], { type: 'application/xml;charset=UTF-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return { exportXML, exportAttachmentXML };
})();
