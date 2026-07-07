// ============================================================================
// bot.js — Punto de entrada de "System Bot"
// Carga el .env, los comandos, los eventos, conecta la base de datos
// y enciende el bot. Si MongoDB falla, el bot NO se cae.
// ============================================================================

const path = require('node:path');
const fs = require('node:fs');

// Cargar el .env desde la RAÍZ del proyecto (funciona sin importar desde
// qué carpeta ejecutes "node src/bot.js")
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { connectDB } = require('./database');

// ---------- Validar variables de entorno (nunca hardcodear secretos) ----------
if (!process.env.TOKEN || !process.env.MONGO_URI) {
  console.error('❌ Faltan variables en el .env (TOKEN y/o MONGO_URI).');
  console.error('   El archivo .env debe estar en la raíz del proyecto.');
  process.exit(1);
}

// ---------- Cliente de Discord ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // OJO: requiere activar "Message Content Intent" en el Developer Portal
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.prefix = process.env.PREFIX || '!';

// ---------- Cargar comandos: src/commands/<categoria>/*.js ----------
const commandsPath = path.join(__dirname, 'commands');
for (const categoria of fs.readdirSync(commandsPath)) {
  const categoriaPath = path.join(commandsPath, categoria);
  if (!fs.statSync(categoriaPath).isDirectory()) continue;

  for (const archivo of fs.readdirSync(categoriaPath).filter((f) => f.endsWith('.js'))) {
    const comando = require(path.join(categoriaPath, archivo));

    if (!comando.name || typeof comando.execute !== 'function') {
      console.warn(`⚠️  Comando ignorado (formato inválido): ${categoria}/${archivo}`);
      continue;
    }

    comando.category = categoria; // usado por !help para agrupar
    client.commands.set(comando.name, comando);
  }
}
console.log(`📦 Comandos cargados: ${client.commands.size}`);

// ---------- Cargar eventos: src/events/*.js ----------
const eventsPath = path.join(__dirname, 'events');
for (const archivo of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
  const evento = require(path.join(eventsPath, archivo));

  if (evento.once) {
    client.once(evento.name, (...args) => evento.execute(...args, client));
  } else {
    client.on(evento.name, (...args) => evento.execute(...args, client));
  }
}

// ---------- Errores globales: que nada tumbe el bot ----------
process.on('unhandledRejection', (error) => {
  console.error('❌ Promesa rechazada sin manejar:', error);
});
process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
});

// ---------- Arranque ----------
(async () => {
  // Si Mongo falla, connectDB solo avisa por consola: el bot sigue vivo
  await connectDB();

  try {
    await client.login(process.env.TOKEN);
  } catch (error) {
    console.error('❌ No se pudo iniciar sesión en Discord. ¿El TOKEN es correcto?');
    console.error('   Detalle:', error.message);
    process.exit(1);
  }
})();
