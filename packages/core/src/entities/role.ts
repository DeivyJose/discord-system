import type { EntityStatus } from '../types/status.js';

export type RoleType =
  | 'system'
  | 'administrative'
  | 'employment'
  | 'community'
  | 'institution'
  | 'notification'
  | 'access'
  | 'cosmetic';

export interface RoleDefinition {
  id: string;

  name: string;

  description: string;

  type: RoleType;

  status: EntityStatus;

  /**
   * Permisos internos.
   *
   * No son necesariamente los mismos permisos de Discord.
   */
  permissions: string[];
}
