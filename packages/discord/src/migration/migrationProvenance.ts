import {
  createHash,
} from 'node:crypto';

import {
  DISCORD_CATEGORIES,
} from '../blueprint/categories.js';

import {
  DISCORD_CHANNELS,
} from '../blueprint/channels.js';

import {
  DISCORD_ROLES,
} from '../blueprint/roles.js';

import {
  createDiscordBlueprintContentFingerprint,
} from '../blueprint/artifact.js';

import {
  createMigrationPlan,
} from './planner.js';

import {
  createMigrationOperationsPlan,
} from './operationsPlanner.js';

import {
  createExecutionPreview,
} from './executionPreview.js';

import type {
  MigrationProvenanceArtifact,
  MigrationProvenanceCheck,
  MigrationProvenanceInput,
  MigrationProvenanceVerification,
} from './migrationProvenanceTypes.js';

function canonicalize(
  value:
    unknown,
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
        Record<
          string,
          unknown
        >;

    const output:
      Record<
        string,
        unknown
      > = {};

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
  value:
    unknown,
): string {
  return JSON.stringify(
    canonicalize(
      value,
    ),
  );
}

function sha256(
  value:
    unknown,
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
  value:
    unknown,
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

  /*
   * Los builders actuales generan su propia
   * hora, así que generatedAt no forma parte
   * de la identidad semántica del resultado.
   */
  delete clone.generatedAt;

  return clone;
}

export function createMigrationProvenanceArtifactFingerprint(
  kind:
    | 'snapshot'
    | 'bindings'
    | 'plan'
    | 'operations'
    | 'preview',
  value:
    unknown,
): string {
  return sha256({
    fingerprintVersion:
      1,

    kind,

    artifact:
      kind ===
        'plan' ||
      kind ===
        'operations' ||
      kind ===
        'preview'
        ? semanticArtifact(
            value,
          )
        : value,
  });
}

function createRootFingerprint(
  blueprintFingerprint:
    string,
  snapshotFingerprint:
    string,
  bindingsFingerprint:
    string,
): string {
  return sha256({
    lineageVersion:
      1,

    stage:
      'migration_root',

    blueprintFingerprint,

    snapshotFingerprint,

    bindingsFingerprint,
  });
}

function createPlanLineageFingerprint(
  rootFingerprint:
    string,
  planFingerprint:
    string,
): string {
  return sha256({
    lineageVersion:
      1,

    stage:
      'migration_plan',

    parent:
      rootFingerprint,

    content:
      planFingerprint,
  });
}

function createOperationsLineageFingerprint(
  planLineageFingerprint:
    string,
  operationsFingerprint:
    string,
): string {
  return sha256({
    lineageVersion:
      1,

    stage:
      'migration_operations',

    parent:
      planLineageFingerprint,

    content:
      operationsFingerprint,
  });
}

function createPreviewLineageFingerprint(
  operationsLineageFingerprint:
    string,
  previewFingerprint:
    string,
): string {
  return sha256({
    lineageVersion:
      1,

    stage:
      'execution_preview',

    parent:
      operationsLineageFingerprint,

    content:
      previewFingerprint,
  });
}

function addCheck(
  checks:
    MigrationProvenanceCheck[],
  id:
    string,
  condition:
    boolean,
  passDetails:
    string,
  blockDetails:
    string,
): void {
  checks.push({
    id,

    status:
      condition
        ? 'pass'
        : 'block',

    details:
      condition
        ? passDetails
        : blockDetails,
  });
}

