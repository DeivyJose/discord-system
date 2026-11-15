import type {
  MutationResolverBindings,
} from './discordMutationResolverTypes.js';

import type {
  SessionBindingCommitResult,
  SessionBindingLookup,
  SessionBindingRecord,
  SessionBindingRegistryErrorCode,
  SessionBindingRegistrySnapshot,
  SessionBindingStageResult,
  SessionBindingTransactionStatus,
} from './sessionBindingRegistryTypes.js';

export class SessionBindingRegistryError
extends Error {
  readonly code:
    SessionBindingRegistryErrorCode;

  constructor(
    code:
      SessionBindingRegistryErrorCode,
    message: string,
  ) {
    super(
      message,
    );

    this.name =
      'SessionBindingRegistryError';

    this.code =
      code;
  }
}

function validateId(
  label: string,
  value: string,
): void {
  if (
    value.trim().length ===
      0
  ) {
    throw new SessionBindingRegistryError(
      'INVALID_BINDING',
      `${label} no puede estar vacío.`,
    );
  }
}

function objectFromMap(
  map:
    ReadonlyMap<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    [...map.entries()]
      .sort(
        (
          left,
          right,
        ) =>
          left[0]
            .localeCompare(
              right[0],
            ),
      ),
  );
}

function sessionObjectFromMap(
  map:
    ReadonlyMap<
      string,
      SessionBindingRecord
    >,
): Record<
  string,
  SessionBindingRecord
> {
  return Object.fromEntries(
    [...map.entries()]
      .sort(
        (
          left,
          right,
        ) =>
          left[0]
            .localeCompare(
              right[0],
            ),
      )
      .map(
        (
          [
            blueprintId,
            record,
          ],
        ) => [
          blueprintId,
          structuredClone(
            record,
          ),
        ],
      ),
  );
}

export class SessionBindingRegistry {
  readonly guildId:
    string;

  private readonly confirmed =
    new Map<string, string>();

  private readonly session =
    new Map<
      string,
      SessionBindingRecord
    >();

  private revisionValue =
    0;

  constructor(
    guildId: string,
    confirmed:
      Readonly<Record<string, string>>,
  ) {
    validateId(
      'guildId',
      guildId,
    );

    this.guildId =
      guildId;

    for (
      const [
        blueprintId,
        actualId,
      ]
      of Object.entries(
        confirmed,
      )
    ) {
      validateId(
        'blueprintId',
        blueprintId,
      );

      validateId(
        'actualId',
        actualId,
      );

      this.assertActualIdAvailable(
        blueprintId,
        actualId,
        new Map(),
      );

      this.confirmed.set(
        blueprintId,
        actualId,
      );
    }
  }

  get revision():
    number {
    return this.revisionValue;
  }

  get confirmedCount():
    number {
    return this.confirmed.size;
  }

  get sessionCount():
    number {
    return this.session.size;
  }

  resolve(
    blueprintId: string,
  ): SessionBindingLookup {
    validateId(
      'blueprintId',
      blueprintId,
    );

    const session =
      this.session.get(
        blueprintId,
      );

    if (
      session
    ) {
      return {
        blueprintId,

        actualId:
          session.actualId,

        source:
          'session',
      };
    }

    const confirmed =
      this.confirmed.get(
        blueprintId,
      );

    if (
      confirmed
    ) {
      return {
        blueprintId,

        actualId:
          confirmed,

        source:
          'confirmed',
      };
    }

    return {
      blueprintId,

      actualId:
        null,

      source:
        'none',
    };
  }

  toResolverBindings():
    MutationResolverBindings {
    const session:
      Record<string, string> = {};

    for (
      const [
        blueprintId,
        record,
      ]
      of this.session
    ) {
      session[
        blueprintId
      ] =
        record.actualId;
    }

    return {
      confirmed:
        objectFromMap(
          this.confirmed,
        ),

      session,
    };
  }

  beginTransaction(
    transactionId: string,
  ): SessionBindingTransaction {
    validateId(
      'transactionId',
      transactionId,
    );

    return new SessionBindingTransaction(
      this,
      transactionId,
      this.revisionValue,
    );
  }

