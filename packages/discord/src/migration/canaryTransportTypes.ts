import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

export type SingleUseCanaryTransportErrorCode =
  | 'CANARY_TRANSPORT_SINGLE_USE_CONSUMED'
  | 'CANARY_TRANSPORT_INTENT_REJECTED'
  | 'CANARY_TRANSPORT_GUILD_MISMATCH'
  | 'CANARY_TRANSPORT_MANAGE_ROLES_REQUIRED'
  | 'CANARY_TRANSPORT_TARGET_EXISTS'
  | 'CANARY_TRANSPORT_CREATE_FAILED'
  | 'CANARY_TRANSPORT_POSTCONDITION_FAILED';

export interface CanaryRoleCreatePayload {
  name:
    'Avisos CDN';

  permissions:
    '0';

  hoist:
    false;

  mentionable:
    true;

  reason:
    'The Clock controlled canary migration: create_role:role_notify_news';
}

export interface CanaryObservedRole {
  id: string;

  guildId: string;

  name: string;

  managed: boolean;

  hoist: boolean;

  mentionable: boolean;

  permissions: string;
}

/**
 * Frontera mínima que el transporte necesita.
 *
 * IMPORTANTE:
 * en esta etapa solamente existirá una implementación
 * FAKE dentro del test.
 *
 * Todavía NO existe implementación Discord.js.
 */
export interface CanaryRoleGateway {
  readonly guildId:
    string;

  canManageRoles():
    Promise<boolean>;

  findRoleByName(
    name: string,
  ): Promise<
    CanaryObservedRole |
    null
  >;

  createRole(
    payload:
      CanaryRoleCreatePayload,
  ): Promise<
    CanaryObservedRole
  >;
}

export interface SingleUseCanaryTransportResult {
  schemaVersion: 1;

  status:
    'applied';

  operationId:
    CanaryRoleIntent['operationId'];

  blueprintId:
    CanaryRoleIntent['blueprintId'];

  sessionId: string;

  guildId: string;

  actualId: string;

  payload:
    CanaryRoleCreatePayload;

  observed:
    CanaryObservedRole;

  /**
   * El resultado no autoriza replay
   * ni una segunda operación.
   */
  executionAllowed: false;
}
