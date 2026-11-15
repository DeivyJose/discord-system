import type {
  AutomatableMigrationOperation,
} from './executionAdapterTypes.js';

export type DiscordMutationRequestType =
  | 'create_role'
  | 'create_category'
  | 'create_channel'
  | 'rename_role'
  | 'rename_category'
  | 'rename_channel'
  | 'move_channel';

export interface DiscordMutationRequest {
  schemaVersion: 1;

  requestId: string;

  operationId: string;

  operationType:
    DiscordMutationRequestType;

  resourceKind: string;

  blueprintId: string | null;

  actualId: string | null;

  desiredName: string | null;

  desiredParentActualId: string | null;

  unresolvedFields: string[];

  sourceOperation:
    AutomatableMigrationOperation;

  executionAllowed: false;
}

export interface DiscordMutationTransportResult {
  actualId: string | null;
}

export interface DiscordMutationTransport {
  send(
    request: DiscordMutationRequest,
  ): Promise<DiscordMutationTransportResult>;
}
