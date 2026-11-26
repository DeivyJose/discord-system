import {
  mkdir,
  open,
} from 'node:fs/promises';

import path from 'node:path';

export interface ApprovalConsumptionOptions {
  directory: string;

  confirmationId: string;

  gateFingerprint: string;

  gateEnvelopeFingerprint: string;

  provenanceFingerprint: string;

  receiptId: string;

  claimedAt: string;
}

export interface ApprovalConsumptionResult {
  claimed: boolean;

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

export async function claimApprovalConfirmation(
  options:
    ApprovalConsumptionOptions,
): Promise<ApprovalConsumptionResult> {
  assertHex(
    options.confirmationId,
    16,
    'confirmationId',
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
    options.receiptId,
    24,
    'receiptId',
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
      `${options.confirmationId}.json`,
    );

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

          confirmationId:
            options.confirmationId,

          gateFingerprint:
            options.gateFingerprint,

          gateEnvelopeFingerprint:
            options.gateEnvelopeFingerprint,

          provenanceFingerprint:
            options.provenanceFingerprint,

          receiptId:
            options.receiptId,

          claimedAt:
            options.claimedAt,

          executionAllowed:
            false,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    return {
      claimed:
        true,

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
