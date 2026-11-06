import type {
  MigrationGate,
} from './migrationGateTypes.js';

export function renderMigrationGate(
  gate: MigrationGate,
): string {
  const output: string[] = [
    'THE CLOCK — MIGRATION GATE',
    '==========================',
    '',
    `Servidor: ${gate.guild.name}`,
    `Guild ID: ${gate.guild.id}`,
    `Generado: ${gate.generatedAt}`,
    '',
    'FINGERPRINT',
    '-----------',
    gate.fingerprint,
    '',
    'SNAPSHOT',
    '--------',
    `Capturado: ${gate.snapshot.capturedAt}`,
    `Edad: ${gate.snapshot.ageMinutes} minutos`,
    `Máximo permitido: ${gate.snapshot.maximumAgeMinutes} minutos`,
    '',
    'COMPROBACIONES',
    '--------------',
  ];

  for (
    const check
    of gate.checks
  ) {
    output.push(
      `[${check.status.toUpperCase()}] ${check.label}`,
    );

    output.push(
      `  ${check.details}`,
    );
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `PASS: ${gate.summary.pass}`,
    `WARN: ${gate.summary.warn}`,
    `BLOCK: ${gate.summary.block}`,
    '',
    `Listo para confirmación explícita: ${
      gate.summary.readyForExplicitConfirmation
        ? 'SÍ'
        : 'NO'
    }`,
    '',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'La huella identifica esta versión exacta del plan.',
    'Un cambio en el snapshot, bindings, operaciones, preflight o jerarquía producirá una huella diferente.',
    '',
  );

  return output.join('\n');
}
