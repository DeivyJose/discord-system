import type {
  ExecutionAdapterSnapshot,
} from './executionAdapterTypes.js';

import type {
  SessionBindingRegistrySnapshot,
} from './sessionBindingRegistryTypes.js';

export type FullFakeMigrationPhase =
  | 'roles'
  | 'categories'
  | 'renames'
  | 'channels'
  | 'moves';

export interface FullFakeMigrationPhaseResult {
  phase:
    FullFakeMigrationPhase;

  operations: number;

  addedBindings: number;

  idempotentBindings: number;

  committedBindings: number;

  registryRevision: number;

  registrySessionBindings: number;

  adapterActions: number;
}

export interface FullFakeMigrationResult {
  schemaVersion: 1;

  totalOperations: number;

  automatableOperations: number;

  manualReviewOperations: number;

  phases:
    FullFakeMigrationPhaseResult[];

  finalAdapterSnapshot:
    ExecutionAdapterSnapshot;

  finalRegistrySnapshot:
    SessionBindingRegistrySnapshot;

  finalResolverBindingCount: number;

  executionAllowed: false;
}
