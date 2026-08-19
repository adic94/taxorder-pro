#!/usr/bin/env node
/**
 * Test OCR na JEDNYM dowodzie, bez deployu — odpowiada na trzy pytania naraz.
 *
 *     node tools/cf-ocr-test.js <sciezka-do-dowodu.jpg|png|pdf>
 *
 * PO CO ISTNIEJE. Playground Workers AI (`playground.ai.cloudflare.com`) przyjmuje SAM
 * TEKST — nie ma tam pola na obraz. Nie da się więc sprawdzić w nim ani skuteczności
 * modelu na dowodzie, ani tego, czy licencja przepuszcza żądanie WIZYJNE. Jedyna droga
 * to prawdziwe wywołanie API z obrazem.
 *
 * NA CO ODPOWIADA:
 *   1. Czy licencja modelu jest zaakceptowana        — kod 5016 albo jego brak
 *   2. Czy `llama-4-scout` przyjmuje obraz przez CF  — to jest niewiadoma z CLAUDE.md
 *   3. Który model lepiej czyta TWÓJ dowód           — porównanie pól obok siebie
 *
 * DWA MODELE, DWA RÓŻNE KSZTAŁTY ŻĄDANIA. To nie jest ozdobnik — to sedno testu:
 *
 *   llama-3.2-11b-vision  ->  { prompt, image: [bajty] }        (parametr modelu wizyjnego)
 *   llama-4-scout         ->  { messages: [{ content: [image_url, text] }] }
 *
 * Podmiana samego identyfikatora modelu w kodzie Workera NIE zadziała: scout nie ma
 * parametru `image`, więc dostałby sam prompt i zacząłby ZMYŚLAĆ pola. Endpoint zwróciłby
 * 200 i komplet wartości wziętych z powietrza. Ten test pokazuje różnicę wprost.
 *
 * PRYWATNOŚĆ. Obraz leci wyłącznie na TWOJE konto Cloudflare (to samo, na którym stoi
 * Worker) — nigdzie indziej. Na wyjściu VIN, numer rejestracyjny i dane właściciela są
 * maskowane, więc log da się wkleić do zgłoszenia bez wycieku.
 *
 * POŚWIADCZENIA. Potrzebny token API z uprawnieniem Workers AI:
 *   Dashboard -> My Profile -> API Tokens -> Create Token -> Workers AI (Read)
 * Podaj go przez zmienną środowiskową albo `.env` (gitignorowany) — NIGDY w kodzie
 * i nigdy przez `$env:` w PowerShellu, bo trafi do ConsoleHost_history.txt.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
try { require('dotenv').config({ path: path.join(ROOT, '.env') }); } catch { /* dotenv opcjonalny */ }

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

/**
 * Wybór dokumentu: podany argument albo — gdy go nie ma — pierwszy obraz znaleziony
 * w `DR_FOLDER`. Chodzi o zdjęcie z człowieka obowiązku wskazywania konkretnego pliku
 * w katalogu, który ma tysiące pozycji w podfolderach per pojazd.
 *
 * PDF-y są POMIJANE przy automatycznym wyborze, nie renderowane w locie. Produkcyjny
 * render PDF ma własne ustawienia (PDF_AZTEC: 300 DPI, PNG bezstratny) i użycie byle
 * jakiego renderu zafałszowałoby wynik — test mierzyłby jakość naszego renderu, a nie
 * modelu. Osobne narzędzie `aztec-compare.js` renderuje PDF-y właściwymi ustawieniami.
 */
const OBRAZY = /\.(jpe?g|png|webp)$/i;

