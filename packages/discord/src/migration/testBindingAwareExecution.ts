import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  dispatchExecutionOperation,
  isAutomatableOperation,
} from './executionAdapter.js';

import type {
  AutomatableMigrationOperation,
} from './executionAdapterTypes.js';

import {
  FakeDiscordExecutionAdapter,
} from './fakeDiscordExecutionAdapter.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  prepareBindingAwareOperation,
} from './bindingAwareExecution.js';

import {
  SessionBindingRegistry,
} from './sessionBindingRegistry.js';

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

const automatable:
  AutomatableMigrationOperation[] =
  operationsPlan.operations.filter(
    (
      operation,
    ): operation is
      AutomatableMigrationOperation =>
      isAutomatableOperation(
        operation,
      ),
  );

if (
  automatable.length !==
    98
) {
  throw new Error(
    `Se esperaban 98 operaciones automáticas y se encontraron ${automatable.length}.`,
  );
}

const categoryOperations =
  automatable.filter(
    (
      operation,
    ) =>
      operation.type ===
        'create_category',
  );

const channelOperations =
  automatable.filter(
    (
      operation,
    ) =>
      operation.type ===
        'create_channel',
  );

if (
  categoryOperations.length !==
    13
) {
  throw new Error(
    `Se esperaban 13 categorías y se encontraron ${categoryOperations.length}.`,
  );
}

if (
  channelOperations.length !==
    51
) {
  throw new Error(
    `Se esperaban 51 canales y se encontraron ${channelOperations.length}.`,
  );
}

const registry =
  new SessionBindingRegistry(
    bindingFile.guildId,
    bindingFile.resources,
  );

const adapter =
  new FakeDiscordExecutionAdapter();

/*
 * ==================================================
 * PHASE 1: CATEGORIES
 * ==================================================
 */
const categoriesTransaction =
  registry.beginTransaction(
    'phase-categories',
  );

for (
  const operation
  of categoryOperations
) {
  if (
    !operation.blueprintId
  ) {
    throw new Error(
      `Categoría sin blueprintId: ${operation.id}`,
    );
  }

  const prepared =
    prepareBindingAwareOperation(
      operation,
      registry.toResolverBindings(),
    );

  await dispatchExecutionOperation(
    adapter,
    prepared.operation,
  );

  const actualId =
    adapter.snapshot()
      .bindings[
        operation.blueprintId
      ];

  if (
    !actualId
  ) {
    throw new Error(
      `Fake Adapter no produjo binding para ${operation.blueprintId}.`,
    );
  }

  categoriesTransaction.stage(
    operation.blueprintId,
    actualId,
    operation.id,
  );
}

const categoryBindingsInvisibleBeforeCommit =
  categoryOperations.every(
    (operation) =>
      operation.blueprintId &&
      registry.resolve(
        operation.blueprintId,
      ).source ===
        'none',
  );

const categoryStagedCount =
  categoriesTransaction
    .stagedCount;

const categoryCommit =
  categoriesTransaction.commit();

const categoriesCommitted =
  categoryCommit.committed ===
    13 &&
  registry.sessionCount ===
    13 &&
  registry.revision ===
    1;

const adapterAfterCategories =
  adapter.snapshot();

const fakeCategoriesCorrect =
  adapterAfterCategories
    .actions.length ===
      13 &&
  Object.keys(
    adapterAfterCategories.bindings,
  ).length ===
    13;

/*
 * Snapshot del registry después de
 * completar la primera fase.
 */
const categoryRegistrySnapshot =
  registry.snapshot();

/*
 * ==================================================
 * PHASE 2: CHANNELS
 * ==================================================
 */
const channelsTransaction =
  registry.beginTransaction(
    'phase-channels',
  );

let sessionParentCount =
  0;

let operationParentCount =
  0;

let otherParentSourceCount =
  0;

let unresolvedChannels =
  0;

let cdnLatestUsesSession =
  false;

let guideUsesOperation =
  false;

