import { requireAuth } from '@/lib/auth-guard';
import { meResponseSchema } from '@/lib/contracts';
import { handleApiError, jsonOk } from '@/lib/http';

export async function GET() {
  try {
    const auth = await requireAuth();
    return jsonOk(auth, meResponseSchema);
  } catch (error) {
    return handleApiError(error);
  }
}
