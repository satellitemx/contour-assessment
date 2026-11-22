import type { FormErrors } from '@mantine/form';
import dayjs from 'dayjs';
import { z } from 'zod';
import { permissionKeySchema } from './contracts';
import type { TranslationDictionary } from './i18n';

export function zodFormValidate<TValues>(
  schema: z.ZodType<unknown>,
): (values: TValues) => FormErrors {
  return (values: TValues): FormErrors => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      return {};
    }

    const errors: FormErrors = {};
    for (const issue of parsed.error.issues) {
      const pathKey = issue.path.join('.');
      if (pathKey && !(pathKey in errors)) {
        errors[pathKey] = issue.message;
      }
    }
    return errors;
  };
}

export function createLoginFormSchema(messages: TranslationDictionary) {
  return z.object({
    email: z.string().trim().email(messages.auth.emailInvalid),
    password: z.string().min(1, messages.auth.passwordRequired),
  });
}

export function createSignupFormSchema(messages: TranslationDictionary) {
  return z.object({
    firstName: z.string().trim().min(1, messages.auth.firstNameRequired),
    lastName: z.string().trim().min(1, messages.auth.lastNameRequired),
    email: z.string().trim().email(messages.auth.emailInvalid),
    password: z.string().min(8, messages.auth.passwordMinError),
  });
}

export function createBookingFormSchema(messages: TranslationDictionary) {
  return z
    .object({
      firstName: z.string().trim().min(1, messages.auth.firstNameRequired),
      lastName: z.string().trim().min(1, messages.auth.lastNameRequired),
      reason: z.string().trim().min(3, messages.booking.reasonError),
      startsAt: z
        .string()
        .nullable()
        .refine((v) => Boolean(v), {
          message: messages.booking.startsAtRequired,
        }),
      endsAt: z
        .string()
        .nullable()
        .refine((v) => Boolean(v), {
          message: messages.booking.endsAtRequired,
        }),
    })
    .superRefine((values, ctx) => {
      if (
        values.startsAt &&
        values.endsAt &&
        !dayjs(values.endsAt).isAfter(dayjs(values.startsAt))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endsAt'],
          message: messages.booking.endsAfterStartsError,
        });
      }
    });
}

export function createRescheduleFormSchema(messages: TranslationDictionary) {
  return z
    .object({
      startsAt: z
        .string()
        .nullable()
        .refine((v) => Boolean(v), {
          message: messages.booking.startsAtRequired,
        }),
      endsAt: z
        .string()
        .nullable()
        .refine((v) => Boolean(v), {
          message: messages.booking.endsAtRequired,
        }),
    })
    .superRefine((values, ctx) => {
      if (
        values.startsAt &&
        values.endsAt &&
        !dayjs(values.endsAt).isAfter(dayjs(values.startsAt))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endsAt'],
          message: messages.booking.endsAfterStartsError,
        });
      }
    });
}

export function createRoleFormSchema(messages: TranslationDictionary) {
  return z.object({
    name: z.string().trim().min(2, messages.roleEditor.nameMinError),
    slug: z.string().optional(),
    description: z.string().optional(),
    isDefault: z.boolean().optional(),
    permissionKeys: z
      .array(permissionKeySchema)
      .min(1, messages.roleEditor.attributesMinError),
  });
}
