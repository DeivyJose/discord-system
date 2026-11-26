import {
  randomBytes,
} from 'node:crypto';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import {
  createMigrationGateContentFingerprint,
  createMigrationGateEnvelopeFingerprint,
  extractMigrationGateEnvelopeFingerprintInput,
} from './migrationGate.js';

import {
  verifyMigrationProvenance,
} from './migrationProvenance.js';

import type {
  ApprovalReceipt,
} from './approvalReceiptTypes.js';

import type {
  ExecutionSessionCheck,
  ExecutionSessionCheckStatus,
  ExecutionSessionGateArtifacts,
  ExecutionSessionPhase,
  ExecutionSessionPhaseId,
  ExecutionSessionPlan,
  ExecutionSessionReceiptClaim,
} from './executionSessionTypes.js';

export interface ExecutionSessionPlannerInput {
  operations: MigrationOperationsPlan;

  preview: DiscordExecutionPreview;

  gate: MigrationGate;

  receipt: ApprovalReceipt;

  gateArtifacts:
    ExecutionSessionGateArtifacts;

  sessionId?: string;

  receiptClaim?:
    ExecutionSessionReceiptClaim;
}

const PHASE_DEFINITIONS: readonly {
  id: ExecutionSessionPhaseId;

  order: number;

  label: string;

  manualOnly: boolean;
}[] = [
  {
    id: 'roles',
    order: 1,
    label: 'Roles',
    manualOnly: false,
  },
  {
    id: 'categories',
    order: 2,
    label: 'Categorías',
    manualOnly: false,
  },
  {
    id: 'renames',
    order: 3,
    label: 'Renombres',
    manualOnly: false,
  },
  {
    id: 'channels',
    order: 4,
    label: 'Canales',
    manualOnly: false,
  },
  {
    id: 'moves',
    order: 5,
    label: 'Movimientos',
    manualOnly: false,
  },
  {
    id: 'manual_review',
    order: 6,
    label: 'Revisión manual',
    manualOnly: true,
  },
];

function countCheckStatus(
  checks: ExecutionSessionCheck[],
  status: ExecutionSessionCheckStatus,
): number {
  return checks.filter(
    (check) =>
      check.status === status,
  ).length;
}

function uniqueValues(
  values: string[],
): string[] {
  return [
    ...new Set(values),
  ];
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
      seen.has(value)
    ) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [
    ...duplicates,
  ];
}

function isValidDate(
  value: string,
): boolean {
  return Number.isFinite(
    new Date(value).getTime(),
  );
}

