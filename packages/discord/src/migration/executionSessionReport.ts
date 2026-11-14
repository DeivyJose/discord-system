import type {
  ExecutionSessionPlan,
} from './executionSessionTypes.js';

export function renderExecutionSessionPlan(
  session: ExecutionSessionPlan,
): string {
  const output: string[] = [
    'THE CLOCK — EXECUTION SESSION PLAN',
    '==================================',
    '',
    `Session ID: ${session.sessionId}`,
    `Generado: ${session.generatedAt}`,
    `Estado: ${session.status}`,
    '',
    `Servidor: ${session.guild.name}`,
    `Guild ID: ${session.guild.id}`,
    '',
    'AUTORIZACIÓN DE ORIGEN',
    '----------------------',
    `Gate fingerprint: ${session.gateFingerprint}`,
    `Approval Receipt: ${session.approvalReceiptId}`,
    `Receipt expira: ${session.source.receiptExpiresAt}`,
    `Snapshot: ${session.source.snapshotCapturedAt}`,
    '',
    'COMPROBACIONES',
    '--------------',
  ];

  for (
    const check
    of session.checks
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
    'FASES',
    '-----',
  );

  for (
    const phase
    of session.phases
  ) {
    output.push(
      '',
      `${phase.order}. ${phase.label}`,
      `   ID: ${phase.id}`,
      `   Solo manual: ${
        phase.manualOnly
          ? 'SÍ'
          : 'NO'
      }`,
      `   Total: ${phase.summary.total}`,
      `   Ready: ${phase.summary.ready}`,
      `   Manual: ${phase.summary.manual}`,
      `   Blocked: ${phase.summary.blocked}`,
      '',
      '   Operaciones:',
    );

    if (
      phase.items.length === 0
    ) {
      output.push(
        '   - (ninguna)',
      );
    }

    for (
      const item
      of phase.items
    ) {
      output.push(
        `   - [${item.preview.status.toUpperCase()}] ${item.operation.id}`,
      );

      output.push(
        `     Tipo: ${item.operation.type}`,
      );

      output.push(
        `     Recurso: ${item.operation.resourceKind}`,
      );

      output.push(
        `     Etiqueta: ${item.preview.label}`,
      );

      if (
        item.preview.dependsOn.length >
        0
      ) {
        output.push(
          `     Depende de: ${item.preview.dependsOn.join(', ')}`,
        );
      }

      if (
        item.preview.blockers.length >
        0
      ) {
        output.push(
          `     Blockers: ${item.preview.blockers.join(' | ')}`,
        );
      }

      if (
        item.preview.notes.length >
        0
      ) {
        output.push(
          `     Notas: ${item.preview.notes.join(' | ')}`,
        );
      }
    }

    output.push(
      '',
      '   Condiciones de parada:',
    );

    for (
      const condition
      of phase.stopConditions
    ) {
      output.push(
        `   - ${condition}`,
      );
    }
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `Operaciones: ${session.summary.operations}`,
    `Fases: ${session.summary.phases}`,
    `Ready: ${session.summary.ready}`,
    `Manual: ${session.summary.manual}`,
    `Blocked: ${session.summary.blocked}`,
    '',
    `Checks PASS: ${session.summary.passChecks}`,
    `Checks WARN: ${session.summary.warnChecks}`,
    `Checks BLOCK: ${session.summary.blockChecks}`,
    '',
    `Listo para diseñar executor: ${
      session.summary.readyForExecutorDesign
        ? 'SÍ'
        : 'NO'
    }`,
    '',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'Este documento es únicamente un plan de sesión.',
    'No conecta con Discord y no ejecuta ninguna operación.',
    '',
  );

  return output.join('\n');
}
