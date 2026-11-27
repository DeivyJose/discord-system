import {
  createHash,
} from 'node:crypto';

import {
  createDiscordBlueprintArtifact,
  createDiscordBlueprintContentFingerprint,
} from '../blueprint/artifact.js';

import type {
  DiscordBlueprintArtifact,
} from '../blueprint/artifact.js';

import type {
  DiscordRoleBlueprint,
} from '../blueprint/types.js';

import type {
  HierarchyBootstrapPlan,
} from './hierarchyBootstrapTypes.js';

import {
  createMigrationProvenanceArtifactFingerprint,
} from './migrationProvenance.js';

import type {
  MigrationProvenanceArtifact,
} from './migrationProvenanceTypes.js';

import type {
  MigrationOperation,
  MigrationOperationsPlan,
} from './operationTypes.js';

import type {
  RolePhaseAutomaticPayload,
  RolePhaseBlockedRole,
  RolePhaseManualRole,
  RolePhasePlan,
  RolePhasePlanCheck,
  RolePhasePlanVerification,
} from './rolePhasePlanTypes.js';

export interface RolePhasePlanInput {
  blueprint:
    DiscordBlueprintArtifact;

  operations:
    MigrationOperationsPlan;

  hierarchy:
    HierarchyBootstrapPlan;

  provenance:
    MigrationProvenanceArtifact;
}

/*
 * Role Phase Plan v1 queda deliberadamente
 * ligado al baseline post-Canary actual.
 *
 * Cualquier operación nueva o ausente obliga
 * a regenerar/revisar esta allowlist.
 */
export const ROLE_PHASE_V1_AUTOMATIC_OPERATION_IDS =
  [
    'create_role:role_police_coronel',
    'create_role:role_police_officer',
    'create_role:role_cdn_director',
    'create_role:role_cdn_editor',
    'create_role:role_cdn_reporter',
    'create_role:role_support_director',
    'create_role:role_support_supervisor',
    'create_role:role_support_representative',
    'create_role:role_campus_director',
    'create_role:role_gaming_commissioner',
    'create_role:role_basket_commissioner',
    'create_role:role_events_director',
    'create_role:role_campus_member',
    'create_role:role_gaming_member',
    'create_role:role_basket_member',
    'create_role:role_events_member',
    'create_role:role_prisoner',
    'create_role:role_sector_27',
    'create_role:role_notify_events',
    'create_role:role_notify_campus',
    'create_role:role_notify_gaming',
    'create_role:role_notify_basket',
  ] as const;

const OWNER_OPERATION_ID =
  'create_role:role_owner' as const;

const PRIVILEGED_BLUEPRINT_IDS =
  new Set([
    'role_owner',
    'role_administrator',
    'role_compai',
  ]);

function canonicalize(
  value: unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      canonicalize,
    );
  }

  if (
    typeof value ===
      'object' &&
    value !==
      null
  ) {
    const source =
      value as
        Record<string, unknown>;

    const output:
      Record<string, unknown> =
      {};

    for (
      const key of
      Object.keys(
        source,
      ).sort()
    ) {
      output[key] =
        canonicalize(
          source[key],
        );
    }

    return output;
  }

  return value;
}

function canonicalJson(
  value: unknown,
): string {
  return JSON.stringify(
    canonicalize(
      value,
    ),
  );
}

function sha256(
  value: unknown,
): string {
  return createHash(
    'sha256',
  )
    .update(
      canonicalJson(
        value,
      ),
      'utf8',
    )
    .digest(
      'hex',
    );
}

function semanticArtifact(
  value: unknown,
): unknown {
  if (
    typeof value !==
      'object' ||
    value ===
      null ||
    Array.isArray(
      value,
    )
  ) {
    return value;
  }

  const clone =
    structuredClone(
      value,
    ) as Record<
      string,
      unknown
    >;

  delete clone.generatedAt;

  return clone;
}

export function createRolePhaseHierarchyFingerprint(
  hierarchy:
    HierarchyBootstrapPlan,
): string {
  return sha256({
    fingerprintVersion:
      1,

    kind:
      'role_phase_hierarchy',

    artifact:
      semanticArtifact(
        hierarchy,
      ),
  });
}

