/**
 * Test Supabase - Konsola diagnostyczna
 * Otwórz DevTools (F12) i uruchom funkcje z консoli
 */

// ==================== LOGGER ====================

const TestLogger = {
  log: (msg, data = null) => {
    const timestamp = new Date().toLocaleTimeString('pl-PL');
    console.log(`[${timestamp}] ✓ ${msg}`, data || '');
  },
  error: (msg, error = null) => {
    const timestamp = new Date().toLocaleTimeString('pl-PL');
    console.error(`[${timestamp}] ✗ ${msg}`, error || '');
  },
  info: (msg, data = null) => {
    const timestamp = new Date().toLocaleTimeString('pl-PL');
    console.info(`[${timestamp}] ℹ ${msg}`, data || '');
  },
  success: (msg, data = null) => {
    const timestamp = new Date().toLocaleTimeString('pl-PL');
    console.log(`%c[${timestamp}] ✅ ${msg}`, 'color: green; font-weight: bold', data || '');
  },
  warning: (msg, data = null) => {
    const timestamp = new Date().toLocaleTimeString('pl-PL');
    console.warn(`[${timestamp}] ⚠ ${msg}`, data || '');
  }
};

// ==================== TEST 1: INICJALIZACJA ====================

window.test1_init = async function() {
  TestLogger.info('TEST 1: Inicjalizacja Supabase');
  
  // Sprawdź czy biblioteka jest załadowana
  if (!window.supabase) {
    TestLogger.error('Supabase JS nie jest załadowany');
    TestLogger.info('Ładuję bibliotekę...');
    
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => {
        TestLogger.success('Biblioteka Supabase załadowana');
        resolve();
      };
      document.head.appendChild(script);
    });
  } else {
    TestLogger.success('Biblioteka Supabase już załadowana');
  }
};

// ==================== TEST 2: SPRAWDZENIE ZMIENNYCH ====================

window.test2_config = function() {
  TestLogger.info('TEST 2: Sprawdzenie konfiguracji');
  
  const config = window.SUPABASE_CONFIG || window.SupabaseManager?.SUPABASE_CONFIG;
  
  if (!config) {
    TestLogger.error('SUPABASE_CONFIG nie znaleziony!');
    return false;
  }
  
  TestLogger.log('URL:', config.url);
  TestLogger.log('anonKey:', config.anonKey ? '✓ (ustawiony)' : '✗ (brak)');
  TestLogger.log('serviceKey:', config.serviceKey ? '✓ (ustawiony)' : '✗ (brak)');
  TestLogger.log('enabled:', config.enabled);
  
  if (!config.url || config.url.includes('YOUR_PROJECT')) {
    TestLogger.error('Supabase URL nie skonfigurowany. Edytuj SUPABASE_CONFIG w modules/supabase-manager.js');
    return false;
  }
  
  TestLogger.success('Konfiguracja OK');
  return true;
};

// ==================== TEST 3: POŁĄCZENIE ====================

window.test3_connect = async function() {
  TestLogger.info('TEST 3: Testowanie połączenia');
  
  // Najpierw inicjalizuj
  await test1_init();
  
  // Sprawdź config
  if (!test2_config()) {
    TestLogger.error('Konfiguracja niezupełna. Nie mogę nawiązać połączenia.');
    return false;
  }
  
  // Spróbuj się połączyć
  try {
    if (!window.SupabaseManager) {
      TestLogger.error('SupabaseManager nie załadowany');
      return false;
    }
    
    window.SupabaseManager.initSupabase();
    
    // Czekaj 2 sekundy
    await new Promise(r => setTimeout(r, 2000));
    
    if (window.SupabaseManager.isSupabaseEnabled()) {
      TestLogger.success('Połączenie z Supabase UDANE! ✅');
      return true;
    } else {
      TestLogger.warning('Supabase nie włączony. Sprawdź konsole błędów.');
      return false;
    }
  } catch (error) {
    TestLogger.error('Błąd podczas połączenia:', error);
    return false;
  }
};

// ==================== TEST 4: POBIERZ POJAZDY ====================

window.test4_getVehicles = async function(companyId = 'mtoilet') {
  TestLogger.info(`TEST 4: Pobieranie pojazdów (company: ${companyId})`);
  
  if (!window.SupabaseManager) {
    TestLogger.error('SupabaseManager nie dostępny');
    return;
  }
  
  try {
    const vehicles = await window.SupabaseManager.getVehicles(companyId);
    
    if (vehicles.length === 0) {
      TestLogger.warning(`Brak pojazdów dla firmy ${companyId}`);
    } else {
      TestLogger.success(`Pobrano ${vehicles.length} pojazd(ów)`);
      TestLogger.log('Pojazdy:', vehicles);
    }
    
    return vehicles;
  } catch (error) {
    TestLogger.error('Błąd pobierania pojazdów:', error);
  }
};

// ==================== TEST 5: DODAJ POJAZD ====================

