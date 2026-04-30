-- =====================================================================================
-- SCHEMA DE BASE DE DATOS PARA LA APP DE RUTAS (SUPABASE)
-- =====================================================================================

-- 1. Habilitar extensión para UUIDs y PostGIS (si en el futuro quieres hacer queries espaciales complejas)
create extension if not exists "uuid-ossp";

-- ==========================================
-- TABLA: profiles (Perfiles de usuario)
-- ==========================================
create table public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    email text unique not null,
    role text not null default 'user' check (role in ('admin', 'driver', 'user')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS (Row Level Security)
alter table public.profiles disable row level security;

-- ==========================================
-- TABLA: routes (Catálogo de Rutas)
-- ==========================================
create table public.routes (
    id text primary key, -- ej: 'P1', 'RUT-1'
    name text not null,
    category text not null check (category in ('principales', 'alimentadoras', 'ruteros', 'complementarias')),
    is_active boolean default true,
    added_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.routes disable row level security;

-- ==========================================
-- TABLA: route_geometries (Geolocalizaciones)
-- ==========================================
create table public.route_geometries (
    id uuid default uuid_generate_v4() primary key,
    route_id text references public.routes(id) on delete cascade not null,
    coordinates jsonb not null, -- Guardaremos el array de LSF/Coordenadas o GeoJSON
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.route_geometries disable row level security;

-- ==========================================
-- TABLA: bus_locations (Para tracking en tiempo real)
-- ==========================================
create table public.bus_locations (
    id uuid default uuid_generate_v4() primary key,
    route_id text references public.routes(id) on delete cascade not null,
    driver_id uuid references public.profiles(id) on delete set null,
    lat double precision not null,
    lng double precision not null,
    speed double precision default 0,
    heading double precision default 0,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.bus_locations disable row level security;

-- ==========================================
-- TABLA: reports (Reportes de usuarios en la vía)
-- ==========================================
create table public.reports (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    route_id text references public.routes(id) on delete set null,
    type text not null, -- ej: 'accidente', 'via_cerrada', 'guagua_llena'
    description text,
    lat double precision not null,
    lng double precision not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.reports disable row level security;

-- =====================================================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================================================

-- Trigger para crear automáticamente el profile al registrar un usuario en Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id, 
    new.email,
    -- Si es el primer usuario en registrarse, hacerlo ADMIN, sino USER
    case 
      when not exists (select 1 from public.profiles) then 'admin'
      else 'user'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================================================
-- INFORMACIÓN DE SUPER USUARIO (ADMIN)
-- =====================================================================================
-- Dado que supabase encripta las contraseñas, no es buena práctica inyectar el usuario
-- directamente por SQL con un password en texto plano. 
--
-- EL MÉTODO CORRECTO ES: 
-- 1. Copia y ejecuta este script en tu editor SQL de Supabase.
-- 2. Ve a Authentication -> Add user e invita a/crea 'admin@rutas.cu' con el password que desees.
-- 3. Gracias al Trigger que creamos arriba, ese primer usuario que crees será el ADMIN automáticamente.
