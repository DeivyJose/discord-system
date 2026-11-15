import {
  isAutomatableOperation,
} from './executionAdapter.js';

import type {
  AutomatableMigrationOperation,
  ExecutionAdapterActionResult,
  ExecutionAdapterSnapshot,
  MigrationOperation,
} from './executionAdapterTypes.js';

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

import {
  resumeCheckpointedBindingPhase,
  runCheckpointedBindingPhase,
} from './checkpointedBindingResume.js';

import {
  FakeDiscordExecutionAdapter,
} from './fakeDiscordExecutionAdapter.js';

import {
  verifyLiveDrift,
} from './liveDrift.js';

import type {
  LiveDriftBaseline,
  LiveDriftContext,
  NormalizedDiscordStructureSnapshot,
} from './liveDriftTypes.js';

import {
  SessionBindingRegistry,
} from './sessionBindingRegistry.js';

import type {
  FullCheckpointedFakeMigrationPhase,
  FullCheckpointedFakeMigrationPhaseResult,
  FullCheckpointedFakeMigrationResult,
} from './fullCheckpointedFakeMigrationTypes.js';

interface FullCheckpointedFakeMigrationOptions {
  guildId: string;

  sessionId: string;

  gateFingerprint: string;

  confirmedBindings:
    Readonly<Record<string, string>>;

  operations:
    MigrationOperation[];

  baseline:
    LiveDriftBaseline;

  currentSnapshot:
    NormalizedDiscordStructureSnapshot;

  channelFailureIndex: number;
}

