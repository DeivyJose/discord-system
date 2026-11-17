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
  schemaVersion: 3;

  generatedAt: string;

  guild: {
    id: string;
    name: string;
  };

  /**
   * Versión del algoritmo/payload utilizado
   * para ligar criptográficamente el Gate
   * con sus artefactos de entrada.
   */
  fingerprintVersion: 3;

  fingerprint: string;

  blueprint: {
    schemaVersion: 1;

    blueprintVersion: 1;

    fingerprintVersion: 1;

    fingerprint: string;

    generatedAt: string;

    summary: {
      categories: number;

      channels: number;

      roles: number;

      totalResources: number;
    };

    executionAllowed: false;
  };

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
