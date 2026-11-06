import type {
  HierarchyBootstrapPlan,
} from './hierarchyBootstrapTypes.js';

export function renderHierarchyBootstrapPlan(
  plan: HierarchyBootstrapPlan,
): string {
  const output: string[] = [
    'THE CLOCK — HIERARCHY BOOTSTRAP PLAN',
    '====================================',
    '',
    `Servidor: ${plan.guild.name}`,
    `Guild ID: ${plan.guild.id}`,
    `Generado: ${plan.generatedAt}`,
    '',
    'JERARQUÍA DESEADA',
    '-----------------',
    '1. Dueño',
    '2. Administrador',
    '3. Compai',
    '4. Roles operativos y comunitarios',
    '',
    'ROLES PRIVILEGIADOS',
    '-------------------',
  ];

  for (
    const role
    of plan.roles
  ) {
    output.push(
      '',
      `- ${role.blueprintId} — ${role.desiredName}`,
      `  Estado: ${role.status}`,
      `  Acción: ${role.action}`,
      `  Discord ID: ${role.actualId ?? '(todavía no existe)'}`,
      `  Nombre actual: ${role.currentName ?? '(todavía no existe)'}`,
      `  Posición actual: ${role.currentPosition ?? '(todavía no existe)'}`,
      `  Managed: ${
        role.managed === null
          ? '(no aplica todavía)'
          : role.managed
            ? 'sí'
            : 'no'
      }`,
      `  Motivo: ${role.reason}`,
    );
  }

  output.push(
    '',
    'COMPROBACIONES',
    '--------------',
  );

  for (
    const check
    of plan.checks
  ) {
    output.push(
      `[${check.status.toUpperCase()}] ${check.id}`,
      `  ${check.details}`,
    );
  }

  output.push(
    '',
    'BOOTSTRAP MANUAL',
    '----------------',
  );

  for (
    const step
    of plan.manualSteps
  ) {
    output.push(
      '',
      `${step.order}. ${step.title}`,
      `   ${step.details}`,
    );
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `Roles listos: ${plan.summary.ready}`,
    `Roles manuales: ${plan.summary.manual}`,
    `Bloqueos: ${plan.summary.block}`,
    '',
    `Bootstrap posible: ${
      plan.summary.bootstrapPossible
        ? 'SÍ'
        : 'NO'
    }`,
    '',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'Este documento no modifica la jerarquía de Discord.',
    'Los cambios privilegiados deben confirmarse y ejecutarse manualmente.',
    '',
  );

  return output.join('\n');
}
