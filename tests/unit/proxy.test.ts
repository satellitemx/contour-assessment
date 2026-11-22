import { describe, expect, test } from 'bun:test';
import { NextResponse } from 'next/server';
import {
  createRedirectWithCookies,
  isAuthPagePath,
  isProtectedPagePath,
} from '@/lib/supabase/proxy';

describe('Supabase proxy helpers', () => {
  test('createRedirectWithCookies preserves refreshed cookies on redirect response', () => {
    const sourceResponse = NextResponse.next();
    sourceResponse.cookies.set('sb-access-token', 'refreshed-jwt', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 3600,
    });
    sourceResponse.cookies.set('sb-refresh-token', 'new-refresh', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    });

    const target = new URL('http://localhost:3000/login?next=%2Fdashboard');
    const redirectResponse = createRedirectWithCookies(target, sourceResponse);

    expect(redirectResponse.status).toBe(307);
    expect(redirectResponse.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fdashboard',
    );

    const accessCookie = redirectResponse.cookies.get('sb-access-token');
    expect(accessCookie?.value).toBe('refreshed-jwt');
    expect(accessCookie?.httpOnly).toBe(true);
    expect(accessCookie?.path).toBe('/');
    expect(accessCookie?.sameSite).toBe('lax');
    expect(accessCookie?.maxAge).toBe(3600);

    const refreshCookie = redirectResponse.cookies.get('sb-refresh-token');
    expect(refreshCookie?.value).toBe('new-refresh');
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.path).toBe('/');
    expect(refreshCookie?.sameSite).toBe('lax');
  });

  test('isProtectedPagePath and isAuthPagePath match routes accurately', () => {
    expect(isProtectedPagePath('/dashboard')).toBe(true);
    expect(isProtectedPagePath('/dashboard/123')).toBe(true);
    expect(isProtectedPagePath('/admin/roles')).toBe(true);
    expect(isProtectedPagePath('/settings')).toBe(true);
    expect(isProtectedPagePath('/no-access')).toBe(true);
    expect(isProtectedPagePath('/login')).toBe(false);
    expect(isProtectedPagePath('/dashboard-public')).toBe(false);

    expect(isAuthPagePath('/login')).toBe(true);
    expect(isAuthPagePath('/signup')).toBe(true);
    expect(isAuthPagePath('/signup/confirm')).toBe(true);
    expect(isAuthPagePath('/dashboard')).toBe(false);
    expect(isAuthPagePath('/login-help')).toBe(false);
  });
});
