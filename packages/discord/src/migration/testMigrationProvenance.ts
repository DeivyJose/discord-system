import {
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordBlueprintArtifact,
} from '../blueprint/artifact.js';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  DiscordBindings,
  MigrationPlan,
} from './types.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import {
  createMigrationProvenance,
  verifyMigrationProvenance,
} from './migrationProvenance.js';

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

async function readJson<T>(
  ...parts:
    string[]
): Promise<T> {
  return JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        ...parts,
      ),
      'utf8',
    ),
  ) as T;
}

const blueprint =
  await readJson<
    DiscordBlueprintArtifact
  >(
    '.data',
    'discord-blueprint',
    'latest.json',
  );

const snapshot =
  await readJson<
    DiscordGuildSnapshot
  >(
    '.data',
    'discord-snapshots',
    'latest.json',
  );

const bindings =
  await readJson<
    DiscordBindings
  >(
    '.data',
    'discord-bindings.json',
  );

const plan =
  await readJson<
    MigrationPlan
  >(
    '.data',
    'migration-plans',
    'latest.json',
  );

const operations =
  await readJson<
    MigrationOperationsPlan
  >(
    '.data',
    'migration-operations',
    'latest.json',
  );

const preview =
  await readJson<
    DiscordExecutionPreview
  >(
    '.data',
    'execution-preview',
    'latest.json',
  );

const fixedNow =
  new Date(
    '2026-11-17T02:19:00.000Z',
  );

function makeInput(
  overrides: {
    blueprint?:
      DiscordBlueprintArtifact;

    snapshot?:
      DiscordGuildSnapshot;

    bindings?:
      DiscordBindings;

    plan?:
      MigrationPlan;

    operations?:
      MigrationOperationsPlan;

    preview?:
      DiscordExecutionPreview;
  } = {},
) {
  return {
    blueprint:
      overrides.blueprint ??
      structuredClone(
        blueprint,
      ),

    snapshot:
      overrides.snapshot ??
      structuredClone(
        snapshot,
      ),

    bindings:
      overrides.bindings ??
      structuredClone(
        bindings,
      ),

    plan:
      overrides.plan ??
      structuredClone(
        plan,
      ),

    operations:
      overrides.operations ??
      structuredClone(
        operations,
      ),

    preview:
      overrides.preview ??
      structuredClone(
        preview,
      ),
  };
}

/*
 * ========================================================
 * BASELINE
 * ========================================================
 */

const baselineInput =
  makeInput();

const baseline =
  createMigrationProvenance(
    baselineInput,
    fixedNow,
  );

const baselineVerification =
  verifyMigrationProvenance(
    baseline,
    baselineInput,
    fixedNow,
  );

const baselineValid =
  baseline.summary.valid &&
  baselineVerification.status ===
    'valid';

/*
 * ========================================================
 * BLUEPRINT TAMPERING
 * ========================================================
 */

const alteredBlueprint =
  structuredClone(
    blueprint,
  );

const blueprintRole =
  alteredBlueprint.roles[0];

if (
  !blueprintRole
) {
  throw new Error(
    'Blueprint sin roles para test.',
  );
}

blueprintRole.name =
  `${blueprintRole.name} TAMPERED`;

const blueprintAttack =
  createMigrationProvenance(
    makeInput({
      blueprint:
        alteredBlueprint,
    }),
    fixedNow,
  );

