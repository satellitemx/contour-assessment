import { NextResponse, type NextRequest } from 'next/server';
import { isE2ETestMode } from '@/lib/http';
import { getE2ERepository } from '@/lib/repositories';
import { E2E_SESSION_COOKIE_NAME } from '@/lib/repositories/memory-repository';
import {
  isAuthPagePath,
  isProtectedPagePath,
  updateSession,
} from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  if (isE2ETestMode()) {
    const token = request.cookies.get(E2E_SESSION_COOKIE_NAME)?.value;
    const isAuthenticated = getE2ERepository().hasValidSessionToken(token);
    const { pathname, search } = request.nextUrl;

    if (!isAuthenticated && isProtectedPagePath(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAuthenticated && isAuthPagePath(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      redirectUrl.search = '';
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next({ request });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
