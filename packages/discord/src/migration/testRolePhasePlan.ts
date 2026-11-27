import {
  readFile,
} from 'node:fs/promises';

import path from 'node:path';

import type {
  DiscordBlueprintArtifact,
} from '../blueprint/artifact.js';

import type {
  HierarchyBootstrapPlan,
} from './hierarchyBootstrapTypes.js';

import type {
  MigrationProvenanceArtifact,
} from './migrationProvenanceTypes.js';

import type {
  MigrationOperationsPlan,
} from './operationTypes.js';

import {
  createRolePhasePlan,
  verifyRolePhasePlan,
} from './rolePhasePlan.js';

async function readJson<T>(
  filePath: string,
): Promise<T> {
  return JSON.parse(
    await readFile(
      filePath,
      'utf8',
    ),
  ) as T;
}

const projectRoot =
  path.resolve(
    process.cwd(),
    '../..',
  );

const dataRoot =
  path.join(
    projectRoot,
    '.data',
  );

const [
  blueprint,
  operations,
  hierarchy,
  provenance,
] =
  await Promise.all([
    readJson<
      DiscordBlueprintArtifact
    >(
      path.join(
        dataRoot,
        'discord-blueprint',
        'latest.json',
      ),
    ),

    readJson<
      MigrationOperationsPlan
    >(
      path.join(
        dataRoot,
        'migration-operations',
        'latest.json',
      ),
    ),

    readJson<
      HierarchyBootstrapPlan
    >(
      path.join(
        dataRoot,
        'hierarchy-bootstrap',
        'latest.json',
      ),
    ),

    readJson<
      MigrationProvenanceArtifact
    >(
      path.join(
        dataRoot,
        'migration-provenance',
        'latest.json',
      ),
    ),
  ]);

const fixedNow =
  new Date(
    '2026-11-27T21:30:00.000Z',
  );

const input = {
  blueprint,
  operations,
  hierarchy,
  provenance,
};

const plan =
  createRolePhasePlan(
    input,
    fixedNow,
  );

const validVerification =
  verifyRolePhasePlan(
    plan,
    input,
    fixedNow,
  );

/*
 * generatedAt no forma parte de la identidad
 * semántica. Mismas fuentes, distinta hora,
 * mismo planFingerprint.
 */
const laterPlan =
  createRolePhasePlan(
    input,
    new Date(
      '2026-11-28T10:45:00.000Z',
    ),
  );

const semanticFingerprintStable =
  laterPlan.planFingerprint ===
    plan.planFingerprint &&
  laterPlan.generatedAt !==
    plan.generatedAt;

const validAccepted =
  plan.summary.valid &&
  plan.summary
    .totalCreateRoles ===
      23 &&
  plan.summary
    .automaticRoles ===
      22 &&
  plan.summary
    .manualRoles ===
      1 &&
  plan.summary
    .blockedRoles ===
      0 &&
  validVerification
    .summary.valid;

const ownerExcluded =
  !plan.automatic.some(
    item =>
      item.blueprintId ===
        'role_owner',
  ) &&
  plan.manual.length ===
    1 &&
  plan.manual[0]
    ?.operationId ===
      'create_role:role_owner';

const zeroPermissions =
  plan.automatic.every(
    item =>
      item.permissions ===
        '0',
  );

/*
 * TAMPER 1:
 * cambiar permissions en el plan sellado.
 */
const permissionsTampered =
  structuredClone(
    plan,
  );

if (
  permissionsTampered
    .automatic[0]
) {
  (
    permissionsTampered
      .automatic[0] as {
        permissions: string;
      }
  ).permissions =
    '8';
}

const permissionsTamperBlocked =
  !verifyRolePhasePlan(
    permissionsTampered,
    input,
    fixedNow,
  ).summary.valid;

/*
 * TAMPER 2:
 * insertar Owner en automatic.
 */
const ownerTampered =
  structuredClone(
    plan,
  );

const firstAutomatic =
  ownerTampered
    .automatic[0];

if (
  firstAutomatic
) {
  ownerTampered
    .automatic.push({
      ...firstAutomatic,

      operationId:
        'create_role:role_owner',

      blueprintId:
        'role_owner',

      name:
        'Dueño',
    });
}