for (
  const operation
  of channelOperations
) {
  if (
    !operation.blueprintId
  ) {
    throw new Error(
      `Canal sin blueprintId: ${operation.id}`,
    );
  }

  let prepared;

  try {
    prepared =
      prepareBindingAwareOperation(
        operation,
        registry.toResolverBindings(),
      );
  } catch {
    unresolvedChannels +=
      1;

    continue;
  }

  switch (
    prepared.request
      .parentActualIdSource
  ) {
    case 'session':
      sessionParentCount +=
        1;
      break;

    case 'operation':
      operationParentCount +=
        1;
      break;

    default:
      otherParentSourceCount +=
        1;
      break;
  }

  if (
    operation.blueprintId ===
      'channel_cdn_latest'
  ) {
    cdnLatestUsesSession =
      prepared.request
        .resolvedParentBlueprintId ===
        'category_cdn_public' &&
      prepared.request
        .parentActualIdSource ===
        'session' &&
      typeof prepared.request
        .resolvedParentActualId ===
        'string';
  }

  if (
    operation.blueprintId ===
      'channel_guide'
  ) {
    guideUsesOperation =
      prepared.request
        .resolvedParentBlueprintId ===
        'category_entry' &&
      prepared.request
        .parentActualIdSource ===
        'operation' &&
      prepared.request
        .resolvedParentActualId ===
        bindingFile.resources[
          'category_entry'
        ];
  }

  await dispatchExecutionOperation(
    adapter,
    prepared.operation,
  );

  const actualId =
    adapter.snapshot()
      .bindings[
        operation.blueprintId
      ];

  if (
    !actualId
  ) {
    throw new Error(
      `Fake Adapter no produjo binding para ${operation.blueprintId}.`,
    );
  }

  channelsTransaction.stage(
    operation.blueprintId,
    actualId,
    operation.id,
  );
}

/*
 * Los bindings de canales todavía no
 * deben ser visibles antes del commit.
 */
const channelBindingsInvisibleBeforeCommit =
  channelOperations.every(
    (operation) =>
      operation.blueprintId &&
      registry.resolve(
        operation.blueprintId,
      ).source ===
        'none',
  );

const channelStagedCount =
  channelsTransaction
    .stagedCount;

const channelCommit =
  channelsTransaction.commit();

const channelsCommitted =
  channelCommit.committed ===
    51 &&
  registry.sessionCount ===
    64 &&
  registry.revision ===
    2;

const finalAdapterSnapshot =
  adapter.snapshot();

const fakeFlowCorrect =
  finalAdapterSnapshot
    .actions.length ===
      64 &&
  finalAdapterSnapshot
    .resources.length ===
      64 &&
  Object.keys(
    finalAdapterSnapshot.bindings,
  ).length ===
    64;

/*
 * Tenemos evidencia previa de que
 * 43 canales dependen de categorías
 * nuevas y los otros 8 ya tenían un
 * parentActualId autorizado en la
 * operación.
 */
const parentSourcesCorrect =
  sessionParentCount ===
    43 &&
  operationParentCount ===
    8 &&
  otherParentSourceCount ===
    0;

const snapshotRestore =
  SessionBindingRegistry.restore(
    categoryRegistrySnapshot,
  );

const phaseBoundaryRestoreCorrect =
  snapshotRestore.revision ===
    1 &&
  snapshotRestore.sessionCount ===
    13 &&
  snapshotRestore.resolve(
    'category_cdn_public',
  ).source ===
    'session' &&
  snapshotRestore.resolve(
    'channel_cdn_latest',
  ).source ===
    'none';

