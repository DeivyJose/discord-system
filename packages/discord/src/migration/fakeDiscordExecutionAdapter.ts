import {
  createHash,
} from 'node:crypto';

import type {
  CreateCategoryOperation,
  CreateChannelOperation,
  CreateRoleOperation,
  DiscordExecutionAdapter,
  ExecutionAdapterActionResult,
  ExecutionAdapterBinding,
  ExecutionAdapterResourceState,
  ExecutionAdapterSnapshot,
  MigrationOperation,
  MoveChannelOperation,
  RenameCategoryOperation,
  RenameChannelOperation,
  RenameRoleOperation,
} from './executionAdapterTypes.js';

function readString(
  value: unknown,
  key: string,
): string | null {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return null;
  }

  const candidate =
    Reflect.get(
      value,
      key,
    );

  return typeof candidate ===
    'string'
    ? candidate
    : null;
}

function cloneResource(
  resource: ExecutionAdapterResourceState,
): ExecutionAdapterResourceState {
  return {
    ...resource,
  };
}

export class FakeDiscordExecutionAdapter
implements DiscordExecutionAdapter {
  readonly mode = 'fake' as const;

  private readonly resources =
    new Map<
      string,
      ExecutionAdapterResourceState
    >();

  private readonly bindings =
    new Map<
      string,
      string
    >();

  private readonly actions:
    ExecutionAdapterActionResult[] =
    [];

  private readonly processedOperations =
    new Set<string>();

  constructor(
    seed?: ExecutionAdapterSnapshot,
  ) {
    if (
      !seed
    ) {
      return;
    }

    if (
      seed.mode !== 'fake'
    ) {
      throw new Error(
        'FakeDiscordExecutionAdapter solo puede restaurar snapshots fake.',
      );
    }

    for (
      const resource
      of seed.resources
    ) {
      this.resources.set(
        resource.actualId,
        {
          ...resource,
        },
      );
    }

    for (
      const [
        blueprintId,
        actualId,
      ]
      of Object.entries(
        seed.bindings,
      )
    ) {
      this.bindings.set(
        blueprintId,
        actualId,
      );
    }

    for (
      const action
      of seed.actions
    ) {
      this.actions.push({
        ...action,

        binding:
          action.binding
            ? {
                ...action.binding,
              }
            : null,
      });

      this.processedOperations.add(
        action.operationId,
      );
    }
  }

  private fakeId(
    operation: MigrationOperation,
  ): string {
    const hash =
      createHash(
        'sha256',
      )
        .update(
          operation.id,
          'utf8',
        )
        .digest('hex')
        .slice(
          0,
          16,
        );

    return [
      'fake',
      operation.resourceKind,
      hash,
    ].join('_');
  }

  private assertNotProcessed(
    operation: MigrationOperation,
  ): void {
    if (
      this.processedOperations.has(
        operation.id,
      )
    ) {
      throw new Error(
        `La operación ${operation.id} ya fue procesada por el Fake Adapter.`,
      );
    }
  }

  private record(
    operation: MigrationOperation,
    result: ExecutionAdapterActionResult,
  ): ExecutionAdapterActionResult {
    this.processedOperations.add(
      operation.id,
    );

    this.actions.push(
      result,
    );

    if (
      result.binding
    ) {
      this.bindings.set(
        result.binding.blueprintId,
        result.binding.actualId,
      );
    }

    return result;
  }

  private buildBinding(
    operation: MigrationOperation,
    actualId: string,
  ): ExecutionAdapterBinding | null {
    const blueprintId =
      readString(
        operation,
        'blueprintId',
      );

    if (
      !blueprintId
    ) {
      return null;
    }

    return {
      blueprintId,
      actualId,
    };
  }

  private simulateCreate(
    operation:
      | CreateRoleOperation
      | CreateCategoryOperation
      | CreateChannelOperation,
    label: string,
  ): ExecutionAdapterActionResult {
    this.assertNotProcessed(
      operation,
    );

    const actualId =
      this.fakeId(
        operation,
      );

    const blueprintId =
      readString(
        operation,
        'blueprintId',
      );

    const name =
      readString(
        operation,
        'desiredName',
      ) ??
      readString(
        operation,
        'name',
      );

    const parentActualId =
      readString(
        operation,
        'desiredParentActualId',
      ) ??
      readString(
        operation,
        'parentActualId',
      );

    this.resources.set(
      actualId,
      {
        actualId,

        resourceKind:
          operation.resourceKind,

        blueprintId,

        name,

        parentActualId,

        synthetic: true,
      },
    );

    return this.record(
      operation,
      {
        operationId:
          operation.id,

        operationType:
          operation.type,

        resourceKind:
          operation.resourceKind,

        status:
          'simulated',

        actualId,

        description:
          `${label}: ${name ?? blueprintId ?? operation.id}`,

        binding:
          this.buildBinding(
            operation,
            actualId,
          ),
      },
    );
  }

  private simulateRename(
    operation:
      | RenameRoleOperation
      | RenameCategoryOperation
      | RenameChannelOperation,
  ): ExecutionAdapterActionResult {
    this.assertNotProcessed(
      operation,
    );

    const actualId =
      readString(
        operation,
        'actualId',
      );

    if (
      !actualId
    ) {
      throw new Error(
        `La operación ${operation.id} no contiene actualId.`,
      );
    }

    const blueprintId =
      readString(
        operation,
        'blueprintId',
      );

    const desiredName =
      readString(
        operation,
        'desiredName',
      );

    const existing =
      this.resources.get(
        actualId,
      );

    this.resources.set(
      actualId,
      {
        actualId,

        resourceKind:
          operation.resourceKind,

        blueprintId:
          blueprintId ??
          existing?.blueprintId ??
          null,

        name:
          desiredName ??
          existing?.name ??
          null,

        parentActualId:
          existing?.parentActualId ??
          null,

        synthetic: false,
      },
    );

    return this.record(
      operation,
      {
        operationId:
          operation.id,

        operationType:
          operation.type,

        resourceKind:
          operation.resourceKind,

        status:
          'simulated',

        actualId,

        description:
          `Renombraría ${actualId} a "${desiredName ?? '(sin nombre)'}".`,

        binding: null,
      },
    );
  }

  async createRole(
    operation: CreateRoleOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.simulateCreate(
      operation,
      'Crearía rol',
    );
  }

  async createCategory(
    operation: CreateCategoryOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.simulateCreate(
      operation,
      'Crearía categoría',
    );
  }

  async createChannel(
    operation: CreateChannelOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.simulateCreate(
      operation,
      'Crearía canal',
    );
  }

  async renameRole(
    operation: RenameRoleOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.simulateRename(
      operation,
    );
  }

  async renameCategory(
    operation: RenameCategoryOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.simulateRename(
      operation,
    );
  }

  async renameChannel(
    operation: RenameChannelOperation,
  ): Promise<ExecutionAdapterActionResult> {
    return this.simulateRename(
      operation,
    );
  }

  async moveChannel(
    operation: MoveChannelOperation,
  ): Promise<ExecutionAdapterActionResult> {
    this.assertNotProcessed(
      operation,
    );

    const actualId =
      readString(
        operation,
        'actualId',
      );

    if (
      !actualId
    ) {
      throw new Error(
        `La operación ${operation.id} no contiene actualId.`,
      );
    }

    const blueprintId =
      readString(
        operation,
        'blueprintId',
      );

    const desiredParentActualId =
      readString(
        operation,
        'desiredParentActualId',
      );

    const existing =
      this.resources.get(
        actualId,
      );

    this.resources.set(
      actualId,
      {
        actualId,

        resourceKind:
          operation.resourceKind,

        blueprintId:
          blueprintId ??
          existing?.blueprintId ??
          null,

        name:
          existing?.name ??
          readString(
            operation,
            'currentName',
          ),

        parentActualId:
          desiredParentActualId,

        synthetic: false,
      },
    );

    return this.record(
      operation,
      {
        operationId:
          operation.id,

        operationType:
          operation.type,

        resourceKind:
          operation.resourceKind,

        status:
          'simulated',

        actualId,

        description:
          `Movería ${actualId} al parent ${desiredParentActualId ?? '(resuelto durante ejecución)'}.`,

        binding: null,
      },
    );
  }

  snapshot():
    ExecutionAdapterSnapshot {
    return {
      mode: this.mode,

      bindings:
        Object.fromEntries(
          this.bindings.entries(),
        ),

      resources:
        [
          ...this.resources.values(),
        ].map(
          cloneResource,
        ),

      actions:
        this.actions.map(
          (action) => ({
            ...action,

            binding:
              action.binding
                ? {
                    ...action.binding,
                  }
                : null,
          }),
        ),
    };
  }
}