function znajdzObraz(dir, limit = 4000) {
  const wynik = { obraz: null, pdfy: 0, sprawdzone: 0 };
  const chodz = (d, glebokosc = 0) => {
    if (wynik.obraz || glebokosc > 6 || wynik.sprawdzone > limit) return;
    let wpisy = [];
    try { wpisy = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const w of wpisy) {
      if (wynik.obraz) return;
      const pelna = path.join(d, w.name);
      if (w.isDirectory()) { chodz(pelna, glebokosc + 1); continue; }
      wynik.sprawdzone++;
      if (OBRAZY.test(w.name)) { wynik.obraz = pelna; return; }
      if (/\.pdf$/i.test(w.name)) wynik.pdfy++;
    }
  };
  chodz(dir);
  return wynik;
}

let plik = process.argv[2];
let wybranyAutomatycznie = false;

if (!plik) {
  const folder = process.env.DR_FOLDER;
  if (!folder) {
    console.error(`\nUżycie: node tools/cf-ocr-test.js <ścieżka-do-dowodu>\n`);
    console.error(`Obsługiwane: .jpg .jpeg .png .webp\n`);
    console.error(`Albo ustaw ${'\x1b[1m'}DR_FOLDER${'\x1b[0m'} w .env, a narzędzie samo wybierze jeden obraz:`);
    console.error(`    DR_FOLDER=C:\\Users\\...\\Dokumentacja pojazdów\n`);
    process.exit(2);
  }
  if (!fs.existsSync(folder)) {
    console.error(`\nDR_FOLDER wskazuje na nieistniejący katalog:\n  ${folder}\n`);
    process.exit(2);
  }
  const z = znajdzObraz(folder);
  if (!z.obraz) {
    console.error(`\nNie znalazłem obrazu (.jpg/.png/.webp) w ${folder}`);
    console.error(`Sprawdzonych plików: ${z.sprawdzone}, w tym PDF-ów: ${z.pdfy}\n`);
    if (z.pdfy) {
      console.error(`Same PDF-y. Ten test przyjmuje obraz, bo render PDF ma własne ustawienia`);
      console.error(`(PDF_AZTEC: 300 DPI, PNG bezstratny) i byle jaki render zafałszowałby wynik.`);
      console.error(`Wyeksportuj jedną stronę do PNG i podaj ścieżkę wprost.\n`);
    }
    process.exit(2);
  }
  plik = z.obraz;
  wybranyAutomatycznie = true;
}

if (!fs.existsSync(plik)) {
  console.error(`\nNie ma takiego pliku:\n  ${plik}\n`);
  process.exit(2);
}

// account_id bierzemy z wrangler.toml — jest tam commitowany, więc nie jest sekretem.
const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
const ACCOUNT = (toml.match(/^account_id\s*=\s*"([^"]+)"/m) || [])[1];
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;

if (!ACCOUNT) { console.error(R('\nNie znalazłem account_id w wrangler.toml\n')); process.exit(2); }
if (!TOKEN) {
  console.error(R('\nBrak tokenu API.') + ` Ustaw ${B('CLOUDFLARE_API_TOKEN')}.\n`);
  console.error('  Token: Dashboard → My Profile → API Tokens → Create Token → Workers AI\n');
  console.error('  Windows, tylko na czas tego okna (nie trafia do historii pliku .env):');
  console.error(D('    $env:CLOUDFLARE_API_TOKEN = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText\n'));
  console.error('  Albo trwale w `.env` (gitignorowany):');
  console.error(D('    CLOUDFLARE_API_TOKEN=twoj-token\n'));
  process.exit(2);
}

const ext = path.extname(plik).toLowerCase();
if (ext === '.pdf') {
  console.error(Y('\nTo jest PDF.') + ' Ten test przyjmuje obraz — wyrenderuj stronę 1 najpierw.');
  console.error(D('  Produkcja renderuje PDF-y ustawieniami z PDF_AZTEC (300 DPI, PNG bezstratny).\n'));
  process.exit(2);
}
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext];
if (!MIME) { console.error(R(`\nNieobsługiwane rozszerzenie: ${ext}\n`)); process.exit(2); }

const bajty = fs.readFileSync(plik);
const b64 = bajty.toString('base64');

