// ============================================================================
// !buy <item> — Compra un item de la tienda: resta Maricoins
// y guarda el item en el inventario del usuario.
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');
const formatMoney = require('../../utils/formatMoney');
const { items: TIENDA } = require('./shop');

module.exports = {
  name: 'buy',
  aliases: ['comprar'],
  description: 'Compra un item de la tienda',
  usage: 'buy <item>',
  async execute(message, args, client) {
    const nombreItem = (args[0] || '').toLowerCase();

    // Validar que el item exista en la tienda
    if (!nombreItem || !TIENDA[nombreItem]) {
      const disponibles = Object.keys(TIENDA).map((i) => `\`${i}\``).join(', ');
      return message.reply(
        `❓ Item inválido. Disponibles: ${disponibles}\nEjemplo: \`${client.prefix}buy escudo\``
      );
    }

    const item = TIENDA[nombreItem];
    const user = await getOrCreateUser(message.author);

    // Validar saldo suficiente
    if (user.balance < item.precio) {
      return message.reply(
        `❌ No te alcanza. **${nombreItem}** cuesta ${formatMoney(item.precio)} y tienes ${formatMoney(user.balance)}.`
      );
    }

    user.balance -= item.precio;
    user.inventory.push(nombreItem);
    await user.save();

    await message.reply(
      `✅ Compraste ${item.emoji} **${nombreItem}** por ${formatMoney(item.precio)}. Te quedan ${formatMoney(user.balance)}.`
    );
  },
};
