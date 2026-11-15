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
  AutomatableMigrationOperation,
  MigrationOperation,
} from './executionAdapterTypes.js';

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

import {
  resumeCheckpointedBindingPhase,
} from './checkpointedBindingResume.js';

import {
  FakeDiscordExecutionAdapter,
} from './fakeDiscordExecutionAdapter.js';

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import type {
  LiveDriftContext,
} from './liveDriftTypes.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  SessionBindingRegistry,
} from './sessionBindingRegistry.js';

import {
  runFullCheckpointedFakeMigration,
} from './fullCheckpointedFakeMigration.js';

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

function asObject(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !==
      'object' ||
    value === null ||
    Array.isArray(
      value,
    )
  ) {
    throw new Error(
      'Se esperaba un objeto.',
    );
  }

  return value as
    Record<string, unknown>;
}

const rawSnapshot =
  await readJson<unknown>(
    '.data',
    'discord-snapshots',
    'latest.json',
  );

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

const automatable:
  AutomatableMigrationOperation[] =
  operations.filter(
    (
      operation,
    ): operation is
      AutomatableMigrationOperation =>
      isAutomatableOperation(
        operation,
      ),
  );

const manual =
  operations.filter(
    (operation) =>
      !isAutomatableOperation(
        operation,
      ),
  );

const channelOperations =
  automatable.filter(
    (operation) =>
      operation.type ===
        'create_channel',
  );

const sessionId =
  'full-checkpointed-fake-test-session';

const gateFingerprint =
  'full-checkpointed-fake-test-gate';

const driftContext:
  LiveDriftContext = {
  sessionId,

  gateFingerprint,
};

const authorizedSnapshot =
  normalizeDiscordStructureSnapshot(
    rawSnapshot,
  );

const baseline =
  createLiveDriftBaseline(
    authorizedSnapshot,
    driftContext,
  );

const identicalSnapshot =
  normalizeDiscordStructureSnapshot(
    structuredClone(
      rawSnapshot,
    ),
  );

/*
 * ============================================
 * TEST 1 — FULL FLOW VÁLIDO
 * ============================================
 */
const failureIndex =
  9;

const full =
  await runFullCheckpointedFakeMigration({
    guildId:
      bindingFile.guildId,

    sessionId,

    gateFingerprint,

    confirmedBindings:
      bindingFile.resources,

    operations,

    baseline,

    currentSnapshot:
      identicalSnapshot,

    channelFailureIndex:
      failureIndex,
  });

if (
  !full.finalAdapterSnapshot ||
  !full.finalRegistrySnapshot ||
  !full.stoppedChannelsCheckpoint
) {
  throw new Error(
    'Full migration no produjo estado final completo.',
  );
}

