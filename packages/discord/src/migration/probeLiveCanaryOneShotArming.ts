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
  evaluateSingleOperationCanary,
} from './canaryGuard.js';

import type {
  CanaryGuardResult,
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import {
  createProcessActionTimeHumanAuthorizationIO,
  SingleUseCanaryHumanAuthorizer,
} from './actionTimeHumanAuthorization.js';

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
    'canary-one-shot-arming-live',
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

function intentsEqual(
  left:
    CanaryRoleIntent,
  right:
    CanaryRoleIntent,
): boolean {
  /*
   * Comparación campo a campo.
   *
   * No dependemos del orden de propiedades
   * producido por JSON.stringify().
   */
  return (
    left.schemaVersion ===
      right.schemaVersion &&
    left.sessionId ===
      right.sessionId &&
    left.guildId ===
      right.guildId &&
    left.operationId ===
      right.operationId &&
    left.blueprintId ===
      right.blueprintId &&
    left.name ===
      right.name &&
    left.description ===
      right.description &&
    left.hoist ===
      right.hoist &&
    left.mentionable ===
      right.mentionable &&
    left.permissions ===
      right.permissions &&
    left.executionAllowed ===
      right.executionAllowed
  );
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

interface ArmingReportOptions {
  status:
    | 'blocked_guard1'
    | 'blocked_authorization'
    | 'blocked_pre2'
    | 'blocked_guard2'
    | 'blocked_intent_change'
    | 'armed_ready_but_disabled';

  reason:
    string;

  session:
    ExecutionSessionPlan;

  guildId:
    string;

  guildName:
    string;

  captures:
    number;

  guard1:
    CanaryGuardResult |
    null;

  guard2:
    CanaryGuardResult |
    null;

  humanAuthorizationAccepted:
    boolean;
}

async function writeReport(
  options:
    ArmingReportOptions,
): Promise<void> {
  const report = {
    schemaVersion:
      1,

    generatedAt:
      new Date()
        .toISOString(),

    mode:
      'live_one_shot_arming_probe',

    status:
      options.status,

    reason:
      options.reason,

    mutationArm:
      'disabled_by_build',

    sessionId:
      options.session.sessionId,

    guild: {
      id:
        options.guildId,

      name:
        options.guildName,
    },

    authorizedSnapshotCapturedAt:
      options.session.source
        .snapshotCapturedAt,

    humanAuthorizationAccepted:
      options
        .humanAuthorizationAccepted,

    liveSnapshotCaptures:
      options.captures,

    guard1:
      options.guard1,

    guard2:
      options.guard2,

    transportPresent:
      false,

    gatewayPresent:
      false,

    transportAttempts:
      0,

    mutationCalls:
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
    '===== RESULTADO ARMING PROBE =====',
  );

  console.log(
    `Estado: ${options.status}`,
  );

  console.log(
    `Razón: ${options.reason}`,
  );

  console.log(
    `Snapshots live: ${options.captures}`,
  );

  console.log(
    `TTY aceptada: ${options.humanAuthorizationAccepted ? 'SÍ' : 'NO'}`,
  );

  console.log(
    'MUTATION ARM: DISABLED BY BUILD',
  );

  console.log(
    'Gateway mutativo presente: NO',
  );

  console.log(
    'Transporte mutativo presente: NO',
  );

  console.log(
    'Transport attempts: 0',
  );

  console.log(
    'Mutation calls: 0',
  );

  console.log(
    'EJECUCIÓN REAL PERMITIDA: NO',
  );

  console.log('');
  console.log(
    `Reporte: ${outputPath}`,
  );
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
   * ======================================================
   * LIVE CONNECTION — READ ONLY
   * ======================================================
   */

  const client =
    new Client({
      intents: [
        GatewayIntentBits.Guilds,
      ],
    });

  try {
    console.log('');
    console.log(
      '🧷 Canary One-Shot Arming Probe',
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
     * ====================================================
     * PRE1 + GUARD1
     * ====================================================
     */

    const pre1 =
      await snapshotProvider
        .capture();

    const normalizedPre1 =
      normalizeDiscordStructureSnapshot(
        pre1,
      );

    const guard1 =
      evaluateSingleOperationCanary({
        session,

        baseline,

        currentSnapshot:
          normalizedPre1,

        now:
          new Date(),
      });

    if (
      guard1.status !==
        'ready_for_simulation' ||
      !guard1.intent
    ) {
      await writeReport({
        status:
          'blocked_guard1',

        reason:
          'Guard1 bloqueó antes de cualquier autorización humana.',

        session,

        guildId:
          guild.id,

        guildName:
          guild.name,

        captures:
          snapshotProvider
            .captures,

        guard1,

        guard2:
          null,

        humanAuthorizationAccepted:
          false,
      });

      return;
    }

    const authorizedIntent =
      structuredClone(
        guard1.intent,
      );

    /*
     * ====================================================
     * TTY SINGLE-USE
     * ====================================================
     */

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

    const humanAuthorized =
      await humanAuthorizer
        .authorize(
          structuredClone(
            authorizedIntent,
          ),
        );

    if (
      !humanAuthorized
    ) {
      await writeReport({
        status:
          'blocked_authorization',

        reason:
          'La autorización humana action-time no fue concedida.',

        session,

        guildId:
          guild.id,

        guildName:
          guild.name,

        captures:
          snapshotProvider
            .captures,

        guard1,

        guard2:
          null,

        humanAuthorizationAccepted:
          false,
      });

      return;
    }

    /*
     * ====================================================
     * PRE2 — DESPUÉS DEL HUMANO
     * ====================================================
     */

    let pre2:
      DiscordGuildSnapshot;

    try {
      pre2 =
        await snapshotProvider
          .capture();
    } catch (
      error
    ) {
      await writeReport({
        status:
          'blocked_pre2',

        reason:
          `PRE2 falló: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,

        session,

        guildId:
          guild.id,

        guildName:
          guild.name,

        captures:
          snapshotProvider
            .captures,

        guard1,

        guard2:
          null,

        humanAuthorizationAccepted:
          true,
      });

      return;
    }

    const normalizedPre2 =
      normalizeDiscordStructureSnapshot(
        pre2,
      );

    /*
     * ====================================================
     * GUARD2
     * ====================================================
     */

    const guard2 =
      evaluateSingleOperationCanary({
        session,

        baseline,

        currentSnapshot:
          normalizedPre2,

        now:
          new Date(),
      });

    if (
      guard2.status !==
        'ready_for_simulation' ||
      !guard2.intent
    ) {
      await writeReport({
        status:
          'blocked_guard2',

        reason:
          'Guard2 bloqueó después de la autorización humana.',

        session,

        guildId:
          guild.id,

        guildName:
          guild.name,

        captures:
          snapshotProvider
            .captures,

        guard1,

        guard2,

        humanAuthorizationAccepted:
          true,
      });

      return;
    }

    const executionIntent =
      structuredClone(
        guard2.intent,
      );

    /*
     * ====================================================
     * INTENT STABILITY
     * ====================================================
     */

    if (
      !intentsEqual(
        authorizedIntent,
        executionIntent,
      )
    ) {
      await writeReport({
        status:
          'blocked_intent_change',

        reason:
          'El intent cambió entre Guard1 y Guard2.',

        session,

        guildId:
          guild.id,

        guildName:
          guild.name,

        captures:
          snapshotProvider
            .captures,

        guard1,

        guard2,

        humanAuthorizationAccepted:
          true,
      });

      return;
    }

    /*
     * ====================================================
     * HARD STOP
     * ====================================================
     *
     * No existe:
     * - DiscordJsCanaryRoleGateway;
     * - SingleUseCanaryTransport;
     * - createRole();
     * - roles.create();
     *
     * Haber llegado aquí NO permite mutar.
     */

    await writeReport({
      status:
        'armed_ready_but_disabled',

      reason:
        'Guard1 + TTY + Guard2 + intent stability pasaron, pero el mutation arm está deshabilitado por build.',

      session,

      guildId:
        guild.id,

      guildName:
        guild.name,

      captures:
        snapshotProvider
          .captures,

      guard1,

      guard2,

      humanAuthorizationAccepted:
        true,
    });
  } finally {
    client.destroy();
  }
}

await main();
