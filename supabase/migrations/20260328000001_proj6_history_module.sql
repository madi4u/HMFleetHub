-- PROJ-6: History Module — vehicle_history_entries & vehicle_history_attachments
-- =============================================================================

-- vehicle_history_entries table
CREATE TABLE IF NOT EXISTS vehicle_history_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'NOTE','REPAIR','MAINTENANCE','OIL_CHANGE','TIRE_CHANGE',
    'DAMAGE','INSPECTION','TUV','MILEAGE_UPDATE',
    'DOCUMENT_UPLOAD','PHOTO_UPLOAD','VIDEO_UPLOAD','OTHER'
  )),
  title TEXT,
  message TEXT CHECK (char_length(message) <= 5000),
  mileage INTEGER,
  cost_net NUMERIC(12,2),
  cost_gross NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  supplier TEXT,
  invoice_number TEXT,
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- vehicle_history_attachments table
CREATE TABLE IF NOT EXISTS vehicle_history_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  history_entry_id UUID NOT NULL REFERENCES vehicle_history_entries(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('IMAGE','VIDEO','DOCUMENT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_history_entries_vehicle_id ON vehicle_history_entries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_history_entries_tenant_id ON vehicle_history_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_history_entries_event_date ON vehicle_history_entries(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_history_attachments_entry_id ON vehicle_history_attachments(history_entry_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vehicle_history_entries_updated_at ON vehicle_history_entries;
CREATE TRIGGER update_vehicle_history_entries_updated_at
  BEFORE UPDATE ON vehicle_history_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE vehicle_history_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_history_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_history_entries
CREATE POLICY "Users see own tenant history" ON vehicle_history_entries
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users create history in own tenant" ON vehicle_history_entries
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND author_user_id = auth.uid()
  );

CREATE POLICY "Users update own history entries" ON vehicle_history_entries
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users delete history in own tenant" ON vehicle_history_entries
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policies for vehicle_history_attachments
CREATE POLICY "Users see own tenant attachments" ON vehicle_history_attachments
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users create attachments in own tenant" ON vehicle_history_attachments
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users delete attachments in own tenant" ON vehicle_history_attachments
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
