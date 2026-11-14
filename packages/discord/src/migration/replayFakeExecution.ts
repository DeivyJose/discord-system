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
  dispatchExecutionOperation,
  isAutomatableOperation,
} from './executionAdapter.js';

import {
  FakeDiscordExecutionAdapter,
} from './fakeDiscordExecutionAdapter.js';

type ReplayPhase =
  | 'roles'
  | 'categories'
  | 'renames'
  | 'channels'
  | 'moves';

interface ReplayCheckpoint {
  phase: ReplayPhase;

  attempted: number;

  simulated: number;

  failed: number;

  actionsAfterPhase: number;

  bindingsAfterPhase: number;
}

function phaseForType(
  type: string,
): ReplayPhase | null {
  switch (
    type
  ) {
    case 'create_role':
      return 'roles';

    case 'create_category':
      return 'categories';

    case 'rename_role':
    case 'rename_category':
    case 'rename_channel':
      return 'renames';

    case 'create_channel':
      return 'channels';

    case 'move_channel':
      return 'moves';

    default:
      return null;
  }
}

const PHASE_ORDER:
  readonly ReplayPhase[] = [
    'roles',
    'categories',
    'renames',
    'channels',
    'moves',
  ];

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const operationsPath =
  path.join(
    projectRoot,
    '.data',
    'migration-operations',
    'latest.json',
  );

const operations =
  JSON.parse(
    await readFile(
      operationsPath,
      'utf8',
    ),
  ) as MigrationOperationsPlan;

const adapter =
  new FakeDiscordExecutionAdapter();

const checkpoints:
  ReplayCheckpoint[] = [];

const errors: {
  operationId: string;

  message: string;
}[] = [];

const skippedManual =
  operations.operations.filter(
    (operation) =>
      !isAutomatableOperation(
        operation,
      ),
  );

console.log('');
console.log(
  '🎭 Iniciando Fake Execution Replay...',
);

console.log('');
console.log(
  'Este comando NO conecta con Discord.',
);

for (
  const phase
  of PHASE_ORDER
) {
  const phaseOperations =
    operations.operations.filter(
      (operation) =>
        isAutomatableOperation(
          operation,
        ) &&
        phaseForType(
          operation.type,
        ) === phase,
    );

  let simulated = 0;
  let failed = 0;

  for (
    const operation
    of phaseOperations
  ) {
    if (
      !isAutomatableOperation(
        operation,
      )
    ) {
      continue;
    }

    try {
      await dispatchExecutionOperation(
        adapter,
        operation,
      );

      simulated += 1;
    } catch (
      error
    ) {
      failed += 1;

      errors.push({
        operationId:
          operation.id,

        message:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const snapshot =
    adapter.snapshot();

  checkpoints.push({
    phase,

    attempted:
      phaseOperations.length,

    simulated,

    failed,

    actionsAfterPhase:
      snapshot.actions.length,

    bindingsAfterPhase:
      Object.keys(
        snapshot.bindings,
      ).length,
  });
}

const snapshot =
  adapter.snapshot();

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  mode:
    adapter.mode,

  source: {
    guild:
      operations.guild,

    operationsGeneratedAt:
      operations.generatedAt,

    totalOperations:
      operations.operations.length,
  },

  summary: {
    total:
      operations.operations.length,

    automatable:
      snapshot.actions.length,

    manualSkipped:
      skippedManual.length,

    failed:
      errors.length,

    fakeBindings:
      Object.keys(
        snapshot.bindings,
      ).length,

    fakeResources:
      snapshot.resources.length,

    success:
      snapshot.actions.length ===
        98 &&
      skippedManual.length ===
        10 &&
      errors.length ===
        0,
  },

  checkpoints,

  skippedManual:
    skippedManual.map(
      (operation) => ({
        id:
          operation.id,

        type:
          operation.type,

        resourceKind:
          operation.resourceKind,
      }),
    ),

  errors,

  adapter:
    snapshot,

  executionAllowed: false,
};

const output: string[] = [
  'THE CLOCK — FAKE EXECUTION REPLAY',
  '=================================',
  '',
  `Generado: ${result.generatedAt}`,
  `Modo: ${result.mode}`,
  '',
  'CHECKPOINTS',
  '-----------',
];

for (
  const checkpoint
  of checkpoints
) {
  output.push(
    '',
    `Fase: ${checkpoint.phase}`,
    `  Intentadas: ${checkpoint.attempted}`,
    `  Simuladas: ${checkpoint.simulated}`,
    `  Fallidas: ${checkpoint.failed}`,
    `  Acciones acumuladas: ${checkpoint.actionsAfterPhase}`,
    `  Bindings ficticios: ${checkpoint.bindingsAfterPhase}`,
  );
}

output.push(
  '',
  'RESUMEN',
  '-------',
  `Operaciones totales: ${result.summary.total}`,
  `Automáticas simuladas: ${result.summary.automatable}`,
  `Manuales omitidas: ${result.summary.manualSkipped}`,
  `Fallidas: ${result.summary.failed}`,
  `Bindings ficticios: ${result.summary.fakeBindings}`,
  `Recursos ficticios: ${result.summary.fakeResources}`,
  '',
  `Replay correcto: ${
    result.summary.success
      ? 'SÍ'
      : 'NO'
  }`,
  '',
  'ADAPTER: FAKE',
  'CONEXIÓN A DISCORD: NO',
  'EJECUCIÓN REAL PERMITIDA: NO',
  '',
);

if (
  errors.length > 0
) {
  output.push(
    'ERRORES',
    '-------',
  );

  for (
    const error
    of errors
  ) {
    output.push(
      `- ${error.operationId}: ${error.message}`,
    );
  }

  output.push('');
}

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'fake-execution-replay',
  );

await mkdir(
  outputDirectory,
  {
    recursive: true,
  },
);

const jsonPath =
  path.join(
    outputDirectory,
    'latest.json',
  );

const textPath =
  path.join(
    outputDirectory,
    'latest.txt',
  );

await writeFile(
  jsonPath,
  JSON.stringify(
    result,
    null,
    2,
  ) + '\n',
  'utf8',
);

await writeFile(
  textPath,
  output.join('\n'),
  'utf8',
);

console.log('');
console.log(
  '✅ Fake Execution Replay terminado.',
);

console.log('');
console.log(
  `Operaciones totales:    ${result.summary.total}`,
);

console.log(
  `Automáticas simuladas:  ${result.summary.automatable}`,
);

console.log(
  `Manuales omitidas:      ${result.summary.manualSkipped}`,
);

console.log(
  `Fallidas:               ${result.summary.failed}`,
);

console.log(
  `Bindings ficticios:     ${result.summary.fakeBindings}`,
);

console.log('');

console.log(
  `Replay correcto: ${
    result.summary.success
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

console.log(
  `Reporte: ${textPath}`,
);

console.log('');

if (
  !result.summary.success
) {
  process.exitCode = 2;
}
