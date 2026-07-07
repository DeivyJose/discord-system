// ============================================================================
// !top — Ranking de los usuarios más ricos.
// ============================================================================

const User = require('../../models/User');

module.exports = {
  name: 'top',
  aliases: ['ranking', 'ricos'],
  description: 'Ranking de los usuarios más ricos',
  usage: 'top',
  async execute(message) {
    // Los 10 usuarios con más balance, de mayor a menor
    const top = await User.find().sort({ balance: -1 }).limit(10);

    if (top.length === 0) {
      return message.reply('Todavía no hay nadie en el ranking. ¡Usa `!work` para empezar!');
    }

    const lineas = top.map(
      (u, i) => `${i + 1}. ${u.username} tiene: 💰 ${u.balance.toLocaleString('es')} Maricoins`
    );

    await message.channel.send(`🏆 TOP RICOS 🏆\n${lineas.join('\n')}`);
  },
};