  snapshot():
    SessionBindingRegistrySnapshot {
    return {
      schemaVersion: 1,

      guildId:
        this.guildId,

      revision:
        this.revisionValue,

      confirmed:
        objectFromMap(
          this.confirmed,
        ),

      session:
        sessionObjectFromMap(
          this.session,
        ),

      executionAllowed:
        false,
    };
  }

  static restore(
    snapshot:
      SessionBindingRegistrySnapshot,
  ): SessionBindingRegistry {
    const registry =
      new SessionBindingRegistry(
        snapshot.guildId,
        snapshot.confirmed,
      );

    for (
      const [
        blueprintId,
        record,
      ]
      of Object.entries(
        snapshot.session,
      )
    ) {
      validateId(
        'blueprintId',
        blueprintId,
      );

      validateId(
        'actualId',
        record.actualId,
      );

      if (
        record.blueprintId !==
          blueprintId
      ) {
        throw new SessionBindingRegistryError(
          'INVALID_BINDING',
          `Snapshot inconsistente para ${blueprintId}.`,
        );
      }

      registry
        .assertBlueprintCompatible(
          blueprintId,
          record.actualId,
          new Map(),
        );

      registry
        .assertActualIdAvailable(
          blueprintId,
          record.actualId,
          new Map(),
        );

      registry.session.set(
        blueprintId,
        structuredClone(
          record,
        ),
      );
    }

    registry.revisionValue =
      snapshot.revision;

    return registry;
  }

  lookupForTransaction(
    blueprintId: string,
    staged:
      ReadonlyMap<
        string,
        SessionBindingRecord
      >,
  ): SessionBindingLookup {
    const stagedRecord =
      staged.get(
        blueprintId,
      );

    if (
      stagedRecord
    ) {
      return {
        blueprintId,

        actualId:
          stagedRecord.actualId,

        source:
          'staged',
      };
    }

    return this.resolve(
      blueprintId,
    );
  }

  validateRegistration(
    blueprintId: string,
    actualId: string,
    staged:
      ReadonlyMap<
        string,
        SessionBindingRecord
      >,
  ): SessionBindingStageResult {
    validateId(
      'blueprintId',
      blueprintId,
    );

    validateId(
      'actualId',
      actualId,
    );

    const existing =
      this.lookupForTransaction(
        blueprintId,
        staged,
      );

    if (
      existing.actualId ===
        actualId
    ) {
      return 'idempotent';
    }

    if (
      existing.actualId
    ) {
      throw new SessionBindingRegistryError(
        'BLUEPRINT_CONFLICT',
        [
          `Blueprint ${blueprintId} ya está enlazado.`,
          `Actual: ${existing.actualId}.`,
          `Intento: ${actualId}.`,
        ].join(
          ' ',
        ),
      );
    }

    this.assertActualIdAvailable(
      blueprintId,
      actualId,
      staged,
    );

    return 'added';
  }

  commitTransaction(
    transactionId: string,
    baseRevision: number,
    staged:
      ReadonlyMap<
        string,
        SessionBindingRecord
      >,
  ): SessionBindingCommitResult {
    if (
      this.revisionValue !==
        baseRevision
    ) {
      throw new SessionBindingRegistryError(
        'REVISION_CONFLICT',
        [
          `Transaction ${transactionId} partió de revision ${baseRevision}.`,
          `Revision actual: ${this.revisionValue}.`,
        ].join(
          ' ',
        ),
      );
    }

    for (
      const [
        blueprintId,
        record,
      ]
      of staged
    ) {
      this.assertBlueprintCompatible(
        blueprintId,
        record.actualId,
        staged,
      );

      this.assertActualIdAvailable(
        blueprintId,
        record.actualId,
        staged,
      );
    }

    const revisionBefore =
      this.revisionValue;

    let committed =
      0;

    for (
      const [
        blueprintId,
        record,
      ]
      of staged
    ) {
      const existing =
        this.resolve(
          blueprintId,
        );

      if (
        existing.actualId ===
          record.actualId
      ) {
        continue;
      }

      this.session.set(
        blueprintId,
        structuredClone(
          record,
        ),
      );

      committed +=
        1;
    }

    if (
      committed > 0
    ) {
      this.revisionValue +=
        1;
    }

    return {
      transactionId,

      committed,

      revisionBefore,

      revisionAfter:
        this.revisionValue,

      executionAllowed:
        false,
    };
  }

