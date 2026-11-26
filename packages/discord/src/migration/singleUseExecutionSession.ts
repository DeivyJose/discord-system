import {
  randomBytes,
} from 'node:crypto';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import type {
  ApprovalReceipt,
} from './approvalReceiptTypes.js';

import type {
  ExecutionSessionGateArtifacts,
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import {
  createExecutionSessionPlan,
} from './executionSessionPlanner.js';

import {
  claimReceiptForExecutionSession,
} from './executionSessionReceiptClaim.js';

export type SingleUseExecutionSessionBlockReason =
  | 'validation_failed'
  | 'missing_confirmation_id'
  | 'receipt_already_claimed'
  | 'post_claim_validation_failed'
  | null;

export interface SingleUseExecutionSessionOptions {
  operations:
    MigrationOperationsPlan;

  preview:
    DiscordExecutionPreview;

  gate:
    MigrationGate;

  receipt:
    ApprovalReceipt;

  gateArtifacts:
    ExecutionSessionGateArtifacts;

  claimsDirectory:
    string;

  now?: Date;
}

export interface SingleUseExecutionSessionResult {
  status:
    | 'created'
    | 'blocked';

  blockReason:
    SingleUseExecutionSessionBlockReason;

  candidateSessionId:
    string;

  preflight:
    ExecutionSessionPlan;

  session:
    ExecutionSessionPlan |
    null;

  receiptClaimed:
    boolean;

  claimMarkerPath:
    string |
    null;

  executionAllowed: false;
}

export async function createSingleUseExecutionSession(
  options:
    SingleUseExecutionSessionOptions,
): Promise<SingleUseExecutionSessionResult> {
  const now =
    options.now ??
    new Date();

  const candidateSessionId =
    randomBytes(12)
      .toString(
        'hex',
      );

  const preflight =
    createExecutionSessionPlan(
      {
        operations:
          options.operations,

        preview:
          options.preview,

        gate:
          options.gate,

        receipt:
          options.receipt,

        gateArtifacts:
          options.gateArtifacts,

        sessionId:
          candidateSessionId,
      },
      now,
    );

  const unrelatedBlocks =
    preflight.checks.filter(
      (check) =>
        check.status ===
          'block' &&
        check.id !==
          'receipt_single_use_claim',
    );

  if (
    unrelatedBlocks.length >
      0
  ) {
    return {
      status:
        'blocked',

      blockReason:
        'validation_failed',

      candidateSessionId,

      preflight,

      session:
        null,

      receiptClaimed:
        false,

      claimMarkerPath:
        null,

      executionAllowed:
        false,
    };
  }

  const confirmationId =
    options.receipt
      .manifest
      .confirmationId;

  if (
    !confirmationId
  ) {
    return {
      status:
        'blocked',

      blockReason:
        'missing_confirmation_id',

      candidateSessionId,

      preflight,

      session:
        null,

      receiptClaimed:
        false,

      claimMarkerPath:
        null,

      executionAllowed:
        false,
    };
  }

  const claim =
    await claimReceiptForExecutionSession({
      directory:
        options.claimsDirectory,

      receiptId:
        options.receipt
          .receiptId,

      sessionId:
        candidateSessionId,

      gateFingerprint:
        options.gate
          .fingerprint,

      gateEnvelopeFingerprint:
        options.gate
          .envelopeFingerprint,

      provenanceFingerprint:
        options.gate
          .provenance
          .lineageFingerprint,

      confirmationId,

      claimedAt:
        now.toISOString(),
    });

  if (
    !claim.claimed ||
    !claim.claim
  ) {
    return {
      status:
        'blocked',

      blockReason:
        'receipt_already_claimed',

      candidateSessionId,

      preflight,

      session:
        null,

      receiptClaimed:
        false,

      claimMarkerPath:
        claim.markerPath,

      executionAllowed:
        false,
    };
  }

  const session =
    createExecutionSessionPlan(
      {
        operations:
          options.operations,

        preview:
          options.preview,

        gate:
          options.gate,

        receipt:
          options.receipt,

        gateArtifacts:
          options.gateArtifacts,

        sessionId:
          candidateSessionId,

        receiptClaim:
          claim.claim,
      },
      now,
    );

  if (
    session.status !==
      'ready' ||
    !session.summary
      .readyForExecutorDesign
  ) {
    return {
      status:
        'blocked',

      blockReason:
        'post_claim_validation_failed',

      candidateSessionId,

      preflight,

      session:
        null,

      receiptClaimed:
        true,

      claimMarkerPath:
        claim.markerPath,

      executionAllowed:
        false,
    };
  }

  return {
    status:
      'created',

    blockReason:
      null,

    candidateSessionId,

    preflight,

    session,

    receiptClaimed:
      true,

    claimMarkerPath:
      claim.markerPath,

    executionAllowed:
      false,
  };
}
