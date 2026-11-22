'use client';

import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCalendarPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { consultationMutationResponseSchema } from '@/lib/contracts';
import { createBookingFormSchema, zodFormValidate } from '@/lib/form-zod';
import type { Consultation } from '@/lib/types';
import { createConsultationSchema } from '@/lib/validation';
import {
  getDefaultBookingRange,
  MANTINE_DATETIME_FORMAT,
  mantineValueToIso,
} from './date-utils';

interface BookConsultationModalProps {
  opened: boolean;
  onClose: () => void;
  defaultFirstName: string;
  defaultLastName: string;
  onCreated: (consultation: Consultation) => void;
}

function BookConsultationForm({
  onClose,
  defaultFirstName,
  defaultLastName,
  onCreated,
}: Omit<BookConsultationModalProps, 'opened'>) {
  const { locale, messages } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initialRange = getDefaultBookingRange();

  const valueFormat =
    locale === 'zh-CN' ? 'YYYY年M月D日 HH:mm' : 'DD MMM YYYY HH:mm';

  const form = useForm({
    initialValues: {
      firstName: defaultFirstName,
      lastName: defaultLastName,
      reason: '',
      startsAt: initialRange.startsAt as string | null,
      endsAt: initialRange.endsAt as string | null,
    },
    validate: zodFormValidate(createBookingFormSchema(messages)),
  });

  const handleSubmit = form.onSubmit(async (values) => {
    const startsIso = mantineValueToIso(values.startsAt);
    const endsIso = mantineValueToIso(values.endsAt);

    if (!startsIso || !endsIso) {
      setErrorMsg(messages.booking.invalidRangeError);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest('/api/consultations', {
        method: 'POST',
        requestSchema: createConsultationSchema,
        responseSchema: consultationMutationResponseSchema,
        body: {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          reason: values.reason.trim(),
          startsAt: startsIso,
          endsAt: endsIso,
        },
      });
      notifications.show({
        color: 'teal',
        title: messages.booking.bookedTitle,
        message: messages.booking.bookedBody,
      });
      onCreated(res.consultation);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof ClientApiError
          ? err.message
          : messages.booking.createError,
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
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
            label={messages.booking.firstNameLabel}
            placeholder={messages.auth.firstNamePlaceholder}
            required
            {...form.getInputProps('firstName')}
          />
          <TextInput
            label={messages.booking.lastNameLabel}
            placeholder={messages.auth.lastNamePlaceholder}
            required
            {...form.getInputProps('lastName')}
          />
        </Group>

        <Textarea
          label={messages.booking.reasonLabel}
          placeholder={messages.booking.reasonPlaceholder}
          minRows={3}
          autosize
          required
          {...form.getInputProps('reason')}
        />

        <Group grow align="flex-start">
          <DateTimePicker
            label={messages.booking.startsAtLabel}
            placeholder={messages.booking.startsAtPlaceholder}
            valueFormat={valueFormat}
            required
            clearable={false}
            timePickerProps={{
              withDropdown: true,
              format: '24h',
              hoursInputLabel: messages.booking.startHoursAria,
              minutesInputLabel: messages.booking.startMinutesAria,
            }}
            submitButtonProps={{
              'aria-label': messages.booking.confirmStartAria,
            }}
            value={form.values.startsAt}
            error={form.errors.startsAt}
            onChange={(val) => {
              form.setFieldValue('startsAt', val);
              if (val && form.values.endsAt) {
                const nextStart = dayjs(val);
                const currEnd = dayjs(form.values.endsAt);
                if (!currEnd.isAfter(nextStart)) {
                  form.setFieldValue(
                    'endsAt',
                    nextStart.add(1, 'hour').format(MANTINE_DATETIME_FORMAT),
                  );
                }
              }
            }}
          />

          <DateTimePicker
            label={messages.booking.endsAtLabel}
            placeholder={messages.booking.endsAtPlaceholder}
            valueFormat={valueFormat}
            required
            clearable={false}
            timePickerProps={{
              withDropdown: true,
              format: '24h',
              hoursInputLabel: messages.booking.endHoursAria,
              minutesInputLabel: messages.booking.endMinutesAria,
            }}
            submitButtonProps={{
              'aria-label': messages.booking.confirmEndAria,
            }}
            {...form.getInputProps('endsAt')}
          />
        </Group>

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            {messages.common.cancel}
          </Button>
          <Button
            type="submit"
            loading={submitting}
            leftSection={<IconCalendarPlus size={18} />}
          >
            {messages.booking.confirmButton}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function BookConsultationModal({
  opened,
  onClose,
  defaultFirstName,
  defaultLastName,
  onCreated,
}: BookConsultationModalProps) {
  const { messages } = useI18n();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={messages.booking.modalTitle}
      size="lg"
    >
      {opened && (
        <BookConsultationForm
          key={`${defaultFirstName}-${defaultLastName}`}
          onClose={onClose}
          defaultFirstName={defaultFirstName}
          defaultLastName={defaultLastName}
          onCreated={onCreated}
        />
      )}
    </Modal>
  );
}
