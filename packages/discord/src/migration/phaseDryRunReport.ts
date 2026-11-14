import type {
  PhaseDryRunPlan,
} from './phaseDryRunTypes.js';

export function renderPhaseDryRunPlan(
  plan: PhaseDryRunPlan,
): string {
  const output: string[] = [
    'THE CLOCK — PHASE DRY-RUN',
    '=========================',
    '',
    `Generado: ${plan.generatedAt}`,
    `Estado: ${plan.status}`,
    '',
    `Fase: ${plan.phase.order}. ${plan.phase.label}`,
    `Phase ID: ${plan.phase.id}`,
    `Manual only: ${
      plan.phase.manualOnly
        ? 'SÍ'
        : 'NO'
    }`,
    '',
    `Phase fingerprint: ${plan.phase.fingerprint}`,
    '',
    'ORIGEN',
    '------',
    `Session ID: ${plan.source.sessionId}`,
    `Gate fingerprint: ${plan.source.gateFingerprint}`,
    `Approval Receipt: ${plan.source.approvalReceiptId}`,
    `Receipt expira: ${plan.source.receiptExpiresAt}`,
    '',
    'COMPROBACIONES',
    '--------------',
  ];

  for (
    const check
    of plan.checks
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
    'INTENCIONES',
    '-----------',
  );

  if (
    plan.intents.length === 0
  ) {
    output.push(
      '(ninguna acción automática)',
    );
  }

  for (
    const intent
    of plan.intents
  ) {
    output.push(
      '',
      `${intent.order}. ${intent.operationId}`,
      `   Tipo: ${intent.operationType}`,
      `   Recurso: ${intent.resourceKind}`,
      `   Etiqueta: ${intent.label}`,
      `   Haría: ${intent.action}`,
    );

    if (
      intent.dependsOn.length >
      0
    ) {
      output.push(
        `   Depende de: ${intent.dependsOn.join(', ')}`,
      );
    }

    output.push(
      '   Modificaría Discord: SÍ, si existiera un executor real.',
    );
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `Total fase: ${plan.summary.total}`,
    `Ready: ${plan.summary.ready}`,
    `Manual: ${plan.summary.manual}`,
    `Blocked: ${plan.summary.blocked}`,
    '',
    `Checks PASS: ${plan.summary.passChecks}`,
    `Checks WARN: ${plan.summary.warnChecks}`,
    `Checks BLOCK: ${plan.summary.blockChecks}`,
    '',
    `Listo para implementar executor real de esta fase: ${
      plan.summary.readyForRealExecutorImplementation
        ? 'SÍ'
        : 'NO'
    }`,
    '',
    'DRY RUN ONLY: SÍ',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'Este reporte describe acciones hipotéticas.',
    'No contiene ninguna llamada mutativa a Discord.',
    '',
  );

  return output.join('\n');
}
