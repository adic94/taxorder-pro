#!/usr/bin/env node
/**
 * Dlaczego kod Aztec się nie odczytuje — pomiar ROZDZIELCZOŚCI ŹRÓDŁA na całym zbiorze.
 *
 *     node tools/aztec-diagnoza.js "<folder z dowodami>"
 *
 * PO CO. Przebieg na 1318 dowodach dał `aztec:0` — zero odczytów. Wiemy, że DEKODOWANIE
 * działa (selftest: 17/17 pól end-to-end, a `aztec-decoded-bytes.bin` z realnego dowodu
 * rozłożył się na 67 pól). Zawodzi DETEKCJA. Pytanie brzmi: czy wina jest w naszej
 * ścieżce, czy w materiale — a to rozstrzyga jedna liczba, której nigdy nie zmierzyliśmy.
 *
 * KLUCZOWA RZECZ, KTÓREJ NIE NAPRAWI ŻADNA ZMIANA W KODZIE. Renderowanie PDF-u w 300 DPI
 * NIE TWORZY informacji, której nie ma w źródle. Jeśli skan osadzony w PDF-ie ma 150 DPI,
 * render w 300 tylko go interpoluje — piksele są, szczegółu nie ma. Nasza poprawka
 * PDF_AZTEC (144 → 300 DPI) usunęła realny problem (przekompresowanie do JPEG), ale nie
 * doda ostrości skanowi, który jej nie miał.
 *
 * ILE TRZEBA. Kod Aztec na polskim dowodzie ma bok około 25 mm. Dekodery potrzebują
 * co najmniej ~3 px na moduł, komfortowo 5. Wariant kompaktowy 23×23 modułów:
 *
 *     150 DPI → 25 mm ≈ 148 px → ~6,4 px/moduł   czytelne
 *     100 DPI → 25 mm ≈  98 px → ~4,3 px/moduł   na granicy
 *      72 DPI → 25 mm ≈  71 px → ~3,1 px/moduł   praktycznie nieczytelne
 *
 * Narzędzie NIE dekoduje i NIE uruchamia przeglądarki — czyta nagłówki plików. Dzięki temu
 * przechodzi przez tysiące dokumentów w sekundy, zamiast w godziny.
 *
 * PRYWATNOŚĆ: nie otwiera zawartości obrazu, nie zapisuje niczego, a nazwy plików skraca
 * (bywają numerami rejestracyjnymi).
 */
const fs = require('fs');
const path = require('path');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('\nUżycie: node tools/aztec-diagnoza.js "<folder z dowodami>"\n');
  process.exit(2);
}

// ── Wymiary z nagłówków, bez dekodowania obrazu ──────────────────────────────
function wymiaryPng(buf) {
  // IHDR jest zawsze pierwszym chunkiem: 8 bajtów sygnatury, 4 długość, 4 typ, potem W i H.
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function wymiaryJpeg(buf) {
  // Przechodzimy po markerach do pierwszego SOF (Start Of Frame). SOF0/1/2/3/5/6/7/9…15
  // niosą wysokość i szerokość; pomijamy DHT/DQT/SOS i restarty.
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    const dl = buf.readUInt16BE(i + 2);
    const sof = (m >= 0xC0 && m <= 0xCF) && m !== 0xC4 && m !== 0xC8 && m !== 0xCC;
    if (sof) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    if (m === 0xDA) break;                       // początek danych — dalej nie ma nagłówków
    i += 2 + dl;
  }
  return null;
}

/**
 * PDF: rozmiar strony w punktach (1 pt = 1/72 cala) z pierwszego /MediaBox oraz wymiary
 * pikselowe pierwszego osadzonego obrazu (/Width, /Height w strumieniu XObject).
 *
 * To jest odczyt ZGRUBNY, celowo bez pdfjs: chcemy przejść tysiące plików w sekundy
 * i bez zależności. Dla skanu — a takie są te dowody — pierwszy duży obraz w pliku JEST
 * skanem strony, więc iloraz pikseli do cali daje realne DPI. Przy PDF-ach złożonych
 * (wiele obrazów, wektory) wynik traktuj jako orientacyjny, nie jako pomiar.
 */
