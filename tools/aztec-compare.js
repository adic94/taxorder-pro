/**
 * TaxOrder Pro — porównanie dwóch ścieżek dekodowania Aztec na PRAWDZIWYM dowodzie.
 *
 * Uruchom:
 *   git checkout claude/aztec-naprawa            # ⚠️ tego pliku NIE MA na main
 *   npm i --no-save @zxing/library@0.20.0        # jednorazowo, jeśli brak
 *   npx playwright install chromium              # jednorazowo, jeśli brak przeglądarki
 *   node tools/aztec-compare.js <sciezka-do-zdjecia.jpg>
 *
 * CZTERY TRYBY, bo odpowiadają na różne pytania:
 *   <plik.jpg|png>      — czy umiemy ZNALEŹĆ i odczytać kod na tym obrazie
 *   --selftest          — czy cała ścieżka działa na kodzie o znanym ładunku
 *   --bytes <plik.bin>  — czy umiemy ROZPAKOWAĆ gotowe bajty (bez warstwy optycznej;
 *                         nie wymaga przeglądarki ani @zxing/library)
 *   --katalog <folder>  — jaki jest WSKAŹNIK skuteczności na całym zbiorze dokumentów
 *                         (dla PDF-ów wymaga: npm i --no-save pdfjs-dist@3.11.174)
 *
 * Pierwsza linijka jest istotna do czasu scalenia PR #13/#14: na `main` polecenie
 * kończy się „Cannot find module", co łatwo wziąć za awarię narzędzia zamiast za
 * brak pliku na gałęzi.
 *
 * Na Windowsie: `npm run` bywa blokowany polityką wykonywania PowerShella — `node`
 * to zwykły plik wykonywalny i polityka go nie dotyczy, więc wołaj go wprost.
 *
 * ŚCIEŻKA A — obecna, produkcyjna: ZXing z wymuszonym CHARACTER_SET ISO-8859-1,
 *   bajty odzyskiwane przez `text.charCodeAt(i) & 0xFF`. Odwzorowanie
 *   `tryAztecFromCanvas()` z app.js — trzymaj zgodne, jeśli tamta się zmieni.
 *
 * ŚCIEŻKA B — `modules/aztec-detector.js`: kaskada 9 strategii, 42 próby.
 *   Jest ładowana w index.html, ale w APLIKACJI nikt jej nie woła — używają jej
 *   wyłącznie narzędzia deweloperskie. Wola `.getText()` BEZ wskazówki
 *   CHARACTER_SET, czego skutków dla ładunku BINARNEGO nikt nie sprawdził.
 *
 * PYTANIE, NA KTÓRE TO ODPOWIADA: czy ścieżka B zwraca bajty zdatne do NRV2E.
 * `tools/aztec-bench.html` tego NIE mierzy — porównuje wyłącznie skuteczność
 * DETEKCJI i nigdy nie konwertuje wyniku z powrotem na bajty. Dlatego detektora
 * nie wolno podpiąć na podstawie tamtego benchmarku.
 *
 * KRYTERIUM: pierwsze 4 bajty ładunku DR to długość po dekompresji (uint32 LE),
 * którą `handleAztec` w Workerze przyjmuje w zakresie 10..131072. Ładunek
 * zniekształcony przez konwersję znakową prawie na pewno wypadnie poza ten zakres.
 *
 * UWAGA NA DANE: dowód rejestracyjny zawiera VIN i dane właściciela. Trzymaj
 * zdjęcie POZA repozytorium; skrypt nic nie zapisuje i drukuje wyłącznie
 * pierwsze bajty w postaci szesnastkowej.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.join(__dirname, '..');
// URUCHAMIANY BEZPOŚREDNIO vs `require`-owany: przy require sprawdzanie argumentów
// i główna pętla NIE mogą wystartować — inne narzędzia (tools/aztec-pdf-bench.js)
// biorą stąd budowniczego ładunku DR i ekstraktor dekodera, zamiast trzymać kopie.
const BEZPOSREDNIO = require.main === module;
const SELFTEST = process.argv.includes('--selftest');
const iBajty = process.argv.indexOf('--bytes');
const plikBajtow = iBajty >= 0 ? process.argv[iBajty + 1] : null;
const iKat = process.argv.indexOf('--katalog');
const katalog = iKat >= 0 ? process.argv[iKat + 1] : null;
const obraz = (SELFTEST || plikBajtow || katalog) ? null : process.argv[2];
if (BEZPOSREDNIO && !SELFTEST && !plikBajtow && !katalog && (!obraz || !fs.existsSync(obraz))) {
  console.error('Podaj ścieżkę do zdjęcia dowodu: node tools/aztec-compare.js <plik>');
  console.error('albo kontrolę wierności bajtów:   node tools/aztec-compare.js --selftest');
  console.error('albo gotowe bajty ładunku:        node tools/aztec-compare.js --bytes <plik.bin>');
  console.error('albo CAŁY katalog dokumentów:     node tools/aztec-compare.js --katalog <folder>');
  process.exit(2);
}

/**
 * Tryb `--bytes`: pomija CAŁĄ warstwę optyczną i podaje gotowe bajty wprost
 * produkcyjnemu `_decodeAztecPayload`. Przeglądarka nie jest potrzebna.
 *
 * PO CO: rozdziela dwa pytania, które łatwo pomylić — „czy umiemy ZNALEŹĆ i odczytać
 * kod na obrazie" (detekcja) od „czy umiemy ROZPAKOWAĆ jego ładunek" (NRV2E + pola).
 * Jeśli skądkolwiek mamy już bajty prawdziwego dowodu, ten tryb odpowiada na drugie
 * pytanie natychmiast i bez zgadywania. Selftest odpowiada na nie tylko dla ładunku,
 * który sami zbudowaliśmy — a prawdziwy strumień NRV2E ma odwołania wstecz, których
 * nasz enkoder „samych literałów" nie produkuje.
 *
 * Maskowanie takie samo jak w trybie obrazu: VIN, nr rej. i seria dowodu nie trafiają
 * w całości na wyjście, żeby log dało się wkleić bez wycieku.
 */
