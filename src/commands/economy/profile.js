// ============================================================================
// !profile — Muestra el perfil: nombre, Maricoins, inventario,
// trabajos realizados y fecha de creación del perfil.
// ============================================================================

const { EmbedBuilder } = require('discord.js');
const getOrCreateUser = require('../../utils/getOrCreateUser');

module.exports = {
  name: 'profile',
  aliases: ['perfil'],
  description: 'Muestra tu perfil',
  usage: 'profile',
  async execute(message) {
    const user = await getOrCreateUser(message.author);

    // Inventario agrupado en una línea: "escudo x2, pocion x1"
    const conteo = {};
    for (const item of user.inventory) {
      conteo[item] = (conteo[item] || 0) + 1;
    }
    const inventarioTexto =
      Object.entries(conteo).map(([i, c]) => `${i} x${c}`).join(', ') || 'Vacío';

    const fechaCreacion = new Date(user.createdAt).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`📋 Perfil de ${user.username}`)
      .setThumbnail(message.author.displayAvatarURL())
      .addFields(
        { name: '💰 Maricoins', value: user.balance.toLocaleString('es'), inline: true },
        { name: '💼 Trabajos realizados', value: String(user.workCount), inline: true },
        { name: '🎒 Inventario', value: inventarioTexto },
        { name: '📅 Perfil creado', value: fechaCreacion }
      );

    await message.reply({ embeds: [embed] });
  },
};
