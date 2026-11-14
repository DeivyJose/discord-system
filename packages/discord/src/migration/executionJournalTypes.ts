import type {
  AutomatableMigrationOperation,
  ExecutionAdapterResourceState,
  ExecutionAdapterSnapshot,
} from './executionAdapterTypes.js';

export type ExecutionJournalEntryStatus =
  | 'succeeded'
  | 'failed';

export type ExecutionCheckpointStatus =
  | 'completed'
  | 'stopped_on_error';

export interface ExecutionJournalState {
  actions: number;

  bindings: number;

  resources: number;

  targetResource:
    | ExecutionAdapterResourceState
    | null;
}

export interface ExecutionJournalEntry {
  sequence: number;

  phase: string;

  operationId: string;

  operationType: string;

  resourceKind: string;

  status: ExecutionJournalEntryStatus;

  startedAt: string;

  finishedAt: string;

  before: ExecutionJournalState;

  after: ExecutionJournalState;

  actualId: string | null;

  error: string | null;
}

export interface ExecutionCheckpoint {
  schemaVersion: 1;

  checkpointId: string;

  createdAt: string;

  phase: string;

  status: ExecutionCheckpointStatus;

  totalOperations: number;

  startIndex: number;

  nextOperationIndex: number | null;

  lastSuccessfulOperationId: string | null;

  failedOperationId: string | null;

  succeeded: number;

  failed: number;

  adapterSnapshot: ExecutionAdapterSnapshot;
}

export interface ExecutionJournalRun {
  schemaVersion: 1;

  runId: string;

  startedAt: string;

  finishedAt: string;

  phase: string;

  status: ExecutionCheckpointStatus;

  startIndex: number;

  entries: ExecutionJournalEntry[];

  checkpoint: ExecutionCheckpoint;

  summary: {
    attempted: number;

    succeeded: number;

    failed: number;

    stoppedOnError: boolean;

    completed: boolean;
  };

  executionAllowed: false;
}

export interface ExecutionJournalHookContext {
  phase: string;

  index: number;

  operation: AutomatableMigrationOperation;
}

export interface ExecutionJournalRunnerOptions {
  phase: string;

  operations:
    AutomatableMigrationOperation[];

  startIndex?: number;

  beforeOperation?: (
    context: ExecutionJournalHookContext,
  ) =>
    void |
    Promise<void>;
}
