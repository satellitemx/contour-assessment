import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { GET as adminConsultationsGet } from '@/app/api/admin/consultations/route';
import {
  DELETE as deleteRole,
  PATCH as patchRole,
} from '@/app/api/admin/roles/[id]/route';
import { GET as rolesGet, POST as rolesPost } from '@/app/api/admin/roles/route';
import { PUT as assignUserRolesPut } from '@/app/api/admin/users/[id]/roles/route';
import { GET as usersGet } from '@/app/api/admin/users/route';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { GET as ownConsultationsGet } from '@/app/api/consultations/route';
import {
  adminConsultationsResponseSchema,
  apiErrorBodySchema,
  roleMutationResponseSchema,
  userMutationResponseSchema,
  usersListResponseSchema,
} from '@/lib/contracts';
import { PERMISSIONS } from '@/lib/permissions';
import { setTestRepository } from '@/lib/repositories';
import { SEEDED_IDS } from '@/lib/repositories/memory-repository';
import { createTestRepo, jsonRequest } from './helpers';

describe('Admin & Attribute-Composed RBAC API Integration', () => {
  beforeEach(() => {
    const { repo } = createTestRepo();
    setTestRepository(repo);
  });

  afterEach(() => {
    setTestRepository(null);
  });

  test('learner cannot access admin consultations or role management endpoints', async () => {
    await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'student@example.org',
        password: 'ChangeMe123!',
      }),
    );

    const adminConsults = await adminConsultationsGet(
      new Request('http://localhost:3000/api/admin/consultations'),
    );
    expect(adminConsults.status).toBe(403);

    const rolesRes = await rolesGet();
    expect(rolesRes.status).toBe(403);
  });

  test('auditor can read all system consultations but cannot manage roles', async () => {
    await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'auditor@example.org',
        password: 'ChangeMe123!',
      }),
    );

    const adminConsults = await adminConsultationsGet(
      new Request('http://localhost:3000/api/admin/consultations?search=Maya'),
    );
    expect(adminConsults.status).toBe(200);
    const data = adminConsultationsResponseSchema.parse(await adminConsults.json());
    expect(data.consultations.length).toBe(3);
    expect(data.consultations[0].studentEmail).toBe('student@example.org');

    const createRoleAttempt = await rolesPost(
      jsonRequest('http://localhost:3000/api/admin/roles', 'POST', {
        name: 'Rogue Admin',
        permissionKeys: [PERMISSIONS.ROLES_MANAGE],
      }),
    );
    expect(createRoleAttempt.status).toBe(403);
    apiErrorBodySchema.parse(await createRoleAttempt.json());
  });

  test('super admin composes custom role, assigns to user, and user dynamically inherits exact attributes', async () => {
    await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'superadmin@example.org',
        password: 'ChangeMe123!',
      }),
    );

    // 1. Compose custom role with read:own + read:all (no roles:manage)
    const createRoleRes = await rolesPost(
      jsonRequest('http://localhost:3000/api/admin/roles', 'POST', {
        name: 'Peer Mentor Reviewer',
        description: 'View own consultations and audit system consultations',
        permissionKeys: [
          PERMISSIONS.CONSULTATIONS_READ_OWN,
          PERMISSIONS.CONSULTATIONS_READ_ALL,
        ],
      }),
    );
    expect(createRoleRes.status).toBe(201);
    const { role: customRole } = roleMutationResponseSchema.parse(await createRoleRes.json());
    expect(customRole.slug).toBe('peer-mentor-reviewer');
    expect(customRole.permissionKeys).toEqual([
      PERMISSIONS.CONSULTATIONS_READ_ALL,
      PERMISSIONS.CONSULTATIONS_READ_OWN,
    ]);

    // 2. Assign custom role to student@example.org
    const assignRes = await assignUserRolesPut(
      jsonRequest(
        `http://localhost:3000/api/admin/users/${SEEDED_IDS.users.student}/roles`,
        'PUT',
        { roleIds: [customRole.id] },
      ),
      { params: Promise.resolve({ id: SEEDED_IDS.users.student }) },
    );
    expect(assignRes.status).toBe(200);
    const { user: updatedUser } = userMutationResponseSchema.parse(await assignRes.json());
    expect(updatedUser.effectivePermissions).toEqual([
      PERMISSIONS.CONSULTATIONS_READ_ALL,
      PERMISSIONS.CONSULTATIONS_READ_OWN,
    ]);

    // 3. Log in as student@example.org and verify exact dynamic capabilities
    await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'student@example.org',
        password: 'ChangeMe123!',
      }),
    );

    const ownRes = await ownConsultationsGet(
      new Request('http://localhost:3000/api/consultations'),
    );
    expect(ownRes.status).toBe(200);

    const allRes = await adminConsultationsGet(
      new Request('http://localhost:3000/api/admin/consultations'),
    );
    expect(allRes.status).toBe(200);

    const rolesForbidden = await rolesGet();
    expect(rolesForbidden.status).toBe(403);
  });

  test('lockout prevention and protected system/default role guards', async () => {
    await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'superadmin@example.org',
        password: 'ChangeMe123!',
      }),
    );

    // Cannot delete system or default roles
    const delSystem = await deleteRole(
      new Request(`http://localhost:3000/api/admin/roles/${SEEDED_IDS.roles.superAdmin}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: SEEDED_IDS.roles.superAdmin }) },
    );
    expect(delSystem.status).toBe(409);

    const delDefault = await deleteRole(
      new Request(`http://localhost:3000/api/admin/roles/${SEEDED_IDS.roles.learner}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: SEEDED_IDS.roles.learner }) },
    );
    expect(delDefault.status).toBe(409);

    // Cannot remove the last super admin's role (prevents platform lockout)
    const lockoutUser = await assignUserRolesPut(
      jsonRequest(
        `http://localhost:3000/api/admin/users/${SEEDED_IDS.users.superAdmin}/roles`,
        'PUT',
        { roleIds: [SEEDED_IDS.roles.learner] },
      ),
      { params: Promise.resolve({ id: SEEDED_IDS.users.superAdmin }) },
    );
    expect(lockoutUser.status).toBe(409);

    // Cannot strip roles:manage from the only active super-admin role
    const lockoutRole = await patchRole(
      jsonRequest(
        `http://localhost:3000/api/admin/roles/${SEEDED_IDS.roles.superAdmin}`,
        'PATCH',
        {
          permissionKeys: [PERMISSIONS.ROLES_READ],
        },
      ),
      { params: Promise.resolve({ id: SEEDED_IDS.roles.superAdmin }) },
    );
    expect(lockoutRole.status).toBe(409);

    // Verify users endpoint works
    const usersRes = await usersGet();
    expect(usersRes.status).toBe(200);
    const { users } = usersListResponseSchema.parse(await usersRes.json());
    expect(users.length).toBeGreaterThanOrEqual(3);
  });
});
