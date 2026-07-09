/**
 * TaxOrder Pro — Eksport DT-1 do XML (ePUAP / e-Deklaracje)
 * Generuje plik XML zgodny ze schematem Ministerstwa Finansów
 * Schema: https://www.podatki.gov.pl/e-deklaracje/dokumentacja-techniczna/
 */
window.DT1XML = (function () {

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  }

  function _fmt2(n) { return n ? Number(n).toFixed(2) : '0.00'; }
  function _fmtDate(d) {
    if (!d) return '';
    try { return new Date(d).toISOString().slice(0,10); } catch { return d; }
  }

  // Mapowanie wartości selecta tp-cel → numer CelZlozenia (1-6)
  const CEL_MAP = {
    'DEKLARACJA SKLADANA DO 15 LUTEGO': '1',
    'POWSTANIE OBOWIAZKU W TRAKCIE ROKU': '2',
    'WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU': '3',
    'ZMIANA MIEJSCA ZAMIESZKANIA LUB SIEDZIBY': '4',
    'KOREKTA DEKLARACJI': '5',
    'PRZEDLUZENIE WYCOFANIA': '6',
  };

  // Zbiera dane formularza z DOM (te same funkcje co w renderFormularze)
  function _getFormData() {
    const g = id => (document.getElementById(id)||{}).value||'';
    const yr = g('taxYearDT1') || g('taxYear') || new Date().getFullYear().toString();
    const nip = g('tp-nip').replace(/[-\s]/g,'');
    const name = g('tp-name') || '';
    const street = g('tp-street') || '';
    const city = g('tp-city') || '';
    const postcode = g('tp-postcode') || '';
    const celRaw = g('tp-cel');
    const cel = CEL_MAP[celRaw] || '1';
    const rodzaj = g('tp-rodzaj') || 'niefizyczny'; // 'fizyczny' | 'niefizyczny'
    return { yr, nip, name, street, city, postcode, cel, rodzaj };
  }

  function exportXML() {
    const form = _getFormData();
    const allVehs = window.vehs || [];
    const selected = window.selected || new Set();

    // Filtruj pojazdy do deklaracji (zaznaczone lub aktywne opodatkowane)
    let taxVehs = selected.size > 0
      ? allVehs.filter(v => selected.has(v.id))
      : allVehs.filter(v => v.is_active !== false);

    // Przelicz podatek
    const taxableVehs = taxVehs.map(v => {
      const cat = typeof getCat === 'function' ? getCat(v) : null;
      const rate = typeof getRate === 'function' ? getRate(v) : 0;
      const m = parseInt(v.miesiacePodatku) || 12;
      const amount = cat ? Math.round((rate * m) / 12 * 100) / 100 : 0;
      return { v, cat, rate, amount, m };
    }).filter(x => x.cat);

    if (!taxableVehs.length) {
      toast('⚠ Brak pojazdów opodatkowanych do eksportu');
      return;
    }

    const total = taxableVehs.reduce((s, x) => s + x.amount, 0);
    const r1 = Math.round(total / 2), r2 = Math.round(total) - r1;
    const today = new Date().toISOString().slice(0,10);
    const year = form.yr;

    // Grupowanie wg kategorii DT-1
    const cats = {};
    taxableVehs.forEach(({ v, cat, amount }) => {
      if (!cats[cat]) cats[cat] = { count: 0, amount: 0 };
      cats[cat].count++;
      cats[cat].amount += amount;
    });

    // Buduj XML zgodnie ze schematem e-Deklaracji DT-1
    const xmlParts = [];
    xmlParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    xmlParts.push(`<Deklaracja xmlns="http://crd.gov.pl/wzor/2023/12/13/13654/" xmlns:etd="http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/01/05/eD/ORDZU/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`);

    // ── Nagłówek ──
    xmlParts.push(`  <Naglowek>`);
    xmlParts.push(`    <KodFormularza kodSystemowy="DT-1 (6)" kodPodatku="DT" rodzajZobowiazania="Z" wersjaSchemy="1-0E">DT-1</KodFormularza>`);
    xmlParts.push(`    <WariantFormularza>6</WariantFormularza>`);
    xmlParts.push(`    <CelZlozenia poz="P_6">${_esc(form.cel)}</CelZlozenia>`);
    xmlParts.push(`    <Rok>${_esc(year)}</Rok>`);
    xmlParts.push(`    <NazwaSystemu>TaxOrder Pro</NazwaSystemu>`);
    xmlParts.push(`    <DataWytworzeniaJPK>${today}</DataWytworzeniaJPK>`);
    xmlParts.push(`  </Naglowek>`);

    // ── Podmiot 1 — podatnik ──
    const isFiz = form.rodzaj === 'fizyczny';
    const adresTag = isFiz ? 'AdresZamieszkania' : 'AdresSiedziby';
    const adresTyp = isFiz ? 'RAD' : 'RAD';
    xmlParts.push(`  <Podmiot1>`);
    if (isFiz) {
      xmlParts.push(`    <OsobaFizyczna>`);
      xmlParts.push(`      <NIP>${_esc(form.nip)}</NIP>`);
      if (form.name) xmlParts.push(`      <PelnaNazwa>${_esc(form.name)}</PelnaNazwa>`);
      xmlParts.push(`    </OsobaFizyczna>`);
    } else {
      xmlParts.push(`    <OsobaNiefizyczna>`);
      xmlParts.push(`      <NIP>${_esc(form.nip)}</NIP>`);
      if (form.name) xmlParts.push(`      <PelnaNazwa>${_esc(form.name)}</PelnaNazwa>`);
      xmlParts.push(`    </OsobaNiefizyczna>`);
    }
    xmlParts.push(`    <${adresTag} rodzajAdresu="${adresTyp}">`);
    xmlParts.push(`      <Ulica>${_esc(form.street)}</Ulica>`);
    xmlParts.push(`      <Miejscowosc>${_esc(form.city)}</Miejscowosc>`);
    xmlParts.push(`      <KodPocztowy>${_esc(form.postcode)}</KodPocztowy>`);
    xmlParts.push(`    </${adresTag}>`);
    xmlParts.push(`  </Podmiot1>`);

    // ── Pozycje szczegółowe (tabela DT-1) ──
    xmlParts.push(`  <PozycjeSzczegolowe>`);

    // Rok podatkowy
    xmlParts.push(`    <P_4>${_esc(year)}</P_4>`);

    // Sumy wg kategorii
    let pNum = 30; // numery pozycji kategorii zaczynają się od ~P_30 w DT-1(6)
    const CAT_POS = {
      D1:'P_30',D2:'P_31',D3:'P_32',D4:'P_33',D5:'P_34',
      D6:'P_35',D7:'P_36',D8:'P_37',D9:'P_38',D10:'P_39',
      D11:'P_40',D12:'P_41',D13:'P_42',D14:'P_43',D15:'P_44',
    };

    Object.entries(cats).forEach(([cat, data]) => {
      const pos = CAT_POS[cat];
      if (pos) xmlParts.push(`    <${pos}>${_fmt2(data.amount)}</${pos}>`);
    });

    // Suma podatku
    xmlParts.push(`    <P_50>${_fmt2(total)}</P_50>`);
    // Rata I (do 15 lutego)
    xmlParts.push(`    <P_51>${r1}</P_51>`);
    // Rata II (do 15 września)
    xmlParts.push(`    <P_52>${r2}</P_52>`);

    xmlParts.push(`  </PozycjeSzczegolowe>`);

    // ── Pouczenia — wymóg e-Deklaracji ──
    xmlParts.push(`  <Pouczenia>1</Pouczenia>`);
    xmlParts.push(`</Deklaracja>`);

    const xml = xmlParts.join('\n');
    const blob = new Blob([xml], { type: 'application/xml;charset=UTF-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DT-1_${form.nip}_${year}.xml`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast(`✓ Plik DT-1 XML wygenerowany (${taxableVehs.length} pojazdów, ${_fmt2(total)} zł)`);
  }

  // ── Eksport DT-1/A załączników ────────────────────────────────────────────
  function exportAttachmentXML() {
    const form = _getFormData();
    const allVehs = window.vehs || [];
    const selected = window.selected || new Set();
    let taxVehs = selected.size > 0
      ? allVehs.filter(v => selected.has(v.id))
      : allVehs.filter(v => v.is_active !== false);

    const taxable = taxVehs.map(v => {
      const cat = typeof getCat === 'function' ? getCat(v) : null;
      const rate = typeof getRate === 'function' ? getRate(v) : 0;
      const m = parseInt(v.miesiacePodatku) || 12;
      const amount = cat ? Math.round((rate * m) / 12 * 100) / 100 : 0;
      return { v, cat, rate, amount, m };
    }).filter(x => x.cat);

    if (!taxable.length) { toast('⚠ Brak pojazdów'); return; }

    const today = new Date().toISOString().slice(0,10);
    const xmlParts = [];
    xmlParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    xmlParts.push(`<Deklaracja xmlns="http://crd.gov.pl/wzor/2023/12/13/13655/">`);
    xmlParts.push(`  <Naglowek>`);
    xmlParts.push(`    <KodFormularza kodSystemowy="DT-1/A (6)">DT-1/A</KodFormularza>`);
    xmlParts.push(`    <WariantFormularza>6</WariantFormularza>`);
    xmlParts.push(`    <Rok>${_esc(form.yr)}</Rok>`);
    xmlParts.push(`    <NazwaSystemu>TaxOrder Pro</NazwaSystemu>`);
    xmlParts.push(`    <DataWytworzeniaJPK>${today}</DataWytworzeniaJPK>`);
    xmlParts.push(`  </Naglowek>`);
    xmlParts.push(`  <PozycjeSzczegolowe>`);

    // Grupuj po 3 pojazdy na stronę załącznika
    let i = 0;
    for (const { v, cat, rate, amount, m } of taxable) {
      const pref = `P_${i * 10 + 1}`;
      xmlParts.push(`    <!-- Pojazd ${i + 1}: ${_esc(v.nrRej)} -->`);
      xmlParts.push(`    <P_${i*10+1}>${_esc(v.vin||'')}</P_${i*10+1}>`);
      xmlParts.push(`    <P_${i*10+2}>${_esc(v.nrRej)}</P_${i*10+2}>`);
      xmlParts.push(`    <P_${i*10+3}>${_esc(v.marka||'')} ${_esc(v.model||'')}</P_${i*10+3}>`);
      xmlParts.push(`    <P_${i*10+4}>${v.dmc||0}</P_${i*10+4}>`);
      xmlParts.push(`    <P_${i*10+5}>${_esc(cat)}</P_${i*10+5}>`);
      xmlParts.push(`    <P_${i*10+6}>${m}</P_${i*10+6}>`);
      xmlParts.push(`    <P_${i*10+7}>${_fmt2(rate)}</P_${i*10+7}>`);
      xmlParts.push(`    <P_${i*10+8}>${_fmt2(amount)}</P_${i*10+8}>`);
      xmlParts.push(`    <P_${i*10+9}>${_esc(v.dataNabycia||v.purchaseDate||'')}</P_${i*10+9}>`);
      xmlParts.push(`    <P_${i*10+10}>${_esc(v.dataWycofania||'')}</P_${i*10+10}>`);
      xmlParts.push(`    <P_${i*10+11}>${_esc(v.dataDopuszczenia||'')}</P_${i*10+11}>`);
      xmlParts.push(`    <P_${i*10+12}>${_esc(v.dataWyrejestrowania||v.saleDate||'')}</P_${i*10+12}>`);
      i++;
    }

    xmlParts.push(`  </PozycjeSzczegolowe>`);
    xmlParts.push(`</Deklaracja>`);

    const xml = xmlParts.join('\n');
    const blob = new Blob([xml], { type: 'application/xml;charset=UTF-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DT-1A_${form.nip}_${form.yr}.xml`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast(`✓ DT-1/A XML: ${taxable.length} pojazdów`);
  }

  return { exportXML, exportAttachmentXML };
})();
