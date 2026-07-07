// ============================================================================
// database.js — Conexión a MongoDB Atlas con mongoose.
// Si la conexión falla, el bot NO crashea: los comandos avisan al usuario.
// ============================================================================

const mongoose = require('mongoose');

async function connectDB() {
  // Listeners para ver el estado de la conexión en la consola
  mongoose.connection.on('connected', () => {
    console.log('✅ Conectado a MongoDB Atlas (base de datos: discordSystem)');
  });
  mongoose.connection.on('error', (err) => {
    console.error('❌ Error de MongoDB:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  Desconectado de MongoDB. Mongoose intentará reconectar...');
  });

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'discordSystem',          // fuerza el nombre de la base de datos
      serverSelectionTimeoutMS: 10000,  // máximo 10s esperando al cluster
    });
  } catch (error) {
    console.error('❌ No se pudo conectar a MongoDB:', error.message);
    console.error('   El bot sigue encendido, pero la economía no funcionará hasta que Mongo responda.');
  }
}

// true si la conexión está lista para usarse (1 = connected)
function dbLista() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, dbLista };
