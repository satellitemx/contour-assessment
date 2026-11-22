import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as signupPost } from '@/app/api/auth/signup/route';
import { PATCH as patchConsultation } from '@/app/api/consultations/[id]/route';
import {
  GET as getConsultations,
  POST as postConsultation,
} from '@/app/api/consultations/route';
import {
  apiErrorBodySchema,
  consultationMutationResponseSchema,
  ownConsultationsResponseSchema,
} from '@/lib/contracts';
import { setTestRepository } from '@/lib/repositories';
import { createTestRepo, jsonRequest } from './helpers';

describe('Student Consultations API Integration', () => {
  beforeEach(async () => {
    const { repo } = createTestRepo();
    setTestRepository(repo);
    await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'student@example.org',
        password: 'ChangeMe123!',
      }),
    );
  });

  afterEach(() => {
    setTestRepository(null);
  });

  test('full consultation lifecycle: book -> complete -> incomplete -> reschedule -> cancel', async () => {
    const start1 = '2026-12-10T10:00:00.000Z';
    const end1 = '2026-12-10T11:00:00.000Z';

    const createRes = await postConsultation(
      jsonRequest('http://localhost:3000/api/consultations', 'POST', {
        firstName: 'Maya',
        lastName: 'Lin',
        reason: 'Final capstone system design review',
        startsAt: start1,
        endsAt: end1,
      }),
    );
    expect(createRes.status).toBe(201);
    const { consultation } = consultationMutationResponseSchema.parse(await createRes.json());
    expect(consultation.status).toBe('scheduled');
    expect(consultation.reason).toBe('Final capstone system design review');

    // Mark complete
    const completeRes = await patchConsultation(
      jsonRequest(`http://localhost:3000/api/consultations/${consultation.id}`, 'PATCH', {
        action: 'toggle_complete',
        completed: true,
      }),
      { params: Promise.resolve({ id: consultation.id }) },
    );
    expect(completeRes.status).toBe(200);
    const completedData = consultationMutationResponseSchema.parse(await completeRes.json());
    expect(completedData.consultation.status).toBe('completed');
    expect(completedData.consultation.completedAt).toBeTruthy();

    // Mark incomplete
    const incompleteRes = await patchConsultation(
      jsonRequest(`http://localhost:3000/api/consultations/${consultation.id}`, 'PATCH', {
        action: 'toggle_complete',
        completed: false,
      }),
      { params: Promise.resolve({ id: consultation.id }) },
    );
    expect(incompleteRes.status).toBe(200);
    const incompleteData = consultationMutationResponseSchema.parse(await incompleteRes.json());
    expect(incompleteData.consultation.status).toBe('scheduled');
    expect(incompleteData.consultation.completedAt).toBeNull();

    // Reschedule
    const start2 = '2026-12-12T14:00:00.000Z';
    const end2 = '2026-12-12T15:30:00.000Z';
    const rescheduleRes = await patchConsultation(
      jsonRequest(`http://localhost:3000/api/consultations/${consultation.id}`, 'PATCH', {
        action: 'reschedule',
        startsAt: start2,
        endsAt: end2,
      }),
      { params: Promise.resolve({ id: consultation.id }) },
    );
    expect(rescheduleRes.status).toBe(200);
    const rescheduledData = consultationMutationResponseSchema.parse(await rescheduleRes.json());
    expect(rescheduledData.consultation.startsAt).toBe(start2);
    expect(rescheduledData.consultation.endsAt).toBe(end2);

    // Cancel
    const cancelRes = await patchConsultation(
      jsonRequest(`http://localhost:3000/api/consultations/${consultation.id}`, 'PATCH', {
        action: 'cancel',
      }),
      { params: Promise.resolve({ id: consultation.id }) },
    );
    expect(cancelRes.status).toBe(200);
    const cancelledData = consultationMutationResponseSchema.parse(await cancelRes.json());
    expect(cancelledData.consultation.status).toBe('cancelled');

    // Further mutation on cancelled booking returns 409
    const rejectedRes = await patchConsultation(
      jsonRequest(`http://localhost:3000/api/consultations/${consultation.id}`, 'PATCH', {
        action: 'toggle_complete',
        completed: true,
      }),
      { params: Promise.resolve({ id: consultation.id }) },
    );
    expect(rejectedRes.status).toBe(409);
    apiErrorBodySchema.parse(await rejectedRes.json());
  });

  test('filter and search consultations returns accurate subset and overall stats', async () => {
    const res = await getConsultations(
      new Request('http://localhost:3000/api/consultations?status=completed&search=Algorithms'),
    );
    expect(res.status).toBe(200);
    const data = ownConsultationsResponseSchema.parse(await res.json());
    expect(data.consultations).toHaveLength(1);
    expect(data.consultations[0].status).toBe('completed');
    expect(data.stats.total).toBe(3);
  });

  test('student cannot access or modify another student consultation (ownership isolation)', async () => {
    const createRes = await postConsultation(
      jsonRequest('http://localhost:3000/api/consultations', 'POST', {
        firstName: 'Maya',
        lastName: 'Lin',
        reason: 'Private thesis check-in',
        startsAt: '2026-12-15T10:00:00.000Z',
        endsAt: '2026-12-15T11:00:00.000Z',
      }),
    );
    const { consultation } = await createRes.json();

    // Sign up a second student (automatically switches test session to second student)
    await signupPost(
      jsonRequest('http://localhost:3000/api/auth/signup', 'POST', {
        email: 'other.student@example.org',
        password: 'Password123!',
        firstName: 'Sam',
        lastName: 'Reed',
      }),
    );

    const listRes = await getConsultations(
      new Request('http://localhost:3000/api/consultations'),
    );
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.consultations).toHaveLength(0);

    const hijackRes = await patchConsultation(
      jsonRequest(`http://localhost:3000/api/consultations/${consultation.id}`, 'PATCH', {
        action: 'cancel',
      }),
      { params: Promise.resolve({ id: consultation.id }) },
    );
    expect(hijackRes.status).toBe(404);
  });

  test('user without student consultation attributes gets 403', async () => {
    await loginPost(
      jsonRequest('http://localhost:3000/api/auth/login', 'POST', {
        email: 'auditor@example.org',
        password: 'ChangeMe123!',
      }),
    );

    const getRes = await getConsultations(
      new Request('http://localhost:3000/api/consultations'),
    );
    expect(getRes.status).toBe(403);

    const postRes = await postConsultation(
      jsonRequest('http://localhost:3000/api/consultations', 'POST', {
        firstName: 'Jordan',
        lastName: 'Patel',
        reason: 'Should be forbidden',
        startsAt: '2026-12-15T10:00:00.000Z',
        endsAt: '2026-12-15T11:00:00.000Z',
      }),
    );
    expect(postRes.status).toBe(403);
  });
});
