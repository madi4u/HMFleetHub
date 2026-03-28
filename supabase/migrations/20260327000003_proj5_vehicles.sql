-- PROJ-5: Fahrzeugstammdaten & Fuhrparkuebersicht
-- Creates vehicles table with RLS, indexes, and storage bucket

CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  license_plate TEXT NOT NULL,
  image_url TEXT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('PKW','LKW','Transporter','Motorrad','Anhänger','Sonstige')),
  status TEXT NOT NULL DEFAULT 'Aktiv' CHECK (status IN ('Aktiv','Inaktiv','In Werkstatt','Verkauft','Abgemeldet')),
  vin TEXT,
  first_registration DATE,
  year INTEGER,
  color TEXT,
  current_mileage INTEGER,
  location TEXT,
  assigned_to TEXT,
  notes TEXT,
  tire_size TEXT,
  engine_oil_spec TEXT,
  transmission_oil_spec TEXT,
  fuel_type TEXT CHECK (fuel_type IN ('Benzin','Diesel','Elektro','Hybrid','Gas','Sonstige') OR fuel_type IS NULL),
  engine_code TEXT,
  engine_power INTEGER,
  hsn TEXT,
  tsn TEXT,
  service_interval_notes TEXT,
  technical_notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (license_plate, tenant_id)
);

-- Enable Row Level Security
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users see only their tenant's vehicles (not soft-deleted)
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Indexes for common queries
CREATE INDEX idx_vehicles_tenant_id ON public.vehicles (tenant_id);
CREATE INDEX idx_vehicles_license_plate ON public.vehicles (tenant_id, license_plate);
CREATE INDEX idx_vehicles_status ON public.vehicles (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_deleted_at ON public.vehicles (deleted_at) WHERE deleted_at IS NOT NULL;

-- Auto-update updated_at on row change
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Storage bucket for vehicle media (images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vehicle-media', 'vehicle-media', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for vehicle-media bucket
-- SELECT: tenant members can view their tenant's vehicle media
CREATE POLICY "vehicle_media_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'vehicle-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] IN (
      SELECT tenant_id::text FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- INSERT: tenant members with vehicles.edit can upload
CREATE POLICY "vehicle_media_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vehicle-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] IN (
      SELECT tenant_id::text FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- UPDATE: tenant members can update their tenant's vehicle media
CREATE POLICY "vehicle_media_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'vehicle-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] IN (
      SELECT tenant_id::text FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- DELETE: tenant members can delete their tenant's vehicle media
CREATE POLICY "vehicle_media_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vehicle-media'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] IN (
      SELECT tenant_id::text FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
