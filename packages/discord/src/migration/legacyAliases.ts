export const LEGACY_ALIASES: Readonly<
  Record<string, readonly string[]>
> = {
  // Categorías actuales conocidas
  category_entry: [
    'inicio',
  ],

  category_malecon: [
    'comunidad',
  ],

  category_system: [
    'sistema',
  ],

  category_palace: [
    'staff',
  ],

  // Canales actuales conocidos
  channel_welcome: [
    'bienvenida',
  ],

  channel_rules: [
    'reglas',
  ],

  channel_official_announcements: [
    'anuncios',
  ],

  channel_general: [
    'general',
  ],

  channel_palace: [
    'staff',
  ],

  channel_system_logs: [
    'logs',
  ],

  // Puede ser ambiguo porque existen
  // varios canales de voz llamados General.
  voice_malecon: [
    'general',
  ],

  // Roles actuales conocidos
  role_administrator: [
    'administrador',
  ],

  role_compai: [
    'systembot',
  ],

  role_member: [
    'miembro',
  ],
};
