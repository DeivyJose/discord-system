import type { Department } from '../entities/department.js';

type DepartmentSeed = Omit<
  Department,
  'createdAt' | 'updatedAt'
>;

export const DEPARTMENTS = [
  {
    id: 'department_administration',
    name: 'Palacio 809',
    description: 'Centro administrativo superior de The Clock.',
    kind: 'department',
    status: 'enabled',
    dependencies: [],
    allowedJobIds: [],
    private: true,
  },

  {
    id: 'department_police',
    name: 'Departamento de Policía',
    description: 'Departamento responsable de moderación, reportes y casos disciplinarios.',
    kind: 'department',
    status: 'enabled',
    dependencies: [],
    allowedJobIds: [
      'job_police_coronel',
      'job_police_officer'
    ],
    private: true,
  },

  {
    id: 'department_cdn',
    name: 'CDN - Redacción',
    description: 'Departamento encargado de redactar, revisar y publicar noticias.',
    kind: 'department',
    status: 'enabled',
    dependencies: [],
    allowedJobIds: [
      'job_cdn_director',
      'job_cdn_editor',
      'job_cdn_reporter'
    ],
    private: true,
  },

  {
    id: 'department_customer_service',
    name: 'Ventanilla 809',
    description: 'Departamento privado de servicio y asistencia a miembros.',
    kind: 'department',
    status: 'enabled',
    dependencies: [],
    allowedJobIds: [
      'job_support_director',
      'job_support_supervisor',
      'job_support_representative'
    ],
    private: true,
  },

  {
    id: 'department_campus',
    name: 'Dirección de Campus RD',
    description: 'Departamento encargado de administrar Campus RD.',
    kind: 'department',
    status: 'enabled',
    dependencies: [
      {
        id: 'community_campus',
        kind: 'module',
        required: true
      }
    ],
    communityId: 'community_campus',
    allowedJobIds: [
      'job_campus_director',
      'job_campus_coordinator'
    ],
    private: true,
  },

  {
    id: 'department_gaming',
    name: 'Dirección de Zona Franca Gaming',
    description: 'Departamento encargado de la administración de Gaming.',
    kind: 'department',
    status: 'enabled',
    dependencies: [
      {
        id: 'community_gaming',
        kind: 'module',
        required: true
      }
    ],
    communityId: 'community_gaming',
    allowedJobIds: [
      'job_gaming_commissioner',
      'job_gaming_organizer'
    ],
    private: true,
  },

  {
    id: 'department_basketball',
    name: 'Federación del Basket',
    description: 'Departamento encargado de la comunidad de basketball.',
    kind: 'department',
    status: 'enabled',
    dependencies: [
      {
        id: 'community_basketball',
        kind: 'module',
        required: true
      }
    ],
    communityId: 'community_basketball',
    allowedJobIds: [
      'job_basket_commissioner',
      'job_basket_referee'
    ],
    private: true,
  },

  {
    id: 'department_events',
    name: 'Comité de Eventos',
    description: 'Departamento encargado de organizar actividades oficiales.',
    kind: 'department',
    status: 'enabled',
    dependencies: [
      {
        id: 'community_events',
        kind: 'module',
        required: true
      }
    ],
    communityId: 'community_events',
    allowedJobIds: [
      'job_events_director',
      'job_events_organizer'
    ],
    private: true,
  },
] satisfies DepartmentSeed[];
