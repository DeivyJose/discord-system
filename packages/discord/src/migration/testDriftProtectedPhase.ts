import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import {
  isAutomatableOperation,
} from './executionAdapter.js';

import type {
  AutomatableMigrationOperation,
} from './executionAdapterTypes.js';

import {
  FakeDiscordExecutionAdapter,
} from './fakeDiscordExecutionAdapter.js';

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import type {
  LiveDriftContext,
} from './liveDriftTypes.js';

import {
  runDriftProtectedPhase,
} from './driftProtectedPhase.js';

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
    typeof value !== 'object' ||
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

const operations =
  await readJson<
    MigrationOperationsPlan
  >(
    '.data',
    'migration-operations',
    'latest.json',
  );

const session =
  await readJson<
    ExecutionSessionPlan
  >(
    '.data',
    'execution-sessions',
    'latest.json',
  );

const roleOperations:
  AutomatableMigrationOperation[] =
  operations.operations.filter(
    (
      operation,
    ): operation is
      AutomatableMigrationOperation =>
      isAutomatableOperation(
        operation,
      ) &&
      operation.type ===
        'create_role',
  );

if (
  roleOperations.length !==
    24
) {
  throw new Error(
    `Se esperaban 24 create_role y se encontraron ${roleOperations.length}.`,
  );
}

const driftContext:
  LiveDriftContext = {
    sessionId:
      session.sessionId,

    gateFingerprint:
      session.gateFingerprint,
  };

const transactionContext:
  CheckpointIntegrityContext = {
    guildId:
      session.guild.id,

    sessionId:
      session.sessionId,

    gateFingerprint:
      session.gateFingerprint,

    phase:
      'roles',

    operationIds:
      roleOperations.map(
        (operation) =>
          operation.id,
      ),
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

/*
 * TEST 1:
 * mismo estado estructural.
 */
const identicalLiveSnapshot =
  normalizeDiscordStructureSnapshot(
    structuredClone(
      rawSnapshot,
    ),
  );

let validFactoryCalls =
  0;

const validResult =
  await runDriftProtectedPhase({
    baseline,

    currentSnapshot:
      identicalLiveSnapshot,

    driftContext,

    transactionContext,

    operations:
      roleOperations,

    adapterFactory:
      () => {
        validFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter();
      },
  });

const validPasses =
  validResult.status ===
    'completed' &&
  validResult
    .adapterFactoryReached ===
    true &&
  validFactoryCalls ===
    1 &&
  validResult.transaction
    ?.summary
    .succeeded ===
    24;

/*
 * TEST 2:
 * rename inesperado en snapshot live.
 */
const renamedRaw =
  structuredClone(
    rawSnapshot,
  );

const renamedObject =
  asObject(
    renamedRaw,
  );

const channels =
  renamedObject.channels;

if (
  !Array.isArray(
    channels,
  ) ||
  channels.length ===
    0
) {
  throw new Error(
    'El snapshot no contiene canales para la prueba de drift.',
  );
}

const firstChannel =
  asObject(
    channels[0],
  );

const oldName =
  firstChannel.name;

if (
  typeof oldName !==
    'string'
) {
  throw new Error(
    'El primer canal no contiene name.',
  );
}

firstChannel.name =
  `${oldName}-DRIFT`;

const renamedLiveSnapshot =
  normalizeDiscordStructureSnapshot(
    renamedRaw,
  );

let driftFactoryCalls =
  0;

const driftResult =
  await runDriftProtectedPhase({
    baseline,

    currentSnapshot:
      renamedLiveSnapshot,

    driftContext,

    transactionContext,

    operations:
      roleOperations,

    adapterFactory:
      () => {
        driftFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter();
      },
  });

const driftBlockedBeforeFactory =
  driftResult.status ===
    'blocked' &&
  driftResult.blockReason ===
    'live_drift_detected' &&
  driftResult
    .adapterFactoryReached ===
    false &&
  driftFactoryCalls ===
    0 &&
  driftResult.transaction ===
    null &&
  (
    driftResult.drift
      ?.summary
      .changed ??
    0
  ) >=
    1;

/*
 * TEST 3:
 * contexto de otra sesión.
 */
const wrongDriftContext:
  LiveDriftContext = {
    ...driftContext,

    sessionId:
      `${driftContext.sessionId}-incorrecta`,
  };

let contextFactoryCalls =
  0;

const wrongContextResult =
  await runDriftProtectedPhase({
    baseline,

    currentSnapshot:
      identicalLiveSnapshot,

    driftContext:
      wrongDriftContext,

    transactionContext,

    operations:
      roleOperations,

    adapterFactory:
      () => {
        contextFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter();
      },
  });

const wrongContextBlocked =
  wrongContextResult.status ===
    'blocked' &&
  wrongContextResult
    .blockReason ===
    'context_mismatch' &&
  wrongContextResult
    .adapterFactoryReached ===
    false &&
  contextFactoryCalls ===
    0 &&
  wrongContextResult.transaction ===
    null;

const success =
  validPasses &&
  driftBlockedBeforeFactory &&
  wrongContextBlocked;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  tests: {
    identicalState: {
      success:
        validPasses,

      factoryCalls:
        validFactoryCalls,

      result:
        validResult,
    },

    liveRenameDrift: {
      success:
        driftBlockedBeforeFactory,

      factoryCalls:
        driftFactoryCalls,

      result:
        driftResult,
    },

    wrongContext: {
      success:
        wrongContextBlocked,

      factoryCalls:
        contextFactoryCalls,

      result:
        wrongContextResult,
    },
  },

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — DRIFT-PROTECTED PHASE TEST',
  '======================================',
  '',
  'ESTADO IDÉNTICO',
  '---------------',
  `Fase completada: ${validPasses ? 'SÍ' : 'NO'}`,
  `Factory llamada: ${validFactoryCalls}`,
  '',
  'LIVE DRIFT',
  '----------',
  `Rename inesperado bloqueado: ${driftBlockedBeforeFactory ? 'SÍ' : 'NO'}`,
  `Factory con drift: ${driftFactoryCalls}`,
  `Transaction con drift creada: ${driftResult.transaction ? 'SÍ' : 'NO'}`,
  '',
  'CONTEXT GUARD',
  '-------------',
  `Contexto incorrecto bloqueado: ${wrongContextBlocked ? 'SÍ' : 'NO'}`,
  `Factory con contexto incorrecto: ${contextFactoryCalls}`,
  '',
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
  '',
  'ADAPTER: FAKE',
  'CONEXIÓN MUTATIVA A DISCORD: NO',
  'EJECUCIÓN REAL PERMITIDA: NO',
  '',
].join(
  '\n',
);

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'drift-protected-phase-test',
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
  '🛡️ Drift-Protected Phase Runner',
);
console.log('');
console.log(
  `Estado idéntico completado: ${validPasses ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory válida llamada: ${validFactoryCalls}`,
);
console.log('');
console.log(
  `Rename inesperado bloqueado: ${driftBlockedBeforeFactory ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory con drift: ${driftFactoryCalls}`,
);
console.log('');
console.log(
  `Contexto incorrecto bloqueado: ${wrongContextBlocked ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory con contexto incorrecto: ${contextFactoryCalls}`,
);
console.log('');
console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);
console.log('');
console.log(
  'CONEXIÓN MUTATIVA A DISCORD: NO',
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
