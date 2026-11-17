import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
  verifyLiveDrift,
} from './liveDrift.js';

import type {
  LiveDriftContext,
  NormalizedDiscordStructureSnapshot,
} from './liveDriftTypes.js';

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

async function readJson<T>(
  ...segments: string[]
): Promise<T> {
  return JSON.parse(
    await readFile(
      path.join(
        projectRoot,
        ...segments,
      ),
      'utf8',
    ),
  ) as T;
}

function rebuildFingerprint(
  snapshot:
    NormalizedDiscordStructureSnapshot,
): NormalizedDiscordStructureSnapshot {
  /*
   * Para los snapshots manipulados de prueba
   * pasamos de nuevo por una representación raw
   * mínima compatible con el normalizador.
   */
  const categories =
    snapshot.resources
      .filter(
        (resource) =>
          resource.kind ===
          'category',
      )
      .map(
        (resource) => ({
          id:
            resource.id,

          name:
            resource.name,

          position:
            resource.position,
        }),
      );

  const channels =
    snapshot.resources
      .filter(
        (resource) =>
          resource.kind ===
          'channel',
      )
      .map(
        (resource) => ({
          id:
            resource.id,

          name:
            resource.name,

          parentId:
            resource.parentId,

          position:
            resource.position,
        }),
      );

  const roles =
    snapshot.resources
      .filter(
        (resource) =>
          resource.kind ===
          'role',
      )
      .map(
        (resource) => ({
          id:
            resource.id,

          name:
            resource.name,

          managed:
            resource.managed,

          position:
            resource.position,
        }),
      );

  return normalizeDiscordStructureSnapshot({
    capturedAt:
      snapshot.capturedAt,

    guild: {
      id:
        snapshot.guildId,
    },

    categories,

    channels,

    roles,
  });
}

const rawSnapshot =
  await readJson<unknown>(
    '.data',
    'discord-snapshots',
    'latest.json',
  );

const session =
  await readJson<
    ExecutionSessionPlan
  >(
    '.data',
    'execution-sessions',
    'latest.json',
  );

const normalized =
  normalizeDiscordStructureSnapshot(
    rawSnapshot,
  );

const context:
  LiveDriftContext = {
    sessionId:
      session.sessionId,

    gateFingerprint:
      session.gateFingerprint,

    gateEnvelopeFingerprint:
      session.gateEnvelopeFingerprint,
  };

const baseline =
  createLiveDriftBaseline(
    normalized,
    context,
  );

/*
 * TEST 1:
 * estado idéntico.
 */
const identicalVerification =
  verifyLiveDrift(
    baseline,
    structuredClone(
      normalized,
    ),
    context,
  );

const identicalPasses =
  identicalVerification.status ===
    'valid' &&
  identicalVerification
    .summary
    .driftDetected ===
    false;

/*
 * TEST:
 * mismo Session ID y Content Fingerprint,
 * pero otro Gate Envelope.
 */
const wrongEnvelopeContext:
  LiveDriftContext = {
    ...context,

    gateEnvelopeFingerprint:
      `${context.gateEnvelopeFingerprint}-incorrecto`,
  };

const wrongEnvelopeVerification =
  verifyLiveDrift(
    baseline,
    structuredClone(
      normalized,
    ),
    wrongEnvelopeContext,
  );

const wrongEnvelopeBlocked =
  wrongEnvelopeVerification.status ===
    'blocked' &&
  wrongEnvelopeVerification.checks.some(
    (check) =>
      check.id ===
        'gate_envelope_fingerprint' &&
      check.status ===
        'block',
  );

/*
 * TEST 2:
 * renombrar un recurso.
 */
const renamed =
  structuredClone(
    normalized,
  );

const renamedTarget =
  renamed.resources.find(
    (resource) =>
      resource.kind ===
        'channel',
  ) ??
  renamed.resources[0];

if (
  !renamedTarget
) {
  throw new Error(
    'No existe recurso para la prueba de rename.',
  );
}

renamedTarget.name =
  `${renamedTarget.name}-ALTERADO`;

const renamedNormalized =
  rebuildFingerprint(
    renamed,
  );

const renamedVerification =
  verifyLiveDrift(
    baseline,
    renamedNormalized,
    context,
  );

const renameBlocked =
  renamedVerification.status ===
    'blocked' &&
  renamedVerification
    .summary
    .changed >=
    1;

/*
 * TEST 3:
 * añadir canal inesperado.
 */
