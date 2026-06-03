-- TaxOrder Fleet Manager Enterprise
-- Supabase / PostgreSQL schema
-- Etap 1: firmy, użytkownicy, role, pojazdy

create extension if not exists "uuid-ossp";

-- =========================
-- FIRMY
-- =========================

create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  short_name text,
  nip text,
  regon text,
  krs text,
  country text default 'Polska',
  voivodeship text,
  county text,
  municipality text,
  street text,
  building_number text,
  apartment_number text,
  city text,
  postal_code text,
  post_office text,
  tax_authority_name text,
  tax_authority_address text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================
-- PROFILE UŻYTKOWNIKÓW
-- =========================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_initials text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================
-- ROLE UŻYTKOWNIKA W FIRMIE
-- =========================

create table if not exists company_users (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in (
    'admin',
    'fleet_manager',
    'accounting',
    'administration',
    'management',
    'viewer'
  )),
  active boolean default true,
  created_at timestamptz default now(),
  unique(company_id, user_id)
);

-- =========================
-- POJAZDY
-- =========================

create table if not exists vehicles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,

  registration_number text not null,
  vin text,
  brand text,
  model text,
  production_year int,

  vehicle_type text,
  ownership_status text,
  owner_name text,

  dmc_kg numeric,
  dmc_team_kg numeric,
  euro_standard text,
  fuel_type text,
  axles_count int,
  suspension_type text,

  first_registration_date date,
  acquisition_date date,
  sale_date date,
  temporary_withdrawal_date date,
  return_to_traffic_date date,
  deregistration_date date,

  dt1_category text,
  dt1_months_count int default 12,
  dt1_tax_amount numeric default 0,
  dt1_ready boolean default false,

  status text default 'active',
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(company_id, registration_number)
);