import type { PermissionDefinition } from '../entities/permission.js';

export const PERMISSIONS = [
  // =========================================================
  // SISTEMA / PROPIETARIO
  // =========================================================

  {
    id: 'system.inventory.view',
    description: 'Ver el inventario maestro de The Clock.',
    dangerous: false,
  },
  {
    id: 'system.module.enable',
    description: 'Habilitar módulos del ecosistema.',
    dangerous: true,
  },
  {
    id: 'system.module.disable',
    description: 'Deshabilitar módulos del ecosistema.',
    dangerous: true,
  },
  {
    id: 'system.entity.rename',
    description: 'Renombrar entidades administrables de The Clock.',
    dangerous: true,
  },

  // =========================================================
  // EMPLEOS
  // =========================================================

  {
    id: 'employment.applications.review',
    description: 'Revisar solicitudes de empleo.',
    dangerous: false,
  },
  {
    id: 'employment.hire',
    description: 'Contratar miembros.',
    dangerous: true,
  },
  {
    id: 'employment.fire',
    description: 'Finalizar contratos laborales.',
    dangerous: true,
  },

  // =========================================================
  // CDN - NOTICIAS
  // =========================================================

  {
    id: 'news.create',
    description: 'Crear borradores de noticias.',
    dangerous: false,
  },
  {
    id: 'news.edit',
    description: 'Editar noticias.',
    dangerous: false,
  },
  {
    id: 'news.review',
    description: 'Revisar noticias antes de publicarlas.',
    dangerous: false,
  },
  {
    id: 'news.publish',
    description: 'Publicar noticias.',
    dangerous: true,
  },
  {
    id: 'news.schedule',
    description: 'Programar publicaciones futuras o recurrentes.',
    dangerous: true,
  },

  // =========================================================
  // POLICÍA
  // =========================================================

  {
    id: 'police.reports.view',
    description: 'Consultar reportes enviados por miembros.',
    dangerous: false,
  },
  {
    id: 'police.cases.manage',
    description: 'Crear y actualizar casos disciplinarios.',
    dangerous: true,
  },
  {
    id: 'police.detain',
    description: 'Enviar temporalmente un miembro a prisión.',
    dangerous: true,
  },
  {
    id: 'police.release',
    description: 'Liberar un miembro cuando esté autorizado.',
    dangerous: true,
  },
  {
    id: 'police.sentences.override',
    description: 'Modificar una sentencia recomendada por Compai.',
    dangerous: true,
  },

  // =========================================================
  // SERVICIO AL CLIENTE
  // =========================================================

  {
    id: 'support.tickets.handle',
    description: 'Atender tickets de miembros.',
    dangerous: false,
  },
  {
    id: 'support.tickets.escalate',
    description: 'Escalar un ticket a un nivel superior.',
    dangerous: false,
  },
  {
    id: 'support.department.manage',
    description: 'Administrar el departamento de atención.',
    dangerous: true,
  },

  // =========================================================
  // CAMPUS
  // =========================================================

  {
    id: 'campus.manage',
    description: 'Administrar Campus RD dentro de los límites autorizados.',
    dangerous: true,
  },

  // =========================================================
  // GAMING
  // =========================================================

  {
    id: 'gaming.manage',
    description: 'Administrar la comunidad Gaming.',
    dangerous: true,
  },

  // =========================================================
  // BASKETBALL
  // =========================================================

  {
    id: 'basket.manage',
    description: 'Administrar la comunidad de Basketball.',
    dangerous: true,
  },

  // =========================================================
  // EVENTOS
  // =========================================================

  {
    id: 'events.create',
    description: 'Crear eventos autorizados.',
    dangerous: false,
  },
  {
    id: 'events.manage',
    description: 'Administrar eventos y sus participantes.',
    dangerous: true,
  },
] satisfies PermissionDefinition[];
