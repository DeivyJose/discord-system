import {
  dispatchExecutionOperation,
  isAutomatableOperation,
} from './executionAdapter.js';

import type {
  AutomatableMigrationOperation,
  MigrationOperation,
} from './executionAdapterTypes.js';

import {
  prepareBindingAwareOperation,
} from './bindingAwareExecution.js';

import {
  FakeDiscordExecutionAdapter,
} from './fakeDiscordExecutionAdapter.js';

import {
  SessionBindingRegistry,
} from './sessionBindingRegistry.js';

import type {
  FullFakeMigrationPhase,
  FullFakeMigrationPhaseResult,
  FullFakeMigrationResult,
} from './fullFakeMigrationOrchestratorTypes.js';

interface FullFakeMigrationOptions {
  guildId: string;

  confirmedBindings:
    Readonly<Record<string, string>>;

  operations:
    MigrationOperation[];
}

interface PhaseDefinition {
  phase:
    FullFakeMigrationPhase;

  accepts: (
    operation:
      AutomatableMigrationOperation,
  ) => boolean;
}

const PHASES:
  PhaseDefinition[] = [
    {
      phase:
        'roles',

      accepts:
        (operation) =>
          operation.type ===
            'create_role',
    },

    {
      phase:
        'categories',

      accepts:
        (operation) =>
          operation.type ===
            'create_category',
    },

    {
      phase:
        'renames',

      accepts:
        (operation) =>
          operation.type ===
            'rename_role' ||
          operation.type ===
            'rename_category' ||
          operation.type ===
            'rename_channel',
    },

    {
      phase:
        'channels',

      accepts:
        (operation) =>
          operation.type ===
            'create_channel',
    },

    {
      phase:
        'moves',

      accepts:
        (operation) =>
          operation.type ===
            'move_channel',
    },
  ];

function readString(
  value: unknown,
  key: string,
): string | null {
  if (
    typeof value !==
      'object' ||
    value === null
  ) {
    return null;
  }

  const candidate =
    Reflect.get(
      value,
      key,
    );

  return typeof candidate ===
    'string'
    ? candidate
    : null;
}

function collectPhaseOperations(
  automatable:
    AutomatableMigrationOperation[],

  definition:
    PhaseDefinition,
): AutomatableMigrationOperation[] {
  return automatable.filter(
    definition.accepts,
  );
}

function assertEveryAutomaticOperationAssigned(
  automatable:
    AutomatableMigrationOperation[],
): void {
  const assignments =
    new Map<string, number>();

  for (
    const operation
    of automatable
  ) {
    assignments.set(
      operation.id,
      0,
    );
  }

  for (
    const definition
    of PHASES
  ) {
    for (
      const operation
      of automatable
    ) {
      if (
        !definition.accepts(
          operation,
        )
      ) {
        continue;
      }

      assignments.set(
        operation.id,
        (
          assignments.get(
            operation.id,
          ) ??
          0
        ) + 1,
      );
    }
  }

  const invalid =
    [...assignments.entries()]
      .filter(
        (
          [
            ,
            count,
          ],
        ) =>
          count !==
            1,
      );

  if (
    invalid.length >
      0
  ) {
    throw new Error(
      [
        'Hay operaciones automáticas sin una fase única:',
        ...invalid.map(
          (
            [
              id,
              count,
            ],
          ) =>
            `${id}=${count}`,
        ),
      ].join(
        ' ',
      ),
    );
  }
}

export async function runFullFakeMigration(
  options:
    FullFakeMigrationOptions,
): Promise<FullFakeMigrationResult> {
  const automatable:
    AutomatableMigrationOperation[] =
    options.operations.filter(
      (
        operation,
      ): operation is
        AutomatableMigrationOperation =>
        isAutomatableOperation(
          operation,
        ),
    );

  const manualReviewOperations =
    options.operations.length -
    automatable.length;

  assertEveryAutomaticOperationAssigned(
    automatable,
  );

  const registry =
    new SessionBindingRegistry(
      options.guildId,
      options.confirmedBindings,
    );

  const adapter =
    new FakeDiscordExecutionAdapter();

  const phaseResults:
    FullFakeMigrationPhaseResult[] =
    [];

  for (
    const definition
    of PHASES
  ) {
    const operations =
      collectPhaseOperations(
        automatable,
        definition,
      );

    const transaction =
      registry.beginTransaction(
        `full-fake-${definition.phase}`,
      );

    let addedBindings =
      0;

    let idempotentBindings =
      0;

    for (
      const operation
      of operations
    ) {
      const prepared =
        prepareBindingAwareOperation(
          operation,
          registry
            .toResolverBindings(),
        );

      const action =
        await dispatchExecutionOperation(
          adapter,
          prepared.operation,
        );

      const blueprintId =
        action.binding
          ?.blueprintId ??
        readString(
          operation,
          'blueprintId',
        );

      const actualId =
        action.binding
          ?.actualId ??
        action.actualId;

      if (
        !blueprintId ||
        !actualId
      ) {
        continue;
      }

      const stageResult =
        transaction.stage(
          blueprintId,
          actualId,
          operation.id,
        );

      if (
        stageResult ===
          'added'
      ) {
        addedBindings +=
          1;
      } else {
        idempotentBindings +=
          1;
      }
    }

    const commit =
      transaction.commit();

    phaseResults.push({
      phase:
        definition.phase,

      operations:
        operations.length,

      addedBindings,

      idempotentBindings,

      committedBindings:
        commit.committed,

      registryRevision:
        registry.revision,

      registrySessionBindings:
        registry.sessionCount,

      adapterActions:
        adapter.snapshot()
          .actions.length,
    });
  }

  const finalAdapterSnapshot =
    adapter.snapshot();

  const finalRegistrySnapshot =
    registry.snapshot();

  const resolverBindings =
    registry.toResolverBindings();

  return {
    schemaVersion: 1,

    totalOperations:
      options.operations.length,

    automatableOperations:
      automatable.length,

    manualReviewOperations,

    phases:
      phaseResults,

    finalAdapterSnapshot,

    finalRegistrySnapshot,

    finalResolverBindingCount:
      Object.keys(
        resolverBindings.confirmed,
      ).length +
      Object.keys(
        resolverBindings.session,
      ).length,

    executionAllowed:
      false,
  };
}
