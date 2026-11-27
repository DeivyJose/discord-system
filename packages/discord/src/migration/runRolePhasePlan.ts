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
  HierarchyBootstrapPlan,
} from './hierarchyBootstrapTypes.js';

import type {
  MigrationProvenanceArtifact,
} from './migrationProvenanceTypes.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  createRolePhasePlan,
  renderRolePhasePlan,
  verifyRolePhasePlan,
} from './rolePhasePlan.js';

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

const dataRoot =
  path.join(
    projectRoot,
    '.data',
  );

const blueprintPath =
  path.join(
    dataRoot,
    'discord-blueprint',
    'latest.json',
  );

const operationsPath =
  path.join(
    dataRoot,
    'migration-operations',
    'latest.json',
  );

const hierarchyPath =
  path.join(
    dataRoot,
    'hierarchy-bootstrap',
    'latest.json',
  );

const provenancePath =
  path.join(
    dataRoot,
    'migration-provenance',
    'latest.json',
  );

const [
  blueprint,
  operations,
  hierarchy,
  provenance,
] =
  await Promise.all([
    readJson<
      DiscordBlueprintArtifact
    >(
      blueprintPath,
    ),

    readJson<
      MigrationOperationsPlan
    >(
      operationsPath,
    ),

    readJson<
      HierarchyBootstrapPlan
    >(
      hierarchyPath,
    ),

    readJson<
      MigrationProvenanceArtifact
    >(
      provenancePath,
    ),
  ]);

const plan =
  createRolePhasePlan({
    blueprint,
    operations,
    hierarchy,
    provenance,
  });

const verification =
  verifyRolePhasePlan(
    plan,
    {
      blueprint,
      operations,
      hierarchy,
      provenance,
    },
  );

const outputDirectory =
  path.join(
    dataRoot,
    'role-phase-plan',
  );

await mkdir(
  outputDirectory,
  {
    recursive:
      true,
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
  renderRolePhasePlan(
    plan,
  ),
  'utf8',
);

console.log('');
console.log(
  'Role Phase Plan v1',
);
console.log('');

console.log(
  `Guild: ${plan.guildId}`,
);

console.log(
  `CREATE_ROLE: ${plan.summary.totalCreateRoles}`,
);

console.log(
  `Automatic:   ${plan.summary.automaticRoles}`,
);

console.log(
  `Manual:      ${plan.summary.manualRoles}`,
);

console.log(
  `Block:       ${plan.summary.blockedRoles}`,
);

console.log(
  `Checks PASS: ${plan.summary.pass}`,
);

console.log(
  `Checks BLOCK: ${plan.summary.block}`,
);

console.log(
  `Fingerprint: ${plan.planFingerprint}`,
);

console.log('');

console.log(
  `Plan válido: ${plan.summary.valid ? 'SÍ' : 'NO'}`,
);

console.log(
  `Verificación: ${verification.summary.valid ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  'CONTINUACIÓN AUTOMÁTICA: NO',
);

console.log(
  'EJECUCIÓN PERMITIDA: NO',
);

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'MUTACIONES DISCORD: 0',
);

console.log('');

console.log(
  `JSON: ${jsonPath}`,
);

console.log(
  `TXT:  ${textPath}`,
);

console.log('');

if (
  !plan.summary.valid ||
  !verification.summary.valid
) {
  process.exitCode =
    2;
}
