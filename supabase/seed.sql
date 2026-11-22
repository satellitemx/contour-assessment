-- Contour Mini LMS - Idempotent Permissions & Starter Role Seed
-- Note: Roles are purely data-driven compositions of atomic access attributes.
-- Application authorization never hardcodes role slugs or names.

INSERT INTO public.permissions (key, resource, action, label, description)
VALUES
  (
    'consultations:read:own',
    'consultations',
    'read:own',
    'View own consultations',
    'View personal consultation bookings on the student dashboard.'
  ),
  (
    'consultations:create:own',
    'consultations',
    'create:own',
    'Book consultations',
    'Create new consultation bookings for yourself.'
  ),
  (
    'consultations:update:own',
    'consultations',
    'update:own',
    'Update & reschedule own consultations',
    'Mark own consultations complete/incomplete and reschedule bookings.'
  ),
  (
    'consultations:cancel:own',
    'consultations',
    'cancel:own',
    'Cancel own consultations',
    'Cancel scheduled consultation bookings.'
  ),
  (
    'consultations:read:all',
    'consultations',
    'read:all',
    'View all system consultations',
    'Read-only access to view consultations across all users in the system.'
  ),
  (
    'roles:read',
    'roles',
    'read',
    'View roles & users',
    'Inspect defined roles, access attribute compositions, and user role assignments.'
  ),
  (
    'roles:manage',
    'roles',
    'manage',
    'Compose & manage custom roles',
    'Create, update, and delete custom roles and compose their access attributes.'
  ),
  (
    'users:assign_roles',
    'users',
    'assign_roles',
    'Assign roles to users',
    'Assign or revoke composed roles for user accounts.'
  )
ON CONFLICT (key) DO UPDATE
  SET resource = EXCLUDED.resource,
      action = EXCLUDED.action,
      label = EXCLUDED.label,
      description = EXCLUDED.description;

-- Ensure starter roles exist idempotently
INSERT INTO public.roles (slug, name, description, is_system, is_default)
VALUES
  (
    'learner',
    'Learner',
    'Default role assigned to newly signed-up users with self-service consultation access.',
    false,
    true
  ),
  (
    'consultation-auditor',
    'Consultation Auditor',
    'Read-only reviewer role able to inspect consultations across the entire system.',
    false,
    false
  ),
  (
    'super-admin',
    'Platform Super Admin',
    'System bootstrap role with full consultation visibility and custom role composition privileges.',
    true,
    false
  )
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_system = EXCLUDED.is_system;

-- Compose permissions for Learner
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'consultations:read:own',
  'consultations:create:own',
  'consultations:update:own',
  'consultations:cancel:own'
)
WHERE r.slug = 'learner'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Compose permissions for Consultation Auditor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'consultations:read:all'
)
WHERE r.slug = 'consultation-auditor'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Compose permissions for Platform Super Admin (all permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'super-admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
