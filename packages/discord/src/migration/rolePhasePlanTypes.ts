export type RolePhasePlanCheckStatus =
  | 'pass'
  | 'block';

export interface RolePhasePlanCheck {
  id: string;

  status:
    RolePhasePlanCheckStatus;

  details: string;
}

export interface RolePhaseAutomaticPayload {
  operationId: string;

  blueprintId: string;

  name: string;

  permissions: '0';

  hoist: boolean;

  mentionable: boolean;

  reason: string;
}

export interface RolePhaseManualRole {
  operationId: string;

  blueprintId: string;

  name: string;

  classification:
    'manual_bootstrap';

  reason: string;
}

export interface RolePhaseBlockedRole {
  operationId: string;

  blueprintId:
    string | null;

  name:
    string | null;

  reasons:
    string[];
}

export interface RolePhasePlan {
  schemaVersion: 1;

  fingerprintVersion: 1;

  generatedAt: string;

  guildId: string;

  source: {
    blueprintFingerprint:
      string;

    operationsFingerprint:
      string;

    hierarchyFingerprint:
      string;

    provenanceFingerprint:
      string;
  };

  summary: {
    totalCreateRoles:
      number;

    automaticRoles:
      number;

    manualRoles:
      number;

    blockedRoles:
      number;

    pass:
      number;

    block:
      number;

    valid:
      boolean;
  };

  automatic:
    RolePhaseAutomaticPayload[];

  manual:
    RolePhaseManualRole[];

  blocked:
    RolePhaseBlockedRole[];

  checks:
    RolePhasePlanCheck[];

  controls: {
    continuationAllowed:
      false;

    executionAllowed:
      false;
  };

  planFingerprint:
    string;
}

export interface RolePhasePlanVerification {
  schemaVersion: 1;

  verifiedAt: string;

  status:
    | 'valid'
    | 'blocked';

  checks:
    RolePhasePlanCheck[];

  summary: {
    pass: number;

    block: number;

    valid: boolean;
  };

  executionAllowed:
    false;
}
