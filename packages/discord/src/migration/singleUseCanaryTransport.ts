import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

import type {
  CanaryObservedRole,
  CanaryRoleCreatePayload,
  CanaryRoleGateway,
  SingleUseCanaryTransportErrorCode,
  SingleUseCanaryTransportResult,
} from './canaryTransportTypes.js';

const EXPECTED_OPERATION_ID =
  'create_role:role_notify_news' as const;

const EXPECTED_BLUEPRINT_ID =
  'role_notify_news' as const;

const EXPECTED_NAME =
  'Avisos CDN' as const;

const EXPECTED_DESCRIPTION =
  'Notificaciones generales de noticias.' as const;

const EXPECTED_REASON =
  'The Clock controlled canary migration: create_role:role_notify_news' as const;

export class SingleUseCanaryTransportError
extends Error {
  readonly code:
    SingleUseCanaryTransportErrorCode;

  constructor(
    code:
      SingleUseCanaryTransportErrorCode,
    message: string,
  ) {
    super(
      message,
    );

    this.name =
      'SingleUseCanaryTransportError';

    this.code =
      code;
  }
}

function intentIsExact(
  intent:
    CanaryRoleIntent,
): boolean {
  return (
    intent.schemaVersion ===
      1 &&
    intent.sessionId.length >
      0 &&
    intent.guildId.length >
      0 &&
    intent.operationId ===
      EXPECTED_OPERATION_ID &&
    intent.blueprintId ===
      EXPECTED_BLUEPRINT_ID &&
    intent.name ===
      EXPECTED_NAME &&
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

function createdRoleIsExact(
  role:
    CanaryObservedRole,
  expectedGuildId:
    string,
): boolean {
  return (
    role.id.length >
      0 &&
    role.guildId ===
      expectedGuildId &&
    role.name ===
      EXPECTED_NAME &&
    role.managed ===
      false &&
    role.hoist ===
      false &&
    role.mentionable ===
      true &&
    role.permissions ===
      '0'
  );
}

export class SingleUseCanaryTransport {
  readonly scope =
    'single_role_canary' as const;

  private consumed =
    false;

  private attempts =
    0;

  /**
   * Cuenta únicamente llamadas a
   * gateway.createRole(...).
   */
  private mutationCalls =
    0;

  constructor(
    private readonly gateway:
      CanaryRoleGateway,
  ) {}

  async execute(
    intent:
      CanaryRoleIntent,
  ): Promise<
    SingleUseCanaryTransportResult
  > {
    this.attempts +=
      1;

    /*
     * La instancia queda consumida en su
     * PRIMER intento, incluso si después
     * una precondición bloquea.
     *
     * Esto evita arreglar algo y reutilizar
     * accidentalmente la misma capacidad.
     */
    if (
      this.consumed
    ) {
      throw new SingleUseCanaryTransportError(
        'CANARY_TRANSPORT_SINGLE_USE_CONSUMED',
        'La capacidad Canary ya fue consumida.',
      );
    }

    this.consumed =
      true;

    /*
     * Defense in depth:
     * no confiamos únicamente en Canary Guard.
     */
    if (
      !intentIsExact(
        intent,
      )
    ) {
      throw new SingleUseCanaryTransportError(
        'CANARY_TRANSPORT_INTENT_REJECTED',
        'El intent no coincide exactamente con la allowlist Canary.',
      );
    }

    if (
      this.gateway.guildId !==
        intent.guildId
    ) {
      throw new SingleUseCanaryTransportError(
        'CANARY_TRANSPORT_GUILD_MISMATCH',
        [
          'El gateway pertenece a otro Guild.',
          `Intent=${intent.guildId}.`,
          `Gateway=${this.gateway.guildId}.`,
        ].join(
          ' ',
        ),
      );
    }

    const canManageRoles =
      await this.gateway
        .canManageRoles();

    if (
      !canManageRoles
    ) {
      throw new SingleUseCanaryTransportError(
        'CANARY_TRANSPORT_MANAGE_ROLES_REQUIRED',
        'Compai no posee ManageRoles en action-time.',
      );
    }

    /*
     * Idempotencia / precondición:
     * si Avisos CDN ya existe, NO crear otro.
     */
    const existing =
      await this.gateway
        .findRoleByName(
          EXPECTED_NAME,
        );

    if (
      existing
    ) {
      throw new SingleUseCanaryTransportError(
        'CANARY_TRANSPORT_TARGET_EXISTS',
        [
          'Avisos CDN ya existe.',
          `Role ID=${existing.id}.`,
          'El Canary no creará un duplicado.',
        ].join(
          ' ',
        ),
      );
    }

    const payload:
      CanaryRoleCreatePayload = {
      name:
        EXPECTED_NAME,

      permissions:
        '0',

      hoist:
        false,

      mentionable:
        true,

      reason:
        EXPECTED_REASON,
    };

    /*
     * ÚNICA frontera potencialmente mutativa.
     *
     * En esta etapa el gateway será FAKE.
     */
    this.mutationCalls +=
      1;

    let created:
      CanaryObservedRole;

    try {
      created =
        await this.gateway
          .createRole(
            payload,
          );
    } catch (
      error
    ) {
      throw new SingleUseCanaryTransportError(
        'CANARY_TRANSPORT_CREATE_FAILED',
        [
          'La llamada createRole falló.',
          'No se permite retry automático porque el resultado remoto podría ser ambiguo.',
          error instanceof Error
            ? `Error=${error.message}`
            : `Error=${String(error)}`,
        ].join(
          ' ',
        ),
      );
    }

    /*
     * Una respuesta exitosa del gateway
     * tampoco se acepta a ciegas.
     */
    if (
      !createdRoleIsExact(
        created,
        intent.guildId,
      )
    ) {
      throw new SingleUseCanaryTransportError(
        'CANARY_TRANSPORT_POSTCONDITION_FAILED',
        [
          'El recurso devuelto no cumple las postcondiciones Canary.',
          `Role ID=${created.id || '(vacío)'}.`,
          'No se ejecutará ninguna compensación automática.',
        ].join(
          ' ',
        ),
      );
    }

    return {
      schemaVersion: 1,

      status:
        'applied',

      operationId:
        intent.operationId,

      blueprintId:
        intent.blueprintId,

      sessionId:
        intent.sessionId,

      guildId:
        intent.guildId,

      actualId:
        created.id,

      payload:
        structuredClone(
          payload,
        ),

      observed:
        structuredClone(
          created,
        ),

      executionAllowed:
        false,
    };
  }

  isConsumed():
    boolean {
    return this.consumed;
  }

  getAttempts():
    number {
    return this.attempts;
  }

  getMutationCalls():
    number {
    return this.mutationCalls;
  }
}
