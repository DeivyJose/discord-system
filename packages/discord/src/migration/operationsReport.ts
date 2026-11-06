import type {
  MigrationOperation,
  MigrationOperationsPlan,
} from './operationTypes.js';

function operationLabel(
  operation: MigrationOperation,
): string {
  const target =
    operation.blueprintId ??
    operation.actualId ??
    '(desconocido)';

  return `${operation.type} — ${target}`;
}

function renderOperation(
  operation: MigrationOperation,
): string {
  const lines = [
    `- ${operationLabel(operation)}`,
  ];

  if (operation.actualId) {
    lines.push(
      `  Discord ID: ${operation.actualId}`,
    );
  }

  if (operation.currentName) {
    lines.push(
      `  Actual: ${operation.currentName}`,
    );
  }

  if (operation.desiredName) {
    lines.push(
      `  Deseado: ${operation.desiredName}`,
    );
  }

  if (
    operation.desiredParentBlueprintId
  ) {
    lines.push(
      `  Categoría destino: ${operation.desiredParentBlueprintId}`,
    );
  }

  if (
    operation.desiredParentActualId
  ) {
    lines.push(
      `  Discord ID destino: ${operation.desiredParentActualId}`,
    );
  }

  if (
    operation.currentParentId !==
    undefined
  ) {
    lines.push(
      `  Categoría actual ID: ${operation.currentParentId ?? '(ninguna)'}`,
    );
  }

  if (operation.channelKind) {
    lines.push(
      `  Tipo de canal: ${operation.channelKind}`,
    );
  }

  lines.push(
    `  Motivo: ${operation.reason}`,
  );

  lines.push(
    '  Requiere confirmación: sí',
  );

  return lines.join('\n');
}

function section(
  title: string,
  operations: MigrationOperation[],
): string {
  const lines = [
    '',
    title,
    '='.repeat(title.length),
    '',
  ];

  if (
    operations.length === 0
  ) {
    lines.push('Ninguna.');

    return lines.join('\n');
  }

  lines.push(
    operations
      .map(renderOperation)
      .join('\n\n'),
  );

  return lines.join('\n');
}

export function renderMigrationOperationsPlan(
  plan: MigrationOperationsPlan,
): string {
  const creates =
    plan.operations.filter(
      (operation) =>
        operation.type.startsWith(
          'create_',
        ),
    );

  const renames =
    plan.operations.filter(
      (operation) =>
        operation.type.startsWith(
          'rename_',
        ),
    );

  const moves =
    plan.operations.filter(
      (operation) =>
        operation.type ===
        'move_channel',
    );

  const managedRoleReviews =
    plan.operations.filter(
      (operation) =>
        operation.type ===
        'review_managed_role',
    );

  const bindingReviews =
    plan.operations.filter(
      (operation) =>
        operation.type ===
        'review_binding',
    );

  const legacyReviews =
    plan.operations.filter(
      (operation) =>
        operation.type ===
        'review_legacy',
    );

  return [
    'THE CLOCK — MIGRATION OPERATIONS PLAN',
    '=====================================',
    '',
    `Servidor: ${plan.guild.name}`,
    `Guild ID: ${plan.guild.id}`,
    `Generado: ${plan.generatedAt}`,
    '',
    'RESUMEN',
    '-------',
    `Operaciones totales:     ${plan.summary.total}`,
    '',
    `Crear categorías:        ${plan.summary.createCategories}`,
    `Crear canales:           ${plan.summary.createChannels}`,
    `Crear roles:             ${plan.summary.createRoles}`,
    '',
    `Renombrar categorías:    ${plan.summary.renameCategories}`,
    `Renombrar canales:       ${plan.summary.renameChannels}`,
    `Renombrar roles:         ${plan.summary.renameRoles}`,
    '',
    `Mover canales:           ${plan.summary.moveChannels}`,
    '',
    `Roles managed a revisar: ${plan.summary.reviewManagedRoles}`,
    `Bindings a revisar:      ${plan.summary.reviewBindings}`,
    `Legacy a revisar:        ${plan.summary.reviewLegacy}`,

    section(
      'CREAR',
      creates,
    ),

    section(
      'RENOMBRAR',
      renames,
    ),

    section(
      'MOVER',
      moves,
    ),

    section(
      'ROLES ADMINISTRADOS A REVISAR',
      managedRoleReviews,
    ),

    section(
      'BINDINGS A REVISAR',
      bindingReviews,
    ),

    section(
      'LEGACY A REVISAR',
      legacyReviews,
    ),

    '',
    'SEGURIDAD',
    '=========',
    '',
    'Este archivo es exclusivamente un plan.',
    'No contiene código de ejecución contra Discord.',
    'Ninguna operación ha sido aplicada al servidor.',
    'Los recursos legacy no se eliminarán automáticamente.',
    '',
  ].join('\n');
}
