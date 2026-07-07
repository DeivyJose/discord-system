// ============================================================================
// !pay @usuario cantidad — Transfiere Maricoins a otro usuario.
// Valida: mención real, no bots, no pagarse a sí mismo,
// cantidad entera positiva y saldo suficiente.
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');
const formatMoney = require('../../utils/formatMoney');

module.exports = {
  name: 'pay',
  aliases: ['pagar', 'transferir'],
  description: 'Transfiere Maricoins a otro usuario',
  usage: 'pay @usuario cantidad',
  async execute(message, args, client) {
    // Solo menciones escritas en el mensaje (evita confundir la mención de un reply)
    const destinatario = message.mentions.users.find((u) => message.content.includes(u.id));

    // La cantidad es el primer argumento que sea solo dígitos (rechaza negativos y decimales)
    const argCantidad = args.find((a) => /^\d+$/.test(a));
    const cantidad = parseInt(argCantidad, 10);

    // ---------- Validaciones ----------
    if (!destinatario) {
      return message.reply(`❓ Debes mencionar a alguien. Ejemplo: \`${client.prefix}pay @usuario 100\``);
    }
    if (destinatario.bot) {
      return message.reply('🤖 No puedes pagarle a un bot.');
    }
    if (destinatario.id === message.author.id) {
      return message.reply('🙃 No puedes pagarte a ti mismo.');
    }
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
      return message.reply('❌ La cantidad debe ser un número entero mayor que 0.');
    }

    const emisor = await getOrCreateUser(message.author);

    if (emisor.balance < cantidad) {
      return message.reply(`❌ Saldo insuficiente. Tienes ${formatMoney(emisor.balance)}.`);
    }

    const receptor = await getOrCreateUser(destinatario);

    emisor.balance -= cantidad;
    receptor.balance += cantidad;
    await emisor.save();
    await receptor.save();

    await message.reply(
      `✅ Le transferiste ${formatMoney(cantidad)} a **${destinatario.username}**. Te quedan ${formatMoney(emisor.balance)}.`
    );
  },
};