function trybBajtow(plik) {
  if (!fs.existsSync(plik)) { console.error(`Nie ma pliku: ${plik}`); process.exit(2); }
  let buf = fs.readFileSync(plik);

  // Plik bywa BASE64, nie surowymi bajtami — `/api/aztec` przyjmuje `bytesBase64`,
  // więc narzędzia zrzucające „bajty Aztec" często zapisują właśnie tekst base64.
  // Bez tej detekcji nagłówek wychodzi absurdalny (np. 1095848246 z ASCII „6QQA")
  // i łatwo uznać ładunek za zniekształcony, choć jest nietknięty.
  const tekst = buf.toString('latin1').trim();
  if (/^[A-Za-z0-9+/\r\n=]+$/.test(tekst) && tekst.length >= 16) {
    const dek = Buffer.from(tekst, 'base64');
    if (dek.length >= 8) {
      console.log(`\n  Wejście rozpoznane jako BASE64 — zdekodowane: ${buf.length} → ${dek.length} bajtów`);
      buf = dek;
    }
  }

  const { _decodeAztecPayload } = wyciagnijDekoder();
  const hex = b => Array.from(b.slice(0, 12)).map(x => x.toString(16).padStart(2, '0')).join(' ');
  const dl = buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] * 0x1000000);

  console.log(`\nDekodowanie gotowych bajtów: ${path.basename(plik)}\n`);
  console.log(`  bajtów w pliku      : ${buf.length}`);
  console.log(`  pierwsze bajty      : ${hex(buf)}`);
  console.log(`  nagłówek (długość)  : ${dl} ${dl >= 10 && dl <= 131072 ? '(w zakresie 10..131072)' : '\x1b[31m(POZA zakresem — to nie wygląda na ładunek DR)\x1b[0m'}`);

  let d;
  try { d = _decodeAztecPayload(new Uint8Array(buf)); }
  catch (e) {
    console.log(`\n  \x1b[31m✗ ${e.message}\x1b[0m`);
    console.log('\n  Możliwe przyczyny: to nie jest ładunek DR, bajty są zniekształcone,');
    console.log('  albo plik zawiera coś innego niż surowe wyjście dekodera Aztec.\n');
    process.exit(1);
  }

  const OSOBOWE = new Set(['vin', 'nrRej', 'seriaDr']);
  const maskuj = (k, v) => OSOBOWE.has(k) ? `${String(v).slice(0, 2)}… (${String(v).length} zn.)` : v;
  console.log(`\n  \x1b[32m✓ rozpakowane\x1b[0m — format=${d.format}, pól w ładunku=${d.fieldCount}\n`);
  for (const [k, v] of Object.entries(d.fields)) console.log(`    ${k.padEnd(14)} ${maskuj(k, v)}`);
  console.log('\n  (VIN, nr rej. i seria dowodu zamaskowane — log można wkleić bez wycieku)');
  console.log('\n  UWAGA: to dowodzi wyłącznie, że NRV2E i mapowanie pól radzą sobie z PRAWDZIWYM');
  console.log('  ładunkiem. Nie mówi nic o tym, czy potrafimy ten kod ZNALEŹĆ na zdjęciu.\n');
  process.exit(0);
}

/**
 * Wyciąga produkcyjny dekoder z worker/index.js i uruchamia go w tym procesie.
 *
 * Wyciąga, a NIE kopiuje — celowo. Kopia rozjechałaby się z produkcją i ukryła
 * dokładnie ten błąd, który to narzędzie ma wykrywać. Ten projekt ma już dwa
 * takie precedensy: dwie tablice wskaźników CO2 i dwie listy źródeł kreatora
 * raportów, obie ciche i obie rozjechane z rzeczywistością.
 *
 * Kotwice są jawne: brak którejkolwiek przerywa działanie z błędem, zamiast po
 * cichu sięgnąć po nieaktualny odpowiednik.
 */
function wyciagnijDekoder() {
  const src = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');
  const OD = '// ─── AZTEC DR DECODER', DO = 'async function handleAztec';
  const i = src.indexOf(OD), j = src.indexOf(DO);
  if (i < 0 || j < 0 || j < i) {
    console.error('Nie znaleziono sekcji dekodera w worker/index.js (kotwice:');
    console.error(`  "${OD}" oraz "${DO}"). Jeśli kod przeniesiono — popraw kotwice tutaj.`);
    process.exit(2);
  }
  return new Function(src.slice(i, j) + '\nreturn { _nrv2eDecompress, _decodeAztecPayload };')();
}

