import { requirePermissions } from '@/lib/auth-guard';
import { permissionsResponseSchema } from '@/lib/contracts';
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
    const permissions = await repo.listPermissions();

    return jsonOk({ permissions }, permissionsResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
