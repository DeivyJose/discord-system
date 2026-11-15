import {
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import type {
  HierarchyBootstrapPlan,
} from './hierarchyBootstrapTypes.js';

import {
  createMigrationGate,
} from './migrationGate.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordMigrationPreflight,
} from './preflightTypes.js';

import type {
  DiscordBindings,
} from './types.js';

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

function reorderObjectKeys<T>(
  value: T,
): T {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      (item) =>
        reorderObjectKeys(
          item,
        ),
    ) as T;
  }

  if (
    typeof value ===
      'object' &&
    value !== null
  ) {
    const source =
      value as
        Record<string, unknown>;

    const output:
      Record<string, unknown> =
      {};

    for (
      const key
      of Object.keys(
        source,
      ).reverse()
    ) {
      output[key] =
        reorderObjectKeys(
          source[key],
        );
    }

    return output as T;
  }

  return value;
}

const snapshot =
  await readJson<
    DiscordGuildSnapshot
  >(
    '.data',
    'discord-snapshots',
    'latest.json',
  );

const bindings =
  await readJson<
    DiscordBindings
  >(
    '.data',
    'discord-bindings.json',
  );

const operations =
  await readJson<
    MigrationOperationsPlan
  >(
    '.data',
    'migration-operations',
    'latest.json',
  );

const executionPreview =
  await readJson<
    DiscordExecutionPreview
  >(
    '.data',
    'execution-preview',
    'latest.json',
  );

const preflight =
  await readJson<
    DiscordMigrationPreflight
  >(
    '.data',
    'migration-preflight',
    'latest.json',
  );

const hierarchy =
  await readJson<
    HierarchyBootstrapPlan
  >(
    '.data',
    'hierarchy-bootstrap',
    'latest.json',
  );

/*
 * Usamos una hora sintética cercana al snapshot.
 * Esta prueba estudia el fingerprint, no la
 * expiración real del snapshot histórico.
 */
const syntheticNow =
  new Date(
    new Date(
      snapshot.capturedAt,
    ).getTime() +
    60_000,
  );

const baseline =
  createMigrationGate(
    {
      snapshot,

      bindings,

      operations,

      executionPreview,

      preflight,

      hierarchy,
    },
    syntheticNow,
  );

const fingerprintFormatValid =
  baseline.schemaVersion ===
    2 &&
  baseline.fingerprintVersion ===
    2 &&
  /^[a-f0-9]{64}$/i.test(
    baseline.fingerprint,
  ) &&
  baseline.executionAllowed ===
    false;

/*
 * ============================================
 * ATTACK 1 — OPERATION CONTENT
 * ============================================
 */
const changedOperationPlan =
  structuredClone(
    operations,
  );

const renamedOperation =
  changedOperationPlan
    .operations
    .find(
      (operation) =>
        typeof operation
          .desiredName ===
        'string',
    );

if (
  !renamedOperation ||
  typeof renamedOperation
    .desiredName !==
    'string'
) {
  throw new Error(
    'No existe una operación con desiredName para la prueba.',
  );
}

renamedOperation.desiredName =
  `${renamedOperation.desiredName}-TAMPERED`;

const operationGate =
  createMigrationGate(
    {
      snapshot,

      bindings,

      operations:
        changedOperationPlan,

      executionPreview,

      preflight,

      hierarchy,
    },
    syntheticNow,
  );

const changedOperationDetected =
  operationGate.fingerprint !==
    baseline.fingerprint;

/*
 * ============================================
 * ATTACK 2 — OPERATION ORDER
 * ============================================
 */
const reorderedOperations =
  structuredClone(
    operations,
  );

const firstOperation =
  reorderedOperations
    .operations[0];

const secondOperation =
  reorderedOperations
    .operations[1];

if (
  !firstOperation ||
  !secondOperation
) {
  throw new Error(
    'No hay suficientes operaciones para alterar el orden.',
  );
}

reorderedOperations
  .operations[0] =
  secondOperation;

reorderedOperations
  .operations[1] =
  firstOperation;

const orderGate =
  createMigrationGate(
    {
      snapshot,

      bindings,

      operations:
        reorderedOperations,

      executionPreview,

      preflight,

      hierarchy,
    },
    syntheticNow,
  );

const changedOperationOrderDetected =
  orderGate.fingerprint !==
    baseline.fingerprint;

/*
 * ============================================
 * ATTACK 3 — BINDING
 * ============================================
 */
const changedBindings =
  structuredClone(
    bindings,
  );

const firstBinding =
  Object.entries(
    changedBindings.resources,
  )[0];

if (
  !firstBinding
) {
  throw new Error(
    'No existen bindings para la prueba.',
  );
}

changedBindings.resources[
  firstBinding[0]
] =
  `${firstBinding[1]}_TAMPERED`;

const bindingGate =
  createMigrationGate(
    {
      snapshot,

      bindings:
        changedBindings,

      operations,

      executionPreview,

      preflight,

      hierarchy,
    },
    syntheticNow,
  );

const changedBindingDetected =
  bindingGate.fingerprint !==
    baseline.fingerprint;

/*
 * ============================================
 * ATTACK 4 — EXECUTION PREVIEW
 * ============================================
 */
