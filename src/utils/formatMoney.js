// ============================================================================
// formatMoney.js — Formatea cantidades de Maricoins.
// Ejemplo: formatMoney(1500) -> "💰 1.500 Maricoins"
// ============================================================================

function formatMoney(cantidad) {
  return `💰 ${Number(cantidad).toLocaleString('es')} Maricoins`;
}

module.exports = formatMoney;
