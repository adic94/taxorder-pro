#!/usr/bin/env node
/**
 * Strażnik izolacji tenanta: każde zapytanie SELECT/UPDATE/DELETE do tabeli
 * per-firmowej musi albo mieć `company_id` wprost w treści SQL, albo być
 * na tej liście z UZASADNIENIEM, dlaczego brak `company_id` w SAMYM zapytaniu
 * jest bezpieczny (scope przychodzi skądinąd — patrz KATEGORIE niżej).
 *
 * PO CO. `CLAUDE.md` (sekcja BEZPIECZEŃSTWO) każe filtrować każde zapytanie po
 * `company_id` z sesji. To poprawna zasada, ale sama SIĘ NIE WERYFIKUJE — audyt
 * 01.09.2026 przeskanował `worker/index.js` (708 zapytań SELECT/UPDATE/DELETE)
 * i znalazł 84 bez `company_id` w treści (po odjęciu `user_prefs`/`notification_prefs`,
 * które w ogóle nie mają tej kolumny — patrz GLOBALNE niżej). Każde zweryfikowane
 * ręcznie, z pełnym kontekstem CAŁEJ FUNKCJI (nie samą linią) — zero realnych luk.
 * Ale to był jednorazowy przegląd w rozmowie z modelem; bez tej bramki 85. zapytanie
 * (dodane jutro, skopiowane z niewłaściwego sąsiada) przejdzie niezauważone,
 * dokładnie tak jak przeszły trzy wcześniej znalezione i naprawione IDOR-y
 * (`handleSupplierInvoices` DELETE, `handleNotifLog`, `enforceModuleAccess`).
 *
 * KATEGORIE bezpiecznego braku `company_id` W SAMYM ZAPYTANIU — każdy wpis
 * niżej zaczyna się jednym z tych tagów:
 *
 *   [PRE-CHECK]      Poprzedza je `SELECT ... WHERE id=? AND company_id=?`
 *                    (czasem przez JOIN do tabeli-rodzica, czasem jawnym
 *                    porównaniem `row.company_id !== company`) z `return 403/404`
 *                    PRZED jakąkolwiek mutacją/odczytem dziecka po samym `id`.
 *   [PRE-SCOPED]     `id`/kolekcja pochodzi z WCZEŚNIEJSZEGO zapytania w tej samej
 *                    funkcji, już przefiltrowanego `WHERE company_id=?` — np. pętla
 *                    po `vehMap` (sync TEKOM), `fileIds` (tachograf), `queued`
 *                    (retry KSeF), `subs`/`expired` (push).
 *   [WŁASNY-ZAPIS]   Odczyt zaraz po `INSERT` TEJ SAMEJ operacji, po `id` które
 *                    ten sam request przed chwilą WYGENEROWAŁ (`crypto.randomUUID()`)
 *                    — nie da się podstawić cudzego `id`.
 *   [TOKEN]          Autoryzacja jest SAMYM tokenem/hashem (nieodgadywalny sekret:
 *                    `api_keys.key_hash`, `vehicle_tokens.token`,
 *                    `external_access_tokens.token`, `push_subscriptions.endpoint`)
 *                    — `company_id` nie ma tu czego wnosić, bo to nie sesja.
 *   [DYNAMIC-WHERE]  Zapytanie budowane z tablicy warunków (`where`/`conds`),
 *                    ZAWSZE zaczynającej się od `'company_id=?'` bindowanego
 *                    do sesyjnego `co`/`company` — scanner nie widzi tego w samym
 *                    literale SQL, bo interpolacja wstawia treść dopiero w runtime.
 *   [ADMIN]          Endpoint już wymaga `user.role==='admin'` — jedyny udokumentowany
 *                    wyjątek architektoniczny (CLAUDE.md: „admin pomija scoping
 *                    wszędzie, celowo").
 *   [CRON]           Funkcja wołana z Cron Triggera / Queue consumera, bez `user`/`url`
 *                    z żądania HTTP — nie ma sesji, do której mogłoby dojść do
 *                    wycieku międzyfirmowego (przetwarza WSZYSTKIE firmy po kolei,
 *                    z osobna scoped wewnątrz pętli).
 *
 * KLUCZ WPISU: `tabela|znormalizowane SQL` (białe znaki zwinięte, przycięte) —
 * NIE numer linii. Numer linii przesuwa się przy każdej niepowiązanej zmianie
 * pliku; treść zapytania zmienia się tylko wtedy, gdy ktoś naprawdę je edytuje,
 * czyli dokładnie wtedy, gdy trzeba je zweryfikować ponownie. Kilka zapytań
 * o identycznej treści, wołanych z różnych miejsc (np. `alert_types` z trzech
 * funkcji), dzieli jeden wpis — uzasadnienie wymienia wszystkie miejsca.
 *
 * ZASADA: lista może wyłącznie MALEĆ. Dopisanie wpisu bez zweryfikowania
 * kategorii z pełnym kontekstem funkcji (nie samą linią) jest tym samym,
 * co wyłączenie bramki dla tego zapytania na zawsze.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WORKER = path.join(ROOT, 'worker', 'index.js');
const src = fs.readFileSync(WORKER, 'utf8');

let pass = 0, fail = 0;
const ok = (w, m) => { console.log(`  ${w ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${m}`); w ? pass++ : fail++; };

// ── ekstrakcja identyczna jak w worker-columns-test.js — skan znak po znaku
// od `.prepare(`, nie regex na całym pliku (apostrofy w JS przechodzą przez
// granice literałów i sklejają śmieci nawet dla poprawnego kodu).
function wyciagnij(src) {
  const out = [];
  const re = /\.prepare\s*\(\s*/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const i = m.index + m[0].length;
    const q = src[i];
    if (q !== '`' && q !== "'" && q !== '"') continue;
    let j = i + 1, buf = '';
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') { buf += src[j + 1]; j += 2; continue; }
      if (c === q) break;
      buf += c; j++;
    }
    if (/^\s*(SELECT|UPDATE|DELETE)\b/i.test(buf))
      out.push({ sql: buf, linia: src.slice(0, i).split('\n').length });
  }
  return out;
}

