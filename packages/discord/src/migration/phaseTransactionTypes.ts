import type {
  AutomatableMigrationOperation,
  DiscordExecutionAdapter,
} from './executionAdapterTypes.js';

import type {
  BoundExecutionCheckpoint,
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

import type {
  ExecutionJournalHookContext,
  ExecutionJournalRun,
} from './executionJournalTypes.js';

export type PhaseTransactionStatus =
  | 'completed'
  | 'stopped_on_error'
  | 'blocked';

export type PhaseTransactionCheckStatus =
  | 'pass'
  | 'block';

export type PhaseTransactionBlockReason =
  | 'operation_sequence_mismatch'
  | 'duplicate_operation_ids'
  | 'empty_operation_set'
  | null;

export interface PhaseTransactionCheck {
  id: string;

  status: PhaseTransactionCheckStatus;

  details: string;
}

export interface PhaseTransactionOptions {
  context:
    CheckpointIntegrityContext;

  operations:
    AutomatableMigrationOperation[];

  adapterFactory:
    () => DiscordExecutionAdapter;

  beforeOperation?: (
    context:
      ExecutionJournalHookContext,
  ) =>
    void |
    Promise<void>;
}

export interface PhaseTransactionResult {
  schemaVersion: 1;

  generatedAt: string;

  status: PhaseTransactionStatus;

  blockReason:
    PhaseTransactionBlockReason;

  context:
    CheckpointIntegrityContext;

  adapterCreated: boolean;

  checks:
    PhaseTransactionCheck[];

  journal:
    ExecutionJournalRun | null;

  sealedCheckpoint:
    BoundExecutionCheckpoint | null;

  summary: {
    operations: number;

    attempted: number;

    succeeded: number;

    failed: number;

    checkpointSealed: boolean;

    resumeAvailable: boolean;
  };

  executionAllowed: false;
}