window.test5_addVehicle = async function(nrRej = 'WA-TEST-001') {
  TestLogger.info(`TEST 5: Dodawanie pojazdu (${nrRej})`);
  
  if (!window.SupabaseManager) {
    TestLogger.error('SupabaseManager nie dostępny');
    return;
  }
  
  const vehicleData = {
    company_id: 'mtoilet',
    nr_rej: nrRej,
    marka: 'Test Marka',
    model: 'Test Model',
    rok: 2024,
    vin: 'VIN-TEST-12345',
    dmc: 5500,
    type: 'Ciężarowy',
    status: 'Własny',
    euro: 'EURO 6'
  };
  
  try {
    const newVehicle = await window.SupabaseManager.addVehicle(vehicleData);
    
    if (newVehicle) {
      TestLogger.success(`Pojazd dodany: ${newVehicle.id}`);
      TestLogger.log('Dane pojazdu:', newVehicle);
      return newVehicle;
    } else {
      TestLogger.error('Nie udało się dodać pojazdu (localStorage fallback)');
      return null;
    }
  } catch (error) {
    TestLogger.error('Błąd dodawania pojazdu:', error);
  }
};

// ==================== TEST 6: AKTUALIZUJ POJAZD ====================

window.test6_updateVehicle = async function(vehicleId) {
  TestLogger.info(`TEST 6: Aktualizacja pojazdu (${vehicleId})`);
  
  if (!window.SupabaseManager) {
    TestLogger.error('SupabaseManager nie dostępny');
    return;
  }
  
  if (!vehicleId) {
    TestLogger.error('Podaj ID pojazdu');
    return;
  }
  
  const updates = {
    dmc: 6000,
    euro: 'EURO 5'
  };
  
  try {
    const updated = await window.SupabaseManager.updateVehicle(vehicleId, updates);
    
    if (updated) {
      TestLogger.success(`Pojazd zaktualizowany`);
      TestLogger.log('Nowe dane:', updated);
      return updated;
    }
  } catch (error) {
    TestLogger.error('Błąd aktualizacji pojazdu:', error);
  }
};

// ==================== TEST 7: SYNCHRONIZACJA ====================

window.test7_sync = async function(companyId = 'mtoilet') {
  TestLogger.info(`TEST 7: Synchronizacja z Supabase`);
  
  if (!window.SupabaseManager) {
    TestLogger.error('SupabaseManager nie dostępny');
    return;
  }
  
  try {
    const result = await window.SupabaseManager.syncFromSupabase(companyId);
    
    if (result) {
      TestLogger.success('Synchronizacja UDANA');
      TestLogger.log('FleetManager.DB.vehicles:', window.FleetManager?.DB?.vehicles?.length || 0);
      TestLogger.log('FleetManager.DB.documents:', window.FleetManager?.DB?.documents?.length || 0);
      TestLogger.log('FleetManager.DB.costs:', window.FleetManager?.DB?.costs?.length || 0);
    } else {
      TestLogger.warning('Synchronizacja nieudana');
    }
    
    return result;
  } catch (error) {
    TestLogger.error('Błąd synchronizacji:', error);
  }
};

// ==================== TEST 8: DOKUMENTY ====================

window.test8_documents = async function(vehicleId) {
  TestLogger.info(`TEST 8: Operacje na dokumentach`);
  
  if (!window.SupabaseManager) {
    TestLogger.error('SupabaseManager nie dostępny');
    return;
  }
  
  if (!vehicleId) {
    TestLogger.error('Podaj ID pojazdu');
    return;
  }
  
  try {
    // Pobierz dokumenty
    const docs = await window.SupabaseManager.getVehicleDocuments(vehicleId);
    TestLogger.log(`Dokumenty pojazdu (${docs.length}):`, docs);
    
    // Dodaj nowy dokument
    const newDoc = await window.SupabaseManager.addDocument(vehicleId, {
      type: 'OC',
      document_number: 'OC-TEST-001',
      issued_date: new Date().toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
      status: 'active'
    });
    
    if (newDoc) {
      TestLogger.success('Dokument dodany');
      TestLogger.log('Dokument:', newDoc);
    }
    
  } catch (error) {
    TestLogger.error('Błąd obsługi dokumentów:', error);
  }
};

// ==================== TEST 9: KOSZTY ====================

window.test9_costs = async function(vehicleId, companyId = 'mtoilet') {
  TestLogger.info(`TEST 9: Operacje na kosztach`);
  
  if (!window.SupabaseManager) {
    TestLogger.error('SupabaseManager nie dostępny');
    return;
  }
  
  if (!vehicleId) {
    TestLogger.error('Podaj ID pojazdu');
    return;
  }
  
  try {
    // Pobierz koszty
    const costs = await window.SupabaseManager.getVehicleCosts(vehicleId);
    TestLogger.log(`Koszty pojazdu (${costs.length}):`, costs);
    
    // Dodaj nowy koszt
    const newCost = await window.SupabaseManager.addCost(vehicleId, companyId, {
      type: 'paliwo',
      amount: 250.50,
      currency: 'PLN',
      date: new Date().toISOString().split('T')[0],
      description: 'Koszt paliwa - test'
    });
    
    if (newCost) {
      TestLogger.success('Koszt dodany');
      TestLogger.log('Koszt:', newCost);
    }
    
  } catch (error) {
    TestLogger.error('Błąd obsługi kosztów:', error);
  }
};

