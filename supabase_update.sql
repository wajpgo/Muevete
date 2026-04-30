-- ==========================================
-- ACTUALIZACIÓN DE SCHEMA (V2)
-- ==========================================

-- Agregar campo 'is_verified' a profiles
alter table public.profiles add column if not exists is_verified boolean default false;

-- ==========================================
-- TABLA: verification_requests
-- ==========================================
create table if not exists public.verification_requests (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    transaction_id text not null,
    phone_number text not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.verification_requests disable row level security;

-- ==========================================
-- TABLA: trips (Viajes publicados)
-- ==========================================
create table if not exists public.trips (
    id uuid default uuid_generate_v4() primary key,
    driver_id uuid references public.profiles(id) on delete cascade not null,
    origin text not null,
    destination text not null,
    departure_time timestamp with time zone not null,
    seats integer not null default 4,
    price numeric not null,
    status text not null default 'active' check (status in ('active', 'closed', 'cancelled')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.trips disable row level security;
