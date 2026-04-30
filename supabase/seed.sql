-- ==========================================
-- SEED DATA (Rutas de La Habana)
-- ==========================================

INSERT INTO public.routes (id, name, color) VALUES
('P1', 'P1 (La Rosita - Playa)', '#ef4444'),
('P2', 'P2 (Alberro - Vedado)', '#3b82f6'),
('P3', 'P3 (Alamar - Túnel)', '#10b981'),
('P4', 'P4 (San Agustín - Playa)', '#f59e0b'),
('P5', 'P5 (San Agustín - Terminal de Trenes)', '#8b5cf6'),
('P6', 'P6 (Reparto Eléctrico - Vedado)', '#ec4899'),
('P7', 'P7 (Alberro - Parque de la Fraternidad)', '#14b8a6'),
('P8', 'P8 (Reparto Eléctrico - Villa Panamericana)', '#f43f5e'),
('P9', 'P9 (CUJAE - La Palma)', '#84cc16'),
('P10', 'P10 (Víbora - Playa)', '#06b6d4'),
('P11', 'P11 (Alamar - Vedado)', '#3b82f6'),
('P12', 'P12 (Santiago de las Vegas - Parque de la Fraternidad)', '#eab308'),
('P13', 'P13 (Santiago de las Vegas - Parque de la Fraternidad)', '#14b8a6'),
('P14', 'P14 (San Agustín - Parque de la Fraternidad)', '#ec4899'),
('P15', 'P15 (Alamar - Guanabacoa)', '#ef4444'),
('A40', 'A40 (Guanabacoa - Estación Central)', '#64748b'),
('A65', 'A65 (Cotorro - Virgen del Camino)', '#64748b'),
('A20', 'A20 (Plaza - Terminal de Trenes)', '#64748b'),
('Gacela1', 'Gacela 14 (Víbora - Vedado) - PRO', '#f59e0b'),
('Gacela2', 'Gacela (Cotorro - Parque Fraternidad) - PRO', '#f59e0b')
ON CONFLICT (id) DO NOTHING;