function analizaPdf(buf) {
  const txt = buf.toString('latin1', 0, Math.min(buf.length, 4 * 1024 * 1024));
  const mb = txt.match(/\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/);
  const strona = mb ? { wPt: Math.abs(+mb[3] - +mb[1]), hPt: Math.abs(+mb[4] - +mb[2]) } : null;

  let naj = null;
  const re = /\/Width\s+(\d+)[\s\S]{0,400}?\/Height\s+(\d+)|\/Height\s+(\d+)[\s\S]{0,400}?\/Width\s+(\d+)/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const w = +(m[1] || m[4]), h = +(m[2] || m[3]);
    if (w > 200 && h > 200 && (!naj || w * h > naj.w * naj.h)) naj = { w, h };
  }
  return { strona, obraz: naj };
}

// ── Zbieranie plików ─────────────────────────────────────────────────────────
const OBS = /\.(pdf|jpe?g|png|webp)$/i;
const zbierz = (d, gl = 0) => {
  if (gl > 6) return [];
  let we = [];
  try { we = fs.readdirSync(d, { withFileTypes: true }); } catch { return []; }
  return we.flatMap(w => {
    const p = path.join(d, w.name);
    if (w.isDirectory()) return zbierz(p, gl + 1);
    return OBS.test(w.name) ? [p] : [];
  });
};

const pliki = zbierz(dir);
if (!pliki.length) { console.error(`\nBrak dokumentów w: ${dir}\n`); process.exit(2); }

console.log(B(`\n  Diagnoza materiału — ${pliki.length} dokumentów\n`));
console.log(D('  Mierzę ROZDZIELCZOŚĆ ŹRÓDŁA, nie próbuję dekodować. Render w wyższym DPI'));
console.log(D('  nie doda szczegółu, którego skan nie ma — to jest ta granica.\n'));

// Kod Aztec na polskim DR ma bok ok. 25 mm ≈ 0,984 cala.
const CAL_KODU = 25 / 25.4;
const MODULY = 23;                                    // wariant kompaktowy, ostrożne założenie

const kubelki = { '<100': 0, '100-149': 0, '150-199': 0, '200-299': 0, '300+': 0, 'nieznane': 0 };
const przyklady = [];
let pdfy = 0, obrazy = 0, bezWymiarow = 0;

for (const f of pliki) {
  const ext = path.extname(f).toLowerCase();
  let dpi = null, opis = '';

  try {
    if (ext === '.pdf') {
      pdfy++;
      const fd = fs.openSync(f, 'r');
      const buf = Buffer.alloc(Math.min(fs.statSync(f).size, 4 * 1024 * 1024));
      fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
      const a = analizaPdf(buf);
      if (a.strona && a.obraz) {
        // DPI = piksele / cale; bierzemy dłuższy bok, żeby orientacja nie mieszała.
        const caleD = Math.max(a.strona.wPt, a.strona.hPt) / 72;
        const pxD = Math.max(a.obraz.w, a.obraz.h);
        dpi = Math.round(pxD / caleD);
        opis = `${a.obraz.w}×${a.obraz.h} px na ${Math.round(caleD * 25.4)} mm`;
      } else if (a.obraz) { opis = `${a.obraz.w}×${a.obraz.h} px, brak /MediaBox`; }
    } else {
      obrazy++;
      const buf = Buffer.alloc(64 * 1024);
      const fd = fs.openSync(f, 'r');
      fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
      const w = ext === '.png' ? wymiaryPng(buf) : wymiaryJpeg(buf);
      if (w) {
        // Dowód rejestracyjny w formacie A6 (105 mm krótszy bok) — zakładamy, że skan
        // obejmuje CAŁY dokument. Dłuższy bok A6 to 148 mm ≈ 5,83 cala.
        dpi = Math.round(Math.max(w.w, w.h) / 5.83);
        opis = `${w.w}×${w.h} px`;
      }
    }
  } catch { /* plik nieczytelny — liczony jako nieznany */ }

  if (dpi == null) { kubelki.nieznane++; bezWymiarow++; continue; }
  const k = dpi < 100 ? '<100' : dpi < 150 ? '100-149' : dpi < 200 ? '150-199' : dpi < 300 ? '200-299' : '300+';
  kubelki[k]++;
  if (przyklady.length < 6) przyklady.push({ f: path.basename(f).slice(0, 30), dpi, opis });
}

