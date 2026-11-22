'use client';

import { Alert, Button, Center, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { formatMessage } from '@/lib/i18n';
import {
  getDefaultLandingRoute,
  hasAllPermissions,
  hasAnyPermission,
} from '@/lib/permissions';
import type { PermissionKey } from '@/lib/types';

interface PermissionGuardProps {
  required: PermissionKey[];
  mode?: 'all' | 'any';
  children: React.ReactNode;
}

export function PermissionGuard({
  required,
  mode = 'all',
  children,
}: PermissionGuardProps) {
  const router = useRouter();
  const { auth, loading } = useAuth();
  const { messages } = useI18n();

  useEffect(() => {
    if (!loading && !auth) {
      router.replace('/login');
    }
  }, [loading, auth, router]);

  if (loading || !auth) {
    return (
      <Center py="xl">
        <Stack align="center" gap="xs">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            {messages.permissionGuard.verifying}
          </Text>
        </Stack>
      </Center>
    );
  }

  const allowed =
    mode === 'all'
      ? hasAllPermissions(auth.effectivePermissions, required)
      : hasAnyPermission(auth.effectivePermissions, required);

  if (!allowed) {
    const fallbackRoute = getDefaultLandingRoute(auth.effectivePermissions);
    return (
      <Center py="xl">
        <Paper withBorder p="xl" maw={520} w="100%">
          <Stack gap="md">
            <Alert
              color="red"
              variant="light"
              icon={<IconLock size={20} />}
              title={messages.permissionGuard.restrictedTitle}
            >
              {formatMessage(messages.permissionGuard.restrictedAlert, {
                attributes: required.join(', '),
              })}
            </Alert>
            <Title order={4}>{messages.permissionGuard.insufficientHeading}</Title>
            <Text size="sm" c="dimmed">
              {messages.permissionGuard.insufficientBody}
            </Text>
            {fallbackRoute !== '/no-access' && (
              <Button component={Link} href={fallbackRoute} variant="light">
                {messages.permissionGuard.returnButton}
              </Button>
            )}
          </Stack>
        </Paper>
      </Center>
    );
  }

  return <>{children}</>;
}
