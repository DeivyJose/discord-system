import type {
  ExecutionSessionPhaseId,
} from './executionSessionTypes.js';

export type PhaseDryRunStatus =
  | 'ready'
  | 'blocked';

export type PhaseDryRunCheckStatus =
  | 'pass'
  | 'warn'
  | 'block';

export interface PhaseDryRunCheck {
  id: string;

  status: PhaseDryRunCheckStatus;

  details: string;
}

export interface PhaseDryRunIntent {
  order: number;

  operationId: string;

  operationType: string;

  resourceKind: string;

  label: string;

  action: string;

  dependsOn: string[];

  wouldMutateDiscord: true;
}

export interface PhaseDryRunPlan {
  schemaVersion: 1;

  generatedAt: string;

  status: PhaseDryRunStatus;

  dryRunOnly: true;

  executionAllowed: false;

  phase: {
    id: ExecutionSessionPhaseId;

    label: string;

    order: number;

    manualOnly: boolean;

    fingerprint: string;
  };

  source: {
    sessionId: string;

    gateFingerprint: string;

    approvalReceiptId: string;

    receiptExpiresAt: string;
  };

  checks: PhaseDryRunCheck[];

  intents: PhaseDryRunIntent[];

  summary: {
    total: number;

    ready: number;

    manual: number;

    blocked: number;

    passChecks: number;

    warnChecks: number;

    blockChecks: number;

    readyForRealExecutorImplementation: boolean;
  };
}
