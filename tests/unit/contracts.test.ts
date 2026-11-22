import { describe, expect, test } from 'bun:test';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import {
  adminConsultationsResponseSchema,
  apiErrorBodySchema,
  ownConsultationsResponseSchema,
  rolesListResponseSchema,
  userSettingsResponseSchema,
} from '@/lib/contracts';
import {
  createBookingFormSchema,
  createLoginFormSchema,
  createRescheduleFormSchema,
  createRoleFormSchema,
  createSignupFormSchema,
  zodFormValidate,
} from '@/lib/form-zod';
import { getMessages } from '@/lib/i18n';
import { PERMISSIONS } from '@/lib/permissions';
import { loginSchema } from '@/lib/validation';

describe('Zod Client Form Validators & API Contract Typechecking', () => {
  test('zodFormValidate produces localized Mantine errors in en and zh-CN', () => {
    for (const locale of ['en', 'zh-CN'] as const) {
      const messages = getMessages(locale);

      const validateLogin = zodFormValidate(createLoginFormSchema(messages));
      expect(validateLogin({ email: 'bad', password: '' })).toEqual({
        email: messages.auth.emailInvalid,
        password: messages.auth.passwordRequired,
      });
      expect(
        validateLogin({ email: 'user@example.org', password: 'secret' }),
      ).toEqual({});

      const validateSignup = zodFormValidate(createSignupFormSchema(messages));
      expect(
        validateSignup({
          firstName: '',
          lastName: '',
          email: 'bad',
          password: '123',
        }),
      ).toEqual({
        firstName: messages.auth.firstNameRequired,
        lastName: messages.auth.lastNameRequired,
        email: messages.auth.emailInvalid,
        password: messages.auth.passwordMinError,
      });

      const validateBooking = zodFormValidate(createBookingFormSchema(messages));
      expect(
        validateBooking({
          firstName: 'Maya',
          lastName: 'Lin',
          reason: 'Thesis review',
          startsAt: '2026-12-01 11:00:00',
          endsAt: '2026-12-01 10:00:00',
        }),
      ).toEqual({
        endsAt: messages.booking.endsAfterStartsError,
      });
      expect(
        validateBooking({
          firstName: 'Maya',
          lastName: 'Lin',
          reason: 'Thesis review',
          startsAt: '2026-12-01 10:00:00',
          endsAt: '2026-12-01 11:00:00',
        }),
      ).toEqual({});

      const validateReschedule = zodFormValidate(
        createRescheduleFormSchema(messages),
      );
      expect(
        validateReschedule({
          startsAt: null,
          endsAt: null,
        }),
      ).toEqual({
        startsAt: messages.booking.startsAtRequired,
        endsAt: messages.booking.endsAtRequired,
      });

      const validateRole = zodFormValidate(createRoleFormSchema(messages));
      expect(
        validateRole({
          name: 'A',
          permissionKeys: [],
        }),
      ).toEqual({
        name: messages.roleEditor.nameMinError,
        permissionKeys: messages.roleEditor.attributesMinError,
      });
      expect(
        validateRole({
          name: 'Mentor',
          permissionKeys: [PERMISSIONS.CONSULTATIONS_READ_OWN],
        }),
      ).toEqual({});
    }
  });

  test('apiRequest validates outgoing requestSchema and incoming responseSchema', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;

    try {
      // Invalid outgoing request must fail before calling fetch
      globalThis.fetch = (async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      }) as typeof fetch;

      await expect(
        apiRequest('/api/auth/login', {
          method: 'POST',
          requestSchema: loginSchema,
          responseSchema: userSettingsResponseSchema,
          body: { email: 'not-an-email', password: '' },
        }),
      ).rejects.toMatchObject({
        name: 'ClientApiError',
        status: 400,
        code: 'VALIDATION_ERROR',
      });
      expect(fetchCalled).toBe(false);

      // Drifted 200 response payload must throw INVALID_API_RESPONSE
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ unexpected: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;

      await expect(
        apiRequest('/api/user/settings', {
          method: 'PATCH',
          responseSchema: userSettingsResponseSchema,
        }),
      ).rejects.toMatchObject({
        name: 'ClientApiError',
        status: 500,
        code: 'INVALID_API_RESPONSE',
      });

      // Valid response passes Zod runtime validation
      const validPayload = {
        user: {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'student@example.org',
          firstName: 'Maya',
          lastName: 'Lin',
          preferredLocale: 'zh-CN',
          createdAt: '2026-11-22T00:00:00.000Z',
          updatedAt: '2026-11-22T00:00:00.000Z',
        },
      };
      globalThis.fetch = (async () =>
        new Response(JSON.stringify(validPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;

      const parsed = await apiRequest('/api/user/settings', {
        method: 'PATCH',
        responseSchema: userSettingsResponseSchema,
      });
      expect(parsed).toEqual(validPayload);

      // Error responses are parsed via apiErrorBodySchema
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            error: { code: 'FORBIDDEN', message: 'Access denied.' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        )) as typeof fetch;

      try {
        await apiRequest('/api/admin/roles', {
          responseSchema: rolesListResponseSchema,
        });
        expect.unreachable('Expected ClientApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ClientApiError);
        expect((err as ClientApiError).code).toBe('FORBIDDEN');
        expect((err as ClientApiError).status).toBe(403);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('API contract schemas enforce valid structures', () => {
    expect(
      apiErrorBodySchema.safeParse({
        error: { code: 'UNAUTHORIZED', message: 'Login required' },
      }).success,
    ).toBe(true);

    expect(
      ownConsultationsResponseSchema.safeParse({
        consultations: [],
        stats: { total: 0, scheduled: 0, completed: 0, cancelled: 0 },
      }).success,
    ).toBe(true);

    expect(
      adminConsultationsResponseSchema.safeParse({
        consultations: [],
        stats: { total: 0, scheduled: 0, completed: 0, cancelled: 0 },
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
      }).success,
    ).toBe(true);
  });
});
