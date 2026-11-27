import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

import {
  buildCanaryActionTimeChallenge,
  SingleUseCanaryHumanAuthorizer,
} from './actionTimeHumanAuthorization.js';

import type {
  ActionTimeHumanAuthorizationIO,
} from './actionTimeHumanAuthorization.js';

const SESSION_ID =
  'aaaaaaaaaaaaaaaaaaaaaaaa';

const GUILD_ID =
  '1494545796492824656';

const SNAPSHOT_AT =
  '2026-11-27T10:00:00.000Z';

const RECEIPT_EXPIRES_AT =
  '2026-11-27T10:15:00.000Z';

const ISSUED_AT =
  '2026-11-27T10:05:00.000Z';

const NONCE =
  '0123456789abcdef01234567';

const context = {
  sessionId:
    SESSION_ID,

  guildId:
    GUILD_ID,

  receiptExpiresAt:
    RECEIPT_EXPIRES_AT,

  snapshotCapturedAt:
    SNAPSHOT_AT,
};

const intent:
  CanaryRoleIntent = {
    schemaVersion:
      1,

    sessionId:
      SESSION_ID,

    guildId:
      GUILD_ID,

    operationId:
      'create_role:role_notify_news',

    blueprintId:
      'role_notify_news',

    name:
      'Avisos CDN',

    description:
      'Notificaciones generales de noticias.',

    hoist:
      false,

    mentionable:
      true,

    permissions:
      '0',

    executionAllowed:
      false,
  };

class FakeIO
implements ActionTimeHumanAuthorizationIO {
  writes:
    string[] =
    [];

  reads =
    0;

  answer =
    '';

  constructor(
    readonly inputIsTTY:
      boolean,

    readonly outputIsTTY:
      boolean,
  ) {}

  write(
    value:
      string,
  ): void {
    this.writes.push(
      value,
    );
  }

  async readLine(
    _prompt:
      string,
  ): Promise<string> {
    this.reads +=
      1;

    return this.answer;
  }
}

function fixedNow(
  value:
    string,
): () => Date {
  return () =>
    new Date(
      value,
    );
}

const exactChallenge =
  buildCanaryActionTimeChallenge({
    context,

    intent,

    issuedAt:
      new Date(
        ISSUED_AT,
      ),

    nonce:
      NONCE,
  });

/*
 * ========================================================
 * TEST 1 — EXACT TTY CONFIRMATION
 * ========================================================
 */

const validIO =
  new FakeIO(
    true,
    true,
  );

validIO.answer =
  exactChallenge;

const validAuthorizer =
  new SingleUseCanaryHumanAuthorizer({
    context,

    io:
      validIO,

    nonceFactory:
      () =>
        NONCE,

    now:
      fixedNow(
        ISSUED_AT,
      ),
  });

const validAccepted =
  await validAuthorizer
    .authorize(
      intent,
    );

const validPass =
  validAccepted ===
    true &&
  validAuthorizer
    .isConsumed() ===
    true &&
  validAuthorizer
    .getAttempts() ===
    1 &&
  validIO.reads ===
    1;

/*
 * ========================================================
 * TEST 2 — WRONG PHRASE + SINGLE USE
 * ========================================================
 */

const wrongIO =
  new FakeIO(
    true,
    true,
  );

wrongIO.answer =
  'NO';

const wrongAuthorizer =
  new SingleUseCanaryHumanAuthorizer({
    context,

    io:
      wrongIO,

    nonceFactory:
      () =>
        NONCE,

    now:
      fixedNow(
        ISSUED_AT,
      ),
  });

const wrongAccepted =
  await wrongAuthorizer
    .authorize(
      intent,
    );

wrongIO.answer =
  exactChallenge;

const replayAccepted =
  await wrongAuthorizer
    .authorize(
      intent,
    );

const wrongPhraseBlocked =
  wrongAccepted ===
    false &&
  replayAccepted ===
    false &&
  wrongAuthorizer
    .isConsumed() ===
    true &&
  wrongAuthorizer
    .getAttempts() ===
    1 &&
  wrongIO.reads ===
    1;