export function createExecutionSessionPlan(
  input: ExecutionSessionPlannerInput,
  now = new Date(),
): ExecutionSessionPlan {
  const {
    operations,
    preview,
    gate,
    receipt,
    gateArtifacts,
    receiptClaim,
  } = input;

  const sessionId =
    input.sessionId ??
    randomBytes(12)
      .toString(
        'hex',
      );

  const checks:
    ExecutionSessionCheck[] = [];

  const guildIds = [
    operations.guild.id,
    preview.guild.id,
    gate.guild.id,
    receipt.guild.id,
  ];

  const sameGuild =
    guildIds.every(
      (guildId) =>
        guildId === guildIds[0],
    );

  checks.push({
    id: 'guild_identity',

    status:
      sameGuild
        ? 'pass'
        : 'block',

    details:
      sameGuild
        ? `Todos los artefactos pertenecen al Guild ${gate.guild.id}.`
        : `Guild IDs encontrados: ${guildIds.join(', ')}.`,
  });

  const recalculatedGateFingerprint =
    createMigrationGateContentFingerprint({
      blueprint:
        gateArtifacts.blueprint,

      snapshot:
        gateArtifacts.snapshot,

      bindings:
        gateArtifacts.bindings,

      plan:
        gateArtifacts.plan,

      provenance:
        gateArtifacts.provenance,

      operations,

      executionPreview:
        preview,

      preflight:
        gateArtifacts.preflight,

      hierarchy:
        gateArtifacts.hierarchy,
    });

  const provenanceVerification =
    verifyMigrationProvenance(
      gateArtifacts.provenance,
      {
        blueprint:
          gateArtifacts.blueprint,

        snapshot:
          gateArtifacts.snapshot,

        bindings:
          gateArtifacts.bindings,

        plan:
          gateArtifacts.plan,

        operations,

        preview,
      },
      now,
    );

  const recalculatedProvenanceFingerprint =
    provenanceVerification.expected
      .lineageFingerprint;

  const gateProvenance =
    (
      gate as unknown as {
        provenance?:
          typeof gate.provenance;
      }
    ).provenance;

  const provenanceMatchesGate =
    gateProvenance !==
      undefined &&
    provenanceVerification.status ===
      'valid' &&
    provenanceVerification.summary.valid ===
      true &&
    provenanceVerification.summary.block ===
      0 &&
    gateArtifacts.provenance
      .lineageFingerprint ===
      recalculatedProvenanceFingerprint &&
    gateProvenance.schemaVersion ===
      1 &&
    gateProvenance.fingerprintVersion ===
      1 &&
    gateProvenance.lineageFingerprint ===
      recalculatedProvenanceFingerprint &&
    gateProvenance.guildId ===
      gate.guild.id &&
    gateProvenance.summary.valid ===
      true &&
    gateProvenance.summary.block ===
      0 &&
    gateProvenance.executionAllowed ===
      false &&
    receipt.provenanceFingerprint ===
      recalculatedProvenanceFingerprint;

  checks.push({
    id:
      'provenance_binding',

    status:
      provenanceMatchesGate
        ? 'pass'
        : 'block',

    details:
      provenanceMatchesGate
        ? `Provenance reproducido exactamente: ${recalculatedProvenanceFingerprint}.`
        : [
            'El Provenance actual NO reproduce el lineage autorizado.',
            `Gate=${gateProvenance?.lineageFingerprint ?? 'MISSING'}.`,
            `Receipt=${receipt.provenanceFingerprint}.`,
            `Recalculado=${recalculatedProvenanceFingerprint}.`,
          ].join(' '),
  });

  const gateBlueprintMatches =
    gate.blueprint.schemaVersion ===
      gateArtifacts.blueprint
        .schemaVersion &&
    gate.blueprint.blueprintVersion ===
      gateArtifacts.blueprint
        .blueprintVersion &&
    gate.blueprint.fingerprintVersion ===
      gateArtifacts.blueprint
        .fingerprintVersion &&
    gate.blueprint.fingerprint ===
      gateArtifacts.blueprint
        .fingerprint &&
    gate.blueprint.executionAllowed ===
      false;

  const gateContentMatches =
    gate.schemaVersion ===
      5 &&
    gate.fingerprintVersion ===
      4 &&
    gateBlueprintMatches &&
    recalculatedGateFingerprint ===
      gate.fingerprint;

  checks.push({
    id:
      'gate_content_binding',

    status:
      gateContentMatches
        ? 'pass'
        : 'block',

    details:
      gateContentMatches
        ? 'Los nueve inputs actuales reproducen exactamente el Content Fingerprint v4 del Migration Gate schema v5.'
        : [
            'Los artefactos actuales NO reproducen el Migration Gate autorizado.',
            `Esperado=${gate.fingerprint}.`,
            `Recalculado=${recalculatedGateFingerprint}.`,
          ].join(' '),
  });

  const recalculatedGateEnvelopeFingerprint =
    createMigrationGateEnvelopeFingerprint(
      extractMigrationGateEnvelopeFingerprintInput(
        gate,
      ),
    );

  const gateEnvelopeMatches =
    gate.envelopeFingerprintVersion ===
      1 &&
    recalculatedGateEnvelopeFingerprint ===
      gate.envelopeFingerprint;

  checks.push({
    id:
      'gate_envelope_binding',

    status:
      gateEnvelopeMatches
        ? 'pass'
        : 'block',

    details:
      gateEnvelopeMatches
        ? 'El envelope actual reproduce exactamente el seal del Migration Gate.'
        : [
            'El envelope del Migration Gate NO es íntegro.',
            `Esperado=${gate.envelopeFingerprint}.`,
            `Recalculado=${recalculatedGateEnvelopeFingerprint}.`,
          ].join(' '),
  });

  const receiptApproved =
    receipt.schemaVersion ===
      4 &&
    receipt.status ===
      'approved' &&
    receipt.summary
      .approvalValid &&
    receipt.summary.block === 0;

  checks.push({
    id: 'approval_receipt',

    status:
      receiptApproved
        ? 'pass'
        : 'block',

    details:
      receiptApproved
        ? `Approval Receipt ${receipt.receiptId} aprobado.`
        : 'El Approval Receipt no contiene una aprobación válida.',
  });

  const receiptEnvelopeMatchesGate =
    receipt.gateEnvelopeFingerprint ===
      gate.envelopeFingerprint;

  checks.push({
    id:
      'approval_receipt_envelope',

    status:
      receiptEnvelopeMatchesGate
        ? 'pass'
        : 'block',

    details:
      receiptEnvelopeMatchesGate
        ? 'El Approval Receipt autoriza este envelope exacto del Gate.'
        : 'El Approval Receipt pertenece a un envelope diferente.',
  });

  const receiptConfirmationId =
    receipt.manifest
      .confirmationId;

  const receiptClaimValid =
    receiptClaim
      ?.claimed ===
        true &&
    receiptClaim
      .receiptId ===
        receipt.receiptId &&
    receiptClaim
      .sessionId ===
        sessionId &&
    receiptClaim
      .gateFingerprint ===
        gate.fingerprint &&
    receiptClaim
      .gateEnvelopeFingerprint ===
        gate.envelopeFingerprint &&
    receiptClaim
      .provenanceFingerprint ===
        gateProvenance?.lineageFingerprint &&
    receiptClaim
      .provenanceFingerprint ===
        receipt.provenanceFingerprint &&
    receiptConfirmationId !==
      null &&
    receiptClaim
      .confirmationId ===
        receiptConfirmationId &&
    receiptClaim
      .executionAllowed ===
        false;

  checks.push({
    id:
      'receipt_single_use_claim',

    status:
      receiptClaimValid
        ? 'pass'
        : 'block',

    details:
      receiptClaimValid
        ? `Receipt ${receipt.receiptId} reclamado exclusivamente para Session ${sessionId}.`
        : 'Falta un claim atómico válido que ligue este Receipt a esta Execution Session.',
  });

  const executionStillDisabled =
    receipt.executionAllowed ===
      false &&
    gate.executionAllowed ===
      false &&
    preview.executionAllowed ===
      false &&
    preview.dryRunOnly ===
      true;

  checks.push({
    id: 'execution_boundary',

    status:
      executionStillDisabled
        ? 'pass'
        : 'block',

    details:
      executionStillDisabled
        ? 'Receipt, Gate y Preview conservan la frontera de no ejecución.'
        : 'Algún artefacto dejó de conservar executionAllowed=false o dryRunOnly=true.',
  });

  const fingerprintMatches =
    receipt.gateFingerprint ===
      gate.fingerprint;

  checks.push({
    id: 'gate_fingerprint',

    status:
      fingerprintMatches
        ? 'pass'
        : 'block',

    details:
      fingerprintMatches
        ? `Fingerprint confirmado: ${gate.fingerprint}.`
        : 'El Receipt no corresponde al Migration Gate actual.',
  });

  const receiptDatesValid =
    isValidDate(
      receipt.manifest.createdAt,
    ) &&
    isValidDate(
      receipt.manifest.expiresAt,
    ) &&
    isValidDate(
      receipt.verifiedAt,
    );

  checks.push({
    id: 'receipt_dates',

    status:
      receiptDatesValid
        ? 'pass'
        : 'block',

    details:
      receiptDatesValid
        ? 'Las fechas del Receipt son válidas.'
        : 'El Receipt contiene fechas inválidas.',
  });

  const receiptExpiresAt =
    new Date(
      receipt.manifest.expiresAt,
    );

  const receiptStillFresh =
    receiptDatesValid &&
    now.getTime() <
      receiptExpiresAt.getTime();

  checks.push({
    id: 'approval_freshness',

    status:
      receiptStillFresh
        ? 'pass'
        : 'block',

    details:
      receiptStillFresh
        ? `La aprobación continúa vigente hasta ${receipt.manifest.expiresAt}.`
        : `La aprobación temporal expiró en ${receipt.manifest.expiresAt}.`,
  });

  const receiptVerifiedInsideWindow =
    receiptDatesValid &&
    new Date(
      receipt.verifiedAt,
    ).getTime() >=
      new Date(
        receipt.manifest.createdAt,
      ).getTime() &&
    new Date(
      receipt.verifiedAt,
    ).getTime() <
      receiptExpiresAt.getTime();

  checks.push({
    id: 'approval_lineage',

    status:
      receiptVerifiedInsideWindow
        ? 'pass'
        : 'block',

    details:
      receiptVerifiedInsideWindow
        ? 'El Receipt fue verificado dentro de la ventana temporal de su Manifest.'
        : 'El Receipt no fue verificado dentro de una ventana temporal válida.',
  });

  const gateReady =
    gate.summary.block === 0 &&
    gate.summary
      .readyForExplicitConfirmation &&
    gate.executionAllowed ===
      false;

  checks.push({
    id: 'gate_ready',

    status:
      gateReady
        ? 'pass'
        : 'block',

    details:
      gateReady
        ? 'El Migration Gate almacenado no contiene bloqueos.'
        : 'El Migration Gate almacenado no está en estado seguro.',
  });

  const snapshotCapturedAt =
    new Date(
      gate.snapshot.capturedAt,
    );

  const snapshotExpiresAt =
    snapshotCapturedAt.getTime() +
    gate.snapshot.maximumAgeMinutes *
      60_000;

  const snapshotStillFresh =
    Number.isFinite(
      snapshotCapturedAt.getTime(),
    ) &&
    now.getTime() <
      snapshotExpiresAt;

  checks.push({
    id: 'snapshot_freshness',

    status:
      snapshotStillFresh
        ? 'pass'
        : 'block',

    details:
      snapshotStillFresh
        ? `El snapshot sigue vigente hasta ${new Date(snapshotExpiresAt).toISOString()}.`
        : 'El snapshot utilizado por el Gate ya expiró.',
  });

  const artifactDatesValid =
    [
      operations.generatedAt,
      preview.generatedAt,
      gate.generatedAt,
      receipt.verifiedAt,
    ].every(
      isValidDate,
    );

  const temporalOrderValid =
    artifactDatesValid &&
    new Date(
      operations.generatedAt,
    ).getTime() <=
      new Date(
        preview.generatedAt,
      ).getTime() &&
    new Date(
      preview.generatedAt,
    ).getTime() <=
      new Date(
        gate.generatedAt,
      ).getTime() &&
    new Date(
      gate.generatedAt,
    ).getTime() <=
      new Date(
        receipt.verifiedAt,
      ).getTime();

  checks.push({
    id: 'artifact_lineage',

    status:
      temporalOrderValid
        ? 'pass'
        : 'block',

    details:
      temporalOrderValid
        ? 'Operations → Preview → Gate → Receipt mantienen un orden temporal válido.'
        : 'Los artefactos no mantienen el orden temporal esperado.',
  });

  const operationIds =
    operations.operations.map(
      (operation) =>
        operation.id,
    );

  const stepOperationIds =
    preview.steps.map(
      (step) =>
        step.operationId,
    );

  const duplicateOperationIds =
    findDuplicates(
      operationIds,
    );

  const duplicateStepIds =
    findDuplicates(
      stepOperationIds,
    );

  checks.push({
    id: 'unique_operation_ids',

    status:
      duplicateOperationIds.length ===
        0 &&
      duplicateStepIds.length ===
        0
        ? 'pass'
        : 'block',

    details:
      duplicateOperationIds.length ===
        0 &&
      duplicateStepIds.length ===
        0
        ? 'Operations y Preview utilizan IDs únicos.'
        : [
            `Operations duplicados: ${duplicateOperationIds.join(', ') || '(ninguno)'}.`,
            `Steps duplicados: ${duplicateStepIds.join(', ') || '(ninguno)'}.`,
          ].join(' '),
  });

  const operationIdSet =
    new Set(
      operationIds,
    );

  const stepIdSet =
    new Set(
      stepOperationIds,
    );

  const missingSteps =
    operationIds.filter(
      (operationId) =>
        !stepIdSet.has(
          operationId,
        ),
    );

  const orphanSteps =
    stepOperationIds.filter(
      (operationId) =>
        !operationIdSet.has(
          operationId,
        ),
    );

  const exactOperationMapping =
    missingSteps.length === 0 &&
    orphanSteps.length === 0 &&
    operations.operations.length ===
      preview.steps.length;

  checks.push({
    id: 'operation_step_mapping',

    status:
      exactOperationMapping
        ? 'pass'
        : 'block',

    details:
      exactOperationMapping
        ? `${operations.operations.length} operaciones corresponden 1:1 con ${preview.steps.length} steps.`
        : [
            `Operaciones sin step: ${missingSteps.join(', ') || '(ninguna)'}.`,
            `Steps huérfanos: ${orphanSteps.join(', ') || '(ninguno)'}.`,
          ].join(' '),
  });

  const summaryCountsValid =
    operations.summary.total ===
      operations.operations.length &&
    preview.summary.totalSteps ===
      preview.steps.length;

  checks.push({
    id: 'summary_counts',

    status:
      summaryCountsValid
        ? 'pass'
        : 'block',

    details:
      summaryCountsValid
        ? `Operations=${operations.operations.length}; Preview=${preview.steps.length}.`
        : 'Los contadores declarados no coinciden con los arrays reales.',
  });

  const unknownDependencies =
    uniqueValues(
      preview.steps.flatMap(
        (step) =>
          step.dependsOn.filter(
            (dependencyId) =>
              !operationIdSet.has(
                dependencyId,
              ),
          ),
      ),
    );

  checks.push({
    id: 'dependency_integrity',

    status:
      unknownDependencies.length ===
        0
        ? 'pass'
        : 'block',

    details:
      unknownDependencies.length ===
        0
        ? 'Todas las dependencias apuntan a operaciones conocidas.'
        : `Dependencias desconocidas: ${unknownDependencies.join(', ')}.`,
  });

  const blockedSteps =
    preview.steps.filter(
      (step) =>
        step.status ===
          'blocked',
    );

  checks.push({
    id: 'blocked_steps',

    status:
      blockedSteps.length ===
        0
        ? 'pass'
        : 'block',

    details:
      blockedSteps.length ===
        0
        ? 'El Preview no contiene pasos bloqueados.'
        : `${blockedSteps.length} paso(s) continúan bloqueados.`,
  });

  const manualSteps =
    preview.steps.filter(
      (step) =>
        step.status ===
          'manual',
    );

  checks.push({
    id: 'manual_steps',

    status:
      manualSteps.length > 0
        ? 'warn'
        : 'pass',

    details:
      manualSteps.length > 0
        ? `${manualSteps.length} paso(s) requieren intervención humana y no serán automatizables.`
        : 'No existen pasos manuales.',
  });

  const operationById =
    new Map(
      operations.operations.map(
        (operation) =>
          [
            operation.id,
            operation,
          ] as const,
      ),
    );

  const phases:
    ExecutionSessionPhase[] =
    PHASE_DEFINITIONS.map(
      (definition) => {
        const steps =
          preview.steps.filter(
            (step) =>
              step.phase ===
                definition.id,
          );

        const items =
          steps.flatMap(
            (step) => {
              const operation =
                operationById.get(
                  step.operationId,
                );

              if (
                !operation
              ) {
                return [];
              }

              return [
                {
                  operation,
                  preview: step,
                },
              ];
            },
          );

        const ready =
          items.filter(
            (item) =>
              item.preview.status ===
                'ready',
          ).length;

        const manual =
          items.filter(
            (item) =>
              item.preview.status ===
                'manual',
          ).length;

        const blocked =
          items.filter(
            (item) =>
              item.preview.status ===
                'blocked',
          ).length;

        const stopConditions =
          definition.manualOnly
            ? [
                'Esta fase nunca debe ejecutarse automáticamente.',
                'Cada elemento requiere revisión o intervención humana.',
                'No continuar automáticamente después de una acción manual.',
              ]
            : [
                'Detener ante cualquier error inesperado.',
                'Detener si cambia el estado real de Discord respecto al snapshot.',
                'Detener si una dependencia no está satisfecha.',
                'Detener al terminar la fase para generar un checkpoint y reinspeccionar.',
              ];

        return {
          id: definition.id,

          order:
            definition.order,

          label:
            definition.label,

          manualOnly:
            definition.manualOnly,

          items,

          summary: {
            total:
              items.length,

            ready,

            manual,

            blocked,
          },

          stopConditions,
        };
      },
    );

  const phaseTotal =
    phases.reduce(
      (
        total,
        phase,
      ) =>
        total +
        phase.summary.total,
      0,
    );

  checks.push({
    id: 'phase_accounting',

    status:
      phaseTotal ===
        preview.steps.length
        ? 'pass'
        : 'block',

    details:
      phaseTotal ===
        preview.steps.length
        ? `Las seis fases contienen exactamente ${phaseTotal} steps.`
        : `Las fases contienen ${phaseTotal}, pero el Preview contiene ${preview.steps.length}.`,
  });

  const ready =
    phases.reduce(
      (
        total,
        phase,
      ) =>
        total +
        phase.summary.ready,
      0,
    );

  const manual =
    phases.reduce(
      (
        total,
        phase,
      ) =>
        total +
        phase.summary.manual,
      0,
    );

  const blocked =
    phases.reduce(
      (
        total,
        phase,
      ) =>
        total +
        phase.summary.blocked,
      0,
    );

  const passChecks =
    countCheckStatus(
      checks,
      'pass',
    );

  const warnChecks =
    countCheckStatus(
      checks,
      'warn',
    );

  const blockChecks =
    countCheckStatus(
      checks,
      'block',
    );

  const readyForExecutorDesign =
    blockChecks === 0;

  return {
    schemaVersion: 6,

    sessionId,

    generatedAt:
      now.toISOString(),

    status:
      readyForExecutorDesign
        ? 'ready'
        : 'blocked',

    guild: {
      id: gate.guild.id,
      name: gate.guild.name,
    },

    gateFingerprint:
      gate.fingerprint,

    gateEnvelopeFingerprint:
      gate.envelopeFingerprint,

    provenanceFingerprint:
      gateProvenance
        ?.lineageFingerprint ??
      '',

    contentBinding: {
      fingerprintVersion:
        4,

      expectedGateFingerprint:
        gate.fingerprint,

      recalculatedGateFingerprint,

      matchesGate:
        gateContentMatches,

      executionAllowed:
        false,
    },

    envelopeBinding: {
      fingerprintVersion:
        1,

      expectedGateEnvelopeFingerprint:
        gate.envelopeFingerprint,

      recalculatedGateEnvelopeFingerprint,

      matchesGate:
        gateEnvelopeMatches,

      executionAllowed:
        false,
    },

    provenanceBinding: {
      fingerprintVersion:
        1,

      expectedProvenanceFingerprint:
        gateArtifacts.provenance
          .lineageFingerprint,

      recalculatedProvenanceFingerprint,

      gateProvenanceFingerprint:
        gateProvenance
          ?.lineageFingerprint ??
        '',

      receiptProvenanceFingerprint:
        receipt.provenanceFingerprint,

      matchesGate:
        provenanceMatchesGate,

      executionAllowed:
        false,
    },

    approvalReceiptId:
      receipt.receiptId,

    receiptClaim:
      receiptClaim
        ? structuredClone(
            receiptClaim,
          )
        : null,

    source: {
      operationsGeneratedAt:
        operations.generatedAt,

      previewGeneratedAt:
        preview.generatedAt,

      provenanceGeneratedAt:
        gateArtifacts.provenance.generatedAt,

      gateGeneratedAt:
        gate.generatedAt,

      receiptVerifiedAt:
        receipt.verifiedAt,

      receiptExpiresAt:
        receipt.manifest.expiresAt,

      snapshotCapturedAt:
        gate.snapshot.capturedAt,
    },

    checks,

    phases,

    summary: {
      operations:
        operations.operations.length,

      phases:
        phases.length,

      ready,

      manual,

      blocked,

      passChecks,

      warnChecks,

      blockChecks,

      readyForExecutorDesign,
    },

    executionAllowed: false,
  };
}
