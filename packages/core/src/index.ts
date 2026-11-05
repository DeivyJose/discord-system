export type { EntityStatus } from './types/status.js';

export type {
  DependencyKind,
  ModuleDependency,
  ModuleKind,
} from './types/module.js';

export type { ClockModule } from './entities/module.js';

export type { Community } from './entities/community.js';

export type { Department } from './entities/department.js';

export type { JobDefinition } from './entities/job.js';

export type {
  InstitutionDefinition,
} from './entities/institution.js';

export type {
  RoleDefinition,
  RoleType,
} from './entities/role.js';

export type {
  PermissionDefinition,
} from './entities/permission.js';

export { ModuleRegistry } from './registry/moduleRegistry.js';

export { COMMUNITIES } from './catalog/communities.js';

export { DEPARTMENTS } from './catalog/departments.js';

export { JOBS } from './catalog/jobs.js';

export { PERMISSIONS } from './catalog/permissions.js';
