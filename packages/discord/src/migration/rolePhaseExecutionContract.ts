import {
  createHash,
} from 'node:crypto';

import {
  createDiscordBlueprintArtifact,
} from '../blueprint/artifact.js';

import {
  runCheckpointedBindingPhase,
  resumeCheckpointedBindingPhase,
} from './checkpointedBindingResume.js';

import type {
  BoundBindingAwareCheckpoint,
} from './checkpointedBindingResumeTypes.js';

import {
  createMigrationProvenanceArtifactFingerprint,
} from './migrationProvenance.js';

import type {
  CheckpointIntegrityContext,
} from './checkpointIntegrityTypes.js';

import {
  FakeDiscordExecutionAdapter,
} from './fakeDiscordExecutionAdapter.js';

import type {
  AutomatableMigrationOperation,
  CreateCategoryOperation,
  CreateChannelOperation,
  CreateRoleOperation,
  DiscordExecutionAdapter,
  ExecutionAdapterActionResult,
  ExecutionAdapterSnapshot,
  MoveChannelOperation,
  RenameCategoryOperation,
  RenameChannelOperation,
  RenameRoleOperation,
} from './executionAdapterTypes.js';

import type {
  ExecutionJournalHookContext,
  ExecutionJournalRun,
} from './executionJournalTypes.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  createRolePhasePlanFingerprint,
} from './rolePhasePlan.js';

import type {
  RolePhaseAutomaticPayload,
  RolePhasePlan,
} from './rolePhasePlanTypes.js';

import type {
  RolePhaseExecutionCheck,
  RolePhaseFailureClassification,
  RolePhaseFakeExecutionOptions,
  RolePhaseFakeExecutionResult,
  RolePhaseFakeResumeResult,
} from './rolePhaseExecutionContractTypes.js';

import {
  SessionBindingRegistry,
} from './sessionBindingRegistry.js';

const PHASE =
  'role_phase_v1_fake';

const OWNER_OPERATION_ID =
  'create_role:role_owner';

const FORBIDDEN_OPERATION_IDS =
  new Set([
    'create_role:role_owner',
    'create_role:role_administrator',
    'create_role:role_compai',
    'create_role:role_notify_news',
  ]);

interface RolePhaseExecutionPreflight {
  checks:
    RolePhaseExecutionCheck[];

  valid:
    boolean;

  operations:
    CreateRoleOperation[];
}

function addCheck(
  checks:
    RolePhaseExecutionCheck[],

  id: string,

  ok: boolean,

  passDetails: string,

  blockDetails: string,
): void {
  checks.push({
    id,

    status:
      ok
        ? 'pass'
        : 'block',

    details:
      ok
        ? passDetails
        : blockDetails,
  });
}

function sha256(
  value: string,
): string {
  return createHash(
    'sha256',
  )
    .update(
      value,
      'utf8',
    )
    .digest(
      'hex',
    );
}

function sameStringArray(
  left:
    readonly string[],

  right:
    readonly string[],
): boolean {
  return (
    left.length ===
      right.length &&
    left.every(
      (value, index) =>
        value ===
          right[index],
    )
  );
}

function uniqueCount(
  values:
    readonly string[],
): number {
  return new Set(
    values,
  ).size;
}

function createContext(
  plan:
    RolePhasePlan,

  sessionKey:
    string,
): CheckpointIntegrityContext {
  const operationIds =
    plan.automatic.map(
      payload =>
        payload.operationId,
    );

  const contextFingerprint =
    sha256(
      JSON.stringify({
        schemaVersion:
          1,

        kind:
          'role_phase_fake_execution_context',

        rolePhasePlanFingerprint:
          plan.planFingerprint,

        sessionKey,

        operationIds,
      }),
    );

  /*
   * IMPORTANTE:
   *
   * Estos valores están domain-separated con
   * prefijo "fake-role-phase". NO representan
   * un Migration Gate real ni autorización real.
   *
   * Solo reutilizan el formato del checkpoint
   * existente para pruebas locales.
   */
  return {
    guildId:
      plan.guildId,

    sessionId:
      `fake-role-phase:${sessionKey}`,

    gateFingerprint:
      `fake-role-phase-plan:${plan.planFingerprint}`,

    gateEnvelopeFingerprint:
      `fake-role-phase-context:${contextFingerprint}`,

    phase:
      PHASE,

    operationIds,
  };
}

