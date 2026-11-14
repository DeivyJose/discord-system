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

export interface ApprovalReceipt {
  schemaVersion: 1;

  receiptId: string;

  verifiedAt: string;

  status: ConfirmationVerificationStatus;

  guild: {
    id: string;
    name: string;
  };

  gateFingerprint: string;

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
