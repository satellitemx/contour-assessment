import { AppError } from '@/lib/http';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n';
import { isKnownPermissionKey, resolveEffectivePermissions } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  AdminConsultation,
  AuthUserContext,
  Consultation,
  ConsultationStats,
  ConsultationStatus,
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

interface DbProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  preferred_locale?: string | null;
  created_at: string;
  updated_at: string;
}

interface DbRoleRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_system: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface DbConsultationRow {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  reason: string;
  starts_at: string;
  ends_at: string;
  status: ConsultationStatus;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapConsultation(row: DbConsultationRow): Consultation {
  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name,
    lastName: row.last_name,
    reason: row.reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

function sanitizePostgrestSearch(raw: string): string {
  return raw.replace(/[,()*%]/g, ' ').trim();
}

export class SupabaseRepository implements LmsRepository {
  private async loadAuthContextForUser(
    userId: string,
    fallbackEmail = '',
    fallbackMeta?: Record<string, unknown>,
  ): Promise<AuthUserContext> {
    const supabase = await createSupabaseServerClient();

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, preferred_locale, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      throw new AppError(500, 'PROFILE_FETCH_FAILED', profileErr.message);
    }

    const { data: userRoleRows, error: urErr } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId);

    if (urErr) {
      throw new AppError(500, 'USER_ROLES_FETCH_FAILED', urErr.message);
    }

    const roleIds = (userRoleRows ?? []).map((row) => row.role_id as string);
    let roles: AuthUserContext['roles'] = [];

    if (roleIds.length > 0) {
      const { data: roleRows, error: rolesErr } = await supabase
        .from('roles')
        .select('id, slug, name, description, is_system, is_default')
        .in('id', roleIds)
        .order('name');

      if (rolesErr) {
        throw new AppError(500, 'ROLES_FETCH_FAILED', rolesErr.message);
      }

      const { data: rpRows, error: rpErr } = await supabase
        .from('role_permissions')
        .select('role_id, permissions(key)')
        .in('role_id', roleIds);

      if (rpErr) {
        throw new AppError(500, 'ROLE_PERMS_FETCH_FAILED', rpErr.message);
      }

      const permsByRole = new Map<string, PermissionKey[]>();
      for (const row of rpRows ?? []) {
        const roleId = row.role_id as string;
        const permObj = Array.isArray(row.permissions)
          ? row.permissions[0]
          : row.permissions;
        const key = (permObj as { key?: string } | null)?.key;
        if (key && isKnownPermissionKey(key)) {
          const existing = permsByRole.get(roleId) ?? [];
          existing.push(key);
          permsByRole.set(roleId, existing);
        }
      }

      roles = (roleRows ?? []).map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        name: r.name as string,
        description: (r.description as string) ?? '',
        isSystem: Boolean(r.is_system),
        isDefault: Boolean(r.is_default),
        permissionKeys: (permsByRole.get(r.id as string) ?? []).sort(),
      }));
    }

    const nowIso = new Date().toISOString();
    const typedProfile = profile as DbProfileRow | null;
    const firstName =
      typedProfile?.first_name ??
      (typeof fallbackMeta?.first_name === 'string' ? fallbackMeta.first_name : '');
    const lastName =
      typedProfile?.last_name ??
      (typeof fallbackMeta?.last_name === 'string' ? fallbackMeta.last_name : '');

    const preferredLocale =
      normalizeLocale(typedProfile?.preferred_locale) ??
      normalizeLocale(
        typeof fallbackMeta?.preferred_locale === 'string'
          ? fallbackMeta.preferred_locale
          : null,
      ) ??
      DEFAULT_LOCALE;

    return {
      user: {
        id: userId,
        email: typedProfile?.email ?? fallbackEmail,
        firstName,
        lastName,
        preferredLocale,
        createdAt: typedProfile?.created_at ?? nowIso,
        updatedAt: typedProfile?.updated_at ?? nowIso,
      },
      roles,
      effectivePermissions: resolveEffectivePermissions(roles),
    };
  }

  private async loadLockoutGraph(): Promise<{
    rolePermissions: RolePermissionEntry[];
    userAssignments: UserRoleAssignment[];
  }> {
    const supabase = await createSupabaseServerClient();

    const [{ data: rpRows, error: rpErr }, { data: urRows, error: urErr }] =
      await Promise.all([
        supabase.from('role_permissions').select('role_id, permissions(key)'),
        supabase.from('user_roles').select('user_id, role_id'),
      ]);

    if (rpErr) throw new AppError(500, 'LOCKOUT_CHECK_FAILED', rpErr.message);
    if (urErr) throw new AppError(500, 'LOCKOUT_CHECK_FAILED', urErr.message);

    const permsMap = new Map<string, PermissionKey[]>();
    for (const row of rpRows ?? []) {
      const roleId = row.role_id as string;
      const permObj = Array.isArray(row.permissions) ? row.permissions[0] : row.permissions;
      const key = (permObj as { key?: string } | null)?.key;
      if (key && isKnownPermissionKey(key)) {
        const list = permsMap.get(roleId) ?? [];
        list.push(key);
        permsMap.set(roleId, list);
      }
    }

    const userMap = new Map<string, string[]>();
    for (const row of urRows ?? []) {
      const userId = row.user_id as string;
      const roleId = row.role_id as string;
      const list = userMap.get(userId) ?? [];
      list.push(roleId);
      userMap.set(userId, list);
    }

    return {
      rolePermissions: Array.from(permsMap.entries()).map(([roleId, permissionKeys]) => ({
        roleId,
        permissionKeys,
      })),
      userAssignments: Array.from(userMap.entries()).map(([userId, roleIds]) => ({
        userId,
        roleIds,
      })),
    };
  }

  async signup(input: SignupInput & { emailRedirectTo?: string }): Promise<SignupResult> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: input.emailRedirectTo,
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          preferred_locale: input.preferredLocale ?? DEFAULT_LOCALE,
        },
      },
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes('already') || lower.includes('registered')) {
        throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
      }
      throw new AppError(400, 'SIGNUP_FAILED', error.message);
    }

    if (!data.user) {
      throw new AppError(500, 'SIGNUP_FAILED', 'User account could not be created.');
    }

    // Supabase returns empty identities when email confirmation is on and email already exists
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    if (!data.session) {
      return {
        user: null,
        requiresEmailConfirmation: true,
      };
    }

    const authContext = await this.loadAuthContextForUser(
      data.user.id,
      data.user.email ?? input.email,
      data.user.user_metadata,
    );

    return {
      user: authContext,
      requiresEmailConfirmation: false,
    };
  }

  async login(input: LoginInput): Promise<AuthUserContext> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    return this.loadAuthContextForUser(
      data.user.id,
      data.user.email ?? input.email,
      data.user.user_metadata,
    );
  }

  async logout(): Promise<void> {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new AppError(500, 'LOGOUT_FAILED', error.message);
    }
  }

  async exchangeAuthCode(code: string): Promise<void> {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new AppError(400, 'AUTH_CALLBACK_FAILED', error.message);
    }
  }

  async getCurrentUser(): Promise<AuthUserContext | null> {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return this.loadAuthContextForUser(user.id, user.email ?? '', user.user_metadata);
  }

  async listOwnConsultations(
    studentId: string,
    filters: { status: 'all' | 'scheduled' | 'completed' | 'cancelled'; search: string },
  ): Promise<ConsultationListResult> {
    const supabase = await createSupabaseServerClient();

    const { data: allRows, error } = await supabase
      .from('consultations')
      .select(
        'id, student_id, first_name, last_name, reason, starts_at, ends_at, status, completed_at, cancelled_at, created_at, updated_at',
      )
      .eq('student_id', studentId)
      .order('starts_at', { ascending: false });

    if (error) {
      throw new AppError(500, 'CONSULTATIONS_FETCH_FAILED', error.message);
    }

    const typed = (allRows ?? []) as DbConsultationRow[];
    const stats = computeStats(typed);
    const searchLower = filters.search.trim().toLowerCase();

    const filtered = typed.filter((row) => {
      if (filters.status !== 'all' && row.status !== filters.status) {
        return false;
      }
      if (searchLower) {
        const haystack = `${row.first_name} ${row.last_name} ${row.reason}`.toLowerCase();
        return haystack.includes(searchLower);
      }
      return true;
    });

    return {
      consultations: filtered.map(mapConsultation),
      stats,
    };
  }

  async createConsultation(
    studentId: string,
    input: CreateConsultationInput,
  ): Promise<Consultation> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('consultations')
      .insert({
        student_id: studentId,
        first_name: input.firstName,
        last_name: input.lastName,
        reason: input.reason,
        starts_at: new Date(input.startsAt).toISOString(),
        ends_at: new Date(input.endsAt).toISOString(),
        status: 'scheduled',
      })
      .select(
        'id, student_id, first_name, last_name, reason, starts_at, ends_at, status, completed_at, cancelled_at, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      throw new AppError(400, 'CONSULTATION_CREATE_FAILED', error?.message || 'Unable to create consultation.');
    }

    return mapConsultation(data as DbConsultationRow);
  }

  async updateOwnConsultation(
    studentId: string,
    consultationId: string,
    input: UpdateConsultationInput,
  ): Promise<Consultation> {
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('consultations')
      .select(
        'id, student_id, first_name, last_name, reason, starts_at, ends_at, status, completed_at, cancelled_at, created_at, updated_at',
      )
      .eq('id', consultationId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchErr) {
      throw new AppError(500, 'CONSULTATION_FETCH_FAILED', fetchErr.message);
    }

    if (!existing) {
      throw new AppError(404, 'CONSULTATION_NOT_FOUND', 'Consultation not found.');
    }

    const mappedExisting = mapConsultation(existing as DbConsultationRow);
    const transition = validateConsultationTransition(mappedExisting, input);
    if (!transition.valid) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION', transition.reason!);
    }

    let updatePatch: Record<string, unknown> = {};
    const nowIso = new Date().toISOString();

    if (input.action === 'toggle_complete') {
      updatePatch = input.completed
        ? { status: 'completed', completed_at: nowIso }
        : { status: 'scheduled', completed_at: null };
    } else if (input.action === 'reschedule') {
      updatePatch = {
        starts_at: new Date(input.startsAt).toISOString(),
        ends_at: new Date(input.endsAt).toISOString(),
      };
    } else if (input.action === 'cancel') {
      updatePatch = {
        status: 'cancelled',
        cancelled_at: nowIso,
      };
    }

    const { data: updated, error: updateErr } = await supabase
      .from('consultations')
      .update(updatePatch)
      .eq('id', consultationId)
      .eq('student_id', studentId)
      .select(
        'id, student_id, first_name, last_name, reason, starts_at, ends_at, status, completed_at, cancelled_at, created_at, updated_at',
      )
      .single();

    if (updateErr || !updated) {
      throw new AppError(400, 'CONSULTATION_UPDATE_FAILED', updateErr?.message || 'Unable to update consultation.');
    }

    return mapConsultation(updated as DbConsultationRow);
  }

  async listAllConsultations(
    query: ConsultationQueryInput,
  ): Promise<PaginatedConsultationsResult> {
    const supabase = await createSupabaseServerClient();

    const { data: statusRows, error: statsErr } = await supabase
      .from('consultations')
      .select('status');

    if (statsErr) {
      throw new AppError(500, 'CONSULTATIONS_STATS_FAILED', statsErr.message);
    }

    const stats = computeStats(
      (statusRows ?? []) as Array<{ status: ConsultationStatus }>,
    );

    const cleanSearch = sanitizePostgrestSearch(query.search);
    let matchingStudentIds: string[] = [];

    if (cleanSearch) {
      const { data: matchingProfiles } = await supabase
        .from('profiles')
        .select('id')
        .or(
          `email.ilike.%${cleanSearch}%,first_name.ilike.%${cleanSearch}%,last_name.ilike.%${cleanSearch}%`,
        )
        .limit(100);

      matchingStudentIds = (matchingProfiles ?? []).map((p) => p.id as string);
    }

    let dbQuery = supabase
      .from('consultations')
      .select(
        'id, student_id, first_name, last_name, reason, starts_at, ends_at, status, completed_at, cancelled_at, created_at, updated_at, profiles(email, first_name, last_name)',
        { count: 'exact' },
      )
      .order('starts_at', { ascending: false });

    if (query.status !== 'all') {
      dbQuery = dbQuery.eq('status', query.status);
    }

    if (cleanSearch) {
      const clauses = [
        `first_name.ilike.%${cleanSearch}%`,
        `last_name.ilike.%${cleanSearch}%`,
        `reason.ilike.%${cleanSearch}%`,
      ];
      if (matchingStudentIds.length > 0) {
        clauses.push(`student_id.in.(${matchingStudentIds.join(',')})`);
      }
      dbQuery = dbQuery.or(clauses.join(','));
    }

    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const { data: rows, count, error: listErr } = await dbQuery.range(from, to);

    if (listErr) {
      throw new AppError(500, 'ADMIN_CONSULTATIONS_FETCH_FAILED', listErr.message);
    }

    const totalItems = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

    const consultations: AdminConsultation[] = (rows ?? []).map((row) => {
      const base = mapConsultation(row as unknown as DbConsultationRow);
      const profileRel = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const profileObj = profileRel as
        | { email?: string; first_name?: string; last_name?: string }
        | null
        | undefined;
      const fullName = [profileObj?.first_name, profileObj?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      return {
        ...base,
        studentEmail: profileObj?.email ?? '',
        studentProfileName: fullName || `${base.firstName} ${base.lastName}`.trim(),
      };
    });

    return {
      consultations,
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
    const supabase = await createSupabaseServerClient();

    const [
      { data: roleRows, error: rolesErr },
      { data: rpRows, error: rpErr },
      { data: urRows, error: urErr },
    ] = await Promise.all([
      supabase
        .from('roles')
        .select('id, slug, name, description, is_system, is_default, created_at, updated_at')
        .order('is_system', { ascending: false })
        .order('name'),
      supabase.from('role_permissions').select('role_id, permissions(key)'),
      supabase.from('user_roles').select('role_id'),
    ]);

    if (rolesErr) throw new AppError(500, 'ROLES_FETCH_FAILED', rolesErr.message);
    if (rpErr) throw new AppError(500, 'ROLE_PERMS_FETCH_FAILED', rpErr.message);
    if (urErr) throw new AppError(500, 'USER_ROLES_FETCH_FAILED', urErr.message);

    const permsByRole = new Map<string, PermissionKey[]>();
    for (const row of rpRows ?? []) {
      const roleId = row.role_id as string;
      const permObj = Array.isArray(row.permissions) ? row.permissions[0] : row.permissions;
      const key = (permObj as { key?: string } | null)?.key;
      if (key && isKnownPermissionKey(key)) {
        const list = permsByRole.get(roleId) ?? [];
        list.push(key);
        permsByRole.set(roleId, list);
      }
    }

    const userCountByRole = new Map<string, number>();
    for (const row of urRows ?? []) {
      const roleId = row.role_id as string;
      userCountByRole.set(roleId, (userCountByRole.get(roleId) ?? 0) + 1);
    }

    return ((roleRows ?? []) as DbRoleRow[]).map((role) => ({
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      isSystem: role.is_system,
      isDefault: role.is_default,
      permissionKeys: (permsByRole.get(role.id) ?? []).sort(),
      userCount: userCountByRole.get(role.id) ?? 0,
      createdAt: role.created_at,
      updatedAt: role.updated_at,
    }));
  }

  async createRole(input: CreateRoleInput): Promise<RoleSummary> {
    const supabase = await createSupabaseServerClient();

    const { data: existingSlug } = await supabase
      .from('roles')
      .select('id')
      .eq('slug', input.slug)
      .maybeSingle();

    if (existingSlug) {
      throw new AppError(409, 'ROLE_SLUG_EXISTS', `A role with slug "${input.slug}" already exists.`);
    }

    const { data: perms, error: permsErr } = await supabase
      .from('permissions')
      .select('id, key')
      .in('key', input.permissionKeys);

    if (permsErr) {
      throw new AppError(500, 'PERMISSIONS_LOOKUP_FAILED', permsErr.message);
    }

    if (!perms || perms.length !== input.permissionKeys.length) {
      throw new AppError(400, 'UNKNOWN_PERMISSION', 'One or more permission attributes do not exist.');
    }

    if (input.isDefault) {
      const { error: clearDefaultErr } = await supabase
        .from('roles')
        .update({ is_default: false })
        .eq('is_default', true);
      if (clearDefaultErr) {
        throw new AppError(500, 'DEFAULT_ROLE_UPDATE_FAILED', clearDefaultErr.message);
      }
    }

    const { data: created, error: createErr } = await supabase
      .from('roles')
      .insert({
        slug: input.slug,
        name: input.name,
        description: input.description,
        is_system: false,
        is_default: input.isDefault,
      })
      .select('id, slug, name, description, is_system, is_default, created_at, updated_at')
      .single();

    if (createErr || !created) {
      throw new AppError(400, 'ROLE_CREATE_FAILED', createErr?.message || 'Unable to create role.');
    }

    const roleId = (created as DbRoleRow).id;
    const { error: rpInsertErr } = await supabase.from('role_permissions').insert(
      perms.map((p) => ({
        role_id: roleId,
        permission_id: p.id,
      })),
    );

    if (rpInsertErr) {
      throw new AppError(500, 'ROLE_PERMS_CREATE_FAILED', rpInsertErr.message);
    }

    const row = created as DbRoleRow;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      isSystem: row.is_system,
      isDefault: row.is_default,
      permissionKeys: [...input.permissionKeys].sort(),
      userCount: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateRole(roleId: string, input: UpdateRoleInput): Promise<RoleSummary> {
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('roles')
      .select('id, slug, name, description, is_system, is_default, created_at, updated_at')
      .eq('id', roleId)
      .maybeSingle();

    if (fetchErr) {
      throw new AppError(500, 'ROLE_FETCH_FAILED', fetchErr.message);
    }
    if (!existing) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found.');
    }

    if (input.permissionKeys) {
      const { data: perms, error: permsErr } = await supabase
        .from('permissions')
        .select('id, key')
        .in('key', input.permissionKeys);

      if (permsErr) {
        throw new AppError(500, 'PERMISSIONS_LOOKUP_FAILED', permsErr.message);
      }
      if (!perms || perms.length !== input.permissionKeys.length) {
        throw new AppError(400, 'UNKNOWN_PERMISSION', 'One or more permission attributes are invalid.');
      }

      const graph = await this.loadLockoutGraph();
      const nextRolePerms = graph.rolePermissions.some((rp) => rp.roleId === roleId)
        ? graph.rolePermissions.map((rp) =>
            rp.roleId === roleId ? { roleId, permissionKeys: input.permissionKeys! } : rp,
          )
        : [...graph.rolePermissions, { roleId, permissionKeys: input.permissionKeys }];

      assertAdminLockoutInvariant(nextRolePerms, graph.userAssignments);

      const { error: delRpErr } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);
      if (delRpErr) {
        throw new AppError(500, 'ROLE_PERMS_UPDATE_FAILED', delRpErr.message);
      }

      const { error: insRpErr } = await supabase.from('role_permissions').insert(
        perms.map((p) => ({
          role_id: roleId,
          permission_id: p.id,
        })),
      );
      if (insRpErr) {
        throw new AppError(500, 'ROLE_PERMS_UPDATE_FAILED', insRpErr.message);
      }
    }

    if (input.isDefault === true) {
      const { error: clearErr } = await supabase
        .from('roles')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', roleId);
      if (clearErr) {
        throw new AppError(500, 'DEFAULT_ROLE_UPDATE_FAILED', clearErr.message);
      }
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.isDefault !== undefined) patch.is_default = input.isDefault;

    if (Object.keys(patch).length > 0) {
      const { error: updErr } = await supabase
        .from('roles')
        .update(patch)
        .eq('id', roleId);
      if (updErr) {
        throw new AppError(400, 'ROLE_UPDATE_FAILED', updErr.message);
      }
    }

    const updatedRoles = await this.listRoles();
    const updated = updatedRoles.find((r) => r.id === roleId);
    if (!updated) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found after update.');
    }
    return updated;
  }

  async deleteRole(roleId: string): Promise<void> {
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('roles')
      .select('id, is_system, is_default')
      .eq('id', roleId)
      .maybeSingle();

    if (fetchErr) {
      throw new AppError(500, 'ROLE_FETCH_FAILED', fetchErr.message);
    }
    if (!existing) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found.');
    }

    if (existing.is_system) {
      throw new AppError(409, 'SYSTEM_ROLE_PROTECTED', 'System bootstrap roles cannot be deleted.');
    }
    if (existing.is_default) {
      throw new AppError(
        409,
        'DEFAULT_ROLE_PROTECTED',
        'Default sign-up role cannot be deleted. Assign another default role first.',
      );
    }

    const graph = await this.loadLockoutGraph();
    const nextRolePerms = graph.rolePermissions.filter((rp) => rp.roleId !== roleId);
    const nextAssignments = graph.userAssignments.map((ua) => ({
      userId: ua.userId,
      roleIds: ua.roleIds.filter((id) => id !== roleId),
    }));
    assertAdminLockoutInvariant(nextRolePerms, nextAssignments);

    const { error: delErr } = await supabase.from('roles').delete().eq('id', roleId);
    if (delErr) {
      throw new AppError(400, 'ROLE_DELETE_FAILED', delErr.message);
    }
  }

  async listUsers(): Promise<UserWithRoles[]> {
    const supabase = await createSupabaseServerClient();

    const [{ data: profiles, error: profErr }, { data: urRows, error: urErr }, roles] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, first_name, last_name, preferred_locale, created_at, updated_at')
          .order('created_at', { ascending: true }),
        supabase.from('user_roles').select('user_id, role_id'),
        this.listRoles(),
      ]);

    if (profErr) throw new AppError(500, 'USERS_FETCH_FAILED', profErr.message);
    if (urErr) throw new AppError(500, 'USER_ROLES_FETCH_FAILED', urErr.message);

    const roleById = new Map(roles.map((r) => [r.id, r]));
    const rolesByUser = new Map<string, RoleSummary[]>();

    for (const row of urRows ?? []) {
      const userId = row.user_id as string;
      const role = roleById.get(row.role_id as string);
      if (role) {
        const list = rolesByUser.get(userId) ?? [];
        list.push(role);
        rolesByUser.set(userId, list);
      }
    }

    return ((profiles ?? []) as DbProfileRow[]).map((profile) => {
      const assigned = (rolesByUser.get(profile.id) ?? []).map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        permissionKeys: r.permissionKeys,
      }));
      return {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        preferredLocale: normalizeLocale(profile.preferred_locale) ?? DEFAULT_LOCALE,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        roles: assigned,
        effectivePermissions: resolveEffectivePermissions(assigned),
      };
    });
  }

  async assignUserRoles(
    targetUserId: string,
    input: AssignUserRolesInput,
    actorId: string,
  ): Promise<UserWithRoles> {
    const supabase = await createSupabaseServerClient();

    const { data: targetProfile, error: profErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (profErr) throw new AppError(500, 'USER_FETCH_FAILED', profErr.message);
    if (!targetProfile) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');

    const uniqueRoleIds = Array.from(new Set(input.roleIds));
    if (uniqueRoleIds.length > 0) {
      const { data: validRoles, error: validErr } = await supabase
        .from('roles')
        .select('id')
        .in('id', uniqueRoleIds);

      if (validErr) throw new AppError(500, 'ROLES_LOOKUP_FAILED', validErr.message);
      if (!validRoles || validRoles.length !== uniqueRoleIds.length) {
        throw new AppError(400, 'UNKNOWN_ROLE', 'One or more selected roles do not exist.');
      }
    }

    const graph = await this.loadLockoutGraph();
    const hasExistingEntry = graph.userAssignments.some((ua) => ua.userId === targetUserId);
    const nextAssignments = hasExistingEntry
      ? graph.userAssignments.map((ua) =>
          ua.userId === targetUserId ? { userId: targetUserId, roleIds: uniqueRoleIds } : ua,
        )
      : [...graph.userAssignments, { userId: targetUserId, roleIds: uniqueRoleIds }];

    assertAdminLockoutInvariant(graph.rolePermissions, nextAssignments);

    const { error: delErr } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId);
    if (delErr) throw new AppError(500, 'USER_ROLES_UPDATE_FAILED', delErr.message);

    if (uniqueRoleIds.length > 0) {
      const { error: insErr } = await supabase.from('user_roles').insert(
        uniqueRoleIds.map((roleId) => ({
          user_id: targetUserId,
          role_id: roleId,
          assigned_by: actorId,
        })),
      );
      if (insErr) throw new AppError(500, 'USER_ROLES_UPDATE_FAILED', insErr.message);
    }

    const users = await this.listUsers();
    const updatedUser = users.find((u) => u.id === targetUserId);
    if (!updatedUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found after update.');
    }
    return updatedUser;
  }

  async updateUserSettings(
    userId: string,
    input: UpdateUserSettingsInput,
  ): Promise<UserProfile> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('profiles')
      .update({ preferred_locale: input.preferredLocale })
      .eq('id', userId)
      .select('id, email, first_name, last_name, preferred_locale, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new AppError(
        400,
        'SETTINGS_UPDATE_FAILED',
        error?.message || 'Unable to update user settings.',
      );
    }

    const row = data as DbProfileRow;
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      preferredLocale: normalizeLocale(row.preferred_locale) ?? DEFAULT_LOCALE,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
