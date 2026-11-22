import { AppError } from '@/lib/http';
import { PERMISSIONS } from '@/lib/permissions';
import type { PermissionKey } from '@/lib/types';

export interface RolePermissionEntry {
  roleId: string;
  permissionKeys: PermissionKey[];
}

export interface UserRoleAssignment {
  userId: string;
  roleIds: string[];
}

/**
 * Ensures at least one user retains `roles:manage` and at least one user retains
 * `users:assign_roles` after any role permission edit, role deletion, or user
 * role assignment change.
 */
export function assertAdminLockoutInvariant(
  rolePermissions: RolePermissionEntry[],
  userAssignments: UserRoleAssignment[],
): void {
  const permsByRole = new Map<string, Set<PermissionKey>>();
  for (const rp of rolePermissions) {
    permsByRole.set(rp.roleId, new Set(rp.permissionKeys));
  }

  let usersWithManageRoles = 0;
  let usersWithAssignRoles = 0;

  for (const assignment of userAssignments) {
    let canManageRoles = false;
    let canAssignRoles = false;

    for (const roleId of assignment.roleIds) {
      const rolePerms = permsByRole.get(roleId);
      if (!rolePerms) continue;
      if (rolePerms.has(PERMISSIONS.ROLES_MANAGE)) canManageRoles = true;
      if (rolePerms.has(PERMISSIONS.USERS_ASSIGN_ROLES)) canAssignRoles = true;
    }

    if (canManageRoles) usersWithManageRoles += 1;
    if (canAssignRoles) usersWithAssignRoles += 1;
  }

  if (usersWithManageRoles === 0 || usersWithAssignRoles === 0) {
    throw new AppError(
      409,
      'ADMIN_LOCKOUT_PREVENTED',
      'Operation rejected: at least one user must retain role management and role assignment attributes to prevent system lockout.',
    );
  }
}
