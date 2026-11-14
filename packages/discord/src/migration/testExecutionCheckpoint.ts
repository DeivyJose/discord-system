import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

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

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const operations =
  JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        '.data',
        'migration-operations',
        'latest.json',
      ),
      'utf8',
    ),
  ) as MigrationOperationsPlan;

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
    `Se esperaban 24 operaciones automáticas de roles y se encontraron ${roleOperations.length}.`,
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
    'No fue posible resolver la tercera operación de roles.',
  );
}

console.log('');
console.log(
  '🧪 Probando Journal + Checkpoint Engine...',
);

console.log('');
console.log(
  `Fallo simulado en: ${failureTarget.id}`,
);

const firstAdapter =
  new FakeDiscordExecutionAdapter();

const firstRun =
  await executeWithJournal(
    firstAdapter,
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
              'Fallo sintético controlado para probar STOP + checkpoint.',
            );
          }
        },
    },
  );

const firstSnapshot =
  firstAdapter.snapshot();

const stoppedExactlyAtFailure =
  firstRun.status ===
    'stopped_on_error' &&
  firstRun.summary.succeeded ===
    2 &&
  firstRun.summary.failed ===
    1 &&
  firstRun.summary.attempted ===
    3 &&
  firstRun.checkpoint
    .nextOperationIndex ===
    failureIndex &&
  firstRun.checkpoint
    .failedOperationId ===
    failureTarget.id &&
  firstSnapshot.actions.length ===
    2;

console.log('');
console.log(
  'PRIMER RUN',
);

console.log(
  `Estado: ${firstRun.status}`,
);

console.log(
  `Intentadas: ${firstRun.summary.attempted}`,
);

console.log(
  `Exitosas: ${firstRun.summary.succeeded}`,
);

console.log(
  `Fallidas: ${firstRun.summary.failed}`,
);

console.log(
  `Acciones aplicadas al Fake: ${firstSnapshot.actions.length}`,
);

console.log(
  `Next index: ${firstRun.checkpoint.nextOperationIndex}`,
);

console.log(
  `STOP correcto: ${
    stoppedExactlyAtFailure
      ? 'SÍ'
      : 'NO'
  }`,
);

if (
  !stoppedExactlyAtFailure
) {
  throw new Error(
    'La primera ejecución no se detuvo exactamente en el fallo esperado.',
  );
}

const resumeIndex =
  firstRun.checkpoint
    .nextOperationIndex;

if (
  resumeIndex === null
) {
  throw new Error(
    'El checkpoint no contiene un índice de reanudación.',
  );
}

const resumedAdapter =
  new FakeDiscordExecutionAdapter(
    firstRun.checkpoint
      .adapterSnapshot,
  );

const resumedRun =
  await executeWithJournal(
    resumedAdapter,
    {
      phase:
        'roles',

      operations:
        roleOperations,

      startIndex:
        resumeIndex,
    },
  );

const finalSnapshot =
  resumedAdapter.snapshot();

const resumeCorrect =
  resumedRun.status ===
    'completed' &&
  resumedRun.summary.failed ===
    0 &&
  finalSnapshot.actions.length ===
    24 &&
  Object.keys(
    finalSnapshot.bindings,
  ).length ===
    24;

console.log('');
console.log(
  'REANUDACIÓN',
);

console.log(
  `Estado: ${resumedRun.status}`,
);

console.log(
  `Reinicio desde índice: ${resumeIndex}`,
);

console.log(
  `Intentadas en resume: ${resumedRun.summary.attempted}`,
);

console.log(
  `Exitosas en resume: ${resumedRun.summary.succeeded}`,
);

console.log(
  `Fallidas en resume: ${resumedRun.summary.failed}`,
);

console.log(
  `Acciones finales: ${finalSnapshot.actions.length}`,
);

console.log(
  `Bindings finales: ${Object.keys(finalSnapshot.bindings).length}`,
);

console.log(
  `Resume correcto: ${
    resumeCorrect
      ? 'SÍ'
      : 'NO'
  }`,
);

if (
  !resumeCorrect
) {
  throw new Error(
    'La reanudación desde checkpoint no produjo el estado esperado.',
  );
}

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

  firstRun,

  resumedRun,

  finalAdapterSnapshot:
    finalSnapshot,

  verification: {
    stoppedExactlyAtFailure,

    resumeCorrect,

    success:
      stoppedExactlyAtFailure &&
      resumeCorrect,
  },

  connectionToDiscord: false,

  executionAllowed: false,
};

const output: string[] = [
  'THE CLOCK — JOURNAL + CHECKPOINT TEST',
  '=====================================',
  '',
  `Fallo simulado: ${failureTarget.id}`,
  '',
  'PRIMER RUN',
  '----------',
  `Estado: ${firstRun.status}`,
  `Intentadas: ${firstRun.summary.attempted}`,
  `Exitosas: ${firstRun.summary.succeeded}`,
  `Fallidas: ${firstRun.summary.failed}`,
  `Next operation index: ${firstRun.checkpoint.nextOperationIndex}`,
  `Acciones antes del STOP: ${firstSnapshot.actions.length}`,
  `STOP correcto: ${stoppedExactlyAtFailure ? 'SÍ' : 'NO'}`,
  '',
  'REANUDACIÓN',
  '-----------',
  `Estado: ${resumedRun.status}`,
  `Start index: ${resumeIndex}`,
  `Intentadas: ${resumedRun.summary.attempted}`,
  `Exitosas: ${resumedRun.summary.succeeded}`,
  `Fallidas: ${resumedRun.summary.failed}`,
  `Acciones finales: ${finalSnapshot.actions.length}`,
  `Bindings finales: ${Object.keys(finalSnapshot.bindings).length}`,
  `Resume correcto: ${resumeCorrect ? 'SÍ' : 'NO'}`,
  '',
  'RESULTADO',
  '---------',
  `Prueba completa: ${result.verification.success ? 'SÍ' : 'NO'}`,
  '',
  'ADAPTER: FAKE',
  'CONEXIÓN A DISCORD: NO',
  'EJECUCIÓN REAL PERMITIDA: NO',
  '',
];

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'execution-journal-test',
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
  output.join('\n'),
  'utf8',
);

console.log('');
console.log(
  `Prueba completa: ${
    result.verification.success
      ? 'SÍ'
      : 'NO'
  }`,
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
  !result.verification.success
) {
  process.exitCode = 2;
}
