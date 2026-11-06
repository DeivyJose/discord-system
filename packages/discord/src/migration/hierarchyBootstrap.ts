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
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  HierarchyBootstrapCheck,
  HierarchyBootstrapPlan,
  HierarchyBootstrapRole,
} from './hierarchyBootstrapTypes.js';

const PRIVILEGED_ROLE_IDS = [
  'role_owner',
  'role_administrator',
  'role_compai',
] as const;

function blueprintRoleName(
  roleId: string,
): string {
  const role =
    DISCORD_ROLES.find(
      (item) =>
        item.id === roleId,
    );

  if (!role) {
    throw new Error(
      `No existe el rol ${roleId} en el Blueprint.`,
    );
  }

  return role.name;
}

export function createHierarchyBootstrapPlan(
  snapshot: DiscordGuildSnapshot,
  bindings: DiscordBindings,
  operations: MigrationOperationsPlan,
): HierarchyBootstrapPlan {
  const checks: HierarchyBootstrapCheck[] = [];

  const snapshotRolesById =
    new Map(
      snapshot.roles.map(
        (role) => [
          role.id,
          role,
        ],
      ),
    );

  const compaiActualId =
    bindings.resources.role_compai;

  const administratorActualId =
    bindings.resources.role_administrator;

  const ownerActualId =
    bindings.resources.role_owner;

  const compai =
    compaiActualId
      ? snapshotRolesById.get(
          compaiActualId,
        )
      : undefined;

  const administrator =
    administratorActualId
      ? snapshotRolesById.get(
          administratorActualId,
        )
      : undefined;

  const owner =
    ownerActualId
      ? snapshotRolesById.get(
          ownerActualId,
        )
      : undefined;

  checks.push({
    id: 'compai_binding',

    status:
      compai
        ? 'pass'
        : 'block',

    details:
      compai
        ? `Compai está vinculado al rol Discord ${compai.name} [${compai.id}].`
        : 'No existe un binding válido para role_compai.',
  });

  checks.push({
    id: 'compai_managed',

    status:
      compai?.managed
        ? 'pass'
        : 'block',

    details:
      compai?.managed
        ? 'El rol de Compai está correctamente identificado como managed.'
        : 'El rol vinculado a Compai no aparece como managed.',
  });

  checks.push({
    id: 'administrator_binding',

    status:
      administrator
        ? 'pass'
        : 'block',

    details:
      administrator
        ? `Administrador está vinculado a ${administrator.name} [${administrator.id}].`
        : 'No existe un binding válido para role_administrator.',
  });

  const ownerCreateOperation =
    operations.operations.find(
      (operation) =>
        operation.type ===
          'create_role' &&
        operation.blueprintId ===
          'role_owner',
    );

  checks.push({
    id: 'owner_resolution',

    status:
      owner ||
      ownerCreateOperation
        ? 'pass'
        : 'block',

    details:
      owner
        ? `El rol Dueño ya existe como ${owner.name} [${owner.id}].`
        : ownerCreateOperation
          ? 'El rol Dueño todavía no existe, pero está incluido en el plan de creación.'
          : 'El rol Dueño no existe ni aparece en las operaciones de creación.',
  });

  const roles: HierarchyBootstrapRole[] = [];

  roles.push({
    blueprintId:
      'role_owner',

    desiredName:
      blueprintRoleName(
        'role_owner',
      ),

    desiredRank: 1,

    actualId:
      owner?.id ?? null,

    currentName:
      owner?.name ?? null,

    currentPosition:
      owner?.position ?? null,

    managed:
      owner?.managed ?? null,

    status:
      owner
        ? (
            compai &&
            owner.position >
              compai.position
              ? 'ready'
              : 'manual'
          )
        : 'manual',

    action:
      owner
        ? (
            compai &&
            owner.position >
              compai.position
              ? 'already_correct'
              : 'promote_above_compai'
          )
        : 'create_then_promote',

    reason:
      owner
        ? (
            compai &&
            owner.position >
              compai.position
              ? 'El rol Dueño ya está por encima de Compai.'
              : 'El rol Dueño debe colocarse manualmente por encima de Compai.'
          )
        : 'Compai podrá crear el rol Dueño debajo de sí mismo, pero un humano deberá moverlo posteriormente por encima de Compai.',
  });

  roles.push({
    blueprintId:
      'role_administrator',

    desiredName:
      blueprintRoleName(
        'role_administrator',
      ),

    desiredRank: 2,

    actualId:
      administrator?.id ?? null,

    currentName:
      administrator?.name ?? null,

    currentPosition:
      administrator?.position ?? null,

    managed:
      administrator?.managed ?? null,

    status:
      administrator &&
      compai &&
      administrator.position >
        compai.position
        ? 'ready'
        : administrator
          ? 'manual'
          : 'block',

    action:
      administrator &&
      compai &&
      administrator.position >
        compai.position
        ? 'already_correct'
        : administrator
          ? 'promote_above_compai'
          : 'review',

    reason:
      administrator &&
      compai &&
      administrator.position >
        compai.position
        ? 'Administrador ya está por encima de Compai.'
        : administrator
          ? 'Administrador debe quedar manualmente por encima de Compai.'
          : 'No existe un rol Administrador resoluble.',
  });

  roles.push({
    blueprintId:
      'role_compai',

    desiredName:
      blueprintRoleName(
        'role_compai',
      ),

    desiredRank: 3,

    actualId:
      compai?.id ?? null,

    currentName:
      compai?.name ?? null,

    currentPosition:
      compai?.position ?? null,

    managed:
      compai?.managed ?? null,

    status:
      compai?.managed
        ? 'ready'
        : 'block',

    action:
      compai?.managed
        ? 'managed_anchor'
        : 'review',

    reason:
      compai?.managed
        ? 'El rol managed de Compai funciona como ancla de la jerarquía automática.'
        : 'No existe un rol managed válido para Compai.',
  });

  if (
    owner &&
    administrator
  ) {
    checks.push({
      id: 'owner_above_administrator',

      status:
        owner.position >
        administrator.position
          ? 'pass'
          : 'warn',

      details:
        owner.position >
        administrator.position
          ? 'Dueño ya está por encima de Administrador.'
          : 'La jerarquía final deberá colocar Dueño por encima de Administrador.',
    });
  } else {
    checks.push({
      id: 'owner_above_administrator',

      status: 'warn',

      details:
        'La relación Dueño > Administrador se verificará después de crear y posicionar el rol Dueño.',
    });
  }

  checks.push({
    id: 'automatic_boundary',

    status: 'pass',

    details:
      'Ninguna operación automática debe intentar colocar roles privilegiados por encima del rol managed de Compai.',
  });

  const block =
    checks.filter(
      (check) =>
        check.status ===
        'block',
    ).length +
    roles.filter(
      (role) =>
        role.status ===
        'block',
    ).length;

  const manual =
    roles.filter(
      (role) =>
        role.status ===
        'manual',
    ).length;

  const ready =
    roles.filter(
      (role) =>
        role.status ===
        'ready',
    ).length;

  return {
    schemaVersion: 1,

    generatedAt:
      new Date().toISOString(),

    guild: {
      id: snapshot.guild.id,
      name: snapshot.guild.name,
    },

    desiredHierarchy:
      PRIVILEGED_ROLE_IDS,

    roles,

    checks,

    manualSteps: [
      {
        order: 1,

        title:
          'Crear roles pendientes debajo de Compai.',

        details:
          'La futura migración podrá crear Dueño y los demás roles que todavía no existen. Discord los creará dentro de la zona que Compai puede administrar.',
      },

      {
        order: 2,

        title:
          'Detener la automatización antes de elevar roles privilegiados.',

        details:
          'La automatización no moverá Dueño ni Administrador por encima de Compai.',
      },

      {
        order: 3,

        title:
          'Colocar manualmente Dueño por encima de Administrador.',

        details:
          'El dueño real del servidor deberá ordenar la parte superior de la jerarquía desde Discord.',
      },

      {
        order: 4,

        title:
          'Colocar Administrador por encima de Compai.',

        details:
          'Administrador debe permanecer por debajo de Dueño y por encima del rol managed de Compai.',
      },

      {
        order: 5,

        title:
          'Mantener Compai como frontera automática.',

        details:
          'Los roles operativos creados por Compai deben quedar debajo del rol managed de Compai.',
      },

      {
        order: 6,

        title:
          'Reinspeccionar y validar.',

        details:
          'Después del ajuste humano se debe generar un snapshot nuevo y volver a ejecutar los preflights antes de continuar.',
      },
    ],

    summary: {
      ready,

      manual,

      block,

      bootstrapPossible:
        block === 0,
    },

    executionAllowed: false,
  };
}
