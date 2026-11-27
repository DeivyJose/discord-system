import {
  mkdir,
  open,
} from 'node:fs/promises';

import path from 'node:path';

export interface RealCanaryRunClaim {
  schemaVersion:
    1;

  sessionId:
    string;

  guildId:
    string;

  gateFingerprint:
    string;

  gateEnvelopeFingerprint:
    string;

  claimedAt:
    string;

  executionAllowed:
    false;
}

export async function claimRealCanaryRunAttempt(
  directory:
    string,

  claim:
    RealCanaryRunClaim,
): Promise<
  string
> {
  if (
    !claim.sessionId ||
    !claim.guildId ||
    !claim.gateFingerprint ||
    !claim.gateEnvelopeFingerprint ||
    claim.executionAllowed !==
      false
  ) {
    throw new Error(
      'REAL_CANARY_RUN_CLAIM_INVALID',
    );
  }

  await mkdir(
    directory,
    {
      recursive:
        true,
    },
  );

  const claimPath =
    path.join(
      directory,
      `${claim.sessionId}.json`,
    );

  let handle;

  try {
    /*
     * wx = creación exclusiva.
     *
     * Si el archivo ya existe:
     * - no se reemplaza;
     * - no se reabre;
     * - no se permite otro intento.
     */
    handle =
      await open(
        claimPath,
        'wx',
      );

    await handle.writeFile(
      JSON.stringify(
        claim,
        null,
        2,
      ) + '\n',
      'utf8',
    );

    /*
     * Fuerza el contenido del claim al almacenamiento
     * antes de considerarlo adquirido.
     */
    await handle.sync();
  } catch (
    error
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
      throw new Error(
        'REAL_CANARY_RUN_ALREADY_CLAIMED',
      );
    }

    throw error;
  } finally {
    await handle?.close();
  }

  return claimPath;
}
