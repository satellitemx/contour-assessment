import { signupResponseSchema } from '@/lib/contracts';
import {
  handleApiError,
  jsonCreated,
  parseJsonBody,
} from '@/lib/http';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n';
import { getLmsRepository } from '@/lib/repositories';
import { signupSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const input = signupSchema.parse(body);

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    const repo = getLmsRepository();
    const result = await repo.signup({
      ...input,
      emailRedirectTo: `${origin.replace(/\/+$/, '')}/api/auth/callback`,
    });

    const response = jsonCreated(result, signupResponseSchema);
    if (result.user) {
      response.cookies.set(
        LOCALE_COOKIE_NAME,
        result.user.user.preferredLocale,
        {
          path: '/',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
        },
      );
    }
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
