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

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

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
  createMigrationGate,
} from './migrationGate.js';

import {
  renderMigrationGate,
} from './migrationGateReport.js';

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

async function readJson<T>(
  ...segments: string[]
): Promise<T> {
  const filePath =
    path.join(
      projectRoot,
      ...segments,
    );

  return JSON.parse(
    await readFile(
      filePath,
      'utf8',
    ),
  ) as T;
}

console.log('');
console.log(
  '🚧 Evaluando Migration Gate...',
);

const snapshot =
  await readJson<DiscordGuildSnapshot>(
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
  await readJson<MigrationOperationsPlan>(
    '.data',
    'migration-operations',
    'latest.json',
  );

const executionPreview =
  await readJson<DiscordExecutionPreview>(
    '.data',
    'execution-preview',
    'latest.json',
  );

const preflight =
  await readJson<DiscordMigrationPreflight>(
    '.data',
    'migration-preflight',
    'latest.json',
  );

const hierarchy =
  await readJson<HierarchyBootstrapPlan>(
    '.data',
    'hierarchy-bootstrap',
    'latest.json',
  );

const gate =
  createMigrationGate({
    snapshot,
    bindings,
    operations,
    executionPreview,
    preflight,
    hierarchy,
  });

const report =
  renderMigrationGate(
    gate,
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'migration-gate',
  );

await mkdir(
  outputDirectory,
  {
    recursive: true,
  },
);

await writeFile(
  path.join(
    outputDirectory,
    'latest.json',
  ),
  JSON.stringify(
    gate,
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
  '✅ Migration Gate evaluado.',
);

console.log('');
console.log(
  `PASS:  ${gate.summary.pass}`,
);

console.log(
  `WARN:  ${gate.summary.warn}`,
);

console.log(
  `BLOCK: ${gate.summary.block}`,
);

console.log('');

console.log(
  `Snapshot: ${gate.snapshot.ageMinutes} minutos`,
);

console.log('');

console.log(
  `Listo para confirmación explícita: ${
    gate.summary.readyForExplicitConfirmation
      ? 'SÍ'
      : 'NO'
  }`,
);

console.log('');

console.log(
  `Fingerprint: ${gate.fingerprint}`,
);

console.log('');

console.log(
  'Ejecución permitida: NO',
);

console.log('');
