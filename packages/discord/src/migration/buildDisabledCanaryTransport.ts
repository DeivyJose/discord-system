import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

import type {
  ActionTimeCanaryTransport,
} from './actionTimeCanaryTypes.js';

import type {
  SingleUseCanaryTransportResult,
} from './canaryTransportTypes.js';

export const BUILD_DISABLED_CANARY_ERROR =
  'MUTATION_ARM_DISABLED_BY_BUILD' as const;

/**
 * Transporte deliberadamente incapaz de mutar Discord.
 *
 * No recibe:
 * - Guild;
 * - Client;
 * - Gateway;
 * - token;
 * - callback mutativo.
 *
 * Su única función es demostrar que el pipeline puede
 * llegar hasta la frontera final de transporte y detenerse.
 */
export class BuildDisabledCanaryTransport
implements ActionTimeCanaryTransport {
  private consumed =
    false;

  private attempts =
    0;

  async execute(
    _intent:
      CanaryRoleIntent,
  ): Promise<
    SingleUseCanaryTransportResult
  > {
    this.attempts +=
      1;

    /*
     * Single-use también en modo deshabilitado.
     */
    if (
      this.consumed
    ) {
      throw new Error(
        'BUILD_DISABLED_CANARY_ALREADY_CONSUMED',
      );
    }

    this.consumed =
      true;

    /*
     * HARD STOP.
     *
     * No existe ninguna referencia desde esta clase
     * hacia Discord.js o hacia CanaryRoleGateway.
     */
    throw new Error(
      BUILD_DISABLED_CANARY_ERROR,
    );
  }

  isConsumed():
    boolean {
    return this.consumed;
  }

  getAttempts():
    number {
    return this.attempts;
  }

  getMutationCalls():
    number {
    return 0;
  }
}
