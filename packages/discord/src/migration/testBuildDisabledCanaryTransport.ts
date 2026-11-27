import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

import {
  BUILD_DISABLED_CANARY_ERROR,
  BuildDisabledCanaryTransport,
} from './buildDisabledCanaryTransport.js';

const intent:
  CanaryRoleIntent = {
    schemaVersion:
      1,

    sessionId:
      'aaaaaaaaaaaaaaaaaaaaaaaa',

    guildId:
      '1494545796492824656',

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

const transport =
  new BuildDisabledCanaryTransport();

let firstBlocked =
  false;

try {
  await transport.execute(
    intent,
  );
} catch (
  error
) {
  firstBlocked =
    error instanceof Error &&
    error.message ===
      BUILD_DISABLED_CANARY_ERROR;
}

const firstStateSafe =
  firstBlocked &&
  transport.isConsumed() ===
    true &&
  transport.getAttempts() ===
    1 &&
  transport.getMutationCalls() ===
    0;

let replayBlocked =
  false;

try {
  await transport.execute(
    intent,
  );
} catch (
  error
) {
  replayBlocked =
    error instanceof Error &&
    error.message ===
      'BUILD_DISABLED_CANARY_ALREADY_CONSUMED';
}

const replayStateSafe =
  replayBlocked &&
  transport.isConsumed() ===
    true &&
  transport.getAttempts() ===
    2 &&
  transport.getMutationCalls() ===
    0;

const success =
  firstStateSafe &&
  replayStateSafe;

console.log('');
console.log(
  'Build-Disabled Canary Transport v1',
);
console.log('');

console.log(
  `Primera ejecución hard-blocked: ${firstBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Single-use preservado: ${replayBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Mutation calls = 0: ${
    transport.getMutationCalls() === 0
      ? 'SÍ'
      : 'NO'
  }`,
);

console.log('');
console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');
console.log(
  'DISCORD.JS: NO',
);

console.log(
  'GATEWAY REAL: NO',
);

console.log(
  'CLIENT.LOGIN: NO',
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
