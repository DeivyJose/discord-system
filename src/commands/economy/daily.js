// ============================================================================
// !daily — Recompensa diaria.
// Cooldown de 24 horas guardado en MongoDB (campo lastDaily).
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');
const formatMoney = require('../../utils/formatMoney');
const { tiempoRestante, formatearTiempo } = require('../../utils/cooldowns');

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas
const RECOMPENSA = 200;                  // Maricoins por día — cámbialo aquí

module.exports = {
  name: 'daily',
  aliases: ['diario'],
  description: 'Reclama tu recompensa diaria',
  usage: 'daily',
  async execute(message) {
    const user = await getOrCreateUser(message.author);

    const restante = tiempoRestante(user.lastDaily, COOLDOWN_MS);
    if (restante > 0) {
      return message.reply(`⏳ Ya reclamaste tu recompensa. Vuelve en **${formatearTiempo(restante)}**.`);
    }

    user.balance += RECOMPENSA;
    user.lastDaily = new Date();
    await user.save();

    await message.reply(
      `🎁 ¡Recompensa diaria! Recibiste ${formatMoney(RECOMPENSA)}. Ahora tienes ${formatMoney(user.balance)}.`
    );
  },
};
