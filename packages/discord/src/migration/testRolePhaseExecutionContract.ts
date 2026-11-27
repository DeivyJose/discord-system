import {
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  BoundBindingAwareCheckpoint,
} from './checkpointedBindingResumeTypes.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  createRolePhasePlanFingerprint,
} from './rolePhasePlan.js';

import type {
  RolePhasePlan,
} from './rolePhasePlanTypes.js';

import {
  RolePhaseFakeExecutionContract,
  RolePhaseFakeResumeContract,
} from './rolePhaseExecutionContract.js';

interface BindingFile {
  schemaVersion: number;

  guildId: string;

  updatedAt: string;

  resources:
    Record<
      string,
      string
    >;
}

async function readJson<T>(
  ...segments:
    string[]
): Promise<T> {
  const projectRoot =
    path.resolve(
      process.cwd(),
      '../..',
    );

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

const plan =
  await readJson<
    RolePhasePlan
  >(
    '.data',
    'role-phase-plan',
    'latest.json',
  );

const operations =
  await readJson<
    MigrationOperationsPlan
  >(
    '.data',
    'migration-operations',
    'latest.json',
  );

const bindings =
  await readJson<
    BindingFile
  >(
    '.data',
    'discord-bindings.json',
  );

/*
 * ======================================================
 * TEST 1 — VALID COMPLETE FLOW
 * ======================================================
 */

const validContract =
  new RolePhaseFakeExecutionContract(
    plan,
    operations,
    {
      sessionKey:
        'role-phase-valid-test',

      confirmedBindings:
        bindings.resources,
    },
  );

const valid =
  await validContract
    .execute();

const validActions =
  valid.finalAdapterSnapshot
    ?.actions ??
  [];

const validActionIds =
  validActions.map(
    action =>
      action.operationId,
  );

const forbidden =
  new Set([
    'create_role:role_owner',
    'create_role:role_administrator',
    'create_role:role_compai',
    'create_role:role_notify_news',
  ]);

const validFlowPasses =
  valid.status ===
    'completed' &&
  valid.adapterCreated &&
  valid.registryCreated &&
  valid.summary.operations ===
    22 &&
  valid.summary.attempted ===
    22 &&
  valid.summary.succeeded ===
    22 &&
  valid.summary.failed ===
    0 &&
  valid.summary.finalActions ===
    22 &&
  valid.summary.uniqueActions ===
    22 &&
  valid.summary.sessionBindings ===
    22 &&
  valid.summary.failureClassification ===
    'none' &&
  !valid.summary.resumeAvailable &&
  validActionIds.every(
    id =>
      !forbidden.has(
        id,
      ),
  ) &&
  plan.automatic.every(
    payload =>
      payload.permissions ===
        '0',
  );

/*
 * ======================================================
 * TEST 2 — CONTRACT SINGLE USE
 * ======================================================
 */

const replay =
  await validContract
    .execute();

const singleUseBlocked =
  replay.status ===
    'blocked' &&
  replay.blockReason ===
    'contract_consumed' &&
  !replay.adapterCreated;

/*
 * ======================================================
 * TEST 3 — PAYLOAD TAMPER, FINGERPRINT REGENERATED
 * ======================================================
 */

const payloadTampered =
  structuredClone(
    plan,
  );

const payload0 =
  payloadTampered
    .automatic[0];

if (
  !payload0
) {
  throw new Error(
    'Role Phase Plan sin payload automático.',
  );
}

(
  payload0 as {
    permissions:
      string;
  }
).permissions =
  '8';

payloadTampered
  .planFingerprint =
    createRolePhasePlanFingerprint(
      payloadTampered,
    );

const payloadTamperResult =
  await new RolePhaseFakeExecutionContract(
    payloadTampered,
    operations,
    {
      sessionKey:
        'payload-tamper-test',

      confirmedBindings:
        bindings.resources,
    },
  ).execute();

const payloadTamperBlocked =
  payloadTamperResult.status ===
    'blocked' &&
  !payloadTamperResult
    .adapterCreated;

/*
 * ======================================================
 * TEST 3B — HOIST TAMPER CON FINGERPRINT REGENERADO
 * ======================================================
 */

const hoistTampered =
  structuredClone(
    plan,
  );

const hoistPayload =
  hoistTampered
    .automatic[0];

if (
  !hoistPayload
) {
  throw new Error(
    'No existe payload para hoist tamper.',
  );
}

hoistPayload.hoist =
  !hoistPayload.hoist;

hoistTampered
  .planFingerprint =
    createRolePhasePlanFingerprint(
      hoistTampered,
    );

const hoistTamperResult =
  await new RolePhaseFakeExecutionContract(
    hoistTampered,
    operations,
    {
      sessionKey:
        'hoist-tamper-test',

      confirmedBindings:
        bindings.resources,
    },
  ).execute();

const hoistTamperBlocked =
  hoistTamperResult.status ===
    'blocked' &&
  !hoistTamperResult
    .adapterCreated;

/*
 * ======================================================
 * TEST 3C — MENTIONABLE TAMPER CON FINGERPRINT REGENERADO
 * ======================================================
 */

const mentionableTampered =
  structuredClone(
    plan,
  );

const mentionablePayload =
  mentionableTampered
    .automatic[0];

if (
  !mentionablePayload
) {
  throw new Error(
    'No existe payload para mentionable tamper.',
  );
}

mentionablePayload.mentionable =
  !mentionablePayload
    .mentionable;

mentionableTampered
  .planFingerprint =
    createRolePhasePlanFingerprint(
      mentionableTampered,
    );

const mentionableTamperResult =
  await new RolePhaseFakeExecutionContract(
    mentionableTampered,
    operations,
    {
      sessionKey:
        'mentionable-tamper-test',

      confirmedBindings:
        bindings.resources,
    },
  ).execute();

const mentionableTamperBlocked =
  mentionableTamperResult.status ===
    'blocked' &&
  !mentionableTamperResult
    .adapterCreated;

/*
 * ======================================================
 * TEST 4 — AUTOMATIC ORDER TAMPER
 * fingerprint regenerado para demostrar que no
 * confiamos solamente en el hash.
 * ======================================================
 */

const orderTampered =
  structuredClone(
    plan,
  );

const first =
  orderTampered
    .automatic[0];

const second =
  orderTampered
    .automatic[1];

if (
  !first ||
  !second
) {
  throw new Error(
    'Role Phase Plan no tiene suficientes payloads.',
  );
}

orderTampered
  .automatic[0] =
    second;

orderTampered
  .automatic[1] =
    first;

orderTampered
  .planFingerprint =
    createRolePhasePlanFingerprint(
      orderTampered,
    );

const orderTamperResult =
  await new RolePhaseFakeExecutionContract(
    orderTampered,
    operations,
    {
      sessionKey:
        'order-tamper-test',

      confirmedBindings:
        bindings.resources,
    },
  ).execute();

const orderTamperBlocked =
  orderTamperResult.status ===
    'blocked' &&
  !orderTamperResult
    .adapterCreated;

/*
 * ======================================================
 * TEST 5 — OPERATIONS TAMPER
 * ======================================================
 */

const operationsTampered =
  structuredClone(
    operations,
  );

const operationToTamper =
  operationsTampered
    .operations
    .find(
      operation =>
        operation.type ===
          'create_role' &&
        operation.blueprintId !==
          'role_owner',
    );

if (
  !operationToTamper
) {
  throw new Error(
    'No existe create_role automático para tamper.',
  );
}

operationToTamper
  .desiredName =
    `${operationToTamper.desiredName ?? ''} TAMPER`;

const operationsTamperResult =
  await new RolePhaseFakeExecutionContract(
    plan,
    operationsTampered,
    {
      sessionKey:
        'operations-tamper-test',

      confirmedBindings:
        bindings.resources,
    },
  ).execute();

const operationsTamperBlocked =
  operationsTamperResult
    .status ===
      'blocked' &&
  !operationsTamperResult
    .adapterCreated;

/*
 * ======================================================
 * TEST 6 — PRE-DISPATCH FAILURE + VALID RESUME
 * ======================================================
 */

const failureIndex =
  7;

const stopped =
  await new RolePhaseFakeExecutionContract(
    plan,
    operations,
    {
      sessionKey:
        'safe-resume-test',

      confirmedBindings:
        bindings.resources,
    },
  ).execute(
    context => {
      if (
        context.index ===
          failureIndex
      ) {
        throw new Error(
          'Synthetic pre-dispatch failure.',
        );
      }
    },
  );

if (
  !stopped.sealedCheckpoint
) {
  throw new Error(
    'El flujo detenido no produjo checkpoint.',
  );
}

const safeStopCorrect =
  stopped.status ===
    'stopped_on_error' &&
  stopped.summary.succeeded ===
    failureIndex &&
  stopped.summary.failed ===
    1 &&
  stopped.summary.finalActions ===
    failureIndex &&
  stopped.summary.sessionBindings ===
    failureIndex &&
  stopped.summary.failureClassification ===
    'pre_dispatch' &&
  stopped.summary.resumeAvailable &&
  stopped.journal
    ?.checkpoint
    .nextOperationIndex ===
      failureIndex;

const resumed =
  await new RolePhaseFakeResumeContract(
    plan,
    operations,
    'safe-resume-test',
    stopped.sealedCheckpoint,
  ).execute();

const resumedActionIds =
  resumed.finalAdapterSnapshot
    ?.actions
    .map(
      action =>
        action.operationId,
    ) ??
  [];

const validResume =
  resumed.status ===
    'completed' &&
  resumed.adapterRestored &&
  resumed.registryRestored &&
  resumed.summary.finalActions ===
    22 &&
  resumed.summary.uniqueActions ===
    22 &&
  resumed.summary.sessionBindings ===
    22 &&
  new Set(
    resumedActionIds,
  ).size ===
    22;

/*
 * ======================================================
 * TEST 7 — CHECKPOINT TAMPER
 * ======================================================
 */

const checkpointTampered =
  structuredClone(
    stopped.sealedCheckpoint,
  );

checkpointTampered
  .integrityFingerprint =
    (
      checkpointTampered
        .integrityFingerprint
        .startsWith('0')
        ? '1'
        : '0'
    ) +
    checkpointTampered
      .integrityFingerprint
      .slice(1);

const checkpointTamperResult =
  await new RolePhaseFakeResumeContract(
    plan,
    operations,
    'safe-resume-test',
    checkpointTampered,
  ).execute();

const checkpointTamperBlocked =
  checkpointTamperResult
    .status ===
      'blocked';

/*
 * ======================================================
 * TEST 8 — WRONG PLAN ON RESUME
 * ======================================================
 */

const wrongPlan =
  structuredClone(
    plan,
  );

wrongPlan.planFingerprint =
  '0'.repeat(
    64,
  );

const wrongPlanResume =
  await new RolePhaseFakeResumeContract(
    wrongPlan,
    operations,
    'safe-resume-test',
    stopped.sealedCheckpoint,
  ).execute();

const wrongPlanBlocked =
  wrongPlanResume.status ===
    'blocked' &&
  !wrongPlanResume
    .adapterRestored;

/*
 * ======================================================
 * TEST 9 — AMBIGUOUS FAILURE AFTER FAKE CREATE
 * ======================================================
 */

const ambiguousOperation =
  plan.automatic[5];

if (
  !ambiguousOperation
) {
  throw new Error(
    'No existe payload para ambiguity test.',
  );
}

const ambiguous =
  await new RolePhaseFakeExecutionContract(
    plan,
    operations,
    {
      sessionKey:
        'ambiguous-test',

      confirmedBindings:
        bindings.resources,

      fault: {
        throwAfterCreateOperationId:
          ambiguousOperation
            .operationId,
      },
    },
  ).execute();

if (
  !ambiguous.sealedCheckpoint
) {
  throw new Error(
    'Ambiguous flow no produjo checkpoint.',
  );
}

const ambiguityDetected =
  ambiguous.status ===
    'stopped_on_error' &&
  ambiguous.summary
    .failureClassification ===
      'ambiguous_after_mutation' &&
  !ambiguous.summary
    .resumeAvailable &&
  ambiguous.finalAdapterSnapshot
    ?.actions
    .some(
      action =>
        action.operationId ===
          ambiguousOperation
            .operationId,
    ) ===
      true;

const ambiguousResume =
  await new RolePhaseFakeResumeContract(
    plan,
    operations,
    'ambiguous-test',
    ambiguous.sealedCheckpoint,
  ).execute();

const ambiguousResumeBlocked =
  ambiguousResume.status ===
    'blocked' &&
  ambiguousResume.blockReason ===
    'ambiguous_checkpoint' &&
  !ambiguousResume
    .adapterRestored &&
  !ambiguousResume
    .registryRestored;

/*
 * ======================================================
 * FINAL
 * ======================================================
 */

const success =
  validFlowPasses &&
  singleUseBlocked &&
  payloadTamperBlocked &&
  hoistTamperBlocked &&
  mentionableTamperBlocked &&
  orderTamperBlocked &&
  operationsTamperBlocked &&
  safeStopCorrect &&
  validResume &&
  checkpointTamperBlocked &&
  wrongPlanBlocked &&
  ambiguityDetected &&
  ambiguousResumeBlocked;

console.log('');
console.log(
  'Role Phase Execution Contract v1 — fake adversarial tests',
);
console.log('');

console.log(
  `22/22 fake flow: ${validFlowPasses ? 'SÍ' : 'NO'}`,
);

console.log(
  `Single-use bloquea replay: ${singleUseBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Payload tamper bloqueado antes del adapter: ${payloadTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Hoist tamper re-fingerprinted bloqueado: ${hoistTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Mentionable tamper re-fingerprinted bloqueado: ${mentionableTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Order tamper bloqueado antes del adapter: ${orderTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Operations tamper bloqueado antes del adapter: ${operationsTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Pre-dispatch STOP correcto: ${safeStopCorrect ? 'SÍ' : 'NO'}`,
);

console.log(
  `Resume seguro completa 22 únicas: ${validResume ? 'SÍ' : 'NO'}`,
);

console.log(
  `Checkpoint tamper bloqueado: ${checkpointTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Wrong plan bloqueado antes de restore: ${wrongPlanBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Ambigüedad after-create detectada: ${ambiguityDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Retry ambiguo bloqueado: ${ambiguousResumeBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  'ADAPTER REAL: NO',
);

console.log(
  'DISCORD.JS: NO',
);

console.log(
  'CLIENT.LOGIN: NO',
);

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'MUTACIONES REALES: 0',
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
