import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  ExecutionSessionPhaseId,
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

import {
  createPhaseDryRunPlan,
} from './phaseDryRunPlanner.js';

import {
  renderPhaseDryRunPlan,
} from './phaseDryRunReport.js';

const ALLOWED_PHASES:
  readonly ExecutionSessionPhaseId[] = [
    'roles',
    'categories',
    'renames',
    'channels',
    'moves',
    'manual_review',
  ];

const requestedPhase =
  process.argv[2];

if (
  !requestedPhase ||
  !ALLOWED_PHASES.includes(
    requestedPhase as
      ExecutionSessionPhaseId,
  )
) {
  console.error('');
  console.error(
    '❌ Debes indicar una fase válida.',
  );
  console.error('');
  console.error(
    `Fases: ${ALLOWED_PHASES.join(', ')}`,
  );
  console.error('');
  console.error(
    'Ejemplo: npm run dry-run:discord-phase -- roles',
  );
  console.error('');

  process.exit(1);
}

const phase =
  requestedPhase as
    ExecutionSessionPhaseId;

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const sessionPath =
  path.join(
    projectRoot,
    '.data',
    'execution-sessions',
    'latest.json',
  );

const session =
  JSON.parse(
    await readFile(
      sessionPath,
      'utf8',
    ),
  ) as ExecutionSessionPlan;

console.log('');
console.log(
  `🧪 Dry-run de fase: ${phase}`,
);

const plan =
  createPhaseDryRunPlan(
    session,
    phase,
  );

const report =
  renderPhaseDryRunPlan(
    plan,
  );

const outputDirectory =
  path.join(
    projectRoot,
    '.data',
    'phase-dry-runs',
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
    `${phase}-latest.json`,
  );

const textPath =
  path.join(
    outputDirectory,
    `${phase}-latest.txt`,
  );

await writeFile(
  jsonPath,
  JSON.stringify(
    plan,
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
  '✅ Phase Dry-Run generado.',
);

console.log('');
console.log(
  `Estado: ${plan.status}`,
);

console.log(
  `Fase: ${plan.phase.id}`,
);

console.log(
  `Fingerprint: ${plan.phase.fingerprint}`,
);

console.log('');

console.log(
  `Total:   ${plan.summary.total}`,
);

console.log(
  `Ready:   ${plan.summary.ready}`,
);

console.log(
  `Manual:  ${plan.summary.manual}`,
);

console.log(
  `Blocked: ${plan.summary.blocked}`,
);

console.log('');

console.log(
  `Checks PASS:  ${plan.summary.passChecks}`,
);

console.log(
  `Checks WARN:  ${plan.summary.warnChecks}`,
);

console.log(
  `Checks BLOCK: ${plan.summary.blockChecks}`,
);

console.log('');

console.log(
  `Listo para implementar executor real: ${
    plan.summary
      .readyForRealExecutorImplementation
      ? 'SÍ'
      : 'NO'
  }`,
);

console.log('');

console.log(
  'DRY RUN ONLY: SÍ',
);

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
  !plan.summary
    .readyForRealExecutorImplementation
) {
  process.exitCode = 2;
}
