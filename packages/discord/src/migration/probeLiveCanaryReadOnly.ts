import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  Client,
  Events,
  GatewayIntentBits,
} from 'discord.js';

import type {
  Guild,
} from 'discord.js';

import {
  inspectGuild,
} from '../inspector/inspectGuild.js';

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import {
  runActionTimeCanary,
} from './actionTimeCanaryOrchestrator.js';

import type {
  ActionTimeCanarySnapshotProvider,
  ActionTimeCanaryTransport,
} from './actionTimeCanaryTypes.js';

import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

const token =
  process.env.DISCORD_TOKEN?.trim();

const configuredGuildId =
  process.env.DISCORD_GUILD_ID?.trim();

if (
  !token
) {
  throw new Error(
    'Falta DISCORD_TOKEN.',
  );
}

if (
  !configuredGuildId
) {
  throw new Error(
    'Falta DISCORD_GUILD_ID.',
  );
}

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const sessionPath =
  path.join(
    projectRoot,
    '.data',
    'execution-sessions',
    'latest.json',
  );

const authorizedSnapshotPath =
  path.join(
    projectRoot,
    '.data',
    'discord-snapshots',
    'latest.json',
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'canary-readonly-live',
  );

async function readJson<T>(
  filePath:
    string,
): Promise<T> {
  return JSON.parse(
    await readFile(
      filePath,
      'utf8',
    ),
  ) as T;
}

/**
 * Transporte deliberadamente incapaz de mutar Discord.
 *
 * Si el orchestrator intentara alcanzar execute(),
 * incrementamos attempts y lanzamos inmediatamente.
 *
 * No existe:
 * - Guild;
 * - DiscordJsCanaryRoleGateway;
 * - roles.create();
 * - retry;
 * - rollback.
 */
class NeverMutateCanaryTransport
implements ActionTimeCanaryTransport {
  private attempts =
    0;

  async execute(
    _intent:
      CanaryRoleIntent,
  ): Promise<never> {
    this.attempts +=
      1;

    throw new Error(
      'READ_ONLY_CANARY_TRANSPORT_REACHED: el probe read-only jamás permite transporte.',
    );
  }

  isConsumed():
    boolean {
    return this.attempts >
      0;
  }

  getAttempts():
    number {
    return this.attempts;
  }

  getMutationCalls():
    number {
    return 0;
  }
}

class LiveReadOnlySnapshotProvider
implements ActionTimeCanarySnapshotProvider {
  captures =
    0;

  constructor(
    private readonly guild:
      Guild,
  ) {}

  async capture():
    Promise<
      DiscordGuildSnapshot
    > {
    this.captures +=
      1;

    return inspectGuild(
      this.guild,
    );
  }
}

const session =
  await readJson<
    ExecutionSessionPlan
  >(
    sessionPath,
  );

const authorizedSnapshot =
  await readJson<
    DiscordGuildSnapshot
  >(
    authorizedSnapshotPath,
  );

/*
 * ========================================================
 * LOCAL FAIL-CLOSED VALIDATION
 * ========================================================
 */

if (
  session.schemaVersion !==
    6
) {
  throw new Error(
    `Execution Session schema inválido: ${String(session.schemaVersion)}.`,
  );
}

if (
  session.status !==
    'ready'
) {
  throw new Error(
    `Execution Session no está ready: ${session.status}.`,
  );
}

if (
  session.executionAllowed !==
    false
) {
  throw new Error(
    'Execution Session viola executionAllowed=false.',
  );
}

if (
  !session.receiptClaim
) {
  throw new Error(
    'Execution Session no contiene Receipt Claim.',
  );
}

if (
  configuredGuildId !==
    session.guild.id
) {
  throw new Error(
    [
      'DISCORD_GUILD_ID no coincide con la Session.',
      `Config=${configuredGuildId}.`,
      `Session=${session.guild.id}.`,
    ].join(
      ' ',
    ),
  );
}

if (
  authorizedSnapshot.guild.id !==
    session.guild.id
) {
  throw new Error(
    'El snapshot autorizado pertenece a otro Guild.',
  );
}

if (
  authorizedSnapshot.capturedAt !==
    session.source
      .snapshotCapturedAt
) {
  throw new Error(
    [
      'latest.json no es el snapshot autorizado por la Session.',
      `Snapshot=${authorizedSnapshot.capturedAt}.`,
      `Session=${session.source.snapshotCapturedAt}.`,
    ].join(
      ' ',
    ),
  );
}

const normalizedAuthorizedSnapshot =
  normalizeDiscordStructureSnapshot(
    authorizedSnapshot,
  );

const baseline =
  createLiveDriftBaseline(
    normalizedAuthorizedSnapshot,
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

/*
 * ========================================================
 * LIVE READ-ONLY CONNECTION
 * ========================================================
 */

const client =
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
    ],
  });

async function waitForReady():
  Promise<void> {
  if (
    client.isReady()
  ) {
    return;
  }

  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      const timeout =
        setTimeout(
          () => {
            cleanup();

            reject(
              new Error(
                'Discord no emitió ClientReady en 20 segundos.',
              ),
            );
          },
          20_000,
        );

      const ready =
        (): void => {
          cleanup();
          resolve();
        };

      const error =
        (
          value:
            Error,
        ): void => {
          cleanup();
          reject(
            value,
          );
        };

      const cleanup =
        (): void => {
          clearTimeout(
            timeout,
          );

          client.off(
            Events.ClientReady,
            ready,
          );

          client.off(
            Events.Error,
            error,
          );
        };

      client.once(
        Events.ClientReady,
        ready,
      );

      client.once(
        Events.Error,
        error,
      );
    },
  );
}

