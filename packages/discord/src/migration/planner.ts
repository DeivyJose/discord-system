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
  DiscordCategoryBlueprint,
  DiscordChannelBlueprint,
  DiscordRoleBlueprint,
} from '../blueprint/types.js';

import type {
  DiscordChannelSnapshot,
  DiscordGuildSnapshot,
  DiscordRoleSnapshot,
} from '../inspector/types.js';

import {
  LEGACY_ALIASES,
} from './legacyAliases.js';

import type {
  DiscordBindings,
  MigrationPlan,
  MigrationPlanItem,
  MigrationResourceKind,
} from './types.js';

function normalizeName(
  value: string,
): string {
  return value
    .normalize('NFKD')
    .replace(
      /\p{Diacritic}/gu,
      '',
    )
    .toLowerCase()
    .replace(
      /[\p{Extended_Pictographic}\uFE0F]/gu,
      '',
    )
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .trim();
}

function expectedChannelTypeName(
  kind:
    | DiscordCategoryBlueprint['kind']
    | DiscordChannelBlueprint['kind'],
): string {
  switch (kind) {
    case 'category':
      return 'GuildCategory';

    case 'text_channel':
      return 'GuildText';

    case 'announcement_channel':
      return 'GuildAnnouncement';

    case 'forum_channel':
      return 'GuildForum';

    case 'voice_channel':
      return 'GuildVoice';
  }
}

function compatibleChannel(
  actual: DiscordChannelSnapshot,
  expectedKind:
    | DiscordCategoryBlueprint['kind']
    | DiscordChannelBlueprint['kind'],
): boolean {
  return (
    actual.typeName ===
    expectedChannelTypeName(expectedKind)
  );
}

interface BlueprintCandidate {
  id: string;

  name: string;

  kind: MigrationResourceKind;

  discordKind:
    | DiscordCategoryBlueprint['kind']
    | DiscordChannelBlueprint['kind']
    | DiscordRoleBlueprint['kind'];
}

interface ActualCandidate {
  id: string;

  name: string;

  kind: MigrationResourceKind;

  channel?: DiscordChannelSnapshot;

  role?: DiscordRoleSnapshot;
}

function aliasesFor(
  blueprintId: string,
  blueprintName: string,
): string[] {
  const aliases =
    LEGACY_ALIASES[blueprintId] ?? [];

  return [
    normalizeName(blueprintName),

    ...aliases.map(
      normalizeName,
    ),
  ];
}

function isCompatible(
  blueprint: BlueprintCandidate,
  actual: ActualCandidate,
): boolean {
  if (blueprint.kind !== actual.kind) {
    return false;
  }

  if (blueprint.kind === 'role') {
    return Boolean(actual.role);
  }

  if (!actual.channel) {
    return false;
  }

  if (
    blueprint.discordKind === 'role'
  ) {
    return false;
  }

  return compatibleChannel(
    actual.channel,
    blueprint.discordKind,
  );
}

function findCandidates(
  blueprint: BlueprintCandidate,
  actualResources: ActualCandidate[],
  reservedActualIds: Set<string>,
): ActualCandidate[] {
  const acceptedNames =
    new Set(
      aliasesFor(
        blueprint.id,
        blueprint.name,
      ),
    );

  return actualResources.filter(
    (actual) => {
      if (
        reservedActualIds.has(actual.id)
      ) {
        return false;
      }

      if (
        !isCompatible(
          blueprint,
          actual,
        )
      ) {
        return false;
      }

      return acceptedNames.has(
        normalizeName(actual.name),
      );
    },
  );
}

