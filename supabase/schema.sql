-- ==========================================
-- SCHEMA Y TABLAS (Muévete!)
-- ==========================================

-- Tabla de Rutas
CREATE TABLE public.routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    polyline JSONB
);

-- Tabla de Reportes
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT REFERENCES public.routes(id),
    type TEXT NOT NULL, -- 'demora', 'llena', 'accidente'
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- Tabla de Perfiles (Suscripciones)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    role TEXT DEFAULT 'free', -- 'free' or 'pro'
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración de Realtime (Activamos Realtime en Reports y en canales personalizados)
ALTER PUBLICATION supabase_realtime ADD TABLE reports;

-- Row Level Security (RLS)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Public routes are viewable by everyone." ON public.routes FOR SELECT USING (true);
CREATE POLICY "Public reports are viewable by everyone." ON public.reports FOR SELECT USING (true);
CREATE POLICY "Users can insert reports." ON public.reports FOR INSERT WITH CHECK (true); -- Sandbox: allow anon insertion, in prod require auth
