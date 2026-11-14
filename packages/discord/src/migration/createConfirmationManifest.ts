import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import {
  createConfirmationManifest,
} from './confirmationManifest.js';

import {
  renderConfirmationManifest,
} from './confirmationManifestReport.js';

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const gatePath =
  path.join(
    projectRoot,
    '.data',
    'migration-gate',
    'latest.json',
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'confirmation-manifest',
  );

console.log('');
console.log(
  '🔐 Creando Confirmation Manifest...',
);

const gate =
  JSON.parse(
    await readFile(
      gatePath,
      'utf8',
    ),
  ) as MigrationGate;

const manifest =
  createConfirmationManifest(
    gate,
  );

const report =
  renderConfirmationManifest(
    manifest,
  );

await mkdir(
  outputDirectory,
  {
    recursive: true,
  },
);

const jsonPath =
  path.join(
    outputDirectory,
    'latest.json',
  );

const textPath =
  path.join(
    outputDirectory,
    'latest.txt',
  );

await writeFile(
  jsonPath,
  JSON.stringify(
    manifest,
    null,
    2,
  ) + '\n',
  'utf8',
);

await writeFile(
  textPath,
  report,
  'utf8',
);

console.log('');
console.log(
  '✅ Confirmation Manifest generado.',
);

console.log('');
console.log(
  `Estado: ${manifest.status}`,
);

console.log(
  `PASS:   ${manifest.summary.pass}`,
);

console.log(
  `BLOCK:  ${manifest.summary.block}`,
);

console.log('');

console.log(
  `Listo para aprobación: ${
    manifest.summary.readyForUserApproval
      ? 'SÍ'
      : 'NO'
  }`,
);

if (
  manifest.requiredPhrase
) {
  console.log('');
  console.log(
    `Desafío: ${manifest.requiredPhrase}`,
  );
}

console.log('');
console.log(
  'Ejecución permitida: NO',
);

console.log('');
console.log(
  `Reporte: ${textPath}`,
);

console.log('');
