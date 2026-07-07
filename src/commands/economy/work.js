// ============================================================================
// !work — Gana Maricoins aleatorios.
// Cooldown anti-spam guardado en MongoDB (campo lastWork).
// ============================================================================

const getOrCreateUser = require('../../utils/getOrCreateUser');
const formatMoney = require('../../utils/formatMoney');
const { tiempoRestante, formatearTiempo } = require('../../utils/cooldowns');

const COOLDOWN_MS = 60 * 1000; // 1 minuto — cámbialo aquí si quieres
const MIN = 25;                // mínimo que puedes ganar
const MAX = 120;               // máximo que puedes ganar

const TRABAJOS = [
  'arreglaste el reloj de la torre 🕰️',
  'fuiste DJ en la fiesta del server 🎧',
  'moderaste el chat durante una pelea épica 🛡️',
  'vendiste empanadas en la plaza 🥟',
  'programaste un bot para otro server 💻',
];

module.exports = {
  name: 'work',
  aliases: ['trabajar'],
  description: 'Trabaja y gana Maricoins aleatorios (con cooldown)',
  usage: 'work',
  async execute(message) {
    const user = await getOrCreateUser(message.author);

    // Cooldown anti-spam leído desde la base de datos
    const restante = tiempoRestante(user.lastWork, COOLDOWN_MS);
    if (restante > 0) {
      return message.reply(`⏳ Estás cansado. Podrás trabajar de nuevo en **${formatearTiempo(restante)}**.`);
    }

    const ganancia = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
    const trabajo = TRABAJOS[Math.floor(Math.random() * TRABAJOS.length)];

    user.balance += ganancia;
    user.workCount += 1;
    user.lastWork = new Date();
    await user.save();

    await message.reply(
      `💼 Trabajaste: ${trabajo}\nGanaste ${formatMoney(ganancia)}. Ahora tienes ${formatMoney(user.balance)}.`
    );
  },
};
