import {
  readFile,
} from 'node:fs/promises';

import type {
  DiscordBindings,
} from './types.js';

export async function loadDiscordBindings(
  path: string,
  guildId: string,
): Promise<DiscordBindings> {
  try {
    const raw =
      await readFile(
        path,
        'utf8',
      );

    const parsed =
      JSON.parse(raw) as DiscordBindings;

    if (parsed.schemaVersion !== 1) {
      throw new Error(
        `Versión de bindings no soportada: ${parsed.schemaVersion}`,
      );
    }

    if (parsed.guildId !== guildId) {
      throw new Error(
        [
          'El archivo de bindings pertenece a otro servidor.',
          `Esperado: ${guildId}`,
          `Encontrado: ${parsed.guildId}`,
        ].join(' '),
      );
    }

    return parsed;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return {
        schemaVersion: 1,

        guildId,

        updatedAt: null,

        resources: {},
      };
    }

    throw error;
  }
}
