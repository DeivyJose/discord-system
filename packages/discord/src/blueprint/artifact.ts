import {
  createHash,
} from 'node:crypto';

import type {
  DiscordCategoryBlueprint,
  DiscordChannelBlueprint,
  DiscordRoleBlueprint,
} from './types.js';

import {
  DISCORD_CATEGORIES,
} from './categories.js';

import {
  DISCORD_CHANNELS,
} from './channels.js';

import {
  DISCORD_ROLES,
} from './roles.js';

export interface DiscordBlueprintFingerprintInput {
  schemaVersion: 1;

  blueprintVersion: 1;

  categories:
    DiscordCategoryBlueprint[];

  channels:
    DiscordChannelBlueprint[];

  roles:
    DiscordRoleBlueprint[];
}

export interface DiscordBlueprintArtifact
  extends DiscordBlueprintFingerprintInput {
  fingerprintVersion: 1;

  fingerprint: string;

  generatedAt: string;

  summary: {
    categories: number;

    channels: number;

    roles: number;

    totalResources: number;
  };

  executionAllowed: false;
}

/*
 * Canonicalización del Blueprint:
 *
 * - claves de objetos ordenadas;
 * - arrays conservan su orden real.
 *
 * Por tanto:
 * - cambiar el orden textual de claves
 *   no cambia el fingerprint;
 * - reordenar categorías, canales o roles
 *   sí cambia el fingerprint.
 */
function canonicalize(
  value: unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      canonicalize,
    );
  }

  if (
    typeof value ===
      'object' &&
    value !== null
  ) {
    const source =
      value as
        Record<string, unknown>;

    const output:
      Record<string, unknown> =
      {};

    for (
      const key
      of Object.keys(
        source,
      ).sort()
    ) {
      output[key] =
        canonicalize(
          source[key],
        );
    }

    return output;
  }

  return value;
}

function canonicalJson(
  value: unknown,
): string {
  return JSON.stringify(
    canonicalize(
      value,
    ),
  );
}

export function createDiscordBlueprintContentFingerprint(
  input:
    DiscordBlueprintFingerprintInput,
): string {
  const payload = {
    fingerprintVersion:
      1,

    schemaVersion:
      input.schemaVersion,

    blueprintVersion:
      input.blueprintVersion,

    categories:
      input.categories,

    channels:
      input.channels,

    roles:
      input.roles,
  };

  return createHash(
    'sha256',
  )
    .update(
      canonicalJson(
        payload,
      ),
      'utf8',
    )
    .digest(
      'hex',
    );
}

export function createDiscordBlueprintArtifact(
  now = new Date(),
): DiscordBlueprintArtifact {
  const input:
    DiscordBlueprintFingerprintInput = {
    schemaVersion:
      1,

    blueprintVersion:
      1,

    categories:
      structuredClone(
        DISCORD_CATEGORIES,
      ),

    channels:
      structuredClone(
        DISCORD_CHANNELS,
      ),

    roles:
      structuredClone(
        DISCORD_ROLES,
      ),
  };

  const fingerprint =
    createDiscordBlueprintContentFingerprint(
      input,
    );

  return {
    ...input,

    fingerprintVersion:
      1,

    fingerprint,

    generatedAt:
      now.toISOString(),

    summary: {
      categories:
        input.categories.length,

      channels:
        input.channels.length,

      roles:
        input.roles.length,

      totalResources:
        input.categories.length +
        input.channels.length +
        input.roles.length,
    },

    executionAllowed:
      false,
  };
}

export function renderDiscordBlueprintArtifact(
  artifact:
    DiscordBlueprintArtifact,
): string {
  return [
    'THE CLOCK — DISCORD BLUEPRINT ARTIFACT',
    '======================================',
    '',
    `Schema version: ${artifact.schemaVersion}`,
    `Blueprint version: ${artifact.blueprintVersion}`,
    `Fingerprint version: ${artifact.fingerprintVersion}`,
    `Generado: ${artifact.generatedAt}`,
    '',
    `Categorías: ${artifact.summary.categories}`,
    `Canales:    ${artifact.summary.channels}`,
    `Roles:      ${artifact.summary.roles}`,
    `Total:      ${artifact.summary.totalResources}`,
    '',
    `Fingerprint: ${artifact.fingerprint}`,
    '',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'Este artefacto representa el contenido exacto del Blueprint Discord.',
    'No conecta ni modifica Discord.',
    '',
  ].join(
    '\n',
  );
}
