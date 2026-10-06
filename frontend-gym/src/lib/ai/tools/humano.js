import { Conversacion } from '@/lib/db/models';

// Marca la conversación para que recepción/un administrativo la retome.
// El panel administrativo (futuro) puede listar conversaciones en este
// estado; por ahora solo deja constancia en la base de datos.
async function derivarHumano(idConversacion) {
  await Conversacion.update(
    { estado: 'esperando_humano' },
    { where: { id_conversacion: idConversacion } }
  );
}

export { derivarHumano };
