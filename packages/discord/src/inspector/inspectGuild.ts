import {
  ChannelType,
  OverwriteType,
  type Guild,
  type NonThreadGuildBasedChannel,
} from 'discord.js';

import type {
  DiscordChannelSnapshot,
  DiscordGuildSnapshot,
  DiscordRoleSnapshot,
} from './types.js';

function channelToSnapshot(
  channel: NonThreadGuildBasedChannel,
): DiscordChannelSnapshot {
  const optional = channel as NonThreadGuildBasedChannel & {
    topic?: string | null;
    nsfw?: boolean;
    userLimit?: number;
  };

  const permissionOverwrites =
    channel.permissionOverwrites.cache
      .map((overwrite) => ({
        id: overwrite.id,

        type:
          overwrite.type === OverwriteType.Role
            ? ('role' as const)
            : ('member' as const),

        allow: overwrite.allow
          .toArray()
          .sort(),

        deny: overwrite.deny
          .toArray()
          .sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

  return {
    id: channel.id,

    name: channel.name,

    type: channel.type,

    typeName:
      ChannelType[channel.type] ??
      `Unknown(${channel.type})`,

    parentId: channel.parentId,

    position: channel.rawPosition,

    topic:
      typeof optional.topic === 'string'
        ? optional.topic
        : null,

    nsfw:
      typeof optional.nsfw === 'boolean'
        ? optional.nsfw
        : null,

    userLimit:
      typeof optional.userLimit === 'number'
        ? optional.userLimit
        : null,

    viewable: channel.viewable,

    permissionOverwrites,
  };
}

function roleToSnapshot(
  role: Awaited<
    ReturnType<Guild['roles']['fetch']>
  > extends Map<string, infer TRole>
    ? NonNullable<TRole>
    : never,
): DiscordRoleSnapshot {
  return {
    id: role.id,

    name: role.name,

    position: role.position,

    color: role.color,

    hexColor: role.hexColor,

    hoist: role.hoist,

    mentionable: role.mentionable,

    managed: role.managed,

    permissions: role.permissions
      .toArray()
      .sort(),
  };
}

export async function inspectGuild(
  guild: Guild,
): Promise<DiscordGuildSnapshot> {
  const channels =
    await guild.channels.fetch();

  const roles =
    await guild.roles.fetch();

  const channelSnapshots = [
    ...channels.values(),
  ]
    .filter(
      (
        channel,
      ): channel is NonThreadGuildBasedChannel =>
        channel !== null,
    )
    .map(channelToSnapshot)
    .sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }

      return a.id.localeCompare(b.id);
    });

  const roleSnapshots = [
    ...roles.values(),
  ]
    .map(roleToSnapshot)
    .sort((a, b) => {
      if (a.position !== b.position) {
        return b.position - a.position;
      }

      return a.id.localeCompare(b.id);
    });

  return {
    schemaVersion: 1,

    capturedAt: new Date().toISOString(),

    guild: {
      id: guild.id,

      name: guild.name,

      ownerId: guild.ownerId,

      memberCount: guild.memberCount,

      description: guild.description,

      preferredLocale:
        guild.preferredLocale,

      verificationLevel:
        guild.verificationLevel,

      premiumTier:
        guild.premiumTier,

      features: [
        ...guild.features,
      ].sort(),

      systemChannelId:
        guild.systemChannelId,

      rulesChannelId:
        guild.rulesChannelId,

      publicUpdatesChannelId:
        guild.publicUpdatesChannelId,

      afkChannelId:
        guild.afkChannelId,

      createdAt:
        guild.createdAt.toISOString(),
    },

    channels: channelSnapshots,

    roles: roleSnapshots,
  };
}