/*
 * ========================================================
 * TEST 3 — INPUT NON-TTY
 * ========================================================
 */

const noInputTTYIO =
  new FakeIO(
    false,
    true,
  );

const noInputTTYAuthorizer =
  new SingleUseCanaryHumanAuthorizer({
    context,

    io:
      noInputTTYIO,

    nonceFactory:
      () =>
        NONCE,

    now:
      fixedNow(
        ISSUED_AT,
      ),
  });

const noInputTTY =
  await noInputTTYAuthorizer
    .authorize(
      intent,
    );

const noInputTTYBlocked =
  noInputTTY ===
    false &&
  noInputTTYIO.reads ===
    0;

/*
 * ========================================================
 * TEST 4 — OUTPUT NON-TTY
 * ========================================================
 */

const noOutputTTYIO =
  new FakeIO(
    true,
    false,
  );

const noOutputTTYAuthorizer =
  new SingleUseCanaryHumanAuthorizer({
    context,

    io:
      noOutputTTYIO,

    nonceFactory:
      () =>
        NONCE,

    now:
      fixedNow(
        ISSUED_AT,
      ),
  });

const noOutputTTY =
  await noOutputTTYAuthorizer
    .authorize(
      intent,
    );

const noOutputTTYBlocked =
  noOutputTTY ===
    false &&
  noOutputTTYIO.reads ===
    0;

/*
 * ========================================================
 * TEST 5 — INTENT TAMPERED
 * ========================================================
 */

/*
 * Simula input runtime malformado.
 *
 * CanaryRoleIntent impide correctamente este valor
 * en compile-time, pero el boundary debe defenderse
 * también contra objetos adulterados en runtime.
 */
const tamperedIntent =
  {
    ...structuredClone(
      intent,
    ),

    permissions:
      'ManageRoles',
  } as unknown as CanaryRoleIntent;

const tamperedIO =
  new FakeIO(
    true,
    true,
  );

const tamperedAuthorizer =
  new SingleUseCanaryHumanAuthorizer({
    context,

    io:
      tamperedIO,

    nonceFactory:
      () =>
        NONCE,

    now:
      fixedNow(
        ISSUED_AT,
      ),
  });

const tamperedAccepted =
  await tamperedAuthorizer
    .authorize(
      tamperedIntent,
    );

const tamperedBlocked =
  tamperedAccepted ===
    false &&
  tamperedIO.reads ===
    0;

/*
 * ========================================================
 * TEST 6 — STALE RECEIPT
 * ========================================================
 */

const staleIO =
  new FakeIO(
    true,
    true,
  );

const staleAuthorizer =
  new SingleUseCanaryHumanAuthorizer({
    context,

    io:
      staleIO,

    nonceFactory:
      () =>
        NONCE,

    now:
      fixedNow(
        RECEIPT_EXPIRES_AT,
      ),
  });

const staleAccepted =
  await staleAuthorizer
    .authorize(
      intent,
    );

const staleBlocked =
  staleAccepted ===
    false &&
  staleIO.reads ===
    0;

/*
 * ========================================================
 * RESULT
 * ========================================================
 */

const success =
  validPass &&
  wrongPhraseBlocked &&
  noInputTTYBlocked &&
  noOutputTTYBlocked &&
  tamperedBlocked &&
  staleBlocked;

console.log('');
console.log(
  'Action-Time Human Authorization v1',
);
console.log('');

console.log(
  `Frase exacta TTY aceptada: ${validPass ? 'SÍ' : 'NO'}`,
);

console.log(
  `Frase incorrecta consume autorización: ${wrongPhraseBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `stdin non-TTY bloqueado: ${noInputTTYBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `stdout non-TTY bloqueado: ${noOutputTTYBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Intent alterado bloqueado antes de prompt: ${tamperedBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Receipt vencido bloqueado antes de prompt: ${staleBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');
console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');
console.log(
  'CLIENT.LOGIN: NO',
);

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'TOKEN: NO LEÍDO',
);

console.log(
  'GATEWAY REAL: NO',
);

console.log(
  'MUTACIONES REALES ENVIADAS: 0',
);

if (
  !success
) {
  process.exitCode =
    2;
}
