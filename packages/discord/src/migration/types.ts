export type MigrationResourceKind =
  | 'category'
  | 'channel'
  | 'role';

export type MigrationAction =
  | 'bound'
  | 'suggest_bind'
  | 'create'
  | 'review'
  | 'unmanaged';

export type MigrationConfidence =
  | 'confirmed'
  | 'high'
  | 'medium'
  | 'none';

export interface DiscordBindings {
  schemaVersion: 1;

  guildId: string;

  updatedAt: string | null;

  resources: Record<string, string>;
}

export interface MigrationPlanItem {
  kind: MigrationResourceKind;

  action: MigrationAction;

  confidence: MigrationConfidence;

  blueprintId?: string;

  blueprintName?: string;

  actualId?: string;

  actualName?: string;

  reason: string;
}

export interface MigrationPlan {
  schemaVersion: 1;

  generatedAt: string;

  guild: {
    id: string;
    name: string;
  };

  summary: {
    bound: number;
    suggestedBindings: number;
    create: number;
    review: number;
    unmanaged: number;
  };

  items: MigrationPlanItem[];
}
