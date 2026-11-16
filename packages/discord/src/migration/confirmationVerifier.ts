import {
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import type {
  MigrationGate,
} from './migrationGateTypes.js';

import type {
  ConfirmationManifest,
} from './confirmationManifestTypes.js';

import type {
  ApprovalReceipt,
  ConfirmationApprovalEvidence,
  ConfirmationVerificationCheck,
} from './approvalReceiptTypes.js';

function safeEqual(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(
      left,
      'utf8',
    );

  const rightBuffer =
    Buffer.from(
      right,
      'utf8',
    );

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer,
  );
}

function countStatus(
  checks: ConfirmationVerificationCheck[],
  status: ConfirmationVerificationCheck['status'],
): number {
  return checks.filter(
    (check) =>
      check.status === status,
  ).length;
}

export function verifyConfirmationManifest(
  manifest: ConfirmationManifest,
  gate: MigrationGate,
  providedPhrase: string,
  approvalEvidence:
    ConfirmationApprovalEvidence,
  now = new Date(),
): ApprovalReceipt {
  const checks:
    ConfirmationVerificationCheck[] = [];

  const sameGuild =
    manifest.guild.id ===
      gate.guild.id;

  checks.push({
    id: 'guild_identity',

    status:
      sameGuild
        ? 'pass'
        : 'block',

    details:
      sameGuild
        ? `Guild ID confirmado: ${gate.guild.id}.`
        : `Manifest=${manifest.guild.id}; Gate=${gate.guild.id}.`,
  });

  const fingerprintMatches =
    manifest.gateFingerprint ===
      gate.fingerprint;

  checks.push({
    id: 'gate_fingerprint',

    status:
      fingerprintMatches
        ? 'pass'
        : 'block',

    details:
      fingerprintMatches
        ? 'El Manifest pertenece exactamente al Migration Gate actual.'
        : 'El fingerprint del Manifest no coincide con el Gate actual.',
  });

  const expectedShortFingerprint =
    gate.fingerprint.slice(
      0,
      12,
    );

  const shortFingerprintMatches =
    manifest.shortFingerprint ===
      expectedShortFingerprint;

  checks.push({
    id: 'short_fingerprint',

    status:
      shortFingerprintMatches
        ? 'pass'
        : 'block',

    details:
      shortFingerprintMatches
        ? `Fingerprint corto confirmado: ${expectedShortFingerprint}.`
        : 'El fingerprint corto del Manifest no coincide con el Gate.',
  });

  const manifestPending =
    manifest.status ===
      'pending';

  checks.push({
    id: 'manifest_pending',

    status:
      manifestPending
        ? 'pass'
        : 'block',

    details:
      manifestPending
        ? 'El Manifest continúa pendiente de aprobación.'
        : `Estado inesperado del Manifest: ${manifest.status}.`,
  });

  checks.push({
    id: 'execution_disabled',

    status:
      manifest.executionAllowed ===
        false &&
      gate.executionAllowed ===
        false
        ? 'pass'
        : 'block',

    details:
      'Manifest y Gate deben conservar executionAllowed=false.',
  });

  const interactiveMethod =
    approvalEvidence.method ===
      'interactive_tty';

  checks.push({
    id:
      'approval_method',

    status:
      interactiveMethod
        ? 'pass'
        : 'block',

    details:
      interactiveMethod
        ? 'La aprobación usa el método interactive_tty.'
        : 'La aprobación no proviene del método interactivo autorizado.',
  });

  const interactiveTerminal =
    approvalEvidence.inputIsTTY &&
    approvalEvidence.outputIsTTY;

  checks.push({
    id:
      'interactive_terminal',

    status:
      interactiveTerminal
        ? 'pass'
        : 'block',

    details:
      interactiveTerminal
        ? 'Entrada y salida pertenecen a una terminal interactiva.'
        : 'stdin/stdout redirigidos o no interactivos están bloqueados.',
  });

  checks.push({
    id:
      'confirmation_unused',

    status:
      approvalEvidence
        .confirmationUnused
        ? 'pass'
        : 'block',

    details:
      approvalEvidence
        .confirmationUnused
        ? 'El confirmationId todavía no había sido consumido.'
        : 'El confirmationId ya fue utilizado anteriormente.',
  });

  const confirmationIdentityPresent =
    Boolean(
      manifest.confirmationId &&
      manifest.requiredPhrase,
    );

  checks.push({
    id: 'confirmation_identity',

    status:
      confirmationIdentityPresent
        ? 'pass'
        : 'block',

    details:
      confirmationIdentityPresent
        ? `Confirmation ID presente: ${manifest.confirmationId}.`
        : 'Falta confirmationId o requiredPhrase.',
  });

  const expectedPhrase =
    manifest.confirmationId
      ? [
          'CONFIRM THE CLOCK',
          expectedShortFingerprint,
          manifest.confirmationId,
        ].join(' ')
      : '';

  const manifestPhraseValid =
    manifest.requiredPhrase !==
      null &&
    safeEqual(
      manifest.requiredPhrase,
      expectedPhrase,
    );

  checks.push({
    id: 'manifest_phrase_integrity',

    status:
      manifestPhraseValid
        ? 'pass'
        : 'block',

    details:
      manifestPhraseValid
        ? 'La frase almacenada corresponde al fingerprint y confirmationId actuales.'
        : 'La frase almacenada en el Manifest no es íntegra.',
  });

  const userPhraseMatches =
    manifest.requiredPhrase !==
      null &&
    safeEqual(
      providedPhrase,
      manifest.requiredPhrase,
    );

  checks.push({
    id: 'user_phrase',

    status:
      userPhraseMatches
        ? 'pass'
        : 'block',

    details:
      userPhraseMatches
        ? 'La frase introducida coincide exactamente.'
        : 'La frase introducida no coincide exactamente.',
  });

  const createdAt =
    new Date(
      manifest.createdAt,
    );

  const expiresAt =
    new Date(
      manifest.expiresAt,
    );

  const manifestDatesValid =
    Number.isFinite(
      createdAt.getTime(),
    ) &&
    Number.isFinite(
      expiresAt.getTime(),
    );

  checks.push({
    id: 'manifest_dates',

    status:
      manifestDatesValid
        ? 'pass'
        : 'block',

    details:
      manifestDatesValid
        ? 'createdAt y expiresAt contienen fechas válidas.'
        : 'El Manifest contiene fechas inválidas.',
  });

  const manifestNotExpired =
    manifestDatesValid &&
    now.getTime() <
      expiresAt.getTime();

  checks.push({
    id: 'manifest_expiration',

    status:
      manifestNotExpired
        ? 'pass'
        : 'block',

    details:
      manifestNotExpired
        ? `Manifest válido hasta ${manifest.expiresAt}.`
        : `Manifest expirado desde ${manifest.expiresAt}.`,
  });

  const gateCreatedAt =
    new Date(
      gate.generatedAt,
    );

  const manifestAfterGate =
    Number.isFinite(
      gateCreatedAt.getTime(),
    ) &&
    manifestDatesValid &&
    createdAt.getTime() >=
      gateCreatedAt.getTime();

  checks.push({
    id: 'manifest_gate_lineage',

    status:
      manifestAfterGate
        ? 'pass'
        : 'block',

    details:
      manifestAfterGate
        ? 'El Manifest fue creado después del Migration Gate.'
        : 'El Manifest no pertenece a un linaje temporal válido del Gate.',
  });

  const gateReady =
    gate.summary.block === 0 &&
    gate.summary
      .readyForExplicitConfirmation;

  checks.push({
    id: 'gate_ready',

    status:
      gateReady
        ? 'pass'
        : 'block',

    details:
      gateReady
        ? 'El Gate actual sigue listo para confirmación.'
        : 'El Gate actual ya no está listo para confirmación.',
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
    id: 'snapshot_freshness',

    status:
      snapshotStillFresh
        ? 'pass'
        : 'block',

    details:
      snapshotStillFresh
        ? 'El snapshot del Gate continúa dentro de su ventana de frescura.'
        : 'El snapshot del Gate ya expiró.',
  });

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

  const approvalValid =
    block === 0;

  return {
    schemaVersion: 2,

    receiptId:
      randomBytes(12)
        .toString('hex'),

    verifiedAt:
      now.toISOString(),

    status:
      approvalValid
        ? 'approved'
        : 'rejected',

    guild: {
      id: gate.guild.id,
      name: gate.guild.name,
    },

    gateFingerprint:
      gate.fingerprint,

    approvalBoundary: {
      method:
        approvalEvidence.method,

      inputIsTTY:
        approvalEvidence
          .inputIsTTY,

      outputIsTTY:
        approvalEvidence
          .outputIsTTY,

      confirmationUnused:
        approvalEvidence
          .confirmationUnused,
    },

    manifest: {
      createdAt:
        manifest.createdAt,

      expiresAt:
        manifest.expiresAt,

      confirmationId:
        manifest.confirmationId,
    },

    checks,

    summary: {
      pass,

      block,

      approvalValid,
    },

    executionAllowed: false,
  };
}
