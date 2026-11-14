import {
  createHash,
} from 'node:crypto';

import type {
  ExecutionSessionItem,
  ExecutionSessionPhase,
  ExecutionSessionPhaseId,
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import type {
  PhaseDryRunCheck,
  PhaseDryRunCheckStatus,
  PhaseDryRunIntent,
  PhaseDryRunPlan,
} from './phaseDryRunTypes.js';

function countStatus(
  checks: PhaseDryRunCheck[],
  status: PhaseDryRunCheckStatus,
): number {
  return checks.filter(
    (check) =>
      check.status === status,
  ).length;
}

function readString(
  object: unknown,
  key: string,
): string | null {
  if (
    typeof object !== 'object' ||
    object === null
  ) {
    return null;
  }

  const value =
    Reflect.get(
      object,
      key,
    );

  return typeof value === 'string'
    ? value
    : null;
}

function describeAction(
  item: ExecutionSessionItem,
): string {
  const operation =
    item.operation;

  const currentName =
    readString(
      operation,
      'currentName',
    );

  const desiredName =
    readString(
      operation,
      'desiredName',
    );

  const blueprintId =
    readString(
      operation,
      'blueprintId',
    );

  switch (
    operation.type
  ) {
    case 'create_role':
      return [
        'Crear rol',
        item.preview.label,
        blueprintId
          ? `(${blueprintId})`
          : '',
      ]
        .filter(Boolean)
        .join(' ');

    case 'create_category':
      return [
        'Crear categoría',
        item.preview.label,
        blueprintId
          ? `(${blueprintId})`
          : '',
      ]
        .filter(Boolean)
        .join(' ');

    case 'create_channel':
      return [
        'Crear canal',
        item.preview.label,
        blueprintId
          ? `(${blueprintId})`
          : '',
      ]
        .filter(Boolean)
        .join(' ');

    case 'rename_category':
    case 'rename_channel':
    case 'rename_role':
      return [
        'Renombrar',
        currentName
          ? `"${currentName}"`
          : item.preview.label,
        desiredName
          ? `→ "${desiredName}"`
          : '',
      ]
        .filter(Boolean)
        .join(' ');

    case 'move_channel':
      return [
        'Mover canal',
        item.preview.label,
        'a su categoría definida en el Blueprint',
      ].join(' ');

    case 'review_managed_role':
      return [
        'Revisar manualmente rol managed',
        item.preview.label,
      ].join(' ');

    case 'review_binding':
      return [
        'Revisar manualmente binding',
        item.preview.label,
      ].join(' ');

    case 'review_legacy':
      return [
        'Revisar recurso legacy no administrado',
        item.preview.label,
      ].join(' ');

    default:
      return [
        'Operación',
        operation.type,
        'sobre',
        item.preview.label,
      ].join(' ');
  }
}

function createPhaseFingerprint(
  session: ExecutionSessionPlan,
  phase: ExecutionSessionPhase,
): string {
  const payload = {
    sessionId:
      session.sessionId,

    gateFingerprint:
      session.gateFingerprint,

    approvalReceiptId:
      session.approvalReceiptId,

    phaseId:
      phase.id,

    operations:
      phase.items.map(
        (item) => ({
          operation:
            item.operation,

          preview:
            item.preview,
        }),
      ),
  };

  return createHash(
    'sha256',
  )
    .update(
      JSON.stringify(payload),
      'utf8',
    )
    .digest('hex');
}

export function createPhaseDryRunPlan(
  session: ExecutionSessionPlan,
  requestedPhase: ExecutionSessionPhaseId,
  now = new Date(),
): PhaseDryRunPlan {
  const checks:
    PhaseDryRunCheck[] = [];

  const phase =
    session.phases.find(
      (candidate) =>
        candidate.id ===
          requestedPhase,
    );

  if (
    !phase
  ) {
    throw new Error(
      `La fase ${requestedPhase} no existe en la Execution Session.`,
    );
  }

  checks.push({
    id: 'session_status',

    status:
      session.status ===
        'ready'
        ? 'pass'
        : 'block',

    details:
      session.status ===
        'ready'
        ? `Execution Session ${session.sessionId} está ready.`
        : `Execution Session está ${session.status}.`,
  });

  checks.push({
    id: 'execution_boundary',

    status:
      session.executionAllowed ===
        false
        ? 'pass'
        : 'block',

    details:
      session.executionAllowed ===
        false
        ? 'La Execution Session conserva executionAllowed=false.'
        : 'La frontera de no ejecución fue alterada.',
  });

  const expiresAt =
    new Date(
      session.source.receiptExpiresAt,
    );

  const expirationValid =
    Number.isFinite(
      expiresAt.getTime(),
    );

  const approvalStillFresh =
    expirationValid &&
    now.getTime() <
      expiresAt.getTime();

  checks.push({
    id: 'approval_freshness',

    status:
      approvalStillFresh
        ? 'pass'
        : 'block',

    details:
      approvalStillFresh
        ? `Approval Receipt vigente hasta ${session.source.receiptExpiresAt}.`
        : `Approval Receipt expirado desde ${session.source.receiptExpiresAt}.`,
  });

  checks.push({
    id: 'phase_not_manual',

    status:
      phase.manualOnly
        ? 'block'
        : 'pass',

    details:
      phase.manualOnly
        ? 'La fase manual_review nunca puede convertirse en una fase ejecutable.'
        : `La fase ${phase.id} admite modelado automático.`,
  });

  checks.push({
    id: 'phase_blocked_steps',

    status:
      phase.summary.blocked ===
        0
        ? 'pass'
        : 'block',

    details:
      phase.summary.blocked ===
        0
        ? 'La fase no contiene steps bloqueados.'
        : `${phase.summary.blocked} step(s) bloqueados en la fase.`,
  });

  checks.push({
    id: 'phase_manual_steps',

    status:
      phase.summary.manual ===
        0
        ? 'pass'
        : 'warn',

    details:
      phase.summary.manual ===
        0
        ? 'La fase automática no contiene steps manuales.'
        : `${phase.summary.manual} step(s) requieren intervención manual.`,
  });

  const readyItems =
    phase.items.filter(
      (item) =>
        item.preview.status ===
          'ready',
    );

  const allDependenciesPresent =
    readyItems.every(
      (item) =>
        item.preview.dependsOn.every(
          (dependencyId) =>
            session.phases.some(
              (candidatePhase) =>
                candidatePhase.items.some(
                  (candidateItem) =>
                    candidateItem.operation.id ===
                      dependencyId,
                ),
            ),
        ),
    );

  checks.push({
    id: 'dependency_visibility',

    status:
      allDependenciesPresent
        ? 'pass'
        : 'block',

    details:
      allDependenciesPresent
        ? 'Todas las dependencias de la fase existen dentro de la Execution Session.'
        : 'Hay dependencias que no existen dentro de la Execution Session.',
  });

  const intents:
    PhaseDryRunIntent[] =
    readyItems.map(
      (
        item,
        index,
      ) => ({
        order:
          index + 1,

        operationId:
          item.operation.id,

        operationType:
          item.operation.type,

        resourceKind:
          item.operation.resourceKind,

        label:
          item.preview.label,

        action:
          describeAction(
            item,
          ),

        dependsOn:
          [
            ...item.preview.dependsOn,
          ],

        wouldMutateDiscord:
          true,
      }),
    );

  checks.push({
    id: 'intent_accounting',

    status:
      intents.length ===
        phase.summary.ready
        ? 'pass'
        : 'block',

    details:
      intents.length ===
        phase.summary.ready
        ? `${intents.length} intent(s) corresponden a ${phase.summary.ready} step(s) ready.`
        : `Intents=${intents.length}; ready=${phase.summary.ready}.`,
  });

  const passChecks =
    countStatus(
      checks,
      'pass',
    );

  const warnChecks =
    countStatus(
      checks,
      'warn',
    );

  const blockChecks =
    countStatus(
      checks,
      'block',
    );

  const readyForRealExecutorImplementation =
    blockChecks === 0;

  return {
    schemaVersion: 1,

    generatedAt:
      now.toISOString(),

    status:
      readyForRealExecutorImplementation
        ? 'ready'
        : 'blocked',

    dryRunOnly: true,

    executionAllowed: false,

    phase: {
      id: phase.id,

      label:
        phase.label,

      order:
        phase.order,

      manualOnly:
        phase.manualOnly,

      fingerprint:
        createPhaseFingerprint(
          session,
          phase,
        ),
    },

    source: {
      sessionId:
        session.sessionId,

      gateFingerprint:
        session.gateFingerprint,

      approvalReceiptId:
        session.approvalReceiptId,

      receiptExpiresAt:
        session.source
          .receiptExpiresAt,
    },

    checks,

    intents,

    summary: {
      total:
        phase.summary.total,

      ready:
        phase.summary.ready,

      manual:
        phase.summary.manual,

      blocked:
        phase.summary.blocked,

      passChecks,

      warnChecks,

      blockChecks,

      readyForRealExecutorImplementation,
    },
  };
}
