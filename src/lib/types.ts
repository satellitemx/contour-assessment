import type { z } from 'zod';
import type {
  adminConsultationSchema,
  apiErrorBodySchema,
  authUserContextSchema,
  consultationSchema,
  consultationStatsSchema,
  consultationStatusFilterSchema,
  consultationStatusSchema,
  localeSchema,
  paginatedConsultationsResultSchema,
  paginationMetaSchema,
  permissionKeySchema,
  permissionSchema,
  roleSummarySchema,
  signupResponseSchema,
  userProfileSchema,
  userWithRolesSchema,
} from './contracts';

export type Locale = z.infer<typeof localeSchema>;
export type ConsultationStatus = z.infer<typeof consultationStatusSchema>;
export type ConsultationStatusFilter = z.infer<
  typeof consultationStatusFilterSchema
>;
export type PermissionKey = z.infer<typeof permissionKeySchema>;

export type Permission = z.infer<typeof permissionSchema>;
export type RoleSummary = z.infer<typeof roleSummarySchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type AuthUserContext = z.infer<typeof authUserContextSchema>;
export type UserWithRoles = z.infer<typeof userWithRolesSchema>;
export type Consultation = z.infer<typeof consultationSchema>;
export type AdminConsultation = z.infer<typeof adminConsultationSchema>;
export type ConsultationStats = z.infer<typeof consultationStatsSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type PaginatedConsultationsResult = z.infer<
  typeof paginatedConsultationsResultSchema
>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
export type SignupApiResponse = z.infer<typeof signupResponseSchema>;
