import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  DiscordExecutionPreview,
} from './executionTypes.js';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import type {
  ApprovalReceipt,
} from './approvalReceiptTypes.js';

import {
  createExecutionSessionPlan,
} from './executionSessionPlanner.js';

import {
  renderExecutionSessionPlan,
} from './executionSessionReport.js';

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

console.log('');
console.log(
  '🧱 Generando Execution Session Plan...',
);

const operations =
  await readJson<MigrationOperationsPlan>(
    '.data',
    'migration-operations',
    'latest.json',
  );

const preview =
  await readJson<DiscordExecutionPreview>(
    '.data',
    'execution-preview',
    'latest.json',
  );

const gate =
  await readJson<MigrationGate>(
    '.data',
    'migration-gate',
    'latest.json',
  );

const receipt =
  await readJson<ApprovalReceipt>(
    '.data',
    'approval-receipts',
    'latest.json',
  );

const session =
  createExecutionSessionPlan({
    operations,
    preview,
    gate,
    receipt,
  });

const report =
  renderExecutionSessionPlan(
    session,
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'execution-sessions',
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
    session,
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
  '✅ Execution Session Plan generado.',
);

console.log('');
console.log(
  `Estado: ${session.status}`,
);

console.log(
  `Operaciones: ${session.summary.operations}`,
);

console.log(
  `Fases:       ${session.summary.phases}`,
);

console.log(
  `Ready:       ${session.summary.ready}`,
);

console.log(
  `Manual:      ${session.summary.manual}`,
);

console.log(
  `Blocked:     ${session.summary.blocked}`,
);

console.log('');

console.log(
  `Checks PASS:  ${session.summary.passChecks}`,
);

console.log(
  `Checks WARN:  ${session.summary.warnChecks}`,
);

console.log(
  `Checks BLOCK: ${session.summary.blockChecks}`,
);

console.log('');

console.log(
  `Listo para diseñar executor: ${
    session.summary.readyForExecutorDesign
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

console.log(
  `JSON:    ${jsonPath}`,
);

console.log('');

if (
  !session.summary
    .readyForExecutorDesign
) {
  process.exitCode = 2;
}
