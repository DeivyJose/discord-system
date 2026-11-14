import type {
  AutomatableMigrationOperation,
  DiscordExecutionAdapter,
  ExecutionAdapterActionResult,
  MigrationOperation,
} from './executionAdapterTypes.js';

const AUTOMATABLE_OPERATION_TYPES =
  new Set<string>([
    'create_role',
    'create_category',
    'rename_role',
    'rename_category',
    'rename_channel',
    'create_channel',
    'move_channel',
  ]);

export function isAutomatableOperation(
  operation: MigrationOperation,
): operation is AutomatableMigrationOperation {
  return AUTOMATABLE_OPERATION_TYPES.has(
    operation.type,
  );
}

export async function dispatchExecutionOperation(
  adapter: DiscordExecutionAdapter,
  operation: AutomatableMigrationOperation,
): Promise<ExecutionAdapterActionResult> {
  switch (
    operation.type
  ) {
    case 'create_role':
      return adapter.createRole(
        operation,
      );

    case 'create_category':
      return adapter.createCategory(
        operation,
      );

    case 'create_channel':
      return adapter.createChannel(
        operation,
      );

    case 'rename_role':
      return adapter.renameRole(
        operation,
      );

    case 'rename_category':
      return adapter.renameCategory(
        operation,
      );

    case 'rename_channel':
      return adapter.renameChannel(
        operation,
      );

    case 'move_channel':
      return adapter.moveChannel(
        operation,
      );
  }
}
