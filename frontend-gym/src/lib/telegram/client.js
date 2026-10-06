function getBaseUrl() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('Falta la variable de entorno TELEGRAM_BOT_TOKEN');
  }
  return `https://api.telegram.org/bot${token}`;
}

async function enviarMensaje(chatId, texto) {
  const res = await fetch(`${getBaseUrl()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto })
  });

  if (!res.ok) {
    const detalle = await res.text();
    throw new Error(`Telegram sendMessage falló (${res.status}): ${detalle}`);
  }
}

export { enviarMensaje };
