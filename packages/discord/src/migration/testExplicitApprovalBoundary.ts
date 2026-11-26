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
  claimApprovalConfirmation,
} from './approvalConsumption.js';

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

const phrase =
  manifest.requiredPhrase;

if (
  !phrase ||
  !manifest.confirmationId
) {
  throw new Error(
    'No fue posible crear un Manifest válido.',
  );
}

const phraseBindsEnvelope =
  phrase.includes(
    gate.envelopeFingerprint.slice(
      0,
      12,
    ),
  );

const verifyTime =
  new Date(
    manifestTime.getTime() +
    1_000,
  );

const interactiveEvidence = {
  method:
    'interactive_tty' as const,

  inputIsTTY:
    true,

  outputIsTTY:
    true,

  confirmationUnused:
    true,
};

const approved =
  verifyConfirmationManifest(
    manifest,
    gate,
    phrase,
    interactiveEvidence,
    verifyTime,
  );

const validInteractivePasses =
  gate.schemaVersion ===
    5 &&
  manifest.schemaVersion ===
    3 &&
  approved.schemaVersion ===
    4 &&
  approved.status ===
    'approved' &&
  approved.summary
    .approvalValid &&
  approved.gateFingerprint ===
    gate.fingerprint &&
  approved.gateEnvelopeFingerprint ===
    gate.envelopeFingerprint &&
  manifest.provenanceFingerprint ===
    gate.provenance.lineageFingerprint &&
  approved.provenanceFingerprint ===
    gate.provenance.lineageFingerprint;

const pipedInput =
  verifyConfirmationManifest(
    manifest,
    gate,
    phrase,
    {
      ...interactiveEvidence,
      inputIsTTY:
        false,
    },
    verifyTime,
  );

const pipedInputBlocked =
  pipedInput.status ===
    'rejected' &&
  !pipedInput.summary
    .approvalValid;

const redirectedOutput =
  verifyConfirmationManifest(
    manifest,
    gate,
    phrase,
    {
      ...interactiveEvidence,
      outputIsTTY:
        false,
    },
    verifyTime,
  );

const redirectedOutputBlocked =
  redirectedOutput.status ===
    'rejected' &&
  !redirectedOutput.summary
    .approvalValid;

const wrongPhrase =
  verifyConfirmationManifest(
    manifest,
    gate,
    `${phrase} WRONG`,
    interactiveEvidence,
    verifyTime,
  );

const wrongPhraseBlocked =
  wrongPhrase.status ===
    'rejected' &&
  !wrongPhrase.summary
    .approvalValid;

const alreadyUsed =
  verifyConfirmationManifest(
    manifest,
    gate,
    phrase,
    {
      ...interactiveEvidence,
      confirmationUnused:
        false,
    },
    verifyTime,
  );

const usedEvidenceBlocked =
  alreadyUsed.status ===
    'rejected' &&
  !alreadyUsed.summary
    .approvalValid;

/*
 * Ataque 1:
 * cambia el envelope sin actualizar el seal.
 */
const tamperedGate =
  structuredClone(
    gate,
  );

tamperedGate.summary.pass +=
  1;

const staleEnvelope =
  verifyConfirmationManifest(
    manifest,
    tamperedGate,
    phrase,
    interactiveEvidence,
    verifyTime,
  );

const staleEnvelopeBlocked =
  staleEnvelope.status ===
    'rejected' &&
  !staleEnvelope.summary
    .approvalValid;

/*
 * Ataque 2:
 * el atacante recalcula el seal después
 * de modificar el Gate.
 *
 * El Manifest sigue ligado al envelope
 * original y debe rechazarlo.
 */
const resealedGate =
  structuredClone(
    tamperedGate,
  );

resealedGate.envelopeFingerprint =
  createMigrationGateEnvelopeFingerprint(
    extractMigrationGateEnvelopeFingerprintInput(
      resealedGate,
    ),
  );

const resealedEnvelope =
  verifyConfirmationManifest(
    manifest,
    resealedGate,
    phrase,
    interactiveEvidence,
    verifyTime,
  );

const resealedAfterManifestBlocked =
  resealedEnvelope.status ===
    'rejected' &&
  !resealedEnvelope.summary
    .approvalValid;

/*
 * ========================================================
 * DOWNGRADE ATTACK
 *
 * Simula un Gate histórico cargado desde JSON:
 * schema v4 / Content v3 / sin Provenance.
 *
 * Debe producir Manifest inválido y Receipt rechazado,
 * nunca una excepción.
 * ========================================================
 */
