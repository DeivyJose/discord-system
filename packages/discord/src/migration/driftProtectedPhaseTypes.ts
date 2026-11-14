import type {
  AutomatableMigrationOperation,
  DiscordExecutionAdapter,
} from './executionAdapterTypes.js';

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

import type {
  ExecutionJournalHookContext,
} from './executionJournalTypes.js';

import type {
  LiveDriftBaseline,
  LiveDriftContext,
  LiveDriftVerification,
  NormalizedDiscordStructureSnapshot,
} from './liveDriftTypes.js';

import type {
  PhaseTransactionResult,
} from './phaseTransactionTypes.js';

export type DriftProtectedPhaseStatus =
  | 'completed'
  | 'stopped_on_error'
  | 'blocked';

export type DriftProtectedPhaseBlockReason =
  | 'context_mismatch'
  | 'live_drift_detected'
  | 'phase_transaction_blocked'
  | null;

export type DriftProtectedPhaseCheckStatus =
  | 'pass'
  | 'block';

export interface DriftProtectedPhaseCheck {
  id: string;

  status:
    DriftProtectedPhaseCheckStatus;

  details: string;
}

export interface DriftProtectedPhaseOptions {
  baseline:
    LiveDriftBaseline;

  currentSnapshot:
    NormalizedDiscordStructureSnapshot;

  driftContext:
    LiveDriftContext;

  transactionContext:
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

export interface DriftProtectedPhaseResult {
  schemaVersion: 1;

  generatedAt: string;

  status:
    DriftProtectedPhaseStatus;

  blockReason:
    DriftProtectedPhaseBlockReason;

  checks:
    DriftProtectedPhaseCheck[];

  drift:
    LiveDriftVerification | null;

  transaction:
    PhaseTransactionResult | null;

  adapterFactoryReached:
    boolean;

  executionAllowed: false;
}
