import { requirePermissions } from '@/lib/auth-guard';
import { usersListResponseSchema } from '@/lib/contracts';
import { handleApiError, jsonOk } from '@/lib/http';
import { PERMISSIONS } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';

export async function GET() {
  try {
    await requirePermissions(
      [
        PERMISSIONS.ROLES_READ,
        PERMISSIONS.ROLES_MANAGE,
        PERMISSIONS.USERS_ASSIGN_ROLES,
      ],
      'any',
    );

    const repo = getLmsRepository();
    const users = await repo.listUsers();

    return jsonOk({ users }, usersListResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
