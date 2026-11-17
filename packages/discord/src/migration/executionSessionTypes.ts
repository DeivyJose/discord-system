import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import type {
  MigrationGateFingerprintInput,
} from './migrationGate.js';

export type ExecutionSessionStatus =
  | 'ready'
  | 'blocked';

export type ExecutionSessionCheckStatus =
  | 'pass'
  | 'warn'
  | 'block';

export type ExecutionSessionPhaseId =
  | 'roles'
  | 'categories'
  | 'renames'
  | 'channels'
  | 'moves'
  | 'manual_review';

export type ExecutionSessionOperation =
  MigrationOperationsPlan['operations'][number];

export type ExecutionSessionPreviewStep =
  DiscordExecutionPreview['steps'][number];

export interface ExecutionSessionCheck {
  id: string;

  status: ExecutionSessionCheckStatus;

  details: string;
}

export interface ExecutionSessionItem {
  operation: ExecutionSessionOperation;

  preview: ExecutionSessionPreviewStep;
}

export interface ExecutionSessionPhase {
  id: ExecutionSessionPhaseId;

  order: number;

  label: string;

  manualOnly: boolean;

  items: ExecutionSessionItem[];

  summary: {
    total: number;

    ready: number;

    manual: number;

    blocked: number;
  };

  stopConditions: string[];
}

export type ExecutionSessionGateArtifacts =
  Pick<
    MigrationGateFingerprintInput,
    | 'blueprint'
    | 'snapshot'
    | 'bindings'
    | 'preflight'
    | 'hierarchy'
  >;

export interface ExecutionSessionContentBinding {
  fingerprintVersion: 3;

  expectedGateFingerprint: string;

  recalculatedGateFingerprint: string;

  matchesGate: boolean;

  executionAllowed: false;
}

export interface ExecutionSessionReceiptClaim {
  claimed: true;

  receiptId: string;

  sessionId: string;

  gateFingerprint: string;

  confirmationId: string;

  claimedAt: string;

  executionAllowed: false;
}

export interface ExecutionSessionPlan {
  schemaVersion: 4;

  sessionId: string;

  generatedAt: string;

  status: ExecutionSessionStatus;

  guild: {
    id: string;

    name: string;
  };

  gateFingerprint: string;

  contentBinding:
    ExecutionSessionContentBinding;

  approvalReceiptId: string;

  receiptClaim:
    ExecutionSessionReceiptClaim |
    null;

  source: {
    operationsGeneratedAt: string;

    previewGeneratedAt: string;

    gateGeneratedAt: string;

    receiptVerifiedAt: string;

    receiptExpiresAt: string;

    snapshotCapturedAt: string;
  };

  checks: ExecutionSessionCheck[];

  phases: ExecutionSessionPhase[];

  summary: {
    operations: number;

    phases: number;

    ready: number;

    manual: number;

    blocked: number;

    passChecks: number;

    warnChecks: number;

    blockChecks: number;

    readyForExecutorDesign: boolean;
  };

  /**
   * Este planner jamás autoriza ejecución.
   */
  executionAllowed: false;
}
