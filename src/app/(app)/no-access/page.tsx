'use client';

import { Alert, Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { IconShieldOff } from '@tabler/icons-react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { getDefaultLandingRoute } from '@/lib/permissions';

export default function NoAccessPage() {
  const { auth, logout } = useAuth();
  const { messages } = useI18n();
  const landing = auth ? getDefaultLandingRoute(auth.effectivePermissions) : '/login';

  return (
    <Center py="xl">
      <Paper withBorder p="xl" maw={520} w="100%">
        <Stack gap="md">
          <Alert
            color="orange"
            variant="light"
            icon={<IconShieldOff size={20} />}
            title={messages.noAccess.alertTitle}
          >
            {messages.noAccess.alertBody}
          </Alert>
          <Title order={4}>{messages.noAccess.heading}</Title>
          <Text size="sm" c="dimmed">
            {messages.noAccess.bodyPrefix} ({auth?.user.email ?? 'current user'}).
          </Text>
          {landing !== '/no-access' ? (
            <Button component={Link} href={landing}>
              {messages.noAccess.openWorkspaceButton}
            </Button>
          ) : (
            <Button variant="light" color="gray" onClick={() => void logout()}>
              {messages.noAccess.signOutButton}
            </Button>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
