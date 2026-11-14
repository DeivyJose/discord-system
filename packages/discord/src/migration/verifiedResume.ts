import {
  verifyExecutionCheckpointIntegrity,
} from './checkpointIntegrity.js';

import {
  executeWithJournal,
} from './executionJournal.js';

import type {
  VerifiedResumeCheck,
  VerifiedResumeOptions,
  VerifiedResumeResult,
} from './verifiedResumeTypes.js';

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

export async function verifiedResumeExecution(
  options: VerifiedResumeOptions,
  now:
    () => Date =
      () =>
        new Date(),
): Promise<VerifiedResumeResult> {
  const checks:
    VerifiedResumeCheck[] = [];

  const integrity =
    verifyExecutionCheckpointIntegrity(
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
      'integrity_guard',

    status:
      integrityValid
        ? 'pass'
        : 'block',

    details:
      integrityValid
        ? 'El Checkpoint Integrity Guard aprobó el checkpoint.'
        : 'El Checkpoint Integrity Guard rechazó el checkpoint.',
  });

  if (
    !integrityValid
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'integrity_verification_failed',

      adapterRestored:
        false,

      integrity,

      checks,

      journal:
        null,

      executionAllowed:
        false,
    };
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
        ? 'Las operaciones entregadas al runner coinciden exactamente con el contexto verificado.'
        : 'Las operaciones entregadas al runner no coinciden con la secuencia autorizada.',
  });

  if (
    !operationSequenceMatches
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'operation_sequence_mismatch',

      adapterRestored:
        false,

      integrity,

      checks,

      journal:
        null,

      executionAllowed:
        false,
    };
  }

  const checkpoint =
    options.sealedCheckpoint
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
        : 'El checkpoint no representa una ejecución detenida por error.',
  });

  if (
    !resumable ||
    resumeIndex === null
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'checkpoint_not_resumable',

      adapterRestored:
        false,

      integrity,

      checks,

      journal:
        null,

      executionAllowed:
        false,
    };
  }

  const resumeOperation =
    options.operations[
      resumeIndex
    ];

  const resumeTargetMatches =
    resumeOperation !==
      undefined &&
    resumeOperation.id ===
      checkpoint
        .failedOperationId;

  checks.push({
    id:
      'resume_target',

    status:
      resumeTargetMatches
        ? 'pass'
        : 'block',

    details:
      resumeTargetMatches
        ? `La reanudación apunta exactamente a ${checkpoint.failedOperationId}.`
        : 'El índice de reanudación no apunta a la operación fallida esperada.',
  });

  if (
    !resumeTargetMatches
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'resume_target_mismatch',

      adapterRestored:
        false,

      integrity,

      checks,

      journal:
        null,

      executionAllowed:
        false,
    };
  }

  /*
   * MUY IMPORTANTE:
   *
   * El adapter se restaura únicamente después
   * de que todas las comprobaciones anteriores
   * hayan pasado.
   */
  const adapter =
    options.adapterFactory(
      checkpoint.adapterSnapshot,
    );

  const journal =
    await executeWithJournal(
      adapter,
      {
        phase:
          checkpoint.phase,

        operations:
          options.operations,

        startIndex:
          resumeIndex,
      },
      now,
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

    integrity,

    checks,

    journal,

    executionAllowed:
      false,
  };
}
