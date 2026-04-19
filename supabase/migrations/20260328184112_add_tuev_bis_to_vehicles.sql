ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tuev_bis DATE NULL;
COMMENT ON COLUMN vehicles.tuev_bis IS 'TÜV-Ablaufdatum (erster Tag des Ablaufmonats, z.B. 2026-04-01 = TÜV bis April 2026)';
