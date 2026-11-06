import {
  createHash,
} from 'node:crypto';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  DiscordBindings,
} from './types.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import type {
  DiscordMigrationPreflight,
} from './preflightTypes.js';

import type {
  HierarchyBootstrapPlan,
} from './hierarchyBootstrapTypes.js';

import type {
  MigrationGate,
  MigrationGateCheck,
} from './migrationGateTypes.js';

const MAXIMUM_SNAPSHOT_AGE_MINUTES =
  30;

interface MigrationGateInput {
  snapshot: DiscordGuildSnapshot;

  bindings: DiscordBindings;

  operations: MigrationOperationsPlan;

  executionPreview: DiscordExecutionPreview;

  preflight: DiscordMigrationPreflight;

  hierarchy: HierarchyBootstrapPlan;
}

function countStatus(
  checks: MigrationGateCheck[],
  status: MigrationGateCheck['status'],
): number {
  return checks.filter(
    (check) =>
      check.status === status,
  ).length;
}

function createFingerprint(
  input: MigrationGateInput,
): string {
  const payload = {
    guildId:
      input.snapshot.guild.id,

    snapshotCapturedAt:
      input.snapshot.capturedAt,

    bindings:
      Object.entries(
        input.bindings.resources,
      ).sort(
        ([a], [b]) =>
          a.localeCompare(b),
      ),

    operations:
      input.operations.operations,

    preflight: {
      checkedAt:
        input.preflight.checkedAt,

      bot:
        input.preflight.bot,

      requirements:
        input.preflight.requirements,

      summary:
        input.preflight.summary,
    },

    hierarchy: {
      desiredHierarchy:
        input.hierarchy.desiredHierarchy,

      roles:
        input.hierarchy.roles,

      summary:
        input.hierarchy.summary,
    },
  };

  return createHash('sha256')
    .update(
      JSON.stringify(payload),
      'utf8',
    )
    .digest('hex');
}

