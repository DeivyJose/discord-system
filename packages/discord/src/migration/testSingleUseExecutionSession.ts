import {
  readFile,
  rm,
} from 'node:fs/promises';

import path from 'node:path';

import {
  createDiscordBlueprintArtifact,
} from '../blueprint/artifact.js';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import {
  createMigrationGate,
} from './migrationGate.js';

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

const blueprint =
  createDiscordBlueprintArtifact(
    new Date(
      '2026-01-01T00:00:00.000Z',
    ),
  );

const gateArtifacts = {
  blueprint,
  snapshot,
  bindings,
  preflight,
  hierarchy,
};

const syntheticGateTime =
  new Date(
    new Date(
      snapshot.capturedAt,
    ).getTime() +
    60_000,
  );

const gate =
  createMigrationGate(
    {
      blueprint,
      snapshot,
      bindings,
      operations,
      executionPreview:
        preview,
      preflight,
      hierarchy,
    },
    syntheticGateTime,
  );

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
    'No fue posible generar Receipt sintético válido.',
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
    'single-use-execution-session-test',
  );

await rm(
  testRoot,
  {
    recursive: true,
    force: true,
  },
);

const mainClaims =
  path.join(
    testRoot,
    'main',
  );

const first =
  await createSingleUseExecutionSession({
    operations,
    preview,
    gate,
    receipt,

    gateArtifacts,

    claimsDirectory:
      mainClaims,

    now:
      sessionTime,
  });

const firstCreated =
  first.status ===
    'created' &&
  first.receiptClaimed &&
  first.session
    ?.status ===
    'ready' &&
  first.session
    .schemaVersion ===
    5 &&
  first.session
    .receiptClaim
    ?.receiptId ===
    receipt.receiptId &&
  first.session
    .receiptClaim
    ?.sessionId ===
    first.session
      .sessionId &&
  first.session
    .receiptClaim
    ?.gateFingerprint ===
    gate.fingerprint &&
  first.session
    .receiptClaim
    ?.gateEnvelopeFingerprint ===
    gate.envelopeFingerprint;

const second =
  await createSingleUseExecutionSession({
    operations,
    preview,
    gate,
    receipt,

    gateArtifacts,

    claimsDirectory:
      mainClaims,

    now:
      sessionTime,
  });

const sequentialReplayBlocked =
  second.status ===
    'blocked' &&
  second.blockReason ===
    'receipt_already_claimed' &&
  second.session ===
    null &&
  !second.receiptClaimed;

const invalidReceipt =
  structuredClone(
    receipt,
  );

invalidReceipt.status =
  'rejected';

invalidReceipt.summary
  .approvalValid =
  false;

invalidReceipt.summary
  .block =
  Math.max(
    1,
    invalidReceipt.summary
      .block,
  );

const invalidClaims =
  path.join(
    testRoot,
    'invalid',
  );

const invalid =
  await createSingleUseExecutionSession({
    operations,
    preview,
    gate,

    receipt:
      invalidReceipt,

    gateArtifacts,

    claimsDirectory:
      invalidClaims,

    now:
      sessionTime,
  });

const invalidDidNotConsume =
  invalid.status ===
    'blocked' &&
  invalid.blockReason ===
    'validation_failed' &&
  !invalid.receiptClaimed &&
  invalid.claimMarkerPath ===
    null;

const raceClaims =
  path.join(
    testRoot,
    'race',
  );

const [
  raceA,
  raceB,
] =
  await Promise.all([
    createSingleUseExecutionSession({
      operations,
      preview,
      gate,
      receipt,

      gateArtifacts,

      claimsDirectory:
        raceClaims,

      now:
        sessionTime,
    }),

    createSingleUseExecutionSession({
      operations,
      preview,
      gate,
      receipt,

      gateArtifacts,

      claimsDirectory:
        raceClaims,

      now:
        sessionTime,
    }),
  ]);

const raceResults = [
  raceA,
  raceB,
];

const raceCreated =
  raceResults.filter(
    (result) =>
      result.status ===
        'created',
  ).length;

const raceBlocked =
  raceResults.filter(
    (result) =>
      result.status ===
        'blocked' &&
      result.blockReason ===
        'receipt_already_claimed',
  ).length;

const atomicRacePasses =
  raceCreated ===
    1 &&
  raceBlocked ===
    1;

const executionDisabled =
  first.executionAllowed ===
    false &&
  (
    first.session
      ?.executionAllowed ??
    true
  ) ===
    false &&
  second.executionAllowed ===
    false;

const success =
  firstCreated &&
  sequentialReplayBlocked &&
  invalidDidNotConsume &&
  atomicRacePasses &&
  executionDisabled;

console.log('');
console.log(
  '🧱 Single-Use Receipt → Execution Session',
);
console.log('');

console.log(
  `Primera Session creada: ${firstCreated ? 'SÍ' : 'NO'}`,
);

console.log(
  `Receipt ligado al sessionId: ${
    first.session
      ?.receiptClaim
      ?.sessionId ===
      first.session
        ?.sessionId
      ? 'SÍ'
      : 'NO'
  }`,
);

console.log('');

console.log(
  `Replay secuencial bloqueado: ${sequentialReplayBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Validación inválida no consume Receipt: ${invalidDidNotConsume ? 'SÍ' : 'NO'}`,
);

console.log(
  `Carrera atómica produce una sola Session: ${atomicRacePasses ? 'SÍ' : 'NO'}`,
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
