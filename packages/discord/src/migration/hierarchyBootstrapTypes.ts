export type HierarchyBootstrapStatus =
  | 'ready'
  | 'manual'
  | 'block';

export type HierarchyBootstrapAction =
  | 'create_then_promote'
  | 'promote_above_compai'
  | 'managed_anchor'
  | 'already_correct'
  | 'review';

export interface HierarchyBootstrapRole {
  blueprintId: string;

  desiredName: string;

  desiredRank: number;

  actualId: string | null;

  currentName: string | null;

  currentPosition: number | null;

  managed: boolean | null;

  status: HierarchyBootstrapStatus;

  action: HierarchyBootstrapAction;

  reason: string;
}

export interface HierarchyBootstrapCheck {
  id: string;

  status:
    | 'pass'
    | 'warn'
    | 'block';

  details: string;
}

export interface HierarchyBootstrapManualStep {
  order: number;

  title: string;

  details: string;
}

export interface HierarchyBootstrapPlan {
  schemaVersion: 1;

  generatedAt: string;

  guild: {
    id: string;
    name: string;
  };

  desiredHierarchy: readonly [
    'role_owner',
    'role_administrator',
    'role_compai',
  ];

  roles: HierarchyBootstrapRole[];

  checks: HierarchyBootstrapCheck[];

  manualSteps: HierarchyBootstrapManualStep[];

  summary: {
    ready: number;

    manual: number;

    block: number;

    bootstrapPossible: boolean;
  };

  executionAllowed: false;
}