  private assertBlueprintCompatible(
    blueprintId: string,
    actualId: string,
    staged:
      ReadonlyMap<
        string,
        SessionBindingRecord
      >,
  ): void {
    const existing =
      this.lookupForTransaction(
        blueprintId,
        staged,
      );

    if (
      existing.actualId &&
      existing.actualId !==
        actualId
    ) {
      throw new SessionBindingRegistryError(
        'BLUEPRINT_CONFLICT',
        [
          `Blueprint ${blueprintId} ya está enlazado a ${existing.actualId}.`,
          `No puede cambiar silenciosamente a ${actualId}.`,
        ].join(
          ' ',
        ),
      );
    }
  }

  private assertActualIdAvailable(
    blueprintId: string,
    actualId: string,
    staged:
      ReadonlyMap<
        string,
        SessionBindingRecord
      >,
  ): void {
    for (
      const [
        otherBlueprintId,
        otherActualId,
      ]
      of this.confirmed
    ) {
      if (
        otherBlueprintId !==
          blueprintId &&
        otherActualId ===
          actualId
      ) {
        throw new SessionBindingRegistryError(
          'ACTUAL_ID_CONFLICT',
          `Discord ID ${actualId} ya pertenece a ${otherBlueprintId}.`,
        );
      }
    }

    for (
      const [
        otherBlueprintId,
        record,
      ]
      of this.session
    ) {
      if (
        otherBlueprintId !==
          blueprintId &&
        record.actualId ===
          actualId
      ) {
        throw new SessionBindingRegistryError(
          'ACTUAL_ID_CONFLICT',
          `Discord ID ${actualId} ya pertenece a ${otherBlueprintId}.`,
        );
      }
    }

    for (
      const [
        otherBlueprintId,
        record,
      ]
      of staged
    ) {
      if (
        otherBlueprintId !==
          blueprintId &&
        record.actualId ===
          actualId
      ) {
        throw new SessionBindingRegistryError(
          'ACTUAL_ID_CONFLICT',
          `Discord ID ${actualId} ya está staged para ${otherBlueprintId}.`,
        );
      }
    }
  }
}

export class SessionBindingTransaction {
  private readonly staged =
    new Map<
      string,
      SessionBindingRecord
    >();

  private statusValue:
    SessionBindingTransactionStatus =
      'open';

  constructor(
    private readonly registry:
      SessionBindingRegistry,

    readonly transactionId:
      string,

    readonly baseRevision:
      number,
  ) {}

  get status():
    SessionBindingTransactionStatus {
    return this.statusValue;
  }

  get stagedCount():
    number {
    return this.staged.size;
  }

  resolve(
    blueprintId: string,
  ): SessionBindingLookup {
    this.assertOpen();

    return this.registry
      .lookupForTransaction(
        blueprintId,
        this.staged,
      );
  }

  stage(
    blueprintId: string,
    actualId: string,
    operationId:
      string | null,
    now =
      new Date(),
  ): SessionBindingStageResult {
    this.assertOpen();

    const result =
      this.registry
        .validateRegistration(
          blueprintId,
          actualId,
          this.staged,
        );

    if (
      result ===
        'idempotent'
    ) {
      return result;
    }

    this.staged.set(
      blueprintId,
      {
        blueprintId,

        actualId,

        operationId,

        createdAt:
          now.toISOString(),
      },
    );

    return 'added';
  }

  commit():
    SessionBindingCommitResult {
    this.assertOpen();

    const result =
      this.registry
        .commitTransaction(
          this.transactionId,
          this.baseRevision,
          this.staged,
        );

    this.statusValue =
      'committed';

    this.staged.clear();

    return result;
  }

  rollback():
    void {
    this.assertOpen();

    this.staged.clear();

    this.statusValue =
      'rolled_back';
  }

  private assertOpen():
    void {
    if (
      this.statusValue !==
        'open'
    ) {
      throw new SessionBindingRegistryError(
        'TRANSACTION_CLOSED',
        `Transaction ${this.transactionId} está ${this.statusValue}.`,
      );
    }
  }
}
