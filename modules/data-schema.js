/**
 * Schemat danych dla Supabase / localStorage
 * Przygotowana struktura gotowa do podłączenia bazy danych
 */

const DATA_SCHEMA = {
  // Tabela: pojazdy
  vehicles: {
    id: 'uuid',
    companyId: 'uuid',
    nrRej: 'string',
    marka: 'string',
    model: 'string',
    rok: 'integer',
    vin: 'string',
    dmc: 'integer', // masa całkowita (kg)
    dmcTeam: 'integer', // DMC zespołu (t)
    type: 'enum', // Ciężarowy, Przyczepa, Naczepa, Ciągnik siodłowy, Autobus
    status: 'enum', // Własny, Leasing, Wynajęty
    owner: 'string',
    euro: 'string', // EURO 3/4/5/6
    fuel: 'string',
    suspension: 'string', // pneumatyczne, inne
    axles: 'integer',
    dataNabycia: 'date',
    dateSprzedazy: 'date',
    monthsTaxable: 'integer',
    category: 'string', // DT-1 kategoria (D1, D2, ...)
    taxAmount: 'decimal',
    documents: 'json', // [{ id, type, expiryDate }]
    _dt1Submitted: 'boolean',
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },

  // Tabela: kierowcy
  drivers: {
    id: 'uuid',
    companyId: 'uuid',
    firstName: 'string',
    lastName: 'string',
    email: 'string',
    phone: 'string',
    licenseNumber: 'string',
    licenseExpiry: 'date',
    dateHired: 'date',
    dateTerminated: 'date',
    status: 'enum', // active, inactive, suspended
    vehicles: 'json', // [vehicleId]
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },

  // Tabela: dokumenty
  documents: {
    id: 'uuid',
    vehicleId: 'uuid',
    type: 'enum', // OC, BadaniaTechniczne, DPF, DT1, Ubezpieczenie
    documentNumber: 'string',
    issuedDate: 'date',
    expiryDate: 'date',
    daysUntilExpiry: 'integer',
    status: 'enum', // active, expired, expiringSoon
    filePath: 'string', // URL do dokumentu
    notes: 'text',
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },

  // Tabela: koszty
  costs: {
    id: 'uuid',
    vehicleId: 'uuid',
    companyId: 'uuid',
    type: 'enum', // paliwo, naprawa, ubezpieczenie, leasing, inne
    amount: 'decimal',
    currency: 'string', // PLN
    date: 'date',
    description: 'text',
    invoiceNumber: 'string',
    invoicePath: 'string',
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },

  // Tabela: podatki DT-1
  taxes_dt1: {
    id: 'uuid',
    companyId: 'uuid',
    taxYear: 'integer',
    vehicles: 'json', // [{ vehicleId, category, rate, amount }]
    totalAmount: 'decimal',
    firstInstallment: 'decimal',
    secondInstallment: 'decimal',
    dueDate1: 'date',
    dueDate2: 'date',
    status: 'enum', // draft, submitted, confirmed, paid
    submittedDate: 'date',
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },

  // Tabela: użytkownicy
  users: {
    id: 'uuid',
    email: 'string',
    password: 'string', // hashed
    firstName: 'string',
    lastName: 'string',
    role: 'enum', // admin, accountant, fleet_manager, viewer
    companyId: 'uuid',
    status: 'enum', // active, inactive, suspended
    lastLogin: 'timestamp',
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },

  // Tabela: firmy
  companies: {
    id: 'uuid',
    name: 'string',
    nip: 'string',
    regon: 'string',
    street: 'string',
    city: 'string',
    zipCode: 'string',
    taxAuthority: 'string', // Organ podatkowy
    email: 'string',
    phone: 'string',
    status: 'enum', // active, inactive
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },

  // Tabela: integracje
  integrations: {
    id: 'uuid',
    companyId: 'uuid',
    service: 'enum', // CEPiK, eHanuta
    enabled: 'boolean',
    apiKey: 'string', // encrypted
    consumerKey: 'string', // encrypted
    lastSync: 'timestamp',
    status: 'enum', // active, error, inactive
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  }
};

// ==================== FUNKCJE LOCALSTORAGE ====================

/**
 * Załaduj dane z localStorage
 */
function loadFromLocalStorage() {
  try {
    const stored = localStorage.getItem('fleet-manager-db');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Błąd ładowania z localStorage:', e);
  }
  return null;
}

/**
 * Zapisz dane do localStorage
 */
function saveToLocalStorage(data) {
  try {
    localStorage.setItem('fleet-manager-db', JSON.stringify(data));
    console.log('✓ Dane zapisane w localStorage');
  } catch (e) {
    console.error('Błąd zapisu do localStorage:', e);
  }
}

/**
 * Inicjalizuj bazę danych
 */
function initializeDatabase() {
  const loaded = loadFromLocalStorage();
  if (loaded) {
    Object.assign(FleetManager.DB, loaded);
    console.log('✓ Baza danych załadowana z localStorage');
  } else {
    console.log('✓ Inicjalizacja nowej bazy danych');
  }
}

// ==================== PRZYGOTOWANIE DO SUPABASE ====================

const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL || '',
  key: process.env.SUPABASE_KEY || '',
  enabled: false
};

/**
 * Połącz z Supabase (gdy będzie dostępny)
 */
async function connectSupabase() {
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) {
    console.log('⚠ Supabase nie skonfigurowany. Używam localStorage.');
    return false;
  }

  try {
    // const { createClient } = window.supabase;
    // const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    // SUPABASE_CONFIG.enabled = true;
    // console.log('✓ Połączono z Supabase');
    return true;
  } catch (e) {
    console.error('Błąd połączenia Supabase:', e);
    return false;
  }
}

// ==================== EKSPORT ====================

window.DataSchema = {
  SCHEMA: DATA_SCHEMA,
  loadFromLocalStorage,
  saveToLocalStorage,
  initializeDatabase,
  connectSupabase,
  SUPABASE_CONFIG
};
