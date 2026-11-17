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
} from './checkpointIntegrity.js';

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

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

const failureIndex =
  2;

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

/*
 * Crear un checkpoint real del Fake Adapter,
 * detenido deliberadamente en la tercera operación.
 */
const initialAdapter =
  new FakeDiscordExecutionAdapter();

const failedRun =
  await executeWithJournal(
    initialAdapter,
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
              'Fallo sintético para Verified Resume.',
            );
          }
        },
    },
  );

if (
  failedRun.status !==
    'stopped_on_error'
) {
  throw new Error(
    'No se produjo el checkpoint detenido esperado.',
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

const sealed =
  sealExecutionCheckpoint(
    failedRun.checkpoint,
    context,
  );

/*
 * TEST 1:
 * checkpoint válido.
 */
let validFactoryCalls =
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
        validFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },
  });

const validResumePasses =
  validResume.status ===
    'completed' &&
  validResume.adapterRestored ===
    true &&
  validFactoryCalls ===
    1 &&
  validResume.journal !==
    null &&
  validResume.journal
    .checkpoint
    .adapterSnapshot
    .actions
    .length ===
    24;

/*
 * TEST 2:
 * manipular el contenido después de sellarlo.
 */
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
    'No hay acción disponible para la prueba de manipulación.',
  );
}

firstAction.description =
  `${firstAction.description} ALTERADO`;

let tamperedFactoryCalls =
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
        tamperedFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },
  });

const tamperedBlockedBeforeRestore =
  tamperedResume.status ===
    'blocked' &&
  tamperedResume.adapterRestored ===
    false &&
  tamperedFactoryCalls ===
    0;

/*
 * TEST 3:
 * intentar usar el checkpoint en otra sesión.
 */
const wrongSessionContext:
  CheckpointIntegrityContext = {
    ...context,

    sessionId:
      `${context.sessionId}-incorrecta`,
  };

let wrongSessionFactoryCalls =
  0;

const wrongSessionResume =
  await verifiedResumeExecution({
    sealedCheckpoint:
      sealed,

    expectedContext:
      wrongSessionContext,

    operations:
      roleOperations,

    adapterFactory:
      (
        snapshot,
      ) => {
        wrongSessionFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },
  });

const wrongSessionBlockedBeforeRestore =
  wrongSessionResume.status ===
    'blocked' &&
  wrongSessionResume.adapterRestored ===
    false &&
  wrongSessionFactoryCalls ===
    0;

/*
 * TEST:
 * mismo Content Fingerprint,
 * pero otro Gate Envelope.
 *
 * Debe fallar en Integrity Guard,
 * antes de restaurar el adapter.
 */
const wrongEnvelopeContext:
  CheckpointIntegrityContext = {
    ...context,

    gateEnvelopeFingerprint:
      `${context.gateEnvelopeFingerprint}-incorrecto`,
  };

let wrongEnvelopeFactoryCalls =
  0;

const wrongEnvelopeResume =
  await verifiedResumeExecution({
    sealedCheckpoint:
      sealed,

    expectedContext:
      wrongEnvelopeContext,

    operations:
      roleOperations,

    adapterFactory:
      (
        snapshot,
      ) => {
        wrongEnvelopeFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },
  });

const wrongEnvelopeBlockedBeforeRestore =
  wrongEnvelopeResume.status ===
    'blocked' &&
  wrongEnvelopeResume.blockReason ===
    'integrity_verification_failed' &&
  wrongEnvelopeResume.adapterRestored ===
    false &&
  wrongEnvelopeFactoryCalls ===
    0 &&
  wrongEnvelopeResume.integrity.checks.some(
    (check) =>
      check.id ===
        'gate_envelope_fingerprint' &&
      check.status ===
        'block',
  );

/*
 * TEST 4:
 * usar contexto correcto pero entregar al runner
 * una secuencia diferente de operaciones.
 */
const changedOperations = [
  ...roleOperations,
];

const firstOperation =
  changedOperations[0];

const secondOperation =
  changedOperations[1];

if (
  !firstOperation ||
  !secondOperation
) {
  throw new Error(
    'No hay suficientes operaciones para alterar el orden.',
  );
}

changedOperations[0] =
  secondOperation;

changedOperations[1] =
  firstOperation;

let changedOperationsFactoryCalls =
  0;

