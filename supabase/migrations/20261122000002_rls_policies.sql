-- Contour Mini LMS - Attribute-Driven Row Level Security (RLS) Policies
-- All policies check atomic access attributes via public.has_permission(...)
-- rather than hardcoded role names.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Profiles
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

-- Permissions Catalog (read-only for authenticated users; API routes restrict admin screens)
DROP POLICY IF EXISTS permissions_select_policy ON public.permissions;
CREATE POLICY permissions_select_policy ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Roles (users can read their own roles, plus anyone with role/user-admin read attributes)
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

-- Role Permissions
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

-- User Role Assignments
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

-- Consultations
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
