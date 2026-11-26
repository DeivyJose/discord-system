export type ConfirmationVerificationStatus =
  | 'approved'
  | 'rejected';

export type ConfirmationVerificationCheckStatus =
  | 'pass'
  | 'block';

export interface ConfirmationVerificationCheck {
  id: string;

  status: ConfirmationVerificationCheckStatus;

  details: string;
}

export type ConfirmationApprovalMethod =
  | 'interactive_tty';

export interface ConfirmationApprovalEvidence {
  method: ConfirmationApprovalMethod;

  inputIsTTY: boolean;

  outputIsTTY: boolean;

  /**
   * true solamente cuando este confirmationId
   * todavía no había sido consumido.
   */
  confirmationUnused: boolean;
}

export interface ApprovalReceipt {
  schemaVersion: 4;

  receiptId: string;

  verifiedAt: string;

  status: ConfirmationVerificationStatus;

  guild: {
    id: string;
    name: string;
  };

  gateFingerprint: string;

  gateEnvelopeFingerprint: string;

  provenanceFingerprint: string;

  approvalBoundary:
    ConfirmationApprovalEvidence;

  manifest: {
    createdAt: string;

    expiresAt: string;

    confirmationId: string | null;
  };

  checks: ConfirmationVerificationCheck[];

  summary: {
    pass: number;

    block: number;

    approvalValid: boolean;
  };

  /**
   * Un Approval Receipt tampoco ejecuta Discord.
   */
  executionAllowed: false;
}
