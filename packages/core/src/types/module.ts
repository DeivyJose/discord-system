export type ModuleKind =
  | 'community'
  | 'department'
  | 'institution'
  | 'service'
  | 'system';

export type DependencyKind =
  | 'module'
  | 'role'
  | 'channel'
  | 'voice_channel'
  | 'job'
  | 'automation'
  | 'feature';

export interface ModuleDependency {
  id: string;
  kind: DependencyKind;
  required: boolean;
}
