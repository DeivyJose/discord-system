import type { Community } from '../entities/community.js';

type CommunitySeed = Omit<
  Community,
  'createdAt' | 'updatedAt'
>;

export const COMMUNITIES = [
  {
    id: 'community_general',
    name: 'El Malecón',
    description: 'Comunidad general y punto de encuentro de todos los miembros.',
    kind: 'community',
    status: 'enabled',
    dependencies: [],
    private: false,
  },

  {
    id: 'community_campus',
    name: 'Campus RD',
    description: 'Comunidad académica de universidades e instituciones dominicanas.',
    kind: 'community',
    status: 'enabled',
    dependencies: [],
    responsibleJobId: 'job_campus_director',
    private: false,
  },

  {
    id: 'community_gaming',
    name: 'Zona Franca Gaming',
    description: 'Comunidad dedicada a videojuegos, clanes y actividades gaming.',
    kind: 'community',
    status: 'enabled',
    dependencies: [],
    responsibleJobId: 'job_gaming_commissioner',
    private: false,
  },

  {
    id: 'community_basketball',
    name: 'Palacio del Basket',
    description: 'Comunidad dedicada al basketball dominicano e internacional.',
    kind: 'community',
    status: 'enabled',
    dependencies: [],
    responsibleJobId: 'job_basket_commissioner',
    private: false,
  },

  {
    id: 'community_events',
    name: 'Centro Olímpico',
    description: 'Centro general para eventos, actividades e inscripciones.',
    kind: 'community',
    status: 'enabled',
    dependencies: [],
    responsibleJobId: 'job_events_director',
    private: false,
  },

  {
    id: 'community_private',
    name: 'Sector 27',
    description: 'Comunidad privada de acceso administrado.',
    kind: 'community',
    status: 'enabled',
    dependencies: [],
    private: true,
  },
] satisfies CommunitySeed[];