const downgradedGate =
  structuredClone(
    gate,
  );

const downgradedRuntime =
  downgradedGate as unknown as {
    schemaVersion: number;
    fingerprintVersion: number;
    provenance?: unknown;
  };

downgradedRuntime.schemaVersion =
  4;

downgradedRuntime.fingerprintVersion =
  3;

delete downgradedRuntime.provenance;

const downgradedManifest =
  createConfirmationManifest(
    downgradedGate,
    manifestTime,
  );

const downgradedReceipt =
  verifyConfirmationManifest(
    manifest,
    downgradedGate,
    phrase,
    interactiveEvidence,
    verifyTime,
  );

const downgradedGateBlocked =
  downgradedManifest.status ===
    'invalid' &&
  downgradedManifest.requiredPhrase ===
    null &&
  downgradedManifest.checks.some(
    (check) =>
      check.status ===
        'block',
  ) &&
  downgradedReceipt.status ===
    'rejected' &&
  !downgradedReceipt.summary
    .approvalValid;

const testRoot =
  path.join(
    projectRoot,
    '.data',
    'explicit-approval-boundary-test-v3',
  );

await rm(
  testRoot,
  {
    recursive: true,
    force: true,
  },
);

const claimsDirectory =
  path.join(
    testRoot,
    'claims',
  );

const firstClaim =
  await claimApprovalConfirmation({
    directory:
      claimsDirectory,

    confirmationId:
      manifest.confirmationId,

    gateFingerprint:
      gate.fingerprint,

    gateEnvelopeFingerprint:
      gate.envelopeFingerprint,

    provenanceFingerprint:
      gate.provenance.lineageFingerprint,

    receiptId:
      approved.receiptId,

    claimedAt:
      approved.verifiedAt,
  });

const secondClaim =
  await claimApprovalConfirmation({
    directory:
      claimsDirectory,

    confirmationId:
      manifest.confirmationId,

    gateFingerprint:
      gate.fingerprint,

    gateEnvelopeFingerprint:
      gate.envelopeFingerprint,

    provenanceFingerprint:
      gate.provenance.lineageFingerprint,

    receiptId:
      approved.receiptId,

    claimedAt:
      approved.verifiedAt,
  });

const atomicSingleUsePasses =
  firstClaim.claimed &&
  !secondClaim.claimed;

const receiptDoesNotStorePhrase =
  !JSON.stringify(
    approved,
  ).includes(
    phrase,
  );

const executionStillDisabled =
  gate.executionAllowed ===
    false &&
  manifest.executionAllowed ===
    false &&
  approved.executionAllowed ===
    false &&
  staleEnvelope.executionAllowed ===
    false &&
  resealedEnvelope.executionAllowed ===
    false;

const success =
  validInteractivePasses &&
  phraseBindsEnvelope &&
  pipedInputBlocked &&
  redirectedOutputBlocked &&
  wrongPhraseBlocked &&
  usedEvidenceBlocked &&
  staleEnvelopeBlocked &&
  resealedAfterManifestBlocked &&
  downgradedGateBlocked &&
  atomicSingleUsePasses &&
  receiptDoesNotStorePhrase &&
  executionStillDisabled;

console.log('');
console.log(
  '🔏 Explicit Approval Boundary v3',
);
console.log('');

console.log(
  `Aprobación interactiva válida: ${validInteractivePasses ? 'SÍ' : 'NO'}`,
);

console.log(
  `Frase liga Envelope: ${phraseBindsEnvelope ? 'SÍ' : 'NO'}`,
);

console.log(
  `stdin no-TTY bloqueado: ${pipedInputBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `stdout no-TTY bloqueado: ${redirectedOutputBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Frase incorrecta bloqueada: ${wrongPhraseBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `confirmationId usado bloqueado: ${usedEvidenceBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Envelope alterado bloqueado: ${staleEnvelopeBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Envelope resealed tras Manifest bloqueado: ${resealedAfterManifestBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Primer claim atómico: ${firstClaim.claimed ? 'SÍ' : 'NO'}`,
);

console.log(
  `Segundo claim rechazado: ${!secondClaim.claimed ? 'SÍ' : 'NO'}`,
);

console.log(
  `Receipt no almacena frase: ${receiptDoesNotStorePhrase ? 'SÍ' : 'NO'}`,
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
