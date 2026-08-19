#!/usr/bin/env node
/**
 * Jedno polecenie, które doprowadza projekt do stanu działającego — i mówi wprost,
 * czego NIE potrafi zrobić za człowieka.
 *
 *     node tools/uruchom-wszystko.js              # sprawdza, niczego nie zmienia
 *     node tools/uruchom-wszystko.js --wykonaj    # dodatkowo wdraża Workera
 *
 * DLACZEGO DOMYŚLNIE NIC NIE ZMIENIA. `wrangler deploy` to wdrożenie na produkcję —
 * czynność jednokierunkowa. Domyślny przebieg pokazuje, co ZOSTAŁOBY zrobione, i dopiero
 * `--wykonaj` to robi. Ten sam wzorzec co `tools/dt1-verify.js` z jego DRY-RUN.
 *
 * DLACZEGO NODE, A NIE .PS1. Polityka wykonywania Windowsa blokuje niepodpisane skrypty
 * `.ps1` (dotyczy też `npm.ps1` i `npx.ps1`). `node` jest zwykłym plikiem wykonywalnym
 * i polityka go nie obejmuje — skrypt uruchomi się bez zmieniania ustawień systemu.
 *
 * ZASADA RAPORTOWANIA: brak błędu NIE jest dowodem sukcesu. Każdy krok potwierdza wynik
 * odczytem (wersja Workera, liczba asercji, obecność modelu), a nie tym, że polecenie
 * nie krzyknęło. Ten projekt stracił na tym już kilka diagnoz.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// `.env` jest tu istotny nie dla nas, tylko dla WRANGLERA: gdy ustawiony jest
// CLOUDFLARE_API_TOKEN, wrangler uwierzytelnia się nim zamiast przez OAuth. Bez tego
// skrypt raportował „brak poświadczeń" u kogoś, kto token ma — tylko w pliku.
try { require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true }); } catch { /* opcjonalny */ }
const WYKONAJ = process.argv.includes('--wykonaj');
const WIN = process.platform === 'win32';
const WRANGLER = path.join(ROOT, 'node_modules', '.bin', WIN ? 'wrangler.cmd' : 'wrangler');