const blueprintBlocked =
  !blueprintAttack
    .summary.valid &&
  blueprintAttack.checks.some(
    (check) =>
      check.id ===
        'blueprint_root_integrity' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * SNAPSHOT TAMPERING
 * ========================================================
 */

const alteredSnapshot =
  structuredClone(
    snapshot,
  );

const snapshotChannel =
  alteredSnapshot.channels[0];

if (
  !snapshotChannel
) {
  throw new Error(
    'Snapshot sin canales para test.',
  );
}

snapshotChannel.name =
  `${snapshotChannel.name}-TAMPERED`;

const snapshotAttack =
  createMigrationProvenance(
    makeInput({
      snapshot:
        alteredSnapshot,
    }),
    fixedNow,
  );

const snapshotBlocked =
  !snapshotAttack
    .summary.valid &&
  (
    snapshotAttack.checks.some(
      (check) =>
        check.id ===
          'plan_reproducibility' &&
        check.status ===
          'block',
    ) ||
    snapshotAttack.checks.some(
      (check) =>
        check.id ===
          'operations_reproducibility' &&
        check.status ===
          'block',
    )
  );

/*
 * ========================================================
 * BINDINGS TAMPERING
 * ========================================================
 */

const alteredBindings =
  structuredClone(
    bindings,
  );

const firstBindingKey =
  Object.keys(
    alteredBindings.resources,
  )[0];

if (
  !firstBindingKey
) {
  throw new Error(
    'Bindings vacíos; no se puede ejecutar ataque.',
  );
}

alteredBindings.resources[
  firstBindingKey
] =
  '999999999999999999';

const bindingsAttack =
  createMigrationProvenance(
    makeInput({
      bindings:
        alteredBindings,
    }),
    fixedNow,
  );

const bindingsBlocked =
  !bindingsAttack
    .summary.valid &&
  (
    bindingsAttack.checks.some(
      (check) =>
        check.id ===
          'plan_reproducibility' &&
        check.status ===
          'block',
    ) ||
    bindingsAttack.checks.some(
      (check) =>
        check.id ===
          'operations_reproducibility' &&
        check.status ===
          'block',
    )
  );

/*
 * ========================================================
 * PLAN TAMPERING
 * ========================================================
 */

const alteredPlan =
  structuredClone(
    plan,
  );

alteredPlan.summary.create +=
  1;

const planAttack =
  createMigrationProvenance(
    makeInput({
      plan:
        alteredPlan,
    }),
    fixedNow,
  );

const planBlocked =
  !planAttack
    .summary.valid &&
  planAttack.checks.some(
    (check) =>
      check.id ===
        'plan_reproducibility' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * OPERATIONS TAMPERING
 * ========================================================
 */

const alteredOperations =
  structuredClone(
    operations,
  );

const firstOperation =
  alteredOperations
    .operations[0];

if (
  !firstOperation
) {
  throw new Error(
    'Operations vacío.',
  );
}

firstOperation.reason =
  `${firstOperation.reason} TAMPERED`;

const operationsAttack =
  createMigrationProvenance(
    makeInput({
      operations:
        alteredOperations,
    }),
    fixedNow,
  );

const operationsBlocked =
  !operationsAttack
    .summary.valid &&
  operationsAttack.checks.some(
    (check) =>
      check.id ===
        'operations_reproducibility' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * PREVIEW TAMPERING
 * ========================================================
 */

const alteredPreview =
  structuredClone(
    preview,
  );

const firstStep =
  alteredPreview.steps[0];

if (
  !firstStep
) {
  throw new Error(
    'Preview sin steps.',
  );
}

firstStep.label =
  `${firstStep.label} TAMPERED`;

const previewAttack =
  createMigrationProvenance(
    makeInput({
      preview:
        alteredPreview,
    }),
    fixedNow,
  );

const previewBlocked =
  !previewAttack
    .summary.valid &&
  previewAttack.checks.some(
    (check) =>
      check.id ===
        'preview_reproducibility' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * FOREIGN OPERATIONS
 *
 * Generamos Operations de otro root y tratamos
 * de combinarlas con el root original.
 * ========================================================
 */

const foreignSnapshot =
  structuredClone(
    snapshot,
  );

const foreignChannel =
  foreignSnapshot.channels[0];

if (
  !foreignChannel
) {
  throw new Error(
    'Snapshot sin canal para foreign lineage.',
  );
}

foreignChannel.name =
  `${foreignChannel.name}-FOREIGN`;

const foreignInput =
  makeInput({
    snapshot:
      foreignSnapshot,
  });

const foreignProvenance =
  createMigrationProvenance(
    foreignInput,
    fixedNow,
  );

const foreignOperationsInput =
  makeInput();

foreignOperationsInput
  .operations =
  structuredClone(
    foreignInput.operations,
  );

/*
 * foreignInput.operations todavía son las originales,
 * así que para este ataque usamos directamente un
 * content fingerprint extranjero dentro del Artifact.
 */
const foreignOperationsArtifact =
  structuredClone(
    baseline,
  );

foreignOperationsArtifact
  .artifacts
  .operationsFingerprint =
  foreignProvenance
    .source
    .rootFingerprint;

const foreignLineageVerification =
  verifyMigrationProvenance(
    foreignOperationsArtifact,
    baselineInput,
    fixedNow,
  );

const foreignLineageBlocked =
  foreignLineageVerification
    .status ===
    'blocked';

/*
 * ========================================================
 * CHILD RESEAL WITHOUT PARENT
 * ========================================================
 */

const resealedChild =
  structuredClone(
    baseline,
  );

resealedChild.lineage
  .operationsFingerprint =
  'f'.repeat(
    64,
  );

resealedChild
  .lineageFingerprint =
  resealedChild
    .lineage
    .previewFingerprint;

const resealVerification =
  verifyMigrationProvenance(
    resealedChild,
    baselineInput,
    fixedNow,
  );

const resealBlocked =
  resealVerification.status ===
    'blocked' &&
  resealVerification.checks.some(
    (check) =>
      check.id ===
        'lineage_chain' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * EXECUTION BOUNDARY
 * ========================================================
 */

const unsafePreview =
  structuredClone(
    preview,
  ) as Omit<
    DiscordExecutionPreview,
    'executionAllowed'
  > & {
    executionAllowed:
      boolean;
  };

unsafePreview.executionAllowed =
  true;

const boundaryAttack =
  createMigrationProvenance(
    makeInput({
      preview:
        unsafePreview as unknown as
          DiscordExecutionPreview,
    }),
    fixedNow,
  );

const boundaryBlocked =
  !boundaryAttack
    .summary.valid &&
  boundaryAttack.checks.some(
    (check) =>
      check.id ===
        'execution_boundary' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * RESULT
 * ========================================================
 */

const success =
  baselineValid &&
  blueprintBlocked &&
  snapshotBlocked &&
  bindingsBlocked &&
  planBlocked &&
  operationsBlocked &&
  previewBlocked &&
  foreignLineageBlocked &&
  resealBlocked &&
  boundaryBlocked;

console.log('');
console.log(
  'Migration Provenance v1',
);
console.log('');

console.log(
  `Baseline reproducible: ${baselineValid ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Blueprint distinto bloqueado: ${blueprintBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Snapshot distinto bloqueado: ${snapshotBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Bindings distintos bloqueados: ${bindingsBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Plan manipulado bloqueado: ${planBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Operations manipuladas bloqueadas: ${operationsBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Preview manipulado bloqueado: ${previewBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Lineage extranjero bloqueado: ${foreignLineageBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Child reseal sin padre bloqueado: ${resealBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Execution boundary alterada bloqueada: ${boundaryBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'MUTACIONES REALES ENVIADAS: 0',
);

console.log(
  'RUN:REAL-CANARY: NO EXISTE',
);

console.log(
  'EJECUCIÓN REAL PERMITIDA: NO',
);

console.log('');

if (
  !success
) {
  process.exitCode =
    2;
}