function evaluateMigrationProvenance(
  input:
    MigrationProvenanceInput,
  now:
    Date,
): MigrationProvenanceArtifact {
  const checks:
    MigrationProvenanceCheck[] =
    [];

  /*
   * ======================================================
   * BLUEPRINT
   * ======================================================
   */

  const declaredBlueprintFingerprint =
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

  const currentBlueprintFingerprint =
    createDiscordBlueprintContentFingerprint({
      schemaVersion:
        1,

      blueprintVersion:
        1,

      categories:
        structuredClone(
          DISCORD_CATEGORIES,
        ),

      channels:
        structuredClone(
          DISCORD_CHANNELS,
        ),

      roles:
        structuredClone(
          DISCORD_ROLES,
        ),
    });

  const blueprintValid =
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
      .executionAllowed ===
      false &&
    input.blueprint
      .fingerprint ===
      declaredBlueprintFingerprint &&
    input.blueprint
      .fingerprint ===
      currentBlueprintFingerprint;

  addCheck(
    checks,
    'blueprint_root_integrity',
    blueprintValid,
    'Blueprint Artifact coincide con el Blueprint actualmente cargado por los planners.',
    [
      'Blueprint Artifact no coincide con el Blueprint utilizado por el código.',
      `Declarado=${input.blueprint.fingerprint}.`,
      `Contenido=${declaredBlueprintFingerprint}.`,
      `Actual=${currentBlueprintFingerprint}.`,
    ].join(
      ' ',
    ),
  );

  /*
   * ======================================================
   * SOURCE FINGERPRINTS
   * ======================================================
   */

  const snapshotFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'snapshot',
      input.snapshot,
    );

  const bindingsFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'bindings',
      input.bindings,
    );

  const rootFingerprint =
    createRootFingerprint(
      input.blueprint
        .fingerprint,
      snapshotFingerprint,
      bindingsFingerprint,
    );

  const sameGuild =
    input.snapshot
      .guild.id ===
      input.bindings
        .guildId &&
    input.operations
      .guild.id ===
      input.snapshot
        .guild.id &&
    input.preview
      .guild.id ===
      input.snapshot
        .guild.id;

  addCheck(
    checks,
    'guild_identity',
    sameGuild,
    `Guild confirmado: ${input.snapshot.guild.id}.`,
    'Snapshot, Bindings, Operations y Preview no pertenecen al mismo Guild.',
  );

  /*
   * ======================================================
   * PLAN REPRODUCIBILITY
   * ======================================================
   */

  const suppliedPlanFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'plan',
      input.plan,
    );

  const expectedPlan =
    createMigrationPlan(
      structuredClone(
        input.snapshot,
      ),
      structuredClone(
        input.bindings,
      ),
    );

  const expectedPlanFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'plan',
      expectedPlan,
    );

  const planReproducible =
    suppliedPlanFingerprint ===
      expectedPlanFingerprint;

  addCheck(
    checks,
    'plan_reproducibility',
    planReproducible,
    'Migration Plan es reproducible desde Blueprint + Snapshot + Bindings.',
    [
      'Migration Plan no es reproducible desde sus fuentes declaradas.',
      `Supplied=${suppliedPlanFingerprint}.`,
      `Expected=${expectedPlanFingerprint}.`,
    ].join(
      ' ',
    ),
  );

  /*
   * ======================================================
   * OPERATIONS REPRODUCIBILITY
   * ======================================================
   */

  const suppliedOperationsFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'operations',
      input.operations,
    );

  const expectedOperations =
    createMigrationOperationsPlan(
      structuredClone(
        input.snapshot,
      ),
      structuredClone(
        input.bindings,
      ),
    );

  const expectedOperationsFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'operations',
      expectedOperations,
    );

  const operationsReproducible =
    suppliedOperationsFingerprint ===
      expectedOperationsFingerprint;

  addCheck(
    checks,
    'operations_reproducibility',
    operationsReproducible,
    'Migration Operations es reproducible desde el mismo root de Snapshot + Bindings + Blueprint.',
    [
      'Migration Operations no es reproducible desde el root declarado.',
      `Supplied=${suppliedOperationsFingerprint}.`,
      `Expected=${expectedOperationsFingerprint}.`,
    ].join(
      ' ',
    ),
  );

  /*
   * ======================================================
   * PREVIEW REPRODUCIBILITY
   * ======================================================
   */

  const suppliedPreviewFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'preview',
      input.preview,
    );

  const expectedPreview =
    createExecutionPreview(
      structuredClone(
        input.snapshot,
      ),
      structuredClone(
        input.bindings,
      ),
      structuredClone(
        input.operations,
      ),
    );

  const expectedPreviewFingerprint =
    createMigrationProvenanceArtifactFingerprint(
      'preview',
      expectedPreview,
    );

  const previewReproducible =
    suppliedPreviewFingerprint ===
      expectedPreviewFingerprint;

  addCheck(
    checks,
    'preview_reproducibility',
    previewReproducible,
    'Execution Preview es reproducible desde Snapshot + Bindings + Operations.',
    [
      'Execution Preview no es reproducible desde sus padres declarados.',
      `Supplied=${suppliedPreviewFingerprint}.`,
      `Expected=${expectedPreviewFingerprint}.`,
    ].join(
      ' ',
    ),
  );

  /*
   * ======================================================
   * LINEAGE CHAIN
   * ======================================================
   */

  const planLineageFingerprint =
    createPlanLineageFingerprint(
      rootFingerprint,
      suppliedPlanFingerprint,
    );

  const operationsLineageFingerprint =
    createOperationsLineageFingerprint(
      planLineageFingerprint,
      suppliedOperationsFingerprint,
    );

  const previewLineageFingerprint =
    createPreviewLineageFingerprint(
      operationsLineageFingerprint,
      suppliedPreviewFingerprint,
    );

  addCheck(
    checks,
    'execution_boundary',
    input.preview
      .dryRunOnly ===
      true &&
    input.preview
      .executionAllowed ===
      false &&
    input.blueprint
      .executionAllowed ===
      false,
    'Provenance conserva las fronteras no ejecutables.',
    'Una frontera executionAllowed/dryRunOnly fue alterada.',
  );

  const pass =
    checks.filter(
      (check) =>
        check.status ===
          'pass',
    ).length;

  const block =
    checks.filter(
      (check) =>
        check.status ===
          'block',
    ).length;

  return {
    schemaVersion:
      1,

    fingerprintVersion:
      1,

    generatedAt:
      now.toISOString(),

    guildId:
      input.snapshot
        .guild.id,

    source: {
      blueprintFingerprint:
        input.blueprint
          .fingerprint,

      snapshotFingerprint,

      bindingsFingerprint,

      rootFingerprint,
    },

    artifacts: {
      planFingerprint:
        suppliedPlanFingerprint,

      operationsFingerprint:
        suppliedOperationsFingerprint,

      previewFingerprint:
        suppliedPreviewFingerprint,
    },

    lineage: {
      planFingerprint:
        planLineageFingerprint,

      operationsFingerprint:
        operationsLineageFingerprint,

      previewFingerprint:
        previewLineageFingerprint,
    },

    lineageFingerprint:
      previewLineageFingerprint,

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

export function createMigrationProvenance(
  input:
    MigrationProvenanceInput,
  now = new Date(),
): MigrationProvenanceArtifact {
  return evaluateMigrationProvenance(
    input,
    now,
  );
}

export function verifyMigrationProvenance(
  supplied:
    MigrationProvenanceArtifact,
  input:
    MigrationProvenanceInput,
  now = new Date(),
): MigrationProvenanceVerification {
  const expected =
    evaluateMigrationProvenance(
      input,
      now,
    );

  const checks:
    MigrationProvenanceCheck[] =
    [];

  addCheck(
    checks,
    'schema_version',
    supplied.schemaVersion ===
      1 &&
    supplied.fingerprintVersion ===
      1,
    'Provenance schema/fingerprint v1 confirmado.',
    'Provenance usa una versión no soportada.',
  );

  addCheck(
    checks,
    'guild_identity',
    supplied.guildId ===
      expected.guildId,
    'Guild del Provenance coincide.',
    'El Provenance pertenece a otro Guild.',
  );

  addCheck(
    checks,
    'source_fingerprints',
    canonicalJson(
      supplied.source,
    ) ===
      canonicalJson(
        expected.source,
      ),
    'Fingerprints de Blueprint/Snapshot/Bindings coinciden.',
    'Uno o más fingerprints de fuentes cambiaron.',
  );

  addCheck(
    checks,
    'artifact_fingerprints',
    canonicalJson(
      supplied.artifacts,
    ) ===
      canonicalJson(
        expected.artifacts,
      ),
    'Fingerprints de Plan/Operations/Preview coinciden.',
    'Uno o más fingerprints de artefactos cambiaron.',
  );

  addCheck(
    checks,
    'lineage_chain',
    canonicalJson(
      supplied.lineage,
    ) ===
      canonicalJson(
        expected.lineage,
      ) &&
    supplied.lineageFingerprint ===
      expected
        .lineageFingerprint,
    'Cadena de lineage completa coincide.',
    'La cadena de lineage fue alterada o pertenece a otros padres.',
  );

  addCheck(
    checks,
    'reproducibility',
    expected.summary.valid,
    'Los artefactos continúan siendo reproducibles desde sus fuentes.',
    'Uno o más artefactos dejaron de ser reproducibles.',
  );

  addCheck(
    checks,
    'execution_boundary',
    supplied.executionAllowed ===
      false &&
    expected.executionAllowed ===
      false,
    'Provenance no autoriza ejecución.',
    'La frontera executionAllowed fue alterada.',
  );

  const pass =
    checks.filter(
      (check) =>
        check.status ===
          'pass',
    ).length;

  const block =
    checks.filter(
      (check) =>
        check.status ===
          'block',
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

    expected,

    supplied:
      structuredClone(
        supplied,
      ),

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