export function createMigrationGate(
  input: MigrationGateInput,
  now = new Date(),
): MigrationGate {
  const checks: MigrationGateCheck[] = [];

  const guildIds = [
    input.snapshot.guild.id,
    input.bindings.guildId,
    input.operations.guild.id,
    input.executionPreview.guild.id,
    input.preflight.guild.id,
    input.hierarchy.guild.id,
  ];

  const sameGuild =
    guildIds.every(
      (guildId) =>
        guildId === guildIds[0],
    );

  checks.push({
    id: 'guild_identity',

    label:
      'Todos los artefactos pertenecen al mismo servidor.',

    status:
      sameGuild
        ? 'pass'
        : 'block',

    details:
      sameGuild
        ? `Guild ID confirmado: ${input.snapshot.guild.id}.`
        : `Guild IDs detectados: ${guildIds.join(', ')}.`,
  });

  const snapshotTime =
    new Date(
      input.snapshot.capturedAt,
    );

  const ageMilliseconds =
    now.getTime() -
    snapshotTime.getTime();

  const ageMinutes =
    Math.max(
      0,
      ageMilliseconds /
        1000 /
        60,
    );

  const snapshotDateValid =
    Number.isFinite(
      snapshotTime.getTime(),
    );

  checks.push({
    id: 'snapshot_valid_date',

    label:
      'La fecha del snapshot es válida.',

    status:
      snapshotDateValid
        ? 'pass'
        : 'block',

    details:
      snapshotDateValid
        ? input.snapshot.capturedAt
        : 'capturedAt no contiene una fecha válida.',
  });

  checks.push({
    id: 'snapshot_freshness',

    label:
      'El snapshot es suficientemente reciente.',

    status:
      snapshotDateValid &&
      ageMinutes <=
        MAXIMUM_SNAPSHOT_AGE_MINUTES
        ? 'pass'
        : 'block',

    details:
      snapshotDateValid
        ? `Edad aproximada: ${ageMinutes.toFixed(1)} minutos. Máximo permitido: ${MAXIMUM_SNAPSHOT_AGE_MINUTES}.`
        : 'No puede calcularse la antigüedad del snapshot.',
  });

  const operationsTime =
    new Date(
      input.operations.generatedAt,
    ).getTime();

  const executionPreviewTime =
    new Date(
      input.executionPreview.generatedAt,
    ).getTime();

  const preflightTime =
    new Date(
      input.preflight.checkedAt,
    ).getTime();

  const hierarchyTime =
    new Date(
      input.hierarchy.generatedAt,
    ).getTime();

  const lineageDatesValid =
    [
      snapshotTime.getTime(),
      operationsTime,
      executionPreviewTime,
      preflightTime,
      hierarchyTime,
    ].every(
      (value) =>
        Number.isFinite(value),
    );

  const lineageValid =
    lineageDatesValid &&
    operationsTime >=
      snapshotTime.getTime() &&
    executionPreviewTime >=
      operationsTime &&
    preflightTime >=
      operationsTime &&
    hierarchyTime >=
      operationsTime;

  checks.push({
    id: 'artifact_lineage',

    label:
      'Los planes fueron regenerados a partir de un estado igual o posterior al snapshot.',

    status:
      lineageValid
        ? 'pass'
        : 'block',

    details:
      lineageValid
        ? [
            'Orden temporal válido:',
            `snapshot=${input.snapshot.capturedAt},`,
            `operations=${input.operations.generatedAt},`,
            `preview=${input.executionPreview.generatedAt},`,
            `preflight=${input.preflight.checkedAt},`,
            `hierarchy=${input.hierarchy.generatedAt}.`,
          ].join(' ')
        : [
            'Los artefactos no pertenecen a una cadena temporal coherente.',
            'Regenera Operations, Preview, Preflight y Hierarchy después del snapshot actual.',
          ].join(' '),
  });

  checks.push({
    id: 'operations_bindings',

    label:
      'El Operations Plan no contiene bindings pendientes.',

    status:
      input.operations.summary
        .reviewBindings === 0
        ? 'pass'
        : 'block',

    details:
      `${input.operations.summary.reviewBindings} binding(s) requieren revisión.`,
  });

  checks.push({
    id: 'execution_preview',

    label:
      'El Execution Preview no tiene pasos bloqueados.',

    status:
      input.executionPreview.summary
        .blocked === 0
        ? 'pass'
        : 'block',

    details:
      `${input.executionPreview.summary.blocked} paso(s) bloqueados.`,
  });

  checks.push({
    id: 'preview_is_dry_run',

    label:
      'El Execution Preview continúa siendo exclusivamente dry-run.',

    status:
      input.executionPreview
        .dryRunOnly === true &&
      input.executionPreview
        .executionAllowed === false
        ? 'pass'
        : 'block',

    details:
      'dryRunOnly debe ser true y executionAllowed debe permanecer false.',
  });

  checks.push({
    id: 'live_preflight',

    label:
      'El preflight real no contiene bloqueos.',

    status:
      input.preflight.summary
        .block === 0 &&
      input.preflight.summary
        .migrationTechnicallyPossible
        ? 'pass'
        : 'block',

    details:
      `PASS=${input.preflight.summary.pass}, WARN=${input.preflight.summary.warn}, BLOCK=${input.preflight.summary.block}.`,
  });

  checks.push({
    id: 'hierarchy_bootstrap',

    label:
      'La jerarquía privilegiada tiene un bootstrap resoluble.',

    status:
      input.hierarchy.summary
        .block === 0 &&
      input.hierarchy.summary
        .bootstrapPossible
        ? 'pass'
        : 'block',

    details:
      `Listos=${input.hierarchy.summary.ready}, manuales=${input.hierarchy.summary.manual}, bloqueos=${input.hierarchy.summary.block}.`,
  });

  checks.push({
    id: 'manual_actions',

    label:
      'Existen pasos que requieren intervención humana.',

    status:
      input.executionPreview.summary
        .manual > 0 ||
      input.hierarchy.summary
        .manual > 0
        ? 'warn'
        : 'pass',

    details:
      `Execution Preview manuales=${input.executionPreview.summary.manual}; jerarquía manuales=${input.hierarchy.summary.manual}.`,
  });

  checks.push({
    id: 'executor_disabled',

    label:
      'El Migration Gate no autoriza ejecución.',

    status: 'pass',

    details:
      'executionAllowed permanece false. La confirmación y el executor todavía no existen.',
  });

  const pass =
    countStatus(
      checks,
      'pass',
    );

  const warn =
    countStatus(
      checks,
      'warn',
    );

  const block =
    countStatus(
      checks,
      'block',
    );

  return {
    schemaVersion: 1,

    generatedAt:
      now.toISOString(),

    guild: {
      id: input.snapshot.guild.id,
      name: input.snapshot.guild.name,
    },

    fingerprint:
      createFingerprint(input),

    snapshot: {
      capturedAt:
        input.snapshot.capturedAt,

      ageMinutes:
        Number(
          ageMinutes.toFixed(2),
        ),

      maximumAgeMinutes:
        MAXIMUM_SNAPSHOT_AGE_MINUTES,
    },

    checks,

    summary: {
      pass,

      warn,

      block,

      readyForExplicitConfirmation:
        block === 0,
    },

    executionAllowed: false,
  };
}
