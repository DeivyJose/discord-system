// ============================================================================
// messageCreate.js — Escucha cada mensaje y ejecuta el comando que toque.
// Aquí viven las reglas globales: ignorar bots, prefijo, permisos de admin,
// aviso si Mongo está caído y el try/catch que protege al bot entero.
// ============================================================================

const { Events, PermissionsBitField } = require('discord.js');
const { dbLista } = require('../database');

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    // 1) Ignorar bots (incluido él mismo) y mensajes por DM
    if (message.author.bot) return;
    if (!message.guild) return;

    // 2) Ignorar mensajes que no empiezan con el prefijo
    const prefix = client.prefix;
    if (!message.content.startsWith(prefix)) return;

    // 3) Separar comando y argumentos: "!pay @user 50" -> "pay", ["@user", "50"]
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const nombreComando = args.shift().toLowerCase();

    // 4) Buscar el comando por nombre o por alias
    const comando =
      client.commands.get(nombreComando) ||
      client.commands.find((c) => c.aliases && c.aliases.includes(nombreComando));
    if (!comando) return;

    // 5) Comandos de admin: solo usuarios con permiso Administrator
    if (comando.adminOnly) {
      const esAdmin =
        message.member &&
        message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!esAdmin) {
        return message.reply('⛔ Este comando es solo para administradores.');
      }
    }

    // 6) Si MongoDB está caído, avisar en lugar de crashear (!help sí funciona)
    if (comando.name !== 'help' && !dbLista()) {
      return message.reply('⚠️ La base de datos no está disponible ahora mismo. Intenta de nuevo en un rato.');
    }

    // 7) try/catch global: ningún comando puede tumbar el bot
    try {
      await comando.execute(message, args, client);
    } catch (error) {
      console.error(`❌ Error en el comando "${comando.name}":`, error);
      message.reply('❌ Ocurrió un error ejecutando el comando. Intenta de nuevo.').catch(() => {});
    }
  },
};
