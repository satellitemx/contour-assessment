import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as meGet } from '@/app/api/auth/me/route';
import { POST as signupPost } from '@/app/api/auth/signup/route';
import { PATCH as userSettingsPatch } from '@/app/api/user/settings/route';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n';
import { setTestRepository } from '@/lib/repositories';
import { createTestRepo, jsonRequest } from './helpers';

describe('User Settings & Locale Preference API Integration', () => {
  beforeEach(() => {
    const { repo } = createTestRepo();
    setTestRepository(repo);
  });

  afterEach(() => {
    setTestRepository(null);
  });

  test('unauthenticated PATCH /api/user/settings returns 401', async () => {
    const res = await userSettingsPatch(
      jsonRequest('http://localhost:3000/api/user/settings', 'PATCH', {
        preferredLocale: 'zh-CN',
      }),
    );
    expect(res.status).toBe(401);
  });

  test('existing seeded users default to English (en)', async () => {
    const loginRes = await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'student@example.org',
        password: 'ChangeMe123!',
      }),
    );
    expect(loginRes.status).toBe(200);
    const body = await loginRes.json();
    expect(body.user.preferredLocale).toBe('en');
    expect(loginRes.headers.get('set-cookie')).toContain(
      `${LOCALE_COOKIE_NAME}=en`,
    );
  });

  test('authenticated user can update language preference and persist across /api/auth/me and login', async () => {
    await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'student@example.org',
        password: 'ChangeMe123!',
      }),
    );

    const invalidRes = await userSettingsPatch(
      jsonRequest('http://localhost:3000/api/user/settings', 'PATCH', {
        preferredLocale: 'es-ES',
      }),
    );
    expect(invalidRes.status).toBe(400);

    const updateRes = await userSettingsPatch(
      jsonRequest('http://localhost:3000/api/user/settings', 'PATCH', {
        preferredLocale: 'zh-CN',
      }),
    );
    expect(updateRes.status).toBe(200);
    const updatedBody = await updateRes.json();
    expect(updatedBody.user.preferredLocale).toBe('zh-CN');
    expect(updateRes.headers.get('set-cookie')).toContain(
      `${LOCALE_COOKIE_NAME}=zh-CN`,
    );

    const meRes = await meGet();
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.preferredLocale).toBe('zh-CN');

    const outRes = await logoutPost();
    expect(outRes.status).toBe(200);

    const reLoginRes = await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'student@example.org',
        password: 'ChangeMe123!',
      }),
    );
    expect(reLoginRes.status).toBe(200);
    const reLoginBody = await reLoginRes.json();
    expect(reLoginBody.user.preferredLocale).toBe('zh-CN');
  });

  test('new user signup stores visitor preferredLocale or defaults to en', async () => {
    const signupZhRes = await signupPost(
      jsonRequest('http://localhost:3000/api/auth/signup', 'POST', {
        email: 'wei.chen@example.org',
        password: 'StrongPassword123!',
        firstName: 'Wei',
        lastName: 'Chen',
        preferredLocale: 'zh-CN',
      }),
    );
    expect(signupZhRes.status).toBe(201);
    const zhBody = await signupZhRes.json();
    expect(zhBody.user.user.preferredLocale).toBe('zh-CN');
    expect(signupZhRes.headers.get('set-cookie')).toContain(
      `${LOCALE_COOKIE_NAME}=zh-CN`,
    );

    const signupDefaultRes = await signupPost(
      jsonRequest('http://localhost:3000/api/auth/signup', 'POST', {
        email: 'alex.kim@example.org',
        password: 'StrongPassword123!',
        firstName: 'Alex',
        lastName: 'Kim',
      }),
    );
    expect(signupDefaultRes.status).toBe(201);
    const defaultBody = await signupDefaultRes.json();
    expect(defaultBody.user.user.preferredLocale).toBe('en');
  });
});