const added =
  structuredClone(
    normalized,
  );

added.resources.push({
  id:
    '999999999999999999',

  kind:
    'channel',

  name:
    'canal-inesperado',

  parentId:
    null,

  position:
    999,

  managed:
    null,

  structureFingerprint:
    '0'.repeat(
      64,
    ),
});

const addedNormalized =
  rebuildFingerprint(
    added,
  );

const addedVerification =
  verifyLiveDrift(
    baseline,
    addedNormalized,
    context,
  );

const additionBlocked =
  addedVerification.status ===
    'blocked' &&
  addedVerification
    .summary
    .added ===
    1;

/*
 * TEST 4:
 * eliminar recurso.
 */
const removed =
  structuredClone(
    normalized,
  );

removed.resources =
  removed.resources.slice(
    1,
  );

const removedNormalized =
  rebuildFingerprint(
    removed,
  );

const removedVerification =
  verifyLiveDrift(
    baseline,
    removedNormalized,
    context,
  );

const removalBlocked =
  removedVerification.status ===
    'blocked' &&
  removedVerification
    .summary
    .removed ===
    1;

const success =
  identicalPasses &&
  wrongEnvelopeBlocked &&
  renameBlocked &&
  additionBlocked &&
  removalBlocked;

const result = {
  schemaVersion: 1,

  generatedAt:
    new Date().toISOString(),

  baseline,

  tests: {
    identical: {
      success:
        identicalPasses,

      verification:
        identicalVerification,
    },

    wrongEnvelope: {
      success:
        wrongEnvelopeBlocked,

      verification:
        wrongEnvelopeVerification,
    },

    renamed: {
      success:
        renameBlocked,

      verification:
        renamedVerification,
    },

    added: {
      success:
        additionBlocked,

      verification:
        addedVerification,
    },

    removed: {
      success:
        removalBlocked,

      verification:
        removedVerification,
    },
  },

  success,

  connectionToDiscord:
    false,

  executionAllowed:
    false,
};

const report = [
  'THE CLOCK — LIVE DRIFT GUARD TEST',
  '=================================',
  '',
  `Guild: ${normalized.guildId}`,
  `Recursos estructurales: ${normalized.resources.length}`,
  `Fingerprint baseline: ${normalized.structureFingerprint}`,
  '',
  'PRUEBAS',
  '-------',
  `Snapshot idéntico aceptado: ${identicalPasses ? 'SÍ' : 'NO'}`,
  `Otro Gate Envelope bloqueado: ${wrongEnvelopeBlocked ? 'SÍ' : 'NO'}`,
  `Rename inesperado bloqueado: ${renameBlocked ? 'SÍ' : 'NO'}`,
  `Recurso añadido bloqueado: ${additionBlocked ? 'SÍ' : 'NO'}`,
  `Recurso eliminado bloqueado: ${removalBlocked ? 'SÍ' : 'NO'}`,
  '',
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
  '',
  'MODO: SOLO LECTURA / SIMULACIÓN',
  'CONEXIÓN MUTATIVA A DISCORD: NO',
  'EJECUCIÓN REAL PERMITIDA: NO',
  '',
].join(
  '\n',
);

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'live-drift-test',
  );

await mkdir(
  outputDirectory,
  {
    recursive: true,
  },
);

await writeFile(
  path.join(
    outputDirectory,
    'latest.json',
  ),
  JSON.stringify(
    result,
    null,
    2,
  ) + '\n',
  'utf8',
);

await writeFile(
  path.join(
    outputDirectory,
    'latest.txt',
  ),
  report,
  'utf8',
);

console.log('');
console.log(
  '🛡️ Live Drift Guard',
);
console.log('');
console.log(
  `Snapshot idéntico aceptado: ${identicalPasses ? 'SÍ' : 'NO'}`,
);
console.log(
  `Otro Gate Envelope bloqueado: ${wrongEnvelopeBlocked ? 'SÍ' : 'NO'}`,
);
console.log(
  `Rename inesperado bloqueado: ${renameBlocked ? 'SÍ' : 'NO'}`,
);
console.log(
  `Recurso añadido bloqueado: ${additionBlocked ? 'SÍ' : 'NO'}`,
);
console.log(
  `Recurso eliminado bloqueado: ${removalBlocked ? 'SÍ' : 'NO'}`,
);
console.log('');
console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);
console.log('');
console.log(
  'CONEXIÓN MUTATIVA A DISCORD: NO',
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
