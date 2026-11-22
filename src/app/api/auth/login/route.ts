import { handleApiError, jsonOk, parseJsonBody } from '@/lib/http';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n';
import { getLmsRepository } from '@/lib/repositories';
import { loginSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const input = loginSchema.parse(body);

    const repo = getLmsRepository();
    const authContext = await repo.login(input);

    const response = jsonOk(authContext);
    response.cookies.set(LOCALE_COOKIE_NAME, authContext.user.preferredLocale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