export function createRolePhasePlanFingerprint(
  plan:
    Omit<
      RolePhasePlan,
      'planFingerprint'
    > |
    RolePhasePlan,
): string {
  const clone =
    structuredClone(
      plan,
    ) as unknown as
      Record<string, unknown>;

  delete clone.planFingerprint;

  /*
   * generatedAt es metadata de materialización,
   * no identidad semántica del Role Phase Plan.
   * Las mismas fuentes deben producir el mismo
   * fingerprint aunque se regeneren más tarde.
   */
  delete clone.generatedAt;

  return sha256({
    fingerprintVersion:
      1,

    kind:
      'role_phase_plan',

    artifact:
      clone,
  });
}

function addCheck(
  checks:
    RolePhasePlanCheck[],

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

function sameStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const a =
    [...left].sort();

  const b =
    [...right].sort();

  return (
    a.length ===
      b.length &&
    a.every(
      (value, index) =>
        value ===
          b[index],
    )
  );
}

function roleDefinitions(
  blueprint:
    DiscordBlueprintArtifact,

  blueprintId:
    string,
): DiscordRoleBlueprint[] {
  return blueprint.roles.filter(
    role =>
      role.id ===
        blueprintId,
  );
}

function operationBlueprintId(
  operation:
    MigrationOperation,
): string | null {
  return typeof operation
    .blueprintId ===
      'string'
    ? operation.blueprintId
    : null;
}

function definitionHasUnexpectedPermissionsField(
  role:
    DiscordRoleBlueprint,
): boolean {
  return Object.prototype
    .hasOwnProperty.call(
      role,
      'permissions',
    );
}

function hierarchyRole(
  hierarchy:
    HierarchyBootstrapPlan,

  blueprintId:
    string,
) {
  return hierarchy.roles.filter(
    role =>
      role.blueprintId ===
        blueprintId,
  );
}

