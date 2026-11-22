import { requireAuth } from '@/lib/auth-guard';
import { consultationMutationResponseSchema } from '@/lib/contracts';
import {
  AppError,
  handleApiError,
  jsonOk,
  parseJsonBody,
} from '@/lib/http';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';
import {
  updateConsultationSchema,
  uuidParamSchema,
} from '@/lib/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const consultationId = uuidParamSchema.parse(id);

    const body = await parseJsonBody(request);
    const input = updateConsultationSchema.parse(body);

    const requiredAttribute =
      input.action === 'cancel'
        ? PERMISSIONS.CONSULTATIONS_CANCEL_OWN
        : PERMISSIONS.CONSULTATIONS_UPDATE_OWN;

    if (!hasPermission(auth.effectivePermissions, requiredAttribute)) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You do not have the required access attribute for this consultation action.',
        { requiredAttributes: [requiredAttribute] },
      );
    }

    const repo = getLmsRepository();
    const consultation = await repo.updateOwnConsultation(
      auth.user.id,
      consultationId,
      input,
    );

    return jsonOk({ consultation }, consultationMutationResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
