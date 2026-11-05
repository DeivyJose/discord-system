import type { EntityStatus } from '../types/status.js';

export interface JobDefinition {
  id: string;

  name: string;

  description: string;

  status: EntityStatus;

  departmentId: string;

  /**
   * Salario base en Maricoins.
   *
   * Por ahora solamente definimos el concepto.
   * La economía real vendrá después.
   */
  baseSalary: number;

  /**
   * Cada cuántos días se paga.
   */
  salaryIntervalDays: number;

  /**
   * Días permitidos sin actividad válida.
   * null = sin despido automático.
   */
  inactivityLimitDays: number | null;

  /**
   * Permisos internos de The Clock.
   */
  permissions: string[];
}
