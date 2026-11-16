import type {
  ConfirmationManifest,
} from './confirmationManifestTypes.js';

export function renderConfirmationManifest(
  manifest: ConfirmationManifest,
): string {
  const output: string[] = [
    'THE CLOCK — CONFIRMATION MANIFEST',
    '=================================',
    '',
    `Servidor: ${manifest.guild.name}`,
    `Guild ID: ${manifest.guild.id}`,
    '',
    `Creado: ${manifest.createdAt}`,
    `Expira: ${manifest.expiresAt}`,
    `Estado: ${manifest.status}`,
    '',
    'MIGRATION GATE',
    '--------------',
    `Fingerprint: ${manifest.gateFingerprint}`,
    `Fingerprint corto: ${manifest.shortFingerprint}`,
    `Snapshot: ${manifest.snapshotCapturedAt}`,
    '',
    'COMPROBACIONES',
    '--------------',
  ];

  for (
    const check
    of manifest.checks
  ) {
    output.push(
      `[${check.status.toUpperCase()}] ${check.id}`,
    );

    output.push(
      `  ${check.details}`,
    );
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `PASS: ${manifest.summary.pass}`,
    `BLOCK: ${manifest.summary.block}`,
    '',
    `Listo para aprobación del usuario: ${
      manifest.summary.readyForUserApproval
        ? 'SÍ'
        : 'NO'
    }`,
  );

  if (
    manifest.requiredPhrase
  ) {
    output.push(
      '',
      'DESAFÍO DE CONFIRMACIÓN',
      '-----------------------',
      manifest.requiredPhrase,
      '',
      'Esta frase NO ha sido aprobada todavía.',
      'Solo identifica esta versión exacta y temporal del plan.',
      'La verificación exige una terminal interactiva; stdin redirigido está bloqueado.',
      'El confirmationId solo puede consumirse una vez localmente.',
    );
  }

  output.push(
    '',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'Este manifest no modifica Discord.',
    'Tampoco constituye autorización de ejecución.',
    '',
  );

  return output.join('\n');
}
