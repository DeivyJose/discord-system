import type {
  ExecutionAdapterActionResult,
} from './executionAdapterTypes.js';

import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

export type SimulatedCanaryAdapterErrorCode =
  | 'CANARY_SINGLE_USE_CONSUMED'
  | 'CANARY_INTENT_REJECTED';

export class SimulatedCanaryAdapterError
extends Error {
  readonly code:
    SimulatedCanaryAdapterErrorCode;

  constructor(
    code:
      SimulatedCanaryAdapterErrorCode,
    message: string,
  ) {
    super(
      message,
    );

    this.name =
      'SimulatedCanaryAdapterError';

    this.code =
      code;
  }
}

export class SimulatedCanaryAdapter {
  readonly mode =
    'fake' as const;

  readonly executionEnabled =
    false as const;

  private consumed =
    false;

  private attempts =
    0;

  private actions:
    ExecutionAdapterActionResult[] =
    [];

  async simulateCreateRole(
    intent:
      CanaryRoleIntent,
  ): Promise<
    ExecutionAdapterActionResult
  > {
    this.attempts +=
      1;

    if (
      this.consumed
    ) {
      throw new SimulatedCanaryAdapterError(
        'CANARY_SINGLE_USE_CONSUMED',
        'El Canary Adapter ya consumió su única simulación permitida.',
      );
    }

    const validIntent =
      intent.schemaVersion ===
        1 &&
      intent.operationId ===
        'create_role:role_notify_news' &&
      intent.blueprintId ===
        'role_notify_news' &&
      intent.name ===
        'Avisos CDN' &&
      intent.description ===
        'Notificaciones generales de noticias.' &&
      intent.hoist ===
        false &&
      intent.mentionable ===
        true &&
      intent.permissions ===
        '0' &&
      intent.executionAllowed ===
        false;

    if (
      !validIntent
    ) {
      throw new SimulatedCanaryAdapterError(
        'CANARY_INTENT_REJECTED',
        'El intent no coincide exactamente con la allowlist del Canary.',
      );
    }

    /*
     * SINGLE USE.
     *
     * Se consume ANTES de producir el resultado
     * para impedir un segundo intento.
     */
    this.consumed =
      true;

    const action:
      ExecutionAdapterActionResult = {
      operationId:
        intent.operationId,

      operationType:
        'create_role',

      resourceKind:
        'role',

      status:
        'simulated',

      /*
       * No existe recurso real.
       */
      actualId:
        null,

      description:
        'Simulación Canary de creación de Avisos CDN con permissions=0.',

      binding:
        null,
    };

    this.actions.push(
      structuredClone(
        action,
      ),
    );

    return structuredClone(
      action,
    );
  }

  getAttempts():
    number {
    return this.attempts;
  }

  getActions():
    ExecutionAdapterActionResult[] {
    return this.actions.map(
      (action) =>
        structuredClone(
          action,
        ),
    );
  }

  isConsumed():
    boolean {
    return this.consumed;
  }
}
