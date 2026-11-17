import {
  createHash,
  timingSafeEqual,
} from 'node:crypto';

import type {
  DiscordStructureResourceKind,
  LiveDriftBaseline,
  LiveDriftChange,
  LiveDriftCheck,
  LiveDriftContext,
  LiveDriftVerification,
  NormalizedDiscordStructureResource,
  NormalizedDiscordStructureSnapshot,
} from './liveDriftTypes.js';

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
    typeof value === 'object' &&
    value !== null
  ) {
    const source =
      value as
        Record<string, unknown>;

    const output:
      Record<string, unknown> = {};

    for (
      const key
      of Object.keys(
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

function safeHashEqual(
  left: string,
  right: string,
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(
      left,
    ) ||
    !/^[a-f0-9]{64}$/i.test(
      right,
    )
  ) {
    return false;
  }

  const leftBuffer =
    Buffer.from(
      left,
      'hex',
    );

  const rightBuffer =
    Buffer.from(
      right,
      'hex',
    );

  return (
    leftBuffer.length ===
      rightBuffer.length &&
    timingSafeEqual(
      leftBuffer,
      rightBuffer,
    )
  );
}

function asObject(
  value: unknown,
): Record<string, unknown> | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  return value as
    Record<string, unknown>;
}

function readString(
  value: unknown,
  key: string,
): string | null {
  const object =
    asObject(
      value,
    );

  const candidate =
    object?.[key];

  return typeof candidate ===
    'string'
    ? candidate
    : null;
}

function readNumber(
  value: unknown,
  key: string,
): number | null {
  const object =
    asObject(
      value,
    );

  const candidate =
    object?.[key];

  return typeof candidate ===
      'number' &&
    Number.isFinite(
      candidate,
    )
    ? candidate
    : null;
}

function readBoolean(
  value: unknown,
  key: string,
): boolean | null {
  const object =
    asObject(
      value,
    );

  const candidate =
    object?.[key];

  return typeof candidate ===
    'boolean'
    ? candidate
    : null;
}

function readArray(
  value: unknown,
  key: string,
): unknown[] {
  const object =
    asObject(
      value,
    );

  const candidate =
    object?.[key];

  return Array.isArray(
    candidate,
  )
    ? candidate
    : [];
}

function channelSnapshotIsCategory(
  value: unknown,
): boolean {
  const typeName =
    readString(
      value,
      'typeName',
    );

  if (
    typeName ===
      'GuildCategory'
  ) {
    return true;
  }

  /*
   * Fallback para snapshots que conserven
   * solamente el enum numérico de Discord.
   *
   * ChannelType.GuildCategory === 4.
   *
   * No importamos discord.js aquí para mantener
   * este módulo de integridad desacoplado del
   * transporte real.
   */
  const object =
    asObject(
      value,
    );

  return object?.type ===
    4;
}

function readParentId(
  resource: unknown,
): string | null {
  const direct =
    readString(
      resource,
      'parentId',
    ) ??
    readString(
      resource,
      'parentCategoryId',
    );

  if (
    direct
  ) {
    return direct;
  }

  const object =
    asObject(
      resource,
    );

  const parent =
    object?.parent;

  return readString(
    parent,
    'id',
  );
}

function normalizeResource(
  raw: unknown,
  kind:
    DiscordStructureResourceKind,
): NormalizedDiscordStructureResource {
  const id =
    readString(
      raw,
      'id',
    );

  const name =
    readString(
      raw,
      'name',
    );

  if (
    !id ||
    !name
  ) {
    throw new Error(
      `Recurso ${kind} inválido: faltan id o name.`,
    );
  }

  const object =
    asObject(
      raw,
    ) ?? {};

  const structurePayload = {
    id,

    kind,

    name,

    parentId:
      kind === 'channel'
        ? readParentId(
            raw,
          )
        : null,

    position:
      readNumber(
        raw,
        'position',
      ),

    managed:
      kind === 'role'
        ? readBoolean(
            raw,
            'managed',
          )
        : null,

    type:
      object.type ??
      null,

    permissions:
      object.permissions ??
      null,

    permissionOverwrites:
      object.permissionOverwrites ??
      object.overwrites ??
      null,
  };

  return {
    id,

    kind,

    name,

    parentId:
      structurePayload.parentId,

    position:
      structurePayload.position,

    managed:
      structurePayload.managed,

    structureFingerprint:
      sha256(
        structurePayload,
      ),
  };
}

function resourceSort(
  left:
    NormalizedDiscordStructureResource,
  right:
    NormalizedDiscordStructureResource,
): number {
  const leftKey =
    `${left.kind}:${left.id}`;

  const rightKey =
    `${right.kind}:${right.id}`;

  return leftKey.localeCompare(
    rightKey,
  );
}

export function normalizeDiscordStructureSnapshot(
  rawSnapshot: unknown,
): NormalizedDiscordStructureSnapshot {
  const guildObject =
    asObject(
      rawSnapshot,
    )?.guild;

  const guildId =
    readString(
      guildObject,
      'id',
    ) ??
    readString(
      rawSnapshot,
      'guildId',
    );

  const capturedAt =
    readString(
      rawSnapshot,
      'capturedAt',
    );

  if (
    !guildId
  ) {
    throw new Error(
      'El snapshot no contiene Guild ID.',
    );
  }

  if (
    !capturedAt
  ) {
    throw new Error(
      'El snapshot no contiene capturedAt.',
    );
  }

  const rawCategories =
    readArray(
      rawSnapshot,
      'categories',
    );

  const rawChannels =
    readArray(
      rawSnapshot,
      'channels',
    );

  /*
   * Existen dos formas soportadas:
   *
   * 1. Formato sintético/legacy:
   *    categories[] + channels[]
   *
   * 2. Formato real del Inspector:
   *    channels[] contiene también GuildCategory.
   *
   * Si categories[] existe y contiene recursos,
   * sigue siendo la fuente explícita.
   */
  const categorySources =
    rawCategories.length > 0
      ? rawCategories
      : rawChannels.filter(
          channelSnapshotIsCategory,
        );

  const categories =
    categorySources.map(
      (resource) =>
        normalizeResource(
          resource,
          'category',
        ),
    );

  /*
   * Una GuildCategory jamás debe terminar
   * normalizada como channel.
   *
   * Esto también evita duplicados si una forma
   * futura incluye categories[] y conserva las
   * categorías dentro de channels[].
   */
  const channels =
    rawChannels
      .filter(
        (resource) =>
          !channelSnapshotIsCategory(
            resource,
          ),
      )
      .map(
        (resource) =>
          normalizeResource(
            resource,
            'channel',
          ),
      );

  const roles =
    readArray(
      rawSnapshot,
      'roles',
    ).map(
      (resource) =>
        normalizeResource(
          resource,
          'role',
        ),
    );

  const resources = [
    ...categories,
    ...channels,
    ...roles,
  ].sort(
    resourceSort,
  );

  if (
    resources.length === 0
  ) {
    throw new Error(
      'El snapshot no contiene recursos estructurales.',
    );
  }

  return {
    guildId,

    capturedAt,

    resources,

    structureFingerprint:
      sha256({
        guildId,

        resources:
          resources.map(
            (resource) => ({
              id:
                resource.id,

              kind:
                resource.kind,

              fingerprint:
                resource.structureFingerprint,
            }),
          ),
      }),
  };
}

export function createLiveDriftBaseline(
  snapshot:
    NormalizedDiscordStructureSnapshot,
  context:
    LiveDriftContext,
  now = new Date(),
): LiveDriftBaseline {
  return {
    schemaVersion: 1,

    createdAt:
      now.toISOString(),

    context: {
      ...context,
    },

    snapshot:
      structuredClone(
        snapshot,
      ),

    executionAllowed:
      false,
  };
}

export function verifyLiveDrift(
  baseline:
    LiveDriftBaseline,
  current:
    NormalizedDiscordStructureSnapshot,
  expectedContext:
    LiveDriftContext,
  now = new Date(),
): LiveDriftVerification {
  const checks:
    LiveDriftCheck[] = [];

  checks.push({
    id:
      'session_identity',

    status:
      baseline.context
        .sessionId ===
        expectedContext.sessionId
        ? 'pass'
        : 'block',

    details:
      baseline.context
        .sessionId ===
        expectedContext.sessionId
        ? 'Execution Session coincide.'
        : 'El baseline pertenece a otra Execution Session.',
  });

  checks.push({
    id:
      'gate_fingerprint',

    status:
      baseline.context
        .gateFingerprint ===
        expectedContext.gateFingerprint
        ? 'pass'
        : 'block',

    details:
      baseline.context
        .gateFingerprint ===
        expectedContext.gateFingerprint
        ? 'Migration Gate fingerprint coincide.'
        : 'El baseline pertenece a otro Migration Gate.',
  });

  const sameGuild =
    baseline.snapshot
      .guildId ===
    current.guildId;

  checks.push({
    id:
      'guild_identity',

    status:
      sameGuild
        ? 'pass'
        : 'block',

    details:
      sameGuild
        ? `Guild confirmado: ${current.guildId}.`
        : 'El snapshot live pertenece a otro Guild.',
  });

  const baselineMap =
    new Map(
      baseline.snapshot
        .resources
        .map(
          (resource) => [
            `${resource.kind}:${resource.id}`,
            resource,
          ] as const,
        ),
    );

  const currentMap =
    new Map(
      current.resources.map(
        (resource) => [
          `${resource.kind}:${resource.id}`,
          resource,
        ] as const,
      ),
    );

  const changes:
    LiveDriftChange[] = [];

  for (
    const [
      key,
      before,
    ]
    of baselineMap
  ) {
    const after =
      currentMap.get(
        key,
      );

    if (
      !after
    ) {
      changes.push({
        type:
          'removed',

        resourceId:
          before.id,

        kind:
          before.kind,

        before:
          structuredClone(
            before,
          ),

        after: null,
      });

      continue;
    }

    if (
      !safeHashEqual(
        before.structureFingerprint,
        after.structureFingerprint,
      )
    ) {
      changes.push({
        type:
          'changed',

        resourceId:
          before.id,

        kind:
          before.kind,

        before:
          structuredClone(
            before,
          ),

        after:
          structuredClone(
            after,
          ),
      });
    }
  }

  for (
    const [
      key,
      after,
    ]
    of currentMap
  ) {
    if (
      baselineMap.has(
        key,
      )
    ) {
      continue;
    }

    changes.push({
      type:
        'added',

      resourceId:
        after.id,

      kind:
        after.kind,

      before: null,

      after:
        structuredClone(
          after,
        ),
    });
  }

  const structureMatches =
    sameGuild &&
    safeHashEqual(
      baseline.snapshot
        .structureFingerprint,
      current.structureFingerprint,
    ) &&
    changes.length ===
      0;

  checks.push({
    id:
      'structural_drift',

    status:
      structureMatches
        ? 'pass'
        : 'block',

    details:
      structureMatches
        ? 'La estructura live coincide exactamente con el baseline autorizado.'
        : `Se detectaron ${changes.length} cambio(s) estructural(es).`,
  });

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

  const added =
    changes.filter(
      (change) =>
        change.type ===
        'added',
    ).length;

  const removed =
    changes.filter(
      (change) =>
        change.type ===
        'removed',
    ).length;

  const changed =
    changes.filter(
      (change) =>
        change.type ===
        'changed',
    ).length;

  return {
    schemaVersion: 1,

    verifiedAt:
      now.toISOString(),

    status:
      block === 0
        ? 'valid'
        : 'blocked',

    baselineFingerprint:
      baseline.snapshot
        .structureFingerprint,

    currentFingerprint:
      current
        .structureFingerprint,

    checks,

    changes,

    summary: {
      added,

      removed,

      changed,

      pass,

      block,

      driftDetected:
        changes.length > 0,

      valid:
        block === 0,
    },

    executionAllowed:
      false,
  };
}
