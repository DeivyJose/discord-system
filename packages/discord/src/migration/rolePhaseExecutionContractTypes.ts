import type {
  BoundBindingAwareCheckpoint,
} from './checkpointedBindingResumeTypes.js';

import type {
  ExecutionAdapterSnapshot,
} from './executionAdapterTypes.js';

import type {
  ExecutionJournalRun,
} from './executionJournalTypes.js';

import type {
  SessionBindingCommitResult,
  SessionBindingRegistrySnapshot,
} from './sessionBindingRegistryTypes.js';

export type RolePhaseExecutionCheckStatus =
  | 'pass'
  | 'block';

export interface RolePhaseExecutionCheck {
  id: string;

  status:
    RolePhaseExecutionCheckStatus;

  details: string;
}

export type RolePhaseFailureClassification =
  | 'none'
  | 'pre_dispatch'
  | 'ambiguous_after_mutation';

export type RolePhaseExecutionBlockReason =
  | 'contract_consumed'
  | 'plan_or_operations_invalid'
  | null;

export interface RolePhaseFakeFault {
  /*
   * Exclusivamente para simulaciones/tests.
   *
   * El Fake Adapter registra primero la creación
   * y luego lanza error. Esto simula el caso
   * "la llamada remota pudo haber ocurrido".
   */
  throwAfterCreateOperationId:
    string;
}

export interface RolePhaseFakeExecutionOptions {
  sessionKey: string;

  confirmedBindings:
    Readonly<
      Record<
        string,
        string
      >
    >;

  fault?:
    RolePhaseFakeFault;
}

export interface RolePhaseFakeExecutionResult {
  schemaVersion: 1;

  generatedAt: string;

  status:
    | 'completed'
    | 'stopped_on_error'
    | 'blocked';

  blockReason:
    RolePhaseExecutionBlockReason;

  contractConsumed:
    boolean;

  adapterCreated:
    boolean;

  registryCreated:
    boolean;

  rolePhasePlanFingerprint:
    string;

  checks:
    RolePhaseExecutionCheck[];

  journal:
    ExecutionJournalRun |
    null;

  bindingCommit:
    SessionBindingCommitResult |
    null;

  sealedCheckpoint:
    BoundBindingAwareCheckpoint |
    null;

  finalAdapterSnapshot:
    ExecutionAdapterSnapshot |
    null;

  finalRegistrySnapshot:
    SessionBindingRegistrySnapshot |
    null;

  summary: {
    operations: number;

    attempted: number;

    succeeded: number;

    failed: number;

    finalActions: number;

    uniqueActions: number;

    sessionBindings: number;

    failureClassification:
      RolePhaseFailureClassification;

    resumeAvailable:
      boolean;
  };

  executionAllowed: false;
}

export type RolePhaseResumeBlockReason =
  | 'contract_consumed'
  | 'plan_or_operations_invalid'
  | 'ambiguous_checkpoint'
  | 'checkpoint_resume_blocked'
  | null;

export interface RolePhaseFakeResumeResult {
  schemaVersion: 1;

  generatedAt: string;

  status:
    | 'completed'
    | 'stopped_on_error'
    | 'blocked';

  blockReason:
    RolePhaseResumeBlockReason;

  contractConsumed:
    boolean;

  adapterRestored:
    boolean;

  registryRestored:
    boolean;

  rolePhasePlanFingerprint:
    string;

  checks:
    RolePhaseExecutionCheck[];

  journal:
    ExecutionJournalRun |
    null;

  bindingCommit:
    SessionBindingCommitResult |
    null;

  sealedCheckpoint:
    BoundBindingAwareCheckpoint |
    null;

  finalAdapterSnapshot:
    ExecutionAdapterSnapshot |
    null;

  finalRegistrySnapshot:
    SessionBindingRegistrySnapshot |
    null;

  summary: {
    finalActions: number;

    uniqueActions: number;

    sessionBindings: number;

    resumeAvailable:
      boolean;
  };

  executionAllowed: false;
}
