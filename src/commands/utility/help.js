// ============================================================================
// !help — Lista todos los comandos, agrupados por categoría.
// Se genera solo a partir de los comandos cargados: si agregas
// un comando nuevo, aparece aquí automáticamente.
// ============================================================================

const { EmbedBuilder } = require('discord.js');

const NOMBRES_CATEGORIA = {
  economy: '💰 Economía',
  admin: '🛠️ Administración',
  utility: '🔧 Utilidad',
};

module.exports = {
  name: 'shelp',
  aliases: ['ayuda', 'comandos'],
  description: 'Muestra esta lista de comandos',
  usage: 'shelp',
  async execute(message, args, client) {
    // Agrupar comandos por categoría
    const porCategoria = {};
    for (const comando of client.commands.values()) {
      const categoria = comando.category || 'otros';
      if (!porCategoria[categoria]) porCategoria[categoria] = [];
      porCategoria[categoria].push(
        `\`${client.prefix}${comando.usage || comando.name}\` — ${comando.description}`
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🤖 System Bot — Comandos')
      .setDescription(`Prefijo: \`${client.prefix}\``);

    for (const [categoria, lista] of Object.entries(porCategoria)) {
      embed.addFields({
        name: NOMBRES_CATEGORIA[categoria] || categoria,
        value: lista.join('\n'),
      });
    }

    await message.reply({ embeds: [embed] });
  },
};
