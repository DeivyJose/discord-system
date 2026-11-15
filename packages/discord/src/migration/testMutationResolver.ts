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
  compileDiscordMutationRequest,
} from './discordMutationRequest.js';

import {
  resolveDiscordMutationRequest,
} from './discordMutationResolver.js';

import type {
  MutationResolverBindings,
} from './discordMutationResolverTypes.js';

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

const compiled =
  automatable.map(
    (
      operation,
    ) =>
      compileDiscordMutationRequest(
        operation,
      ),
  );

/*
 * TEST 1
 *
 * Solo los bindings que existen antes
 * de la migración.
 */
const baselineBindings:
  MutationResolverBindings = {
    confirmed:
      bindingFile.resources,

    session: {},
  };

const baselineResolved =
  compiled.map(
    (
      request,
    ) =>
      resolveDiscordMutationRequest(
        request,
        baselineBindings,
      ),
  );

const baselinePending =
  baselineResolved.filter(
    (result) =>
      !result.ready,
  );

const baselinePendingParents =
  baselinePending.filter(
    (result) =>
      result.request
        .resolverUnresolvedFields
        .includes(
          'resolvedParentActualId',
        ),
  );

const detectsMissingNewParents =
  baselinePendingParents.length >
    0;

/*
 * TEST 2
 *
 * Simulamos los bindings generados
 * después de ejecutar correctamente
 * la fase de categorías.
 */
const createCategories =
  automatable.filter(
    (
      operation,
    ) =>
      operation.type ===
      'create_category',
  );

if (
  createCategories.length !==
    13
) {
  throw new Error(
    `Se esperaban 13 create_category y se encontraron ${createCategories.length}.`,
  );
}

const sessionCategoryBindings:
  Record<string, string> = {};

for (
  const operation
  of createCategories
) {
  if (
    !operation.blueprintId
  ) {
    throw new Error(
      `create_category sin blueprintId: ${operation.id}`,
    );
  }

  sessionCategoryBindings[
    operation.blueprintId
  ] =
    `session_${operation.blueprintId}`;
}

const completeBindings:
  MutationResolverBindings = {
    confirmed:
      bindingFile.resources,

    session:
      sessionCategoryBindings,
  };

const fullyResolved =
  compiled.map(
    (
      request,
    ) =>
      resolveDiscordMutationRequest(
        request,
        completeBindings,
      ),
  );

const finalPending =
  fullyResolved.filter(
    (result) =>
      !result.ready,
  );

/*
 * TEST 3
 *
 * Caso importante:
 *
 * channel_cdn_latest pertenece a
 * category_cdn_public, y esa categoría
 * es nueva.
 *
 * Debe usar el binding de la sesión.
 */
const cdnLatest =
  fullyResolved.find(
    (result) =>
      result.request
        .blueprintId ===
      'channel_cdn_latest',
  );

if (
  !cdnLatest
) {
  throw new Error(
    'No se encontró channel_cdn_latest.',
  );
}

const expectedCdnParent =
  sessionCategoryBindings[
    'category_cdn_public'
  ];

const newParentUsesSessionBinding =
  cdnLatest.request
    .resolvedParentBlueprintId ===
      'category_cdn_public' &&
  cdnLatest.request
    .resolvedParentActualId ===
      expectedCdnParent &&
  cdnLatest.request
    .parentActualIdSource ===
      'session';

/*
 * TEST 4
 *
 * Un canal cuya categoría ya existía
 * debe conservar exactamente el actualId
 * autorizado que quedó incorporado
 * en la operación.
 */
const guide =
  fullyResolved.find(
    (result) =>
      result.request
        .blueprintId ===
      'channel_guide',
  );

if (
  !guide
) {
  throw new Error(
    'No se encontró channel_guide.',
  );
}

const existingParentUsesAuthorizedOperationId =
  guide.request
    .resolvedParentBlueprintId ===
      'category_entry' &&
  guide.request
    .resolvedParentActualId ===
      bindingFile.resources[
        'category_entry'
      ] &&
  guide.request
    .parentActualIdSource ===
      'operation';

