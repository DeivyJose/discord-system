import {
  verifyLiveDrift,
} from './liveDrift.js';

import {
  runExecutionPhaseTransaction,
} from './phaseTransaction.js';

import type {
  DriftProtectedPhaseCheck,
  DriftProtectedPhaseOptions,
  DriftProtectedPhaseResult,
} from './driftProtectedPhaseTypes.js';

export async function runDriftProtectedPhase(
  options:
    DriftProtectedPhaseOptions,
  now:
    () => Date =
      () =>
        new Date(),
): Promise<DriftProtectedPhaseResult> {
  const checks:
    DriftProtectedPhaseCheck[] = [];

  const sessionMatches =
    options.driftContext
      .sessionId ===
      options.transactionContext
        .sessionId;

  checks.push({
    id:
      'session_context_alignment',

    status:
      sessionMatches
        ? 'pass'
        : 'block',

    details:
      sessionMatches
        ? 'Live Drift y Transaction usan la misma Execution Session.'
        : 'Live Drift y Transaction pertenecen a sesiones diferentes.',
  });

  const gateMatches =
    options.driftContext
      .gateFingerprint ===
      options.transactionContext
        .gateFingerprint;

  checks.push({
    id:
      'gate_context_alignment',

    status:
      gateMatches
        ? 'pass'
        : 'block',

    details:
      gateMatches
        ? 'Live Drift y Transaction usan el mismo Migration Gate.'
        : 'Live Drift y Transaction usan Migration Gates diferentes.',
  });

  const guildMatches =
    options.baseline
      .snapshot
      .guildId ===
      options.transactionContext
        .guildId &&
    options.currentSnapshot
      .guildId ===
      options.transactionContext
        .guildId;

  checks.push({
    id:
      'guild_context_alignment',

    status:
      guildMatches
        ? 'pass'
        : 'block',

    details:
      guildMatches
        ? `Guild confirmado: ${options.transactionContext.guildId}.`
        : 'Baseline, snapshot live y Transaction no pertenecen al mismo Guild.',
  });

  const contextValid =
    sessionMatches &&
    gateMatches &&
    guildMatches;

  if (
    !contextValid
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'context_mismatch',

      checks,

      drift: null,

      transaction: null,

      adapterFactoryReached:
        false,

      executionAllowed:
        false,
    };
  }

  const drift =
    verifyLiveDrift(
      options.baseline,
      options.currentSnapshot,
      options.driftContext,
      now(),
    );

  const driftValid =
    drift.status ===
      'valid' &&
    drift.summary.valid &&
    !drift.summary
      .driftDetected;

  checks.push({
    id:
      'live_drift_guard',

    status:
      driftValid
        ? 'pass'
        : 'block',

    details:
      driftValid
        ? 'No se detectó drift estructural.'
        : `Live Drift Guard bloqueó la fase con ${drift.changes.length} cambio(s).`,
  });

  if (
    !driftValid
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'live_drift_detected',

      checks,

      drift,

      transaction: null,

      adapterFactoryReached:
        false,

      executionAllowed:
        false,
    };
  }

  let adapterFactoryReached =
    false;

  const transaction =
    await runExecutionPhaseTransaction(
      {
        context:
          options.transactionContext,

        operations:
          options.operations,

        adapterFactory:
          () => {
            adapterFactoryReached =
              true;

            return options
              .adapterFactory();
          },

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

  if (
    transaction.status ===
      'blocked'
  ) {
    return {
      schemaVersion: 1,

      generatedAt:
        now().toISOString(),

      status:
        'blocked',

      blockReason:
        'phase_transaction_blocked',

      checks,

      drift,

      transaction,

      adapterFactoryReached,

      executionAllowed:
        false,
    };
  }

  return {
    schemaVersion: 1,

    generatedAt:
      now().toISOString(),

    status:
      transaction.status,

    blockReason: null,

    checks,

    drift,

    transaction,

    adapterFactoryReached,

    executionAllowed:
      false,
  };
}
