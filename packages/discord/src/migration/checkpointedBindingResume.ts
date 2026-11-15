import {
  createHash,
  timingSafeEqual,
} from 'node:crypto';

import {
  sealExecutionCheckpoint,
  verifyExecutionCheckpointIntegrity,
} from './checkpointIntegrity.js';

import {
  executeWithJournal,
} from './executionJournal.js';

import {
  prepareBindingAwareOperation,
} from './bindingAwareExecution.js';

import type {
  AutomatableMigrationOperation,
  DiscordExecutionAdapter,
  ExecutionAdapterSnapshot,
} from './executionAdapterTypes.js';

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

import type {
  ExecutionJournalRun,
} from './executionJournalTypes.js';

import type {
  MutationResolverBindings,
} from './discordMutationResolverTypes.js';

import type {
  SessionBindingRegistry,
} from './sessionBindingRegistry.js';

import type {
  SessionBindingCommitResult,
  SessionBindingRegistrySnapshot,
} from './sessionBindingRegistryTypes.js';

import type {
  BindingAwareCheckpointCheck,
  BindingAwareCheckpointVerification,
  BoundBindingAwareCheckpoint,
  CheckpointedBindingPhaseOptions,
  CheckpointedBindingPhaseResult,
  CheckpointedBindingResumeCheck,
  CheckpointedBindingResumeOptions,
  CheckpointedBindingResumeResult,
} from './checkpointedBindingResumeTypes.js';

function canonicalize(
  value: unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      canonicalize,
    );
  }

  if (
    typeof value === 'object' &&
    value !== null
  ) {
    const source =
      value as
        Record<string, unknown>;

    const result:
      Record<string, unknown> =
      {};

    for (
      const key
      of Object.keys(
        source,
      ).sort()
    ) {
      result[key] =
        canonicalize(
          source[key],
        );
    }

    return result;
  }

  return value;
}

function canonicalJson(
  value: unknown,
): string {
  return JSON.stringify(
    canonicalize(
      value,
    ),
  );
}

function sha256(
  value: unknown,
): string {
  return createHash(
    'sha256',
  )
    .update(
      canonicalJson(
        value,
      ),
      'utf8',
    )
    .digest(
      'hex',
    );
}

function safeHashEqual(
  left: string,
  right: string,
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(
      left,
    ) ||
    !/^[a-f0-9]{64}$/i.test(
      right,
    )
  ) {
    return false;
  }

  const leftBuffer =
    Buffer.from(
      left,
      'hex',
    );

  const rightBuffer =
    Buffer.from(
      right,
      'hex',
    );

  return (
    leftBuffer.length ===
      rightBuffer.length &&
    timingSafeEqual(
      leftBuffer,
      rightBuffer,
    )
  );
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length ===
      right.length &&
    left.every(
      (
        value,
        index,
      ) =>
        value ===
        right[index],
    )
  );
}

