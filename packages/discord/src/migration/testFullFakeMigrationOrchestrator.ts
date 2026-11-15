import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  isAutomatableOperation,
} from './executionAdapter.js';

import type {
  MigrationOperation,
} from './executionAdapterTypes.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  runFullFakeMigration,
} from './fullFakeMigrationOrchestrator.js';

interface BindingFile {
  schemaVersion: number;

  guildId: string;

  updatedAt: string;

  resources:
    Record<string, string>;
}

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

const bindingFile =
  await readJson<
    BindingFile
  >(
    '.data',
    'discord-bindings.json',
  );

const operationsPlan =
  await readJson<
    MigrationOperationsPlan
  >(
    '.data',
    'migration-operations',
    'latest.json',
  );

const operations:
  MigrationOperation[] =
  operationsPlan.operations;

const automatable =
  operations.filter(
    isAutomatableOperation,
  );

const manual =
  operations.filter(
    (operation) =>
      !isAutomatableOperation(
        operation,
      ),
  );

const result =
  await runFullFakeMigration({
    guildId:
      bindingFile.guildId,

    confirmedBindings:
      bindingFile.resources,

    operations,
  });

const phaseMap =
  new Map(
    result.phases.map(
      (phase) => [
        phase.phase,
        phase,
      ] as const,
    ),
  );

const roles =
  phaseMap.get(
    'roles',
  );

const categories =
  phaseMap.get(
    'categories',
  );

const renames =
  phaseMap.get(
    'renames',
  );

const channels =
  phaseMap.get(
    'channels',
  );

const moves =
  phaseMap.get(
    'moves',
  );

if (
  !roles ||
  !categories ||
  !renames ||
  !channels ||
  !moves
) {
  throw new Error(
    'Faltan fases del Full Fake Migration.',
  );
}

const phaseCountsCorrect =
  roles.operations ===
    24 &&
  categories.operations ===
    13 &&
  renames.operations ===
    8 &&
  channels.operations ===
    51 &&
  moves.operations ===
    2;

const bindingCommitsCorrect =
  roles.committedBindings ===
    24 &&
  categories.committedBindings ===
    13 &&
  renames.committedBindings ===
    0 &&
  channels.committedBindings ===
    51 &&
  moves.committedBindings ===
    0;

const idempotentExistingBindingsCorrect =
  renames.idempotentBindings ===
    8 &&
  moves.idempotentBindings ===
    2;

const totalsCorrect =
  operations.length ===
    108 &&
  automatable.length ===
    98 &&
  manual.length ===
    10 &&
  result.totalOperations ===
    108 &&
  result.automatableOperations ===
    98 &&
  result.manualReviewOperations ===
    10;

const actionIds =
  result.finalAdapterSnapshot
    .actions
    .map(
      (action) =>
        action.operationId,
    );

const uniqueActionIds =
  new Set(
    actionIds,
  );

const automaticIds =
  new Set(
    automatable.map(
      (operation) =>
        operation.id,
    ),
  );

const allAutomaticExecuted =
  actionIds.length ===
    98 &&
  uniqueActionIds.size ===
    98 &&
  [...automaticIds]
    .every(
      (id) =>
        uniqueActionIds.has(
          id,
        ),
    );

const manualIds =
  new Set(
    manual.map(
      (operation) =>
        operation.id,
    ),
  );

const noManualExecuted =
  actionIds.every(
    (id) =>
      !manualIds.has(
        id,
      ),
  );

const registryCorrect =
  Object.keys(
    result.finalRegistrySnapshot
      .confirmed,
  ).length ===
    13 &&
  Object.keys(
    result.finalRegistrySnapshot
      .session,
  ).length ===
    88 &&
  result.finalRegistrySnapshot
    .revision ===
    3 &&
  result.finalResolverBindingCount ===
    101;

function registryActualId(
  blueprintId: string,
): string | null {
  return (
    result
      .finalRegistrySnapshot
      .session[
        blueprintId
      ]?.actualId ??
    result
      .finalRegistrySnapshot
      .confirmed[
        blueprintId
      ] ??
    null
  );
}

const adapterBindingsConsistent =
  Object.entries(
    result.finalAdapterSnapshot
      .bindings,
  ).every(
    (
      [
        blueprintId,
        actualId,
      ],
    ) =>
      registryActualId(
        blueprintId,
      ) ===
        actualId,
  );

const expectedRevisionProgress =
  roles.registryRevision ===
    1 &&
  categories.registryRevision ===
    2 &&
  renames.registryRevision ===
    2 &&
  channels.registryRevision ===
    3 &&
  moves.registryRevision ===
    3;

const success =
  phaseCountsCorrect &&
  bindingCommitsCorrect &&
  idempotentExistingBindingsCorrect &&
  totalsCorrect &&
  allAutomaticExecuted &&
  noManualExecuted &&
  registryCorrect &&
  adapterBindingsConsistent &&
  expectedRevisionProgress;

