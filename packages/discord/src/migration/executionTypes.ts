import type {
  MigrationOperationResourceKind,
  MigrationOperationType,
} from './operationTypes.js';

export type ExecutionPhase =
  | 'roles'
  | 'categories'
  | 'renames'
  | 'channels'
  | 'moves'
  | 'manual_review';

export type ExecutionStepStatus =
  | 'ready'
  | 'manual'
  | 'blocked';

export type ExecutionPreconditionStatus =
  | 'pass'
  | 'warn'
  | 'block';

export interface ExecutionPrecondition {
  id: string;

  label: string;

  status: ExecutionPreconditionStatus;

  details: string;
}

export interface ExecutionPreviewStep {
  operationId: string;

  operationType: MigrationOperationType;

  resourceKind: MigrationOperationResourceKind;

  phase: ExecutionPhase;

  status: ExecutionStepStatus;

  blueprintId: string | null;

  actualId: string | null;

  label: string;

  dependsOn: string[];

  blockers: string[];

  notes: string[];
}

export interface DiscordExecutionPreview {
  schemaVersion: 1;

  generatedAt: string;

  guild: {
    id: string;
    name: string;
  };

  /**
   * Mientras esto sea true, este artefacto
   * jamás debe tratarse como autorización
   * para modificar Discord.
   */
  dryRunOnly: true;

  executionAllowed: false;

  preconditions: ExecutionPrecondition[];

  summary: {
    totalSteps: number;

    ready: number;

    manual: number;

    blocked: number;

    phases: Record<
      ExecutionPhase,
      number
    >;
  };

  steps: ExecutionPreviewStep[];
}
