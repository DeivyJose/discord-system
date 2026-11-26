import {
  PermissionFlagsBits,
} from 'discord.js';

import type {
  Guild,
  Role,
  RoleCreateOptions,
} from 'discord.js';

import type {
  CanaryRoleCreatePayload,
} from './canaryTransportTypes.js';

import {
  DiscordJsCanaryRoleGateway,
  DiscordJsCanaryRoleGatewayError,
} from './discordJsCanaryRoleGateway.js';

const GUILD_ID =
  'fake-canary-guild';

const VALID_PAYLOAD:
  CanaryRoleCreatePayload = {
  name:
    'Avisos CDN',

  permissions:
    '0',

  hoist:
    false,

  mentionable:
    true,

  reason:
    'The Clock controlled canary migration: create_role:role_notify_news',
};

interface FakeState {
  manageRoles:
    boolean;

  administrator:
    boolean;

  existingRoles:
    Role[];

  createCalls:
    number;

  createOptions:
    RoleCreateOptions[];

  createdRole:
    Role;
}

function fakeRole(
  overrides: {
    id?: string;
    name?: string;
    managed?: boolean;
    hoist?: boolean;
    mentionable?: boolean;
    permissions?: bigint;
  } = {},
): Role {
  const role = {
    id:
      overrides.id ??
      'fake-role-id',

    guild: {
      id:
        GUILD_ID,
    },

    name:
      overrides.name ??
      'Avisos CDN',

    managed:
      overrides.managed ??
      false,

    hoist:
      overrides.hoist ??
      false,

    mentionable:
      overrides.mentionable ??
      true,

    permissions: {
      bitfield:
        overrides.permissions ??
        0n,
    },
  };

  return role as unknown as
    Role;
}

function createFakeGuild(
  overrides: {
    manageRoles?: boolean;
    administrator?: boolean;
    existingRoles?: Role[];
    createdRole?: Role;
  } = {},
): {
  guild: Guild;
  state: FakeState;
} {
  const state:
    FakeState = {
    manageRoles:
      overrides.manageRoles ??
      true,

    administrator:
      overrides.administrator ??
      false,

    existingRoles:
      overrides.existingRoles ??
      [],

    createCalls:
      0,

    createOptions:
      [],

    createdRole:
      overrides.createdRole ??
      fakeRole(),
  };

  const permissions = {
    has(
      permission:
        bigint,
      _checkAdmin?:
        boolean,
    ): boolean {
      if (
        permission ===
          PermissionFlagsBits
            .Administrator
      ) {
        return state
          .administrator;
      }

      if (
        permission ===
          PermissionFlagsBits
            .ManageRoles
      ) {
        return state
          .manageRoles;
      }

      return false;
    },
  };

  const guild = {
    id:
      GUILD_ID,

    members: {
      async fetchMe() {
        return {
          permissions,
        };
      },
    },

    roles: {
      async fetch() {
        return {
          find(
            predicate:
              (
                role: Role,
              ) => boolean,
          ) {
            return state
              .existingRoles
              .find(
                predicate,
              );
          },
        };
      },

      async create(
        options:
          RoleCreateOptions,
      ) {
        state.createCalls +=
          1;

        state.createOptions.push(
          structuredClone(
            options,
          ),
        );

        return state
          .createdRole;
      },
    },
  };

  return {
    guild:
      guild as unknown as
        Guild,

    state,
  };
}

/*
 * ========================================================
 * TEST 1 — MANAGE ROLES EXPLÍCITO
 * ========================================================
 */

const validFixture =
  createFakeGuild();

const validGateway =
  new DiscordJsCanaryRoleGateway(
    validFixture.guild,
  );

const manageRolesAllowed =
  await validGateway
    .canManageRoles();

/*
 * ========================================================
 * TEST 2 — ADMINISTRATOR BLOQUEA EL CANARY
 * ========================================================
 */

const administratorFixture =
  createFakeGuild({
    manageRoles:
      true,

    administrator:
      true,
  });

const administratorGateway =
  new DiscordJsCanaryRoleGateway(
    administratorFixture.guild,
  );

const administratorBlocked =
  (
    await administratorGateway
      .canManageRoles()
  ) ===
  false;

/*
 * ========================================================
 * TEST 3 — SIN MANAGE ROLES
 * ========================================================
 */

const noManageRolesFixture =
  createFakeGuild({
    manageRoles:
      false,
  });

const noManageRolesGateway =
  new DiscordJsCanaryRoleGateway(
    noManageRolesFixture.guild,
  );

const missingManageRolesBlocked =
  (
    await noManageRolesGateway
      .canManageRoles()
  ) ===
  false;

/*
 * ========================================================
 * TEST 4 — TARGET AUSENTE
 * ========================================================
 */

const missingTarget =
  await validGateway
    .findRoleByName(
      'Avisos CDN',
    );

const targetAbsentDetected =
  missingTarget ===
    null;

/*
 * ========================================================
 * TEST 5 — TARGET EXISTENTE
 * ========================================================
 */

const existingRole =
  fakeRole({
    id:
      'existing-avisos-cdn',
  });

const existingFixture =
  createFakeGuild({
    existingRoles: [
      existingRole,
    ],
  });

