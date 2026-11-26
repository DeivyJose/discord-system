import {
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordGuildSnapshot,
  DiscordRoleSnapshot,
} from '../inspector/types.js';

import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import type {
  MigrationProvenanceArtifact,
} from './migrationProvenanceTypes.js';

import type {
  CanaryObservedRole,
  CanaryRoleCreatePayload,
  CanaryRoleGateway,
} from './canaryTransportTypes.js';

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import {
  SingleUseCanaryTransport,
} from './singleUseCanaryTransport.js';

import {
  runActionTimeCanary,
} from './actionTimeCanaryOrchestrator.js';

import type {
  ActionTimeCanarySnapshotProvider,
} from './actionTimeCanaryTypes.js';

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

/*
 * Este test usa una Execution Session histórica
 * persistida antes del contrato v6.
 *
 * La normalizamos EXCLUSIVAMENTE en memoria para
 * probar el Action-Time Orchestrator actual.
 *
 * No modifica .data.
 * No crea autorización.
 * No conecta Discord.
 */
const provenance =
  JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        '.data',
        'migration-provenance',
        'latest.json',
      ),
      'utf8',
    ),
  ) as MigrationProvenanceArtifact;

session.schemaVersion =
  6;

session.contentBinding
  .fingerprintVersion =
  4;

session.provenanceFingerprint =
  provenance.lineageFingerprint;

session.provenanceBinding = {
  fingerprintVersion:
    1,

  expectedProvenanceFingerprint:
    provenance.lineageFingerprint,

  recalculatedProvenanceFingerprint:
    provenance.lineageFingerprint,

  gateProvenanceFingerprint:
    provenance.lineageFingerprint,

  receiptProvenanceFingerprint:
    provenance.lineageFingerprint,

  matchesGate:
    true,

  executionAllowed:
    false,
};

session.source
  .provenanceGeneratedAt =
    provenance.generatedAt;

if (
  !session.receiptClaim
) {
  throw new Error(
    'Fixture histórico sin Receipt Claim.',
  );
}

session.receiptClaim
  .provenanceFingerprint =
    provenance.lineageFingerprint;

const historicalSnapshot =
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

const validNow =
  new Date(
    '2026-11-17T02:23:00.000Z',
  );

const EXPECTED_ROLE_ID =
  '999999999999999901';

function expectedRole():
  DiscordRoleSnapshot {
  return {
    id:
      EXPECTED_ROLE_ID,

    name:
      'Avisos CDN',

    position:
      1,

    color:
      0,

    hexColor:
      '#000000',

    hoist:
      false,

    mentionable:
      true,

    managed:
      false,

    permissions:
      [],
  };
}

function createPostSnapshot(
  pre:
    DiscordGuildSnapshot,
): DiscordGuildSnapshot {
  const post =
    structuredClone(
      pre,
    );

  post.capturedAt =
    '2026-11-17T02:23:01.000Z';

  post.roles.push(
    expectedRole(),
  );

  return post;
}

class QueueSnapshotProvider
implements ActionTimeCanarySnapshotProvider {
  captures =
    0;

  constructor(
    private readonly queue:
      DiscordGuildSnapshot[],
  ) {}

  async capture():
    Promise<
      DiscordGuildSnapshot
    > {
    this.captures +=
      1;

    const next =
      this.queue.shift();

    if (
      !next
    ) {
      throw new Error(
        'No quedan snapshots fake en la cola.',
      );
    }

    return structuredClone(
      next,
    );
  }
}

class FakeGateway
implements CanaryRoleGateway {
  readonly guildId =
    session.guild.id;

  createCalls =
    0;

  failCreate =
    false;

  async canManageRoles():
    Promise<boolean> {
    return true;
  }

  async findRoleByName(
    _name:
      string,
  ): Promise<
    CanaryObservedRole |
    null
  > {
    return null;
  }

  async createRole(
    payload:
      CanaryRoleCreatePayload,
  ): Promise<
    CanaryObservedRole
  > {
    this.createCalls +=
      1;

    if (
      this.failCreate
    ) {
      throw new Error(
        'Fake ambiguous create failure.',
      );
    }

    return {
      id:
        EXPECTED_ROLE_ID,

      guildId:
        this.guildId,

      name:
        payload.name,

      managed:
        false,

      hoist:
        payload.hoist,

      mentionable:
        payload.mentionable,

      permissions:
        payload.permissions,
    };
  }
}

