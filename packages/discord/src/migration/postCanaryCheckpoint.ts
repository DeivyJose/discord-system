import {
  createHash,
} from 'node:crypto';

type JsonRecord =
  Record<string, unknown>;

export interface PostCanaryCheckpointSources {
  report:
    unknown;

  runClaim:
    unknown;

  session:
    unknown;

  postSnapshot:
    unknown;

  bindingsBefore:
    unknown;

  bindingsAfter:
    unknown;
}

export interface PostCanaryCheckpoint {
  schemaVersion:
    1;

  fingerprintVersion:
    1;

  generatedAt:
    string;

  guildId:
    string;

  sessionId:
    string;

  operation: {
    operationId:
      'create_role:role_notify_news';

    blueprintId:
      'role_notify_news';

    targetName:
      'Avisos CDN';

    actualId:
      string;
  };

  execution: {
    status:
      'completed';

    transportAttempts:
      1;

    mutationCalls:
      1;

    transportConsumed:
      true;

    realGatewayPresent:
      true;

    realTransportPresent:
      true;
  };

  postSnapshot: {
    capturedAt:
      string;

    role: {
      id:
        string;

      name:
        'Avisos CDN';

      managed:
        false;

      hoist:
        false;

      mentionable:
        true;

      permissionsCount:
        0;
    };
  };

  bindingTransition: {
    beforeCount:
      13;

    afterCount:
      14;

    blueprintId:
      'role_notify_news';

    before:
      null;

    after:
      string;

    onlyExpectedBindingAdded:
      true;
  };

  authorization: {
    gateFingerprint:
      string;

    gateEnvelopeFingerprint:
      string;

    provenanceFingerprint:
      string;

    authorizedSnapshotCapturedAt:
      string;

    receiptExpiresAt:
      string;

    runClaimedAt:
      string;
  };

  sourceFingerprints: {
    report:
      string;

    runClaim:
      string;

    session:
      string;

    postSnapshot:
      string;

    bindingsBefore:
      string;

    bindingsAfter:
      string;
  };

  controls: {
    retryAutomatic:
      false;

    rollbackAutomatic:
      false;

    continuationAllowed:
      false;

    executionAllowed:
      false;
  };

  checkpointFingerprint:
    string;
}

export interface PostCanaryCheckpointVerification {
  valid:
    boolean;

  checks:
    Array<{
      id:
        string;

      status:
        'pass' | 'block';

      message:
        string;
    }>;
}

function isRecord(
  value:
    unknown,
): value is JsonRecord {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function requireRecord(
  value:
    unknown,

  label:
    string,
): JsonRecord {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new Error(
      `POST_CANARY_INVALID_${label.toUpperCase()}`,
    );
  }

  return value;
}

function requireString(
  value:
    unknown,

  label:
    string,
): string {
  if (
    typeof value !==
      'string' ||
    value.length ===
      0
  ) {
    throw new Error(
      `POST_CANARY_INVALID_${label.toUpperCase()}`,
    );
  }

  return value;
}

function requireBoolean(
  value:
    unknown,

  expected:
    boolean,

  label:
    string,
): void {
  if (
    value !==
      expected
  ) {
    throw new Error(
      `POST_CANARY_INVALID_${label.toUpperCase()}`,
    );
  }
}

