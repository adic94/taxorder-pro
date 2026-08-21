/**
 * Wspolna warstwa HTTP do api.cepik.gov.pl — jedna implementacja dla sondy i sterownika.
 *
 * DLACZEGO OSOBNY PLIK. Uzgadnianie TLS z tym serwerem wymaga obejscia (patrz nizej),
 * ktore powstalo metoda prob i bledow. Skopiowanie go do drugiego narzedzia oznaczaloby
 * dwie kopie nietrywialnej logiki sieciowej, ktore rozjada sie przy pierwszej poprawce —
 * ten projekt ma juz na koncie cztery takie rozjazdy (tablice CO2, zrodla raportow, wersje
 * ZXing, listy pol DR). Jedna implementacja, dwoch uzytkownikow.
 *
 * OBEJSCIE TLS. `api.cepik.gov.pl` proponuje sesje z parametrem Diffie-Hellmana ponizej
 * progu, ktory Node akceptuje domyslnie — polaczenie pada na `EPROTO ... dh key too small`.
 * Wymuszenie ECDHE (wymiana klucza na krzywych eliptycznych) omija ten parametr CALKOWICIE,
 * zamiast go tolerowac, wiec uzgadnianie zostaje mocne. Zmierzone: dziala.
 */
const https = require('node:https');

const SZYFRY_ECDHE = [
  'ECDHE-ECDSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES256-SHA384', 'ECDHE-RSA-AES128-SHA256',
].join(':');

function zadanieHttps(url, opcjeTls = {}, limitMs = 25000) {
  return new Promise((res, rej) => {
    const req = https.get(url, { headers: { Accept: 'application/vnd.api+json' }, ...opcjeTls }, (r) => {
      let buf = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { buf += c; });
      r.on('end', () => res({ status: r.statusCode, tresc: buf }));
    });
    req.on('error', rej);
    req.setTimeout(limitMs, () => { req.destroy(new Error('ETIMEDOUT')); });
  });
}

/** Blad uzgadniania TLS — jedyny rodzaj, przy ktorym ponawianie ma sens. */
const bladTls = (e) => {
  const c = e.cause || e;
  return /EPROTO|ERR_SSL|DH_KEY_TOO_SMALL|dh key too small|SSLV3_ALERT|WRONG_VERSION|UNSUPPORTED_PROTOCOL|HANDSHAKE/i
    .test(`${c.code || ''} ${c.message || ''} ${e.message || ''}`);
};

/**
 * Zadanie z automatycznym obejsciem TLS. Zwraca `{status, tresc, sciezka}`, gdzie
 * `sciezka` mowi, ktora droga udalo sie polaczyc — to informacja diagnostyczna, nie ozdoba:
 * gdyby serwer kiedys naprawil swoja konfiguracje, przejscie na 'domyslna' bedzie sygnalem,
 * ze obejscie mozna usunac.
 */
async function pobierz(url, limitMs) {
  try {
    const r = await zadanieHttps(url, {}, limitMs);
    return { ...r, sciezka: 'domyslna' };
  } catch (e) {
    if (!bladTls(e)) throw e;
    const r = await zadanieHttps(url, { ciphers: SZYFRY_ECDHE }, limitMs);
    return { ...r, sciezka: 'ECDHE' };
  }
}

module.exports = { pobierz, zadanieHttps, SZYFRY_ECDHE, bladTls };
