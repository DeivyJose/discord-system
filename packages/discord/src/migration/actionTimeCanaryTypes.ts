import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import type {
  LiveDriftBaseline,
} from './liveDriftTypes.js';

import type {
  CanaryGuardResult,
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

import type {
  SingleUseCanaryTransportResult,
} from './canaryTransportTypes.js';

export type ActionTimeCanaryCheckStatus =
  | 'pass'
  | 'block';

export interface ActionTimeCanaryCheck {
  id: string;

  status:
    ActionTimeCanaryCheckStatus;

  details: string;
}

export type ActionTimeCanaryStatus =
  | 'completed'
  | 'blocked_before_transport'
  | 'transport_failed'
  | 'postcondition_failed';

export type ActionTimeCanaryFailureStage =
  | 'pre_inspection'
  | 'guard'
  | 'transport'
  | 'post_inspection'
  | 'postcondition';

export interface ActionTimeCanaryFailure {
  stage:
    ActionTimeCanaryFailureStage;

  message:
    string;
}

export interface ActionTimeCanarySnapshotProvider {
  capture():
    Promise<
      DiscordGuildSnapshot
    >;
}

export interface ActionTimeCanaryTransport {
  execute(
    intent:
      CanaryRoleIntent,
  ): Promise<
    SingleUseCanaryTransportResult
  >;

  isConsumed():
    boolean;

  getAttempts():
    number;

  getMutationCalls():
    number;
}

export interface ActionTimeCanaryOptions {
  session:
    ExecutionSessionPlan;

  baseline:
    LiveDriftBaseline;

  snapshotProvider:
    ActionTimeCanarySnapshotProvider;

  transport:
    ActionTimeCanaryTransport;

  /**
   * Inyectable para tests históricos.
   */
  now?:
    () => Date;
}

export interface ActionTimeCanaryResult {
  schemaVersion: 1;

  startedAt:
    string;

  finishedAt:
    string;

  status:
    ActionTimeCanaryStatus;

  checks:
    ActionTimeCanaryCheck[];

  guard:
    CanaryGuardResult |
    null;

  transportResult:
    SingleUseCanaryTransportResult |
    null;

  preSnapshotCapturedAt:
    string |
    null;

  postSnapshotCapturedAt:
    string |
    null;

  transportAttempts:
    number;

  mutationCalls:
    number;

  /**
   * true cuando una mutación pudo haber llegado
   * a Discord pero el estado final no puede
   * declararse seguro automáticamente.
   */
  requiresManualInspection:
    boolean;

  failure:
    ActionTimeCanaryFailure |
    null;

  executionAllowed:
    false;
}
