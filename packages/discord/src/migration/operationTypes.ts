export type MigrationOperationType =
  | 'create_category'
  | 'create_channel'
  | 'create_role'
  | 'rename_category'
  | 'rename_channel'
  | 'rename_role'
  | 'move_channel'
  | 'review_managed_role'
  | 'review_binding'
  | 'review_legacy';

export type MigrationOperationResourceKind =
  | 'category'
  | 'channel'
  | 'role';

export interface MigrationOperation {
  id: string;

  type: MigrationOperationType;

  resourceKind: MigrationOperationResourceKind;

  blueprintId?: string;

  actualId?: string;

  currentName?: string;

  desiredName?: string;

  currentParentId?: string | null;

  desiredParentBlueprintId?: string;

  desiredParentActualId?: string;

  channelKind?: string;

  reason: string;

  /**
   * Siempre true en esta fase.
   *
   * Ninguna operación sensible se ejecutará
   * sin confirmación explícita futura.
   */
  requiresConfirmation: true;
}

export interface MigrationOperationsPlan {
  schemaVersion: 1;

  generatedAt: string;

  guild: {
    id: string;
    name: string;
  };

  summary: {
    total: number;

    createCategories: number;
    createChannels: number;
    createRoles: number;

    renameCategories: number;
    renameChannels: number;
    renameRoles: number;

    moveChannels: number;

    reviewManagedRoles: number;
    reviewBindings: number;
    reviewLegacy: number;
  };

  operations: MigrationOperation[];
}
