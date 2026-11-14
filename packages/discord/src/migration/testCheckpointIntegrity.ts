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

import {
  executeWithJournal,
} from './executionJournal.js';

import {
  sealExecutionCheckpoint,
  verifyExecutionCheckpointIntegrity,
} from './checkpointIntegrity.js';

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

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
    `Se esperaban 24 roles y se encontraron ${roleOperations.length}.`,
  );
}

const failureIndex = 2;

const failureTarget =
  roleOperations[
    failureIndex
  ];

if (
  !failureTarget
) {
  throw new Error(
    'No existe la operación de fallo esperada.',
  );
}

const adapter =
  new FakeDiscordExecutionAdapter();

const run =
  await executeWithJournal(
    adapter,
    {
      phase:
        'roles',

      operations:
        roleOperations,

      beforeOperation:
        ({
          operation,
        }) => {
          if (
            operation.id ===
              failureTarget.id
          ) {
            throw new Error(
              'Fallo sintético para prueba de integridad.',
            );
          }
        },
    },
  );

if (
  run.status !==
    'stopped_on_error'
) {
  throw new Error(
    'La prueba necesita un checkpoint detenido por error.',
  );
}

const context:
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

const sealed =
  sealExecutionCheckpoint(
    run.checkpoint,
    context,
  );

const validVerification =
  verifyExecutionCheckpointIntegrity(
    sealed,
    context,
  );

const wrongSessionContext:
  CheckpointIntegrityContext = {
    ...context,

    sessionId:
      `${context.sessionId}-otra`,
  };

const wrongSessionVerification =
  verifyExecutionCheckpointIntegrity(
    sealed,
    wrongSessionContext,
  );

const changedOperationIds = [
  ...context.operationIds,
];

const first =
  changedOperationIds[0];

const second =
  changedOperationIds[1];

if (
  !first ||
  !second
) {
  throw new Error(
    'No hay suficientes operaciones para la prueba.',
  );
}

changedOperationIds[0] =
  second;

changedOperationIds[1] =
  first;

const changedOperationsContext:
  CheckpointIntegrityContext = {
    ...context,

    operationIds:
      changedOperationIds,
  };

const changedOperationsVerification =
  verifyExecutionCheckpointIntegrity(
    sealed,
    changedOperationsContext,
  );

const tampered =
  structuredClone(
    sealed,
  );

const firstAction =
  tampered.checkpoint
    .adapterSnapshot
    .actions[0];

if (
  !firstAction
) {
  throw new Error(
    'El snapshot no contiene una acción para manipular.',
  );
}

firstAction.description =
  `${firstAction.description} ALTERADO`;

const tamperedVerification =
  verifyExecutionCheckpointIntegrity(
    tampered,
    context,
  );

const validPasses =
  validVerification.status ===
    'valid' &&
  validVerification.summary.block ===
    0;

const wrongSessionBlocked =
  wrongSessionVerification.status ===
    'blocked' &&
  wrongSessionVerification.checks.some(
    (check) =>
      check.id ===
        'session_identity' &&
      check.status ===
        'block',
  );

const changedOperationsBlocked =
  changedOperationsVerification.status ===
    'blocked' &&
  changedOperationsVerification.checks.some(
    (check) =>
      check.id ===
        'operation_sequence' &&
      check.status ===
        'block',
  );

const tamperingBlocked =
  tamperedVerification.status ===
    'blocked' &&
  tamperedVerification.checks.some(
    (check) =>
      check.id ===
        'integrity_fingerprint' &&
      check.status ===
        'block',
  );

const success =
  validPasses &&
  wrongSessionBlocked &&
  changedOperationsBlocked &&
  tamperingBlocked;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  context,

  sealed,

  tests: {
    valid: {
      success:
        validPasses,

      verification:
        validVerification,
    },

    wrongSession: {
      success:
        wrongSessionBlocked,

      verification:
        wrongSessionVerification,
    },

    changedOperations: {
      success:
        changedOperationsBlocked,

      verification:
        changedOperationsVerification,
    },

    tamperedSnapshot: {
      success:
        tamperingBlocked,

      verification:
        tamperedVerification,
    },
  },

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — CHECKPOINT INTEGRITY TEST',
  '=====================================',
  '',
  `Checkpoint: ${sealed.checkpoint.checkpointId}`,
  `Fingerprint: ${sealed.integrityFingerprint}`,
  `Session: ${context.sessionId}`,
  `Guild: ${context.guildId}`,
  `Fase: ${context.phase}`,
  `Operaciones: ${context.operationIds.length}`,
  '',
  'PRUEBAS',
  '-------',
  `Checkpoint intacto aceptado: ${validPasses ? 'SÍ' : 'NO'}`,
  `Otra sesión bloqueada: ${wrongSessionBlocked ? 'SÍ' : 'NO'}`,
  `Operaciones cambiadas bloqueadas: ${changedOperationsBlocked ? 'SÍ' : 'NO'}`,
  `Snapshot alterado bloqueado: ${tamperingBlocked ? 'SÍ' : 'NO'}`,
  '',
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
  '',
  'ADAPTER: FAKE',
  'CONEXIÓN A DISCORD: NO',
  'EJECUCIÓN REAL PERMITIDA: NO',
  '',
].join(
  '\n',
);

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'checkpoint-integrity-test',
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
  '🔐 Checkpoint Integrity Guard',
);
console.log('');
console.log(
  `Checkpoint intacto aceptado: ${validPasses ? 'SÍ' : 'NO'}`,
);
console.log(
  `Otra sesión bloqueada: ${wrongSessionBlocked ? 'SÍ' : 'NO'}`,
);
console.log(
  `Operaciones cambiadas bloqueadas: ${changedOperationsBlocked ? 'SÍ' : 'NO'}`,
);
console.log(
  `Snapshot alterado bloqueado: ${tamperingBlocked ? 'SÍ' : 'NO'}`,
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
  'EJECUCIÓN REAL PERMITIDA: NO',
);
console.log('');

if (
  !success
) {
  process.exitCode = 2;
}
