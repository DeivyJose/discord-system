// ============================================================================
// !balance — Muestra tus Maricoins.
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');
const formatMoney = require('../../utils/formatMoney');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'dinero'],
  description: 'Muestra tus Maricoins',
  usage: 'balance',
  async execute(message) {
    const user = await getOrCreateUser(message.author);
    await message.reply(`Tienes ${formatMoney(user.balance)}`);
  },
};
