import {
  randomBytes,
} from 'node:crypto';

import {
  dispatchExecutionOperation,
} from './executionAdapter.js';

import type {
  DiscordExecutionAdapter,
  ExecutionAdapterSnapshot,
} from './executionAdapterTypes.js';

import type {
  ExecutionCheckpoint,
  ExecutionJournalEntry,
  ExecutionJournalRun,
  ExecutionJournalRunnerOptions,
  ExecutionJournalState,
} from './executionJournalTypes.js';

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

function captureState(
  snapshot: ExecutionAdapterSnapshot,
  actualId: string | null,
): ExecutionJournalState {
  const targetResource =
    actualId
      ? snapshot.resources.find(
          (resource) =>
            resource.actualId ===
              actualId,
        ) ?? null
      : null;

  return {
    actions:
      snapshot.actions.length,

    bindings:
      Object.keys(
        snapshot.bindings,
      ).length,

    resources:
      snapshot.resources.length,

    targetResource:
      targetResource
        ? {
            ...targetResource,
          }
        : null,
  };
}

export async function executeWithJournal(
  adapter: DiscordExecutionAdapter,
  options: ExecutionJournalRunnerOptions,
  now:
    () => Date =
      () =>
        new Date(),
): Promise<ExecutionJournalRun> {
  const startIndex =
    options.startIndex ?? 0;

  if (
    startIndex < 0 ||
    startIndex >
      options.operations.length
  ) {
    throw new Error(
      `startIndex inválido: ${startIndex}.`,
    );
  }

  const startedAt =
    now().toISOString();

  const entries:
    ExecutionJournalEntry[] = [];

  let succeeded = 0;
  let failed = 0;

  let lastSuccessfulOperationId:
    string | null =
      null;

  let failedOperationId:
    string | null =
      null;

  let nextOperationIndex:
    number | null =
      null;

  for (
    let index =
      startIndex;
    index <
      options.operations.length;
    index += 1
  ) {
    const operation =
      options.operations[index];

    if (
      !operation
    ) {
      throw new Error(
        `No existe una operación en el índice ${index}.`,
      );
    }

    const operationStartedAt =
      now().toISOString();

    const actualIdBefore =
      readString(
        operation,
        'actualId',
      );

    const before =
      captureState(
        adapter.snapshot(),
        actualIdBefore,
      );

    try {
      if (
        options.beforeOperation
      ) {
        await options.beforeOperation({
          phase:
            options.phase,

          index,

          operation,
        });
      }

      const result =
        await dispatchExecutionOperation(
          adapter,
          operation,
        );

      const after =
        captureState(
          adapter.snapshot(),
          result.actualId ??
            actualIdBefore,
        );

      entries.push({
        sequence:
          index + 1,

        phase:
          options.phase,

        operationId:
          operation.id,

        operationType:
          operation.type,

        resourceKind:
          operation.resourceKind,

        status:
          'succeeded',

        startedAt:
          operationStartedAt,

        finishedAt:
          now().toISOString(),

        before,

        after,

        actualId:
          result.actualId,

        error: null,
      });

      succeeded += 1;

      lastSuccessfulOperationId =
        operation.id;
    } catch (
      error
    ) {
      failed += 1;

      failedOperationId =
        operation.id;

      nextOperationIndex =
        index;

      const after =
        captureState(
          adapter.snapshot(),
          actualIdBefore,
        );

      entries.push({
        sequence:
          index + 1,

        phase:
          options.phase,

        operationId:
          operation.id,

        operationType:
          operation.type,

        resourceKind:
          operation.resourceKind,

        status:
          'failed',

        startedAt:
          operationStartedAt,

        finishedAt:
          now().toISOString(),

        before,

        after,

        actualId: null,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      break;
    }
  }

  const stoppedOnError =
    failed > 0;

  const completed =
    !stoppedOnError &&
    startIndex +
      succeeded >=
      options.operations.length;

  const status =
    completed
      ? 'completed' as const
      : 'stopped_on_error' as const;

  if (
    completed
  ) {
    nextOperationIndex =
      null;
  }

  const checkpoint:
    ExecutionCheckpoint = {
      schemaVersion: 1,

      checkpointId:
        randomBytes(12)
          .toString('hex'),

      createdAt:
        now().toISOString(),

      phase:
        options.phase,

      status,

      totalOperations:
        options.operations.length,

      startIndex,

      nextOperationIndex,

      lastSuccessfulOperationId,

      failedOperationId,

      succeeded,

      failed,

      adapterSnapshot:
        adapter.snapshot(),
    };

  return {
    schemaVersion: 1,

    runId:
      randomBytes(12)
        .toString('hex'),

    startedAt,

    finishedAt:
      now().toISOString(),

    phase:
      options.phase,

    status,

    startIndex,

    entries,

    checkpoint,

    summary: {
      attempted:
        entries.length,

      succeeded,

      failed,

      stoppedOnError,

      completed,
    },

    executionAllowed: false,
  };
}
