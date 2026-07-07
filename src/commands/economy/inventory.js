// ============================================================================
// !inv — Muestra el inventario agrupado (escudo x2, pocion x4...).
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');

module.exports = {
  name: 'inv',
  aliases: ['inventory', 'inventario'],
  description: 'Muestra tu inventario',
  usage: 'inv',
  async execute(message) {
    const user = await getOrCreateUser(message.author);

    if (user.inventory.length === 0) {
      return message.reply('🎒 Tu inventario está vacío. Mira la tienda con `!shop`.');
    }

    // Agrupar: ['escudo','escudo','pocion'] -> { escudo: 2, pocion: 1 }
    const conteo = {};
    for (const item of user.inventory) {
      conteo[item] = (conteo[item] || 0) + 1;
    }

    const lineas = Object.entries(conteo).map(([item, cantidad]) => `${item} x${cantidad}`);

    await message.reply(`🎒 **Inventario de ${message.author.username}:**\n${lineas.join('\n')}`);
  },
};
