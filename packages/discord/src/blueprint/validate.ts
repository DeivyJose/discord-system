import {
  COMMUNITIES,
  DEPARTMENTS,
  JOBS,
} from '@the-clock/core';

import { DISCORD_CATEGORIES } from './categories.js';
import { DISCORD_CHANNELS } from './channels.js';
import { DISCORD_ROLES } from './roles.js';

const errors: string[] = [];

const categoryIds = new Set(
  DISCORD_CATEGORIES.map((item) => item.id),
);

const roleIds = new Set(
  DISCORD_ROLES.map((item) => item.id),
);

const communityIds = new Set(
  COMMUNITIES.map((item) => item.id),
);

const departmentIds = new Set(
  DEPARTMENTS.map((item) => item.id),
);

const jobIds = new Set(
  JOBS.map((item) => item.id),
);

const allResourceIds = [
  ...DISCORD_CATEGORIES.map((item) => item.id),
  ...DISCORD_CHANNELS.map((item) => item.id),
  ...DISCORD_ROLES.map((item) => item.id),
];

const seen = new Set<string>();

for (const id of allResourceIds) {
  if (seen.has(id)) {
    errors.push(`ID duplicado en Blueprint: "${id}".`);
  }

  seen.add(id);
}

function validateRoleReferences(
  ownerId: string,
  roleReferences: readonly string[] | undefined,
): void {
  if (!roleReferences) return;

  for (const roleId of roleReferences) {
    if (!roleIds.has(roleId)) {
      errors.push(
        `"${ownerId}" referencia el rol inexistente "${roleId}".`,
      );
    }
  }
}

for (const role of DISCORD_ROLES) {
  if (role.jobId && !jobIds.has(role.jobId)) {
    errors.push(
      `Rol "${role.id}" referencia el trabajo inexistente "${role.jobId}".`,
    );
  }

  if (
    role.moduleId &&
    !communityIds.has(role.moduleId)
  ) {
    errors.push(
      `Rol "${role.id}" referencia el módulo inexistente "${role.moduleId}".`,
    );
  }

  if (
    role.departmentId &&
    !departmentIds.has(role.departmentId)
  ) {
    errors.push(
      `Rol "${role.id}" referencia el departamento inexistente "${role.departmentId}".`,
    );
  }
}

for (const category of DISCORD_CATEGORIES) {
  validateRoleReferences(
    category.id,
    category.access.allowRoleIds,
  );

  validateRoleReferences(
    category.id,
    category.access.denyRoleIds,
  );

  if (
    category.moduleId &&
    !communityIds.has(category.moduleId)
  ) {
    errors.push(
      `Categoría "${category.id}" referencia el módulo inexistente "${category.moduleId}".`,
    );
  }

  if (
    category.departmentId &&
    !departmentIds.has(category.departmentId)
  ) {
    errors.push(
      `Categoría "${category.id}" referencia el departamento inexistente "${category.departmentId}".`,
    );
  }
}

for (const channel of DISCORD_CHANNELS) {
  if (!categoryIds.has(channel.parentId)) {
    errors.push(
      `Canal "${channel.id}" referencia la categoría inexistente "${channel.parentId}".`,
    );
  }

  validateRoleReferences(
    channel.id,
    channel.access.allowRoleIds,
  );

  validateRoleReferences(
    channel.id,
    channel.access.denyRoleIds,
  );

  if (
    channel.moduleId &&
    !communityIds.has(channel.moduleId)
  ) {
    errors.push(
      `Canal "${channel.id}" referencia el módulo inexistente "${channel.moduleId}".`,
    );
  }

  if (
    channel.departmentId &&
    !departmentIds.has(channel.departmentId)
  ) {
    errors.push(
      `Canal "${channel.id}" referencia el departamento inexistente "${channel.departmentId}".`,
    );
  }
}

if (errors.length > 0) {
  console.error('');
  console.error('❌ BLUEPRINT DE DISCORD INVÁLIDO');
  console.error('');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  console.error('');

  process.exitCode = 1;
} else {
  console.log('');
  console.log('✅ Blueprint de Discord válido.');
  console.log('');
  console.log(
    `Categorías: ${DISCORD_CATEGORIES.length}`,
  );
  console.log(
    `Canales:    ${DISCORD_CHANNELS.length}`,
  );
  console.log(
    `Roles:      ${DISCORD_ROLES.length}`,
  );
  console.log('');
}