// ==================== SEKWENCJA PEŁNEGO TESTU ====================

window.testFull = async function() {
  console.clear();
  TestLogger.info('═══════════════════════════════════════════');
  TestLogger.info('PEŁNY TEST SUPABASE');
  TestLogger.info('═══════════════════════════════════════════');
  
  // Test 1: Inicjalizacja
  await test1_init();
  console.log('');
  
  // Test 2: Config
  test2_config();
  console.log('');
  
  // Test 3: Połączenie
  const connected = await test3_connect();
  if (!connected) {
    TestLogger.error('Nie mogę nawiązać połączenia. Zatrzymuję testy.');
    return;
  }
  console.log('');
  
  // Test 4: Pobierz pojazdy
  const vehicles = await test4_getVehicles();
  console.log('');
  
  // Test 5: Dodaj pojazd
  const newVehicle = await test5_addVehicle('WA-FULL-TEST-001');
  console.log('');
  
  if (newVehicle) {
    // Test 6: Aktualizuj pojazd
    await test6_updateVehicle(newVehicle.id);
    console.log('');
    
    // Test 8: Dokumenty
    await test8_documents(newVehicle.id);
    console.log('');
    
    // Test 9: Koszty
    await test9_costs(newVehicle.id);
    console.log('');
  }
  
  // Test 7: Synchronizacja
  await test7_sync();
  console.log('');
  
  TestLogger.info('═══════════════════════════════════════════');
  TestLogger.success('TESTY UKOŃCZONE! ✅');
  TestLogger.info('═══════════════════════════════════════════');
};

// ==================== HELP ====================

window.testHelp = function() {
  console.clear();
  console.log(`
╔═════════════════════════════��══════════════════════════════════╗
║           SUPABASE TEST CONSOLE - INSTRUKCJA UŻYTKOWNIKA       ║
╚════════════════════════════════════════════════════════════════╝

📋 DOSTĘPNE TESTY:

1. test1_init()
   → Ładuje bibliotekę Supabase

2. test2_config()
   → Sprawdza konfigurację (URL, klucze)

3. test3_connect()
   → Testuje połączenie z Supabase

4. test4_getVehicles(companyId = 'mtoilet')
   → Pobiera pojazdy
   → Użycie: test4_getVehicles('mtoilet')

5. test5_addVehicle(nrRej = 'WA-TEST-001')
   → Dodaje testowy pojazd
   → Użycie: test5_addVehicle('WA-12345')

6. test6_updateVehicle(vehicleId)
   → Aktualizuje pojazd
   → Użycie: test6_updateVehicle('uuid-pojazdu')

7. test7_sync(companyId = 'mtoilet')
   → Synchronizuje dane z Supabase

8. test8_documents(vehicleId)
   → Testuje operacje na dokumentach

9. test9_costs(vehicleId, companyId = 'mtoilet')
   → Testuje operacje na kosztach

🚀 testFull()
   → Uruchamia WSZYSTKIE testy po kolei

═════════════════════════════════════════════════════════════════

📌 INSTRUKCJA:

1. PRZYGOTOWANIE:
   a) Otwórz DevTools (F12 lub Ctrl+Shift+I)
   b) Przejdź do zakładki "Console"
   c) Podaj komendy poniżej

2. URUCHOM PEŁNY TEST:
   testFull()
   
   Lub uruchom indywidualne testy:
   test2_config()        ← Sprawdź config
   test3_connect()       ← Testuj połączenie
   test4_getVehicles()   ← Pobierz pojazdy
   test5_addVehicle()    ← Dodaj pojazd

3. INTERPRETACJA WYNIKÓW:
   ✓ zielone  = OK
   ✗ czerwone = BŁĄD
   ℹ niebieskie = INFO
   ⚠ żółte    = OSTRZEŻENIE

═════════════════════════════════════════════════════════════════

❓ PROBLEMY?

   1. "Supabase JS nie jest załadowany"
      → test1_init() załaduje bibliotekę
   
   2. "SUPABASE_CONFIG nie skonfigurowany"
      → Edytuj modules/supabase-manager.js
      → Wpisz URL i klucze z Supabase
   
   3. "Połączenie nieudane"
      → Sprawdź URL i klucze
      → Czy projekt w Supabase jest aktywny?
   
   4. "localhost refused to connect"
      → localhost nie ma dostępu do Supabase
      → Testuj na publicznym URL (Cloudflare Pages, Vercel)

═════════════════════════════════════════════════════════════════
`);
};

// Automatycznie pokaż help przy załadowaniu
window.addEventListener('load', () => {
  console.log('%cOtworz DevTools (F12) i wpisz: testHelp() or testFull()', 'font-size: 14px; color: blue; font-weight: bold');
});

// Eksport
window.TestSuite = {
  test1_init,
  test2_config,
  test3_connect,
  test4_getVehicles,
  test5_addVehicle,
  test6_updateVehicle,
  test7_sync,
  test8_documents,
  test9_costs,
  testFull,
  testHelp
};
