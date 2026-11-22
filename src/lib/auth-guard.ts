import { AppError } from '@/lib/http';
import { hasAllPermissions, hasAnyPermission } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';
import type { AuthUserContext, PermissionKey } from '@/lib/types';

export async function requireAuth(): Promise<AuthUserContext> {
  const repo = getLmsRepository();
  const current = await repo.getCurrentUser();
  if (!current) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }
  return current;
}

export async function requirePermissions(
  required: PermissionKey[],
  mode: 'all' | 'any' = 'all',
): Promise<AuthUserContext> {
  const auth = await requireAuth();

  const allowed =
    mode === 'all'
      ? hasAllPermissions(auth.effectivePermissions, required)
      : hasAnyPermission(auth.effectivePermissions, required);

  if (!allowed) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You do not have the required access attributes for this operation.',
      {
        mode,
        requiredAttributes: required,
      },
    );
  }

  return auth;
}
