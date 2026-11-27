import {
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  PermissionFlagsBits,
} from 'discord.js';

import type {
  Guild,
  Role,
  RoleCreateOptions,
} from 'discord.js';

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

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import type {
  ActionTimeCanarySnapshotProvider,
} from './actionTimeCanaryTypes.js';

import {
  DiscordJsCanaryRoleGateway,
} from './discordJsCanaryRoleGateway.js';

import {
  SingleUseCanaryTransport,
} from './singleUseCanaryTransport.js';

import {
  runActionTimeCanary,
} from './actionTimeCanaryOrchestrator.js';

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

/*
 * Igual que el test del orchestrator:
 * compatibilidad histórica EXCLUSIVAMENTE en memoria.
 */
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
    'Fixture sin Receipt Claim.',
  );
}

session.receiptClaim
  .provenanceFingerprint =
    provenance.lineageFingerprint;

/*
 * Elegimos un instante dentro de la ventana histórica
 * autorizada. No cambia ningún artefacto persistido.
 */
const snapshotTime =
  new Date(
    session.source
      .snapshotCapturedAt,
  ).getTime();

const receiptExpiryTime =
  new Date(
    session.source
      .receiptExpiresAt,
  ).getTime();

const validNowTime =
  receiptExpiryTime -
  60_000;

if (
  !Number.isFinite(
    snapshotTime,
  ) ||
  !Number.isFinite(
    receiptExpiryTime,
  ) ||
  validNowTime <=
    snapshotTime ||
  validNowTime -
    snapshotTime >
      30 * 60 * 1000
) {
  throw new Error(
    'La fixture persistida no ofrece una ventana histórica válida para este test.',
  );
}