function readString(
  value: unknown,
  key: string,
): string | null {
  if (
    typeof value !== 'object' ||
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

function resolverBindingsFromSnapshot(
  snapshot:
    SessionBindingRegistrySnapshot,
): MutationResolverBindings {
  const session:
    Record<string, string> =
    {};

  for (
    const [
      blueprintId,
      record,
    ]
    of Object.entries(
      snapshot.session,
    )
  ) {
    session[
      blueprintId
    ] =
      record.actualId;
  }

  return {
    confirmed:
      structuredClone(
        snapshot.confirmed,
      ),

    session,
  };
}

function prepareOperations(
  operations:
    AutomatableMigrationOperation[],
  bindings:
    MutationResolverBindings,
): AutomatableMigrationOperation[] {
  return operations.map(
    (operation) =>
      prepareBindingAwareOperation(
        operation,
        bindings,
      ).operation,
  );
}

function registrySnapshotSemanticallyValid(
  snapshot:
    SessionBindingRegistrySnapshot,
): boolean {
  if (
    snapshot.schemaVersion !==
      1 ||
    snapshot.executionAllowed !==
      false ||
    snapshot.guildId.trim()
      .length === 0 ||
    !Number.isInteger(
      snapshot.revision,
    ) ||
    snapshot.revision < 0
  ) {
    return false;
  }

  const owners =
    new Map<
      string,
      string
    >();

  for (
    const [
      blueprintId,
      actualId,
    ]
    of Object.entries(
      snapshot.confirmed,
    )
  ) {
    if (
      blueprintId.trim()
        .length === 0 ||
      actualId.trim()
        .length === 0
    ) {
      return false;
    }

    const owner =
      owners.get(
        actualId,
      );

    if (
      owner &&
      owner !==
        blueprintId
    ) {
      return false;
    }

    owners.set(
      actualId,
      blueprintId,
    );
  }

  for (
    const [
      blueprintId,
      record,
    ]
    of Object.entries(
      snapshot.session,
    )
  ) {
    if (
      blueprintId.trim()
        .length === 0 ||
      record.blueprintId !==
        blueprintId ||
      record.actualId.trim()
        .length === 0
    ) {
      return false;
    }

    /*
     * Un binding confirmado no debe
     * reaparecer silenciosamente como
     * binding de sesión.
     */
    if (
      snapshot.confirmed[
        blueprintId
      ] !==
        undefined
    ) {
      return false;
    }

    const owner =
      owners.get(
        record.actualId,
      );

    if (
      owner &&
      owner !==
        blueprintId
    ) {
      return false;
    }

    owners.set(
      record.actualId,
      blueprintId,
    );
  }

  return true;
}

function adapterRegistryBindingsAgree(
  adapter:
    ExecutionAdapterSnapshot,
  registry:
    SessionBindingRegistrySnapshot,
): boolean {
  for (
    const [
      blueprintId,
      actualId,
    ]
    of Object.entries(
      adapter.bindings,
    )
  ) {
    const registryActualId =
      registry.session[
        blueprintId
      ]?.actualId ??
      registry.confirmed[
        blueprintId
      ];

    if (
      registryActualId !==
        actualId
    ) {
      return false;
    }
  }

  return true;
}

function outerPayload(
  value: {
    schemaVersion: 1;

    algorithm: 'sha256';

    sealedAt: string;

    executionCheckpoint:
      BoundBindingAwareCheckpoint[
        'executionCheckpoint'
      ];

    bindingRegistrySnapshot:
      SessionBindingRegistrySnapshot;

    executionAllowed: false;
  },
): unknown {
  return value;
}

export function sealBindingAwareCheckpoint(
  executionCheckpoint:
    BoundBindingAwareCheckpoint[
      'executionCheckpoint'
    ],

  bindingRegistrySnapshot:
    SessionBindingRegistrySnapshot,

  now =
    new Date(),
): BoundBindingAwareCheckpoint {
  const payload = {
    schemaVersion:
      1 as const,

    algorithm:
      'sha256' as const,

    sealedAt:
      now.toISOString(),

    executionCheckpoint:
      structuredClone(
        executionCheckpoint,
      ),

    bindingRegistrySnapshot:
      structuredClone(
        bindingRegistrySnapshot,
      ),

    executionAllowed:
      false as const,
  };

  return {
    ...payload,

    integrityFingerprint:
      sha256(
        outerPayload(
          payload,
        ),
      ),
  };
}

export function verifyBindingAwareCheckpoint(
  sealed:
    BoundBindingAwareCheckpoint,

  expectedContext:
    CheckpointIntegrityContext,

  now =
    new Date(),
): BindingAwareCheckpointVerification {
  const checks:
    BindingAwareCheckpointCheck[] =
    [];

  const calculatedFingerprint =
    sha256(
      outerPayload({
        schemaVersion:
          sealed.schemaVersion,

        algorithm:
          sealed.algorithm,

        sealedAt:
          sealed.sealedAt,

        executionCheckpoint:
          sealed.executionCheckpoint,

        bindingRegistrySnapshot:
          sealed.bindingRegistrySnapshot,

        executionAllowed:
          sealed.executionAllowed,
      }),
    );

  const fingerprintValid =
    safeHashEqual(
      sealed.integrityFingerprint,
      calculatedFingerprint,
    );

  checks.push({
    id:
      'composite_integrity',

    status:
      fingerprintValid
        ? 'pass'
        : 'block',

    details:
      fingerprintValid
        ? 'Adapter checkpoint y Binding Registry coinciden con el fingerprint compuesto.'
        : 'El checkpoint compuesto fue alterado o no coincide con su fingerprint.',
  });

  const registryGuildValid =
    sealed.bindingRegistrySnapshot
      .guildId ===
    expectedContext.guildId;

  checks.push({
    id:
      'registry_guild',

    status:
      registryGuildValid
        ? 'pass'
        : 'block',

    details:
      registryGuildValid
        ? `Binding Registry pertenece al Guild ${expectedContext.guildId}.`
        : 'Binding Registry pertenece a otro Guild.',
  });

  const registrySemanticValid =
    registrySnapshotSemanticallyValid(
      sealed.bindingRegistrySnapshot,
    );

  checks.push({
    id:
      'registry_snapshot_semantics',

    status:
      registrySemanticValid
        ? 'pass'
        : 'block',

    details:
      registrySemanticValid
        ? 'Binding Registry snapshot es estructuralmente válido.'
        : 'Binding Registry snapshot contiene bindings inválidos o conflictivos.',
  });

  const crossStateValid =
    adapterRegistryBindingsAgree(
      sealed.executionCheckpoint
        .checkpoint
        .adapterSnapshot,

      sealed.bindingRegistrySnapshot,
    );

  checks.push({
    id:
      'adapter_registry_lineage',

    status:
      crossStateValid
        ? 'pass'
        : 'block',

    details:
      crossStateValid
        ? 'Los bindings del adapter coinciden con el Registry.'
        : 'Adapter snapshot y Binding Registry discrepan.',
  });

  const executionCheckpointIntegrity =
    verifyExecutionCheckpointIntegrity(
      sealed.executionCheckpoint,
      expectedContext,
      now,
    );

  const innerValid =
    executionCheckpointIntegrity
      .status ===
        'valid' &&
    executionCheckpointIntegrity
      .summary
      .valid;

  checks.push({
    id:
      'execution_checkpoint_integrity',

    status:
      innerValid
        ? 'pass'
        : 'block',

    details:
      innerValid
        ? 'Execution Checkpoint Integrity Guard aprobó el estado del adapter.'
        : 'Execution Checkpoint Integrity Guard rechazó el estado del adapter.',
  });

  const pass =
    checks.filter(
      (check) =>
        check.status ===
        'pass',
    ).length;

  const block =
    checks.filter(
      (check) =>
        check.status ===
        'block',
    ).length;

  return {
    schemaVersion: 1,

    verifiedAt:
      now.toISOString(),

    status:
      block === 0
        ? 'valid'
        : 'blocked',

    checks,

    executionCheckpointIntegrity,

    summary: {
      pass,

      block,

      valid:
        block === 0,
    },

    executionAllowed:
      false,
  };
}

function persistSucceededBindings(
  registry:
    SessionBindingRegistry,

  originalOperations:
    AutomatableMigrationOperation[],

  journal:
    ExecutionJournalRun,

  adapterSnapshot:
    ExecutionAdapterSnapshot,
): SessionBindingCommitResult {
  const operationById =
    new Map(
      originalOperations.map(
        (operation) => [
          operation.id,
          operation,
        ] as const,
      ),
    );

  const transaction =
    registry.beginTransaction(
      `journal-${journal.runId}`,
    );

  for (
    const entry
    of journal.entries
  ) {
    if (
      entry.status !==
        'succeeded'
    ) {
      continue;
    }

    const operation =
      operationById.get(
        entry.operationId,
      );

    if (
      !operation
    ) {
      throw new Error(
        `Journal contiene operación desconocida: ${entry.operationId}.`,
      );
    }

    const blueprintId =
      readString(
        operation,
        'blueprintId',
      );

    if (
      !blueprintId
    ) {
      continue;
    }

    const actualId =
      adapterSnapshot.bindings[
        blueprintId
      ] ??
      entry.actualId;

    if (
      !actualId
    ) {
      continue;
    }

    transaction.stage(
      blueprintId,
      actualId,
      entry.operationId,
      new Date(
        entry.finishedAt,
      ),
    );
  }

  return transaction.commit();
}

export async function runCheckpointedBindingPhase(
  options:
    CheckpointedBindingPhaseOptions,

  now:
    () => Date =
      () =>
        new Date(),
): Promise<CheckpointedBindingPhaseResult> {
  const preparedOperations =
    prepareOperations(
      options.operations,
      options.registry
        .toResolverBindings(),
    );

  const journal =
    await executeWithJournal(
      options.adapter,
      {
        phase:
          options.context.phase,

        operations:
          preparedOperations,

        ...(
          options.beforeOperation
            ? {
                beforeOperation:
                  options.beforeOperation,
              }
            : {}
        ),
      },
      now,
    );

  const finalAdapterSnapshot =
    options.adapter.snapshot();

  const bindingCommit =
    persistSucceededBindings(
      options.registry,
      options.operations,
      journal,
      finalAdapterSnapshot,
    );

  const executionCheckpoint =
    sealExecutionCheckpoint(
      journal.checkpoint,
      options.context,
      now(),
    );

  const finalRegistrySnapshot =
    options.registry.snapshot();

  const sealedCheckpoint =
    sealBindingAwareCheckpoint(
      executionCheckpoint,
      finalRegistrySnapshot,
      now(),
    );

  return {
    schemaVersion: 1,

    journal,

    bindingCommit,

    sealedCheckpoint,

    finalAdapterSnapshot,

    finalRegistrySnapshot,

    executionAllowed:
      false,
  };
}

function blockedResult(
  reason:
    CheckpointedBindingResumeResult[
      'blockReason'
    ],

  integrity:
    BindingAwareCheckpointVerification,

  checks:
    CheckpointedBindingResumeCheck[],

  now:
    () => Date,
): CheckpointedBindingResumeResult {
  return {
    schemaVersion: 1,

    generatedAt:
      now().toISOString(),

    status:
      'blocked',

    blockReason:
      reason,

    adapterRestored:
      false,

    registryRestored:
      false,

    integrity,

    checks,

    journal: null,

    bindingCommit: null,

    sealedCheckpoint: null,

    finalAdapterSnapshot:
      null,

    finalRegistrySnapshot:
      null,

    executionAllowed:
      false,
  };
}

export async function resumeCheckpointedBindingPhase(
  options:
    CheckpointedBindingResumeOptions,

  now:
    () => Date =
      () =>
        new Date(),
): Promise<CheckpointedBindingResumeResult> {
  const checks:
    CheckpointedBindingResumeCheck[] =
    [];

  const integrity =
    verifyBindingAwareCheckpoint(
      options.sealedCheckpoint,
      options.expectedContext,
      now(),
    );

  const integrityValid =
    integrity.status ===
      'valid' &&
    integrity.summary.valid;

  checks.push({
    id:
      'composite_integrity_guard',

    status:
      integrityValid
        ? 'pass'
        : 'block',

    details:
      integrityValid
        ? 'Checkpoint compuesto aprobado.'
        : 'Checkpoint compuesto rechazado.',
  });

  if (
    !integrityValid
  ) {
    return blockedResult(
      'checkpoint_integrity_failed',
      integrity,
      checks,
      now,
    );
  }

  const suppliedOperationIds =
    options.operations.map(
      (operation) =>
        operation.id,
    );

  const operationSequenceMatches =
    sameStringArray(
      suppliedOperationIds,
      options.expectedContext
        .operationIds,
    );

  checks.push({
    id:
      'runner_operation_sequence',

    status:
      operationSequenceMatches
        ? 'pass'
        : 'block',

    details:
      operationSequenceMatches
        ? 'La secuencia entregada al resume coincide exactamente.'
        : 'Las operaciones entregadas al resume cambiaron.',
  });

  if (
    !operationSequenceMatches
  ) {
    return blockedResult(
      'operation_sequence_mismatch',
      integrity,
      checks,
      now,
    );
  }

  const checkpoint =
    options.sealedCheckpoint
      .executionCheckpoint
      .checkpoint;

  const resumeIndex =
    checkpoint
      .nextOperationIndex;

  const resumable =
    checkpoint.status ===
      'stopped_on_error' &&
    resumeIndex !== null &&
    checkpoint.failedOperationId !==
      null;

  checks.push({
    id:
      'checkpoint_resumable',

    status:
      resumable
        ? 'pass'
        : 'block',

    details:
      resumable
        ? `Checkpoint resumible desde índice ${resumeIndex}.`
        : 'Checkpoint no representa un STOP recuperable.',
  });

  if (
    !resumable ||
    resumeIndex === null
  ) {
    return blockedResult(
      'checkpoint_not_resumable',
      integrity,
      checks,
      now,
    );
  }

  const resumeOperation =
    options.operations[
      resumeIndex
    ];

  const resumeTargetMatches =
    resumeOperation !==
      undefined &&
    resumeOperation.id ===
      checkpoint.failedOperationId;

  checks.push({
    id:
      'resume_target',

    status:
      resumeTargetMatches
        ? 'pass'
        : 'block',

    details:
      resumeTargetMatches
        ? `Resume apunta exactamente a ${checkpoint.failedOperationId}.`
        : 'Resume no apunta a la operación fallida.',
  });

  if (
    !resumeTargetMatches
  ) {
    return blockedResult(
      'resume_target_mismatch',
      integrity,
      checks,
      now,
    );
  }

  /*
   * Preflight de resolución ANTES
   * de crear adapter o registry.
   */
  let preparedOperations:
    AutomatableMigrationOperation[];

  try {
    preparedOperations =
      prepareOperations(
        options.operations,
        resolverBindingsFromSnapshot(
          options.sealedCheckpoint
            .bindingRegistrySnapshot,
        ),
      );
  } catch (
    error
  ) {
    checks.push({
      id:
        'resolution_preflight',

      status:
        'block',

      details:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return blockedResult(
      'resolution_preflight_failed',
      integrity,
      checks,
      now,
    );
  }

  checks.push({
    id:
      'resolution_preflight',

    status:
      'pass',

    details:
      'Todas las operaciones pueden resolverse usando el Registry restaurable.',
  });

  /*
   * IMPORTANTE:
   *
   * Ninguna factory se alcanza antes
   * de superar TODAS las comprobaciones.
   */
  const registry =
    options.registryFactory(
      structuredClone(
        options.sealedCheckpoint
          .bindingRegistrySnapshot,
      ),
    );

  const adapter =
    options.adapterFactory(
      structuredClone(
        checkpoint.adapterSnapshot,
      ),
    );

  const journal =
    await executeWithJournal(
      adapter,
      {
        phase:
          checkpoint.phase,

        operations:
          preparedOperations,

        startIndex:
          resumeIndex,
      },
      now,
    );

  const finalAdapterSnapshot =
    adapter.snapshot();

  const bindingCommit =
    persistSucceededBindings(
      registry,
      options.operations,
      journal,
      finalAdapterSnapshot,
    );

  const newExecutionCheckpoint =
    sealExecutionCheckpoint(
      journal.checkpoint,
      options.expectedContext,
      now(),
    );

  const finalRegistrySnapshot =
    registry.snapshot();

  const sealedCheckpoint =
    sealBindingAwareCheckpoint(
      newExecutionCheckpoint,
      finalRegistrySnapshot,
      now(),
    );

  return {
    schemaVersion: 1,

    generatedAt:
      now().toISOString(),

    status:
      journal.status,

    blockReason:
      null,

    adapterRestored:
      true,

    registryRestored:
      true,

    integrity,

    checks,

    journal,

    bindingCommit,

    sealedCheckpoint,

    finalAdapterSnapshot,

    finalRegistrySnapshot,

    executionAllowed:
      false,
  };
}