/*
 * TEST 5
 *
 * El Blueprint enriquecido debe
 * preservar metadatos reales.
 */
const owner =
  fullyResolved.find(
    (result) =>
      result.request
        .blueprintId ===
      'role_owner',
  );

const ownerBlueprintPreserved =
  owner?.request
    .blueprintResource
    ?.definition
    .priority ===
      1000 &&
  owner.request
    .blueprintResource
    ?.definition
    .hoist ===
      true &&
  owner.request
    .blueprintResource
    ?.definition
    .mentionable ===
      false;

const allResolved =
  finalPending.length ===
    0 &&
  fullyResolved.length ===
    98;

const success =
  detectsMissingNewParents &&
  newParentUsesSessionBinding &&
  existingParentUsesAuthorizedOperationId &&
  ownerBlueprintPreserved &&
  allResolved;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  summary: {
    automatableOperations:
      automatable.length,

    confirmedBindings:
      Object.keys(
        bindingFile.resources,
      ).length,

    simulatedSessionBindings:
      Object.keys(
        sessionCategoryBindings,
      ).length,

    baselinePending:
      baselinePending.length,

    baselinePendingParents:
      baselinePendingParents.length,

    finalResolved:
      fullyResolved.filter(
        (item) =>
          item.ready,
      ).length,

    finalPending:
      finalPending.length,

    success,
  },

  checks: {
    detectsMissingNewParents,

    newParentUsesSessionBinding,

    existingParentUsesAuthorizedOperationId,

    ownerBlueprintPreserved,

    allResolved,
  },

  cdnLatest: {
    expectedParentActualId:
      expectedCdnParent,

    actual:
      cdnLatest.request,
  },

  guide: {
    expectedParentActualId:
      bindingFile.resources[
        'category_entry'
      ],

    actual:
      guide.request,
  },

  unresolved:
    finalPending.map(
      (item) => ({
        operationId:
          item.request.operationId,

        blueprintId:
          item.request.blueprintId,

        fields:
          item.request
            .resolverUnresolvedFields,
      }),
    ),

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — MUTATION REQUEST RESOLVER TEST',
  '==========================================',
  '',
  `Operaciones automáticas: ${automatable.length}`,
  `Bindings confirmados: ${Object.keys(bindingFile.resources).length}`,
  `Bindings de sesión simulados: ${Object.keys(sessionCategoryBindings).length}`,
  '',
  `Pendientes antes de crear categorías: ${baselinePending.length}`,
  `Parents nuevos detectados: ${baselinePendingParents.length}`,
  '',
  `Requests resueltas al final: ${fullyResolved.filter((item) => item.ready).length}`,
  `Requests pendientes al final: ${finalPending.length}`,
  '',
  `Detecta parents aún no creados: ${detectsMissingNewParents ? 'SÍ' : 'NO'}`,
  `Canal CDN usa binding de sesión: ${newParentUsesSessionBinding ? 'SÍ' : 'NO'}`,
  `Canal guía usa parent autorizado de la operación: ${existingParentUsesAuthorizedOperationId ? 'SÍ' : 'NO'}`,
  `Metadatos Blueprint preservados: ${ownerBlueprintPreserved ? 'SÍ' : 'NO'}`,
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
    'mutation-resolver-test',
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
  '🧩 Mutation Request Resolver',
);
console.log('');

console.log(
  `Pendientes antes de crear categorías: ${baselinePending.length}`,
);

console.log(
  `Parents nuevos detectados: ${baselinePendingParents.length}`,
);

console.log('');

console.log(
  `Requests resueltas al final: ${fullyResolved.filter((item) => item.ready).length}`,
);

console.log(
  `Requests pendientes al final: ${finalPending.length}`,
);

console.log('');

console.log(
  `Canal CDN usa binding de sesión: ${newParentUsesSessionBinding ? 'SÍ' : 'NO'}`,
);

console.log(
  `Canal guía usa parent autorizado de la operación: ${existingParentUsesAuthorizedOperationId ? 'SÍ' : 'NO'}`,
);

console.log(
  `Metadatos Blueprint preservados: ${ownerBlueprintPreserved ? 'SÍ' : 'NO'}`,
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
