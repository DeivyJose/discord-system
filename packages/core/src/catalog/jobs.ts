import type { JobDefinition } from '../entities/job.js';

export const JOBS = [
  // =========================================================
  // POLICÍA
  // =========================================================

  {
    id: 'job_police_coronel',
    name: 'Coronel',
    description: 'Supervisor superior del Departamento de Policía.',
    status: 'enabled',
    departmentId: 'department_police',
    baseSalary: 600,
    salaryIntervalDays: 7,
    inactivityLimitDays: 30,
    permissions: [
      'police.reports.view',
      'police.cases.manage',
      'police.detain',
      'police.release',
      'police.sentences.override',
      'employment.applications.review'
    ],
  },

  {
    id: 'job_police_officer',
    name: 'Policía',
    description: 'Agente encargado de atender reportes y aplicar medidas autorizadas.',
    status: 'enabled',
    departmentId: 'department_police',
    baseSalary: 350,
    salaryIntervalDays: 7,
    inactivityLimitDays: 21,
    permissions: [
      'police.reports.view',
      'police.cases.manage',
      'police.detain'
    ],
  },

  // =========================================================
  // CDN
  // =========================================================

  {
    id: 'job_cdn_director',
    name: 'Director CDN',
    description: 'Responsable superior del departamento de noticias.',
    status: 'enabled',
    departmentId: 'department_cdn',
    baseSalary: 600,
    salaryIntervalDays: 7,
    inactivityLimitDays: 30,
    permissions: [
      'news.create',
      'news.edit',
      'news.review',
      'news.publish',
      'news.schedule',
      'employment.applications.review'
    ],
  },

  {
    id: 'job_cdn_editor',
    name: 'Editor CDN',
    description: 'Revisa y corrige contenido antes de su publicación.',
    status: 'enabled',
    departmentId: 'department_cdn',
    baseSalary: 400,
    salaryIntervalDays: 7,
    inactivityLimitDays: 21,
    permissions: [
      'news.create',
      'news.edit',
      'news.review'
    ],
  },

  {
    id: 'job_cdn_reporter',
    name: 'Reportero CDN',
    description: 'Redacta noticias y coberturas para CDN.',
    status: 'enabled',
    departmentId: 'department_cdn',
    baseSalary: 250,
    salaryIntervalDays: 7,
    inactivityLimitDays: 14,
    permissions: [
      'news.create',
      'news.edit'
    ],
  },

  // =========================================================
  // SERVICIO AL CLIENTE
  // =========================================================

  {
    id: 'job_support_director',
    name: 'Director de Atención',
    description: 'Responsable superior del servicio al cliente.',
    status: 'enabled',
    departmentId: 'department_customer_service',
    baseSalary: 500,
    salaryIntervalDays: 7,
    inactivityLimitDays: 30,
    permissions: [
      'support.tickets.handle',
      'support.tickets.escalate',
      'support.department.manage',
      'employment.applications.review'
    ],
  },

  {
    id: 'job_support_supervisor',
    name: 'Supervisor de Atención',
    description: 'Supervisa representantes y casos escalados.',
    status: 'enabled',
    departmentId: 'department_customer_service',
    baseSalary: 350,
    salaryIntervalDays: 7,
    inactivityLimitDays: 21,
    permissions: [
      'support.tickets.handle',
      'support.tickets.escalate'
    ],
  },

  {
    id: 'job_support_representative',
    name: 'Representante de Servicio',
    description: 'Atiende solicitudes y problemas de los miembros.',
    status: 'enabled',
    departmentId: 'department_customer_service',
    baseSalary: 225,
    salaryIntervalDays: 7,
    inactivityLimitDays: 14,
    permissions: [
      'support.tickets.handle'
    ],
  },

  // =========================================================
  // CAMPUS RD
  // =========================================================

  {
    id: 'job_campus_director',
    name: 'Director de Campus RD',
    description: 'Responsable superior de la comunidad académica.',
    status: 'enabled',
    departmentId: 'department_campus',
    baseSalary: 500,
    salaryIntervalDays: 7,
    inactivityLimitDays: 30,
    permissions: [
      'campus.manage',
      'employment.applications.review'
    ],
  },

  {
    id: 'job_campus_coordinator',
    name: 'Coordinador de Campus',
    description: 'Apoya la administración diaria de Campus RD.',
    status: 'enabled',
    departmentId: 'department_campus',
    baseSalary: 325,
    salaryIntervalDays: 7,
    inactivityLimitDays: 21,
    permissions: [
      'campus.manage'
    ],
  },

  // =========================================================
  // GAMING
  // =========================================================

  {
    id: 'job_gaming_commissioner',
    name: 'Comisionado Gaming',
    description: 'Responsable superior de Zona Franca Gaming.',
    status: 'enabled',
    departmentId: 'department_gaming',
    baseSalary: 500,
    salaryIntervalDays: 7,
    inactivityLimitDays: 30,
    permissions: [
      'gaming.manage',
      'events.create',
      'employment.applications.review'
    ],
  },

  {
    id: 'job_gaming_organizer',
    name: 'Organizador Gaming',
    description: 'Organiza actividades autorizadas de Gaming.',
    status: 'enabled',
    departmentId: 'department_gaming',
    baseSalary: 300,
    salaryIntervalDays: 7,
    inactivityLimitDays: 21,
    permissions: [
      'events.create'
    ],
  },

  // =========================================================
  // BASKETBALL
  // =========================================================

  {
    id: 'job_basket_commissioner',
    name: 'Comisionado del Basket',
    description: 'Responsable superior del Palacio del Basket.',
    status: 'enabled',
    departmentId: 'department_basketball',
    baseSalary: 500,
    salaryIntervalDays: 7,
    inactivityLimitDays: 30,
    permissions: [
      'basket.manage',
      'events.create',
      'employment.applications.review'
    ],
  },

  {
    id: 'job_basket_referee',
    name: 'Árbitro',
    description: 'Apoya actividades y eventos de basketball.',
    status: 'enabled',
    departmentId: 'department_basketball',
    baseSalary: 250,
    salaryIntervalDays: 7,
    inactivityLimitDays: 21,
    permissions: [
      'events.create'
    ],
  },

  // =========================================================
  // EVENTOS
  // =========================================================

  {
    id: 'job_events_director',
    name: 'Director de Eventos',
    description: 'Responsable superior del Centro Olímpico.',
    status: 'enabled',
    departmentId: 'department_events',
    baseSalary: 500,
    salaryIntervalDays: 7,
    inactivityLimitDays: 30,
    permissions: [
      'events.create',
      'events.manage',
      'employment.applications.review'
    ],
  },

  {
    id: 'job_events_organizer',
    name: 'Organizador de Eventos',
    description: 'Organiza actividades oficiales de The Clock.',
    status: 'enabled',
    departmentId: 'department_events',
    baseSalary: 300,
    salaryIntervalDays: 7,
    inactivityLimitDays: 21,
    permissions: [
      'events.create',
      'events.manage'
    ],
  },
] satisfies JobDefinition[];