function baselineFor(
  snapshot:
    DiscordGuildSnapshot,
) {
  return createLiveDriftBaseline(
    normalizeDiscordStructureSnapshot(
      snapshot,
    ),

    {
      sessionId:
        session.sessionId,

      gateFingerprint:
        session.gateFingerprint,

      gateEnvelopeFingerprint:
        session
          .gateEnvelopeFingerprint,
    },

    new Date(
      session.source
        .snapshotCapturedAt,
    ),
  );
}

const baseline =
  baselineFor(
    historicalSnapshot,
  );

/*
 * ========================================================
 * TEST 1 — CAMINO VÁLIDO
 * ========================================================
 */

const validPre =
  structuredClone(
    historicalSnapshot,
  );

const validPost =
  createPostSnapshot(
    validPre,
  );

const validProvider =
  new QueueSnapshotProvider([
    validPre,
    validPost,
  ]);

const validGateway =
  new FakeGateway();

const validTransport =
  new SingleUseCanaryTransport(
    validGateway,
  );

const validResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      validProvider,

    transport:
      validTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const validPasses =
  validResult.status ===
    'completed' &&
  validResult.mutationCalls ===
    1 &&
  validResult.transportAttempts ===
    1 &&
  validResult
    .requiresManualInspection ===
    false &&
  validProvider.captures ===
    2 &&
  validGateway.createCalls ===
    1;

/*
 * ========================================================
 * TEST 2 — SEGUNDA EJECUCIÓN MISMO TRANSPORTE
 * ========================================================
 */

const secondProvider =
  new QueueSnapshotProvider([
    validPre,
  ]);

const secondRun =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      secondProvider,

    transport:
      validTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const secondRunBlocked =
  secondRun.status ===
    'blocked_before_transport' &&
  secondProvider.captures ===
    0 &&
  validGateway.createCalls ===
    1;

/*
 * ========================================================
 * TEST 3 — LIVE DRIFT PRE BLOQUEA SIN MUTACIÓN
 * ========================================================
 */

const driftPre =
  structuredClone(
    historicalSnapshot,
  );

const driftChannel =
  driftPre.channels.find(
    (channel) =>
      channel.typeName !==
        'GuildCategory',
  );

if (
  !driftChannel
) {
  throw new Error(
    'Snapshot sin canal para drift.',
  );
}

driftChannel.name =
  `${driftChannel.name}-UNEXPECTED`;

const driftProvider =
  new QueueSnapshotProvider([
    driftPre,
  ]);

const driftGateway =
  new FakeGateway();

const driftTransport =
  new SingleUseCanaryTransport(
    driftGateway,
  );

const driftResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      driftProvider,

    transport:
      driftTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const preDriftBlocked =
  driftResult.status ===
    'blocked_before_transport' &&
  driftGateway.createCalls ===
    0 &&
  driftTransport
    .getMutationCalls() ===
    0 &&
  driftProvider.captures ===
    1;

/*
 * ========================================================
 * TEST 4 — RECEIPT VENCIDO BLOQUEA SIN MUTACIÓN
 * ========================================================
 */

const staleProvider =
  new QueueSnapshotProvider([
    historicalSnapshot,
  ]);

const staleGateway =
  new FakeGateway();

const staleTransport =
  new SingleUseCanaryTransport(
    staleGateway,
  );

const staleResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      staleProvider,

    transport:
      staleTransport,

    now:
      () =>
        new Date(
          session.source
            .receiptExpiresAt,
        ),
  });

const staleBlocked =
  staleResult.status ===
    'blocked_before_transport' &&
  staleGateway.createCalls ===
    0 &&
  staleTransport
    .getMutationCalls() ===
    0;

/*
 * ========================================================
 * TEST 5 — CREATE FALLA:
 * SIN RETRY + REINSPECCIÓN DIAGNÓSTICA
 * ========================================================
 */

const failurePre =
  structuredClone(
    historicalSnapshot,
  );

const failureDiagnostic =
  createPostSnapshot(
    failurePre,
  );

const failureProvider =
  new QueueSnapshotProvider([
    failurePre,
    failureDiagnostic,
  ]);

const failureGateway =
  new FakeGateway();

failureGateway.failCreate =
  true;

const failureTransport =
  new SingleUseCanaryTransport(
    failureGateway,
  );

const failureResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      failureProvider,

    transport:
      failureTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const ambiguousFailureHandled =
  failureResult.status ===
    'transport_failed' &&
  failureResult.mutationCalls ===
    1 &&
  failureResult
    .requiresManualInspection ===
    true &&
  failureProvider.captures ===
    2 &&
  failureGateway.createCalls ===
    1;

