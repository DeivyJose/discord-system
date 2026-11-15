import type {
  AutomatableMigrationOperation,
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

import type {
  BindingAwarePreparedOperation,
} from './bindingAwareExecutionTypes.js';

export class BindingAwareExecutionError
extends Error {
  readonly code =
    'BINDING_AWARE_RESOLUTION_BLOCKED';

  readonly operationId:
    string;

  readonly unresolvedFields:
    string[];

  constructor(
    operationId: string,
    unresolvedFields:
      readonly string[],
  ) {
    super(
      [
        `Operation ${operationId} no está lista para ejecución.`,
        `Unresolved: ${unresolvedFields.join(', ') || 'unknown'}.`,
      ].join(
        ' ',
      ),
    );

    this.name =
      'BindingAwareExecutionError';

    this.operationId =
      operationId;

    this.unresolvedFields =
      [...unresolvedFields];
  }
}

function requireResolvedActualId(
  request:
    ResolvedDiscordMutationRequest,
): string {
  if (
    !request.resolvedActualId
  ) {
    throw new BindingAwareExecutionError(
      request.operationId,
      [
        'resolvedActualId',
      ],
    );
  }

  return request.resolvedActualId;
}

function requireResolvedParentActualId(
  request:
    ResolvedDiscordMutationRequest,
): string {
  if (
    !request.resolvedParentActualId
  ) {
    throw new BindingAwareExecutionError(
      request.operationId,
      [
        'resolvedParentActualId',
      ],
    );
  }

  return request
    .resolvedParentActualId;
}

export function prepareBindingAwareOperation(
  operation:
    AutomatableMigrationOperation,

  bindings:
    MutationResolverBindings,
): BindingAwarePreparedOperation {
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
    throw new BindingAwareExecutionError(
      operation.id,
      resolved.request
        .resolverUnresolvedFields,
    );
  }

  const request =
    resolved.request;

  let prepared:
    AutomatableMigrationOperation;

  switch (
    operation.type
  ) {
    case 'create_channel': {
      if (
        request
          .resolvedParentBlueprintId
      ) {
        const parentActualId =
          requireResolvedParentActualId(
            request,
          );

        prepared = {
          ...structuredClone(
            operation,
          ),

          desiredParentActualId:
            parentActualId,
        };

        break;
      }

      prepared =
        structuredClone(
          operation,
        );

      break;
    }

    case 'move_channel': {
      prepared = {
        ...structuredClone(
          operation,
        ),

        actualId:
          requireResolvedActualId(
            request,
          ),

        desiredParentActualId:
          requireResolvedParentActualId(
            request,
          ),
      };

      break;
    }

    case 'rename_role':
    case 'rename_category':
    case 'rename_channel': {
      prepared = {
        ...structuredClone(
          operation,
        ),

        actualId:
          requireResolvedActualId(
            request,
          ),
      };

      break;
    }

    case 'create_role':
    case 'create_category': {
      prepared =
        structuredClone(
          operation,
        );

      break;
    }
  }

  return {
    sourceOperationId:
      operation.id,

    operation:
      prepared,

    request,

    executionAllowed:
      false,
  };
}