// Prompt skrócony do pól rozstrzygających. Pełny prompt produkcyjny ma ~2500 znaków
// i pilnuje pułapek formularza; tutaj chodzi o odpowiedź „czy model w ogóle widzi obraz",
// a nie o ocenę kompletności ekstrakcji.
const PROMPT = `To jest polski dowod rejestracyjny pojazdu. Odczytaj pola i zwroc WYLACZNIE JSON:
{"nrRej":"pole A - numer rejestracyjny","vin":"pole E - dokladnie 17 znakow, litery i cyfry, NIGDY nie zaczyna sie od malego e z gwiazdka","marka":"pole D.1","dmcKg":"pole F.1 - kilogramy z ZOLTEJ tabeli","liczbaOsi":"pole L","kategoria":"pole J"}
Jesli pola nie widac, wstaw pusty string. Nie zmyslaj wartosci.`;

const OSOBOWE = new Set(['vin', 'nrRej']);
const maskuj = (k, v) => (OSOBOWE.has(k) && v) ? `${String(v).slice(0, 2)}… (${String(v).length} zn.)` : v;

async function wywolaj(model, body) {
  const t0 = Date.now();
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const tresc = await r.text();
  let dane = null;
  try { dane = JSON.parse(tresc); } catch { /* nie-JSON — rozpoznane niżej */ }
  // Odpowiedź, która nie jest JSON-em API Cloudflare, NIE pochodzi od Cloudflare:
  // proxy firmowe, firewall albo portal sieciowy potrafią oddać własne 403 i wtedy
  // komunikat wygląda jak odrzucony token. Sprawdzone w praktyce — kontener, w którym
  // to narzędzie powstało, oddaje na ten host `403 Host not in allowlist`.
  const obce = !dane || (dane.success === undefined && !dane.result && !dane.errors);
  return { status: r.status, ms, dane, obce, tresc };
}

function opiszBlad(status, dane) {
  const err = dane?.errors?.[0];
  const kod = err?.code;
  if (kod === 5016) return R('5016 — LICENCJA MODELU NIEZAAKCEPTOWANA');
  // 4006 przy HTTP 429 to wyczerpany DZIENNY przydział neuronów (plan darmowy: 10 000/dobę),
  // nie awaria modelu ani problem z tokenem. Odnawia się o północy UTC. Przy 1318 dowodach
  // ten próg nie wystarczy na masowe przetwarzanie — patrz komentarz w podsumowaniu.
  if (kod === 4006) return R('4006 — WYCZERPANY DZIENNY LIMIT NEURONÓW (reset o północy UTC)');
  if (kod === 5035) return R('5035 — model wymaga planu Workers Paid');
  if (kod === 3041 || kod === 5018) return R(`${kod} — konto bez dostępu do tego modelu`);
  if (kod === 3042) return R('3042 — nieprawidłowy identyfikator modelu');
  if (kod === 3006) return R('3006 — żądanie za duże (zmniejsz obraz)');
  return R(`HTTP ${status}${kod ? ` / kod ${kod}` : ''}${err?.message ? ` — ${err.message}` : ''}`);
}

function polaZOdpowiedzi(dane) {
  const txt = dane?.result?.response || '';
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, powod: 'model nie zwrócił JSON', surowe: txt.slice(0, 160) };
  try { return { ok: true, pola: JSON.parse(m[0]) }; }
  catch (e) { return { ok: false, powod: `JSON nieparsowalny: ${e.message}`, surowe: m[0].slice(0, 160) }; }
}

