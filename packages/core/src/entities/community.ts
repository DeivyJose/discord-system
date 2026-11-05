import type { ClockModule } from './module.js';

export interface Community extends ClockModule {
  kind: 'community';

  /**
   * ID del trabajo responsable de la comunidad.
   *
   * Ejemplo:
   * job_basketball_commissioner
   */
  responsibleJobId?: string;

  /**
   * Permite ocultar completamente esta comunidad
   * a usuarios sin acceso.
   */
  private: boolean;
}
