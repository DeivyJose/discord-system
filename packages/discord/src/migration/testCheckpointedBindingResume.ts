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

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

import {
  prepareBindingAwareOperation,
} from './bindingAwareExecution.js';

import {
  FakeDiscordExecutionAdapter,
} from './fakeDiscordExecutionAdapter.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  SessionBindingRegistry,
} from './sessionBindingRegistry.js';

import {
  resumeCheckpointedBindingPhase,
  runCheckpointedBindingPhase,
  verifyBindingAwareCheckpoint,
} from './checkpointedBindingResume.js';

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

const categoryOperations =
  automatable.filter(
    (operation) =>
      operation.type ===
      'create_category',
  );

const channelOperations =
  automatable.filter(
    (operation) =>
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

/*
 * ============================================
 * BOOTSTRAP DE CATEGORIES
 * ============================================
 */
const registry =
  new SessionBindingRegistry(
    bindingFile.guildId,
    bindingFile.resources,
  );

const categoryAdapter =
  new FakeDiscordExecutionAdapter();

const categoryTransaction =
  registry.beginTransaction(
    'bootstrap-categories',
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

  const action =
    await dispatchExecutionOperation(
      categoryAdapter,
      prepared.operation,
    );

  if (
    !action.actualId
  ) {
    throw new Error(
      `Categoría sin actualId: ${operation.id}`,
    );
  }

  categoryTransaction.stage(
    operation.blueprintId,
    action.actualId,
    operation.id,
  );
}

const categoryCommit =
  categoryTransaction.commit();

if (
  categoryCommit.committed !==
    13
) {
  throw new Error(
    `Bootstrap esperaba 13 bindings y obtuvo ${categoryCommit.committed}.`,
  );
}

const categorySnapshot =
  categoryAdapter.snapshot();

/*
 * Para el journal de channels conservamos
 * resources + bindings de categorías, pero
 * reiniciamos el historial de actions.
 *
 * Esto hace que la lineage del journal sea
 * específica de la fase channels.
 */
const channelAdapterSeed =
  structuredClone(
    categorySnapshot,
  );

channelAdapterSeed.actions =
  [];

const channelAdapter =
  new FakeDiscordExecutionAdapter(
    channelAdapterSeed,
  );

const context:
  CheckpointIntegrityContext = {
    guildId:
      bindingFile.guildId,

    sessionId:
      'test-checkpointed-binding-session',

    gateFingerprint:
      'checkpointed-binding-test-gate',

    phase:
      'channels',

    operationIds:
      channelOperations.map(
        (operation) =>
          operation.id,
      ),
  };

/*
 * ============================================
 * PRIMER RUN:
 * fallo artificial en channel #10
 * ============================================
 */
const failureIndex =
  9;

const stopped =
  await runCheckpointedBindingPhase(
    {
      context,

      operations:
        channelOperations,

      adapter:
        channelAdapter,

      registry,

      beforeOperation: ({
        index,
      }) => {
        if (
          index ===
            failureIndex
        ) {
          throw new Error(
            'Synthetic channel failure.',
          );
        }
      },
    },
  );

const stoppedVerification =
  verifyBindingAwareCheckpoint(
    stopped.sealedCheckpoint,
    context,
  );

const stoppedCorrect =
  stopped.journal.status ===
    'stopped_on_error' &&
  stopped.journal.checkpoint
    .nextOperationIndex ===
    failureIndex &&
  stopped.journal.checkpoint
    .failedOperationId ===
    channelOperations[
      failureIndex
    ]?.id &&
  stopped.bindingCommit
    .committed ===
    9 &&
  stopped.finalAdapterSnapshot
    .actions.length ===
    9 &&
  stopped.finalAdapterSnapshot
    .resources.length ===
    22 &&
  Object.keys(
    stopped.finalAdapterSnapshot
      .bindings,
  ).length ===
    22 &&
  stopped.finalRegistrySnapshot
    .revision ===
    2 &&
  Object.keys(
    stopped.finalRegistrySnapshot
      .session,
  ).length ===
    22 &&
  stoppedVerification.status ===
    'valid';

/*
 * ============================================
 * ATAQUE 1:
 * alterar Binding Registry snapshot
 * ============================================
 */
const tampered =
  structuredClone(
    stopped.sealedCheckpoint,
  );

const tamperedCategory =
  tampered
    .bindingRegistrySnapshot
    .session[
      'category_cdn_public'
    ];

if (
  !tamperedCategory
) {
  throw new Error(
    'No existe category_cdn_public en el checkpoint.',
  );
}

tamperedCategory.actualId =
  `${tamperedCategory.actualId}_TAMPERED`;

let tamperedAdapterFactoryCalls =
  0;

let tamperedRegistryFactoryCalls =
  0;

const tamperedResume =
  await resumeCheckpointedBindingPhase({
    sealedCheckpoint:
      tampered,

    expectedContext:
      context,

    operations:
      channelOperations,

    adapterFactory:
      (snapshot) => {
        tamperedAdapterFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },

    registryFactory:
      (snapshot) => {
        tamperedRegistryFactoryCalls +=
          1;

        return SessionBindingRegistry.restore(
          snapshot,
        );
      },
  });

const tamperedBlocked =
  tamperedResume.status ===
    'blocked' &&
  tamperedResume.blockReason ===
    'checkpoint_integrity_failed' &&
  tamperedAdapterFactoryCalls ===
    0 &&
  tamperedRegistryFactoryCalls ===
    0;

/*
 * ============================================
 * ATAQUE 2:
 * otra Execution Session
 * ============================================
 */
let wrongSessionAdapterFactoryCalls =
  0;

let wrongSessionRegistryFactoryCalls =
  0;

const wrongSessionContext:
  CheckpointIntegrityContext = {
    ...context,

    sessionId:
      'otra-session',
  };

const wrongSessionResume =
  await resumeCheckpointedBindingPhase({
    sealedCheckpoint:
      stopped.sealedCheckpoint,

    expectedContext:
      wrongSessionContext,

    operations:
      channelOperations,

    adapterFactory:
      (snapshot) => {
        wrongSessionAdapterFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },

    registryFactory:
      (snapshot) => {
        wrongSessionRegistryFactoryCalls +=
          1;

        return SessionBindingRegistry.restore(
          snapshot,
        );
      },
  });

const wrongSessionBlocked =
  wrongSessionResume.status ===
    'blocked' &&
  wrongSessionAdapterFactoryCalls ===
    0 &&
  wrongSessionRegistryFactoryCalls ===
    0;

/*
 * ============================================
 * ATAQUE 3:
 * cambiar orden de operaciones
 * ============================================
 */
const changedOperations = [
  ...channelOperations,
];

const first =
  changedOperations[0];

const second =
  changedOperations[1];

if (
  !first ||
  !second
) {
  throw new Error(
    'No hay suficientes operaciones para probar cambio de orden.',
  );
}

changedOperations[0] =
  second;

changedOperations[1] =
  first;

let changedAdapterFactoryCalls =
  0;

let changedRegistryFactoryCalls =
  0;

const changedResume =
  await resumeCheckpointedBindingPhase({
    sealedCheckpoint:
      stopped.sealedCheckpoint,

    expectedContext:
      context,

    operations:
      changedOperations,

    adapterFactory:
      (snapshot) => {
        changedAdapterFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },

    registryFactory:
      (snapshot) => {
        changedRegistryFactoryCalls +=
          1;

        return SessionBindingRegistry.restore(
          snapshot,
        );
      },
  });

const changedOperationsBlocked =
  changedResume.status ===
    'blocked' &&
  changedResume.blockReason ===
    'operation_sequence_mismatch' &&
  changedAdapterFactoryCalls ===
    0 &&
  changedRegistryFactoryCalls ===
    0;

/*
 * ============================================
 * RESUME VÁLIDO
 * ============================================
 */
let validAdapterFactoryCalls =
  0;

let validRegistryFactoryCalls =
  0;

const validResume =
  await resumeCheckpointedBindingPhase({
    sealedCheckpoint:
      stopped.sealedCheckpoint,

    expectedContext:
      context,

    operations:
      channelOperations,

    adapterFactory:
      (snapshot) => {
        validAdapterFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },

    registryFactory:
      (snapshot) => {
        validRegistryFactoryCalls +=
          1;

        return SessionBindingRegistry.restore(
          snapshot,
        );
      },
  });

const finalAdapter =
  validResume
    .finalAdapterSnapshot;

const finalRegistry =
  validResume
    .finalRegistrySnapshot;

if (
  !finalAdapter ||
  !finalRegistry ||
  !validResume.sealedCheckpoint
) {
  throw new Error(
    'Resume válido no produjo estado final.',
  );
}

const finalCategories =
  finalAdapter.resources.filter(
    (resource) =>
      resource.resourceKind ===
      'category',
  ).length;

const finalChannels =
  finalAdapter.resources.filter(
    (resource) =>
      resource.resourceKind ===
      'channel',
  ).length;

const uniqueResources =
  new Set(
    finalAdapter.resources.map(
      (resource) =>
        resource.actualId,
    ),
  ).size;

const uniqueChannelActions =
  new Set(
    finalAdapter.actions.map(
      (action) =>
        action.operationId,
    ),
  ).size;

const finalVerification =
  verifyBindingAwareCheckpoint(
    validResume.sealedCheckpoint,
    context,
  );

const validResumeCorrect =
  validResume.status ===
    'completed' &&
  validResume.adapterRestored &&
  validResume.registryRestored &&
  validAdapterFactoryCalls ===
    1 &&
  validRegistryFactoryCalls ===
    1 &&
  validResume.bindingCommit
    ?.committed ===
    42 &&
  finalAdapter.actions.length ===
    51 &&
  finalAdapter.resources.length ===
    64 &&
  Object.keys(
    finalAdapter.bindings,
  ).length ===
    64 &&
  finalRegistry.revision ===
    3 &&
  Object.keys(
    finalRegistry.session,
  ).length ===
    64 &&
  finalCategories ===
    13 &&
  finalChannels ===
    51 &&
  uniqueResources ===
    64 &&
  uniqueChannelActions ===
    51 &&
  finalVerification.status ===
    'valid';

/*
 * ============================================
 * RESULTADO
 * ============================================
 */
const success =
  stoppedCorrect &&
  tamperedBlocked &&
  wrongSessionBlocked &&
  changedOperationsBlocked &&
  validResumeCorrect;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  stopped: {
    success:
      stoppedCorrect,

    failedIndex:
      stopped.journal
        .checkpoint
        .nextOperationIndex,

    failedOperationId:
      stopped.journal
        .checkpoint
        .failedOperationId,

    successfulChannels:
      stopped.journal
        .summary
        .succeeded,

    adapterActions:
      stopped
        .finalAdapterSnapshot
        .actions
        .length,

    registrySessionBindings:
      Object.keys(
        stopped
          .finalRegistrySnapshot
          .session,
      ).length,

    verification:
      stoppedVerification.status,
  },

  attacks: {
    tamperedRegistry: {
      blocked:
        tamperedBlocked,

      adapterFactoryCalls:
        tamperedAdapterFactoryCalls,

      registryFactoryCalls:
        tamperedRegistryFactoryCalls,
    },

    wrongSession: {
      blocked:
        wrongSessionBlocked,

      adapterFactoryCalls:
        wrongSessionAdapterFactoryCalls,

      registryFactoryCalls:
        wrongSessionRegistryFactoryCalls,
    },

    changedOperations: {
      blocked:
        changedOperationsBlocked,

      adapterFactoryCalls:
        changedAdapterFactoryCalls,

      registryFactoryCalls:
        changedRegistryFactoryCalls,
    },
  },

  resume: {
    success:
      validResumeCorrect,

    status:
      validResume.status,

    adapterFactoryCalls:
      validAdapterFactoryCalls,

    registryFactoryCalls:
      validRegistryFactoryCalls,

    resumedSuccessfulOperations:
      validResume.journal
        ?.summary
        .succeeded ??
      null,

    bindingsCommittedOnResume:
      validResume.bindingCommit
        ?.committed ??
      null,

    finalCategories,

    finalChannels,

    finalResources:
      finalAdapter
        .resources
        .length,

    finalAdapterBindings:
      Object.keys(
        finalAdapter.bindings,
      ).length,

    finalRegistryBindings:
      Object.keys(
        finalRegistry.session,
      ).length,

    finalRegistryRevision:
      finalRegistry.revision,

    uniqueResources,

    uniqueChannelActions,

    finalVerification:
      finalVerification.status,
  },

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — CHECKPOINTED BINDING-AWARE RESUME TEST',
  '==================================================',
  '',
  'STOP ARTIFICIAL',
  '---------------',
  `STOP correcto: ${stoppedCorrect ? 'SÍ' : 'NO'}`,
  `Índice fallido: ${stopped.journal.checkpoint.nextOperationIndex}`,
  `Canales exitosos antes del STOP: ${stopped.journal.summary.succeeded}`,
  `Adapter actions antes del STOP: ${stopped.finalAdapterSnapshot.actions.length}`,
  `Registry bindings antes del resume: ${Object.keys(stopped.finalRegistrySnapshot.session).length}`,
  '',
  'ATAQUES',
  '-------',
  `Registry manipulado bloqueado: ${tamperedBlocked ? 'SÍ' : 'NO'}`,
  `Factories tras manipulación: adapter=${tamperedAdapterFactoryCalls}, registry=${tamperedRegistryFactoryCalls}`,
  '',
  `Otra session bloqueada: ${wrongSessionBlocked ? 'SÍ' : 'NO'}`,
  `Factories otra session: adapter=${wrongSessionAdapterFactoryCalls}, registry=${wrongSessionRegistryFactoryCalls}`,
  '',
  `Orden alterado bloqueado: ${changedOperationsBlocked ? 'SÍ' : 'NO'}`,
  `Factories orden alterado: adapter=${changedAdapterFactoryCalls}, registry=${changedRegistryFactoryCalls}`,
  '',
  'RESUME VÁLIDO',
  '-------------',
  `Resume completado: ${validResumeCorrect ? 'SÍ' : 'NO'}`,
  `Factories válidas: adapter=${validAdapterFactoryCalls}, registry=${validRegistryFactoryCalls}`,
  `Operaciones exitosas tras resume: ${validResume.journal?.summary.succeeded ?? 'N/A'}`,
  `Bindings committeados tras resume: ${validResume.bindingCommit?.committed ?? 'N/A'}`,
  '',
  `Categorías finales: ${finalCategories}`,
  `Canales finales: ${finalChannels}`,
  `Resources finales: ${finalAdapter.resources.length}`,
  `Adapter bindings finales: ${Object.keys(finalAdapter.bindings).length}`,
  `Registry bindings finales: ${Object.keys(finalRegistry.session).length}`,
  `Registry revision final: ${finalRegistry.revision}`,
  '',
  `Resources únicos: ${uniqueResources}`,
  `Channel actions únicas: ${uniqueChannelActions}`,
  `Checkpoint final válido: ${finalVerification.status === 'valid' ? 'SÍ' : 'NO'}`,
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
    'checkpointed-binding-resume-test',
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
  '♻️ Checkpointed Binding-Aware Resume',
);
console.log('');

console.log(
  `STOP correcto: ${stoppedCorrect ? 'SÍ' : 'NO'}`,
);

console.log(
  `Canales antes del STOP: ${stopped.journal.summary.succeeded}`,
);

console.log('');

console.log(
  `Registry manipulado bloqueado: ${tamperedBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Factories tras manipulación: ${tamperedAdapterFactoryCalls}/${tamperedRegistryFactoryCalls}`,
);

console.log('');

console.log(
  `Otra session bloqueada: ${wrongSessionBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Orden alterado bloqueado: ${changedOperationsBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Resume válido completado: ${validResumeCorrect ? 'SÍ' : 'NO'}`,
);

console.log(
  `Categorías finales: ${finalCategories}`,
);

console.log(
  `Canales finales: ${finalChannels}`,
);

console.log(
  `Resources finales: ${finalAdapter.resources.length}`,
);

console.log(
  `Adapter bindings finales: ${Object.keys(finalAdapter.bindings).length}`,
);

console.log(
  `Registry bindings finales: ${Object.keys(finalRegistry.session).length}`,
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
