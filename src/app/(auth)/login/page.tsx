import { LoginForm } from '@/components/auth/LoginForm';
import { sanitizeRedirectPath } from '@/lib/http';

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next ? sanitizeRedirectPath(params.next, '') : '';

  return (
    <LoginForm
      nextPath={nextPath || undefined}
      errorCode={params.error}
    />
  );
}