const existingGateway =
  new DiscordJsCanaryRoleGateway(
    existingFixture.guild,
  );

const observedExisting =
  await existingGateway
    .findRoleByName(
      'Avisos CDN',
    );

const targetExistingDetected =
  observedExisting
    ?.id ===
      'existing-avisos-cdn' &&
  observedExisting
    .guildId ===
      GUILD_ID &&
  observedExisting
    .permissions ===
      '0';

/*
 * ========================================================
 * TEST 6 — CREATE EXACTO
 * ========================================================
 */

const created =
  await validGateway
    .createRole(
      VALID_PAYLOAD,
    );

const createOptions =
  validFixture
    .state
    .createOptions[0];

const exactCreatePasses =
  validFixture
    .state
    .createCalls ===
      1 &&
  createOptions !==
    undefined &&
  createOptions.name ===
    'Avisos CDN' &&
  createOptions.permissions ===
    0n &&
  createOptions.hoist ===
    false &&
  createOptions.mentionable ===
    true &&
  createOptions.reason ===
    'The Clock controlled canary migration: create_role:role_notify_news' &&
  created.id ===
    'fake-role-id' &&
  created.guildId ===
    GUILD_ID &&
  created.name ===
    'Avisos CDN' &&
  created.managed ===
    false &&
  created.hoist ===
    false &&
  created.mentionable ===
    true &&
  created.permissions ===
    '0';

/*
 * ========================================================
 * TEST 7 — PAYLOAD ALTERADO BLOQUEADO EN GATEWAY
 * ========================================================
 */

const alteredFixture =
  createFakeGuild();

const alteredGateway =
  new DiscordJsCanaryRoleGateway(
    alteredFixture.guild,
  );

const alteredPayload = {
  ...structuredClone(
    VALID_PAYLOAD,
  ),

  permissions:
    '8',
} as unknown as
  CanaryRoleCreatePayload;

let alteredPayloadBlocked =
  false;

try {
  await alteredGateway
    .createRole(
      alteredPayload,
    );
} catch (
  error
) {
  alteredPayloadBlocked =
    error instanceof
      DiscordJsCanaryRoleGatewayError &&
    error.code ===
      'DISCORDJS_CANARY_PAYLOAD_REJECTED';
}

const alteredPayloadNoMutation =
  alteredFixture
    .state
    .createCalls ===
      0;

/*
 * ========================================================
 * TEST 8 — POSTCONDITION DATA PRESERVADA
 * ========================================================
 */

const badCreatedFixture =
  createFakeGuild({
    createdRole:
      fakeRole({
        id:
          'managed-result',

        managed:
          true,

        permissions:
          PermissionFlagsBits
            .ManageRoles,
      }),
  });

const badCreatedGateway =
  new DiscordJsCanaryRoleGateway(
    badCreatedFixture.guild,
  );

const badObserved =
  await badCreatedGateway
    .createRole(
      VALID_PAYLOAD,
    );

const unsafeRemoteStateVisible =
  badObserved.managed ===
    true &&
  badObserved.permissions ===
    PermissionFlagsBits
      .ManageRoles
      .toString();

/*
 * El Gateway solo observa y devuelve.
 *
 * SingleUseCanaryTransport es quien debe
 * rechazar esta postcondición.
 */
const gatewayDoesNotHideBadResult =
  unsafeRemoteStateVisible &&
  badCreatedFixture
    .state
    .createCalls ===
      1;

/*
 * ========================================================
 * RESULTADO
 * ========================================================
 */

const success =
  manageRolesAllowed &&
  administratorBlocked &&
  missingManageRolesBlocked &&
  targetAbsentDetected &&
  targetExistingDetected &&
  exactCreatePasses &&
  alteredPayloadBlocked &&
  alteredPayloadNoMutation &&
  gatewayDoesNotHideBadResult;

console.log('');
console.log(
  'Discord.js Canary Role Gateway v1',
);
console.log('');

console.log(
  `ManageRoles explícito aceptado: ${manageRolesAllowed ? 'SÍ' : 'NO'}`,
);

console.log(
  `Administrator bloquea Canary: ${administratorBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Sin ManageRoles bloqueado: ${missingManageRolesBlocked ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Target ausente detectado: ${targetAbsentDetected ? 'SÍ' : 'NO'}`,
);

console.log(
  `Target existente detectado: ${targetExistingDetected ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `roles.create recibe payload exacto: ${exactCreatePasses ? 'SÍ' : 'NO'}`,
);

console.log(
  `Payload alterado bloqueado antes de create: ${alteredPayloadBlocked && alteredPayloadNoMutation ? 'SÍ' : 'NO'}`,
);

console.log(
  `Resultado remoto inseguro preservado para postcondition guard: ${gatewayDoesNotHideBadResult ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  `Prueba completa: ${success ? 'SÍ' : 'NO'}`,
);

console.log('');

console.log(
  'GUILD: FAKE',
);

console.log(
  'CLIENT: NO CREADO',
);

console.log(
  'CLIENT.LOGIN: NO',
);

console.log(
  'TOKEN: NO LEÍDO',
);

console.log(
  'CONEXIÓN A DISCORD: NO',
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
