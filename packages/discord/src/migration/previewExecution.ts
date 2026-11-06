import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  loadDiscordBindings,
} from './bindings.js';

import {
  createExecutionPreview,
} from './executionPreview.js';

import {
  renderExecutionPreview,
} from './executionReport.js';

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const snapshotPath =
  path.join(
    projectRoot,
    '.data',
    'discord-snapshots',
    'latest.json',
  );

const bindingsPath =
  path.join(
    projectRoot,
    '.data',
    'discord-bindings.json',
  );

const operationsPath =
  path.join(
    projectRoot,
    '.data',
    'migration-operations',
    'latest.json',
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'execution-preview',
  );

console.log('');
console.log(
  '🛡️ Generando Execution Preview...',
);

const snapshot =
  JSON.parse(
    await readFile(
      snapshotPath,
      'utf8',
    ),
  ) as DiscordGuildSnapshot;

const bindings =
  await loadDiscordBindings(
    bindingsPath,
    snapshot.guild.id,
  );

const operations =
  JSON.parse(
    await readFile(
      operationsPath,
      'utf8',
    ),
  ) as MigrationOperationsPlan;

const preview =
  createExecutionPreview(
    snapshot,
    bindings,
    operations,
  );

const report =
  renderExecutionPreview(
    preview,
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
    preview,
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
  '✅ Execution Preview generado.',
);

console.log('');
console.log(
  `Pasos totales: ${preview.summary.totalSteps}`,
);

console.log(
  `Listos:        ${preview.summary.ready}`,
);

console.log(
  `Manuales:      ${preview.summary.manual}`,
);

console.log(
  `Bloqueados:    ${preview.summary.blocked}`,
);

console.log('');
console.log(
  'Ejecución permitida: NO',
);

console.log('');
console.log(
  `Reporte: ${textPath}`,
);

console.log(
  `JSON:    ${jsonPath}`,
);

console.log('');
