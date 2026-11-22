'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconEdit,
  IconPlus,
  IconShieldLock,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { PermissionGuard } from '@/components/layout/PermissionGuard';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/I18nProvider';
import { RoleEditorModal } from '@/components/roles/RoleEditorModal';
import { UserRolesSection } from '@/components/roles/UserRolesSection';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { formatMessage } from '@/lib/i18n';
import { PERMISSIONS } from '@/lib/permissions';
import type { RoleSummary, UserWithRoles } from '@/lib/types';

function AdminRolesContent() {
  const { hasPermission, refreshAuth } = useAuth();
  const { messages } = useI18n();
  const canManageRoles = hasPermission(PERMISSIONS.ROLES_MANAGE);
  const canAssignRoles = hasPermission(PERMISSIONS.USERS_ASSIGN_ROLES);

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [editorOpened, setEditorOpened] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [rolesRes, usersRes] = await Promise.all([
          apiRequest<{ roles: RoleSummary[] }>('/api/admin/roles', {
            cache: 'no-store',
          }),
          apiRequest<{ users: UserWithRoles[] }>('/api/admin/users', {
            cache: 'no-store',
          }),
        ]);
        if (!active) return;
        setRoles(rolesRes.roles);
        setUsers(usersRes.users);
        setErrorMsg(null);
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err instanceof ClientApiError ? err.message : messages.roles.loadError,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadTick, messages.roles.loadError]);

  const handleAfterMutation = async () => {
    setReloadTick((n) => n + 1);
    await refreshAuth();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/roles/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      notifications.show({
        color: 'gray',
        title: messages.roles.deletedTitle,
        message: formatMessage(messages.roles.deletedBody, {
          name: deleteTarget.name,
        }),
      });
      setDeleteTarget(null);
      await handleAfterMutation();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: messages.roles.deleteFailedTitle,
        message:
          err instanceof ClientApiError
            ? err.message
            : messages.roles.deleteFailedBody,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <div>
          <Title order={2}>{messages.roles.title}</Title>
          <Text size="sm" c="dimmed">
            {messages.roles.subtitle}
          </Text>
        </div>

        {canManageRoles && (
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => {
              setEditingRole(null);
              setEditorOpened(true);
            }}
            data-testid="create-role-button"
          >
            {messages.roles.createButton}
          </Button>
        )}
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
      ) : (
        <Paper withBorder p="md">
          <Tabs defaultValue="roles">
            <Tabs.List mb="md">
              <Tabs.Tab value="roles" leftSection={<IconShieldLock size={16} />}>
                {formatMessage(messages.roles.rolesTab, { count: roles.length })}
              </Tabs.Tab>
              <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
                {formatMessage(messages.roles.usersTab, { count: users.length })}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="roles">
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {roles.map((role) => (
                  <Card
                    key={role.id}
                    padding="md"
                    data-testid={`role-card-${role.slug}`}
                  >
                    <Stack gap="sm" h="100%" justify="space-between">
                      <Stack gap="xs">
                        <Group justify="space-between" align="flex-start" wrap="wrap">
                          <div>
                            <Group gap="xs" align="center" wrap="wrap">
                              <Text fw={700} size="md">
                                {role.name}
                              </Text>
                              {role.isSystem && (
                                <Badge size="xs" color="violet" variant="light">
                                  {messages.roles.systemBadge}
                                </Badge>
                              )}
                              {role.isDefault && (
                                <Badge size="xs" color="teal" variant="light">
                                  {messages.roles.defaultBadge}
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {messages.roles.slugLabel} <code>{role.slug}</code> ·{' '}
                              {role.userCount}{' '}
                              {role.userCount === 1
                                ? messages.roles.userSingular
                                : messages.roles.userPlural}
                            </Text>
                          </div>
                        </Group>

                        {role.description && (
                          <Text size="sm" c="dimmed">
                            {role.description}
                          </Text>
                        )}

                        <div>
                          <Text size="xs" fw={600} c="dimmed" mb={6}>
                            {formatMessage(
                              messages.roles.composedAttributesLabel,
                              { count: role.permissionKeys.length },
                            )}
                          </Text>
                          <Group gap={6} wrap="wrap">
                            {role.permissionKeys.map((perm) => (
                              <Badge
                                key={perm}
                                size="xs"
                                variant="light"
                                color="indigo"
                              >
                                {perm}
                              </Badge>
                            ))}
                          </Group>
                        </div>
                      </Stack>

                      {canManageRoles && (
                        <Group justify="flex-end" gap="xs" pt="xs">
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconEdit size={14} />}
                            onClick={() => {
                              setEditingRole(role);
                              setEditorOpened(true);
                            }}
                            data-testid={`edit-role-${role.slug}`}
                          >
                            {messages.roles.editButton}
                          </Button>

                          {!role.isSystem && !role.isDefault && (
                            <Button
                              size="xs"
                              variant="subtle"
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => setDeleteTarget(role)}
                              data-testid={`delete-role-${role.slug}`}
                            >
                              {messages.roles.deleteButton}
                            </Button>
                          )}
                        </Group>
                      )}
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            </Tabs.Panel>

            <Tabs.Panel value="users">
              <UserRolesSection
                users={users}
                roles={roles}
                canAssignRoles={canAssignRoles}
                onUpdated={handleAfterMutation}
              />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      )}

      <RoleEditorModal
        opened={editorOpened}
        editingRole={editingRole}
        onClose={() => setEditorOpened(false)}
        onSaved={() => void handleAfterMutation()}
      />

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={messages.roles.deleteModalTitle}
        size="sm"
      >
        {deleteTarget && (
          <Stack gap="md">
            <Text size="sm">
              {messages.roles.deleteConfirmBefore}{' '}
              <strong>{deleteTarget.name}</strong>?{' '}
              {messages.roles.deleteConfirmAfter}
            </Text>
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                {messages.common.cancel}
              </Button>
              <Button
                color="red"
                loading={deleting}
                onClick={() => void handleConfirmDelete()}
              >
                {messages.roles.deleteRoleConfirmButton}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default function AdminRolesPage() {
  return (
    <PermissionGuard
      required={[
        PERMISSIONS.ROLES_READ,
        PERMISSIONS.ROLES_MANAGE,
        PERMISSIONS.USERS_ASSIGN_ROLES,
      ]}
      mode="any"
    >
      <AdminRolesContent />
    </PermissionGuard>
  );
}