function requireNumber(
  value:
    unknown,

  expected:
    number,

  label:
    string,
): void {
  if (
    value !==
      expected
  ) {
    throw new Error(
      `POST_CANARY_INVALID_${label.toUpperCase()}`,
    );
  }
}

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
    isRecord(
      value,
    )
  ) {
    return Object.fromEntries(
      Object.keys(
        value,
      )
        .sort()
        .map(
          key => [
            key,
            canonicalize(
              value[
                key
              ],
            ),
          ],
        ),
    );
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

function fingerprint(
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

function assertValidDate(
  value:
    string,

  label:
    string,
): void {
  if (
    !Number.isFinite(
      new Date(
        value,
      ).getTime(),
    )
  ) {
    throw new Error(
      `POST_CANARY_INVALID_${label.toUpperCase()}`,
    );
  }
}

function getRoles(
  snapshot:
    JsonRecord,
): JsonRecord[] {
  const roles =
    snapshot.roles;

  if (
    !Array.isArray(
      roles,
    )
  ) {
    throw new Error(
      'POST_CANARY_INVALID_SNAPSHOT_ROLES',
    );
  }

  return roles.map(
    (
      value,
      index,
    ) =>
      requireRecord(
        value,
        `snapshot_role_${index}`,
      ),
  );
}

function getResources(
  bindings:
    JsonRecord,

  label:
    string,
): JsonRecord {
  return requireRecord(
    bindings.resources,
    `${label}_resources`,
  );
}

function assertBindingTransition(
  before:
    JsonRecord,

  after:
    JsonRecord,

  actualId:
    string,
): {
  beforeCount:
    13;

  afterCount:
    14;
} {
  const beforeResources =
    getResources(
      before,
      'bindings_before',
    );

  const afterResources =
    getResources(
      after,
      'bindings_after',
    );

  const beforeKeys =
    Object.keys(
      beforeResources,
    );

  const afterKeys =
    Object.keys(
      afterResources,
    );

  if (
    beforeKeys.length !==
      13
  ) {
    throw new Error(
      'POST_CANARY_BINDINGS_BEFORE_COUNT_NOT_13',
    );
  }

  if (
    afterKeys.length !==
      14
  ) {
    throw new Error(
      'POST_CANARY_BINDINGS_AFTER_COUNT_NOT_14',
    );
  }

  if (
    beforeResources[
      'role_notify_news'
    ] !== undefined
  ) {
    throw new Error(
      'POST_CANARY_BINDING_ALREADY_EXISTED_BEFORE',
    );
  }

  if (
    afterResources[
      'role_notify_news'
    ] !== actualId
  ) {
    throw new Error(
      'POST_CANARY_BINDING_AFTER_MISMATCH',
    );
  }

  for (
    const [
      blueprintId,
      id,
    ]
    of Object.entries(
      beforeResources,
    )
  ) {
    if (
      afterResources[
        blueprintId
      ] !== id
    ) {
      throw new Error(
        `POST_CANARY_UNEXPECTED_BINDING_CHANGE_${blueprintId}`,
      );
    }
  }

  const expectedAfterKeys =
    [
      ...beforeKeys,
      'role_notify_news',
    ]
      .sort();

  if (
    canonicalJson(
      [...afterKeys]
        .sort(),
    ) !==
    canonicalJson(
      expectedAfterKeys,
    )
  ) {
    throw new Error(
      'POST_CANARY_UNEXPECTED_BINDING_SET',
    );
  }

  return {
    beforeCount:
      13,

    afterCount:
      14,
  };
}

export function createPostCanaryCheckpoint(
  sources:
    PostCanaryCheckpointSources,

  generatedAt =
    new Date()
      .toISOString(),
): PostCanaryCheckpoint {
  assertValidDate(
    generatedAt,
    'generated_at',
  );

  const report =
    requireRecord(
      sources.report,
      'report',
    );

  const runClaim =
    requireRecord(
      sources.runClaim,
      'run_claim',
    );

  const session =
    requireRecord(
      sources.session,
      'session',
    );

  const postSnapshot =
    requireRecord(
      sources.postSnapshot,
      'post_snapshot',
    );

  const bindingsBefore =
    requireRecord(
      sources.bindingsBefore,
      'bindings_before',
    );

  const bindingsAfter =
    requireRecord(
      sources.bindingsAfter,
      'bindings_after',
    );

  requireNumber(
    report.schemaVersion,
    1,
    'report_schema',
  );

  if (
    report.mode !==
      'live_real_canary_one_shot'
  ) {
    throw new Error(
      'POST_CANARY_REPORT_MODE_MISMATCH',
    );
  }

  if (
    report.operationId !==
      'create_role:role_notify_news'
  ) {
    throw new Error(
      'POST_CANARY_OPERATION_MISMATCH',
    );
  }

  if (
    report.targetName !==
      'Avisos CDN'
  ) {
    throw new Error(
      'POST_CANARY_TARGET_MISMATCH',
    );
  }

  requireNumber(
    report.transportAttempts,
    1,
    'transport_attempts',
  );

  requireNumber(
    report.mutationCalls,
    1,
    'mutation_calls',
  );

  requireBoolean(
    report.transportConsumed,
    true,
    'transport_consumed',
  );

  requireBoolean(
    report.realGatewayPresent,
    true,
    'real_gateway_present',
  );

  requireBoolean(
    report.realTransportPresent,
    true,
    'real_transport_present',
  );

  requireBoolean(
    report.executionAllowed,
    false,
    'report_execution_allowed',
  );

  const result =
    requireRecord(
      report.result,
      'report_result',
    );

  if (
    result.status !==
      'completed'
  ) {
    throw new Error(
      'POST_CANARY_RESULT_NOT_COMPLETED',
    );
  }

  const sessionId =
    requireString(
      report.sessionId,
      'session_id',
    );

  const reportGuild =
    requireRecord(
      report.guild,
      'report_guild',
    );

  const guildId =
    requireString(
      reportGuild.id,
      'guild_id',
    );

  requireNumber(
    runClaim.schemaVersion,
    1,
    'run_claim_schema',
  );

  if (
    runClaim.sessionId !==
      sessionId ||
    runClaim.guildId !==
      guildId
  ) {
    throw new Error(
      'POST_CANARY_RUN_CLAIM_CONTEXT_MISMATCH',
    );
  }

  requireBoolean(
    runClaim.executionAllowed,
    false,
    'run_claim_execution_allowed',
  );

  const gateFingerprint =
    requireString(
      runClaim.gateFingerprint,
      'gate_fingerprint',
    );

  const gateEnvelopeFingerprint =
    requireString(
      runClaim.gateEnvelopeFingerprint,
      'gate_envelope_fingerprint',
    );

  const runClaimedAt =
    requireString(
      runClaim.claimedAt,
      'run_claimed_at',
    );

  assertValidDate(
    runClaimedAt,
    'run_claimed_at',
  );

  requireNumber(
    session.schemaVersion,
    6,
    'session_schema',
  );

  if (
    session.sessionId !==
      sessionId ||
    session.status !==
      'ready'
  ) {
    throw new Error(
      'POST_CANARY_SESSION_CONTEXT_MISMATCH',
    );
  }

  requireBoolean(
    session.executionAllowed,
    false,
    'session_execution_allowed',
  );

  const sessionGuild =
    requireRecord(
      session.guild,
      'session_guild',
    );

  if (
    sessionGuild.id !==
      guildId
  ) {
    throw new Error(
      'POST_CANARY_SESSION_GUILD_MISMATCH',
    );
  }

  if (
    session.gateFingerprint !==
      gateFingerprint ||
    session.gateEnvelopeFingerprint !==
      gateEnvelopeFingerprint
  ) {
    throw new Error(
      'POST_CANARY_SESSION_GATE_MISMATCH',
    );
  }

  const source =
    requireRecord(
      session.source,
      'session_source',
    );

  const authorizedSnapshotCapturedAt =
    requireString(
      source.snapshotCapturedAt,
      'authorized_snapshot_captured_at',
    );

  const receiptExpiresAt =
    requireString(
      source.receiptExpiresAt,
      'receipt_expires_at',
    );

  assertValidDate(
    authorizedSnapshotCapturedAt,
    'authorized_snapshot_captured_at',
  );

  assertValidDate(
    receiptExpiresAt,
    'receipt_expires_at',
  );

  const provenanceBinding =
    requireRecord(
      session.provenanceBinding,
      'provenance_binding',
    );

  requireBoolean(
    provenanceBinding.matchesGate,
    true,
    'provenance_matches_gate',
  );

  requireBoolean(
    provenanceBinding.executionAllowed,
    false,
    'provenance_execution_allowed',
  );

  const provenanceFingerprint =
    requireString(
      provenanceBinding
        .expectedProvenanceFingerprint,
      'provenance_fingerprint',
    );

  for (
    const key
    of [
      'recalculatedProvenanceFingerprint',
      'gateProvenanceFingerprint',
      'receiptProvenanceFingerprint',
    ]
  ) {
    if (
      provenanceBinding[
        key
      ] !==
        provenanceFingerprint
    ) {
      throw new Error(
        `POST_CANARY_PROVENANCE_MISMATCH_${key}`,
      );
    }
  }

  const snapshotGuild =
    requireRecord(
      postSnapshot.guild,
      'post_snapshot_guild',
    );

  if (
    snapshotGuild.id !==
      guildId
  ) {
    throw new Error(
      'POST_CANARY_POST_SNAPSHOT_GUILD_MISMATCH',
    );
  }

  const postCapturedAt =
    requireString(
      postSnapshot.capturedAt,
      'post_snapshot_captured_at',
    );

  assertValidDate(
    postCapturedAt,
    'post_snapshot_captured_at',
  );

  if (
    new Date(
      postCapturedAt,
    ).getTime() <=
    new Date(
      runClaimedAt,
    ).getTime()
  ) {
    throw new Error(
      'POST_CANARY_POST_SNAPSHOT_NOT_AFTER_CLAIM',
    );
  }

  const matchingRoles =
    getRoles(
      postSnapshot,
    )
      .filter(
        role =>
          role.name ===
            'Avisos CDN',
      );

  if (
    matchingRoles.length !==
      1
  ) {
    throw new Error(
      'POST_CANARY_AVISOS_CDN_COUNT_NOT_ONE',
    );
  }

  const role =
    matchingRoles[
      0
    ];

  if (
    !role
  ) {
    throw new Error(
      'POST_CANARY_AVISOS_CDN_ROLE_MISSING',
    );
  }

  const actualId =
    requireString(
      role.id,
      'actual_role_id',
    );

  requireBoolean(
    role.managed,
    false,
    'role_managed',
  );

  requireBoolean(
    role.hoist,
    false,
    'role_hoist',
  );

  requireBoolean(
    role.mentionable,
    true,
    'role_mentionable',
  );

  if (
    !Array.isArray(
      role.permissions,
    ) ||
    role.permissions.length !==
      0
  ) {
    throw new Error(
      'POST_CANARY_ROLE_PERMISSIONS_NOT_EMPTY',
    );
  }

  if (
    bindingsBefore.schemaVersion !==
      1 ||
    bindingsAfter.schemaVersion !==
      1 ||
    bindingsBefore.guildId !==
      guildId ||
    bindingsAfter.guildId !==
      guildId
  ) {
    throw new Error(
      'POST_CANARY_BINDINGS_CONTEXT_MISMATCH',
    );
  }

  const transition =
    assertBindingTransition(
      bindingsBefore,
      bindingsAfter,
      actualId,
    );

  const content:
    Omit<
      PostCanaryCheckpoint,
      'checkpointFingerprint'
    > = {
      schemaVersion:
        1,

      fingerprintVersion:
        1,

      generatedAt,

      guildId,

      sessionId,

      operation: {
        operationId:
          'create_role:role_notify_news',

        blueprintId:
          'role_notify_news',

        targetName:
          'Avisos CDN',

        actualId,
      },

      execution: {
        status:
          'completed',

        transportAttempts:
          1,

        mutationCalls:
          1,

        transportConsumed:
          true,

        realGatewayPresent:
          true,

        realTransportPresent:
          true,
      },

      postSnapshot: {
        capturedAt:
          postCapturedAt,

        role: {
          id:
            actualId,

          name:
            'Avisos CDN',

          managed:
            false,

          hoist:
            false,

          mentionable:
            true,

          permissionsCount:
            0,
        },
      },

      bindingTransition: {
        beforeCount:
          transition.beforeCount,

        afterCount:
          transition.afterCount,

        blueprintId:
          'role_notify_news',

        before:
          null,

        after:
          actualId,

        onlyExpectedBindingAdded:
          true,
      },

      authorization: {
        gateFingerprint,

        gateEnvelopeFingerprint,

        provenanceFingerprint,

        authorizedSnapshotCapturedAt,

        receiptExpiresAt,

        runClaimedAt,
      },

      sourceFingerprints: {
        report:
          fingerprint(
            sources.report,
          ),

        runClaim:
          fingerprint(
            sources.runClaim,
          ),

        session:
          fingerprint(
            sources.session,
          ),

        postSnapshot:
          fingerprint(
            sources.postSnapshot,
          ),

        bindingsBefore:
          fingerprint(
            sources.bindingsBefore,
          ),

        bindingsAfter:
          fingerprint(
            sources.bindingsAfter,
          ),
      },

      controls: {
        retryAutomatic:
          false,

        rollbackAutomatic:
          false,

        continuationAllowed:
          false,

        executionAllowed:
          false,
      },
    };

  return {
    ...content,

    checkpointFingerprint:
      fingerprint(
        content,
      ),
  };
}

export function verifyPostCanaryCheckpoint(
  checkpoint:
    PostCanaryCheckpoint,

  sources:
    PostCanaryCheckpointSources,
): PostCanaryCheckpointVerification {
  const checks:
    PostCanaryCheckpointVerification[
      'checks'
    ] = [];

  const add =
    (
      id:
        string,

      pass:
        boolean,

      message:
        string,
    ): void => {
      checks.push({
        id,

        status:
          pass
            ? 'pass'
            : 'block',

        message,
      });
    };

  let expected:
    PostCanaryCheckpoint | null =
      null;

  try {
    expected =
      createPostCanaryCheckpoint(
        sources,
        checkpoint.generatedAt,
      );

    add(
      'source_semantics',
      true,
      'Las fuentes conservan la semántica exacta del Canary completado.',
    );
  } catch (
    error
  ) {
    add(
      'source_semantics',
      false,
      error instanceof Error
        ? error.message
        : String(
            error,
          ),
    );
  }

  if (
    expected
  ) {
    add(
      'checkpoint_fingerprint',
      checkpoint.checkpointFingerprint ===
        expected.checkpointFingerprint,
      'El fingerprint del checkpoint coincide con las fuentes.',
    );

    add(
      'checkpoint_content',
      canonicalJson(
        checkpoint,
      ) ===
        canonicalJson(
          expected,
        ),
      'El contenido completo del checkpoint coincide con la reconstrucción determinista.',
    );
  } else {
    add(
      'checkpoint_fingerprint',
      false,
      'No se puede validar fingerprint porque las fuentes son inválidas.',
    );

    add(
      'checkpoint_content',
      false,
      'No se puede reconstruir el checkpoint desde las fuentes.',
    );
  }

  add(
    'continuation_boundary',
    checkpoint.controls
      ?.continuationAllowed ===
      false &&
    checkpoint.controls
      ?.executionAllowed ===
      false,
    'El checkpoint no autoriza continuación ni ejecución.',
  );

  return {
    valid:
      checks.every(
        check =>
          check.status ===
            'pass',
      ),

    checks,
  };
}
