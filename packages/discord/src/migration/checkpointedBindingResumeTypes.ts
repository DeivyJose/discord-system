import type {
  AutomatableMigrationOperation,
  DiscordExecutionAdapter,
  ExecutionAdapterSnapshot,
} from './executionAdapterTypes.js';

import type {
  BoundExecutionCheckpoint,
  CheckpointIntegrityContext,
  CheckpointIntegrityVerification,
} from './checkpointIntegrityTypes.js';

import type {
  ExecutionJournalHookContext,
  ExecutionJournalRun,
} from './executionJournalTypes.js';

import type {
  SessionBindingRegistry,
} from './sessionBindingRegistry.js';

import type {
  SessionBindingCommitResult,
  SessionBindingRegistrySnapshot,
} from './sessionBindingRegistryTypes.js';

export interface BoundBindingAwareCheckpoint {
  schemaVersion: 1;

  algorithm: 'sha256';

  sealedAt: string;

  executionCheckpoint:
    BoundExecutionCheckpoint;

  bindingRegistrySnapshot:
    SessionBindingRegistrySnapshot;

  integrityFingerprint: string;

  executionAllowed: false;
}

export type BindingAwareCheckpointCheckStatus =
  | 'pass'
  | 'block';

export interface BindingAwareCheckpointCheck {
  id: string;

  status:
    BindingAwareCheckpointCheckStatus;

  details: string;
}

export interface BindingAwareCheckpointVerification {
  schemaVersion: 1;

  verifiedAt: string;

  status:
    | 'valid'
    | 'blocked';

  checks:
    BindingAwareCheckpointCheck[];

  executionCheckpointIntegrity:
    CheckpointIntegrityVerification;

  summary: {
    pass: number;

    block: number;

    valid: boolean;
  };

  executionAllowed: false;
}

export interface CheckpointedBindingPhaseOptions {
  context:
    CheckpointIntegrityContext;

  operations:
    AutomatableMigrationOperation[];

  adapter:
    DiscordExecutionAdapter;

  registry:
    SessionBindingRegistry;

  beforeOperation?: (
    context:
      ExecutionJournalHookContext,
  ) =>
    void |
    Promise<void>;
}

export interface CheckpointedBindingPhaseResult {
  schemaVersion: 1;

  journal:
    ExecutionJournalRun;

  bindingCommit:
    SessionBindingCommitResult;

  sealedCheckpoint:
    BoundBindingAwareCheckpoint;

  finalAdapterSnapshot:
    ExecutionAdapterSnapshot;

  finalRegistrySnapshot:
    SessionBindingRegistrySnapshot;

  executionAllowed: false;
}

export type CheckpointedBindingResumeStatus =
  | 'completed'
  | 'stopped_on_error'
  | 'blocked';

export type CheckpointedBindingResumeBlockReason =
  | 'checkpoint_integrity_failed'
  | 'operation_sequence_mismatch'
  | 'checkpoint_not_resumable'
  | 'resume_target_mismatch'
  | 'resolution_preflight_failed'
  | null;

export interface CheckpointedBindingResumeCheck {
  id: string;

  status:
    BindingAwareCheckpointCheckStatus;

  details: string;
}

export interface CheckpointedBindingResumeOptions {
  sealedCheckpoint:
    BoundBindingAwareCheckpoint;

  expectedContext:
    CheckpointIntegrityContext;

  operations:
    AutomatableMigrationOperation[];

  adapterFactory: (
    snapshot:
      ExecutionAdapterSnapshot,
  ) =>
    DiscordExecutionAdapter;

  registryFactory: (
    snapshot:
      SessionBindingRegistrySnapshot,
  ) =>
    SessionBindingRegistry;
}

export interface CheckpointedBindingResumeResult {
  schemaVersion: 1;

  generatedAt: string;

  status:
    CheckpointedBindingResumeStatus;

  blockReason:
    CheckpointedBindingResumeBlockReason;

  adapterRestored: boolean;

  registryRestored: boolean;

  integrity:
    BindingAwareCheckpointVerification;

  checks:
    CheckpointedBindingResumeCheck[];

  journal:
    ExecutionJournalRun | null;

  bindingCommit:
    SessionBindingCommitResult | null;

  sealedCheckpoint:
    BoundBindingAwareCheckpoint | null;

  finalAdapterSnapshot:
    ExecutionAdapterSnapshot | null;

  finalRegistrySnapshot:
    SessionBindingRegistrySnapshot | null;

  executionAllowed: false;
}
