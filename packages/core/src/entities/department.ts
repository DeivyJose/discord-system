import type { ClockModule } from './module.js';

export interface Department extends ClockModule {
  kind: 'department';

  /**
   * Comunidad a la que pertenece, si aplica.
   */
  communityId?: string;

  /**
   * Trabajos cuyos empleados tienen acceso.
   */
  allowedJobIds: string[];

  private: boolean;
}
