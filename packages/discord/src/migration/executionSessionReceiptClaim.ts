import {
  mkdir,
  open,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  ExecutionSessionReceiptClaim,
} from './executionSessionTypes.js';

export interface ExecutionSessionReceiptClaimOptions {
  directory: string;

  receiptId: string;

  sessionId: string;

  gateFingerprint: string;

  gateEnvelopeFingerprint: string;

  provenanceFingerprint: string;

  confirmationId: string;

  claimedAt: string;
}

export interface ExecutionSessionReceiptClaimResult {
  claimed: boolean;

  claim:
    ExecutionSessionReceiptClaim |
    null;

  markerPath: string;

  executionAllowed: false;
}

function assertHex(
  value: string,
  length: number,
  label: string,
): void {
  const expression =
    new RegExp(
      `^[a-f0-9]{${length}}$`,
      'i',
    );

  if (
    !expression.test(
      value,
    )
  ) {
    throw new Error(
      `${label} inválido.`,
    );
  }
}

export async function claimReceiptForExecutionSession(
  options:
    ExecutionSessionReceiptClaimOptions,
): Promise<ExecutionSessionReceiptClaimResult> {
  assertHex(
    options.receiptId,
    24,
    'receiptId',
  );

  assertHex(
    options.sessionId,
    24,
    'sessionId',
  );

  assertHex(
    options.gateFingerprint,
    64,
    'gateFingerprint',
  );

  assertHex(
    options.gateEnvelopeFingerprint,
    64,
    'gateEnvelopeFingerprint',
  );

  assertHex(
    options.provenanceFingerprint,
    64,
    'provenanceFingerprint',
  );

  assertHex(
    options.confirmationId,
    16,
    'confirmationId',
  );

  await mkdir(
    options.directory,
    {
      recursive: true,
    },
  );

  const markerPath =
    path.join(
      options.directory,
      `${options.receiptId}.json`,
    );

  const claim:
    ExecutionSessionReceiptClaim = {
    claimed:
      true,

    receiptId:
      options.receiptId,

    sessionId:
      options.sessionId,

    gateFingerprint:
      options.gateFingerprint,

    gateEnvelopeFingerprint:
      options.gateEnvelopeFingerprint,

    provenanceFingerprint:
      options.provenanceFingerprint,

    confirmationId:
      options.confirmationId,

    claimedAt:
      options.claimedAt,

    executionAllowed:
      false,
  };

  let handle:
    Awaited<
      ReturnType<typeof open>
    > |
    null =
    null;

  try {
    handle =
      await open(
        markerPath,
        'wx',
        0o600,
      );

    await handle.writeFile(
      JSON.stringify(
        {
          schemaVersion: 3,

          ...claim,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    return {
      claimed:
        true,

      claim,

      markerPath,

      executionAllowed:
        false,
    };
  } catch (
    error: unknown
  ) {
    const code =
      (
        error as
          NodeJS.ErrnoException
      ).code;

    if (
      code ===
        'EEXIST'
    ) {
      return {
        claimed:
          false,

        claim:
          null,

        markerPath,

        executionAllowed:
          false,
      };
    }

    throw error;
  } finally {
    if (
      handle
    ) {
      await handle.close();
    }
  }
}