// Tabele bez kolumny `company_id` W OGÓLE — poza zakresem izolacji tenanta
// z definicji, nie przez wyjątek. `users`/`sessions`/`error_logs`/`companies`
// są sesyjne/systemowe; `user_prefs`/`notification_prefs` (schema_v1/v8) mają
// wyłącznie `user_id` — zasięgiem jest konto, nie firma (zweryfikowane grepem
// po CREATE TABLE, nie założone).
const GLOBALNE = new Set(['users', 'sessions', 'error_logs', 'companies', 'user_prefs', 'notification_prefs']);

function sygnatura(tabela, sql) {
  return `${tabela}|${sql.replace(/\s+/g, ' ').trim()}`;
}

/**
 * 73 sygnatury (84 zapytania — kilka dzieli tę samą treść z różnych miejsc)
 * zweryfikowane ręcznie 01.09.2026, z pełnym kontekstem funkcji. Zero realnych luk.
 */
const ZNANE_BEZPIECZNE = {
  "api_keys|SELECT * FROM api_keys WHERE key_hash = ? AND active = 1": "[TOKEN] key_hash to nieodgadywalny sekret; company_id przychodzi z row.company_id po dopasowaniu",
  "api_keys|UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?": "[TOKEN] row.id pochodzi z dopasowania key_hash powyżej, nie z parametru żądania",
  "api_keys|UPDATE api_keys SET ${sets.join(',')} WHERE id=?": "[ADMIN] handleApiKeys wymaga user.role==='admin' na wejściu; BRAK company_id jest tu celowy (naprawa 03.09.2026) — admin wystawia klucze dla dowolnej firmy (dropdown w modules/api-keys.js), więc filtr do company_id ADMINA uniemożliwiał zarządzanie kluczem wystawionym dla innej firmy",
  "api_keys|DELETE FROM api_keys WHERE id=?": "[ADMIN] jak wyżej — ta sama naprawa 03.09.2026, ten sam handler wymagający roli admin",
  "damage_photos|SELECT id, damage_id, r2_key, mime_type FROM damage_photos WHERE damage_id IN (${placeholders})": "[PRE-SCOPED] ids z `reports` = SELECT * FROM damage_reports WHERE company_id=? kilka linii wyżej",
  "damage_photos|DELETE FROM damage_photos WHERE id=?": "[PRE-CHECK] poprzedzone SELECT JOIN damage_reports WHERE dp.id=? AND dr.company_id=?",
  "damage_photos|SELECT r2_key FROM damage_photos WHERE damage_id=?": "[PRE-CHECK] poprzedzone SELECT id FROM damage_reports WHERE id=? AND company_id=?, 404 gdy brak",
  "tires|UPDATE tires SET status='ZAMONTOWANA', nr_rej=?, pozycja=?, historia=?, updated_at=datetime('now') WHERE id=?": "[PRE-CHECK] poprzedzone SELECT * FROM tires WHERE id=? AND company_id=? na początku PUT /api/tires/:id",
  "tires|UPDATE tires SET status='MAGAZYN', nr_rej=NULL, pozycja=NULL, lokalizacja_magazyn=?, historia=?, updated_at=datetime('now') WHERE id=?": "[PRE-CHECK] jak wyżej — jedna wspólna weryfikacja na początku handlera PUT /api/tires/:id",
  "tires|UPDATE tires SET status='ZLOMOWANA', nr_rej=NULL, pozycja=NULL, historia=?, updated_at=datetime('now') WHERE id=?": "[PRE-CHECK] jak wyżej",
  "tires|UPDATE tires SET rozmiar=?, marka=?, dot=?, bieznik_mm=?, sezon=?, lokalizacja_magazyn=?, data_zakupu=?, uwagi=?, nr_faktury=?, dostawca=?, updated_at=datetime('now') WHERE id=?": "[PRE-CHECK] jak wyżej — gałąź „zwykła edycja pól\"",
  "service_orders|UPDATE service_orders SET status='AUTORYZOWANE', autoryzowal=?, data_autoryzacji=datetime('now'), updated_at=datetime('now') WHERE id=?": "[PRE-CHECK] poprzedzone SELECT * FROM service_orders WHERE id=? AND company_id=? na początku PUT",
  "service_orders|UPDATE service_orders SET status='ODRZUCONE', powod_odrzucenia=?, updated_at=datetime('now') WHERE id=?": "[PRE-CHECK] jak wyżej",
  "service_orders|UPDATE service_orders SET status='ZREALIZOWANE', data_realizacji=?, km_realizacji=?, koszt_rzeczywisty=?, nastepny_termin=?, nastepny_km=?, updated_at=datetime('now') WHERE id=?": "[PRE-CHECK] jak wyżej",
  "service_orders|UPDATE service_orders SET typ=?, opis=?, zglaszajacy=?, koszt_szacowany=?, warsztat=?, uwagi=?, updated_at=datetime('now') WHERE id=?": "[PRE-CHECK] jak wyżej — gałąź „zwykła edycja pól\"",
  "protocol_photos|SELECT id, protocol_id, r2_key, mime_type FROM protocol_photos WHERE protocol_id IN (${placeholders})": "[PRE-SCOPED] ids z `protocols` = SELECT * FROM handover_protocols WHERE company_id=? kilka linii wyżej",
  "handover_protocols|UPDATE handover_protocols SET typ=?, data=?, osoba_wydajaca=?, osoba_odbierajaca=?, stan_licznika=?, stan_paliwa=?, wyposazenie=?, uszkodzenia_opis=?, uszkodzenia_diagram=?, uwagi=?, podpis_wydajacy=?, podpis_odbierajacy=? WHERE id=?": "[PRE-CHECK] poprzedzone SELECT * FROM handover_protocols WHERE id=? AND company_id=?",
  "protocol_photos|SELECT r2_key FROM protocol_photos WHERE protocol_id=?": "[PRE-CHECK] poprzedzone SELECT id FROM handover_protocols WHERE id=? AND company_id=?, 404 gdy brak",
  "reservations|SELECT * FROM reservations WHERE id=?": "[PRE-CHECK] `existing.company_id !== company` sprawdzone i zwraca 403 PRZED jakimkolwiek użyciem danych; UPDATE ma i tak AND company_id=?",
  "webhooks|UPDATE webhooks SET last_fired_at=datetime('now'),last_status=? WHERE id=?": "[PRE-CHECK] poprzedzone SELECT * FROM webhooks WHERE id=? AND company_id=? (POST .../test) | [PRE-SCOPED] h.id z pętli po `hooks` = SELECT * FROM webhooks WHERE company_id=? AND active=1 (fireWebhooks)",
  "vehicles|UPDATE vehicles SET data=?, updated_at=datetime('now') WHERE id=?": "[PRE-SCOPED] u.id z `updates`, zbudowane z `vehMap` = SELECT ... FROM vehicles WHERE company_id=? (sync TEKOM)",
  "push_subscriptions|DELETE FROM push_subscriptions WHERE endpoint=?": "[TOKEN] endpoint Web Push jest per-urządzenie nieodgadywalny — komentarz w kodzie: „public (endpoint is secret enough)\"",
  "push_subscriptions|DELETE FROM push_subscriptions WHERE id=?": "[PRE-SCOPED] id z `expired`, filtrowane z `subs` = SELECT * FROM push_subscriptions WHERE company_id=? (po push/send) | [CRON] Queue consumer (processNotifQueue) — job.sub_id z payloadu zakolejkowanego wewnętrznie, nie z żądania HTTP | [PRE-SCOPED]+[CRON] sub.id z `subs` = SELECT * FROM push_subscriptions WHERE company_id=? w tej samej pętli crona (_sendNotificationsSync)",
  "alert_types|UPDATE alert_types SET ${sets.join(',')} WHERE id=?": "[PRE-CHECK] jawna weryfikacja własności: user.role!=='admin' && (atRow.company_id===null || atRow.company_id!==company) → 403",
  "maintenance_templates|UPDATE maintenance_templates SET ${sets.join(',')} WHERE id=?": "[PRE-CHECK] jawna weryfikacja własności: user.role!=='admin' && tmplRow.company_id!==company → 403",
  "spare_parts_transactions|SELECT * FROM spare_parts_transactions WHERE part_id=? ORDER BY created_at DESC LIMIT 50": "[PRE-CHECK] poprzedzone SELECT * FROM spare_parts WHERE id=? AND company_id=?, 404 gdy brak",
  "supplier_invoice_items|SELECT * FROM supplier_invoice_items WHERE invoice_id=?": "[PRE-CHECK] poprzedzone SELECT * FROM supplier_invoices WHERE id=? AND company_id=?",
  "supplier_invoice_items|DELETE FROM supplier_invoice_items WHERE invoice_id=?": "[PRE-CHECK] naprawiony IDOR (patrz komentarz w kodzie) — SELECT id FROM supplier_invoices WHERE id=? AND company_id=? PRZED kasowaniem dzieci",
  "vehicle_tokens|SELECT * FROM vehicle_tokens WHERE token=?": "[TOKEN] publiczny formularz kierowcy — token jest jedyną autoryzacją, company_id z row.company_id po dopasowaniu",
  "tachograph_activities|SELECT * FROM tachograph_activities WHERE file_id=? ORDER BY activity_date, start_time": "[PRE-CHECK] poprzedzone SELECT * FROM tachograph_files WHERE id=? AND company_id=? (GET files/:id ORAZ GET report-data/:id — dwa wywołania tej samej treści)",
  "tachograph_violations|SELECT * FROM tachograph_violations WHERE file_id=? ORDER BY violation_date": "[PRE-CHECK] jak wyżej",
  "tachograph_vehicles_used|SELECT * FROM tachograph_vehicles_used WHERE file_id=?": "[PRE-CHECK] jak wyżej",
  "tacho_integrations|UPDATE tacho_integrations SET config=?,enabled=? WHERE id=?": "[PRE-SCOPED] existing.id z SELECT ... WHERE company_id=? AND provider='flespi' kilka linii wyżej",
  "tachograph_activities|SELECT * FROM tachograph_activities WHERE file_id IN (${ph}) ORDER BY activity_date, start_time": "[PRE-SCOPED] fileIds z SELECT id FROM tachograph_files WHERE company_id=? AND ... (driver-analysis)",
  "tachograph_violations|SELECT * FROM tachograph_violations WHERE file_id IN (${ph}) ORDER BY violation_date": "[PRE-SCOPED] jak wyżej",
  "tachograph_activities|SELECT activity_type, SUM(duration_min) tot FROM tachograph_activities WHERE file_id IN (${placeholders}) GROUP BY activity_type": "[PRE-SCOPED] fileIds z SELECT id FROM tachograph_files WHERE company_id=? AND ... (comparison)",
  "tachograph_violations|SELECT COUNT(*) cnt, COALESCE(SUM(penalty_pln),0) penalty FROM tachograph_violations WHERE file_id IN (${placeholders})": "[PRE-SCOPED] fileIds z SELECT id FROM tachograph_files WHERE company_id=? AND ... (comparison)",
  "documents|SELECT d.id,d.name,d.doc_type,d.nr_rej,d.vin,d.vehicle_id,d.expiry_date, d.workflow_status,d.workflow_assigned_to,d.workflow_assigned_name, d.workflow_due_date,d.workflow_priority,d.workflow_template_id, d.uploaded_at,d.uploaded_by FROM documents d WHERE ${conds.join(' AND ')} ORDER BY CASE d.workflow_priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, d.uploaded_at DESC LIMIT 500": "[DYNAMIC-WHERE] conds=['d.company_id=?'] zawsze pierwszym elementem, bind(...,company,...) (obieg dokumentów, lista)",
  "alert_types|SELECT * FROM alert_types WHERE active=1": "[ADMIN]+[CRON] previewNotificationJobs wołane wyłącznie z /api/notif-trigger chronione user.role!=='admin'→403; _sendNotificationsSync (drugi i trzeci wariant) to funkcje crona bez kontekstu HTTP",
  "driver_trips|SELECT * FROM driver_trips WHERE id=?": "[WŁASNY-ZAPIS] id = crypto.randomUUID() wygenerowane linię wyżej w TYM SAMYM requeście (POST start trip) | [PRE-CHECK] poprzedzone SELECT id,start_km WHERE id=? AND company_id=?, UPDATE też ma AND company_id=? (PUT end trip)",
  "ksef_invoices|SELECT * FROM ksef_invoices WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "ksef_offline_queue|UPDATE ksef_offline_queue SET error_last=?,last_attempt_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?": "[PRE-CHECK] existing.id z SELECT id FROM ksef_offline_queue WHERE invoice_id=? AND company_id=? AND status='queued' kilka linii wyżej",
  "ksef_offline_queue|DELETE FROM ksef_offline_queue WHERE id=?": "[PRE-SCOPED]+[CRON] item.id z `queued` = SELECT * FROM ksef_offline_queue WHERE company_id=? (_ksefRetryCompany, wołane per-firma z runKsefRetry)",
  "ksef_offline_queue|UPDATE ksef_offline_queue SET attempt_count=?,last_attempt_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'),next_retry_at=?,error_last=?,status=? WHERE id=?": "[PRE-SCOPED]+[CRON] item.id z `queued` = SELECT * FROM ksef_offline_queue WHERE company_id=? (_ksefRetryCompany, wołane per-firma z runKsefRetry)",
  "vehicle_inspections|SELECT * FROM vehicle_inspections WHERE ${where.join(' AND ')} ORDER BY inspection_date DESC LIMIT 200": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "fleet_renewal_plan|SELECT * FROM fleet_renewal_plan WHERE ${where.join(' AND ')} ORDER BY planned_replacement_date ASC LIMIT 200": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "driver_training_records|SELECT * FROM driver_training_records WHERE ${where.join(' AND ')} ORDER BY start_date DESC LIMIT 200": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "fleet_limits|SELECT * FROM fleet_limits WHERE ${where.join(' AND ')} ORDER BY scope_label ASC LIMIT 200": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "internal_rentals|SELECT * FROM internal_rentals WHERE ${where.join(' AND ')} ORDER BY start_datetime DESC LIMIT 200": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "carpooling_trips|SELECT * FROM carpooling_trips WHERE ${where.join(' AND ')} ORDER BY trip_date DESC, departure_time ASC LIMIT 200": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "gdpr_records|SELECT * FROM gdpr_records WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "currency_rates|SELECT * FROM currency_rates WHERE ${where.join(' AND ')} ORDER BY rate_date DESC, currency_code ASC LIMIT 500": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "predictive_alerts|SELECT * FROM predictive_alerts WHERE ${where.join(' AND ')} ORDER BY status ASC, predicted_due_date ASC LIMIT 500": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "predictive_alerts|UPDATE predictive_alerts SET status=? WHERE id=?": "[PRE-SCOPED] a.id z `rows` = SELECT * FROM predictive_alerts WHERE company_id=? AND active=1, w tej samej funkcji (recalculate)",
  "warranties_recalls|SELECT * FROM warranties_recalls WHERE ${where.join(' AND ')} ORDER BY end_date ASC NULLS LAST, created_at DESC LIMIT 500": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "supplier_records|SELECT * FROM supplier_records WHERE ${where.join(' AND ')} ORDER BY name ASC LIMIT 300": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "disposal_records|SELECT * FROM disposal_records WHERE ${where.join(' AND ')} ORDER BY start_date DESC LIMIT 300": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "cmr_documents|SELECT * FROM cmr_documents WHERE ${where.join(' AND ')} ORDER BY issue_date DESC LIMIT 300": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "sent_records|SELECT * FROM sent_records WHERE ${where.join(' AND ')} ORDER BY departure_date DESC LIMIT 300": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "vehicles|SELECT id, nr_rej AS reg, JSON_EXTRACT(data,'$.marka') AS brand, JSON_EXTRACT(data,'$.model') AS model FROM vehicles WHERE ${where.join(' AND ')} AND ${SQL_VEH_ACTIVE} ORDER BY nr_rej ASC LIMIT 300": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...) (kreator raportów, źródło „Pojazdy\")",
  "edoreczenia_items|SELECT * FROM edoreczenia_items WHERE ${where.join(' AND ')} ORDER BY sent_date DESC LIMIT 300": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "video_telematics_events|SELECT * FROM video_telematics_events WHERE ${where.join(' AND ')} ORDER BY event_at DESC LIMIT 500": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "driver_work_sessions|SELECT * FROM driver_work_sessions WHERE ${where.join(' AND ')} ORDER BY work_date DESC, start_time DESC LIMIT 500": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "delegations|SELECT * FROM delegations WHERE ${where.join(' AND ')} ORDER BY date_from DESC LIMIT 500": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "fleet_inventory_sessions|SELECT * FROM fleet_inventory_sessions WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?": "[DYNAMIC-WHERE] where=['company_id=?'] zawsze pierwszym elementem, bind(...,co,...)",
  "fuel_import_schedules|UPDATE fuel_import_schedules SET last_run_at=datetime('now'), last_run_status='error' WHERE id=?": "[PRE-CHECK]+[CRON] schedule z SELECT id=?+company_id=? (wywołanie ręczne) LUB z crona po WHERE active=1 (schedule.company_id użyty poprawnie w INSERT fuel_fills)",
  "fuel_import_schedules|UPDATE fuel_import_schedules SET last_run_at=datetime('now'), last_run_status=?, last_row_count=? WHERE id=?": "[PRE-CHECK]+[CRON] schedule z SELECT id=?+company_id=? (wywołanie ręczne) LUB z crona po WHERE active=1 (schedule.company_id użyty poprawnie w INSERT fuel_fills)",
  "fuel_import_schedules|SELECT * FROM fuel_import_schedules WHERE active=1 AND csv_url IS NOT NULL AND csv_url != ''": "[CRON] lista harmonogramów WSZYSTKICH firm — funkcja crona bez kontekstu HTTP, każdy schedule niesie własne company_id użyte poprawnie niżej",
  "debt_collection|UPDATE debt_collection SET reminder_count=?, last_reminder_at=datetime('now'), next_reminder_at=? WHERE id=?": "[PRE-CHECK] debt z SELECT * FROM debt_collection WHERE id=? AND company_id=? (POST remind) kilka linii wyżej",
  "debt_collection|SELECT * FROM debt_collection WHERE status='active' AND next_reminder_at IS NOT NULL AND next_reminder_at<=datetime('now') LIMIT 50": "[CRON] runDebtReminders — bez kontekstu HTTP, przetwarza przeterminowane długi wszystkich firm po kolei",
  "debt_collection|UPDATE debt_collection SET status='disputed',next_reminder_at=NULL WHERE id=?": "[CRON] runDebtReminders — bez kontekstu HTTP, przetwarza przeterminowane długi wszystkich firm po kolei",
  "debt_collection|UPDATE debt_collection SET reminder_count=?,last_reminder_at=datetime('now'),next_reminder_at=? WHERE id=?": "[CRON] runDebtReminders — bez kontekstu HTTP, przetwarza przeterminowane długi wszystkich firm po kolei",
  "external_access_tokens|SELECT * FROM external_access_tokens WHERE token=? AND active=1": "[TOKEN] token jest jedyną autoryzacją (panel podglądu zewnętrznego) — company_id z rec.company_id po dopasowaniu",
  "external_access_tokens|UPDATE external_access_tokens SET active=0 WHERE id=?": "[TOKEN] rec.id pochodzi z dopasowania token=? w tej samej funkcji",
  "external_access_tokens|UPDATE external_access_tokens SET last_used_at=datetime('now') WHERE id=?": "[TOKEN] rec.id pochodzi z dopasowania token=? w tej samej funkcji",
};

