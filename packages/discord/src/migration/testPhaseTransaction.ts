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
  runExecutionPhaseTransaction,
} from './phaseTransaction.js';

import {
  verifiedResumeExecution,
} from './verifiedResume.js';

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

const context:
  CheckpointIntegrityContext = {
    guildId:
      session.guild.id,

    sessionId:
      session.sessionId,

    gateFingerprint:
      session.gateFingerprint,

    gateEnvelopeFingerprint:
      session.gateEnvelopeFingerprint,

    phase:
      'roles',

    operationIds:
      roleOperations.map(
        (operation) =>
          operation.id,
      ),
  };

/*
 * TEST 0:
 * entregar operaciones en orden incorrecto.
 * El Fake Adapter ni siquiera debe crearse.
 */
const changedOperations = [
  ...roleOperations,
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
    'No hay suficientes operaciones para la prueba.',
  );
}

changedOperations[0] =
  second;

changedOperations[1] =
  first;

let blockedFactoryCalls =
  0;

const blockedTransaction =
  await runExecutionPhaseTransaction({
    context,

    operations:
      changedOperations,

    adapterFactory:
      () => {
        blockedFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter();
      },
  });

const preflightBlockPasses =
  blockedTransaction.status ===
    'blocked' &&
  blockedTransaction.adapterCreated ===
    false &&
  blockedFactoryCalls ===
    0;

/*
 * TEST 1:
 * transacción real del Fake Adapter,
 * con fallo deliberado en la operación 10.
 */
const failureIndex =
  9;

const failureTarget =
  roleOperations[
    failureIndex
  ];

if (
  !failureTarget
) {
  throw new Error(
    'No existe la operación objetivo del fallo.',
  );
}

let transactionFactoryCalls =
  0;

const transaction =
  await runExecutionPhaseTransaction({
    context,

    operations:
      roleOperations,

    adapterFactory:
      () => {
        transactionFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter();
      },

    beforeOperation:
      ({
        operation,
      }) => {
        if (
          operation.id ===
            failureTarget.id
        ) {
          throw new Error(
            'Fallo sintético en mitad de la Phase Transaction.',
          );
        }
      },
  });

const sealed =
  transaction
    .sealedCheckpoint;

if (
  !sealed
) {
  throw new Error(
    'La transacción no produjo un checkpoint sellado.',
  );
}

const transactionStoppedCorrectly =
  transaction.status ===
    'stopped_on_error' &&
  transaction.adapterCreated ===
    true &&
  transactionFactoryCalls ===
    1 &&
  transaction.summary.attempted ===
    10 &&
  transaction.summary.succeeded ===
    9 &&
  transaction.summary.failed ===
    1 &&
  transaction.summary.resumeAvailable ===
    true &&
  sealed.checkpoint
    .nextOperationIndex ===
    failureIndex &&
  sealed.checkpoint
    .adapterSnapshot
    .actions
    .length ===
    9;

/*
 * TEST 2:
 * manipular el checkpoint sellado.
 */
const tampered =
  structuredClone(
    sealed,
  );

const tamperedAction =
  tampered.checkpoint
    .adapterSnapshot
    .actions[0];

if (
  !tamperedAction
) {
  throw new Error(
    'No existe una acción para manipular.',
  );
}

tamperedAction.description =
  `${tamperedAction.description} ALTERADO`;

let tamperedResumeFactoryCalls =
  0;

const tamperedResume =
  await verifiedResumeExecution({
    sealedCheckpoint:
      tampered,

    expectedContext:
      context,

    operations:
      roleOperations,

    adapterFactory:
      (
        snapshot,
      ) => {
        tamperedResumeFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },
  });

const tamperedBlocked =
  tamperedResume.status ===
    'blocked' &&
  tamperedResume.adapterRestored ===
    false &&
  tamperedResumeFactoryCalls ===
    0;

/*
 * TEST 3:
 * reanudar el checkpoint auténtico.
 */
let validResumeFactoryCalls =
  0;

const validResume =
  await verifiedResumeExecution({
    sealedCheckpoint:
      sealed,

    expectedContext:
      context,

    operations:
      roleOperations,

    adapterFactory:
      (
        snapshot,
      ) => {
        validResumeFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },
  });

const finalActions =
  validResume.journal
    ?.checkpoint
    .adapterSnapshot
    .actions
    .length ??
  0;

