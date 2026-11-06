import type {
  MigrationPlan,
  MigrationPlanItem,
} from './types.js';

function displayResource(
  item: MigrationPlanItem,
): string {
  const desired =
    item.blueprintId
      ? `${item.blueprintId} — ${item.blueprintName ?? ''}`
      : null;

  const actual =
    item.actualId
      ? `${item.actualName ?? '(sin nombre)'} [${item.actualId}]`
      : null;

  if (desired && actual) {
    return `${actual} -> ${desired}`;
  }

  return (
    desired ??
    actual ??
    '(recurso desconocido)'
  );
}

function section(
  title: string,
  items: MigrationPlanItem[],
): string {
  const lines = [
    '',
    title,
    '='.repeat(title.length),
  ];

  if (items.length === 0) {
    lines.push(
      'Ninguno.',
    );

    return lines.join('\n');
  }

  for (const item of items) {
    lines.push('');

    lines.push(
      `- ${displayResource(item)}`,
    );

    lines.push(
      `  Tipo: ${item.kind}`,
    );

    lines.push(
      `  Motivo: ${item.reason}`,
    );
  }

  return lines.join('\n');
}

export function renderMigrationPlan(
  plan: MigrationPlan,
): string {
  const bound =
    plan.items.filter(
      (item) =>
        item.action === 'bound',
    );

  const suggested =
    plan.items.filter(
      (item) =>
        item.action ===
        'suggest_bind',
    );

  const create =
    plan.items.filter(
      (item) =>
        item.action === 'create',
    );

  const review =
    plan.items.filter(
      (item) =>
        item.action === 'review',
    );

  const unmanaged =
    plan.items.filter(
      (item) =>
        item.action ===
        'unmanaged',
    );

  return [
    'THE CLOCK — MIGRATION PLAN',
    '==========================',
    '',
    `Servidor: ${plan.guild.name}`,
    `Guild ID: ${plan.guild.id}`,
    `Generado: ${plan.generatedAt}`,
    '',
    'RESUMEN',
    '-------',
    `Bindings confirmados: ${plan.summary.bound}`,
    `Bindings sugeridos:   ${plan.summary.suggestedBindings}`,
    `Crear:                ${plan.summary.create}`,
    `Revisión manual:      ${plan.summary.review}`,
    `Sin administrar:      ${plan.summary.unmanaged}`,

    section(
      'BINDINGS CONFIRMADOS',
      bound,
    ),

    section(
      'BINDINGS SUGERIDOS',
      suggested,
    ),

    section(
      'CREAR',
      create,
    ),

    section(
      'REVISIÓN MANUAL',
      review,
    ),

    section(
      'RECURSOS ACTUALES SIN ADMINISTRAR',
      unmanaged,
    ),

    '',
    'IMPORTANTE',
    '==========',
    '',
    'Este plan es informativo.',
    'No crea, elimina, mueve, renombra ni modifica recursos de Discord.',
    'Los recursos sin administrar NO son candidatos automáticos a eliminación.',
    '',
  ].join('\n');
}
