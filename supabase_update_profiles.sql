-- ADD COLUMNS TO PROFILES IF NOT EXIST
alter table public.profiles 
add column if not exists phone text,
add column if not exists avatar_url text,
add column if not exists car_plate text,
add column if not exists car_type text,
add column if not exists car_color text;
