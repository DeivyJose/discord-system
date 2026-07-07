// ============================================================================
// !setmoney @usuario cantidad — (ADMIN) Fija el saldo exacto de un usuario.
// Acepta 0 o más (nunca negativo).
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');
const formatMoney = require('../../utils/formatMoney');

module.exports = {
  name: 'setmoney',
  aliases: ['fijardinero'],
  description: '(Admin) Fija el saldo exacto de un usuario',
  usage: 'setmoney @usuario cantidad',
  adminOnly: true,
  async execute(message, args, client) {
    const objetivo = message.mentions.users.find((u) => message.content.includes(u.id));
    const argCantidad = args.find((a) => /^\d+$/.test(a));
    const cantidad = parseInt(argCantidad, 10);

    if (!objetivo || objetivo.bot) {
      return message.reply(`❓ Menciona a un usuario válido. Ejemplo: \`${client.prefix}setmoney @usuario 100\``);
    }
    if (argCantidad === undefined || !Number.isSafeInteger(cantidad) || cantidad < 0) {
      return message.reply('❌ La cantidad debe ser un número entero de 0 en adelante.');
    }

    const user = await getOrCreateUser(objetivo);
    user.balance = cantidad;
    await user.save();

    await message.reply(`✅ El saldo de **${objetivo.username}** ahora es ${formatMoney(user.balance)}.`);
  },
};
