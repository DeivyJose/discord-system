import {
  readFile,
  readdir,
} from 'node:fs/promises';

import path from 'node:path';

import {
  createPostCanaryCheckpoint,
  verifyPostCanaryCheckpoint,
} from './postCanaryCheckpoint.js';

async function readJson(
  filePath:
    string,
): Promise<unknown> {
  return JSON.parse(
    await readFile(
      filePath,
      'utf8',
    ),
  ) as unknown;
}

function clone<T>(
  value:
    T,
): T {
  return structuredClone(
    value,
  );
}

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const dataRoot =
  path.join(
    projectRoot,
    '.data',
  );

const report =
  await readJson(
    path.join(
      dataRoot,
      'real-canary-live',
      'latest.json',
    ),
  );

const reportRecord =
  report as
    Record<
      string,
      unknown
    >;

const sessionId =
  String(
    reportRecord.sessionId,
  );

const backups =
  (
    await readdir(
      dataRoot,
    )
  )
    .filter(
      file =>
        file.startsWith(
          'discord-bindings.before-role_notify_news-',
        ) &&
        file.endsWith(
          '.json',
        ),
    )
    .sort();

if (
  backups.length ===
    0
) {
  throw new Error(
    'No existe backup pre-binding.',
  );
}

const sources = {
  report,

  runClaim:
    await readJson(
      path.join(
        dataRoot,
        'real-canary-run-claims',
        `${sessionId}.json`,
      ),
    ),

  session:
    await readJson(
      path.join(
        dataRoot,
        'execution-sessions',
        'latest.json',
      ),
    ),

  postSnapshot:
    await readJson(
      path.join(
        dataRoot,
        'discord-snapshots',
        'latest.json',
      ),
    ),

  bindingsBefore:
    await readJson(
      path.join(
        dataRoot,
        (() => {
          const latestBackup =
            backups.at(
              -1,
            );

          if (
            !latestBackup
          ) {
            throw new Error(
              'No existe backup pre-binding.',
            );
          }

          return latestBackup;
        })(),
      ),
    ),

  bindingsAfter:
    await readJson(
      path.join(
        dataRoot,
        'discord-bindings.json',
      ),
    ),
};

const checkpoint =
  createPostCanaryCheckpoint(
    sources,
    '2026-11-27T06:30:00.000Z',
  );

const valid =
  verifyPostCanaryCheckpoint(
    checkpoint,
    sources,
  ).valid;

const tamperedCheckpoint =
  clone(
    checkpoint,
  );

tamperedCheckpoint.operation.actualId =
  'tampered-role-id';

const tamperedCheckpointBlocked =
  !verifyPostCanaryCheckpoint(
    tamperedCheckpoint,
    sources,
  ).valid;

const mutationSources =
  clone(
    sources,
  );

(
  mutationSources.report as
    Record<
      string,
      unknown
    >
).mutationCalls =
  0;

const mutationTamperBlocked =
  !verifyPostCanaryCheckpoint(
    checkpoint,
    mutationSources,
  ).valid;

const bindingSources =
  clone(
    sources,
  );

const after =
  bindingSources.bindingsAfter as
    Record<
      string,
      unknown
    >;

const resources =
  after.resources as
    Record<
      string,
      unknown
    >;

resources.role_notify_news =
  'wrong-id';

const bindingTamperBlocked =
  !verifyPostCanaryCheckpoint(
    checkpoint,
    bindingSources,
  ).valid;

const snapshotSources =
  clone(
    sources,
  );

const snapshot =
  snapshotSources.postSnapshot as
    Record<
      string,
      unknown
    >;

const roles =
  snapshot.roles as
    Array<
      Record<
        string,
        unknown
      >
    >;

const avisos =
  roles.find(
    role =>
      role.name ===
        'Avisos CDN',
  );

if (
  !avisos
) {
  throw new Error(
    'Avisos CDN no encontrado en fixture.',
  );
}

avisos.mentionable =
  false;

const snapshotTamperBlocked =
  !verifyPostCanaryCheckpoint(
    checkpoint,
    snapshotSources,
  ).valid;

const claimSources =
  clone(
    sources,
  );

(
  claimSources.runClaim as
    Record<
      string,
      unknown
    >
).executionAllowed =
  true;

const claimTamperBlocked =
  !verifyPostCanaryCheckpoint(
    checkpoint,
    claimSources,
  ).valid;

const success =
  valid &&
  tamperedCheckpointBlocked &&
  mutationTamperBlocked &&
  bindingTamperBlocked &&
  snapshotTamperBlocked &&
  claimTamperBlocked;

console.log('');
console.log(
  'Post-Canary Checkpoint v1 — adversarial tests',
);

console.log('');
console.log(
  `Checkpoint válido aceptado: ${valid ? 'SÍ' : 'NO'}`,
);

console.log(
  `Actual ID alterado bloqueado: ${tamperedCheckpointBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Mutation calls alteradas bloqueadas: ${mutationTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Binding alterado bloqueado: ${bindingTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Post-snapshot alterado bloqueado: ${snapshotTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Run claim alterado bloqueado: ${claimTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');
console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');
console.log(
  'CLIENT.LOGIN: NO',
);

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'MUTACIONES REALES: 0',
);

console.log(
  'CONTINUACIÓN AUTOMÁTICA: NO',
);

if (
  !success
) {
  process.exitCode =
    2;
}