const success =
  categoryBindingsInvisibleBeforeCommit &&
  categoryStagedCount ===
    13 &&
  categoriesCommitted &&
  fakeCategoriesCorrect &&
  unresolvedChannels ===
    0 &&
  channelBindingsInvisibleBeforeCommit &&
  channelStagedCount ===
    51 &&
  channelsCommitted &&
  fakeFlowCorrect &&
  parentSourcesCorrect &&
  cdnLatestUsesSession &&
  guideUsesOperation &&
  phaseBoundaryRestoreCorrect;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  categories: {
    operations:
      categoryOperations.length,

    staged:
      categoryStagedCount,

    invisibleBeforeCommit:
      categoryBindingsInvisibleBeforeCommit,

    committed:
      categoryCommit.committed,

    registryRevision:
      categoryRegistrySnapshot
        .revision,

    adapterActions:
      adapterAfterCategories
        .actions.length,
  },

  channels: {
    operations:
      channelOperations.length,

    unresolved:
      unresolvedChannels,

    staged:
      channelStagedCount,

    invisibleBeforeCommit:
      channelBindingsInvisibleBeforeCommit,

    committed:
      channelCommit.committed,

    parentSources: {
      session:
        sessionParentCount,

      operation:
        operationParentCount,

      other:
        otherParentSourceCount,
    },

    cdnLatestUsesSession,

    guideUsesOperation,
  },

  final: {
    registryRevision:
      registry.revision,

    registrySessionBindings:
      registry.sessionCount,

    adapterActions:
      finalAdapterSnapshot
        .actions.length,

    adapterResources:
      finalAdapterSnapshot
        .resources.length,

    adapterBindings:
      Object.keys(
        finalAdapterSnapshot.bindings,
      ).length,

    phaseBoundaryRestoreCorrect,

    success,
  },

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — BINDING-AWARE PHASE EXECUTION TEST',
  '==============================================',
  '',
  'PHASE: CATEGORIES',
  '-----------------',
  `Operaciones: ${categoryOperations.length}`,
  `Bindings staged: ${categoryStagedCount}`,
  `Invisibles antes del commit: ${categoryBindingsInvisibleBeforeCommit ? 'SÍ' : 'NO'}`,
  `Bindings committeados: ${categoryCommit.committed}`,
  `Registry revision: ${categoryRegistrySnapshot.revision}`,
  '',
  'PHASE: CHANNELS',
  '---------------',
  `Operaciones: ${channelOperations.length}`,
  `Unresolved: ${unresolvedChannels}`,
  `Bindings staged: ${channelStagedCount}`,
  `Bindings committeados: ${channelCommit.committed}`,
  '',
  `Parents desde Session Registry: ${sessionParentCount}`,
  `Parents desde operación autorizada: ${operationParentCount}`,
  `Parents desde otras fuentes: ${otherParentSourceCount}`,
  '',
  `channel_cdn_latest usa Session Binding: ${cdnLatestUsesSession ? 'SÍ' : 'NO'}`,
  `channel_guide conserva parent autorizado: ${guideUsesOperation ? 'SÍ' : 'NO'}`,
  '',
  'RESULTADO FINAL',
  '---------------',
  `Registry revision: ${registry.revision}`,
  `Bindings de sesión: ${registry.sessionCount}`,
  `Fake adapter actions: ${finalAdapterSnapshot.actions.length}`,
  `Fake adapter resources: ${finalAdapterSnapshot.resources.length}`,
  `Fake adapter bindings: ${Object.keys(finalAdapterSnapshot.bindings).length}`,
  `Restore de boundary categories correcto: ${phaseBoundaryRestoreCorrect ? 'SÍ' : 'NO'}`,
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
    'binding-aware-execution-test',
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
    result,
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
  '🧬 Binding-Aware Phase Execution',
);
console.log('');

console.log(
  `Categorías committeadas: ${categoryCommit.committed}`,
);

console.log(
  `Canales resueltos: ${channelOperations.length - unresolvedChannels}/${channelOperations.length}`,
);

console.log('');

console.log(
  `Parents desde Session Registry: ${sessionParentCount}`,
);

console.log(
  `Parents desde operación autorizada: ${operationParentCount}`,
);

console.log('');

console.log(
  `channel_cdn_latest usa Session Binding: ${cdnLatestUsesSession ? 'SÍ' : 'NO'}`,
);

console.log(
  `channel_guide conserva parent autorizado: ${guideUsesOperation ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Bindings finales del Fake Adapter: ${Object.keys(finalAdapterSnapshot.bindings).length}`,
);

console.log(
  `Bindings finales del Registry: ${registry.sessionCount}`,
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
