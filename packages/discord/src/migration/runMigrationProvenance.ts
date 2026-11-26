import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordBlueprintArtifact,
} from '../blueprint/artifact.js';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  DiscordBindings,
  MigrationPlan,
} from './types.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import {
  createMigrationProvenance,
} from './migrationProvenance.js';

async function readJson<T>(
  filePath: string,
): Promise<T> {
  return JSON.parse(
    await readFile(
      filePath,
      'utf8',
    ),
  ) as T;
}

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const blueprintPath =
  path.join(
    projectRoot,
    '.data',
    'discord-blueprint',
    'latest.json',
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

const planPath =
  path.join(
    projectRoot,
    '.data',
    'migration-plans',
    'latest.json',
  );

const operationsPath =
  path.join(
    projectRoot,
    '.data',
    'migration-operations',
    'latest.json',
  );

const previewPath =
  path.join(
    projectRoot,
    '.data',
    'execution-preview',
    'latest.json',
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'migration-provenance',
  );

console.log('');
console.log(
  'Generando Migration Provenance v1...',
);

const [
  blueprint,
  snapshot,
  bindings,
  plan,
  operations,
  preview,
] =
  await Promise.all([
    readJson<
      DiscordBlueprintArtifact
    >(
      blueprintPath,
    ),

    readJson<
      DiscordGuildSnapshot
    >(
      snapshotPath,
    ),

    readJson<
      DiscordBindings
    >(
      bindingsPath,
    ),

    readJson<
      MigrationPlan
    >(
      planPath,
    ),

    readJson<
      MigrationOperationsPlan
    >(
      operationsPath,
    ),

    readJson<
      DiscordExecutionPreview
    >(
      previewPath,
    ),
  ]);

const provenance =
  createMigrationProvenance({
    blueprint,
    snapshot,
    bindings,
    plan,
    operations,
    preview,
  });

await mkdir(
  outputDirectory,
  {
    recursive:
      true,
  },
);

const outputPath =
  path.join(
    outputDirectory,
    'latest.json',
  );

await writeFile(
  outputPath,
  JSON.stringify(
    provenance,
    null,
    2,
  ) + '\n',
  'utf8',
);

console.log('');
console.log(
  `Guild: ${provenance.guildId}`,
);

console.log(
  `Lineage fingerprint: ${provenance.lineageFingerprint}`,
);

console.log(
  `Checks PASS: ${provenance.summary.pass}`,
);

console.log(
  `Checks BLOCK: ${provenance.summary.block}`,
);

console.log(
  `Provenance válido: ${provenance.summary.valid ? 'SÍ' : 'NO'}`,
);

console.log('');
console.log(
  `JSON: ${outputPath}`,
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
  !provenance.summary.valid
) {
  process.exitCode =
    2;
}
