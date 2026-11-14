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
  ExecutionJournalRun,
} from './executionJournalTypes.js';

export type VerifiedResumeStatus =
  | 'completed'
  | 'stopped_on_error'
  | 'blocked';

export type VerifiedResumeCheckStatus =
  | 'pass'
  | 'block';

export interface VerifiedResumeCheck {
  id: string;

  status: VerifiedResumeCheckStatus;

  details: string;
}

export type VerifiedResumeBlockReason =
  | 'integrity_verification_failed'
  | 'operation_sequence_mismatch'
  | 'checkpoint_not_resumable'
  | 'resume_target_mismatch'
  | null;

export interface VerifiedResumeOptions {
  sealedCheckpoint:
    BoundExecutionCheckpoint;

  expectedContext:
    CheckpointIntegrityContext;

  operations:
    AutomatableMigrationOperation[];

  adapterFactory: (
    snapshot:
      ExecutionAdapterSnapshot,
  ) => DiscordExecutionAdapter;
}

export interface VerifiedResumeResult {
  schemaVersion: 1;

  generatedAt: string;

  status: VerifiedResumeStatus;

  blockReason:
    VerifiedResumeBlockReason;

  adapterRestored: boolean;

  integrity:
    CheckpointIntegrityVerification;

  checks:
    VerifiedResumeCheck[];

  journal:
    ExecutionJournalRun | null;

  executionAllowed: false;
}
