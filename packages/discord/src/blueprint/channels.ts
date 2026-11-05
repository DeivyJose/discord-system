import type { DiscordChannelBlueprint } from './types.js';

export const DISCORD_CHANNELS: DiscordChannelBlueprint[] = [
  // =========================================================
  // LAS AMÉRICAS
  // =========================================================

  {
    id: 'channel_welcome',
    kind: 'text_channel',
    name: 'bienvenida',
    description: 'Primer contacto con The Clock.',
    parentId: 'category_entry',
    position: 10,
    access: { preset: 'public' },
  },

  {
    id: 'channel_rules',
    kind: 'text_channel',
    name: 'reglamento',
    description: 'Reglamento oficial del servidor.',
    parentId: 'category_entry',
    position: 20,
    access: { preset: 'public' },
  },

  {
    id: 'channel_guide',
    kind: 'text_channel',
    name: 'guia-del-reloj',
    description: 'Guía dinámica del ecosistema.',
    parentId: 'category_entry',
    position: 30,
    access: { preset: 'public' },
    automated: true,
  },

  {
    id: 'channel_official_announcements',
    kind: 'announcement_channel',
    name: 'anuncios-oficiales',
    description: 'Comunicaciones generales de The Clock.',
    parentId: 'category_entry',
    position: 40,
    access: { preset: 'public' },
  },

  // =========================================================
  // MALECÓN
  // =========================================================

  {
    id: 'channel_general',
    kind: 'text_channel',
    name: 'el-malecon',
    description: 'Conversación general.',
    parentId: 'category_malecon',
    moduleId: 'community_general',
    position: 10,
    access: { preset: 'member' },
  },

  {
    id: 'channel_chercha',
    kind: 'text_channel',
    name: 'la-chercha',
    description: 'Conversaciones informales y contenido casual.',
    parentId: 'category_malecon',
    moduleId: 'community_general',
    position: 20,
    access: { preset: 'member' },
  },

  {
    id: 'channel_suggestions',
    kind: 'forum_channel',
    name: 'sugerencias',
    description: 'Ideas y propuestas de los miembros.',
    parentId: 'category_malecon',
    moduleId: 'community_general',
    position: 30,
    access: { preset: 'member' },
  },

  {
    id: 'voice_malecon',
    kind: 'voice_channel',
    name: 'Malecón',
    description: 'Canal de voz general.',
    parentId: 'category_malecon',
    moduleId: 'community_general',
    position: 40,
    access: { preset: 'member' },
    userLimit: 0,
  },

  // =========================================================
  // CDN PÚBLICO
  // =========================================================

  {
    id: 'channel_cdn_latest',
    kind: 'announcement_channel',
    name: 'ultima-hora',
    description: 'Noticias generales importantes.',
    parentId: 'category_cdn_public',
    position: 10,
    access: { preset: 'member' },
  },

  {
    id: 'channel_cdn_events',
    kind: 'announcement_channel',
    name: 'eventos',
    description: 'Noticias y anuncios de eventos.',
    parentId: 'category_cdn_public',
    position: 20,
    access: { preset: 'member' },
  },

  {
    id: 'channel_cdn_sports',
    kind: 'announcement_channel',
    name: 'deportes',
    description: 'Noticias y resultados deportivos.',
    parentId: 'category_cdn_public',
    position: 30,
    access: { preset: 'member' },
  },

  {
    id: 'channel_cdn_gaming',
    kind: 'announcement_channel',
    name: 'gaming',
    description: 'Noticias relacionadas con Gaming.',
    parentId: 'category_cdn_public',
    position: 40,
    access: { preset: 'member' },
  },

  {
    id: 'channel_cdn_campus',
    kind: 'announcement_channel',
    name: 'campus',
    description: 'Noticias académicas.',
    parentId: 'category_cdn_public',
    position: 50,
    access: { preset: 'member' },
  },

  {
    id: 'channel_cdn_incidents',
    kind: 'announcement_channel',
    name: 'sucesos',
    description: 'Boletines disciplinarios autorizados.',
    parentId: 'category_cdn_public',
    position: 60,
    access: { preset: 'member' },
    automated: true,
  },

  {
    id: 'channel_cdn_classifieds',
    kind: 'announcement_channel',
    name: 'clasificados',
    description: 'Promociones aprobadas mediante Maricoins.',
    parentId: 'category_cdn_public',
    position: 70,
    access: { preset: 'member' },
    automated: true,
  },

  // =========================================================
  // CAMPUS
  // =========================================================

  {
    id: 'channel_campus_general',
    kind: 'text_channel',
    name: 'campus-general',
    description: 'Conversación general de Campus RD.',
    parentId: 'category_campus',
    moduleId: 'community_campus',
    position: 10,
    access: {
      preset: 'community',
      allowRoleIds: ['role_campus_member'],
    },
  },

  {
    id: 'channel_campus_directory',
    kind: 'text_channel',
    name: 'directorio-campus',
    description: 'Directorio de instituciones disponibles.',
    parentId: 'category_campus',
    moduleId: 'community_campus',
    position: 20,
    access: {
      preset: 'community',
      allowRoleIds: ['role_campus_member'],
    },
    automated: true,
  },

  {
    id: 'channel_campus_opportunities',
    kind: 'forum_channel',
    name: 'becas-y-oportunidades',
    description: 'Becas, oportunidades y recursos académicos.',
    parentId: 'category_campus',
    moduleId: 'community_campus',
    position: 30,
    access: {
      preset: 'community',
      allowRoleIds: ['role_campus_member'],
    },
  },

  // =========================================================
  // GAMING
  // =========================================================

  {
    id: 'channel_gaming_general',
    kind: 'text_channel',
    name: 'gaming-general',
    description: 'Conversación general de Gaming.',
    parentId: 'category_gaming',
    moduleId: 'community_gaming',
    position: 10,
    access: {
      preset: 'community',
      allowRoleIds: ['role_gaming_member'],
    },
  },

  {
    id: 'channel_gaming_lfg',
    kind: 'forum_channel',
    name: 'busco-equipo',
    description: 'Buscar jugadores y grupos.',
    parentId: 'category_gaming',
    moduleId: 'community_gaming',
    position: 20,
    access: {
      preset: 'community',
      allowRoleIds: ['role_gaming_member'],
    },
  },

  {
    id: 'channel_gaming_clans',
    kind: 'forum_channel',
    name: 'clanes',
    description: 'Clanes administrados por Compai.',
    parentId: 'category_gaming',
    moduleId: 'community_gaming',
    position: 30,
    access: {
      preset: 'community',
      allowRoleIds: ['role_gaming_member'],
    },
    automated: true,
  },

  {
    id: 'voice_gaming',
    kind: 'voice_channel',
    name: 'Lobby Gaming',
    description: 'Voz general de Gaming.',
    parentId: 'category_gaming',
    moduleId: 'community_gaming',
    position: 40,
    access: {
      preset: 'community',
      allowRoleIds: ['role_gaming_member'],
    },
    userLimit: 0,
  },

  // =========================================================
  // BASKET
  // =========================================================

  {
    id: 'channel_basket_general',
    kind: 'text_channel',
    name: 'basket-general',
    description: 'Conversación general de Basketball.',
    parentId: 'category_basket',
    moduleId: 'community_basketball',
    position: 10,
    access: {
      preset: 'community',
      allowRoleIds: ['role_basket_member'],
    },
  },

  {
    id: 'channel_nba',
    kind: 'text_channel',
    name: 'nba',
    description: 'NBA, equipos, partidos y discusión.',
    parentId: 'category_basket',
    moduleId: 'community_basketball',
    position: 20,
    access: {
      preset: 'community',
      allowRoleIds: ['role_basket_member'],
    },
  },

  {
    id: 'channel_basket_rd',
    kind: 'text_channel',
    name: 'basket-rd',
    description: 'Basketball dominicano.',
    parentId: 'category_basket',
    moduleId: 'community_basketball',
    position: 30,
    access: {
      preset: 'community',
      allowRoleIds: ['role_basket_member'],
    },
  },

  {
    id: 'channel_basket_scores',
    kind: 'text_channel',
    name: 'resultados',
    description: 'Resultados y clasificaciones deportivas.',
    parentId: 'category_basket',
    moduleId: 'community_basketball',
    position: 40,
    access: {
      preset: 'community',
      allowRoleIds: ['role_basket_member'],
    },
    automated: true,
  },

  {
    id: 'voice_basket',
    kind: 'voice_channel',
    name: 'La Cancha',
    description: 'Voz de la comunidad Basketball.',
    parentId: 'category_basket',
    moduleId: 'community_basketball',
    position: 50,
    access: {
      preset: 'community',
      allowRoleIds: ['role_basket_member'],
    },
    userLimit: 0,
  },

  // =========================================================
  // EVENTOS
  // =========================================================

  {
    id: 'channel_event_agenda',
    kind: 'announcement_channel',
    name: 'agenda',
    description: 'Calendario público de eventos.',
    parentId: 'category_events',
    moduleId: 'community_events',
    position: 10,
    access: { preset: 'member' },
    automated: true,
  },

  {
    id: 'channel_event_registration',
    kind: 'text_channel',
    name: 'inscripciones',
    description: 'Inscripciones y participación en eventos.',
    parentId: 'category_events',
    moduleId: 'community_events',
    position: 20,
    access: { preset: 'member' },
    automated: true,
  },

  {
    id: 'channel_event_results',
    kind: 'announcement_channel',
    name: 'resultados',
    description: 'Resultados oficiales.',
    parentId: 'category_events',
    moduleId: 'community_events',
    position: 30,
    access: { preset: 'member' },
    automated: true,
  },

  // =========================================================
  // RESIDENCIAL 809
  // =========================================================

  {
    id: 'channel_residential_control',
    kind: 'text_channel',
    name: 'administrar-residencia',
    description: 'Panel e instrucciones de salas privadas.',
    parentId: 'category_residential',
    position: 10,
    access: { preset: 'member' },
    automated: true,
  },

  {
    id: 'voice_create_apartment',
    kind: 'voice_channel',
    name: '➕ Crear apartamento',
    description: 'Entrar aquí crea una VC privada temporal.',
    parentId: 'category_residential',
    position: 20,
    access: { preset: 'member' },
    automated: true,
    userLimit: 1,
  },

  // =========================================================
  // ECONOMÍA
  // =========================================================

  {
    id: 'channel_colmado',
    kind: 'text_channel',
    name: 'colmado-los-mellos',
    description: 'Tienda oficial de The Clock.',
    parentId: 'category_economy',
    position: 10,
    access: { preset: 'member' },
    automated: true,
  },

  {
    id: 'channel_bank',
    kind: 'text_channel',
    name: 'banreservas',
    description: 'Consultas económicas y transferencias.',
    parentId: 'category_economy',
    position: 20,
    access: { preset: 'member' },
    automated: true,
  },

  {
    id: 'channel_maricoin_ranking',
    kind: 'text_channel',
    name: 'top-maricoins',
    description: 'Top 15 de miembros con más Maricoins.',
    parentId: 'category_economy',
    position: 30,
    access: { preset: 'member' },
    automated: true,
  },

  // =========================================================
  // SOPORTE PÚBLICO
  // =========================================================

  {
    id: 'channel_support',
    kind: 'text_channel',
    name: 'solicitar-ayuda',
    description: 'Abrir solicitudes de servicio al cliente.',
    parentId: 'category_support',
    position: 10,
    access: { preset: 'member' },
    automated: true,
  },

  {
    id: 'channel_jobs',
    kind: 'forum_channel',
    name: 'bolsa-de-trabajo',
    description: 'Vacantes y solicitudes laborales.',
    parentId: 'category_support',
    position: 20,
    access: { preset: 'member' },
    automated: true,
  },

  // =========================================================
  // SECTOR 27
  // =========================================================

  {
    id: 'channel_sector_27',
    kind: 'text_channel',
    name: 'sector-27',
    description: 'Sala privada de Sector 27.',
    parentId: 'category_sector_27',
    moduleId: 'community_private',
    position: 10,
    access: {
      preset: 'private',
      allowRoleIds: ['role_sector_27'],
    },
  },

  {
    id: 'voice_sector_27',
    kind: 'voice_channel',
    name: 'Sector 27',
    description: 'Voz privada.',
    parentId: 'category_sector_27',
    moduleId: 'community_private',
    position: 20,
    access: {
      preset: 'private',
      allowRoleIds: ['role_sector_27'],
    },
    userLimit: 0,
  },

  // =========================================================
  // POLICÍA
  // =========================================================

  {
    id: 'channel_police_hq',
    kind: 'text_channel',
    name: 'central',
    description: 'Centro de coordinación policial.',
    parentId: 'category_police',
    departmentId: 'department_police',
    position: 10,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_police_coronel',
        'role_police_officer'
      ],
    },
  },

  {
    id: 'channel_police_reports',
    kind: 'forum_channel',
    name: 'reportes',
    description: 'Reportes escalados para revisión.',
    parentId: 'category_police',
    departmentId: 'department_police',
    position: 20,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_police_coronel',
        'role_police_officer'
      ],
    },
    automated: true,
  },

  {
    id: 'channel_police_cases',
    kind: 'forum_channel',
    name: 'casos',
    description: 'Expedientes disciplinarios.',
    parentId: 'category_police',
    departmentId: 'department_police',
    position: 30,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_police_coronel',
        'role_police_officer'
      ],
    },
    automated: true,
  },

  {
    id: 'channel_police_detentions',
    kind: 'text_channel',
    name: 'detenciones',
    description: 'Registro operativo de detenciones.',
    parentId: 'category_police',
    departmentId: 'department_police',
    position: 40,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_police_coronel',
        'role_police_officer'
      ],
    },
    automated: true,
  },

  // =========================================================
  // PRISIÓN
  // =========================================================

  {
    id: 'channel_prison_reception',
    kind: 'text_channel',
    name: 'recepcion-najayo',
    description: 'Información de sentencia y tiempo restante.',
    parentId: 'category_prison',
    position: 10,
    access: {
      preset: 'prisoner',
      allowRoleIds: ['role_prisoner'],
    },
    automated: true,
  },

  {
    id: 'channel_prison_economato',
    kind: 'text_channel',
    name: 'economato',
    description: 'Servicios temporales adquiribles con Maricoins.',
    parentId: 'category_prison',
    position: 20,
    access: {
      preset: 'prisoner',
      allowRoleIds: ['role_prisoner'],
    },
    automated: true,
  },

  {
    id: 'voice_prison_visits',
    kind: 'voice_channel',
    name: 'Visitas',
    description: 'VC temporal para visitas autorizadas.',
    parentId: 'category_prison',
    position: 30,
    access: {
      preset: 'prisoner',
      allowRoleIds: ['role_prisoner'],
    },
    automated: true,
    userLimit: 3,
  },

  // =========================================================
  // CDN INTERNO
  // =========================================================

  {
    id: 'channel_cdn_newsroom',
    kind: 'text_channel',
    name: 'redaccion',
    description: 'Coordinación interna de CDN.',
    parentId: 'category_cdn_staff',
    departmentId: 'department_cdn',
    position: 10,
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
    id: 'channel_cdn_drafts',
    kind: 'forum_channel',
    name: 'borradores',
    description: 'Flujo de borradores de noticias.',
    parentId: 'category_cdn_staff',
    departmentId: 'department_cdn',
    position: 20,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_cdn_director',
        'role_cdn_editor',
        'role_cdn_reporter'
      ],
    },
    automated: true,
  },

  {
    id: 'channel_cdn_review',
    kind: 'forum_channel',
    name: 'revision',
    description: 'Noticias esperando revisión o aprobación.',
    parentId: 'category_cdn_staff',
    departmentId: 'department_cdn',
    position: 30,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_cdn_director',
        'role_cdn_editor'
      ],
    },
    automated: true,
  },

  // =========================================================
  // SERVICIO INTERNO
  // =========================================================

  {
    id: 'channel_support_tickets',
    kind: 'forum_channel',
    name: 'tickets',
    description: 'Casos de servicio al cliente.',
    parentId: 'category_support_staff',
    departmentId: 'department_customer_service',
    position: 10,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_support_director',
        'role_support_supervisor',
        'role_support_representative'
      ],
    },
    automated: true,
  },

  {
    id: 'channel_support_escalations',
    kind: 'forum_channel',
    name: 'escalaciones',
    description: 'Casos escalados.',
    parentId: 'category_support_staff',
    departmentId: 'department_customer_service',
    position: 20,
    access: {
      preset: 'employment',
      allowRoleIds: [
        'role_support_director',
        'role_support_supervisor'
      ],
    },
    automated: true,
  },

  // =========================================================
  // PALACIO
  // =========================================================

  {
    id: 'channel_palace',
    kind: 'text_channel',
    name: 'administracion',
    description: 'Administración superior.',
    parentId: 'category_palace',
    departmentId: 'department_administration',
    position: 10,
    access: {
      preset: 'owner',
      allowRoleIds: [
        'role_owner',
        'role_administrator'
      ],
    },
  },

  {
    id: 'channel_inventory',
    kind: 'text_channel',
    name: 'inventario',
    description: 'Inventario maestro del ecosistema.',
    parentId: 'category_palace',
    departmentId: 'department_administration',
    position: 20,
    access: {
      preset: 'owner',
      allowRoleIds: [
        'role_owner'
      ],
    },
    automated: true,
  },

  {
    id: 'channel_audit',
    kind: 'text_channel',
    name: 'auditoria',
    description: 'Registro de acciones sensibles.',
    parentId: 'category_palace',
    departmentId: 'department_administration',
    position: 30,
    access: {
      preset: 'owner',
      allowRoleIds: [
        'role_owner',
        'role_administrator'
      ],
    },
    automated: true,
  },

  // =========================================================
  // INFRAESTRUCTURA
  // =========================================================

  {
    id: 'channel_compai_status',
    kind: 'text_channel',
    name: 'estado-compai',
    description: 'Estado operativo de Compai.',
    parentId: 'category_system',
    position: 10,
    access: {
      preset: 'owner',
      allowRoleIds: [
        'role_owner',
        'role_administrator'
      ],
    },
    automated: true,
  },

  {
    id: 'channel_system_logs',
    kind: 'text_channel',
    name: 'logs',
    description: 'Logs operativos relevantes.',
    parentId: 'category_system',
    position: 20,
    access: {
      preset: 'owner',
      allowRoleIds: [
        'role_owner',
        'role_administrator'
      ],
    },
    automated: true,
  },

  {
    id: 'channel_system_errors',
    kind: 'text_channel',
    name: 'errores',
    description: 'Errores del ecosistema.',
    parentId: 'category_system',
    position: 30,
    access: {
      preset: 'owner',
      allowRoleIds: [
        'role_owner',
        'role_administrator'
      ],
    },
    automated: true,
  },
];
