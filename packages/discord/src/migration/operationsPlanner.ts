import {
  DISCORD_CATEGORIES,
} from '../blueprint/categories.js';

import {
  DISCORD_CHANNELS,
} from '../blueprint/channels.js';

import {
  DISCORD_ROLES,
} from '../blueprint/roles.js';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  DiscordBindings,
} from './types.js';

import type {
  MigrationOperation,
  MigrationOperationsPlan,
} from './operationTypes.js';

function operationId(
  type: string,
  resourceId: string,
): string {
  return `${type}:${resourceId}`;
}

export function createMigrationOperationsPlan(
  snapshot: DiscordGuildSnapshot,
  bindings: DiscordBindings,
): MigrationOperationsPlan {
  const operations: MigrationOperation[] = [];

  const actualChannelsById =
    new Map(
      snapshot.channels.map(
        (channel) => [
          channel.id,
          channel,
        ],
      ),
    );

  const actualRolesById =
    new Map(
      snapshot.roles.map(
        (role) => [
          role.id,
          role,
        ],
      ),
    );

  const boundActualIds =
    new Set(
      Object.values(
        bindings.resources,
      ),
    );

  // =========================================================
  // CATEGORÍAS
  // =========================================================

  for (
    const category
    of DISCORD_CATEGORIES
  ) {
    const actualId =
      bindings.resources[
        category.id
      ];

    if (!actualId) {
      operations.push({
        id: operationId(
          'create_category',
          category.id,
        ),

        type: 'create_category',

        resourceKind: 'category',

        blueprintId:
          category.id,

        desiredName:
          category.name,

        reason:
          'La categoría del Blueprint no tiene un binding confirmado.',

        requiresConfirmation: true,
      });

      continue;
    }

    const actual =
      actualChannelsById.get(
        actualId,
      );

    if (
      !actual ||
      actual.typeName !==
        'GuildCategory'
    ) {
      operations.push({
        id: operationId(
          'review_binding',
          category.id,
        ),

        type: 'review_binding',

        resourceKind: 'category',

        blueprintId:
          category.id,

        actualId,

        desiredName:
          category.name,

        reason:
          'El binding de la categoría no apunta a una categoría válida del snapshot.',

        requiresConfirmation: true,
      });

      continue;
    }

    if (
      actual.name !==
      category.name
    ) {
      operations.push({
        id: operationId(
          'rename_category',
          category.id,
        ),

        type: 'rename_category',

        resourceKind: 'category',

        blueprintId:
          category.id,

        actualId:
          actual.id,

        currentName:
          actual.name,

        desiredName:
          category.name,

        reason:
          'El nombre actual difiere del nombre definido en el Blueprint.',

        requiresConfirmation: true,
      });
    }
  }

  // =========================================================
  // CANALES
  // =========================================================

  for (
    const channel
    of DISCORD_CHANNELS
  ) {
    const actualId =
      bindings.resources[
        channel.id
      ];

    const desiredParentActualId =
      bindings.resources[
        channel.parentId
      ];

    if (!actualId) {
      operations.push({
        id: operationId(
          'create_channel',
          channel.id,
        ),

        type: 'create_channel',

        resourceKind: 'channel',

        blueprintId:
          channel.id,

        desiredName:
          channel.name,

        desiredParentBlueprintId:
          channel.parentId,

        ...(desiredParentActualId
          ? { desiredParentActualId }
          : {}),

        channelKind:
          channel.kind,

        reason:
          'El canal del Blueprint no tiene un binding confirmado.',

        requiresConfirmation: true,
      });

      continue;
    }

    const actual =
      actualChannelsById.get(
        actualId,
      );

    if (
      !actual ||
      actual.typeName ===
        'GuildCategory'
    ) {
      operations.push({
        id: operationId(
          'review_binding',
          channel.id,
        ),

        type: 'review_binding',

        resourceKind: 'channel',

        blueprintId:
          channel.id,

        actualId,

        desiredName:
          channel.name,

        desiredParentBlueprintId:
          channel.parentId,

        reason:
          'El binding del canal no apunta a un canal válido del snapshot.',

        requiresConfirmation: true,
      });

      continue;
    }

    if (
      actual.name !==
      channel.name
    ) {
      operations.push({
        id: operationId(
          'rename_channel',
          channel.id,
        ),

        type: 'rename_channel',

        resourceKind: 'channel',

        blueprintId:
          channel.id,

        actualId:
          actual.id,

        currentName:
          actual.name,

        desiredName:
          channel.name,

        reason:
          'El nombre actual del canal difiere del Blueprint.',

        requiresConfirmation: true,
      });
    }

    if (
      desiredParentActualId &&
      actual.parentId !==
        desiredParentActualId
    ) {
      operations.push({
        id: operationId(
          'move_channel',
          channel.id,
        ),

        type: 'move_channel',

        resourceKind: 'channel',

        blueprintId:
          channel.id,

        actualId:
          actual.id,

        currentName:
          actual.name,

        desiredName:
          channel.name,

        currentParentId:
          actual.parentId,

        desiredParentBlueprintId:
          channel.parentId,

        desiredParentActualId,

        reason:
          'El canal está dentro de una categoría distinta a la definida en el Blueprint.',

        requiresConfirmation: true,
      });
    }
  }

  // =========================================================
  // ROLES
  // =========================================================

  for (
    const role
    of DISCORD_ROLES
  ) {
    const actualId =
      bindings.resources[
        role.id
      ];

    if (!actualId) {
      operations.push({
        id: operationId(
          'create_role',
          role.id,
        ),

        type: 'create_role',

        resourceKind: 'role',

        blueprintId:
          role.id,

        desiredName:
          role.name,

        reason:
          'El rol del Blueprint no tiene un binding confirmado.',

        requiresConfirmation: true,
      });

      continue;
    }

    const actual =
      actualRolesById.get(
        actualId,
      );

    if (!actual) {
      operations.push({
        id: operationId(
          'review_binding',
          role.id,
        ),

        type: 'review_binding',

        resourceKind: 'role',

        blueprintId:
          role.id,

        actualId,

        desiredName:
          role.name,

        reason:
          'El binding del rol no aparece en el snapshot actual.',

        requiresConfirmation: true,
      });

      continue;
    }

    if (
      actual.managed &&
      actual.name !==
        role.name
    ) {
      operations.push({
        id: operationId(
          'review_managed_role',
          role.id,
        ),

        type: 'review_managed_role',

        resourceKind: 'role',

        blueprintId:
          role.id,

        actualId:
          actual.id,

        currentName:
          actual.name,

        desiredName:
          role.name,

        reason:
          'El rol está administrado por una integración de Discord. Su identidad debe cambiarse desde la aplicación o servicio propietario, no mediante una edición normal de rol.',

        requiresConfirmation: true,
      });

      continue;
    }

    if (
      actual.name !==
      role.name
    ) {
      operations.push({
        id: operationId(
          'rename_role',
          role.id,
        ),

        type: 'rename_role',

        resourceKind: 'role',

        blueprintId:
          role.id,

        actualId:
          actual.id,

        currentName:
          actual.name,

        desiredName:
          role.name,

        reason:
          'El nombre actual del rol difiere del Blueprint.',

        requiresConfirmation: true,
      });
    }
  }

  // =========================================================
  // RECURSOS LEGACY
  // =========================================================

  for (
    const actual
    of snapshot.channels
  ) {
    if (
      boundActualIds.has(
        actual.id,
      )
    ) {
      continue;
    }

    operations.push({
      id: operationId(
        'review_legacy',
        actual.id,
      ),

      type: 'review_legacy',

      resourceKind:
        actual.typeName ===
        'GuildCategory'
          ? 'category'
          : 'channel',

      actualId:
        actual.id,

      currentName:
        actual.name,

      currentParentId:
        actual.parentId,

      reason:
        'Recurso existente sin binding. Debe revisarse manualmente antes de decidir conservarlo o retirarlo.',

      requiresConfirmation: true,
    });
  }

  for (
    const actual
    of snapshot.roles
  ) {
    if (
      actual.name ===
      '@everyone'
    ) {
      continue;
    }

    if (
      boundActualIds.has(
        actual.id,
      )
    ) {
      continue;
    }

    operations.push({
      id: operationId(
        'review_legacy',
        actual.id,
      ),

      type: 'review_legacy',

      resourceKind: 'role',

      actualId:
        actual.id,

      currentName:
        actual.name,

      reason:
        'Rol existente sin binding. Debe revisarse manualmente antes de decidir conservarlo o retirarlo.',

      requiresConfirmation: true,
    });
  }

  const count = (
    type:
      MigrationOperation['type'],
  ): number =>
    operations.filter(
      (operation) =>
        operation.type === type,
    ).length;

  return {
    schemaVersion: 1,

    generatedAt:
      new Date().toISOString(),

    guild: {
      id: snapshot.guild.id,
      name: snapshot.guild.name,
    },

    summary: {
      total:
        operations.length,

      createCategories:
        count(
          'create_category',
        ),

      createChannels:
        count(
          'create_channel',
        ),

      createRoles:
        count(
          'create_role',
        ),

      renameCategories:
        count(
          'rename_category',
        ),

      renameChannels:
        count(
          'rename_channel',
        ),

      renameRoles:
        count(
          'rename_role',
        ),

      moveChannels:
        count(
          'move_channel',
        ),

      reviewManagedRoles:
        count(
          'review_managed_role',
        ),

      reviewBindings:
        count(
          'review_binding',
        ),

      reviewLegacy:
        count(
          'review_legacy',
        ),
    },

    operations,
  };
}
