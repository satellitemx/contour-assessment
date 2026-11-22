-- Contour Mini LMS - Consolidated Declarative Schema Snapshot
-- Mirrors supabase/migrations/20261122000001_initial_schema.sql and 20261122000002_rls_policies.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  preferred_locale text NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en', 'zh-CN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_single_default_idx
  ON public.roles (is_default)
  WHERE is_default = true;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
  ON public.role_permissions (permission_id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx
  ON public.user_roles (role_id);

CREATE TABLE IF NOT EXISTS public.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultations_valid_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS consultations_student_starts_idx
  ON public.consultations (student_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS consultations_starts_at_idx
  ON public.consultations (starts_at DESC);

CREATE INDEX IF NOT EXISTS consultations_status_idx
  ON public.consultations (status);

-- Functions & Triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS roles_set_updated_at ON public.roles;
CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS consultations_set_updated_at ON public.consultations;
CREATE TRIGGER consultations_set_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_permission(target_user_id uuid, perm_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = target_user_id
      AND p.key = perm_key
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions(target_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT p.key ORDER BY p.key), ARRAY[]::text[])
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role_id uuid;
  v_first_name text;
  v_last_name text;
  v_locale text;
BEGIN
  v_first_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), ''), '');
  v_last_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), ''), '');
  v_locale := CASE
    WHEN (NEW.raw_user_meta_data ->> 'preferred_locale') IN ('en', 'zh-CN')
      THEN NEW.raw_user_meta_data ->> 'preferred_locale'
    ELSE 'en'
  END;

  INSERT INTO public.profiles (id, email, first_name, last_name, preferred_locale)
  VALUES (NEW.id, COALESCE(NEW.email, ''), v_first_name, v_last_name, v_locale)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        first_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE public.profiles.first_name END,
        last_name = CASE WHEN EXCLUDED.last_name <> '' THEN EXCLUDED.last_name ELSE public.profiles.last_name END;

  SELECT id INTO default_role_id
  FROM public.roles
  WHERE is_default = true
  LIMIT 1;

  IF default_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, default_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_permission(auth.uid(), 'consultations:read:all')
    OR public.has_permission(auth.uid(), 'roles:read')
    OR public.has_permission(auth.uid(), 'roles:manage')
    OR public.has_permission(auth.uid(), 'users:assign_roles')
  );

DROP POLICY IF EXISTS profiles_update_own_policy ON public.profiles;
CREATE POLICY profiles_update_own_policy ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS permissions_select_policy ON public.permissions;
CREATE POLICY permissions_select_policy ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS roles_select_policy ON public.roles;
CREATE POLICY roles_select_policy ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'roles:read')
    OR public.has_permission(auth.uid(), 'roles:manage')
    OR public.has_permission(auth.uid(), 'users:assign_roles')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role_id = roles.id
    )
  );

DROP POLICY IF EXISTS roles_insert_policy ON public.roles;
CREATE POLICY roles_insert_policy ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'roles:manage'));

DROP POLICY IF EXISTS roles_update_policy ON public.roles;
CREATE POLICY roles_update_policy ON public.roles
  FOR UPDATE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'roles:manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles:manage'));

DROP POLICY IF EXISTS roles_delete_policy ON public.roles;
CREATE POLICY roles_delete_policy ON public.roles
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'roles:manage')
    AND is_system = false
    AND is_default = false
  );

DROP POLICY IF EXISTS role_permissions_select_policy ON public.role_permissions;
CREATE POLICY role_permissions_select_policy ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'roles:read')
    OR public.has_permission(auth.uid(), 'roles:manage')
    OR public.has_permission(auth.uid(), 'users:assign_roles')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role_id = role_permissions.role_id
    )
  );

DROP POLICY IF EXISTS role_permissions_insert_policy ON public.role_permissions;
CREATE POLICY role_permissions_insert_policy ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'roles:manage'));

DROP POLICY IF EXISTS role_permissions_delete_policy ON public.role_permissions;
CREATE POLICY role_permissions_delete_policy ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'roles:manage'));

DROP POLICY IF EXISTS user_roles_select_policy ON public.user_roles;
CREATE POLICY user_roles_select_policy ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'roles:read')
    OR public.has_permission(auth.uid(), 'roles:manage')
    OR public.has_permission(auth.uid(), 'users:assign_roles')
  );

DROP POLICY IF EXISTS user_roles_insert_policy ON public.user_roles;
CREATE POLICY user_roles_insert_policy ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'users:assign_roles'));

DROP POLICY IF EXISTS user_roles_update_policy ON public.user_roles;
CREATE POLICY user_roles_update_policy ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'users:assign_roles'))
  WITH CHECK (public.has_permission(auth.uid(), 'users:assign_roles'));

DROP POLICY IF EXISTS user_roles_delete_policy ON public.user_roles;
CREATE POLICY user_roles_delete_policy ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'users:assign_roles'));

DROP POLICY IF EXISTS consultations_select_policy ON public.consultations;
CREATE POLICY consultations_select_policy ON public.consultations
  FOR SELECT
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.has_permission(auth.uid(), 'consultations:read:own'))
    OR public.has_permission(auth.uid(), 'consultations:read:all')
  );

DROP POLICY IF EXISTS consultations_insert_policy ON public.consultations;
CREATE POLICY consultations_insert_policy ON public.consultations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.has_permission(auth.uid(), 'consultations:create:own')
  );

DROP POLICY IF EXISTS consultations_update_policy ON public.consultations;
CREATE POLICY consultations_update_policy ON public.consultations
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    AND (
      public.has_permission(auth.uid(), 'consultations:update:own')
      OR public.has_permission(auth.uid(), 'consultations:cancel:own')
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    AND (
      (status = 'cancelled' AND public.has_permission(auth.uid(), 'consultations:cancel:own'))
      OR (status <> 'cancelled' AND public.has_permission(auth.uid(), 'consultations:update:own'))
    )
  );
