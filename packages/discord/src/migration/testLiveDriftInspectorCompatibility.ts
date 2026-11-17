import {
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import {
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  return value as
    Record<string, unknown>;
}

function asArray(
  value: unknown,
): unknown[] {
  return Array.isArray(
    value,
  )
    ? value
    : [];
}

function readString(
  value: unknown,
  key: string,
): string | null {
  const object =
    asObject(
      value,
    );

  const candidate =
    object?.[key];

  return typeof candidate ===
    'string'
    ? candidate
    : null;
}

function isGuildCategory(
  value: unknown,
): boolean {
  const object =
    asObject(
      value,
    );

  return (
    readString(
      value,
      'typeName',
    ) ===
      'GuildCategory' ||
    object?.type ===
      4
  );
}

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const rawSnapshot =
  JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        '.data',
        'discord-snapshots',
        'latest.json',
      ),
      'utf8',
    ),
  ) as unknown;

const rawObject =
  asObject(
    rawSnapshot,
  );

if (
  !rawObject
) {
  throw new Error(
    'El snapshot real no es un objeto JSON válido.',
  );
}

const rawCategories =
  asArray(
    rawObject.categories,
  );

const rawChannels =
  asArray(
    rawObject.channels,
  );

const rawRoles =
  asArray(
    rawObject.roles,
  );

if (
  rawChannels.length ===
    0 ||
  rawRoles.length ===
    0
) {
  throw new Error(
    'El snapshot real no contiene channels/roles suficientes para la prueba.',
  );
}

const inspectorCategories =
  rawChannels.filter(
    isGuildCategory,
  );

const expectedCategorySources =
  rawCategories.length > 0
    ? rawCategories
    : inspectorCategories;

const expectedChannels =
  rawChannels.filter(
    (resource) =>
      !isGuildCategory(
        resource,
      ),
  );

const normalized =
  normalizeDiscordStructureSnapshot(
    rawSnapshot,
  );

const normalizedCategories =
  normalized.resources.filter(
    (resource) =>
      resource.kind ===
        'category',
  );

const normalizedChannels =
  normalized.resources.filter(
    (resource) =>
      resource.kind ===
        'channel',
  );

const normalizedRoles =
  normalized.resources.filter(
    (resource) =>
      resource.kind ===
        'role',
  );

const expectedCategoryIds =
  new Set(
    expectedCategorySources
      .map(
        (resource) =>
          readString(
            resource,
            'id',
          ),
      )
      .filter(
        (
          id,
        ): id is string =>
          id !==
            null,
      ),
  );

const categoriesClassifiedCorrectly =
  [...expectedCategoryIds].every(
    (id) =>
      normalized.resources.some(
        (resource) =>
          resource.id ===
            id &&
          resource.kind ===
            'category',
      ),
  );

const categoryNeverClassifiedAsChannel =
  [...expectedCategoryIds].every(
    (id) =>
      !normalized.resources.some(
        (resource) =>
          resource.id ===
            id &&
          resource.kind ===
            'channel',
      ),
  );

const countsMatch =
  normalizedCategories.length ===
      expectedCategorySources.length &&
  normalizedChannels.length ===
      expectedChannels.length &&
  normalizedRoles.length ===
      rawRoles.length;

const totalMatches =
  normalized.resources.length ===
    (
      expectedCategorySources.length +
      expectedChannels.length +
      rawRoles.length
    );

const inspectorShapeDetected =
  rawCategories.length ===
    0 &&
  inspectorCategories.length >
    0;

const currentClockShape =
  normalizedCategories.length ===
      6 &&
  normalizedChannels.length ===
      11 &&
  normalizedRoles.length ===
      6;

/*
 * Compatibilidad adicional:
 * el formato sintético antiguo con categories[]
 * debe seguir funcionando.
 */
const legacyNormalized =
  normalizeDiscordStructureSnapshot({
    capturedAt:
      '2026-01-01T00:00:00.000Z',

    guild: {
      id:
        'legacy-guild',
    },

    categories: [
      {
        id:
          'legacy-category',

        name:
          'Legacy Category',

        position:
          0,
      },
    ],

    channels: [
      {
        id:
          'legacy-channel',

        name:
          'legacy-channel',

        type:
          0,

        typeName:
          'GuildText',

        parentId:
          'legacy-category',

        position:
          0,

        permissionOverwrites:
          [],
      },
    ],

    roles: [
      {
        id:
          'legacy-role',

        name:
          'Legacy Role',

        position:
          1,

        managed:
          false,

        permissions:
          [],
      },
    ],
  });

const legacyCompatible =
  legacyNormalized.resources.filter(
    (resource) =>
      resource.kind ===
        'category',
  ).length ===
      1 &&
  legacyNormalized.resources.filter(
    (resource) =>
      resource.kind ===
        'channel',
  ).length ===
      1 &&
  legacyNormalized.resources.filter(
    (resource) =>
      resource.kind ===
        'role',
  ).length ===
      1;

const success =
  inspectorShapeDetected &&
  countsMatch &&
  totalMatches &&
  categoriesClassifiedCorrectly &&
  categoryNeverClassifiedAsChannel &&
  legacyCompatible;

console.log('');
console.log(
  '🧭 Live Drift Inspector Compatibility v1',
);

console.log('');

console.log(
  `Inspector shape detectado: ${inspectorShapeDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Categorías normalizadas: ${normalizedCategories.length}`,
);

console.log(
  `Canales normalizados:    ${normalizedChannels.length}`,
);

console.log(
  `Roles normalizados:      ${normalizedRoles.length}`,
);

console.log(
  `Total estructural:       ${normalized.resources.length}`,
);

console.log('');

console.log(
  `Conteos derivados coinciden: ${countsMatch ? 'SÍ' : 'NO'}`,
);

console.log(
  `Categorías clasificadas correctamente: ${categoriesClassifiedCorrectly ? 'SÍ' : 'NO'}`,
);

console.log(
  `Categorías nunca tratadas como canal: ${categoryNeverClassifiedAsChannel ? 'SÍ' : 'NO'}`,
);

console.log(
  `Formato legacy compatible: ${legacyCompatible ? 'SÍ' : 'NO'}`,
);

console.log(
  `Estado actual The Clock = 6/11/6: ${currentClockShape ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'MUTACIONES REALES ENVIADAS: 0',
);

console.log(
  'EJECUCIÓN REAL PERMITIDA: NO',
);

console.log('');

if (
  !success
) {
  process.exitCode =
    2;
}
