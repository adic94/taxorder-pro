// ==================== DT-1 GENERATOR ====================
// Własny generator PDF formularza DT-1 i DT-1/A od zera przez pdf-lib
// Niezależny od formularza MF — pełna kontrola nad pozycjami i polami
// Zgodny z wzorem DT-1(5) obowiązującym od 2019 r.

window.DT1Generator = {

  // Rozmiar strony A4 w punktach (pdf-lib używa punktów)
  W: 595.28,
  H: 841.89,
  M: 28,      // margines
  FONT_MONO: null,
  FONT_BOLD: null,

  // ── KOLORY ────────────────────────────────────────────────────────
  C: {
    black:  [0,0,0],
    white:  [1,1,1],
    gray:   [0.85,0.85,0.85],
    dgray:  [0.25,0.25,0.25],
    lgray:  [0.95,0.95,0.95],
  },

  rgb(r,g,b){ return PDFLib.rgb(r,g,b); },
  col(name){ const c=this.C[name]||this.C.black; return this.rgb(...c); },

  // ── POMOCNICZE ────────────────────────────────────────────────────
  text(page, txt, x, y, size=8, bold=false, color=null) {
    if(!txt && txt !== 0) return;
    page.drawText(String(txt), {
      x, y: this.H - y - size,
      size,
      font: bold ? this.FONT_BOLD : this.FONT_MONO,
      color: color || this.col('black'),
    });
  },

  rect(page, x, y, w, h, fill=null, stroke=null, sw=0.5) {
    page.drawRectangle({
      x, y: this.H - y - h,
      width: w, height: h,
      color: fill ? fill : undefined,
      borderColor: stroke || this.col('black'),
      borderWidth: sw,
    });
  },

  line(page, x1, y1, x2, y2, sw=0.5) {
    page.drawLine({
      start: {x: x1, y: this.H - y1},
      end:   {x: x2, y: this.H - y2},
      thickness: sw,
      color: this.col('black'),
    });
  },

  // Pole z ramką i etykietą
  field(page, label, value, x, y, w, h=14, bold=false) {
    this.rect(page, x, y, w, h, this.col('white'), this.col('black'));
    if(label) this.text(page, label, x+1, y+1, 5.5);
    if(value) this.text(page, value, x+2, y + (label ? 5 : 3), bold ? 9 : 8, bold);
  },

  // Ciemne pole (wypełnia organ)
  darkField(page, label, x, y, w, h=14) {
    this.rect(page, x, y, w, h, this.col('gray'), this.col('black'));
    if(label) this.text(page, label, x+2, y+3, 7, false, this.col('dgray'));
  },

  // Checkbox
  checkbox(page, checked, x, y, size=8) {
    this.rect(page, x, y, size, size, this.col('white'), this.col('black'), 0.5);
    if(checked) {
      this.text(page, '×', x+0.5, y+0.5, size-1, true);
    }
  },

  // Kratka na cyfry (jak w formularzu MF)
  digitBox(page, digits, x, y, boxW=9, h=12) {
    const str = String(digits || '').replace(/\s/g,'');
    for(let i=0; i<str.length; i++) {
      this.rect(page, x + i*boxW, y, boxW, h, this.col('white'), this.col('black'), 0.5);
      this.text(page, str[i], x + i*boxW + 2, y+2, 9, true);
    }
  },

  // ── STRONA 1 DT-1 ─────────────────────────────────────────────────
  async buildPage1(pdfDoc, data) {
    const page = pdfDoc.addPage([this.W, this.H]);
    const { W, H, M } = this;
    const cW = W - 2*M;   // szerokość treści

    // --- NAGŁÓWEK ---
    this.text(page,
      'POLA JASNE WYPEŁNIA PODATNIK, POLA CIEMNE WYPEŁNIA ORGAN PODATKOWY. WYPEŁNIAĆ NA MASZYNIE, KOMPUTEROWO LUB RĘCZNIE, DUŻYMI, DRUKOWANYMI',
      M, 22, 5.5);
    this.text(page,
      'LITERAMI, CZARNYM LUB NIEBIESKIM KOLOREM. PRZED WYPEŁNIENIEM NALEŻY ZAPOZNAĆ SIĘ Z OBJAŚNIENIAMI.',
      M, 28, 5.5);

    // Wiersz: NIP | Nr dok | Status
    const nipW = cW * 0.6, docW = cW * 0.2, statW = cW - nipW - docW;
    const row1y = 35;
    this.field(page, '1. Identyfikator podatkowy NIP / numer PESEL (niepotrzebne skreślić) podatnika',
      data.nip ? this._formatNip(data.nip) : '', M, row1y, nipW, 18);
    this.darkField(page, '2. Nr dokumentu', M+nipW, row1y, docW, 18);
    this.darkField(page, '3. Status',       M+nipW+docW, row1y, statW, 18);

    // Tytuł DT-1
    this.text(page, 'DT-1', M, 60, 20, true);
    this.text(page, 'DT-1\u2085', W-M-18, 58, 7);
    this.text(page, '1/4', W-M-8, 64, 7);

    // Deklaracja
    this.text(page, 'DEKLARACJA NA PODATEK OD ŚRODKÓW TRANSPORTOWYCH', W/2, 78, 11, true);
    this.text(page, 'na', M+40, 96, 9);

    // Pole roku - kratka
    const rokX = M+60, rokY = 88;
    this.rect(page, rokX, rokY, 60, 16, this.col('white'), this.col('black'), 0.8);
    this.text(page, '4. Rok', rokX+1, rokY+1, 5.5);
    this.text(page, String(data.rok || new Date().getFullYear()), rokX+4, rokY+5, 11, true);

    // Rok pisany słownie poniżej
    this.text(page, String(data.rok || new Date().getFullYear()), W/2, 108, 9, true);

    // Podstawa prawna, składający, termin
    this.text(page, 'Podstawa prawna:', M, 120, 7, true);
    this.text(page, 'Art. 9 ust. 6 pkt 1 i 2 ustawy z dnia 12 stycznia 1991 r. o podatkach i opłatach lokalnych', M+70, 120, 7);
    this.text(page, '(Dz. U. z 2025 r. poz. 707), zwanej dalej „ustawą".', M+70, 128, 7);
    this.text(page, 'Składający:', M, 136, 7, true);
    this.text(page, 'Podatnicy podatku od środków transportowych.', M+70, 136, 7);
    this.text(page, 'Termin składania:', M, 144, 7, true);
    this.text(page, 'Do dnia 15 lutego każdego roku podatkowego, jak również w terminie 14 dni od zaistnienia', M+70, 144, 7);
    this.text(page, 'okoliczności mających wpływ na powstanie bądź wygaśnięcie obowiązku podatkowego lub zmiany', M+70, 151, 7);
    this.text(page, 'miejsca zamieszkania albo siedziby.', M+70, 158, 7);
    this.text(page, 'Miejsce składania:', M, 165, 7, true);
    this.text(page, 'Siedziba organu podatkowego właściwego według miejsca zamieszkania albo siedziby podatnika.', M+70, 165, 7);

    // --- A. MIEJSCE SKŁADANIA ---
    const sy = 174;
    this.rect(page, M, sy, cW, 8, this.col('dgray'));
    this.text(page, 'A. MIEJSCE SKŁADANIA DEKLARACJI', M+2, sy+1, 7, true, this.col('white'));
    this.field(page, '5. Nazwa i adres siedziby organu podatkowego', data.organ||'', M, sy+8, cW, 20);

    // --- B. DANE PODATNIKA ---
    const by = sy + 30;
    this.rect(page, M, by, cW, 8, this.col('dgray'));
    this.text(page, 'B. DANE PODATNIKA', M+2, by+1, 7, true, this.col('white'));
    this.text(page, '* - dotyczy podatnika niebędącego osobą fizyczną', M+80, by+1, 5.5, false, this.col('white'));
    this.text(page, '** - dotyczy podatnika będącego osobą fizyczną', M+200, by+1, 5.5, false, this.col('white'));

    // B.1
    const b1y = by + 10;
    this.rect(page, M, b1y, cW, 8, this.col('lgray'));
    this.text(page, 'B.1. DANE IDENTYFIKACYJNE', M+2, b1y+1, 6.5, true);

    // Rodzaj podatnika
    const b2y = b1y + 10;
    this.text(page, '6. Rodzaj podatnika (zaznaczyć właściwy kwadrat):', M+2, b2y, 7);
    this.checkbox(page, data.rodzajPodatnika !== 'fizyczny', M+130, b2y+2, 7);
    this.text(page, '1. podatnik niebędący osobą fizyczną', M+139, b2y, 7);
    this.checkbox(page, data.rodzajPodatnika === 'fizyczny', M+280, b2y+2, 7);
    this.text(page, '2. osoba fizyczna', M+289, b2y, 7);

    // Nazwa/Nazwisko
    const b3y = b2y + 12;
    this.field(page, '7. Nazwa pełna * / Nazwisko, pierwsze imię, data urodzenia **',
      (data.nazwa||'').toUpperCase(), M, b3y, cW, 22);

    // B.2 Adres
    const b4y = b3y + 24;
    this.rect(page, M, b4y, cW, 7, this.col('lgray'));
    this.text(page, 'B.2. ADRES SIEDZIBY * / ADRES ZAMIESZKANIA **', M+2, b4y+1, 6.5, true);

    // Kraj, województwo, powiat
    const adW = cW/3;
    const b5y = b4y + 9;
    this.field(page, '8. Kraj', data.kraj||'Polska', M, b5y, adW, 14);
    this.field(page, '9. Województwo', data.woj||'', M+adW, b5y, adW, 14);
    this.field(page, '10. Powiat', data.powiat||'', M+2*adW, b5y, adW, 14);

    // Gmina, ulica, nr domu, lokal
    const b6y = b5y + 16;
    this.field(page, '11. Gmina', data.gmina||data.miasto||'', M, b6y, adW, 14);
    this.field(page, '12. Ulica', data.ulica||'', M+adW, b6y, adW*1.4, 14);
    const domW = adW*0.3, lokW = cW - adW*2 - adW*1.4;
    this.field(page, '13. Nr domu', data.dom||'', M+adW+adW*1.4, b6y, domW, 14);
    this.field(page, '14. Nr lokalu', data.lokal||'', M+adW+adW*1.4+domW, b6y, lokW, 14);

    // Miejscowość, kod, poczta
    const b7y = b6y + 16;
    this.field(page, '15. Miejscowość', data.miasto||'', M, b7y, adW*1.5, 14);
    this.field(page, '16. Kod pocztowy', data.kod||'', M+adW*1.5, b7y, adW*0.8, 14);
    this.field(page, '17. Poczta', data.miasto||'', M+adW*2.3, b7y, cW-adW*2.3, 14);

    // --- C. OBOWIĄZEK ---
    const cy = b7y + 17;
    this.rect(page, M, cy, cW, 8, this.col('dgray'));
    this.text(page, 'C. OBOWIĄZEK SKŁADANIA DEKLARACJI', M+2, cy+1, 7, true, this.col('white'));

    const c1y = cy + 10;
    this.text(page, '18. Przyczyny złożenia deklaracji (zaznaczyć właściwy kwadrat):', M+2, c1y, 7);

    const cel = data.cel || 'DEKLARACJA SKLADANA DO 15 LUTEGO';
    const cels = [
      ['DEKLARACJA SKLADANA DO 15 LUTEGO', '1. deklaracja składana w terminie do dnia 15 lutego roku podatkowego'],
      ['POWSTANIE OBOWIAZKU', '2. powstanie obowiązku podatkowego w trakcie roku podatkowego'],
      ['WYGASNIECIE OBOWIAZKU', '3. wygaśnięcie obowiązku podatkowego'],
      ['ZMIANA MIEJSCA', '4. zmiana miejsca zamieszkania lub siedziby'],
      ['KOREKTA DEKLARACJI', '5. korekta deklaracji'],
      ['PRZEDLUZENIE WYCOFANIA', '6. przedłużenie okresu czasowego wycofania pojazdu z ruchu'],
    ];
    const c2y = c1y + 9;
    cels.forEach(([key, label], i) => {
      const cx = i < 3 ? M+2 : M+cW/2;
      const cy2 = c2y + (i % 3) * 10;
      this.checkbox(page, cel.includes(key.split(' ')[0]), cx, cy2, 7);
      this.text(page, label, cx+9, cy2+0.5, 6.5);
    });

    // Pole 19 (zmiana organu)
    const c4y = c2y + 32;
    this.field(page, '19. Nazwa i adres siedziby organu podatkowego, w którym poprzednio składano deklarację (wypełnić przy zazn. kw. 4 w poz.18)',
      '', M, c4y, cW, 16);

    // Stopka strony
    this.text(page, 'DT-1₅', M, H-M+5, 8, true);
    this.text(page, '1/4', W-M-8, H-M+5, 8);

    return page;
  },

  // ── STRONA 2 DT-1 — Dane dotyczące przedmiotów opodatkowania ──────
  async buildPage2(pdfDoc, catData) {
    const page = pdfDoc.addPage([this.W, this.H]);
    const { W, H, M } = this;
    const cW = W - 2*M;

    this.text(page,
      'POLA JASNE WYPEŁNIA PODATNIK, POLA CIEMNE WYPEŁNIA ORGAN PODATKOWY. WYPEŁNIAĆ NA MASZYNIE, KOMPUTEROWO LUB RĘCZNIE, DUŻYMI, DRUKOWANYMI LITERAMI, CZARNYM LUB NIEBIESKIM KOLOREM.',
      M, 22, 5);

    const ty = 30;
    this.rect(page, M, ty, cW, 8, this.col('dgray'));
    this.text(page, 'D. DANE DOTYCZĄCE PRZEDMIOTÓW OPODATKOWANIA', M+2, ty+1, 7, true, this.col('white'));

    // Nagłówki kolumn tabeli
    const colA = cW * 0.42;
    const colBCDE = (cW - colA) / 4;
    const hy = ty + 10;

    this.rect(page, M, hy, colA, 24, this.col('lgray'), this.col('black'));
    this.text(page, 'Rodzaje środków transportowych', M + colA/2 - 30, hy + 8, 7, true);
    this.text(page, 'a', M + colA/2 - 2, hy + 17, 7);

    const hdrs = ['Liczba poj.\nniepozost.\nwe współwł.', 'Liczba poj.\npozost.\nwe współwł. 1)', 'Liczba poj.\npozost.\nwe współwł. 2)', 'Kwota podatku\nzł, gr'];
    const hletters = ['b','c','d','e'];
    hdrs.forEach((h, i) => {
      const hx = M + colA + i*colBCDE;
      this.rect(page, hx, hy, colBCDE, 24, this.col('lgray'), this.col('black'));
      h.split('\n').forEach((line, li) => {
        this.text(page, line, hx+2, hy + 4 + li*6, 5.5);
      });
      this.text(page, hletters[i], hx + colBCDE/2 - 2, hy + 18, 7);
    });

    // Kategorie D1-D7
    const cats = [
      ['D.1', 'Samochody ciężarowe o dopuszczalnej masie całkowitej powyżej 3,5 tony do 5,5 tony włącznie', [20,21,22,23]],
      ['D.2', 'Samochody ciężarowe o dopuszczalnej masie całkowitej powyżej 5,5 tony do 9 ton włącznie', [24,25,26,27]],
      ['D.3', 'Samochody ciężarowe o dopuszczalnej masie całkowitej powyżej 9 ton i poniżej 12 ton', [28,29,30,31]],
      ['D.4', 'Ciągniki siodłowe i balastowe, DMC zesp. od 3,5 t i poniżej 12 t', [32,33,34,35]],
      ['D.5', 'Przyczepy i naczepy, DMC zesp. od 7 t i poniżej 12 t', [36,37,38,39]],
      ['D.6', 'Autobusy z liczbą miejsc do siedzenia mniejszą niż 22', [40,41,42,43]],
      ['D.7', 'Autobusy z liczbą miejsc do siedzenia równą i wyższą niż 22', [44,45,46,47]],
    ];

    let rowY = hy + 26;
    const rowH = 22;

    cats.forEach(([cat, desc, pols]) => {
      this.rect(page, M, rowY, colA, rowH, this.col('white'), this.col('black'));
      this.text(page, cat, M+2, rowY+4, 7, true);
      // Opis w dwóch liniach
      const words = desc.split(' ');
      let line1 = '', line2 = '';
      for(const w of words) {
        if((line1+' '+w).length < 55) line1 += (line1?' ':'')+w;
        else line2 += (line2?' ':'')+w;
      }
      this.text(page, line1, M+16, rowY+4, 6.5);
      if(line2) this.text(page, line2, M+16, rowY+11, 6.5);

      const nums = pols;
      [0,1,2,3].forEach(ci => {
        const cx = M + colA + ci*colBCDE;
        this.rect(page, cx, rowY, colBCDE, rowH, this.col('white'), this.col('black'));
        this.text(page, String(nums[ci])+'.', cx+2, rowY+2, 6);
        const val = catData[nums[ci]];
        if(val) this.text(page, String(val), cx+2, rowY+9, 8, ci===3);
      });

      rowY += rowH;
    });

    // Podsekcje D8-D12 z kolumną "Liczba osi"
    const subsections = [
      { title: 'Samochody ciężarowe o dopuszczalnej masie całkowitej równej lub wyższej niż 12 ton',
        rows: [['D.8','Dwie osie',[48,49,50,51]],['D.9','Trzy osie',[52,53,54,55]],['D.10','Cztery osie i więcej',[56,57,58,59]]] },
      { title: 'Ciągniki siodłowe i balastowe do używania łącznie z naczepą/przyczepą, DMC zesp. ≥ 12 t',
        rows: [['D.11','Dwie osie',[60,61,62,63]],['D.12','Trzy osie i więcej',[64,65,66,67]]] },
    ];

    const axisW = colA * 0.35;

    subsections.forEach(sub => {
      // Tytuł podsekcji
      rowY += 4;
      this.rect(page, M, rowY, cW, 14, this.col('lgray'), this.col('black'));
      this.text(page, sub.title, M+2, rowY+4, 6, true);
      rowY += 14;

      // Nagłówek z "Liczba osi"
      this.rect(page, M, rowY, axisW, 14, this.col('lgray'), this.col('black'));
      this.text(page, 'Liczba osi', M+2, rowY+4, 6.5, true);
      this.text(page, 'a', M+axisW/2-2, rowY+10, 6);
      const remW = colA - axisW;
      this.rect(page, M+axisW, rowY, remW, 14, this.col('lgray'), this.col('black'));
      [0,1,2,3].forEach(ci => {
        const cx = M + colA + ci*colBCDE;
        this.rect(page, cx, rowY, colBCDE, 14, this.col('lgray'), this.col('black'));
        this.text(page, hletters[ci], cx+colBCDE/2-2, rowY+8, 6);
      });
      rowY += 14;

      sub.rows.forEach(([cat, label, pols]) => {
        this.rect(page, M, rowY, axisW, rowH-4, this.col('white'), this.col('black'));
        this.text(page, cat, M+2, rowY+4, 7, true);
        this.rect(page, M+axisW, rowY, remW, rowH-4, this.col('white'), this.col('black'));
        this.text(page, label, M+axisW+2, rowY+4, 7);
        [0,1,2,3].forEach(ci => {
          const cx = M + colA + ci*colBCDE;
          this.rect(page, cx, rowY, colBCDE, rowH-4, this.col('white'), this.col('black'));
          this.text(page, String(pols[ci])+'.', cx+2, rowY+2, 6);
          const val = catData[pols[ci]];
          if(val) this.text(page, String(val), cx+2, rowY+8, 8, ci===3);
        });
        rowY += rowH - 4;
      });
    });

    // Stopki tabelki + strona
    this.text(page, '1) Kolumnę c wypełnia współwłaściciel wpisany jako pierwszy w dowodzie rejestracyjnym.', M, rowY+6, 5.5);
    this.text(page, '2) Kolumnę d wypełnia współwłaściciel niewpisany jako pierwszy w dowodzie rejestracyjnym.', M, rowY+12, 5.5);
    this.text(page, 'DT-1₅', M, H-M+5, 8, true);
    this.text(page, '2/4', W-M-8, H-M+5, 8);
    return page;
  },

  // ── STRONA 3 DT-1 — D13-D15 + E + F + G ──────────────────────────
  async buildPage3(pdfDoc, catData, data) {
    const page = pdfDoc.addPage([this.W, this.H]);
    const { W, H, M } = this;
    const cW = W - 2*M;

    this.text(page, 'POLA JASNE WYPEŁNIA PODATNIK, POLA CIEMNE WYPEŁNIA ORGAN PODATKOWY.', M, 20, 5);

    // D13-D15 (przyczepy ≥12t)
    const title = 'Przyczepy i naczepy, które łącznie z pojazdem silnikowym posiadają dopuszczalną masę całkowitą równą lub wyższą niż 12 ton';
    this.rect(page, M, 28, cW, 12, this.col('lgray'), this.col('black'));
    this.text(page, title, M+2, 30, 5.5, true);
    this.text(page, '(z wyjątkiem związanych wyłącznie z działalnością rolniczą prowadzoną przez podatnika podatku rolnego)', M+2, 36, 5.5);

    const colA = cW * 0.42, colBCDE = (cW - colA) / 4;
    const axisW = colA * 0.35, remW = colA - axisW;
    const hletters = ['b','c','d','e'];
    let ry = 42;

    // Nagłówek
    this.rect(page, M, ry, axisW, 12, this.col('lgray'), this.col('black'));
    this.text(page, 'Liczba osi', M+2, ry+3, 6);
    this.rect(page, M+axisW, ry, remW, 12, this.col('lgray'), this.col('black'));
    [0,1,2,3].forEach(ci => {
      const cx = M + colA + ci*colBCDE;
      this.rect(page, cx, ry, colBCDE, 12, this.col('lgray'), this.col('black'));
    });
    ry += 12;

    [['D.13','Jedna oś',[68,69,70,71]],['D.14','Dwie osie',[72,73,74,75]],['D.15','Trzy osie i więcej',[76,77,78,79]]].forEach(([cat, label, pols]) => {
      this.rect(page, M, ry, axisW, 18, this.col('white'), this.col('black'));
      this.text(page, cat, M+2, ry+4, 7, true);
      this.rect(page, M+axisW, ry, remW, 18, this.col('white'), this.col('black'));
      this.text(page, label, M+axisW+2, ry+5, 7);
      [0,1,2,3].forEach(ci => {
        const cx = M + colA + ci*colBCDE;
        this.rect(page, cx, ry, colBCDE, 18, this.col('white'), this.col('black'));
        this.text(page, String(pols[ci])+'.', cx+2, ry+2, 6);
        const val = catData[pols[ci]];
        if(val) this.text(page, String(val), cx+2, ry+8, 8, ci===3);
      });
      ry += 18;
    });

    // E. KWOTA PODATKU
    ry += 6;
    this.rect(page, M, ry, cW, 8, this.col('dgray'));
    this.text(page, 'E. KWOTA PODATKU', M+2, ry+1, 7, true, this.col('white'));
    ry += 10;

    const totalTax = catData.total || 0;
    const rata1 = Math.round(totalTax / 2);
    const rata2 = totalTax - rata1;

    this.field(page, '80. Razem kwota podatku (suma kwot z kol. e w części D)', '', M, ry, cW-80, 18);
    this.rect(page, W-M-80, ry, 80, 18, this.col('white'), this.col('black'));
    this.text(page, '80.', W-M-78, ry+2, 6);
    if(totalTax) this.text(page, _fmt(totalTax), W-M-60, ry+6, 9, true);
    ry += 20;

    this.field(page, '81. Kwota I raty podatku do zapłaty (zaokrąglona do pełnych zł)', '', M, ry, cW-80, 18);
    this.rect(page, W-M-80, ry, 80, 18, this.col('white'), this.col('black'));
    this.text(page, '81.', W-M-78, ry+2, 6);
    if(rata1) this.text(page, String(rata1), W-M-40, ry+6, 9, true);
    ry += 20;

    this.field(page, '82. Kwota II raty podatku do zapłaty (zaokrąglona do pełnych zł)', '', M, ry, cW-80, 18);
    this.rect(page, W-M-80, ry, 80, 18, this.col('white'), this.col('black'));
    this.text(page, '82.', W-M-78, ry+2, 6);
    if(rata2) this.text(page, String(rata2), W-M-40, ry+6, 9, true);
    ry += 24;

    // F. INFORMACJA O ZAŁĄCZNIKACH
    this.rect(page, M, ry, cW, 8, this.col('dgray'));
    this.text(page, 'F. INFORMACJA O ZAŁĄCZNIKACH', M+2, ry+1, 7, true, this.col('white'));
    ry += 10;
    this.field(page, '83. Liczba składanych załączników DT-1/A', '', M, ry, cW*0.5, 16);
    this.rect(page, M+cW*0.5, ry, cW*0.25, 16, this.col('white'), this.col('black'));
    const nAtt = catData.attachments || 0;
    if(nAtt) this.text(page, String(nAtt), M+cW*0.5+8, ry+4, 11, true);
    ry += 20;

    // G. PODPIS
    this.rect(page, M, ry, cW, 8, this.col('dgray'));
    this.text(page, 'G. PODPIS PODATNIKA / OSOBY REPREZENTUJĄCEJ PODATNIKA', M+2, ry+1, 7, true, this.col('white'));
    ry += 10;

    const gW = cW/4;
    this.field(page, '84. Imię', data.imie||'', M, ry, gW, 20);
    this.field(page, '85. Nazwisko', data.nazwisko||'', M+gW, ry, gW, 20);
    this.field(page, '86. Data wypełnienia (dzień - miesiąc - rok)', '', M+2*gW, ry, gW, 20);
    this.field(page, '87. Podpis podatnika / osoby reprezentującej podatnika', '', M+3*gW, ry, gW, 20);
    ry += 24;

    // H. ADNOTACJE
    this.rect(page, M, ry, cW, 8, this.col('dgray'));
    this.text(page, 'H. ADNOTACJE ORGANU PODATKOWEGO', M+2, ry+1, 7, true, this.col('white'));
    ry += 10;
    this.darkField(page, '88. Uwagi organu podatkowego', M, ry, cW, 60);
    ry += 62;

    const hw = cW/2;
    this.darkField(page, '89. Identyfikator przyjmującego formularz', M, ry, hw, 16);
    this.darkField(page, '90. Podpis przyjmującego formularz', M+hw, ry, hw, 16);

    this.text(page, 'DT-1₅', M, H-M+5, 8, true);
    this.text(page, '3/4', W-M-8, H-M+5, 8);
    return page;
  },

  // ── STRONA DT-1/A — jeden załącznik (3 pojazdy) ──────────────────
  async buildDT1A(pdfDoc, vehicles, attNum, data) {
    const page = pdfDoc.addPage([this.W, this.H]);
    const { W, H, M } = this;
    const cW = W - 2*M;

    this.text(page, 'POLA JASNE WYPEŁNIA PODATNIK, POLA CIEMNE WYPEŁNIA ORGAN PODATKOWY.', M, 20, 5);

    // NIP + Nr dok + Status
    const nipW = cW * 0.6, docW = cW * 0.2;
    this.field(page, '1. Identyfikator podatkowy NIP / numer PESEL podatnika',
      data.nip ? this._formatNip(data.nip) : '', M, 28, nipW, 16);
    this.darkField(page, '2. Nr dokumentu', M+nipW, 28, docW, 16);
    this.darkField(page, '3. Status', M+nipW+docW, 28, cW-nipW-docW, 16);

    // Tytuł
    this.text(page, 'DT-1/A', M, 50, 14, true);
    this.text(page, 'ZAŁĄCZNIK DO DEKLARACJI DT-1', W/2-40, 52, 9, true);
    this.field(page, '4. Numer załącznika', String(attNum), W-M-60, 44, 60, 18);

    this.text(page, 'Formularz DT-1/A może być składany jedynie jako załącznik do deklaracji DT-1.', M, 68, 6.5);

    // A. DANE PODATNIKA
    let ay = 76;
    this.rect(page, M, ay, cW, 8, this.col('dgray'));
    this.text(page, 'A. DANE PODATNIKA', M+2, ay+1, 7, true, this.col('white'));
    ay += 10;
    this.text(page, '5. Rodzaj podatnika:', M+2, ay, 6.5);
    this.checkbox(page, data.rodzajPodatnika !== 'fizyczny', M+60, ay, 7);
    this.text(page, '1. podatnik niebędący osobą fizyczną', M+69, ay, 6.5);
    this.checkbox(page, data.rodzajPodatnika === 'fizyczny', M+220, ay, 7);
    this.text(page, '2. osoba fizyczna', M+229, ay, 6.5);
    ay += 10;
    this.field(page, '6. Nazwa pełna * / Nazwisko, pierwsze imię **',
      (data.nazwa||'').toUpperCase(), M, ay, cW, 16);
    ay += 18;

    // B. DANE ŚRODKÓW TRANSPORTOWYCH — po 3 pojazdy
    this.rect(page, M, ay, cW, 8, this.col('dgray'));
    this.text(page, 'B. DANE DOTYCZĄCE ŚRODKÓW TRANSPORTOWYCH', M+2, ay+1, 7, true, this.col('white'));
    ay += 10;

    const secNames = ['B.1.','B.2.','B.3.'];
    vehicles.forEach((v, vi) => {
      if(!v) return;
      const sy = ay;
      const sh = 148;

      this.rect(page, M, sy, cW, 10, this.col('lgray'), this.col('black'));
      this.text(page, secNames[vi]+' DANE SZCZEGÓŁOWE DOTYCZĄCE ŚRODKA TRANSPORTOWEGO', M+2, sy+2, 6.5, true);
      let vy = sy + 12;

      // 1. Własność
      const typVlasn = ['1. właściciel','2. współwłaściciel wpisany jako pierwszy','3. współwłaściciel niewpisany jako pierwszy'];
      this.text(page, '1. Dane dotyczące własności albo współwłasności (zaznaczyć właściwy kwadrat):', M+2, vy, 6);
      typVlasn.forEach((t, i) => {
        const tx = M + 2 + i*165;
        this.checkbox(page, i===0, tx, vy+3, 6);
        this.text(page, t, tx+8, vy+3, 5.5);
      });
      vy += 12;

      // 2. Rodzaj
      const typRodz = ['1. samochód ciężarowy','2. ciągnik siodłowy','3. ciągnik balastowy','4. przyczepa','5. naczepa','6. autobus'];
      this.text(page, '2. Rodzaj środka transportowego:', M+2, vy, 6);
      const vtyp = (v.typ||'').toLowerCase();
      typRodz.forEach((t, i) => {
        const tx = M + 2 + i*90;
        const checked = (i===0&&vtyp.includes('cięż'))||(i===1&&vtyp.includes('siodł'))||
          (i===2&&vtyp.includes('balast'))||(i===3&&vtyp.includes('przyczepa'))||
          (i===4&&vtyp.includes('naczepa'))||(i===5&&vtyp.includes('autobus'));
        this.checkbox(page, checked, tx, vy+3, 6);
        this.text(page, t, tx+8, vy+3, 5.5);
      });
      vy += 12;

      // 3-6: Data rej, Nr rej, VIN, Marka/model, Rok prod
      const hw = cW/2;
      this.field(page, '3. Data pierwszej rejestracji na terytorium RP', v.dataRejestracji||'', M, vy, hw, 14);
      this.field(page, '4. Numer rejestracyjny pojazdu', v.nrRej||'', M+hw, vy, hw, 14);
      vy += 16;
      this.field(page, '5. Numer Identyfikacyjny VIN / nadwozia, podwozia lub ramy', v.vin||'', M, vy, hw, 14);
      this.field(page, '6. Marka, typ, model pojazdu', (v.marka||'')+' '+(v.model||''), M+hw, vy, hw, 14);
      vy += 16;

      // 7-12: Rok prod, data nabycia, data zbycia, wycofanie, przywrócenie, wyrejestrowanie
      const sw = cW/6;
      this.field(page, '7. Rok produkcji', v.rok||'', M, vy, sw, 14);
      this.field(page, '8. Data nabycia', v.purchaseDate||v.dataRejestracji||'', M+sw, vy, sw, 14);
      this.field(page, '9. Data zbycia', v.saleDate||'', M+2*sw, vy, sw, 14);
      this.field(page, '10. Data czasowego wycofania z ruchu', '', M+3*sw, vy, sw, 14);
      this.field(page, '11. Data ponownego dopuszczenia', '', M+4*sw, vy, sw, 14);
      this.field(page, '12. Data wyrejestrowania', '', M+5*sw, vy, sw, 14);
      vy += 16;

      // 13-16: DMC, masa własna ciągnika, DMC zespołu, liczba osi
      const qw = cW/4;
      const dmcT = v.dmc ? (v.dmc/1000).toFixed(2) : '';
      const dmcZT = v.dmcZespolu ? (v.dmcZespolu/1000).toFixed(2) : '';
      this.field(page, '13. Dopuszczalna masa całkowita pojazdu (w tonach)', dmcT, M, vy, qw, 14);
      this.field(page, '14. Masa własna ciągnika siodłowego (w tonach)', '', M+qw, vy, qw, 14);
      this.field(page, '15. Dopuszczalna masa całkowita zespołu pojazdów (w tonach)', dmcZT, M+2*qw, vy, qw, 14);
      this.field(page, '16. Liczba osi pojazdu', v.osie||'', M+3*qw, vy, qw, 14);
      vy += 16;

      // 17. Zawieszenie
      this.text(page, '17. Rodzaj zawieszenia (zaznaczyć właściwy kwadrat):', M+2, vy, 6);
      const zawTyp = ['1. pneumatyczne','2. równoważne z pneumatycznym','3. inny system zawieszenia'];
      const z = (v.zawieszenie||'').toLowerCase();
      zawTyp.forEach((t, i) => {
        const tx = M + 2 + i*170;
        const ch = (i===0&&z.includes('pneum'))||(i===1&&z.includes('równ'))||(i===2&&z.includes('inne'));
        this.checkbox(page, ch, tx, vy+3, 6);
        this.text(page, t, tx+8, vy+3, 6);
      });
      vy += 12;

      // 20. Euro
      this.text(page, '20. Wpływ na środowisko (EURO):', M+2, vy, 6);
      const euroLevels = ['Euro 0','Euro 1/I','Euro 2/II','Euro 3/III','Euro 4/IV','Euro 5/V','Euro 6/VI'];
      const eu = (v.euro||'').toUpperCase();
      this.checkbox(page, !!eu, M+80, vy, 6);
      this.text(page, '1. Euro (UE/EKG ONZ)', M+88, vy, 5.5);
      euroLevels.forEach((el, i) => {
        const tx = M + 170 + i*52;
        const ch = eu.includes(String(i)) || (i===6&&eu.includes('VI')) || (i===5&&eu.includes('V/')&&!eu.includes('VI'));
        this.checkbox(page, ch, tx, vy, 5);
        this.text(page, el, tx+6, vy, 5.5);
      });
      vy += 12;

      // 21. Kwota podatku
      const taxAmt = v.amount || 0;
      this.field(page, '21. Kwota podatku', '', M, vy, cW-80, 14);
      this.rect(page, W-M-80, vy, 80, 14, this.col('white'), this.col('black'));
      if(taxAmt) this.text(page, _fmt(taxAmt), W-M-50, vy+3, 9, true);
      this.text(page, 'zł', W-M-22, vy+3, 7);
      this.text(page, '00', W-M-8, vy+3, 7);
      vy += 16;

      // 22. Kwota zapłacona
      this.field(page, '22. Kwota podatku zapłaconego', '', M, vy, cW-80, 14);
      this.rect(page, W-M-80, vy, 80, 14, this.col('white'), this.col('black'));
      this.text(page, 'zł', W-M-22, vy+3, 7);

      ay = vy + 20;
    });

    // Numer strony
    const attPage = `DT-1/A₅  ${Math.ceil(attNum)}/2`;
    this.text(page, 'DT-1/A₅', M, H-M+5, 8, true);
    this.text(page, `${attNum > 1 ? '2' : '1'}/2`, W-M-8, H-M+5, 8);

    return page;
  },

  // ── FORMAT NIP ────────────────────────────────────────────────────
  _formatNip(nip) {
    const n = String(nip).replace(/\D/g,'');
    if(n.length===10) return `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6,8)}-${n.slice(8)}`;
    return nip;
  },

  // ── GŁÓWNY GENERATOR ─────────────────────────────────────────────
  async generate(taxpayerData, vehicles, options={}) {
    const { PDFDocument, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();

    // Wczytaj czcionkę Roboto jeśli dostępna, fallback na Helvetica
    try {
      if(window._ROBOTO_BYTES) {
        this.FONT_MONO = await pdfDoc.embedFont(window._ROBOTO_BYTES);
        this.FONT_BOLD = this.FONT_MONO;
      } else {
        this.FONT_MONO = await pdfDoc.embedFont(StandardFonts.Helvetica);
        this.FONT_BOLD = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
    } catch(e) {
      this.FONT_MONO = await pdfDoc.embedFont(StandardFonts.Helvetica);
      this.FONT_BOLD = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    // Oblicz dane kategorii
    const catData = {};
    let total = 0;
    vehicles.forEach(v => {
      const tax = typeof calcTax === 'function' ? calcTax(v) : {};
      const cat = tax.cat || v.cat;
      const amt = tax.amount || v.amount || 0;
      if(cat && amt) {
        const catDef = typeof catDefs !== 'undefined' ? catDefs.find(c=>c[0]===cat) : null;
        if(catDef) {
          catData[catDef[2][0]] = (catData[catDef[2][0]]||0) + 1;
          const existing = catData[catDef[2][3]] || 0;
          catData[catDef[2][3]] = parseFloat((existing + amt).toFixed(2));
        }
        total += amt;
      }
    });
    catData.total = parseFloat(total.toFixed(2));
    catData.attachments = Math.ceil(vehicles.length / 3);

    const data = {
      rok:   options.rok || new Date().getFullYear(),
      nip:   taxpayerData.nip || '',
      nazwa: taxpayerData.nazwa || '',
      organ: taxpayerData.organ || '',
      ulica: taxpayerData.ulica || '',
      dom:   taxpayerData.dom || '',
      lokal: taxpayerData.lokal || '',
      kod:   taxpayerData.kod || '',
      miasto: taxpayerData.miasto || '',
      woj:   taxpayerData.woj || '',
      gmina: taxpayerData.gmina || taxpayerData.miasto || '',
      powiat: taxpayerData.powiat || '',
      kraj:  'Polska',
      cel:   taxpayerData.cel || 'DEKLARACJA SKLADANA DO 15 LUTEGO',
      imie:  taxpayerData.imie || '',
      nazwisko: taxpayerData.nazwisko || '',
      rodzajPodatnika: taxpayerData.rodzajPodatnika || 'niefizyczny',
    };

    // Strony DT-1
    await this.buildPage1(pdfDoc, data);
    await this.buildPage2(pdfDoc, catData);
    await this.buildPage3(pdfDoc, catData, data);

    // Strony DT-1/A (po 3 pojazdy)
    for(let i=0; i<vehicles.length; i+=3) {
      const group = [vehicles[i], vehicles[i+1]||null, vehicles[i+2]||null];
      await this.buildDT1A(pdfDoc, group, Math.ceil((i+1)/3), data);
    }

    // Generuj i pobierz
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], {type:'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DT-1_${data.nip}_${data.rok}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    if(typeof toast === 'function') toast(`✓ Wygenerowano DT-1 za ${data.rok} — ${vehicles.length} pojazdów`);
    return { ok: true, pages: 3 + catData.attachments };
  },
};

// Helper
function _fmt(v) {
  const n = Math.round(Number(v||0)*100);
  const zl = Math.floor(n/100);
  const gr = String(n%100).padStart(2,'0');
  return `${zl.toLocaleString('pl-PL')},${gr}`;
}
