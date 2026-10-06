import { buscarClientePorTelefono, vincularTelegram } from './cliente';
import { consultarMembresia, consultarPlanes } from './membresia';
import { consultarPagos } from './pagos';
import { consultarAsistencias } from './asistencia';
import { derivarHumano } from './humano';

// Declaraciones en formato "function calling" de Gemini. El modelo solo ve
// esto: nunca recibe id_usuario ni id_conversacion como parámetro, para que
// no pueda (por error o manipulación del cliente) consultar datos de otra
// persona. Esos IDs los inyecta el agente desde el contexto de la sesión
// (ver agent.js) al ejecutar la herramienta.
const declaraciones = [
  {
    name: 'vincular_cuenta',
    description:
      'Vincula este chat de Telegram con la cuenta del cliente en Arena Gym, a partir de su número de teléfono registrado. Usar cuando el cliente todavía no está identificado y pregunta algo sobre su membresía, pagos o asistencias.',
    parameters: {
      type: 'OBJECT',
      properties: {
        telefono: {
          type: 'STRING',
          description: 'Número de teléfono que el cliente registró en Arena Gym'
        }
      },
      required: ['telefono']
    }
  },
  {
    name: 'consultar_membresia',
    description:
      'Consulta el estado de la membresía vigente del cliente ya identificado: si está activa, días restantes y fecha de vencimiento.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'consultar_planes',
    description:
      'Consulta los planes de membresía disponibles y sus precios actuales. Información pública, no requiere identificar al cliente.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'consultar_pagos',
    description: 'Consulta los últimos pagos registrados del cliente ya identificado.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'consultar_asistencias',
    description:
      'Consulta cuántas veces asistió el cliente ya identificado al gimnasio en los últimos días.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'derivar_humano',
    description:
      'Deriva la conversación a un encargado de recepción. Usar cuando el cliente pide explícitamente hablar con una persona, o cuando la consulta no se puede resolver con las otras herramientas.',
    parameters: { type: 'OBJECT', properties: {} }
  }
];

// Ejecuta una herramienta por nombre. `args` viene del modelo (solo los
// campos declarados arriba); `contexto` viene de la sesión ya resuelta por
// el webhook (id_usuario puede ser null si el chat aún no está vinculado).
async function ejecutarHerramienta(nombre, args, contexto) {
  switch (nombre) {
    case 'vincular_cuenta': {
      const cliente = await buscarClientePorTelefono(args.telefono);
      if (!cliente) {
        return { encontrado: false };
      }
      await vincularTelegram(cliente.id_usuario, contexto.chatId);
      // Importante: así las siguientes herramientas que se llamen en este
      // mismo turno (ej. el modelo vincula y de inmediato pide la membresía)
      // ya usan el cliente recién identificado.
      contexto.idUsuario = cliente.id_usuario;
      return { encontrado: true, nombre: cliente.nombre, apellido: cliente.apellido };
    }

    case 'consultar_membresia': {
      if (!contexto.idUsuario) return { error: 'cliente_no_identificado' };
      return await consultarMembresia(contexto.idUsuario);
    }

    case 'consultar_planes': {
      return await consultarPlanes();
    }

    case 'consultar_pagos': {
      if (!contexto.idUsuario) return { error: 'cliente_no_identificado' };
      return await consultarPagos(contexto.idUsuario);
    }

    case 'consultar_asistencias': {
      if (!contexto.idUsuario) return { error: 'cliente_no_identificado' };
      return await consultarAsistencias(contexto.idUsuario);
    }

    case 'derivar_humano': {
      await derivarHumano(contexto.idConversacion);
      contexto.derivadoHumano = true;
      return { ok: true };
    }

    default:
      return { error: `herramienta_desconocida: ${nombre}` };
  }
}

export { declaraciones, ejecutarHerramienta };
