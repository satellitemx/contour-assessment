import { handleApiError, jsonOk } from '@/lib/http';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n';
import { getLmsRepository } from '@/lib/repositories';

export async function POST() {
  try {
    const repo = getLmsRepository();
    await repo.logout();
    const response = jsonOk({ success: true });
    response.cookies.delete(LOCALE_COOKIE_NAME);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
