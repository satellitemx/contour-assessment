import { requirePermissions } from '@/lib/auth-guard';
import {
  handleApiError,
  jsonCreated,
  jsonOk,
  parseJsonBody,
} from '@/lib/http';
import { PERMISSIONS } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';
import {
  consultationQuerySchema,
  createConsultationSchema,
} from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const auth = await requirePermissions([PERMISSIONS.CONSULTATIONS_READ_OWN]);
    const url = new URL(request.url);
    const query = consultationQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
    });

    const repo = getLmsRepository();
    const result = await repo.listOwnConsultations(auth.user.id, {
      status: query.status,
      search: query.search,
    });

    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermissions([PERMISSIONS.CONSULTATIONS_CREATE_OWN]);
    const body = await parseJsonBody(request);
    const input = createConsultationSchema.parse(body);

    const repo = getLmsRepository();
    const consultation = await repo.createConsultation(auth.user.id, input);

    return jsonCreated({ consultation });
  } catch (error) {
    return handleApiError(error);
  }
}
