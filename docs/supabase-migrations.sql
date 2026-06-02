/**
 * SQL Migracje - Tworzenie tabel w Supabase
 * Wklej zawartość tego pliku do SQL Editora w Supabase
 */

-- ==================== TABELA: users (użytkownicy) ====================
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'viewer',
  company_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_company ON public.users(company_id);
CREATE INDEX idx_users_email ON public.users(email);

-- ==================== TABELA: companies (firmy) ====================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  nip VARCHAR(10) UNIQUE NOT NULL,
  regon VARCHAR(9),
  street VARCHAR(255),
  city VARCHAR(100),
  zip_code VARCHAR(10),
  tax_authority VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_companies_nip ON public.companies(nip);

-- ==================== TABELA: vehicles (pojazdy) ====================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nr_rej VARCHAR(20) NOT NULL,
  marka VARCHAR(100),
  model VARCHAR(100),
  rok INTEGER,
  vin VARCHAR(50),
  dmc INTEGER,
  dmc_team FLOAT,
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Własny',
  owner VARCHAR(100),
  euro VARCHAR(20),
  fuel VARCHAR(50),
  suspension VARCHAR(100),
  axles INTEGER,
  date_purchased DATE,
  date_sold DATE,
  months_taxable INTEGER,
  category VARCHAR(10),
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  documents JSONB DEFAULT '[]'::JSONB,
  dt1_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vehicles_company ON public.vehicles(company_id);
CREATE INDEX idx_vehicles_nr_rej ON public.vehicles(nr_rej);
CREATE INDEX idx_vehicles_vin ON public.vehicles(vin);
CREATE UNIQUE INDEX idx_vehicles_company_nr_rej ON public.vehicles(company_id, nr_rej);

-- ==================== TABELA: drivers (kierowcy) ====================
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  license_number VARCHAR(50),
  license_expiry DATE,
  date_hired DATE,
  date_terminated DATE,
  status VARCHAR(50) DEFAULT 'active',
  vehicles JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drivers_company ON public.drivers(company_id);
CREATE INDEX idx_drivers_license ON public.drivers(license_number);

-- ==================== TABELA: documents (dokumenty) ====================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  document_number VARCHAR(100),
  issued_date DATE,
  expiry_date DATE,
  days_until_expiry INTEGER,
  status VARCHAR(50) DEFAULT 'active',
  file_path VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_vehicle ON public.documents(vehicle_id);
CREATE INDEX idx_documents_type ON public.documents(type);
CREATE INDEX idx_documents_expiry ON public.documents(expiry_date);

-- ==================== TABELA: costs (koszty) ====================
CREATE TABLE public.costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type VARCHAR(50),
  amount DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'PLN',
  date DATE NOT NULL,
  description TEXT,
  invoice_number VARCHAR(100),
  invoice_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_costs_vehicle ON public.costs(vehicle_id);
CREATE INDEX idx_costs_company ON public.costs(company_id);
CREATE INDEX idx_costs_date ON public.costs(date);
CREATE INDEX idx_costs_type ON public.costs(type);

-- ==================== TABELA: taxes_dt1 (podatki DT-1) ====================
CREATE TABLE public.taxes_dt1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  vehicles JSONB,
  total_amount DECIMAL(12, 2),
  first_installment DECIMAL(12, 2),
  second_installment DECIMAL(12, 2),
  due_date_1 DATE,
  due_date_2 DATE,
  status VARCHAR(50) DEFAULT 'draft',
  submitted_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_taxes_dt1_company ON public.taxes_dt1(company_id);
CREATE INDEX idx_taxes_dt1_year ON public.taxes_dt1(tax_year);
CREATE UNIQUE INDEX idx_taxes_dt1_company_year ON public.taxes_dt1(company_id, tax_year);

-- ==================== TABELA: integrations (integracje) ====================
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT false,
  api_key_encrypted VARCHAR(500),
  consumer_key_encrypted VARCHAR(500),
  last_sync TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_integrations_company ON public.integrations(company_id);
CREATE INDEX idx_integrations_service ON public.integrations(service);

-- ==================== POLITYKI RLS (Row Level Security) ====================

-- Włącz RLS dla wszystkich tabel
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes_dt1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Polityka: użytkownik może czytać/edytować dane swojej firmy
CREATE POLICY "Users can read their company data" ON public.vehicles
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE email = auth.email()
    )
  );

CREATE POLICY "Users can insert vehicles for their company" ON public.vehicles
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE email = auth.email()
    )
  );

CREATE POLICY "Users can update vehicles in their company" ON public.vehicles
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE email = auth.email()
    )
  );

-- ==================== FUNKCJE ====================

-- Funkcja do aktualizacji updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggery
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_costs_updated_at
  BEFORE UPDATE ON public.costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_taxes_dt1_updated_at
  BEFORE UPDATE ON public.taxes_dt1
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