function preflight(
  plan:
    RolePhasePlan,

  operationsPlan:
    MigrationOperationsPlan,
): RolePhaseExecutionPreflight {
  const checks:
    RolePhaseExecutionCheck[] =
    [];

  const recalculatedPlanFingerprint =
    createRolePhasePlanFingerprint(
      plan,
    );

  /*
   * El fingerprint propio del plan no basta:
   * un atacante que modifique el plan también
   * podría recalcular ese hash.
   *
   * Volvemos a anclar la fase al Blueprint
   * canónico actualmente compilado.
   */
  const currentBlueprint =
    createDiscordBlueprintArtifact(
      new Date(0),
    );

  addCheck(
    checks,
    'role_phase_plan_fingerprint',
    plan.schemaVersion ===
      1 &&
    plan.fingerprintVersion ===
      1 &&
    plan.planFingerprint ===
      recalculatedPlanFingerprint,
    'Role Phase Plan fingerprint válido.',
    'Role Phase Plan fingerprint inválido.',
  );

  addCheck(
    checks,
    'blueprint_source_current',
    plan.source
      .blueprintFingerprint ===
        currentBlueprint
          .fingerprint,
    'Role Phase Plan sigue ligado al Blueprint fuente actual.',
    'El Blueprint fuente actual difiere del sellado por Role Phase Plan.',
  );

  addCheck(
    checks,
    'role_phase_plan_summary',
    plan.summary.valid ===
      true &&
    plan.summary.block ===
      0 &&
    plan.summary.totalCreateRoles ===
      23 &&
    plan.summary.automaticRoles ===
      22 &&
    plan.summary.manualRoles ===
      1 &&
    plan.summary.blockedRoles ===
      0,
    'Role Phase Plan mantiene 23 total / 22 automatic / 1 manual / 0 block.',
    'Role Phase Plan dejó de cumplir la frontera v1.',
  );

  addCheck(
    checks,
    'execution_boundary',
    plan.controls
      .continuationAllowed ===
        false &&
    plan.controls
      .executionAllowed ===
        false,
    'Role Phase Plan no autoriza continuación ni ejecución real.',
    'La frontera executionAllowed/continuationAllowed fue alterada.',
  );

  const operationsFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'operations',
      operationsPlan,
    );

  addCheck(
    checks,
    'operations_fingerprint',
    operationsFingerprint ===
      plan.source
        .operationsFingerprint,
    'Migration Operations coincide con el fingerprint sellado por Role Phase Plan.',
    'Migration Operations cambió respecto al Role Phase Plan.',
  );

  addCheck(
    checks,
    'guild_alignment',
    operationsPlan.guild.id ===
      plan.guildId,
    'Guild consistente entre Role Phase Plan y Migration Operations.',
    'Role Phase Plan y Migration Operations pertenecen a Guilds diferentes.',
  );

  const createRoles =
    operationsPlan.operations
      .filter(
        (
          operation,
        ): operation is
          CreateRoleOperation =>
          operation.type ===
            'create_role',
      );

  const sourceAutomatic =
    createRoles.filter(
      operation =>
        operation.id !==
          OWNER_OPERATION_ID,
    );

  const sourceAutomaticIds =
    sourceAutomatic.map(
      operation =>
        operation.id,
    );

  const planAutomaticIds =
    plan.automatic.map(
      payload =>
        payload.operationId,
    );

  addCheck(
    checks,
    'automatic_sequence',
    sourceAutomatic.length ===
      22 &&
    plan.automatic.length ===
      22 &&
    sameStringArray(
      sourceAutomaticIds,
      planAutomaticIds,
    ),
    'Los 22 create_role automáticos mantienen el mismo orden sellado.',
    'La secuencia automática difiere del Role Phase Plan.',
  );

  addCheck(
    checks,
    'automatic_unique',
    uniqueCount(
      planAutomaticIds,
    ) ===
      22,
    'Los 22 operation IDs automáticos son únicos.',
    'Automatic contiene operation IDs duplicados.',
  );

  const ownerManual =
    plan.manual.length ===
      1 &&
    plan.manual[0]
      ?.operationId ===
        OWNER_OPERATION_ID &&
    plan.manual[0]
      ?.blueprintId ===
        'role_owner';

  addCheck(
    checks,
    'owner_manual',
    ownerManual,
    'Dueño permanece exclusivamente en MANUAL_BOOTSTRAP.',
    'Dueño dejó de estar exclusivamente en MANUAL_BOOTSTRAP.',
  );

  addCheck(
    checks,
    'forbidden_operations_excluded',
    planAutomaticIds.every(
      operationId =>
        !FORBIDDEN_OPERATION_IDS
          .has(
            operationId,
          ),
    ),
    'Owner, Administrator, Compai y Avisos CDN están fuera de automatic.',
    'Automatic contiene una operación privilegiada o el Canary ya creado.',
  );

  let payloadsExact =
    true;

  for (
    let index = 0;
    index <
      plan.automatic.length;
    index +=
      1
  ) {
    const payload =
      plan.automatic[
        index
      ];

    const operation =
      sourceAutomatic[
        index
      ];

    const blueprintDefinitions =
      payload
        ? currentBlueprint
            .roles
            .filter(
              role =>
                role.id ===
                  payload.blueprintId,
            )
        : [];

    const blueprintRole =
      blueprintDefinitions.length ===
        1
        ? blueprintDefinitions[0]
        : undefined;

    if (
      !payload ||
      !operation ||
      !blueprintRole ||
      blueprintDefinitions.length !==
        1 ||
      payload.operationId !==
        operation.id ||
      payload.blueprintId !==
        operation.blueprintId ||
      payload.name !==
        operation.desiredName ||
      payload.name !==
        blueprintRole.name ||
      payload.permissions !==
        '0' ||
      payload.hoist !==
        blueprintRole.hoist ||
      payload.mentionable !==
        blueprintRole.mentionable ||
      blueprintRole.systemManaged !==
        true ||
      payload.reason !==
        `The Clock controlled role phase: ${operation.id}`
    ) {
      payloadsExact =
        false;

      break;
    }
  }

  addCheck(
    checks,
    'sealed_payloads_exact',
    payloadsExact,
    'Los 22 payloads coinciden exactamente con sus create_role y permissions=0.',
    'Uno o más payloads sellados no coinciden con Migration Operations.',
  );

  const valid =
    checks.every(
      check =>
        check.status ===
          'pass',
    );

  return {
    checks,

    valid,

    operations:
      valid
        ? sourceAutomatic
        : [],
  };
}

