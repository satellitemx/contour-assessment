'use client';

import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCalendarTime } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { consultationMutationResponseSchema } from '@/lib/contracts';
import { createRescheduleFormSchema, zodFormValidate } from '@/lib/form-zod';
import type { Consultation } from '@/lib/types';
import { rescheduleConsultationSchema } from '@/lib/validation';
import {
  MANTINE_DATETIME_FORMAT,
  mantineValueToIso,
  toMantineDateTimeValue,
} from './date-utils';

interface RescheduleModalProps {
  consultation: Consultation | null;
  onClose: () => void;
  onUpdated: (consultation: Consultation) => void;
}

function RescheduleForm({
  consultation,
  onClose,
  onUpdated,
}: {
  consultation: Consultation;
  onClose: () => void;
  onUpdated: (consultation: Consultation) => void;
}) {
  const { locale, messages } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const valueFormat =
    locale === 'zh-CN' ? 'YYYY年M月D日 HH:mm' : 'DD MMM YYYY HH:mm';

  const form = useForm({
    initialValues: {
      startsAt: toMantineDateTimeValue(consultation.startsAt) as string | null,
      endsAt: toMantineDateTimeValue(consultation.endsAt) as string | null,
    },
    validate: zodFormValidate(createRescheduleFormSchema(messages)),
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
      const res = await apiRequest(`/api/consultations/${consultation.id}`, {
        method: 'PATCH',
        requestSchema: rescheduleConsultationSchema,
        responseSchema: consultationMutationResponseSchema,
        body: {
          action: 'reschedule',
          startsAt: startsIso,
          endsAt: endsIso,
        },
      });
      notifications.show({
        color: 'indigo',
        title: messages.reschedule.successTitle,
        message: messages.reschedule.successBody,
      });
      onUpdated(res.consultation);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof ClientApiError
          ? err.message
          : messages.reschedule.errorBody,
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {messages.reschedule.subtitlePrefix}{' '}
          <strong>{consultation.reason}</strong>
        </Text>

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

        <DateTimePicker
          label={messages.reschedule.newStartLabel}
          valueFormat={valueFormat}
          required
          clearable={false}
          timePickerProps={{
            withDropdown: true,
            format: '24h',
            hoursInputLabel: messages.reschedule.startHoursAria,
            minutesInputLabel: messages.reschedule.startMinutesAria,
          }}
          submitButtonProps={{
            'aria-label': messages.reschedule.confirmStartAria,
          }}
          value={form.values.startsAt}
          error={form.errors.startsAt}
          onChange={(val) => {
            form.setFieldValue('startsAt', val);
            if (val && form.values.endsAt) {
              const nextStart = dayjs(val);
              if (!dayjs(form.values.endsAt).isAfter(nextStart)) {
                form.setFieldValue(
                  'endsAt',
                  nextStart.add(1, 'hour').format(MANTINE_DATETIME_FORMAT),
                );
              }
            }
          }}
        />

        <DateTimePicker
          label={messages.reschedule.newEndLabel}
          valueFormat={valueFormat}
          required
          clearable={false}
          timePickerProps={{
            withDropdown: true,
            format: '24h',
            hoursInputLabel: messages.reschedule.endHoursAria,
            minutesInputLabel: messages.reschedule.endMinutesAria,
          }}
          submitButtonProps={{
            'aria-label': messages.reschedule.confirmEndAria,
          }}
          {...form.getInputProps('endsAt')}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            {messages.common.cancel}
          </Button>
          <Button
            type="submit"
            loading={submitting}
            leftSection={<IconCalendarTime size={18} />}
          >
            {messages.reschedule.saveButton}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function RescheduleModal({
  consultation,
  onClose,
  onUpdated,
}: RescheduleModalProps) {
  const { messages } = useI18n();

  return (
    <Modal
      opened={Boolean(consultation)}
      onClose={onClose}
      title={messages.reschedule.modalTitle}
      size="md"
    >
      {consultation && (
        <RescheduleForm
          key={`${consultation.id}-${consultation.updatedAt}`}
          consultation={consultation}
          onClose={onClose}
          onUpdated={onUpdated}
        />
      )}
    </Modal>
  );
}
