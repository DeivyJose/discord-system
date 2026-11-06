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

import type {
  DiscordExecutionPreview,
  ExecutionPhase,
  ExecutionPrecondition,
  ExecutionPreviewStep,
} from './executionTypes.js';

const PHASE_ORDER: Record<
  ExecutionPhase,
  number
> = {
  roles: 10,
  categories: 20,
  renames: 30,
  channels: 40,
  moves: 50,
  manual_review: 90,
};

function phaseFor(
  operation: MigrationOperation,
): ExecutionPhase {
  switch (operation.type) {
    case 'create_role':
      return 'roles';

    case 'create_category':
      return 'categories';

    case 'rename_category':
    case 'rename_channel':
    case 'rename_role':
      return 'renames';

    case 'create_channel':
      return 'channels';

    case 'move_channel':
      return 'moves';

    case 'review_managed_role':
    case 'review_binding':
    case 'review_legacy':
      return 'manual_review';
  }
}

function labelFor(
  operation: MigrationOperation,
): string {
  const current =
    operation.currentName ?? null;

  const desired =
    operation.desiredName ?? null;

  if (current && desired) {
    return `${current} -> ${desired}`;
  }

  if (desired) {
    return desired;
  }

  if (current) {
    return current;
  }

  return (
    operation.blueprintId ??
    operation.actualId ??
    operation.id
  );
}

function createPreconditions(
  snapshot: DiscordGuildSnapshot,
  bindings: DiscordBindings,
  plan: MigrationOperationsPlan,
): ExecutionPrecondition[] {
  const result: ExecutionPrecondition[] = [];

  const guildMatches =
    snapshot.guild.id ===
      bindings.guildId &&
    snapshot.guild.id ===
      plan.guild.id;

  result.push({
    id: 'guild_identity',

    label:
      'Snapshot, bindings y plan pertenecen al mismo servidor.',

    status:
      guildMatches
        ? 'pass'
        : 'block',

    details:
      guildMatches
        ? 'Los tres artefactos usan el mismo Guild ID.'
        : 'Existe una discrepancia de Guild ID. Ninguna ejecución debe permitirse.',
  });

  const bindingReviews =
    plan.operations.filter(
      (operation) =>
        operation.type ===
        'review_binding',
    );

  result.push({
    id: 'bindings_resolved',

    label:
      'No existen bindings inconsistentes.',

    status:
      bindingReviews.length === 0
        ? 'pass'
        : 'block',

    details:
      bindingReviews.length === 0
        ? 'Todos los bindings utilizados por el plan son consistentes.'
        : `Existen ${bindingReviews.length} bindings que requieren revisión.`,
  });

  const managedRoles =
    plan.operations.filter(
      (operation) =>
        operation.type ===
        'review_managed_role',
    );

  result.push({
    id: 'managed_roles',

    label:
      'Roles administrados por integraciones.',

    status:
      managedRoles.length === 0
        ? 'pass'
        : 'warn',

    details:
      managedRoles.length === 0
        ? 'No existen roles managed pendientes.'
        : `${managedRoles.length} rol(es) managed quedan fuera de cualquier ejecución automática.`,
  });

  const legacy =
    plan.operations.filter(
      (operation) =>
        operation.type ===
        'review_legacy',
    );

  result.push({
    id: 'legacy_resources',

    label:
      'Recursos legacy sin binding.',

    status:
      legacy.length === 0
        ? 'pass'
        : 'warn',

    details:
      legacy.length === 0
        ? 'No existen recursos legacy pendientes.'
        : `${legacy.length} recurso(s) legacy permanecerán intactos hasta revisión manual.`,
  });

  result.push({
    id: 'executor_absent',

    label:
      'Executor de Discord deshabilitado.',

    status: 'pass',

    details:
      'Esta etapa genera únicamente un preview. No existe código de ejecución habilitado.',
  });

  return result;
}

