import { COMMUNITIES } from './communities.js';
import { DEPARTMENTS } from './departments.js';
import { JOBS } from './jobs.js';
import { PERMISSIONS } from './permissions.js';

const errors: string[] = [];

function checkDuplicates(
  label: string,
  ids: string[],
): void {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`${label}: ID duplicado "${id}".`);
    }

    seen.add(id);
  }
}

checkDuplicates(
  'Comunidades',
  COMMUNITIES.map((item) => item.id),
);

checkDuplicates(
  'Departamentos',
  DEPARTMENTS.map((item) => item.id),
);

checkDuplicates(
  'Trabajos',
  JOBS.map((item) => item.id),
);

checkDuplicates(
  'Permisos',
  PERMISSIONS.map((item) => item.id),
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

const permissionIds = new Set(
  PERMISSIONS.map((item) => item.id),
);

const moduleIds = new Set([
  ...COMMUNITIES.map((item) => item.id),
  ...DEPARTMENTS.map((item) => item.id),
]);

for (const community of COMMUNITIES) {
  if (
    community.responsibleJobId &&
    !jobIds.has(community.responsibleJobId)
  ) {
    errors.push(
      `Comunidad "${community.id}" referencia el trabajo inexistente "${community.responsibleJobId}".`,
    );
  }
}

for (const department of DEPARTMENTS) {
  if (
    department.communityId &&
    !communityIds.has(department.communityId)
  ) {
    errors.push(
      `Departamento "${department.id}" referencia la comunidad inexistente "${department.communityId}".`,
    );
  }

  for (const jobId of department.allowedJobIds) {
    if (!jobIds.has(jobId)) {
      errors.push(
        `Departamento "${department.id}" permite el trabajo inexistente "${jobId}".`,
      );
    }
  }

  for (const dependency of department.dependencies) {
    if (
      dependency.kind === 'module' &&
      !moduleIds.has(dependency.id)
    ) {
      errors.push(
        `Departamento "${department.id}" depende del módulo inexistente "${dependency.id}".`,
      );
    }
  }
}

for (const job of JOBS) {
  if (!departmentIds.has(job.departmentId)) {
    errors.push(
      `Trabajo "${job.id}" referencia el departamento inexistente "${job.departmentId}".`,
    );
  }

  for (const permission of job.permissions) {
    if (!permissionIds.has(permission)) {
      errors.push(
        `Trabajo "${job.id}" utiliza el permiso inexistente "${permission}".`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error('');
  console.error('❌ CATÁLOGO DE THE CLOCK INVÁLIDO');
  console.error('');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  console.error('');
  process.exitCode = 1;
} else {
  console.log('');
  console.log('✅ Catálogo de The Clock válido.');
  console.log('');
  console.log(`Comunidades:  ${COMMUNITIES.length}`);
  console.log(`Departamentos: ${DEPARTMENTS.length}`);
  console.log(`Trabajos:      ${JOBS.length}`);
  console.log(`Permisos:      ${PERMISSIONS.length}`);
  console.log('');
}
