import type {
  DiscordMigrationPreflight,
} from './preflightTypes.js';

export function renderDiscordMigrationPreflight(
  preflight: DiscordMigrationPreflight,
): string {
  const output: string[] = [
    'THE CLOCK — DISCORD MIGRATION PREFLIGHT',
    '=======================================',
    '',
    `Servidor: ${preflight.guild.name}`,
    `Guild ID: ${preflight.guild.id}`,
    `Revisado: ${preflight.checkedAt}`,
    '',
    'COMPAI',
    '------',
    `Usuario: ${preflight.bot.tag}`,
    `User ID: ${preflight.bot.id}`,
    `Rol más alto: ${preflight.bot.highestRoleName}`,
    `Rol ID: ${preflight.bot.highestRoleId}`,
    `Posición: ${preflight.bot.highestRolePosition}`,
    `Administrator: ${preflight.bot.administrator ? 'sí' : 'no'}`,
    `ManageChannels: ${preflight.bot.manageChannels ? 'sí' : 'no'}`,
    `ManageRoles: ${preflight.bot.manageRoles ? 'sí' : 'no'}`,
    '',
    'REQUISITOS DEL PLAN',
    '-------------------',
    `ManageChannels requerido: ${preflight.requirements.manageChannelsRequired ? 'sí' : 'no'}`,
    `ManageRoles requerido: ${preflight.requirements.manageRolesRequired ? 'sí' : 'no'}`,
    '',
    'COMPROBACIONES',
    '--------------',
  ];

  for (
    const check
    of preflight.checks
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
    'JERARQUÍA DE ROLES',
    '------------------',
  );

  if (
    preflight.hierarchy.length === 0
  ) {
    output.push(
      'No existen roles ordinarios actuales que el plan intente editar.',
    );
  } else {
    for (
      const role
      of preflight.hierarchy
    ) {
      output.push(
        `- ${role.roleName} [${role.roleId}]`,
      );

      output.push(
        `  Posición: ${role.rolePosition}`,
      );

      output.push(
        `  Gestionable: ${role.manageable ? 'sí' : 'no'}`,
      );

      output.push(
        `  ${role.reason}`,
      );
    }
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `PASS: ${preflight.summary.pass}`,
    `WARN: ${preflight.summary.warn}`,
    `BLOCK: ${preflight.summary.block}`,
    '',
    `Migración técnicamente posible: ${
      preflight.summary.migrationTechnicallyPossible
        ? 'SÍ'
        : 'NO'
    }`,
    '',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'Este preflight únicamente inspecciona permisos y jerarquía.',
    'No modifica canales, categorías, roles ni miembros.',
    '',
  );

  return output.join('\n');
}
