import {
  createHash,
} from 'node:crypto';

import type {
  AutomatableMigrationOperation,
} from './executionAdapterTypes.js';

import type {
  DiscordMutationRequest,
} from './discordMutationRequestTypes.js';

function readString(
  value: unknown,
  key: string,
): string | null {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return null;
  }

  const candidate =
    Reflect.get(
      value,
      key,
    );

  return typeof candidate ===
    'string'
    ? candidate
    : null;
}

function requestIdFor(
  operation:
    AutomatableMigrationOperation,
): string {
  const hash =
    createHash(
      'sha256',
    )
      .update(
        operation.id,
        'utf8',
      )
      .digest('hex')
      .slice(
        0,
        24,
      );

  return `request_${hash}`;
}

export function compileDiscordMutationRequest(
  operation:
    AutomatableMigrationOperation,
): DiscordMutationRequest {
  const blueprintId =
    readString(
      operation,
      'blueprintId',
    );

  const actualId =
    readString(
      operation,
      'actualId',
    );

  const desiredName =
    readString(
      operation,
      'desiredName',
    ) ??
    readString(
      operation,
      'name',
    );

  const desiredParentActualId =
    readString(
      operation,
      'desiredParentActualId',
    ) ??
    readString(
      operation,
      'parentActualId',
    );

  const unresolvedFields:
    string[] = [];

  switch (
    operation.type
  ) {
    case 'create_role':
    case 'create_category':
    case 'create_channel':
      if (
        !desiredName
      ) {
        unresolvedFields.push(
          'desiredName',
        );
      }

      break;

    case 'rename_role':
    case 'rename_category':
    case 'rename_channel':
      if (
        !actualId
      ) {
        unresolvedFields.push(
          'actualId',
        );
      }

      if (
        !desiredName
      ) {
        unresolvedFields.push(
          'desiredName',
        );
      }

      break;

    case 'move_channel':
      if (
        !actualId
      ) {
        unresolvedFields.push(
          'actualId',
        );
      }

      if (
        !desiredParentActualId
      ) {
        unresolvedFields.push(
          'desiredParentActualId',
        );
      }

      break;
  }

  return {
    schemaVersion: 1,

    requestId:
      requestIdFor(
        operation,
      ),

    operationId:
      operation.id,

    operationType:
      operation.type,

    resourceKind:
      operation.resourceKind,

    blueprintId,

    actualId,

    desiredName,

    desiredParentActualId,

    unresolvedFields,

    sourceOperation:
      structuredClone(
        operation,
      ),

    executionAllowed:
      false,
  };
}