const kandydaci = [];
for (const z of wyciagnij(src)) {
  const tm = z.sql.match(/\b(?:FROM|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (!tm) continue;
  const tabela = tm[1];
  if (GLOBALNE.has(tabela)) continue;
  if (/company_id/i.test(z.sql)) continue; // scope wprost w treści zapytania
  kandydaci.push({ tabela, linia: z.linia, sql: z.sql });
}

console.log(`\nIzolacja tenanta — ${wyciagnij(src).length} zapytań SELECT/UPDATE/DELETE, ${kandydaci.length} bez company_id w treści\n`);

const uzyteSygnatury = new Set();
const nowe = [];
for (const k of kandydaci) {
  const sig = sygnatura(k.tabela, k.sql);
  if (ZNANE_BEZPIECZNE[sig] !== undefined) { uzyteSygnatury.add(sig); continue; }
  nowe.push(k);
}

ok(nowe.length === 0,
  nowe.length
    ? `${nowe.length} NOWE zapytanie(a) bez company_id, nie na liście ZNANE_BEZPIECZNE`
    : `wszystkie ${kandydaci.length} zapytania bez company_id w treści mają zweryfikowane uzasadnienie`);

if (nowe.length) {
  for (const n of nowe) console.log(`      L.${n.linia} [${n.tabela}] ${n.sql.replace(/\s+/g, ' ').trim().slice(0, 160)}`);
  console.log('      Zweryfikuj z PEŁNYM kontekstem funkcji (nie samą linią) i dopisz do ZNANE_BEZPIECZNE z kategorią z nagłówka pliku.');
}

// Lista może tylko MALEĆ — wpis, którego już nie widać wśród kandydatów (bo kod
// się zmienił i dorobił company_id, albo zapytanie usunięto), trzeba wykreślić.
const martwe = Object.keys(ZNANE_BEZPIECZNE).filter(k => !uzyteSygnatury.has(k));
ok(martwe.length === 0,
  martwe.length
    ? `${martwe.length} wpis(ów) w ZNANE_BEZPIECZNE nie odpowiada już żadnemu zapytaniu — USUŃ z listy`
    : 'każdy wpis ZNANE_BEZPIECZNE odpowiada realnemu, wciąż istniejącemu zapytaniu');
if (martwe.length) for (const m of martwe) console.log(`      ${m.slice(0, 160)}`);

console.log(`\n────────────────────────────────────────────\nWynik: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