/**
 * NRV2E w wariancie "same literały": bit 1 oznacza, że kolejny bajt strumienia
 * jest literałem. Układ wynika wprost z `_BitReader` w Workerze — bity idą
 * MSB-first z bajtu flag, a `readByte()` pobiera następny CAŁY bajt strumienia,
 * omijając bufor bitowy. Round-trip przez produkcyjny `_nrv2eDecompress()`
 * potwierdza, że ten układ jest poprawny.
 *
 * Kompresora NRV2E nie mamy i nie jest potrzebny: dekompresor obsługuje ten
 * wariant tą samą ścieżką co strumień z odwołaniami wstecz.
 */
function nrv2eLiteraly(bajty) {
  const out = [];
  for (let i = 0; i < bajty.length; i += 8) {
    const grupa = bajty.slice(i, i + 8);
    out.push((0xFF << (8 - grupa.length)) & 0xFF);
    for (const b of grupa) out.push(b);
  }
  return out;
}

/**
 * Ładunek kontrolny dla --selftest: prawdziwy FORMAT dowodu (nowy, >40 pól),
 * ale w całości dane syntetyczne — żadnego prawdziwego VIN-u ani rejestracji.
 *
 * Pola `typ` i `model` zawierają znaki U+0180/U+0192/U+019F, których UTF-16LE
 * daje młodszy bajt w zakresie 0x80–0x9F. To ten zakres psuła konwersja znakowa
 * (CP1252: 0x80 → U+20AC → 0xAC). W prawdziwym dowodzie te bajty biorą się nie
 * ze znaków, lecz ze struktury skompresowanego strumienia — tutaj, przy
 * kodowaniu samymi literałami, trzeba je wprowadzić tekstem. Zakres bajtów
 * jest więc odwzorowany wiernie, choć innym mechanizmem.
 */
function zbudujDrKontrolny() {
  const pola = new Array(55).fill('');
  const oczekiwane = {
    seriaDr: 'DR/TEST/0001', nrRej: 'ZZ00000', marka: 'TESTMARKA',
    typ: 'Tƀ-92', model: 'Mƒ-9F Ɵ', vin: 'TESTVIN0000000001',
    dmcKg: '18000', dmcKg2: '18000', dmcZespolu: '40000', masaWlKg: '7500',
    kategoria: 'N3', liczbaOsi: '3', pojSilnika: '10837', mocKW: '265',
    dataRej: '15.03.2019', miejscaSied: '3',
  };
  const _DR_NEW = { seriaDr:1, nrRej:7, marka:8, typ:9, model:12, vin:13,
    dmcKg:38, dmcKg2:39, dmcZespolu:40, masaWlKg:41, kategoria:42, liczbaOsi:44,
    pojSilnika:48, mocKW:49, paliwo:50, dataRej:51, miejscaSied:52 };
  for (const [k, idx] of Object.entries(_DR_NEW)) {
    if (k === 'paliwo') { pola[idx] = 'D'; continue; }          // _FUEL: D → 'ON (Olej napędowy)'
    if (k === 'dataRej') { pola[idx] = '20190315'; continue; }  // YYYYMMDD → DD.MM.YYYY
    pola[idx] = oczekiwane[k];
  }
  oczekiwane.paliwo = 'ON (Olej napędowy)';

  const tekst = pola.join('|');
  const utf16 = [];
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst.charCodeAt(i);
    utf16.push(c & 0xFF, (c >> 8) & 0xFF);
  }
  const dlugosc = utf16.length;
  const bajty = [dlugosc & 0xFF, (dlugosc >> 8) & 0xFF, (dlugosc >> 16) & 0xFF, (dlugosc >>> 24) & 0xFF]
    .concat(nrv2eLiteraly(utf16));
  return { bajty, oczekiwane };
}

const { bajty: KONTROLNY, oczekiwane: POLA_OCZEKIWANE } = zbudujDrKontrolny();

/**
 * Opcje uruchomienia przeglądarki — MUSZĄ działać i na Windowsie, i w kontenerze CI.
 *
 * Pierwsza wersja tego pliku miała ścieżkę do Chromium zahardkodowaną na układ
 * kontenera deweloperskiego (`/opt/pw-browsers/...`). Na maszynie deweloperskiej
 * z Windowsem taki plik nie istnieje, więc `chromium.launch()` padał na
 * „executable doesn't exist" — narzędzie było nieuruchamialne dokładnie tam, gdzie
 * leżą prawdziwe zdjęcia dowodów.
 *
 * Kolejność: jawny CHROME_PATH → preinstalowana binarka, jeśli FAKTYCZNIE istnieje →
 * Chromium Playwrighta (pominięty `executablePath`, biblioteka znajdzie własny build).
 * `--no-sandbox` jest konieczny w kontenerze i nieszkodliwy poza nim.
 */
