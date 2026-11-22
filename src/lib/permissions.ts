import { permissionKeySchema } from './contracts';
import type { PermissionKey } from './types';

export const PERMISSIONS = {
  CONSULTATIONS_READ_OWN: 'consultations:read:own',
  CONSULTATIONS_CREATE_OWN: 'consultations:create:own',
  CONSULTATIONS_UPDATE_OWN: 'consultations:update:own',
  CONSULTATIONS_CANCEL_OWN: 'consultations:cancel:own',
  CONSULTATIONS_READ_ALL: 'consultations:read:all',
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
  USERS_ASSIGN_ROLES: 'users:assign_roles',
} as const satisfies Record<string, PermissionKey>;

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PERMISSIONS);

export interface PermissionCatalogEntry {
  key: PermissionKey;
  resource: string;
  action: string;
  group: 'Student Consultations' | 'System Administration' | 'Access Control';
  label: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  {
    key: PERMISSIONS.CONSULTATIONS_READ_OWN,
    resource: 'consultations',
    action: 'read:own',
    group: 'Student Consultations',
    label: 'View own consultations',
    description: 'View personal consultation bookings on the student dashboard.',
  },
  {
    key: PERMISSIONS.CONSULTATIONS_CREATE_OWN,
    resource: 'consultations',
    action: 'create:own',
    group: 'Student Consultations',
    label: 'Book consultations',
    description: 'Create new consultation bookings for yourself.',
  },
  {
    key: PERMISSIONS.CONSULTATIONS_UPDATE_OWN,
    resource: 'consultations',
    action: 'update:own',
    group: 'Student Consultations',
    label: 'Update & reschedule own consultations',
    description: 'Mark own consultations complete/incomplete and reschedule bookings.',
  },
  {
    key: PERMISSIONS.CONSULTATIONS_CANCEL_OWN,
    resource: 'consultations',
    action: 'cancel:own',
    group: 'Student Consultations',
    label: 'Cancel own consultations',
    description: 'Cancel scheduled consultation bookings.',
  },
  {
    key: PERMISSIONS.CONSULTATIONS_READ_ALL,
    resource: 'consultations',
    action: 'read:all',
    group: 'System Administration',
    label: 'View all system consultations',
    description: 'Read-only access to inspect consultations across all users.',
  },
  {
    key: PERMISSIONS.ROLES_READ,
    resource: 'roles',
    action: 'read',
    group: 'Access Control',
    label: 'View roles & user access',
    description: 'View custom roles, access attributes, and user assignments.',
  },
  {
    key: PERMISSIONS.ROLES_MANAGE,
    resource: 'roles',
    action: 'manage',
    group: 'Access Control',
    label: 'Compose & manage custom roles',
    description: 'Create, edit, and delete roles and compose access attributes.',
  },
  {
    key: PERMISSIONS.USERS_ASSIGN_ROLES,
    resource: 'users',
    action: 'assign_roles',
    group: 'Access Control',
    label: 'Assign roles to users',
    description: 'Assign or revoke composed roles for platform users.',
  },
];

export function isKnownPermissionKey(value: string): value is PermissionKey {
  return permissionKeySchema.safeParse(value).success;
}

export function hasPermission(
  effectivePermissions: readonly PermissionKey[],
  required: PermissionKey,
): boolean {
  return effectivePermissions.includes(required);
}

export function hasAnyPermission(
  effectivePermissions: readonly PermissionKey[],
  required: readonly PermissionKey[],
): boolean {
  if (required.length === 0) return true;
  return required.some((perm) => effectivePermissions.includes(perm));
}

export function hasAllPermissions(
  effectivePermissions: readonly PermissionKey[],
  required: readonly PermissionKey[],
): boolean {
  return required.every((perm) => effectivePermissions.includes(perm));
}

export function resolveEffectivePermissions(
  roles: ReadonlyArray<{ permissionKeys: readonly PermissionKey[] }>,
): PermissionKey[] {
  const unique = new Set<PermissionKey>();
  for (const role of roles) {
    for (const key of role.permissionKeys) {
      if (isKnownPermissionKey(key)) {
        unique.add(key);
      }
    }
  }
  return Array.from(unique).sort();
}

export interface NavItemDescriptor {
  id: 'dashboard' | 'admin-consultations' | 'admin-roles';
  label: string;
  href: string;
  description: string;
  requiredAny: PermissionKey[];
}

export const NAV_ITEMS: NavItemDescriptor[] = [
  {
    id: 'dashboard',
    label: 'My Consultations',
    href: '/dashboard',
    description: 'Book, reschedule, cancel, and complete consultations',
    requiredAny: [
      PERMISSIONS.CONSULTATIONS_READ_OWN,
      PERMISSIONS.CONSULTATIONS_CREATE_OWN,
    ],
  },
  {
    id: 'admin-consultations',
    label: 'All Consultations',
    href: '/admin/consultations',
    description: 'Read-only system-wide consultation directory',
    requiredAny: [PERMISSIONS.CONSULTATIONS_READ_ALL],
  },
  {
    id: 'admin-roles',
    label: 'Roles & Access',
    href: '/admin/roles',
    description: 'Compose custom roles and assign user attributes',
    requiredAny: [
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.USERS_ASSIGN_ROLES,
    ],
  },
];

export function getAccessibleNavItems(
  effectivePermissions: readonly PermissionKey[],
): NavItemDescriptor[] {
  return NAV_ITEMS.filter((item) => hasAnyPermission(effectivePermissions, item.requiredAny));
}

export function getDefaultLandingRoute(
  effectivePermissions: readonly PermissionKey[],
): string {
  const accessible = getAccessibleNavItems(effectivePermissions);
  if (accessible.length > 0) {
    return accessible[0].href;
  }
  return '/no-access';
}

export function slugifyRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
