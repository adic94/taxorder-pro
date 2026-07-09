/**
 * TaxOrder Pro — Eksport DT-1 / DT-1A do XML (ePUAP / e-Deklaracje)
 *
 * Struktura zgodna z oficjalnym schematem MF DT-1(6):
 *   https://crd.gov.pl/wzor/2019/02/28/7206/
 * Mapowanie pól P_20–P_82 zweryfikowane na podstawie styl.xsl RTM Lite i papierowego formularza MF.
 *
 * Sekcja D formularza DT-1 — mapowanie kategorii → pól XML:
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
 * Format kolumn (P_X0..P_X3 dla każdej kategorii):
 *   P_N0 = liczba pojazdów (wyłączny właściciel)
 *   P_N1 = liczba pojazdów (współwłaściciel wpisany jako 1. w DR)
 *   P_N2 = liczba pojazdów (współwłaściciel NIE wpisany jako 1.)
 *   P_N3 = kwota podatku
 */
window.DT1XML = (function () {

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function _fmt2(n)     { return n != null ? Number(n).toFixed(2) : '0.00'; }
  function _fmtT(kg)    { return kg ? (Number(kg) / 1000).toFixed(3) : '0.000'; }  // kg → tony (format DT-1)
  function _fmtDate(d)  { if (!d) return ''; try { return new Date(d).toISOString().slice(0, 10); } catch { return d; } }
  function _int(v)      { return String(Math.round(Number(v) || 0)); }

  // Cel złożenia: klucz z selecta → numer w deklaracji
  const CEL_MAP = {
    'DEKLARACJA SKLADANA DO 15 LUTEGO':     '1',
    'POWSTANIE OBOWIAZKU W TRAKCIE ROKU':   '2',
    'WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU': '3',
    'ZMIANA MIEJSCA ZAMIESZKANIA LUB SIEDZIBY': '4',
    'KOREKTA DEKLARACJI':                   '5',
    'PRZEDLUZENIE WYCOFANIA':               '6',
  };

  // Kategoria DT-1 → [P_count1, P_count2, P_count3, P_amount]
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

  // Typ pojazdu → kod w DT-1A (P_B2)
  const VEH_TYPE_CODE = {
    'samochód ciężarowy':  '1',
    'ciągnik siodłowy':    '2',
    'ciągnik balastowy':   '3',
    'przyczepa':           '4',
    'naczepa':             '5',
    'autobus':             '6',
  };

  // Zawieszenie → kod w DT-1A (P_B9): 1=pneumatyczne, 2=równoważne, 3=inne
  const SUSP_CODE = {
    'pneumatyczne': '1',
    'mechaniczne':  '3',
    'inne':         '3',
  };

  function _getFormData() {
    const g = id => (document.getElementById(id) || {}).value || '';
    return {
      yr:       g('taxYearDT1') || g('taxYear') || String(new Date().getFullYear()),
      nip:      g('tp-nip').replace(/[-\s]/g, ''),
      name:     g('tp-name'),
      street:   g('tp-street'),
      houseNo:  g('tp-house-no') || '',
      city:     g('tp-city'),
      postcode: g('tp-postcode'),
      kodUrzedu:g('tp-kod-urzedu') || '1435',
      cel:      CEL_MAP[g('tp-cel')] || '1',
      rodzaj:   g('tp-rodzaj') || 'niefizyczny',
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

  // ── Eksport DT-1 (główna deklaracja) ─────────────────────────────────────────
  function exportXML() {
    const form   = _getFormData();
    const taxable = _taxableVehs();

    if (!taxable.length) { toast('⚠ Brak pojazdów opodatkowanych do eksportu'); return; }

    // Agregacja po kategorii
    const cats = {};
    for (const { v, cat, amount } of taxable) {
      if (!cats[cat]) cats[cat] = { count1: 0, count2: 0, count3: 0, amount: 0 };
      const own = (v.ownership_type || 'właściciel');
      if      (own === 'współwłaściciel-1') cats[cat].count2++;
      else if (own === 'współwłaściciel-2') cats[cat].count3++;
      else                                  cats[cat].count1++;
      cats[cat].amount += amount;
    }

    const total = taxable.reduce((s, x) => s + x.amount, 0);
    const r1    = Math.round(total / 2);
    const r2    = Math.round(total) - r1;
    const today = new Date().toISOString().slice(0, 10);
    const isFiz = form.rodzaj === 'fizyczny';

    const x = [];
    x.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    x.push(`<Deklaracja xmlns="http://crd.gov.pl/wzor/2023/12/13/13654/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`);

    // Nagłówek
    x.push(`  <Naglowek>`);
    x.push(`    <KodFormularza kodSystemowy="DT-1 (6)" kodPodatku="DT" rodzajZobowiazania="Z" wersjaSchemy="1-0E">DT-1</KodFormularza>`);
    x.push(`    <WariantFormularza>6</WariantFormularza>`);
    x.push(`    <CelZlozenia poz="P_6">${form.cel}</CelZlozenia>`);
    x.push(`    <Rok>${_esc(form.yr)}</Rok>`);
    x.push(`    <NazwaSystemu>TaxOrder Pro</NazwaSystemu>`);
    x.push(`    <DataWytworzeniaJPK>${today}</DataWytworzeniaJPK>`);
    x.push(`  </Naglowek>`);

    // Podmiot 1 — podatnik
    x.push(`  <Podmiot1 rodzaj="${isFiz ? '1' : '2'}">`);
    if (isFiz) {
      x.push(`    <OsobaFizyczna>`);
      x.push(`      <NIP>${_esc(form.nip)}</NIP>`);
      if (form.name) x.push(`      <PelnaNazwa>${_esc(form.name)}</PelnaNazwa>`);
      x.push(`    </OsobaFizyczna>`);
      x.push(`    <AdresZamieszkania rodzajAdresu="RAD">`);
    } else {
      x.push(`    <OsobaNiefizyczna>`);
      x.push(`      <NIP>${_esc(form.nip)}</NIP>`);
      if (form.name) x.push(`      <PelnaNazwa>${_esc(form.name)}</PelnaNazwa>`);
      x.push(`    </OsobaNiefizyczna>`);
      x.push(`    <AdresSiedziby rodzajAdresu="RAD">`);
    }
    x.push(`      <KodKraju>PL</KodKraju>`);
    if (form.street)   x.push(`      <Ulica>${_esc(form.street)}</Ulica>`);
    if (form.houseNo)  x.push(`      <NrDomu>${_esc(form.houseNo)}</NrDomu>`);
    if (form.city)     x.push(`      <Miejscowosc>${_esc(form.city)}</Miejscowosc>`);
    if (form.postcode) x.push(`      <KodPocztowy>${_esc(form.postcode)}</KodPocztowy>`);
    x.push(`    </${isFiz ? 'AdresZamieszkania' : 'AdresSiedziby'}>`);
    x.push(`  </Podmiot1>`);

    // Pozycje szczegółowe
    x.push(`  <PozycjeSzczegolowe>`);
    x.push(`    <P_4>${_esc(form.yr)}</P_4>`);
    if (form.kodUrzedu) x.push(`    <P_7>${_esc(form.kodUrzedu)}</P_7>`);

    // Kategorie D.1–D.15
    for (const [cat, data] of Object.entries(cats)) {
      const pos = CAT_POS[cat];
      if (!pos) continue;
      const [p0, p1, p2, p3] = pos;
      x.push(`    <P_${p0}>${data.count1}</P_${p0}>`);
      if (data.count2 > 0) x.push(`    <P_${p1}>${data.count2}</P_${p1}>`);
      if (data.count3 > 0) x.push(`    <P_${p2}>${data.count3}</P_${p2}>`);
      x.push(`    <P_${p3}>${_fmt2(data.amount)}</P_${p3}>`);
    }

    // Suma i raty
    x.push(`    <P_80>${_fmt2(total)}</P_80>`);
    x.push(`    <P_81>${r1}</P_81>`);
    x.push(`    <P_82>${r2}</P_82>`);
    x.push(`  </PozycjeSzczegolowe>`);
    x.push(`  <Pouczenia>1</Pouczenia>`);
    x.push(`</Deklaracja>`);

    _download(x.join('\n'), `DT-1_${form.nip}_${form.yr}.xml`);
    toast(`✓ DT-1 XML: ${taxable.length} pojazd(ów), podatek ${_fmt2(total)} zł`);
  }

  // ── Eksport DT-1/A (załącznik — szczegółowe dane pojazdu) ────────────────────
  function exportAttachmentXML() {
    const form    = _getFormData();
    const taxable = _taxableVehs();

    if (!taxable.length) { toast('⚠ Brak pojazdów'); return; }

    const today = new Date().toISOString().slice(0, 10);
    const x = [];
    x.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    x.push(`<Deklaracja xmlns="http://crd.gov.pl/wzor/2023/12/13/13655/">`);
    x.push(`  <Naglowek>`);
    x.push(`    <KodFormularza kodSystemowy="DT-1/A (6)">DT-1/A</KodFormularza>`);
    x.push(`    <WariantFormularza>6</WariantFormularza>`);
    x.push(`    <Rok>${_esc(form.yr)}</Rok>`);
    x.push(`    <NazwaSystemu>TaxOrder Pro</NazwaSystemu>`);
    x.push(`    <DataWytworzeniaJPK>${today}</DataWytworzeniaJPK>`);
    x.push(`  </Naglowek>`);
    x.push(`  <PozycjeSzczegolowe>`);

    for (const { v, cat, rate, amount, months } of taxable) {
      const r1 = Math.round(amount / 2);
      const r2  = Math.round(amount) - r1;

      // Własność: 1=wyłączny właściciel, 2=współwłaściciel-1, 3=współwłaściciel-2
      const ownMap = { 'współwłaściciel-1': '2', 'współwłaściciel-2': '3' };
      const own = ownMap[v.ownership_type || ''] || '1';

      const dmc    = v.dmc ?? v.dmcMax ?? 0;
      const dmcZ   = v.dmcZespolu ?? 0;
      const isNacz = (v.typ || '').toLowerCase().includes('naczepa') || (v.typ || '').toLowerCase().includes('przyczepa');
      const isCiag = (v.typ || '').toLowerCase().includes('ciągnik') || (v.typ || '').toLowerCase().includes('ciagnik');
      const isAutobus = (v.typ || '').toLowerCase().includes('autobus');

      const typCode  = VEH_TYPE_CODE[(v.typ || '').toLowerCase()] || '1';
      const suspCode = SUSP_CODE[(v.zawieszenie || '').toLowerCase()] || '3';

      x.push(`    <P_B>`);
      x.push(`      <P_B1>${own}</P_B1>`);                                          // własność
      x.push(`      <P_B2>${typCode}</P_B2>`);                                      // rodzaj środka
      x.push(`      <P_B3>${_esc(v.nrRej || '')}</P_B3>`);                         // nr rej
      x.push(`      <P_B4>${_esc(v.vin || '')}</P_B4>`);                            // VIN
      x.push(`      <P_B5>${_esc((v.marka || '') + ' ' + (v.model || ''))}</P_B5>`); // marka + model
      x.push(`      <P_B6>${v.rok || ''}</P_B6>`);                                  // rok produkcji
      x.push(`      <P_B7>${_fmtT(dmc)}</P_B7>`);                                  // DMC (tony)
      // P_B8: DMC zespołu — dla naczep/przyczep, dla ciągników — DMC zestawu
      x.push(`      <P_B8>${(isNacz || isCiag) && dmcZ > 0 ? _fmtT(dmcZ) : ''}</P_B8>`);
      x.push(`      <P_B9>${parseInt(v.osie) || 2}</P_B9>`);                        // liczba osi
      x.push(`      <P_B10>${suspCode}</P_B10>`);                                   // zawieszenie
      x.push(`      <P_B11>${isAutobus ? (parseInt(v.miejscaSied) || '') : ''}</P_B11>`); // miejsca (tylko autobusy)
      x.push(`      <P_B12>${_esc(_fmtDate(v.dataNabycia || v.purchaseDate || ''))}</P_B12>`);    // data nabycia
      x.push(`      <P_B13>${_esc(_fmtDate(v.dataWycofania || ''))}</P_B13>`);                    // data wycofania
      x.push(`      <P_B14>${_esc(_fmtDate(v.dataDopuszczenia || ''))}</P_B14>`);                 // data dopuszczenia
      x.push(`      <P_B15>${_esc(_fmtDate(v.dataWyrejestrowania || v.saleDate || ''))}</P_B15>`); // data wyrejestrowania
      x.push(`      <P_B16>${months}</P_B16>`);                                     // liczba miesięcy
      x.push(`      <P_B17>${_fmt2(rate)}</P_B17>`);                                // stawka roczna
      x.push(`      <P_B18>${_fmt2(amount)}</P_B18>`);                              // kwota podatku
      x.push(`      <P_B19>${r1}</P_B19>`);                                         // rata I
      x.push(`      <P_B20>${r2}</P_B20>`);                                         // rata II
      x.push(`      <P_B20_1></P_B20_1>`);                                          // paliwo gazowe (nie dot.)
      x.push(`      <P_B20_gazowa></P_B20_gazowa>`);
      x.push(`      <P_B20_elektryczny></P_B20_elektryczny>`);
      x.push(`      <P_B20_hybrydowy></P_B20_hybrydowy>`);
      x.push(`      <P_B20_gaz_ziemny></P_B20_gaz_ziemny>`);
      x.push(`      <P_B20_wodor></P_B20_wodor>`);
      x.push(`      <P_B20_7></P_B20_7>`);
      x.push(`      <P_B21>${_esc(cat || '')}</P_B21>`);                            // kategoria DT-1
      x.push(`      <P_B22></P_B22>`);
      x.push(`    </P_B>`);
    }

    x.push(`  </PozycjeSzczegolowe>`);
    x.push(`</Deklaracja>`);

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