interface PhaseDefinition {
  phase:
    FullCheckpointedFakeMigrationPhase;

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

function phaseOperations(
  operations:
    AutomatableMigrationOperation[],

  phase:
    FullCheckpointedFakeMigrationPhase,
): AutomatableMigrationOperation[] {
  const definition =
    PHASES.find(
      (candidate) =>
        candidate.phase ===
          phase,
    );

  if (
    !definition
  ) {
    throw new Error(
      `Fase desconocida: ${phase}.`,
    );
  }

  return operations.filter(
    definition.accepts,
  );
}

function assertEveryAutomaticOperationAssigned(
  operations:
    AutomatableMigrationOperation[],
): void {
  for (
    const operation
    of operations
  ) {
    const matches =
      PHASES.filter(
        (definition) =>
          definition.accepts(
            operation,
          ),
      ).length;

    if (
      matches !==
        1
    ) {
      throw new Error(
        `Operation ${operation.id} pertenece a ${matches} fases automáticas.`,
      );
    }
  }
}

function makeContext(
  options:
    FullCheckpointedFakeMigrationOptions,

  phase:
    FullCheckpointedFakeMigrationPhase,

  operations:
    AutomatableMigrationOperation[],
): CheckpointIntegrityContext {
  return {
    guildId:
      options.guildId,

    sessionId:
      options.sessionId,

    gateFingerprint:
      options.gateFingerprint,

    phase,

    operationIds:
      operations.map(
        (operation) =>
          operation.id,
      ),
  };
}

/*
 * Cada checkpoint es específico de una fase.
 *
 * Conservamos resources + bindings entre fases,
 * pero eliminamos actions del seed para que el
 * Integrity Guard no reciba lineage de fases
 * anteriores.
 */
function createPhaseLocalSeed(
  snapshot:
    ExecutionAdapterSnapshot,
): ExecutionAdapterSnapshot {
  const seed =
    structuredClone(
      snapshot,
    );

  seed.actions = [];

  return seed;
}

/*
 * El orchestrator mantiene aparte el historial
 * global. Solo se vuelve a adjuntar al snapshot
 * cuando termina la migración completa.
 */
function withCumulativeActions(
  snapshot:
    ExecutionAdapterSnapshot,

  actions:
    ExecutionAdapterActionResult[],
): ExecutionAdapterSnapshot {
  const result =
    structuredClone(
      snapshot,
    );

  result.actions =
    structuredClone(
      actions,
    );

  return result;
}

export async function runFullCheckpointedFakeMigration(
  options:
    FullCheckpointedFakeMigrationOptions,
): Promise<FullCheckpointedFakeMigrationResult> {
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

  const driftContext:
    LiveDriftContext = {
    sessionId:
      options.sessionId,

    gateFingerprint:
      options.gateFingerprint,
  };

  const drift =
    verifyLiveDrift(
      options.baseline,
      options.currentSnapshot,
      driftContext,
    );

  const driftValid =
    drift.status ===
      'valid' &&
    drift.summary.valid &&
    !drift.summary
      .driftDetected &&
    options.baseline
      .snapshot
      .guildId ===
      options.guildId &&
    options.currentSnapshot
      .guildId ===
      options.guildId;

  if (
    !driftValid
  ) {
    return {
      schemaVersion: 1,

      status:
        'blocked',

      blockReason:
        'live_drift_detected',

      adapterCreated:
        false,

      registryCreated:
        false,

      drift,

      totalOperations:
        options.operations.length,

      automatableOperations:
        automatable.length,

      manualReviewOperations,

      phases: [],

      stoppedChannelsCheckpoint:
        null,

      finalAdapterSnapshot:
        null,

      finalRegistrySnapshot:
        null,

      executionAllowed:
        false,
    };
  }

  let adapter =
    new FakeDiscordExecutionAdapter();

  const cumulativeActions:
    ExecutionAdapterActionResult[] =
    [];

  let registry =
    new SessionBindingRegistry(
      options.guildId,
      options.confirmedBindings,
    );

  const phases:
    FullCheckpointedFakeMigrationPhaseResult[] =
    [];

  /*
   * =======================================
   * ROLES / CATEGORIES / RENAMES
   * =======================================
   */
  for (
    const phase
    of [
      'roles',
      'categories',
      'renames',
    ] as const
  ) {
    const operations =
      phaseOperations(
        automatable,
        phase,
      );

    const result =
      await runCheckpointedBindingPhase({
        context:
          makeContext(
            options,
            phase,
            operations,
          ),

        operations,

        adapter,

        registry,
      });

    if (
      result.journal.status !==
        'completed'
    ) {
      throw new Error(
        `La fase ${phase} no terminó correctamente.`,
      );
    }

    cumulativeActions.push(
      ...structuredClone(
        result
          .finalAdapterSnapshot
          .actions,
      ),
    );

    phases.push({
      phase,

      operations:
        operations.length,

      succeeded:
        result.journal
          .summary
          .succeeded,

      syntheticFailures:
        0,

      bindingsCommitted:
        result.bindingCommit
          .committed,

      resumed:
        false,

      registryRevision:
        result
          .finalRegistrySnapshot
          .revision,

      adapterActions:
        cumulativeActions.length,
    });

    /*
     * La siguiente fase recibe todo el
     * estado estructural, pero no el
     * lineage de actions de esta fase.
     */
    adapter =
      new FakeDiscordExecutionAdapter(
        createPhaseLocalSeed(
          result.finalAdapterSnapshot,
        ),
      );
  }

  /*
   * =======================================
   * CHANNELS + STOP + RESUME
   * =======================================
   */
  const channelOperations =
    phaseOperations(
      automatable,
      'channels',
    );

  if (
    options.channelFailureIndex <
      0 ||
    options.channelFailureIndex >=
      channelOperations.length
  ) {
    throw new Error(
      `channelFailureIndex inválido: ${options.channelFailureIndex}.`,
    );
  }

  const channelsContext =
    makeContext(
      options,
      'channels',
      channelOperations,
    );

  const stopped =
    await runCheckpointedBindingPhase({
      context:
        channelsContext,

      operations:
        channelOperations,

      adapter,

      registry,

      beforeOperation: ({
        index,
      }) => {
        if (
          index ===
            options
              .channelFailureIndex
        ) {
          throw new Error(
            'Synthetic full migration channel failure.',
          );
        }
      },
    });

  if (
    stopped.journal.status !==
      'stopped_on_error'
  ) {
    throw new Error(
      'La fase channels debía detenerse por el fallo sintético.',
    );
  }

  let resumeAdapterFactoryCalls =
    0;

  let resumeRegistryFactoryCalls =
    0;

  const resumed =
    await resumeCheckpointedBindingPhase({
      sealedCheckpoint:
        stopped.sealedCheckpoint,

      expectedContext:
        channelsContext,

      operations:
        channelOperations,

      adapterFactory:
        (snapshot) => {
          resumeAdapterFactoryCalls +=
            1;

          return new FakeDiscordExecutionAdapter(
            snapshot,
          );
        },

      registryFactory:
        (snapshot) => {
          resumeRegistryFactoryCalls +=
            1;

          return SessionBindingRegistry.restore(
            snapshot,
          );
        },
    });

  if (
    resumed.status !==
      'completed' ||
    !resumed.finalAdapterSnapshot ||
    !resumed.finalRegistrySnapshot ||
    resumeAdapterFactoryCalls !==
      1 ||
    resumeRegistryFactoryCalls !==
      1
  ) {
    throw new Error(
      'El resume de channels no terminó correctamente.',
    );
  }

  cumulativeActions.push(
    ...structuredClone(
      resumed
        .finalAdapterSnapshot
        .actions,
    ),
  );

  phases.push({
    phase:
      'channels',

    operations:
      channelOperations.length,

    succeeded:
      stopped.journal
        .summary
        .succeeded +
      (
        resumed.journal
          ?.summary
          .succeeded ??
        0
      ),

    syntheticFailures:
      1,

    bindingsCommitted:
      stopped.bindingCommit
        .committed +
      (
        resumed.bindingCommit
          ?.committed ??
        0
      ),

    resumed:
      true,

    registryRevision:
      resumed
        .finalRegistrySnapshot
        .revision,

    adapterActions:
      cumulativeActions.length,
  });

  /*
   * Simulamos un proceso nuevo después
   * del resume antes de ejecutar moves.
   *
   * Resources y bindings sobreviven.
   * El historial de channels queda fuera
   * del checkpoint de moves.
   */
  adapter =
    new FakeDiscordExecutionAdapter(
      createPhaseLocalSeed(
        resumed.finalAdapterSnapshot,
      ),
    );

  registry =
    SessionBindingRegistry.restore(
      resumed.finalRegistrySnapshot,
    );

  /*
   * =======================================
   * MOVES
   * =======================================
   */
  const moveOperations =
    phaseOperations(
      automatable,
      'moves',
    );

  const moves =
    await runCheckpointedBindingPhase({
      context:
        makeContext(
          options,
          'moves',
          moveOperations,
        ),

      operations:
        moveOperations,

      adapter,

      registry,
    });

  if (
    moves.journal.status !==
      'completed'
  ) {
    throw new Error(
      'La fase moves no terminó correctamente.',
    );
  }

  cumulativeActions.push(
    ...structuredClone(
      moves
        .finalAdapterSnapshot
        .actions,
    ),
  );

  phases.push({
    phase:
      'moves',

    operations:
      moveOperations.length,

    succeeded:
      moves.journal
        .summary
        .succeeded,

    syntheticFailures:
      0,

    bindingsCommitted:
      moves.bindingCommit
        .committed,

    resumed:
      false,

    registryRevision:
      moves
        .finalRegistrySnapshot
        .revision,

    adapterActions:
      cumulativeActions.length,
  });

  return {
    schemaVersion: 1,

    status:
      'completed',

    blockReason:
      null,

    adapterCreated:
      true,

    registryCreated:
      true,

    drift,

    totalOperations:
      options.operations.length,

    automatableOperations:
      automatable.length,

    manualReviewOperations,

    phases,

    stoppedChannelsCheckpoint:
      stopped.sealedCheckpoint,

    finalAdapterSnapshot:
      withCumulativeActions(
        moves.finalAdapterSnapshot,
        cumulativeActions,
      ),

    finalRegistrySnapshot:
      moves.finalRegistrySnapshot,

    executionAllowed:
      false,
  };
}
