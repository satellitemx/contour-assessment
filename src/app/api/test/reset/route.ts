import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isE2ETestMode, jsonOk } from '@/lib/http';
import { getE2ERepository } from '@/lib/repositories';
import { E2E_SESSION_COOKIE_NAME } from '@/lib/repositories/memory-repository';

export async function POST() {
  if (!isE2ETestMode()) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const repo = getE2ERepository();
  repo.reset();

  const cookieStore = await cookies();
  cookieStore.delete(E2E_SESSION_COOKIE_NAME);

  return jsonOk({ reset: true });
}
