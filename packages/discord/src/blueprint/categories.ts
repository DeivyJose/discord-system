import type { DiscordCategoryBlueprint } from './types.js';

export const DISCORD_CATEGORIES: DiscordCategoryBlueprint[] = [
  {
    id: 'category_entry',
    kind: 'category',
    name: '🛬・LAS AMÉRICAS',
    description: 'Entrada, onboarding y documentación inicial.',
    position: 10,
    access: {
      preset: 'public',
    },
  },

  {
    id: 'category_malecon',
    kind: 'category',
    name: '🌊・EL MALECÓN',
    description: 'Zona social general del servidor.',
    moduleId: 'community_general',
    position: 20,
    access: {
      preset: 'member',
    },
  },

  {
    id: 'category_cdn_public',
    kind: 'category',
    name: '📰・CDN - NOTICIAS',
    description: 'Noticias públicas de The Clock.',
    position: 30,
    access: {
      preset: 'member',
    },
  },

  {
    id: 'category_campus',
    kind: 'category',
    name: '🎓・CAMPUS RD',
    description: 'Comunidad académica.',
    moduleId: 'community_campus',
    position: 40,
    access: {
      preset: 'community',
      allowRoleIds: [
        'role_campus_member'
      ],
    },
  },

  {
    id: 'category_gaming',
    kind: 'category',
    name: '🎮・ZONA FRANCA GAMING',
    description: 'Comunidad Gaming.',
    moduleId: 'community_gaming',
    position: 50,
    access: {
      preset: 'community',
      allowRoleIds: [
        'role_gaming_member'
      ],
    },
  },

  {
    id: 'category_basket',
    kind: 'category',
    name: '🏀・PALACIO DEL BASKET',
    description: 'Comunidad de basketball.',
    moduleId: 'community_basketball',
    position: 60,
    access: {
      preset: 'community',
      allowRoleIds: [
        'role_basket_member'
      ],
    },
  },

  {
    id: 'category_events',
    kind: 'category',
    name: '🏟️・CENTRO OLÍMPICO',
    description: 'Eventos oficiales de The Clock.',
    moduleId: 'community_events',
    position: 70,
    access: {
      preset: 'member',
    },
  },

  {
    id: 'category_residential',
    kind: 'category',
    name: '🏠・RESIDENCIAL 809',
    description: 'Salas privadas temporales y propiedades.',
    position: 80,
    access: {
      preset: 'member',
    },
  },

  {
    id: 'category_economy',
    kind: 'category',
    name: '💰・ECONOMÍA 809',
    description: 'Maricoins, Colmado Los Mellos y servicios económicos.',
    position: 90,
    access: {
      preset: 'member',
    },
  },

  {
    id: 'category_support',
    kind: 'category',
    name: '🧾・VENTANILLA 809',
    description: 'Servicio al cliente y solicitudes.',
    position: 100,
    access: {
      preset: 'member',
    },
  },

  {
    id: 'category_sector_27',
    kind: 'category',
    name: '🌃・SECTOR 27',
    description: 'Zona privada de acceso administrado.',
    moduleId: 'community_private',
    position: 110,
    access: {
      preset: 'private',
      allowRoleIds: [
        'role_sector_27'
      ],
    },
  },

  {
    id: 'category_police',
    kind: 'category',
    name: '🚔・DEPARTAMENTO DE POLICÍA',
    description: 'Departamento privado de seguridad y moderación.',
    departmentId: 'department_police',
    position: 200,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_police_coronel',
        'role_police_officer'
      ],
    },
  },

  {
    id: 'category_prison',
    kind: 'category',
    name: '🔒・SISTEMA PENITENCIARIO',
    description: 'Áreas temporales para miembros sancionados.',
    position: 210,
    access: {
      preset: 'prisoner',
      allowRoleIds: [
        'role_prisoner',
        'role_police_coronel',
        'role_police_officer'
      ],
    },
  },

  {
    id: 'category_cdn_staff',
    kind: 'category',
    name: '🗞️・CDN - REDACCIÓN',
    description: 'Departamento privado de noticias.',
    departmentId: 'department_cdn',
    position: 220,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_cdn_director',
        'role_cdn_editor',
        'role_cdn_reporter'
      ],
    },
  },

  {
    id: 'category_support_staff',
    kind: 'category',
    name: '☎️・CENTRO DE ATENCIÓN',
    description: 'Departamento privado de servicio al cliente.',
    departmentId: 'department_customer_service',
    position: 230,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_support_director',
        'role_support_supervisor',
        'role_support_representative'
      ],
    },
  },

  {
    id: 'category_palace',
    kind: 'category',
    name: '🏛️・PALACIO 809',
    description: 'Administración superior de The Clock.',
    departmentId: 'department_administration',
    position: 300,
    access: {
      preset: 'owner',
      allowRoleIds: [
        'role_owner',
        'role_administrator'
      ],
    },
  },

  {
    id: 'category_system',
    kind: 'category',
    name: '⚙️・INFRAESTRUCTURA',
    description: 'Estado técnico, logs y operación de Compai.',
    position: 310,
    access: {
      preset: 'owner',
      allowRoleIds: [
        'role_owner',
        'role_administrator'
      ],
    },
  },
];
