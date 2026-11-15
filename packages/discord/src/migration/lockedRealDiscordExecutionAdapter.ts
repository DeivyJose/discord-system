import type {
  CreateCategoryOperation,
  CreateChannelOperation,
  CreateRoleOperation,
  DiscordExecutionAdapter,
  ExecutionAdapterActionResult,
  ExecutionAdapterSnapshot,
  MoveChannelOperation,
  RenameCategoryOperation,
  RenameChannelOperation,
  RenameRoleOperation,
} from './executionAdapterTypes.js';

import {
  compileDiscordMutationRequest,
} from './discordMutationRequest.js';

import type {
  DiscordMutationRequest,
  DiscordMutationTransport,
} from './discordMutationRequestTypes.js';

import type {
  ResolvedDiscordMutationRequest,
} from './discordMutationResolverTypes.js';

export class DiscordExecutionLockedError
extends Error {
  readonly code =
    'DISCORD_EXECUTION_HARD_LOCKED';

  readonly request:
    DiscordMutationRequest;

  constructor(
    request:
      DiscordMutationRequest,
  ) {
    super(
      [
        'Discord mutation blocked by hard lock.',
        `Operation: ${request.operationId}.`,
        'Real execution is not enabled in this adapter.',
      ].join(' '),
    );

    this.name =
      'DiscordExecutionLockedError';

    this.request =
      structuredClone(
        request,
      );
  }
}

export class LockedRealDiscordExecutionAdapter
implements DiscordExecutionAdapter {
  readonly mode =
    'real' as const;

  /**
   * Hard lock deliberado.
   *
   * No existe constructor option,
   * env var ni setter capaz de
   * convertir esto a true.
   */
  readonly executionEnabled =
    false as const;

  private readonly blockedRequests:
    DiscordMutationRequest[] =
    [];

  constructor(
    private readonly transport:
      DiscordMutationTransport,
  ) {}

  private async block(
    operation:
      | CreateRoleOperation
      | CreateCategoryOperation
      | CreateChannelOperation
      | RenameRoleOperation
      | RenameCategoryOperation
      | RenameChannelOperation
      | MoveChannelOperation,
  ): Promise<ExecutionAdapterActionResult> {
    const request =
      compileDiscordMutationRequest(
        operation,
      );

    this.blockedRequests.push(
      structuredClone(
        request,
      ),
    );

    /*
     * MUY IMPORTANTE:
     *
     * this.transport.send(...)
     * NO se llama aquí.
     *
     * El hard lock termina la ejecución
     * antes de cualquier transport.
     */
    throw new DiscordExecutionLockedError(
      request,
    );
  }

  async createRole(
    operation:
      CreateRoleOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.block(
      operation,
    );
  }

  async createCategory(
    operation:
      CreateCategoryOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.block(
      operation,
    );
  }

  async createChannel(
    operation:
      CreateChannelOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.block(
      operation,
    );
  }

  async renameRole(
    operation:
      RenameRoleOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.block(
      operation,
    );
  }

  async renameCategory(
    operation:
      RenameCategoryOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.block(
      operation,
    );
  }

  async renameChannel(
    operation:
      RenameChannelOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.block(
      operation,
    );
  }

  async moveChannel(
    operation:
      MoveChannelOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.block(
      operation,
    );
  }

  async attemptResolvedRequest(
    request:
      ResolvedDiscordMutationRequest,
  ): Promise<ExecutionAdapterActionResult> {
    if (
      !request.ready ||
      request.resolverUnresolvedFields.length > 0
    ) {
      throw new Error(
        [
          'Resolved request is not ready.',
          `Operation: ${request.operationId}.`,
        ].join(' '),
      );
    }

    this.blockedRequests.push(
      structuredClone(
        request,
      ),
    );

    /*
     * HARD LOCK.
     *
     * Incluso una request completamente
     * resuelta termina aquí.
     *
     * this.transport.send(request)
     * NO se ejecuta.
     */
    throw new DiscordExecutionLockedError(
      request,
    );
  }

  getBlockedRequests():
    DiscordMutationRequest[] {
    return this.blockedRequests.map(
      (request) =>
        structuredClone(
          request,
        ),
    );
  }

  snapshot():
    ExecutionAdapterSnapshot {
    return {
      mode:
        this.mode,

      bindings: {},

      resources: [],

      actions: [],
    };
  }
}