const changedPreview =
  structuredClone(
    executionPreview,
  );

const previewStep =
  changedPreview.steps[0];

if (
  !previewStep
) {
  throw new Error(
    'Execution Preview sin steps.',
  );
}

previewStep.label =
  `${previewStep.label} TAMPERED`;

const previewGate =
  createMigrationGate(
    {
      snapshot,

      bindings,

      operations,

      executionPreview:
        changedPreview,

      preflight,

      hierarchy,
    },
    syntheticNow,
  );

const changedPreviewDetected =
  previewGate.fingerprint !==
    baseline.fingerprint;

/*
 * ============================================
 * ATTACK 5 — STRUCTURAL SNAPSHOT
 * ============================================
 */
const changedSnapshot =
  structuredClone(
    snapshot,
  );

const snapshotChannel =
  changedSnapshot.channels[0];

if (
  !snapshotChannel
) {
  throw new Error(
    'Snapshot sin canales.',
  );
}

snapshotChannel.name =
  `${snapshotChannel.name}-TAMPERED`;

const snapshotGate =
  createMigrationGate(
    {
      snapshot:
        changedSnapshot,

      bindings,

      operations,

      executionPreview,

      preflight,

      hierarchy,
    },
    syntheticNow,
  );

const changedSnapshotDetected =
  snapshotGate.fingerprint !==
    baseline.fingerprint;

/*
 * ============================================
 * ATTACK 6 — PREFLIGHT
 * ============================================
 */
const changedPreflight =
  structuredClone(
    preflight,
  );

changedPreflight
  .bot
  .manageChannels =
  !changedPreflight
    .bot
    .manageChannels;

const preflightGate =
  createMigrationGate(
    {
      snapshot,

      bindings,

      operations,

      executionPreview,

      preflight:
        changedPreflight,

      hierarchy,
    },
    syntheticNow,
  );

const changedPreflightDetected =
  preflightGate.fingerprint !==
    baseline.fingerprint;

/*
 * ============================================
 * ATTACK 7 — HIERARCHY
 * ============================================
 */
const changedHierarchy =
  structuredClone(
    hierarchy,
  );

const hierarchyRole =
  changedHierarchy.roles[0];

if (
  !hierarchyRole
) {
  throw new Error(
    'Hierarchy sin roles.',
  );
}

hierarchyRole.desiredName =
  `${hierarchyRole.desiredName}-TAMPERED`;

const hierarchyGate =
  createMigrationGate(
    {
      snapshot,

      bindings,

      operations,

      executionPreview,

      preflight,

      hierarchy:
        changedHierarchy,
    },
    syntheticNow,
  );

const changedHierarchyDetected =
  hierarchyGate.fingerprint !==
    baseline.fingerprint;

/*
 * ============================================
 * CANONICALIZATION TEST
 *
 * Cambiamos solamente orden de claves de
 * objetos. Arrays conservan el mismo orden.
 * ============================================
 */
const canonicalGate =
  createMigrationGate(
    {
      snapshot:
        reorderObjectKeys(
          snapshot,
        ),

      bindings:
        reorderObjectKeys(
          bindings,
        ),

      operations:
        reorderObjectKeys(
          operations,
        ),

      executionPreview:
        reorderObjectKeys(
          executionPreview,
        ),

      preflight:
        reorderObjectKeys(
          preflight,
        ),

      hierarchy:
        reorderObjectKeys(
          hierarchy,
        ),
    },
    syntheticNow,
  );

const objectKeyOrderIndependent =
  canonicalGate.fingerprint ===
    baseline.fingerprint;

/*
 * generatedAt del Gate no forma parte del
 * contenido autorizado. El mismo conjunto
 * de artefactos debe tener el mismo hash.
 */
const laterGate =
  createMigrationGate(
    {
      snapshot,

      bindings,

      operations,

      executionPreview,

      preflight,

      hierarchy,
    },
    new Date(
      syntheticNow.getTime() +
      30_000,
    ),
  );

const generationTimeIndependent =
  laterGate.fingerprint ===
    baseline.fingerprint;

const success =
  fingerprintFormatValid &&
  changedOperationDetected &&
  changedOperationOrderDetected &&
  changedBindingDetected &&
  changedPreviewDetected &&
  changedSnapshotDetected &&
  changedPreflightDetected &&
  changedHierarchyDetected &&
  objectKeyOrderIndependent &&
  generationTimeIndependent;

console.log('');
console.log(
  '🔐 Migration Gate Content Fingerprint v2',
);
console.log('');

console.log(
  `Formato/versionado correcto: ${fingerprintFormatValid ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Operación alterada detectada: ${changedOperationDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Orden de operaciones alterado detectado: ${changedOperationOrderDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Binding alterado detectado: ${changedBindingDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Preview alterado detectado: ${changedPreviewDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Snapshot alterado detectado: ${changedSnapshotDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Preflight alterado detectado: ${changedPreflightDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Hierarchy alterada detectada: ${changedHierarchyDetected ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Orden de claves JSON independiente: ${objectKeyOrderIndependent ? 'SÍ' : 'NO'}`,
);

console.log(
  `Hora de generación independiente: ${generationTimeIndependent ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Fingerprint base: ${baseline.fingerprint}`,
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