function opcjeChrome() {
  const args = ['--no-sandbox'];
  const jawny = process.env.CHROME_PATH;
  if (jawny) {
    if (!fs.existsSync(jawny)) {
      console.error(`CHROME_PATH wskazuje na nieistniejący plik: ${jawny}`);
      process.exit(2);
    }
    return { executablePath: jawny, args };
  }
  const wKontenerze = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (fs.existsSync(wKontenerze)) return { executablePath: wKontenerze, args };
  return { args };   // Playwright sam wskaże swoją binarkę (npx playwright install chromium)
}

/**
 * Uruchomienie przeglądarki z komunikatem, który mówi CO ZROBIĆ.
 *
 * Bez tego brak Chromium kończy się gołym stack tracem Playwrighta — a to najbardziej
 * prawdopodobny sposób, w jaki to narzędzie odmówi współpracy na świeżej maszynie.
 */
async function uruchomChrome(chromium) {
  try {
    return await chromium.launch(opcjeChrome());
  } catch (e) {
    console.error('\nNie udało się uruchomić Chromium.\n');
    console.error('  Najczęstsza przyczyna: Playwright nie ma pobranej przeglądarki.');
    console.error('  Napraw jednym z dwóch sposobów:\n');
    console.error('    npx playwright install chromium');
    console.error('    albo wskaż istniejącą przeglądarkę:');
    console.error('    CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"\n');
    console.error(`  Komunikat Playwrighta: ${String(e && e.message || e).split('\n')[0]}\n`);
    process.exit(2);
  }
}
const ZXING = path.join(ROOT, 'node_modules', '@zxing', 'library', 'umd', 'index.min.js');

