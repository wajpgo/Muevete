-- ==========================================
-- TABLA: trip_requests (Solicitudes de Viajes)
-- ==========================================
create table if not exists public.trip_requests (
    id uuid default uuid_generate_v4() primary key,
    rider_id uuid references public.profiles(id) on delete cascade not null,
    driver_id uuid references public.profiles(id) on delete set null,
    rider_name text not null,
    origin_coords jsonb not null,
    dest_coords jsonb not null,
    route_info jsonb,
    price numeric not null,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'completed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.trip_requests disable row level security;
