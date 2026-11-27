import {
  randomBytes,
} from 'node:crypto';

import {
  createInterface,
} from 'node:readline/promises';

import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

const EXPECTED_OPERATION_ID =
  'create_role:role_notify_news' as const;

const EXPECTED_BLUEPRINT_ID =
  'role_notify_news' as const;

const EXPECTED_ROLE_NAME =
  'Avisos CDN' as const;

const EXPECTED_DESCRIPTION =
  'Notificaciones generales de noticias.' as const;

const MAXIMUM_SNAPSHOT_AGE_MS =
  30 * 60_000;

const MAXIMUM_CHALLENGE_AGE_MS =
  120_000;

const NONCE_PATTERN =
  /^[a-f0-9]{24}$/;

export interface ActionTimeHumanAuthorizationIO {
  inputIsTTY:
    boolean;

  outputIsTTY:
    boolean;

  write(
    value:
      string,
  ): void;

  readLine(
    prompt:
      string,
  ): Promise<string>;
}

export interface ActionTimeHumanAuthorizationContext {
  sessionId:
    string;

  guildId:
    string;

  receiptExpiresAt:
    string;

  snapshotCapturedAt:
    string;
}

export interface SingleUseCanaryHumanAuthorizerOptions {
  context:
    ActionTimeHumanAuthorizationContext;

  io:
    ActionTimeHumanAuthorizationIO;

  /**
   * Solo para tests deterministas.
   * El runner real no debe inyectarlo.
   */
  nonceFactory?:
    () => string;

  /**
   * Solo para tests deterministas.
   */
  now?:
    () => Date;
}

function currentTime(
  options:
    SingleUseCanaryHumanAuthorizerOptions,
): Date {
  return options.now
    ? options.now()
    : new Date();
}

function validDate(
  value:
    string,
): boolean {
  return Number.isFinite(
    new Date(
      value,
    ).getTime(),
  );
}

function authorizationContextIsFresh(
  context:
    ActionTimeHumanAuthorizationContext,
  now:
    Date,
): boolean {
  if (
    !validDate(
      context.receiptExpiresAt,
    ) ||
    !validDate(
      context.snapshotCapturedAt,
    )
  ) {
    return false;
  }

  const nowMs =
    now.getTime();

  const receiptExpiresAtMs =
    new Date(
      context.receiptExpiresAt,
    ).getTime();

  const snapshotCapturedAtMs =
    new Date(
      context.snapshotCapturedAt,
    ).getTime();

  const snapshotAgeMs =
    nowMs -
    snapshotCapturedAtMs;

  return (
    nowMs <
      receiptExpiresAtMs &&
    snapshotAgeMs >=
      0 &&
    snapshotAgeMs <
      MAXIMUM_SNAPSHOT_AGE_MS
  );
}

function intentIsExact(
  intent:
    CanaryRoleIntent,
  context:
    ActionTimeHumanAuthorizationContext,
): boolean {
  return (
    intent.schemaVersion ===
      1 &&
    intent.sessionId ===
      context.sessionId &&
    intent.guildId ===
      context.guildId &&
    intent.operationId ===
      EXPECTED_OPERATION_ID &&
    intent.blueprintId ===
      EXPECTED_BLUEPRINT_ID &&
    intent.name ===
      EXPECTED_ROLE_NAME &&
    intent.description ===
      EXPECTED_DESCRIPTION &&
    intent.hoist ===
      false &&
    intent.mentionable ===
      true &&
    intent.permissions ===
      '0' &&
    intent.executionAllowed ===
      false
  );
}

function createNonce():
  string {
  return randomBytes(
    12,
  ).toString(
    'hex',
  );
}

export function createProcessActionTimeHumanAuthorizationIO():
  ActionTimeHumanAuthorizationIO {
  return {
    inputIsTTY:
      process.stdin.isTTY ===
      true,

    outputIsTTY:
      process.stdout.isTTY ===
      true,

    write:
      (
        value:
          string,
      ): void => {
        process.stdout.write(
          value,
        );
      },

    readLine:
      async (
        prompt:
          string,
      ): Promise<string> => {
        const readline =
          createInterface({
            input:
              process.stdin,

            output:
              process.stdout,
          });

        try {
          return await readline.question(
            prompt,
          );
        } finally {
          readline.close();
        }
      },
  };
}