export function createExecutionPreview(
  snapshot: DiscordGuildSnapshot,
  bindings: DiscordBindings,
  plan: MigrationOperationsPlan,
): DiscordExecutionPreview {
  const preconditions =
    createPreconditions(
      snapshot,
      bindings,
      plan,
    );

  const globalBlock =
    preconditions.some(
      (item) =>
        item.status === 'block',
    );

  const createCategoryByBlueprintId =
    new Map<string, MigrationOperation>();

  for (const operation of plan.operations) {
    if (
      operation.type ===
        'create_category' &&
      operation.blueprintId
    ) {
      createCategoryByBlueprintId.set(
        operation.blueprintId,
        operation,
      );
    }
  }

  const snapshotRolesById =
    new Map(
      snapshot.roles.map(
        (role) => [
          role.id,
          role,
        ],
      ),
    );

  const steps: ExecutionPreviewStep[] =
    plan.operations.map(
      (operation) => {
        const phase =
          phaseFor(operation);

        const dependsOn: string[] = [];

        const blockers: string[] = [];

        const notes: string[] = [];

        let status:
          ExecutionPreviewStep['status'] =
          'ready';

        if (
          operation.type ===
          'review_managed_role'
        ) {
          status = 'manual';

          blockers.push(
            'Rol administrado por una integración. No se puede tratar como un rol ordinario.',
          );
        }

        if (
          operation.type ===
          'review_legacy'
        ) {
          status = 'manual';

          blockers.push(
            'Recurso legacy sin decisión de conservación o retiro.',
          );
        }

        if (
          operation.type ===
          'review_binding'
        ) {
          status = 'blocked';

          blockers.push(
            'Binding inconsistente o inválido.',
          );
        }

        if (
          operation.type ===
          'rename_role' &&
          operation.actualId
        ) {
          const actualRole =
            snapshotRolesById.get(
              operation.actualId,
            );

          if (actualRole?.managed) {
            status = 'blocked';

            blockers.push(
              'Defensa adicional: el snapshot indica que este rol es managed.',
            );
          }
        }

        if (
          operation.type ===
            'create_channel' ||
          operation.type ===
            'move_channel'
        ) {
          if (
            operation.desiredParentActualId
          ) {
            notes.push(
              `La categoría destino ya existe en Discord: ${operation.desiredParentActualId}.`,
            );
          } else if (
            operation.desiredParentBlueprintId
          ) {
            const parentCreate =
              createCategoryByBlueprintId.get(
                operation.desiredParentBlueprintId,
              );

            if (parentCreate) {
              dependsOn.push(
                parentCreate.id,
              );

              notes.push(
                `La categoría destino debe crearse primero: ${operation.desiredParentBlueprintId}.`,
              );
            } else {
              status = 'blocked';

              blockers.push(
                `No se pudo resolver la categoría destino "${operation.desiredParentBlueprintId}".`,
              );
            }
          } else {
            status = 'blocked';

            blockers.push(
              'La operación no tiene una categoría destino resoluble.',
            );
          }
        }

        if (
          globalBlock &&
          status === 'ready'
        ) {
          status = 'blocked';

          blockers.push(
            'Existe al menos una precondición global bloqueante.',
          );
        }

        return {
          operationId:
            operation.id,

          operationType:
            operation.type,

          resourceKind:
            operation.resourceKind,

          phase,

          status,

          blueprintId:
            operation.blueprintId ??
            null,

          actualId:
            operation.actualId ??
            null,

          label:
            labelFor(operation),

          dependsOn,

          blockers,

          notes,
        };
      },
    );

  steps.sort(
    (a, b) => {
      const phaseDifference =
        PHASE_ORDER[a.phase] -
        PHASE_ORDER[b.phase];

      if (phaseDifference !== 0) {
        return phaseDifference;
      }

      return a.operationId.localeCompare(
        b.operationId,
      );
    },
  );

  const countStatus = (
    status:
      ExecutionPreviewStep['status'],
  ): number =>
    steps.filter(
      (step) =>
        step.status === status,
    ).length;

  const countPhase = (
    phase: ExecutionPhase,
  ): number =>
    steps.filter(
      (step) =>
        step.phase === phase,
    ).length;

  return {
    schemaVersion: 1,

    generatedAt:
      new Date().toISOString(),

    guild: {
      id: snapshot.guild.id,
      name: snapshot.guild.name,
    },

    dryRunOnly: true,

    executionAllowed: false,

    preconditions,

    summary: {
      totalSteps:
        steps.length,

      ready:
        countStatus('ready'),

      manual:
        countStatus('manual'),

      blocked:
        countStatus('blocked'),

      phases: {
        roles:
          countPhase('roles'),

        categories:
          countPhase('categories'),

        renames:
          countPhase('renames'),

        channels:
          countPhase('channels'),

        moves:
          countPhase('moves'),

        manual_review:
          countPhase(
            'manual_review',
          ),
      },
    },

    steps,
  };
}