async function glowna() {
  if (!fs.existsSync(ZXING)) {
    console.error('Brak @zxing/library. Uruchom: npm i --no-save @zxing/library@0.20.0');
    process.exit(2);
  }
  const { chromium } = require(path.join(ROOT, 'node_modules', '@playwright', 'test'));

  // --selftest: generujemy wlasny kod Aztec o ZNANYM ladunku, zeby zmierzyc
  // WIERNOSC BAJTOW, a nie tylko skutecznosc detekcji.
  let obrazBuf;
  if (SELFTEST) {
    const Z = require(path.join(ROOT, 'node_modules', '@zxing', 'library'));
    const code = Z.AztecEncoder.encode(Uint8Array.from(KONTROLNY), 33, Z.AztecEncoder.DEFAULT_AZTEC_LAYERS);
    const m = code.getMatrix();
    const px = []; for (let y=0;y<m.getHeight();y++){const r=[];for(let x=0;x<m.getWidth();x++)r.push(m.get(x,y)?1:0);px.push(r);}
    const b0 = await uruchomChrome(chromium);
    const p0 = await b0.newPage();
    const S=10,Q=40,W=m.getWidth()*S+2*Q,H=m.getHeight()*S+2*Q;
    const du = await p0.evaluate(({px,S,Q,W,H})=>{
      const c=document.createElement('canvas');c.width=W;c.height=H;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';
      for(let i=0;i<px.length;i++)for(let j=0;j<px[i].length;j++)if(px[i][j])x.fillRect(Q+j*S,Q+i*S,S,S);
      return c.toDataURL('image/png');
    },{px,S,Q,W,H});
    await b0.close();
    obrazBuf = Buffer.from(du.split(',')[1],'base64');
  }

  // PDF na wejściu renderujemy DOKŁADNIE tak, jak robi to produkcja — ustawienia
  // czytane z `PDF_AZTEC` w modules/dr-import.js, nie wpisane tutaj na sztywno.
  // Dzięki temu narzędzie mierzy produkcyjną ścieżkę, a nie jej wyobrażenie: zmiana
  // DPI albo formatu w module od razu zmienia to, co ten test sprawdza.
  const JEST_PDF = !SELFTEST && /\.pdf$/i.test(obraz || '');
  let PDFJS = null, PDFWRK = null, USTAW_PDF = null;
  if (JEST_PDF) {
    PDFJS  = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.js');
    PDFWRK = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
    if (!fs.existsSync(PDFJS)) {
      console.error('Wejście to PDF, a brakuje pdfjs-dist. Uruchom:');
      console.error('  npm i --no-save pdfjs-dist@3.11.174        # ta sama wersja co w index.html');
      process.exit(2);
    }
    const src = fs.readFileSync(path.join(ROOT, 'modules', 'dr-import.js'), 'utf8');
    const m = src.match(/PDF_AZTEC\s*=\s*\{([^}]*)\}/);
    if (!m) { console.error('Nie znaleziono PDF_AZTEC w modules/dr-import.js — popraw kotwicę.'); process.exit(2); }
    USTAW_PDF = {
      dpi: Number((m[1].match(/dpi:\s*(\d+)/) || [])[1]) || 300,
      format: (m[1].match(/format:\s*'([^']+)'/) || [])[1] || 'image/png',
    };
    console.log(`\n  Wejście PDF — render jak w produkcji: ${USTAW_PDF.dpi} DPI, ${USTAW_PDF.format}`);
  }

  // Serwer lokalny: strona ładuje ZXing z DYSKU, nie z CDN — kontener nie ma sieci.
  const srv = http.createServer((req, res) => {
    const mapa = {
      '/': ['text/html', Buffer.from('<!doctype html><meta charset="utf-8"><title>aztec</title>')],
      '/zxing.js': ['application/javascript', fs.readFileSync(ZXING)],
      '/detector.js': ['application/javascript', fs.readFileSync(path.join(ROOT, 'modules', 'aztec-detector.js'))],
      '/obraz': ['application/octet-stream', SELFTEST ? obrazBuf : fs.readFileSync(obraz)],
    };
    if (JEST_PDF) {
      mapa['/pdf.js'] = ['application/javascript', fs.readFileSync(PDFJS)];
      mapa['/pdf.worker.js'] = ['application/javascript', fs.readFileSync(PDFWRK)];
    }
    const wpis = mapa[req.url];
    if (!wpis) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': wpis[0] });
    res.end(wpis[1]);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;

  const browser = await uruchomChrome(chromium);
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.addScriptTag({ url: '/zxing.js' });
  await page.addScriptTag({ url: '/detector.js' });
  if (JEST_PDF) {
    await page.addScriptTag({ url: '/pdf.js' });
    await page.evaluate(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'; });
  }

  const wynik = await page.evaluate(async (pdfOpts) => {
    let canvas;
    if (pdfOpts) {
      // Odwzorowanie _pdfPage1Blob() z dr-import.js: render strony 1 w zadanym DPI,
      // zapis do blobu w zadanym formacie i powrót do canvasu — tak jak w produkcji,
      // razem z tym powrotem, bo to on decyduje o ostatecznych pikselach.
      const dane = await (await fetch('/obraz')).arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: dane }).promise;
      const strona = await pdf.getPage(1);
      const vp = strona.getViewport({ scale: pdfOpts.dpi / 72 });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      await strona.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      const blob = await new Promise(r => cv.toBlob(r, pdfOpts.format));
      const url = URL.createObjectURL(blob);
      const im = new Image();
      await new Promise(r => { im.onload = r; im.onerror = r; im.src = url; });
      canvas = document.createElement('canvas');
      canvas.width = im.naturalWidth; canvas.height = im.naturalHeight;
      canvas.getContext('2d').drawImage(im, 0, 0);
      URL.revokeObjectURL(url);
    } else {
      const img = new Image();
      await new Promise(res => { img.onload = res; img.onerror = res; img.src = '/obraz'; });
      canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
    }
    if (!canvas.width) return { blad: 'nie udało się wczytać obrazu' };

    // Odwrócenie windows-1252 — kopia `_aztecTextToBytes` z app.js. Trzymaj zgodne:
    // to jedyne miejsce, w którym mierzymy wierność bajtów, więc rozjazd tutaj
    // ukryłby dokładnie ten błąd, który ten skrypt ma wykrywać.
    const CP = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,
      0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,
      0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,
      0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
    const naBajty = t => { const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); u[i] = CP[c] !== undefined ? CP[c] : (c & 0xFF); } return u; };
    // Stara konwersja — pokazujemy w selfteście, co dokładnie naprawiono.
    const naBajtyStare = t => { const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i) & 0xFF; return u; };

    // ── Ścieżka A: dokładnie jak tryAztecFromCanvas() w app.js ──────────────
    function sciezkaA(c) {
      try {
        const hints = new Map([
          [ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.AZTEC]],
          [ZXing.DecodeHintType.TRY_HARDER, true],
          [ZXing.DecodeHintType.CHARACTER_SET, 'ISO-8859-1'],
        ]);
        const reader = new ZXing.MultiFormatReader(); reader.setHints(hints);
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const argb = new Int32Array(c.width * c.height);
        for (let i = 0; i < argb.length; i++) argb[i] = (d.data[i*4] << 16) | (d.data[i*4+1] << 8) | d.data[i*4+2];
        const lum = new ZXing.RGBLuminanceSource(argb, c.width, c.height);
        const r = reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum)));
        return { ok: true, bajty: Array.from(naBajty(r.getText())), bajtyStare: Array.from(naBajtyStare(r.getText())) };
      } catch (e) { return { ok: false, blad: String(e && e.message || e).slice(0, 120) }; }
    }

    // Aplikacja próbuje czterech obrotów — odwzorowujemy to samo.
    let A = { ok: false, blad: 'brak wyniku' };
    for (const deg of [0, 90, 270, 180]) {
      const c = document.createElement('canvas');
      const obr = deg % 180 !== 0;
      c.width = obr ? canvas.height : canvas.width;
      c.height = obr ? canvas.width : canvas.height;
      const cx = c.getContext('2d');
      cx.translate(c.width / 2, c.height / 2); cx.rotate(deg * Math.PI / 180);
      cx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      const r = sciezkaA(c);
      if (r.ok) { A = { ...r, obrot: deg }; break; }
      A = r;
    }

    // ── Ścieżka B: TaxOrderAztecDetector ────────────────────────────────────
    let B;
    try {
      const r = await window.TaxOrderAztecDetector.detect(canvas, { budget: 10000 });
      B = r ? { ok: true, strategia: r.strategy, proby: r.attempts, bajty: Array.from(naBajty(r.text)), bajtyStare: Array.from(naBajtyStare(r.text)) }
            : { ok: false, blad: 'detect() zwrócił null' };
    } catch (e) { B = { ok: false, blad: String(e && e.message || e).slice(0, 120) }; }

    return { A, B, wymiar: `${canvas.width}x${canvas.height}` };
  }, JEST_PDF ? USTAW_PDF : null);

  await browser.close(); srv.close();

  if (wynik.blad) { console.error(wynik.blad); process.exit(1); }

  const hex = b => b.slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(' ');
  // Kryterium z handleAztec(): pierwsze 4 bajty to długość po dekompresji (uint32 LE).
  const naglowekOk = b => { if (!b || b.length < 8) return false; const n = b[0] | (b[1]<<8) | (b[2]<<16) | (b[3]*0x1000000); return n >= 10 && n <= 131072; };

  console.log('\nPorównanie ścieżek dekodowania Aztec\n');
  for (const [nazwa, r] of [['A (obecna, ISO-8859-1)', wynik.A], ['B (TaxOrderAztecDetector)', wynik.B]]) {
    if (!r.ok) { console.log(`  ${nazwa.padEnd(28)} ✗ ${r.blad}`); continue; }
    const ok = naglowekOk(r.bajty);
    const dl = r.bajty[0] | (r.bajty[1]<<8) | (r.bajty[2]<<16) | (r.bajty[3]*0x1000000);
    console.log(`  ${nazwa.padEnd(28)} ${ok ? '✓' : '✗'} bajtów=${r.bajty.length} nagłówek=${dl} ${ok ? '(w zakresie 10..131072)' : '(POZA zakresem — ładunek zniekształcony)'}`);
    console.log(`  ${' '.repeat(30)}pierwsze bajty: ${hex(r.bajty)}`);
    if (r.strategia) console.log(`  ${' '.repeat(30)}strategia: ${r.strategia}, prób: ${r.proby}`);
  }

  // Pełne dekodowanie produkcyjnym kodem Workera — dopiero to rozstrzyga, czy
  // ładunek jest UŻYTECZNY. Sam nagłówek w zakresie 10..131072 tego nie dowodzi:
  // zniekształcone bajty potrafią dać wiarygodną długość i wywalić się dopiero
  // w NRV2E albo wyprodukować pola-śmieci.
  const { _decodeAztecPayload } = wyciagnijDekoder();
  const dekoduj = b => {
    try { return { ok: true, ...(_decodeAztecPayload(Uint8Array.from(b))) }; }
    catch (e) { return { ok: false, blad: String(e && e.message || e).slice(0, 120) }; }
  };

  if (SELFTEST) {
    console.log('\nKontrola wierności bajtów (ładunek znany):');
    console.log(`  oczekiwano: ${hex(KONTROLNY)}`);
    let bledy = 0;
    for (const [nazwa, r] of [['A', wynik.A], ['B', wynik.B]]) {
      if (!r.ok) { console.log(`  ${nazwa}: ✗ nie odczytano`); bledy++; continue; }
      const roznice = (b) => b.map((x,i)=>x!==KONTROLNY[i]?`${KONTROLNY[i].toString(16)}→${x.toString(16)}`:null).filter(Boolean);
      const zgodne = r.bajty.length === KONTROLNY.length && r.bajty.every((x,i)=>x===KONTROLNY[i]);
      const zle = roznice(r.bajty);
      const skrot = l => l.length > 4 ? l.slice(0,4).join(', ') + ` (+${l.length-4} więcej)` : l.join(', ');
      console.log(`  ${nazwa}: ${zgodne?'✓ bajty wierne':'✗ ZNIEKSZTAŁCONE — '+skrot(zle)}`);
      if (r.bajtyStare) {
        const zleStare = roznice(r.bajtyStare);
        console.log(`     bez naprawy (charCodeAt & 0xFF): ${zleStare.length?'✗ '+skrot(zleStare):'✓ wierne'}`);
      }
      if (!zgodne) bledy++;
    }

    // Wierność bajtów to warunek konieczny, nie wystarczający. Ten krok przepuszcza
    // ładunek przez CAŁĄ produkcyjną ścieżkę Workera (NRV2E → UTF-16LE → pola)
    // i porównuje wynik z tym, co zakodowaliśmy.
    console.log('\nDekodowanie end-to-end (produkcyjny _decodeAztecPayload z worker/index.js):');
    for (const [nazwa, r] of [['A', wynik.A], ['B', wynik.B]]) {
      if (!r.ok) continue;
      const d = dekoduj(r.bajty);
      if (!d.ok) { console.log(`  ${nazwa}: ✗ ${d.blad}`); bledy++; continue; }
      const zle = Object.entries(POLA_OCZEKIWANE)
        .filter(([k, v]) => d.fields[k] !== v)
        .map(([k, v]) => `${k}: "${v}" → "${d.fields[k] ?? '(brak)'}"`);
      console.log(`  ${nazwa}: ${zle.length ? '✗ ' + zle.join('; ') : `✓ ${Object.keys(POLA_OCZEKIWANE).length}/${Object.keys(POLA_OCZEKIWANE).length} pól zgodnych (format=${d.format}, pól w ładunku=${d.fieldCount})`}`);
      if (zle.length) bledy++;

      // Kontrola negatywna: ten sam ładunek po STAREJ konwersji. Musi się wywalić —
      // gdyby przechodził, znaczyłoby to, że test nie mierzy tego, co deklaruje.
      if (r.bajtyStare) {
        const ds = dekoduj(r.bajtyStare);
        const zlamane = !ds.ok || Object.entries(POLA_OCZEKIWANE).some(([k, v]) => ds.fields[k] !== v);
        console.log(`     bez naprawy: ${zlamane ? '✗ ' + (ds.ok ? 'pola niezgodne' : ds.blad) : '⚠ PRZESZŁO — test nie mierzy tego, co deklaruje'}`);
        if (!zlamane) bledy++;
      }
    }

    console.log(bledy
      ? '\n  Konwersja znakowa psuje bajty 0x80–0x9F (CP1252). Ładunek NRV2E zawiera dowolne\n  bajty, więc dotyczy to prawdziwych dowodów. Trzeba czytać bajty bez warstwy tekstowej.\n'
      : '\n  Cała ścieżka działa: obraz → Aztec → bajty → NRV2E → UTF-16LE → pola dowodu.\n'
        + '  UWAGA: to kod Aztec wygenerowany przez nas, nie zdjęcie. Dowodzi poprawności\n'
        + '  DEKODOWANIA, nie skuteczności DETEKCJI na sfotografowanym dokumencie.\n');
    process.exit(bledy ? 1 : 0);
  }

  // ── Prawdziwe zdjęcie: pełne dekodowanie z maskowaniem danych osobowych ──────
  //
  // VIN i numer rejestracyjny identyfikują pojazd i właściciela, więc NIE trafiają
  // na wyjście w całości — inaczej wystarczy wkleić log do czatu albo do zgłoszenia,
  // żeby dane produkcyjne wyszły poza `~/Documents/taxorder-backupy/`. Do oceny,
  // czy dekodowanie zadziałało, w zupełności wystarczy sama obecność i długość.
  // Parametry techniczne (DMC, osie, kategoria, paliwo) danymi osobowymi nie są
  // i to właśnie ich potrzebuje DT-1 — te pokazujemy w całości.
  const OSOBOWE = new Set(['vin', 'nrRej', 'seriaDr']);
  const maskuj = (k, v) => OSOBOWE.has(k) ? `${String(v).slice(0, 2)}… (${String(v).length} zn.)` : v;

  console.log('\nDekodowanie pełnego ładunku (produkcyjny kod Workera):');
  for (const [nazwa, r] of [['A', wynik.A], ['B', wynik.B]]) {
    if (!r.ok) { console.log(`  ${nazwa}: — (nie odczytano kodu)`); continue; }
    const d = dekoduj(r.bajty);
    if (!d.ok) { console.log(`  ${nazwa}: ✗ ${d.blad}`); continue; }
    const opis = Object.entries(d.fields).map(([k, v]) => `${k}=${maskuj(k, v)}`).join(', ');
    console.log(`  ${nazwa}: ✓ format=${d.format}, pól=${d.fieldCount}`);
    console.log(`     ${opis || '(dekompresja przeszła, ale żadne znane pole nie ma wartości)'}`);
  }
  console.log('  (VIN, nr rej. i seria dowodu zamaskowane — patrz komentarz w źródle)');

  const uzyteczne = r => r.ok && naglowekOk(r.bajty) && dekoduj(r.bajty).ok;
  const aOk = uzyteczne(wynik.A);
  const bOk = uzyteczne(wynik.B);
  console.log('\nWniosek:');
  if (bOk && aOk) {
    const zgodne = wynik.A.bajty.length === wynik.B.bajty.length && wynik.A.bajty.every((x, i) => x === wynik.B.bajty[i]);
    console.log(zgodne
      ? '  Obie ścieżki dają IDENTYCZNE bajty — detektor można podpiąć bez zmiany zachowania.'
      : '  Obie dają poprawny nagłówek, ale RÓŻNE bajty — sprawdź, która wersja parsuje się w Workerze.');
  } else if (bOk) {
    console.log('  Tylko ścieżka B daje użyteczny ładunek — detektor jest lepszy, warto podpiąć.');
  } else if (aOk) {
    console.log('  Tylko ścieżka A daje użyteczny ładunek. NIE podpinaj detektora: jego .getText()');
    console.log('  bez CHARACTER_SET zniekształca bajty binarne. Najpierw popraw detektor.');
  } else {
    console.log('  Żadna ścieżka nie odczytała kodu z tego zdjęcia — spróbuj ostrzejszego ujęcia.');
  }
  console.log('');
}

