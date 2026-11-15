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
} from './executionAdapterTypes.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordMutationRequest,
  DiscordMutationTransport,
  DiscordMutationTransportResult,
} from './discordMutationRequestTypes.js';

import type {
  MutationResolverBindings,
} from './discordMutationResolverTypes.js';

import {
  DiscordExecutionLockedError,
  LockedRealDiscordExecutionAdapter,
} from './lockedRealDiscordExecutionAdapter.js';

import {
  DiscordMutationResolutionBlockedError,
  executeResolvedLockedMutation,
} from './resolvedLockedExecution.js';

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

const operations =
  await readJson<
    MigrationOperationsPlan
  >(
    '.data',
    'migration-operations',
    'latest.json',
  );

const bindingFile =
  await readJson<
    BindingFile
  >(
    '.data',
    'discord-bindings.json',
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

if (
  automatable.length !==
    98
) {
  throw new Error(
    `Se esperaban 98 operaciones automáticas y se encontraron ${automatable.length}.`,
  );
}

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

      throw new Error(
        'SECURITY FAILURE: transport.send() fue invocado.',
      );
    },
  };

/*
 * TEST 1
 *
 * Falta category_cdn_public.
 * Debe bloquearse ANTES del hard lock.
 */
const incompleteAdapter =
  new LockedRealDiscordExecutionAdapter(
    transport,
  );

const incompleteBindings:
  MutationResolverBindings = {
    confirmed:
      bindingFile.resources,

    session: {},
  };

let resolutionBlocked =
  false;

let hardLockReachedForIncomplete =
  false;

try {
  await executeResolvedLockedMutation(
    incompleteAdapter,
    cdnOperation,
    incompleteBindings,
  );
} catch (
  error
) {
  if (
    error instanceof
      DiscordMutationResolutionBlockedError
  ) {
    resolutionBlocked =
      true;
  }

  if (
    error instanceof
      DiscordExecutionLockedError
  ) {
    hardLockReachedForIncomplete =
      true;
  }
}

const incompleteBlockedRequests =
  incompleteAdapter
    .getBlockedRequests()
    .length;

const incompleteCorrect =
  resolutionBlocked &&
  !hardLockReachedForIncomplete &&
  incompleteBlockedRequests ===
    0 &&
  transportCalls ===
    0;

/*
 * TEST 2
 *
 * category_cdn_public ya fue creada
 * durante la sesión.
 *
 * Ahora la resolución debe pasar y
 * debemos llegar al HARD LOCK.
 */
const completeSingleAdapter =
  new LockedRealDiscordExecutionAdapter(
    transport,
  );

const cdnParentActualId =
  'session_category_cdn_public';

const singleCompleteBindings:
  MutationResolverBindings = {
    confirmed:
      bindingFile.resources,

    session: {
      category_cdn_public:
        cdnParentActualId,
    },
  };

let singleHardLocked =
  false;

let singleResolutionBlocked =
  false;

try {
  await executeResolvedLockedMutation(
    completeSingleAdapter,
    cdnOperation,
    singleCompleteBindings,
  );
} catch (
  error
) {
  if (
    error instanceof
      DiscordExecutionLockedError
  ) {
    singleHardLocked =
      error.request
        .operationId ===
        cdnOperation.id;
  }

  if (
    error instanceof
      DiscordMutationResolutionBlockedError
  ) {
    singleResolutionBlocked =
      true;
  }
}

const singleBlockedRequest =
  completeSingleAdapter
    .getBlockedRequests()[0];

const singleCorrect =
  singleHardLocked &&
  !singleResolutionBlocked &&
  completeSingleAdapter
    .getBlockedRequests()
    .length === 1 &&
  transportCalls ===
    0;

/*
 * TEST 3
 *
 * Simulamos que las 13 categorías
 * nuevas ya fueron creadas.
 */
const categoryOperations =
  automatable.filter(
    (operation) =>
      operation.type ===
      'create_category',
  );

if (
  categoryOperations.length !==
    13
) {
  throw new Error(
    `Se esperaban 13 categorías nuevas y se encontraron ${categoryOperations.length}.`,
  );
}

