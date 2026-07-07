// ============================================================================
// !removemoney @usuario cantidad — (ADMIN) Quita Maricoins a un usuario.
// El saldo nunca baja de 0.
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');
const formatMoney = require('../../utils/formatMoney');

module.exports = {
  name: 'removemoney',
  aliases: ['quitardinero'],
  description: '(Admin) Quita Maricoins a un usuario',
  usage: 'removemoney @usuario cantidad',
  adminOnly: true,
  async execute(message, args, client) {
    const objetivo = message.mentions.users.find((u) => message.content.includes(u.id));
    const argCantidad = args.find((a) => /^\d+$/.test(a));
    const cantidad = parseInt(argCantidad, 10);

    if (!objetivo || objetivo.bot) {
      return message.reply(`❓ Menciona a un usuario válido. Ejemplo: \`${client.prefix}removemoney @usuario 100\``);
    }
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
      return message.reply('❌ La cantidad debe ser un número entero mayor que 0.');
    }

    const user = await getOrCreateUser(objetivo);
    user.balance = Math.max(0, user.balance - cantidad); // nunca negativo
    await user.save();

    await message.reply(
      `✅ Le quitaste ${formatMoney(cantidad)} a **${objetivo.username}**. Nuevo saldo: ${formatMoney(user.balance)}.`
    );
  },
};