const output = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  totals: {
    planned:
      operations.length,

    automatic:
      automatable.length,

    manual:
      manual.length,

    adapterActions:
      result
        .finalAdapterSnapshot
        .actions
        .length,
  },

  phases:
    result.phases,

  checks: {
    phaseCountsCorrect,

    bindingCommitsCorrect,

    idempotentExistingBindingsCorrect,

    totalsCorrect,

    allAutomaticExecuted,

    noManualExecuted,

    registryCorrect,

    adapterBindingsConsistent,

    expectedRevisionProgress,
  },

  final: {
    confirmedBindings:
      Object.keys(
        result
          .finalRegistrySnapshot
          .confirmed,
      ).length,

    sessionBindings:
      Object.keys(
        result
          .finalRegistrySnapshot
          .session,
      ).length,

    resolverBindings:
      result
        .finalResolverBindingCount,

    registryRevision:
      result
        .finalRegistrySnapshot
        .revision,

    adapterActions:
      result
        .finalAdapterSnapshot
        .actions
        .length,

    adapterResources:
      result
        .finalAdapterSnapshot
        .resources
        .length,

    adapterBindings:
      Object.keys(
        result
          .finalAdapterSnapshot
          .bindings,
      ).length,
  },

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — FULL FAKE MIGRATION ORCHESTRATOR TEST',
  '=================================================',
  '',
  'PLAN COMPLETO',
  '-------------',
  `Operaciones totales: ${operations.length}`,
  `Operaciones automáticas: ${automatable.length}`,
  `Revisión manual: ${manual.length}`,
  '',
  'FASES',
  '-----',
  `Roles: ${roles.operations} | bindings nuevos=${roles.committedBindings}`,
  `Categories: ${categories.operations} | bindings nuevos=${categories.committedBindings}`,
  `Renames: ${renames.operations} | idempotentes=${renames.idempotentBindings}`,
  `Channels: ${channels.operations} | bindings nuevos=${channels.committedBindings}`,
  `Moves: ${moves.operations} | idempotentes=${moves.idempotentBindings}`,
  '',
  'SEGURIDAD',
  '---------',
  `98 operaciones automáticas ejecutadas una sola vez: ${allAutomaticExecuted ? 'SÍ' : 'NO'}`,
  `10 operaciones manuales nunca ejecutadas: ${noManualExecuted ? 'SÍ' : 'NO'}`,
  `Bindings adapter/registry consistentes: ${adapterBindingsConsistent ? 'SÍ' : 'NO'}`,
  '',
  'REGISTRY FINAL',
  '--------------',
  `Bindings confirmados: ${Object.keys(result.finalRegistrySnapshot.confirmed).length}`,
  `Bindings de sesión: ${Object.keys(result.finalRegistrySnapshot.session).length}`,
  `Bindings disponibles al resolver: ${result.finalResolverBindingCount}`,
  `Registry revision: ${result.finalRegistrySnapshot.revision}`,
  '',
  'FAKE ADAPTER FINAL',
  '------------------',
  `Actions: ${result.finalAdapterSnapshot.actions.length}`,
  `Resources representados: ${result.finalAdapterSnapshot.resources.length}`,
  `Bindings representados: ${Object.keys(result.finalAdapterSnapshot.bindings).length}`,
  '',
  `Conteos de fases correctos: ${phaseCountsCorrect ? 'SÍ' : 'NO'}`,
  `Commits de bindings correctos: ${bindingCommitsCorrect ? 'SÍ' : 'NO'}`,
  `Revision progression correcta: ${expectedRevisionProgress ? 'SÍ' : 'NO'}`,
  '',
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
  '',
  'ADAPTER: FAKE',
  'CONEXIÓN A DISCORD: NO',
  'MUTACIONES REALES ENVIADAS: 0',
  'EJECUCIÓN REAL PERMITIDA: NO',
  '',
].join(
  '\n',
);

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'full-fake-migration-test',
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
    output,
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
  '🏗️ Full Fake Migration Orchestrator',
);
console.log('');

console.log(
  `Plan: ${operations.length}`,
);

console.log(
  `Automáticas: ${automatable.length}`,
);

console.log(
  `Manual review: ${manual.length}`,
);

console.log('');

console.log(
  `Roles: ${roles.operations}`,
);

console.log(
  `Categories: ${categories.operations}`,
);

console.log(
  `Renames: ${renames.operations}`,
);

console.log(
  `Channels: ${channels.operations}`,
);

console.log(
  `Moves: ${moves.operations}`,
);

console.log('');

console.log(
  `Adapter actions: ${result.finalAdapterSnapshot.actions.length}`,
);

console.log(
  `Session bindings: ${Object.keys(result.finalRegistrySnapshot.session).length}`,
);

console.log(
  `Resolver bindings totales: ${result.finalResolverBindingCount}`,
);

console.log('');

console.log(
  `Manual operations ejecutadas: ${noManualExecuted ? 0 : 'ERROR'}`,
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
