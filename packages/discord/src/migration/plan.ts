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
  createMigrationPlan,
} from './planner.js';

import {
  renderMigrationPlan,
} from './report.js';

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
    'migration-plans',
  );

console.log('');
console.log(
  '🧭 Generando Migration Plan...',
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
  createMigrationPlan(
    snapshot,
    bindings,
  );

const report =
  renderMigrationPlan(
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
  '✅ Migration Plan generado.',
);

console.log('');
console.log(
  `Bindings confirmados: ${plan.summary.bound}`,
);

console.log(
  `Bindings sugeridos:   ${plan.summary.suggestedBindings}`,
);

console.log(
  `Crear:                ${plan.summary.create}`,
);

console.log(
  `Revisión manual:      ${plan.summary.review}`,
);

console.log(
  `Sin administrar:      ${plan.summary.unmanaged}`,
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
