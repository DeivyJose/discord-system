import {
  randomBytes,
} from 'node:crypto';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import {
  createMigrationGateEnvelopeFingerprint,
  extractMigrationGateEnvelopeFingerprintInput,
} from './migrationGate.js';

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

  const recalculatedGateEnvelopeFingerprint =
    createMigrationGateEnvelopeFingerprint(
      extractMigrationGateEnvelopeFingerprintInput(
        gate,
      ),
    );

  const gateEnvelopeValid =
    gate.schemaVersion ===
      5 &&
    gate.fingerprintVersion ===
      4 &&
    gate.envelopeFingerprintVersion ===
      1 &&
    /^[a-f0-9]{64}$/i.test(
      gate.envelopeFingerprint,
    ) &&
    recalculatedGateEnvelopeFingerprint ===
      gate.envelopeFingerprint;

  checks.push({
    id:
      'gate_envelope_integrity',

    status:
      gateEnvelopeValid
        ? 'pass'
        : 'block',

    details:
      gateEnvelopeValid
        ? 'El envelope del Migration Gate es íntegro.'
        : [
            'El envelope del Migration Gate NO es íntegro.',
            `Esperado=${gate.envelopeFingerprint}.`,
            `Recalculado=${recalculatedGateEnvelopeFingerprint}.`,
          ].join(' '),
  });

  const gateProvenance =
    (
      gate as unknown as {
        provenance?:
          typeof gate.provenance;
      }
    ).provenance;

  const gateProvenanceValid =
    gateProvenance !==
      undefined &&
    gateProvenance.schemaVersion ===
      1 &&
    gateProvenance.fingerprintVersion ===
      1 &&
    gateProvenance.guildId ===
      gate.guild.id &&
    gateProvenance.summary.valid ===
      true &&
    gateProvenance.summary.block ===
      0 &&
    gateProvenance.executionAllowed ===
      false &&
    /^[a-f0-9]{64}$/i.test(
      gateProvenance.lineageFingerprint,
    );

  checks.push({
    id:
      'gate_provenance',

    status:
      gateProvenanceValid
        ? 'pass'
        : 'block',

    details:
      gateProvenanceValid
        ? `Migration Provenance confirmado: ${gate.provenance.lineageFingerprint}.`
        : 'El Migration Provenance del Gate no es válido.',
  });

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

  const shortEnvelopeFingerprint =
    gate.envelopeFingerprint
      .slice(
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
          shortEnvelopeFingerprint,
          confirmationId,
        ].join(' ')
      : null;

  return {
    schemaVersion: 3,

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

    gateEnvelopeFingerprint:
      gate.envelopeFingerprint,


    provenanceFingerprint:
      gateProvenance
        ?.lineageFingerprint ??
      '',

    shortFingerprint,

    shortEnvelopeFingerprint,

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
