import {
  randomBytes,
} from 'node:crypto';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import type {
  ConfirmationManifest,
  ConfirmationManifestCheck,
} from './confirmationManifestTypes.js';

const MANIFEST_MAXIMUM_AGE_MINUTES =
  15;

function countStatus(
  checks: ConfirmationManifestCheck[],
  status: ConfirmationManifestCheck['status'],
): number {
  return checks.filter(
    (check) =>
      check.status === status,
  ).length;
}

export function createConfirmationManifest(
  gate: MigrationGate,
  now = new Date(),
): ConfirmationManifest {
  const checks:
    ConfirmationManifestCheck[] = [];

  const gateReady =
    gate.summary.block === 0 &&
    gate.summary.readyForExplicitConfirmation;

  checks.push({
    id: 'gate_ready',

    status:
      gateReady
        ? 'pass'
        : 'block',

    details:
      gateReady
        ? 'El Migration Gate está listo para confirmación explícita.'
        : 'El Migration Gate tiene bloqueos o no está listo para confirmación.',
  });

  const gateStillSafe =
    gate.executionAllowed === false;

  checks.push({
    id: 'gate_execution_disabled',

    status:
      gateStillSafe
        ? 'pass'
        : 'block',

    details:
      gateStillSafe
        ? 'El Gate continúa con executionAllowed=false.'
        : 'El Gate no conserva la protección executionAllowed=false.',
  });

  const snapshotCapturedAt =
    new Date(
      gate.snapshot.capturedAt,
    );

  const snapshotExpiresAt =
    snapshotCapturedAt.getTime() +
    gate.snapshot.maximumAgeMinutes *
      60_000;

  const snapshotStillFresh =
    Number.isFinite(
      snapshotCapturedAt.getTime(),
    ) &&
    now.getTime() <
      snapshotExpiresAt;

  checks.push({
    id: 'snapshot_still_fresh',

    status:
      snapshotStillFresh
        ? 'pass'
        : 'block',

    details:
      snapshotStillFresh
        ? 'El snapshot sigue dentro de su ventana máxima de antigüedad.'
        : 'El snapshot ya expiró. Debe regenerarse toda la cadena.',
  });

  const requestedExpiration =
    now.getTime() +
    MANIFEST_MAXIMUM_AGE_MINUTES *
      60_000;

  const effectiveExpiration =
    Math.min(
      requestedExpiration,
      snapshotExpiresAt,
    );

  const pass =
    countStatus(
      checks,
      'pass',
    );

  const block =
    countStatus(
      checks,
      'block',
    );

  const readyForUserApproval =
    block === 0;

  const shortFingerprint =
    gate.fingerprint.slice(
      0,
      12,
    );

  const confirmationId =
    readyForUserApproval
      ? randomBytes(8)
          .toString('hex')
      : null;

  const requiredPhrase =
    confirmationId
      ? [
          'CONFIRM THE CLOCK',
          shortFingerprint,
          confirmationId,
        ].join(' ')
      : null;

  return {
    schemaVersion: 1,

    createdAt:
      now.toISOString(),

    expiresAt:
      new Date(
        effectiveExpiration,
      ).toISOString(),

    status:
      readyForUserApproval
        ? 'pending'
        : 'invalid',

    guild: {
      id: gate.guild.id,
      name: gate.guild.name,
    },

    gateFingerprint:
      gate.fingerprint,

    shortFingerprint,

    snapshotCapturedAt:
      gate.snapshot.capturedAt,

    confirmationId,

    requiredPhrase,

    checks,

    summary: {
      pass,

      block,

      readyForUserApproval,
    },

    executionAllowed: false,
  };
}
