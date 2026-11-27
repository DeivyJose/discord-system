import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';

import path from 'node:path';

import {
  tmpdir,
} from 'node:os';

import {
  claimRealCanaryRunAttempt,
} from './realCanaryRunClaim.js';

const directory =
  await mkdtemp(
    path.join(
      tmpdir(),
      'the-clock-real-canary-claim-',
    ),
  );

try {
  const claim = {
    schemaVersion:
      1 as const,

    sessionId:
      'test-session-one-shot',

    guildId:
      '1494545796492824656',

    gateFingerprint:
      'gate-fingerprint-test',

    gateEnvelopeFingerprint:
      'gate-envelope-test',

    claimedAt:
      '2026-11-27T05:00:00.000Z',

    executionAllowed:
      false as const,
  };

  const claimPath =
    await claimRealCanaryRunAttempt(
      directory,
      claim,
    );

  const persisted =
    JSON.parse(
      await readFile(
        claimPath,
        'utf8',
      ),
    ) as typeof claim;

  const firstClaimValid =
    persisted.sessionId ===
      claim.sessionId &&
    persisted.executionAllowed ===
      false;

  let replayBlocked =
    false;

  try {
    await claimRealCanaryRunAttempt(
      directory,
      {
        ...claim,

        claimedAt:
          '2026-11-27T05:01:00.000Z',
      },
    );
  } catch (
    error
  ) {
    replayBlocked =
      error instanceof Error &&
      error.message ===
        'REAL_CANARY_RUN_ALREADY_CLAIMED';
  }

  const success =
    firstClaimValid &&
    replayBlocked;

  console.log('');
  console.log(
    'Real Canary Durable Run Claim v1',
  );

  console.log('');
  console.log(
    `Primer claim persistido: ${firstClaimValid ? 'SÍ' : 'NO'}`,
  );

  console.log(
    `Replay misma Session bloqueado: ${replayBlocked ? 'SÍ' : 'NO'}`,
  );

  console.log('');
  console.log(
    `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
  );

  console.log('');
  console.log(
    'DISCORD: NO',
  );

  console.log(
    'MUTACIONES REALES: 0',
  );

  console.log(
    'CLAIM AUTOMÁTICAMENTE REVERSIBLE: NO',
  );

  if (
    !success
  ) {
    process.exitCode =
      2;
  }
} finally {
  await rm(
    directory,
    {
      recursive:
        true,

      force:
        true,
    },
  );
}
