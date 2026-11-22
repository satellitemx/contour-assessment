import { requirePermissions } from '@/lib/auth-guard';
import {
  roleMutationResponseSchema,
  rolesListResponseSchema,
} from '@/lib/contracts';
import {
  handleApiError,
  jsonCreated,
  jsonOk,
  parseJsonBody,
} from '@/lib/http';
import { PERMISSIONS } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';
import { createRoleSchema } from '@/lib/validation';

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
    const roles = await repo.listRoles();

    return jsonOk({ roles }, rolesListResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermissions([PERMISSIONS.ROLES_MANAGE]);
    const body = await parseJsonBody(request);
    const input = createRoleSchema.parse(body);

    const repo = getLmsRepository();
    const role = await repo.createRole(input);

    return jsonCreated({ role }, roleMutationResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
