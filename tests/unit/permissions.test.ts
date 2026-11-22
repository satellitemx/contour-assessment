import { describe, expect, test } from 'bun:test';
import { AppError } from '@/lib/http';
import {
  getAccessibleNavItems,
  getDefaultLandingRoute,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  PERMISSIONS,
  resolveEffectivePermissions,
  slugifyRoleName,
} from '@/lib/permissions';
import { assertAdminLockoutInvariant } from '@/lib/repositories/lockout';

describe('Permissions & Attribute Composition Helpers', () => {
  test('hasPermission / hasAnyPermission / hasAllPermissions evaluate attributes accurately', () => {
    const perms = [
      PERMISSIONS.CONSULTATIONS_READ_OWN,
      PERMISSIONS.CONSULTATIONS_CREATE_OWN,
    ];

    expect(hasPermission(perms, PERMISSIONS.CONSULTATIONS_READ_OWN)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.CONSULTATIONS_READ_ALL)).toBe(false);

    expect(
      hasAnyPermission(perms, [
        PERMISSIONS.CONSULTATIONS_READ_ALL,
        PERMISSIONS.CONSULTATIONS_CREATE_OWN,
      ]),
    ).toBe(true);
    expect(
      hasAnyPermission(perms, [
        PERMISSIONS.ROLES_MANAGE,
        PERMISSIONS.CONSULTATIONS_READ_ALL,
      ]),
    ).toBe(false);
    expect(hasAnyPermission(perms, [])).toBe(true);

    expect(
      hasAllPermissions(perms, [
        PERMISSIONS.CONSULTATIONS_READ_OWN,
        PERMISSIONS.CONSULTATIONS_CREATE_OWN,
      ]),
    ).toBe(true);
    expect(
      hasAllPermissions(perms, [
        PERMISSIONS.CONSULTATIONS_READ_OWN,
        PERMISSIONS.CONSULTATIONS_UPDATE_OWN,
      ]),
    ).toBe(false);
  });

  test('resolveEffectivePermissions merges and deduplicates multi-role attributes', () => {
    const effective = resolveEffectivePermissions([
      {
        permissionKeys: [
          PERMISSIONS.CONSULTATIONS_READ_OWN,
          PERMISSIONS.CONSULTATIONS_CREATE_OWN,
        ],
      },
      {
        permissionKeys: [
          PERMISSIONS.CONSULTATIONS_READ_OWN,
          PERMISSIONS.CONSULTATIONS_READ_ALL,
        ],
      },
    ]);

    expect(effective).toEqual([
      PERMISSIONS.CONSULTATIONS_CREATE_OWN,
      PERMISSIONS.CONSULTATIONS_READ_ALL,
      PERMISSIONS.CONSULTATIONS_READ_OWN,
    ]);
  });

  test('nav items and default landing route derive strictly from composed attributes', () => {
    expect(
      getAccessibleNavItems([PERMISSIONS.CONSULTATIONS_READ_ALL]).map((n) => n.id),
    ).toEqual(['admin-consultations']);
    expect(getDefaultLandingRoute([PERMISSIONS.CONSULTATIONS_READ_ALL])).toBe(
      '/admin/consultations',
    );

    expect(
      getAccessibleNavItems([
        PERMISSIONS.CONSULTATIONS_READ_OWN,
        PERMISSIONS.ROLES_READ,
      ]).map((n) => n.id),
    ).toEqual(['dashboard', 'admin-roles']);
    expect(
      getDefaultLandingRoute([
        PERMISSIONS.CONSULTATIONS_READ_OWN,
        PERMISSIONS.ROLES_READ,
      ]),
    ).toBe('/dashboard');

    expect(getDefaultLandingRoute([])).toBe('/no-access');
  });

  test('slugifyRoleName normalizes display names into lowercase slugs', () => {
    expect(slugifyRoleName('  Teaching Assistant (Lead)  ')).toBe(
      'teaching-assistant-lead',
    );
    expect(slugifyRoleName('Peer_Mentor 2026!')).toBe('peer-mentor-2026');
  });

  test('assertAdminLockoutInvariant blocks removing last role manager or user assigner', () => {
    const rolePerms = [
      {
        roleId: 'role-admin',
        permissionKeys: [PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_ASSIGN_ROLES],
      },
      {
        roleId: 'role-learner',
        permissionKeys: [PERMISSIONS.CONSULTATIONS_READ_OWN],
      },
    ];

    expect(() =>
      assertAdminLockoutInvariant(rolePerms, [
        { userId: 'u1', roleIds: ['role-admin'] },
        { userId: 'u2', roleIds: ['role-learner'] },
      ]),
    ).not.toThrow();

    expect(() =>
      assertAdminLockoutInvariant(rolePerms, [
        { userId: 'u1', roleIds: ['role-learner'] },
        { userId: 'u2', roleIds: ['role-learner'] },
      ]),
    ).toThrow(AppError);

    expect(() =>
      assertAdminLockoutInvariant(
        [
          {
            roleId: 'role-admin',
            permissionKeys: [PERMISSIONS.ROLES_MANAGE],
          },
        ],
        [{ userId: 'u1', roleIds: ['role-admin'] }],
      ),
    ).toThrow(AppError);
  });
});
