import {
  DISCORD_CATEGORIES,
} from '../blueprint/categories.js';

import {
  DISCORD_CHANNELS,
} from '../blueprint/channels.js';

import {
  DISCORD_ROLES,
} from '../blueprint/roles.js';

import type {
  DiscordMutationRequest,
} from './discordMutationRequestTypes.js';

import type {
  MutationBindingSource,
  MutationResolverBindings,
  MutationResolverResult,
  ResolvedBlueprintResource,
  ResolvedDiscordMutationRequest,
} from './discordMutationResolverTypes.js';

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  return value as
    Record<string, unknown>;
}

function readString(
  value: unknown,
  key: string,
): string | null {
  const object =
    asObject(
      value,
    );

  const candidate =
    object?.[key];

  return typeof candidate ===
    'string'
    ? candidate
    : null;
}

const BLUEPRINT_RESOURCES:
  ResolvedBlueprintResource[] = [
    ...DISCORD_CATEGORIES,
    ...DISCORD_CHANNELS,
    ...DISCORD_ROLES,
  ].map(
    (
      resource,
    ): ResolvedBlueprintResource => ({
      id:
        resource.id,

      kind:
        resource.kind,

      name:
        resource.name,

      definition:
        structuredClone(
          resource,
        ) as
          Record<string, unknown>,
    }),
  );

const BLUEPRINT_BY_ID =
  new Map(
    BLUEPRINT_RESOURCES.map(
      (resource) => [
        resource.id,
        resource,
      ] as const,
    ),
  );

function resolveBinding(
  blueprintId: string | null,
  operationActualId: string | null,
  bindings:
    MutationResolverBindings,
): {
  actualId: string | null;

  source:
    MutationBindingSource;
} {
  if (
    operationActualId
  ) {
    return {
      actualId:
        operationActualId,

      source:
        'operation',
    };
  }

  if (
    !blueprintId
  ) {
    return {
      actualId: null,

      source:
        'none',
    };
  }

  const sessionActualId =
    bindings.session[
      blueprintId
    ];

  if (
    sessionActualId
  ) {
    return {
      actualId:
        sessionActualId,

      source:
        'session',
    };
  }

  const confirmedActualId =
    bindings.confirmed[
      blueprintId
    ];

  if (
    confirmedActualId
  ) {
    return {
      actualId:
        confirmedActualId,

      source:
        'confirmed',
    };
  }

  return {
    actualId: null,

    source:
      'none',
  };
}

function findBlueprintResource(
  blueprintId: string | null,
): ResolvedBlueprintResource | null {
  if (
    !blueprintId
  ) {
    return null;
  }

  const resource =
    BLUEPRINT_BY_ID.get(
      blueprintId,
    );

  return resource
    ? structuredClone(
        resource,
      )
    : null;
}

function parentBlueprintIdFor(
  request:
    DiscordMutationRequest,
  blueprintResource:
    ResolvedBlueprintResource | null,
): string | null {
  const operationParent =
    readString(
      request.sourceOperation,
      'desiredParentBlueprintId',
    );

  if (
    operationParent
  ) {
    return operationParent;
  }

  if (
    !blueprintResource
  ) {
    return null;
  }

  return readString(
    blueprintResource.definition,
    'parentId',
  );
}

function channelKindFor(
  request:
    DiscordMutationRequest,
  blueprintResource:
    ResolvedBlueprintResource | null,
): string | null {
  const operationKind =
    readString(
      request.sourceOperation,
      'channelKind',
    );

  if (
    operationKind
  ) {
    return operationKind;
  }

  if (
    request.resourceKind !==
      'channel'
  ) {
    return null;
  }

  return (
    blueprintResource?.kind ??
    null
  );
}

function actualIdIsRequired(
  request:
    DiscordMutationRequest,
): boolean {
  switch (
    request.operationType
  ) {
    case 'rename_role':
    case 'rename_category':
    case 'rename_channel':
    case 'move_channel':
      return true;

    case 'create_role':
    case 'create_category':
    case 'create_channel':
      return false;
  }
}

export function resolveDiscordMutationRequest(
  request:
    DiscordMutationRequest,
  bindings:
    MutationResolverBindings,
): MutationResolverResult {
  const blueprintResource =
    findBlueprintResource(
      request.blueprintId,
    );

  const selfBinding =
    resolveBinding(
      request.blueprintId,
      request.actualId,
      bindings,
    );

  const resolvedParentBlueprintId =
    parentBlueprintIdFor(
      request,
      blueprintResource,
    );

  const parentBinding =
    resolveBinding(
      resolvedParentBlueprintId,
      request.desiredParentActualId,
      bindings,
    );

  const resolvedChannelKind =
    channelKindFor(
      request,
      blueprintResource,
    );

  const unresolved =
    new Set<string>(
      request.unresolvedFields,
    );

  if (
    !request.blueprintId
  ) {
    unresolved.add(
      'blueprintId',
    );
  }

  if (
    !blueprintResource
  ) {
    unresolved.add(
      'blueprintResource',
    );
  }

  if (
    actualIdIsRequired(
      request,
    ) &&
    !selfBinding.actualId
  ) {
    unresolved.add(
      'resolvedActualId',
    );
  }

  if (
    request.operationType ===
      'create_channel'
  ) {
    if (
      !resolvedChannelKind
    ) {
      unresolved.add(
        'resolvedChannelKind',
      );
    }

    /*
     * Un canal del Blueprint con parentId
     * necesita obligatoriamente el Discord
     * actualId de dicha categoría.
     */
    if (
      resolvedParentBlueprintId &&
      !parentBinding.actualId
    ) {
      unresolved.add(
        'resolvedParentActualId',
      );
    }
  }

  if (
    request.operationType ===
      'move_channel'
  ) {
    if (
      !resolvedParentBlueprintId
    ) {
      unresolved.add(
        'resolvedParentBlueprintId',
      );
    }

    if (
      !parentBinding.actualId
    ) {
      unresolved.add(
        'resolvedParentActualId',
      );
    }
  }

  const resolverUnresolvedFields =
    [...unresolved].sort();

  const resolvedRequest:
    ResolvedDiscordMutationRequest = {
      ...structuredClone(
        request,
      ),

      blueprintResource,

      resolvedActualId:
        selfBinding.actualId,

      actualIdSource:
        selfBinding.source,

      resolvedParentBlueprintId,

      resolvedParentActualId:
        parentBinding.actualId,

      parentActualIdSource:
        parentBinding.source,

      resolvedChannelKind,

      resolverUnresolvedFields,

      ready:
        resolverUnresolvedFields
          .length === 0,

      executionAllowed:
        false,
    };

  return {
    schemaVersion: 1,

    request:
      resolvedRequest,

    ready:
      resolvedRequest.ready,

    executionAllowed:
      false,
  };
}
