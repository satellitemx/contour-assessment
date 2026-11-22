import { z } from 'zod';

// ---------------------------------------------------------------------------
// Core Enum Schemas
// ---------------------------------------------------------------------------

export const localeSchema = z.enum(['en', 'zh-CN']);

export const consultationStatusSchema = z.enum([
  'scheduled',
  'completed',
  'cancelled',
]);

export const consultationStatusFilterSchema = z.enum([
  'all',
  'scheduled',
  'completed',
  'cancelled',
]);

export const permissionKeySchema = z.enum([
  'consultations:read:own',
  'consultations:create:own',
  'consultations:update:own',
  'consultations:cancel:own',
  'consultations:read:all',
  'roles:read',
  'roles:manage',
  'users:assign_roles',
]);

// ---------------------------------------------------------------------------
// Domain Entity Schemas
// ---------------------------------------------------------------------------

export const roleSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  isSystem: z.boolean(),
  isDefault: z.boolean(),
  permissionKeys: z.array(permissionKeySchema),
  userCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const authRoleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  isSystem: z.boolean(),
  isDefault: z.boolean(),
  permissionKeys: z.array(permissionKeySchema),
});

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  preferredLocale: localeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const authUserContextSchema = z.object({
  user: userProfileSchema,
  roles: z.array(authRoleSchema),
  effectivePermissions: z.array(permissionKeySchema),
});

export const userRoleRefSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  permissionKeys: z.array(permissionKeySchema),
});

export const userWithRolesSchema = userProfileSchema.extend({
  roles: z.array(userRoleRefSchema),
  effectivePermissions: z.array(permissionKeySchema),
});

export const consultationSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  reason: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: consultationStatusSchema,
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminConsultationSchema = consultationSchema.extend({
  studentEmail: z.string(),
  studentProfileName: z.string(),
});

export const consultationStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  scheduled: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
});

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().min(1),
});

export const paginatedConsultationsResultSchema = z.object({
  consultations: z.array(adminConsultationSchema),
  stats: consultationStatsSchema,
  pagination: paginationMetaSchema,
});

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// ---------------------------------------------------------------------------
// API Response Contract Schemas
// ---------------------------------------------------------------------------

export const signupResponseSchema = z.object({
  user: authUserContextSchema.nullable(),
  requiresEmailConfirmation: z.boolean(),
});

export const loginResponseSchema = authUserContextSchema;

export const meResponseSchema = authUserContextSchema;

export const successResponseSchema = z.object({
  success: z.literal(true),
});

export const ownConsultationsResponseSchema = z.object({
  consultations: z.array(consultationSchema),
  stats: consultationStatsSchema,
});

export const consultationMutationResponseSchema = z.object({
  consultation: consultationSchema,
});

export const adminConsultationsResponseSchema = paginatedConsultationsResultSchema;

export const rolesListResponseSchema = z.object({
  roles: z.array(roleSummarySchema),
});

export const roleMutationResponseSchema = z.object({
  role: roleSummarySchema,
});

export const usersListResponseSchema = z.object({
  users: z.array(userWithRolesSchema),
});

export const userMutationResponseSchema = z.object({
  user: userWithRolesSchema,
});

export const userSettingsResponseSchema = z.object({
  user: userProfileSchema,
});

export const testResetResponseSchema = z.object({
  reset: z.literal(true),
});
