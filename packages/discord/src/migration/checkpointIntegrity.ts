import {
  createHash,
  timingSafeEqual,
} from 'node:crypto';

import type {
  ExecutionCheckpoint,
} from './executionJournalTypes.js';

import type {
  BoundExecutionCheckpoint,
  CheckpointIntegrityCheck,
  CheckpointIntegrityContext,
  CheckpointIntegrityVerification,
} from './checkpointIntegrityTypes.js';

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
        Record<
          string,
          unknown
        >;

    const result:
      Record<
        string,
        unknown
      > = {};

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

function fingerprintPayload(
  value: {
    schemaVersion: 1;

    algorithm: 'sha256';

    sealedAt: string;

    context:
      CheckpointIntegrityContext;

    checkpoint:
      ExecutionCheckpoint;

    executionAllowed: false;
  },
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
  left: string[],
  right: string[],
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

export function sealExecutionCheckpoint(
  checkpoint: ExecutionCheckpoint,
  context: CheckpointIntegrityContext,
  now = new Date(),
): BoundExecutionCheckpoint {
  const payload = {
    schemaVersion:
      1 as const,

    algorithm:
      'sha256' as const,

    sealedAt:
      now.toISOString(),

    context: {
      guildId:
        context.guildId,

      sessionId:
        context.sessionId,

      gateFingerprint:
        context.gateFingerprint,

      gateEnvelopeFingerprint:
        context.gateEnvelopeFingerprint,

      phase:
        context.phase,

      operationIds: [
        ...context.operationIds,
      ],
    },

    checkpoint:
      structuredClone(
        checkpoint,
      ),

    executionAllowed:
      false as const,
  };

  return {
    ...payload,

    integrityFingerprint:
      fingerprintPayload(
        payload,
      ),
  };
}

export function verifyExecutionCheckpointIntegrity(
  sealed: BoundExecutionCheckpoint,
  expected:
    CheckpointIntegrityContext,
  now = new Date(),
): CheckpointIntegrityVerification {
  const checks:
    CheckpointIntegrityCheck[] = [];

  const calculatedFingerprint =
    fingerprintPayload({
      schemaVersion:
        sealed.schemaVersion,

      algorithm:
        sealed.algorithm,

      sealedAt:
        sealed.sealedAt,

      context:
        sealed.context,

      checkpoint:
        sealed.checkpoint,

      executionAllowed:
        sealed.executionAllowed,
    });

  checks.push({
    id:
      'integrity_fingerprint',

    status:
      safeHashEqual(
        sealed.integrityFingerprint,
        calculatedFingerprint,
      )
        ? 'pass'
        : 'block',

    details:
      safeHashEqual(
        sealed.integrityFingerprint,
        calculatedFingerprint,
      )
        ? 'El contenido del checkpoint coincide con su fingerprint SHA-256.'
        : 'El contenido del checkpoint fue alterado o su fingerprint no coincide.',
  });

  checks.push({
    id:
      'guild_identity',

    status:
      sealed.context.guildId ===
        expected.guildId
        ? 'pass'
        : 'block',

    details:
      sealed.context.guildId ===
        expected.guildId
        ? `Guild confirmado: ${expected.guildId}.`
        : 'El checkpoint pertenece a otro Guild.',
  });

  checks.push({
    id:
      'session_identity',

    status:
      sealed.context.sessionId ===
        expected.sessionId
        ? 'pass'
        : 'block',

    details:
      sealed.context.sessionId ===
        expected.sessionId
        ? `Session confirmada: ${expected.sessionId}.`
        : 'El checkpoint pertenece a otra Execution Session.',
  });

  checks.push({
    id:
      'gate_fingerprint',

    status:
      sealed.context
        .gateFingerprint ===
        expected.gateFingerprint
        ? 'pass'
        : 'block',

    details:
      sealed.context
        .gateFingerprint ===
        expected.gateFingerprint
        ? 'Migration Gate fingerprint coincide.'
        : 'El checkpoint fue generado contra otro Migration Gate.',
  });

  checks.push({
    id:
      'gate_envelope_fingerprint',

    status:
      sealed.context
        .gateEnvelopeFingerprint ===
        expected.gateEnvelopeFingerprint
        ? 'pass'
        : 'block',

    details:
      sealed.context
        .gateEnvelopeFingerprint ===
        expected.gateEnvelopeFingerprint
        ? 'Migration Gate envelope fingerprint coincide.'
        : 'El checkpoint fue generado contra otro envelope del Migration Gate.',
  });

  checks.push({
    id:
      'phase_identity',

    status:
      sealed.context.phase ===
        expected.phase &&
      sealed.checkpoint.phase ===
        expected.phase
        ? 'pass'
        : 'block',

    details:
      sealed.context.phase ===
        expected.phase &&
      sealed.checkpoint.phase ===
        expected.phase
        ? `Fase confirmada: ${expected.phase}.`
        : 'La fase del checkpoint no coincide con la fase esperada.',
  });

  const operationSequenceMatches =
    sameStringArray(
      sealed.context
        .operationIds,
      expected.operationIds,
    );

  checks.push({
    id:
      'operation_sequence',

    status:
      operationSequenceMatches
        ? 'pass'
        : 'block',

    details:
      operationSequenceMatches
        ? `La secuencia exacta de ${expected.operationIds.length} operaciones coincide.`
        : 'La lista u orden de operaciones cambió desde que se creó el checkpoint.',
  });

  const totalMatches =
    sealed.checkpoint
      .totalOperations ===
      expected.operationIds.length;

  checks.push({
    id:
      'operation_count',

    status:
      totalMatches
        ? 'pass'
        : 'block',

    details:
      totalMatches
        ? `Total confirmado: ${expected.operationIds.length}.`
        : 'El total del checkpoint no coincide con el plan actual.',
  });

  const nextIndex =
    sealed.checkpoint
      .nextOperationIndex;

  const nextIndexValid =
    nextIndex === null ||
    (
      Number.isInteger(
        nextIndex,
      ) &&
      nextIndex >= 0 &&
      nextIndex <
        expected.operationIds.length
    );

  checks.push({
    id:
      'resume_index',

    status:
      nextIndexValid
        ? 'pass'
        : 'block',

    details:
      nextIndexValid
        ? `Índice de reanudación válido: ${nextIndex ?? 'completado'}.`
        : 'El índice de reanudación está fuera del plan actual.',
  });

  const failureLineageValid =
    sealed.checkpoint.status ===
      'stopped_on_error'
      ? (
          nextIndex !== null &&
          sealed.checkpoint
            .failedOperationId !==
            null &&
          expected.operationIds[
            nextIndex
          ] ===
            sealed.checkpoint
              .failedOperationId
        )
      : (
          nextIndex === null &&
          sealed.checkpoint
            .failedOperationId ===
            null
        );

  checks.push({
    id:
      'failure_lineage',

    status:
      failureLineageValid
        ? 'pass'
        : 'block',

    details:
      failureLineageValid
        ? 'El punto de reanudación coincide con la operación fallida.'
        : 'La operación fallida y el índice de reanudación no son coherentes.',
  });

  const operationSet =
    new Set(
      expected.operationIds,
    );

  const snapshotActionsValid =
    sealed.checkpoint
      .adapterSnapshot
      .actions
      .every(
        (action) =>
          operationSet.has(
            action.operationId,
          ),
      );

  checks.push({
    id:
      'snapshot_action_lineage',

    status:
      snapshotActionsValid
        ? 'pass'
        : 'block',

    details:
      snapshotActionsValid
        ? 'Todas las acciones guardadas pertenecen al plan actual.'
        : 'El snapshot contiene acciones pertenecientes a otro plan.',
  });

  checks.push({
    id:
      'execution_boundary',

    status:
      sealed.executionAllowed ===
        false
        ? 'pass'
        : 'block',

    details:
      sealed.executionAllowed ===
        false
        ? 'El checkpoint conserva executionAllowed=false.'
        : 'La frontera de no ejecución fue alterada.',
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

    summary: {
      pass,

      block,

      valid:
        block === 0,
    },

    executionAllowed: false,
  };
}
