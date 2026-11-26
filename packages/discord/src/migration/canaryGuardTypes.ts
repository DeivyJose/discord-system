import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import type {
  LiveDriftBaseline,
  LiveDriftVerification,
  NormalizedDiscordStructureSnapshot,
} from './liveDriftTypes.js';

export type CanaryGuardCheckStatus =
  | 'pass'
  | 'block';

export interface CanaryGuardCheck {
  id: string;

  status:
    CanaryGuardCheckStatus;

  details: string;
}

export interface CanaryRoleIntent {
  schemaVersion: 1;

  sessionId: string;

  guildId: string;

  operationId:
    'create_role:role_notify_news';

  blueprintId:
    'role_notify_news';

  name:
    'Avisos CDN';

  description:
    'Notificaciones generales de noticias.';

  hoist: false;

  mentionable: true;

  /**
   * Discord role permissions.
   *
   * "0" significa:
   * ningún permiso de Discord otorgado
   * por esta creación.
   */
  permissions: '0';

  /**
   * Intent estrictamente limitado al flujo Canary.
   *
   * executionAllowed permanece false porque el
   * intent por sí mismo nunca constituye una
   * autorización general para ejecutar Discord.
   */
  executionAllowed: false;
}

export interface CanaryGuardOptions {
  session:
    ExecutionSessionPlan;

  baseline:
    LiveDriftBaseline;

  currentSnapshot:
    NormalizedDiscordStructureSnapshot;

  now?: Date;
}

export type CanaryGuardStatus =
  | 'ready_for_simulation'
  | 'blocked';

export interface CanaryGuardResult {
  schemaVersion: 1;

  generatedAt: string;

  status:
    CanaryGuardStatus;

  checks:
    CanaryGuardCheck[];

  drift:
    LiveDriftVerification |
    null;

  intent:
    CanaryRoleIntent |
    null;

  session:
    Pick<
      ExecutionSessionPlan,
      | 'sessionId'
      | 'gateFingerprint'
      | 'gateEnvelopeFingerprint'
    >;

  executionAllowed: false;
}
