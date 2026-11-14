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

export type {
  ConfirmationManifest,
  ConfirmationManifestCheck,
  ConfirmationManifestCheckStatus,
  ConfirmationManifestStatus,
} from './migration/confirmationManifestTypes.js';

export {
  createConfirmationManifest,
} from './migration/confirmationManifest.js';

export {
  renderConfirmationManifest,
} from './migration/confirmationManifestReport.js';

export type {
  ApprovalReceipt,
  ConfirmationVerificationCheck,
  ConfirmationVerificationCheckStatus,
  ConfirmationVerificationStatus,
} from './migration/approvalReceiptTypes.js';

export {
  verifyConfirmationManifest,
} from './migration/confirmationVerifier.js';

export {
  renderApprovalReceipt,
} from './migration/approvalReceiptReport.js';

export type {
  ExecutionSessionCheck,
  ExecutionSessionCheckStatus,
  ExecutionSessionItem,
  ExecutionSessionOperation,
  ExecutionSessionPhase,
  ExecutionSessionPhaseId,
  ExecutionSessionPlan,
  ExecutionSessionPreviewStep,
  ExecutionSessionStatus,
} from './migration/executionSessionTypes.js';

export {
  createExecutionSessionPlan,
} from './migration/executionSessionPlanner.js';

export {
  renderExecutionSessionPlan,
} from './migration/executionSessionReport.js';

export type {
  PhaseDryRunCheck,
  PhaseDryRunCheckStatus,
  PhaseDryRunIntent,
  PhaseDryRunPlan,
  PhaseDryRunStatus,
} from './migration/phaseDryRunTypes.js';

export {
  createPhaseDryRunPlan,
} from './migration/phaseDryRunPlanner.js';

export {
  renderPhaseDryRunPlan,
} from './migration/phaseDryRunReport.js';

export type {
  AutomatableMigrationOperation,
  AutomatableOperationType,
  CreateCategoryOperation,
  CreateChannelOperation,
  CreateRoleOperation,
  DiscordExecutionAdapter,
  ExecutionAdapterActionResult,
  ExecutionAdapterBinding,
  ExecutionAdapterResourceState,
  ExecutionAdapterSnapshot,
MoveChannelOperation,
  RenameCategoryOperation,
  RenameChannelOperation,
  RenameRoleOperation,
} from './migration/executionAdapterTypes.js';

export {
  dispatchExecutionOperation,
  isAutomatableOperation,
} from './migration/executionAdapter.js';

export {
  FakeDiscordExecutionAdapter,
} from './migration/fakeDiscordExecutionAdapter.js';

export type {
  ExecutionCheckpoint,
  ExecutionCheckpointStatus,
  ExecutionJournalEntry,
  ExecutionJournalEntryStatus,
  ExecutionJournalHookContext,
  ExecutionJournalRun,
  ExecutionJournalRunnerOptions,
  ExecutionJournalState,
} from './migration/executionJournalTypes.js';

export {
  executeWithJournal,
} from './migration/executionJournal.js';

export type {
  BoundExecutionCheckpoint,
  CheckpointIntegrityCheck,
  CheckpointIntegrityCheckStatus,
  CheckpointIntegrityContext,
  CheckpointIntegrityVerification,
} from './migration/checkpointIntegrityTypes.js';

export {
  sealExecutionCheckpoint,
  verifyExecutionCheckpointIntegrity,
} from './migration/checkpointIntegrity.js';

export type {
  VerifiedResumeBlockReason,
  VerifiedResumeCheck,
  VerifiedResumeCheckStatus,
  VerifiedResumeOptions,
  VerifiedResumeResult,
  VerifiedResumeStatus,
} from './migration/verifiedResumeTypes.js';

export {
  verifiedResumeExecution,
} from './migration/verifiedResume.js';

export type {
  PhaseTransactionBlockReason,
  PhaseTransactionCheck,
  PhaseTransactionCheckStatus,
  PhaseTransactionOptions,
  PhaseTransactionResult,
  PhaseTransactionStatus,
} from './migration/phaseTransactionTypes.js';

export {
  runExecutionPhaseTransaction,
} from './migration/phaseTransaction.js';

export type {
  DiscordStructureResourceKind,
  LiveDriftBaseline,
  LiveDriftChange,
  LiveDriftChangeType,
  LiveDriftCheck,
  LiveDriftCheckStatus,
  LiveDriftContext,
  LiveDriftVerification,
  NormalizedDiscordStructureResource,
  NormalizedDiscordStructureSnapshot,
} from './migration/liveDriftTypes.js';

export {
  createLiveDriftBaseline,
  normalizeDiscordStructureSnapshot,
  verifyLiveDrift,
} from './migration/liveDrift.js';
