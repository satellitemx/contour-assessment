'use client';

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconShieldCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { apiRequest, ClientApiError } from '@/lib/api-client';
import { roleMutationResponseSchema } from '@/lib/contracts';
import { createRoleFormSchema, zodFormValidate } from '@/lib/form-zod';
import { formatMessage } from '@/lib/i18n';
import {
  PERMISSION_CATALOG,
  slugifyRoleName,
  type PermissionCatalogEntry,
} from '@/lib/permissions';
import type { PermissionKey, RoleSummary } from '@/lib/types';
import { createRoleSchema, updateRoleSchema } from '@/lib/validation';

interface RoleEditorModalProps {
  opened: boolean;
  editingRole: RoleSummary | null;
  onClose: () => void;
  onSaved: () => void;
}

const GROUPS: Array<PermissionCatalogEntry['group']> = [
  'Student Consultations',
  'System Administration',
  'Access Control',
];

function RoleEditorForm({
  editingRole,
  onClose,
  onSaved,
}: {
  editingRole: RoleSummary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { messages } = useI18n();
  const isEditing = Boolean(editingRole);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      name: editingRole?.name ?? '',
      slug: editingRole?.slug ?? '',
      description: editingRole?.description ?? '',
      isDefault: editingRole?.isDefault ?? false,
      permissionKeys: (editingRole?.permissionKeys ?? []) as PermissionKey[],
    },
    validate: zodFormValidate(createRoleFormSchema(messages)),
  });

  const togglePermission = (key: PermissionKey, checked: boolean) => {
    const current = new Set(form.values.permissionKeys);
    if (checked) current.add(key);
    else current.delete(key);
    form.setFieldValue('permissionKeys', Array.from(current));
  };

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const trimmedName = values.name.trim();
      if (editingRole) {
        await apiRequest(`/api/admin/roles/${editingRole.id}`, {
          method: 'PATCH',
          requestSchema: updateRoleSchema,
          responseSchema: roleMutationResponseSchema,
          body: {
            name: trimmedName,
            description: values.description.trim(),
            isDefault: values.isDefault,
            permissionKeys: values.permissionKeys,
          },
        });
        notifications.show({
          color: 'indigo',
          title: messages.roleEditor.updatedTitle,
          message: formatMessage(messages.roleEditor.updatedBody, {
            name: trimmedName,
          }),
        });
      } else {
        await apiRequest('/api/admin/roles', {
          method: 'POST',
          requestSchema: createRoleSchema,
          responseSchema: roleMutationResponseSchema,
          body: {
            name: trimmedName,
            slug: values.slug.trim() || slugifyRoleName(values.name),
            description: values.description.trim(),
            isDefault: values.isDefault,
            permissionKeys: values.permissionKeys,
          },
        });
        notifications.show({
          color: 'teal',
          title: messages.roleEditor.createdTitle,
          message: formatMessage(messages.roleEditor.createdBody, {
            name: trimmedName,
            count: values.permissionKeys.length,
          }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof ClientApiError
          ? err.message
          : messages.roleEditor.saveError,
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
            label={messages.roleEditor.nameLabel}
            placeholder={messages.roleEditor.namePlaceholder}
            required
            value={form.values.name}
            error={form.errors.name}
            onChange={(e) => {
              const nextName = e.currentTarget.value;
              form.setFieldValue('name', nextName);
              if (!isEditing) {
                form.setFieldValue('slug', slugifyRoleName(nextName));
              }
            }}
          />

          <TextInput
            label={messages.roleEditor.slugLabel}
            placeholder={messages.roleEditor.slugPlaceholder}
            disabled={isEditing}
            description={
              isEditing
                ? messages.roleEditor.slugLockedHint
                : messages.roleEditor.slugEditableHint
            }
            {...form.getInputProps('slug')}
          />
        </Group>

        <Textarea
          label={messages.roleEditor.descriptionLabel}
          placeholder={messages.roleEditor.descriptionPlaceholder}
          minRows={2}
          autosize
          {...form.getInputProps('description')}
        />

        <Switch
          label={messages.roleEditor.defaultSwitchLabel}
          description={messages.roleEditor.defaultSwitchDescription}
          checked={form.values.isDefault}
          onChange={(e) =>
            form.setFieldValue('isDefault', e.currentTarget.checked)
          }
        />

        <Divider
          label={messages.roleEditor.composeDivider}
          labelPosition="left"
        />

        {form.errors.permissionKeys && (
          <Text size="xs" c="red">
            {form.errors.permissionKeys}
          </Text>
        )}

        <Stack gap="sm">
          {GROUPS.map((group) => {
            const entries = PERMISSION_CATALOG.filter((p) => p.group === group);
            return (
              <Paper key={group} withBorder p="sm">
                <Stack gap="xs">
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                    {messages.permissions.groups[group]}
                  </Text>
                  {entries.map((entry) => {
                    const checked = form.values.permissionKeys.includes(entry.key);
                    const localizedEntry = messages.permissions.entries[entry.key];
                    return (
                      <Checkbox
                        key={entry.key}
                        checked={checked}
                        onChange={(e) =>
                          togglePermission(entry.key, e.currentTarget.checked)
                        }
                        label={
                          <Group gap="xs" wrap="wrap">
                            <Text size="sm" fw={500}>
                              {localizedEntry.label}
                            </Text>
                            <Badge size="xs" variant="light" color="indigo">
                              {entry.key}
                            </Badge>
                          </Group>
                        }
                        description={localizedEntry.description}
                      />
                    );
                  })}
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            {messages.common.cancel}
          </Button>
          <Button
            type="submit"
            loading={submitting}
            leftSection={<IconShieldCheck size={18} />}
          >
            {isEditing
              ? messages.roleEditor.saveButton
              : messages.roleEditor.createButton}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function RoleEditorModal({
  opened,
  editingRole,
  onClose,
  onSaved,
}: RoleEditorModalProps) {
  const { messages } = useI18n();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        editingRole
          ? `${messages.roleEditor.editTitlePrefix} ${editingRole.name}`
          : messages.roleEditor.createTitle
      }
      size="lg"
    >
      {opened && (
        <RoleEditorForm
          key={editingRole?.id ?? 'new'}
          editingRole={editingRole}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}
