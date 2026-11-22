'use client';

import {
  Alert,
  Anchor,
  Box,
  Button,
  Center,
  Container,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertCircle,
  IconCheck,
  IconSchool,
  IconUserPlus,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { getDefaultLandingRoute } from '@/lib/permissions';
import type { AuthUserContext } from '@/lib/types';

interface SignupApiResponse {
  user: AuthUserContext | null;
  requiresEmailConfirmation: boolean;
}

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { locale, messages } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const form = useForm({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
    validate: {
      firstName: (value) =>
        value.trim().length > 0 ? null : messages.auth.firstNameRequired,
      lastName: (value) =>
        value.trim().length > 0 ? null : messages.auth.lastNameRequired,
      email: (value) =>
        /^\S+@\S+\.\S+$/.test(value.trim()) ? null : messages.auth.emailInvalid,
      password: (value) =>
        value.length >= 8 ? null : messages.auth.passwordMinError,
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setErrorMsg(null);
    setConfirmationSent(false);
    try {
      const res = await apiRequest<SignupApiResponse>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          password: values.password,
          preferredLocale: locale,
        }),
      });

      if (res.requiresEmailConfirmation || !res.user) {
        setConfirmationSent(true);
        return;
      }

      setAuth(res.user);
      router.replace(getDefaultLandingRoute(res.user.effectivePermissions));
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(messages.auth.signupGenericError);
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Center mih="100vh" py="xl" px="sm">
      <Container size={480} w="100%">
        <Stack align="center" gap="xs" mb="lg">
          <LanguageSwitcher />
          <ThemeIcon size={46} radius="md" color="indigo" variant="filled" mt="xs">
            <IconSchool size={26} />
          </ThemeIcon>
          <Title order={2} ta="center">
            {messages.auth.signupTitle}
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            {messages.auth.signupSubtitle}
          </Text>
        </Stack>

        <Paper withBorder shadow="sm" p="xl">
          {confirmationSent ? (
            <Stack gap="md">
              <Alert
                color="teal"
                variant="light"
                icon={<IconCheck size={18} />}
                title={messages.auth.confirmEmailTitle}
              >
                {messages.auth.confirmEmailBody}
              </Alert>
              <Button component={Link} href="/login" fullWidth>
                {messages.auth.goToSignInButton}
              </Button>
            </Stack>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <Stack gap="md">
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

                <Group grow align="flex-start">
                  <TextInput
                    label={messages.auth.firstNameLabel}
                    placeholder={messages.auth.firstNamePlaceholder}
                    autoComplete="given-name"
                    required
                    {...form.getInputProps('firstName')}
                  />
                  <TextInput
                    label={messages.auth.lastNameLabel}
                    placeholder={messages.auth.lastNamePlaceholder}
                    autoComplete="family-name"
                    required
                    {...form.getInputProps('lastName')}
                  />
                </Group>

                <TextInput
                  label={messages.auth.emailLabel}
                  placeholder={messages.auth.signupEmailPlaceholder}
                  type="email"
                  autoComplete="email"
                  required
                  {...form.getInputProps('email')}
                />

                <PasswordInput
                  label={messages.auth.passwordLabel}
                  placeholder={messages.auth.passwordPlaceholderSignup}
                  autoComplete="new-password"
                  description={messages.auth.passwordDescription}
                  required
                  {...form.getInputProps('password')}
                />

                <Button
                  type="submit"
                  fullWidth
                  loading={submitting}
                  leftSection={<IconUserPlus size={18} />}
                  mt="xs"
                >
                  {messages.auth.createAccountButton}
                </Button>
              </Stack>
            </form>
          )}

          <Box
            mt="lg"
            pt="md"
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            <Text size="sm" ta="center" c="dimmed">
              {messages.auth.hasAccountPrompt}{' '}
              <Anchor component={Link} href="/login" fw={600}>
                {messages.auth.signInLink}
              </Anchor>
            </Text>
          </Box>
        </Paper>
      </Container>
    </Center>
  );
}