// Eksport dla innych narzędzi — bez uruchamiania czegokolwiek.
module.exports = { wyciagnijDekoder, nrv2eLiteraly, zbudujDrKontrolny, opcjeChrome, uruchomChrome, KONTROLNY, POLA_OCZEKIWANE };

/**
 * Tryb `--katalog`: uruchamia ścieżkę jednoplikową na KAŻDYM dokumencie w folderze
 * i podaje WSKAŹNIK SKUTECZNOŚCI, a nie werdykt z jednego pliku.
 *
 * PO CO: jeden dokument daje odpowiedź „ten się nie odczytał", co nie mówi nic o tym,
 * czy problem jest w materiale, czy w naszej ścieżce. Dwadzieścia dokumentów mówi,
 * czy odczytujemy 0%, 40% czy 95% — a to jest różnica między „nie działa",
 * „działa przy dobrej jakości skanu" i „działa, trafiliśmy na feralny plik".
 *
 * Uruchamia każdy plik jako OSOBNY PROCES, zamiast przerabiać pętlę wewnątrz strony.
 * Wolniej (nowa przeglądarka na plik), ale nie dotyka działającej ścieżki jednoplikowej
 * i awaria jednego dokumentu nie przewraca całego przebiegu.
 *
 * NIC NIE ZAPISUJE. Nazwy plików bywają numerami rejestracyjnymi, więc na wyjściu
 * są skracane; VIN, nr rej. i seria dowodu i tak są maskowane przez ścieżkę jednoplikową.
 */
