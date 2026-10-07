// Índice de evolución física (0-100): indicador INTERNO de seguimiento del
// gimnasio, no una medición médica. Se calcula una vez por evaluación
// (Progreso), combinando lo que esa evaluación realmente trae disponible:
// medidas manuales, proporciones geométricas, postura, simetría y la
// calidad/consistencia del análisis de visión artificial.
//
// Decisión de diseño importante: el índice NO juzga si un hombro-cadera
// alto o bajo es "mejor" (eso sería una afirmación estética/médica que la
// sección 11 del pedido prohíbe explícitamente). Lo que mide es:
//   1) Qué tan COMPLETA y consistente es la evaluación (cuántos datos hay,
//      con qué confianza se detectó la pose, qué tan alineada/simétrica
//      se ve la postura de forma neutral).
//   2) Para peso/altura (único dato con un rango de referencia ampliamente
//      aceptado, el IMC), qué tan cerca está del rango saludable estándar
//      de la OMS -- documentado abajo, nunca presentado como diagnóstico.
//
// Si a una evaluación le faltan componentes completos (ej. no tiene fotos
// todavía), los pesos de los componentes faltantes se redistribuyen
// proporcionalmente entre los disponibles, en vez de penalizar la
// evaluación por no tener ese dato.

const PESOS = Object.freeze({
  medidasManuales: 0.30,
  proporciones: 0.25,
  postura: 0.20,
  simetria: 0.15,
  consistencia: 0.10,
});

function clamp(valor, min = 0, max = 100) {
  return Math.max(min, Math.min(max, valor));
}

/**
 * Puntaje de IMC: 100 en el centro del rango saludable OMS (18.5-24.9,
 * centro ~21.7) y decae simétricamente hacia afuera. Es una referencia
 * poblacional general, no una evaluación clínica individual.
 */
function puntajeImc(imc) {
  const CENTRO = 21.7;
  const ANCHO = 9; // a +/-9 de IMC respecto al centro, el puntaje llega a ~0
  const distancia = Math.abs(imc - CENTRO);
  return clamp(100 * Math.max(0, 1 - distancia / ANCHO));
}

/**
 * Componente "medidas manuales": si hay peso+altura, 60% IMC + 40%
 * completitud de las demás medidas manuales; si no, solo completitud.
 */
function scoreMedidasManuales(progreso) {
  const campos = ['peso', 'cintura', 'pecho', 'brazo', 'pierna', 'cadera', 'porcentaje_grasa'];
  const llenos = campos.filter((c) => progreso[c] !== null && progreso[c] !== undefined).length;
  const completitud = (llenos / campos.length) * 100;

  const peso = progreso.peso !== null && progreso.peso !== undefined ? Number(progreso.peso) : null;
  const altura = progreso.altura !== null && progreso.altura !== undefined ? Number(progreso.altura) : null;

  if (peso && altura && altura > 0) {
    const alturaMetros = altura > 3 ? altura / 100 : altura; // admite altura en cm o m
    const imc = peso / (alturaMetros * alturaMetros);
    return 0.6 * puntajeImc(imc) + 0.4 * completitud;
  }
  return completitud;
}

/**
 * Componente "proporciones": cobertura de métricas geométricas calculadas
 * (no su valor -- ver nota de diseño arriba). Cuantas más proporciones se
 * lograron calcular a partir de las fotos, más completo es el seguimiento.
 */
function scoreProporciones(metricas) {
  if (!metricas) return null;
  const campos = [
    'ancho_hombros_relativo', 'ancho_cadera_relativo', 'relacion_hombros_cadera',
    'torso_relativo', 'brazo_relativo', 'pierna_relativa',
  ];
  const disponibles = campos.filter((c) => metricas[c] !== null && metricas[c] !== undefined).length;
  if (disponibles === 0) return null;
  return (disponibles / campos.length) * 100;
}

/**
 * Componente "postura": qué tan neutral/alineada se ve la postura
 * (inclinaciones de hombro/cadera cercanas a 0°), sin interpretar si eso
 * es "bueno" en sentido médico, solo si la foto refleja una postura
 * estable y comparable con evaluaciones futuras.
 */
function scorePostura(metricas) {
  if (!metricas || metricas.inclinacion_hombros === null || metricas.inclinacion_hombros === undefined) return null;
  const inclinacionHombros = Math.abs(Number(metricas.inclinacion_hombros ?? 0));
  const inclinacionCadera = Math.abs(Number(metricas.inclinacion_cadera ?? 0));
  const alineacion = metricas.alineacion_postural !== null && metricas.alineacion_postural !== undefined
    ? Number(metricas.alineacion_postural) * 100
    : null;

  const penalizacion = clamp((inclinacionHombros + inclinacionCadera) * 2.5, 0, 100);
  const porInclinacion = 100 - penalizacion;

  if (alineacion === null) return porInclinacion;
  return (porInclinacion + alineacion) / 2;
}

/** Componente "simetría": promedio directo de los índices de simetría (0-1 -> 0-100). */
function scoreSimetria(metricas) {
  if (!metricas) return null;
  const campos = ['simetria_hombros', 'simetria_cadera', 'simetria_brazos', 'simetria_piernas'];
  const valores = campos
    .map((c) => metricas[c])
    .filter((v) => v !== null && v !== undefined)
    .map(Number);
  if (valores.length === 0) return null;
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  return clamp(promedio * 100);
}

/** Componente "consistencia/calidad": confianza media del análisis de pose. */
function scoreConsistencia(metricas) {
  if (!metricas || metricas.confianza_media === null || metricas.confianza_media === undefined) return null;
  return clamp(Number(metricas.confianza_media) * 100);
}

/**
 * Calcula el índice de evolución física (0-100) para una evaluación.
 * @param {object} progreso - fila de Progreso (peso, altura, cintura, ...)
 * @param {object|null} metricas - fila de MetricaFisica asociada, o null si
 *   la evaluación todavía no tiene fotos analizadas.
 * @returns {number|null} índice redondeado a 2 decimales, o null si no hay
 *   ningún componente calculable (evaluación vacía).
 */
function calcularIndiceEvolucion(progreso, metricas) {
  const componentes = {
    medidasManuales: scoreMedidasManuales(progreso),
    proporciones: scoreProporciones(metricas),
    postura: scorePostura(metricas),
    simetria: scoreSimetria(metricas),
    consistencia: scoreConsistencia(metricas),
  };

  const disponibles = Object.entries(componentes).filter(([, v]) => v !== null);
  if (disponibles.length === 0) return null;

  const pesoTotalDisponible = disponibles.reduce((suma, [clave]) => suma + PESOS[clave], 0);

  const indice = disponibles.reduce((suma, [clave, valor]) => {
    const pesoRedistribuido = PESOS[clave] / pesoTotalDisponible;
    return suma + valor * pesoRedistribuido;
  }, 0);

  return Math.round(indice * 100) / 100;
}

export { calcularIndiceEvolucion, PESOS };
