import { requirePermissions } from '@/lib/auth-guard';
import { adminConsultationsResponseSchema } from '@/lib/contracts';
import { handleApiError, jsonOk } from '@/lib/http';
import { PERMISSIONS } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';
import { consultationQuerySchema } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    await requirePermissions([PERMISSIONS.CONSULTATIONS_READ_ALL]);
    const url = new URL(request.url);
    const query = consultationQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    });

    const repo = getLmsRepository();
    const result = await repo.listAllConsultations(query);

    return jsonOk(result, adminConsultationsResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
