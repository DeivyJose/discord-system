export type ConfirmationManifestStatus =
  | 'pending'
  | 'invalid';

export type ConfirmationManifestCheckStatus =
  | 'pass'
  | 'block';

export interface ConfirmationManifestCheck {
  id: string;

  status: ConfirmationManifestCheckStatus;

  details: string;
}

export interface ConfirmationManifest {
  schemaVersion: 1;

  createdAt: string;

  expiresAt: string;

  status: ConfirmationManifestStatus;

  guild: {
    id: string;
    name: string;
  };

  gateFingerprint: string;

  shortFingerprint: string;

  snapshotCapturedAt: string;

  confirmationId: string | null;

  requiredPhrase: string | null;

  checks: ConfirmationManifestCheck[];

  summary: {
    pass: number;

    block: number;

    readyForUserApproval: boolean;
  };

  /**
   * Crear este manifest NO constituye autorización.
   */
  executionAllowed: false;
}
