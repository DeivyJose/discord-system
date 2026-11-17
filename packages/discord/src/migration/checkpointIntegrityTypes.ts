import type {
  ExecutionCheckpoint,
} from './executionJournalTypes.js';

export interface CheckpointIntegrityContext {
  guildId: string;

  sessionId: string;

  gateFingerprint: string;

  gateEnvelopeFingerprint: string;

  phase: string;

  operationIds: string[];
}

export interface BoundExecutionCheckpoint {
  schemaVersion: 1;

  algorithm: 'sha256';

  sealedAt: string;

  context: CheckpointIntegrityContext;

  checkpoint: ExecutionCheckpoint;

  integrityFingerprint: string;

  executionAllowed: false;
}

export type CheckpointIntegrityCheckStatus =
  | 'pass'
  | 'block';

export interface CheckpointIntegrityCheck {
  id: string;

  status:
    CheckpointIntegrityCheckStatus;

  details: string;
}

export interface CheckpointIntegrityVerification {
  schemaVersion: 1;

  verifiedAt: string;

  status:
    | 'valid'
    | 'blocked';

  checks: CheckpointIntegrityCheck[];

  summary: {
    pass: number;

    block: number;

    valid: boolean;
  };

  executionAllowed: false;
}
