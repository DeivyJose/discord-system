import {
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import {
  evaluateSingleOperationCanary,
} from './canaryGuard.js';

import {
  SimulatedCanaryAdapter,
  SimulatedCanaryAdapterError,
} from './simulatedCanaryAdapter.js';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const session =
  JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        '.data',
        'execution-sessions',
        'latest.json',
      ),
      'utf8',
    ),
  ) as ExecutionSessionPlan;

const rawSnapshot =
  JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        '.data',
        'discord-snapshots',
        'latest.json',
      ),
      'utf8',
    ),
  ) as DiscordGuildSnapshot;

const normalized =
  normalizeDiscordStructureSnapshot(
    rawSnapshot,
  );

const driftContext = {
  sessionId:
    session.sessionId,

  gateFingerprint:
    session.gateFingerprint,

  gateEnvelopeFingerprint:
    session.gateEnvelopeFingerprint,
};

const baseline =
  createLiveDriftBaseline(
    normalized,
    driftContext,
    new Date(
      session.source
        .snapshotCapturedAt,
    ),
  );

/*
 * Punto temporal histórico válido:
 * después del Receipt,
 * antes de su expiración,
 * y dentro de los 30 min del snapshot.
 */
const validNow =
  new Date(
    '2026-11-17T02:23:00.000Z',
  );

/*
 * ========================================================
 * TEST 1 — GUARD VÁLIDO
 * ========================================================
 */

const validGuard =
  evaluateSingleOperationCanary({
    session,

    baseline,

    currentSnapshot:
      structuredClone(
        normalized,
      ),

    now:
      validNow,
  });

const validGuardPasses =
  validGuard.status ===
    'ready_for_simulation' &&
  validGuard.intent !==
    null &&
  validGuard.executionAllowed ===
    false;

/*
 * ========================================================
 * TEST 2 — ADAPTER SIMULADO + SINGLE USE
 * ========================================================
 */

const adapter =
  new SimulatedCanaryAdapter();

if (
  !validGuard.intent
) {
  throw new Error(
    'El Guard válido no produjo intent.',
  );
}

const simulatedAction =
  await adapter.simulateCreateRole(
    validGuard.intent,
  );

const simulationPasses =
  simulatedAction.status ===
    'simulated' &&
  simulatedAction.actualId ===
    null &&
  adapter.getActions().length ===
    1 &&
  adapter.executionEnabled ===
    false;

let secondCallBlocked =
  false;

try {
  await adapter.simulateCreateRole(
    validGuard.intent,
  );
} catch (
  error
) {
  secondCallBlocked =
    error instanceof
      SimulatedCanaryAdapterError &&
    error.code ===
      'CANARY_SINGLE_USE_CONSUMED';
}

/*
 * ========================================================
 * TEST 3 — OPERACIÓN ALTERADA A CATEGORY
 * ========================================================
 */

const wrongOperationSession =
  structuredClone(
    session,
  );

const wrongOperationItem =
  wrongOperationSession.phases
    .flatMap(
      (phase) =>
        phase.items,
    )
    .find(
      (item) =>
        item.operation.id ===
          'create_role:role_notify_news',
    );

if (
  !wrongOperationItem
) {
  throw new Error(
    'No se encontró la operación Canary.',
  );
}

wrongOperationItem.operation.type =
  'create_category';

wrongOperationItem.operation.resourceKind =
  'category';

wrongOperationItem.preview.operationType =
  'create_category';

wrongOperationItem.preview.resourceKind =
  'category';

const wrongOperationGuard =
  evaluateSingleOperationCanary({
    session:
      wrongOperationSession,

    baseline,

    currentSnapshot:
      normalized,

    now:
      validNow,
  });

const wrongOperationBlocked =
  wrongOperationGuard.status ===
    'blocked' &&
  wrongOperationGuard.intent ===
    null;

/*
 * ========================================================
 * TEST 4 — NOMBRE ALTERADO
 * ========================================================
 */

const wrongNameSession =
  structuredClone(
    session,
  );

const wrongNameItem =
  wrongNameSession.phases
    .flatMap(
      (phase) =>
        phase.items,
    )
    .find(
      (item) =>
        item.operation.id ===
          'create_role:role_notify_news',
    );

if (
  !wrongNameItem
) {
  throw new Error(
    'No se encontró la operación para name tampering.',
  );
}

wrongNameItem.operation.desiredName =
  'Administrador';

wrongNameItem.preview.label =
  'Administrador';