const finalBindings =
  Object.keys(
    validResume.journal
      ?.checkpoint
      .adapterSnapshot
      .bindings ??
    {},
  ).length;

const validResumePasses =
  validResume.status ===
    'completed' &&
  validResume.adapterRestored ===
    true &&
  validResumeFactoryCalls ===
    1 &&
  finalActions ===
    24 &&
  finalBindings ===
    24;

const success =
  preflightBlockPasses &&
  transactionStoppedCorrectly &&
  tamperedBlocked &&
  validResumePasses;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  context,

  failure: {
    index:
      failureIndex,

    operationId:
      failureTarget.id,
  },

  tests: {
    invalidInitialSequence: {
      success:
        preflightBlockPasses,

      factoryCalls:
        blockedFactoryCalls,

      result:
        blockedTransaction,
    },

    transactionStop: {
      success:
        transactionStoppedCorrectly,

      factoryCalls:
        transactionFactoryCalls,

      result:
        transaction,
    },

    tamperedResume: {
      success:
        tamperedBlocked,

      factoryCalls:
        tamperedResumeFactoryCalls,

      result:
        tamperedResume,
    },

    validResume: {
      success:
        validResumePasses,

      factoryCalls:
        validResumeFactoryCalls,

      finalActions,

      finalBindings,

      result:
        validResume,
    },
  },

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — PHASE TRANSACTION TEST',
  '==================================',
  '',
  `Fase: ${context.phase}`,
  `Operaciones: ${context.operationIds.length}`,
  `Fallo simulado: ${failureTarget.id}`,
  `Índice del fallo: ${failureIndex}`,
  '',
  'PRE-EXECUTION GUARD',
  '-------------------',
  `Secuencia incorrecta bloqueada: ${preflightBlockPasses ? 'SÍ' : 'NO'}`,
  `Factory con secuencia incorrecta: ${blockedFactoryCalls}`,
  '',
  'TRANSACTION',
  '-----------',
  `Estado: ${transaction.status}`,
  `Intentadas: ${transaction.summary.attempted}`,
  `Exitosas: ${transaction.summary.succeeded}`,
  `Fallidas: ${transaction.summary.failed}`,
  `Checkpoint sellado: ${transaction.summary.checkpointSealed ? 'SÍ' : 'NO'}`,
  `Resume disponible: ${transaction.summary.resumeAvailable ? 'SÍ' : 'NO'}`,
  `Acciones antes del STOP: ${sealed.checkpoint.adapterSnapshot.actions.length}`,
  `STOP correcto: ${transactionStoppedCorrectly ? 'SÍ' : 'NO'}`,
  '',
  'TAMPER TEST',
  '-----------',
  `Checkpoint manipulado bloqueado: ${tamperedBlocked ? 'SÍ' : 'NO'}`,
  `Factory tras manipulación: ${tamperedResumeFactoryCalls}`,
  '',
  'VERIFIED RESUME',
  '---------------',
  `Resume válido completado: ${validResumePasses ? 'SÍ' : 'NO'}`,
  `Factory de resume válida: ${validResumeFactoryCalls}`,
  `Acciones finales: ${finalActions}`,
  `Bindings finales: ${finalBindings}`,
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
    'phase-transaction-test',
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
  '🧱 Execution Phase Transaction Runner',
);
console.log('');
console.log(
  `Secuencia incorrecta bloqueada: ${preflightBlockPasses ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory con secuencia incorrecta: ${blockedFactoryCalls}`,
);
console.log('');
console.log(
  `STOP correcto: ${transactionStoppedCorrectly ? 'SÍ' : 'NO'}`,
);
console.log(
  `Intentadas antes del STOP: ${transaction.summary.attempted}`,
);
console.log(
  `Acciones antes del STOP: ${sealed.checkpoint.adapterSnapshot.actions.length}`,
);
console.log('');
console.log(
  `Checkpoint manipulado bloqueado: ${tamperedBlocked ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory tras manipulación: ${tamperedResumeFactoryCalls}`,
);
console.log('');
console.log(
  `Resume válido completado: ${validResumePasses ? 'SÍ' : 'NO'}`,
);
console.log(
  `Acciones finales: ${finalActions}`,
);
console.log(
  `Bindings finales: ${finalBindings}`,
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
