// ============================================================================
// User.js — Modelo de usuario. Se guarda en la colección "users"
// de la base de datos "discordSystem".
// ============================================================================

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true }, // ID de Discord
  username:  { type: String, default: 'Desconocido' },       // nombre visible
  balance:   { type: Number, default: 0 },                   // Maricoins
  inventory: { type: [String], default: [] },                // ej: ['escudo', 'escudo', 'pocion']
  lastWork:  { type: Date, default: null },                  // cooldown de !work
  lastDaily: { type: Date, default: null },                  // cooldown de !daily
  workCount: { type: Number, default: 0 },                   // trabajos realizados
  createdAt: { type: Date, default: Date.now },              // fecha de creación del perfil
});

module.exports = mongoose.model('User', userSchema);
