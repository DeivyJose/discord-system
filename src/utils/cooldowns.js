// ============================================================================
// cooldowns.js — Utilidades para cooldowns guardados en MongoDB
// (campos lastWork y lastDaily del modelo User).
// ============================================================================

/**
 * Milisegundos que faltan para poder usar el comando otra vez.
 * @param {Date|null} ultimaVez  Fecha guardada en la BD (lastWork / lastDaily)
 * @param {number} duracionMs    Duración del cooldown en milisegundos
 * @returns {number} 0 si ya puede usarlo; si no, los ms que faltan
 */
function tiempoRestante(ultimaVez, duracionMs) {
  if (!ultimaVez) return 0;
  const transcurrido = Date.now() - new Date(ultimaVez).getTime();
  return transcurrido >= duracionMs ? 0 : duracionMs - transcurrido;
}

/**
 * Convierte milisegundos a texto legible.
 * Ejemplo: 5430000 -> "1h 30m 30s"
 */
function formatearTiempo(ms) {
  const totalSegundos = Math.ceil(ms / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  const partes = [];
  if (horas > 0) partes.push(`${horas}h`);
  if (minutos > 0) partes.push(`${minutos}m`);
  if (segundos > 0 || partes.length === 0) partes.push(`${segundos}s`);
  return partes.join(' ');
}

module.exports = { tiempoRestante, formatearTiempo };