const validNow =
  new Date(
    validNowTime,
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

  const captured =
    new Date(
      pre.capturedAt,
    ).getTime();

  if (
    !Number.isFinite(
      captured,
    )
  ) {
    throw new Error(
      'PRE capturedAt inválido.',
    );
  }

  post.capturedAt =
    new Date(
      captured +
        1_000,
    ).toISOString();

  post.roles.push(
    expectedRole(),
  );

  return post;
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
 * SNAPSHOT PROVIDER
 *
 * afterCapture permite simular una carrera que ocurre
 * inmediatamente DESPUÉS de capturar PRE2.
 * ========================================================
 */

class QueueSnapshotProvider
implements ActionTimeCanarySnapshotProvider {
  captures =
    0;

  constructor(
    private readonly queue:
      DiscordGuildSnapshot[],

    private readonly afterCapture?:
      (
        capture:
          number,
      ) => void,
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

    const result =
      structuredClone(
        next,
      );

    this.afterCapture?.(
      this.captures,
    );

    return result;
  }
}

/*
 * ========================================================
 * FAKE DISCORD GUILD
 *
 * Usa la misma superficie mínima probada por
 * testDiscordJsCanaryRoleGateway.ts.
 * ========================================================
 */

interface FakeGuildState {
  manageRoles:
    boolean;

  administrator:
    boolean;

  existingRoles:
    Role[];

  createCalls:
    number;

  createOptions:
    RoleCreateOptions[];

  createdRole:
    Role;

  createError:
    Error |
    null;
}

function fakeRole(
  overrides: {
    id?: string;
    name?: string;
    managed?: boolean;
    hoist?: boolean;
    mentionable?: boolean;
    permissions?: bigint;
  } = {},
): Role {
  const role = {
    id:
      overrides.id ??
      EXPECTED_ROLE_ID,

    guild: {
      id:
        session.guild.id,
    },

    name:
      overrides.name ??
      'Avisos CDN',

    managed:
      overrides.managed ??
      false,

    hoist:
      overrides.hoist ??
      false,

    mentionable:
      overrides.mentionable ??
      true,

    permissions: {
      bitfield:
        overrides.permissions ??
        0n,
    },
  };

  return role as unknown as
    Role;
}

function createFakeGuild(
  overrides: {
    manageRoles?: boolean;
    administrator?: boolean;
    existingRoles?: Role[];
    createdRole?: Role;
    createError?: Error | null;
  } = {},
): {
  guild:
    Guild;

  state:
    FakeGuildState;
} {
  const state:
    FakeGuildState = {
      manageRoles:
        overrides.manageRoles ??
        true,

      administrator:
        overrides.administrator ??
        false,

      existingRoles:
        overrides.existingRoles ??
        [],

      createCalls:
        0,

      createOptions:
        [],

      createdRole:
        overrides.createdRole ??
        fakeRole(),

      createError:
        overrides.createError ??
        null,
    };

  const permissions = {
    has(
      permission:
        bigint,
      _checkAdmin?:
        boolean,
    ): boolean {
      if (
        permission ===
          PermissionFlagsBits
            .Administrator
      ) {
        return state
          .administrator;
      }

      if (
        permission ===
          PermissionFlagsBits
            .ManageRoles
      ) {
        return state
          .manageRoles;
      }

      return false;
    },
  };

  const guild = {
    id:
      session.guild.id,

    members: {
      async fetchMe() {
        return {
          permissions,
        };
      },
    },

    roles: {
      async fetch() {
        return {
          find(
            predicate:
              (
                role:
                  Role,
              ) => boolean,
          ) {
            return state
              .existingRoles
              .find(
                predicate,
              );
          },
        };
      },

      async create(
        options:
          RoleCreateOptions,
      ) {
        state.createCalls +=
          1;

        state.createOptions.push(
          structuredClone(
            options,
          ),
        );

        if (
          state.createError
        ) {
          throw state
            .createError;
        }

        return state
          .createdRole;
      },
    },
  };

  return {
    guild:
      guild as unknown as
        Guild,

    state,
  };
}

/*
 * ========================================================
 * TEST 1 — COMPOSICIÓN REAL, CAMINO VÁLIDO
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
    structuredClone(
      validPre,
    ),

    structuredClone(
      validPre,
    ),

    structuredClone(
      validPost,
    ),
  ]);

const validFixture =
  createFakeGuild();

const validGateway =
  new DiscordJsCanaryRoleGateway(
    validFixture.guild,
  );

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

    authorizeIntent:
      async () => true,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const validOptions =
  validFixture
    .state
    .createOptions[0];

const validComposition =
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
    3 &&
  validFixture
    .state
    .createCalls ===
      1 &&
  validOptions !==
    undefined &&
  validOptions.name ===
    'Avisos CDN' &&
  validOptions.permissions ===
    0n &&
  validOptions.hoist ===
    false &&
  validOptions.mentionable ===
    true;

/*
 * ========================================================
 * TEST 2 — SIN MANAGE ROLES
 * ========================================================
 */

const noManageProvider =
  new QueueSnapshotProvider([
    structuredClone(
      validPre,
    ),

    structuredClone(
      validPre,
    ),
  ]);

const noManageFixture =
  createFakeGuild({
    manageRoles:
      false,
  });

const noManageTransport =
  new SingleUseCanaryTransport(
    new DiscordJsCanaryRoleGateway(
      noManageFixture.guild,
    ),
  );

const noManageResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      noManageProvider,

    transport:
      noManageTransport,

    authorizeIntent:
      async () => true,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const noManageBlocked =
  noManageResult.status ===
    'transport_failed' &&
  noManageFixture
    .state
    .createCalls ===
      0 &&
  noManageTransport
    .getAttempts() ===
      1 &&
  noManageTransport
    .getMutationCalls() ===
      0;

/*
 * ========================================================
 * TEST 3 — ADMINISTRATOR PRESENTE
 * ========================================================
 */

const administratorProvider =
  new QueueSnapshotProvider([
    structuredClone(
      validPre,
    ),

    structuredClone(
      validPre,
    ),
  ]);

const administratorFixture =
  createFakeGuild({
    manageRoles:
      true,

    administrator:
      true,
  });

const administratorTransport =
  new SingleUseCanaryTransport(
    new DiscordJsCanaryRoleGateway(
      administratorFixture
        .guild,
    ),
  );

const administratorResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      administratorProvider,

    transport:
      administratorTransport,

    authorizeIntent:
      async () => true,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const administratorBlocked =
  administratorResult.status ===
    'transport_failed' &&
  administratorFixture
    .state
    .createCalls ===
      0 &&
  administratorTransport
    .getMutationCalls() ===
      0;

/*
 * ========================================================
 * TEST 4 — TARGET APARECE DESPUÉS DE PRE2
 *
 * PRE2 ya fue capturado sin target.
 * Inmediatamente después, el Guild fake empieza a
 * reportar Avisos CDN.
 *
 * Guard2 ve el snapshot capturado.
 * El transporte vuelve a hacer roles.fetch() y bloquea.
 * ========================================================
 */

const raceFixture =
  createFakeGuild();

const raceProvider =
  new QueueSnapshotProvider(
    [
      structuredClone(
        validPre,
      ),

      structuredClone(
        validPre,
      ),
    ],

    (
      capture,
    ) => {
      if (
        capture ===
          2
      ) {
        raceFixture
          .state
          .existingRoles
          .push(
            fakeRole({
              id:
                'concurrent-avisos-cdn',
            }),
          );
      }
    },
  );

const raceTransport =
  new SingleUseCanaryTransport(
    new DiscordJsCanaryRoleGateway(
      raceFixture.guild,
    ),
  );

const raceResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      raceProvider,

    transport:
      raceTransport,

    authorizeIntent:
      async () => true,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const raceBlocked =
  raceResult.status ===
    'transport_failed' &&
  raceFixture
    .state
    .createCalls ===
      0 &&
  raceTransport
    .getAttempts() ===
      1 &&
  raceTransport
    .getMutationCalls() ===
      0;

/*
 * ========================================================
 * TEST 5 — CREATE AMBIGUO
 *
 * roles.create() es llamado exactamente una vez
 * y luego lanza.
 *
 * No retry.
 * El orchestrator hace diagnóstico y exige revisión.
 * ========================================================
 */

const ambiguousPre =
  structuredClone(
    validPre,
  );

const ambiguousDiagnostic =
  createPostSnapshot(
    ambiguousPre,
  );

const ambiguousProvider =
  new QueueSnapshotProvider([
    structuredClone(
      ambiguousPre,
    ),

    structuredClone(
      ambiguousPre,
    ),

    structuredClone(
      ambiguousDiagnostic,
    ),
  ]);

const ambiguousFixture =
  createFakeGuild({
    createError:
      new Error(
        'Fake ambiguous Discord create failure.',
      ),
  });

const ambiguousTransport =
  new SingleUseCanaryTransport(
    new DiscordJsCanaryRoleGateway(
      ambiguousFixture.guild,
    ),
  );

const ambiguousResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      ambiguousProvider,

    transport:
      ambiguousTransport,

    authorizeIntent:
      async () => true,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const ambiguousHandled =
  ambiguousResult.status ===
    'transport_failed' &&
  ambiguousResult.mutationCalls ===
    1 &&
  ambiguousResult
    .requiresManualInspection ===
      true &&
  ambiguousFixture
    .state
    .createCalls ===
      1 &&
  ambiguousTransport
    .getAttempts() ===
      1 &&
  ambiguousProvider.captures ===
    3;

/*
 * ========================================================
 * TEST 6 — REPLAY DEL MISMO TRANSPORTE
 * ========================================================
 */

const replayProvider =
  new QueueSnapshotProvider([
    structuredClone(
      validPre,
    ),
  ]);

const replayResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      replayProvider,

    transport:
      ambiguousTransport,

    authorizeIntent:
      async () => true,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const replayBlocked =
  replayResult.status ===
    'blocked_before_transport' &&
  replayProvider.captures ===
    0 &&
  ambiguousFixture
    .state
    .createCalls ===
      1 &&
  ambiguousTransport
    .getMutationCalls() ===
      1;

/*
 * ========================================================
 * TEST 7 — RESPUESTA REMOTA INSEGURA
 *
 * Gateway devuelve exactamente lo que Discord "respondió".
 * Transport debe rechazar managed=true / permisos elevados.
 * No rollback automático.
 * ========================================================
 */

const unsafeProvider =
  new QueueSnapshotProvider([
    structuredClone(
      validPre,
    ),

    structuredClone(
      validPre,
    ),

    structuredClone(
      createPostSnapshot(
        validPre,
      ),
    ),
  ]);

const unsafeFixture =
  createFakeGuild({
    createdRole:
      fakeRole({
        id:
          'unsafe-created-role',

        managed:
          true,

        permissions:
          PermissionFlagsBits
            .ManageRoles,
      }),
  });

const unsafeTransport =
  new SingleUseCanaryTransport(
    new DiscordJsCanaryRoleGateway(
      unsafeFixture.guild,
    ),
  );

const unsafeResult =
  await runActionTimeCanary({
    session,

    baseline,

    snapshotProvider:
      unsafeProvider,

    transport:
      unsafeTransport,

    authorizeIntent:
      async () => true,

    now:
      () =>
        new Date(
          validNow,
        ),
  });

const unsafePostconditionBlocked =
  unsafeResult.status ===
    'transport_failed' &&
  unsafeResult.mutationCalls ===
    1 &&
  unsafeResult
    .requiresManualInspection ===
      true &&
  unsafeFixture
    .state
    .createCalls ===
      1 &&
  unsafeTransport
    .getAttempts() ===
      1;

/*
 * ========================================================
 * RESULTADO
 * ========================================================
 */

const success =
  validComposition &&
  noManageBlocked &&
  administratorBlocked &&
  raceBlocked &&
  ambiguousHandled &&
  replayBlocked &&
  unsafePostconditionBlocked;

console.log('');
console.log(
  'Real Canary Composition — FAKE Discord Guild',
);

console.log('');

console.log(
  `Camino válido Gateway→Transport→Orchestrator: ${validComposition ? 'SÍ' : 'NO'}`,
);

console.log(
  `Sin ManageRoles bloqueado antes de create: ${noManageBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Administrator bloqueado antes de create: ${administratorBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Target concurrente bloqueado por transporte: ${raceBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Create ambiguo sin retry + revisión manual: ${ambiguousHandled ? 'SÍ' : 'NO'}`,
);

console.log(
  `Replay del mismo transporte bloqueado: ${replayBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Respuesta remota insegura bloqueada: ${unsafePostconditionBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');
console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');
console.log(
  'GUILD: FAKE',
);

console.log(
  'DISCORDJS GATEWAY: REAL CLASS / FAKE GUILD',
);

console.log(
  'SINGLE-USE TRANSPORT: REAL CLASS',
);

console.log(
  'ORCHESTRATOR: REAL CLASS',
);

console.log(
  'CLIENT: NO CREADO',
);

console.log(
  'CLIENT.LOGIN: NO',
);

console.log(
  'TOKEN: NO LEÍDO',
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
