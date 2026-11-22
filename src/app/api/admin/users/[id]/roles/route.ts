import { requirePermissions } from '@/lib/auth-guard';
import { handleApiError, jsonOk, parseJsonBody } from '@/lib/http';
import { PERMISSIONS } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';
import { assignUserRolesSchema, uuidParamSchema } from '@/lib/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const auth = await requirePermissions([PERMISSIONS.USERS_ASSIGN_ROLES]);
    const { id } = await context.params;
    const targetUserId = uuidParamSchema.parse(id);

    const body = await parseJsonBody(request);
    const input = assignUserRolesSchema.parse(body);

    const repo = getLmsRepository();
    const user = await repo.assignUserRoles(targetUserId, input, auth.user.id);

    return jsonOk({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
