import {
  PermissionFlagsBits,
} from 'discord.js';

import type {
  Guild,
  Role,
} from 'discord.js';

import type {
  CanaryObservedRole,
  CanaryRoleCreatePayload,
  CanaryRoleGateway,
} from './canaryTransportTypes.js';

const EXPECTED_NAME =
  'Avisos CDN' as const;

const EXPECTED_REASON =
  'The Clock controlled canary migration: create_role:role_notify_news' as const;

export type DiscordJsCanaryRoleGatewayErrorCode =
  | 'DISCORDJS_CANARY_PAYLOAD_REJECTED';

export class DiscordJsCanaryRoleGatewayError
extends Error {
  readonly code:
    DiscordJsCanaryRoleGatewayErrorCode;

  constructor(
    code:
      DiscordJsCanaryRoleGatewayErrorCode,
    message: string,
  ) {
    super(
      message,
    );

    this.name =
      'DiscordJsCanaryRoleGatewayError';

    this.code =
      code;
  }
}

function observeRole(
  role: Role,
): CanaryObservedRole {
  return {
    id:
      role.id,

    guildId:
      role.guild.id,

    name:
      role.name,

    managed:
      role.managed,

    hoist:
      role.hoist,

    mentionable:
      role.mentionable,

    permissions:
      role.permissions
        .bitfield
        .toString(),
  };
}

function payloadIsExact(
  payload:
    CanaryRoleCreatePayload,
): boolean {
  return (
    payload.name ===
      EXPECTED_NAME &&
    payload.permissions ===
      '0' &&
    payload.hoist ===
      false &&
    payload.mentionable ===
      true &&
    payload.reason ===
      EXPECTED_REASON
  );
}

/**
 * Adapter mínimo Discord.js para el Canary.
 *
 * IMPORTANTE:
 * - no crea Client;
 * - no hace login;
 * - no conoce tokens;
 * - no tiene retry;
 * - no edita;
 * - no elimina;
 * - no mueve;
 * - no crea canales/categorías;
 * - solo expone la interfaz CanaryRoleGateway.
 *
 * Si recibe un Guild real, createRole() sí representa
 * una frontera potencialmente mutativa.
 *
 * Por eso NO existe todavía ningún entrypoint que
 * instancie esta clase con un Guild real.
 */
export class DiscordJsCanaryRoleGateway
implements CanaryRoleGateway {
  readonly guildId:
    string;

  constructor(
    private readonly guild:
      Guild,
  ) {
    this.guildId =
      guild.id;
  }

  async canManageRoles():
    Promise<boolean> {
    const botMember =
      await this.guild
        .members
        .fetchMe();

    /*
     * Política deliberadamente estricta:
     *
     * Compai debe poseer ManageRoles explícitamente
     * y NO debe poseer Administrator.
     */
    const administrator =
      botMember.permissions.has(
        PermissionFlagsBits.Administrator,
        false,
      );

    const manageRoles =
      botMember.permissions.has(
        PermissionFlagsBits.ManageRoles,
        false,
      );

    return (
      manageRoles &&
      !administrator
    );
  }

  async findRoleByName(
    name: string,
  ): Promise<
    CanaryObservedRole |
    null
  > {
    /*
     * Fetch remoto deliberado.
     *
     * No dependemos únicamente del cache local
     * para decidir si el target ya existe.
     */
    const roles =
      await this.guild
        .roles
        .fetch();

    const role =
      roles.find(
        (candidate) =>
          candidate.name ===
            name,
      );

    return role
      ? observeRole(
          role,
        )
      : null;
  }

  async createRole(
    payload:
      CanaryRoleCreatePayload,
  ): Promise<
    CanaryObservedRole
  > {
    /*
     * Defense in depth.
     *
     * Aunque SingleUseCanaryTransport ya valida
     * el payload, esta última frontera vuelve a
     * comprobarlo antes de llamar Discord.js.
     */
    if (
      !payloadIsExact(
        payload,
      )
    ) {
      throw new DiscordJsCanaryRoleGatewayError(
        'DISCORDJS_CANARY_PAYLOAD_REJECTED',
        'El payload no coincide exactamente con la allowlist Discord.js Canary.',
      );
    }

    /*
     * ÚNICA llamada mutativa posible de esta clase.
     *
     * permissions usa BigInt deliberadamente.
     */
    const role =
      await this.guild
        .roles
        .create({
          name:
            EXPECTED_NAME,

          permissions:
            0n,

          hoist:
            false,

          mentionable:
            true,

          reason:
            EXPECTED_REASON,
        });

    return observeRole(
      role,
    );
  }
}
