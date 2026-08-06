'use strict';
/**
 * Analiza korpusu DR oznaczonych jako "Aztec nieodczytany".
 * Kategoryzuje pliki wg nazwy i rozdzielczości; szacuje ile to realny brak
 * kodu Aztec (verte, tymczasowe, zagraniczne), a ile — porażka detekcji
 * (stały DR z wystarczającą rozdzielczością).
 *
 * Wymaga: sharp  (npm install sharp w katalogu projektu)
 * Narzędzie lokalne — nie uruchamiać na CI.
 *
 * Użycie:
 *   node tools/dr-analyze-unreadable.js <checkpoint.ndjson>
 *
 *   checkpoint.ndjson — plik z dr-extractor (dr-extractor-checkpoint.ndjson);
 *                       ścieżki do obrazów muszą być dostępne lokalnie.
 */
const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const CKPT = (() => {
  const p = process.argv[2];
  if (!p) {
    console.error('BŁĄD: Podaj ścieżkę do pliku checkpoint.');
    console.error('Użycie: node tools/dr-analyze-unreadable.js <checkpoint.ndjson>');
    process.exit(1);
  }
  if (!fs.existsSync(p)) { console.error(`BŁĄD: Plik nie istnieje: ${p}`); process.exit(1); }
  return p;
})();

// Kategorie według nazwy pliku
const KATEGORIE = {
  verte:       /verte|verso|tył|tyl\b|back|str\.?\s*2|strona\s*2/i,
  tymczasowy:  /tymcz|tymczasow/i,
  miekki:      /mi[eę]kki/i,
  zagraniczny: /norweg|niemiec|deutsch|litew|latvia|foreign|abroad|ausland/i,
  duplikat:    /kopia|duplikat|copy/i,
  staly:       /sta[łl]y|sta[łl]e/i,
};

function kategoriaPliku(name) {
  const lower = name.toLowerCase();
  if (KATEGORIE.verte.test(lower))       return 'verte (tył DR)';
  if (KATEGORIE.tymczasowy.test(lower))  return 'tymczasowy';
  if (KATEGORIE.miekki.test(lower))      return 'miękki (stary format)';
  if (KATEGORIE.zagraniczny.test(lower)) return 'zagraniczny';
  if (KATEGORIE.duplikat.test(lower))    return 'kopia/duplikat';
  if (KATEGORIE.staly.test(lower))       return 'stały (powinien mieć Aztec)';
  return 'nieokreślony';
}

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff']);

(async () => {
  // Wczytaj checkpoint
  const lines = fs.readFileSync(CKPT, 'utf8').split('\n');
  const unreadable = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.status === 'unreadable' && e.reason === 'Aztec nieodczytany') {
        unreadable.push(e);
      }
    } catch {}
  }

  console.log(`Pliki "Aztec nieodczytany" w checkpoincie: ${unreadable.length}\n`);

  // Podział na format
  const pdfs   = unreadable.filter(e => (e.ext||'').toLowerCase() === '.pdf');
  const images = unreadable.filter(e => IMG_EXTS.has((e.ext||'').toLowerCase()));
  const other  = unreadable.filter(e => !IMG_EXTS.has((e.ext||'').toLowerCase()) && (e.ext||'').toLowerCase() !== '.pdf');

  console.log(`Format:`);
  console.log(`  PDF:    ${pdfs.length}`);
  console.log(`  Obraz:  ${images.length}`);
  console.log(`  Inne:   ${other.length}`);

  // Kategorie wg nazwy pliku
  const katCount = {};
  for (const e of unreadable) {
    const k = kategoriaPliku(e.name || '');
    katCount[k] = (katCount[k] || 0) + 1;
  }
  console.log(`\nKategorie wg nazwy pliku:`);
  for (const [k, n] of Object.entries(katCount).sort((a,b)=>b[1]-a[1])) {
    const tag = (k.includes('stały') || k.includes('nieokreślony')) ? ' ← potencjalna PORAŻKA DETEKCJI' : ' ← realnie brak kodu';
    console.log(`  ${k.padEnd(32)} ${String(n).padStart(3)}${tag}`);
  }

  // Analiza rozdzielczości dla obrazów
  let lowRes = 0, grayCount = 0, errCount = 0;
  const resBuckets = { 'brak danych': 0, '<800px': 0, '800-1499px': 0, '1500-2999px': 0, '≥3000px': 0 };
  for (const e of images) {
    if (!e.path || !fs.existsSync(e.path)) { resBuckets['brak danych']++; continue; }
    try {
      const meta = await sharp(e.path).metadata();
      const shortSide = Math.min(meta.width || 0, meta.height || 0);
      if (shortSide < 800)        resBuckets['<800px']++;
      else if (shortSide < 1500)  resBuckets['800-1499px']++;
      else if (shortSide < 3000)  resBuckets['1500-2999px']++;
      else                        resBuckets['≥3000px']++;
      if (shortSide < 1500) lowRes++;
      // Grayscale: channels === 1 albo (channels === 3 i grayscale-ish)
      if (meta.channels === 1 || meta.space === 'b-w' || meta.space === 'grey') grayCount++;
    } catch { errCount++; resBuckets['brak danych']++; }
  }

  if (images.length > 0) {
    console.log(`\nRozdzielczość obrazów (krótszy bok):`);
    for (const [k, n] of Object.entries(resBuckets)) {
      if (n) console.log(`  ${k.padEnd(15)} ${n}`);
    }
    console.log(`  Poniżej 1500px (za niska): ${lowRes} / ${images.length}`);
    console.log(`  Skany czarno-białe:        ${grayCount} / ${images.length}`);
  }

  // Szacunek: ile realnie brakuje kodu vs porażka detekcji
  const realBrakKodu = (katCount['verte (tył DR)'] || 0)
    + (katCount['tymczasowy'] || 0)
    + (katCount['miękki (stary format)'] || 0)
    + (katCount['zagraniczny'] || 0)
    + (katCount['kopia/duplikat'] || 0)
    + lowRes;  // zbyt niska rozdzielczość

  // Dedupuj (lowRes może nakładać się na kategorie)
  const staly = katCount['stały (powinien mieć Aztec)'] || 0;
  const nieokreslony = katCount['nieokreślony'] || 0;
  const porazka = staly + Math.max(0, nieokreslony - lowRes);

  console.log(`\n══════════════════════════════════`);
  console.log(`  SZACUNEK`);
  console.log(`══════════════════════════════════`);
  console.log(`Realnie brakuje kodu Aztec:   ~${realBrakKodu}`);
  console.log(`  (miękki + tymczasowy + verte + zagraniczne + za niska rozdzielczość)`);
  console.log(`Potencjalna porażka detekcji: ~${porazka}`);
  console.log(`  (stały + nieokreślony z wystarczającą rozdzielczością)`);
  console.log(`UWAGA: szacunek orientacyjny — nakładanie się kategorii możliwe.`);
})().catch(e => { console.error('BŁĄD:', e.stack); process.exit(1); });
