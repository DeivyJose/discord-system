import {
  mkdir,
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

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

const gate =
  JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        '.data',
        'migration-gate',
        'latest.json',
      ),
      'utf8',
    ),
  ) as MigrationGate;

/*
 * Tiempo sintético dentro de la ventana
 * del Gate. Esta prueba no reutiliza una
 * autorización histórica real.
 */
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

const phrase =
  manifest.requiredPhrase;

if (
  !phrase ||
  !manifest.confirmationId
) {
  throw new Error(
    'No fue posible crear un Manifest válido para la prueba.',
  );
}

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
  approved.status ===
    'approved' &&
  approved.summary
    .approvalValid &&
  approved.schemaVersion ===
    2;

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

const claimsDirectory =
  path.join(
    projectRoot,
    '.data',
    'explicit-approval-boundary-test',
    'claims',
  );

await mkdir(
  claimsDirectory,
  {
    recursive: true,
  },
);

const firstClaim =
  await claimApprovalConfirmation({
    directory:
      claimsDirectory,

    confirmationId:
      manifest.confirmationId,

    gateFingerprint:
      gate.fingerprint,

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
  approved.executionAllowed ===
    false &&
  pipedInput.executionAllowed ===
    false &&
  alreadyUsed.executionAllowed ===
    false;

const success =
  validInteractivePasses &&
  pipedInputBlocked &&
  redirectedOutputBlocked &&
  wrongPhraseBlocked &&
  usedEvidenceBlocked &&
  atomicSingleUsePasses &&
  receiptDoesNotStorePhrase &&
  executionStillDisabled;

console.log('');
console.log(
  '🔏 Explicit Approval Boundary v2',
);
console.log('');

console.log(
  `Aprobación interactiva válida: ${validInteractivePasses ? 'SÍ' : 'NO'}`,
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
  `Primer claim atómico: ${firstClaim.claimed ? 'SÍ' : 'NO'}`,
);

console.log(
  `Segundo claim rechazado: ${!secondClaim.claimed ? 'SÍ' : 'NO'}`,
);

console.log(
  `Receipt no almacena la frase: ${receiptDoesNotStorePhrase ? 'SÍ' : 'NO'}`,
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