export function buildCanaryActionTimeChallenge(
  options: {
    context:
      ActionTimeHumanAuthorizationContext;

    intent:
      CanaryRoleIntent;

    issuedAt:
      Date;

    nonce:
      string;
  },
): string {
  if (
    !NONCE_PATTERN.test(
      options.nonce,
    )
  ) {
    throw new Error(
      'Nonce action-time inválido.',
    );
  }

  return [
    'CREATE EXACT CANARY',
    `guild=${options.context.guildId}`,
    `session=${options.context.sessionId}`,
    `op=${options.intent.operationId}`,
    `blueprint=${options.intent.blueprintId}`,
    `name=${options.intent.name}`,
    `permissions=${options.intent.permissions}`,
    `hoist=${String(options.intent.hoist)}`,
    `mentionable=${String(options.intent.mentionable)}`,
    `issued=${options.issuedAt.toISOString()}`,
    `nonce=${options.nonce}`,
  ].join(
    ' | ',
  );
}

export class SingleUseCanaryHumanAuthorizer {
  private consumed =
    false;

  private attempts =
    0;

  constructor(
    private readonly options:
      SingleUseCanaryHumanAuthorizerOptions,
  ) {}

  async authorize(
    intent:
      CanaryRoleIntent,
  ): Promise<boolean> {
    if (
      this.consumed
    ) {
      return false;
    }

    /*
     * Single-use incluso si:
     * - no es TTY;
     * - el intent no coincide;
     * - la frase es incorrecta;
     * - la autorización está vencida.
     */
    this.consumed =
      true;

    this.attempts +=
      1;

    const {
      context,
      io,
    } =
      this.options;

    if (
      !io.inputIsTTY ||
      !io.outputIsTTY
    ) {
      io.write(
        '\nBLOCK: la autorización action-time exige stdin y stdout TTY.\n',
      );

      return false;
    }

    if (
      !intentIsExact(
        intent,
        context,
      )
    ) {
      io.write(
        '\nBLOCK: el intent no coincide con el Canary exacto permitido.\n',
      );

      return false;
    }

    const issuedAt =
      currentTime(
        this.options,
      );

    if (
      !authorizationContextIsFresh(
        context,
        issuedAt,
      )
    ) {
      io.write(
        '\nBLOCK: Receipt o snapshot ya no están frescos al abrir la confirmación.\n',
      );

      return false;
    }

    const nonce =
      this.options
        .nonceFactory
        ? this.options
            .nonceFactory()
        : createNonce();

    if (
      !NONCE_PATTERN.test(
        nonce,
      )
    ) {
      throw new Error(
        'Nonce action-time inválido.',
      );
    }

    const challenge =
      buildCanaryActionTimeChallenge({
        context,
        intent,
        issuedAt,
        nonce,
      });

    io.write(
      [
        '',
        '============================================================',
        'CONFIRMACIÓN HUMANA ACTION-TIME',
        '============================================================',
        '',
        'Esta acción, si posteriormente supera el segundo Guard,',
        'podrá crear exactamente UN rol de Discord:',
        '',
        `  Guild:       ${context.guildId}`,
        `  Session:     ${context.sessionId}`,
        `  Operación:   ${intent.operationId}`,
        `  Blueprint:   ${intent.blueprintId}`,
        `  Rol:         ${intent.name}`,
        `  Permissions: ${intent.permissions}`,
        `  Hoist:       ${String(intent.hoist)}`,
        `  Mentionable: ${String(intent.mentionable)}`,
        '',
        'NO hay retry automático.',
        'NO hay rollback automático.',
        'Una respuesta incorrecta consume esta autorización.',
        '',
        'Frase exacta:',
        challenge,
        '',
      ].join(
        '\n',
      ),
    );

    const answer =
      await io.readLine(
        'Confirmación exacta: ',
      );

    const answeredAt =
      currentTime(
        this.options,
      );

    const challengeAgeMs =
      answeredAt.getTime() -
      issuedAt.getTime();

    if (
      challengeAgeMs <
        0 ||
      challengeAgeMs >
        MAXIMUM_CHALLENGE_AGE_MS
    ) {
      io.write(
        '\nBLOCK: la ventana action-time de 120 segundos expiró.\n',
      );

      return false;
    }

    /*
     * Defensa adicional:
     * Receipt y snapshot deben seguir frescos
     * DESPUÉS de la interacción humana.
     */
    if (
      !authorizationContextIsFresh(
        context,
        answeredAt,
      )
    ) {
      io.write(
        '\nBLOCK: Receipt o snapshot expiraron durante la confirmación.\n',
      );

      return false;
    }

    if (
      answer !==
      challenge
    ) {
      io.write(
        '\nBLOCK: frase action-time incorrecta.\n',
      );

      return false;
    }

    io.write(
      '\nConfirmación action-time exacta aceptada.\n',
    );

    return true;
  }

  isConsumed():
    boolean {
    return this.consumed;
  }

  getAttempts():
    number {
    return this.attempts;
  }
}