export function createRolePhasePlan(
  input:
    RolePhasePlanInput,

  now =
    new Date(),
): RolePhasePlan {
  const checks:
    RolePhasePlanCheck[] =
    [];

  const automatic:
    RolePhaseAutomaticPayload[] =
    [];

  const manual:
    RolePhaseManualRole[] =
    [];

  const blocked:
    RolePhaseBlockedRole[] =
    [];

  /*
   * ======================================================
   * SOURCE INTEGRITY
   * ======================================================
   */

  const calculatedBlueprintFingerprint =
    createDiscordBlueprintContentFingerprint({
      schemaVersion:
        input.blueprint
          .schemaVersion,

      blueprintVersion:
        input.blueprint
          .blueprintVersion,

      categories:
        input.blueprint
          .categories,

      channels:
        input.blueprint
          .channels,

      roles:
        input.blueprint
          .roles,
    });

  const currentBlueprint =
    createDiscordBlueprintArtifact(
      new Date(0),
    );

  addCheck(
    checks,
    'blueprint_integrity',
    input.blueprint
      .schemaVersion ===
        1 &&
    input.blueprint
      .blueprintVersion ===
        1 &&
    input.blueprint
      .fingerprintVersion ===
        1 &&
    input.blueprint
      .fingerprint ===
        calculatedBlueprintFingerprint,
    'El fingerprint declarado del Blueprint coincide con su contenido.',
    'El Blueprint declarado no supera su verificación de integridad.',
  );

  addCheck(
    checks,
    'blueprint_current_source',
    input.blueprint
      .fingerprint ===
        currentBlueprint
          .fingerprint,
    'El Blueprint materializado coincide con el Blueprint fuente actual.',
    'El Blueprint materializado difiere del Blueprint fuente actual.',
  );

  const operationsFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'operations',
      input.operations,
    );

  const hierarchyFingerprint =
    createRolePhaseHierarchyFingerprint(
      input.hierarchy,
    );

  addCheck(
    checks,
    'provenance_valid',
    input.provenance
      .schemaVersion ===
        1 &&
    input.provenance
      .fingerprintVersion ===
        1 &&
    input.provenance
      .summary.valid ===
        true &&
    input.provenance
      .summary.block ===
        0 &&
    input.provenance
      .executionAllowed ===
        false,
    'Migration Provenance v1 es válido y mantiene executionAllowed=false.',
    'Migration Provenance no es válido para construir Role Phase Plan.',
  );

  addCheck(
    checks,
    'provenance_blueprint_binding',
    input.provenance
      .source
      .blueprintFingerprint ===
        input.blueprint
          .fingerprint,
    'Provenance está ligado al Blueprint exacto.',
    'El Blueprint no coincide con el fingerprint sellado por Provenance.',
  );

  addCheck(
    checks,
    'provenance_operations_binding',
    input.provenance
      .artifacts
      .operationsFingerprint ===
        operationsFingerprint,
    'Provenance está ligado al Migration Operations Plan exacto.',
    'Las operaciones actuales no coinciden con Provenance.',
  );

  addCheck(
    checks,
    'guild_consistency',
    input.operations
      .guild.id ===
        input.hierarchy
          .guild.id &&
    input.operations
      .guild.id ===
        input.provenance
          .guildId,
    'Guild consistente entre Operations, Hierarchy y Provenance.',
    'Los artefactos pertenecen a Guilds diferentes.',
  );

  /*
   * ======================================================
   * HIERARCHY BOUNDARY
   * ======================================================
   */

  const ownerHierarchy =
    hierarchyRole(
      input.hierarchy,
      'role_owner',
    );

  const administratorHierarchy =
    hierarchyRole(
      input.hierarchy,
      'role_administrator',
    );

  const compaiHierarchy =
    hierarchyRole(
      input.hierarchy,
      'role_compai',
    );

  const automaticBoundaryChecks =
    input.hierarchy
      .checks
      .filter(
        check =>
          check.id ===
            'automatic_boundary',
      );

  addCheck(
    checks,
    'hierarchy_no_blocks',
    input.hierarchy
      .schemaVersion ===
        1 &&
    input.hierarchy
      .summary.block ===
        0 &&
    input.hierarchy
      .summary.bootstrapPossible ===
        true &&
    input.hierarchy
      .executionAllowed ===
        false,
    'Hierarchy Bootstrap no contiene bloqueos y no autoriza ejecución.',
    'Hierarchy Bootstrap contiene un bloqueo o una frontera inválida.',
  );

  addCheck(
    checks,
    'owner_manual_boundary',
    ownerHierarchy.length ===
      1 &&
    ownerHierarchy[0]
      ?.status ===
        'manual' &&
    ownerHierarchy[0]
      ?.action ===
        'create_then_promote',
    'role_owner permanece manual/create_then_promote.',
    'role_owner dejó de ser manual/create_then_promote.',
  );

  addCheck(
    checks,
    'administrator_ready_boundary',
    administratorHierarchy.length ===
      1 &&
    administratorHierarchy[0]
      ?.status ===
        'ready' &&
    administratorHierarchy[0]
      ?.action ===
        'already_correct',
    'role_administrator permanece ready/already_correct.',
    'role_administrator requiere revisión antes de una fase automática.',
  );

  addCheck(
    checks,
    'compai_anchor_boundary',
    compaiHierarchy.length ===
      1 &&
    compaiHierarchy[0]
      ?.status ===
        'ready' &&
    compaiHierarchy[0]
      ?.action ===
        'managed_anchor' &&
    compaiHierarchy[0]
      ?.managed ===
        true,
    'Compai permanece como managed_anchor de la frontera automática.',
    'Compai dejó de ser un managed_anchor válido.',
  );

  addCheck(
    checks,
    'automatic_boundary',
    automaticBoundaryChecks
      .length ===
        1 &&
    automaticBoundaryChecks[0]
      ?.status ===
        'pass',
    'Hierarchy confirma que la automatización queda debajo de Compai.',
    'Hierarchy ya no confirma la frontera automática debajo de Compai.',
  );

  /*
   * ======================================================
   * CREATE_ROLE CLASSIFICATION
   * ======================================================
   */

  const createRoleOperations =
    input.operations
      .operations
      .filter(
        operation =>
          operation.type ===
            'create_role',
      );

  const expectedAutomaticIds =
    [
      ...ROLE_PHASE_V1_AUTOMATIC_OPERATION_IDS,
    ];

  const expectedPendingIds =
    [
      OWNER_OPERATION_ID,
      ...expectedAutomaticIds,
    ];

  const actualPendingIds =
    createRoleOperations
      .map(
        operation =>
          operation.id,
      );

  addCheck(
    checks,
    'create_role_count_exact',
    createRoleOperations
      .length ===
        23 &&
    input.operations
      .summary
      .createRoles ===
        23,
    'El baseline contiene exactamente 23 create_role.',
    'El número de create_role cambió; Role Phase Plan v1 requiere revisión.',
  );

  addCheck(
    checks,
    'pending_operation_set_exact',
    sameStringSet(
      actualPendingIds,
      expectedPendingIds,
    ),
    'El conjunto de create_role coincide exactamente con la allowlist v1.',
    'El conjunto de create_role contiene operaciones nuevas, ausentes o duplicadas.',
  );

  addCheck(
    checks,
    'canary_not_pending',
    !actualPendingIds.includes(
      'create_role:role_notify_news',
    ),
    'role_notify_news no está pendiente y no puede duplicarse.',
    'role_notify_news reapareció como create_role; fase bloqueada.',
  );

  addCheck(
    checks,
    'administrator_compai_not_pending',
    !actualPendingIds.includes(
      'create_role:role_administrator',
    ) &&
    !actualPendingIds.includes(
      'create_role:role_compai',
    ),
    'Administrador y Compai no aparecen como create_role pendientes.',
    'Un rol privilegiado inesperado apareció como create_role.',
  );

  for (
    const operation
    of createRoleOperations
  ) {
    const blueprintId =
      operationBlueprintId(
        operation,
      );

    const definitions =
      blueprintId
        ? roleDefinitions(
            input.blueprint,
            blueprintId,
          )
        : [];

    const definition =
      definitions.length ===
        1
        ? definitions[0]
        : undefined;

    const reasons:
      string[] =
      [];

    if (
      !blueprintId
    ) {
      reasons.push(
        'blueprintId ausente.',
      );
    }

    if (
      operation.resourceKind !==
        'role'
    ) {
      reasons.push(
        'resourceKind no es role.',
      );
    }

    if (
      operation.requiresConfirmation !==
        true
    ) {
      reasons.push(
        'requiresConfirmation no es true.',
      );
    }

    if (
      definitions.length !==
        1
    ) {
      reasons.push(
        `Definiciones Blueprint encontradas: ${definitions.length}.`,
      );
    }

    if (
      blueprintId &&
      operation.id !==
        `create_role:${blueprintId}`
    ) {
      reasons.push(
        'operationId no coincide con blueprintId.',
      );
    }

    if (
      definition &&
      operation.desiredName !==
        definition.name
    ) {
      reasons.push(
        'desiredName no coincide con Blueprint.name.',
      );
    }

    if (
      definition &&
      definition.kind !==
        'role'
    ) {
      reasons.push(
        'Blueprint.kind no es role.',
      );
    }

    if (
      definition &&
      definition.systemManaged !==
        true
    ) {
      reasons.push(
        'systemManaged no es true.',
      );
    }

    /*
     * Role Phase Plan v1 no acepta que el schema
     * del Blueprint empiece a transportar permisos
     * sin una revisión explícita.
     */
    if (
      definition &&
      definitionHasUnexpectedPermissionsField(
        definition,
      )
    ) {
      reasons.push(
        'Blueprint contiene un campo permissions inesperado.',
      );
    }

    if (
      operation.id ===
        OWNER_OPERATION_ID
    ) {
      if (
        blueprintId !==
          'role_owner'
      ) {
        reasons.push(
          'Owner operation no apunta a role_owner.',
        );
      }

      if (
        reasons.length ===
          0 &&
        definition
      ) {
        manual.push({
          operationId:
            operation.id,

          blueprintId:
            'role_owner',

          name:
            definition.name,

          classification:
            'manual_bootstrap',

          reason:
            'Dueño debe crearse/posicionarse bajo control humano; nunca pertenece a la fase automática.',
        });
      } else {
        blocked.push({
          operationId:
            operation.id,

          blueprintId,

          name:
            operation.desiredName ??
              null,

          reasons,
        });
      }

      continue;
    }

    if (
      !expectedAutomaticIds
        .includes(
          operation.id as
            typeof expectedAutomaticIds[number],
        )
    ) {
      reasons.push(
        'Operación fuera de la allowlist automática Role Phase v1.',
      );
    }

    if (
      blueprintId &&
      PRIVILEGED_BLUEPRINT_IDS
        .has(
          blueprintId,
        )
    ) {
      reasons.push(
        'Rol privilegiado prohibido en automatic.',
      );
    }

    if (
      reasons.length ===
        0 &&
      definition &&
      blueprintId
    ) {
      automatic.push({
        operationId:
          operation.id,

        blueprintId,

        name:
          definition.name,

        /*
         * Invariante central:
         * todos los roles de esta fase nacen
         * con ZERO global Discord permissions.
         */
        permissions:
          '0',

        hoist:
          definition.hoist,

        mentionable:
          definition.mentionable,

        reason:
          `The Clock controlled role phase: ${operation.id}`,
      });
    } else {
      blocked.push({
        operationId:
          operation.id,

        blueprintId,

        name:
          operation.desiredName ??
            null,

        reasons,
      });
    }
  }

  /*
   * Si falta una operación esperada, la registramos
   * también en blocked para que la ausencia sea visible.
   */
  for (
    const expectedId
    of expectedAutomaticIds
  ) {
    if (
      !actualPendingIds.includes(
        expectedId,
      )
    ) {
      blocked.push({
        operationId:
          expectedId,

        blueprintId:
          expectedId.replace(
            'create_role:',
            '',
          ),

        name:
          null,

        reasons: [
          'Operación automática esperada ausente.',
        ],
      });
    }
  }

  const automaticIds =
    automatic.map(
      item =>
        item.operationId,
    );

  addCheck(
    checks,
    'automatic_set_exact',
    automatic.length ===
      22 &&
    sameStringSet(
      automaticIds,
      expectedAutomaticIds,
    ),
    'Automatic contiene exactamente los 22 operation IDs permitidos.',
    'Automatic no coincide exactamente con la allowlist de 22 roles.',
  );

  addCheck(
    checks,
    'manual_set_exact',
    manual.length ===
      1 &&
    manual[0]
      ?.operationId ===
        OWNER_OPERATION_ID &&
    manual[0]
      ?.blueprintId ===
        'role_owner',
    'Manual contiene únicamente create_role:role_owner.',
    'La clasificación manual no contiene exactamente role_owner.',
  );

  addCheck(
    checks,
    'automatic_zero_permissions',
    automatic.every(
      item =>
        item.permissions ===
          '0',
    ),
    'Los 22 payloads automáticos tienen permissions=0.',
    'Uno o más payloads automáticos contienen permisos Discord.',
  );

  addCheck(
    checks,
    'no_privileged_automatic_roles',
    automatic.every(
      item =>
        !PRIVILEGED_BLUEPRINT_IDS
          .has(
            item.blueprintId,
          ),
    ),
    'Ningún rol privilegiado aparece en automatic.',
    'Automatic contiene role_owner, role_administrator o role_compai.',
  );

  addCheck(
    checks,
    'no_role_blocks',
    blocked.length ===
      0,
    'No existen roles bloqueados.',
    `Existen ${blocked.length} entradas bloqueadas.`,
  );

  /*
   * ======================================================
   * FINAL
   * ======================================================
   */

  const blockCount =
    checks.filter(
      check =>
        check.status ===
          'block',
    ).length;

  const passCount =
    checks.filter(
      check =>
        check.status ===
          'pass',
    ).length;

  const valid =
    blockCount ===
      0 &&
    automatic.length ===
      22 &&
    manual.length ===
      1 &&
    blocked.length ===
      0;

  const withoutFingerprint:
    Omit<
      RolePhasePlan,
      'planFingerprint'
    > = {
    schemaVersion:
      1,

    fingerprintVersion:
      1,

    generatedAt:
      now.toISOString(),

    guildId:
      input.operations
        .guild.id,

    source: {
      blueprintFingerprint:
        input.blueprint
          .fingerprint,

      operationsFingerprint,

      hierarchyFingerprint,

      provenanceFingerprint:
        input.provenance
          .lineageFingerprint,
    },

    summary: {
      totalCreateRoles:
        createRoleOperations
          .length,

      automaticRoles:
        automatic.length,

      manualRoles:
        manual.length,

      blockedRoles:
        blocked.length,

      pass:
        passCount,

      block:
        blockCount,

      valid,
    },

    automatic,

    manual,

    blocked,

    checks,

    controls: {
      continuationAllowed:
        false,

      executionAllowed:
        false,
    },
  };

  return {
    ...withoutFingerprint,

    planFingerprint:
      createRolePhasePlanFingerprint(
        withoutFingerprint,
      ),
  };
}