const changedOperationsResume =
  await verifiedResumeExecution({
    sealedCheckpoint:
      sealed,

    expectedContext:
      context,

    operations:
      changedOperations,

    adapterFactory:
      (
        snapshot,
      ) => {
        changedOperationsFactoryCalls +=
          1;

        return new FakeDiscordExecutionAdapter(
          snapshot,
        );
      },
  });

const changedOperationsBlockedBeforeRestore =
  changedOperationsResume.status ===
    'blocked' &&
  changedOperationsResume.adapterRestored ===
    false &&
  changedOperationsFactoryCalls ===
    0 &&
  changedOperationsResume
    .blockReason ===
    'operation_sequence_mismatch';

const success =
  validResumePasses &&
  tamperedBlockedBeforeRestore &&
  wrongSessionBlockedBeforeRestore &&
  wrongEnvelopeBlockedBeforeRestore &&
  changedOperationsBlockedBeforeRestore;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  failureTarget: {
    index:
      failureIndex,

    operationId:
      failureTarget.id,
  },

  tests: {
    validResume: {
      success:
        validResumePasses,

      factoryCalls:
        validFactoryCalls,

      result:
        validResume,
    },

    tamperedCheckpoint: {
      success:
        tamperedBlockedBeforeRestore,

      factoryCalls:
        tamperedFactoryCalls,

      result:
        tamperedResume,
    },

    wrongSession: {
      success:
        wrongSessionBlockedBeforeRestore,

      factoryCalls:
        wrongSessionFactoryCalls,

      result:
        wrongSessionResume,
    },

    wrongEnvelope: {
      success:
        wrongEnvelopeBlockedBeforeRestore,

      factoryCalls:
        wrongEnvelopeFactoryCalls,

      result:
        wrongEnvelopeResume,
    },

    changedOperations: {
      success:
        changedOperationsBlockedBeforeRestore,

      factoryCalls:
        changedOperationsFactoryCalls,

      result:
        changedOperationsResume,
    },
  },

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — VERIFIED RESUME TEST',
  '================================',
  '',
  `Fallo original: ${failureTarget.id}`,
  '',
  'PRUEBAS',
  '-------',
  `Checkpoint válido reanudado: ${validResumePasses ? 'SÍ' : 'NO'}`,
  `Factory válida llamada una vez: ${validFactoryCalls === 1 ? 'SÍ' : 'NO'}`,
  '',
  `Checkpoint alterado bloqueado: ${tamperedBlockedBeforeRestore ? 'SÍ' : 'NO'}`,
  `Factory tras alteración: ${tamperedFactoryCalls}`,
  '',
  `Otra sesión bloqueada: ${wrongSessionBlockedBeforeRestore ? 'SÍ' : 'NO'}`,
  `Factory con otra sesión: ${wrongSessionFactoryCalls}`,
  '',
  `Otro Gate Envelope bloqueado: ${wrongEnvelopeBlockedBeforeRestore ? 'SÍ' : 'NO'}`,
  `Factory con otro Envelope: ${wrongEnvelopeFactoryCalls}`,
  '',
  `Operaciones cambiadas bloqueadas: ${changedOperationsBlockedBeforeRestore ? 'SÍ' : 'NO'}`,
  `Factory con operaciones cambiadas: ${changedOperationsFactoryCalls}`,
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
    'verified-resume-test',
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
  '🔁 Verified Resume Runner',
);
console.log('');
console.log(
  `Checkpoint válido reanudado: ${validResumePasses ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory válida llamada: ${validFactoryCalls}`,
);
console.log('');
console.log(
  `Checkpoint alterado bloqueado: ${tamperedBlockedBeforeRestore ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory tras alteración: ${tamperedFactoryCalls}`,
);
console.log('');
console.log(
  `Otra sesión bloqueada: ${wrongSessionBlockedBeforeRestore ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory con otra sesión: ${wrongSessionFactoryCalls}`,
);
console.log('');
console.log(
  `Otro Gate Envelope bloqueado: ${wrongEnvelopeBlockedBeforeRestore ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory con otro Envelope: ${wrongEnvelopeFactoryCalls}`,
);
console.log('');
console.log(
  `Operaciones cambiadas bloqueadas: ${changedOperationsBlockedBeforeRestore ? 'SÍ' : 'NO'}`,
);
console.log(
  `Factory con operaciones cambiadas: ${changedOperationsFactoryCalls}`,
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
