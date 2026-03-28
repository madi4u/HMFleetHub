-- PROJ-8: Mileage & Cost Tracking
-- Add cost_category to vehicle_history_entries
ALTER TABLE vehicle_history_entries
  ADD COLUMN IF NOT EXISTS cost_category TEXT
  CHECK (cost_category IN ('REPAIR','MAINTENANCE','OIL','TIRES','INSPECTION','BODYWORK','ELECTRICAL','OTHER'));

-- mileage_entries table
CREATE TABLE IF NOT EXISTS mileage_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  mileage INTEGER NOT NULL CHECK (mileage >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mileage_entries_vehicle_id ON mileage_entries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mileage_entries_tenant_id ON mileage_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mileage_entries_recorded_at ON mileage_entries(recorded_at DESC);

-- RLS on mileage_entries
ALTER TABLE mileage_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own tenant mileage" ON mileage_entries
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users create mileage in own tenant" ON mileage_entries
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND user_id = auth.uid()
  );

-- Trigger: update vehicles.current_mileage when mileage_entries inserted
CREATE OR REPLACE FUNCTION update_vehicle_mileage_on_entry()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vehicles
  SET current_mileage = NEW.mileage, updated_at = now()
  WHERE id = NEW.vehicle_id
    AND (current_mileage IS NULL OR NEW.mileage >= current_mileage);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_vehicle_mileage ON mileage_entries;
CREATE TRIGGER trg_update_vehicle_mileage
  AFTER INSERT ON mileage_entries
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_mileage_on_entry();

-- Trigger: update vehicles.current_mileage when history entry with mileage is inserted/updated
CREATE OR REPLACE FUNCTION update_vehicle_mileage_from_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mileage IS NOT NULL THEN
    UPDATE vehicles
    SET current_mileage = NEW.mileage, updated_at = now()
    WHERE id = NEW.vehicle_id
      AND (current_mileage IS NULL OR NEW.mileage >= current_mileage);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_vehicle_mileage_from_history ON vehicle_history_entries;
CREATE TRIGGER trg_update_vehicle_mileage_from_history
  AFTER INSERT OR UPDATE OF mileage ON vehicle_history_entries
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_mileage_from_history();
