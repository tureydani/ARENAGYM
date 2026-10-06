// Registra (o reemplaza) el webhook de Telegram para este bot.
//
// Uso:
//   node scripts/set-telegram-webhook.js https://tu-dominio.vercel.app
//
// Requiere TELEGRAM_BOT_TOKEN en el entorno (y TELEGRAM_WEBHOOK_SECRET si
// se usó al configurar el bot, para que Telegram lo mande de vuelta en cada
// request y el webhook pueda verificarlo).
const fs = require('fs');
const path = require('path');

// Carga manual de .env.local (no hay `dotenv` instalado en el proyecto y
// no queremos agregar una dependencia nueva solo para esto).
function cargarEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const contenido = fs.readFileSync(envPath, 'utf-8');
  for (const linea of contenido.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const idx = limpia.indexOf('=');
    if (idx === -1) continue;
    const clave = limpia.slice(0, idx).trim();
    const valor = limpia.slice(idx + 1).trim();
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

cargarEnvLocal();

async function main() {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error('Uso: node scripts/set-telegram-webhook.js https://tu-dominio.com');
    process.exit(1);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('Falta TELEGRAM_BOT_TOKEN en .env.local');
    process.exit(1);
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  const body = { url };
  if (process.env.TELEGRAM_WEBHOOK_SECRET) {
    body.secret_token = process.env.TELEGRAM_WEBHOOK_SECRET;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log(data);
}

main();