function payloadMap(
  plan:
    RolePhasePlan,
): ReadonlyMap<
  string,
  RolePhaseAutomaticPayload
> {
  return new Map(
    plan.automatic.map(
      payload => [
        payload.operationId,
        payload,
      ] as const,
    ),
  );
}

class RolePhasePayloadValidatingFakeAdapter
implements DiscordExecutionAdapter {
  readonly mode =
    'fake' as const;

  private readonly delegate:
    FakeDiscordExecutionAdapter;

  private readonly payloads:
    ReadonlyMap<
      string,
      RolePhaseAutomaticPayload
    >;

  private faultConsumed =
    false;

  constructor(
    plan:
      RolePhasePlan,

    seed?:
      ExecutionAdapterSnapshot,

    private readonly faultOperationId?:
      string,
  ) {
    this.payloads =
      payloadMap(
        plan,
      );

    this.delegate =
      new FakeDiscordExecutionAdapter(
        seed,
      );
  }

  private assertExactRole(
    operation:
      CreateRoleOperation,
  ): RolePhaseAutomaticPayload {
    const payload =
      this.payloads.get(
        operation.id,
      );

    if (
      !payload
    ) {
      throw new Error(
        `Role Phase rechazó ${operation.id}: no existe payload sellado.`,
      );
    }

    if (
      FORBIDDEN_OPERATION_IDS
        .has(
          operation.id,
        ) ||
      payload.operationId !==
        operation.id ||
      payload.blueprintId !==
        operation.blueprintId ||
      payload.name !==
        operation.desiredName ||
      payload.permissions !==
        '0' ||
      payload.reason !==
        `The Clock controlled role phase: ${operation.id}`
    ) {
      throw new Error(
        `Role Phase rechazó ${operation.id}: payload no exacto.`,
      );
    }

    return payload;
  }

  async createRole(
    operation:
      CreateRoleOperation,
  ): Promise<
    ExecutionAdapterActionResult
  > {
    this.assertExactRole(
      operation,
    );

    const result =
      await this.delegate
        .createRole(
          operation,
        );

    /*
     * Fault injection exclusivamente fake:
     * simula "la creación pudo ocurrir pero
     * la respuesta terminó en error".
     */
    if (
      !this.faultConsumed &&
      this.faultOperationId ===
        operation.id
    ) {
      this.faultConsumed =
        true;

      throw new Error(
        `Synthetic ambiguous failure after fake create: ${operation.id}`,
      );
    }

    return result;
  }

  async createCategory(
    _operation:
      CreateCategoryOperation,
  ): Promise<
    ExecutionAdapterActionResult
  > {
    throw new Error(
      'Role Phase Contract no permite create_category.',
    );
  }

  async createChannel(
    _operation:
      CreateChannelOperation,
  ): Promise<
    ExecutionAdapterActionResult
  > {
    throw new Error(
      'Role Phase Contract no permite create_channel.',
    );
  }

  async renameRole(
    _operation:
      RenameRoleOperation,
  ): Promise<
    ExecutionAdapterActionResult
  > {
    throw new Error(
      'Role Phase Contract no permite rename_role.',
    );
  }

  async renameCategory(
    _operation:
      RenameCategoryOperation,
  ): Promise<
    ExecutionAdapterActionResult
  > {
    throw new Error(
      'Role Phase Contract no permite rename_category.',
    );
  }

  async renameChannel(
    _operation:
      RenameChannelOperation,
  ): Promise<
    ExecutionAdapterActionResult
  > {
    throw new Error(
      'Role Phase Contract no permite rename_channel.',
    );
  }

  async moveChannel(
    _operation:
      MoveChannelOperation,
  ): Promise<
    ExecutionAdapterActionResult
  > {
    throw new Error(
      'Role Phase Contract no permite move_channel.',
    );
  }

  snapshot():
    ExecutionAdapterSnapshot {
    return this.delegate
      .snapshot();
  }
}

