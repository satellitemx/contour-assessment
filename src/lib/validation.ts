import { z } from 'zod';
import {
  consultationStatusFilterSchema,
  consultationStatusSchema,
  localeSchema,
  permissionKeySchema,
} from './contracts';
import { slugifyRoleName } from './permissions';
import type { Consultation } from './types';

export {
  consultationStatusFilterSchema,
  consultationStatusSchema,
  localeSchema,
  permissionKeySchema,
};

const MIN_DURATION_MS = 5 * 60 * 1000;
const MAX_DURATION_MS = 12 * 60 * 60 * 1000;

function validateIsoDatetimeRange(
  startsAtRaw: string,
  endsAtRaw: string,
  ctx: z.RefinementCtx,
) {
  const startMs = Date.parse(startsAtRaw);
  const endMs = Date.parse(endsAtRaw);

  if (Number.isNaN(startMs)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startsAt'],
      message: 'Start date/time must be a valid ISO datetime.',
    });
    return;
  }

  if (Number.isNaN(endMs)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'End date/time must be a valid ISO datetime.',
    });
    return;
  }

  if (endMs <= startMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'End date/time must be after start date/time.',
    });
    return;
  }

  const duration = endMs - startMs;
  if (duration < MIN_DURATION_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'Consultation duration must be at least 5 minutes.',
    });
  } else if (duration > MAX_DURATION_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'Consultation duration cannot exceed 12 hours.',
    });
  }
}

export const signupSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password must be 128 characters or fewer.'),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(80, 'First name must be 80 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(80, 'Last name must be 80 characters or fewer.'),
  preferredLocale: localeSchema.optional(),
});

export const updateUserSettingsSchema = z.object({
  preferredLocale: localeSchema,
});

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').toLowerCase(),
  password: z.string().min(1, 'Password is required.').max(128),
});

export const createConsultationSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required.')
      .max(80, 'First name must be 80 characters or fewer.'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required.')
      .max(80, 'Last name must be 80 characters or fewer.'),
    reason: z
      .string()
      .trim()
      .min(3, 'Please provide a brief reason (at least 3 characters).')
      .max(500, 'Reason must be 500 characters or fewer.'),
    startsAt: z.string().min(1, 'Start date and time are required.'),
    endsAt: z.string().min(1, 'End date and time are required.'),
  })
  .superRefine((data, ctx) => {
    validateIsoDatetimeRange(data.startsAt, data.endsAt, ctx);
  });

export const toggleCompleteConsultationSchema = z.object({
  action: z.literal('toggle_complete'),
  completed: z.boolean(),
});

const rescheduleConsultationBaseSchema = z.object({
  action: z.literal('reschedule'),
  startsAt: z.string().min(1, 'Start date and time are required.'),
  endsAt: z.string().min(1, 'End date and time are required.'),
});

export const rescheduleConsultationSchema =
  rescheduleConsultationBaseSchema.superRefine((data, ctx) => {
    validateIsoDatetimeRange(data.startsAt, data.endsAt, ctx);
  });

export const cancelConsultationSchema = z.object({
  action: z.literal('cancel'),
});

export const updateConsultationSchema = z
  .discriminatedUnion('action', [
    toggleCompleteConsultationSchema,
    rescheduleConsultationBaseSchema,
    cancelConsultationSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.action === 'reschedule') {
      validateIsoDatetimeRange(data.startsAt, data.endsAt, ctx);
    }
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;

export const createRoleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Role name must be at least 2 characters.')
      .max(64, 'Role name must be 64 characters or fewer.'),
    slug: z
      .string()
      .trim()
      .max(64, 'Slug must be 64 characters or fewer.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(300, 'Description must be 300 characters or fewer.')
      .default(''),
    isDefault: z.boolean().default(false),
    permissionKeys: z
      .array(permissionKeySchema)
      .min(1, 'Select at least one access attribute for this role.'),
  })
  .transform((data) => {
    const resolvedSlug = data.slug
      ? slugifyRoleName(data.slug)
      : slugifyRoleName(data.name);
    return {
      ...data,
      slug: resolvedSlug,
      permissionKeys: Array.from(new Set(data.permissionKeys)),
    };
  })
  .refine((data) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug), {
    path: ['slug'],
    message: 'Role slug must contain lowercase letters, numbers, and hyphens only.',
  });

export const updateRoleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Role name must be at least 2 characters.')
      .max(64, 'Role name must be 64 characters or fewer.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(300, 'Description must be 300 characters or fewer.')
      .optional(),
    isDefault: z.boolean().optional(),
    permissionKeys: z
      .array(permissionKeySchema)
      .min(1, 'Select at least one access attribute for this role.')
      .optional(),
  })
  .transform((data) => ({
    ...data,
    permissionKeys: data.permissionKeys
      ? Array.from(new Set(data.permissionKeys))
      : undefined,
  }));

export const assignUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid('Each role ID must be a valid UUID.')),
});

export const uuidParamSchema = z
  .string()
  .uuid('Resource identifier must be a valid UUID.');

export const consultationQuerySchema = z.object({
  status: consultationStatusFilterSchema.default('all'),
  search: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignUserRolesInput = z.infer<typeof assignUserRolesSchema>;
export type ConsultationQueryInput = z.infer<typeof consultationQuerySchema>;

export const transitionValidationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
});

export type TransitionValidationResult = z.infer<
  typeof transitionValidationResultSchema
>;

export const consultationTransitionSchema = z
  .object({
    status: consultationStatusSchema,
    update: updateConsultationSchema,
  })
  .superRefine(({ status, update }, ctx) => {
    if (update.action === 'toggle_complete') {
      if (status === 'cancelled') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cancelled consultations cannot be marked complete or incomplete.',
        });
      }
      return;
    }

    if (update.action === 'reschedule') {
      if (status !== 'scheduled') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Only scheduled consultations can be rescheduled (current status: ${status}).`,
        });
      }
      return;
    }

    if (update.action === 'cancel') {
      if (status === 'cancelled') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'This consultation is already cancelled.',
        });
      } else if (status === 'completed') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Completed consultations cannot be cancelled. Mark it incomplete first if needed.',
        });
      }
    }
  });

export function validateConsultationTransition(
  consultation: Pick<Consultation, 'status'>,
  update: UpdateConsultationInput,
): TransitionValidationResult {
  const parsed = consultationTransitionSchema.safeParse({
    status: consultation.status,
    update,
  });

  if (parsed.success) {
    return { valid: true };
  }

  return {
    valid: false,
    reason:
      parsed.error.issues[0]?.message ||
      'Unsupported consultation update action.',
  };
}
