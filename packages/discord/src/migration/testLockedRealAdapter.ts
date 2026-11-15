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

import type {
  AutomatableMigrationOperation,
} from './executionAdapterTypes.js';

import {
  DiscordExecutionLockedError,
  LockedRealDiscordExecutionAdapter,
} from './lockedRealDiscordExecutionAdapter.js';

import type {
  DiscordMutationRequest,
  DiscordMutationTransport,
  DiscordMutationTransportResult,
} from './discordMutationRequestTypes.js';

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

if (
  automatable.length !==
    98
) {
  throw new Error(
    `Se esperaban 98 operaciones automáticas y se encontraron ${automatable.length}.`,
  );
}

let transportCalls =
  0;

const transport:
  DiscordMutationTransport = {
    async send(
      _request:
        DiscordMutationRequest,
    ): Promise<
      DiscordMutationTransportResult
    > {
      transportCalls +=
        1;

      /*
       * Si alguna vez llegamos aquí durante
       * esta etapa, la prueba debe fallar.
       */
      throw new Error(
        'SECURITY FAILURE: el transport no debía ser invocado.',
      );
    },
  };

const adapter =
  new LockedRealDiscordExecutionAdapter(
    transport,
  );

let blocked = 0;
let unexpected = 0;

const errors: {
  operationId: string;

  error: string;
}[] = [];

for (
  const operation
  of automatable
) {
  try {
    await dispatchExecutionOperation(
      adapter,
      operation,
    );

    unexpected +=
      1;
  } catch (
    error
  ) {
    if (
      error instanceof
        DiscordExecutionLockedError &&
      error.code ===
        'DISCORD_EXECUTION_HARD_LOCKED'
    ) {
      blocked +=
        1;

      continue;
    }

    unexpected +=
      1;

    errors.push({
      operationId:
        operation.id,

      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

const blockedRequests =
  adapter.getBlockedRequests();

const unresolvedRequests =
  blockedRequests.filter(
    (request) =>
      request.unresolvedFields
        .length > 0,
  );

const executionEnabledIsFalse =
  adapter.executionEnabled ===
    false;

const snapshot =
  adapter.snapshot();

const success =
  blocked ===
    98 &&
  unexpected ===
    0 &&
  transportCalls ===
    0 &&
  blockedRequests.length ===
    98 &&
  executionEnabledIsFalse &&
  snapshot.actions.length ===
    0 &&
  snapshot.resources.length ===
    0;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  summary: {
    automatableOperations:
      automatable.length,

    blocked,

    unexpected,

    transportCalls,

    compiledRequests:
      blockedRequests.length,

    unresolvedRequests:
      unresolvedRequests.length,

    executionEnabled:
      adapter.executionEnabled,

    adapterActions:
      snapshot.actions.length,

    success,
  },

  unresolved:
    unresolvedRequests.map(
      (request) => ({
        operationId:
          request.operationId,

        operationType:
          request.operationType,

        unresolvedFields:
          request.unresolvedFields,
      }),
    ),

  errors,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — LOCKED REAL ADAPTER TEST',
  '====================================',
  '',
  `Operaciones automáticas: ${automatable.length}`,
  `Bloqueadas por hard lock: ${blocked}`,
  `Resultados inesperados: ${unexpected}`,
  `Requests compiladas: ${blockedRequests.length}`,
  `Requests con datos pendientes: ${unresolvedRequests.length}`,
  '',
  `Transport calls: ${transportCalls}`,
  `executionEnabled: ${adapter.executionEnabled}`,
  `Adapter actions: ${snapshot.actions.length}`,
  '',
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
  '',
  'ADAPTER MODE: REAL / HARD-LOCKED',
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
    'locked-real-adapter-test',
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
  '🔒 Locked Real Discord Adapter',
);
console.log('');
console.log(
  `Operaciones automáticas: ${automatable.length}`,
);
console.log(
  `Bloqueadas: ${blocked}`,
);
console.log(
  `Transport calls: ${transportCalls}`,
);
console.log(
  `Requests compiladas: ${blockedRequests.length}`,
);
console.log(
  `Requests con datos pendientes: ${unresolvedRequests.length}`,
);
console.log('');
console.log(
  `executionEnabled: ${adapter.executionEnabled}`,
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
