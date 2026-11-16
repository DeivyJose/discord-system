import type {
  DiscordBlueprintFingerprintInput,
} from './artifact.js';

import {
  createDiscordBlueprintArtifact,
  createDiscordBlueprintContentFingerprint,
} from './artifact.js';

function reverseObjectKeys(
  value: unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      reverseObjectKeys,
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
      ).reverse()
    ) {
      output[key] =
        reverseObjectKeys(
          source[key],
        );
    }

    return output;
  }

  return value;
}

const baseline =
  createDiscordBlueprintArtifact(
    new Date(
      '2026-01-01T00:00:00.000Z',
    ),
  );

const baselineInput:
  DiscordBlueprintFingerprintInput = {
  schemaVersion:
    baseline.schemaVersion,

  blueprintVersion:
    baseline.blueprintVersion,

  categories:
    structuredClone(
      baseline.categories,
    ),

  channels:
    structuredClone(
      baseline.channels,
    ),

  roles:
    structuredClone(
      baseline.roles,
    ),
};

const validFormat =
  baseline.schemaVersion ===
    1 &&
  baseline.blueprintVersion ===
    1 &&
  baseline.fingerprintVersion ===
    1 &&
  /^[a-f0-9]{64}$/i.test(
    baseline.fingerprint,
  );

/*
 * Categoría renombrada.
 */
const renamedCategory =
  structuredClone(
    baselineInput,
  );

const category =
  renamedCategory
    .categories[0];

if (
  !category
) {
  throw new Error(
    'Blueprint sin categorías.',
  );
}

category.name =
  `${category.name} TEST`;

const categoryRenameDetected =
  createDiscordBlueprintContentFingerprint(
    renamedCategory,
  ) !==
  baseline.fingerprint;

/*
 * Cambio de acceso.
 */
const accessMutation =
  structuredClone(
    baselineInput,
  );

const accessCategory =
  accessMutation
    .categories[0];

if (
  !accessCategory
) {
  throw new Error(
    'Blueprint sin categoría para access test.',
  );
}

accessCategory.access = {
  preset:
    'member',
};

const accessChangeDetected =
  createDiscordBlueprintContentFingerprint(
    accessMutation,
  ) !==
  baseline.fingerprint;

/*
 * Canal movido a otro parent.
 */
const movedChannel =
  structuredClone(
    baselineInput,
  );

const channel =
  movedChannel
    .channels[0];

if (
  !channel
) {
  throw new Error(
    'Blueprint sin canales.',
  );
}

channel.parentId =
  'category_malecon';

const parentChangeDetected =
  createDiscordBlueprintContentFingerprint(
    movedChannel,
  ) !==
  baseline.fingerprint;

/*
 * Prioridad de rol alterada.
 */
const changedRole =
  structuredClone(
    baselineInput,
  );

const role =
  changedRole
    .roles[0];

if (
  !role
) {
  throw new Error(
    'Blueprint sin roles.',
  );
}

role.priority +=
  1;

const rolePriorityDetected =
  createDiscordBlueprintContentFingerprint(
    changedRole,
  ) !==
  baseline.fingerprint;

/*
 * Orden real de arrays alterado.
 */
const reorderedCategories =
  structuredClone(
    baselineInput,
  );

if (
  reorderedCategories
    .categories.length <
      2
) {
  throw new Error(
    'Se requieren al menos dos categorías.',
  );
}

const first =
  reorderedCategories
    .categories[0];

const second =
  reorderedCategories
    .categories[1];

if (
  !first ||
  !second
) {
  throw new Error(
    'No fue posible leer categorías para reorder test.',
  );
}

reorderedCategories
  .categories[0] =
  second;

reorderedCategories
  .categories[1] =
  first;

const arrayOrderDetected =
  createDiscordBlueprintContentFingerprint(
    reorderedCategories,
  ) !==
  baseline.fingerprint;

/*
 * Solo cambia el orden de las claves JSON.
 * Debe producir el mismo hash.
 */
const reversedKeys =
  reverseObjectKeys(
    baselineInput,
  ) as
    DiscordBlueprintFingerprintInput;

const keyOrderIndependent =
  createDiscordBlueprintContentFingerprint(
    reversedKeys,
  ) ===
  baseline.fingerprint;

/*
 * generatedAt NO forma parte del contenido
 * criptográfico del Blueprint.
 */
const laterArtifact =
  createDiscordBlueprintArtifact(
    new Date(
      '2026-02-01T00:00:00.000Z',
    ),
  );

const generationTimeIndependent =
  laterArtifact.fingerprint ===
    baseline.fingerprint;

/*
 * La frontera sigue hard-locked.
 */
const executionDisabled =
  baseline.executionAllowed ===
    false &&
  laterArtifact.executionAllowed ===
    false;

const summaryConsistent =
  baseline.summary
    .categories ===
      baseline.categories.length &&
  baseline.summary
    .channels ===
      baseline.channels.length &&
  baseline.summary
    .roles ===
      baseline.roles.length &&
  baseline.summary
    .totalResources ===
      baseline.categories.length +
      baseline.channels.length +
      baseline.roles.length;

const success =
  validFormat &&
  categoryRenameDetected &&
  accessChangeDetected &&
  parentChangeDetected &&
  rolePriorityDetected &&
  arrayOrderDetected &&
  keyOrderIndependent &&
  generationTimeIndependent &&
  executionDisabled &&
  summaryConsistent;

console.log('');
console.log(
  '🧬 Discord Blueprint Content Fingerprint v1',
);
console.log('');

console.log(
  `Formato/versionado correcto: ${validFormat ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Renombre de categoría detectado: ${categoryRenameDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Cambio de access detectado: ${accessChangeDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Cambio de parentId detectado: ${parentChangeDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Cambio de prioridad de rol detectado: ${rolePriorityDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Orden de recursos alterado detectado: ${arrayOrderDetected ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Orden de claves JSON independiente: ${keyOrderIndependent ? 'SÍ' : 'NO'}`,
);

console.log(
  `Hora de generación independiente: ${generationTimeIndependent ? 'SÍ' : 'NO'}`,
);

console.log(
  `Resumen consistente: ${summaryConsistent ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Fingerprint base: ${baseline.fingerprint}`,
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
  process.exitCode = 2;
}
