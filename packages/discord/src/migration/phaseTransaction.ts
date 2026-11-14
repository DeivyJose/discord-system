import {
  sealExecutionCheckpoint,
} from './checkpointIntegrity.js';

import {
  executeWithJournal,
} from './executionJournal.js';

import type {
  PhaseTransactionCheck,
  PhaseTransactionOptions,
  PhaseTransactionResult,
} from './phaseTransactionTypes.js';

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

function findDuplicates(
  values: string[],
): string[] {
  const seen =
    new Set<string>();

  const duplicates =
    new Set<string>();

  for (
    const value
    of values
  ) {
    if (
      seen.has(
        value,
      )
    ) {
      duplicates.add(
        value,
      );
    }

    seen.add(
      value,
    );
  }

  return [
    ...duplicates,
  ];
}

export async function runExecutionPhaseTransaction(
  options: PhaseTransactionOptions,
  now:
    () => Date =
      () =>
        new Date(),
): Promise<PhaseTransactionResult> {
  const checks:
    PhaseTransactionCheck[] = [];

  const operationIds =
    options.operations.map(
      (operation) =>
        operation.id,
    );

  const nonEmpty =
    operationIds.length > 0;

  checks.push({
    id:
      'non_empty_operation_set',

    status:
      nonEmpty
        ? 'pass'
        : 'block',

    details:
      nonEmpty
        ? `La fase contiene ${operationIds.length} operación(es).`
        : 'La fase no contiene operaciones.',
  });

  if (
    !nonEmpty
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'empty_operation_set',

      context:
        structuredClone(
          options.context,
        ),

      adapterCreated:
        false,

      checks,

      journal:
        null,

      sealedCheckpoint:
        null,

      summary: {
        operations: 0,

        attempted: 0,

        succeeded: 0,

        failed: 0,

        checkpointSealed:
          false,

        resumeAvailable:
          false,
      },

      executionAllowed:
        false,
    };
  }

  const duplicates =
    findDuplicates(
      operationIds,
    );

  const unique =
    duplicates.length ===
      0;

  checks.push({
    id:
      'unique_operation_ids',

    status:
      unique
        ? 'pass'
        : 'block',

    details:
      unique
        ? 'Todos los operation IDs de la fase son únicos.'
        : `Operation IDs duplicados: ${duplicates.join(', ')}.`,
  });

  if (
    !unique
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'duplicate_operation_ids',

      context:
        structuredClone(
          options.context,
        ),

      adapterCreated:
        false,

      checks,

      journal:
        null,

      sealedCheckpoint:
        null,

      summary: {
        operations:
          operationIds.length,

        attempted: 0,

        succeeded: 0,

        failed: 0,

        checkpointSealed:
          false,

        resumeAvailable:
          false,
      },

      executionAllowed:
        false,
    };
  }

  const sequenceMatches =
    sameStringArray(
      operationIds,
      options.context
        .operationIds,
    );

  checks.push({
    id:
      'operation_sequence',

    status:
      sequenceMatches
        ? 'pass'
        : 'block',

    details:
      sequenceMatches
        ? 'La secuencia exacta de operaciones coincide con el contexto de la transacción.'
        : 'Las operaciones entregadas no coinciden con la secuencia autorizada.',
  });

  if (
    !sequenceMatches
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'operation_sequence_mismatch',

      context:
        structuredClone(
          options.context,
        ),

      adapterCreated:
        false,

      checks,

      journal:
        null,

      sealedCheckpoint:
        null,

      summary: {
        operations:
          operationIds.length,

        attempted: 0,

        succeeded: 0,

        failed: 0,

        checkpointSealed:
          false,

        resumeAvailable:
          false,
      },

      executionAllowed:
        false,
    };
  }

  /*
   * El adapter se crea solamente después
   * de validar toda la frontera anterior.
   */
  const adapter =
    options.adapterFactory();

  const journal =
    await executeWithJournal(
      adapter,
      {
        phase:
          options.context.phase,

        operations:
          options.operations,

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

  const sealedCheckpoint =
    sealExecutionCheckpoint(
      journal.checkpoint,
      options.context,
      now(),
    );

  const resumeAvailable =
    journal.status ===
      'stopped_on_error' &&
    journal.checkpoint
      .nextOperationIndex !==
      null;

  return {
    schemaVersion: 1,

    generatedAt:
      now().toISOString(),

    status:
      journal.status,

    blockReason:
      null,

    context:
      structuredClone(
        options.context,
      ),

    adapterCreated:
      true,

    checks,

    journal,

    sealedCheckpoint,

    summary: {
      operations:
        operationIds.length,

      attempted:
        journal.summary
          .attempted,

      succeeded:
        journal.summary
          .succeeded,

      failed:
        journal.summary
          .failed,

      checkpointSealed:
        true,

      resumeAvailable,
    },

    executionAllowed:
      false,
  };
}
