import type {
  DiscordMutationRequest,
} from './discordMutationRequestTypes.js';

export type MutationBindingSource =
  | 'operation'
  | 'session'
  | 'confirmed'
  | 'none';

export interface MutationResolverBindings {
  /**
   * Bindings confirmados antes de iniciar
   * la sesión de ejecución.
   *
   * blueprintId -> Discord actualId
   */
  confirmed:
    Readonly<Record<string, string>>;

  /**
   * Bindings creados durante la sesión
   * actual.
   *
   * Tienen prioridad porque permiten que
   * recursos creados en fases anteriores
   * sean utilizados por fases posteriores.
   */
  session:
    Readonly<Record<string, string>>;
}

export interface ResolvedBlueprintResource {
  id: string;

  kind: string;

  name: string;

  /**
   * Copia completa del recurso Blueprint.
   *
   * Conservamos aquí metadatos como:
   * position, access, priority, hoist,
   * mentionable, description, etc.
   */
  definition:
    Record<string, unknown>;
}

export interface ResolvedDiscordMutationRequest
extends DiscordMutationRequest {
  blueprintResource:
    ResolvedBlueprintResource | null;

  resolvedActualId:
    string | null;

  actualIdSource:
    MutationBindingSource;

  resolvedParentBlueprintId:
    string | null;

  resolvedParentActualId:
    string | null;

  parentActualIdSource:
    MutationBindingSource;

  resolvedChannelKind:
    string | null;

  resolverUnresolvedFields:
    string[];

  ready:
    boolean;

  executionAllowed: false;
}

export interface MutationResolverResult {
  schemaVersion: 1;

  request:
    ResolvedDiscordMutationRequest;

  ready:
    boolean;

  executionAllowed: false;
}
