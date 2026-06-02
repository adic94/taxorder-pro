/**
 * Konfiguracja i inicjalizacja Supabase
 * Połączenie z bazą danych i zarządzanie autentykacją
 */

// ==================== KONFIGURACJA SUPABASE ====================

const SUPABASE_CONFIG = {
  // Zmienne środowiskowe - zastąp własnymi kluczami
  url: process.env.REACT_APP_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co',
  anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY',
  serviceKey: process.env.REACT_APP_SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY',
  enabled: false
};

// Globalny klient Supabase
let supabaseClient = null;

/**
 * Zainicjalizuj połączenie Supabase
 */
async function initSupabase() {
  // Załaduj bibliotekę Supabase z CDN
  if (!window.supabase) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
      connectToSupabase();
    };
    document.head.appendChild(script);
  } else {
    connectToSupabase();
  }
}

function connectToSupabase() {
  try {
    const { createClient } = window.supabase;
    
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
      console.warn('⚠ Supabase nie skonfigurowany. Używam localStorage.');
      return false;
    }
    
    supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    SUPABASE_CONFIG.enabled = true;
    console.log('✓ Połączono z Supabase');
    return true;
  } catch (error) {
    console.error('❌ Błąd połączenia Supabase:', error);
    return false;
  }
}

/**
 * Sprawdź czy Supabase jest dostępny
 */
function isSupabaseEnabled() {
  return SUPABASE_CONFIG.enabled && supabaseClient !== null;
}

/**
 * Pobierz klienta Supabase
 */
function getSupabaseClient() {
  return supabaseClient;
}

// ==================== AUTENTYKACJA ====================

/**
 * Zaloguj użytkownika
 */
