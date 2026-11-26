import type {
  CanaryRoleIntent,
} from './canaryGuardTypes.js';

import type {
  CanaryObservedRole,
  CanaryRoleCreatePayload,
  CanaryRoleGateway,
  SingleUseCanaryTransportErrorCode,
} from './canaryTransportTypes.js';

import {
  SingleUseCanaryTransport,
  SingleUseCanaryTransportError,
} from './singleUseCanaryTransport.js';

const VALID_INTENT:
  CanaryRoleIntent = {
  schemaVersion: 1,

  sessionId:
    'canary-session-test',

  guildId:
    'canary-guild-test',

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

function alteredIntent(
  patch:
    Record<string, unknown>,
): CanaryRoleIntent {
  return {
    ...structuredClone(
      VALID_INTENT,
    ),

    ...patch,
  } as unknown as
    CanaryRoleIntent;
}

class FakeCanaryRoleGateway
implements CanaryRoleGateway {
  readonly guildId:
    string;

  manageRoles =
    true;

  existingRole:
    CanaryObservedRole |
    null =
    null;

  failCreate =
    false;

  createCalls =
    0;

  payloads:
    CanaryRoleCreatePayload[] =
    [];

  createdRole:
    CanaryObservedRole;

  constructor(
    guildId =
      VALID_INTENT.guildId,
  ) {
    this.guildId =
      guildId;

    this.createdRole = {
      id:
        'fake-role-avisos-cdn',

      guildId:
        this.guildId,

      name:
        'Avisos CDN',

      managed:
        false,

      hoist:
        false,

      mentionable:
        true,

      permissions:
        '0',
    };
  }

  async canManageRoles():
    Promise<boolean> {
    return this.manageRoles;
  }

  async findRoleByName(
    name: string,
  ): Promise<
    CanaryObservedRole |
    null
  > {
    if (
      !this.existingRole ||
      this.existingRole.name !==
        name
    ) {
      return null;
    }

    return structuredClone(
      this.existingRole,
    );
  }

  async createRole(
    payload:
      CanaryRoleCreatePayload,
  ): Promise<
    CanaryObservedRole
  > {
    this.createCalls +=
      1;

    this.payloads.push(
      structuredClone(
        payload,
      ),
    );

    if (
      this.failCreate
    ) {
      throw new Error(
        'Fake gateway create failure.',
      );
    }

    return structuredClone(
      this.createdRole,
    );
  }
}

async function blockedWith(
  task:
    () => Promise<unknown>,
  expectedCode:
    SingleUseCanaryTransportErrorCode,
): Promise<boolean> {
  try {
    await task();

    return false;
  } catch (
    error
  ) {
    return (
      error instanceof
        SingleUseCanaryTransportError &&
      error.code ===
        expectedCode
    );
  }
}

/*
 * ========================================================
 * TEST 1 — CAMINO VÁLIDO
 * ========================================================
 */

const validGateway =
  new FakeCanaryRoleGateway();

const validTransport =
  new SingleUseCanaryTransport(
    validGateway,
  );

const validResult =
  await validTransport.execute(
    VALID_INTENT,
  );

const validPayload =
  validGateway.payloads[0];

const validPasses =
  validResult.status ===
    'applied' &&
  validResult.actualId ===
    'fake-role-avisos-cdn' &&
  validResult.executionAllowed ===
    false &&
  validGateway.createCalls ===
    1 &&
  validTransport.getMutationCalls() ===
    1 &&
  validTransport.getAttempts() ===
    1 &&
  validTransport.isConsumed() &&
  validPayload !==
    undefined &&
  validPayload.name ===
    'Avisos CDN' &&
  validPayload.permissions ===
    '0' &&
  validPayload.hoist ===
    false &&
  validPayload.mentionable ===
    true &&
  validPayload.reason ===
    'The Clock controlled canary migration: create_role:role_notify_news';

/*
 * ========================================================
 * TEST 2 — SEGUNDA LLAMADA
 * ========================================================
 */

const secondCallBlocked =
  await blockedWith(
    () =>
      validTransport.execute(
        VALID_INTENT,
      ),

    'CANARY_TRANSPORT_SINGLE_USE_CONSUMED',
  );

const secondCallNoMutation =
  validGateway.createCalls ===
    1 &&
  validTransport.getMutationCalls() ===
    1;

/*
 * ========================================================
 * TEST 3 — NOMBRE ALTERADO
 * ========================================================
 */

const wrongNameGateway =
  new FakeCanaryRoleGateway();

const wrongNameTransport =
  new SingleUseCanaryTransport(
    wrongNameGateway,
  );

const wrongNameBlocked =
  await blockedWith(
    () =>
      wrongNameTransport.execute(
        alteredIntent({
          name:
            'Administrador',
        }),
      ),

    'CANARY_TRANSPORT_INTENT_REJECTED',
  ) &&
  wrongNameGateway.createCalls ===
    0;

/*
 * ========================================================
 * TEST 4 — HOIST ALTERADO
 * ========================================================
 */

const wrongHoistGateway =
  new FakeCanaryRoleGateway();

const wrongHoistTransport =
  new SingleUseCanaryTransport(
    wrongHoistGateway,
  );

const wrongHoistBlocked =
  await blockedWith(
    () =>
      wrongHoistTransport.execute(
        alteredIntent({
          hoist:
            true,
        }),
      ),

    'CANARY_TRANSPORT_INTENT_REJECTED',
  ) &&
  wrongHoistGateway.createCalls ===
    0;

/*
 * ========================================================
 * TEST 5 — MENTIONABLE ALTERADO
 * ========================================================
 */

const wrongMentionableGateway =
  new FakeCanaryRoleGateway();

const wrongMentionableTransport =
  new SingleUseCanaryTransport(
    wrongMentionableGateway,
  );

const wrongMentionableBlocked =
  await blockedWith(
    () =>
      wrongMentionableTransport.execute(
        alteredIntent({
          mentionable:
            false,
        }),
      ),

    'CANARY_TRANSPORT_INTENT_REJECTED',
  ) &&
  wrongMentionableGateway.createCalls ===
    0;

/*
 * ========================================================
 * TEST 6 — PERMISOS NO-CERO
 * ========================================================
 */

const permissionsGateway =
  new FakeCanaryRoleGateway();

const permissionsTransport =
  new SingleUseCanaryTransport(
    permissionsGateway,
  );

const permissionsBlocked =
  await blockedWith(
    () =>
      permissionsTransport.execute(
        alteredIntent({
          permissions:
            '8',
        }),
      ),

    'CANARY_TRANSPORT_INTENT_REJECTED',
  ) &&
  permissionsGateway.createCalls ===
    0;

/*
 * ========================================================
 * TEST 7 — GUILD INCORRECTO
 * ========================================================
 */

const wrongGuildGateway =
  new FakeCanaryRoleGateway(
    'otro-guild',
  );

const wrongGuildTransport =
  new SingleUseCanaryTransport(
    wrongGuildGateway,
  );

const wrongGuildBlocked =
  await blockedWith(
    () =>
      wrongGuildTransport.execute(
        VALID_INTENT,
      ),

    'CANARY_TRANSPORT_GUILD_MISMATCH',
  ) &&
  wrongGuildGateway.createCalls ===
    0;

/*
 * ========================================================
 * TEST 8 — SIN MANAGE ROLES
 * ========================================================
 */

const noPermissionGateway =
  new FakeCanaryRoleGateway();

noPermissionGateway.manageRoles =
  false;

const noPermissionTransport =
  new SingleUseCanaryTransport(
    noPermissionGateway,
  );

const noPermissionBlocked =
  await blockedWith(
    () =>
      noPermissionTransport.execute(
        VALID_INTENT,
      ),

    'CANARY_TRANSPORT_MANAGE_ROLES_REQUIRED',
  ) &&
  noPermissionGateway.createCalls ===
    0;

/*
 * ========================================================
 * TEST 9 — TARGET YA EXISTE
 * ========================================================
 */

const targetExistsGateway =
  new FakeCanaryRoleGateway();

targetExistsGateway.existingRole = {
  id:
    'existing-role',

  guildId:
    VALID_INTENT.guildId,

  name:
    'Avisos CDN',

  managed:
    false,

  hoist:
    false,

  mentionable:
    true,

  permissions:
    '0',
};

const targetExistsTransport =
  new SingleUseCanaryTransport(
    targetExistsGateway,
  );

const targetExistsBlocked =
  await blockedWith(
    () =>
      targetExistsTransport.execute(
        VALID_INTENT,
      ),

    'CANARY_TRANSPORT_TARGET_EXISTS',
  ) &&
  targetExistsGateway.createCalls ===
    0;

/*
 * ========================================================
 * TEST 10 — CREATE FALLA
 * ========================================================
 */

const createFailureGateway =
  new FakeCanaryRoleGateway();

createFailureGateway.failCreate =
  true;

const createFailureTransport =
  new SingleUseCanaryTransport(
    createFailureGateway,
  );

const createFailureBlocked =
  await blockedWith(
    () =>
      createFailureTransport.execute(
        VALID_INTENT,
      ),

    'CANARY_TRANSPORT_CREATE_FAILED',
  ) &&
  createFailureGateway.createCalls ===
    1 &&
  createFailureTransport
    .getMutationCalls() ===
    1 &&
  createFailureTransport
    .isConsumed();

const retryAfterFailureBlocked =
  await blockedWith(
    () =>
      createFailureTransport.execute(
        VALID_INTENT,
      ),

    'CANARY_TRANSPORT_SINGLE_USE_CONSUMED',
  ) &&
  createFailureGateway.createCalls ===
    1;

/*
 * ========================================================
 * TEST 11 — POSTCONDICIÓN INCORRECTA
 * ========================================================
 */

const badResultGateway =
  new FakeCanaryRoleGateway();

badResultGateway.createdRole = {
  ...badResultGateway.createdRole,

  managed:
    true,
};

const badResultTransport =
  new SingleUseCanaryTransport(
    badResultGateway,
  );

const badResultBlocked =
  await blockedWith(
    () =>
      badResultTransport.execute(
        VALID_INTENT,
      ),

    'CANARY_TRANSPORT_POSTCONDITION_FAILED',
  ) &&
  badResultGateway.createCalls ===
    1 &&
  badResultTransport
    .getMutationCalls() ===
    1;

const retryAfterBadResultBlocked =
  await blockedWith(
    () =>
      badResultTransport.execute(
        VALID_INTENT,
      ),

    'CANARY_TRANSPORT_SINGLE_USE_CONSUMED',
  ) &&
  badResultGateway.createCalls ===
    1;

/*
 * ========================================================
 * RESULTADO
 * ========================================================
 */

const success =
  validPasses &&
  secondCallBlocked &&
  secondCallNoMutation &&
  wrongNameBlocked &&
  wrongHoistBlocked &&
  wrongMentionableBlocked &&
  permissionsBlocked &&
  wrongGuildBlocked &&
  noPermissionBlocked &&
  targetExistsBlocked &&
  createFailureBlocked &&
  retryAfterFailureBlocked &&
  badResultBlocked &&
  retryAfterBadResultBlocked;

console.log('');
console.log(
  'Single-Use Canary Transport Contract v1',
);
console.log('');

console.log(
  `Payload exacto aceptado: ${validPasses ? 'SÍ' : 'NO'}`,
);

console.log(
  `Segunda llamada bloqueada: ${secondCallBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Mutaciones tras segunda llamada: ${validGateway.createCalls}`,
);

console.log('');

console.log(
  `Nombre alterado bloqueado: ${wrongNameBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Hoist alterado bloqueado: ${wrongHoistBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Mentionable alterado bloqueado: ${wrongMentionableBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Permisos no-cero bloqueados: ${permissionsBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Guild incorrecto bloqueado: ${wrongGuildBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Sin ManageRoles bloqueado: ${noPermissionBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Target existente bloqueado: ${targetExistsBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Fallo create sin retry automático: ${createFailureBlocked && retryAfterFailureBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Postcondición incorrecta bloqueada: ${badResultBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Retry tras postcondición bloqueado: ${retryAfterBadResultBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  'GATEWAY: FAKE',
);

console.log(
  'CONEXIÓN A DISCORD: NO',
);

console.log(
  'CLIENT.LOGIN: NO',
);

console.log(
  'MUTACIONES REALES ENVIADAS: 0',
);

console.log(
  'EJECUCIÓN REAL PERMITIDA: NO',
);

console.log('');

if (
  !success
) {
  process.exitCode =
    2;
}
