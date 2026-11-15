export type SessionBindingRegistryErrorCode =
  | 'INVALID_BINDING'
  | 'BLUEPRINT_CONFLICT'
  | 'ACTUAL_ID_CONFLICT'
  | 'TRANSACTION_CLOSED'
  | 'REVISION_CONFLICT'
  | 'SNAPSHOT_GUILD_MISMATCH';

export type SessionBindingLookupSource =
  | 'confirmed'
  | 'session'
  | 'staged'
  | 'none';

export interface SessionBindingRecord {
  blueprintId: string;

  actualId: string;

  operationId: string | null;

  createdAt: string;
}

export interface SessionBindingLookup {
  blueprintId: string;

  actualId: string | null;

  source:
    SessionBindingLookupSource;
}

export type SessionBindingStageResult =
  | 'added'
  | 'idempotent';

export type SessionBindingTransactionStatus =
  | 'open'
  | 'committed'
  | 'rolled_back';

export interface SessionBindingRegistrySnapshot {
  schemaVersion: 1;

  guildId: string;

  revision: number;

  confirmed:
    Record<string, string>;

  session:
    Record<string, SessionBindingRecord>;

  executionAllowed: false;
}

export interface SessionBindingCommitResult {
  transactionId: string;

  committed: number;

  revisionBefore: number;

  revisionAfter: number;

  executionAllowed: false;
}