export function createMigrationPlan(
  snapshot: DiscordGuildSnapshot,
  bindings: DiscordBindings,
): MigrationPlan {
  const items: MigrationPlanItem[] = [];

  const actualCategories: ActualCandidate[] =
    snapshot.channels
      .filter(
        (channel) =>
          channel.typeName ===
          'GuildCategory',
      )
      .map(
        (channel) => ({
          id: channel.id,

          name: channel.name,

          kind: 'category' as const,

          channel,
        }),
      );

  const actualChannels: ActualCandidate[] =
    snapshot.channels
      .filter(
        (channel) =>
          channel.typeName !==
          'GuildCategory',
      )
      .map(
        (channel) => ({
          id: channel.id,

          name: channel.name,

          kind: 'channel' as const,

          channel,
        }),
      );

  const actualRoles: ActualCandidate[] =
    snapshot.roles
      .filter(
        (role) =>
          role.name !== '@everyone',
      )
      .map(
        (role) => ({
          id: role.id,

          name: role.name,

          kind: 'role' as const,

          role,
        }),
      );

  const actualResources = [
    ...actualCategories,
    ...actualChannels,
    ...actualRoles,
  ];

  const actualById =
    new Map(
      actualResources.map(
        (resource) => [
          resource.id,
          resource,
        ],
      ),
    );

  const blueprintResources: BlueprintCandidate[] = [
    ...DISCORD_CATEGORIES.map(
      (category) => ({
        id: category.id,

        name: category.name,

        kind: 'category' as const,

        discordKind:
          category.kind,
      }),
    ),

    ...DISCORD_CHANNELS.map(
      (channel) => ({
        id: channel.id,

        name: channel.name,

        kind: 'channel' as const,

        discordKind:
          channel.kind,
      }),
    ),

    ...DISCORD_ROLES.map(
      (role) => ({
        id: role.id,

        name: role.name,

        kind: 'role' as const,

        discordKind:
          role.kind,
      }),
    ),
  ];

  const reservedActualIds =
    new Set<string>();

  for (
    const blueprint
    of blueprintResources
  ) {
    const boundActualId =
      bindings.resources[
        blueprint.id
      ];

    if (boundActualId) {
      const actual =
        actualById.get(
          boundActualId,
        );

      if (!actual) {
        items.push({
          kind: blueprint.kind,

          action: 'review',

          confidence: 'none',

          blueprintId:
            blueprint.id,

          blueprintName:
            blueprint.name,

          actualId:
            boundActualId,

          reason:
            'Existe un binding, pero el recurso real ya no aparece en el snapshot.',
        });

        continue;
      }

      if (
        !isCompatible(
          blueprint,
          actual,
        )
      ) {
        items.push({
          kind: blueprint.kind,

          action: 'review',

          confidence: 'none',

          blueprintId:
            blueprint.id,

          blueprintName:
            blueprint.name,

          actualId:
            actual.id,

          actualName:
            actual.name,

          reason:
            'El binding existe, pero el tipo del recurso real no coincide con el Blueprint.',
        });

        reservedActualIds.add(
          actual.id,
        );

        continue;
      }

      items.push({
        kind: blueprint.kind,

        action: 'bound',

        confidence: 'confirmed',

        blueprintId:
          blueprint.id,

        blueprintName:
          blueprint.name,

        actualId:
          actual.id,

        actualName:
          actual.name,

        reason:
          'Binding confirmado.',
      });

      reservedActualIds.add(
        actual.id,
      );

      continue;
    }

    const candidates =
      findCandidates(
        blueprint,
        actualResources,
        reservedActualIds,
      );

    if (candidates.length === 1) {
      const candidate =
        candidates[0];

      if (!candidate) {
        throw new Error(
          'Estado imposible: candidato único no disponible.',
        );
      }

      items.push({
        kind: blueprint.kind,

        action: 'suggest_bind',

        confidence: 'high',

        blueprintId:
          blueprint.id,

        blueprintName:
          blueprint.name,

        actualId:
          candidate.id,

        actualName:
          candidate.name,

        reason:
          'Existe exactamente un recurso compatible con nombre o alias conocido.',
      });

      reservedActualIds.add(
        candidate.id,
      );

      continue;
    }

    if (candidates.length > 1) {
      items.push({
        kind: blueprint.kind,

        action: 'review',

        confidence: 'medium',

        blueprintId:
          blueprint.id,

        blueprintName:
          blueprint.name,

        reason:
          `Se encontraron ${candidates.length} recursos compatibles; requiere selección manual.`,
      });

      continue;
    }

    items.push({
      kind: blueprint.kind,

      action: 'create',

      confidence: 'none',

      blueprintId:
        blueprint.id,

      blueprintName:
        blueprint.name,

      reason:
        'No existe binding ni candidato inequívoco en el servidor actual.',
    });
  }

  for (
    const actual
    of actualResources
  ) {
    if (
      reservedActualIds.has(
        actual.id,
      )
    ) {
      continue;
    }

    items.push({
      kind: actual.kind,

      action: 'unmanaged',

      confidence: 'none',

      actualId:
        actual.id,

      actualName:
        actual.name,

      reason:
        'Recurso actual sin binding ni equivalencia inequívoca. No será eliminado automáticamente.',
    });
  }

  return {
    schemaVersion: 1,

    generatedAt:
      new Date().toISOString(),

    guild: {
      id: snapshot.guild.id,

      name: snapshot.guild.name,
    },

    summary: {
      bound:
        items.filter(
          (item) =>
            item.action ===
            'bound',
        ).length,

      suggestedBindings:
        items.filter(
          (item) =>
            item.action ===
            'suggest_bind',
        ).length,

      create:
        items.filter(
          (item) =>
            item.action ===
            'create',
        ).length,

      review:
        items.filter(
          (item) =>
            item.action ===
            'review',
        ).length,

      unmanaged:
        items.filter(
          (item) =>
            item.action ===
            'unmanaged',
        ).length,
    },

    items,
  };
}
