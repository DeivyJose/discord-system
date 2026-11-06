import type {
  DiscordExecutionPreview,
  ExecutionPhase,
  ExecutionPreviewStep,
} from './executionTypes.js';

const PHASE_TITLES: Record<
  ExecutionPhase,
  string
> = {
  roles: 'FASE 1 — ROLES',
  categories: 'FASE 2 — CATEGORÍAS',
  renames: 'FASE 3 — RENOMBRES',
  channels: 'FASE 4 — CANALES',
  moves: 'FASE 5 — MOVIMIENTOS',
  manual_review:
    'FASE 90 — REVISIÓN MANUAL',
};

function renderStep(
  step: ExecutionPreviewStep,
): string {
  const lines = [
    `- ${step.operationType} — ${step.label}`,
    `  Estado: ${step.status}`,
    `  Operation ID: ${step.operationId}`,
  ];

  if (step.blueprintId) {
    lines.push(
      `  Blueprint ID: ${step.blueprintId}`,
    );
  }

  if (step.actualId) {
    lines.push(
      `  Discord ID: ${step.actualId}`,
    );
  }

  if (step.dependsOn.length > 0) {
    lines.push(
      `  Depende de: ${step.dependsOn.join(', ')}`,
    );
  }

  for (const blocker of step.blockers) {
    lines.push(
      `  BLOQUEO: ${blocker}`,
    );
  }

  for (const note of step.notes) {
    lines.push(
      `  Nota: ${note}`,
    );
  }

  return lines.join('\n');
}

export function renderExecutionPreview(
  preview: DiscordExecutionPreview,
): string {
  const output: string[] = [
    'THE CLOCK — EXECUTION PREVIEW',
    '=============================',
    '',
    `Servidor: ${preview.guild.name}`,
    `Guild ID: ${preview.guild.id}`,
    `Generado: ${preview.generatedAt}`,
    '',
    'MODO',
    '----',
    'DRY RUN ONLY: sí',
    'EJECUCIÓN PERMITIDA: no',
    '',
    'PRECONDICIONES',
    '--------------',
  ];

  for (
    const item
    of preview.preconditions
  ) {
    output.push(
      `[${item.status.toUpperCase()}] ${item.label}`,
    );

    output.push(
      `  ${item.details}`,
    );
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `Pasos totales:     ${preview.summary.totalSteps}`,
    `Listos:            ${preview.summary.ready}`,
    `Manuales:          ${preview.summary.manual}`,
    `Bloqueados:        ${preview.summary.blocked}`,
    '',
    `Fase roles:        ${preview.summary.phases.roles}`,
    `Fase categorías:   ${preview.summary.phases.categories}`,
    `Fase renombres:    ${preview.summary.phases.renames}`,
    `Fase canales:      ${preview.summary.phases.channels}`,
    `Fase movimientos:  ${preview.summary.phases.moves}`,
    `Revisión manual:   ${preview.summary.phases.manual_review}`,
  );

  const phases:
    ExecutionPhase[] = [
      'roles',
      'categories',
      'renames',
      'channels',
      'moves',
      'manual_review',
    ];

  for (const phase of phases) {
    output.push(
      '',
      PHASE_TITLES[phase],
      '='.repeat(
        PHASE_TITLES[phase].length,
      ),
      '',
    );

    const steps =
      preview.steps.filter(
        (step) =>
          step.phase === phase,
      );

    if (steps.length === 0) {
      output.push('Ninguno.');
      continue;
    }

    output.push(
      steps
        .map(renderStep)
        .join('\n\n'),
    );
  }

  output.push(
    '',
    'SEGURIDAD',
    '=========',
    '',
    'Este documento es únicamente una simulación.',
    'executionAllowed=false.',
    'No existe ejecución automática en esta etapa.',
    'Los recursos legacy permanecen intactos.',
    'Los roles managed requieren intervención separada.',
    '',
  );

  return output.join('\n');
}
