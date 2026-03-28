-- ============================================================
-- PROJ-3: Mandanten- & Superadmin-Verwaltung
-- Extend tenants table with contact_email and address
-- ============================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;
