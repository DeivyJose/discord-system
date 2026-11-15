import type {
  AutomatableMigrationOperation,
  ExecutionAdapterActionResult,
} from './executionAdapterTypes.js';

import {
  compileDiscordMutationRequest,
} from './discordMutationRequest.js';

import {
  resolveDiscordMutationRequest,
} from './discordMutationResolver.js';

import type {
  MutationResolverBindings,
  ResolvedDiscordMutationRequest,
} from './discordMutationResolverTypes.js';

import {
  LockedRealDiscordExecutionAdapter,
} from './lockedRealDiscordExecutionAdapter.js';

export class DiscordMutationResolutionBlockedError
extends Error {
  readonly code =
    'DISCORD_MUTATION_RESOLUTION_BLOCKED';

  readonly request:
    ResolvedDiscordMutationRequest;

  constructor(
    request:
      ResolvedDiscordMutationRequest,
  ) {
    super(
      [
        'Discord mutation blocked before execution.',
        `Operation: ${request.operationId}.`,
        `Unresolved: ${request.resolverUnresolvedFields.join(', ') || 'unknown'}.`,
      ].join(' '),
    );

    this.name =
      'DiscordMutationResolutionBlockedError';

    this.request =
      structuredClone(
        request,
      );
  }
}

export interface ResolvedLockedExecutionResult {
  request:
    ResolvedDiscordMutationRequest;

  result:
    ExecutionAdapterActionResult;

  executionAllowed: false;
}

export async function executeResolvedLockedMutation(
  adapter:
    LockedRealDiscordExecutionAdapter,

  operation:
    AutomatableMigrationOperation,

  bindings:
    MutationResolverBindings,
): Promise<ResolvedLockedExecutionResult> {
  const compiled =
    compileDiscordMutationRequest(
      operation,
    );

  const resolved =
    resolveDiscordMutationRequest(
      compiled,
      bindings,
    );

  if (
    !resolved.ready
  ) {
    throw new DiscordMutationResolutionBlockedError(
      resolved.request,
    );
  }

  const result =
    await adapter.attemptResolvedRequest(
      resolved.request,
    );

  return {
    request:
      resolved.request,

    result,

    executionAllowed:
      false,
  };
}
