import { requirePermissions } from '@/lib/auth-guard';
import { handleApiError, jsonOk, parseJsonBody } from '@/lib/http';
import { PERMISSIONS } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';
import { updateRoleSchema, uuidParamSchema } from '@/lib/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requirePermissions([PERMISSIONS.ROLES_MANAGE]);
    const { id } = await context.params;
    const roleId = uuidParamSchema.parse(id);

    const body = await parseJsonBody(request);
    const input = updateRoleSchema.parse(body);

    const repo = getLmsRepository();
    const role = await repo.updateRole(roleId, input);

    return jsonOk({ role });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requirePermissions([PERMISSIONS.ROLES_MANAGE]);
    const { id } = await context.params;
    const roleId = uuidParamSchema.parse(id);

    const repo = getLmsRepository();
    await repo.deleteRole(roleId);

    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
