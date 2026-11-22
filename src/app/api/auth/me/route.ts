import { requireAuth } from '@/lib/auth-guard';
import { handleApiError, jsonOk } from '@/lib/http';

export async function GET() {
  try {
    const auth = await requireAuth();
    return jsonOk(auth);
  } catch (error) {
    return handleApiError(error);
  }
}
