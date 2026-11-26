import type {
  DiscordBlueprintArtifact,
} from '../blueprint/artifact.js';

import type {
  DiscordGuildSnapshot,
} from '../inspector/types.js';

import type {
  DiscordBindings,
  MigrationPlan,
} from './types.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

export interface MigrationProvenanceInput {
  blueprint:
    DiscordBlueprintArtifact;

  snapshot:
    DiscordGuildSnapshot;

  bindings:
    DiscordBindings;

  plan:
    MigrationPlan;

  operations:
    MigrationOperationsPlan;

  preview:
    DiscordExecutionPreview;
}

export type MigrationProvenanceCheckStatus =
  | 'pass'
  | 'block';

export interface MigrationProvenanceCheck {
  id: string;

  status:
    MigrationProvenanceCheckStatus;

  details: string;
}

export interface MigrationProvenanceArtifact {
  schemaVersion: 1;

  fingerprintVersion: 1;

  generatedAt: string;

  guildId: string;

  source: {
    blueprintFingerprint:
      string;

    snapshotFingerprint:
      string;

    bindingsFingerprint:
      string;

    rootFingerprint:
      string;
  };

  artifacts: {
    planFingerprint:
      string;

    operationsFingerprint:
      string;

    previewFingerprint:
      string;
  };

  lineage: {
    planFingerprint:
      string;

    operationsFingerprint:
      string;

    previewFingerprint:
      string;
  };

  lineageFingerprint:
    string;

  checks:
    MigrationProvenanceCheck[];

  summary: {
    pass: number;

    block: number;

    valid: boolean;
  };

  executionAllowed: false;
}

export interface MigrationProvenanceVerification {
  schemaVersion: 1;

  verifiedAt: string;

  status:
    | 'valid'
    | 'blocked';

  checks:
    MigrationProvenanceCheck[];

  expected:
    MigrationProvenanceArtifact;

  supplied:
    MigrationProvenanceArtifact;

  summary: {
    pass: number;

    block: number;

    valid: boolean;
  };

  executionAllowed: false;
}
