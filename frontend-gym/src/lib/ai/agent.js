import { GoogleGenerativeAI } from '@google/generative-ai';
import { declaraciones, ejecutarHerramienta } from './tools';
import systemConfig from './config/system.json';
import knowledge from './config/knowledge.json';
import rules from './config/rules.json';

const MAX_PASOS_HERRAMIENTAS = 4;

function construirInstruccionSistema() {
  return [
    `Eres ${systemConfig.nombre}, ${systemConfig.rol}.`,
    `Hablas en ${systemConfig.idioma === 'es' ? 'español' : systemConfig.idioma}, con un tono ${systemConfig.tono.join(', ')}.`,
    systemConfig.comportamiento?.usar_emojis ? 'Puedes usar emojis con moderación.' : 'No uses emojis.',
    systemConfig.comportamiento?.respuestas_cortas ? 'Responde de forma breve y directa.' : '',
    systemConfig.comportamiento?.evitar_lenguaje_tecnico ? 'Evita lenguaje técnico.' : '',
    '',
    'Información del gimnasio (puedes responder esto directamente, es información fija):',
    JSON.stringify(knowledge, null, 2),
    '',
    'Reglas que debes seguir siempre:',
    rules.reglas.map((r) => `- ${r}`).join('\n')
  ].filter(Boolean).join('\n');
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno GEMINI_API_KEY');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: construirInstruccionSistema(),
    tools: [{ functionDeclarations: declaraciones }]
  });
}

// Convierte el historial guardado en BD (emisor/contenido) al formato de
// turnos que espera el SDK de Gemini.
function mapearHistorial(historial) {
  return historial.map((m) => ({
    role: m.emisor === 'cliente' ? 'user' : 'model',
    parts: [{ text: m.contenido }]
  }));
}

/**
 * Procesa un mensaje del cliente y devuelve la respuesta del agente.
 *
 * contexto: { idUsuario, idConversacion, chatId } — idUsuario puede ser
 * null si el chat todavía no está vinculado a ningún cliente.
 * historial: mensajes previos de esta conversación, más antiguos primero.
 */
async function procesarMensaje({ contexto, historial, mensaje }) {
  const model = getModel();
  const chat = model.startChat({ history: mapearHistorial(historial) });

  let resultado = await chat.sendMessage(mensaje);

  for (let paso = 0; paso < MAX_PASOS_HERRAMIENTAS; paso += 1) {
    const llamadas = resultado.response.functionCalls();
    if (!llamadas || llamadas.length === 0) break;

    const respuestasHerramientas = [];
    for (const llamada of llamadas) {
      const salida = await ejecutarHerramienta(llamada.name, llamada.args || {}, contexto);
      respuestasHerramientas.push({
        functionResponse: { name: llamada.name, response: salida }
      });
    }

    resultado = await chat.sendMessage(respuestasHerramientas);
  }

  return {
    respuesta: resultado.response.text(),
    derivadoHumano: Boolean(contexto.derivadoHumano)
  };
}

export { procesarMensaje };
