import type { DiscordRoleBlueprint } from './types.js';

export const DISCORD_ROLES: DiscordRoleBlueprint[] = [
  // =========================================================
  // SISTEMA / ADMINISTRACIÓN
  // =========================================================

  {
    id: 'role_owner',
    kind: 'role',
    name: 'Dueño',
    description: 'Rol superior del propietario de The Clock.',
    priority: 1000,
    hoist: true,
    mentionable: false,
    systemManaged: true,
  },

  {
    id: 'role_administrator',
    kind: 'role',
    name: 'Administrador',
    description: 'Administradores generales autorizados.',
    priority: 900,
    hoist: true,
    mentionable: false,
    systemManaged: true,
  },

  {
    id: 'role_compai',
    kind: 'role',
    name: 'Compai',
    description: 'Rol oficial del bot Compai.',
    priority: 850,
    hoist: true,
    mentionable: false,
    systemManaged: true,
  },

  // =========================================================
  // POLICÍA
  // =========================================================

  {
    id: 'role_police_coronel',
    kind: 'role',
    name: 'Coronel',
    description: 'Supervisor superior del Departamento de Policía.',
    priority: 700,
    hoist: true,
    mentionable: true,
    jobId: 'job_police_coronel',
    departmentId: 'department_police',
    systemManaged: true,
  },

  {
    id: 'role_police_officer',
    kind: 'role',
    name: 'Policía',
    description: 'Miembro activo del Departamento de Policía.',
    priority: 690,
    hoist: true,
    mentionable: true,
    jobId: 'job_police_officer',
    departmentId: 'department_police',
    systemManaged: true,
  },

  // =========================================================
  // CDN
  // =========================================================

  {
    id: 'role_cdn_director',
    kind: 'role',
    name: 'Director CDN',
    description: 'Director del Departamento CDN.',
    priority: 650,
    hoist: true,
    mentionable: true,
    jobId: 'job_cdn_director',
    departmentId: 'department_cdn',
    systemManaged: true,
  },

  {
    id: 'role_cdn_editor',
    kind: 'role',
    name: 'Editor CDN',
    description: 'Editor del Departamento CDN.',
    priority: 640,
    hoist: true,
    mentionable: true,
    jobId: 'job_cdn_editor',
    departmentId: 'department_cdn',
    systemManaged: true,
  },

  {
    id: 'role_cdn_reporter',
    kind: 'role',
    name: 'Reportero CDN',
    description: 'Reportero del Departamento CDN.',
    priority: 630,
    hoist: true,
    mentionable: true,
    jobId: 'job_cdn_reporter',
    departmentId: 'department_cdn',
    systemManaged: true,
  },

  // =========================================================
  // ATENCIÓN
  // =========================================================

  {
    id: 'role_support_director',
    kind: 'role',
    name: 'Director de Atención',
    description: 'Director de Ventanilla 809.',
    priority: 620,
    hoist: true,
    mentionable: true,
    jobId: 'job_support_director',
    departmentId: 'department_customer_service',
    systemManaged: true,
  },

  {
    id: 'role_support_supervisor',
    kind: 'role',
    name: 'Supervisor de Atención',
    description: 'Supervisor de servicio al cliente.',
    priority: 610,
    hoist: true,
    mentionable: true,
    jobId: 'job_support_supervisor',
    departmentId: 'department_customer_service',
    systemManaged: true,
  },

  {
    id: 'role_support_representative',
    kind: 'role',
    name: 'Representante de Servicio',
    description: 'Representante de servicio al cliente.',
    priority: 600,
    hoist: true,
    mentionable: true,
    jobId: 'job_support_representative',
    departmentId: 'department_customer_service',
    systemManaged: true,
  },

  // =========================================================
  // RESPONSABLES DE COMUNIDAD
  // =========================================================

  {
    id: 'role_campus_director',
    kind: 'role',
    name: 'Director de Campus RD',
    description: 'Responsable superior de Campus RD.',
    priority: 580,
    hoist: true,
    mentionable: true,
    jobId: 'job_campus_director',
    moduleId: 'community_campus',
    departmentId: 'department_campus',
    systemManaged: true,
  },

  {
    id: 'role_gaming_commissioner',
    kind: 'role',
    name: 'Comisionado Gaming',
    description: 'Responsable superior de Gaming.',
    priority: 570,
    hoist: true,
    mentionable: true,
    jobId: 'job_gaming_commissioner',
    moduleId: 'community_gaming',
    departmentId: 'department_gaming',
    systemManaged: true,
  },

  {
    id: 'role_basket_commissioner',
    kind: 'role',
    name: 'Comisionado del Basket',
    description: 'Responsable superior de Basketball.',
    priority: 560,
    hoist: true,
    mentionable: true,
    jobId: 'job_basket_commissioner',
    moduleId: 'community_basketball',
    departmentId: 'department_basketball',
    systemManaged: true,
  },

  {
    id: 'role_events_director',
    kind: 'role',
    name: 'Director de Eventos',
    description: 'Responsable superior de eventos.',
    priority: 550,
    hoist: true,
    mentionable: true,
    jobId: 'job_events_director',
    moduleId: 'community_events',
    departmentId: 'department_events',
    systemManaged: true,
  },

  // =========================================================
  // COMUNIDADES
  // =========================================================

  {
    id: 'role_member',
    kind: 'role',
    name: 'Miembro',
    description: 'Miembro verificado de The Clock.',
    priority: 300,
    hoist: false,
    mentionable: false,
    systemManaged: true,
  },

  {
    id: 'role_campus_member',
    kind: 'role',
    name: 'Campus RD',
    description: 'Acceso a la comunidad académica.',
    priority: 250,
    hoist: false,
    mentionable: true,
    moduleId: 'community_campus',
    systemManaged: true,
  },

  {
    id: 'role_gaming_member',
    kind: 'role',
    name: 'Gaming',
    description: 'Acceso a la comunidad Gaming.',
    priority: 240,
    hoist: false,
    mentionable: true,
    moduleId: 'community_gaming',
    systemManaged: true,
  },

  {
    id: 'role_basket_member',
    kind: 'role',
    name: 'Basketball',
    description: 'Acceso a la comunidad de Basketball.',
    priority: 230,
    hoist: false,
    mentionable: true,
    moduleId: 'community_basketball',
    systemManaged: true,
  },

  {
    id: 'role_events_member',
    kind: 'role',
    name: 'Eventos',
    description: 'Interés en eventos generales.',
    priority: 220,
    hoist: false,
    mentionable: true,
    moduleId: 'community_events',
    systemManaged: true,
  },

  // =========================================================
  // ESTADOS / ACCESOS
  // =========================================================

  {
    id: 'role_prisoner',
    kind: 'role',
    name: 'Preso',
    description: 'Rol temporal aplicado durante una sentencia.',
    priority: 200,
    hoist: true,
    mentionable: false,
    systemManaged: true,
  },

  {
    id: 'role_sector_27',
    kind: 'role',
    name: 'Sector 27',
    description: 'Acceso privado a Sector 27.',
    priority: 190,
    hoist: false,
    mentionable: false,
    moduleId: 'community_private',
    systemManaged: true,
  },

  // =========================================================
  // NOTIFICACIONES
  // =========================================================

  {
    id: 'role_notify_news',
    kind: 'role',
    name: 'Avisos CDN',
    description: 'Notificaciones generales de noticias.',
    priority: 100,
    hoist: false,
    mentionable: true,
    systemManaged: true,
  },

  {
    id: 'role_notify_events',
    kind: 'role',
    name: 'Avisos de Eventos',
    description: 'Notificaciones de eventos.',
    priority: 90,
    hoist: false,
    mentionable: true,
    systemManaged: true,
  },

  {
    id: 'role_notify_campus',
    kind: 'role',
    name: 'Avisos Campus',
    description: 'Notificaciones relacionadas con Campus RD.',
    priority: 80,
    hoist: false,
    mentionable: true,
    systemManaged: true,
  },

  {
    id: 'role_notify_gaming',
    kind: 'role',
    name: 'Avisos Gaming',
    description: 'Notificaciones relacionadas con Gaming.',
    priority: 70,
    hoist: false,
    mentionable: true,
    systemManaged: true,
  },

  {
    id: 'role_notify_basket',
    kind: 'role',
    name: 'Avisos Basket',
    description: 'Notificaciones relacionadas con Basketball.',
    priority: 60,
    hoist: false,
    mentionable: true,
    systemManaged: true,
  },
];