const wrongNameGuard =
  evaluateSingleOperationCanary({
    session:
      wrongNameSession,

    baseline,

    currentSnapshot:
      normalized,

    now:
      validNow,
  });

const privilegedNameBlocked =
  wrongNameGuard.status ===
    'blocked' &&
  wrongNameGuard.intent ===
    null;

/*
 * ========================================================
 * TEST 5 — CONTENT MISMATCH
 * ========================================================
 */

const wrongContentSession =
  structuredClone(
    session,
  );

wrongContentSession
  .contentBinding
  .recalculatedGateFingerprint =
  '0'.repeat(
    64,
  );

const wrongContentGuard =
  evaluateSingleOperationCanary({
    session:
      wrongContentSession,

    baseline,

    currentSnapshot:
      normalized,

    now:
      validNow,
  });

const contentMismatchBlocked =
  wrongContentGuard.status ===
    'blocked' &&
  wrongContentGuard.checks.some(
    (check) =>
      check.id ===
        'content_binding' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 6 — ENVELOPE MISMATCH
 * ========================================================
 */

const wrongEnvelopeSession =
  structuredClone(
    session,
  );

wrongEnvelopeSession
  .envelopeBinding
  .recalculatedGateEnvelopeFingerprint =
  'f'.repeat(
    64,
  );

const wrongEnvelopeGuard =
  evaluateSingleOperationCanary({
    session:
      wrongEnvelopeSession,

    baseline,

    currentSnapshot:
      normalized,

    now:
      validNow,
  });

const envelopeMismatchBlocked =
  wrongEnvelopeGuard.status ===
    'blocked' &&
  wrongEnvelopeGuard.checks.some(
    (check) =>
      check.id ===
        'envelope_binding' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 7 — RECEIPT VENCIDO
 * ========================================================
 */

const expiredReceiptGuard =
  evaluateSingleOperationCanary({
    session,

    baseline,

    currentSnapshot:
      normalized,

    now:
      new Date(
        session.source
          .receiptExpiresAt,
      ),
  });

const expiredReceiptBlocked =
  expiredReceiptGuard.status ===
    'blocked' &&
  expiredReceiptGuard.checks.some(
    (check) =>
      check.id ===
        'action_time_receipt_freshness' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 8 — SNAPSHOT AUTORIZADO VENCIDO
 *
 * Receipt se mantiene fresco.
 * Movemos solo el fixture del snapshot hacia atrás.
 * ========================================================
 */

const staleSnapshotSession =
  structuredClone(
    session,
  );

staleSnapshotSession.source
  .snapshotCapturedAt =
  '2026-11-17T01:50:00.000Z';

const staleNormalized =
  structuredClone(
    normalized,
  );

staleNormalized.capturedAt =
  staleSnapshotSession.source
    .snapshotCapturedAt;

const staleBaseline =
  createLiveDriftBaseline(
    staleNormalized,
    {
      sessionId:
        staleSnapshotSession
          .sessionId,

      gateFingerprint:
        staleSnapshotSession
          .gateFingerprint,

      gateEnvelopeFingerprint:
        staleSnapshotSession
          .gateEnvelopeFingerprint,
    },
    new Date(
      staleSnapshotSession.source
        .snapshotCapturedAt,
    ),
  );

const staleSnapshotGuard =
  evaluateSingleOperationCanary({
    session:
      staleSnapshotSession,

    baseline:
      staleBaseline,

    currentSnapshot:
      staleNormalized,

    now:
      validNow,
  });

const staleSnapshotBlocked =
  staleSnapshotGuard.status ===
    'blocked' &&
  staleSnapshotGuard.checks.some(
    (check) =>
      check.id ===
        'action_time_authorized_snapshot_freshness' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 9 — LIVE DRIFT
 * ========================================================
 */

const driftRaw =
  structuredClone(
    rawSnapshot,
  );

const channelForDrift =
  driftRaw.channels.find(
    (channel) =>
      channel.typeName !==
        'GuildCategory',
  );

if (
  !channelForDrift
) {
  throw new Error(
    'Snapshot sin canal para prueba de drift.',
  );
}

channelForDrift.name =
  `${channelForDrift.name}-CANARY-DRIFT`;

const driftSnapshot =
  normalizeDiscordStructureSnapshot(
    driftRaw,
  );

const driftGuard =
  evaluateSingleOperationCanary({
    session,

    baseline,

    currentSnapshot:
      driftSnapshot,

    now:
      validNow,
  });

const driftBlocked =
  driftGuard.status ===
    'blocked' &&
  driftGuard.checks.some(
    (check) =>
      check.id ===
        'live_drift' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 10 — TARGET YA EXISTE
 *
 * Baseline y current contienen el rol:
 * no hay drift entre ambos.
 * Debe bloquearlo target_absent.
 * ========================================================
 */

const targetExistsRaw =
  structuredClone(
    rawSnapshot,
  );

const roleTemplate =
  targetExistsRaw.roles[0];

if (
  !roleTemplate
) {
  throw new Error(
    'Snapshot sin rol base para target-exists test.',
  );
}

targetExistsRaw.roles.push({
  ...structuredClone(
    roleTemplate,
  ),

  id:
    '999999999999999991',

  name:
    'Avisos CDN',

  managed:
    false,
});

const targetExistsSnapshot =
  normalizeDiscordStructureSnapshot(
    targetExistsRaw,
  );

const targetExistsBaseline =
  createLiveDriftBaseline(
    targetExistsSnapshot,
    driftContext,
    new Date(
      session.source
        .snapshotCapturedAt,
    ),
  );

const targetExistsGuard =
  evaluateSingleOperationCanary({
    session,

    baseline:
      targetExistsBaseline,

    currentSnapshot:
      targetExistsSnapshot,

    now:
      validNow,
  });

const targetAlreadyExistsBlocked =
  targetExistsGuard.status ===
    'blocked' &&
  targetExistsGuard.checks.some(
    (check) =>
      check.id ===
        'target_absent' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 11 — ADAPTER DEFENSE IN DEPTH:
 * HOIST ALTERADO
 * ========================================================
 */

const hoistAdapter =
  new SimulatedCanaryAdapter();

const hoistIntent =
  structuredClone(
    validGuard.intent,
  );

hoistIntent.hoist =
  true as false;

let alteredHoistBlocked =
  false;

try {
  await hoistAdapter
    .simulateCreateRole(
      hoistIntent,
    );
} catch (
  error
) {
  alteredHoistBlocked =
    error instanceof
      SimulatedCanaryAdapterError &&
    error.code ===
      'CANARY_INTENT_REJECTED';
}

/*
 * ========================================================
 * TEST 12 — NONZERO PERMISSIONS
 * ========================================================
 */

const permissionsAdapter =
  new SimulatedCanaryAdapter();

const permissionsIntent =
  structuredClone(
    validGuard.intent,
  );

permissionsIntent.permissions =
  '8' as '0';

let nonzeroPermissionsBlocked =
  false;

try {
  await permissionsAdapter
    .simulateCreateRole(
      permissionsIntent,
    );
} catch (
  error
) {
  nonzeroPermissionsBlocked =
    error instanceof
      SimulatedCanaryAdapterError &&
    error.code ===
      'CANARY_INTENT_REJECTED';
}

/*
 * ========================================================
 * RESULTADO
 * ========================================================
 */

const success =
  validGuardPasses &&
  simulationPasses &&
  secondCallBlocked &&
  wrongOperationBlocked &&
  privilegedNameBlocked &&
  contentMismatchBlocked &&
  envelopeMismatchBlocked &&
  expiredReceiptBlocked &&
  staleSnapshotBlocked &&
  driftBlocked &&
  targetAlreadyExistsBlocked &&
  alteredHoistBlocked &&
  nonzeroPermissionsBlocked;

console.log('');
console.log(
  '🐤 Single-Operation Canary Guard v1',
);
console.log('');

console.log(
  `Guard válido listo para simulación: ${validGuardPasses ? 'SÍ' : 'NO'}`,
);

console.log(
  `Simulación única completada: ${simulationPasses ? 'SÍ' : 'NO'}`,
);

console.log(
  `Segunda llamada bloqueada: ${secondCallBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Operación category bloqueada: ${wrongOperationBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Nombre privilegiado bloqueado: ${privilegedNameBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Content mismatch bloqueado: ${contentMismatchBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Envelope mismatch bloqueado: ${envelopeMismatchBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Receipt vencido bloqueado: ${expiredReceiptBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Snapshot vencido bloqueado: ${staleSnapshotBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Live drift bloqueado: ${driftBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Target existente bloqueado: ${targetAlreadyExistsBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Hoist alterado bloqueado: ${alteredHoistBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Permisos no-cero bloqueados: ${nonzeroPermissionsBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Adapter attempts válidos: ${adapter.getAttempts()}`,
);

console.log(
  `Adapter actions simuladas: ${adapter.getActions().length}`,
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
  process.exitCode =
    2;
}
