import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  writeFile,
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

const reportPath =
  path.join(
    dataRoot,
    'real-canary-live',
    'latest.json',
  );

const sessionPath =
  path.join(
    dataRoot,
    'execution-sessions',
    'latest.json',
  );

const snapshotPath =
  path.join(
    dataRoot,
    'discord-snapshots',
    'latest.json',
  );

const bindingsAfterPath =
  path.join(
    dataRoot,
    'discord-bindings.json',
  );

const report =
  await readJson(
    reportPath,
  );

if (
  typeof report !==
    'object' ||
  report ===
    null ||
  Array.isArray(
    report,
  ) ||
  typeof (
    report as
      Record<
        string,
        unknown
      >
  ).sessionId !==
    'string'
) {
  throw new Error(
    'POST_CANARY_REPORT_SESSION_ID_INVALID',
  );
}

const sessionId =
  (
    report as
      Record<
        string,
        unknown
      >
  ).sessionId as string;

const claimPath =
  path.join(
    dataRoot,
    'real-canary-run-claims',
    `${sessionId}.json`,
  );

const allDataFiles =
  await readdir(
    dataRoot,
  );

const backupCandidates =
  allDataFiles
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
  backupCandidates.length ===
    0
) {
  throw new Error(
    'POST_CANARY_BINDINGS_BEFORE_BACKUP_NOT_FOUND',
  );
}

const latestBackupCandidate =
  backupCandidates.at(
    -1,
  );

if (
  !latestBackupCandidate
) {
  throw new Error(
    'POST_CANARY_BINDINGS_BEFORE_BACKUP_NOT_FOUND',
  );
}

const bindingsBeforePath =
  path.join(
    dataRoot,
    latestBackupCandidate,
  );

const sources = {
  report,

  runClaim:
    await readJson(
      claimPath,
    ),

  session:
    await readJson(
      sessionPath,
    ),

  postSnapshot:
    await readJson(
      snapshotPath,
    ),

  bindingsBefore:
    await readJson(
      bindingsBeforePath,
    ),

  bindingsAfter:
    await readJson(
      bindingsAfterPath,
    ),
};

const checkpoint =
  createPostCanaryCheckpoint(
    sources,
  );

const verification =
  verifyPostCanaryCheckpoint(
    checkpoint,
    sources,
  );

if (
  !verification.valid
) {
  console.error(
    verification,
  );

  throw new Error(
    'POST_CANARY_CHECKPOINT_VERIFICATION_BLOCKED',
  );
}

const outputDirectory =
  path.join(
    dataRoot,
    'post-canary-checkpoints',
  );

await mkdir(
  outputDirectory,
  {
    recursive:
      true,
  },
);

const checkpointPath =
  path.join(
    outputDirectory,
    `checkpoint-${checkpoint.sessionId}.json`,
  );

let handle;

try {
  handle =
    await open(
      checkpointPath,
      'wx',
    );

  await handle.writeFile(
    JSON.stringify(
      checkpoint,
      null,
      2,
    ) + '\n',
    'utf8',
  );

  await handle.sync();
} catch (
  error
) {
  const code =
    (
      error as
        NodeJS.ErrnoException
    ).code;

  if (
    code ===
      'EEXIST'
  ) {
    throw new Error(
      'POST_CANARY_CHECKPOINT_ALREADY_EXISTS',
    );
  }

  throw error;
} finally {
  await handle?.close();
}

const persisted =
  await readJson(
    checkpointPath,
  );

const persistedVerification =
  verifyPostCanaryCheckpoint(
    persisted as
      typeof checkpoint,
    sources,
  );

if (
  !persistedVerification.valid
) {
  throw new Error(
    'POST_CANARY_CHECKPOINT_READBACK_FAILED',
  );
}

const latestPath =
  path.join(
    outputDirectory,
    'latest.json',
  );

const latestTempPath =
  `${latestPath}.tmp-${process.pid}`;

await writeFile(
  latestTempPath,
  JSON.stringify(
    checkpoint,
    null,
    2,
  ) + '\n',
  'utf8',
);

await rename(
  latestTempPath,
  latestPath,
);

console.log('');
console.log(
  'Post-Canary Checkpoint v1',
);

console.log('');
console.log(
  `Guild: ${checkpoint.guildId}`,
);

console.log(
  `Session: ${checkpoint.sessionId}`,
);

console.log(
  `Operation: ${checkpoint.operation.operationId}`,
);

console.log(
  `Blueprint: ${checkpoint.operation.blueprintId}`,
);

console.log(
  `Actual ID: ${checkpoint.operation.actualId}`,
);

console.log(
  `Post snapshot: ${checkpoint.postSnapshot.capturedAt}`,
);

console.log(
  `Bindings: ${checkpoint.bindingTransition.beforeCount} -> ${checkpoint.bindingTransition.afterCount}`,
);

console.log(
  `Mutation calls: ${checkpoint.execution.mutationCalls}`,
);

console.log(
  `Fingerprint: ${checkpoint.checkpointFingerprint}`,
);

console.log('');
console.log(
  `Checkpoint válido: ${verification.valid ? 'SÍ' : 'NO'}`,
);

console.log(
  'CONTINUACIÓN AUTOMÁTICA: NO',
);

console.log(
  'EJECUCIÓN PERMITIDA: NO',
);

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'MUTACIONES DISCORD: 0',
);

console.log('');
console.log(
  `JSON: ${checkpointPath}`,
);

console.log(
  `Latest: ${latestPath}`,
);
