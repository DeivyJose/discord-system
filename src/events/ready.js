// ============================================================================
// ready.js — Se ejecuta UNA vez cuando el bot termina de encender.
// ============================================================================

const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`🤖 ${client.user.tag} está en línea (prefijo: ${client.prefix})`);
    client.user.setActivity(`${client.prefix}shelp | The Clock`);
  },
};
