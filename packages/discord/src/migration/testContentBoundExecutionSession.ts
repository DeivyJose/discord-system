import {
  readFile,
  rm,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import type {
  DiscordMigrationPreflight,
} from './preflightTypes.js';

import type {
  HierarchyBootstrapPlan,
} from './hierarchyBootstrapTypes.js';

import {
  loadDiscordBindings,
} from './bindings.js';

import {
  createConfirmationManifest,
} from './confirmationManifest.js';

import {
  verifyConfirmationManifest,
} from './confirmationVerifier.js';

import {
  createSingleUseExecutionSession,
} from './singleUseExecutionSession.js';

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

async function readJson<T>(
  ...segments: string[]
): Promise<T> {
  return JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        ...segments,
      ),
      'utf8',
    ),
  ) as T;
}

const snapshot =
  await readJson<
    DiscordGuildSnapshot
  >(
    '.data',
    'discord-snapshots',
    'latest.json',
  );

const bindings =
  await loadDiscordBindings(
    path.join(
      projectRoot,
      '.data',
      'discord-bindings.json',
    ),
    snapshot.guild.id,
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

const preflight =
  await readJson<
    DiscordMigrationPreflight
  >(
    '.data',
    'migration-preflight',
    'latest.json',
  );

const hierarchy =
  await readJson<
    HierarchyBootstrapPlan
  >(
    '.data',
    'hierarchy-bootstrap',
    'latest.json',
  );

const gate =
  await readJson<
    MigrationGate
  >(
    '.data',
    'migration-gate',
    'latest.json',
  );

const gateArtifacts = {
  snapshot,
  bindings,
  preflight,
  hierarchy,
};

const manifestTime =
  new Date(
    new Date(
      gate.generatedAt,
    ).getTime() +
    1_000,
  );

const manifest =
  createConfirmationManifest(
    gate,
    manifestTime,
  );

if (
  !manifest.requiredPhrase
) {
  throw new Error(
    'No fue posible crear Manifest sintético.',
  );
}

const receiptTime =
  new Date(
    manifestTime.getTime() +
    1_000,
  );

const receipt =
  verifyConfirmationManifest(
    manifest,
    gate,
    manifest.requiredPhrase,
    {
      method:
        'interactive_tty',

      inputIsTTY:
        true,

      outputIsTTY:
        true,

      confirmationUnused:
        true,
    },
    receiptTime,
  );

if (
  !receipt.summary
    .approvalValid
) {
  throw new Error(
    'No fue posible crear Receipt sintético válido.',
  );
}

const sessionTime =
  new Date(
    receiptTime.getTime() +
    1_000,
  );

const testRoot =
  path.join(
    projectRoot,
    '.data',
    'content-bound-execution-session-test',
  );

await rm(
  testRoot,
  {
    recursive: true,
    force: true,
  },
);

/*
 * BASELINE
 */
const baseline =
  await createSingleUseExecutionSession({
    operations,
    preview,
    gate,
    receipt,
    gateArtifacts,

    claimsDirectory:
      path.join(
        testRoot,
        'baseline',
      ),

    now:
      sessionTime,
  });

const baselinePasses =
  baseline.status ===
    'created' &&
  baseline.session
    ?.status ===
    'ready' &&
  baseline.session
    .contentBinding
    .matchesGate &&
  baseline.session
    .contentBinding
    .recalculatedGateFingerprint ===
    gate.fingerprint;

/*
 * TAMPER 1:
 * Añadimos contenido a una operación
 * sin alterar IDs ni contadores.
 */
const tamperedOperations =
  structuredClone(
    operations,
  );

const firstOperation =
  tamperedOperations
    .operations[0];

if (
  !firstOperation
) {
  throw new Error(
    'Operations no contiene elementos.',
  );
}

Object.assign(
  firstOperation as unknown as
    Record<string, unknown>,
  {
    __contentBindingTamper:
      'operation-mutated-after-gate',
  },
);

const operationTamper =
  await createSingleUseExecutionSession({
    operations:
      tamperedOperations,

    preview,
    gate,
    receipt,
    gateArtifacts,

    claimsDirectory:
      path.join(
        testRoot,
        'operation-tamper',
      ),

    now:
      sessionTime,
  });

const operationBindingCheck =
  operationTamper.preflight
    .checks.find(
      (check) =>
        check.id ===
          'gate_content_binding',
    );

const operationTamperBlocked =
  operationTamper.status ===
    'blocked' &&
  operationTamper.blockReason ===
    'validation_failed' &&
  !operationTamper
    .receiptClaimed &&
  operationTamper
    .claimMarkerPath ===
    null &&
  operationBindingCheck
    ?.status ===
    'block';

/*
 * TAMPER 2:
 * Añadimos contenido a un Preview step
 * conservando operationId, status,
 * phase, dependencias y contadores.
 */
const tamperedPreview =
  structuredClone(
    preview,
  );

const firstStep =
  tamperedPreview
    .steps[0];

if (
  !firstStep
) {
  throw new Error(
    'Execution Preview no contiene steps.',
  );
}

Object.assign(
  firstStep as unknown as
    Record<string, unknown>,
  {
    __contentBindingTamper:
      'preview-mutated-after-gate',
  },
);

const previewTamper =
  await createSingleUseExecutionSession({
    operations,

    preview:
      tamperedPreview,

    gate,
    receipt,
    gateArtifacts,

    claimsDirectory:
      path.join(
        testRoot,
        'preview-tamper',
      ),

    now:
      sessionTime,
  });

const previewBindingCheck =
  previewTamper.preflight
    .checks.find(
      (check) =>
        check.id ===
          'gate_content_binding',
    );

const previewTamperBlocked =
  previewTamper.status ===
    'blocked' &&
  previewTamper.blockReason ===
    'validation_failed' &&
  !previewTamper
    .receiptClaimed &&
  previewTamper
    .claimMarkerPath ===
    null &&
  previewBindingCheck
    ?.status ===
    'block';

/*
 * TAMPER 3:
 * Alteración de uno de los otros
 * cuatro inputs del fingerprint.
 */
const tamperedGateArtifacts =
  structuredClone(
    gateArtifacts,
  );

Object.assign(
  tamperedGateArtifacts
    .bindings as unknown as
      Record<string, unknown>,
  {
    __contentBindingTamper:
      'bindings-mutated-after-gate',
  },
);

const bindingsTamper =
  await createSingleUseExecutionSession({
    operations,
    preview,
    gate,
    receipt,

    gateArtifacts:
      tamperedGateArtifacts,

    claimsDirectory:
      path.join(
        testRoot,
        'bindings-tamper',
      ),

    now:
      sessionTime,
  });

const bindingsBindingCheck =
  bindingsTamper.preflight
    .checks.find(
      (check) =>
        check.id ===
          'gate_content_binding',
    );

const bindingsTamperBlocked =
  bindingsTamper.status ===
    'blocked' &&
  bindingsTamper.blockReason ===
    'validation_failed' &&
  !bindingsTamper
    .receiptClaimed &&
  bindingsTamper
    .claimMarkerPath ===
    null &&
  bindingsBindingCheck
    ?.status ===
    'block';

const receiptProtectedBeforeClaim =
  !operationTamper
    .receiptClaimed &&
  !previewTamper
    .receiptClaimed &&
  !bindingsTamper
    .receiptClaimed;

const executionStillDisabled =
  baseline.executionAllowed ===
    false &&
  baseline.session
    ?.executionAllowed ===
    false &&
  operationTamper
    .executionAllowed ===
    false &&
  previewTamper
    .executionAllowed ===
    false &&
  bindingsTamper
    .executionAllowed ===
    false;

const success =
  baselinePasses &&
  operationTamperBlocked &&
  previewTamperBlocked &&
  bindingsTamperBlocked &&
  receiptProtectedBeforeClaim &&
  executionStillDisabled;

console.log('');
console.log(
  '🔐 Content-Bound Execution Session',
);
console.log('');

console.log(
  `Baseline reproduce Gate v2: ${baselinePasses ? 'SÍ' : 'NO'}`,
);

console.log(
  `Operations modificadas bloqueadas: ${operationTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Preview modificado bloqueado: ${previewTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Bindings modificados bloqueados: ${bindingsTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Tampering bloqueado antes de consumir Receipt: ${receiptProtectedBeforeClaim ? 'SÍ' : 'NO'}`,
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
  'EJECUCIÓN REAL PERMITIDA: NO',
);

console.log('');

if (
  !success
) {
  process.exitCode = 2;
}
