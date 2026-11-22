'use client';

import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconBan } from '@tabler/icons-react';
import { useState } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import type { Consultation } from '@/lib/types';
import { formatConsultationRange } from './date-utils';

interface CancelConsultationModalProps {
  consultation: Consultation | null;
  onClose: () => void;
  onCancelled: (consultation: Consultation) => void;
}

export function CancelConsultationModal({
  consultation,
  onClose,
  onCancelled,
}: CancelConsultationModalProps) {
  const { locale, messages } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!consultation) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ consultation: Consultation }>(
        `/api/consultations/${consultation.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action: 'cancel' }),
        },
      );
      notifications.show({
        color: 'gray',
        title: messages.cancelModal.successTitle,
        message: messages.cancelModal.successBody,
      });
      onCancelled(res.consultation);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof ClientApiError
          ? err.message
          : messages.cancelModal.errorBody,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={Boolean(consultation)}
      onClose={onClose}
      title={messages.cancelModal.modalTitle}
      size="md"
    >
      {consultation && (
        <Stack gap="md">
          {errorMsg && (
            <Alert color="red" variant="light" role="alert">
              {errorMsg}
            </Alert>
          )}

          <Alert
            color="orange"
            variant="light"
            icon={<IconAlertTriangle size={18} />}
            title={messages.cancelModal.warningTitle}
          >
            {messages.cancelModal.warningBody}
          </Alert>

          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {consultation.firstName} {consultation.lastName}
            </Text>
            <Text size="sm">{consultation.reason}</Text>
            <Text size="xs" c="dimmed">
              {formatConsultationRange(
                consultation.startsAt,
                consultation.endsAt,
                locale,
              )}
            </Text>
          </Stack>

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} disabled={submitting}>
              {messages.cancelModal.keepButton}
            </Button>
            <Button
              color="red"
              loading={submitting}
              leftSection={<IconBan size={18} />}
              onClick={() => void handleConfirm()}
            >
              {messages.cancelModal.confirmButton}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
