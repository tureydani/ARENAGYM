import { Usuario } from '@/lib/db/models';

// Busca un cliente activo por teléfono, para el onboarding del bot
// (vincular el chat_id de Telegram con su cuenta ya existente en Arena Gym).
async function buscarClientePorTelefono(telefono) {
  const limpio = String(telefono).replace(/\D/g, '');
  if (!limpio) return null;

  const usuario = await Usuario.findOne({ where: { telefono: limpio } });
  if (!usuario) return null;

  return {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    apellido: usuario.apellido
  };
}

async function vincularTelegram(idUsuario, telegramUserId) {
  await Usuario.update(
    { telegram_user_id: telegramUserId },
    { where: { id_usuario: idUsuario } }
  );
}

async function buscarClientePorTelegramId(telegramUserId) {
  const usuario = await Usuario.findOne({ where: { telegram_user_id: telegramUserId } });
  if (!usuario) return null;

  return {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    apellido: usuario.apellido
  };
}

export { buscarClientePorTelefono, vincularTelegram, buscarClientePorTelegramId };
