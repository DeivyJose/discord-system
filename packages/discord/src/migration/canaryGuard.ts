import {
  DISCORD_ROLES,
} from '../blueprint/roles.js';

import {
  MAXIMUM_SNAPSHOT_AGE_MINUTES,
} from './migrationGate.js';

import {
  verifyLiveDrift,
} from './liveDrift.js';

import type {
  CanaryGuardCheck,
  CanaryGuardOptions,
  CanaryGuardResult,
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

const CANARY_OPERATION_ID =
  'create_role:role_notify_news' as const;

const CANARY_BLUEPRINT_ID =
  'role_notify_news' as const;

const CANARY_ROLE_NAME =
  'Avisos CDN' as const;

const CANARY_ROLE_DESCRIPTION =
  'Notificaciones generales de noticias.' as const;

function validDate(
  value: string,
): boolean {
  return Number.isFinite(
    new Date(
      value,
    ).getTime(),
  );
}

function addCheck(
  checks: CanaryGuardCheck[],
  id: string,
  condition: boolean,
  passDetails: string,
  blockDetails: string,
): void {
  checks.push({
    id,

    status:
      condition
        ? 'pass'
        : 'block',

    details:
      condition
        ? passDetails
        : blockDetails,
  });
}

export function evaluateSingleOperationCanary(
  options: CanaryGuardOptions,
): CanaryGuardResult {
  const now =
    options.now ??
    new Date();

  const checks:
    CanaryGuardCheck[] = [];

  const {
    session,
    baseline,
    currentSnapshot,
  } = options;

  /*
   * ======================================================
   * 1. EXECUTION SESSION
   * ======================================================
   */

  addCheck(
    checks,
    'session_schema',
    session.schemaVersion === 6,
    'Execution Session schema v6 confirmado.',
    'El Canary requiere Execution Session schema v6.',
  );

  addCheck(
    checks,
    'session_status',
    session.status === 'ready',
    'Execution Session está ready.',
    'Execution Session no está ready.',
  );

  addCheck(
    checks,
    'session_execution_boundary',
    session.executionAllowed === false,
    'Execution Session conserva executionAllowed=false.',
    'La frontera de ejecución de la Session fue alterada.',
  );

  const sessionHasNoBlockChecks =
    session.checks.every(
      (check) =>
        check.status !==
          'block',
    );

  addCheck(
    checks,
    'session_checks',
    sessionHasNoBlockChecks,
    'Execution Session no contiene checks bloqueantes.',
    'Execution Session contiene uno o más checks bloqueantes.',
  );

  addCheck(
    checks,
    'session_executor_design',
    session.summary
      .readyForExecutorDesign ===
      true,
    'Session declarada lista para diseño de executor.',
    'Session no está lista para diseño de executor.',
  );

  /*
   * ======================================================
   * 2. CONTENT BINDING
   * ======================================================
   */

  const contentBindingValid =
    session.contentBinding
      .fingerprintVersion === 4 &&
    session.contentBinding
      .matchesGate === true &&
    session.contentBinding
      .executionAllowed === false &&
    session.contentBinding
      .expectedGateFingerprint ===
        session.gateFingerprint &&
    session.contentBinding
      .recalculatedGateFingerprint ===
        session.gateFingerprint;

  addCheck(
    checks,
    'content_binding',
    contentBindingValid,
    'Gate Content Fingerprint coincide con la Session.',
    'Gate Content Fingerprint no coincide exactamente con la Session.',
  );

  /*
   * ======================================================
   * 3. PROVENANCE BINDING
   * ======================================================
   */

  const provenanceBinding =
    (
      session as unknown as {
        provenanceBinding?:
          typeof session.provenanceBinding;
      }
    ).provenanceBinding;

  const provenanceFingerprintValid =
    typeof session.provenanceFingerprint ===
      'string' &&
    /^[a-f0-9]{64}$/i.test(
      session.provenanceFingerprint,
    );

  const provenanceBindingValid =
    provenanceFingerprintValid &&
    provenanceBinding !==
      undefined &&
    provenanceBinding
      .fingerprintVersion === 1 &&
    provenanceBinding
      .matchesGate === true &&
    provenanceBinding
      .executionAllowed === false &&
    provenanceBinding
      .expectedProvenanceFingerprint ===
        session.provenanceFingerprint &&
    provenanceBinding
      .recalculatedProvenanceFingerprint ===
        session.provenanceFingerprint &&
    provenanceBinding
      .gateProvenanceFingerprint ===
        session.provenanceFingerprint &&
    provenanceBinding
      .receiptProvenanceFingerprint ===
        session.provenanceFingerprint;

  addCheck(
    checks,
    'provenance_binding',
    provenanceBindingValid,
    'Migration Provenance coincide exactamente con la Session.',
    'Migration Provenance no coincide exactamente con la Session.',
  );

  /*
   * ======================================================
   * 4. ENVELOPE BINDING
   * ======================================================
   */

  const envelopeBindingValid =
    session.envelopeBinding
      .fingerprintVersion === 1 &&
    session.envelopeBinding
      .matchesGate === true &&
    session.envelopeBinding
      .executionAllowed === false &&
    session.envelopeBinding
      .expectedGateEnvelopeFingerprint ===
        session.gateEnvelopeFingerprint &&
    session.envelopeBinding
      .recalculatedGateEnvelopeFingerprint ===
        session.gateEnvelopeFingerprint;

  addCheck(
    checks,
    'envelope_binding',
    envelopeBindingValid,
    'Gate Envelope Fingerprint coincide con la Session.',
    'Gate Envelope Fingerprint no coincide exactamente con la Session.',
  );

  /*
   * ======================================================
   * 5. RECEIPT CLAIM
   * ======================================================
   */

  const claim =
    session.receiptClaim;

  const receiptClaimValid =
    claim !== null &&
    claim.claimed === true &&
    claim.sessionId ===
      session.sessionId &&
    claim.receiptId ===
      session.approvalReceiptId &&
    claim.gateFingerprint ===
      session.gateFingerprint &&
    claim.gateEnvelopeFingerprint ===
      session.gateEnvelopeFingerprint &&
    claim.provenanceFingerprint ===
      session.provenanceFingerprint &&
    claim.executionAllowed ===
      false;

  addCheck(
    checks,
    'receipt_claim',
    receiptClaimValid,
    'Approval Receipt está reclamado exclusivamente por esta Session.',
    'Approval Receipt claim no coincide con esta Session.',
  );

  const receiptDateValid =
    validDate(
      session.source
        .receiptExpiresAt,
    );

  const receiptFresh =
    receiptDateValid &&
    now.getTime() <
      new Date(
        session.source
          .receiptExpiresAt,
      ).getTime();

  addCheck(
    checks,
    'action_time_receipt_freshness',
    receiptFresh,
    `Receipt vigente en action-time hasta ${session.source.receiptExpiresAt}.`,
    `Receipt vencido en action-time: ${session.source.receiptExpiresAt}.`,
  );

  /*
   * ======================================================
   * 5. SNAPSHOT FRESHNESS
   * ======================================================
   */

  const sourceSnapshotDateValid =
    validDate(
      session.source
        .snapshotCapturedAt,
    );

  const sourceSnapshotExpiresAt =
    sourceSnapshotDateValid
      ? (
          new Date(
            session.source
              .snapshotCapturedAt,
          ).getTime() +
          MAXIMUM_SNAPSHOT_AGE_MINUTES *
            60_000
        )
      : Number.NaN;

  const sourceSnapshotFresh =
    sourceSnapshotDateValid &&
    now.getTime() <
      sourceSnapshotExpiresAt;

  addCheck(
    checks,
    'action_time_authorized_snapshot_freshness',
    sourceSnapshotFresh,
    `Snapshot autorizado sigue vigente hasta ${new Date(sourceSnapshotExpiresAt).toISOString()}.`,
    'El snapshot autorizado por la Session está vencido.',
  );

  const baselineMatchesSource =
    baseline.snapshot
      .capturedAt ===
    session.source
      .snapshotCapturedAt;

  addCheck(
    checks,
    'baseline_snapshot_lineage',
    baselineMatchesSource,
    'Live Drift baseline corresponde al snapshot autorizado.',
    'Live Drift baseline no corresponde al snapshot autorizado por la Session.',
  );

  const currentSnapshotDateValid =
    validDate(
      currentSnapshot
        .capturedAt,
    );

  const currentSnapshotExpiresAt =
    currentSnapshotDateValid
      ? (
          new Date(
            currentSnapshot
              .capturedAt,
          ).getTime() +
          MAXIMUM_SNAPSHOT_AGE_MINUTES *
            60_000
        )
      : Number.NaN;

  const currentSnapshotFresh =
    currentSnapshotDateValid &&
    now.getTime() <
      currentSnapshotExpiresAt;

  addCheck(
    checks,
    'action_time_live_snapshot_freshness',
    currentSnapshotFresh,
    'Snapshot live está dentro de la ventana máxima permitida.',
    'Snapshot live está vencido.',
  );

  /*
   * ======================================================
   * 6. GUILD
   * ======================================================
   */

  const guildMatches =
    baseline.snapshot.guildId ===
      session.guild.id &&
    currentSnapshot.guildId ===
      session.guild.id;

  addCheck(
    checks,
    'guild_identity',
    guildMatches,
    `Guild confirmado: ${session.guild.id}.`,
    'Session, baseline y snapshot live no pertenecen al mismo Guild.',
  );

  /*
   * ======================================================
   * 7. EXACT ONE-OP ALLOWLIST
   * ======================================================
   */

  const allItems =
    session.phases.flatMap(
      (phase) =>
        phase.items.map(
          (item) => ({
            phase,
            item,
          }),
        ),
    );

  const targetMatches =
    allItems.filter(
      ({ item }) =>
        item.operation.id ===
          CANARY_OPERATION_ID,
    );

  const targetUnique =
    targetMatches.length ===
      1;

  addCheck(
    checks,
    'target_operation_unique',
    targetUnique,
    'La operación Canary aparece exactamente una vez.',
    `Se encontraron ${targetMatches.length} coincidencias de la operación Canary.`,
  );

  const target =
    targetMatches[0];

  const operationShapeValid =
    target !== undefined &&
    target.phase.id ===
      'roles' &&
    target.phase.manualOnly ===
      false &&
    target.item.operation.type ===
      'create_role' &&
    target.item.operation
      .resourceKind ===
      'role' &&
    target.item.operation
      .blueprintId ===
      CANARY_BLUEPRINT_ID &&
    target.item.operation
      .desiredName ===
      CANARY_ROLE_NAME &&
    target.item.operation
      .requiresConfirmation ===
      true;

  addCheck(
    checks,
    'target_operation_shape',
    operationShapeValid,
    'La operación coincide exactamente con create_role:role_notify_news.',
    'La operación Canary fue alterada o no es create_role:role_notify_news.',
  );

  const previewValid =
    target !== undefined &&
    target.item.preview
      .operationId ===
      CANARY_OPERATION_ID &&
    target.item.preview
      .operationType ===
      'create_role' &&
    target.item.preview
      .resourceKind ===
      'role' &&
    target.item.preview
      .phase ===
      'roles' &&
    target.item.preview
      .status ===
      'ready' &&
    target.item.preview
      .blueprintId ===
      CANARY_BLUEPRINT_ID &&
    target.item.preview
      .actualId ===
      null &&
    target.item.preview
      .label ===
      CANARY_ROLE_NAME &&
    target.item.preview
      .dependsOn.length ===
      0 &&
    target.item.preview
      .blockers.length ===
      0;

  addCheck(
    checks,
    'target_preview',
    previewValid,
    'Preview Canary está ready, sin dependencias ni blockers.',
    'Preview Canary no coincide con la operación permitida.',
  );

  /*
   * ======================================================
   * 8. BLUEPRINT EXACTO
   * ======================================================
   */

  const blueprintMatches =
    DISCORD_ROLES.filter(
      (role) =>
        role.id ===
          CANARY_BLUEPRINT_ID,
    );

  const blueprintRole =
    blueprintMatches[0];

  const blueprintValid =
    blueprintMatches.length ===
      1 &&
    blueprintRole !==
      undefined &&
    blueprintRole.kind ===
      'role' &&
    blueprintRole.name ===
      CANARY_ROLE_NAME &&
    blueprintRole.description ===
      CANARY_ROLE_DESCRIPTION &&
    blueprintRole.priority ===
      100 &&
    blueprintRole.hoist ===
      false &&
    blueprintRole.mentionable ===
      true &&
    blueprintRole.systemManaged ===
      true;

  addCheck(
    checks,
    'target_blueprint',
    blueprintValid,
    'Blueprint role_notify_news coincide con la allowlist Canary.',
    'El Blueprint del rol Canary fue alterado.',
  );

  /*
   * ======================================================
   * 9. TARGET DEBE SEGUIR AUSENTE
   * ======================================================
   */

  const existingTargetRoles =
    currentSnapshot.resources.filter(
      (resource) =>
        resource.kind ===
          'role' &&
        resource.name ===
          CANARY_ROLE_NAME,
    );

  const targetAbsent =
    existingTargetRoles.length ===
      0;

  addCheck(
    checks,
    'target_absent',
    targetAbsent,
    'Avisos CDN todavía no existe en el snapshot live.',
    'Avisos CDN ya existe; create_role Canary queda bloqueado.',
  );

  /*
   * ======================================================
   * 10. LIVE DRIFT
   * ======================================================
   */

  const drift =
    verifyLiveDrift(
      baseline,
      currentSnapshot,
      {
        sessionId:
          session.sessionId,

        gateFingerprint:
          session.gateFingerprint,

        gateEnvelopeFingerprint:
          session.gateEnvelopeFingerprint,
      },
      now,
    );

  const driftValid =
    drift.status ===
      'valid' &&
    drift.summary.valid &&
    drift.summary
      .driftDetected ===
      false &&
    drift.changes.length ===
      0;

  addCheck(
    checks,
    'live_drift',
    driftValid,
    'Live Drift Guard confirma cero cambios estructurales.',
    `Live Drift Guard detectó ${drift.changes.length} cambio(s) o contexto inválido.`,
  );

  /*
   * ======================================================
   * FINAL
   * ======================================================
   */

  const blocked =
    checks.some(
      (check) =>
        check.status ===
          'block',
    );

  const intent:
    CanaryRoleIntent |
    null =
    !blocked &&
    target !== undefined &&
    blueprintRole !== undefined
      ? {
          schemaVersion: 1,

          sessionId:
            session.sessionId,

          guildId:
            session.guild.id,

          operationId:
            CANARY_OPERATION_ID,

          blueprintId:
            CANARY_BLUEPRINT_ID,

          name:
            CANARY_ROLE_NAME,

          description:
            CANARY_ROLE_DESCRIPTION,

          hoist:
            false,

          mentionable:
            true,

          /*
           * ZERO Discord permissions.
           */
          permissions:
            '0',

          executionAllowed:
            false,
        }
      : null;

  return {
    schemaVersion: 1,

    generatedAt:
      now.toISOString(),

    status:
      blocked
        ? 'blocked'
        : 'ready_for_simulation',

    checks,

    drift,

    intent,

    session: {
      sessionId:
        session.sessionId,

      gateFingerprint:
        session.gateFingerprint,

      gateEnvelopeFingerprint:
        session.gateEnvelopeFingerprint,
    },

    executionAllowed:
      false,
  };
}