const ownerTamperBlocked =
  !verifyRolePhasePlan(
    ownerTampered,
    input,
    fixedNow,
  ).summary.valid;

/*
 * SOURCE TAMPER 1:
 * alterar una operación sin regenerar Provenance.
 */
const operationsTampered =
  structuredClone(
    operations,
  );

const firstPendingAutomatic =
  operationsTampered
    .operations
    .find(
      operation =>
        operation.type ===
          'create_role' &&
        operation.blueprintId !==
          'role_owner',
    );

if (
  firstPendingAutomatic
) {
  firstPendingAutomatic
    .desiredName =
      `${firstPendingAutomatic.desiredName ?? ''} TAMPER`;
}

const operationsSourceBlocked =
  !createRolePhasePlan(
    {
      blueprint,
      operations:
        operationsTampered,
      hierarchy,
      provenance,
    },
    fixedNow,
  ).summary.valid;

/*
 * SOURCE TAMPER 2:
 * Owner deja de ser manual.
 */
const hierarchyTampered =
  structuredClone(
    hierarchy,
  );

const ownerHierarchy =
  hierarchyTampered
    .roles
    .find(
      role =>
        role.blueprintId ===
          'role_owner',
    );

if (
  ownerHierarchy
) {
  ownerHierarchy.status =
    'ready';

  ownerHierarchy.action =
    'already_correct';
}

const hierarchySourceBlocked =
  !createRolePhasePlan(
    {
      blueprint,
      operations,
      hierarchy:
        hierarchyTampered,
      provenance,
    },
    fixedNow,
  ).summary.valid;

/*
 * SOURCE TAMPER 3:
 * Provenance deja de sellar Operations.
 */
const provenanceTampered =
  structuredClone(
    provenance,
  );

provenanceTampered
  .artifacts
  .operationsFingerprint =
    '0'.repeat(
      64,
    );

const provenanceSourceBlocked =
  !createRolePhasePlan(
    {
      blueprint,
      operations,
      hierarchy,
      provenance:
        provenanceTampered,
    },
    fixedNow,
  ).summary.valid;

/*
 * SOURCE TAMPER 4:
 * cambiar el Blueprint materializado sin
 * regenerar su fingerprint.
 */
const blueprintTampered =
  structuredClone(
    blueprint,
  );

const roleToTamper =
  blueprintTampered
    .roles
    .find(
      role =>
        role.id ===
          'role_police_coronel',
    );

if (
  roleToTamper
) {
  roleToTamper.systemManaged =
    false;
}

const blueprintSourceBlocked =
  !createRolePhasePlan(
    {
      blueprint:
        blueprintTampered,
      operations,
      hierarchy,
      provenance,
    },
    fixedNow,
  ).summary.valid;

const success =
  validAccepted &&
  semanticFingerprintStable &&
  ownerExcluded &&
  zeroPermissions &&
  permissionsTamperBlocked &&
  ownerTamperBlocked &&
  operationsSourceBlocked &&
  hierarchySourceBlocked &&
  provenanceSourceBlocked &&
  blueprintSourceBlocked;

console.log('');
console.log(
  'Role Phase Plan v1 — adversarial tests',
);
console.log('');

console.log(
  `Plan válido aceptado: ${validAccepted ? 'SÍ' : 'NO'}`,
);

console.log(
  `Fingerprint semántico estable: ${semanticFingerprintStable ? 'SÍ' : 'NO'}`,
);

console.log(
  `Owner fuera de automatic: ${ownerExcluded ? 'SÍ' : 'NO'}`,
);

console.log(
  `Permissions=0 en automatic: ${zeroPermissions ? 'SÍ' : 'NO'}`,
);

console.log(
  `Permissions tamper bloqueado: ${permissionsTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Owner tamper bloqueado: ${ownerTamperBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Operations tamper bloqueado: ${operationsSourceBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Hierarchy tamper bloqueado: ${hierarchySourceBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Provenance tamper bloqueado: ${provenanceSourceBlocked ? 'SÍ' : 'NO'}`,
);

console.log(
  `Blueprint tamper bloqueado: ${blueprintSourceBlocked ? 'SÍ' : 'NO'}`,
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
  'MUTACIONES REALES: 0',
);

console.log(
  'CONTINUACIÓN AUTOMÁTICA: NO',
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
