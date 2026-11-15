import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  compileDiscordMutationRequest,
} from './discordMutationRequest.js';

import {
  resolveDiscordMutationRequest,
} from './discordMutationResolver.js';

import {
  isAutomatableOperation,
} from './executionAdapter.js';

import type {
  AutomatableMigrationOperation,
} from './executionAdapterTypes.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  SessionBindingRegistry,
  SessionBindingRegistryError,
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

const operations =
  await readJson<
    MigrationOperationsPlan
  >(
    '.data',
    'migration-operations',
    'latest.json',
  );

const automatable:
  AutomatableMigrationOperation[] =
  operations.operations.filter(
    (
      operation,
    ): operation is
      AutomatableMigrationOperation =>
      isAutomatableOperation(
        operation,
      ),
  );

const registry =
  new SessionBindingRegistry(
    bindingFile.guildId,
    bindingFile.resources,
  );

const initialConfirmed =
  registry.confirmedCount ===
    13;

const existingCategory =
  registry.resolve(
    'category_entry',
  );

const existingBindingCorrect =
  existingCategory.actualId ===
    bindingFile.resources[
      'category_entry'
    ] &&
  existingCategory.source ===
    'confirmed';

/*
 * TEST 1:
 * staged no se vuelve visible antes
 * del commit.
 */
const transaction =
  registry.beginTransaction(
    'tx-categories-1',
  );

const categoryActualId =
  'fake_category_cdn_public';

const stageResult =
  transaction.stage(
    'category_cdn_public',
    categoryActualId,
    'create_category:category_cdn_public',
    new Date(
      '2026-11-15T04:00:00.000Z',
    ),
  );

const invisibleBeforeCommit =
  registry.resolve(
    'category_cdn_public',
  ).source ===
    'none';

const visibleInsideTransaction =
  transaction.resolve(
    'category_cdn_public',
  ).actualId ===
    categoryActualId &&
  transaction.resolve(
    'category_cdn_public',
  ).source ===
    'staged';

const commitResult =
  transaction.commit();

const visibleAfterCommit =
  registry.resolve(
    'category_cdn_public',
  ).actualId ===
    categoryActualId &&
  registry.resolve(
    'category_cdn_public',
  ).source ===
    'session' &&
  commitResult.committed ===
    1 &&
  registry.revision ===
    1;

/*
 * TEST 2:
 * Mutation Resolver consume el
 * binding producido por la sesión.
 */
const cdnOperation =
  automatable.find(
    (operation) =>
      operation.blueprintId ===
      'channel_cdn_latest',
  );

if (
  !cdnOperation
) {
  throw new Error(
    'No se encontró channel_cdn_latest.',
  );
}

const cdnResolved =
  resolveDiscordMutationRequest(
    compileDiscordMutationRequest(
      cdnOperation,
    ),
    registry.toResolverBindings(),
  );

const resolverConsumesRegistry =
  cdnResolved.ready &&
  cdnResolved.request
    .resolvedParentActualId ===
      categoryActualId &&
  cdnResolved.request
    .parentActualIdSource ===
      'session';

/*
 * TEST 3:
 * mismo blueprint + mismo ID =
 * idempotente.
 */
const idempotentTx =
  registry.beginTransaction(
    'tx-idempotent',
  );

const idempotentResult =
  idempotentTx.stage(
    'category_cdn_public',
    categoryActualId,
    'create_category:category_cdn_public',
  );

const idempotentCommit =
  idempotentTx.commit();

const idempotencyCorrect =
  idempotentResult ===
    'idempotent' &&
  idempotentCommit.committed ===
    0 &&
  registry.revision ===
    1;

/*
 * TEST 4:
 * mismo blueprint + ID distinto =
 * conflicto.
 */
let blueprintConflict =
  false;

const conflictTx =
  registry.beginTransaction(
    'tx-blueprint-conflict',
  );

try {
  conflictTx.stage(
    'category_cdn_public',
    'fake_DIFFERENT',
    'conflict-operation',
  );
} catch (
  error
) {
  blueprintConflict =
    error instanceof
      SessionBindingRegistryError &&
    error.code ===
      'BLUEPRINT_CONFLICT';
}

conflictTx.rollback();

/*
 * TEST 5:
 * mismo Discord actualId no puede
 * pertenecer a dos blueprint IDs.
 */
let actualIdConflict =
  false;

const actualConflictTx =
  registry.beginTransaction(
    'tx-actual-conflict',
  );

try {
  actualConflictTx.stage(
    'category_support',
    categoryActualId,
    'conflict-operation',
  );
} catch (
  error
) {
  actualIdConflict =
    error instanceof
      SessionBindingRegistryError &&
    error.code ===
      'ACTUAL_ID_CONFLICT';
}

actualConflictTx.rollback();

/*
 * TEST 6:
 * rollback no modifica registry.
 */
const rollbackTx =
  registry.beginTransaction(
    'tx-rollback',
  );

rollbackTx.stage(
  'category_support',
  'fake_category_support',
  'create_category:category_support',
);

rollbackTx.rollback();

const rollbackCorrect =
  registry.resolve(
    'category_support',
  ).source ===
    'none' &&
  registry.sessionCount ===
    1 &&
  registry.revision ===
    1;

/*
 * TEST 7:
 * snapshot + restore.
 */
const snapshot =
  registry.snapshot();

const restored =
  SessionBindingRegistry.restore(
    snapshot,
  );

const restoreCorrect =
  restored.guildId ===
    registry.guildId &&
  restored.revision ===
    registry.revision &&
  restored.confirmedCount ===
    registry.confirmedCount &&
  restored.sessionCount ===
    registry.sessionCount &&
  restored.resolve(
    'category_cdn_public',
  ).actualId ===
    categoryActualId;