function classifyFailure(
  journal:
    ExecutionJournalRun,
): RolePhaseFailureClassification {
  if (
    journal.status ===
      'completed'
  ) {
    return 'none';
  }

  const failed =
    journal.entries.find(
      entry =>
        entry.status ===
          'failed',
    );

  if (
    !failed
  ) {
    return 'pre_dispatch';
  }

  const stateChanged =
    failed.after.actions !==
      failed.before.actions ||
    failed.after.bindings !==
      failed.before.bindings ||
    failed.after.resources !==
      failed.before.resources ||
    JSON.stringify(
      failed.after.targetResource,
    ) !==
      JSON.stringify(
        failed.before.targetResource,
      );

  return stateChanged
    ? 'ambiguous_after_mutation'
    : 'pre_dispatch';
}

function checkpointIsAmbiguous(
  sealed:
    BoundBindingAwareCheckpoint,
): boolean {
  const checkpoint =
    sealed.executionCheckpoint
      .checkpoint;

  const failedOperationId =
    checkpoint
      .failedOperationId;

  if (
    !failedOperationId
  ) {
    return false;
  }

  return checkpoint
    .adapterSnapshot
    .actions
    .some(
      action =>
        action.operationId ===
          failedOperationId,
    );
}

function actionStats(
  snapshot:
    ExecutionAdapterSnapshot |
    null,
): {
  finalActions: number;

  uniqueActions: number;
} {
  if (
    !snapshot
  ) {
    return {
      finalActions: 0,

      uniqueActions: 0,
    };
  }

  const ids =
    snapshot.actions.map(
      action =>
        action.operationId,
    );

  return {
    finalActions:
      ids.length,

    uniqueActions:
      uniqueCount(
        ids,
      ),
  };
}

