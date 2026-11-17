import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  createInterface,
} from 'node:readline/promises';

import {
  stdin as input,
  stdout as output,
} from 'node:process';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import type {
  ConfirmationManifest,
} from './confirmationManifestTypes.js';

import {
  verifyConfirmationManifest,
} from './confirmationVerifier.js';

import {
  claimApprovalConfirmation,
} from './approvalConsumption.js';

import {
  renderApprovalReceipt,
} from './approvalReceiptReport.js';

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

console.log('');
console.log(
  '🔏 Confirmation Verifier de The Clock',
);

console.log('');
console.log(
  'Este comando NO ejecuta ninguna modificación en Discord.',
);

const gate =
  await readJson<MigrationGate>(
    '.data',
    'migration-gate',
    'latest.json',
  );

const manifest =
  await readJson<ConfirmationManifest>(
    '.data',
    'confirmation-manifest',
    'latest.json',
  );

console.log('');
console.log(
  `Content fingerprint: ${gate.fingerprint}`,
);

console.log(
  `Envelope fingerprint: ${gate.envelopeFingerprint}`,
);

console.log(
  `Manifest expira: ${manifest.expiresAt}`,
);

console.log('');

const inputIsTTY =
  input.isTTY ===
    true;

const outputIsTTY =
  output.isTTY ===
    true;

if (
  !inputIsTTY ||
  !outputIsTTY
) {
  console.error(
    'BLOCK: la aprobación requiere una terminal interactiva real.',
  );

  console.error(
    'stdin redirigido, pipes y archivos de entrada no son aceptados.',
  );

  process.exit(
    2,
  );
}

const readline =
  createInterface({
    input,
    output,
  });

let phrase = '';

try {
  phrase =
    await readline.question(
      'Escribe exactamente la frase de confirmación: ',
    );
} finally {
  readline.close();
}

const approvalEvidence = {
  method:
    'interactive_tty' as const,

  inputIsTTY,

  outputIsTTY,

  confirmationUnused:
    true,
};

let receipt =
  verifyConfirmationManifest(
    manifest,
    gate,
    phrase,
    approvalEvidence,
  );

/*
 * Solo una aprobación que ya pasó todos los
 * checks intenta reclamar el confirmationId.
 *
 * El marker se crea atómicamente con flag wx.
 * Si ya existe, el Receipt final se rehace
 * como rejected.
 */
if (
  receipt.summary
    .approvalValid
) {
  const confirmationId =
    manifest.confirmationId;

  if (
    !confirmationId
  ) {
    throw new Error(
      'Manifest aprobado sin confirmationId.',
    );
  }

  const claim =
    await claimApprovalConfirmation({
      directory:
        path.join(
          projectRoot,
          '.data',
          'approval-consumption',
        ),

      confirmationId,

      gateFingerprint:
        gate.fingerprint,

      gateEnvelopeFingerprint:
        gate.envelopeFingerprint,

      receiptId:
        receipt.receiptId,

      claimedAt:
        receipt.verifiedAt,
    });

  if (
    !claim.claimed
  ) {
    receipt =
      verifyConfirmationManifest(
        manifest,
        gate,
        phrase,
        {
          ...approvalEvidence,

          confirmationUnused:
            false,
        },
      );
  }
}

const report =
  renderApprovalReceipt(
    receipt,
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'approval-receipts',
  );

await mkdir(
  outputDirectory,
  {
    recursive: true,
  },
);

const timestamp =
  receipt.verifiedAt
    .replace(
      /[:.]/g,
      '-',
    );

const receiptJsonPath =
  path.join(
    outputDirectory,
    `receipt-${receipt.receiptId}-${timestamp}.json`,
  );

const receiptTextPath =
  path.join(
    outputDirectory,
    `receipt-${receipt.receiptId}-${timestamp}.txt`,
  );

await writeFile(
  receiptJsonPath,
  JSON.stringify(
    receipt,
    null,
    2,
  ) + '\n',
  'utf8',
);

await writeFile(
  receiptTextPath,
  report,
  'utf8',
);

await writeFile(
  path.join(
    outputDirectory,
    'latest.json',
  ),
  JSON.stringify(
    receipt,
    null,
    2,
  ) + '\n',
  'utf8',
);

await writeFile(
  path.join(
    outputDirectory,
    'latest.txt',
  ),
  report,
  'utf8',
);

console.log('');
console.log(
  '✅ Verificación terminada.',
);

console.log('');
console.log(
  `Estado: ${receipt.status}`,
);

console.log(
  `PASS:   ${receipt.summary.pass}`,
);

console.log(
  `BLOCK:  ${receipt.summary.block}`,
);

console.log('');

console.log(
  `Aprobación válida: ${
    receipt.summary.approvalValid
      ? 'SÍ'
      : 'NO'
  }`,
);

console.log('');

console.log(
  'Ejecución permitida: NO',
);

console.log('');

console.log(
  `Receipt: ${receiptTextPath}`,
);

console.log('');

if (
  !receipt.summary.approvalValid
) {
  process.exitCode = 2;
}