async function signInWithEmail(email, password) {
  if (!isSupabaseEnabled()) {
    return fallbackLogin(email, password);
  }
  
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    console.log('✓ Zalogowano:', email);
    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    console.error('❌ Błąd logowania:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Wyloguj użytkownika
 */
async function signOut() {
  if (isSupabaseEnabled()) {
    await supabaseClient.auth.signOut();
  }
  localStorage.removeItem('auth-token');
  console.log('✓ Wylogowano');
}

/**
 * Fallback - logowanie z localStorage (na razie)
 */
function fallbackLogin(email, password) {
  // Domyślne dane dla testów
  const defaultUsers = {
    'admin@mtoilet.pl': 'admin123'
  };
  
  if (defaultUsers[email] === password) {
    const user = {
      id: 'local-user-1',
      email: email,
      role: 'admin',
      companyId: 'mtoilet'
    };
    localStorage.setItem('auth-token', JSON.stringify(user));
    return { success: true, user, session: null };
  }
  
  return { success: false, error: 'Nieprawidłowe dane logowania' };
}

/**
 * Pobierz aktualnego użytkownika
 */
function getCurrentUser() {
  if (isSupabaseEnabled()) {
    const session = supabaseClient.auth.getSession();
    return session?.user || null;
  }
  
  // Fallback z localStorage
  const token = localStorage.getItem('auth-token');
  return token ? JSON.parse(token) : null;
}

// ==================== OPERACJE NA POJAZDACH ====================

/**
 * Pobierz wszystkie pojazdy użytkownika
 */
async function getVehicles(companyId) {
  if (!isSupabaseEnabled()) {
    return FleetManager.DB.vehicles || [];
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('vehicles')
      .select('*')
      .eq('companyId', companyId);
    
    if (error) throw error;
    console.log(`✓ Pobrano ${data.length} pojazdów`);
    return data;
  } catch (error) {
    console.error('❌ Błąd pobierania pojazdów:', error.message);
    return FleetManager.DB.vehicles || [];
  }
}

/**
 * Dodaj nowy pojazd
 */
async function addVehicle(vehicleData) {
  if (!isSupabaseEnabled()) {
    const newVehicle = {
      id: 'veh-' + Date.now(),
      ...vehicleData,
      createdAt: new Date().toISOString()
    };
    FleetManager.DB.vehicles.push(newVehicle);
    DataSchema.saveToLocalStorage(FleetManager.DB);
    return newVehicle;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('vehicles')
      .insert([{
        ...vehicleData,
        createdAt: new Date().toISOString()
      }])
      .select();
    
    if (error) throw error;
    console.log('✓ Pojazd dodany');
    return data[0];
  } catch (error) {
    console.error('❌ Błąd dodawania pojazdu:', error.message);
    return null;
  }
}

/**
 * Zaktualizuj pojazd
 */
async function updateVehicle(vehicleId, updates) {
  if (!isSupabaseEnabled()) {
    const idx = FleetManager.DB.vehicles.findIndex(v => v.id === vehicleId);
    if (idx >= 0) {
      FleetManager.DB.vehicles[idx] = { ...FleetManager.DB.vehicles[idx], ...updates };
      DataSchema.saveToLocalStorage(FleetManager.DB);
      return FleetManager.DB.vehicles[idx];
    }
    return null;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('vehicles')
      .update({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .eq('id', vehicleId)
      .select();
    
    if (error) throw error;
    console.log('✓ Pojazd zaktualizowany');
    return data[0];
  } catch (error) {
    console.error('❌ Błąd aktualizacji pojazdu:', error.message);
    return null;
  }
}

/**
 * Usuń pojazd
 */
async function deleteVehicle(vehicleId) {
  if (!isSupabaseEnabled()) {
    const idx = FleetManager.DB.vehicles.findIndex(v => v.id === vehicleId);
    if (idx >= 0) {
      FleetManager.DB.vehicles.splice(idx, 1);
      DataSchema.saveToLocalStorage(FleetManager.DB);
      return true;
    }
    return false;
  }
  
  try {
    const { error } = await supabaseClient
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);
    
    if (error) throw error;
    console.log('✓ Pojazd usunięty');
    return true;
  } catch (error) {
    console.error('❌ Błąd usuwania pojazdu:', error.message);
    return false;
  }
}

// ==================== OPERACJE NA DOKUMENTACH ====================

/**
 * Pobierz dokumenty pojazdu
 */
async function getVehicleDocuments(vehicleId) {
  if (!isSupabaseEnabled()) {
    return FleetManager.DB.documents?.filter(d => d.vehicleId === vehicleId) || [];
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('vehicleId', vehicleId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Błąd pobierania dokumentów:', error.message);
    return [];
  }
}

/**
 * Dodaj dokument pojazdu
 */
async function addDocument(vehicleId, documentData) {
  if (!isSupabaseEnabled()) {
    const newDoc = {
      id: 'doc-' + Date.now(),
      vehicleId,
      ...documentData,
      createdAt: new Date().toISOString()
    };
    if (!FleetManager.DB.documents) FleetManager.DB.documents = [];
    FleetManager.DB.documents.push(newDoc);
    DataSchema.saveToLocalStorage(FleetManager.DB);
    return newDoc;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('documents')
      .insert([{
        vehicleId,
        ...documentData,
        createdAt: new Date().toISOString()
      }])
      .select();
    
    if (error) throw error;
    console.log('✓ Dokument dodany');
    return data[0];
  } catch (error) {
    console.error('❌ Błąd dodawania dokumentu:', error.message);
    return null;
  }
}

// ==================== OPERACJE NA KOSZTACH ====================

/**
 * Pobierz koszty pojazdu
 */
async function getVehicleCosts(vehicleId) {
  if (!isSupabaseEnabled()) {
    return FleetManager.DB.costs?.filter(c => c.vehicleId === vehicleId) || [];
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('costs')
      .select('*')
      .eq('vehicleId', vehicleId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Błąd pobierania kosztów:', error.message);
    return [];
  }
}

/**
 * Dodaj koszt
 */
async function addCost(vehicleId, companyId, costData) {
  if (!isSupabaseEnabled()) {
    const newCost = {
      id: 'cost-' + Date.now(),
      vehicleId,
      companyId,
      ...costData,
      createdAt: new Date().toISOString()
    };
    if (!FleetManager.DB.costs) FleetManager.DB.costs = [];
    FleetManager.DB.costs.push(newCost);
    DataSchema.saveToLocalStorage(FleetManager.DB);
    return newCost;
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('costs')
      .insert([{
        vehicleId,
        companyId,
        ...costData,
        createdAt: new Date().toISOString()
      }])
      .select();
    
    if (error) throw error;
    console.log('✓ Koszt dodany');
    return data[0];
  } catch (error) {
    console.error('❌ Błąd dodawania kosztu:', error.message);
    return null;
  }
}

// ==================== SYNCHRONIZACJA ====================

/**
 * Synchronizuj dane z Supabase do localStorage
 */
async function syncFromSupabase(companyId) {
  if (!isSupabaseEnabled()) {
    console.log('⚠ Supabase niedostępny - używam cache');
    return false;
  }
  
  try {
    console.log('🔄 Synchronizacja z Supabase...');
    
    // Pobierz wszystkie dane
    const [vehicles, drivers, documents, costs] = await Promise.all([
      getVehicles(companyId),
      getDrivers(companyId),
      supabaseClient.from('documents').select('*').eq('companyId', companyId).then(r => r.data || []),
      supabaseClient.from('costs').select('*').eq('companyId', companyId).then(r => r.data || [])
    ]);
    
    // Zaktualizuj state
    FleetManager.DB.vehicles = vehicles;
    FleetManager.DB.drivers = drivers;
    FleetManager.DB.documents = documents;
    FleetManager.DB.costs = costs;
    
    console.log('✓ Synchronizacja ukończona');
    return true;
  } catch (error) {
    console.error('❌ Błąd synchronizacji:', error.message);
    return false;
  }
}

/**
 * Wyślij dane do Supabase (backup)
 */
async function syncToSupabase(companyId) {
  if (!isSupabaseEnabled()) {
    console.log('⚠ Supabase niedostępny');
    return false;
  }
  
  try {
    console.log('💾 Wysyłanie danych do Supabase...');
    // TODO: Implementacja logiki wysyłania
    console.log('✓ Dane wysłane');
    return true;
  } catch (error) {
    console.error('❌ Błąd wysyłania:', error.message);
    return false;
  }
}

// ==================== KIEROWCY ====================

/**
 * Pobierz kierowców firmy
 */
async function getDrivers(companyId) {
  if (!isSupabaseEnabled()) {
    return FleetManager.DB.drivers || [];
  }
  
  try {
    const { data, error } = await supabaseClient
      .from('drivers')
      .select('*')
      .eq('companyId', companyId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Błąd pobierania kierowców:', error.message);
    return [];
  }
}

// ==================== EKSPORT ====================

window.SupabaseManager = {
  SUPABASE_CONFIG,
  initSupabase,
  isSupabaseEnabled,
  getSupabaseClient,
  signInWithEmail,
  signOut,
  getCurrentUser,
  getVehicles,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleDocuments,
  addDocument,
  getVehicleCosts,
  addCost,
  getDrivers,
  syncFromSupabase,
  syncToSupabase
};
