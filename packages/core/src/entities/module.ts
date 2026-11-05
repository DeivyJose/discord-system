import type { EntityStatus } from '../types/status.js';
import type {
  ModuleDependency,
  ModuleKind,
} from '../types/module.js';

export interface ClockModule {
  /**
   * Identificador interno permanente.
   *
   * Ejemplo:
   * community_basketball
   *
   * Nunca debe depender del nombre visible.
   */
  id: string;

  /**
   * Nombre visible y modificable.
   *
   * Ejemplo:
   * Palacio del Basket
   */
  name: string;

  description: string;

  kind: ModuleKind;

  status: EntityStatus;

  dependencies: ModuleDependency[];

  createdAt: Date;

  updatedAt: Date;
}