export function verifyRolePhasePlan(
  supplied:
    RolePhasePlan,

  input:
    RolePhasePlanInput,

  now =
    new Date(),
): RolePhasePlanVerification {
  const checks:
    RolePhasePlanCheck[] =
    [];

  const recalculatedFingerprint =
    createRolePhasePlanFingerprint(
      supplied,
    );

  addCheck(
    checks,
    'plan_fingerprint',
    supplied
      .schemaVersion ===
        1 &&
    supplied
      .fingerprintVersion ===
        1 &&
    supplied
      .planFingerprint ===
        recalculatedFingerprint,
    'Role Phase Plan fingerprint válido.',
    'Role Phase Plan fingerprint inválido.',
  );

  let expected:
    RolePhasePlan |
    null =
    null;

  try {
    expected =
      createRolePhasePlan(
        input,
        new Date(
          supplied.generatedAt,
        ),
      );
  } catch {
    expected =
      null;
  }

  addCheck(
    checks,
    'plan_reconstruction',
    expected !==
      null &&
    canonicalJson(
      expected,
    ) ===
      canonicalJson(
        supplied,
      ),
    'Role Phase Plan coincide exactamente con una reconstrucción desde sus fuentes.',
    'Role Phase Plan no coincide con sus fuentes actuales.',
  );

  addCheck(
    checks,
    'execution_boundary',
    supplied.controls
      ?.continuationAllowed ===
        false &&
    supplied.controls
      ?.executionAllowed ===
        false,
    'El plan no autoriza continuación ni ejecución.',
    'La frontera de ejecución del plan fue alterada.',
  );

  addCheck(
    checks,
    'valid_summary',
    supplied.summary
      ?.valid ===
        true &&
    supplied.summary
      ?.block ===
        0 &&
    supplied.summary
      ?.automaticRoles ===
        22 &&
    supplied.summary
      ?.manualRoles ===
        1 &&
    supplied.summary
      ?.blockedRoles ===
        0,
    'Summary Role Phase v1 válido: 22 automatic, 1 manual, 0 block.',
    'Summary Role Phase v1 no cumple la frontera esperada.',
  );

  const block =
    checks.filter(
      check =>
        check.status ===
          'block',
    ).length;

  const pass =
    checks.filter(
      check =>
        check.status ===
          'pass',
    ).length;

  return {
    schemaVersion:
      1,

    verifiedAt:
      now.toISOString(),

    status:
      block ===
        0
        ? 'valid'
        : 'blocked',

    checks,

    summary: {
      pass,

      block,

      valid:
        block ===
          0,
    },

    executionAllowed:
      false,
  };
}

