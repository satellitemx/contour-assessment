import { requireAuth } from '@/lib/auth-guard';
import { handleApiError, jsonOk, parseJsonBody } from '@/lib/http';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n';
import { getLmsRepository } from '@/lib/repositories';
import { updateUserSettingsSchema } from '@/lib/validation';

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await parseJsonBody(request);
    const input = updateUserSettingsSchema.parse(body);

    const repo = getLmsRepository();
    const user = await repo.updateUserSettings(auth.user.id, input);

    const response = jsonOk({ user });
    response.cookies.set(LOCALE_COOKIE_NAME, user.preferredLocale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