const phaseMap =
  new Map(
    full.phases.map(
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
    'Faltan fases en el resultado.',
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

const phaseSuccessCorrect =
  roles.succeeded ===
    24 &&
  categories.succeeded ===
    13 &&
  renames.succeeded ===
    8 &&
  channels.succeeded ===
    51 &&
  moves.succeeded ===
    2 &&
  channels.syntheticFailures ===
    1 &&
  channels.resumed;

const actionIds =
  full.finalAdapterSnapshot
    .actions
    .map(
      (action) =>
        action.operationId,
    );

const uniqueActionIds =
  new Set(
    actionIds,
  );

const manualIds =
  new Set(
    manual.map(
      (operation) =>
        operation.id,
    ),
  );

const automaticExecutionCorrect =
  actionIds.length ===
    98 &&
  uniqueActionIds.size ===
    98;

const manualNeverExecuted =
  actionIds.every(
    (id) =>
      !manualIds.has(
        id,
      ),
  );

const registryCorrect =
  Object.keys(
    full.finalRegistrySnapshot
      .confirmed,
  ).length ===
    13 &&
  Object.keys(
    full.finalRegistrySnapshot
      .session,
  ).length ===
    88 &&
  full.finalRegistrySnapshot
    .revision ===
    4;

const resolverBindingsTotal =
  Object.keys(
    full.finalRegistrySnapshot
      .confirmed,
  ).length +
  Object.keys(
    full.finalRegistrySnapshot
      .session,
  ).length;

const totalsCorrect =
  full.status ===
    'completed' &&
  full.totalOperations ===
    108 &&
  full.automatableOperations ===
    98 &&
  full.manualReviewOperations ===
    10 &&
  resolverBindingsTotal ===
    101;

const channelCheckpointPhaseIsolated =
  full.stoppedChannelsCheckpoint
    .executionCheckpoint
    .checkpoint
    .adapterSnapshot
    .actions
    .length ===
    failureIndex;

const fullFlowPasses =
  phaseCountsCorrect &&
  phaseSuccessCorrect &&
  automaticExecutionCorrect &&
  manualNeverExecuted &&
  registryCorrect &&
  totalsCorrect &&
  channelCheckpointPhaseIsolated;

/*
 * ============================================
 * TEST 2 — LIVE DRIFT ANTES DE CREAR ADAPTER
 * ============================================
 */
const driftedRaw =
  structuredClone(
    rawSnapshot,
  );

const driftedObject =
  asObject(
    driftedRaw,
  );

const driftedChannels =
  driftedObject.channels;

if (
  !Array.isArray(
    driftedChannels,
  ) ||
  driftedChannels.length ===
    0
) {
  throw new Error(
    'Snapshot sin canales para drift test.',
  );
}

const firstChannel =
  asObject(
    driftedChannels[0],
  );

const originalName =
  firstChannel.name;

if (
  typeof originalName !==
    'string'
) {
  throw new Error(
    'Canal de prueba sin name.',
  );
}

firstChannel.name =
  `${originalName}-UNEXPECTED-DRIFT`;

const driftedSnapshot =
  normalizeDiscordStructureSnapshot(
    driftedRaw,
  );

const driftBlocked =
  await runFullCheckpointedFakeMigration({
    guildId:
      bindingFile.guildId,

    sessionId,

    gateFingerprint,

    confirmedBindings:
      bindingFile.resources,

    operations,

    baseline,

    currentSnapshot:
      driftedSnapshot,

    channelFailureIndex:
      failureIndex,
  });

const driftBlockedBeforeStateCreation =
  driftBlocked.status ===
    'blocked' &&
  driftBlocked.blockReason ===
    'live_drift_detected' &&
  !driftBlocked.adapterCreated &&
  !driftBlocked.registryCreated &&
  driftBlocked.phases.length ===
    0;

/*
 * ============================================
 * TEST 3 — CHECKPOINT COMPUESTO MANIPULADO
 * ============================================
 */
const channelsContext:
  CheckpointIntegrityContext = {
  guildId:
    bindingFile.guildId,

  sessionId,

  gateFingerprint,

  phase:
    'channels',

  operationIds:
    channelOperations.map(
      (operation) =>
        operation.id,
    ),
};

const tampered =
  structuredClone(
    full.stoppedChannelsCheckpoint,
  );

const firstSessionBinding =
  Object.values(
    tampered
      .bindingRegistrySnapshot
      .session,
  )[0];

if (
  !firstSessionBinding
) {
  throw new Error(
    'Checkpoint sin binding para manipular.',
  );
}

firstSessionBinding.actualId =
  `${firstSessionBinding.actualId}_TAMPERED`;

let tamperedAdapterFactories =
  0;

let tamperedRegistryFactories =
  0;

const tamperedResume =
  await resumeCheckpointedBindingPhase({
    sealedCheckpoint:
      tampered,

    expectedContext:
      channelsContext,

    operations:
      channelOperations,

    adapterFactory:
      (snapshot) => {
        tamperedAdapterFactories +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },

    registryFactory:
      (snapshot) => {
        tamperedRegistryFactories +=
          1;

        return SessionBindingRegistry.restore(
          snapshot,
        );
      },
  });

const tamperedBlocked =
  tamperedResume.status ===
    'blocked' &&
  tamperedAdapterFactories ===
    0 &&
  tamperedRegistryFactories ===
    0;

/*
 * ============================================
 * TEST 4 — OTRA EXECUTION SESSION
 * ============================================
 */
const wrongSessionContext:
  CheckpointIntegrityContext = {
  ...channelsContext,

  sessionId:
    'another-fake-session',
};

let wrongSessionAdapterFactories =
  0;

let wrongSessionRegistryFactories =
  0;

const wrongSessionResume =
  await resumeCheckpointedBindingPhase({
    sealedCheckpoint:
      full.stoppedChannelsCheckpoint,

    expectedContext:
      wrongSessionContext,

    operations:
      channelOperations,

    adapterFactory:
      (snapshot) => {
        wrongSessionAdapterFactories +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },

    registryFactory:
      (snapshot) => {
        wrongSessionRegistryFactories +=
          1;

        return SessionBindingRegistry.restore(
          snapshot,
        );
      },
  });

const wrongSessionBlocked =
  wrongSessionResume.status ===
    'blocked' &&
  wrongSessionAdapterFactories ===
    0 &&
  wrongSessionRegistryFactories ===
    0;

/*
 * ============================================
 * RESULTADO
 * ============================================
 */
const success =
  fullFlowPasses &&
  driftBlockedBeforeStateCreation &&
  tamperedBlocked &&
  wrongSessionBlocked;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  fullFlow: {
    success:
      fullFlowPasses,

    totalOperations:
      full.totalOperations,

    automatable:
      full.automatableOperations,

    manual:
      full.manualReviewOperations,

    phases:
      full.phases,

    finalActions:
      full.finalAdapterSnapshot
        .actions
        .length,

    uniqueActions:
      uniqueActionIds.size,

    sessionBindings:
      Object.keys(
        full
          .finalRegistrySnapshot
          .session,
      ).length,

    resolverBindings:
      resolverBindingsTotal,

    registryRevision:
      full
        .finalRegistrySnapshot
        .revision,

    channelCheckpointPhaseIsolated,
  },

  security: {
    manualNeverExecuted,

    driftBlockedBeforeStateCreation,

    tamperedBlocked,

    tamperedFactories: {
      adapter:
        tamperedAdapterFactories,

      registry:
        tamperedRegistryFactories,
    },

    wrongSessionBlocked,

    wrongSessionFactories: {
      adapter:
        wrongSessionAdapterFactories,

      registry:
        wrongSessionRegistryFactories,
    },
  },

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — FULL CHECKPOINTED FAKE MIGRATION TEST',
  '================================================',
  '',
  'FULL FLOW',
  '---------',
  `Operaciones planificadas: ${full.totalOperations}`,
  `Automáticas: ${full.automatableOperations}`,
  `Manual review: ${full.manualReviewOperations}`,
  '',
  `Roles: ${roles.succeeded}/24`,
  `Categories: ${categories.succeeded}/13`,
  `Renames: ${renames.succeeded}/8`,
  `Channels: ${channels.succeeded}/51`,
  `Moves: ${moves.succeeded}/2`,
  '',
  `Fallo artificial en channels: ${channels.syntheticFailures === 1 ? 'SÍ' : 'NO'}`,
  `Channels reanudado: ${channels.resumed ? 'SÍ' : 'NO'}`,
  `Checkpoint de channels contiene solo sus 9 actions previas al STOP: ${channelCheckpointPhaseIsolated ? 'SÍ' : 'NO'}`,
  '',
  `Actions finales: ${full.finalAdapterSnapshot.actions.length}`,
  `Actions únicas: ${uniqueActionIds.size}`,
  `Bindings de sesión: ${Object.keys(full.finalRegistrySnapshot.session).length}`,
  `Bindings resolubles: ${resolverBindingsTotal}`,
  `Registry revision: ${full.finalRegistrySnapshot.revision}`,
  '',
  `10 operaciones manuales nunca ejecutadas: ${manualNeverExecuted ? 'SÍ' : 'NO'}`,
  '',
  'SECURITY ATTACKS',
  '----------------',
  `Live drift bloqueado antes de crear estado: ${driftBlockedBeforeStateCreation ? 'SÍ' : 'NO'}`,
  `Checkpoint manipulado bloqueado: ${tamperedBlocked ? 'SÍ' : 'NO'}`,
  `Factories tras checkpoint manipulado: adapter=${tamperedAdapterFactories}, registry=${tamperedRegistryFactories}`,
  `Otra session bloqueada: ${wrongSessionBlocked ? 'SÍ' : 'NO'}`,
  `Factories con otra session: adapter=${wrongSessionAdapterFactories}, registry=${wrongSessionRegistryFactories}`,
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
    'full-checkpointed-fake-migration-test',
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
  '🧭 Full Checkpointed Fake Migration',
);
console.log('');

console.log(
  `Plan: ${full.totalOperations}`,
);

console.log(
  `Automáticas: ${full.automatableOperations}`,
);

console.log(
  `Manual review: ${full.manualReviewOperations}`,
);

console.log('');

console.log(
  `Roles: ${roles.succeeded}/24`,
);

console.log(
  `Categories: ${categories.succeeded}/13`,
);

console.log(
  `Renames: ${renames.succeeded}/8`,
);

console.log(
  `Channels: ${channels.succeeded}/51`,
);

console.log(
  `Moves: ${moves.succeeded}/2`,
);

console.log('');

console.log(
  `Channels resume: ${channels.resumed ? 'SÍ' : 'NO'}`,
);

console.log(
  `Actions únicas: ${uniqueActionIds.size}`,
);

console.log(
  `Session bindings: ${Object.keys(full.finalRegistrySnapshot.session).length}`,
);

console.log(
  `Resolver bindings: ${resolverBindingsTotal}`,
);

console.log('');

console.log(
  `Live drift bloqueado: ${driftBlockedBeforeStateCreation ? 'SÍ' : 'NO'}`,
);

console.log(
  `Checkpoint manipulado bloqueado: ${tamperedBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Otra session bloqueada: ${wrongSessionBlocked ? 'SÍ' : 'NO'}`,
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
