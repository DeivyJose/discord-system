export interface PermissionOverwriteSnapshot {
  id: string;
  type: 'role' | 'member';
  allow: string[];
  deny: string[];
}

export interface DiscordChannelSnapshot {
  id: string;
  name: string;

  type: number;
  typeName: string;

  parentId: string | null;

  position: number;

  topic: string | null;

  nsfw: boolean | null;

  userLimit: number | null;

  viewable: boolean;

  permissionOverwrites: PermissionOverwriteSnapshot[];
}

export interface DiscordRoleSnapshot {
  id: string;

  name: string;

  position: number;

  color: number;

  hexColor: string;

  hoist: boolean;

  mentionable: boolean;

  managed: boolean;

  permissions: string[];
}

export interface DiscordGuildSnapshot {
  schemaVersion: 1;

  capturedAt: string;

  guild: {
    id: string;

    name: string;

    ownerId: string;

    memberCount: number;

    description: string | null;

    preferredLocale: string;

    verificationLevel: number;

    premiumTier: number;

    features: string[];

    systemChannelId: string | null;

    rulesChannelId: string | null;

    publicUpdatesChannelId: string | null;

    afkChannelId: string | null;

    createdAt: string;
  };

  channels: DiscordChannelSnapshot[];

  roles: DiscordRoleSnapshot[];
}