export class RolePhaseFakeExecutionContract {
  private consumed =
    false;

  constructor(
    private readonly plan:
      RolePhasePlan,

    private readonly operationsPlan:
      MigrationOperationsPlan,

    private readonly options:
      RolePhaseFakeExecutionOptions,
  ) {}

  isConsumed():
    boolean {
    return this.consumed;
  }

  async execute(
    beforeOperation?: (
      context:
        ExecutionJournalHookContext,
    ) =>
      void |
      Promise<void>,
  ): Promise<
    RolePhaseFakeExecutionResult
  > {
    if (
      this.consumed
    ) {
      return {
        schemaVersion: 1,

        generatedAt:
          new Date()
            .toISOString(),

        status:
          'blocked',

        blockReason:
          'contract_consumed',

        contractConsumed:
          true,

        adapterCreated:
          false,

        registryCreated:
          false,

        rolePhasePlanFingerprint:
          this.plan
            .planFingerprint,

        checks: [
          {
            id:
              'single_use',

            status:
              'block',

            details:
              'La instancia Role Phase Execution Contract ya fue consumida.',
          },
        ],

        journal:
          null,

        bindingCommit:
          null,

        sealedCheckpoint:
          null,

        finalAdapterSnapshot:
          null,

        finalRegistrySnapshot:
          null,

        summary: {
          operations:
            0,

          attempted:
            0,

          succeeded:
            0,

          failed:
            0,

          finalActions:
            0,

          uniqueActions:
            0,

          sessionBindings:
            0,

          failureClassification:
            'none',

          resumeAvailable:
            false,
        },

        executionAllowed:
          false,
      };
    }

    /*
     * Single-use desde el PRIMER intento,
     * incluso si preflight bloquea.
     */
    this.consumed =
      true;

    const pre =
      preflight(
        this.plan,
        this.operationsPlan,
      );

    if (
      !pre.valid
    ) {
      return {
        schemaVersion: 1,

        generatedAt:
          new Date()
            .toISOString(),

        status:
          'blocked',

        blockReason:
          'plan_or_operations_invalid',

        contractConsumed:
          true,

        adapterCreated:
          false,

        registryCreated:
          false,

        rolePhasePlanFingerprint:
          this.plan
            .planFingerprint,

        checks:
          pre.checks,

        journal:
          null,

        bindingCommit:
          null,

        sealedCheckpoint:
          null,

        finalAdapterSnapshot:
          null,

        finalRegistrySnapshot:
          null,

        summary: {
          operations:
            pre.operations
              .length,

          attempted:
            0,

          succeeded:
            0,

          failed:
            0,

          finalActions:
            0,

          uniqueActions:
            0,

          sessionBindings:
            0,

          failureClassification:
            'none',

          resumeAvailable:
            false,
        },

        executionAllowed:
          false,
      };
    }

    const context =
      createContext(
        this.plan,
        this.options
          .sessionKey,
      );

    const registry =
      new SessionBindingRegistry(
        this.plan.guildId,
        this.options
          .confirmedBindings,
      );

    const adapter =
      new RolePhasePayloadValidatingFakeAdapter(
        this.plan,
        undefined,
        this.options.fault
          ?.throwAfterCreateOperationId,
      );

    const run =
      await runCheckpointedBindingPhase({
        context,

        operations:
          pre.operations,

        adapter,

        registry,

        ...(
          beforeOperation
            ? {
                beforeOperation,
              }
            : {}
        ),
      });

    const failureClassification =
      classifyFailure(
        run.journal,
      );

    const stats =
      actionStats(
        run.finalAdapterSnapshot,
      );

    const sessionBindings =
      Object.keys(
        run.finalRegistrySnapshot
          .session,
      ).length;

    const resumeAvailable =
      run.journal.status ===
        'stopped_on_error' &&
      run.journal
        .checkpoint
        .nextOperationIndex !==
        null &&
      failureClassification ===
        'pre_dispatch';

    return {
      schemaVersion: 1,

      generatedAt:
        new Date()
          .toISOString(),

      status:
        run.journal.status,

      blockReason:
        null,

      contractConsumed:
        true,

      adapterCreated:
        true,

      registryCreated:
        true,

      rolePhasePlanFingerprint:
        this.plan
          .planFingerprint,

      checks:
        pre.checks,

      journal:
        run.journal,

      bindingCommit:
        run.bindingCommit,

      sealedCheckpoint:
        run.sealedCheckpoint,

      finalAdapterSnapshot:
        run.finalAdapterSnapshot,

      finalRegistrySnapshot:
        run.finalRegistrySnapshot,

      summary: {
        operations:
          pre.operations
            .length,

        attempted:
          run.journal
            .summary
            .attempted,

        succeeded:
          run.journal
            .summary
            .succeeded,

        failed:
          run.journal
            .summary
            .failed,

        finalActions:
          stats.finalActions,

        uniqueActions:
          stats.uniqueActions,

        sessionBindings,

        failureClassification,

        resumeAvailable,
      },

      executionAllowed:
        false,
    };
  }
}