// ── Wynik ────────────────────────────────────────────────────────────────────
console.log(`  ${D('PDF-y:')} ${pdfy}   ${D('obrazy:')} ${obrazy}   ${D('bez odczytu wymiarów:')} ${bezWymiarow}\n`);
console.log(B('  Szacowana rozdzielczość skanu:\n'));

const zbadane = pliki.length - kubelki.nieznane;
for (const [k, n] of Object.entries(kubelki)) {
  if (!n) continue;
  const proc = Math.round(n / pliki.length * 100);
  const pasek = '█'.repeat(Math.max(1, Math.round(proc / 3)));
  const dpiSrodek = k === '<100' ? 85 : k === '100-149' ? 125 : k === '150-199' ? 175 : k === '200-299' ? 250 : 350;
  const pxModul = k === 'nieznane' ? null : (dpiSrodek * CAL_KODU) / MODULY;
  const ocena = pxModul == null ? '' :
    pxModul >= 5 ? G('czytelne') : pxModul >= 3 ? Y('na granicy') : R('za mało');
  console.log(`   ${k.padEnd(9)} ${String(n).padStart(5)}  ${String(proc).padStart(3)}%  ${pasek.padEnd(34)}` +
    (pxModul == null ? D('—') : `${pxModul.toFixed(1)} px/moduł  ${ocena}`));
}

if (przyklady.length) {
  console.log(D('\n  Przykłady:'));
  for (const p of przyklady) console.log(D(`    ${p.f.padEnd(32)} ~${p.dpi} DPI   ${p.opis}`));
}

const zaMalo = kubelki['<100'] + kubelki['100-149'];
const dosc = kubelki['150-199'] + kubelki['200-299'] + kubelki['300+'];

console.log(B('\n  ' + '─'.repeat(60)));
if (!zbadane) {
  console.log(Y('\n  Nie odczytano wymiarów żadnego pliku — sprawdź, czy to na pewno skany.\n'));
} else if (zaMalo / zbadane > 0.5) {
  console.log(R('\n  MATERIAŁ JEST ZA SŁABY dla kodu Aztec.'));
  console.log(`  ${Math.round(zaMalo / zbadane * 100)}% skanów ma poniżej 150 DPI — kod ma wtedy ~3 px/moduł lub mniej.`);
  console.log(D('\n  To NIE jest wada naszej detekcji i żadna zmiana biblioteki tego nie naprawi.'));
  console.log(D('  Render w wyższym DPI też nie — interpoluje piksele, nie odtwarza szczegółu.'));
  console.log(D('  Realne opcje: ponowne skanowanie w 300 DPI albo oparcie się na OCR.\n'));
} else if (dosc / zbadane > 0.5) {
  console.log(Y('\n  MATERIAŁ JEST WYSTARCZAJĄCY — a mimo to odczytów jest zero.'));
  console.log(`  ${Math.round(dosc / zbadane * 100)}% skanów ma 150 DPI lub więcej, czyli ≥ 6 px/moduł.`);
  console.log(D('\n  Wina leży zatem po stronie DETEKCJI albo materiału w inny sposób:'));
  console.log(D('    • kodu Aztec nie ma na dokumencie (starszy wzór dowodu),'));
  console.log(D('    • skan obejmuje tylko część dowodu, bez sekcji z kodem,'));
  console.log(D('    • kod jest, ale detekcja go nie znajduje — wtedy to nasz problem.'));
  console.log(D('  Rozstrzyga: aztec-compare.js na JEDNYM pliku z tej grupy.\n'));
} else {
  console.log(Y('\n  Materiał jest niejednorodny — patrz rozkład wyżej.\n'));
}
