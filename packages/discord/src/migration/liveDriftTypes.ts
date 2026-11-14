export type DiscordStructureResourceKind =
  | 'category'
  | 'channel'
  | 'role';

export interface NormalizedDiscordStructureResource {
  id: string;

  kind: DiscordStructureResourceKind;

  name: string;

  parentId: string | null;

  position: number | null;

  managed: boolean | null;

  structureFingerprint: string;
}

export interface NormalizedDiscordStructureSnapshot {
  guildId: string;

  capturedAt: string;

  resources:
    NormalizedDiscordStructureResource[];

  structureFingerprint: string;
}

export interface LiveDriftContext {
  sessionId: string;

  gateFingerprint: string;
}

export interface LiveDriftBaseline {
  schemaVersion: 1;

  createdAt: string;

  context:
    LiveDriftContext;

  snapshot:
    NormalizedDiscordStructureSnapshot;

  executionAllowed: false;
}

export type LiveDriftChangeType =
  | 'added'
  | 'removed'
  | 'changed';

export interface LiveDriftChange {
  type: LiveDriftChangeType;

  resourceId: string;

  kind:
    DiscordStructureResourceKind;

  before:
    NormalizedDiscordStructureResource |
    null;

  after:
    NormalizedDiscordStructureResource |
    null;
}

export type LiveDriftCheckStatus =
  | 'pass'
  | 'block';

export interface LiveDriftCheck {
  id: string;

  status: LiveDriftCheckStatus;

  details: string;
}

export interface LiveDriftVerification {
  schemaVersion: 1;

  verifiedAt: string;

  status:
    | 'valid'
    | 'blocked';

  baselineFingerprint: string;

  currentFingerprint: string;

  checks:
    LiveDriftCheck[];

  changes:
    LiveDriftChange[];

  summary: {
    added: number;

    removed: number;

    changed: number;

    pass: number;

    block: number;

    driftDetected: boolean;

    valid: boolean;
  };

  executionAllowed: false;
}
