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
  createHierarchyBootstrapPlan,
} from './hierarchyBootstrap.js';

import {
  renderHierarchyBootstrapPlan,
} from './hierarchyBootstrapReport.js';

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
    'hierarchy-bootstrap',
  );

console.log('');
console.log(
  '👑 Generando Hierarchy Bootstrap Plan...',
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

const plan =
  createHierarchyBootstrapPlan(
    snapshot,
    bindings,
    operations,
  );

const report =
  renderHierarchyBootstrapPlan(
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
  '✅ Hierarchy Bootstrap Plan generado.',
);

console.log('');
console.log(
  `Roles listos:   ${plan.summary.ready}`,
);

console.log(
  `Roles manuales: ${plan.summary.manual}`,
);

console.log(
  `Bloqueos:       ${plan.summary.block}`,
);

console.log('');

console.log(
  `Bootstrap posible: ${
    plan.summary.bootstrapPossible
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
  `Reporte: ${textPath}`,
);

console.log(
  `JSON:    ${jsonPath}`,
);

console.log('');
