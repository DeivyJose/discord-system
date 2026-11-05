export type DiscordResourceKind =
  | 'category'
  | 'text_channel'
  | 'announcement_channel'
  | 'forum_channel'
  | 'voice_channel'
  | 'role';

export type DiscordAccessPreset =
  | 'public'
  | 'member'
  | 'community'
  | 'employment'
  | 'private'
  | 'prisoner'
  | 'owner';

export interface DiscordAccessRule {
  preset: DiscordAccessPreset;

  /**
   * Roles lógicos adicionales que pueden ver
   * este recurso.
   */
  allowRoleIds?: string[];

  /**
   * Roles lógicos a los que se les niega acceso.
   */
  denyRoleIds?: string[];
}

export interface DiscordCategoryBlueprint {
  id: string;

  kind: 'category';

  name: string;

  description: string;

  moduleId?: string;

  departmentId?: string;

  position: number;

  access: DiscordAccessRule;
}

export interface DiscordChannelBlueprint {
  id: string;

  kind:
    | 'text_channel'
    | 'announcement_channel'
    | 'forum_channel'
    | 'voice_channel';

  name: string;

  description: string;

  parentId: string;

  moduleId?: string;

  departmentId?: string;

  position: number;

  access: DiscordAccessRule;

  /**
   * Solo para canales de voz.
   * 0 = sin límite.
   */
  userLimit?: number;

  /**
   * Indica que el canal será administrado
   * automáticamente por Compai.
   */
  automated?: boolean;
}

export interface DiscordRoleBlueprint {
  id: string;

  kind: 'role';

  name: string;

  description: string;

  /**
   * Cuanto mayor sea este valor, mayor debería
   * estar en la jerarquía del servidor.
   */
  priority: number;

  hoist: boolean;

  mentionable: boolean;

  /**
   * Rol funcional interno relacionado, si existe.
   */
  jobId?: string;

  moduleId?: string;

  departmentId?: string;

  systemManaged: boolean;
}
