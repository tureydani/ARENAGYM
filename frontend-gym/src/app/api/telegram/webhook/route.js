import { NextResponse } from 'next/server';
import { Conversacion, Mensaje } from '@/lib/db/models';
import { buscarClientePorTelegramId } from '@/lib/ai/tools/cliente';
import { procesarMensaje } from '@/lib/ai/agent';
import { enviarMensaje } from '@/lib/telegram/client';

const HISTORIAL_MAX_MENSAJES = 20;

async function obtenerOCrearConversacion(chatId) {
  let conversacion = await Conversacion.findOne({
    where: { canal: 'telegram', chat_id: chatId }
  });

  if (!conversacion) {
    conversacion = await Conversacion.create({ canal: 'telegram', chat_id: chatId });
  } else if (conversacion.estado === 'cerrada') {
    // Si el cliente vuelve a escribir después de que se cerró, se reabre.
    await conversacion.update({ estado: 'activa' });
  }

  return conversacion;
}

async function obtenerHistorial(idConversacion) {
  const mensajes = await Mensaje.findAll({
    where: { id_conversacion: idConversacion },
    order: [['fecha_hora', 'DESC']],
    limit: HISTORIAL_MAX_MENSAJES
  });
  return mensajes.reverse();
}

export async function POST(request) {
  const secretoEsperado = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secretoEsperado) {
    const secretoRecibido = request.headers.get('x-telegram-bot-api-secret-token');
    if (secretoRecibido !== secretoEsperado) {
      return NextResponse.json({ error: 'secreto inválido' }, { status: 401 });
    }
  }

  const update = await request.json();
  const mensajeTelegram = update.message;

  // Ignoramos updates sin texto (fotos, stickers, ediciones, etc.) por ahora.
  if (!mensajeTelegram || typeof mensajeTelegram.text !== 'string') {
    return NextResponse.json({ ok: true });
  }

  const chatId = mensajeTelegram.chat.id;
  const texto = mensajeTelegram.text;

  try {
    const conversacion = await obtenerOCrearConversacion(chatId);

    // El chat ya puede estar siendo atendido por un humano: el agente no
    // interviene hasta que un administrativo cierre o reactive la conversación.
    if (conversacion.estado === 'esperando_humano') {
      await Mensaje.create({ id_conversacion: conversacion.id_conversacion, emisor: 'cliente', contenido: texto });
      return NextResponse.json({ ok: true });
    }

    const cliente = await buscarClientePorTelegramId(chatId);
    const historialPrevio = await obtenerHistorial(conversacion.id_conversacion);

    await Mensaje.create({ id_conversacion: conversacion.id_conversacion, emisor: 'cliente', contenido: texto });

    const contexto = {
      idUsuario: cliente?.id_usuario ?? null,
      idConversacion: conversacion.id_conversacion,
      chatId
    };

    const { respuesta, derivadoHumano } = await procesarMensaje({
      contexto,
      historial: historialPrevio.map((m) => ({ emisor: m.emisor, contenido: m.contenido })),
      mensaje: texto
    });

    await Mensaje.create({ id_conversacion: conversacion.id_conversacion, emisor: 'agente', contenido: respuesta });
    await conversacion.update({
      fecha_ultimo_mensaje: new Date(),
      estado: derivadoHumano ? 'esperando_humano' : 'activa'
    });

    await enviarMensaje(chatId, respuesta);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[telegram/webhook] error procesando mensaje:', error);
    // Siempre 200 hacia Telegram para que no reintente indefinidamente;
    // el error ya quedó en los logs del servidor.
    return NextResponse.json({ ok: true });
  }
}
