'use client';

import {
  Alert,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconBan,
  IconCalendarPlus,
  IconCalendarTime,
  IconCheck,
  IconRotateClockwise,
  IconSearch,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { BookConsultationModal } from '@/components/consultations/BookConsultationModal';
import { CancelConsultationModal } from '@/components/consultations/CancelConsultationModal';
import { ConsultationStatsCards } from '@/components/consultations/ConsultationStatsCards';
import { formatConsultationRange } from '@/components/consultations/date-utils';
import { RescheduleModal } from '@/components/consultations/RescheduleModal';
import { StatusBadge } from '@/components/consultations/StatusBadge';
import { PermissionGuard } from '@/components/layout/PermissionGuard';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import {
  consultationMutationResponseSchema,
  consultationStatusFilterSchema,
  ownConsultationsResponseSchema,
} from '@/lib/contracts';
import { PERMISSIONS } from '@/lib/permissions';
import type {
  Consultation,
  ConsultationStats,
  ConsultationStatusFilter,
} from '@/lib/types';
import { toggleCompleteConsultationSchema } from '@/lib/validation';

const EMPTY_STATS: ConsultationStats = {
  total: 0,
  scheduled: 0,
  completed: 0,
  cancelled: 0,
};

function StudentDashboardContent() {
  const { auth, hasPermission } = useAuth();
  const { locale, messages } = useI18n();
  const canReadOwn = hasPermission(PERMISSIONS.CONSULTATIONS_READ_OWN);
  const canCreateOwn = hasPermission(PERMISSIONS.CONSULTATIONS_CREATE_OWN);
  const canUpdateOwn = hasPermission(PERMISSIONS.CONSULTATIONS_UPDATE_OWN);
  const canCancelOwn = hasPermission(PERMISSIONS.CONSULTATIONS_CANCEL_OWN);

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [stats, setStats] = useState<ConsultationStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<ConsultationStatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchText, 200);
  const [reloadTick, setReloadTick] = useState(0);

  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Consultation | null>(
    null,
  );
  const [cancelTarget, setCancelTarget] = useState<Consultation | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const triggerReload = () => setReloadTick((n) => n + 1);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!canReadOwn) {
        if (active) setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set('status', statusFilter);
        if (debouncedSearch.trim()) {
          params.set('search', debouncedSearch.trim());
        }

        const res = await apiRequest(`/api/consultations?${params.toString()}`, {
          cache: 'no-store',
          responseSchema: ownConsultationsResponseSchema,
        });

        if (!active) return;
        setConsultations(res.consultations);
        setStats(res.stats);
        setErrorMsg(null);
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err instanceof ClientApiError
            ? err.message
            : messages.dashboard.loadError,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [canReadOwn, statusFilter, debouncedSearch, reloadTick, messages.dashboard.loadError]);

  const handleToggleComplete = async (item: Consultation) => {
    const nextCompleted = item.status !== 'completed';
    setTogglingId(item.id);
    try {
      await apiRequest(`/api/consultations/${item.id}`, {
        method: 'PATCH',
        requestSchema: toggleCompleteConsultationSchema,
        responseSchema: consultationMutationResponseSchema,
        body: {
          action: 'toggle_complete',
          completed: nextCompleted,
        },
      });
      notifications.show({
        color: nextCompleted ? 'teal' : 'blue',
        title: nextCompleted
          ? messages.dashboard.notifications.markedCompleteTitle
          : messages.dashboard.notifications.markedIncompleteTitle,
        message: nextCompleted
          ? messages.dashboard.notifications.markedCompleteBody
          : messages.dashboard.notifications.markedIncompleteBody,
      });
      triggerReload();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: messages.dashboard.notifications.updateFailedTitle,
        message:
          err instanceof ClientApiError
            ? err.message
            : messages.dashboard.notifications.updateFailedBody,
      });
    } finally {
      setTogglingId(null);
    }
  };

  const renderActions = (item: Consultation) => {
    const isCancelled = item.status === 'cancelled';
    const isCompleted = item.status === 'completed';

    return (
      <Group gap="xs" wrap="wrap">
        {canUpdateOwn && !isCancelled && (
          <Button
            size="xs"
            variant={isCompleted ? 'light' : 'filled'}
            color={isCompleted ? 'blue' : 'teal'}
            loading={togglingId === item.id}
            leftSection={
              isCompleted ? (
                <IconRotateClockwise size={14} />
              ) : (
                <IconCheck size={14} />
              )
            }
            onClick={() => void handleToggleComplete(item)}
            data-testid={`toggle-complete-${item.id}`}
          >
            {isCompleted
              ? messages.dashboard.actions.markIncomplete
              : messages.dashboard.actions.markComplete}
          </Button>
        )}

        {canUpdateOwn && item.status === 'scheduled' && (
          <Button
            size="xs"
            variant="light"
            color="indigo"
            leftSection={<IconCalendarTime size={14} />}
            onClick={() => setRescheduleTarget(item)}
            data-testid={`reschedule-${item.id}`}
          >
            {messages.dashboard.actions.reschedule}
          </Button>
        )}

        {canCancelOwn && item.status === 'scheduled' && (
          <Button
            size="xs"
            variant="subtle"
            color="red"
            leftSection={<IconBan size={14} />}
            onClick={() => setCancelTarget(item)}
            data-testid={`cancel-${item.id}`}
          >
            {messages.dashboard.actions.cancel}
          </Button>
        )}
      </Group>
    );
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <div>
          <Title order={2}>{messages.dashboard.title}</Title>
          <Text size="sm" c="dimmed">
            {messages.dashboard.subtitle}
          </Text>
        </div>

        {canCreateOwn && (
          <Button
            leftSection={<IconCalendarPlus size={18} />}
            onClick={() => setBookModalOpen(true)}
            data-testid="open-booking-modal-button"
          >
            {messages.dashboard.bookButton}
          </Button>
        )}
      </Group>

      {canReadOwn && <ConsultationStatsCards stats={stats} />}

      {!canReadOwn ? (
        <Alert
          color="blue"
          variant="light"
          icon={<IconAlertCircle size={18} />}
          title={messages.dashboard.bookingOnlyTitle}
        >
          {messages.dashboard.bookingOnlyBody}
        </Alert>
      ) : (
        <Paper withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <SegmentedControl
                value={statusFilter}
                onChange={(val) => {
                  const parsed = consultationStatusFilterSchema.safeParse(val);
                  if (parsed.success) {
                    setStatusFilter(parsed.data);
                  }
                }}
                data={[
                  { label: messages.consultationStatus.all, value: 'all' },
                  {
                    label: messages.consultationStatus.scheduled,
                    value: 'scheduled',
                  },
                  {
                    label: messages.consultationStatus.completed,
                    value: 'completed',
                  },
                  {
                    label: messages.consultationStatus.cancelled,
                    value: 'cancelled',
                  },
                ]}
              />

              <TextInput
                placeholder={messages.dashboard.searchPlaceholder}
                leftSection={<IconSearch size={16} />}
                value={searchText}
                onChange={(e) => setSearchText(e.currentTarget.value)}
                w={{ base: '100%', sm: 280 }}
                aria-label={messages.dashboard.searchAriaLabel}
              />
            </Group>

            {errorMsg && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
                {errorMsg}
              </Alert>
            )}

            {loading ? (
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            ) : consultations.length === 0 ? (
              <Center py="xl">
                <Stack align="center" gap="xs">
                  <Text fw={600}>{messages.dashboard.emptyTitle}</Text>
                  <Text size="sm" c="dimmed" ta="center">
                    {statusFilter === 'all' && !searchText
                      ? messages.dashboard.emptyDefaultSubtitle
                      : messages.dashboard.emptyFilteredSubtitle}
                  </Text>
                  {canCreateOwn && statusFilter === 'all' && !searchText && (
                    <Button
                      variant="light"
                      size="sm"
                      mt="xs"
                      leftSection={<IconCalendarPlus size={16} />}
                      onClick={() => setBookModalOpen(true)}
                    >
                      {messages.dashboard.emptyBookButton}
                    </Button>
                  )}
                </Stack>
              </Center>
            ) : (
              <>
                <Table.ScrollContainer minWidth={720} visibleFrom="md">
                  <Table striped highlightOnHover verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{messages.dashboard.tableHeaders.attendee}</Table.Th>
                        <Table.Th>{messages.dashboard.tableHeaders.reason}</Table.Th>
                        <Table.Th>{messages.dashboard.tableHeaders.schedule}</Table.Th>
                        <Table.Th>{messages.dashboard.tableHeaders.status}</Table.Th>
                        <Table.Th>{messages.dashboard.tableHeaders.actions}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {consultations.map((item) => (
                        <Table.Tr
                          key={item.id}
                          data-testid={`consultation-row-${item.id}`}
                        >
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {item.firstName} {item.lastName}
                            </Text>
                          </Table.Td>
                          <Table.Td maw={320}>
                            <Text size="sm" lineClamp={2}>
                              {item.reason}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {formatConsultationRange(
                                item.startsAt,
                                item.endsAt,
                                locale,
                              )}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <StatusBadge status={item.status} />
                          </Table.Td>
                          <Table.Td>{renderActions(item)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>

                <Stack gap="sm" hiddenFrom="md">
                  {consultations.map((item) => (
                    <Card
                      key={item.id}
                      padding="md"
                      data-testid={`consultation-card-${item.id}`}
                    >
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <div>
                            <Text fw={600} size="sm">
                              {item.firstName} {item.lastName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatConsultationRange(
                                item.startsAt,
                                item.endsAt,
                                locale,
                              )}
                            </Text>
                          </div>
                          <StatusBadge status={item.status} />
                        </Group>

                        <Text size="sm">{item.reason}</Text>

                        {renderActions(item)}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        </Paper>
      )}

      <BookConsultationModal
        opened={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        defaultFirstName={auth?.user.firstName ?? ''}
        defaultLastName={auth?.user.lastName ?? ''}
        onCreated={triggerReload}
      />

      <RescheduleModal
        consultation={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onUpdated={triggerReload}
      />

      <CancelConsultationModal
        consultation={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={triggerReload}
      />
    </Stack>
  );
}

export default function DashboardPage() {
  return (
    <PermissionGuard
      required={[
        PERMISSIONS.CONSULTATIONS_READ_OWN,
        PERMISSIONS.CONSULTATIONS_CREATE_OWN,
      ]}
      mode="any"
    >
      <StudentDashboardContent />
    </PermissionGuard>
  );
}