const failureReplayProvider =
  new QueueSnapshotProvider([
    historicalSnapshot,
  ]);

const failureReplay =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      failureReplayProvider,

    transport:
      failureTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const noRetryAfterFailure =
  failureReplay.status ===
    'blocked_before_transport' &&
  failureReplayProvider
    .captures ===
    0 &&
  failureGateway.createCalls ===
    1;

/*
 * ========================================================
 * TEST 6 — ROLE CREADO CON PERMISOS INSEGUROS
 * ========================================================
 */

const unsafePost =
  createPostSnapshot(
    historicalSnapshot,
  );

const unsafeRole =
  unsafePost.roles.find(
    (role) =>
      role.id ===
        EXPECTED_ROLE_ID,
  );

if (
  !unsafeRole
) {
  throw new Error(
    'No se pudo preparar unsafe role.',
  );
}

unsafeRole.permissions = [
  'ManageRoles',
];

const unsafeProvider =
  new QueueSnapshotProvider([
    historicalSnapshot,
    unsafePost,
  ]);

const unsafeGateway =
  new FakeGateway();

const unsafeTransport =
  new SingleUseCanaryTransport(
    unsafeGateway,
  );

const unsafeResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      unsafeProvider,

    transport:
      unsafeTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const unsafeRoleBlocked =
  unsafeResult.status ===
    'postcondition_failed' &&
  unsafeResult
    .requiresManualInspection ===
    true &&
  unsafeResult.checks.some(
    (check) =>
      check.id ===
        'post_target_role_exact' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 7 — ROL EXTRA CONCURRENTE
 * ========================================================
 */

const extraRolePost =
  createPostSnapshot(
    historicalSnapshot,
  );

extraRolePost.roles.push({
  id:
    '999999999999999902',

  name:
    'Unexpected Concurrent Role',

  position:
    2,

  color:
    0,

  hexColor:
    '#000000',

  hoist:
    false,

  mentionable:
    false,

  managed:
    false,

  permissions:
    [],
});

const extraRoleProvider =
  new QueueSnapshotProvider([
    historicalSnapshot,
    extraRolePost,
  ]);

const extraRoleGateway =
  new FakeGateway();

const extraRoleTransport =
  new SingleUseCanaryTransport(
    extraRoleGateway,
  );

const extraRoleResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      extraRoleProvider,

    transport:
      extraRoleTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const extraRoleBlocked =
  extraRoleResult.status ===
    'postcondition_failed' &&
  extraRoleResult.checks.some(
    (check) =>
      check.id ===
        'post_expected_role_addition' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 8 — CAMBIO CONCURRENTE EN CANAL
 * ========================================================
 */

const concurrentChannelPost =
  createPostSnapshot(
    historicalSnapshot,
  );

const postChannel =
  concurrentChannelPost.channels.find(
    (channel) =>
      channel.typeName !==
        'GuildCategory',
  );

if (
  !postChannel
) {
  throw new Error(
    'No existe canal para prueba concurrente.',
  );
}

postChannel.name =
  `${postChannel.name}-CONCURRENT`;

const concurrentChannelProvider =
  new QueueSnapshotProvider([
    historicalSnapshot,
    concurrentChannelPost,
  ]);

const concurrentChannelGateway =
  new FakeGateway();

const concurrentChannelTransport =
  new SingleUseCanaryTransport(
    concurrentChannelGateway,
  );

const concurrentChannelResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      concurrentChannelProvider,

    transport:
      concurrentChannelTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const concurrentChannelBlocked =
  concurrentChannelResult.status ===
    'postcondition_failed' &&
  concurrentChannelResult.checks.some(
    (check) =>
      check.id ===
        'post_channels_unchanged' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 9 — ROL EXISTENTE CAMBIA PERMISOS
 * ========================================================
 */

const existingRoleChangePost =
  createPostSnapshot(
    historicalSnapshot,
  );

const existingRoleToChange =
  existingRoleChangePost.roles.find(
    (role) =>
      role.id !==
        EXPECTED_ROLE_ID &&
      !role.managed,
  );

if (
  !existingRoleToChange
) {
  throw new Error(
    'No existe rol preexistente para tampering.',
  );
}

existingRoleToChange.permissions = [
  ...existingRoleToChange.permissions,
  'ManageMessages',
].sort();

const existingRoleChangeProvider =
  new QueueSnapshotProvider([
    historicalSnapshot,
    existingRoleChangePost,
  ]);

const existingRoleChangeGateway =
  new FakeGateway();

const existingRoleChangeTransport =
  new SingleUseCanaryTransport(
    existingRoleChangeGateway,
  );

const existingRoleChangeResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      existingRoleChangeProvider,

    transport:
      existingRoleChangeTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const existingRoleChangeBlocked =
  existingRoleChangeResult.status ===
    'postcondition_failed' &&
  existingRoleChangeResult.checks.some(
    (check) =>
      check.id ===
        'post_existing_roles_unchanged' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 10 — DUPLICATE NAME
 * ========================================================
 */

const duplicateNamePost =
  createPostSnapshot(
    historicalSnapshot,
  );

duplicateNamePost.roles.push({
  id:
    '999999999999999903',

  name:
    'Avisos CDN',

  position:
    3,

  color:
    0,

  hexColor:
    '#000000',

  hoist:
    false,

  mentionable:
    true,

  managed:
    false,

  permissions:
    [],
});

const duplicateNameProvider =
  new QueueSnapshotProvider([
    historicalSnapshot,
    duplicateNamePost,
  ]);

const duplicateNameGateway =
  new FakeGateway();

const duplicateNameTransport =
  new SingleUseCanaryTransport(
    duplicateNameGateway,
  );

const duplicateNameResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      duplicateNameProvider,

    transport:
      duplicateNameTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const duplicateNameBlocked =
  duplicateNameResult.status ===
    'postcondition_failed' &&
  duplicateNameResult.checks.some(
    (check) =>
      check.id ===
        'post_target_unique' &&
      check.status ===
        'block',
  );

/*
 * ========================================================
 * TEST 11 — SOLO CAMBIAN POSICIONES EXISTENTES
 *
 * Esto debe ser aceptado.
 * ========================================================
 */

const positionShiftPost =
  createPostSnapshot(
    historicalSnapshot,
  );

for (
  const role of
  positionShiftPost.roles
) {
  if (
    role.id !==
      EXPECTED_ROLE_ID
  ) {
    role.position +=
      1;
  }
}

const positionShiftProvider =
  new QueueSnapshotProvider([
    historicalSnapshot,
    positionShiftPost,
  ]);

const positionShiftGateway =
  new FakeGateway();

const positionShiftTransport =
  new SingleUseCanaryTransport(
    positionShiftGateway,
  );

const positionShiftResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      positionShiftProvider,

    transport:
      positionShiftTransport,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const positionShiftAccepted =
  positionShiftResult.status ===
    'completed';

/*
 * ========================================================
 * RESULTADO
 * ========================================================
 */

const success =
  validPasses &&
  secondRunBlocked &&
  preDriftBlocked &&
  staleBlocked &&
  ambiguousFailureHandled &&
  noRetryAfterFailure &&
  unsafeRoleBlocked &&
  extraRoleBlocked &&
  concurrentChannelBlocked &&
  existingRoleChangeBlocked &&
  duplicateNameBlocked &&
  positionShiftAccepted;

console.log('');
console.log(
  'Action-Time Canary Orchestrator v1',
);
console.log('');

console.log(
  `Camino válido completado: ${validPasses ? 'SÍ' : 'NO'}`,
);

console.log(
  `Segunda ejecución mismo transporte bloqueada: ${secondRunBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Live drift PRE bloqueado con 0 mutaciones: ${preDriftBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Receipt vencido bloqueado con 0 mutaciones: ${staleBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Fallo ambiguo provoca reinspección y STOP: ${ambiguousFailureHandled ? 'SÍ' : 'NO'}`,
);

console.log(
  `Retry tras fallo ambiguo bloqueado: ${noRetryAfterFailure ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Permisos inseguros POST bloqueados: ${unsafeRoleBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Rol concurrente extra bloqueado: ${extraRoleBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Cambio concurrente de canal bloqueado: ${concurrentChannelBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Cambio concurrente de rol existente bloqueado: ${existingRoleChangeBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Nombre Avisos CDN duplicado bloqueado: ${duplicateNameBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Reordenamiento automático de posiciones aceptado: ${positionShiftAccepted ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  'SNAPSHOTS: FAKE/HISTÓRICOS',
);

console.log(
  'TRANSPORTE: FAKE GATEWAY',
);

console.log(
  'CLIENT.LOGIN: NO',
);

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'MUTACIONES REALES ENVIADAS: 0',
);

console.log(
  'ROLLBACK AUTOMÁTICO: NO',
);

console.log(
  'RETRY AUTOMÁTICO: NO',
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