const G = s => `\x1b[32m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, B = s => `\x1b[1m${s}\x1b[0m`, D = s => `\x1b[2m${s}\x1b[0m`;

/**
 * NIE UZYWAJ `shell: true` TAM, GDZIE NIE MUSISZ.
 *
 * Na Windowsie `spawnSync` z `shell: true` sklada wiersz polecenia, laczac polecenie
 * i argumenty SPACJAMI, BEZ cudzyslowow. Sciezka projektu to
 * `...\Desktop\Program flotowy\taxorder-pro\...` — cmd.exe rozbija ja na spacji i node
 * dostaje `C:\Users\...\Desktop\Program` jako plik do uruchomienia. MODULE_NOT_FOUND,
 * kod wyjscia 1, a skrypt raportowal „bramki nie przechodza" przy 15/15 PASS.
 * To samo falszowalo `wrangler whoami` -> „brak poswiadczen" przy zalogowanym wranglerze.
 *
 * Zgloszone przez uzytkownika, odtworzone: shell:false -> kod 0, shell:true -> kod 1.
 *
 * `node` (process.execPath) to plik .exe — uruchamia sie BEZ powloki, wiec argumenty
 * ida tablica i spacje nie maja znaczenia. Powloka jest potrzebna wylacznie dla plikow
 * .cmd/.bat (wrangler.cmd), i tam kazdy element musi byc w cudzyslowach.
 */
const uruchom = (cmd, args, opts = {}) => {
  const wsp = { cwd: ROOT, encoding: 'utf8', timeout: opts.timeout || 180000 };
  const potrzebnaPowloka = WIN && /\.(cmd|bat)$/i.test(cmd);
  if (!potrzebnaPowloka) return spawnSync(cmd, args, wsp);
  const cyt = a => `"${String(a).replace(/"/g, '\\"')}"`;
  return spawnSync(cyt(cmd), args.map(cyt), { ...wsp, shell: true });
};

const doRecznie = [];   // czynności, których skrypt nie potrafi wykonać
const problemy = [];    // rzeczy, które trzeba naprawić zanim się ruszy dalej
let krok = 0;
const naglowek = (t) => console.log(`\n${B(`── ${++krok}. ${t} `.padEnd(62, '─'))}`);

console.log(B('\n  TaxOrder Pro — doprowadzenie do stanu działającego\n'));
console.log(WYKONAJ
  ? Y('  Tryb --wykonaj: Worker ZOSTANIE wdrożony na produkcję.\n')
  : D('  Tryb sprawdzania: nic nie zostanie zmienione. Wdrożenie: --wykonaj\n'));

// ── 1. Środowisko ────────────────────────────────────────────────────────────
naglowek('Środowisko');

const major = Number(process.versions.node.split('.')[0]);
if (major >= 22) console.log(`  ${G('✓')} Node.js ${process.versions.node}`);
else {
  console.log(`  ${R('✗')} Node.js ${process.versions.node} — wrangler wymaga ≥ 22`);
  problemy.push('Node.js poniżej 22 — wrangler odmówi startu, a bramka migration-apply-test używa node:sqlite');
}

if (fs.existsSync(WRANGLER)) {
  const w = uruchom(WRANGLER, ['--version'], { timeout: 60000 });
  const wersja = (`${w.stdout}`.match(/\d+\.\d+\.\d+/) || ['?'])[0];
  console.log(`  ${G('✓')} wrangler ${wersja}`);
} else {
  console.log(`  ${R('✗')} brak ${WRANGLER} — uruchom: npm.cmd install`);
  problemy.push('wrangler nieobecny w node_modules');
}

// ── 2. Poświadczenia Cloudflare ──────────────────────────────────────────────
naglowek('Poświadczenia Cloudflare');
let zalogowany = false;
if (fs.existsSync(WRANGLER)) {
  const who = uruchom(WRANGLER, ['whoami'], { timeout: 90000 });
  const out = `${who.stdout}${who.stderr}`;
  zalogowany = !/not authenticated|You are not logged in/i.test(out) && who.status === 0;
  if (zalogowany) {
    const mail = (out.match(/[\w.+-]+@[\w.-]+\.\w+/) || [])[0];
    // Rozróżnienie ISTOTNE dla kroku 5: token API ma ZAKRES. Ten utworzony do testu OCR
    // ma „Workers AI → Read" i NIE pozwoli na `wrangler deploy` — a komunikat o odmowie
    // przyszedłby dopiero w trakcie wdrożenia, wyglądając na awarię deployu.
    const przezToken = !!process.env.CLOUDFLARE_API_TOKEN;
    console.log(`  ${G('✓')} zalogowany${mail ? ` jako ${mail}` : ''}${przezToken ? D('  (przez CLOUDFLARE_API_TOKEN z .env)') : ''}`);
    if (przezToken) {
      console.log(Y('      Token API ma ZAKRES. Jeśli utworzyłeś go do testu OCR'));
      console.log(Y('      („Workers AI → Read"), NIE wystarczy na `wrangler deploy`.'));
      console.log(D('      Do wdrożenia: `wrangler login` (OAuth) albo token z uprawnieniem'));
      console.log(D('      Account → Workers Scripts → Edit.'));
    }
  } else {
    console.log(`  ${R('✗')} brak poświadczeń`);
    doRecznie.push(['Zaloguj wranglera', `${WIN ? '.\\node_modules\\.bin\\wrangler.cmd' : './node_modules/.bin/wrangler'} login`]);
    problemy.push('wrangler bez poświadczeń — deploy i odczyt modeli niemożliwe');
  }
}

// ── 3. Kod aktualny ──────────────────────────────────────────────────────────
naglowek('Kod aktualny względem origin/main');
const galaz = (uruchom('git', ['branch', '--show-current']).stdout || '').trim();
const brudne = (uruchom('git', ['status', '--porcelain']).stdout || '').trim();
console.log(`  ${D('gałąź:')} ${galaz || '(odłączona)'}`);

if (brudne) {
  console.log(`  ${Y('⚠')} niezacommitowane zmiany — pomijam \`git pull\`, żeby ich nie stracić`);
  console.log(D(brudne.split('\n').slice(0, 5).map(l => `      ${l}`).join('\n')));
} else {
  uruchom('git', ['fetch', 'origin', 'main'], { timeout: 120000 });
  const za = (uruchom('git', ['rev-list', '--count', 'HEAD..origin/main']).stdout || '0').trim();
  if (Number(za) > 0) {
    if (galaz === 'main') {
      uruchom('git', ['pull', 'origin', 'main'], { timeout: 120000 });
      console.log(`  ${G('✓')} pobrano ${za} commit(ów) z origin/main`);
    } else {
      console.log(`  ${Y('⚠')} jesteś na \`${galaz}\`, ${za} commit(ów) za origin/main — nie przełączam gałęzi`);
    }
  } else console.log(`  ${G('✓')} kod aktualny`);
}
console.log(`  ${D('HEAD:')} ${(uruchom('git', ['log', '--oneline', '-1']).stdout || '').trim()}`);

// ── 4. Bramki ────────────────────────────────────────────────────────────────
naglowek('Bramki jednostkowe');
const bramki = uruchom(process.execPath, [path.join(ROOT, 'tools', 'autotest', 'run-gates.js')]);
const wynik = (`${bramki.stdout}`.match(/Bramki: (\d+)\/(\d+).*?Asercje: (\d+) PASS \/ (\d+) FAIL/s) || []);
if (bramki.status === 0) {
  console.log(`  ${G('✓')} ${wynik[1]}/${wynik[2]} bramek, ${wynik[3]} asercji PASS`);
} else {
  console.log(`  ${R('✗')} bramki nie przechodzą — NIE wdrażam`);
  console.log(D(`${bramki.stdout}`.split('\n').filter(l => l.includes('✗')).slice(0, 8).join('\n')));
  problemy.push('Bramki jednostkowe padają — wdrożenie wstrzymane. Uruchom: npm.cmd run test:gates');
}

// ── 5. Wdrożenie Workera ─────────────────────────────────────────────────────
naglowek('Worker na produkcji');
const doWdrozenia = (uruchom('git', ['log', '--oneline', 'd9cd6cd..origin/main', '--', 'worker/']).stdout || '')
  .trim().split('\n').filter(Boolean);

if (!doWdrozenia.length) {
  console.log(`  ${G('✓')} brak niewdrożonych zmian w worker/`);
} else {
  console.log(`  ${Y(`${doWdrozenia.length} commit(ów) czeka na wdrożenie:`)}`);
  for (const c of doWdrozenia) console.log(D(`      ${c}`));
  console.log(D('\n      deploy-worker.yml ich nie wdrożył — pakiet minut Actions wyczerpany,'));
  console.log(D('      przebiegi padają po kilku sekundach z runner_id: 0. To brak runnera,'));
  console.log(D('      nie awaria deployu.'));

  if (!WYKONAJ) {
    console.log(`\n  ${Y('→')} uruchom z ${B('--wykonaj')}, żeby wdrożyć`);
  } else if (problemy.length) {
    console.log(`\n  ${R('✗')} wdrożenie wstrzymane — najpierw napraw problemy wypisane niżej`);
  } else {
    console.log(`\n  ${Y('…')} wdrażam`);
    const dep = uruchom(WRANGLER, ['deploy'], { timeout: 300000 });
    const idWersji = (`${dep.stdout}${dep.stderr}`.match(/Current Version ID:\s*([0-9a-f-]+)/i)
      || `${dep.stdout}`.match(/Version ID:\s*([0-9a-f-]+)/i) || [])[1];
    if (dep.status === 0) {
      console.log(`  ${G('✓')} wdrożone${idWersji ? `, wersja ${idWersji.slice(0, 8)}` : ''}`);
      if (!idWersji) console.log(`  ${Y('⚠')} nie odczytałem ID wersji — sprawdź: wrangler deployments list`);
    } else {
      console.log(`  ${R('✗')} deploy padł`);
      console.log(D(`${dep.stdout}${dep.stderr}`.split('\n').slice(-8).map(l => `      ${l}`).join('\n')));
      problemy.push('wrangler deploy zakończony błędem — treść wyżej');
    }
  }
}

// ── 6. Modele AI ─────────────────────────────────────────────────────────────
naglowek('Modele Workers AI');
const POTRZEBNE = [
  ['llama-3.2-11b-vision-instruct', 'OCR dowodów — Próba 1 kaskady (worker/index.js:3065, :3455)'],
  ['llama-4-scout-17b-16e-instruct', 'kandydat na zamiennik + guided_json'],
  ['llama-3.1-8b-instruct', 'parsowanie e-maili na zlecenia (handleEmail2Order)'],
];
if (zalogowany) {
  const m = uruchom(WRANGLER, ['ai', 'models'], { timeout: 120000 });
  const lista = `${m.stdout}`;
  if (m.status === 0 && lista.trim()) {
    for (const [id, po_co] of POTRZEBNE) {
      const jest = lista.includes(id);
      console.log(`  ${jest ? G('✓') : Y('?')} ${id}`);
      console.log(D(`      ${po_co}`));
    }
    console.log(D('\n      Obecność na liście NIE dowodzi, że licencja jest zaakceptowana —'));
    console.log(D('      to widać dopiero po wywołaniu modelu (błąd 5016 = brak zgody).'));
  } else {
    console.log(`  ${Y('⚠')} \`wrangler ai models\` nic nie zwrócił — sprawdź ręcznie`);
  }
} else {
  console.log(`  ${D('pominięte — brak poświadczeń')}`);
}

doRecznie.push([
  'Zaakceptuj licencje modeli (jeśli OCR zwraca 5016)',
  'https://playground.ai.cloudflare.com/?model=@cf/meta/llama-3.2-11b-vision-instruct\n     https://playground.ai.cloudflare.com/?model=@cf/meta/llama-4-scout-17b-16e-instruct\n     Na liście modeli NIE MA przycisku Accept — link `Terms` prowadzi do licencji Meta.\n     Zgodę wyzwala UŻYCIE modelu w playgroundzie. Wrzuć tam prawdziwy dowód.',
]);

// ── 7. Zbiór odniesienia ─────────────────────────────────────────────────────
naglowek('Zbiór odniesienia z kodów Aztec');
const KAT_DR = WIN ? 'C:\\Users\\acichocki\\Desktop\\Dokumentacja pojazdów' : null;
const CEL = WIN ? '%USERPROFILE%\\Documents\\taxorder-backupy\\aztec-prawda.json'
                : '~/Documents/taxorder-backupy/aztec-prawda.json';
if (KAT_DR && fs.existsSync(KAT_DR)) {
  console.log(`  ${G('✓')} katalog z dowodami istnieje`);
} else {
  console.log(`  ${D('katalog z dowodami niedostępny z tego środowiska')}`);
}
console.log(D('      Zbiór daje pola PEWNE (z Aztec), więc pozwala zmierzyć dowolny model'));
console.log(D('      OCR na własnych dokumentach zamiast na cudzym benchmarku.'));
doRecznie.push([
  'Zbuduj zbiór odniesienia (po zaakceptowaniu licencji)',
  `node tools/aztec-compare.js --katalog "${KAT_DR || '<folder z dowodami>'}" ^\n       --zapisz-prawde "${CEL}"`,
]);

// ── 8. Monitoring OCR ────────────────────────────────────────────────────────
naglowek('Weryfikacja OCR po wdrożeniu');
console.log(D('      Od commita a2a795c (CF) i 76839f8 (PaddleOCR) powód porażki KAŻDEJ'));
console.log(D('      warstwy kaskady trafia do odpowiedzi 502, nie tylko do logu.'));
doRecznie.push([
  'Sprawdź OCR na JEDNYM dowodzie',
  `${WIN ? '.\\node_modules\\.bin\\wrangler.cmd' : './node_modules/.bin/wrangler'} tail --format pretty\n     …i w drugim oknie zaimportuj jeden dowód w aplikacji.\n     5016 → licencja niezaakceptowana | PaddleOCR pominięty → sprawdź Railway`,
]);

// ── Podsumowanie ─────────────────────────────────────────────────────────────
console.log(`\n${B('─'.repeat(64))}`);
if (problemy.length) {
  console.log(R(`\n  DO NAPRAWY (${problemy.length}) — blokują dalsze kroki:\n`));
  problemy.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
}
console.log(B(`\n  TWOJE CZYNNOŚCI (${doRecznie.length}) — skrypt ich nie wykona:\n`));
doRecznie.forEach(([co, jak], i) => {
  console.log(`   ${B(`${i + 1}. ${co}`)}`);
  console.log(D(`      ${jak.split('\n').join('\n      ')}\n`));
});
if (!WYKONAJ && doWdrozenia.length && !problemy.length) {
  console.log(Y(`  Wdrożenie Workera skrypt zrobi sam: node tools/uruchom-wszystko.js --wykonaj\n`));
}
process.exit(problemy.length ? 1 : 0);