export class RolePhaseFakeResumeContract {
  private consumed =
    false;

  constructor(
    private readonly plan:
      RolePhasePlan,

    private readonly operationsPlan:
      MigrationOperationsPlan,

    private readonly sessionKey:
      string,

    private readonly sealedCheckpoint:
      BoundBindingAwareCheckpoint,
  ) {}

  async execute():
    Promise<
      RolePhaseFakeResumeResult
    > {
    if (
      this.consumed
    ) {
      return {
        schemaVersion: 1,

        generatedAt:
          new Date()
            .toISOString(),

        status:
          'blocked',

        blockReason:
          'contract_consumed',

        contractConsumed:
          true,

        adapterRestored:
          false,

        registryRestored:
          false,

        rolePhasePlanFingerprint:
          this.plan
            .planFingerprint,

        checks: [
          {
            id:
              'single_use',

            status:
              'block',

            details:
              'La instancia Role Phase Resume Contract ya fue consumida.',
          },
        ],

        journal:
          null,

        bindingCommit:
          null,

        sealedCheckpoint:
          null,

        finalAdapterSnapshot:
          null,

        finalRegistrySnapshot:
          null,

        summary: {
          finalActions:
            0,

          uniqueActions:
            0,

          sessionBindings:
            0,

          resumeAvailable:
            false,
        },

        executionAllowed:
          false,
      };
    }

    this.consumed =
      true;

    const pre =
      preflight(
        this.plan,
        this.operationsPlan,
      );

    if (
      !pre.valid
    ) {
      return {
        schemaVersion: 1,

        generatedAt:
          new Date()
            .toISOString(),

        status:
          'blocked',

        blockReason:
          'plan_or_operations_invalid',

        contractConsumed:
          true,

        adapterRestored:
          false,

        registryRestored:
          false,

        rolePhasePlanFingerprint:
          this.plan
            .planFingerprint,

        checks:
          pre.checks,

        journal:
          null,

        bindingCommit:
          null,

        sealedCheckpoint:
          null,

        finalAdapterSnapshot:
          null,

        finalRegistrySnapshot:
          null,

        summary: {
          finalActions:
            0,

          uniqueActions:
            0,

          sessionBindings:
            0,

          resumeAvailable:
            false,
        },

        executionAllowed:
          false,
      };
    }

    /*
     * Si la operación marcada como failed YA aparece
     * en las actions del adapter, pudo haberse aplicado.
     *
     * Nunca reintentamos automáticamente ese caso.
     */
    if (
      checkpointIsAmbiguous(
        this.sealedCheckpoint,
      )
    ) {
      return {
        schemaVersion: 1,

        generatedAt:
          new Date()
            .toISOString(),

        status:
          'blocked',

        blockReason:
          'ambiguous_checkpoint',

        contractConsumed:
          true,

        adapterRestored:
          false,

        registryRestored:
          false,

        rolePhasePlanFingerprint:
          this.plan
            .planFingerprint,

        checks: [
          ...pre.checks,

          {
            id:
              'ambiguity_guard',

            status:
              'block',

            details:
              'La operación fallida ya aparece en el adapter snapshot; retry automático prohibido.',
          },
        ],

        journal:
          null,

        bindingCommit:
          null,

        sealedCheckpoint:
          null,

        finalAdapterSnapshot:
          null,

        finalRegistrySnapshot:
          null,

        summary: {
          finalActions:
            0,

          uniqueActions:
            0,

          sessionBindings:
            0,

          resumeAvailable:
            false,
        },

        executionAllowed:
          false,
      };
    }

    const expectedContext =
      createContext(
        this.plan,
        this.sessionKey,
      );

    const resumed =
      await resumeCheckpointedBindingPhase({
        sealedCheckpoint:
          this.sealedCheckpoint,

        expectedContext,

        operations:
          pre.operations,

        adapterFactory:
          snapshot =>
            new RolePhasePayloadValidatingFakeAdapter(
              this.plan,
              snapshot,
            ),

        registryFactory:
          snapshot =>
            SessionBindingRegistry
              .restore(
                snapshot,
              ),
      });

    if (
      resumed.status ===
        'blocked'
    ) {
      return {
        schemaVersion: 1,

        generatedAt:
          new Date()
            .toISOString(),

        status:
          'blocked',

        blockReason:
          'checkpoint_resume_blocked',

        contractConsumed:
          true,

        adapterRestored:
          resumed.adapterRestored,

        registryRestored:
          resumed.registryRestored,

        rolePhasePlanFingerprint:
          this.plan
            .planFingerprint,

        checks: [
          ...pre.checks,

          ...resumed.checks.map(
            check => ({
              id:
                `resume:${check.id}`,

              status:
                check.status,

              details:
                check.details,
            }),
          ),
        ],

        journal:
          resumed.journal,

        bindingCommit:
          resumed.bindingCommit,

        sealedCheckpoint:
          resumed.sealedCheckpoint,

        finalAdapterSnapshot:
          resumed.finalAdapterSnapshot,

        finalRegistrySnapshot:
          resumed.finalRegistrySnapshot,

        summary: {
          finalActions:
            0,

          uniqueActions:
            0,

          sessionBindings:
            0,

          resumeAvailable:
            false,
        },

        executionAllowed:
          false,
      };
    }

    const stats =
      actionStats(
        resumed.finalAdapterSnapshot,
      );

    const sessionBindings =
      resumed.finalRegistrySnapshot
        ? Object.keys(
            resumed
              .finalRegistrySnapshot
              .session,
          ).length
        : 0;

    const resumeAvailable =
      resumed.status ===
        'stopped_on_error' &&
      resumed.sealedCheckpoint !==
        null &&
      !checkpointIsAmbiguous(
        resumed.sealedCheckpoint,
      );

    return {
      schemaVersion: 1,

      generatedAt:
        new Date()
          .toISOString(),

      status:
        resumed.status,

      blockReason:
        null,

      contractConsumed:
        true,

      adapterRestored:
        resumed.adapterRestored,

      registryRestored:
        resumed.registryRestored,

      rolePhasePlanFingerprint:
        this.plan
          .planFingerprint,

      checks: [
        ...pre.checks,

        ...resumed.checks.map(
          check => ({
            id:
              `resume:${check.id}`,

            status:
              check.status,

            details:
              check.details,
          }),
        ),
      ],

      journal:
        resumed.journal,

      bindingCommit:
        resumed.bindingCommit,

      sealedCheckpoint:
        resumed.sealedCheckpoint,

      finalAdapterSnapshot:
        resumed.finalAdapterSnapshot,

      finalRegistrySnapshot:
        resumed.finalRegistrySnapshot,

      summary: {
        finalActions:
          stats.finalActions,

        uniqueActions:
          stats.uniqueActions,

        sessionBindings,

        resumeAvailable,
      },

      executionAllowed:
        false,
    };
  }
}