(async () => {
  console.log(B(`\n  Test OCR na jednym dowodzie — konto ${ACCOUNT.slice(0, 8)}…\n`));
  console.log(`  ${D('plik:')} ${path.basename(plik)}  ${D(`(${Math.round(bajty.length / 1024)} kB, ${MIME})`)}`);
  if (wybranyAutomatycznie) console.log(D(`        wybrany automatycznie z DR_FOLDER — podaj ścieżkę, żeby użyć innego`));
  console.log(D('  Obraz leci wyłącznie na Twoje konto Cloudflare. Nigdzie indziej.\n'));

  const proby = [
    {
      nazwa: 'llama-3.2-11b-vision-instruct',
      etykieta: 'obecny w kodzie (Próba 1 kaskady)',
      model: '@cf/meta/llama-3.2-11b-vision-instruct',
      ksztalt: 'image: [tablica bajtów]',
      body: { prompt: PROMPT, image: [...bajty], max_tokens: 768 },
    },
    {
      nazwa: 'llama-4-scout-17b-16e-instruct',
      etykieta: 'kandydat — ten sam model, który już działa w warstwie Groq',
      model: '@cf/meta/llama-4-scout-17b-16e-instruct',
      ksztalt: 'messages z image_url (jak Groq)',
      body: {
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${MIME};base64,${b64}` } },
            { type: 'text', text: PROMPT },
          ],
        }],
        max_tokens: 768,
      },
    },
  ];

  const wyniki = [];
  for (const p of proby) {
    console.log(B(`── ${p.nazwa}`));
    console.log(D(`   ${p.etykieta}`));
    console.log(D(`   kształt żądania: ${p.ksztalt}`));
    let r;
    try { r = await wywolaj(p.model, p.body); }
    catch (e) { console.log(`   ${R('✗')} awaria sieci: ${e.message}\n`); wyniki.push({ p, ok: false }); continue; }

    if (r.obce) {
      console.log(`   ${R('✗')} odpowiedź NIE pochodzi z API Cloudflare (HTTP ${r.status})`);
      console.log(D(`      ${r.tresc.slice(0, 140).replace(/\s+/g, ' ')}`));
      console.log(Y('      To nie jest problem z tokenem ani z licencją — coś przechwytuje ruch'));
      console.log(Y('      (proxy, firewall, portal sieciowy). Napraw dostęp i powtórz.\n'));
      wyniki.push({ p, ok: false, obce: true });
      continue;
    }
    if (r.status !== 200 || r.dane?.success === false) {
      console.log(`   ${R('✗')} ${opiszBlad(r.status, r.dane)}  ${D(`${r.ms} ms`)}\n`);
      wyniki.push({ p, ok: false, kod: r.dane?.errors?.[0]?.code });
      continue;
    }

    const w = polaZOdpowiedzi(r.dane);
    if (!w.ok) {
      console.log(`   ${Y('⚠')} odpowiedź 200, ale ${w.powod}  ${D(`${r.ms} ms`)}`);
      console.log(D(`      ${w.surowe}\n`));
      wyniki.push({ p, ok: false, odpowiedzialo: true });
      continue;
    }
    const niepuste = Object.values(w.pola).filter(v => String(v ?? '').trim()).length;
    console.log(`   ${G('✓')} ${niepuste}/${Object.keys(w.pola).length} pól niepustych  ${D(`${r.ms} ms`)}`);
    for (const [k, v] of Object.entries(w.pola)) console.log(`      ${k.padEnd(12)} ${maskuj(k, v) || D('(puste)')}`);
    console.log('');
    wyniki.push({ p, ok: true, niepuste, pola: w.pola });
  }

  // ── Wnioski ────────────────────────────────────────────────────────────────
  console.log(B('─'.repeat(64)));
  const limit = wyniki.filter(w => w.kod === 4006);
  if (limit.length) {
    console.log(Y(`\n  DZIENNY LIMIT NEURONÓW WYCZERPANY (${limit.length} model/e).`));
    console.log(D('    To NIE jest problem z tokenem, licencją ani modelem — sam fakt, że'));
    console.log(D('    Cloudflare odpowiedział tym kodem, dowodzi, że token działa i licencja'));
    console.log(D('    jest zaakceptowana (inaczej byłoby 5016).'));
    console.log(D('    Limit odnawia się o północy UTC. Powtórz test wtedy.'));
    console.log(Y('\n    UWAGA NA SKALĘ: plan darmowy to 10 000 neuronów/dobę. Inferencja wizyjna'));
    console.log(Y('    na 1318 dowodach znacznie to przekracza — masowe przetwarzanie wymaga'));
    console.log(Y('    planu Workers Paid ALBO rozłożenia na wiele dni. Sprawdź plan konta,'));
    console.log(Y('    zanim uruchomisz przebieg na całym zbiorze: przerwie się w połowie,'));
    console.log(Y('    a przy cichej kaskadzie objawi się jako gorsze dane, nie jako błąd.\n'));
  }

  const licencja = wyniki.filter(w => w.kod === 5016);
  if (licencja.length) {
    console.log(R(`\n  LICENCJA NIEZAAKCEPTOWANA (${licencja.length} model/e):`));
    for (const w of licencja) console.log(`    ${w.p.model}`);
    console.log(D('\n    Otwórz w panelu i wyślij dowolny prompt tekstowy — to wyzwala zgodę:'));
    for (const w of licencja) console.log(D(`      https://playground.ai.cloudflare.com/?model=${w.p.model}`));
    console.log(D('    Playground jest tekstowy, więc do zgody wystarczy zwykłe pytanie.'));
    console.log(D('    Potem uruchom ten test ponownie.\n'));
  }

  const dzialajace = wyniki.filter(w => w.ok);
  if (dzialajace.length === 2) {
    const [a, b] = dzialajace;
    console.log(`\n  Oba modele odczytały dowód: ${a.p.nazwa} ${a.niepuste} pól, ${b.p.nazwa} ${b.niepuste} pól.`);
    console.log(D('  UWAGA: jeden dokument nie rozstrzyga o jakości. Do decyzji potrzebny'));
    console.log(D('  zbiór odniesienia z Aztec — patrz: aztec-compare.js --zapisz-prawde\n'));
  } else if (dzialajace.length === 1) {
    console.log(`\n  Odczytał tylko: ${G(dzialajace[0].p.nazwa)} (${dzialajace[0].niepuste} pól).`);
    console.log(D('  To jest odpowiedź na pytanie, którego kształtu żądania używać.\n'));
  } else if (wyniki.every(w => w.obce)) {
    console.log(R('\n  Ruch do api.cloudflare.com nie dochodzi — żadnego wniosku o modelach\n  z tego przebiegu NIE DA SIĘ wyciągnąć. Napraw dostęp sieciowy i powtórz.\n'));
  } else if (!licencja.length) {
    console.log(Y('\n  Żaden model nie zwrócił pól. Powody wyżej — to NIE jest wynik o jakości\n  modeli, tylko o dostępie albo kształcie żądania.\n'));
  }

  const scout = wyniki.find(w => w.p.model.includes('scout'));
  if (scout?.ok) {
    console.log(G('  ROZSTRZYGNIĘTE: llama-4-scout przyjmuje obraz przez `messages` z image_url'));
    console.log(D('  po stronie REST. To była otwarta niewiadoma w CLAUDE.md. Zostaje sprawdzić,'));
    console.log(D('  czy powiązanie `env.AI.run()` w Workerze przyjmuje ten sam kształt.\n'));
  }
  // `process.exitCode`, NIE `process.exit()`. Ten kod wykonuje sie wewnatrz funkcji async,
  // w ktorej gniazda `fetch` moga byc jeszcze w trakcie zamykania. `process.exit()` ubija
  // petle zdarzen w srodku tej operacji i libuv na Windowsie przerywa asercja:
  //     Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c
  // Wynik jest juz wtedy wypisany, wiec nic nie ginie — ale wyglada jak awaria narzedzia
  // i przykrywa prawdziwy komunikat. Ustawienie kodu wyjscia pozwala Node'owi domknac
  // uchwyty i zakonczyc sie normalnie, z tym samym kodem.
  process.exitCode = dzialajace.length ? 0 : 1;
})();
