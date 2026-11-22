import { redirect } from 'next/navigation';
import { getDefaultLandingRoute } from '@/lib/permissions';
import { getLmsRepository } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const repo = getLmsRepository();
  const auth = await repo.getCurrentUser();

  if (!auth) {
    redirect('/login');
  }

  redirect(getDefaultLandingRoute(auth.effectivePermissions));
}
