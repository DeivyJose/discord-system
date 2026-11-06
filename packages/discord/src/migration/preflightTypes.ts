export type PreflightCheckStatus =
  | 'pass'
  | 'warn'
  | 'block';

export interface PreflightCheck {
  id: string;

  label: string;

  status: PreflightCheckStatus;

  details: string;
}

export interface RoleHierarchyCheck {
  roleId: string;

  roleName: string;

  rolePosition: number;

  manageable: boolean;

  reason: string;
}

export interface DiscordMigrationPreflight {
  schemaVersion: 1;

  checkedAt: string;

  guild: {
    id: string;
    name: string;
  };

  bot: {
    id: string;

    tag: string;

    highestRoleId: string;

    highestRoleName: string;

    highestRolePosition: number;

    administrator: boolean;

    manageChannels: boolean;

    manageRoles: boolean;
  };

  requirements: {
    manageChannelsRequired: boolean;

    manageRolesRequired: boolean;
  };

  checks: PreflightCheck[];

  hierarchy: RoleHierarchyCheck[];

  summary: {
    pass: number;

    warn: number;

    block: number;

    migrationTechnicallyPossible: boolean;
  };

  /**
   * Esta herramienta solamente inspecciona.
   */
  executionAllowed: false;
}
