import type {
  AutomatableMigrationOperation,
} from './executionAdapterTypes.js';

import type {
  ResolvedDiscordMutationRequest,
} from './discordMutationResolverTypes.js';

export interface BindingAwarePreparedOperation {
  sourceOperationId: string;

  operation:
    AutomatableMigrationOperation;

  request:
    ResolvedDiscordMutationRequest;

  executionAllowed: false;
}
