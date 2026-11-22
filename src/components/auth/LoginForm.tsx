'use client';

import {
  Alert,
  Anchor,
  Box,
  Button,
  Center,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconLogin, IconSchool } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { loginResponseSchema } from '@/lib/contracts';
import { createLoginFormSchema, zodFormValidate } from '@/lib/form-zod';
import { getDefaultLandingRoute } from '@/lib/permissions';
import { loginSchema } from '@/lib/validation';

interface LoginFormProps {
  nextPath?: string;
  errorCode?: string;
}

export function LoginForm({ nextPath, errorCode }: LoginFormProps) {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { messages } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorCode === 'auth_callback_failed' ? messages.auth.callbackError : null,
  );

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: zodFormValidate(createLoginFormSchema(messages)),
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const authContext = await apiRequest('/api/auth/login', {
        method: 'POST',
        requestSchema: loginSchema,
        responseSchema: loginResponseSchema,
        body: {
          email: values.email.trim(),
          password: values.password,
        },
      });
      setAuth(authContext);
      const destination =
        nextPath || getDefaultLandingRoute(authContext.effectivePermissions);
      router.replace(destination);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(messages.auth.loginGenericError);
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Center mih="100vh" py="xl" px="sm">
      <Container size={440} w="100%">
        <Stack align="center" gap="xs" mb="lg">
          <LanguageSwitcher />
          <ThemeIcon size={46} radius="md" color="indigo" variant="filled" mt="xs">
            <IconSchool size={26} />
          </ThemeIcon>
          <Title order={2} ta="center">
            {messages.auth.loginTitle}
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            {messages.auth.loginSubtitle}
          </Text>
        </Stack>

        <Paper withBorder shadow="sm" p="xl">
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

              <TextInput
                label={messages.auth.emailLabel}
                placeholder={messages.auth.emailPlaceholder}
                type="email"
                autoComplete="email"
                required
                {...form.getInputProps('email')}
              />

              <PasswordInput
                label={messages.auth.passwordLabel}
                placeholder={messages.auth.passwordPlaceholderLogin}
                autoComplete="current-password"
                required
                {...form.getInputProps('password')}
              />

              <Button
                type="submit"
                fullWidth
                loading={submitting}
                leftSection={<IconLogin size={18} />}
                mt="xs"
              >
                {messages.auth.signInButton}
              </Button>
            </Stack>
          </form>

          <Box
            mt="lg"
            pt="md"
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            <Text size="sm" ta="center" c="dimmed">
              {messages.auth.noAccountPrompt}{' '}
              <Anchor component={Link} href="/signup" fw={600}>
                {messages.auth.createAccountLink}
              </Anchor>
            </Text>
          </Box>
        </Paper>
      </Container>
    </Center>
  );
}
