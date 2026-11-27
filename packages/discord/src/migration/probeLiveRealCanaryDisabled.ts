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

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import {
  createProcessActionTimeHumanAuthorizationIO,
  SingleUseCanaryHumanAuthorizer,
} from './actionTimeHumanAuthorization.js';

import {
  runActionTimeCanary,
} from './actionTimeCanaryOrchestrator.js';

import {
  BuildDisabledCanaryTransport,
} from './buildDisabledCanaryTransport.js';

import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

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
    'real-canary-disabled-live',
  );

const outputPath =
  path.join(
    outputDirectory,
    'latest.json',
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

class LiveSnapshotProvider {
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

async function waitForReady(
  client:
    Client,
): Promise<void> {
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

async function main():
  Promise<void> {
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
   * ======================================================
   * LOCAL FAIL-CLOSED VALIDATION
   * ======================================================
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

  const baseline =
    createLiveDriftBaseline(
      normalizeDiscordStructureSnapshot(
        authorizedSnapshot,
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

  const client =
    new Client({
      intents: [
        GatewayIntentBits.Guilds,
      ],
    });

  try {
    console.log('');
    console.log(
      '🔐 Real Canary Pipeline — BUILD DISABLED',
    );

    console.log('');
    console.log(
      `Session: ${session.sessionId}`,
    );

    console.log(
      `Guild: ${session.guild.id}`,
    );

    console.log(
      `Snapshot autorizado: ${session.source.snapshotCapturedAt}`,
    );

    console.log('');
    console.log(
      'MUTATION ARM: DISABLED BY BUILD',
    );

    await client.login(
      token,
    );

    await waitForReady(
      client,
    );

    if (
      !client.user
    ) {
      throw new Error(
        'ClientReady ocurrió pero client.user es null.',
      );
    }

    console.log(
      `Compai conectado como: ${client.user.tag}`,
    );

    const guild =
      await client.guilds.fetch(
        configuredGuildId,
      );

    console.log(
      `Servidor encontrado: ${guild.name}`,
    );

    const snapshotProvider =
      new LiveSnapshotProvider(
        guild,
      );

    /*
     * Este objeto es incapaz de mutar.
     *
     * No recibe Guild ni Gateway.
     */
    const disabledTransport =
      new BuildDisabledCanaryTransport();

    const humanAuthorizer =
      new SingleUseCanaryHumanAuthorizer({
        context: {
          sessionId:
            session.sessionId,

          guildId:
            session.guild.id,

          receiptExpiresAt:
            session.source
              .receiptExpiresAt,

          snapshotCapturedAt:
            session.source
              .snapshotCapturedAt,
        },

        io:
          createProcessActionTimeHumanAuthorizationIO(),
      });

    const result =
      await runActionTimeCanary({
        session,

        baseline,

        snapshotProvider,

        transport:
          disabledTransport,

        authorizeIntent:
          async (
            intent,
          ) =>
            humanAuthorizer
              .authorize(
                intent,
              ),
      });

    const report = {
      schemaVersion:
        1,

      generatedAt:
        new Date()
          .toISOString(),

      mode:
        'live_real_canary_pipeline_build_disabled',

      mutationArm:
        'disabled_by_build',

      sessionId:
        session.sessionId,

      guild: {
        id:
          guild.id,

        name:
          guild.name,
      },

      snapshotCaptures:
        snapshotProvider
          .captures,

      transportAttempts:
        disabledTransport
          .getAttempts(),

      mutationCalls:
        disabledTransport
          .getMutationCalls(),

      transportConsumed:
        disabledTransport
          .isConsumed(),

      realGatewayPresent:
        false,

      realTransportPresent:
        false,

      result,

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
      `Estado orchestrator: ${result.status}`,
    );

    console.log(
      `Snapshots live: ${snapshotProvider.captures}`,
    );

    console.log(
      `Transport attempts: ${disabledTransport.getAttempts()}`,
    );

    console.log(
      `Mutation calls: ${disabledTransport.getMutationCalls()}`,
    );

    console.log(
      `Transporte consumido: ${disabledTransport.isConsumed() ? 'SÍ' : 'NO'}`,
    );

    console.log(
      'Gateway real presente: NO',
    );

    console.log(
      'SingleUseCanaryTransport real presente: NO',
    );

    console.log(
      'MUTATION ARM: DISABLED BY BUILD',
    );

    console.log(
      'EJECUCIÓN REAL PERMITIDA: NO',
    );

    if (
      result.failure
    ) {
      console.log('');
      console.log(
        `Failure stage: ${result.failure.stage}`,
      );

      console.log(
        `Failure: ${result.failure.message}`,
      );
    }

    console.log('');
    console.log(
      `Reporte: ${outputPath}`,
    );
  } finally {
    client.destroy();
  }
}

await main();
