import { createHash, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '@/lib/http';
import {
  PERMISSION_CATALOG,
  PERMISSIONS,
  resolveEffectivePermissions,
} from '@/lib/permissions';
import type {
  AdminConsultation,
  AuthUserContext,
  Consultation,
  ConsultationStats,
  ConsultationStatus,
  Locale,
  PaginatedConsultationsResult,
  PermissionKey,
  RoleSummary,
  UserProfile,
  UserWithRoles,
} from '@/lib/types';
import {
  validateConsultationTransition,
  type AssignUserRolesInput,
  type ConsultationQueryInput,
  type CreateConsultationInput,
  type CreateRoleInput,
  type LoginInput,
  type SignupInput,
  type UpdateConsultationInput,
  type UpdateRoleInput,
  type UpdateUserSettingsInput,
} from '@/lib/validation';
import {
  assertAdminLockoutInvariant,
  type RolePermissionEntry,
  type UserRoleAssignment,
} from './lockout';
import type { ConsultationListResult, LmsRepository, SignupResult } from './types';

export const E2E_SESSION_COOKIE_NAME = 'contour_e2e_session';

export interface SessionAdapter {
  getSessionToken(): Promise<string | null>;
  setSessionToken(token: string | null): Promise<void>;
}

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  preferredLocale: Locale;
  createdAt: string;
  updatedAt: string;
}

interface StoredRole {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  isDefault: boolean;
  permissionKeys: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}

interface StoredUserRole {
  userId: string;
  roleId: string;
}

interface StoredSession {
  token: string;
  userId: string;
}

export interface MemoryStoreSnapshot {
  users: StoredUser[];
  roles: StoredRole[];
  userRoles: StoredUserRole[];
  consultations: Consultation[];
  sessions: StoredSession[];
}

function hashPassword(password: string): string {
  const salt = 'contour-lms-salt-v1';
  return scryptSync(password, salt, 32).toString('hex');
}

function verifyPassword(password: string, storedHash: string): boolean {
  const computed = Buffer.from(hashPassword(password), 'hex');
  const existing = Buffer.from(storedHash, 'hex');
  if (computed.length !== existing.length) return false;
  return timingSafeEqual(computed, existing);
}

function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

export const SEEDED_IDS = {
  roles: {
    learner: deterministicUuid('role:learner'),
    auditor: deterministicUuid('role:consultation-auditor'),
    superAdmin: deterministicUuid('role:super-admin'),
  },
  users: {
    student: deterministicUuid('user:student@example.org'),
    auditor: deterministicUuid('user:auditor@example.org'),
    superAdmin: deterministicUuid('user:superadmin@example.org'),
  },
  consultations: {
    c1: deterministicUuid('consultation:1'),
    c2: deterministicUuid('consultation:2'),
    c3: deterministicUuid('consultation:3'),
  },
};