function trybKatalogu(dir) {
  if (!fs.existsSync(dir)) { console.error(`Nie ma katalogu: ${dir}`); process.exit(2); }
  const OBSLUGIWANE = /\.(pdf|jpe?g|png|webp)$/i;
  const pliki = fs.readdirSync(dir).filter(f => OBSLUGIWANE.test(f)).sort();
  if (!pliki.length) { console.error(`Brak plików (pdf/jpg/png/webp) w: ${dir}`); process.exit(2); }

  const { execFileSync } = require('child_process');
  const skrot = f => f.length > 34 ? f.slice(0, 16) + '…' + f.slice(-14) : f;

  console.log(`\nOdczyt kodu Aztec — ${pliki.length} dokumentów z ${dir}\n`);
  const wyniki = [];
  for (const f of pliki) {
    let out = '', kod = 0;
    try {
      out = execFileSync(process.execPath, [__filename, path.join(dir, f)],
        { encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { out = (e.stdout || '') + (e.stderr || ''); kod = e.status ?? 1; }

    const czysty = out.replace(/\x1b\[[0-9;]*m/g, '');
    const A = /A: ✓ format=/.test(czysty);
    const B = /B: ✓ format=/.test(czysty);

    // Kod 2 = narzędzie NIE MOGŁO SIĘ URUCHOMIĆ (brak zależności, brak przeglądarki,
    // przesunięte kotwice). To NIE jest to samo co "kodu nie odczytano" i mieszanie
    // tych dwóch daje fałszywy wniosek o materiale — sam się na to nabrałem przy
    // pierwszym przebiegu, gdy brak pdfjs-dist policzył się jako porażka odczytu.
    const awariaNarzedzia = kod === 2;
    const stan = awariaNarzedzia ? '\x1b[33m⚠ narzędzie\x1b[0m'
      : (A || B) ? '\x1b[32m✓ odczytany\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const czym = awariaNarzedzia ? (czysty.trim().split('\n')[0] || '').slice(0, 44)
      : A && B ? 'obie ścieżki' : A ? 'tylko A (produkcyjna)' : B ? 'tylko B (detektor)' : '—';
    console.log(`  ${skrot(f).padEnd(36)} ${stan.padEnd(22)} ${czym}`);
    wyniki.push({ f, A, B, ok: A || B, awariaNarzedzia });
  }

  const awarie = wyniki.filter(w => w.awariaNarzedzia);
  if (awarie.length) {
    console.log(`\n  \x1b[33m${awarie.length} plik(ów) NIE ZOSTAŁO ZBADANYCH — narzędzie nie mogło się uruchomić.\x1b[0m`);
    console.log('  Nie licz ich jako porażki odczytu. Napraw przyczynę i powtórz, inaczej');
    console.log('  wskaźnik poniżej opisuje co innego, niż się wydaje.');
  }
  const zbadane = wyniki.filter(w => !w.awariaNarzedzia);
  if (!zbadane.length) { console.log('\n  Żaden plik nie został zbadany.\n'); process.exit(2); }

  const ok = zbadane.filter(w => w.ok).length;
  const tylkoB = zbadane.filter(w => w.B && !w.A).length;
  const proc = Math.round(ok / zbadane.length * 100);
  console.log(`\n  Odczytane: ${ok}/${zbadane.length} (${proc}%)`);
  if (tylkoB) console.log(`  \x1b[33m${tylkoB} dokument(ów) odczytał TYLKO detektor (ścieżka B), której aplikacja nie używa.\x1b[0m`);
  console.log(proc === 0
    ? '\n  Zero odczytów na całym zbiorze — to wskazuje na naszą ścieżkę albo na wspólną\n  cechę materiału (ten sam skaner, ten sam format), nie na feralny pojedynczy plik.\n'
    : proc === 100
      ? '\n  Wszystko odczytane — ścieżka produkcyjna działa na realnych dowodach.\n'
      : `\n  Częściowa skuteczność. Porównaj pliki odczytane z nieodczytanymi (format, DPI,\n  skaner) — różnica między nimi jest tu ważniejsza niż sam odsetek.\n`);
  process.exit(ok ? 0 : 1);
}

if (BEZPOSREDNIO && katalog) trybKatalogu(katalog);
if (BEZPOSREDNIO && plikBajtow) trybBajtow(plikBajtow);
if (BEZPOSREDNIO) glowna();
