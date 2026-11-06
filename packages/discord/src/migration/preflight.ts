import {
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
} from 'discord.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordMigrationPreflight,
  PreflightCheck,
  RoleHierarchyCheck,
} from './preflightTypes.js';

function countStatuses(
  checks: PreflightCheck[],
  status: PreflightCheck['status'],
): number {
  return checks.filter(
    (check) => check.status === status,
  ).length;
}

function requiresManageChannels(
  plan: MigrationOperationsPlan,
): boolean {
  return plan.operations.some(
    (operation) =>
      operation.type === 'create_category' ||
      operation.type === 'create_channel' ||
      operation.type === 'rename_category' ||
      operation.type === 'rename_channel' ||
      operation.type === 'move_channel',
  );
}

function requiresManageRoles(
  plan: MigrationOperationsPlan,
): boolean {
  return plan.operations.some(
    (operation) =>
      operation.type === 'create_role' ||
      operation.type === 'rename_role',
  );
}

function inspectRoleHierarchy(
  guild: Guild,
  botMember: GuildMember,
  plan: MigrationOperationsPlan,
): RoleHierarchyCheck[] {
  const result: RoleHierarchyCheck[] = [];

  const targetRoleIds = new Set(
    plan.operations
      .filter(
        (operation) =>
          operation.type === 'rename_role' &&
          operation.actualId,
      )
      .map(
        (operation) =>
          operation.actualId as string,
      ),
  );

  for (const roleId of targetRoleIds) {
    const role =
      guild.roles.cache.get(roleId);

    if (!role) {
      result.push({
        roleId,

        roleName: '(no encontrado)',

        rolePosition: -1,

        manageable: false,

        reason:
          'El rol objetivo no aparece en la caché actual del servidor.',
      });

      continue;
    }

    if (role.managed) {
      result.push({
        roleId: role.id,

        roleName: role.name,

        rolePosition: role.position,

        manageable: false,

        reason:
          'El rol está administrado por una integración.',
      });

      continue;
    }

    const comparison =
      guild.roles.comparePositions(
        botMember.roles.highest,
        role,
      );

    result.push({
      roleId: role.id,

      roleName: role.name,

      rolePosition: role.position,

      manageable:
        comparison > 0,

      reason:
        comparison > 0
          ? 'El rol más alto de Compai está por encima del rol objetivo.'
          : 'El rol objetivo está al mismo nivel o por encima del rol más alto de Compai.',
    });
  }

  return result;
}

export function createDiscordMigrationPreflight(
  guild: Guild,
  botMember: GuildMember,
  plan: MigrationOperationsPlan,
): DiscordMigrationPreflight {
  const checks: PreflightCheck[] = [];

  const manageChannelsRequired =
    requiresManageChannels(plan);

  const manageRolesRequired =
    requiresManageRoles(plan);

  const administrator =
    botMember.permissions.has(
      PermissionFlagsBits.Administrator,
      false,
    );

  const manageChannels =
    botMember.permissions.has(
      PermissionFlagsBits.ManageChannels,
    );

  const manageRoles =
    botMember.permissions.has(
      PermissionFlagsBits.ManageRoles,
    );

  checks.push({
    id: 'guild_identity',

    label:
      'El plan pertenece al servidor conectado.',

    status:
      guild.id === plan.guild.id
        ? 'pass'
        : 'block',

    details:
      guild.id === plan.guild.id
        ? 'Guild ID coincidente.'
        : `Plan=${plan.guild.id}; conectado=${guild.id}.`,
  });

  checks.push({
    id: 'manage_channels',

    label:
      'Compai puede administrar canales.',

    status:
      !manageChannelsRequired ||
      manageChannels
        ? 'pass'
        : 'block',

    details:
      !manageChannelsRequired
        ? 'El plan actual no requiere ManageChannels.'
        : manageChannels
          ? 'ManageChannels disponible.'
          : 'El plan requiere ManageChannels y Compai no lo posee.',
  });

  checks.push({
    id: 'manage_roles',

    label:
      'Compai puede administrar roles.',

    status:
      !manageRolesRequired ||
      manageRoles
        ? 'pass'
        : 'block',

    details:
      !manageRolesRequired
        ? 'El plan actual no requiere ManageRoles.'
        : manageRoles
          ? 'ManageRoles disponible.'
          : 'El plan requiere ManageRoles y Compai no lo posee.',
  });

  const hierarchy =
    inspectRoleHierarchy(
      guild,
      botMember,
      plan,
    );

  const hierarchyFailures =
    hierarchy.filter(
      (item) =>
        !item.manageable,
    );

  checks.push({
    id: 'role_hierarchy',

    label:
      'Jerarquía suficiente para roles existentes que serían editados.',

    status:
      hierarchyFailures.length === 0
        ? 'pass'
        : 'block',

    details:
      hierarchy.length === 0
        ? 'El plan no contiene renombres automáticos de roles existentes.'
        : hierarchyFailures.length === 0
          ? `${hierarchy.length} rol(es) objetivo están por debajo de Compai.`
          : `${hierarchyFailures.length} de ${hierarchy.length} rol(es) objetivo no son gestionables por Compai.`,
  });

  checks.push({
    id: 'managed_bot_role',

    label:
      'El rol administrado de Compai no será editado como rol ordinario.',

    status:
      plan.operations.some(
        (operation) =>
          operation.type ===
            'rename_role' &&
          operation.actualId ===
            botMember.roles.highest.id &&
          botMember.roles.highest.managed,
      )
        ? 'block'
        : 'pass',

    details:
      'Los roles managed deben permanecer fuera de rename_role.',
  });

  checks.push({
    id: 'high_priority_roles',

    label:
      'Roles superiores a Compai requieren bootstrap manual de jerarquía.',

    status: 'warn',

    details:
      'Compai puede crear roles debajo de su propio rol más alto, pero no debe asumirse que podrá colocar roles administrativos por encima de sí mismo. La jerarquía final se validará por separado.',
  });

  const pass =
    countStatuses(
      checks,
      'pass',
    );

  const warn =
    countStatuses(
      checks,
      'warn',
    );

  const block =
    countStatuses(
      checks,
      'block',
    );

  return {
    schemaVersion: 1,

    checkedAt:
      new Date().toISOString(),

    guild: {
      id: guild.id,
      name: guild.name,
    },

    bot: {
      id: botMember.id,

      tag: botMember.user.tag,

      highestRoleId:
        botMember.roles.highest.id,

      highestRoleName:
        botMember.roles.highest.name,

      highestRolePosition:
        botMember.roles.highest.position,

      administrator,

      manageChannels,

      manageRoles,
    },

    requirements: {
      manageChannelsRequired,

      manageRolesRequired,
    },

    checks,

    hierarchy,

    summary: {
      pass,

      warn,

      block,

      migrationTechnicallyPossible:
        block === 0,
    },

    executionAllowed: false,
  };
}
