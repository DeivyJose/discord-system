import {
  mkdir,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  Client,
  Events,
  GatewayIntentBits,
} from 'discord.js';

import { inspectGuild } from './inspectGuild.js';

const token =
  process.env.DISCORD_TOKEN?.trim();

const guildId =
  process.env.DISCORD_GUILD_ID?.trim();

if (!token) {
  throw new Error(
    'Falta DISCORD_TOKEN en el archivo .env.',
  );
}

if (!guildId) {
  throw new Error(
    'Falta DISCORD_GUILD_ID en el archivo .env.',
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

async function waitForClientReady(): Promise<void> {
  if (client.isReady()) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();

      reject(
        new Error(
          'Discord no confirmó ClientReady dentro de 20 segundos.',
        ),
      );
    }, 20_000);

    const handleReady = (): void => {
      cleanup();
      resolve();
    };

    const handleError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const cleanup = (): void => {
      clearTimeout(timeout);

      client.off(
        Events.ClientReady,
        handleReady,
      );

      client.off(
        Events.Error,
        handleError,
      );
    };

    client.once(
      Events.ClientReady,
      handleReady,
    );

    client.once(
      Events.Error,
      handleError,
    );
  });
}

try {
  console.log('');
  console.log(
    '🔎 Iniciando inspector de The Clock...',
  );

  await client.login(token);

  await waitForClientReady();

  const readyUser = client.user;

  if (!readyUser) {
    throw new Error(
      'Discord emitió ClientReady, pero client.user sigue siendo null.',
    );
  }

  console.log(
    `Compai conectado como: ${readyUser.tag}`,
  );

  const guild =
    await client.guilds.fetch(guildId);

  console.log(
    `Servidor encontrado: ${guild.name}`,
  );

  const snapshot =
    await inspectGuild(guild);

  const outputDirectory =
    path.resolve(
      process.cwd(),
      '../../.data/discord-snapshots',
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const timestamp =
    snapshot.capturedAt
      .replaceAll(':', '-')
      .replaceAll('.', '-');

  const filename =
    `snapshot-${guild.id}-${timestamp}.json`;

  const snapshotPath =
    path.join(
      outputDirectory,
      filename,
    );

  const latestPath =
    path.join(
      outputDirectory,
      'latest.json',
    );

  const serialized =
    JSON.stringify(
      snapshot,
      null,
      2,
    ) + '\n';

  await writeFile(
    snapshotPath,
    serialized,
    'utf8',
  );

  await writeFile(
    latestPath,
    serialized,
    'utf8',
  );

  const categories =
    snapshot.channels.filter(
      (channel) =>
        channel.typeName ===
        'GuildCategory',
    );

  const nonCategories =
    snapshot.channels.filter(
      (channel) =>
        channel.typeName !==
        'GuildCategory',
    );

  console.log('');
  console.log(
    '✅ Inspección terminada.',
  );

  console.log('');
  console.log(
    `Servidor:    ${snapshot.guild.name}`,
  );

  console.log(
    `Miembros:    ${snapshot.guild.memberCount}`,
  );

  console.log(
    `Categorías:  ${categories.length}`,
  );

  console.log(
    `Canales:     ${nonCategories.length}`,
  );

  console.log(
    `Roles:       ${snapshot.roles.length}`,
  );

  console.log('');
  console.log(
    `Snapshot: ${snapshotPath}`,
  );

  console.log('');
  console.log(
    'ℹ️ No se realizó ninguna modificación en Discord.',
  );

  console.log('');
} finally {
  client.destroy();
}
