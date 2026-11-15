import type {
  ExecutionAdapterSnapshot,
} from './executionAdapterTypes.js';

import type {
  BoundBindingAwareCheckpoint,
} from './checkpointedBindingResumeTypes.js';

import type {
  LiveDriftVerification,
} from './liveDriftTypes.js';

import type {
  SessionBindingRegistrySnapshot,
} from './sessionBindingRegistryTypes.js';

export type FullCheckpointedFakeMigrationStatus =
  | 'completed'
  | 'blocked';

export type FullCheckpointedFakeMigrationBlockReason =
  | 'live_drift_detected'
  | null;

export type FullCheckpointedFakeMigrationPhase =
  | 'roles'
  | 'categories'
  | 'renames'
  | 'channels'
  | 'moves';

export interface FullCheckpointedFakeMigrationPhaseResult {
  phase:
    FullCheckpointedFakeMigrationPhase;

  operations: number;

  succeeded: number;

  syntheticFailures: number;

  bindingsCommitted: number;

  resumed: boolean;

  registryRevision: number;

  adapterActions: number;
}

export interface FullCheckpointedFakeMigrationResult {
  schemaVersion: 1;

  status:
    FullCheckpointedFakeMigrationStatus;

  blockReason:
    FullCheckpointedFakeMigrationBlockReason;

  adapterCreated: boolean;

  registryCreated: boolean;

  drift:
    LiveDriftVerification;

  totalOperations: number;

  automatableOperations: number;

  manualReviewOperations: number;

  phases:
    FullCheckpointedFakeMigrationPhaseResult[];

  stoppedChannelsCheckpoint:
    BoundBindingAwareCheckpoint | null;

  finalAdapterSnapshot:
    ExecutionAdapterSnapshot | null;

  finalRegistrySnapshot:
    SessionBindingRegistrySnapshot | null;

  executionAllowed: false;
}