const sessionBindings:
  Record<string, string> = {};

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

  sessionBindings[
    operation.blueprintId
  ] =
    `session_${operation.blueprintId}`;
}

const fullBindings:
  MutationResolverBindings = {
    confirmed:
      bindingFile.resources,

    session:
      sessionBindings,
  };

const allAdapter =
  new LockedRealDiscordExecutionAdapter(
    transport,
  );

let allHardLocked =
  0;

let allResolutionBlocked =
  0;

let unexpected =
  0;

const errors: {
  operationId: string;

  error: string;
}[] = [];

for (
  const operation
  of automatable
) {
  try {
    await executeResolvedLockedMutation(
      allAdapter,
      operation,
      fullBindings,
    );

    unexpected +=
      1;
  } catch (
    error
  ) {
    if (
      error instanceof
        DiscordExecutionLockedError
    ) {
      allHardLocked +=
        1;

      continue;
    }

    if (
      error instanceof
        DiscordMutationResolutionBlockedError
    ) {
      allResolutionBlocked +=
        1;

      errors.push({
        operationId:
          operation.id,

        error:
          error.message,
      });

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

const allBlockedRequests =
  allAdapter
    .getBlockedRequests();

const allCorrect =
  allHardLocked ===
    98 &&
  allResolutionBlocked ===
    0 &&
  unexpected ===
    0 &&
  allBlockedRequests.length ===
    98 &&
  transportCalls ===
    0;

const success =
  incompleteCorrect &&
  singleCorrect &&
  allCorrect;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  tests: {
    incompleteRequest: {
      resolutionBlocked,

      hardLockReached:
        hardLockReachedForIncomplete,

      blockedRequests:
        incompleteBlockedRequests,

      success:
        incompleteCorrect,
    },

    completeRequest: {
      resolutionBlocked:
        singleResolutionBlocked,

      hardLocked:
        singleHardLocked,

      blockedRequests:
        completeSingleAdapter
          .getBlockedRequests()
          .length,

      blockedOperationId:
        singleBlockedRequest
          ?.operationId ??
        null,

      success:
        singleCorrect,
    },

    allOperations: {
      operations:
        automatable.length,

      hardLocked:
        allHardLocked,

      resolutionBlocked:
        allResolutionBlocked,

      unexpected,

      blockedRequests:
        allBlockedRequests.length,

      success:
        allCorrect,
    },
  },

  transportCalls,

  errors,

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — RESOLVED LOCKED EXECUTION TEST',
  '==========================================',
  '',
  'REQUEST INCOMPLETA',
  '------------------',
  `Resolution block: ${resolutionBlocked ? 'SÍ' : 'NO'}`,
  `Hard lock alcanzado: ${hardLockReachedForIncomplete ? 'SÍ' : 'NO'}`,
  `Requests dentro del adapter: ${incompleteBlockedRequests}`,
  '',
  'REQUEST COMPLETA',
  '----------------',
  `Resolution block: ${singleResolutionBlocked ? 'SÍ' : 'NO'}`,
  `Hard lock alcanzado: ${singleHardLocked ? 'SÍ' : 'NO'}`,
  `Requests dentro del adapter: ${completeSingleAdapter.getBlockedRequests().length}`,
  '',
  '98 OPERACIONES',
  '--------------',
  `Hard locked: ${allHardLocked}`,
  `Resolution blocked: ${allResolutionBlocked}`,
  `Unexpected: ${unexpected}`,
  `Requests dentro del adapter: ${allBlockedRequests.length}`,
  '',
  `Transport calls: ${transportCalls}`,
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
    'resolved-locked-execution-test',
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
  '🔐 Resolved Locked Discord Execution',
);
console.log('');

console.log(
  `Request incompleta bloqueada por resolver: ${incompleteCorrect ? 'SÍ' : 'NO'}`,
);

console.log(
  `Hard lock alcanzado con request incompleta: ${hardLockReachedForIncomplete ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Request completa llega al hard lock: ${singleCorrect ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `98 operaciones hard locked: ${allHardLocked}`,
);

console.log(
  `Resolution blocked inesperadas: ${allResolutionBlocked}`,
);

console.log(
  `Transport calls: ${transportCalls}`,
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
