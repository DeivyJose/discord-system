import type { EntityStatus } from '../types/status.js';

export interface InstitutionDefinition {
  id: string;

  name: string;

  shortName: string;

  status: EntityStatus;

  countryCode: string;

  communityId: string;

  /**
   * La institución existe porque nosotros la registramos.
   * Un miembro normal nunca podrá crearla.
   */
  managed: true;
}
