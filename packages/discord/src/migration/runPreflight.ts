import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  Client,
  Events,
  GatewayIntentBits,
} from 'discord.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  createDiscordMigrationPreflight,
} from './preflight.js';

import {
  renderDiscordMigrationPreflight,
} from './preflightReport.js';

const token =
  process.env.DISCORD_TOKEN?.trim();

const guildId =
  process.env.DISCORD_GUILD_ID?.trim();

if (!token) {
  throw new Error(
    'Falta DISCORD_TOKEN.',
  );
}

if (!guildId) {
  throw new Error(
    'Falta DISCORD_GUILD_ID.',
  );
}

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const operationsPath =
  path.join(
    projectRoot,
    '.data',
    'migration-operations',
    'latest.json',
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'migration-preflight',
  );

const operations =
  JSON.parse(
    await readFile(
      operationsPath,
      'utf8',
    ),
  ) as MigrationOperationsPlan;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

async function waitForReady(): Promise<void> {
  if (client.isReady()) {
    return;
  }

  await new Promise<void>(
    (resolve, reject) => {
      const timeout =
        setTimeout(
          () => {
            cleanup();

            reject(
              new Error(
                'Discord no emitió ClientReady en 20 segundos.',
              ),
            );
          },
          20_000,
        );

      const ready = (): void => {
        cleanup();
        resolve();
      };

      const error = (
        value: Error,
      ): void => {
        cleanup();
        reject(value);
      };

      const cleanup = (): void => {
        clearTimeout(timeout);

        client.off(
          Events.ClientReady,
          ready,
        );

        client.off(
          Events.Error,
          error,
        );
      };

      client.once(
        Events.ClientReady,
        ready,
      );

      client.once(
        Events.Error,
        error,
      );
    },
  );
}

try {
  console.log('');
  console.log(
    '🛡️ Ejecutando preflight de Discord...',
  );

  await client.login(token);

  await waitForReady();

  const guild =
    await client.guilds.fetch(
      guildId,
    );

  await guild.roles.fetch();

  const botMember =
    await guild.members.fetchMe();

  const preflight =
    createDiscordMigrationPreflight(
      guild,
      botMember,
      operations,
    );

  const report =
    renderDiscordMigrationPreflight(
      preflight,
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const jsonPath =
    path.join(
      outputDirectory,
      'latest.json',
    );

  const textPath =
    path.join(
      outputDirectory,
      'latest.txt',
    );

  await writeFile(
    jsonPath,
    JSON.stringify(
      preflight,
      null,
      2,
    ) + '\n',
    'utf8',
  );

  await writeFile(
    textPath,
    report,
    'utf8',
  );

  console.log('');
  console.log(
    '✅ Preflight terminado.',
  );

  console.log('');
  console.log(
    `PASS:  ${preflight.summary.pass}`,
  );

  console.log(
    `WARN:  ${preflight.summary.warn}`,
  );

  console.log(
    `BLOCK: ${preflight.summary.block}`,
  );

  console.log('');

  console.log(
    `Migración técnicamente posible: ${
      preflight.summary.migrationTechnicallyPossible
        ? 'SÍ'
        : 'NO'
    }`,
  );

  console.log('');

  console.log(
    'Ejecución permitida: NO',
  );

  console.log('');

  console.log(
    `Reporte: ${textPath}`,
  );
} finally {
  client.destroy();
}
