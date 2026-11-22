import { describe, expect, test } from 'bun:test';
import { sanitizeRedirectPath } from '@/lib/http';
import { PERMISSIONS } from '@/lib/permissions';
import {
  assignUserRolesSchema,
  createConsultationSchema,
  createRoleSchema,
  loginSchema,
  signupSchema,
  updateConsultationSchema,
} from '@/lib/validation';

describe('Validation Schemas & Security Helpers', () => {
  test('signupSchema normalizes email and enforces strong minimum fields', () => {
    const parsed = signupSchema.parse({
      email: '  Student@Example.ORG ',
      password: 'Password123!',
      firstName: '  Maya ',
      lastName: ' Lin ',
    });

    expect(parsed).toEqual({
      email: 'student@example.org',
      password: 'Password123!',
      firstName: 'Maya',
      lastName: 'Lin',
    });

    expect(() =>
      signupSchema.parse({
        email: 'bad-email',
        password: 'short',
        firstName: '',
        lastName: 'Lin',
      }),
    ).toThrow();
  });

  test('loginSchema validates email and non-empty password', () => {
    expect(
      loginSchema.parse({ email: 'USER@EXAMPLE.ORG', password: 'secret' }),
    ).toEqual({
      email: 'user@example.org',
      password: 'secret',
    });

    expect(() =>
      loginSchema.parse({ email: 'user@example.org', password: '' }),
    ).toThrow();
  });

  test('createConsultationSchema enforces required fields and datetime range bounds', () => {
    const start = new Date('2026-12-01T10:00:00.000Z');
    const end = new Date('2026-12-01T11:00:00.000Z');

    const valid = createConsultationSchema.parse({
      firstName: 'Maya',
      lastName: 'Lin',
      reason: 'Capstone architecture feedback',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });
    expect(valid.reason).toBe('Capstone architecture feedback');

    // End before start
    expect(() =>
      createConsultationSchema.parse({
        firstName: 'Maya',
        lastName: 'Lin',
        reason: 'Capstone architecture feedback',
        startsAt: end.toISOString(),
        endsAt: start.toISOString(),
      }),
    ).toThrow();

    // Less than 5 minutes
    expect(() =>
      createConsultationSchema.parse({
        firstName: 'Maya',
        lastName: 'Lin',
        reason: 'Quick ping',
        startsAt: '2026-12-01T10:00:00.000Z',
        endsAt: '2026-12-01T10:02:00.000Z',
      }),
    ).toThrow();

    // More than 12 hours
    expect(() =>
      createConsultationSchema.parse({
        firstName: 'Maya',
        lastName: 'Lin',
        reason: 'Marathon',
        startsAt: '2026-12-01T08:00:00.000Z',
        endsAt: '2026-12-01T22:00:00.000Z',
      }),
    ).toThrow();
  });

  test('updateConsultationSchema supports discriminated actions and validates reschedule range', () => {
    expect(
      updateConsultationSchema.parse({ action: 'toggle_complete', completed: true }),
    ).toEqual({ action: 'toggle_complete', completed: true });

    expect(updateConsultationSchema.parse({ action: 'cancel' })).toEqual({
      action: 'cancel',
    });

    expect(() =>
      updateConsultationSchema.parse({
        action: 'reschedule',
        startsAt: '2026-12-01T12:00:00.000Z',
        endsAt: '2026-12-01T11:00:00.000Z',
      }),
    ).toThrow();
  });

  test('createRoleSchema generates slug, deduplicates attributes, and rejects unknown attributes', () => {
    const created = createRoleSchema.parse({
      name: 'Peer Reviewer',
      description: 'Read all consultations and own consultations',
      permissionKeys: [
        PERMISSIONS.CONSULTATIONS_READ_ALL,
        PERMISSIONS.CONSULTATIONS_READ_OWN,
        PERMISSIONS.CONSULTATIONS_READ_ALL,
      ],
    });

    expect(created.slug).toBe('peer-reviewer');
    expect(created.permissionKeys).toEqual([
      PERMISSIONS.CONSULTATIONS_READ_ALL,
      PERMISSIONS.CONSULTATIONS_READ_OWN,
    ]);

    expect(() =>
      createRoleSchema.parse({
        name: 'Bad Role',
        permissionKeys: ['hardcoded:ADMIN'],
      }),
    ).toThrow();

    expect(() =>
      createRoleSchema.parse({
        name: 'Empty Role',
        permissionKeys: [],
      }),
    ).toThrow();
  });

  test('assignUserRolesSchema requires valid UUIDs', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(assignUserRolesSchema.parse({ roleIds: [id] })).toEqual({
      roleIds: [id],
    });

    expect(() =>
      assignUserRolesSchema.parse({ roleIds: ['not-a-uuid'] }),
    ).toThrow();
  });

  test('sanitizeRedirectPath blocks open redirects', () => {
    expect(sanitizeRedirectPath('/dashboard?filter=scheduled')).toBe(
      '/dashboard?filter=scheduled',
    );
    expect(sanitizeRedirectPath('https://evil.example/phish')).toBe('/');
    expect(sanitizeRedirectPath('//evil.example/phish')).toBe('/');
    expect(sanitizeRedirectPath('/\\evil.example')).toBe('/');
    expect(sanitizeRedirectPath(null, '/login')).toBe('/login');
  });
});
