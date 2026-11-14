import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

export type MigrationOperation =
  MigrationOperationsPlan['operations'][number];

export type AutomatableOperationType =
  | 'create_role'
  | 'create_category'
  | 'rename_role'
  | 'rename_category'
  | 'rename_channel'
  | 'create_channel'
  | 'move_channel';

/**
 * IMPORTANTE:
 *
 * MigrationOperation no está modelado actualmente como una
 * discriminated union suficientemente estrecha para usar
 * Extract<MigrationOperation, { type: '...' }>.
 *
 * Por eso construimos explícitamente cada variante mediante
 * intersección.
 */
export type CreateRoleOperation =
  MigrationOperation & {
    type: 'create_role';
  };

export type CreateCategoryOperation =
  MigrationOperation & {
    type: 'create_category';
  };

export type CreateChannelOperation =
  MigrationOperation & {
    type: 'create_channel';
  };

export type RenameRoleOperation =
  MigrationOperation & {
    type: 'rename_role';
  };

export type RenameCategoryOperation =
  MigrationOperation & {
    type: 'rename_category';
  };

export type RenameChannelOperation =
  MigrationOperation & {
    type: 'rename_channel';
  };

export type MoveChannelOperation =
  MigrationOperation & {
    type: 'move_channel';
  };

export type AutomatableMigrationOperation =
  | CreateRoleOperation
  | CreateCategoryOperation
  | CreateChannelOperation
  | RenameRoleOperation
  | RenameCategoryOperation
  | RenameChannelOperation
  | MoveChannelOperation;

export interface ExecutionAdapterBinding {
  blueprintId: string;

  actualId: string;
}

export interface ExecutionAdapterResourceState {
  actualId: string;

  resourceKind: string;

  blueprintId: string | null;

  name: string | null;

  parentActualId: string | null;

  synthetic: boolean;
}

export interface ExecutionAdapterActionResult {
  operationId: string;

  operationType: string;

  resourceKind: string;

  status:
    | 'simulated'
    | 'applied';

  actualId: string | null;

  description: string;

  binding:
    | ExecutionAdapterBinding
    | null;
}

export interface ExecutionAdapterSnapshot {
  mode:
    | 'fake'
    | 'real';

  bindings:
    Record<string, string>;

  resources:
    ExecutionAdapterResourceState[];

  actions:
    ExecutionAdapterActionResult[];
}

export interface DiscordExecutionAdapter {
  readonly mode:
    | 'fake'
    | 'real';

  createRole(
    operation: CreateRoleOperation,
  ): Promise<ExecutionAdapterActionResult>;

  createCategory(
    operation: CreateCategoryOperation,
  ): Promise<ExecutionAdapterActionResult>;

  createChannel(
    operation: CreateChannelOperation,
  ): Promise<ExecutionAdapterActionResult>;

  renameRole(
    operation: RenameRoleOperation,
  ): Promise<ExecutionAdapterActionResult>;

  renameCategory(
    operation: RenameCategoryOperation,
  ): Promise<ExecutionAdapterActionResult>;

  renameChannel(
    operation: RenameChannelOperation,
  ): Promise<ExecutionAdapterActionResult>;

  moveChannel(
    operation: MoveChannelOperation,
  ): Promise<ExecutionAdapterActionResult>;

  snapshot():
    ExecutionAdapterSnapshot;
}
