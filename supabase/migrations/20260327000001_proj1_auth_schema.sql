-- ============================================================
-- PROJ-1: Authentication & Session Management
-- Tables: tenants, profiles, user_tenant_memberships
-- RLS policies + trigger for auto-creating profile on signup
-- ============================================================

-- 1. TENANTS TABLE (minimal foundation for PROJ-3)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Users see only tenants they belong to
CREATE POLICY "tenants_select_own" ON public.tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only SUPERADMIN can insert tenants
CREATE POLICY "tenants_insert_superadmin" ON public.tenants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
        AND role = 'SUPERADMIN'
        AND is_active = true
    )
  );

-- Only SUPERADMIN can update tenants
CREATE POLICY "tenants_update_superadmin" ON public.tenants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
        AND role = 'SUPERADMIN'
        AND is_active = true
    )
  );

-- No DELETE policy -- tenants are soft-deleted via status='inactive'

CREATE INDEX idx_tenants_slug ON public.tenants (slug);
CREATE INDEX idx_tenants_status ON public.tenants (status);

-- 2. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Users within the same tenant can read each other's profiles
CREATE POLICY "profiles_select_same_tenant" ON public.profiles
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Insert policy for the user's own profile
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE INDEX idx_profiles_tenant_id ON public.profiles (tenant_id);

-- 3. USER_TENANT_MEMBERSHIPS TABLE
CREATE TABLE public.user_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'SUPERADMIN', 'TENANT_ADMIN', 'FLEET_MANAGER',
    'OFFICE_USER', 'WORKSHOP_MECHANIC', 'READ_ONLY'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

ALTER TABLE public.user_tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Users can read their own memberships
CREATE POLICY "memberships_select_own" ON public.user_tenant_memberships
  FOR SELECT USING (user_id = auth.uid());

-- TENANT_ADMIN and SUPERADMIN can see memberships in their tenant
CREATE POLICY "memberships_select_admin" ON public.user_tenant_memberships
  FOR SELECT USING (
    tenant_id IN (
      SELECT utm.tenant_id FROM public.user_tenant_memberships utm
      WHERE utm.user_id = auth.uid()
        AND utm.role IN ('SUPERADMIN', 'TENANT_ADMIN')
        AND utm.is_active = true
    )
  );

-- Only SUPERADMIN and TENANT_ADMIN can insert memberships
CREATE POLICY "memberships_insert_admin" ON public.user_tenant_memberships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships utm
      WHERE utm.user_id = auth.uid()
        AND utm.tenant_id = tenant_id
        AND utm.role IN ('SUPERADMIN', 'TENANT_ADMIN')
        AND utm.is_active = true
    )
  );

-- Only SUPERADMIN and TENANT_ADMIN can update memberships in their tenant
CREATE POLICY "memberships_update_admin" ON public.user_tenant_memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_tenant_memberships utm
      WHERE utm.user_id = auth.uid()
        AND utm.tenant_id = user_tenant_memberships.tenant_id
        AND utm.role IN ('SUPERADMIN', 'TENANT_ADMIN')
        AND utm.is_active = true
    )
  );

-- No DELETE policy -- memberships are soft-deactivated via is_active=false

CREATE INDEX idx_memberships_user_id ON public.user_tenant_memberships (user_id);
CREATE INDEX idx_memberships_tenant_id ON public.user_tenant_memberships (tenant_id);
CREATE INDEX idx_memberships_user_tenant ON public.user_tenant_memberships (user_id, tenant_id);
CREATE INDEX idx_memberships_role ON public.user_tenant_memberships (role);

-- 4. AUTO-CREATE PROFILE ON AUTH USER CREATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. AUTO-UPDATE updated_at TIMESTAMPS
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON public.user_tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
