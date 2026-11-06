export type {
  DiscordAccessPreset,
  DiscordAccessRule,
  DiscordCategoryBlueprint,
  DiscordChannelBlueprint,
  DiscordResourceKind,
  DiscordRoleBlueprint,
} from './blueprint/types.js';

export {
  DISCORD_CATEGORIES,
} from './blueprint/categories.js';

export {
  DISCORD_CHANNELS,
} from './blueprint/channels.js';

export {
  DISCORD_ROLES,
} from './blueprint/roles.js';

export type {
  DiscordChannelSnapshot,
  DiscordGuildSnapshot,
  DiscordRoleSnapshot,
  PermissionOverwriteSnapshot,
} from './inspector/types.js';

export {
  inspectGuild,
} from './inspector/inspectGuild.js';

export type {
  DiscordBindings,
  MigrationAction,
  MigrationConfidence,
  MigrationPlan,
  MigrationPlanItem,
  MigrationResourceKind,
} from './migration/types.js';

export {
  createMigrationPlan,
} from './migration/planner.js';

export {
  renderMigrationPlan,
} from './migration/report.js';

export type {
  MigrationOperation,
  MigrationOperationResourceKind,
  MigrationOperationsPlan,
  MigrationOperationType,
} from './migration/operationTypes.js';

export {
  createMigrationOperationsPlan,
} from './migration/operationsPlanner.js';

export {
  renderMigrationOperationsPlan,
} from './migration/operationsReport.js';

export type {
  DiscordExecutionPreview,
  ExecutionPhase,
  ExecutionPrecondition,
  ExecutionPreconditionStatus,
  ExecutionPreviewStep,
  ExecutionStepStatus,
} from './migration/executionTypes.js';

export {
  createExecutionPreview,
} from './migration/executionPreview.js';

export {
  renderExecutionPreview,
} from './migration/executionReport.js';

export type {
  DiscordMigrationPreflight,
  PreflightCheck,
  PreflightCheckStatus,
  RoleHierarchyCheck,
} from './migration/preflightTypes.js';

export {
  createDiscordMigrationPreflight,
} from './migration/preflight.js';

export {
  renderDiscordMigrationPreflight,
} from './migration/preflightReport.js';

export type {
  HierarchyBootstrapAction,
  HierarchyBootstrapCheck,
  HierarchyBootstrapManualStep,
  HierarchyBootstrapPlan,
  HierarchyBootstrapRole,
  HierarchyBootstrapStatus,
} from './migration/hierarchyBootstrapTypes.js';

export {
  createHierarchyBootstrapPlan,
} from './migration/hierarchyBootstrap.js';

export {
  renderHierarchyBootstrapPlan,
} from './migration/hierarchyBootstrapReport.js';

export type {
  MigrationGate,
  MigrationGateCheck,
  MigrationGateCheckStatus,
} from './migration/migrationGateTypes.js';

export {
  createMigrationGate,
} from './migration/migrationGate.js';

export {
  renderMigrationGate,
} from './migration/migrationGateReport.js';
