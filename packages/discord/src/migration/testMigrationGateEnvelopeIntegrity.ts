import {
  readFile,
  rm,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import {
  createDiscordBlueprintArtifact,
} from '../blueprint/artifact.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  MigrationProvenanceArtifact,
} from './migrationProvenanceTypes.js';

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
  DiscordBindings,
  MigrationPlan,
} from './types.js';

import {
  createMigrationGate,
  createMigrationGateEnvelopeFingerprint,
  extractMigrationGateEnvelopeFingerprintInput,
} from './migrationGate.js';

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

const provenance =
  await readJson<
    MigrationProvenanceArtifact
  >(
    '.data',
    'migration-provenance',
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

const gateTime =
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
      plan,
      provenance,
      operations,
      executionPreview:
        preview,
      preflight,
      hierarchy,
    },
    gateTime,
  );

const recalculatedEnvelope =
  createMigrationGateEnvelopeFingerprint(
    extractMigrationGateEnvelopeFingerprintInput(
      gate,
    ),
  );

const baselineEnvelopeValid =
  gate.schemaVersion ===
    5 &&
  gate.envelopeFingerprintVersion ===
    1 &&
  recalculatedEnvelope ===
    gate.envelopeFingerprint;

const manifestTime =
  new Date(
    gateTime.getTime() +
    1_000,
  );

const manifest =
  createConfirmationManifest(
    gate,
    manifestTime,
  );

if (
  !manifest.requiredPhrase ||
  !manifest.confirmationId
) {
  throw new Error(
    'Manifest sintético inválido.',
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
    'Receipt sintético inválido.',
  );
}

const gateArtifacts = {
  blueprint,
  snapshot,
  bindings,
  plan,
  provenance,
  preflight,
  hierarchy,
};

const sessionTime =
  new Date(
    receiptTime.getTime() +
    1_000,
  );

const testRoot =
  path.join(
    projectRoot,
    '.data',
    'migration-gate-envelope-integrity-test',
  );

await rm(
  testRoot,
  {
    recursive: true,
    force: true,
  },
);

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
  baseline.receiptClaimed &&
  baseline.session
    ?.schemaVersion ===
    6 &&
  baseline.session
    .envelopeBinding
    .matchesGate &&
  baseline.session
    .receiptClaim
    ?.gateEnvelopeFingerprint ===
    gate.envelopeFingerprint;

/*
 * TAMPER A:
 * metadata cambia y el seal NO se recalcula.
 */
const staleGate =
  structuredClone(
    gate,
  );

staleGate.summary.pass +=
  1;

const stale =
  await createSingleUseExecutionSession({
    operations,
    preview,

    gate:
      staleGate,

    receipt,
    gateArtifacts,

    claimsDirectory:
      path.join(
        testRoot,
        'stale',
      ),

    now:
      sessionTime,
  });

const staleEnvelopeBlockedBeforeClaim =
  stale.status ===
    'blocked' &&
  stale.blockReason ===
    'validation_failed' &&
  !stale.receiptClaimed &&
  stale.claimMarkerPath ===
    null;

/*
 * TAMPER B:
 * metadata cambia y el atacante recalcula
 * correctamente el envelope seal.
 *
 * El Receipt pertenece al envelope anterior,
 * por lo que también debe bloquearse antes
 * de consumirlo.
 */
const resealedGate =
  structuredClone(
    staleGate,
  );

resealedGate.envelopeFingerprint =
  createMigrationGateEnvelopeFingerprint(
    extractMigrationGateEnvelopeFingerprintInput(
      resealedGate,
    ),
  );

const resealed =
  await createSingleUseExecutionSession({
    operations,
    preview,

    gate:
      resealedGate,

    receipt,
    gateArtifacts,

    claimsDirectory:
      path.join(
        testRoot,
        'resealed',
      ),

    now:
      sessionTime,
  });

const resealedAfterReceiptBlocked =
  resealed.status ===
    'blocked' &&
  resealed.blockReason ===
    'validation_failed' &&
  !resealed.receiptClaimed &&
  resealed.claimMarkerPath ===
    null;

const executionDisabled =
  baseline.executionAllowed ===
    false &&
  stale.executionAllowed ===
    false &&
  resealed.executionAllowed ===
    false;

const success =
  baselineEnvelopeValid &&
  baselinePasses &&
  staleEnvelopeBlockedBeforeClaim &&
  resealedAfterReceiptBlocked &&
  executionDisabled;

console.log('');
console.log(
  '🛡️ Migration Gate Envelope Integrity v1',
);
console.log('');

console.log(
  `Envelope baseline reproducible: ${baselineEnvelopeValid ? 'SÍ' : 'NO'}`,
);

console.log(
  `Session baseline creada: ${baselinePasses ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Envelope alterado bloqueado antes del claim: ${staleEnvelopeBlockedBeforeClaim ? 'SÍ' : 'NO'}`,
);

console.log(
  `Envelope resealed después del Receipt bloqueado: ${resealedAfterReceiptBlocked ? 'SÍ' : 'NO'}`,
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