export function renderRolePhasePlan(
  plan:
    RolePhasePlan,
): string {
  return [
    'THE CLOCK — ROLE PHASE PLAN v1',
    '==============================',
    '',
    `Guild: ${plan.guildId}`,
    `Generado: ${plan.generatedAt}`,
    '',
    `CREATE_ROLE total: ${plan.summary.totalCreateRoles}`,
    `Automáticos:       ${plan.summary.automaticRoles}`,
    `Manuales:          ${plan.summary.manualRoles}`,
    `Bloqueados:        ${plan.summary.blockedRoles}`,
    '',
    'AUTOMATIC',
    '---------',
    ...plan.automatic.map(
      item =>
        [
          `${item.operationId}`,
          `  Blueprint:   ${item.blueprintId}`,
          `  Nombre:      ${item.name}`,
          `  Permissions: ${item.permissions}`,
          `  Hoist:       ${String(item.hoist)}`,
          `  Mentionable: ${String(item.mentionable)}`,
        ].join(
          '\n',
        ),
    ),
    '',
    'MANUAL_BOOTSTRAP',
    '----------------',
    ...plan.manual.map(
      item =>
        `${item.operationId} — ${item.name}`,
    ),
    '',
    'CHECKS',
    '------',
    ...plan.checks.map(
      check =>
        `[${check.status.toUpperCase()}] ${check.id} — ${check.details}`,
    ),
    '',
    `PASS:  ${plan.summary.pass}`,
    `BLOCK: ${plan.summary.block}`,
    `Plan válido: ${plan.summary.valid ? 'SÍ' : 'NO'}`,
    '',
    `Fingerprint: ${plan.planFingerprint}`,
    '',
    'CONTINUACIÓN AUTOMÁTICA: NO',
    'EJECUCIÓN PERMITIDA: NO',
    'CONEXIÓN A DISCORD: NO',
    'MUTACIONES DISCORD: 0',
    '',
  ].join(
    '\n',
  );
}
