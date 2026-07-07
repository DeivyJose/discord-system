// ============================================================================
// !shop — Muestra la tienda.
// El catálogo TIENDA se exporta para que !buy use exactamente
// los mismos items y precios (una sola fuente de verdad).
// ============================================================================

const TIENDA = {
  escudo: { precio: 150, emoji: '🛡️', descripcion: 'Protección del server' },
  vip24h: { precio: 500, emoji: '⭐', descripcion: 'Estatus VIP por 24 horas' },
  pocion: { precio: 75,  emoji: '🧪', descripcion: 'Una poción misteriosa' },
};

module.exports = {
  name: 'shop',
  aliases: ['tienda'],
  description: 'Muestra la tienda de items',
  usage: 'shop',
  items: TIENDA, // <- lo usa buy.js
  async execute(message, args, client) {
    const lineas = Object.entries(TIENDA).map(
      ([nombre, item]) => `${item.emoji} **${nombre}** — 💰 ${item.precio} Maricoins · ${item.descripcion}`
    );

    await message.channel.send(
      `🛒 **TIENDA** 🛒\n${lineas.join('\n')}\n\nCompra con: \`${client.prefix}buy <item>\``
    );
  },
};
