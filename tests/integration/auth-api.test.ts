import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as meGet } from '@/app/api/auth/me/route';
import { POST as signupPost } from '@/app/api/auth/signup/route';
import { PERMISSIONS } from '@/lib/permissions';
import { setTestRepository } from '@/lib/repositories';
import { createTestRepo, jsonRequest } from './helpers';

describe('Auth API Integration', () => {
  beforeEach(() => {
    const { repo } = createTestRepo();
    setTestRepository(repo);
  });

  afterEach(() => {
    setTestRepository(null);
  });

  test('unauthenticated /api/auth/me returns 401', async () => {
    const res = await meGet();
    expect(res.status).toBe(401);
  });

  test('signup creates user, assigns default role, and establishes session', async () => {
    const res = await signupPost(
      jsonRequest('http://localhost:3000/api/auth/signup', 'POST', {
        email: 'newlearner@example.org',
        password: 'SecurePassword123!',
        firstName: 'Alex',
        lastName: 'Rivera',
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.requiresEmailConfirmation).toBe(false);
    expect(data.user.user.email).toBe('newlearner@example.org');
    expect(data.user.roles.map((r: { slug: string }) => r.slug)).toEqual(['learner']);
    expect(data.user.effectivePermissions).toContain(PERMISSIONS.CONSULTATIONS_CREATE_OWN);

    const meRes = await meGet();
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.user.email).toBe('newlearner@example.org');
  });

  test('duplicate signup email returns 409 conflict', async () => {
    const res = await signupPost(
      jsonRequest('http://localhost:3000/api/auth/signup', 'POST', {
        email: 'student@example.org',
        password: 'SecurePassword123!',
        firstName: 'Maya',
        lastName: 'Lin',
      }),
    );
    expect(res.status).toBe(409);
  });

  test('login, /api/auth/me, and logout lifecycle', async () => {
    const badLogin = await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'student@example.org',
        password: 'wrong-password',
      }),
    );
    expect(badLogin.status).toBe(401);

    const goodLogin = await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'student@example.org',
        password: 'ChangeMe123!',
      }),
    );
    expect(goodLogin.status).toBe(200);
    const loginBody = await goodLogin.json();
    expect(loginBody.user.email).toBe('student@example.org');

    const meBeforeLogout = await meGet();
    expect(meBeforeLogout.status).toBe(200);

    const out = await logoutPost();
    expect(out.status).toBe(200);

    const meAfterLogout = await meGet();
    expect(meAfterLogout.status).toBe(401);
  });

  test('malformed JSON returns 400 VALIDATION/INVALID_JSON', async () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    const res = await loginPost(req);
    expect(res.status).toBe(400);
  });
});