export function createSeededSnapshot(): MemoryStoreSnapshot {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const nowIso = new Date(now).toISOString();
  const defaultPasswordHash = hashPassword('ChangeMe123!');

  const roles: StoredRole[] = [
    {
      id: SEEDED_IDS.roles.learner,
      slug: 'learner',
      name: 'Learner',
      description:
        'Default role assigned to newly signed-up users with self-service consultation access.',
      isSystem: false,
      isDefault: true,
      permissionKeys: [
        PERMISSIONS.CONSULTATIONS_READ_OWN,
        PERMISSIONS.CONSULTATIONS_CREATE_OWN,
        PERMISSIONS.CONSULTATIONS_UPDATE_OWN,
        PERMISSIONS.CONSULTATIONS_CANCEL_OWN,
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: SEEDED_IDS.roles.auditor,
      slug: 'consultation-auditor',
      name: 'Consultation Auditor',
      description:
        'Read-only reviewer role able to inspect consultations across the entire system.',
      isSystem: false,
      isDefault: false,
      permissionKeys: [PERMISSIONS.CONSULTATIONS_READ_ALL],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: SEEDED_IDS.roles.superAdmin,
      slug: 'super-admin',
      name: 'Platform Super Admin',
      description:
        'System bootstrap role with full consultation visibility and custom role composition privileges.',
      isSystem: true,
      isDefault: false,
      permissionKeys: PERMISSION_CATALOG.map((p) => p.key),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const users: StoredUser[] = [
    {
      id: SEEDED_IDS.users.student,
      email: 'student@example.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Maya',
      lastName: 'Lin',
      preferredLocale: 'en',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: SEEDED_IDS.users.auditor,
      email: 'auditor@example.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Jordan',
      lastName: 'Patel',
      preferredLocale: 'en',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: SEEDED_IDS.users.superAdmin,
      email: 'superadmin@example.org',
      passwordHash: defaultPasswordHash,
      firstName: 'Elena',
      lastName: 'Vance',
      preferredLocale: 'en',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const userRoles: StoredUserRole[] = [
    { userId: SEEDED_IDS.users.student, roleId: SEEDED_IDS.roles.learner },
    { userId: SEEDED_IDS.users.auditor, roleId: SEEDED_IDS.roles.auditor },
    { userId: SEEDED_IDS.users.superAdmin, roleId: SEEDED_IDS.roles.superAdmin },
  ];

  const consultations: Consultation[] = [
    {
      id: SEEDED_IDS.consultations.c1,
      studentId: SEEDED_IDS.users.student,
      firstName: 'Maya',
      lastName: 'Lin',
      reason: 'Thesis architecture review and milestone check-in',
      startsAt: new Date(now + 2 * day).toISOString(),
      endsAt: new Date(now + 2 * day + hour).toISOString(),
      status: 'scheduled',
      completedAt: null,
      cancelledAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: SEEDED_IDS.consultations.c2,
      studentId: SEEDED_IDS.users.student,
      firstName: 'Maya',
      lastName: 'Lin',
      reason: 'Algorithms module dynamic programming walkthrough',
      startsAt: new Date(now - 3 * day).toISOString(),
      endsAt: new Date(now - 3 * day + 45 * 60 * 1000).toISOString(),
      status: 'completed',
      completedAt: new Date(now - 3 * day + hour).toISOString(),
      cancelledAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: SEEDED_IDS.consultations.c3,
      studentId: SEEDED_IDS.users.student,
      firstName: 'Maya',
      lastName: 'Lin',
      reason: 'Rescheduled portfolio feedback session',
      startsAt: new Date(now + 5 * day).toISOString(),
      endsAt: new Date(now + 5 * day + 30 * 60 * 1000).toISOString(),
      status: 'cancelled',
      completedAt: null,
      cancelledAt: new Date(now - hour).toISOString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  return {
    users,
    roles,
    userRoles,
    consultations,
    sessions: [],
  };
}

function computeStats(rows: ReadonlyArray<{ status: ConsultationStatus }>): ConsultationStats {
  const stats: ConsultationStats = {
    total: rows.length,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    if (row.status === 'scheduled') stats.scheduled += 1;
    else if (row.status === 'completed') stats.completed += 1;
    else if (row.status === 'cancelled') stats.cancelled += 1;
  }
  return stats;
}

export class InMemorySessionAdapter implements SessionAdapter {
  private token: string | null = null;

  async getSessionToken(): Promise<string | null> {
    return this.token;
  }

  async setSessionToken(token: string | null): Promise<void> {
    this.token = token;
  }
}

export class MemoryRepository implements LmsRepository {
  private inMemorySnapshot: MemoryStoreSnapshot;
  private readonly persistenceFile?: string;
  private readonly sessionAdapter: SessionAdapter;

  constructor(options?: {
    persistenceFile?: string;
    sessionAdapter?: SessionAdapter;
    initialSnapshot?: MemoryStoreSnapshot;
  }) {
    this.persistenceFile = options?.persistenceFile;
    this.sessionAdapter = options?.sessionAdapter ?? new InMemorySessionAdapter();
    this.inMemorySnapshot = options?.initialSnapshot ?? createSeededSnapshot();

    if (this.persistenceFile && !fs.existsSync(this.persistenceFile)) {
      this.writeSnapshot(this.inMemorySnapshot);
    }
  }

  private readSnapshot(): MemoryStoreSnapshot {
    if (!this.persistenceFile) {
      return this.inMemorySnapshot;
    }
    try {
      const raw = fs.readFileSync(this.persistenceFile, 'utf8');
      return JSON.parse(raw) as MemoryStoreSnapshot;
    } catch {
      const fresh = createSeededSnapshot();
      this.writeSnapshot(fresh);
      return fresh;
    }
  }

  private writeSnapshot(snapshot: MemoryStoreSnapshot): void {
    this.inMemorySnapshot = snapshot;
    if (this.persistenceFile) {
      fs.mkdirSync(path.dirname(this.persistenceFile), { recursive: true });
      const tmpPath = `${this.persistenceFile}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.persistenceFile);
    }
  }

  reset(): void {
    this.writeSnapshot(createSeededSnapshot());
  }

  hasValidSessionToken(token: string | undefined | null): boolean {
    if (!token) return false;
    const snap = this.readSnapshot();
    const session = snap.sessions.find((s) => s.token === token);
    if (!session) return false;
    return snap.users.some((u) => u.id === session.userId);
  }

  private toUserProfile(u: StoredUser): UserProfile {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      preferredLocale: u.preferredLocale ?? 'en',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  private buildAuthContext(snap: MemoryStoreSnapshot, user: StoredUser): AuthUserContext {
    const assignedIds = snap.userRoles
      .filter((ur) => ur.userId === user.id)
      .map((ur) => ur.roleId);
    const roles = snap.roles
      .filter((r) => assignedIds.includes(r.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        isDefault: r.isDefault,
        permissionKeys: [...r.permissionKeys].sort(),
      }));

    return {
      user: this.toUserProfile(user),
      roles,
      effectivePermissions: resolveEffectivePermissions(roles),
    };
  }

  private toLockoutInput(snap: MemoryStoreSnapshot): {
    rolePermissions: RolePermissionEntry[];
    userAssignments: UserRoleAssignment[];
  } {
    const rolePermissions: RolePermissionEntry[] = snap.roles.map((r) => ({
      roleId: r.id,
      permissionKeys: r.permissionKeys,
    }));

    const userAssignments: UserRoleAssignment[] = snap.users.map((u) => ({
      userId: u.id,
      roleIds: snap.userRoles.filter((ur) => ur.userId === u.id).map((ur) => ur.roleId),
    }));

    return { rolePermissions, userAssignments };
  }

  async signup(input: SignupInput): Promise<SignupResult> {
    const snap = this.readSnapshot();
    const normalizedEmail = input.email.trim().toLowerCase();

    if (snap.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    const nowIso = new Date().toISOString();
    const newUser: StoredUser = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: hashPassword(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      preferredLocale: input.preferredLocale ?? 'en',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    snap.users.push(newUser);

    const defaultRole = snap.roles.find((r) => r.isDefault);
    if (defaultRole) {
      snap.userRoles.push({ userId: newUser.id, roleId: defaultRole.id });
    }

    const token = randomUUID();
    snap.sessions.push({ token, userId: newUser.id });
    this.writeSnapshot(snap);
    await this.sessionAdapter.setSessionToken(token);

    return {
      user: this.buildAuthContext(snap, newUser),
      requiresEmailConfirmation: false,
    };
  }

  async login(input: LoginInput): Promise<AuthUserContext> {
    const snap = this.readSnapshot();
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = snap.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const token = randomUUID();
    snap.sessions.push({ token, userId: user.id });
    this.writeSnapshot(snap);
    await this.sessionAdapter.setSessionToken(token);

    return this.buildAuthContext(snap, user);
  }

  async logout(): Promise<void> {
    const token = await this.sessionAdapter.getSessionToken();
    if (token) {
      const snap = this.readSnapshot();
      snap.sessions = snap.sessions.filter((s) => s.token !== token);
      this.writeSnapshot(snap);
    }
    await this.sessionAdapter.setSessionToken(null);
  }

  async getCurrentUser(): Promise<AuthUserContext | null> {
    const token = await this.sessionAdapter.getSessionToken();
    if (!token) return null;

    const snap = this.readSnapshot();
    const session = snap.sessions.find((s) => s.token === token);
    if (!session) return null;

    const user = snap.users.find((u) => u.id === session.userId);
    if (!user) return null;

    return this.buildAuthContext(snap, user);
  }

  async listOwnConsultations(
    studentId: string,
    filters: { status: 'all' | 'scheduled' | 'completed' | 'cancelled'; search: string },
  ): Promise<ConsultationListResult> {
    const snap = this.readSnapshot();
    const own = snap.consultations
      .filter((c) => c.studentId === studentId)
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));

    const stats = computeStats(own);
    const searchLower = filters.search.trim().toLowerCase();

    const filtered = own.filter((item) => {
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (searchLower) {
        const haystack = `${item.firstName} ${item.lastName} ${item.reason}`.toLowerCase();
        return haystack.includes(searchLower);
      }
      return true;
    });

    return {
      consultations: filtered,
      stats,
    };
  }

  async createConsultation(
    studentId: string,
    input: CreateConsultationInput,
  ): Promise<Consultation> {
    const snap = this.readSnapshot();
    const nowIso = new Date().toISOString();

    const created: Consultation = {
      id: randomUUID(),
      studentId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      reason: input.reason.trim(),
      startsAt: new Date(input.startsAt).toISOString(),
      endsAt: new Date(input.endsAt).toISOString(),
      status: 'scheduled',
      completedAt: null,
      cancelledAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    snap.consultations.push(created);
    this.writeSnapshot(snap);
    return created;
  }

  async updateOwnConsultation(
    studentId: string,
    consultationId: string,
    input: UpdateConsultationInput,
  ): Promise<Consultation> {
    const snap = this.readSnapshot();
    const index = snap.consultations.findIndex(
      (c) => c.id === consultationId && c.studentId === studentId,
    );

    if (index === -1) {
      throw new AppError(404, 'CONSULTATION_NOT_FOUND', 'Consultation not found.');
    }

    const existing = snap.consultations[index];
    const transition = validateConsultationTransition(existing, input);
    if (!transition.valid) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', transition.reason!);
    }

    const nowIso = new Date().toISOString();
    const updated: Consultation = { ...existing, updatedAt: nowIso };

    if (input.action === 'toggle_complete') {
      updated.status = input.completed ? 'completed' : 'scheduled';
      updated.completedAt = input.completed ? nowIso : null;
    } else if (input.action === 'reschedule') {
      updated.startsAt = new Date(input.startsAt).toISOString();
      updated.endsAt = new Date(input.endsAt).toISOString();
    } else if (input.action === 'cancel') {
      updated.status = 'cancelled';
      updated.cancelledAt = nowIso;
    }

    snap.consultations[index] = updated;
    this.writeSnapshot(snap);
    return updated;
  }

  async listAllConsultations(
    query: ConsultationQueryInput,
  ): Promise<PaginatedConsultationsResult> {
    const snap = this.readSnapshot();
    const userById = new Map(snap.users.map((u) => [u.id, u]));

    const allSorted: AdminConsultation[] = [...snap.consultations]
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
      .map((c) => {
        const owner = userById.get(c.studentId);
        const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.trim() : '';
        return {
          ...c,
          studentEmail: owner?.email ?? '',
          studentProfileName: ownerName || `${c.firstName} ${c.lastName}`.trim(),
        };
      });

    const stats = computeStats(allSorted);
    const searchLower = query.search.trim().toLowerCase();

    const filtered = allSorted.filter((item) => {
      if (query.status !== 'all' && item.status !== query.status) return false;
      if (searchLower) {
        const haystack =
          `${item.firstName} ${item.lastName} ${item.reason} ${item.studentEmail} ${item.studentProfileName}`.toLowerCase();
        return haystack.includes(searchLower);
      }
      return true;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
    const offset = (query.page - 1) * query.pageSize;
    const paged = filtered.slice(offset, offset + query.pageSize);

    return {
      consultations: paged,
      stats,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async listRoles(): Promise<RoleSummary[]> {
    const snap = this.readSnapshot();
    return [...snap.roles]
      .sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        isDefault: r.isDefault,
        permissionKeys: [...r.permissionKeys].sort(),
        userCount: snap.userRoles.filter((ur) => ur.roleId === r.id).length,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
  }

  async createRole(input: CreateRoleInput): Promise<RoleSummary> {
    const snap = this.readSnapshot();
    if (snap.roles.some((r) => r.slug === input.slug)) {
      throw new AppError(409, 'ROLE_SLUG_EXISTS', `A role with slug "${input.slug}" already exists.`);
    }

    if (input.isDefault) {
      for (const r of snap.roles) {
        r.isDefault = false;
      }
    }

    const nowIso = new Date().toISOString();
    const role: StoredRole = {
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      description: input.description,
      isSystem: false,
      isDefault: input.isDefault,
      permissionKeys: [...input.permissionKeys].sort(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    snap.roles.push(role);
    this.writeSnapshot(snap);

    return {
      ...role,
      userCount: 0,
    };
  }

  async updateRole(roleId: string, input: UpdateRoleInput): Promise<RoleSummary> {
    const snap = this.readSnapshot();
    const role = snap.roles.find((r) => r.id === roleId);
    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found.');
    }

    if (input.permissionKeys) {
      const graph = this.toLockoutInput(snap);
      const nextRolePerms = graph.rolePermissions.map((rp) =>
        rp.roleId === roleId ? { roleId, permissionKeys: input.permissionKeys! } : rp,
      );
      assertAdminLockoutInvariant(nextRolePerms, graph.userAssignments);
      role.permissionKeys = [...input.permissionKeys].sort();
    }

    if (input.isDefault === true) {
      for (const r of snap.roles) {
        r.isDefault = r.id === roleId;
      }
    } else if (input.isDefault === false) {
      role.isDefault = false;
    }

    if (input.name !== undefined) role.name = input.name;
    if (input.description !== undefined) role.description = input.description;
    role.updatedAt = new Date().toISOString();

    this.writeSnapshot(snap);

    return {
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isDefault: role.isDefault,
      permissionKeys: [...role.permissionKeys].sort(),
      userCount: snap.userRoles.filter((ur) => ur.roleId === role.id).length,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async deleteRole(roleId: string): Promise<void> {
    const snap = this.readSnapshot();
    const role = snap.roles.find((r) => r.id === roleId);
    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found.');
    }
    if (role.isSystem) {
      throw new AppError(409, 'SYSTEM_ROLE_PROTECTED', 'System bootstrap roles cannot be deleted.');
    }
    if (role.isDefault) {
      throw new AppError(
        409,
        'DEFAULT_ROLE_PROTECTED',
        'Default sign-up role cannot be deleted. Assign another default role first.',
      );
    }

    const graph = this.toLockoutInput(snap);
    const nextRolePerms = graph.rolePermissions.filter((rp) => rp.roleId !== roleId);
    const nextAssignments = graph.userAssignments.map((ua) => ({
      userId: ua.userId,
      roleIds: ua.roleIds.filter((id) => id !== roleId),
    }));
    assertAdminLockoutInvariant(nextRolePerms, nextAssignments);

    snap.roles = snap.roles.filter((r) => r.id !== roleId);
    snap.userRoles = snap.userRoles.filter((ur) => ur.roleId !== roleId);
    this.writeSnapshot(snap);
  }

  async listUsers(): Promise<UserWithRoles[]> {
    const snap = this.readSnapshot();
    const roleById = new Map(snap.roles.map((r) => [r.id, r]));

    return snap.users.map((u) => {
      const assignedRoles = snap.userRoles
        .filter((ur) => ur.userId === u.id)
        .map((ur) => roleById.get(ur.roleId))
        .filter((r): r is StoredRole => Boolean(r))
        .map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          permissionKeys: [...r.permissionKeys].sort(),
        }));

      return {
        ...this.toUserProfile(u),
        roles: assignedRoles,
        effectivePermissions: resolveEffectivePermissions(assignedRoles),
      };
    });
  }

  async assignUserRoles(
    targetUserId: string,
    input: AssignUserRolesInput,
  ): Promise<UserWithRoles> {
    const snap = this.readSnapshot();
    const targetUser = snap.users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const uniqueRoleIds = Array.from(new Set(input.roleIds));
    for (const roleId of uniqueRoleIds) {
      if (!snap.roles.some((r) => r.id === roleId)) {
        throw new AppError(400, 'UNKNOWN_ROLE', 'One or more selected roles do not exist.');
      }
    }

    const graph = this.toLockoutInput(snap);
    const nextAssignments = graph.userAssignments.map((ua) =>
      ua.userId === targetUserId ? { userId: targetUserId, roleIds: uniqueRoleIds } : ua,
    );
    assertAdminLockoutInvariant(graph.rolePermissions, nextAssignments);

    snap.userRoles = snap.userRoles.filter((ur) => ur.userId !== targetUserId);
    for (const roleId of uniqueRoleIds) {
      snap.userRoles.push({ userId: targetUserId, roleId });
    }
    this.writeSnapshot(snap);

    const updatedUsers = await this.listUsers();
    const found = updatedUsers.find((u) => u.id === targetUserId);
    if (!found) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found after update.');
    }
    return found;
  }

  async updateUserSettings(
    userId: string,
    input: UpdateUserSettingsInput,
  ): Promise<UserProfile> {
    const snap = this.readSnapshot();
    const user = snap.users.find((u) => u.id === userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    user.preferredLocale = input.preferredLocale;
    user.updatedAt = new Date().toISOString();
    this.writeSnapshot(snap);
    return this.toUserProfile(user);
  }
}
