// ============================================================================
// !addmoney @usuario cantidad — (ADMIN) Añade Maricoins a un usuario.
// El permiso Administrator se verifica en events/messageCreate.js
// gracias a la propiedad adminOnly: true.
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');
const formatMoney = require('../../utils/formatMoney');

module.exports = {
  name: 'addmoney',
  aliases: ['agregardinero'],
  description: '(Admin) Añade Maricoins a un usuario',
  usage: 'addmoney @usuario cantidad',
  adminOnly: true,
  async execute(message, args, client) {
    const objetivo = message.mentions.users.find((u) => message.content.includes(u.id));
    const argCantidad = args.find((a) => /^\d+$/.test(a));
    const cantidad = parseInt(argCantidad, 10);

    if (!objetivo || objetivo.bot) {
      return message.reply(`❓ Menciona a un usuario válido. Ejemplo: \`${client.prefix}addmoney @usuario 100\``);
    }
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
      return message.reply('❌ La cantidad debe ser un número entero mayor que 0.');
    }

    const user = await getOrCreateUser(objetivo);
    user.balance += cantidad;
    await user.save();

    await message.reply(
      `✅ Añadiste ${formatMoney(cantidad)} a **${objetivo.username}**. Nuevo saldo: ${formatMoney(user.balance)}.`
    );
  },
};
