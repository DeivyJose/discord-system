import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import {
  loadDiscordBindings,
} from './bindings.js';

import {
  createMigrationOperationsPlan,
} from './operationsPlanner.js';

import {
  renderMigrationOperationsPlan,
} from './operationsReport.js';

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

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'migration-operations',
  );

console.log('');
console.log(
  '🧩 Generando plan de operaciones...',
);

const snapshotRaw =
  await readFile(
    snapshotPath,
    'utf8',
  );

const snapshot =
  JSON.parse(
    snapshotRaw,
  ) as DiscordGuildSnapshot;

const bindings =
  await loadDiscordBindings(
    bindingsPath,
    snapshot.guild.id,
  );

const plan =
  createMigrationOperationsPlan(
    snapshot,
    bindings,
  );

const report =
  renderMigrationOperationsPlan(
    plan,
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
    plan,
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
  '✅ Plan de operaciones generado.',
);

console.log('');
console.log(
  `Operaciones totales:  ${plan.summary.total}`,
);

console.log(
  `Crear categorías:     ${plan.summary.createCategories}`,
);

console.log(
  `Crear canales:        ${plan.summary.createChannels}`,
);

console.log(
  `Crear roles:          ${plan.summary.createRoles}`,
);

console.log(
  `Renombrar categorías: ${plan.summary.renameCategories}`,
);

console.log(
  `Renombrar canales:    ${plan.summary.renameChannels}`,
);

console.log(
  `Renombrar roles:      ${plan.summary.renameRoles}`,
);

console.log(
  `Mover canales:        ${plan.summary.moveChannels}`,
);

console.log(
  `Roles managed revisar: ${plan.summary.reviewManagedRoles}`,
);

console.log(
  `Bindings a revisar:   ${plan.summary.reviewBindings}`,
);

console.log(
  `Legacy a revisar:     ${plan.summary.reviewLegacy}`,
);

console.log('');
console.log(
  `Reporte: ${textPath}`,
);

console.log(
  `JSON:    ${jsonPath}`,
);

console.log('');
console.log(
  'ℹ️ No se realizó ninguna modificación en Discord.',
);

console.log('');
