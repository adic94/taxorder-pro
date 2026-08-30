#!/usr/bin/env node
/**
 * Deterministyczna walidacja checkpointu OCR.
 *
 * Wynik zawiera rekordy gotowe do dalszego przeglądu oraz jawne błędy,
 * duplikaty i konflikty. Nie zapisuje niczego do bazy ani do repozytorium.
 *
 *   node tools/dr-validate-ocr.js <checkpoint.json> --wyjscie <validation.json>
 */
const fs = require('fs');
const path = require('path');
const DR = require('../modules/dr-fields.js');

const argv = process.argv.slice(2);
const input = argv.find(a => !a.startsWith('--'));
const iw = argv.indexOf('--wyjscie');
const output = iw >= 0 ? argv[iw + 1] : null;

if (!input || !output || !fs.existsSync(input)) {
  console.error('Użycie: node tools/dr-validate-ocr.js <checkpoint.json> --wyjscie <validation.json>');
  process.exit(2);
}

const root = path.resolve(__dirname, '..');
const destination = path.resolve(output);
if (destination === root || destination.startsWith(root + path.sep)) {
  console.error('ODMOWA: wynik walidacji nie może trafić do drzewa repozytorium.');
  process.exit(2);
}

function normalize(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
}

function looksLikeRegistration(value) {
  const normalized = normalize(value);
  return normalized.length >= 4 && normalized.length <= 8
    && /^[A-Z]{1,3}[A-Z0-9]{2,7}$/.test(normalized)
    && /\d/.test(normalized);
}

function validateValue(field, value) {
  const text = String(value ?? '').trim();
  if (!text) return { ok: false, reason: 'puste' };
  if (field.typ === 'liczba') {
    const normalized = text.replace(/\s/g, '').replace(',', '.');
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return { ok: false, reason: 'nie jest liczbą' };
    const number = Number(normalized);
    if (field.zakres && (number < field.zakres[0] || number > field.zakres[1])) {
      return { ok: false, reason: `poza zakresem ${field.zakres[0]}-${field.zakres[1]}` };
    }
    return { ok: true, value: number };
  }
  if (field.typ === 'data' && !/^(?:\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})$/.test(text)) {
    return { ok: false, reason: 'nieprawidłowy format daty' };
  }
  if (field.domena && !field.domena.some(option => normalize(text) === normalize(option))) {
    return { ok: false, reason: 'poza dozwoloną domeną' };
  }
  return { ok: true, value: text };
}

const source = JSON.parse(fs.readFileSync(input, 'utf8'));
const entries = Array.isArray(source) ? source.map((value, index) => [String(index), value]) : Object.entries(source);
const records = [];
const errors = [];
const byRegistration = new Map();
const byVin = new Map();

for (const [key, wrapped] of entries) {
  const record = wrapped && (wrapped.pola || wrapped.fields || wrapped.dane || wrapped);
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    errors.push({ file: key, reason: 'nieprawidłowy rekord' });
    continue;
  }
  const valid = {};
  const rejected = {};
  for (const [fieldKey, rawValue] of Object.entries(record)) {
    if (fieldKey.startsWith('_') || rawValue === '' || rawValue == null) continue;
    const field = DR.wgKlucza[fieldKey];
    if (!field) continue;
    const result = validateValue(field, rawValue);
    if (result.ok) valid[fieldKey] = result.value;
    else rejected[fieldKey] = { value: rawValue, reason: result.reason };
  }
  const nrRej = valid.nrRej && normalize(valid.nrRej);
  const vin = valid.vin && normalize(valid.vin);
  if (nrRej && !looksLikeRegistration(nrRej)) {
    rejected.nrRej = { value: valid.nrRej, reason: 'nieprawidłowy kształt numeru rejestracyjnego' };
    delete valid.nrRej;
  }
  const result = {
    ...valid,
    _plik: record._plik || key,
    _zrodlo: record._zrodlo || 'ocr',
    _model: record._model || 'unknown',
    _walidacja: Object.keys(rejected).length ? 'wymaga_kontroli' : 'poprawny',
    _odrzucone: rejected,
  };
  records.push(result);
  const registrationKey = valid.nrRej && normalize(valid.nrRej);
  if (registrationKey) (byRegistration.get(registrationKey) || byRegistration.set(registrationKey, []).get(registrationKey)).push(result);
  if (vin) (byVin.get(vin) || byVin.set(vin, []).get(vin)).push(result);
  for (const [fieldKey, detail] of Object.entries(rejected)) errors.push({ file: result._plik, field: fieldKey, ...detail });
}

const duplicates = [];
for (const [kind, groups] of [['nrRej', byRegistration], ['vin', byVin]]) {
  for (const [value, group] of groups) {
    if (group.length > 1) duplicates.push({ kind, value, files: group.map(record => record._plik) });
  }
}

const validation = {
  generatedAt: new Date().toISOString(),
  source: path.resolve(input),
  total: records.length,
  valid: records.filter(record => record._walidacja === 'poprawny').length,
  requiringReview: records.filter(record => record._walidacja !== 'poprawny').length,
  errors,
  duplicates,
  records,
};
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(validation, null, 2), 'utf8');
console.log(`Zweryfikowano: ${validation.total}`);
console.log(`Poprawne: ${validation.valid}`);
console.log(`Do kontroli: ${validation.requiringReview}`);
console.log(`Błędy pól: ${errors.length}`);
console.log(`Duplikaty: ${duplicates.length}`);
console.log(`Zapisano: ${destination}`);
