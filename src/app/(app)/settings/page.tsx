'use client';

import {
  Alert,
  Badge,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconDeviceFloppy, IconLanguage } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { localeSchema, userSettingsResponseSchema } from '@/lib/contracts';
import type { AuthUserContext, Locale, UserProfile } from '@/lib/types';
import { updateUserSettingsSchema } from '@/lib/validation';

function SettingsForm({
  auth,
  onUpdated,
}: {
  auth: AuthUserContext;
  onUpdated: (updatedUser: UserProfile) => void;
}) {
  const { messages } = useI18n();
  const [selectedLocale, setSelectedLocale] = useState<Locale>(
    auth.user.preferredLocale,
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fullName =
    `${auth.user.firstName} ${auth.user.lastName}`.trim() || auth.user.email;
  const isDirty = selectedLocale !== auth.user.preferredLocale;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest('/api/user/settings', {
        method: 'PATCH',
        requestSchema: updateUserSettingsSchema,
        responseSchema: userSettingsResponseSchema,
        body: { preferredLocale: selectedLocale },
      });
      onUpdated(res.user);
      notifications.show({
        color: 'teal',
        title: messages.settings.savedTitle,
        message: messages.settings.savedBody,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof ClientApiError
          ? err.message
          : messages.settings.saveError,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="lg" maw={640}>
      <div>
        <Title order={2}>{messages.settings.title}</Title>
        <Text size="sm" c="dimmed">
          {messages.settings.subtitle}
        </Text>
      </div>

      <Paper withBorder p="lg">
        <Stack gap="md">
          <Title order={4}>{messages.settings.profileSectionTitle}</Title>

          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="sm" c="dimmed">
              {messages.settings.fullNameLabel}
            </Text>
            <Text size="sm" fw={600}>
              {fullName}
            </Text>
          </Group>

          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="sm" c="dimmed">
              {messages.settings.emailLabel}
            </Text>
            <Text size="sm" fw={500}>
              {auth.user.email}
            </Text>
          </Group>

          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
            <Text size="sm" c="dimmed">
              {messages.settings.rolesLabel}
            </Text>
            <Group gap={6} wrap="wrap">
              {auth.roles.length > 0 ? (
                auth.roles.map((role) => (
                  <Badge key={role.id} size="sm" variant="light" color="indigo">
                    {role.name}
                  </Badge>
                ))
              ) : (
                <Badge size="sm" variant="light" color="gray">
                  {messages.nav.noRolesAssigned}
                </Badge>
              )}
            </Group>
          </Group>

          <Divider my="xs" />

          <form onSubmit={handleSave}>
            <Stack gap="md">
              <Title order={4}>{messages.settings.languageSectionTitle}</Title>

              {errorMsg && (
                <Alert
                  color="red"
                  variant="light"
                  icon={<IconAlertCircle size={18} />}
                  role="alert"
                >
                  {errorMsg}
                </Alert>
              )}

              <Select
                label={messages.settings.languageLabel}
                description={messages.settings.languageDescription}
                leftSection={<IconLanguage size={16} />}
                allowDeselect={false}
                value={selectedLocale}
                onChange={(val) => {
                  const parsed = localeSchema.safeParse(val);
                  if (parsed.success) {
                    setSelectedLocale(parsed.data);
                  }
                }}
                data={[
                  { value: 'en', label: messages.common.englishOption },
                  {
                    value: 'zh-CN',
                    label: `${messages.common.simplifiedChineseOption} (Chinese, Simplified)`,
                  },
                ]}
                data-testid="settings-language-select"
              />

              <Group justify="flex-end">
                <Button
                  type="submit"
                  loading={saving}
                  disabled={!isDirty}
                  leftSection={<IconDeviceFloppy size={16} />}
                  data-testid="save-settings-button"
                >
                  {messages.settings.saveButton}
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Stack>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { auth, loading, setAuth } = useAuth();
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
            {messages.common.loading}
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <SettingsForm
      key={auth.user.id}
      auth={auth}
      onUpdated={(updatedUser) => {
        setAuth({ ...auth, user: updatedUser });
        router.refresh();
      }}
    />
  );
}
