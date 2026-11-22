export type Locale = 'en' | 'zh-CN';

export type ConsultationStatus = 'scheduled' | 'completed' | 'cancelled';

export type PermissionKey =
  | 'consultations:read:own'
  | 'consultations:create:own'
  | 'consultations:update:own'
  | 'consultations:cancel:own'
  | 'consultations:read:all'
  | 'roles:read'
  | 'roles:manage'
  | 'users:assign_roles';

export interface Permission {
  id: string;
  key: PermissionKey;
  resource: string;
  action: string;
  label: string;
  description: string;
}

export interface RoleSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  isDefault: boolean;
  permissionKeys: PermissionKey[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  preferredLocale: Locale;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUserContext {
  user: UserProfile;
  roles: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    isSystem: boolean;
    isDefault: boolean;
    permissionKeys: PermissionKey[];
  }>;
  effectivePermissions: PermissionKey[];
}

export interface UserWithRoles extends UserProfile {
  roles: Array<{
    id: string;
    slug: string;
    name: string;
    permissionKeys: PermissionKey[];
  }>;
  effectivePermissions: PermissionKey[];
}

export interface Consultation {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  status: ConsultationStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminConsultation extends Consultation {
  studentEmail: string;
  studentProfileName: string;
}

export interface ConsultationStats {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedConsultationsResult {
  consultations: AdminConsultation[];
  stats: ConsultationStats;
  pagination: PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
