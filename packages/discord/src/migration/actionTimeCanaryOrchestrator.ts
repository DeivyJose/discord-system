import type {
  DiscordChannelSnapshot,
  DiscordGuildSnapshot,
  DiscordRoleSnapshot,
} from '../inspector/types.js';

import {
  evaluateSingleOperationCanary,
} from './canaryGuard.js';

import {
  normalizeDiscordStructureSnapshot,
} from './liveDrift.js';

import type {
  ActionTimeCanaryCheck,
  ActionTimeCanaryFailure,
  ActionTimeCanaryOptions,
  ActionTimeCanaryResult,
  ActionTimeCanaryStatus,
} from './actionTimeCanaryTypes.js';

import type {
  CanaryGuardResult,
} from './canaryGuardTypes.js';

import type {
  SingleUseCanaryTransportResult,
} from './canaryTransportTypes.js';

const TARGET_NAME =
  'Avisos CDN' as const;

function currentTime(
  options:
    ActionTimeCanaryOptions,
): Date {
  return options.now
    ? options.now()
    : new Date();
}

function addCheck(
  checks:
    ActionTimeCanaryCheck[],
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

function cloneAndSortPermissions(
  permissions:
    string[],
): string[] {
  return [
    ...permissions,
  ].sort();
}

/**
 * position queda fuera deliberadamente.
 *
 * Crear un rol puede hacer que Discord recalcule
 * posiciones relativas de roles ya existentes.
 * No queremos interpretar ese comportamiento
 * propio de Discord como una mutación concurrente.
 */
function comparableExistingRole(
  role:
    DiscordRoleSnapshot,
): Record<
  string,
  unknown
> {
  return {
    id:
      role.id,

    name:
      role.name,

    color:
      role.color,

    hexColor:
      role.hexColor,

    hoist:
      role.hoist,

    mentionable:
      role.mentionable,

    managed:
      role.managed,

    permissions:
      cloneAndSortPermissions(
        role.permissions,
      ),
  };
}

function canonicalExistingRoles(
  roles:
    DiscordRoleSnapshot[],
): string {
  return JSON.stringify(
    roles
      .map(
        comparableExistingRole,
      )
      .sort(
        (left, right) =>
          String(
            left.id,
          ).localeCompare(
            String(
              right.id,
            ),
          ),
      ),
  );
}

function canonicalChannels(
  channels:
    DiscordChannelSnapshot[],
): string {
  return JSON.stringify(
    [
      ...channels,
    ].sort(
      (left, right) =>
        left.id.localeCompare(
          right.id,
        ),
    ),
  );
}

function snapshotDateIsValid(
  value:
    string,
): boolean {
  return Number.isFinite(
    new Date(
      value,
    ).getTime(),
  );
}

function errorMessage(
  error:
    unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(
        error,
      );
}

function buildResult(
  options: {
    startedAt:
      string;

    status:
      ActionTimeCanaryStatus;

    checks:
      ActionTimeCanaryCheck[];

    guard:
      CanaryGuardResult |
      null;

    transportResult:
      SingleUseCanaryTransportResult |
      null;

    preSnapshotCapturedAt:
      string |
      null;

    postSnapshotCapturedAt:
      string |
      null;

    transportAttempts:
      number;

    mutationCalls:
      number;

    requiresManualInspection:
      boolean;

    failure:
      ActionTimeCanaryFailure |
      null;

    finishedAt:
      string;
  },
): ActionTimeCanaryResult {
  return {
    schemaVersion: 1,

    startedAt:
      options.startedAt,

    finishedAt:
      options.finishedAt,

    status:
      options.status,

    checks:
      options.checks,

    guard:
      options.guard,

    transportResult:
      options.transportResult,

    preSnapshotCapturedAt:
      options.preSnapshotCapturedAt,

    postSnapshotCapturedAt:
      options.postSnapshotCapturedAt,

    transportAttempts:
      options.transportAttempts,

    mutationCalls:
      options.mutationCalls,

    requiresManualInspection:
      options
        .requiresManualInspection,

    failure:
      options.failure,

    executionAllowed:
      false,
  };
}

export async function runActionTimeCanary(
  options:
    ActionTimeCanaryOptions,
): Promise<
  ActionTimeCanaryResult
> {
  const startedAt =
    currentTime(
      options,
    ).toISOString();

  const checks:
    ActionTimeCanaryCheck[] =
    [];

  let guard:
    CanaryGuardResult |
    null =
    null;

  let transportResult:
    SingleUseCanaryTransportResult |
    null =
    null;

  let preSnapshot:
    DiscordGuildSnapshot |
    null =
    null;

  let postSnapshot:
    DiscordGuildSnapshot |
    null =
    null;

  /*
   * ======================================================
   * 0. EL TRANSPORTE DEBE ESTAR VIRGEN
   * ======================================================
   */

  const transportVirgin =
    !options.transport
      .isConsumed() &&
    options.transport
      .getAttempts() ===
      0 &&
    options.transport
      .getMutationCalls() ===
      0;

  addCheck(
    checks,
    'transport_virgin',
    transportVirgin,
    'El transporte Canary no ha sido utilizado.',
    'El transporte Canary ya fue utilizado o contiene intentos previos.',
  );

  if (
    !transportVirgin
  ) {
    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        null,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'guard',

        message:
          'El transporte Canary no está virgen.',
      },
    });
  }

  /*
   * ======================================================
   * 1. SNAPSHOT PRE
   * ======================================================
   */

  try {
    preSnapshot =
      await options
        .snapshotProvider
        .capture();
  } catch (
    error
  ) {
    addCheck(
      checks,
      'pre_snapshot_capture',
      false,
      '',
      `No fue posible capturar snapshot PRE: ${errorMessage(error)}`,
    );

    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        null,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'pre_inspection',

        message:
          errorMessage(
            error,
          ),
      },
    });
  }

  addCheck(
    checks,
    'pre_snapshot_capture',
    true,
    `Snapshot PRE capturado: ${preSnapshot.capturedAt}.`,
    '',
  );

  /*
   * ======================================================
   * 2. NORMALIZAR + GUARD ACTION-TIME
   * ======================================================
   */

  let normalizedPre;

  try {
    normalizedPre =
      normalizeDiscordStructureSnapshot(
        preSnapshot,
      );
  } catch (
    error
  ) {
    addCheck(
      checks,
      'pre_snapshot_normalization',
      false,
      '',
      `Snapshot PRE inválido: ${errorMessage(error)}`,
    );

    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        preSnapshot.capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'pre_inspection',

        message:
          errorMessage(
            error,
          ),
      },
    });
  }

  addCheck(
    checks,
    'pre_snapshot_normalization',
    true,
    'Snapshot PRE normalizado correctamente.',
    '',
  );

  guard =
    evaluateSingleOperationCanary({
      session:
        options.session,

      baseline:
        options.baseline,

      currentSnapshot:
        normalizedPre,

      now:
        currentTime(
          options,
        ),
    });

  const guardReady =
    guard.status ===
      'ready_for_simulation' &&
    guard.intent !==
      null;

  addCheck(
    checks,
    'action_time_guard',
    guardReady,
    'Canary Guard inicial válido antes de autorización humana.',
    'Canary Guard inicial bloqueó antes de autorización humana.',
  );

  if (
    !guardReady ||
    !guard.intent
  ) {
    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        preSnapshot.capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'guard',

        message:
          'Canary Guard action-time bloqueado.',
      },
    });
  }

  /*
   * ======================================================
   * 3. AUTORIZACIÓN HUMANA ACTION-TIME
   * ======================================================
   *
   * Esta autorización se concede sobre el intent
   * producido por el primer Guard.
   *
   * Una respuesta true NO alcanza directamente
   * el transporte.
   */
  const authorizedIntent =
    structuredClone(
      guard.intent,
    );

  let actionAuthorized =
    false;

  try {
    actionAuthorized =
      await options
        .authorizeIntent(
          structuredClone(
            authorizedIntent,
          ),
        );
  } catch (
    error
  ) {
    addCheck(
      checks,
      'explicit_action_authorization',
      false,
      '',
      `La autorización humana falló: ${errorMessage(error)}`,
    );

    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        preSnapshot.capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'authorization',

        message:
          'La autorización humana action-time produjo un error.',
      },
    });
  }

  addCheck(
    checks,
    'explicit_action_authorization',
    actionAuthorized,
    'Autorización humana action-time confirmada.',
    'La autorización humana action-time fue rechazada.',
  );

  if (
    !actionAuthorized
  ) {
    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        preSnapshot.capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'authorization',

        message:
          'La autorización humana action-time no fue concedida.',
      },
    });
  }

  /*
   * ======================================================
   * 4. SEGUNDO SNAPSHOT PRE DESPUÉS DE AUTORIZACIÓN
   * ======================================================
   *
   * Cierra la ventana TOCTOU introducida por el tiempo
   * que el humano puede tardar en confirmar.
   *
   * Todavía NO se ha llamado al transporte.
   */
  let postAuthorizationPreSnapshot:
    DiscordGuildSnapshot;

  try {
    postAuthorizationPreSnapshot =
      await options
        .snapshotProvider
        .capture();
  } catch (
    error
  ) {
    addCheck(
      checks,
      'post_authorization_pre_snapshot_capture',
      false,
      '',
      `No fue posible capturar PRE2 después de autorización: ${errorMessage(error)}`,
    );

    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        preSnapshot.capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'post_authorization_inspection',

        message:
          errorMessage(
            error,
          ),
      },
    });
  }

  addCheck(
    checks,
    'post_authorization_pre_snapshot_capture',
    true,
    `PRE2 capturado después de autorización: ${postAuthorizationPreSnapshot.capturedAt}.`,
    '',
  );

  let postAuthorizationNormalizedPre;

  try {
    postAuthorizationNormalizedPre =
      normalizeDiscordStructureSnapshot(
        postAuthorizationPreSnapshot,
      );
  } catch (
    error
  ) {
    addCheck(
      checks,
      'post_authorization_pre_snapshot_normalization',
      false,
      '',
      `PRE2 inválido después de autorización: ${errorMessage(error)}`,
    );

    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        postAuthorizationPreSnapshot
          .capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'post_authorization_inspection',

        message:
          errorMessage(
            error,
          ),
      },
    });
  }

  addCheck(
    checks,
    'post_authorization_pre_snapshot_normalization',
    true,
    'PRE2 normalizado correctamente después de autorización.',
    '',
  );

  /*
   * ======================================================
   * 5. SEGUNDO GUARD INMEDIATAMENTE ANTES DEL TRANSPORTE
   * ======================================================
   */
  const postAuthorizationGuard =
    evaluateSingleOperationCanary({
      session:
        options.session,

      baseline:
        options.baseline,

      currentSnapshot:
        postAuthorizationNormalizedPre,

      now:
        currentTime(
          options,
        ),
    });

  const postAuthorizationGuardReady =
    postAuthorizationGuard.status ===
      'ready_for_simulation' &&
    postAuthorizationGuard.intent !==
      null;

  addCheck(
    checks,
    'post_authorization_guard',
    postAuthorizationGuardReady,
    'Segundo Canary Guard válido después de autorización.',
    'Segundo Canary Guard bloqueó antes del transporte.',
  );

  if (
    !postAuthorizationGuardReady ||
    !postAuthorizationGuard.intent
  ) {
    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard:
        postAuthorizationGuard,

      transportResult,

      preSnapshotCapturedAt:
        postAuthorizationPreSnapshot
          .capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'post_authorization_guard',

        message:
          'El segundo Canary Guard bloqueó después de la autorización.',
      },
    });
  }

  /*
   * La autorización humana fue dada para authorizedIntent.
   *
   * El intent producido por PRE2 + Guard2 debe ser
   * exactamente idéntico antes de permitir transporte.
   */
  /*
   * Guard2 ya confirmó que intent !== null.
   *
   * Conservamos una copia concreta para que:
   * - TypeScript mantenga el narrowing;
   * - la comparación use exactamente el intent
   *   que llegará al transporte;
   * - no dependamos de la variable guard reasignada.
   */
  const executionIntent =
    structuredClone(
      postAuthorizationGuard.intent,
    );

  const postAuthorizationIntentMatches =
    JSON.stringify(
      authorizedIntent,
    ) ===
    JSON.stringify(
      executionIntent,
    );

  addCheck(
    checks,
    'post_authorization_intent_match',
    postAuthorizationIntentMatches,
    'El intent posterior a autorización coincide exactamente con el intent autorizado.',
    'El intent cambió después de la autorización humana.',
  );

  if (
    !postAuthorizationIntentMatches
  ) {
    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'blocked_before_transport',

      checks,

      guard:
        postAuthorizationGuard,

      transportResult,

      preSnapshotCapturedAt:
        postAuthorizationPreSnapshot
          .capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        false,

      failure: {
        stage:
          'post_authorization_guard',

        message:
          'El intent cambió entre Guard1 y Guard2.',
      },
    });
  }

  /*
   * Desde aquí PRE2 se convierte en el PRE efectivo.
   *
   * Las postcondiciones posteriores deben comparar
   * Discord POST contra el estado observado
   * inmediatamente antes del transporte.
   */
  preSnapshot =
    postAuthorizationPreSnapshot;

  guard =
    postAuthorizationGuard;

  /*
   * ======================================================
   * 6. ÚNICA EJECUCIÓN DEL TRANSPORTE
   * ======================================================
   */
  try {
    transportResult =
      await options.transport
        .execute(
          executionIntent,
        );
  } catch (
    error
  ) {
    const mutationCalls =
      options.transport
        .getMutationCalls();

    addCheck(
      checks,
      'transport_execution',
      false,
      '',
      `El transporte Canary falló: ${errorMessage(error)}`,
    );

    /*
     * Si createRole pudo haber sido invocado,
     * intentamos una reinspección diagnóstica.
     *
     * NO reintentamos.
     * NO hacemos rollback.
     */
    if (
      mutationCalls >
      0
    ) {
      try {
        postSnapshot =
          await options
            .snapshotProvider
            .capture();

        addCheck(
          checks,
          'ambiguous_failure_reinspection',
          true,
          `Se capturó snapshot diagnóstico POST: ${postSnapshot.capturedAt}.`,
          '',
        );
      } catch (
        inspectionError
      ) {
        addCheck(
          checks,
          'ambiguous_failure_reinspection',
          false,
          '',
          `También falló la reinspección posterior: ${errorMessage(inspectionError)}`,
        );
      }
    }

    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'transport_failed',

      checks,

      guard,

      transportResult:
        null,

      preSnapshotCapturedAt:
        preSnapshot.capturedAt,

      postSnapshotCapturedAt:
        postSnapshot
          ?.capturedAt ??
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls,

      requiresManualInspection:
        mutationCalls >
        0,

      failure: {
        stage:
          'transport',

        message:
          errorMessage(
            error,
          ),
      },
    });
  }

  addCheck(
    checks,
    'transport_execution',
    true,
    `Transporte completó exactamente una operación: ${transportResult.actualId}.`,
    '',
  );

  /*
   * ======================================================
   * 4. SNAPSHOT POST
   * ======================================================
   */

  try {
    postSnapshot =
      await options
        .snapshotProvider
        .capture();
  } catch (
    error
  ) {
    addCheck(
      checks,
      'post_snapshot_capture',
      false,
      '',
      `La mutación respondió, pero no fue posible capturar snapshot POST: ${errorMessage(error)}`,
    );

    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'postcondition_failed',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        preSnapshot.capturedAt,

      postSnapshotCapturedAt:
        null,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        true,

      failure: {
        stage:
          'post_inspection',

        message:
          errorMessage(
            error,
          ),
      },
    });
  }

  addCheck(
    checks,
    'post_snapshot_capture',
    true,
    `Snapshot POST capturado: ${postSnapshot.capturedAt}.`,
    '',
  );

  /*
   * ======================================================
   * 5. POSTCONDITIONS
   * ======================================================
   */

  const sameGuild =
    preSnapshot.guild.id ===
      options.session.guild.id &&
    postSnapshot.guild.id ===
      options.session.guild.id &&
    transportResult.guildId ===
      options.session.guild.id;

  addCheck(
    checks,
    'post_guild_identity',
    sameGuild,
    `Guild POST confirmado: ${options.session.guild.id}.`,
    'PRE, POST, Session y resultado no pertenecen al mismo Guild.',
  );

  const snapshotDatesValid =
    snapshotDateIsValid(
      preSnapshot.capturedAt,
    ) &&
    snapshotDateIsValid(
      postSnapshot.capturedAt,
    );

  const postNotOlderThanPre =
    snapshotDatesValid &&
    new Date(
      postSnapshot.capturedAt,
    ).getTime() >=
      new Date(
        preSnapshot.capturedAt,
      ).getTime();

  addCheck(
    checks,
    'post_snapshot_temporal_order',
    postNotOlderThanPre,
    'Snapshot POST no es anterior al snapshot PRE.',
    'El orden temporal PRE/POST es inválido.',
  );

  const preRoleMap =
    new Map(
      preSnapshot.roles.map(
        (role) => [
          role.id,
          role,
        ] as const,
      ),
    );

  const postRoleMap =
    new Map(
      postSnapshot.roles.map(
        (role) => [
          role.id,
          role,
        ] as const,
      ),
    );

  const addedRoleIds =
    postSnapshot.roles
      .filter(
        (role) =>
          !preRoleMap.has(
            role.id,
          ),
      )
      .map(
        (role) =>
          role.id,
      )
      .sort();

  const removedRoleIds =
    preSnapshot.roles
      .filter(
        (role) =>
          !postRoleMap.has(
            role.id,
          ),
      )
      .map(
        (role) =>
          role.id,
      )
      .sort();

  const expectedSingleAddition =
    addedRoleIds.length ===
      1 &&
    addedRoleIds[0] ===
      transportResult.actualId;

  addCheck(
    checks,
    'post_expected_role_addition',
    expectedSingleAddition,
    `La única adición de rol es ${transportResult.actualId}.`,
    `Adiciones inesperadas: ${addedRoleIds.join(', ') || '(ninguna)'}.`,
  );

  addCheck(
    checks,
    'post_no_role_removals',
    removedRoleIds.length ===
      0,
    'No desapareció ningún rol existente.',
    `Roles eliminados inesperadamente: ${removedRoleIds.join(', ')}.`,
  );

  const preExistingRoles =
    preSnapshot.roles
      .filter(
        (role) =>
          postRoleMap.has(
            role.id,
          ),
      );

  const postExistingRoles =
    postSnapshot.roles
      .filter(
        (role) =>
          preRoleMap.has(
            role.id,
          ),
      );

  const existingRolesUnchanged =
    canonicalExistingRoles(
      preExistingRoles,
    ) ===
    canonicalExistingRoles(
      postExistingRoles,
    );

  addCheck(
    checks,
    'post_existing_roles_unchanged',
    existingRolesUnchanged,
    'Roles preexistentes no cambiaron fuera de position.',
    'Uno o más roles preexistentes cambiaron durante el Canary.',
  );

  const channelsUnchanged =
    canonicalChannels(
      preSnapshot.channels,
    ) ===
    canonicalChannels(
      postSnapshot.channels,
    );

  addCheck(
    checks,
    'post_channels_unchanged',
    channelsUnchanged,
    'Canales y categorías permanecen idénticos.',
    'Se detectaron cambios concurrentes en canales o categorías.',
  );

  const createdRole =
    postRoleMap.get(
      transportResult.actualId,
    );

  const targetRoleExact =
    createdRole !==
      undefined &&
    createdRole.name ===
      TARGET_NAME &&
    createdRole.managed ===
      false &&
    createdRole.hoist ===
      false &&
    createdRole.mentionable ===
      true &&
    createdRole.permissions.length ===
      0;

  addCheck(
    checks,
    'post_target_role_exact',
    targetRoleExact,
    'Avisos CDN existe con managed=false, hoist=false, mentionable=true y permissions=0.',
    'El rol creado no cumple exactamente las postcondiciones Canary.',
  );

  const targetNameMatches =
    postSnapshot.roles.filter(
      (role) =>
        role.name ===
          TARGET_NAME,
    );

  const targetUnique =
    targetNameMatches.length ===
      1 &&
    targetNameMatches[0]
      ?.id ===
      transportResult.actualId;

  addCheck(
    checks,
    'post_target_unique',
    targetUnique,
    'Existe exactamente un rol Avisos CDN y coincide con actualId.',
    `Se encontraron ${targetNameMatches.length} roles llamados Avisos CDN.`,
  );

  const transportObservedAligns =
    transportResult.observed.id ===
      transportResult.actualId &&
    transportResult.observed.guildId ===
      options.session.guild.id &&
    transportResult.observed.name ===
      TARGET_NAME &&
    transportResult.observed.managed ===
      false &&
    transportResult.observed.hoist ===
      false &&
    transportResult.observed.mentionable ===
      true &&
    transportResult.observed.permissions ===
      '0';

  addCheck(
    checks,
    'transport_observation_alignment',
    transportObservedAligns,
    'La observación inmediata del transporte coincide con la allowlist.',
    'El resultado inmediato del transporte no coincide con la allowlist.',
  );

  const postconditionsValid =
    checks.every(
      (check) =>
        check.status !==
          'block',
    );

  if (
    !postconditionsValid
  ) {
    return buildResult({
      startedAt,

      finishedAt:
        currentTime(
          options,
        ).toISOString(),

      status:
        'postcondition_failed',

      checks,

      guard,

      transportResult,

      preSnapshotCapturedAt:
        preSnapshot.capturedAt,

      postSnapshotCapturedAt:
        postSnapshot.capturedAt,

      transportAttempts:
        options.transport
          .getAttempts(),

      mutationCalls:
        options.transport
          .getMutationCalls(),

      requiresManualInspection:
        true,

      failure: {
        stage:
          'postcondition',

        message:
          'El estado POST no coincide exactamente con el Canary esperado.',
      },
    });
  }

  /*
   * ======================================================
   * 6. COMPLETADO — STOP
   * ======================================================
   */

  addCheck(
    checks,
    'stop_after_single_operation',
    options.transport
      .getAttempts() ===
        1 &&
    options.transport
      .getMutationCalls() ===
        1 &&
    options.transport
      .isConsumed(),
    'Canary terminó después de una única operación y el transporte quedó consumido.',
    'La frontera single-use no terminó en el estado esperado.',
  );

  const finalValid =
    checks.every(
      (check) =>
        check.status !==
          'block',
    );

  return buildResult({
    startedAt,

    finishedAt:
      currentTime(
        options,
      ).toISOString(),

    status:
      finalValid
        ? 'completed'
        : 'postcondition_failed',

    checks,

    guard,

    transportResult,

    preSnapshotCapturedAt:
      preSnapshot.capturedAt,

    postSnapshotCapturedAt:
      postSnapshot.capturedAt,

    transportAttempts:
      options.transport
        .getAttempts(),

    mutationCalls:
      options.transport
        .getMutationCalls(),

    requiresManualInspection:
      !finalValid,

    failure:
      finalValid
        ? null
        : {
            stage:
              'postcondition',

            message:
              'La frontera single-use terminó en un estado inesperado.',
          },
  });
}
