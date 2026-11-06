export type MigrationGateCheckStatus =
  | 'pass'
  | 'warn'
  | 'block';

export interface MigrationGateCheck {
  id: string;

  label: string;

  status: MigrationGateCheckStatus;

  details: string;
}

export interface MigrationGate {
  schemaVersion: 1;

  generatedAt: string;

  guild: {
    id: string;
    name: string;
  };

  fingerprint: string;

  snapshot: {
    capturedAt: string;

    ageMinutes: number;

    maximumAgeMinutes: number;
  };

  checks: MigrationGateCheck[];

  summary: {
    pass: number;

    warn: number;

    block: number;

    readyForExplicitConfirmation: boolean;
  };

  /**
   * El Gate NO ejecuta la migración.
   */
  executionAllowed: false;
}