try {
  console.log('');
  console.log(
    '🔬 Live Canary Read-Only Probe',
  );

  console.log('');
  console.log(
    `Session: ${session.sessionId}`,
  );

  console.log(
    `Guild autorizado: ${session.guild.id}`,
  );

  console.log(
    `Snapshot autorizado: ${session.source.snapshotCapturedAt}`,
  );

  console.log('');
  console.log(
    'Conectando Discord en modo de lectura...',
  );

  await client.login(
    token,
  );

  await waitForReady();

  const readyUser =
    client.user;

  if (
    !readyUser
  ) {
    throw new Error(
      'ClientReady ocurrió pero client.user es null.',
    );
  }

  console.log(
    `Compai conectado como: ${readyUser.tag}`,
  );

  const guild =
    await client.guilds.fetch(
      configuredGuildId,
    );

  console.log(
    `Servidor encontrado: ${guild.name}`,
  );

  const snapshotProvider =
    new LiveReadOnlySnapshotProvider(
      guild,
    );

  const transport =
    new NeverMutateCanaryTransport();

  const result =
    await runActionTimeCanary({
      session,

      baseline,

      snapshotProvider,

      transport,

      /*
       * DENEGACIÓN OBLIGATORIA.
       *
       * Aunque Session + PRE + Guard fueran válidos,
       * este probe jamás autoriza el transporte.
       */
      authorizeIntent:
        async (
          intent,
        ) => {
          console.log('');
          console.log(
            '===== ACTION-TIME INTENT OBSERVADO =====',
          );

          console.log(
            `Operación:   ${intent.operationId}`,
          );

          console.log(
            `Blueprint:   ${intent.blueprintId}`,
          );

          console.log(
            `Rol:         ${intent.name}`,
          );

          console.log(
            `Permissions: ${intent.permissions}`,
          );

          console.log(
            `Hoist:       ${String(intent.hoist)}`,
          );

          console.log(
            `Mentionable: ${String(intent.mentionable)}`,
          );

          console.log('');
          console.log(
            'AUTORIZACIÓN ACTION-TIME: DENEGADA POR DISEÑO READ-ONLY.',
          );

          return false;
        },
    });

  const noTransportReached =
    transport.getAttempts() ===
      0 &&
    transport
      .getMutationCalls() ===
      0 &&
    result
      .transportAttempts ===
      0 &&
    result
      .mutationCalls ===
      0;

  const report = {
    schemaVersion:
      1,

    generatedAt:
      new Date()
        .toISOString(),

    mode:
      'live_read_only',

    sessionId:
      session.sessionId,

    guild: {
      id:
        guild.id,

      name:
        guild.name,
    },

    authorizedSnapshotCapturedAt:
      session.source
        .snapshotCapturedAt,

    liveSnapshotCaptures:
      snapshotProvider
        .captures,

    transportAttempts:
      transport
        .getAttempts(),

    mutationCalls:
      transport
        .getMutationCalls(),

    noTransportReached,

    actionTimeResult:
      result,

    discordMutationCalls:
      0,

    executionAllowed:
      false,
  } as const;

  await mkdir(
    outputDirectory,
    {
      recursive:
        true,
    },
  );

  const outputPath =
    path.join(
      outputDirectory,
      'latest.json',
    );

  await writeFile(
    outputPath,
    JSON.stringify(
      report,
      null,
      2,
    ) + '\n',
    'utf8',
  );

  console.log('');
  console.log(
    '===== RESULTADO =====',
  );

  console.log(
    `Estado: ${result.status}`,
  );

  console.log(
    `Snapshots live: ${snapshotProvider.captures}`,
  );

  console.log(
    `Transport attempts: ${transport.getAttempts()}`,
  );

  console.log(
    `Mutation calls: ${transport.getMutationCalls()}`,
  );

  console.log(
    `Transporte nunca alcanzado: ${noTransportReached ? 'SÍ' : 'NO'}`,
  );

  console.log(
    `Requiere inspección manual: ${result.requiresManualInspection ? 'SÍ' : 'NO'}`,
  );

  console.log('');
  console.log(
    'Checks BLOCK:',
  );

  for (
    const check of
    result.checks.filter(
      (
        candidate,
      ) =>
        candidate.status ===
        'block',
    )
  ) {
    console.log(
      `- ${check.id}: ${check.details}`,
    );
  }

  console.log('');
  console.log(
    `Reporte local: ${outputPath}`,
  );

  console.log('');
  console.log(
    'MUTACIONES DISCORD POSIBLES DESDE ESTE PROBE: 0',
  );

  console.log(
    'EJECUCIÓN REAL PERMITIDA: NO',
  );

  if (
    !noTransportReached
  ) {
    throw new Error(
      'INVARIANTE VIOLADA: el probe read-only alcanzó el transporte.',
    );
  }
} finally {
  client.destroy();
}
