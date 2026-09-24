#!/usr/bin/env node
/**
 * Bramka: zapis OCR faktury paliwa musi trafiać do endpointu, który naprawdę istnieje.
 *
 * DLACZEGO. Audyt przekrojowy 31.08 (docs/audits/CODEX_CROSS_LAYER_AUDIT.md:116-134)
 * znalazł, że `modules/ocr-fuel-invoices.js` POSTował do `/api/fuel-records` —
 * endpointu, którego Worker NIGDY nie rejestruje. Podgląd/edycja w formularzu działały,
 * bo dzieją się w przeglądarce; sam zapis zawsze kończył się 404 — cicho, bo `save()`
 * łapał to tylko jako generyczny komunikat błędu, nie jako brakującą trasę.
 *
 * Ta bramka pilnuje dwóch rzeczy naraz: że moduł woła istniejący `/api/fuel-fills`,
 * i że wysyła pola pod nazwami, których Worker faktycznie oczekuje (`nr_rej`,
 * `fill_date`, `liters`) — a nie pod starymi nazwami z nieistniejącego kontraktu
 * (`vehicle_id`, `data_tanko`, `litery`), które przeszłyby ten sam test połowicznie.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const modSrc = fs.readFileSync(path.join(ROOT, 'modules', 'ocr-fuel-invoices.js'), 'utf8');
const workerSrc = fs.readFileSync(path.join(ROOT, 'worker', 'index.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

console.log('\nZapis OCR faktury paliwa trafia do istniejącego endpointu\n');

// Sprawdzamy KONSTRUKCJĘ URL-a wysyłanego do fetch (nie całego pliku tekstem) —
// komentarz w kodzie SMIE wspominać starą, złą ścieżkę jako historię naprawy;
// liczy się tylko to, dokąd faktycznie leci żądanie.
const buduje404 = /\$\{_api\(\)\}\/api\/fuel-records/.test(modSrc);
ok(!buduje404, !buduje404 ? 'moduł już NIE buduje żądania do nieistniejącego /api/fuel-records'
                            : 'moduł nadal buduje fetch do /api/fuel-records — Worker tej trasy nie rejestruje, zapis da 404');

ok(modSrc.includes('/api/fuel-fills'),
  modSrc.includes('/api/fuel-fills') ? 'moduł woła /api/fuel-fills'
                                       : 'moduł NIE woła /api/fuel-fills — brak ścieżki do realnego endpointu');

// Worker musi faktycznie rejestrować tę trasę, i wymagać dokładnie tych pól —
// inaczej ta bramka tylko przesuwa halucynację o jeden plik.
const rejestracja = /path\.startsWith\(['"]\/api\/fuel-fills['"]\)/.test(workerSrc)
  || /path\s*===\s*['"]\/api\/fuel-fills['"]/.test(workerSrc)
  || /handleFuelFills/.test(workerSrc);
ok(rejestracja, rejestracja ? 'worker/index.js faktycznie obsługuje /api/fuel-fills (handleFuelFills)'
                              : 'BRAK handleFuelFills w worker/index.js — endpoint zniknął, moduł znów będzie 404');

const maNrRej = /if\s*\(!d\.nr_rej\)/.test(workerSrc);
const maFillDate = /if\s*\(!d\.fill_date\)/.test(workerSrc);
const maLiters = /d\.liters\s*==\s*null/.test(workerSrc);
ok(maNrRej && maFillDate && maLiters,
  (maNrRej && maFillDate && maLiters)
    ? 'POST /api/fuel-fills nadal wymaga nr_rej + fill_date + liters (kontrakt niezmieniony)'
    : 'kontrakt POST /api/fuel-fills się zmienił (worker/index.js) — zaktualizuj moduł i tę bramkę');

// Pola wysyłane w body save() — muszą być NOWYMI nazwami, nie starymi (vehicle_id/
// data_tanko/litery), inaczej naprawa jest tylko zmianą URL-a bez zmiany kontraktu.
const funkcjaSave = (modSrc.match(/async function save\(\)[\s\S]*?\n  \}/) || [''])[0];
ok(!!funkcjaSave, funkcjaSave ? 'znaleziono funkcję save() w module' : 'BRAK funkcji save() — plik przebudowany, zaktualizuj bramkę');

if (funkcjaSave) {
  const wysylaNrRej = /nr_rej[,\s]/.test(funkcjaSave) && !/vehicle_id[,:\s]/.test(funkcjaSave);
  ok(wysylaNrRej, wysylaNrRej ? 'save() wysyła nr_rej, nie vehicle_id'
                                : 'save() nadal wysyła stare pole vehicle_id zamiast nr_rej — worker go zignoruje');

  const wysylaFillDate = /fill_date[,\s]/.test(funkcjaSave) && !/data_tanko[,:\s]/.test(funkcjaSave);
  ok(wysylaFillDate, wysylaFillDate ? 'save() wysyła fill_date, nie data_tanko'
                                      : 'save() nadal wysyła stare pole data_tanko zamiast fill_date');

  const wysylaLiters = /\bliters[,\s]/.test(funkcjaSave) && !/\blitery[,:\s]/.test(funkcjaSave);
  ok(wysylaLiters, wysylaLiters ? 'save() wysyła liters, nie litery'
                                  : 'save() nadal wysyła stare pole litery zamiast liters');

  const companyWQuery = /\/api\/fuel-fills\?company=/.test(funkcjaSave);
  ok(companyWQuery, companyWQuery
    ? 'company trafia do query string (tak czyta go handleFuelFills), nie tylko do body'
    : 'company NIE jest w query string — handleFuelFills czyta je z url.searchParams, zwróci 400 "Wymagane: ?company="');
}

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
