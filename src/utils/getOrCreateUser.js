// ============================================================================
// getOrCreateUser.js — Busca un usuario en la base de datos o lo crea.
// Recibe un usuario de Discord (message.author o un usuario mencionado).
// ============================================================================

const User = require('../models/User');

async function getOrCreateUser(discordUser) {
  let user = await User.findOne({ userId: discordUser.id });

  if (!user) {
    user = await User.create({
      userId: discordUser.id,
      username: discordUser.username,
    });
  } else if (user.username !== discordUser.username) {
    // Mantener el nombre actualizado (para que !top y !profile muestren el real)
    user.username = discordUser.username;
    await user.save();
  }

  return user;
}

module.exports = getOrCreateUser;
