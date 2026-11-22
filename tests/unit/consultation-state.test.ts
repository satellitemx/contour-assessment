import { describe, expect, test } from 'bun:test';
import { validateConsultationTransition } from '@/lib/validation';

describe('Consultation State Transitions', () => {
  test('scheduled allows toggle_complete, reschedule, and cancel', () => {
    expect(
      validateConsultationTransition(
        { status: 'scheduled' },
        { action: 'toggle_complete', completed: true },
      ).valid,
    ).toBe(true);

    expect(
      validateConsultationTransition(
        { status: 'scheduled' },
        {
          action: 'reschedule',
          startsAt: '2026-12-05T10:00:00.000Z',
          endsAt: '2026-12-05T11:00:00.000Z',
        },
      ).valid,
    ).toBe(true);

    expect(
      validateConsultationTransition({ status: 'scheduled' }, { action: 'cancel' })
        .valid,
    ).toBe(true);
  });

  test('completed allows toggling back to incomplete, rejects reschedule and cancel', () => {
    expect(
      validateConsultationTransition(
        { status: 'completed' },
        { action: 'toggle_complete', completed: false },
      ).valid,
    ).toBe(true);

    expect(
      validateConsultationTransition(
        { status: 'completed' },
        {
          action: 'reschedule',
          startsAt: '2026-12-05T10:00:00.000Z',
          endsAt: '2026-12-05T11:00:00.000Z',
        },
      ).valid,
    ).toBe(false);

    expect(
      validateConsultationTransition({ status: 'completed' }, { action: 'cancel' })
        .valid,
    ).toBe(false);
  });

  test('cancelled rejects all state mutations', () => {
    expect(
      validateConsultationTransition(
        { status: 'cancelled' },
        { action: 'toggle_complete', completed: true },
      ).valid,
    ).toBe(false);

    expect(
      validateConsultationTransition(
        { status: 'cancelled' },
        {
          action: 'reschedule',
          startsAt: '2026-12-05T10:00:00.000Z',
          endsAt: '2026-12-05T11:00:00.000Z',
        },
      ).valid,
    ).toBe(false);

    expect(
      validateConsultationTransition({ status: 'cancelled' }, { action: 'cancel' })
        .valid,
    ).toBe(false);
  });
});