/*
 * TEST 8:
 * optimistic concurrency.
 *
 * Dos transactions salen de la misma
 * revision. La segunda no puede hacer
 * commit después de que la primera
 * cambió el registry.
 */
const firstConcurrent =
  registry.beginTransaction(
    'tx-concurrent-a',
  );

const secondConcurrent =
  registry.beginTransaction(
    'tx-concurrent-b',
  );

firstConcurrent.stage(
  'category_support',
  'fake_category_support',
  'create_category:category_support',
);

secondConcurrent.stage(
  'category_campus',
  'fake_category_campus',
  'create_category:category_campus',
);

const firstConcurrentCommit =
  firstConcurrent.commit();

let revisionConflict =
  false;

try {
  secondConcurrent.commit();
} catch (
  error
) {
  revisionConflict =
    error instanceof
      SessionBindingRegistryError &&
    error.code ===
      'REVISION_CONFLICT';
}

const noPartialConcurrentWrite =
  registry.resolve(
    'category_support',
  ).actualId ===
    'fake_category_support' &&
  registry.resolve(
    'category_campus',
  ).source ===
    'none' &&
  firstConcurrentCommit.committed ===
    1;

/*
 * Resultado.
 */
const success =
  initialConfirmed &&
  existingBindingCorrect &&
  stageResult ===
    'added' &&
  invisibleBeforeCommit &&
  visibleInsideTransaction &&
  visibleAfterCommit &&
  resolverConsumesRegistry &&
  idempotencyCorrect &&
  blueprintConflict &&
  actualIdConflict &&
  rollbackCorrect &&
  restoreCorrect &&
  revisionConflict &&
  noPartialConcurrentWrite;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  checks: {
    initialConfirmed,

    existingBindingCorrect,

    invisibleBeforeCommit,

    visibleInsideTransaction,

    visibleAfterCommit,

    resolverConsumesRegistry,

    idempotencyCorrect,

    blueprintConflict,

    actualIdConflict,

    rollbackCorrect,

    restoreCorrect,

    revisionConflict,

    noPartialConcurrentWrite,
  },

  summary: {
    confirmed:
      registry.confirmedCount,

    session:
      registry.sessionCount,

    revision:
      registry.revision,

    success,
  },

  snapshot:
    registry.snapshot(),

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — SESSION BINDING REGISTRY TEST',
  '=========================================',
  '',
  `Bindings confirmados iniciales: ${bindingFile.resources ? Object.keys(bindingFile.resources).length : 0}`,
  `Binding staged invisible antes de commit: ${invisibleBeforeCommit ? 'SÍ' : 'NO'}`,
  `Binding visible dentro de transaction: ${visibleInsideTransaction ? 'SÍ' : 'NO'}`,
  `Binding visible después de commit: ${visibleAfterCommit ? 'SÍ' : 'NO'}`,
  '',
  `Resolver consume binding de sesión: ${resolverConsumesRegistry ? 'SÍ' : 'NO'}`,
  `Registro idempotente: ${idempotencyCorrect ? 'SÍ' : 'NO'}`,
  `Conflicto de blueprint bloqueado: ${blueprintConflict ? 'SÍ' : 'NO'}`,
  `Conflicto de actualId bloqueado: ${actualIdConflict ? 'SÍ' : 'NO'}`,
  `Rollback correcto: ${rollbackCorrect ? 'SÍ' : 'NO'}`,
  `Snapshot/restore correcto: ${restoreCorrect ? 'SÍ' : 'NO'}`,
  `Revision conflict bloqueado: ${revisionConflict ? 'SÍ' : 'NO'}`,
  `Sin escritura parcial concurrente: ${noPartialConcurrentWrite ? 'SÍ' : 'NO'}`,
  '',
  `Revision final: ${registry.revision}`,
  `Bindings de sesión finales: ${registry.sessionCount}`,
  '',
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
  '',
  'CONEXIÓN A DISCORD: NO',
  'MUTACIONES ENVIADAS: 0',
  'EJECUCIÓN REAL PERMITIDA: NO',
  '',
].join(
  '\n',
);

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'session-binding-registry-test',
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
  '🔗 Session Binding Registry',
);
console.log('');

console.log(
  `Binding staged invisible antes de commit: ${invisibleBeforeCommit ? 'SÍ' : 'NO'}`,
);

console.log(
  `Binding visible después de commit: ${visibleAfterCommit ? 'SÍ' : 'NO'}`,
);

console.log(
  `Resolver consume binding de sesión: ${resolverConsumesRegistry ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Registro idempotente: ${idempotencyCorrect ? 'SÍ' : 'NO'}`,
);

console.log(
  `Conflicto de blueprint bloqueado: ${blueprintConflict ? 'SÍ' : 'NO'}`,
);

console.log(
  `Conflicto de actualId bloqueado: ${actualIdConflict ? 'SÍ' : 'NO'}`,
);

console.log(
  `Rollback correcto: ${rollbackCorrect ? 'SÍ' : 'NO'}`,
);

console.log(
  `Snapshot/restore correcto: ${restoreCorrect ? 'SÍ' : 'NO'}`,
);

console.log(
  `Revision conflict bloqueado: ${revisionConflict ? 'SÍ' : 'NO'}`,
);

console.log(
  `Sin escritura parcial concurrente: ${noPartialConcurrentWrite ? 'SÍ' : 'NO'}`,
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
  'MUTACIONES ENVIADAS: 0',
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
