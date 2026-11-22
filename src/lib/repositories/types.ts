import type {
  AuthUserContext,
  Consultation,
  ConsultationStats,
  PaginatedConsultationsResult,
  Permission,
  RoleSummary,
  UserProfile,
  UserWithRoles,
} from '@/lib/types';
import type {
  AssignUserRolesInput,
  ConsultationQueryInput,
  CreateConsultationInput,
  CreateRoleInput,
  LoginInput,
  SignupInput,
  UpdateConsultationInput,
  UpdateRoleInput,
  UpdateUserSettingsInput,
} from '@/lib/validation';

export interface SignupResult {
  user: AuthUserContext | null;
  requiresEmailConfirmation: boolean;
}

export interface ConsultationListResult {
  consultations: Consultation[];
  stats: ConsultationStats;
}

export interface LmsRepository {
  // Authentication & Identity
  signup(input: SignupInput & { emailRedirectTo?: string }): Promise<SignupResult>;
  login(input: LoginInput): Promise<AuthUserContext>;
  logout(): Promise<void>;
  exchangeAuthCode?(code: string): Promise<void>;
  getCurrentUser(): Promise<AuthUserContext | null>;

  // Student Consultations
  listOwnConsultations(
    studentId: string,
    filters: { status: 'all' | 'scheduled' | 'completed' | 'cancelled'; search: string },
  ): Promise<ConsultationListResult>;
  createConsultation(
    studentId: string,
    input: CreateConsultationInput,
  ): Promise<Consultation>;
  updateOwnConsultation(
    studentId: string,
    consultationId: string,
    input: UpdateConsultationInput,
  ): Promise<Consultation>;

  // Admin Consultations (Read-only across system)
  listAllConsultations(query: ConsultationQueryInput): Promise<PaginatedConsultationsResult>;

  // Attribute-Composed RBAC
  listPermissions(): Promise<Permission[]>;
  listRoles(): Promise<RoleSummary[]>;
  createRole(input: CreateRoleInput): Promise<RoleSummary>;
  updateRole(roleId: string, input: UpdateRoleInput): Promise<RoleSummary>;
  deleteRole(roleId: string): Promise<void>;

  // User Role Assignments & Settings
  listUsers(): Promise<UserWithRoles[]>;
  assignUserRoles(
    targetUserId: string,
    input: AssignUserRolesInput,
    actorId: string,
  ): Promise<UserWithRoles>;
  updateUserSettings(
    userId: string,
    input: UpdateUserSettingsInput,
  ): Promise<UserProfile>;
}
