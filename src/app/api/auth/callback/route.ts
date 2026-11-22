import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/http';
import { getLmsRepository } from '@/lib/repositories';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextPath = sanitizeRedirectPath(searchParams.get('next'), '/');

  if (code) {
    try {
      const repo = getLmsRepository();
      if (repo.exchangeAuthCode) {
        await repo.exchangeAuthCode(code);
      }
      return NextResponse.redirect(new URL(nextPath, origin));
    } catch {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=missing_code', origin));
}
